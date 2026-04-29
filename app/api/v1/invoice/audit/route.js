import { createClient } from '@supabase/supabase-js'
import { auditInvoice } from '../../../../../lib/invoicePipeline.js'
import { transformInvoiceForPartner } from '../../../../../lib/partnerView.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

function genRequestId() {
  return 'req_' + Math.random().toString(36).slice(2, 10)
}

function extractApiKey(request) {
  const xKey = request.headers.get('x-api-key')
  if (xKey) return xKey.trim()
  const auth = request.headers.get('authorization')
  if (auth && auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim()
  return null
}

async function authenticate(db, request, requiredPermission) {
  const key = extractApiKey(request)
  if (!key) return { ok: false, code: 'ERR_001', http: 401, message: 'Unauthorised' }

  const { data: keyRow, error } = await db
    .from('api_keys')
    .select('id, permissions, allowed_client_ids, active')
    .eq('key', key)
    .maybeSingle()

  if (error || !keyRow) return { ok: false, code: 'ERR_001', http: 401, message: 'Unauthorised' }
  if (!keyRow.active) return { ok: false, code: 'ERR_001', http: 401, message: 'Unauthorised' }
  if (!Array.isArray(keyRow.permissions) || !keyRow.permissions.includes(requiredPermission)) {
    return { ok: false, code: 'ERR_001', http: 401, message: 'Unauthorised' }
  }

  return { ok: true, keyRow }
}

function errJson(code, http, message, requestId) {
  return Response.json({ error: code, message, request_id: requestId }, { status: http })
}

export async function POST(request) {
  const requestId = genRequestId()

  try {
    const db = getDB()
    if (!db) return errJson('ERR_004', 500, 'Internal error', requestId)

    // 1. Auth
    const auth = await authenticate(db, request, 'invoice_audit')
    if (!auth.ok) return errJson(auth.code, auth.http, auth.message, requestId)

    // 2. Parse body
    let body
    try {
      body = await request.json()
    } catch {
      return errJson('ERR_002', 400, 'Invalid JSON body', requestId)
    }

    const { client_id, file_content, file_type, filename } = body
    if (!client_id) return errJson('ERR_002', 400, 'client_id required', requestId)
    if (!file_content) return errJson('ERR_002', 400, 'file_content required', requestId)
    if (!file_type) return errJson('ERR_002', 400, 'file_type required (csv or txt)', requestId)

    // 3. Scope check — client_id must be in allowed_client_ids
    const allowed = auth.keyRow.allowed_client_ids
    if (!Array.isArray(allowed) || !allowed.includes(client_id)) {
      return errJson('ERR_001', 401, 'Unauthorised', requestId)
    }

    // 4. Mark key as recently used (best-effort)
    db.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', auth.keyRow.id).then(() => {}).catch(() => {})

    // 5. Run pipeline
    let auditResult
    try {
      auditResult = await auditInvoice({ db, clientId: client_id, fileContent: file_content, fileType: file_type, filename })
    } catch (pipelineErr) {
      console.error('[v1/invoice/audit]', requestId, 'pipeline failed:', pipelineErr.message)
      const msg = pipelineErr.message || 'pipeline_failed'
      const userFacing = ['parse_failed', 'no_line_items_found', 'file_type_must_be_csv_or_txt'].some(p => msg.startsWith(p))
      return errJson(userFacing ? 'ERR_002' : 'ERR_004', userFacing ? 400 : 500, msg, requestId)
    }

    // 6. Transform for partner — strips PII, rate amounts, evidence strings
    const partnerView = transformInvoiceForPartner(auditResult)

    return Response.json({ ...partnerView, request_id: requestId })
  } catch (err) {
    console.error('[v1/invoice/audit]', requestId, 'unhandled:', err)
    return Response.json({ error: 'ERR_004', message: 'Internal error', request_id: requestId }, { status: 500 })
  }
}
