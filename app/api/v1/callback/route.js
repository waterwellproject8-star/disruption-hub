import { createClient } from '@supabase/supabase-js'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('x-internal-key')
    if (authHeader !== process.env.INTERNAL_API_KEY) {
      return Response.json({ error: 'ERR_001', message: 'Unauthorised' }, { status: 401 })
    }
    if (!process.env.INTERNAL_API_KEY) {
      return Response.json({ error: 'ERR_004', message: 'Request could not be processed' }, { status: 500 })
    }

    const body = await request.json()
    const { ref } = body

    if (!ref) {
      return Response.json({ error: 'ERR_002', message: 'ref is required' }, { status: 400 })
    }

    const db = getDB()
    if (!db) return Response.json({ error: 'ERR_004', message: 'Request could not be processed' }, { status: 500 })

    const { data: event, error: queryErr } = await db.from('webhook_log')
      .select('payload')
      .eq('system_name', 'api_v1')
      .filter('payload->>ref', 'eq', ref)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (queryErr) {
      console.error('[v1/callback] query error:', queryErr.message)
      return Response.json({ error: 'ERR_004', message: 'Request could not be processed' }, { status: 500 })
    }

    if (!event) {
      return Response.json({ error: 'ERR_002', message: 'Event not found' }, { status: 404 })
    }

    const callbackUrl = event.payload?.callback_url
    if (!callbackUrl) {
      return Response.json({ success: true, callback_sent: false, message: 'No callback URL registered' })
    }

    const callbackPayload = {
      ref,
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      sector: event.payload?.sector || 'haulage',
      asset_id: event.payload?.vehicle_reg || null
    }

    console.log('[v1/callback]', JSON.stringify({ ref, target: callbackUrl }))

    const callbackRes = await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(callbackPayload),
      signal: AbortSignal.timeout(10000)
    })

    if (!callbackRes.ok) {
      console.error('[v1/callback] partner returned', callbackRes.status, 'for ref:', ref)
      return Response.json({ success: true, callback_sent: true, callback_status: callbackRes.status })
    }

    return Response.json({ success: true, callback_sent: true, callback_status: callbackRes.status })

  } catch (err) {
    console.error('[v1/callback] internal error:', err)
    return Response.json({ error: 'ERR_004', message: 'Request could not be processed' }, { status: 500 })
  }
}
