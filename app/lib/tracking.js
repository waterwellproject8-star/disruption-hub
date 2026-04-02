import { supabase } from './supabase.js'
import { getLatestPositions } from './telematics.js'
import { randomBytes } from 'crypto'

// ── GENERATE A TRACKING TOKEN ─────────────────────────────────────────────────
export function generateTrackingToken() {
  return randomBytes(16).toString('hex')
}

// ── CREATE A TRACKING LINK ────────────────────────────────────────────────────
export async function createTrackingLink({
  clientId,
  jobRef,
  vehicleReg,
  driverName,
  origin,
  destination,
  cargoDescription,
  estimatedArrival,
  clientBranding = {},
  expiresHours = 48
}) {
  const token = generateTrackingToken()
  const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('tracking_links')
    .insert({
      client_id: clientId,
      token,
      job_ref: jobRef,
      vehicle_reg: vehicleReg,
      driver_name: driverName,
      origin,
      destination,
      cargo_description: cargoDescription,
      estimated_arrival: estimatedArrival,
      client_branding: clientBranding,
      expires_at: expiresAt,
      status: 'in_transit',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// ── GET TRACKING INFO BY TOKEN ────────────────────────────────────────────────
export async function getTrackingByToken(token) {
  const { data, error } = await supabase
    .from('tracking_links')
    .select('*')
    .eq('token', token)
    .single()

  if (error) return null

  // Check not expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { ...data, expired: true }
  }

  // Get live vehicle position if we have a vehicle reg
  let livePosition = null
  if (data.vehicle_reg && data.status === 'in_transit') {
    try {
      const positions = await getLatestPositions(data.client_id)
      livePosition = positions.find(p => p.vehicle_reg === data.vehicle_reg) || null
    } catch {
      // Position unavailable — not a fatal error
    }
  }

  // Get status updates from driver jobs
  let jobUpdates = []
  if (data.job_ref) {
    const { data: job } = await supabase
      .from('driver_jobs')
      .select('status, notes, updated_at, instruction_acknowledged, instruction_acknowledged_at')
      .eq('ref', data.job_ref)
      .eq('client_id', data.client_id)
      .single()

    if (job) {
      jobUpdates = buildStatusTimeline(data, job)
      // Sync delivery status
      if (job.status === 'completed' && data.status === 'in_transit') {
        await supabase
          .from('tracking_links')
          .update({ status: 'delivered', delivered_at: new Date().toISOString() })
          .eq('token', token)
        data.status = 'delivered'
      }
    }
  }

  return {
    ...data,
    live_position: livePosition,
    updates: jobUpdates,
    expired: false,
  }
}

// ── UPDATE TRACKING STATUS ────────────────────────────────────────────────────
export async function updateTrackingStatus(token, status, estimatedArrival = null) {
  const update = { status }
  if (estimatedArrival) update.estimated_arrival = estimatedArrival
  if (status === 'delivered') update.delivered_at = new Date().toISOString()

  const { error } = await supabase
    .from('tracking_links')
    .update(update)
    .eq('token', token)

  if (error) throw error
}

// ── BUILD STATUS TIMELINE ─────────────────────────────────────────────────────
function buildStatusTimeline(trackingData, job) {
  const events = []

  events.push({
    time: trackingData.created_at,
    label: 'Order confirmed',
    detail: `Your delivery has been confirmed and is being prepared for dispatch.`,
    icon: 'confirmed'
  })

  if (job.instruction_acknowledged_at) {
    events.push({
      time: job.instruction_acknowledged_at,
      label: 'Out for delivery',
      detail: `Your driver is on the way${trackingData.origin ? ` from ${trackingData.origin}` : ''}.`,
      icon: 'transit'
    })
  }

  if (trackingData.status === 'delayed') {
    events.push({
      time: new Date().toISOString(),
      label: 'Slight delay',
      detail: 'Your delivery is running a little behind schedule. Your driver is still on the way.',
      icon: 'delayed'
    })
  }

  if (trackingData.status === 'delivered') {
    events.push({
      time: trackingData.delivered_at,
      label: 'Delivered',
      detail: 'Your delivery has been completed successfully.',
      icon: 'delivered'
    })
  }

  return events.sort((a, b) => new Date(a.time) - new Date(b.time))
}

// ── CALCULATE ETA FROM LIVE POSITION ─────────────────────────────────────────
export function calculateETA(position, destinationLat, destinationLng) {
  if (!position || !destinationLat || !destinationLng) return null

  const R = 6371
  const dLat = (destinationLat - position.latitude) * Math.PI / 180
  const dLng = (destinationLng - position.longitude) * Math.PI / 180
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(position.latitude * Math.PI/180) *
    Math.cos(destinationLat * Math.PI/180) *
    Math.sin(dLng/2) ** 2
  const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  const speedKmh = Math.max((position.speed_mph || 30) * 1.60934, 20)
  const etaMinutes = (distanceKm / speedKmh) * 60
  const etaDate = new Date(Date.now() + etaMinutes * 60 * 1000)

  return {
    minutes: Math.round(etaMinutes),
    distance_km: Math.round(distanceKm * 10) / 10,
    arrives_at: etaDate.toISOString(),
    arrives_at_formatted: etaDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }
}
