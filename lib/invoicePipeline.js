// Shared invoice audit pipeline used by both:
//   - /api/modules/invoice/run (internal — ops dashboard)
//   - /v1/invoice/audit       (partner — TMS integration)
//
// Routes are responsible for: auth, body parsing, DB client init, response shape.
// This module is responsible for: everything else in the audit pipeline.

import crypto from 'crypto'
import { runModule, anthropic } from './anthropic.js'
import { enrichEvidenceBatch } from './evidenceEnricher.js'

// ── Carrier name normalisation ─────────────────────────────────────────────
function normaliseCarrier(name) {
  if (!name) return ''
  return String(name)
    .toLowerCase()
    .replace(/\b(ltd|limited|plc|inc|llc|gmbh|group|co|company)\b\.?/gi, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Discrepancy dedupe + math validation ────────────────────────────────────
function dedupeDiscrepancies(discrepancies) {
  if (!Array.isArray(discrepancies)) return []
  const seen = new Map()
  let droppedCount = 0

  for (const d of discrepancies) {
    if (!d || typeof d !== 'object') continue
    const key = `${d.job_ref || ''}|${d.charged || 0}|${d.expected || 0}`
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, d)
    } else {
      droppedCount++
      const incumbentDelta = Number(existing.delta) || 0
      const candidateDelta = Number(d.delta) || 0
      if (candidateDelta > incumbentDelta) {
        console.warn(`[invoice-pipeline] dedupe: replaced ${key} delta ${incumbentDelta} with ${candidateDelta} (issue_type ${d.issue_type})`)
        seen.set(key, d)
      } else {
        console.warn(`[invoice-pipeline] dedupe: dropped ${key} delta ${candidateDelta} (kept ${incumbentDelta} of issue_type ${existing.issue_type})`)
      }
    }
  }

  if (droppedCount > 0) {
    console.warn(`[invoice-pipeline] AI emitted ${droppedCount} duplicate discrepancy entries — review prompt`)
  }
  return Array.from(seen.values())
}

function validatePerLineMath(discrepancies) {
  if (!Array.isArray(discrepancies)) return []

  const byJob = new Map()
  for (const d of discrepancies) {
    const key = d.job_ref || '__unknown'
    if (!byJob.has(key)) byJob.set(key, [])
    byJob.get(key).push(d)
  }

  const validated = []
  for (const [jobRef, items] of byJob) {
    if (items.length === 1) {
      validated.push(items[0])
      continue
    }

    const charged = Number(items[0].charged) || 0
    const expected = Number(items[0].expected) || 0
    const maxOvercharge = Math.max(0, charged - expected)
    const sumDelta = items.reduce((s, d) => s + (Number(d.delta) || 0), 0)

    if (sumDelta > maxOvercharge + 0.01) {
      const largest = items.reduce((best, d) =>
        (Number(d.delta) || 0) > (Number(best.delta) || 0) ? d : best
      )
      console.warn(
        `[invoice-pipeline] math invariant violated for ${jobRef}: ` +
        `sum(deltas)=${sumDelta.toFixed(2)} > max(charged-expected)=${maxOvercharge.toFixed(2)}. ` +
        `Truncating to single largest delta=${largest.delta}.`
      )
      validated.push(largest)
    } else {
      validated.push(...items)
    }
  }
  return validated
}

// ── CSV parser (no deps, supports quoted fields) ───────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }

  const splitRow = (line) => {
    const out = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') { inQuotes = !inQuotes }
      else if (c === ',' && !inQuotes) { out.push(cur); cur = '' }
      else { cur += c }
    }
    out.push(cur)
    return out.map(s => s.trim())
  }

  const headers = splitRow(lines[0]).map(h => h.toLowerCase().replace(/[\s-]+/g, '_'))
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitRow(lines[i])
    if (cells.every(c => c === '')) continue
    const row = {}
    for (let j = 0; j < headers.length; j++) {
      const v = cells[j]
      if (v === undefined || v === '') continue
      if (['charged', 'agreed_rate', 'fuel_surcharge_pct'].includes(headers[j])) {
        const n = Number(v.replace(/[£$,]/g, ''))
        if (!isNaN(n)) row[headers[j]] = n
      } else {
        row[headers[j]] = v
      }
    }
    if (Object.keys(row).length > 0) rows.push(row)
  }
  return { headers, rows }
}

// ── Free-text extraction via Haiku ──────────────────────────────────────────
async function extractFromText(rawText) {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    system: `You are a freight invoice parser. Extract line items from the invoice text.
Return ONLY valid JSON, no preamble or markdown:
{
  "carrier": "string — carrier company name from invoice",
  "invoice_ref": "string — invoice number",
  "invoice_date": "string — ISO date if present, else null",
  "line_items": [
    {
      "job_ref": "string — job/load reference if present, else null",
      "line_description": "string — what was charged for",
      "charged": number,
      "lane_origin": "string or null",
      "lane_destination": "string or null",
      "fuel_surcharge_pct": "number or null — if charged separately or as percentage"
    }
  ]
}
If the text is not a freight invoice, return {"error": "not_an_invoice"}.`,
    messages: [{ role: 'user', content: rawText }]
  })

  const raw = message.content[0].text.trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()

  return JSON.parse(raw)
}

// ── Idempotency hash ────────────────────────────────────────────────────────
function contentHash(clientId, fileContent) {
  return crypto.createHash('sha256').update(fileContent).digest('hex').substring(0, 16)
}

// ── Main pipeline ──────────────────────────────────────────────────────────
export async function auditInvoice({ db, clientId, fileContent, fileType, filename, apiKeyId = null }) {
  if (!db) throw new Error('db_required')
  if (!clientId) throw new Error('client_id_required')
  if (!fileContent) throw new Error('file_content_required')

  const ft = (fileType || '').toLowerCase()
  if (!['csv', 'txt'].includes(ft)) throw new Error('file_type_must_be_csv_or_txt')

  // 1. Idempotency — return existing if same content within 24h
  const hash = contentHash(clientId, fileContent)
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  try {
    const { data: existing } = await db
      .from('invoices')
      .select('id, invoice_ref, carrier, total_charged, total_overcharge, status, dispute_email_to, dispute_email_body, evidence_pack, ai_processed_at')
      .eq('client_id', clientId)
      .eq('source', `hash:${hash}`)
      .gte('created_at', since24h)
      .limit(1)
      .maybeSingle()

    if (existing) {
      return { ...buildResultFromInvoice(existing), duplicate: true }
    }
  } catch (err) {
    console.error('[invoicePipeline] dedup check failed (continuing):', err.message)
  }

  // 2. Parse the file
  let parsed
  if (ft === 'csv') {
    const { rows } = parseCSV(fileContent)
    if (rows.length === 0) throw new Error('no_line_items_found')
    const first = rows[0]
    parsed = {
      invoice_ref: first.invoice_ref || filename || `INV-${hash}`,
      invoice_date: first.invoice_date || null,
      carrier: first.carrier || 'Unknown',
      line_items: rows
    }
  } else {
    parsed = await extractFromText(fileContent)
    if (parsed.error) throw new Error(`parse_failed:${parsed.error}`)
  }

  if (!parsed.line_items || parsed.line_items.length === 0) {
    throw new Error('no_line_items_found')
  }

  // 3. Look up rate cards + shipment rates + client context
  const carrier = parsed.carrier || 'Unknown'
  const normalisedInvoiceCarrier = normaliseCarrier(carrier)
  const jobRefs = [...new Set((parsed.line_items || []).map(li => li.job_ref).filter(Boolean))]

  const [allActiveCardsResult, shipmentRatesResult, clientContextResult] = await Promise.all([
    db.from('rate_cards')
      .select('carrier, lane_origin, lane_destination, service_type, agreed_rate_total, agreed_rate_per_mile, fuel_surcharge_pct_max, waiting_time_per_hour, multi_drop_fee, contract_ref')
      .eq('client_id', clientId)
      .is('effective_to', null),
    jobRefs.length > 0
      ? db.from('shipments')
          .select('ref, agreed_rate, agreed_rate_source, route, carrier, sla_window, cargo_type')
          .eq('client_id', clientId)
          .in('ref', jobRefs)
      : Promise.resolve({ data: [] }),
    db.from('clients')
      .select('name, system_prompt, sector')
      .eq('id', clientId)
      .maybeSingle()
  ])

  const rateCards = (allActiveCardsResult.data || []).filter(rc =>
    normaliseCarrier(rc.carrier) === normalisedInvoiceCarrier
  )
  const shipmentRates = {}
  for (const s of (shipmentRatesResult.data || [])) {
    shipmentRates[s.ref] = s
  }
  const clientData = clientContextResult.data
  const clientContext = clientData
    ? `Client: ${clientData.name} (sector: ${clientData.sector || 'haulage'})\n${clientData.system_prompt || ''}`
    : ''

  // 4. Run AI invoice module
  const aiInput = {
    invoice_ref: parsed.invoice_ref,
    carrier,
    invoice_date: parsed.invoice_date,
    line_items: parsed.line_items,
    rate_cards: rateCards,
    shipment_agreed_rates: shipmentRates,
    instruction: 'Compare each line item against the matching rate card and shipment agreed_rate. Flag fuel surcharge above contracted maximum, duplicate invoice references, charged amounts above agreed rates. For each discrepancy, cite specific evidence (which rate card, which shipment ref, what threshold was exceeded).'
  }

  let aiResult
  try {
    aiResult = await runModule('invoice', aiInput, clientContext, { model: 'claude-sonnet-4-6' })
  } catch (err) {
    console.error('[invoicePipeline] AI invoice module failed:', err.message)
    throw new Error(`ai_module_failed:${err.message}`)
  }

  // 5. Defensive filter — drop non-positive deltas, dedupe, validate math
  const rawDiscrepancies = Array.isArray(aiResult.discrepancies) ? aiResult.discrepancies : []
  const dedupedDiscrepancies = dedupeDiscrepancies(rawDiscrepancies)
  const validatedDiscrepancies = validatePerLineMath(dedupedDiscrepancies)

  const genuineDiscrepancies = validatedDiscrepancies.filter(d => Number(d.delta) > 0)
  const unvalidatedDiscrepancies = validatedDiscrepancies.filter(d =>
    d.issue_type === 'unvalidated' && Number(d.delta) === 0
  )
  const discrepancies = [...genuineDiscrepancies, ...unvalidatedDiscrepancies]

  const totalCharged = (parsed.line_items || []).reduce((s, li) => s + (Number(li.charged) || 0), 0)
  const totalOvercharge = genuineDiscrepancies.reduce((s, d) => s + Number(d.delta), 0)
  const safeOvercharge = Math.max(0, totalOvercharge)
  const totalAgreed = totalCharged - safeOvercharge

  // 6. Evidence enrichment
  let evidenceByRef = {}
  try {
    const refsToEnrich = discrepancies.map(d => d.job_ref).filter(Boolean)
    if (refsToEnrich.length > 0) {
      evidenceByRef = await enrichEvidenceBatch(db, clientId, refsToEnrich)
    }
  } catch (err) {
    console.error('[invoicePipeline] enrichment failed (non-fatal):', err.message)
  }

  const enrichedDiscrepancies = discrepancies.map(d => ({
    ...d,
    operational_evidence: d.job_ref ? (evidenceByRef[d.job_ref] || null) : null
  }))

  // 7. Compose dispute draft when there are genuine overcharges
  let disputeDraft = null
  let disputeContactEmail = null
  let disputeContactName = null

  if (safeOvercharge > 0 && genuineDiscrepancies.length > 0) {
    try {
      const { data: allContacts } = await db
        .from('rate_cards')
        .select('dispute_contact_email, dispute_contact_name, carrier')
        .eq('client_id', clientId)
        .not('dispute_contact_email', 'is', null)
      const matchingContact = (allContacts || []).find(c =>
        normaliseCarrier(c.carrier) === normalisedInvoiceCarrier
      )
      if (matchingContact) {
        disputeContactEmail = matchingContact.dispute_contact_email
        disputeContactName = matchingContact.dispute_contact_name
      }
    } catch (err) {
      console.error('[invoicePipeline] contact lookup failed:', err.message)
    }

    const trimmedForComposer = genuineDiscrepancies.map(d => ({
      job_ref: d.job_ref,
      charged: d.charged,
      expected: d.expected,
      delta: d.delta,
      issue_type: d.issue_type,
      evidence: d.evidence,
      operational_evidence: d.operational_evidence ? {
        summary: d.operational_evidence.summary,
        shipment: d.operational_evidence.shipment ? {
          route: d.operational_evidence.shipment.route,
          sla_window: d.operational_evidence.shipment.sla_window,
          cargo_type: d.operational_evidence.shipment.cargo_type,
          agreed_rate: d.operational_evidence.shipment.agreed_rate
        } : null
      } : null
    }))

    const composerInput = {
      carrier,
      invoice_ref: parsed.invoice_ref,
      invoice_date: parsed.invoice_date,
      total_overcharge: safeOvercharge,
      discrepancies: trimmedForComposer,
      client_name: clientData?.name || 'Operations',
      carrier_contact_name: disputeContactName,
      response_deadline_days: 14
    }

    try {
      disputeDraft = await runModule('dispute_email', composerInput, '', {
        model: 'claude-sonnet-4-6', maxTokens: 2000
      })
    } catch (err) {
      console.error('[invoicePipeline] dispute draft failed (non-fatal):', err.message)
    }
  }

  // 8. Store invoice row
  const invoiceRow = {
    client_id: clientId,
    carrier,
    invoice_ref: parsed.invoice_ref,
    invoice_date: parsed.invoice_date || null,
    line_items: parsed.line_items,
    total_charged: totalCharged,
    total_agreed: totalAgreed,
    total_overcharge: safeOvercharge,
    status: 'pending_review',
    source: `hash:${hash}`,
    ai_processed_at: new Date().toISOString(),
    evidence_pack: enrichedDiscrepancies,
    dispute_email_body: disputeDraft ? JSON.stringify({
      subject: disputeDraft.subject,
      body_text: disputeDraft.body_text,
      body_html: disputeDraft.body_html,
      internal_summary: disputeDraft.internal_summary
    }) : null,
    dispute_email_to: disputeContactEmail,
    created_by_api_key: apiKeyId
  }

  const { data: inserted, error: insertErr } = await db
    .from('invoices')
    .insert(invoiceRow)
    .select('id')
    .single()

  if (insertErr) {
    console.error('[invoicePipeline] insert failed:', insertErr.message)
    throw new Error(`storage_failed:${insertErr.message}`)
  }

  return {
    invoice_id: inserted.id,
    duplicate: false,
    parsed,
    aiResult,
    rateCardsMatched: rateCards.length,
    shipmentsMatched: Object.keys(shipmentRates).length,
    summary: {
      total_charged: totalCharged,
      total_agreed: totalAgreed,
      total_overcharge: safeOvercharge,
      discrepancy_count: genuineDiscrepancies.length,
      unvalidated_count: unvalidatedDiscrepancies.length,
      status: 'pending_review',
      dispute_draft_available: disputeDraft !== null
    },
    discrepancies: enrichedDiscrepancies,
    dispute_draft: disputeDraft ? {
      subject: disputeDraft.subject,
      to: disputeContactEmail,
      internal_summary: disputeDraft.internal_summary,
      body_text: disputeDraft.body_text,
      body_html: disputeDraft.body_html
    } : null
  }
}

// Helper for the duplicate path — rebuild the same shape from a stored invoice
function buildResultFromInvoice(inv) {
  let draft = null
  if (inv.dispute_email_body) {
    try {
      const parsed = JSON.parse(inv.dispute_email_body)
      draft = {
        subject: parsed.subject,
        to: inv.dispute_email_to,
        internal_summary: parsed.internal_summary,
        body_text: parsed.body_text,
        body_html: parsed.body_html
      }
    } catch {}
  }

  const enriched = Array.isArray(inv.evidence_pack) ? inv.evidence_pack : []
  const genuine = enriched.filter(d => Number(d.delta) > 0)
  const unvalidated = enriched.filter(d => d.issue_type === 'unvalidated')

  return {
    invoice_id: inv.id,
    duplicate: false,
    parsed: { invoice_ref: inv.invoice_ref, carrier: inv.carrier, line_items: [] },
    aiResult: null,
    rateCardsMatched: 0,
    shipmentsMatched: 0,
    summary: {
      total_charged: Number(inv.total_charged) || 0,
      total_agreed: (Number(inv.total_charged) || 0) - (Number(inv.total_overcharge) || 0),
      total_overcharge: Number(inv.total_overcharge) || 0,
      discrepancy_count: genuine.length,
      unvalidated_count: unvalidated.length,
      status: inv.status,
      dispute_draft_available: draft !== null
    },
    discrepancies: enriched,
    dispute_draft: draft
  }
}
