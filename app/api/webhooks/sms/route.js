import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'
import { formatDelayForSpeech } from '../../../../lib/twilio.js'

async function sendSMS(to, body) {
  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from  = process.env.TWILIO_PHONE_NUMBER
  if (!sid || !token || !from || sid.includes('placeholder') || sid.startsWith('AC_')) {
    console.log('[Twilio SMS - not configured] To:', to, '| Body:', body)
    return { success: false, simulated: true }
  }
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ To: to, From: from, Body: body })
      }
    )
    const data = await res.json()
    return { success: res.ok, sid: data.sid, error: data.message }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

async function makeCall(to, twimlMessage) {
  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from  = process.env.TWILIO_PHONE_NUMBER
  if (!sid || !token || !from || sid.includes('placeholder') || sid.startsWith('AC_')) {
    return { success: false, simulated: true }
  }
  // Polly.Amy — British English, standard voice (instant playback, no synthesis delay)
  // Note: Polly.Amy-Generative causes 10-13s silence before speech — unacceptable for ops calls
  const safe = twimlMessage.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Amy" language="en-GB">${safe}</Say><Pause length="1"/><Say voice="Polly.Amy" language="en-GB">I will repeat that message.</Say><Pause length="1"/><Say voice="Polly.Amy" language="en-GB">${safe}</Say></Response>`
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ To: to, From: from, Twiml: twiml })
      }
    )
    const data = await res.json()
    return { success: res.ok, sid: data.sid, status: data.status, error: data.message }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

function twimlSafe(name) {
  if (!name) return 'your delivery contact'
  return name.replace(/\b([A-Z]{2,})\b/g, (match) => match.split('').join('. ') + '.')
}

function speakReg(reg) {
  if (!reg) return 'unknown'
  return reg.replace(/\s/g, '').replace(/./g, c => c + '. ').trim()
}

function twimlReply(msg) {
  const safe = msg.substring(0, 155)
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
}

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

function buildCarrierVoiceMessage({ carrierName, vehicleReg, clientName, incidentDescription, opsPhone, ref }) {
  return `This is an automated emergency alert from DisruptionHub on behalf of ${clientName || 'your client'}. ` +
    `Vehicle registration ${vehicleReg ? vehicleReg.split('').join(' ') : 'unknown'} ` +
    `${ref ? `, job reference ${ref},` : ''} ` +
    `requires immediate assistance. ` +
    `${incidentDescription ? incidentDescription.substring(0, 150) : 'Please see your dispatch system.'} ` +
    `Please call the operations manager back urgently` +
    `${opsPhone ? ` on ${opsPhone.split('').join(' ')}` : ''}.` +
    ` This is an automated message from DisruptionHub.`
}

function extractPhoneNumber(text) {
  if (!text) return null
  const match = text.match(/\b(0800[\s\d]{8,12}|07[\d\s]{9,11}|01[\d\s]{9,11}|02[\d\s]{9,11}|\+44[\s\d]{10,12})\b/)
  if (!match) return null
  return match[1].replace(/\s/g, '')
}

function toE164UK(phone) {
  if (!phone) return null
  const digits = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '')
  if (digits.startsWith('+44')) return digits
  if (digits.startsWith('0'))   return '+44' + digits.slice(1)
  if (digits.startsWith('44'))  return '+' + digits
  return null
}

// Spell out alphanumeric string for TTS — prevents Polly reading "44821" as a number
// "MAN-44821" → "M, A, N, 4, 4, 8, 2, 1"
function spellOut(str) {
  if (!str) return ''
  return str.replace(/[^a-zA-Z0-9]/g, '').split('').join(', ')
}

function extractConsigneeName(route) {
  if (!route) return null
  const brackets = route.match(/\(([^)]+)\)\s*$/)
  if (brackets) return brackets[1].trim()
  const arrow = route.split('→')
  if (arrow.length >= 2) return arrow[arrow.length - 1].trim()
  return null
}

// Build a driver-facing instruction from webhook event data
// Webhook AI analysis is written for ops ("contact driver", "call carrier") — not for the driver
// This function translates the event into plain driver instructions
function buildDriverInstruction(details, actionLabel) {
  const p = details.payload || {}
  const eventType = details.event_type || ''
  const system = details.system || ''
  const ref = details.ref || ''

  // Webfleet events
  if (system === 'webfleet') {
    if (eventType === 'temp_alarm')
      return `TEMP ALARM${ref ? ` — ${ref}` : ''}\nYour reefer is reading ${p.temp_reading || '?'}°C (threshold ${p.threshold || 5}°C). Pull over safely when safe to do so. Check reefer unit${p.reefer_unit ? ` (${p.reefer_unit})` : ''}. Do NOT continue with cargo above threshold. Reply DONE when checked.`
    if (eventType === 'temp_probe_failure')
      return `TEMP PROBE FAILURE${ref ? ` — ${ref}` : ''}\nYour temperature probe has failed at ${p.location || 'your location'}. Pull over at next safe point. Treat cargo as potentially compromised. Call ops. Reply DONE when stopped.`
    if (eventType === 'reefer_fault')
      return `REEFER FAULT${ref ? ` — ${ref}` : ''}\nFault code ${p.fault_code || 'unknown'} on your reefer unit. Pull over immediately — do NOT continue with frozen cargo at risk. Call ops for recovery instructions. Reply DONE when stopped.`
    if (eventType === 'engine_fault')
      return `ENGINE FAULT${ref ? ` — ${ref}` : ''}\nFault code ${p.fault_code || 'unknown'} detected. Pull over at next safe location. Do not continue if warning lights are showing. Call ops. Reply DONE when stopped.`
    if (eventType === 'fuel_critical')
      return `FUEL CRITICAL${ref ? ` — ${ref}` : ''}\nYou have approximately ${p.estimated_range_miles || '?'} miles of fuel remaining. ${p.nearest_forecourt ? `Nearest forecourt: ${p.nearest_forecourt}.` : 'Find a fuel stop immediately.'} Fill up now. Reply DONE when fuelled.`
    if (eventType === 'tyre_pressure')
      return `TYRE PRESSURE ALERT${ref ? ` — ${ref}` : ''}\n${p.tyre_position || 'A tyre'} is at ${p.pressure_bar || '?'} bar (minimum ${p.threshold_bar || '?'} bar). Pull over safely and check. Do NOT continue on a deflating tyre at this load weight. Reply DONE when checked.`
    if (eventType === 'panic_button')
      return `OPS RECEIVED YOUR PANIC ALERT. Help is being arranged. Stay with vehicle, doors locked. Call 999 if in immediate danger. Reply DONE when situation is stable.`
    if (eventType === 'impact_detected')
      return `IMPACT DETECTED${ref ? ` — ${ref}` : ''}\nOps received a collision alert. Are you OK? Pull over safely. Check yourself and cargo. Call 999 if anyone is injured. Reply DONE when you have assessed the situation.`
    if (eventType === 'door_open_transit')
      return `DOOR ALERT${ref ? ` — ${ref}` : ''}\nOps can see your cargo door is open. Please check your load is secure before continuing. Reply DONE when doors are secured.`
    if (eventType === 'off_route')
      return `ROUTE CHECK${ref ? ` — ${ref}` : ''}\nOps can see you are off your planned route. Is everything OK? Check your navigation. Reply DONE to confirm all is fine.`
  }

  // Microlise events
  if (system === 'microlise') {
    if (eventType === 'wtd_hours_breach' || eventType === 'wtd_hours_warning')
      return `HOURS ALERT${ref ? ` — ${ref}` : ''}\nYou have ${p.hours_remaining || '?'} hours remaining this week under WTD rules. Ops is reviewing your remaining jobs. Do NOT start any new jobs until confirmed by ops. Reply DONE when you have noted this.`
    if (eventType === 'tacho_fault')
      return `TACHO FAULT${ref ? ` — ${ref}` : ''}\nA tachograph fault has been detected. Pull over at next safe location. Do NOT drive further until tacho issue is resolved — DVSA prohibition risk. Call ops immediately. Reply DONE when stopped.`
    if (eventType === 'no_driver_card')
      return `TACHO CARD ALERT${ref ? ` — ${ref}` : ''}\nNo driver card detected. You must stop at next safe location and insert your tacho card. Driving without a card is a DVSA offence. Reply DONE when card is inserted.`
    if (eventType === 'long_stop')
      return `CHECK-IN${ref ? ` — ${ref}` : ''}\nOps has noticed you have been stopped for ${p.stop_duration_mins || '?'} minutes. Please reply to confirm everything is OK and your ETA for next delivery.`
    if (eventType === 'fatigue_alert')
      return `BREAK REQUIRED${ref ? ` — ${ref}` : ''}\nYour break is now ${p.break_overdue_mins || '?'} minutes overdue under EU Reg 561/2006. You MUST take a 45-minute break at next safe location. Reply DONE when you have stopped for your break.`
  }

  // Mandata TMS events
  if (system === 'mandata') {
    if (eventType === 'job_delayed')
      return `JOB UPDATE${ref ? ` — ${ref}` : ''}\nOps is aware of the delay. Continue to ${p.consignee || 'your destination'}. Ops is notifying the customer. Reply DONE to confirm you have noted this.`
    if (eventType === 'night_out_required')
      return `NIGHT OUT APPROVED${ref ? ` — ${ref}` : ''}\nOps has confirmed you need to stay overnight. Find a secure truck park. ${p.cargo && p.cargo.includes('chilled') ? 'Keep reefer running — cargo is temperature sensitive.' : ''} Call ops with your location. Reply DONE when parked safely.`
    if (eventType === 'driver_change')
      return `JOB REASSIGNED${ref ? ` — ${ref}` : ''}\nOps has noted a driver change is needed for ${p.job_id || 'your current job'}. Please confirm your current status and location. Reply DONE when you have spoken to ops.`
  }

  // Samsara events
  if (system === 'samsara') {
    if (eventType === 'cargo_tamper')
      return `CARGO ALERT${ref ? ` — ${ref}` : ''}\nA cargo tamper alert has been triggered. Do NOT leave the vehicle. Call 999 if you feel unsafe. Reply DONE when you have checked your load and confirmed it is secure.`
    if (eventType === 'load_movement')
      return `LOAD MOVEMENT${ref ? ` — ${ref}` : ''}\nOps detected load movement in your trailer. Pull over at next safe location and check your load is secure before continuing. Reply DONE when load is checked.`
    if (eventType === 'fatigue_alert')
      return `FATIGUE ALERT${ref ? ` — ${ref}` : ''}\nYour driving pattern indicates fatigue. Pull over at next safe location for a break. Do NOT continue driving when tired. Reply DONE when you have stopped.`
    if (eventType === 'tail_lift_fault')
      return `TAIL LIFT FAULT${ref ? ` — ${ref}` : ''}\nTail lift hydraulic fault detected. Do NOT attempt to use the tail lift. Call ops before attempting delivery. Manual unload may be arranged. Reply DONE when you have called ops.`
    if (eventType === 'wrong_fuel')
      return `WRONG FUEL ALERT${ref ? ` — ${ref}` : ''}\nA wrong fuel alert has been raised. Do NOT start the engine. Call ops immediately for recovery instructions. Reply DONE when you have stopped and called ops.`
  }

  // Compliance events
  if (system === 'compliance') {
    if (eventType === 'adr_documentation')
      return `ADR DOCUMENT MISSING${ref ? ` — ${ref}` : ''}\nYour consignor declaration is missing for the dangerous goods on this vehicle. Do NOT depart until documentation is complete. Ops is arranging this. Reply DONE when documents are received.`
    if (eventType === 'overweight_enforcement')
      return `OVERWEIGHT ALERT${ref ? ` — ${ref}` : ''}\nVehicle is over legal weight limit. Do NOT approach the weigh station. Divert away immediately. Call ops for alternative routing. Reply DONE when diverted.`
    if (eventType === 'low_bridge_risk')
      return `LOW BRIDGE AHEAD${ref ? ` — ${ref}` : ''}\nThere is a ${p.restriction_height_m || '?'}m height restriction ahead at ${p.restriction_location || 'your route'}. Your vehicle is ${p.vehicle_height_m || '?'}m. DO NOT proceed — turn around now. Call ops for alternative route. Reply DONE when diverted.`
  }

  // Generic fallback — strip ops-facing language, make it driver-appropriate
  const stripped = actionLabel
    .replace(/contact\s+driver[^.—\n]*/gi, '')
    .replace(/call\s+driver[^.—\n]*/gi, '')
    .replace(/notify\s+driver[^.—\n]*/gi, '')
    .replace(/alert\s+driver[^.—\n]*/gi, '')
    .replace(/send.*?to\s+driver[^.—\n]*/gi, '')
    .replace(/\*\*/g, '')
    .trim()

  return stripped.length > 10
    ? `OPS INSTRUCTION${ref ? ` — ${ref}` : ''}\n${stripped}\nReply DONE when complete.`
    : `OPS INSTRUCTION${ref ? ` — ${ref}` : ''}\nOps has reviewed your situation and approved action. Reply DONE when complete.`
}

export async function POST(request) {
  try {
    const formData = await request.formData()

    // Twilio signature validation — reject spoofed webhooks in production.
    // Skipped in dev so local tests without real Twilio signatures still work.
    if (process.env.NODE_ENV === 'production') {
      const authToken = process.env.TWILIO_AUTH_TOKEN
      const signature = request.headers.get('x-twilio-signature')
      if (!authToken) {
        console.error('webhooks/sms: TWILIO_AUTH_TOKEN missing — cannot validate signature')
        return new Response('Forbidden', { status: 403 })
      }
      const proto = request.headers.get('x-forwarded-proto') || 'https'
      const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
      const url = host ? `${proto}://${host}/api/webhooks/sms` : request.url
      const params = {}
      for (const [k, v] of formData.entries()) params[k] = typeof v === 'string' ? v : ''
      const valid = twilio.validateRequest(authToken, signature || '', url, params)
      if (!valid) {
        console.error('webhooks/sms: invalid Twilio signature', { url, from: params.From })
        return new Response('Forbidden', { status: 403 })
      }
    }

    const rawBody = formData.get('Body')?.trim() || ''
    const body = rawBody.toUpperCase()
    const from = formData.get('From') || ''
    const smsSid = formData.get('SmsMessageSid') || formData.get('MessageSid') || ''

    // Extract approval ref from SMS body (e.g. "YES Ref: d38fe6d6" or quoted original containing "Ref: d38fe6d6")
    const refMatch = rawBody.match(/Ref:\s*([a-f0-9]{8})/i)
    const smsRef = refMatch?.[1] || null

    const db = getDB()
    if (!db) return twimlReply('DH: System error. Open disruptionhub.ai')

    // Find client by ops manager phone number
    const { data: clients } = await db
      .from('clients')
      .select('id, contact_name, contact_phone, system_prompt')
      .eq('contact_phone', from)
      .limit(1)

    // ── DRIVER REPLY HANDLER ─────────────────────────────────────────────
    // If number not recognised as ops, check if it's a driver
    if (!clients?.length) {
      try {
        const { data: driverRow } = await db
          .from('driver_progress')
          .select('client_id, vehicle_reg, driver_name, ref')
          .eq('driver_phone', from)
          .not('status', 'eq', 'completed')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (driverRow) {
          const upperBody = body.toUpperCase().trim()
          if (upperBody === 'DONE' || upperBody.startsWith('DONE')) {
            // Clear the ops message from driver_progress
            await db.from('driver_progress')
              .update({ alert: null, updated_at: new Date().toISOString() })
              .eq('client_id', driverRow.client_id)
              .eq('vehicle_reg', driverRow.vehicle_reg)
              .not('status', 'eq', 'completed')

            // Log as resolved approval so it shows green tick in dashboard
            try {
              await db.from('approvals').insert({
                client_id: driverRow.client_id,
                action_type: 'driver_resolved',
                action_label: '✅ ' + (driverRow.driver_name || 'Driver') + ' (' + driverRow.vehicle_reg + ') confirmed complete' + (driverRow.ref ? ' — ' + driverRow.ref : ''),
                action_details: { vehicle_reg: driverRow.vehicle_reg, driver_name: driverRow.driver_name, ref: driverRow.ref, source: 'driver_done' },
                financial_value: 0,
                status: 'executed'
              })
            } catch {}

            return twimlReply('DH: Got it - logged as complete. Drive safe.')
          }
          // Driver sent something other than DONE
          return twimlReply('DH: Reply DONE when your instruction is complete.')
        }
      } catch (e) {
        console.error('[SMS] error:', e.message)
      }

      return twimlReply('DH: Number not recognised. Visit disruptionhub.ai')
    }

    const client = clients[0]
    const clientId = client.id
    const contactName = client.contact_name || 'Ops'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://disruptionhub.ai'

    // ── NO ─────────────────────────────────────────────────────────────────
    if (body === 'NO' || body === 'N' || body === 'REJECT') {
      let pending = null

      // If SMS contains a ref, reject that specific approval
      if (smsRef) {
        const { data } = await db
          .from('approvals')
          .select('id, action_label')
          .eq('client_id', clientId)
          .eq('status', 'pending')
          .ilike('id', `${smsRef}%`)
          .limit(1)
        pending = data
      }

      // Fallback: oldest pending approval (consistent with YES handler)
      if (!pending?.length) {
        const { data } = await db
          .from('approvals')
          .select('id, action_label')
          .eq('client_id', clientId)
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(1)
        pending = data
      }

      if (!pending?.length) return twimlReply('DH: No pending actions to reject.')

      await db.from('approvals').update({
        status: 'rejected',
        approved_by: contactName,
        approved_at: new Date().toISOString()
      }).eq('id', pending[0].id)

      return twimlReply('DH: Action rejected and logged.')
    }

    // ── HOLD / ALT — failed delivery actions ────────────────────────────────
    if (body === 'HOLD' || body === 'ALT') {
      let pending = null
      if (smsRef) {
        const { data } = await db.from('approvals').select('*').eq('client_id', clientId).eq('status', 'pending').ilike('id', `${smsRef}%`).limit(1)
        pending = data
      }
      if (!pending?.length) {
        const { data } = await db.from('approvals').select('*').eq('client_id', clientId).eq('status', 'pending').order('created_at', { ascending: true }).limit(1)
        pending = data
      }
      if (!pending?.length) return twimlReply('DH: No pending actions.')

      const approval = pending[0]
      const details = approval.action_details || {}
      const refTag = details.ref ? ` — ${details.ref}` : ''

      let driverMsg
      if (body === 'HOLD') {
        driverMsg = `DisruptionHub OPS${refTag}\nStay on site. Ops are making arrangements — you will receive further instructions shortly.\nDo not leave the vehicle.`
      } else {
        driverMsg = `DisruptionHub OPS${refTag}\nAlternative delivery being arranged. Ops will send the new address shortly.\nStand by at current location.`
      }

      await db.from('approvals').update({
        status: 'executed',
        approved_by: contactName,
        approved_at: new Date().toISOString(),
        executed_at: new Date().toISOString(),
        execution_result: { action: body.toLowerCase() }
      }).eq('id', approval.id)

      let driverPhone = details.driver_phone || null
      if (!driverPhone && details.vehicle_reg) {
        const { data: byReg } = await db.from('driver_progress').select('driver_phone').eq('vehicle_reg', details.vehicle_reg).not('driver_phone', 'is', null).order('updated_at', { ascending: false }).limit(1).maybeSingle()
        driverPhone = byReg?.driver_phone || null
      }

      if (details.vehicle_reg) {
        try {
          await db.from('driver_progress').update({ alert: `OPS_MSG:${driverMsg}`, updated_at: new Date().toISOString() }).eq('vehicle_reg', details.vehicle_reg).not('status', 'eq', 'completed')
        } catch (e) { console.error('[HOLD/ALT] writeInstruction:', e?.message) }
      }

      if (driverPhone) {
        await sendSMS(driverPhone, driverMsg)
        return twimlReply(`DH: ${body === 'HOLD' ? 'Driver told to stay on site.' : 'Driver told to stand by — send new address when ready.'}`)
      }
      return twimlReply(`DH: ${body === 'HOLD' ? 'Hold' : 'Alt'} logged. No driver phone — contact them directly.`)
    }

    // ── OPEN ────────────────────────────────────────────────────────────────
    if (body === 'OPEN') return twimlReply(`DH: Dashboard -> ${appUrl}/ops-9x7k`)

    // ── STATUS ──────────────────────────────────────────────────────────────
    if (body === 'STATUS') {
      const { data: incidents } = await db
        .from('incidents')
        .select('severity, financial_impact, created_at, ref')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(3)

      if (!incidents?.length) return twimlReply('DH: No recent incidents on record.')

      const lines = incidents.map((inc, i) => {
        const ago = Math.round((Date.now() - new Date(inc.created_at).getTime()) / 60000)
        const timeStr = ago < 60 ? `${ago}m ago` : `${Math.floor(ago/60)}h ago`
        const money = inc.financial_impact > 0 ? ` £${Number(inc.financial_impact).toLocaleString()}` : ''
        return `${i+1}. ${inc.severity}${money} — ${timeStr}`
      })

      return twimlReply(`DH Last 3:\n${lines.join('\n')}`)
    }

    // ── NEXT ACTION SMS HELPER ───────────────────────────────────────────────
    // After executing an action, sends the next queued pending action to ops
    // This creates a sequential decision flow — ops handles one thing at a time
    async function sendNextPendingActionSMS() {
      try {
        const { data: nextActions } = await db
          .from('approvals')
          .select('*')
          .eq('client_id', clientId)
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(1)

        if (!nextActions?.length) return // nothing queued

        const next = nextActions[0]
        const nextType = next.action_type || ''
        const nextDetails = next.action_details || {}
        const nextLabel = next.action_label || ''
        const sevEmoji = '🟠' // default — inbound route sets severity on label
        const reg = nextDetails.vehicle_reg || ''
        const consignee = nextDetails.consignee_name || nextDetails.payload?.consignee || ''
        const financial = next.financial_value > 0 ? `\n£${Number(next.financial_value).toLocaleString()} exposure` : ''

        let actionLine = ''
        if (['call','make_call'].includes(nextType) && (nextDetails.call_type === 'consignee_delay_alert' || nextDetails.call_type === 'breakdown')) {
          actionLine = `YES = call ${consignee || 'consignee'} automatically`
        } else if (['call','make_call'].includes(nextType)) {
          actionLine = `YES = call carrier for recovery`
        } else if (['sms','send_sms','notify','reroute'].includes(nextType)) {
          actionLine = `YES = notify driver`
        } else {
          actionLine = `YES = execute next action`
        }

        const refTag = next.id ? `\nRef: ${next.id.slice(0, 8)}` : ''
        const smsBody = `${sevEmoji} NEXT ACTION${reg ? ` — ${reg}` : ''}${financial}\n${actionLine}\nReply YES · NO${refTag}`

        await sendSMS(client.contact_phone || from, smsBody)
      } catch (e) {
        console.log('[sendNextPendingActionSMS] error:', e.message)
      }
    }

    // ── YES ─────────────────────────────────────────────────────────────────
    if (body === 'YES' || body === 'Y' || body === 'APPROVE') {
      let approvals = null

      // If SMS contains a ref, look up that specific approval (any action_type)
      if (smsRef) {
        const { data } = await db
          .from('approvals')
          .select('*')
          .eq('client_id', clientId)
          .eq('status', 'pending')
          .gt('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
          .ilike('id', `${smsRef}%`)
          .limit(1)
        approvals = data
      }

      // Fallback: most recent pending approval for this client (within last 4 hours)
      if (!approvals?.length) {
        const { data } = await db
          .from('approvals')
          .select('*')
          .eq('client_id', clientId)
          .eq('status', 'pending')
          .gt('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
        approvals = data
      }

      // Step 2: no dispatch/sms pending — check for pending call approval (consignee notification)
      if (!approvals?.length) {
        const { data: callApprovals } = await db.from('approvals').select('*')
          .eq('client_id', clientId).eq('status', 'pending')
          .in('action_type', ['call', 'make_call'])
          .gt('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
        if (callApprovals?.length) {
          const ca = callApprovals[0]
          const cad = ca.action_details || {}
          const { data: claimed } = await db.from('approvals').update({ approved_by: contactName, approved_at: new Date().toISOString() }).eq('id', ca.id).eq('status', 'pending').is('approved_at', null).select('id')
          if (!claimed?.length) return twimlReply('DH: Action already executed. Check dashboard.')

          let cConsignee = cad.consignee_name || null
          if (!cConsignee && cad.ref) {
            try { const { data: sh } = await db.from('shipments').select('route, consignee').eq('ref', cad.ref).maybeSingle(); cConsignee = sh?.consignee || extractConsigneeName(sh?.route) } catch {}
          }
          cConsignee = cConsignee || 'consignee'

          const consigneePhone = toE164UK(cad.consignee_phone)
          if (consigneePhone) {
            const spokenVehicle = speakReg(cad.vehicle_reg)
            const isBreakdown = cad.call_type === 'breakdown' || cad.alert_type === 'breakdown'
            const voiceMsg = isBreakdown
              ? `${twimlSafe(contactName || 'your supplier')} is calling to advise that vehicle ${spokenVehicle} has experienced a mechanical issue and will be delayed. We are arranging recovery and will provide an update as soon as possible. No action is required from you at this time. Thank you.`
              : `${twimlSafe(contactName || 'your supplier')} is calling to advise that your delivery from vehicle ${spokenVehicle} is running late. No action is required from you at this time. Thank you.`
            const callResult = await makeCall(consigneePhone, voiceMsg)
            const nowIso = new Date().toISOString()
            await db.from('approvals').update({ status: callResult.success ? 'executed' : 'failed', executed_at: nowIso, execution_result: { twilio_sid: callResult.sid, auto_fired: true } }).eq('id', ca.id)
            console.log(`[sms-YES] consignee call ${ca.id} → ${cConsignee}: ${callResult.success ? 'ok' : callResult.error || 'failed'}`)
            return twimlReply(`DH: ${cConsignee} notified ✓`)
          }
          await db.from('approvals').update({ status: 'failed', executed_at: new Date().toISOString(), execution_result: { failure_reason: 'no_consignee_phone' } }).eq('id', ca.id)
          return twimlReply(`DH: No phone on file for ${cConsignee}. Call manually.`)
        }
        return twimlReply('DH: No pending actions. Check disruptionhub.ai')
      }

      const approval = approvals[0]
      console.log(`[sms] YES found approval ${approval.id}, status: ${approval.status}, created_at: ${approval.created_at}, approved_at: ${approval.approved_at}`)
      const ageHours = (Date.now() - new Date(approval.created_at).getTime()) / 3600000
      console.log(`[sms] YES age check: ageHours=${ageHours.toFixed(2)}, created_at raw=${approval.created_at}`)
      if (ageHours > 4) {
        const { error: expireErr } = await db.from('approvals').update({ status: 'expired' }).eq('id', approval.id)
        console.log(`[sms] YES expired approval ${approval.id}, update error: ${expireErr?.message || 'none'}`)
        return twimlReply('DH: Action expired (>4hrs). Check dashboard.')
      }

      const actionType = approval.action_type || ''
      const actionLabel = approval.action_label || ''
      const details = approval.action_details || {}

      // Claim the approval without marking executed — finaliseApproval() below
      // writes the real status once we know whether Twilio actually delivered.
      const { data: updated, error: claimErr } = await db.from('approvals').update({
        approved_by: contactName,
        approved_at: new Date().toISOString()
      }).eq('id', approval.id).eq('status', 'pending').is('approved_at', null).select('id')

      console.log(`[sms] YES claim result: updated=${updated?.length || 0}, error=${claimErr?.message || 'none'}`)
      if (!updated?.length) {
        console.log(`[sms] YES claim failed — approval ${approval.id} already claimed or RLS blocked. SmsMessageSid: ${smsSid}, claimErr: ${JSON.stringify(claimErr)}`)
        return twimlReply('DH: Action already executed or expired. Check dashboard.')
      }

      // Final status writer. SMS success = sendSMS().success; call success =
      // callResult.success && !callResult.simulated. Anything else is 'failed'
      // with a structured reason in execution_result.
      async function finaliseApproval(outcome) {
        const nowIso = new Date().toISOString()
        const patch = { status: outcome.success ? 'executed' : 'failed', executed_at: nowIso }
        if (outcome.success) {
          if (outcome.twilio_sid) patch.execution_result = { twilio_sid: outcome.twilio_sid, twilio_status: outcome.twilio_status }
          else if (outcome.sms_sent) patch.execution_result = { sms_sent: true }
        } else if (outcome.simulated) {
          patch.execution_result = { simulated: true, reason: outcome.reason || 'twilio_not_configured' }
        } else {
          patch.execution_result = { failure_reason: outcome.failure_reason || 'unknown' }
        }
        const { error: finErr } = await db.from('approvals').update(patch).eq('id', approval.id)
        if (finErr) console.error('sms YES finalise failed:', finErr.message)
      }

      // RESOLVE DRIVER PHONE
      // 1. driver_phone in action_details (driver app alerts)
      // 2. look up driver_progress by vehicle_reg (webhook alerts)
      // 3. most recent non-null phone for client (fallback)
      async function resolveDriverPhone() {
        if (details.driver_phone) return details.driver_phone
        try {
          if (details.vehicle_reg) {
            const { data: byReg } = await db
              .from('driver_progress')
              .select('driver_phone')
              .eq('vehicle_reg', details.vehicle_reg)
              .not('driver_phone', 'is', null)
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            if (byReg?.driver_phone) return byReg.driver_phone
          }
          const { data: fallback } = await db
            .from('driver_progress')
            .select('driver_phone')
            .not('driver_phone', 'is', null)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          return fallback?.driver_phone || null
        } catch { return null }
      }

      // Write instruction to driver_progress.alert so driver app can poll it
      // NOTE: driver_progress has NO client_id column — never filter by it here
      // Tries vehicle_reg first, falls back to driver_phone if no vehicle_reg match
      async function writeInstructionToApp(instruction) {
        try {
          const alertPayload = { alert: `OPS_MSG:${instruction}`, updated_at: new Date().toISOString() }

          // Primary: match by vehicle_reg
          if (details.vehicle_reg) {
            const { error: wErr } = await db.from('driver_progress')
              .update(alertPayload)
              .eq('vehicle_reg', details.vehicle_reg)
              .not('status', 'eq', 'completed')
            if (!wErr) return
            console.log('[writeInstructionToApp] vehicle_reg match failed, trying driver_phone')
          }

          // Fallback: match by driver_phone
          const driverPhoneForBanner = details.driver_phone || null
          if (driverPhoneForBanner) {
            await db.from('driver_progress')
              .update(alertPayload)
              .eq('driver_phone', driverPhoneForBanner)
              .not('status', 'eq', 'completed')
          }
        } catch (e) { console.error('[writeInstructionToApp] exception:', e.message) }
      }

      // ── FAILED DELIVERY — YES means return to depot ────────────────────
      if (details.type === 'failed_delivery') {
        const driverPhone = await resolveDriverPhone()
        const driverMsg = `DisruptionHub OPS${details.ref ? ` — ${details.ref}` : ''}\nReturn goods to depot. Secure the load and head back now.\nDo not leave goods unattended.`
        await writeInstructionToApp(driverMsg)
        if (driverPhone) {
          const result = await sendSMS(driverPhone, driverMsg)
          await finaliseApproval(result.success
            ? { success: true, sms_sent: true, action: 'return_to_depot' }
            : { success: false, failure_reason: result.error || 'driver_sms_failed' })
          await sendNextPendingActionSMS()
          return twimlReply(result.success ? `DH: Driver told to return to depot with goods. ${details.vehicle_reg || ''}` : 'DH: Approved. Call driver directly — SMS failed.')
        }
        await finaliseApproval({ success: false, failure_reason: 'no_driver_phone_on_file' })
        await sendNextPendingActionSMS()
        return twimlReply('DH: Approved. No driver phone — call them directly.')
      }

      // ── DISPATCH ─────────────────────────────────────────────────────────
      if (actionType === 'dispatch') {
        const driverPhone = await resolveDriverPhone()
        const driverMsg = `DisruptionHub OPS${details.ref ? ` — ${details.ref}` : ''}\n\nOps have confirmed. Recovery is being arranged — you will receive a further update shortly. Stay with your vehicle, hazards on.`
        await writeInstructionToApp(driverMsg)

        let consigneeName = details.consignee_name || null
        if (!consigneeName && details.ref) {
          try { const { data: sh } = await db.from('shipments').select('route, consignee').eq('ref', details.ref).maybeSingle(); consigneeName = sh?.consignee || extractConsigneeName(sh?.route) } catch {}
        }
        consigneeName = consigneeName || 'consignee'

        if (driverPhone) {
          const result = await sendSMS(driverPhone, driverMsg)
          await finaliseApproval(result.success
            ? { success: true, sms_sent: true }
            : { success: false, failure_reason: result.error || 'driver_sms_failed' })

          // Find the pending consignee call approval ref for the prompt
          let callRef = ''
          const { data: nextCall } = await db.from('approvals').select('id')
            .eq('client_id', clientId).eq('status', 'pending')
            .in('action_type', ['call', 'make_call'])
            .contains('action_details', { vehicle_reg: details.vehicle_reg })
            .gt('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
            .limit(1)
          if (nextCall?.[0]?.id) callRef = `\nRef: ${nextCall[0].id.slice(0, 8)}`

          await sendSMS(client.contact_phone || from, `DisruptionHub — Recovery being arranged.\n${details.vehicle_reg || ''}: Driver briefed.\nReply YES to notify ${consigneeName}.${callRef}`)

          return twimlReply(result.success ? `DH: Confirmed. Driver briefed. Reply YES to notify ${consigneeName}.` : 'DH: Approved. Call driver directly — SMS failed.')
        }
        await finaliseApproval({ success: false, failure_reason: 'no_driver_phone_on_file' })
        return twimlReply('DH: Approved. No driver phone — call them directly.')
      }

      // ── SMS / REROUTE / NOTIFY ────────────────────────────────────────────
      if (['sms', 'send_sms', 'reroute', 'notify'].includes(actionType)) {
        const driverPhone = await resolveDriverPhone()

        // Build proper driver-facing instruction
        // For webhook-triggered approvals, build from event data
        // For agent/module actions, use action_label directly
        const isWebhook = details.source === 'webhook_inbound'
        const instruction = isWebhook
          ? buildDriverInstruction(details, actionLabel)
          : `${actionLabel}\n\nReply DONE when complete.`

        await writeInstructionToApp(instruction)

        if (driverPhone) {
          const result = await sendSMS(driverPhone, instruction)
          await finaliseApproval(result.success
            ? { success: true, sms_sent: true }
            : { success: false, failure_reason: result.error || 'driver_sms_failed' })
          await sendNextPendingActionSMS()
          return twimlReply(result.success ? 'DH: Driver notified. Check dashboard.' : 'DH: Approved. Send instruction to driver manually.')
        }
        await finaliseApproval({ success: false, failure_reason: 'no_driver_phone_on_file' })
        await sendNextPendingActionSMS()
        return twimlReply('DH: Approved. No driver phone — send instruction manually.')
      }

      // ── CALL / EMERGENCY ──────────────────────────────────────────────────
      if (actionType === 'call' || actionType === 'make_call' || actionType === 'emergency') {

        // Detect call type — prefer explicit field, infer from presence of consignee fields
        // Defaults to carrier_alert if nothing indicates a consignee call
        const callType = details.call_type ||
          (details.consignee_name || details.consignee_phone ? 'consignee_delay_alert' : 'carrier_alert')

        // ── CONSIGNEE DELAY / BREAKDOWN ALERT ──────────────────────────────────
        if (callType === 'consignee_delay_alert' || callType === 'breakdown') {
          // delay > 60 mins → manual rebook, no automated call (bypass for breakdowns — always call)
          if (callType !== 'breakdown' && details.alert_type !== 'breakdown' && details.delay_minutes && details.delay_minutes > 60) {
            await sendSMS(client.contact_phone || from, `DisruptionHub — Action needed.\n${details.vehicle_reg || ''}: Delay over 60 mins — ${details.consignee_name || 'consignee'} slot rebook required.\nCall ${details.consignee_name || 'consignee'} directly to rearrange.\nDashboard: disruptionhub.ai/unlock`)
            await finaliseApproval({ success: false, failure_reason: 'delay_exceeds_60_mins_manual_rebook_required' })
            return twimlReply('DH: Delay >60 mins — call consignee directly to rebook.')
          }

          let rawConsigneePhone = details.consignee_phone || null
          if (!rawConsigneePhone && details.consignee_name && client.system_prompt) {
            for (const line of client.system_prompt.split('\n')) {
              if (line.toLowerCase().includes(details.consignee_name.toLowerCase())) {
                rawConsigneePhone = extractPhoneNumber(line)
                if (rawConsigneePhone) break
              }
            }
          }
          if (!rawConsigneePhone) rawConsigneePhone = extractPhoneNumber(client.system_prompt)

          const consigneePhone = toE164UK(rawConsigneePhone)
          console.log('[DH Voice] consignee_delay_alert raw:', rawConsigneePhone, '→ E.164:', consigneePhone)

          if (consigneePhone) {
            const spokenVehicle = speakReg(details.vehicle_reg)
            const delayNum = parseInt(details.delay_minutes, 10) || 0
            const delaySpoken = delayNum > 0 ? formatDelayForSpeech(delayNum) : '30 minutes'
            const clientSpoken = twimlSafe(contactName || 'your supplier')
            const isBreakdown = callType === 'breakdown' || details.alert_type === 'breakdown' || details.delay_reason?.toLowerCase().includes('breakdown') || details.issue_context?.toLowerCase().includes('breakdown')

            let parts
            if (isBreakdown) {
              parts = [
                `${clientSpoken} is calling to advise that vehicle ${spokenVehicle} has experienced a mechanical issue and will be delayed.`,
                `We are arranging recovery and will provide an update as soon as possible.`,
                `No action is required from you at this time. Please contact our operations team if you need to discuss. Thank you.`
              ]
            } else {
              parts = [
                `${clientSpoken} is calling to advise that your delivery from vehicle ${spokenVehicle} is running approximately ${delaySpoken} late.`,
                details.revised_eta ? `Expected arrival is now ${details.revised_eta}.` : '',
                `No action is required from you at this time. Thank you.`
              ].filter(Boolean)
            }

            const voiceMessage = parts.join(' ')
            const callResult = await makeCall(consigneePhone, voiceMessage)

            const driverPhone = await resolveDriverPhone()
            const driverMsg = `DisruptionHub — Confirmed.\n${details.vehicle_reg || ''}: ${details.consignee_name || 'Consignee'} being called. Continue to destination.`
            await writeInstructionToApp(driverMsg)
            if (driverPhone) await sendSMS(driverPhone, driverMsg).catch(err => console.error('[sms-yes] sendSMS to driver failed:', err?.message))

            await sendNextPendingActionSMS()
            if (callResult.success) {
              await finaliseApproval({ success: true, twilio_sid: callResult.sid, twilio_status: callResult.status })
            } else if (callResult.simulated) {
              await finaliseApproval({ success: false, simulated: true, reason: callResult.reason || 'twilio_not_configured' })
            } else {
              await finaliseApproval({ success: false, failure_reason: callResult.error || 'call_error' })
            }
            if (callResult.success) return twimlReply(`DH: Calling ${details.consignee_name || consigneePhone}. Driver notified.`)
            if (callResult.simulated) return twimlReply(`DH: Call ${details.consignee_name || 'consignee'} manually: ${rawConsigneePhone}`)
            return twimlReply(`DH: Call failed (${callResult.error || 'unknown'}) — dial ${rawConsigneePhone} manually.`)
          }

          // No consignee phone found
          const driverPhone = await resolveDriverPhone()
          const driverMsg = `DisruptionHub OPS${details.ref ? ` — ${details.ref}` : ''}\n\nOps approved delay. No consignee contact on file — ops will call directly.\nContinue to destination. Reply DONE.`
          await writeInstructionToApp(driverMsg)
          if (driverPhone) await sendSMS(driverPhone, driverMsg).catch(err => console.error('[sms-yes] sendSMS to driver failed:', err?.message))
          await finaliseApproval({ success: false, failure_reason: 'no_consignee_phone' })
          return twimlReply(`DH: Approved. No consignee phone for ${details.consignee_name || 'this delivery'} — call them manually.`)
        }

        // ── FAILED DELIVERY CALLBACK ──────────────────────────────────────────
        if (callType === 'failed_delivery_callback') {
          const fdPhone = toE164UK(details.consignee_phone || extractPhoneNumber(client.system_prompt))
          if (fdPhone) {
            const fdMsg = `${twimlSafe(contactName || 'your supplier')} is calling to advise that we were unable to complete your delivery today. Please contact our operations team to rearrange at your earliest convenience. Thank you.`
            const callResult = await makeCall(fdPhone, fdMsg)
            if (callResult.success) { await finaliseApproval({ success: true, twilio_sid: callResult.sid }); return twimlReply('DH: Calling consignee about failed delivery.') }
            if (callResult.simulated) { await finaliseApproval({ success: false, simulated: true, reason: 'twilio_not_configured' }); return twimlReply(`DH: Call consignee manually: ${details.consignee_phone || 'no number'}`) }
            await finaliseApproval({ success: false, failure_reason: callResult.error || 'call_error' })
            return twimlReply(`DH: Call failed — dial consignee manually.`)
          }
          await finaliseApproval({ success: false, failure_reason: 'no_consignee_phone' })
          return twimlReply('DH: No consignee phone — call manually.')
        }

        // ── CARRIER / RECOVERY ALERT ──────────────────────────────────────────
        const rawCarrierPhone = details.carrier_phone
          || extractPhoneNumber(actionLabel)
          || extractPhoneNumber(client.system_prompt)

        const carrierPhone = toE164UK(rawCarrierPhone)
        console.log('[DH Voice] carrier_alert raw:', rawCarrierPhone, '→ E.164:', carrierPhone)

        if (carrierPhone) {
          const { data: recentIncidents } = await db
            .from('incidents')
            .select('user_input, ref')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })
            .limit(1)

          const spokenReg      = details.vehicle_reg ? details.vehicle_reg.replace(/\s/g,'').split('').join(', ') : 'unknown'
          const spokenOpsPhone = client.contact_phone ? client.contact_phone.replace(/\s/g,'').split('').join(', ') : null
          const ref = details.ref || recentIncidents?.[0]?.ref || ''

          const voiceMessage = [
            `This is an automated alert from DisruptionHub on behalf of ${contactName || 'your client'}.`,
            `Vehicle registration ${spokenReg}${ref ? `, job reference ${ref},` : ''} requires immediate assistance.`,
            recentIncidents?.[0]?.user_input ? recentIncidents[0].user_input.substring(0,150) + '.' : 'Please check your dispatch system.',
            spokenOpsPhone ? `Please call the operations manager urgently on ${spokenOpsPhone}.` : 'Please contact the operations manager urgently.',
            `This is an automated message from DisruptionHub.`
          ].join(' ')

          const callResult = await makeCall(carrierPhone, voiceMessage)
          const driverPhone = await resolveDriverPhone()
          const driverMsg = `DisruptionHub — Confirmed.\n${details.vehicle_reg || ''}: Carrier being contacted. Stay safe.`
          await writeInstructionToApp(driverMsg)
          if (driverPhone) await sendSMS(driverPhone, driverMsg).catch(err => console.error('[sms-yes] sendSMS to driver failed:', err?.message))

          if (callResult.success) {
            await finaliseApproval({ success: true, twilio_sid: callResult.sid, twilio_status: callResult.status })
          } else if (callResult.simulated) {
            await finaliseApproval({ success: false, simulated: true, reason: callResult.reason || 'twilio_not_configured' })
          } else {
            await finaliseApproval({ success: false, failure_reason: callResult.error || 'call_error' })
          }

          if (callResult.success) return twimlReply(`DH: Calling ${details.carrier_name || rawCarrierPhone}. Driver notified.`)
          if (callResult.simulated) return twimlReply(`DH: Call ${details.carrier_name || 'carrier'} manually: ${rawCarrierPhone}`)
          return twimlReply(`DH: Call failed (${callResult.error || 'unknown'}) — dial ${rawCarrierPhone} manually.`)
        }

        // No phone found for either call type
        const driverPhone = await resolveDriverPhone()
        const helpMsg = `DisruptionHub OPS${details.ref ? ` — ${details.ref}` : ''}\n\nOps approved. Help being arranged. Stay safe.`
        await writeInstructionToApp(helpMsg)
        if (driverPhone) await sendSMS(driverPhone, helpMsg).catch(err => console.error('[sms-yes] sendSMS to driver failed:', err?.message))
        await finaliseApproval({ success: false, failure_reason: 'no_carrier_or_consignee_phone' })
        return twimlReply('DH: Approved. No contact phone on file — action manually.')
      }

      // Unknown action type
      const driverPhone = await resolveDriverPhone()
      if (driverPhone) {
        const result = await sendSMS(driverPhone, `DisruptionHub OPS${details.ref ? ` — ${details.ref}` : ''}\n\nOps approved your report. Action being taken.`)
          .catch(err => ({ success: false, error: err?.message }))
        await finaliseApproval(result?.success
          ? { success: true, sms_sent: true }
          : { success: false, failure_reason: `unknown_action_type:${actionType || 'none'}` })
      } else {
        await finaliseApproval({ success: false, failure_reason: `unknown_action_type_no_driver_phone:${actionType || 'none'}` })
      }
      return twimlReply('DH: Action approved and logged.')
    }

    return twimlReply('DH: Commands: YES / NO / OPEN / STATUS')

  } catch (error) {
    console.error('SMS webhook error:', error)
    return twimlReply('DH: Error processing command. Try again.')
  }
}
