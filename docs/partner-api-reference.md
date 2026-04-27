# DisruptionHub Partner API Reference

**Version:** v1
**Last updated:** 2026-04-23

---

## Overview

The DisruptionHub API allows transport partners to submit operational disruption events and query real-time fleet status programmatically. Events submitted through the API enter the same disruption management pipeline as events from TMS integrations, enabling automated triage, driver coordination, and customer communication. The API supports haulage, PSV, coach, and LGV operations.

---

## Authentication

All requests must include your API key in the `x-api-key` header:

```
x-api-key: dh_tms_live_abc123...
```

Alternatively, you may pass the key as a Bearer token:

```
Authorization: Bearer dh_tms_live_abc123...
```

### Key format

| Key prefix | Environment |
|---|---|
| `dh_tms_live_` | Production — events are processed and actioned |
| `dh_tms_test_` | Testing — events are processed but can be identified and filtered |

Keys are issued by the DisruptionHub team. If you need to rotate a key, contact support. Once rotated, the previous key is immediately invalidated.

---

## Base URL

```
https://disruptionhub.ai/api/v1
```

All endpoints are served over HTTPS only.

---

## POST /ingest

Submit a disruption event for processing.

### Request fields

| Field | Type | Required | Valid values | Description |
|---|---|---|---|---|
| `client_id` | string | Yes | Your assigned client identifier | Identifies your organisation |
| `event_type` | string | Yes | See [Event types](#event-types) | The type of disruption event |
| `asset_id` | string | No | Vehicle registration (e.g. `AB12 CDE`) | The affected vehicle. Automatically normalised to uppercase |
| `severity` | string | No | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` | Severity level. Defaults to `MEDIUM` if omitted |
| `sector` | string | No | `psv`, `coach`, `haulage`, `lgv` | Operating sector. Defaults to `haulage` if omitted or invalid |
| `description` | string | No | Free text | Human-readable description of the disruption |
| `ref` | string | No | Your internal reference | Your own reference ID. If omitted, one is generated automatically (prefixed `EVT-`) |
| `payload` | object | No | Any valid JSON object | Additional structured data relevant to the event |
| `sandbox` | boolean | No | `true` / `false` | When `true`, enables sandbox mode. See [Sandbox mode](#sandbox-mode) |

### Example: Haulage breakdown

```bash
curl -X POST https://disruptionhub.ai/api/v1/ingest \
  -H "Content-Type: application/json" \
  -H "x-api-key: dh_tms_live_abc123..." \
  -d '{
    "client_id": "acme-logistics",
    "event_type": "vehicle_off_road",
    "asset_id": "AB12 CDE",
    "severity": "HIGH",
    "sector": "haulage",
    "description": "Gearbox failure on M6 northbound, J15. Vehicle immobilised.",
    "payload": {
      "location": "M6 J15",
      "load_weight_kg": 18000
    }
  }'
```

### Example: PSV breakdown

```bash
curl -X POST https://disruptionhub.ai/api/v1/ingest \
  -H "Content-Type: application/json" \
  -H "x-api-key: dh_tms_live_abc123..." \
  -d '{
    "client_id": "city-buses",
    "event_type": "vehicle_off_road",
    "asset_id": "BUS 401",
    "severity": "CRITICAL",
    "sector": "psv",
    "description": "Engine warning light, 32 passengers on board. Route 401 Piccadilly.",
    "payload": {
      "route_number": "401",
      "passengers": 32
    }
  }'
```

### Example: Sandbox request

```bash
curl -X POST https://disruptionhub.ai/api/v1/ingest \
  -H "Content-Type: application/json" \
  -H "x-api-key: dh_tms_live_abc123..." \
  -d '{
    "client_id": "acme-logistics",
    "event_type": "vehicle_off_road",
    "asset_id": "TEST 001",
    "severity": "HIGH",
    "sector": "haulage",
    "description": "Test event — sandbox mode",
    "sandbox": true
  }'
```

### Success response

**HTTP 200**

```json
{
  "success": true,
  "ref": "EVT-2A3B4C5D",
  "message": "Event received",
  "status": "HIGH",
  "sector": "haulage"
}
```

Sandbox responses include an additional field and a modified ref:

```json
{
  "success": true,
  "ref": "sandbox_EVT-2A3B4C5D",
  "message": "Event received",
  "status": "HIGH",
  "sector": "haulage",
  "sandbox": true
}
```

### Error responses

**HTTP 401 — Unauthorised**

```json
{
  "error": "ERR_001",
  "message": "Unauthorised"
}
```

**HTTP 400 — Missing required fields**

```json
{
  "error": "ERR_002",
  "message": "client_id and event_type are required"
}
```

**HTTP 500 — Processing error**

```json
{
  "error": "ERR_004",
  "message": "Request could not be processed"
}
```

---

## GET /fleet

Retrieve current fleet status and client metadata. Requires `fleet_read` permission.

### Request fields (query parameters)

| Field | Type | Required | Description |
|---|---|---|---|
| `client_id` | string | Yes | Your assigned client identifier |
| `status` | string | No | Filter by shipment status (e.g. `on-track`, `delayed`, `disrupted`) |
| `limit` | integer | No | Max results per page (default 50, max 200) |
| `offset` | integer | No | Pagination offset (default 0) |

### Example request

```bash
curl -G "https://disruptionhub.ai/api/v1/fleet" \
  -H "x-api-key: dh_tms_live_abc123..." \
  --data-urlencode "client_id=acme-logistics"
```

### Success response

**HTTP 200**

```json
{
  "shipments": [
    {
      "ref": "SHP-00142",
      "route": "Birmingham → Manchester",
      "status": "on-track",
      "eta": "2026-04-23T14:30:00Z",
      "sla_window": "2026-04-23T16:00:00Z",
      "cargo_type": "palletised",
      "cargo_value": 18500,
      "consignee": "Tesco DC Manchester",
      "alert": null
    }
  ],
  "client": {
    "id": "acme-logistics",
    "name": "Acme Logistics Ltd",
    "sector": "haulage",
    "fleet_size": 35
  },
  "count": 1,
  "has_more": false
}
```

### Error responses

Same error format as POST /ingest. See [Error codes](#error-codes).

---

## Sector values

| Value | Description |
|---|---|
| `psv` | Public Service Vehicle — scheduled bus and urban transit operations |
| `coach` | Coach and private hire — long-distance passenger services, school contracts, tours |
| `haulage` | General haulage — goods transport, distribution, pallet networks |
| `lgv` | Light Goods Vehicle — courier, parcel, and last-mile delivery operations |

If the `sector` field is omitted or contains an unrecognised value, it defaults to `haulage`.

---

## Severity values

| Value | Description |
|---|---|
| `LOW` | Minor operational impact. No immediate action required. Example: minor delay within SLA tolerance |
| `MEDIUM` | Moderate impact. Action needed within the current shift. Example: vehicle running 30+ minutes late |
| `HIGH` | Significant disruption. Immediate action required. Example: vehicle breakdown with time-critical cargo |
| `CRITICAL` | Severe disruption affecting safety or multiple operations. Example: medical incident, vehicle fire, passengers stranded |

If the `severity` field is omitted, it defaults to `MEDIUM`.

---

## Event types

| Value | Description |
|---|---|
| `vehicle_off_road` | Vehicle breakdown, mechanical failure, or any condition that takes the vehicle out of service |
| `running_late` | Vehicle is behind schedule and at risk of missing its delivery window or service commitment |
| `failed_delivery` | Delivery attempt was unsuccessful — no access, wrong address, refused, or recipient unavailable |
| `medical` | Driver medical incident or any health-related event requiring immediate operational response |

---

## Error codes

| Code | HTTP status | Meaning |
|---|---|---|
| `ERR_001` | 401 | Authentication failed. API key is missing, invalid, or does not match the requested `client_id` |
| `ERR_002` | 400 | Required fields are missing from the request |
| `ERR_003` | 400 | Reserved for future use |
| `ERR_004` | 500 | The request could not be processed. Retry after a short delay. If persistent, contact support |

---

## Sandbox mode

Sandbox mode lets you test your integration without triggering real operational workflows.

To enable sandbox mode, include `"sandbox": true` in the request body of a POST /ingest call.

### What happens in sandbox mode

- The event is **not** stored or processed
- **No** SMS messages, calls, or notifications are sent
- **No** driver alerts or approval workflows are triggered
- A realistic response is returned with the same structure as a live response
- The `ref` field is prefixed with `sandbox_` so sandbox events are clearly identifiable
- The response includes `"sandbox": true`

### What stays the same

- Authentication is still validated — you need a valid API key
- Request validation still runs — missing required fields still return errors
- The `sector` field is still validated and defaulted

Sandbox mode is available on both live and test API keys.

---

## Rate limits

| Limit | Value |
|---|---|
| Requests per minute per key | 100 |
| Maximum request body size | 256 KB |

If you exceed the rate limit, you will receive an HTTP 429 response. Implement exponential backoff in your retry logic.

---

## Support

For API key requests, integration support, or to report issues:

**Email:** hello@disruptionhub.ai
