import { createClient } from '@supabase/supabase-js'
import {
  DEMO_BREAKDOWN_LAT,
  DEMO_BREAKDOWN_LNG,
  DEMO_BREAKDOWN_AREA_LABEL,
  DEMO_VEHICLE_REG,
  DEMO_DRIVER_NAME,
  DEMO_SHIPMENT_REF,
} from '../../../../lib/demoBreakdown.js'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder') || key.includes('placeholder')) return null
  return createClient(url, key)
}

function checkInternalKey(request) {
  const headerKey = request.headers.get('x-dh-key')
  return headerKey === process.env.DH_INTERNAL_KEY
}

export async function POST(request) {
  if (!checkInternalKey(request)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  let body = {}
  try { body = await request.json() } catch {
    // empty body is fine — defaults below
  }

  const clientId = (body.client_id || 'pearson-haulage').toLowerCase().trim()
  const ref = body.ref || DEMO_SHIPMENT_REF
  const vehicleReg = (body.vehicle_reg || DEMO_VEHICLE_REG).toUpperCase().trim()
  const driverName = body.driver_name || DEMO_DRIVER_NAME

  // Look up driver phone from driver_progress for this vehicle
  let driverPhone = null
  const db = getDB()
  if (db) {
    try {
      const { data: dp } = await db.from('driver_progress')
        .select('driver_phone')
        .eq('vehicle_reg', vehicleReg)
        .not('driver_phone', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (dp?.driver_phone) driverPhone = dp.driver_phone
    } catch (err) {
      console.error('[simulate-breakdown] driver phone lookup:', err?.message)
    }
  }

  const canonicalPayload = {
    client_id: clientId,
    driver_name: driverName,
    driver_phone: driverPhone,
    vehicle_reg: vehicleReg,
    ref,
    issue_type: 'breakdown',
    issue_description: `BREAKDOWN EMERGENCY. ${vehicleReg}, ${driverName}. Location: ${DEMO_BREAKDOWN_AREA_LABEL}. Vehicle broken down — engine warning light, loss of power. Job: Leeds to Bradford. Cargo: mixed retail. IMPORTANT: Tell the driver to stay with their vehicle — ops have been notified and are arranging recovery. Driver will receive confirmation shortly. Then assess SLA risk.`,
    human_description: 'Breakdown',
    area_label_override: DEMO_BREAKDOWN_AREA_LABEL,
    latitude: DEMO_BREAKDOWN_LAT,
    longitude: DEMO_BREAKDOWN_LNG,
    at_risk_refs: [ref]
  }

  try {
    const origin = new URL(request.url).origin
    const res = await fetch(`${origin}/api/driver/alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(canonicalPayload)
    })
    const json = await res.json()

    return Response.json({
      ok: res.ok,
      simulated: true,
      vehicle_reg: vehicleReg,
      driver_name: driverName,
      ref,
      alert_response: json
    })
  } catch (err) {
    console.error('[simulate-breakdown] forward failed:', err)
    return Response.json({ ok: false, error: 'forward_failed', message: err.message }, { status: 500 })
  }
}
