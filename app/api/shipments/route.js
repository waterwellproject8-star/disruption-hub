import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

function fmt(date) {
  // Always format in Europe/London timezone — fixes UTC server showing wrong times for UK drivers
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
}

function window(date, durationMins) {
  const end = new Date(date.getTime() + durationMins * 60000)
  return `${fmt(date)}-${fmt(end)}`
}

function buildPearsonShipments() {
  const now = new Date()
  // All ETAs relative to current server time
  // PH-4421: active on-track job — driver at collection, ETA to customer = now + 45min
  // PH-8832: disrupted, no ETA
  // PH-5517: delayed NHS run — now + 120min
  // PH-9103: at risk cold chain Edinburgh — now + 270min
  const r1Eta      = new Date(now.getTime() + 45  * 60000)
  const r1Slot     = new Date(now.getTime() + 15  * 60000)
  const r2SlotStart = new Date(now.getTime() - 30 * 60000) // slot started 30min ago, disrupted
  const r3Eta      = new Date(now.getTime() + 120 * 60000)
  const r3SlotStart = new Date(now.getTime() + 90  * 60000)
  const r4Eta      = new Date(now.getTime() + 270 * 60000)
  const r4SlotStart = new Date(now.getTime() + 240 * 60000)

  return [
    { ref:'PH-4421', route:'Leeds → Bradford (Tesco DC)', status:'on-track', eta:fmt(r1Eta), sla_window:window(r1Slot,90), carrier:'Pearson Haulage', cargo_type:'mixed retail', cargo_value:8400, penalty_if_breached:1200, alert:null, drops:1 },
    { ref:'PH-8832', route:'Leeds → London (M1)', status:'disrupted', eta:'???', sla_window:window(r2SlotStart,120), carrier:'Pearson Haulage', cargo_type:'mixed retail', cargo_value:18500, penalty_if_breached:2400, alert:'M1 breakdown — recovery dispatched', drops:1 },
    { ref:'PH-5517', route:'Leeds → Sheffield (NHS Supply Chain)', status:'delayed', eta:fmt(r3Eta), sla_window:window(r3SlotStart,120), carrier:'Pearson Haulage', cargo_type:'pharmaceutical', cargo_value:12000, penalty_if_breached:2400, alert:'Delayed — cascade from London disruption', drops:2 },
    { ref:'PH-9103', route:'Leeds → Edinburgh (A1)', status:'at_risk', eta:fmt(r4Eta), sla_window:window(r4SlotStart,120), carrier:'Pearson Haulage', cargo_type:'chilled 0-5C', cargo_value:9200, penalty_if_breached:1800, alert:'Cold chain — chilled cargo, slot at risk from cascade', drops:1 },
  ]
}

function buildArcticFreshShipments() {
  const now = new Date()
  const r1Eta = new Date(now.getTime() + 60 * 60000)
  const r1Slot = new Date(now.getTime() + 30 * 60000)
  const r2Eta = new Date(now.getTime() + 180 * 60000)
  const r2Slot = new Date(now.getTime() + 150 * 60000)
  return [
    { ref:'AF-1001', route:'Manchester → Birmingham (chilled)', status:'on-track', eta:fmt(r1Eta), sla_window:window(r1Slot,120), carrier:'Arctic Fresh', cargo_type:'chilled 0-5C', cargo_value:14000, penalty_if_breached:3200, alert:null, drops:1 },
    { ref:'AF-1002', route:'Manchester → Bristol (frozen)', status:'on-track', eta:fmt(r2Eta), sla_window:window(r2Slot,120), carrier:'Arctic Fresh', cargo_type:'frozen -18C', cargo_value:22000, penalty_if_breached:4500, alert:null, drops:2 },
  ]
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const client_id = searchParams.get('client_id')

  if (!client_id) {
    return Response.json({ error: 'client_id required' }, { status: 400 })
  }

  try {
    const db = getSupabase()
    if (db) {
      const { data, error } = await db
        .from('shipments')
        .select('*')
        .eq('client_id', client_id)
        .order('sequence', { ascending: true })

      if (!error && data && data.length > 0) {
        return Response.json({ shipments: data, source: 'live' })
      }
    }
  } catch {}

  let shipments
  if (client_id === 'arctic-fresh') {
    shipments = buildArcticFreshShipments()
  } else {
    shipments = buildPearsonShipments()
  }

  return Response.json({ shipments, source: 'demo' })
}
