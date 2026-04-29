import { createClient } from '@supabase/supabase-js'

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

function err(code, http, message, requestId) {
  return Response.json({ error: code, message, request_id: requestId }, { status: http })
}

function viewOf(inv) {
  return {
    invoice_id: inv.id,
    invoice_ref: inv.invoice_ref,
    carrier: inv.carrier,
    total_charged: Number(inv.total_charged) || 0,
    total_overcharge: Number(inv.total_overcharge) || 0,
    status: inv.status,
    dispute_draft_available: inv.dispute_email_body !== null,
    dispute_sent_at: inv.dispute_email_sent_at,
    recovered_amount: inv.recovered_amount === null ? null : Number(inv.recovered_amount),
    recovered_at: inv.recovered_at,
    created_at: inv.created_at
  }
}

export async function GET(request) {
  const requestId = genRequestId()

  try {
    const db = getDB()
    if (!db) return err('ERR_004', 500, 'Internal error', requestId)

    const auth = await authenticate(db, request, 'invoice_read')
    if (!auth.ok) return err(auth.code, auth.http, 'Unauthorised', requestId)

    const url = new URL(request.url)
    const clientId = url.searchParams.get('client_id')
    if (!clientId) return err('ERR_002', 400, 'client_id required', requestId)

    // Scope check
    const allowed = auth.keyRow.allowed_client_ids
    if (!Array.isArray(allowed) || !allowed.includes(clientId)) {
      return err('ERR_001', 401, 'Unauthorised', requestId)
    }

    // Filters
    const since = url.searchParams.get('since')
    const until = url.searchParams.get('until')
    const status = url.searchParams.get('status')
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200)
    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0)

    // Default: last 30 days if since not provided
    const sinceISO = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // Partners only see invoices THEIR key created
    let query = db
      .from('invoices')
      .select('id, invoice_ref, carrier, total_charged, total_overcharge, status, dispute_email_body, dispute_email_sent_at, recovered_amount, recovered_at, created_at', { count: 'exact' })
      .eq('client_id', clientId)
      .eq('created_by_api_key', auth.keyRow.id)
      .gte('created_at', sinceISO)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (until) query = query.lte('created_at', until)
    if (status) query = query.eq('status', status)

    const { data: rows, error: qErr, count } = await query
    if (qErr) {
      console.error('[v1/invoice/discrepancies]', requestId, 'query failed:', qErr.message)
      return err('ERR_004', 500, 'Internal error', requestId)
    }

    // Mark key as recently used (best-effort)
    db.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', auth.keyRow.id).then(() => {}).catch(() => {})

    return Response.json({
      invoices: (rows || []).map(viewOf),
      count: count || 0,
      has_more: (offset + limit) < (count || 0),
      filters: { client_id: clientId, since: sinceISO, until: until || null, status: status || null, limit, offset },
      request_id: requestId
    })
  } catch (e) {
    console.error('[v1/invoice/discrepancies] unhandled:', e)
    return Response.json({ error: 'ERR_004', message: 'Internal error', request_id: requestId }, { status: 500 })
  }
}
