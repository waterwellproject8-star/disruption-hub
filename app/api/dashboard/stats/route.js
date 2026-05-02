import { createClient } from '@supabase/supabase-js'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder') || key.includes('placeholder')) {
    return null
  }
  return createClient(url, key)
}

function checkInternalKey(request) {
  const headerKey = request.headers.get('x-dh-key')
  return headerKey === process.env.DH_INTERNAL_KEY
}

export async function GET(request) {
  if (!checkInternalKey(request)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = (searchParams.get('client_id') || '').toLowerCase().trim()
  if (!clientId) {
    return Response.json({ ok: false, error: 'client_id_required' }, { status: 400 })
  }

  const db = getDB()
  if (!db) {
    return Response.json({ ok: false, error: 'db_unavailable' }, { status: 503 })
  }

  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await db
      .from('invoices')
      .select('recovered_amount')
      .eq('client_id', clientId)
      .eq('status', 'resolved')
      .gte('recovered_at', since)

    if (error) {
      console.error('[dashboard/stats] supabase error', error)
      return Response.json({ ok: false, error: 'db_error' }, { status: 500 })
    }

    const amount = (data || []).reduce(
      (sum, row) => sum + (Number(row.recovered_amount) || 0),
      0
    )

    return Response.json({
      ok: true,
      client_id: clientId,
      recovered_this_month: {
        amount: Number(amount.toFixed(2)),
        count: (data || []).length,
        since
      }
    })
  } catch (err) {
    console.error('[dashboard/stats] unexpected', err)
    return Response.json({ ok: false, error: 'internal' }, { status: 500 })
  }
}
