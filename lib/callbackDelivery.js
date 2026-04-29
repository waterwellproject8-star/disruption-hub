import crypto from 'crypto'

// Single source of truth for HMAC computation + HTTP POST + timeout.
// Used by initial fire (lib/invoiceDispatch.js) and retry cron.
// Returns: { ok, status_code, response_body, error }
// Never throws — all failures normalised into the return shape.
export async function deliverCallback({ url, secret, payload, timeoutMs = 10_000 }) {
  if (!url) return { ok: false, status_code: 0, error: 'no_url' }

  const body = JSON.stringify(payload || {})
  const signature = secret
    ? 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex')
    : 'sha256=unsigned'

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-dh-signature': signature,
        'x-dh-event-type': payload?.event_type || 'unknown',
        'user-agent': 'DisruptionHub-Webhook/1.0'
      },
      body,
      signal: ctrl.signal
    })
    clearTimeout(timer)

    const responseText = await res.text().catch(() => '')
    return {
      ok: res.status >= 200 && res.status < 300,
      status_code: res.status,
      response_body: responseText.slice(0, 1000)
    }
  } catch (err) {
    clearTimeout(timer)
    const isAbort = err?.name === 'AbortError'
    return {
      ok: false,
      status_code: 0,
      error: isAbort ? 'timeout' : (err?.message || 'network_error')
    }
  }
}

// Backoff schedule (seconds from now). Index = attempt number (1-indexed).
// Attempt 1 is synchronous (no schedule entry).
const BACKOFF_SECONDS = [null, null, 60, 300, 1800]

export function nextAttemptDelay(nextAttemptNumber) {
  return BACKOFF_SECONDS[nextAttemptNumber] ?? null
}

export function nextAttemptISO(currentAttempt, maxAttempts) {
  const next = currentAttempt + 1
  if (next > maxAttempts) return null
  const delay = nextAttemptDelay(next)
  if (delay === null) return null
  return new Date(Date.now() + delay * 1000).toISOString()
}
