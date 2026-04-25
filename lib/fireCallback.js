import crypto from 'crypto'

export async function fireCallbackIfPartnerEvent({ ref, client_id, resolution_method, db }) {
  const reqId = crypto.randomUUID().slice(0, 8)
  try {
    if (!ref || !db) return { fired: false, reason: 'missing_params' }

    const { data: event, error: qErr } = await db.from('webhook_log')
      .select('id, payload')
      .eq('client_id', client_id)
      .eq('system_name', 'api_v1')
      .filter('payload->>ref', 'eq', ref)
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (qErr) {
      console.error('[fireCallback]', reqId, 'query error:', qErr.message)
      return { fired: false, reason: 'query_error' }
    }

    if (!event) return { fired: false, reason: 'not_partner_event' }

    const nowIso = new Date().toISOString()
    const { data: claimed, error: claimErr } = await db.from('webhook_log')
      .update({
        resolved_at: nowIso,
        resolution_method: resolution_method || 'unknown',
        callback_fired_at: nowIso
      })
      .eq('id', event.id)
      .is('resolved_at', null)
      .select('id')

    if (claimErr) {
      console.error('[fireCallback]', reqId, 'claim error:', claimErr.message)
      return { fired: false, reason: 'claim_error' }
    }

    if (!claimed?.length) return { fired: false, reason: 'already_resolved' }

    const callbackUrl = event.payload?.callback_url
    if (!callbackUrl) {
      return { fired: true, callback_skipped: true, reason: 'no_callback_url' }
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.disruptionhub.ai'
    const internalKey = process.env.DH_INTERNAL_KEY

    if (!internalKey) {
      console.error('[fireCallback]', reqId, 'DH_INTERNAL_KEY not set — cannot fire callback')
      return { fired: true, callback_skipped: true, reason: 'no_internal_key' }
    }

    const res = await fetch(`${baseUrl}/api/v1/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-dh-internal-key': internalKey
      },
      body: JSON.stringify({ ref }),
      signal: AbortSignal.timeout(55000)
    })

    console.log('[fireCallback]', reqId, 'ref:', ref, 'status:', res.status)
    return { fired: true, callback_fired: true, response_status: res.status, ref }

  } catch (err) {
    console.error('[fireCallback]', reqId, 'error:', err.message)
    return { fired: false, reason: 'exception' }
  }
}
