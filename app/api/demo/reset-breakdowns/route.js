import { createClient } from '@supabase/supabase-js'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder') || key.includes('placeholder')) return null
  return createClient(url, key)
}

function checkInternalKey(request) {
  const headerKey = request.headers.get('x-dh-key')
  return headerKey === process.env.DH_INTERNAL_KEY
}

export async function POST(request) {
  if (!checkInternalKey(request)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  let body = {}
  try { body = await request.json() } catch {
    // empty body is fine — defaults below
  }

  const clientId = (body.client_id || 'pearson-haulage').toLowerCase().trim()

  const db = getDB()
  if (!db) {
    return Response.json({ ok: false, error: 'db_unavailable' }, { status: 503 })
  }

  try {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
    const nowIso = new Date().toISOString()

    const { data, error } = await db
      .from('approvals')
      .update({
        status: 'cancelled',
        executed_at: nowIso,
        execution_result: { cancelled_by: 'demo_reset', reason: 'breakdown demo reset' }
      })
      .eq('client_id', clientId)
      .eq('status', 'pending')
      .in('action_type', ['dispatch', 'call'])
      .gt('created_at', sixHoursAgo)
      .select('id')

    if (error) {
      console.error('[demo/reset-breakdowns] supabase error', error)
      return Response.json({ ok: false, error: 'db_error' }, { status: 500 })
    }

    return Response.json({
      ok: true,
      client_id: clientId,
      cancelled_count: (data || []).length,
      ids: (data || []).map(r => r.id)
    })
  } catch (err) {
    console.error('[demo/reset-breakdowns] unexpected', err)
    return Response.json({ ok: false, error: 'internal' }, { status: 500 })
  }
}
