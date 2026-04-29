import { createClient } from '@supabase/supabase-js'
import { runModule, anthropic } from '../../../../../lib/anthropic.js'
import { enrichEvidenceBatch } from '../../../../../lib/evidenceEnricher.js'
import crypto from 'crypto'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

// ── HEADER AUTH ─────────────────────────────────────────────────────────────
function checkInternalKey(request) {
  const provided = request.headers.get('x-dh-key')
  const expected = process.env.DH_INTERNAL_KEY
  if (!expected) {
    console.error('[invoice-run] DH_INTERNAL_KEY env var not set — refusing all requests')
    return false
  }
  return provided === expected
}

// ── CSV PARSER (no external deps) ───────────────────────────────────────────
// Expected headers (case-insensitive, any subset accepted):
//   invoice_ref, carrier, job_ref, line_description, charged, agreed_rate,
//   fuel_surcharge_pct, invoice_date, lane_origin, lane_destination, service_type
function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length < 2) return { lines: [], error: 'CSV must have header row plus at least one data row' }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[\s-]+/g, '_'))
  const out = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    const row = {}
    headers.forEach((h, idx) => {
      const v = values[idx]
      if (v === undefined || v === '') return
      if (['charged', 'agreed_rate', 'fuel_surcharge_pct'].includes(h)) {
        const n = Number(v.replace(/[£$,]/g, ''))
        if (!isNaN(n)) row[h] = n
      } else {
        row[h] = v
      }
    })
    if (Object.keys(row).length > 0) out.push(row)
  }
  return { lines: out, error: null }
}

// ── TXT EXTRACTOR (Claude Haiku call) ───────────────────────────────────────
// Free-form invoice text → structured line items.
async function extractFromTxt(rawText) {
  try {
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
  } catch (err) {
    console.error('[invoice-run] TXT extraction failed:', err.message)
    return { error: 'extraction_failed', message: err.message }
  }
}

// ── RATE CARD LOOKUP ────────────────────────────────────────────────────────
async function fetchRateCards(db, clientId, carrier) {
  try {
    const { data, error } = await db
      .from('rate_cards')
      .select('carrier, lane_origin, lane_destination, service_type, agreed_rate_total, agreed_rate_per_mile, fuel_surcharge_pct_max, waiting_time_per_hour, multi_drop_fee, contract_ref')
      .eq('client_id', clientId)
      .eq('carrier', carrier)
      .is('effective_to', null)

    if (error) {
      console.error('[invoice-run] Rate card lookup failed:', error.message)
      return []
    }
    return data || []
  } catch (err) {
    console.error('[invoice-run] Rate card lookup exception:', err.message)
    return []
  }
}

// ── SHIPMENT AGREED-RATE LOOKUP ─────────────────────────────────────────────
async function fetchShipmentAgreedRates(db, clientId, jobRefs) {
  if (!jobRefs || jobRefs.length === 0) return {}
  try {
    const { data, error } = await db
      .from('shipments')
      .select('ref, agreed_rate, agreed_rate_source, route, carrier, sla_window, cargo_type')
      .eq('client_id', clientId)
      .in('ref', jobRefs)

    if (error) {
      console.error('[invoice-run] Shipment lookup failed:', error.message)
      return {}
    }
    const map = {}
    for (const s of (data || [])) {
      map[s.ref] = s
    }
    return map
  } catch (err) {
    console.error('[invoice-run] Shipment lookup exception:', err.message)
    return {}
  }
}

// ── CLIENT CONTEXT ──────────────────────────────────────────────────────────
async function fetchClientContext(db, clientId) {
  try {
    const { data, error } = await db
      .from('clients')
      .select('name, system_prompt, sector')
      .eq('id', clientId)
      .single()
    if (error || !data) return ''
    return `Client: ${data.name} (sector: ${data.sector || 'haulage'})\n${data.system_prompt || ''}`
  } catch (err) {
    console.error('[invoice-run] Client context fetch failed:', err.message)
    return ''
  }
}

// ── IDEMPOTENCY ─────────────────────────────────────────────────────────────
// Hash file content + client_id; if already processed within last 24h, skip.
async function checkDuplicate(db, clientId, contentHash) {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await db
      .from('invoices')
      .select('id, invoice_ref, ai_processed_at')
      .eq('client_id', clientId)
      .eq('source', `hash:${contentHash}`)
      .gte('created_at', since)
      .limit(1)
    if (error) return null
    return (data && data[0]) || null
  } catch (err) {
    console.error('[invoice-run] Duplicate check failed:', err.message)
    return null
  }
}

// ── MAIN POST HANDLER ───────────────────────────────────────────────────────
export async function POST(request) {
  // 1. Auth
  if (!checkInternalKey(request)) {
    return Response.json({ error: 'unauthorised' }, { status: 401 })
  }

  // 2. Parse body
  let body
  try {
    body = await request.json()
  } catch (err) {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { client_id, file_content, file_type, filename } = body
  if (!client_id || !file_content || !file_type) {
    return Response.json({
      error: 'missing_required_fields',
      message: 'client_id, file_content, file_type required'
    }, { status: 400 })
  }

  if (!['txt', 'csv'].includes(file_type.toLowerCase())) {
    return Response.json({
      error: 'unsupported_file_type',
      message: 'Only txt and csv supported in Phase 1. PDF support coming in Phase 2.'
    }, { status: 400 })
  }

  const db = getDB()
  if (!db) {
    return Response.json({ error: 'db_not_configured' }, { status: 503 })
  }

  // 3. Idempotency
  const contentHash = crypto.createHash('sha256').update(file_content).digest('hex').substring(0, 16)
  const existing = await checkDuplicate(db, client_id, contentHash)
  if (existing) {
    console.log(`[invoice-run] Duplicate skipped — ${existing.invoice_ref} already processed`)
    return Response.json({
      success: true,
      duplicate: true,
      existing_invoice_id: existing.id,
      message: 'This invoice was already processed in the last 24 hours.'
    })
  }

  // 4. Parse file → structured line items
  let parsed
  if (file_type.toLowerCase() === 'csv') {
    const result = parseCSV(file_content)
    if (result.error) {
      return Response.json({ error: 'csv_parse_failed', message: result.error }, { status: 400 })
    }
    if (result.lines.length === 0) {
      return Response.json({ error: 'no_line_items', message: 'CSV had no data rows' }, { status: 400 })
    }
    const firstRow = result.lines[0]
    parsed = {
      carrier: firstRow.carrier || 'Unknown',
      invoice_ref: firstRow.invoice_ref || filename || `INV-${Date.now()}`,
      invoice_date: firstRow.invoice_date || null,
      line_items: result.lines
    }
  } else {
    // TXT path
    parsed = await extractFromTxt(file_content)
    if (parsed.error) {
      return Response.json({
        error: 'extraction_failed',
        message: parsed.message || 'Could not extract line items from TXT'
      }, { status: 400 })
    }
  }

  // 5. Fetch rate cards + shipment agreed rates + client context
  const carrier = parsed.carrier || 'Unknown'
  const jobRefs = (parsed.line_items || []).map(li => li.job_ref).filter(Boolean)

  const [rateCards, shipmentRates, clientContext] = await Promise.all([
    fetchRateCards(db, client_id, carrier),
    fetchShipmentAgreedRates(db, client_id, jobRefs),
    fetchClientContext(db, client_id)
  ])

  // 6. Build AI input payload
  const aiInput = {
    invoice_ref: parsed.invoice_ref,
    carrier: carrier,
    invoice_date: parsed.invoice_date,
    line_items: parsed.line_items,
    rate_cards: rateCards,
    shipment_agreed_rates: shipmentRates,
    instruction: 'Compare each line item against the matching rate card and shipment agreed_rate. Flag fuel surcharge above contracted maximum, duplicate invoice references, charged amounts above agreed rates. For each discrepancy, cite specific evidence (which rate card, which shipment ref, what threshold was exceeded).'
  }

  // 7. Run the invoice module
  let aiResult
  try {
    aiResult = await runModule('invoice', aiInput, clientContext)
  } catch (err) {
    console.error('[invoice-run] AI module call failed:', err.message)
    return Response.json({
      error: 'ai_failed',
      message: 'Invoice analysis could not complete. Please retry.'
    }, { status: 502 })
  }

  // 8. Compute totals defensively
  // Filter out any AI-returned items with non-positive delta — these aren't overcharges.
  // Belt-and-braces: prompt instructs the AI to never return these, but if the AI slips
  // we don't want negative totals propagating to the dashboard.
  const allDiscrepancies = Array.isArray(aiResult.discrepancies) ? aiResult.discrepancies : []
  const genuineDiscrepancies = allDiscrepancies.filter(d => Number(d.delta) > 0)
  const unvalidatedDiscrepancies = allDiscrepancies.filter(d =>
    d.issue_type === 'unvalidated' && Number(d.delta) === 0
  )
  const discrepancies = [...genuineDiscrepancies, ...unvalidatedDiscrepancies]

  const totalCharged = (parsed.line_items || []).reduce((s, li) => s + (Number(li.charged) || 0), 0)
  const totalOvercharge = genuineDiscrepancies.reduce((s, d) => s + Number(d.delta), 0)
  const safeOvercharge = Math.max(0, totalOvercharge)
  const totalAgreed = totalCharged - safeOvercharge

  // 8.5 Enrich each genuine + unvalidated discrepancy with operational evidence.
  // Pulls shipment, driver progress, webhook events, incidents, end-of-shift in parallel.
  // Attaches to each discrepancy as `operational_evidence` field for Day 3 dispute drafting.
  let evidenceByRef = {}
  try {
    const refsToEnrich = discrepancies
      .map(d => d.job_ref)
      .filter(Boolean)
    if (refsToEnrich.length > 0) {
      evidenceByRef = await enrichEvidenceBatch(db, client_id, refsToEnrich)
    }
  } catch (err) {
    console.error('[invoice-run] Evidence enrichment failed (continuing without):', err.message)
  }

  const enrichedDiscrepancies = discrepancies.map(d => ({
    ...d,
    operational_evidence: d.job_ref ? (evidenceByRef[d.job_ref] || null) : null
  }))

  // 8.6 Compose dispute email draft (Sonnet) when there are genuine overcharges.
  let disputeDraft = null
  let disputeContactEmail = null
  let disputeContactName = null

  if (safeOvercharge > 0 && genuineDiscrepancies.length > 0) {
    try {
      const { data: rateContacts } = await db
        .from('rate_cards')
        .select('dispute_contact_email, dispute_contact_name')
        .eq('client_id', client_id)
        .eq('carrier', carrier)
        .not('dispute_contact_email', 'is', null)
        .limit(1)
      if (rateContacts && rateContacts[0]) {
        disputeContactEmail = rateContacts[0].dispute_contact_email
        disputeContactName = rateContacts[0].dispute_contact_name
      }
    } catch (err) {
      console.error('[invoice-run] Dispute contact lookup failed (continuing without):', err.message)
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
      client_name: clientContext ? (clientContext.split('\n')[0].replace(/^Client:\s*/, '').replace(/\s*\(.*$/, '')) : 'Operations',
      carrier_contact_name: disputeContactName,
      response_deadline_days: 14
    }

    try {
      disputeDraft = await runModule('dispute_email', composerInput, '', { model: 'claude-sonnet-4-6', maxTokens: 2000 })
    } catch (err) {
      console.error('[invoice-run] Dispute draft composition failed (non-fatal):', err.message)
    }
  }

  // 9. Store invoice with AI run tracking
  const invoiceRow = {
    client_id,
    carrier,
    invoice_ref: parsed.invoice_ref,
    invoice_date: parsed.invoice_date || null,
    line_items: parsed.line_items,
    total_charged: totalCharged,
    total_agreed: totalAgreed,
    total_overcharge: safeOvercharge,
    status: 'pending_review',
    source: `hash:${contentHash}`,
    ai_processed_at: new Date().toISOString(),
    evidence_pack: enrichedDiscrepancies,
    dispute_email_body: disputeDraft ? JSON.stringify({
      subject: disputeDraft.subject,
      body_text: disputeDraft.body_text,
      body_html: disputeDraft.body_html,
      internal_summary: disputeDraft.internal_summary
    }) : null,
    dispute_email_to: disputeContactEmail
  }

  let inserted
  try {
    const { data, error } = await db.from('invoices').insert(invoiceRow).select().single()
    if (error) {
      console.error('[invoice-run] Invoice insert failed:', error.message)
      return Response.json({ error: 'storage_failed', message: error.message }, { status: 500 })
    }
    inserted = data
  } catch (err) {
    console.error('[invoice-run] Invoice insert exception:', err.message)
    return Response.json({ error: 'storage_failed', message: err.message }, { status: 500 })
  }

  // 10. Return result to dashboard
  return Response.json({
    success: true,
    invoice_id: inserted.id,
    invoice_ref: parsed.invoice_ref,
    carrier,
    summary: {
      total_charged: totalCharged,
      total_overcharge: safeOvercharge,
      annual_projection: aiResult.annual_projection || null,
      discrepancy_count: genuineDiscrepancies.length,
      unvalidated_count: unvalidatedDiscrepancies.length
    },
    discrepancies: enrichedDiscrepancies,
    rate_cards_matched: rateCards.length,
    shipments_matched: Object.keys(shipmentRates).length,
    line_items_count: (parsed.line_items || []).length,
    dispute_draft_available: disputeDraft !== null,
    dispute_email_to: disputeContactEmail,
    dispute_subject: disputeDraft ? disputeDraft.subject : null,
    dispute_internal_summary: disputeDraft ? disputeDraft.internal_summary : null
  })
}
