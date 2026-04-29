# DisruptionHub Partner API — Outbound Callbacks

**Last updated:** 29 April 2026
**Status:** Live in production
**Applies to:** all `/v1/*` partner integrations with `callback_url` registered

---

## Overview

When events resolve in DisruptionHub that are linked to a partner's API key,
DisruptionHub fires an HMAC-signed `POST` to the partner's pre-registered
`callback_url`. This is how partners receive asynchronous outcomes (dispute
sent, dispute resolved, incident resolved) without polling.

Two registration fields per API key:

- **`callback_url`** — fully-qualified HTTPS URL where DisruptionHub will POST
- **`callback_secret`** — opaque string used to sign every callback. Issued
  alongside the API key during onboarding. Treat as a credential.

Both are configured manually during onboarding. Self-serve registration is on
the roadmap.

---

## HMAC verification

Every callback POST includes a signature header:

```
X-DH-Signature: sha256=<hex-encoded-hmac>
```

The signature is computed as **HMAC-SHA256 over the raw JSON request body**,
using the partner's `callback_secret` as the key. No timestamp is included in
the signed content — the signature covers the body only.

An additional header `X-DH-Event-Type` is sent with every callback, containing
the event type string (e.g. `invoice.dispute_sent`).

Partners **MUST** verify the `X-DH-Signature` header on every request before
trusting the payload.

### Verification example (Node.js)

```javascript
import crypto from 'crypto'

function verifyCallback(rawBody, signatureHeader, secret) {
  // signatureHeader arrives as "sha256=<hex>"
  const receivedHex = signatureHeader.replace('sha256=', '')
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(receivedHex, 'hex'),
    Buffer.from(expected, 'hex')
  )
}

// Express middleware example:
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-dh-signature']
  if (!verifyCallback(req.body, sig, process.env.DH_CALLBACK_SECRET)) {
    return res.status(401).send('Invalid signature')
  }
  const event = JSON.parse(req.body)
  console.log('Received:', event.event_type)
  // Queue async processing here
  res.status(200).send('ok')
})
```

If `callback_secret` is not set on the API key, the signature header will
contain `sha256=unsigned`. Partners should treat unsigned callbacks as
untrusted.

---

## Delivery behaviour

DisruptionHub makes up to **4 delivery attempts** per callback event:

| Attempt | Timing | Trigger |
|---|---|---|
| 1 | Immediate (synchronous, in-process) | Event resolution |
| 2 | +1 minute after attempt 1 fails | Cron |
| 3 | +5 minutes after attempt 2 fails | Cron |
| 4 | +30 minutes after attempt 3 fails | Cron |

Total window: ~36 minutes from initial event to final attempt.

- **Timeout:** 10 seconds per attempt. Non-response within 10s = failure.
- **Failure conditions:** network error, timeout, or non-2xx HTTP response.
- **Terminal state:** after attempt 4 fails, the callback is marked failed and
  never retried. Partners experiencing prolonged outages must reconcile via
  the partner API (`GET /v1/invoice/discrepancies`) rather than wait.
- **User-Agent:** `DisruptionHub-Webhook/1.0`
- **Secret rotation:** retries use the `callback_secret` that was current at
  the time the event was first queued. If a partner rotates their secret
  between attempts, in-flight retries continue with the original secret.
  New events use the new secret.

Partners SHOULD respond with HTTP 200 within 10 seconds. Long processing
should be queued asynchronously after returning 200.

Idempotency: partners may receive the same callback up to 4 times if their
endpoint returns success after a previous attempt experienced a network
failure between sending the response and the connection closing. Use the
combination of `event_type` + `invoice_id` (or `ref` for `event.resolved`)
to de-dupe.

---

## Event types

| Event type | When fired |
|---|---|
| `event.resolved` | An operational event (`/v1/ingest`) resolves — driver fixed, recovery completed, false alarm, etc. |
| `invoice.dispute_sent` | A dispute email is sent to the carrier (via `/v1/invoice/dispute/send` or internal ops action) |
| `invoice.dispute_resolved` | An invoice dispute is marked resolved with a recovered amount |

Partners receive only events for invoices their API key created
(`created_by_api_key` match) or for events they originally pushed.

---

## Payload — `event.resolved`

```json
{
  "event_type": "event.resolved",
  "ref": "PH-4421",
  "client_id": "pearson-haulage",
  "resolved_at": "2026-04-29T11:30:00.000Z",
  "resolution_method": "driver_fixed",
  "vehicle_reg": "BN21 XKT"
}
```

`resolution_method` enum: `driver_fixed`, `recovery_fixed`, `towed`,
`other_resolved`, `driver_ok`, `driver_unwell_cover`, `false_alarm`,
`other_medical`.

---

## Payload — `invoice.dispute_sent`

Fired immediately after a successful Resend email send.

```json
{
  "event_type": "invoice.dispute_sent",
  "invoice_id": "59a66aa6-6ed8-48ba-9a39-fc9b5d223547",
  "invoice_ref": "FF-INV-DAY7-CB",
  "carrier": "FastFreight UK",
  "client_id": "pearson-haulage",
  "total_overcharge": 7.20,
  "dispute_email_id": "08f7f475-0dc5-48c8-a8c2-1e7266075ffc",
  "dispute_email_to": "billing@fastfreight.example.com",
  "sent_at": "2026-04-29T12:52:47.785Z"
}
```

---

## Payload — `invoice.dispute_resolved`

Fired when ops marks an invoice as resolved (carrier credited, recovered
amount confirmed). Always preceded by an `invoice.dispute_sent` event for
the same `invoice_id`.

```json
{
  "event_type": "invoice.dispute_resolved",
  "invoice_id": "59a66aa6-6ed8-48ba-9a39-fc9b5d223547",
  "invoice_ref": "FF-INV-DAY7-CB",
  "carrier": "FastFreight UK",
  "client_id": "pearson-haulage",
  "total_overcharge": 7.20,
  "recovered_amount": 7.20,
  "recovered_at": "2026-05-13T09:00:00.000Z",
  "response_received_at": "2026-05-13T09:00:00.000Z",
  "resolution_notes": "FastFreight issued credit note CR-FF-2026-008"
}
```

`recovered_amount` may be less than `total_overcharge` if the carrier paid a
partial credit. `0.00` indicates the dispute was closed without recovery
(carrier refused).

---

## Failure modes

| Symptom | Cause | Partner action |
|---|---|---|
| No callback arrives | `callback_url` not registered, or invoice was created internally (no `created_by_api_key`) | Verify URL with onboarding contact |
| 401 / signature mismatch on partner side | Wrong `callback_secret`, or verifying against wrong content | Verify HMAC-SHA256 over the raw body (not parsed JSON) using the exact `callback_secret` issued during onboarding |
| Callback not received after timeout | Partner endpoint took >10s to respond | Return 200 immediately, process async |
| Callback for an invoice the partner didn't create | Bug — report to support with `invoice_id` and `event_type` | — |
