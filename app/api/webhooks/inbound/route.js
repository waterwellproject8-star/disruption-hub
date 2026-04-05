import Anthropic from '@anthropic-ai/sdk'
import { sendSMS } from '@/lib/twilio'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

// Convert structured machine payload into natural-language incident description
function buildDescription(system, event_type, payload) {
  const p = payload || {}

  if (system === 'mandata') {
    if (event_type === 'job_delayed')
      return `MANDATA TMS ALERT — Job Delayed\nVehicle: ${p.vehicle_reg||'unknown'}\nDelay: ${p.delay_minutes||'?'} minutes behind schedule\nReason: ${p.reason||'not specified'}\nSLA deadline: ${p.sla_deadline||'unknown'}\nConsignee: ${p.consignee||'unknown'}\nJob ID: ${p.job_id||'unknown'}`
    if (event_type === 'job_cancelled')
      return `MANDATA TMS ALERT — Job Cancellation\nVehicle: ${p.vehicle_reg||'unknown'}\nJob ID: ${p.job_id||'unknown'}\nReason: ${p.reason||'not specified'}\nValue at risk: £${p.value_gbp||0}\nCollection point: ${p.collection||'unknown'}\nConsignee: ${p.consignee||'unknown'}`
    if (event_type === 'pod_problem')
      return `MANDATA TMS ALERT — POD Not Received\nVehicle: ${p.vehicle_reg||'unknown'}\nJob: ${p.job_id||'unknown'}\nConsignee: ${p.consignee||'unknown'}\nHours overdue: ${p.hours_overdue||'?'}\nDelivery value: £${p.value_gbp||0}`
  }

  if (system === 'webfleet') {
    if (event_type === 'temp_alarm')
      return `WEBFLEET TELEMATICS ALERT — Temperature Alarm\nVehicle: ${p.vehicle_reg||'unknown'}\nTemp reading: ${p.temp_reading||'?'}°C\nThreshold: ${p.threshold||5}°C\nCargo type: ${p.cargo_type||'unknown'}\nLocation: ${p.location||'unknown'}\nThis is a LIVE sensor reading — cold chain integrity at risk`
    if (event_type === 'off_route')
      return `WEBFLEET TELEMATICS ALERT — Vehicle Off Planned Route\nVehicle: ${p.vehicle_reg||'unknown'}\nDeviation: ${p.deviation_miles||'?'} miles\nPlanned route: ${p.planned_route||'unknown'}\nCurrent location: ${p.current_location||'unknown'}\nDriver: ${p.driver_name||'unknown'}`
    if (event_type === 'panic_button')
      return `WEBFLEET TELEMATICS ALERT — PANIC BUTTON ACTIVATED\nVehicle: ${p.vehicle_reg||'unknown'}\nDriver: ${p.driver_name||'unknown'}\nLocation: ${p.location||'unknown'}\nCargo value: £${p.cargo_value||0}\nIMMEDIATE RESPONSE REQUIRED — treat as security or medical incident first`
  }

  if (system === 'microlise') {
    if (event_type === 'speeding')
      return `MICROLISE FLEET ALERT — Speed Violation\nVehicle: ${p.vehicle_reg||'unknown'}\nRecorded speed: ${p.speed_mph||'?'}mph\nPosted limit: ${p.limit_mph||56}mph\nLocation: ${p.location||'unknown'}\nDriver: ${p.driver_name||'unknown'}\nO/C recording captured`
    if (event_type === 'harsh_braking')
      return `MICROLISE FLEET ALERT — Harsh Braking Event\nVehicle: ${p.vehicle_reg||'unknown'}\nG-force recorded: ${p.g_force||'?'}G\nLocation: ${p.location||'unknown'}\nCargo type: ${p.cargo_type||'general freight'}\nPossible load shift or cargo damage — inspection required`
    if (event_type === 'long_stop')
      return `MICROLISE FLEET ALERT — Unexpected Long Stop\nVehicle: ${p.vehicle_reg||'unknown'}\nStopped for: ${p.stop_duration_mins||'?'} minutes\nLocation: ${p.location||'unknown'}\nDriver: ${p.driver_name||'unknown'}\nNo pre-planned stop at this location`
  }

  if (system === 'samsara') {
    if (event_type === 'sensor_alert')
      return `SAMSARA TELEMATICS ALERT — Door Sensor Event\nVehicle: ${p.vehicle_reg||'unknown'}\nEvent type: ${p.event||'unknown'}\nLocation: ${p.location||'unknown'}\nTime stopped: ${p.time_stopped_mins||'?'} minutes\nPossible unauthorised access or cargo issue`
    if (event_type === 'fatigue_alert')
      return `SAMSARA TELEMATICS ALERT — Driver Fatigue Warning\nVehicle: ${p.vehicle_reg||'unknown'}\nDriver: ${p.driver_name||'unknown'}\nHours driven today: ${p.hours_driven||'?'}\nNext mandatory break due in: ${p.next_break_due_mins||'?'} minutes\nLocation: ${p.location||'unknown'}\nEU Regulation 561/2006 compliance at risk`
    if (event_type === 'idling')
      return `SAMSARA TELEMATICS ALERT — Excessive Idling\nVehicle: ${p.vehicle_reg||'unknown'}\nIdle time: ${p.idle_minutes||'?'} minutes\nFuel wasted: ${p.fuel_wasted_litres||'?'} litres\nLocation: ${p.location||'unknown'}`
  }

  if (system === 'wms') {
    if (event_type === 'short_pick')
      return `WMS ALERT — Short Pick at Despatch\nOrder: ${p.order_id||'unknown'}\nWarehouse: ${p.warehouse||'unknown'}\nOrdered quantity: ${p.ordered_qty||'?'} units\nAvailable quantity: ${p.available_qty||'?'} units\nShortfall: ${p.ordered_qty&&p.available_qty ? p.ordered_qty-p.available_qty : '?'} units\nProduct: ${p.product_code||'unknown'}\nConsignee: ${p.consignee||'unknown'}\nDespatch deadline: ${p.despatch_deadline||'unknown'}`
    if (event_type === 'hold')
      return `WMS ALERT — Despatch Hold Applied\nOrder: ${p.order_id||'unknown'}\nWarehouse: ${p.warehouse||'unknown'}\nHold reason: ${p.hold_reason||'not specified'}\nConsignee: ${p.consignee||'unknown'}\nValue at risk: £${p.value_gbp||0}\nNo despatch until hold cleared`
    if (event_type === 'overweight')
      return `WMS ALERT — Overweight Load Detected\nVehicle: ${p.vehicle_reg||'unknown'}\nLoaded weight: ${p.loaded_weight_kg||'?'}kg\nLegal maximum: ${p.legal_max_kg||44000}kg\nOverweight by: ${p.loaded_weight_kg && p.legal_max_kg ? p.loaded_weight_kg-p.legal_max_kg : '?'}kg\nDepot: ${p.depot||'unknown'}\nConsignee: ${p.consignee||'unknown'}\nVehicle MUST NOT depart — legal and safety breach`
  }

  if (system === 'customer') {
    if (event_type === 'cancellation')
      return `CUSTOMER PORTAL ALERT — Booking Cancellation Received\nRef: ${p.booking_ref||'unknown'}\nCollection: ${p.collection||'unknown'}\nDelivery: ${p.delivery||'unknown'}\nPallets: ${p.pallets||'?'}\nValue: £${p.value_gbp||0}\nReason given: ${p.reason||'none'}\nDriver status: ${p.driver_already_dispatched ? 'ALREADY DISPATCHED — urgent recall needed' : 'Not yet dispatched'}`
    if (event_type === 'sla_dispute')
      return `CUSTOMER PORTAL ALERT — SLA Dispute Raised\nRef: ${p.booking_ref||'unknown'}\nConsignee: ${p.consignee||'unknown'}\nClaimed late by: ${p.claimed_late_mins||'?'} minutes\nPenalty claimed: £${p.penalty_claimed||0}\nDisputed job: ${p.disputed_ref||'unknown'}`
    if (event_type === 'change_request')
      return `CUSTOMER PORTAL ALERT — Collection Time Change Request\nRef: ${p.booking_ref||'unknown'}\nOriginal time: ${p.original_time||'unknown'}\nNew requested time: ${p.new_time||'unknown'}\nCollection point: ${p.collection||'unknown'}\nDriver already dispatched: ${p.driver_already_dispatched ? 'YES — may need recall' : 'No'}`
  }

  // Fallback for any system/event combo not mapped above
  return `WEBHOOK ALERT — ${(system||'UNKNOWN').toUpperCase()} / ${(event_type||'unknown').replace(/_/g,' ')}\n${JSON.stringify(p, null, 2)}`
}

const INBOUND_SYSTEM_PROMPT = `You are a Senior Logistics Crisis Director. You receive automated alerts from TMS systems, telematics platforms, and warehouse management systems. These are machine-generated events that require immediate operational assessment.

Respond with exactly this structure:

## DISRUPTION ASSESSMENT
- Severity: [CRITICAL / HIGH / MEDIUM / LOW]
- Estimated Financial Impact: £[X,XXX]
- Time to Resolution: [X hours]

## IMMEDIATE ACTIONS (Do these NOW)
1. [Specific action — named owner — specific deadline]
2. [Specific action — named owner — deadline]
3. [Optional third action if needed]

## WHO TO CONTACT
[Exact contacts and what to say to each]

## DOWNSTREAM RISKS
[What breaks next if this goes unresolved in the next 30 minutes]

## PREVENTION FOR NEXT TIME
[1-2 specific process improvements]

Four rules that always apply:
1. Never invent location names — if uncertain say "verify via Google Maps before dispatching"
2. Apply 1.5x buffer to all UK road time estimates and state it
3. Temperature alerts: chilled above 5°C = cold chain breach in headline. Frozen above -15°C = CRITICAL
4. Overweight vehicles: Action 1 is ALWAYS "Stop vehicle departure immediately" — never allow dispatch`

export async function POST(request) {
  try {
    const body = await request.json()
    const { system, event_type, payload, client_id = 'pearson-haulage' } = body

    if (!system || !event_type) {
      return Response.json({ error: 'system and event_type are required' }, { status: 400 })
    }

    const db = getSupabase()
    const description = buildDescription(system, event_type, payload)

    // Run AI analysis
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: INBOUND_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: description }]
    })

    const analysis = msg.content[0]?.text || ''

    // Extract severity and financial impact
    const sevMatch = analysis.match(/Severity:\s*(CRITICAL|HIGH|MEDIUM|LOW)/i)
    const severity = sevMatch ? sevMatch[1].toUpperCase() : 'MEDIUM'
    const moneyMatch = analysis.match(/£([\d,]+)/)
    const financialImpact = moneyMatch ? parseInt(moneyMatch[1].replace(/,/g, '')) : 0

    // Get client ops manager phone
    let contactPhone = null
    if (db) {
      try {
        const { data: client } = await db.from('clients').select('contact_phone').eq('id', client_id).single()
        contactPhone = client?.contact_phone
      } catch {}
    }

    // Log to webhook_log table
    let webhookLogId = null
    if (db) {
      try {
        const { data } = await db.from('webhook_log').insert({
          client_id,
          direction: 'inbound',
          system_name: system,
          event_type,
          payload,
          description,
          analysis,
          severity,
          financial_impact: financialImpact,
          sms_fired: false,
          simulated: !contactPhone
        }).select().single()
        webhookLogId = data?.id
      } catch (e) {
        console.error('webhook_log insert failed:', e.message)
      }
    }

    // Log to incidents table
    if (db) {
      try {
        const ref = `WH-${system.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`
        await db.from('incidents').insert({
          client_id,
          user_input: description,
          ai_response: analysis,
          severity,
          financial_impact: financialImpact,
          ref
        })
      } catch {}
    }

    // Send SMS for HIGH/CRITICAL
    let smsSent = false
    const shouldAlert = severity === 'CRITICAL' || severity === 'HIGH'

    if (shouldAlert && contactPhone) {
      const sysLabels = { mandata: 'Mandata', webfleet: 'Webfleet', microlise: 'Microlise', samsara: 'Samsara', wms: 'WMS', customer: 'Customer' }
      const firstAction = analysis.match(/1\.\s+(.{20,100})/)?.[1]?.split('—')[0]?.trim() || 'See dashboard'
      const eventLabel = event_type.replace(/_/g, ' ')
      const smsBody = `DH ${severity} — ${sysLabels[system]||system} ${eventLabel}\n${firstAction.substring(0, 80)}\n${financialImpact > 0 ? `£${financialImpact.toLocaleString()} ` : ''}YES/NO/OPEN`

      const result = await sendSMS(contactPhone, smsBody)
      smsSent = result?.success || false

      if (db && webhookLogId) {
        await db.from('webhook_log').update({ sms_fired: smsSent }).eq('id', webhookLogId)
      }

      // Create approval record
      if (db) {
        try {
          await db.from('approvals').insert({
            client_id,
            action_type: 'sms',
            action_label: `${sysLabels[system]||system} ${eventLabel} — ${firstAction.substring(0, 120)}`,
            action_details: { system, event_type, payload, source: 'webhook_inbound' },
            financial_value: financialImpact,
            status: 'pending'
          })
        } catch {}
      }
    }

    return Response.json({
      success: true,
      severity,
      financial_impact: financialImpact,
      analysis,
      sms_sent: smsSent,
      simulated: !contactPhone,
      webhook_log_id: webhookLogId,
      description
    })

  } catch (error) {
    console.error('Inbound webhook error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}

// GET — fetch recent inbound/outbound webhook log for dashboard
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const client_id = searchParams.get('client_id') || 'pearson-haulage'
    const limit = parseInt(searchParams.get('limit') || '30')

    const db = getSupabase()
    if (!db) return Response.json({ logs: [] })

    const { data, error } = await db
      .from('webhook_log')
      .select('id, direction, system_name, event_type, severity, financial_impact, sms_fired, simulated, created_at, payload')
      .eq('client_id', client_id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return Response.json({ logs: data || [] })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
