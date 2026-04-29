import { createClient } from '@supabase/supabase-js'
import { sendDispute } from '../../../../../../lib/invoiceDispatch.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

function genRequestId() { return 'req_' + Math.random().toString(36).slice(2, 10) }

function extractApiKey(request) {
  const xKey = request.headers.get('x-api-key')
  if (xKey) return xKey.trim()
  const auth = request.headers.get('authorization')
  if (auth && auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim()
  return null
}

async function authenticate(db, request, requiredPermission) {
  const key = extractApiKey(request)
  if (!key) return { ok: false, code: 'ERR_001', http: 401 }
  const { data, error } = await db
    .from('api_keys')
    .select('id, permissions, allowed_client_ids, active')
    .eq('key', key)
    .maybeSingle()
  if (error || !data || !data.active) return { ok: false, code: 'ERR_001', http: 401 }
  if (!Array.isArray(data.permissions) || !data.permissions.includes(requiredPermission)) {
    return { ok: false, code: 'ERR_001', http: 401 }
  }
  return { ok: true, keyRow: data }
}

function errJson(code, http, message, requestId) {
  return Response.json({ error: code, message, request_id: requestId }, { status: http })
}

export async function POST(request) {
  const requestId = genRequestId()

  try {
    const db = getDB()
    if (!db) return errJson('ERR_004', 500, 'Internal error', requestId)

    const auth = await authenticate(db, request, 'invoice_send')
    if (!auth.ok) return errJson(auth.code, auth.http, 'Unauthorised', requestId)

    let body
    try { body = await request.json() } catch { return errJson('ERR_002', 400, 'Invalid JSON', requestId) }

    const { invoice_id, override_to, override_subject, override_body_text, override_body_html } = body || {}
    if (!invoice_id) return errJson('ERR_002', 400, 'invoice_id required', requestId)

    const dispatch = await sendDispute({
      db,
      invoiceId: invoice_id,
      overrides: { to: override_to, subject: override_subject, body_text: override_body_text, body_html: override_body_html },
      scopeCheck: async (inv) => {
        const allowed = auth.keyRow.allowed_client_ids
        if (!Array.isArray(allowed) || !allowed.includes(inv.client_id)) {
          return { ok: false, reason: 'scope_denied' }
        }
        if (inv.created_by_api_key !== auth.keyRow.id) {
          return { ok: false, reason: 'not_your_invoice' }
        }
        return { ok: true }
      }
    })

    if (!dispatch.ok) {
      const isAuth = ['scope_denied', 'not_your_invoice', 'invoice_not_found'].includes(dispatch.code)
      const isValidation = ['no_recipient', 'no_draft', 'missing_subject_or_body', 'invoice_id_required'].includes(dispatch.code)
      const code = isAuth ? 'ERR_001' : (isValidation ? 'ERR_002' : 'ERR_004')
      const http = isAuth ? 401 : (isValidation ? 400 : (dispatch.http || 500))
      return errJson(code, http, dispatch.message || dispatch.code, requestId)
    }

    db.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', auth.keyRow.id).then(() => {}).catch(() => {})

    if (dispatch.already_sent) {
      return Response.json({
        success: true,
        already_sent: true,
        invoice_id,
        sent_at: dispatch.sent_at,
        sent_to: dispatch.sent_to,
        message: 'Dispute already sent. Use a separate follow-up workflow.',
        request_id: requestId
      })
    }

    return Response.json({
      success: true,
      invoice_id,
      invoice_ref: dispatch.invoice.invoice_ref,
      sent_to: dispatch.sent_to,
      sent_at: dispatch.sent_at,
      message_id: dispatch.message_id,
      from: dispatch.from,
      ...(dispatch.warning ? { warning: dispatch.warning } : {}),
      request_id: requestId
    })
  } catch (e) {
    console.error('[v1/invoice/dispute/send] unhandled:', e)
    return Response.json({ error: 'ERR_004', message: 'Internal error', request_id: requestId }, { status: 500 })
  }
}
