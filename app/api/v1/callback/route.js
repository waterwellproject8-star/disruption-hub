import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

const BACKOFF_MS = [5000, 30000]
const MAX_ATTEMPTS = 3
const FETCH_TIMEOUT_MS = 10000

function errResponse(code, status, requestId) {
  return Response.json({ error: code, request_id: requestId }, { status })
}

async function logAttempt(db, entry) {
  try {
    const { error } = await db.from('callback_log').insert(entry)
    if (error) console.error('[v1/callback] audit log insert failed:', error.message)
  } catch (err) {
    console.error('[v1/callback] audit log insert error:', err.message)
  }
}

export async function POST(request) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const expected = process.env.DH_INTERNAL_KEY
    if (!expected) {
      console.error('[v1/callback]', requestId, 'DH_INTERNAL_KEY not configured')
      return errResponse('ERR_005', 500, requestId)
    }
    const provided = request.headers.get('x-dh-internal-key') || ''
    const a = Buffer.from(provided)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return errResponse('ERR_001', 401, requestId)
    }

    const reqBody = await request.json()
    const { ref } = reqBody

    if (!ref) {
      return errResponse('ERR_002', 400, requestId)
    }

    const db = getDB()
    if (!db) {
      console.error('[v1/callback]', requestId, 'database unavailable')
      return errResponse('ERR_005', 500, requestId)
    }

    const { data: event, error: queryErr } = await db.from('webhook_log')
      .select('payload')
      .eq('system_name', 'api_v1')
      .filter('payload->>ref', 'eq', ref)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (queryErr) {
      console.error('[v1/callback]', requestId, 'event lookup failed:', queryErr.message)
      return errResponse('ERR_004', 500, requestId)
    }

    if (!event) {
      return errResponse('ERR_003', 404, requestId)
    }

    const callbackUrl = event.payload?.callback_url
    if (!callbackUrl) {
      return Response.json({ ok: true, ref, callback_sent: false, request_id: requestId })
    }

    const { data: keyRow, error: keyErr } = await db.from('api_keys')
      .select('callback_secret')
      .eq('callback_url', callbackUrl)
      .eq('active', true)
      .limit(1)
      .maybeSingle()

    if (keyErr) {
      console.error('[v1/callback]', requestId, 'key lookup failed:', keyErr.message)
      return errResponse('ERR_004', 500, requestId)
    }

    const callbackSecret = keyRow?.callback_secret
    if (!callbackSecret) {
      console.error('[v1/callback]', requestId, 'no signing secret for ref:', ref)
      return Response.json({ ok: false, ref, callback_sent: false, request_id: requestId })
    }

    const resolved_at = new Date().toISOString()
    const payload = {
      ref,
      status: 'resolved',
      resolved_at,
      sector: event.payload?.sector || 'haulage',
      asset_id: event.payload?.asset_id || null
    }
    const body = JSON.stringify(payload)
    const sig = crypto.createHmac('sha256', callbackSecret).update(body).digest('hex')

    console.log('[v1/callback]', requestId, 'firing', JSON.stringify({ ref, target: callbackUrl, attempts: MAX_ATTEMPTS }))

    let lastStatusCode = null
    let lastResponseBody = null
    let succeeded = false
    let attempts = 0

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      attempts = i + 1
      const attemptedAt = new Date().toISOString()

      try {
        const res = await fetch(callbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-DH-Signature': `sha256=${sig}`,
            'X-DH-Event-Ref': ref,
            'User-Agent': 'DisruptionHub-Webhook/1.0'
          },
          body,
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
        })

        lastStatusCode = res.status
        try {
          const raw = await res.text()
          lastResponseBody = raw.length > 500 ? raw.substring(0, 500) : raw
        } catch {
          lastResponseBody = null
        }

        await logAttempt(db, {
          event_ref: ref,
          callback_url: callbackUrl,
          payload,
          attempt_number: attempts,
          status_code: lastStatusCode,
          response_body: lastResponseBody,
          last_attempted_at: attemptedAt,
          succeeded_at: res.ok ? attemptedAt : null
        })

        if (res.ok) {
          succeeded = true
          break
        }

        console.error('[v1/callback]', requestId, 'partner returned', res.status, 'attempt', attempts, 'ref:', ref)
      } catch (fetchErr) {
        lastStatusCode = null
        lastResponseBody = fetchErr.message

        await logAttempt(db, {
          event_ref: ref,
          callback_url: callbackUrl,
          payload,
          attempt_number: attempts,
          status_code: null,
          response_body: fetchErr.message?.substring(0, 500) || 'network error',
          last_attempted_at: attemptedAt,
          succeeded_at: null
        })

        console.error('[v1/callback]', requestId, 'network error attempt', attempts, 'ref:', ref, fetchErr.message)
      }

      if (i < MAX_ATTEMPTS - 1) {
        await new Promise(r => setTimeout(r, BACKOFF_MS[i]))
      }
    }

    const allNetworkErrors = lastStatusCode === null && !succeeded
    const lastAttemptedAt = new Date().toISOString()

    return Response.json({
      ok: succeeded,
      ref,
      attempts,
      final_status_code: lastStatusCode,
      last_attempted_at: lastAttemptedAt,
      request_id: requestId
    }, {
      status: allNetworkErrors ? 502 : 200
    })

  } catch (err) {
    console.error('[v1/callback]', requestId, 'internal error:', err)
    return errResponse('ERR_004', 500, requestId)
  }
}
