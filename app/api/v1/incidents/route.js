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
    if (!permissions.includes('incidents_read')) return errResponse('ERR_001', 401, requestId)

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')?.toLowerCase().trim()
    const eventType = searchParams.get('event_type')
    const severity = searchParams.get('severity')
    const since = searchParams.get('since')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200)
    const offset = parseInt(searchParams.get('offset') || '0', 10) || 0

    if (!clientId) return errResponse('ERR_002', 400, requestId)

    const db = getDB()
    if (!db) {
      console.error('[v1/incidents]', requestId, 'database unavailable')
      return errResponse('ERR_004', 500, requestId)
    }

    let query = db.from('webhook_log').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).range(offset, offset + limit - 1)
    if (eventType) query = query.eq('event_type', eventType)
    if (severity) query = query.eq('severity', severity)
    if (since) query = query.gte('created_at', since)
    const { data: rows, error: queryErr } = await query

    if (queryErr) {
      console.error('[v1/incidents]', requestId, 'query error:', queryErr.message)
      return errResponse('ERR_004', 500, requestId)
    }

    let viewIncidents
    try {
      viewIncidents = applyPartnerView(rows || [], 'incident', permissions)
    } catch (e) {
      console.error('[v1/incidents]', requestId, 'view transform error:', e.message)
      return errResponse('ERR_001', 401, requestId)
    }

    db.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('key', apiKey).then(() => {}).catch(() => {})

    return Response.json({
      incidents: viewIncidents,
      count: viewIncidents.length,
      has_more: viewIncidents.length === limit
    })

  } catch (err) {
    console.error('[v1/incidents]', requestId, 'internal error:', err)
    return errResponse('ERR_004', 500, requestId)
  }
}
