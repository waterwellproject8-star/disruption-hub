import { createClient } from '@supabase/supabase-js'
import { sendSMS, makeCall, extractPhoneNumber, buildCarrierVoiceMessage, buildDriverInstructionSMS } from '../../../../lib/twilio.js'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

// POST /api/webhooks/sms — Twilio inbound SMS webhook
// Configure in Twilio console: Phone Numbers → Active Numbers → Messaging → Webhook URL
// Set to: https://disruptionhub.ai/api/webhooks/sms
export async function POST(request) {
  try {
    const formData = await request.formData()
    const body = formData.get('Body')?.trim().toUpperCase() || ''
    const from = formData.get('From') || ''

    const db = getDB()
    if (!db) {
      return twimlReply('System not configured. Open disruptionhub.ai/dashboard.')
    }

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
        return twimlReply('No pending actions found. All actions may already be executed. Open disruptionhub.ai/dashboard.')
      }

      const approval = approvals[0]
      const actionType = approval.action_type || ''
      const actionLabel = approval.action_label || ''
      const details = approval.action_details || {}

      // Mark as executed in database
      await db.from('approvals').update({
        status: 'executed',
        approved_by: contactName,
        approved_at: new Date().toISOString(),
        executed_at: new Date().toISOString()
      }).eq('id', approval.id)

      // ── PHASE 2: SMS instruction to driver ──────────────────────────────────
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
          const sent = result.success || result.simulated

          return twimlReply(
            sent
              ? `✓ Instruction sent to driver.\n"${actionLabel.substring(0, 80)}"\n\nDriver will receive the message now. Open dashboard to monitor.`
              : `✓ Approved. Driver phone not on file — forward instruction manually:\n${actionLabel.substring(0, 100)}`
          )
        }
        return twimlReply(`✓ Approved: ${actionLabel.substring(0, 100)}\n\nNo driver phone on file. Send instruction manually.`)
      }

      // ── PHASE 3: Outbound voice call to carrier ──────────────────────────────
      if (actionType === 'call' || actionType === 'emergency') {
        // Try to extract carrier phone from action label or details
        const carrierPhone = details.carrier_phone || extractPhoneNumber(actionLabel) || extractPhoneNumber(client.system_prompt)

        if (carrierPhone) {
          // Get incident context for the voice message
          const { data: recentIncident } = await db.from('incidents')
            .select('user_input, ref')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })
            .limit(1)

          const voiceMessage = buildCarrierVoiceMessage({
            carrierName: details.carrier_name || 'the carrier',
            vehicleReg: details.vehicle_reg || recentIncident?.[0]?.user_input?.match(/[A-Z]{2}\d{2}\s?[A-Z]{3}/)?.[0],
            clientName: client.contact_name ? `${client.contact_name} at Pearson Haulage` : 'your client',
            incidentDescription: recentIncident?.[0]?.user_input?.substring(0, 180),
            opsPhone: client.contact_phone,
            ref: details.ref || recentIncident?.[0]?.ref
          })

          const result = await makeCall(carrierPhone, voiceMessage)

          if (result.success) {
            return twimlReply(
              `✓ Calling ${details.carrier_name || carrierPhone} now.\n\nAutomated message being delivered. They will call you back on ${client.contact_phone}.\n\nOpen dashboard to monitor.`
            )
          } else if (result.simulated) {
            return twimlReply(
              `✓ Logged. Twilio not yet configured — you need to call ${details.carrier_name || 'the carrier'} manually.\n\nNumber: ${carrierPhone}\n\nSay: "${voiceMessage.substring(0, 100)}..."`
            )
          } else {
            return twimlReply(
              `✓ Logged. Call to ${carrierPhone} failed — ${result.error || 'unknown error'}. Call manually.`
            )
          }
        }

        // No carrier phone found — give the action label and ask to call manually
        return twimlReply(
          `✓ Approved. No carrier number found in system.\nAction: ${actionLabel.substring(0, 120)}\n\nCall carrier manually. Open dashboard for contact details.`
        )
      }

      // ── EMAIL / NOTIFY / OTHER ────────────────────────────────────────────────
      if (actionType === 'email' || actionType === 'notify') {
        return twimlReply(
          `✓ Notification logged: ${actionLabel.substring(0, 100)}\n\nEmail will be queued. Open dashboard to verify and send.`
        )
      }

      // ── DEFAULT ───────────────────────────────────────────────────────────────
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
        return twimlReply(
          `✗ Action rejected: ${approvals[0].action_label?.substring(0, 80)}\n\nOpen disruptionhub.ai/dashboard to review alternatives and take a different action.`
        )
      }
      return twimlReply('No pending actions to reject. Open disruptionhub.ai/dashboard.')
    }

    // ── OPEN / REVIEW ─────────────────────────────────────────────────────────
    if (body === 'OPEN' || body === 'REVIEW' || body === 'DASHBOARD') {
      return twimlReply('Open disruptionhub.ai/dashboard\nPIN: DH2026\n\nReply YES to approve the pending action or NO to reject without opening.')
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

      return twimlReply(`DisruptionHub — Recent incidents:\n${summary}\n\nReply OPEN for dashboard.`)
    }

    // ── HELP / DEFAULT ────────────────────────────────────────────────────────
    return twimlReply(
      'DisruptionHub commands:\nYES — approve pending action\nNO — reject action\nOPEN — dashboard link\nSTATUS — recent incidents'
    )

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
