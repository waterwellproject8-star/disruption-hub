import { supabase } from './supabase.js'

// ── PROVIDER CONFIGS ──────────────────────────────────────────────────────────
const PROVIDERS = {
  samsara: {
    baseUrl: 'https://api.samsara.com',
    pollVehicles: pollSamsara,
  },
  webfleet: {
    baseUrl: 'https://csv.telematics.tomtom.com',
    pollVehicles: pollWebfleet,
  },
  verizon: {
    baseUrl: 'https://api.fleetmatics.com',
    pollVehicles: pollVerizon,
  },
}

// ── MAIN POLL FUNCTION ────────────────────────────────────────────────────────
// Called by the cron job every 2 minutes
export async function pollAllClients() {
  const { data: configs, error } = await supabase
    .from('telematics_config')
    .select('*, clients(id, name)')
    .eq('enabled', true)

  if (error) throw error

  const results = { polled: 0, positions_saved: 0, errors: [] }

  for (const config of configs || []) {
    try {
      const positions = await pollProvider(config)
      if (positions.length > 0) {
        await savePositions(config.client_id, positions, config.provider)
        await checkSLABreaches(config.client_id, positions)
        results.positions_saved += positions.length
      }
      results.polled++

      await supabase
        .from('telematics_config')
        .update({ last_poll_at: new Date().toISOString() })
        .eq('id', config.id)

    } catch (err) {
      results.errors.push({ client: config.client_id, error: err.message })
    }
  }

  return results
}

// ── POLL A SPECIFIC PROVIDER ──────────────────────────────────────────────────
async function pollProvider(config) {
  const provider = PROVIDERS[config.provider]
  if (!provider) {
    // Generic webhook — positions come in via POST, not polled
    return []
  }
  return provider.pollVehicles(config)
}

// ── SAMSARA INTEGRATION ───────────────────────────────────────────────────────
async function pollSamsara(config) {
  const res = await fetch(`${PROVIDERS.samsara.baseUrl}/fleet/vehicles/locations`, {
    headers: {
      'Authorization': `Token ${config.api_key}`,
      'Content-Type': 'application/json',
    }
  })

  if (!res.ok) throw new Error(`Samsara API error: ${res.status}`)
  const data = await res.json()

  return (data.data || []).map(v => ({
    vehicle_reg: v.name || v.id,
    driver_name: v.driver?.name || null,
    latitude: v.location?.latitude,
    longitude: v.location?.longitude,
    speed_mph: v.location?.speedMilesPerHour || 0,
    heading: v.location?.heading || 0,
    ignition_on: v.location?.isEcuSpeedValid !== false,
    source: 'samsara',
    raw_data: v,
    recorded_at: v.location?.time || new Date().toISOString(),
  })).filter(p => p.latitude && p.longitude)
}

// ── WEBFLEET (TomTom) INTEGRATION ─────────────────────────────────────────────
async function pollWebfleet(config) {
  const params = new URLSearchParams({
    account: config.fleet_id,
    username: config.api_key,
    password: config.api_secret,
    action: 'showObjectReport',
    outputformat: 'json',
  })

  const res = await fetch(`${PROVIDERS.webfleet.baseUrl}/extern?${params}`)
  if (!res.ok) throw new Error(`Webfleet API error: ${res.status}`)
  const data = await res.json()

  return (data.showObjectReport || []).map(v => ({
    vehicle_reg: v.objectno || v.objectname,
    driver_name: v.drivername || null,
    latitude: parseFloat(v.latitude) / 1000000,
    longitude: parseFloat(v.longitude) / 1000000,
    speed_mph: Math.round((v.speed || 0) * 0.621371),
    heading: v.course || 0,
    ignition_on: v.ignition !== '0',
    source: 'webfleet',
    raw_data: v,
    recorded_at: new Date().toISOString(),
  })).filter(p => p.latitude && p.longitude)
}

// ── VERIZON CONNECT INTEGRATION ───────────────────────────────────────────────
async function pollVerizon(config) {
  const res = await fetch(
    `${PROVIDERS.verizon.baseUrl}/v2/groups/${config.fleet_id}/vehicles/locations`,
    {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${config.api_key}:${config.api_secret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      }
    }
  )

  if (!res.ok) throw new Error(`Verizon API error: ${res.status}`)
  const data = await res.json()

  return (data.Vehicles || []).map(v => ({
    vehicle_reg: v.VehicleLabel || v.DeviceSerialNumber,
    driver_name: v.DriverName || null,
    latitude: v.Latitude,
    longitude: v.Longitude,
    speed_mph: Math.round(v.Speed * 0.621371),
    heading: v.Heading || 0,
    ignition_on: v.Ignition !== false,
    source: 'verizon',
    raw_data: v,
    recorded_at: v.LastUpdated || new Date().toISOString(),
  })).filter(p => p.latitude && p.longitude)
}

// ── GENERIC WEBHOOK INGEST ────────────────────────────────────────────────────
// Accepts position data from any telematics system via POST
export function normaliseWebhookPosition(body, clientId) {
  // Try to extract position from common webhook formats
  const lat = body.latitude || body.lat || body.Latitude || body.location?.lat
  const lng = body.longitude || body.lng || body.lon || body.Longitude || body.location?.lng || body.location?.lon

  if (!lat || !lng) return null

  return {
    client_id: clientId,
    vehicle_reg: body.registration || body.vehicle_reg || body.reg || body.vehicleId || body.imei || 'UNKNOWN',
    driver_name: body.driver || body.driver_name || body.driverName || null,
    latitude: parseFloat(lat),
    longitude: parseFloat(lng),
    speed_mph: Math.round((body.speed || body.speedKph || 0) * (body.speedKph ? 0.621371 : 1)),
    heading: body.heading || body.course || body.direction || 0,
    ignition_on: body.ignition !== false && body.ignition !== 'off',
    source: 'webhook',
    raw_data: body,
    recorded_at: body.timestamp || body.time || body.datetime || new Date().toISOString(),
  }
}

// ── SAVE POSITIONS TO DB ──────────────────────────────────────────────────────
export async function savePositions(clientId, positions, source = 'unknown') {
  const rows = positions.map(p => ({
    client_id: clientId,
    vehicle_reg: p.vehicle_reg,
    driver_name: p.driver_name || null,
    latitude: p.latitude,
    longitude: p.longitude,
    speed_mph: p.speed_mph || 0,
    heading: p.heading || 0,
    ignition_on: p.ignition_on !== false,
    source: p.source || source,
    raw_data: p.raw_data || null,
    recorded_at: p.recorded_at || new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('vehicle_positions')
    .insert(rows)

  if (error) throw error

  // Update telematics_config last_position_at
  await supabase
    .from('telematics_config')
    .update({ last_position_at: new Date().toISOString() })
    .eq('client_id', clientId)

  return rows.length
}

// ── GET LATEST POSITIONS FOR A CLIENT ────────────────────────────────────────
export async function getLatestPositions(clientId) {
  // Get the most recent position per vehicle using a subquery approach
  const { data, error } = await supabase
    .from('vehicle_positions')
    .select('*')
    .eq('client_id', clientId)
    .gte('recorded_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // last 30 min
    .order('recorded_at', { ascending: false })

  if (error) throw error

  // Deduplicate — only return most recent position per vehicle
  const seen = new Set()
  return (data || []).filter(p => {
    if (seen.has(p.vehicle_reg)) return false
    seen.add(p.vehicle_reg)
    return true
  })
}

// ── SLA BREACH CHECK ──────────────────────────────────────────────────────────
// When new positions arrive, check if any active jobs are at risk
export async function checkSLABreaches(clientId, positions) {
  // Get active jobs for this client
  const { data: jobs } = await supabase
    .from('driver_jobs')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'en_route')
    .not('sla_deadline', 'is', null)

  if (!jobs || jobs.length === 0) return

  const now = new Date()

  for (const job of jobs) {
    const deadline = new Date(job.sla_deadline)
    const minutesUntilDeadline = (deadline - now) / 60000
    const vehiclePos = positions.find(p => p.vehicle_reg === job.vehicle_reg)

    if (!vehiclePos) continue

    // If deadline within 90 minutes and we have live position — flag for SLA check
    if (minutesUntilDeadline > 0 && minutesUntilDeadline < 90) {
      const distanceKm = estimateDistance(
        vehiclePos.latitude, vehiclePos.longitude,
        job.destination_lat, job.destination_lng
      )
      const etaMinutes = distanceKm > 0 ? (distanceKm / Math.max(vehiclePos.speed_mph * 1.6, 40)) * 60 : 0
      const atRisk = etaMinutes > minutesUntilDeadline

      if (atRisk) {
        // Queue a SLA alert in the approvals table
        await supabase.from('approvals').insert({
          client_id: clientId,
          action_type: 'internal_flag',
          action_label: 'SLA BREACH RISK — LIVE GPS',
          action_details: {
            job_ref: job.ref,
            vehicle_reg: job.vehicle_reg,
            driver: job.driver_name,
            minutes_until_deadline: Math.round(minutesUntilDeadline),
            estimated_arrival_minutes: Math.round(etaMinutes),
            shortfall_minutes: Math.round(etaMinutes - minutesUntilDeadline),
            current_position: { lat: vehiclePos.latitude, lng: vehiclePos.longitude },
            content: `LIVE GPS SLA ALERT: ${job.ref} — driver ${job.driver_name} is ${Math.round(distanceKm)}km from ${job.destination} with ${Math.round(minutesUntilDeadline)} minutes until SLA. ETA ${Math.round(etaMinutes)} minutes.`
          },
          financial_value: 0,
          auto_approve: true,
          status: 'pending',
        })
      }
    }
  }
}

// Simple Haversine distance calculation
function estimateDistance(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2) return 0
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
