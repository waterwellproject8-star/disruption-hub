import { createClient } from '@supabase/supabase-js'
import { sendDispute } from '../../../../../../lib/invoiceDispatch.js'

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

    const dispatch = await sendDispute({
      db,
      invoiceId: invoice_id,
      overrides: { to: override_to, subject: override_subject, body_text: override_body_text, body_html: override_body_html }
    })

    if (!dispatch.ok) {
      return Response.json({ error: dispatch.code, message: dispatch.message }, { status: dispatch.http || 500 })
    }

    if (dispatch.already_sent) {
      return Response.json({
        success: true,
        already_sent: true,
        sent_at: dispatch.sent_at,
        dispute_email_to: dispatch.sent_to,
        message: 'Dispute already sent for this invoice. Use a separate workflow to send a follow-up.'
      })
    }

    if (dispatch.warning) {
      return Response.json({
        success: true,
        warning: dispatch.warning,
        message_id: dispatch.message_id,
        sent_to: dispatch.sent_to,
        message: 'Email sent but audit update failed. Manual reconciliation required.'
      }, { status: 200 })
    }

    return Response.json({
      success: true,
      invoice_id,
      invoice_ref: dispatch.invoice.invoice_ref,
      sent_to: dispatch.sent_to,
      sent_at: dispatch.sent_at,
      message_id: dispatch.message_id,
      from: dispatch.from
    })
  } catch (err) {
    console.error('[dispute-send] Unhandled error:', err)
    return Response.json({ error: 'internal_error', message: err.message }, { status: 500 })
  }
}
