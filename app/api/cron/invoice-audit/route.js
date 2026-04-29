import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

// Accept either Vercel cron auth or our internal x-dh-key for manual testing.
function checkAuth(request) {
  const cronAuth = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && cronAuth === `Bearer ${cronSecret}`) return true

  const dhKey = request.headers.get('x-dh-key')
  const expected = process.env.DH_INTERNAL_KEY
  if (expected && dhKey === expected) return true

  return false
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function gbp(n) {
  return `£${Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function isoNow() { return new Date().toISOString() }

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

// ── Per-client activity assembly ────────────────────────────────────────────
async function gatherClientActivity(db, clientId) {
  const since24h = isoDaysAgo(1)
  const since7d  = isoDaysAgo(7)

  // Yesterday's invoices (created in last 24h)
  const { data: yesterdayInvoices, error: e1 } = await db
    .from('invoices')
    .select('id, invoice_ref, carrier, total_charged, total_overcharge, status, dispute_email_sent_at, created_at')
    .eq('client_id', clientId)
    .gte('created_at', since24h)
  if (e1) console.error(`[invoice-audit] yesterday query failed for ${clientId}:`, e1.message)

  // Drafts older than 24h still in pending_review (nudge ops)
  const { data: stalledDrafts, error: e2 } = await db
    .from('invoices')
    .select('id, invoice_ref, carrier, total_overcharge, dispute_email_to, created_at')
    .eq('client_id', clientId)
    .eq('status', 'pending_review')
    .not('dispute_email_body', 'is', null)
    .lt('created_at', since24h)
    .order('created_at', { ascending: true })
  if (e2) console.error(`[invoice-audit] stalled drafts query failed for ${clientId}:`, e2.message)

  // Sent disputes >7 days ago with no response (suggest follow-up)
  const { data: unansweredDisputes, error: e3 } = await db
    .from('invoices')
    .select('id, invoice_ref, carrier, total_overcharge, dispute_email_sent_at')
    .eq('client_id', clientId)
    .eq('status', 'disputed')
    .is('response_received_at', null)
    .lt('dispute_email_sent_at', since7d)
    .order('dispute_email_sent_at', { ascending: true })
  if (e3) console.error(`[invoice-audit] unanswered query failed for ${clientId}:`, e3.message)

  return {
    yesterday: yesterdayInvoices || [],
    stalled_drafts: stalledDrafts || [],
    unanswered_disputes: unansweredDisputes || []
  }
}

// ── Determine if there is anything worth emailing ──────────────────────────
function hasActionableContent(activity) {
  return (activity.yesterday?.length || 0) > 0
      || (activity.stalled_drafts?.length || 0) > 0
      || (activity.unanswered_disputes?.length || 0) > 0
}

// ── Build digest email content (deterministic template — no AI call) ───────
function buildDigest({ clientName, activity, dateLabel }) {
  const yest = activity.yesterday
  const stalled = activity.stalled_drafts
  const unanswered = activity.unanswered_disputes

  // Aggregate yesterday by status
  const byStatus = {}
  let yestTotalCharged = 0
  let yestTotalOvercharge = 0
  for (const inv of yest) {
    byStatus[inv.status] = (byStatus[inv.status] || 0) + 1
    yestTotalCharged += Number(inv.total_charged || 0)
    yestTotalOvercharge += Number(inv.total_overcharge || 0)
  }

  const stalledTotal = stalled.reduce((s, i) => s + Number(i.total_overcharge || 0), 0)
  const unansweredTotal = unanswered.reduce((s, i) => s + Number(i.total_overcharge || 0), 0)

  // ── Plain text version ──
  const lines = []
  lines.push(`DisruptionHub daily digest — ${clientName} — ${dateLabel}`)
  lines.push('')

  if (yest.length > 0) {
    lines.push(`YESTERDAY'S INVOICE ACTIVITY`)
    lines.push(`${yest.length} invoice(s) processed, total charged ${gbp(yestTotalCharged)}.`)
    lines.push(`Total overcharges identified: ${gbp(yestTotalOvercharge)}.`)
    const statusSummary = Object.entries(byStatus).map(([k, v]) => `${v} ${k}`).join(', ')
    lines.push(`Status breakdown: ${statusSummary}.`)
    lines.push('')
  }

  if (stalled.length > 0) {
    lines.push(`DRAFTED DISPUTES AWAITING ACTION (>24h old)`)
    lines.push(`${stalled.length} dispute(s) drafted but not yet sent. Total potential recovery: ${gbp(stalledTotal)}.`)
    for (const inv of stalled.slice(0, 10)) {
      lines.push(`  • ${inv.invoice_ref} (${inv.carrier}) — ${gbp(inv.total_overcharge)} — drafted ${new Date(inv.created_at).toLocaleDateString('en-GB')}`)
    }
    if (stalled.length > 10) lines.push(`  ...and ${stalled.length - 10} more.`)
    lines.push('Action: review and send via the dashboard, or close as not-disputable.')
    lines.push('')
  }

  if (unanswered.length > 0) {
    lines.push(`SENT DISPUTES WITHOUT RESPONSE (>7 days)`)
    lines.push(`${unanswered.length} dispute(s) sent but no carrier response logged. Total amount in dispute: ${gbp(unansweredTotal)}.`)
    for (const inv of unanswered.slice(0, 10)) {
      const daysSince = Math.floor((Date.now() - new Date(inv.dispute_email_sent_at).getTime()) / (1000 * 60 * 60 * 24))
      lines.push(`  • ${inv.invoice_ref} (${inv.carrier}) — ${gbp(inv.total_overcharge)} — sent ${daysSince} days ago`)
    }
    if (unanswered.length > 10) lines.push(`  ...and ${unanswered.length - 10} more.`)
    lines.push('Action: consider follow-up. Carriers typically respond within 14 days.')
    lines.push('')
  }

  lines.push('---')
  lines.push('Automated digest from DisruptionHub. Reply to this email if anything looks wrong.')

  const bodyText = lines.join('\n')

  // ── HTML version (simple) ──
  const htmlParts = []
  htmlParts.push(`<h2>DisruptionHub daily digest — ${clientName} — ${dateLabel}</h2>`)

  if (yest.length > 0) {
    htmlParts.push(`<h3>Yesterday's invoice activity</h3>`)
    htmlParts.push(`<p><strong>${yest.length}</strong> invoice(s) processed, total charged <strong>${gbp(yestTotalCharged)}</strong>.<br/>`)
    htmlParts.push(`Total overcharges identified: <strong>${gbp(yestTotalOvercharge)}</strong>.<br/>`)
    htmlParts.push(`Status breakdown: ${Object.entries(byStatus).map(([k, v]) => `${v} ${k}`).join(', ')}.</p>`)
  }

  if (stalled.length > 0) {
    htmlParts.push(`<h3>Drafted disputes awaiting action (>24h old)</h3>`)
    htmlParts.push(`<p><strong>${stalled.length}</strong> dispute(s) drafted but not yet sent. Total potential recovery: <strong>${gbp(stalledTotal)}</strong>.</p>`)
    htmlParts.push('<ul>')
    for (const inv of stalled.slice(0, 10)) {
      htmlParts.push(`<li><strong>${inv.invoice_ref}</strong> (${inv.carrier}) — ${gbp(inv.total_overcharge)} — drafted ${new Date(inv.created_at).toLocaleDateString('en-GB')}</li>`)
    }
    if (stalled.length > 10) htmlParts.push(`<li>...and ${stalled.length - 10} more.</li>`)
    htmlParts.push('</ul>')
    htmlParts.push('<p><em>Action: review and send via the dashboard, or close as not-disputable.</em></p>')
  }

  if (unanswered.length > 0) {
    htmlParts.push(`<h3>Sent disputes without response (>7 days)</h3>`)
    htmlParts.push(`<p><strong>${unanswered.length}</strong> dispute(s) sent but no carrier response logged. Total amount in dispute: <strong>${gbp(unansweredTotal)}</strong>.</p>`)
    htmlParts.push('<ul>')
    for (const inv of unanswered.slice(0, 10)) {
      const daysSince = Math.floor((Date.now() - new Date(inv.dispute_email_sent_at).getTime()) / (1000 * 60 * 60 * 24))
      htmlParts.push(`<li><strong>${inv.invoice_ref}</strong> (${inv.carrier}) — ${gbp(inv.total_overcharge)} — sent ${daysSince} days ago</li>`)
    }
    if (unanswered.length > 10) htmlParts.push(`<li>...and ${unanswered.length - 10} more.</li>`)
    htmlParts.push('</ul>')
    htmlParts.push('<p><em>Action: consider follow-up. Carriers typically respond within 14 days.</em></p>')
  }

  htmlParts.push('<hr/><p><small>Automated digest from DisruptionHub. Reply to this email if anything looks wrong.</small></p>')

  return {
    subject: `DisruptionHub digest — ${clientName} — ${dateLabel}`,
    body_text: bodyText,
    body_html: htmlParts.join('\n'),
    summary: `${yest.length} invoices yesterday (${gbp(yestTotalOvercharge)} flagged), ${stalled.length} drafts stalled (${gbp(stalledTotal)}), ${unanswered.length} unanswered (${gbp(unansweredTotal)})`
  }
}

// ── Resend send ─────────────────────────────────────────────────────────────
async function sendViaResend({ to, subject, bodyText, bodyHtml }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: 'resend_not_configured' }

  const fromAddress = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        subject,
        text: bodyText,
        html: bodyHtml
      })
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('[invoice-audit] Resend rejected:', res.status, data)
      return { ok: false, error: 'resend_rejected', status: res.status, message: data.message }
    }
    return { ok: true, message_id: data.id || null, from: fromAddress }
  } catch (err) {
    console.error('[invoice-audit] Resend network error:', err.message)
    return { ok: false, error: 'resend_network', message: err.message }
  }
}

// ── Main handler ────────────────────────────────────────────────────────────
async function runAudit(request) {
  const db = getDB()
  if (!db) return Response.json({ error: 'db_not_configured' }, { status: 503 })

  // Find all clients with a digest email configured
  const { data: clients, error: cErr } = await db
    .from('clients')
    .select('id, name, daily_digest_email')
    .not('daily_digest_email', 'is', null)

  if (cErr) {
    console.error('[invoice-audit] client load failed:', cErr.message)
    return Response.json({ error: 'client_load_failed' }, { status: 500 })
  }

  const dateLabel = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  const results = { ran_at: isoNow(), clients_checked: clients?.length || 0, sent: 0, skipped: 0, errors: 0, details: [] }

  for (const client of clients || []) {
    try {
      const activity = await gatherClientActivity(db, client.id)

      if (!hasActionableContent(activity)) {
        results.skipped++
        results.details.push({ client_id: client.id, action: 'skipped', reason: 'no_activity' })
        continue
      }

      const digest = buildDigest({
        clientName: client.name || client.id,
        activity,
        dateLabel
      })

      const sendResult = await sendViaResend({
        to: client.daily_digest_email,
        subject: digest.subject,
        bodyText: digest.body_text,
        bodyHtml: digest.body_html
      })

      if (sendResult.ok) {
        results.sent++
        results.details.push({
          client_id: client.id,
          action: 'sent',
          to: client.daily_digest_email,
          message_id: sendResult.message_id,
          summary: digest.summary
        })
      } else {
        results.errors++
        results.details.push({
          client_id: client.id,
          action: 'send_failed',
          error: sendResult.error,
          message: sendResult.message
        })
      }
    } catch (err) {
      console.error(`[invoice-audit] client ${client.id} threw:`, err.message)
      results.errors++
      results.details.push({ client_id: client.id, action: 'exception', message: err.message })
    }
  }

  return Response.json(results)
}

export async function GET(request) {
  // Vercel cron uses GET
  if (!checkAuth(request)) return Response.json({ error: 'unauthorised' }, { status: 401 })
  try {
    return await runAudit(request)
  } catch (err) {
    console.error('[invoice-audit] unhandled:', err)
    return Response.json({ error: 'internal_error', message: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  // Manual testing path with x-dh-key
  if (!checkAuth(request)) return Response.json({ error: 'unauthorised' }, { status: 401 })
  try {
    return await runAudit(request)
  } catch (err) {
    console.error('[invoice-audit] unhandled:', err)
    return Response.json({ error: 'internal_error', message: err.message }, { status: 500 })
  }
}
