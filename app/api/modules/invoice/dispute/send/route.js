import { createClient } from '@supabase/supabase-js'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

function checkInternalKey(request) {
  const provided = request.headers.get('x-dh-key')
  const expected = process.env.DH_INTERNAL_KEY
  if (!expected) {
    console.error('[dispute-send] DH_INTERNAL_KEY env var not set — refusing all requests')
    return false
  }
  return provided === expected
}

// ── Resend send ─────────────────────────────────────────────────────────────
async function sendViaResend({ to, subject, bodyText, bodyHtml }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'resend_not_configured', message: 'RESEND_API_KEY not set' }
  }

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
      console.error('[dispute-send] Resend rejected:', res.status, data)
      return { ok: false, error: 'resend_rejected', status: res.status, message: data.message || data.name || 'unknown' }
    }

    return { ok: true, message_id: data.id || null, from: fromAddress }
  } catch (err) {
    console.error('[dispute-send] Resend network error:', err.message)
    return { ok: false, error: 'resend_network', message: err.message }
  }
}

// ── POST handler ────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
  if (!checkInternalKey(request)) {
    return Response.json({ error: 'unauthorised' }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { invoice_id, override_to, override_subject, override_body_text, override_body_html } = body
  if (!invoice_id) {
    return Response.json({ error: 'invoice_id required' }, { status: 400 })
  }

  const db = getDB()
  if (!db) return Response.json({ error: 'db_not_configured' }, { status: 503 })

  // 1. Load invoice
  const { data: inv, error: loadErr } = await db
    .from('invoices')
    .select('id, client_id, invoice_ref, carrier, status, dispute_email_body, dispute_email_to, dispute_email_sent_at, total_overcharge')
    .eq('id', invoice_id)
    .single()

  if (loadErr || !inv) {
    console.error('[dispute-send] Invoice load failed:', loadErr?.message)
    return Response.json({ error: 'invoice_not_found' }, { status: 404 })
  }

  // 2. Idempotency — already sent?
  if (inv.status === 'disputed' && inv.dispute_email_sent_at) {
    return Response.json({
      success: true,
      already_sent: true,
      sent_at: inv.dispute_email_sent_at,
      dispute_email_to: inv.dispute_email_to,
      message: 'Dispute already sent for this invoice. Use a separate workflow to send a follow-up.'
    })
  }

  // 3. Determine recipient + content
  const to = override_to || inv.dispute_email_to
  if (!to) {
    return Response.json({
      error: 'no_recipient',
      message: 'No dispute_email_to on invoice and no override_to provided.'
    }, { status: 400 })
  }

  let subject, bodyText, bodyHtml
  if (override_subject || override_body_text || override_body_html) {
    subject = override_subject
    bodyText = override_body_text
    bodyHtml = override_body_html || (override_body_text ? `<p>${override_body_text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>` : null)
  } else if (inv.dispute_email_body) {
    try {
      const draft = JSON.parse(inv.dispute_email_body)
      subject = draft.subject
      bodyText = draft.body_text
      bodyHtml = draft.body_html
    } catch {
      return Response.json({
        error: 'draft_corrupted',
        message: 'Stored dispute_email_body is not valid JSON. Please supply override fields.'
      }, { status: 500 })
    }
  } else {
    return Response.json({
      error: 'no_draft',
      message: 'No dispute draft on invoice. Provide override_subject + override_body_text.'
    }, { status: 400 })
  }

  if (!subject || !bodyText) {
    return Response.json({ error: 'missing_subject_or_body' }, { status: 400 })
  }

  // 4. Send via Resend
  const sendResult = await sendViaResend({ to, subject, bodyText, bodyHtml })
  if (!sendResult.ok) {
    return Response.json({
      error: sendResult.error,
      message: sendResult.message,
      status: sendResult.status
    }, { status: 502 })
  }

  // 5. Update invoice with audit trail
  const sentAt = new Date().toISOString()
  try {
    const { error: updateErr } = await db
      .from('invoices')
      .update({
        status: 'disputed',
        dispute_email_id: sendResult.message_id,
        dispute_email_sent_at: sentAt,
        dispute_email_to: to,
        dispute_email_body: JSON.stringify({ subject, body_text: bodyText, body_html: bodyHtml, sent_via: 'resend', from: sendResult.from }),
        updated_at: sentAt
      })
      .eq('id', invoice_id)

    if (updateErr) {
      console.error('[dispute-send] CRITICAL: email sent but invoice audit update failed:', updateErr.message)
      return Response.json({
        success: true,
        warning: 'audit_update_failed',
        message_id: sendResult.message_id,
        sent_to: to,
        message: 'Email sent via Resend but invoice audit update failed. Manual reconciliation required.'
      }, { status: 200 })
    }
  } catch (err) {
    console.error('[dispute-send] CRITICAL: email sent but audit update threw:', err.message)
    return Response.json({
      success: true,
      warning: 'audit_update_exception',
      message_id: sendResult.message_id,
      sent_to: to
    }, { status: 200 })
  }

  return Response.json({
    success: true,
    invoice_id,
    invoice_ref: inv.invoice_ref,
    sent_to: to,
    sent_at: sentAt,
    message_id: sendResult.message_id,
    from: sendResult.from
  })
  } catch (err) {
    console.error('[dispute-send] Unhandled error:', err)
    return Response.json({ error: 'internal_error', message: err.message }, { status: 500 })
  }
}
