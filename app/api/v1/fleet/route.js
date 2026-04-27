import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { applyPartnerView } from '../../../../lib/partnerView.js'

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
  const { data } = await db.from('api_keys').select('active, permissions').eq('key', key).maybeSingle()
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

    const permissions = Array.isArray(keyRecord.permissions) ? keyRecord.permissions : []
    if (!permissions.includes('fleet_read')) return errResponse('ERR_001', 401, requestId)

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')?.toLowerCase().trim()
    const statusFilter = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200)
    const offset = parseInt(searchParams.get('offset') || '0', 10) || 0

    if (!clientId) return errResponse('ERR_002', 400, requestId)

    const db = getDB()
    if (!db) {
      console.error('[v1/fleet]', requestId, 'database unavailable')
      return errResponse('ERR_004', 500, requestId)
    }

    let query = db.from('shipments').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).range(offset, offset + limit - 1)
    if (statusFilter) query = query.eq('status', statusFilter)
    const { data: shipments, error: shipErr } = await query

    if (shipErr) {
      console.error('[v1/fleet]', requestId, 'shipments query error:', shipErr.message)
      return errResponse('ERR_004', 500, requestId)
    }

    const { data: clientRow, error: clientErr } = await db.from('clients').select('id, name, sector, service_type, fleet_size, created_at').eq('id', clientId).maybeSingle()
    if (clientErr) console.error('[v1/fleet]', requestId, 'client query error:', clientErr.message)

    let viewShipments, viewClient
    try {
      viewShipments = applyPartnerView(shipments || [], 'shipment', permissions)
      viewClient = clientRow ? applyPartnerView(clientRow, 'client', permissions)[0] || null : null
    } catch (e) {
      console.error('[v1/fleet]', requestId, 'view transform error:', e.message)
      return errResponse('ERR_001', 401, requestId)
    }

    db.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('key', apiKey).then(() => {}).catch(() => {})

    return Response.json({
      shipments: viewShipments,
      client: viewClient,
      count: viewShipments.length,
      has_more: viewShipments.length === limit
    })

  } catch (err) {
    console.error('[v1/fleet]', requestId, 'internal error:', err)
    return errResponse('ERR_004', 500, requestId)
  }
}
