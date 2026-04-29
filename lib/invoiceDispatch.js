// Shared dispute send dispatcher used by:
//   - /api/modules/invoice/dispute/send  (internal — ops "Send" button)
//   - /v1/invoice/dispute/send           (partner — TMS triggers send)
//
// Routes are responsible for: auth, body parse, invoice scope check, response shape.
// This module is responsible for: load → idempotency → Resend send → audit update → callback fire.

import crypto from 'crypto'

// ── HMAC callback fire (direct to partner callback_url) ─────────────────────
async function fireInvoiceCallback(db, apiKeyId, eventType, payload) {
  if (!db || !apiKeyId) return

  const { data: keyRow } = await db
    .from('api_keys')
    .select('id, callback_url, callback_secret')
    .eq('id', apiKeyId)
    .maybeSingle()

  if (!keyRow?.callback_url) return

  const body = JSON.stringify({ event_type: eventType, ...payload })
  const sig = keyRow.callback_secret
    ? crypto.createHmac('sha256', keyRow.callback_secret).update(body).digest('hex')
    : 'unsigned'

  try {
    const res = await fetch(keyRow.callback_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-DH-Signature': `sha256=${sig}`,
        'X-DH-Event-Type': eventType,
        'User-Agent': 'DisruptionHub-Webhook/1.0'
      },
      body,
      signal: AbortSignal.timeout(10000)
    })
    console.log(`[invoiceDispatch] callback ${eventType} → ${keyRow.callback_url} status:${res.status}`)
  } catch (err) {
    console.error(`[invoiceDispatch] callback ${eventType} failed:`, err.message)
  }
}

// ── Resend send ─────────────────────────────────────────────────────────────
async function sendViaResend({ to, subject, bodyText, bodyHtml }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: 'resend_not_configured', message: 'RESEND_API_KEY not set' }

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
      console.error('[invoiceDispatch] Resend rejected:', res.status, data)
      return { ok: false, error: 'resend_rejected', status: res.status, message: data.message || data.name || 'unknown' }
    }

    return { ok: true, message_id: data.id || null, from: fromAddress }
  } catch (err) {
    console.error('[invoiceDispatch] Resend network error:', err.message)
    return { ok: false, error: 'resend_network', message: err.message }
  }
}

// ── Public API ──────────────────────────────────────────────────────────────
export async function sendDispute({ db, invoiceId, overrides = {}, scopeCheck = null }) {
  if (!db) return { ok: false, code: 'db_required', http: 503 }
  if (!invoiceId) return { ok: false, code: 'invoice_id_required', http: 400 }

  // 1. Load invoice
  const { data: inv, error: loadErr } = await db
    .from('invoices')
    .select('id, client_id, invoice_ref, carrier, status, dispute_email_body, dispute_email_to, dispute_email_sent_at, total_overcharge, created_by_api_key')
    .eq('id', invoiceId)
    .single()

  if (loadErr || !inv) {
    return { ok: false, code: 'invoice_not_found', http: 404 }
  }

  // 2. Optional scope check (partner)
  if (scopeCheck) {
    try {
      const sc = await scopeCheck(inv)
      if (!sc?.ok) return { ok: false, code: sc?.reason || 'scope_denied', http: 401 }
    } catch (err) {
      console.error('[invoiceDispatch] scope check threw:', err.message)
      return { ok: false, code: 'scope_check_failed', http: 500 }
    }
  }

  // 3. Idempotency — already sent?
  if (inv.status === 'disputed' && inv.dispute_email_sent_at) {
    return {
      ok: true,
      already_sent: true,
      invoice: inv,
      sent_at: inv.dispute_email_sent_at,
      sent_to: inv.dispute_email_to
    }
  }

  // 4. Determine recipient + content
  const to = overrides.to || inv.dispute_email_to
  if (!to) {
    return { ok: false, code: 'no_recipient', http: 400, message: 'No dispute_email_to and no override.to provided' }
  }

  let subject, bodyText, bodyHtml
  if (overrides.subject || overrides.body_text || overrides.body_html) {
    subject = overrides.subject
    bodyText = overrides.body_text
    bodyHtml = overrides.body_html || (overrides.body_text
      ? `<p>${overrides.body_text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`
      : null)
  } else if (inv.dispute_email_body) {
    try {
      const draft = JSON.parse(inv.dispute_email_body)
      subject = draft.subject
      bodyText = draft.body_text
      bodyHtml = draft.body_html
    } catch {
      return { ok: false, code: 'draft_corrupted', http: 500 }
    }
  } else {
    return { ok: false, code: 'no_draft', http: 400, message: 'No draft and no override fields' }
  }

  if (!subject || !bodyText) {
    return { ok: false, code: 'missing_subject_or_body', http: 400 }
  }

  // 5. Send via Resend
  const sendResult = await sendViaResend({ to, subject, bodyText, bodyHtml })
  if (!sendResult.ok) {
    return {
      ok: false,
      code: sendResult.error,
      http: 502,
      message: sendResult.message,
      status: sendResult.status
    }
  }

  // 6. Update invoice with audit trail
  const sentAt = new Date().toISOString()
  try {
    const { error: updateErr } = await db
      .from('invoices')
      .update({
        status: 'disputed',
        dispute_email_id: sendResult.message_id,
        dispute_email_sent_at: sentAt,
        dispute_email_to: to,
        dispute_email_body: JSON.stringify({
          subject, body_text: bodyText, body_html: bodyHtml,
          sent_via: 'resend', from: sendResult.from
        }),
        updated_at: sentAt
      })
      .eq('id', invoiceId)

    if (updateErr) {
      console.error('[invoiceDispatch] CRITICAL: email sent but audit update failed:', updateErr.message)
      return {
        ok: true,
        warning: 'audit_update_failed',
        invoice: inv,
        message_id: sendResult.message_id,
        sent_to: to,
        sent_at: sentAt,
        from: sendResult.from
      }
    }
  } catch (err) {
    console.error('[invoiceDispatch] CRITICAL: audit update threw:', err.message)
    return {
      ok: true,
      warning: 'audit_update_exception',
      invoice: inv,
      message_id: sendResult.message_id,
      sent_to: to,
      sent_at: sentAt,
      from: sendResult.from
    }
  }

  // 7. Fire callback if partner-created (non-fatal)
  if (inv.created_by_api_key) {
    try {
      await fireInvoiceCallback(db, inv.created_by_api_key, 'invoice.dispute_sent', {
        invoice_id: inv.id,
        invoice_ref: inv.invoice_ref,
        carrier: inv.carrier,
        client_id: inv.client_id,
        total_overcharge: Number(inv.total_overcharge) || 0,
        dispute_email_id: sendResult.message_id,
        dispute_email_to: to,
        sent_at: sentAt
      })
    } catch (cbErr) {
      console.error('[invoiceDispatch] callback fire failed (non-fatal):', cbErr.message)
    }
  }

  return {
    ok: true,
    invoice: inv,
    message_id: sendResult.message_id,
    sent_to: to,
    sent_at: sentAt,
    from: sendResult.from
  }
}

// Export for use by resolve route
export { fireInvoiceCallback }
