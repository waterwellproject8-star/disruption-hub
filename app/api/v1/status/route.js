import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

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

function errResponse(code, status, requestId) {
  return Response.json({ error: code, request_id: requestId }, { status })
}

export async function GET(request) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '')

    const start = Date.now()
    const keyRecord = await checkApiKey(apiKey)
    const elapsed = Date.now() - start
    if (elapsed < 200) await new Promise(r => setTimeout(r, 200 - elapsed))
    if (!keyRecord) return errResponse('ERR_001', 401, requestId)

    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 12)
    console.log('[api-audit]', JSON.stringify({
      key_ref: keyHash,
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      path: '/api/v1/status',
      method: 'GET',
      ts: new Date().toISOString(),
      request_id: requestId
    }))

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')?.toLowerCase().trim()
    const assetId = searchParams.get('asset_id')?.toUpperCase().trim()

    if (!clientId) {
      return errResponse('ERR_002', 400, requestId)
    }

    if (clientId !== keyRecord.client_id) {
      return errResponse('ERR_001', 401, requestId)
    }

    const db = getDB()
    if (!db) {
      console.error('[v1/status]', requestId, 'database unavailable')
      return errResponse('ERR_004', 500, requestId)
    }

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
      console.error('[v1/status]', requestId, 'query error:', error.message, error.code)
      return errResponse('ERR_004', 500, requestId)
    }

    const fleet = (data || []).map(s => ({
      ref: s.ref,
      route: s.route,
      status: s.status,
      eta: s.eta,
      delivery_window: s.sla_window,
      load_type: s.cargo_type
    }))

    return Response.json({ fleet })

  } catch (err) {
    console.error('[v1/status]', requestId, 'internal error:', err)
    return errResponse('ERR_004', 500, requestId)
  }
}
