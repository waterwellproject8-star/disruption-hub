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

export async function POST(request) {
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
      path: '/api/v1/ingest',
      method: 'POST',
      ts: new Date().toISOString()
    }))

    const body = await request.json()
    const { client_id, asset_id, event_type, severity, description, ref, payload } = body

    if (!client_id || !event_type) {
      return Response.json({ error: 'ERR_002', message: 'client_id and event_type are required' }, { status: 400 })
    }

    const vehicle_reg = asset_id ? asset_id.toUpperCase().trim() : null
    const normalised_client = client_id.toLowerCase().trim()
    const eventRef = ref || `EVT-${Date.now().toString(36).toUpperCase()}`

    if (body.sandbox === true) {
      const sandboxRef = `sandbox_${eventRef}`
      console.log('[sandbox]', JSON.stringify({ client_id: normalised_client, event_type, ref: sandboxRef }))
      return Response.json({
        success: true,
        ref: sandboxRef,
        message: 'Event received',
        status: severity || 'MEDIUM',
        sandbox: true
      })
    }

    const db = getDB()
    if (!db) return Response.json({ error: 'ERR_004', message: 'Request could not be processed' }, { status: 500 })

    const { error: insertErr } = await db.from('webhook_log').insert({
      client_id: normalised_client,
      system_name: 'api_v1',
      direction: 'inbound',
      event_type,
      severity: severity || 'MEDIUM',
      financial_impact: 0,
      payload: { vehicle_reg, description, ref: eventRef, ...payload },
      sms_fired: false,
      created_at: new Date().toISOString()
    })

    if (insertErr) {
      console.error('[v1/ingest] insert error:', insertErr.message, insertErr.code)
      return Response.json({ error: 'ERR_004', message: 'Request could not be processed' }, { status: 500 })
    }

    return Response.json({
      success: true,
      ref: eventRef,
      message: 'Event received',
      status: severity || 'MEDIUM'
    })

  } catch (err) {
    console.error('[v1/ingest] internal error:', err)
    return Response.json({ error: 'ERR_004', message: 'Request could not be processed' }, { status: 500 })
  }
}
