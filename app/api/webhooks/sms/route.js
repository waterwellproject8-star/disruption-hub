import { createClient } from '@supabase/supabase-js'

// Inlined Twilio helpers — no lib import needed
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
    console.log('[Twilio Voice - not configured] To:', to)
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
  // Keep all responses under 160 chars for Twilio trial compatibility
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

// POST /api/webhooks/sms — Twilio inbound SMS webhook
export async function POST(request) {
  try {
    const formData = await request.formData()
    const body = formData.get('Body')?.trim().toUpperCase() || ''
    const from = formData.get('From') || ''

    const db = getDB()
    if (!db) return twimlReply('DH: System error. Open disruptionhub.ai')

    // Find client by ops manager phone number
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

    // ── NO ─────────────────────────────────────────────────────────────────
    if (body === 'NO' || body === 'N' || body === 'REJECT') {
      const { data: pending } = await db
        .from('approvals')
        .select('id, action_label')
        .eq('client_id', clientId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)

      if (!pending?.length) {
        return twimlReply('DH: No pending actions to reject.')
      }

      await db.from('approvals').update({
        status: 'rejected',
        approved_by: contactName,
        approved_at: new Date().toISOString()
      }).eq('id', pending[0].id)

      return twimlReply('DH: ✗ Action rejected and logged.')
    }

    // ── OPEN ────────────────────────────────────────────────────────────────
    if (body === 'OPEN') {
      return twimlReply(`DH: Dashboard → ${appUrl}/dashboard`)
    }

    // ── STATUS ──────────────────────────────────────────────────────────────
    if (body === 'STATUS') {
      const { data: incidents } = await db
        .from('incidents')
        .select('severity, financial_impact, created_at, ref')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(3)

      if (!incidents?.length) {
        return twimlReply('DH: No recent incidents on record.')
      }

      const lines = incidents.map((inc, i) => {
        const ago = Math.round((Date.now() - new Date(inc.created_at).getTime()) / 60000)
        const timeStr = ago < 60 ? `${ago}m ago` : `${Math.floor(ago/60)}h ago`
        const money = inc.financial_impact > 0 ? ` £${Number(inc.financial_impact).toLocaleString()}` : ''
        return `${i+1}. ${inc.severity}${money} — ${timeStr}`
      })

      return twimlReply(`DH Last 3:\n${lines.join('\n')}`)
    }

    // ── YES ─────────────────────────────────────────────────────────────────
    if (body === 'YES' || body === 'Y' || body === 'APPROVE') {
      const { data: approvals } = await db
        .from('approvals')
        .select('*')
        .eq('client_id', clientId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)

      if (!approvals?.length) {
        return twimlReply('DH: No pending actions. Check disruptionhub.ai')
      }

      const approval = approvals[0]

      // 4-hour expiry
      const ageHours = (Date.now() - new Date(approval.created_at).getTime()) / 3600000
      if (ageHours > 4) {
        await db.from('approvals').update({ status: 'expired' }).eq('id', approval.id)
        return twimlReply('DH: Action expired (>4hrs). Check dashboard for current status.')
      }

      const actionType = approval.action_type || ''
      const actionLabel = approval.action_label || ''
      const details = approval.action_details || {}

      // Mark as executed
      await db.from('approvals').update({
        status: 'executed',
        approved_by: contactName,
        approved_at: new Date().toISOString(),
        executed_at: new Date().toISOString()
      }).eq('id', approval.id)

      // ── DISPATCH — recovery/emergency confirmation to driver ──────────────
      if (actionType === 'dispatch') {
        const driverPhone = details.driver_phone
        if (driverPhone) {
          const msg = `DisruptionHub OPS UPDATE${details.ref ? ` — ${details.ref}` : ''}\n\nOps has confirmed your situation. Recovery dispatched to your location.\n\nStay with vehicle. Hazards on. Call ops if situation changes.`
          const result = await sendSMS(driverPhone, msg)
          return twimlReply(result.success ? 'DH: ✓ Driver notified. Recovery confirmed.' : 'DH: ✓ Approved. Call driver directly — SMS failed.')
        }
        return twimlReply('DH: ✓ Approved. No driver phone — call them directly.')
      }

      // ── SMS / REROUTE — instruction to driver ─────────────────────────────
      if (actionType === 'sms' || actionType === 'reroute' || actionType === 'notify') {
        const driverPhone = details.driver_phone
        if (driverPhone) {
          const smsText = buildDriverInstructionSMS({
            driverName: details.driver_name,
            action: actionLabel,
            ref: details.ref
          })
          const result = await sendSMS(driverPhone, smsText)
          return twimlReply(result.success ? 'DH: ✓ Driver notified. Check dashboard.' : 'DH: ✓ Approved. Send instruction to driver manually.')
        }
        return twimlReply('DH: ✓ Approved. No driver phone — send instruction manually.')
      }

      // ── CALL / EMERGENCY — Phase 3 voice call to carrier ──────────────────
      if (actionType === 'call' || actionType === 'emergency') {
        const carrierPhone = details.carrier_phone
          || extractPhoneNumber(actionLabel)
          || extractPhoneNumber(client.system_prompt)

        // If we have a carrier phone — make the voice call
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

          // Also notify driver if we have their phone
          if (details.driver_phone) {
            const driverMsg = `DisruptionHub OPS${details.ref ? ` — ${details.ref}` : ''}\n\nOps approved. Carrier being contacted now.\nStay safe. Help is coming.`
            await sendSMS(details.driver_phone, driverMsg).catch(() => {})
          }

          if (callResult.success) return twimlReply(`DH: ✓ Calling ${details.carrier_name || carrierPhone}. Driver notified.`)
          if (callResult.simulated) return twimlReply(`DH: Call ${details.carrier_name || 'carrier'} manually: ${carrierPhone}`)
          return twimlReply(`DH: ✓ Approved. Call failed — call ${carrierPhone} manually.`)
        }

        // No carrier phone — but still notify driver if possible
        if (details.driver_phone) {
          const driverMsg = `DisruptionHub OPS${details.ref ? ` — ${details.ref}` : ''}\n\nOps has reviewed your situation and approved action.\nHelp is being arranged. Stay safe.`
          const result = await sendSMS(details.driver_phone, driverMsg)
          return twimlReply(result.success ? 'DH: ✓ Driver notified. No carrier phone on file.' : 'DH: ✓ Approved. No carrier phone — arrange manually.')
        }

        return twimlReply('DH: ✓ Approved. No carrier or driver phone — action manually.')
      }

      // Unknown action type — still confirm to driver if possible
      if (details.driver_phone) {
        const driverMsg = `DisruptionHub OPS${details.ref ? ` — ${details.ref}` : ''}\n\nOps has approved your report. Action being taken.`
        await sendSMS(details.driver_phone, driverMsg).catch(() => {})
      }
      return twimlReply('DH: ✓ Action approved and logged.')
    }

    // ── UNRECOGNISED COMMAND ──────────────────────────────────────────────
    return twimlReply('DH: Commands: YES / NO / OPEN / STATUS')

  } catch (error) {
    console.error('SMS webhook error:', error)
    return twimlReply('DH: Error processing command. Try again.')
  }
}
