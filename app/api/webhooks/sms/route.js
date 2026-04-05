import { createClient } from '@supabase/supabase-js'
import { sendSMS, makeCall, extractPhoneNumber, buildCarrierVoiceMessage, buildDriverInstructionSMS } from '../../../../lib/twilio.js'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

// POST /api/webhooks/sms
// Twilio inbound SMS webhook — handles YES/NO/OPEN/STATUS replies from ops manager
export async function POST(request) {
  try {
    const formData = await request.formData()
    const body = formData.get('Body')?.trim().toUpperCase() || ''
    const from = formData.get('From') || ''

    const db = getDB()
    if (!db) return twimlReply('DH: System error. Open disruptionhub.ai')

    // Find client by ops manager phone number
    const { data: clients } = await db.from('clients')
      .select('id, contact_name, contact_phone, system_prompt, fleet_size')
      .eq('contact_phone', from)
      .limit(1)

    if (!clients?.length) {
      return twimlReply('DH: Number not found. Check disruptionhub.ai')
    }

    const client = clients[0]
    const clientId = client.id
    const contactName = client.contact_name || 'Ops'

    // ── YES / APPROVE ─────────────────────────────────────────────────────────
    if (body === 'YES' || body === 'Y' || body === 'APPROVE') {
      const { data: approvals } = await db.from('approvals')
        .select('*')
        .eq('client_id', clientId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)

      if (!approvals?.length) {
        return twimlReply('DH: No pending actions. Check disruptionhub.ai')
      }

      const approval = approvals[0]

      // Expire approvals older than 4 hours
      const ageHours = (Date.now() - new Date(approval.created_at).getTime()) / 3600000
      if (ageHours > 4) {
        await db.from('approvals').update({ status:'expired' }).eq('id', approval.id)
        return twimlReply('DH: Action expired (>4hrs old). Check dashboard.')
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

      // ── DISPATCH — send driver confirmation SMS ───────────────────────────
      if (actionType === 'dispatch') {
        const driverPhone = details.driver_phone
        const vehicleReg = details.vehicle_reg || ''
        const dispatchMsg = `DisruptionHub OPS UPDATE${details.ref ? ` — ${details.ref}` : ''}\n\nRecovery vehicle has been dispatched to your location.\n\nStay with your vehicle. Keep hazards on.\n\nOps manager has been notified and is monitoring.\n\nCall ops if situation changes.`

        if (driverPhone) {
          await sendSMS(driverPhone, dispatchMsg)
          return twimlReply(`DH: ✓ Recovery dispatched. Driver notified.`)
        }

        return twimlReply(`DH: ✓ Dispatched. No driver phone — call directly.`)
      }

      // ── SMS / REROUTE — send instruction to driver ────────────────────────
      if (actionType === 'sms' || actionType === 'reroute') {
        const driverPhone = details.driver_phone
        if (driverPhone) {
          const smsText = buildDriverInstructionSMS({
            action: actionLabel,
            carrierName: details.carrier_name,
            carrierPhone: details.carrier_phone,
            script: details.script,
            ref: details.ref
          })
          const result = await sendSMS(driverPhone, smsText)
          return twimlReply(
            result.success
              ? `DH: ✓ Driver notified. Check dashboard.`
              : `DH: ✓ Approved. Send to driver manually.`
          )
        }
        return twimlReply(`DH: ✓ Approved. No driver phone — send manually.`)
      }

      // ── CALL / EMERGENCY — outbound voice call to carrier ─────────────────
      if (actionType === 'call' || actionType === 'emergency') {
        const carrierPhone = details.carrier_phone || extractPhoneNumber(actionLabel) || extractPhoneNumber(client.system_prompt)

        if (carrierPhone) {
          const { data: recentIncident } = await db.from('incidents')
            .select('user_input, ref')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })
            .limit(1)

          const voiceMessage = buildCarrierVoiceMessage({
            carrierName: details.carrier_name || 'the carrier',
            vehicleReg: details.vehicle_reg || recentIncident?.[0]?.user_input?.match(/[A-Z]{2}\d{2}\s?[A-Z]{3}/)?.[0],
            clientName: client.contact_name ? `${client.contact_name}` : 'your client',
            incidentDescription: recentIncident?.[0]?.user_input?.substring(0, 180),
            opsPhone: client.contact_phone,
            ref: details.ref || recentIncident?.[0]?.ref
          })

          const result = await makeCall(carrierPhone, voiceMessage)

          if (result.success) {
            return twimlReply(`DH: ✓ Calling ${details.carrier_name || carrierPhone}. Await callback.`)
          } else if (result.simulated) {
            return twimlReply(`DH: Call ${details.carrier_name || 'carrier'} manually: ${carrierPhone}`)
          } else {
            return twimlReply(`DH: Call failed. Call ${carrierPhone} manually.`)
          }
        }

        return twimlReply(`DH: ✓ Approved. No carrier number — call manually.`)
      }

      // ── EMAIL / NOTIFY ────────────────────────────────────────────────────
      if (actionType === 'email' || actionType === 'notify') {
        return twimlReply(`DH: ✓ Logged. Open dashboard to send.`)
      }

      // ── PRE-SHIFT CHECK ───────────────────────────────────────────────────
      if (details.source === 'preshift_check') {
        return twimlReply(`DH: ✓ Pre-shift defect logged. Call driver.`)
      }

      // ── DEFAULT ───────────────────────────────────────────────────────────
      return twimlReply(`DH: ✓ Done. Check dashboard.`)
    }

    // ── NO / REJECT ───────────────────────────────────────────────────────────
    if (body === 'NO' || body === 'N' || body === 'REJECT') {
      const { data: approvals } = await db.from('approvals')
        .select('*')
        .eq('client_id', clientId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)

      if (approvals?.length) {
        await db.from('approvals').update({ status: 'rejected' }).eq('id', approvals[0].id)
        return twimlReply(`DH: ✗ Rejected. Open disruptionhub.ai PIN:DH2026`)
      }
      return twimlReply('DH: Nothing to reject. Check dashboard.')
    }

    // ── OPEN / REVIEW ─────────────────────────────────────────────────────────
    if (body === 'OPEN' || body === 'REVIEW' || body === 'DASHBOARD') {
      // Fetch pending action so ops knows what they're approving
      const { data: pending } = await db.from('approvals')
        .select('action_label, action_type, financial_value')
        .eq('client_id', clientId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)

      const pendingLine = pending?.[0]
        ? `\nPending action: "${pending[0].action_label?.substring(0, 80)}"\n`
        : '\nNo pending actions.\n'

      const shortPending = pending?.[0] ? pending[0].action_label?.substring(0,50) : 'none'
      return twimlReply(`DH: disruptionhub.ai PIN:DH2026\nPending: ${shortPending}\nYES/NO to act.`)
    }

    // ── STATUS ────────────────────────────────────────────────────────────────
    if (body === 'STATUS') {
      const { data: recent } = await db.from('incidents')
        .select('severity, ref, created_at, financial_impact')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(3)

      const summary = recent?.map(i =>
        `${i.severity} ${i.ref}${i.financial_impact > 0 ? ` £${Number(i.financial_impact).toLocaleString()}` : ''}`
      ).join(' | ') || 'None'

      return twimlReply(`DH: ${summary}`)
    }

    // ── HELP / DEFAULT ────────────────────────────────────────────────────────
    return twimlReply('DH: YES=approve NO=reject OPEN=dashboard STATUS=incidents')

  } catch (e) {
    console.error('SMS webhook error:', e.message)
    return twimlReply('DH: Error. Open disruptionhub.ai')
  }
}

function twimlReply(message) {
  const escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
}
