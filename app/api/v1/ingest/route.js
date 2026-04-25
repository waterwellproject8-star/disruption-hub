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
  const { data } = await db.from('api_keys').select('client_id, active, callback_url').eq('key', key).maybeSingle()
  return data?.active ? data : null
}

function errResponse(code, status, requestId) {
  return Response.json({ error: code, request_id: requestId }, { status })
}

export async function POST(request) {
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
      path: '/api/v1/ingest',
      method: 'POST',
      ts: new Date().toISOString(),
      request_id: requestId
    }))

    const body = await request.json()
    const { client_id, event_type, severity, description, ref, payload } = body

    if (!client_id || !event_type) {
      return errResponse('ERR_002', 400, requestId)
    }

    const VALID_SECTORS = ['psv', 'coach', 'haulage', 'lgv']
    const sector = VALID_SECTORS.includes(body.sector?.toLowerCase?.()) ? body.sector.toLowerCase() : 'haulage'

    const partnerAssetId = body.asset_id || body.vehicle_reg || null
    const vehicle_reg = partnerAssetId ? partnerAssetId.toUpperCase().trim() : null
    const normalised_client = client_id.toLowerCase().trim()
    const eventRef = ref || `EVT-${Date.now().toString(36).toUpperCase()}`

    if (body.sandbox === true) {
      const sandboxRef = `sandbox_${eventRef}`
      console.log('[sandbox]', JSON.stringify({ client_id: normalised_client, event_type, ref: sandboxRef, request_id: requestId }))
      return Response.json({
        success: true,
        ref: sandboxRef,
        message: 'Event received',
        status: severity || 'MEDIUM',
        sector,
        asset_id: partnerAssetId,
        sandbox: true
      })
    }

    const db = getDB()
    if (!db) {
      console.error('[v1/ingest]', requestId, 'database unavailable')
      return errResponse('ERR_004', 500, requestId)
    }

    const { error: insertErr } = await db.from('webhook_log').insert({
      client_id: normalised_client,
      system_name: 'api_v1',
      direction: 'inbound',
      event_type,
      severity: severity || 'MEDIUM',
      financial_impact: 0,
      payload: { asset_id: partnerAssetId, vehicle_reg, description, ref: eventRef, sector, callback_url: keyRecord.callback_url || null, ...payload },
      sms_fired: false,
      created_at: new Date().toISOString()
    })

    if (insertErr) {
      console.error('[v1/ingest]', requestId, 'insert error:', insertErr.message, insertErr.code)
      return errResponse('ERR_004', 500, requestId)
    }

    return Response.json({
      success: true,
      ref: eventRef,
      message: 'Event received',
      status: severity || 'MEDIUM',
      sector,
      asset_id: partnerAssetId
    })

  } catch (err) {
    console.error('[v1/ingest]', requestId, 'internal error:', err)
    return errResponse('ERR_004', 500, requestId)
  }
}
