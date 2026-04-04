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
    if (!db) return twimlReply('System not configured. Open disruptionhub.ai/dashboard.')

    // Find client by ops manager phone number
    const { data: clients } = await db.from('clients')
      .select('id, contact_name, contact_phone, system_prompt, fleet_size')
      .eq('contact_phone', from)
      .limit(1)

    if (!clients?.length) {
      return twimlReply('Number not recognised. Log in at disruptionhub.ai/dashboard to review actions.')
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
        return twimlReply('No pending actions found. All actions may already be executed.\n\nOpen disruptionhub.ai/dashboard for full incident log.')
      }

      const approval = approvals[0]
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
          return twimlReply(`✓ Recovery dispatched.\n\nDriver on ${vehicleReg} has been notified by SMS to stay with the vehicle.\n\nOpen dashboard to monitor.`)
        }

        return twimlReply(`✓ Recovery dispatched: ${actionLabel.substring(0, 100)}\n\nNo driver phone on file — call driver directly to confirm.\n\nOpen disruptionhub.ai/dashboard to add driver phone.`)
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
              ? `✓ Instruction sent to driver.\n"${actionLabel.substring(0, 80)}"\n\nDriver will receive the message now. Open dashboard to monitor.`
              : `✓ Approved. Driver phone not on file — forward manually:\n${actionLabel.substring(0, 100)}`
          )
        }
        return twimlReply(`✓ Approved: ${actionLabel.substring(0, 100)}\n\nNo driver phone on file. Send instruction manually.`)
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
            return twimlReply(`✓ Calling ${details.carrier_name || carrierPhone} now.\n\nAutomated message being delivered. They will call you back on ${client.contact_phone}.\n\nOpen dashboard to monitor.`)
          } else if (result.simulated) {
            return twimlReply(`✓ Logged. Call ${details.carrier_name || 'the carrier'} manually.\n\nNumber: ${carrierPhone}\n\nSay: "${voiceMessage.substring(0, 80)}..."`)
          } else {
            return twimlReply(`✓ Logged. Call to ${carrierPhone} failed — ${result.error || 'unknown error'}. Call manually.`)
          }
        }

        return twimlReply(`✓ Approved. No carrier number found.\nAction: ${actionLabel.substring(0, 100)}\n\nCall carrier manually. Open dashboard for contacts.`)
      }

      // ── EMAIL / NOTIFY ────────────────────────────────────────────────────
      if (actionType === 'email' || actionType === 'notify') {
        return twimlReply(`✓ Notification logged: ${actionLabel.substring(0, 100)}\n\nEmail queued. Open dashboard to verify and send.`)
      }

      // ── PRE-SHIFT CHECK ───────────────────────────────────────────────────
      if (details.source === 'preshift_check') {
        return twimlReply(`✓ Logged — pre-shift defect acknowledged.\n\nAction: ${actionLabel.substring(0, 100)}\n\nOpen disruptionhub.ai/dashboard to log outcome.`)
      }

      // ── DEFAULT ───────────────────────────────────────────────────────────
      return twimlReply(`✓ Executed: ${actionLabel.substring(0, 100)}\n\nOpen disruptionhub.ai/dashboard to review full incident log.`)
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
        return twimlReply(`✗ Action rejected: ${approvals[0].action_label?.substring(0, 80)}\n\nOpen disruptionhub.ai/dashboard\nPIN: DH2026\n\nTap APPROVALS tab to review alternatives.`)
      }
      return twimlReply('No pending actions to reject.\n\nOpen disruptionhub.ai/dashboard for full log.')
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

      return twimlReply(`disruptionhub.ai/dashboard\nPIN: DH2026\n${pendingLine}\nTap APPROVALS tab — it is highlighted in the top navigation.\n\nReply YES to approve or NO to reject without opening.`)
    }

    // ── STATUS ────────────────────────────────────────────────────────────────
    if (body === 'STATUS') {
      const { data: recent } = await db.from('incidents')
        .select('severity, ref, created_at, financial_impact')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(3)

      const summary = recent?.map(i =>
        `${i.ref} — ${i.severity}${i.financial_impact > 0 ? ` (£${Number(i.financial_impact).toLocaleString()})` : ''}`
      ).join('\n') || 'No recent incidents'

      return twimlReply(`DisruptionHub — Recent incidents:\n${summary}\n\nReply OPEN for dashboard link.`)
    }

    // ── HELP / DEFAULT ────────────────────────────────────────────────────────
    return twimlReply('DisruptionHub commands:\nYES — approve pending action\nNO — reject action\nOPEN — dashboard link + pending action\nSTATUS — recent incidents')

  } catch (e) {
    console.error('SMS webhook error:', e.message)
    return twimlReply('Error processing request. Open disruptionhub.ai/dashboard.')
  }
}

function twimlReply(message) {
  const escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
}
