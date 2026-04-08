import { createClient } from '@supabase/supabase-js'

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
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Pause length="1"/><Say voice="alice" language="en-GB">${twimlMessage}</Say><Pause length="1"/><Say voice="alice" language="en-GB">I will repeat that.</Say><Pause length="1"/><Say voice="alice" language="en-GB">${twimlMessage}</Say><Pause length="1"/><Say voice="alice" language="en-GB">End of message from DisruptionHub.</Say></Response>`
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

function buildDriverInstructionSMS({ driverName, action, ref }) {
  return [
    `DisruptionHub OPS INSTRUCTION${ref ? ` — ${ref}` : ''}`,
    '',
    action,
    '',
    'Reply DONE when complete.'
  ].join('\n')
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
  const match = text.match(/\b(0800[\s\d]{8,12}|07[\d\s]{9,11}|01[\d\s]{9,11}|02[\d\s]{9,11})\b/)
  if (!match) return null
  return match[1].replace(/\s/g, '')
}

export async function POST(request) {
  try {
    const formData = await request.formData()
    const body = formData.get('Body')?.trim().toUpperCase() || ''
    const from = formData.get('From') || ''

    const db = getDB()
    if (!db) return twimlReply('DH: System error. Open disruptionhub.ai')

    const { data: clients } = await db
      .from('clients')
      .select('id, contact_name, contact_phone, system_prompt')
      .eq('contact_phone', from)
      .limit(1)

    if (!clients?.length) {
      return twimlReply('DH: Number not recognised. Visit disruptionhub.ai')
    }

    const client = clients[0]
    const clientId = client.id
    const contactName = client.contact_name || 'Ops'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://disruptionhub.ai'

    if (body === 'NO' || body === 'N' || body === 'REJECT') {
      const { data: pending } = await db
        .from('approvals')
        .select('id, action_label')
        .eq('client_id', clientId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)

      if (!pending?.length) return twimlReply('DH: No pending actions to reject.')

      await db.from('approvals').update({
        status: 'rejected',
        approved_by: contactName,
        approved_at: new Date().toISOString()
      }).eq('id', pending[0].id)

      return twimlReply('DH: Action rejected and logged.')
    }

    if (body === 'OPEN') return twimlReply(`DH: Dashboard -> ${appUrl}/dashboard`)

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

    if (body === 'YES' || body === 'Y' || body === 'APPROVE') {
      const { data: approvals } = await db
        .from('approvals')
        .select('*')
        .eq('client_id', clientId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)

      if (!approvals?.length) return twimlReply('DH: No pending actions. Check disruptionhub.ai')

      const approval = approvals[0]
      const ageHours = (Date.now() - new Date(approval.created_at).getTime()) / 3600000
      if (ageHours > 4) {
        await db.from('approvals').update({ status: 'expired' }).eq('id', approval.id)
        return twimlReply('DH: Action expired (>4hrs). Check dashboard.')
      }

      const actionType = approval.action_type || ''
      const actionLabel = approval.action_label || ''
      const details = approval.action_details || {}

      await db.from('approvals').update({
        status: 'executed',
        approved_by: contactName,
        approved_at: new Date().toISOString(),
        executed_at: new Date().toISOString()
      }).eq('id', approval.id)

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
              .eq('client_id', clientId)
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
            .eq('client_id', clientId)
            .not('driver_phone', 'is', null)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          return fallback?.driver_phone || null
        } catch { return null }
      }

      if (actionType === 'dispatch') {
        const driverPhone = await resolveDriverPhone()
        if (driverPhone) {
          const msg = `DisruptionHub OPS UPDATE${details.ref ? ` — ${details.ref}` : ''}\n\nOps confirmed. Recovery dispatched.\nStay with vehicle. Hazards on.`
          const result = await sendSMS(driverPhone, msg)
          return twimlReply(result.success ? 'DH: Driver notified. Recovery confirmed.' : 'DH: Approved. Call driver directly — SMS failed.')
        }
        return twimlReply('DH: Approved. No driver phone — call them directly.')
      }

      if (actionType === 'sms' || actionType === 'reroute' || actionType === 'notify') {
        const driverPhone = await resolveDriverPhone()
        if (driverPhone) {
          const smsText = buildDriverInstructionSMS({
            driverName: details.driver_name,
            action: actionLabel,
            ref: details.ref
          })
          const result = await sendSMS(driverPhone, smsText)
          return twimlReply(result.success ? 'DH: Driver notified. Check dashboard.' : 'DH: Approved. Send instruction to driver manually.')
        }
        return twimlReply('DH: Approved. No driver phone — send instruction manually.')
      }

      if (actionType === 'call' || actionType === 'emergency') {
        const carrierPhone = details.carrier_phone
          || extractPhoneNumber(actionLabel)
          || extractPhoneNumber(client.system_prompt)

        if (carrierPhone) {
          const { data: recentIncidents } = await db
            .from('incidents')
            .select('user_input, ref')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })
            .limit(1)

          const voiceMessage = buildCarrierVoiceMessage({
            carrierName: details.carrier_name || 'the carrier',
            vehicleReg: details.vehicle_reg,
            clientName: contactName,
            incidentDescription: recentIncidents?.[0]?.user_input?.substring(0, 150),
            opsPhone: client.contact_phone,
            ref: details.ref || recentIncidents?.[0]?.ref
          })

          const callResult = await makeCall(carrierPhone, voiceMessage)
          const driverPhone = await resolveDriverPhone()
          if (driverPhone) {
            await sendSMS(driverPhone, `DisruptionHub OPS${details.ref ? ` — ${details.ref}` : ''}\n\nOps approved. Carrier being contacted.\nStay safe.`).catch(() => {})
          }

          if (callResult.success) return twimlReply(`DH: Calling ${details.carrier_name || carrierPhone}. Driver notified.`)
          if (callResult.simulated) return twimlReply(`DH: Call ${details.carrier_name || 'carrier'} manually: ${carrierPhone}`)
          return twimlReply(`DH: Approved. Call failed — dial ${carrierPhone} manually.`)
        }

        const driverPhone = await resolveDriverPhone()
        if (driverPhone) {
          const result = await sendSMS(driverPhone, `DisruptionHub OPS${details.ref ? ` — ${details.ref}` : ''}\n\nOps approved. Help being arranged. Stay safe.`)
          return twimlReply(result.success ? 'DH: Driver notified. No carrier phone on file.' : 'DH: Approved. No carrier phone — arrange manually.')
        }
        return twimlReply('DH: Approved. No carrier or driver phone — action manually.')
      }

      const driverPhone = await resolveDriverPhone()
      if (driverPhone) {
        await sendSMS(driverPhone, `DisruptionHub OPS${details.ref ? ` — ${details.ref}` : ''}\n\nOps approved your report. Action being taken.`).catch(() => {})
      }
      return twimlReply('DH: Action approved and logged.')
    }

    return twimlReply('DH: Commands: YES / NO / OPEN / STATUS')

  } catch (error) {
    console.error('SMS webhook error:', error)
    return twimlReply('DH: Error processing command. Try again.')
  }
}
