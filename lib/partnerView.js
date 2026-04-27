export const FORBIDDEN_KEYS = [
  'system_prompt',
  'contact_name', 'contact_email', 'contact_phone',
  'secondary_contact_name', 'secondary_contact_phone',
  'consignee_phone', 'driver_phone',
  'tier', 'pilot_started_at', 'active',
  'analysis', 'sms_fired', 'simulated', 'callback_fired_at',
  'callback_url', 'callback_secret',
  'financial_source', 'direction', 'system_name',
  'user_input', 'ai_response',
]

export const PAYLOAD_REDACT_KEYS = ['consignee_phone']

export const PAYLOAD_TRANSFORMS = {
  driver_name: maskDriverName,
}

export const KNOWN_PAYLOAD_KEYS = [
  'agreed_rate_gbp', 'area', 'attempted_time', 'cargo', 'cargo_type',
  'cargo_value_gbp', 'carrier_name', 'collection', 'consignee',
  'consignee_phone', 'current_eta', 'current_location',
  'delay_minutes', 'description', 'discrepancy_gbp', 'driver_dispatched',
  'driver_name', 'fault_code', 'fault_desc', 'fired_at', 'g_force',
  'hours_driven', 'invoice_ref', 'invoiced_amount_gbp', 'job_id', 'job_ref',
  'lat', 'lng', 'location', 'map_url', 'mileage', 'new_sequence',
  'original_quote_ref', 'original_sequence', 'penalty_gbp', 'probe_id',
  'reason', 'reefer_unit', 'ref', 'remaining_jobs', 'sla_deadline',
  'speed_before_mph', 'temp_reading', 'threshold', 'time',
  'value_gbp', 'vehicle_reg', 'what3words',
]

export function maskDriverName(name) {
  if (!name || typeof name !== 'string') return null
  const trimmed = name.trim()
  if (!trimmed) return null
  const parts = trimmed.split(/\s+/)
  const initial = parts[0][0].toUpperCase()
  if (parts.length === 1) return `${initial}.`
  const surname = parts[parts.length - 1]
  return `${initial}. ${surname}`
}

export function normalizeTimestamp(ts) {
  if (!ts) return null
  try { return new Date(ts).toISOString() } catch { return null }
}

export function transformPayload(payload) {
  if (!payload || typeof payload !== 'object') return null
  const out = {}
  for (const [key, value] of Object.entries(payload)) {
    if (PAYLOAD_REDACT_KEYS.includes(key)) continue
    if (FORBIDDEN_KEYS.includes(key)) continue
    if (PAYLOAD_TRANSFORMS[key]) {
      out[key] = PAYLOAD_TRANSFORMS[key](value)
      continue
    }
    if (!KNOWN_PAYLOAD_KEYS.includes(key)) {
      console.warn(`[partnerView] unknown payload key: ${key} — review and add to KNOWN_PAYLOAD_KEYS`)
    }
    out[key] = value
  }
  return out
}

export function clientToView(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    sector: row.sector,
    service_type: row.service_type,
    fleet_size: row.fleet_size,
    created_at: normalizeTimestamp(row.created_at),
  }
}

export function shipmentToView(row) {
  if (!row) return null
  return {
    id: row.id,
    client_id: row.client_id,
    ref: row.ref,
    route: row.route,
    carrier: row.carrier,
    status: row.status,
    eta: row.eta,
    sla_window: row.sla_window,
    penalty_if_breached: row.penalty_if_breached,
    alert: row.alert,
    cargo_type: row.cargo_type,
    cargo_value: row.cargo_value,
    drops: row.drops,
    multi_collection: row.multi_collection,
    collection_sequence: row.collection_sequence,
    consignee: row.consignee,
    created_at: normalizeTimestamp(row.created_at),
  }
}

export function webhookLogToIncidentView(row) {
  if (!row) return null
  return {
    id: row.id,
    client_id: row.client_id,
    event_type: row.event_type,
    severity: row.severity,
    description: row.description,
    financial_impact: row.financial_impact,
    payload: transformPayload(row.payload),
    created_at: normalizeTimestamp(row.created_at),
    resolved_at: normalizeTimestamp(row.resolved_at),
    resolution_method: row.resolution_method,
  }
}

export function applyPartnerView(rows, type, permissions = []) {
  if (!Array.isArray(rows)) rows = rows ? [rows] : []
  const requiredPermission = {
    shipment: 'fleet_read',
    client: 'fleet_read',
    incident: 'incidents_read',
  }[type]
  if (!requiredPermission) throw new Error(`Unknown partner view type: ${type}`)
  if (!permissions.includes(requiredPermission)) {
    throw new Error(`Permission denied: ${requiredPermission} required`)
  }
  const transformer = {
    shipment: shipmentToView,
    client: clientToView,
    incident: webhookLogToIncidentView,
  }[type]
  return rows.map(transformer).filter(Boolean)
}
