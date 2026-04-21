import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

async function checkApiKey(key) {
  if (!key) return null
  const db = getDB()
  if (!db) return null
  const { data } = await db.from('api_keys').select('client_id, active').eq('key', key).maybeSingle()
  return data?.active ? data : null
}

export async function GET(request) {
  try {
    const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '')

    const start = Date.now()
    const keyRecord = await checkApiKey(apiKey)
    const elapsed = Date.now() - start
    if (elapsed < 200) await new Promise(r => setTimeout(r, 200 - elapsed))
    if (!keyRecord) return Response.json({ error: 'ERR_001', message: 'Unauthorised' }, { status: 401 })

    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 12)
    console.log('[api-audit]', JSON.stringify({
      key_ref: keyHash,
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      path: '/api/v1/status',
      method: 'GET',
      ts: new Date().toISOString()
    }))

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')?.toLowerCase().trim()
    const assetId = searchParams.get('asset_id')?.toUpperCase().trim()

    if (!clientId) {
      return Response.json({ error: 'ERR_002', message: 'client_id is required' }, { status: 400 })
    }

    if (clientId !== keyRecord.client_id) {
      return Response.json({ error: 'ERR_001', message: 'Unauthorised' }, { status: 401 })
    }

    const db = getDB()
    if (!db) return Response.json({ error: 'ERR_004', message: 'Request could not be processed' }, { status: 500 })

    let query = db.from('shipments')
      .select('ref, route, status, eta, sla_window, cargo_type')
      .eq('client_id', clientId)
      .neq('status', 'completed')

    if (assetId) {
      const { data: driverRows } = await db.from('driver_progress')
        .select('ref')
        .eq('vehicle_reg', assetId)
        .not('status', 'eq', 'completed')
      const refs = (driverRows || []).map(r => r.ref).filter(Boolean)
      if (refs.length > 0) query = query.in('ref', refs)
      else return Response.json({ fleet: [] })
    }

    const { data, error } = await query

    if (error) {
      console.error('[v1/status] query error:', error.message, error.code)
      return Response.json({ error: 'ERR_004', message: 'Request could not be processed' }, { status: 500 })
    }

    const fleet = (data || []).map(s => ({
      ref: s.ref,
      route: s.route,
      status: s.status,
      eta: s.eta,
      sla_window: s.sla_window,
      cargo_type: s.cargo_type
    }))

    return Response.json({ fleet })

  } catch (err) {
    console.error('[v1/status] internal error:', err)
    return Response.json({ error: 'ERR_004', message: 'Request could not be processed' }, { status: 500 })
  }
}
