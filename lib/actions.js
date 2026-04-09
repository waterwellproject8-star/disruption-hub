import { logAction, getClientConfig } from './supabase.js'
import {
  makeCall,
  buildCarrierVoiceMessage,
  buildConsigneeVoiceMessage,
  extractPhoneNumber
} from './twilio.js'

// Lazy clients
function getTwilio() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token || sid.includes('placeholder') || sid.startsWith('ACplaceholder')) return null
  const twilio = require('twilio')
  return twilio(sid, token)
}

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key || key.includes('placeholder') || key === 're_placeholder123456789') return null
  const { Resend } = require('resend')
  return new Resend(key)
}

// Normalise any UK number to E.164 — Twilio requires this for outbound calls
// Without this, calls silently fail with no error
function toE164UK(phone) {
  if (!phone) return null
  const digits = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '')
  if (digits.startsWith('+44')) return digits
  if (digits.startsWith('0'))   return '+44' + digits.slice(1)
  if (digits.startsWith('44'))  return '+' + digits
  return null
}

export async function sendSMS({ to, body, clientId, approvalId }) {
  const client = getTwilio()
  if (!client) return { success: false, error: 'Twilio not configured' }
  try {
    const msg = await client.messages.create({
      body: `[DisruptionHub]\n${body}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to
    })
    await logAction(clientId, approvalId, 'send_sms', { to, body }, { sid: msg.sid }, true)
    return { success: true, sid: msg.sid }
  } catch (error) {
    await logAction(clientId, approvalId, 'send_sms', { to, body }, { error: error.message }, false)
    throw error
  }
}

export async function sendEmail({ to, subject, body, clientId, approvalId }) {
  const resend = getResend()
  if (!resend) return { success: false, error: 'Resend not configured' }
  // ops@disruptionhub.ai must be verified in Resend — do not change without re-verifying
  const from = process.env.FROM_EMAIL || 'ops@disruptionhub.ai'
  try {
    const result = await resend.emails.send({ from, to, subject, html: body.replace(/\n/g, '<br>') })
    await logAction(clientId, approvalId, 'send_email', { to, subject }, result, true)
    return { success: true, id: result.id }
  } catch (error) {
    await logAction(clientId, approvalId, 'send_email', { to, subject }, { error: error.message }, false)
    throw error
  }
}

export async function placeCall({ action_details, clientId, approvalId }) {
  const d        = action_details || {}
  const callType = d.call_type || 'carrier_alert' // 'consignee_delay_alert' | 'carrier_alert'

  // ── Step 1: Resolve phone number ─────────────────────────────────────────
  // Check every field the AI might populate, in priority order.
  // The AI uses different field names depending on which module generated the action.
  let rawPhone =
    d.consignee_phone ||                                          // explicit consignee field
    d.carrier_phone   ||                                          // explicit carrier field
    d.phone           ||                                          // generic phone field
    extractPhoneNumber(d.recipient || '') ||                      // AI puts number directly in recipient
    extractPhoneNumber(d.action_label || '') ||                   // number mentioned in label
    extractPhoneNumber(d.incident_description || '') ||           // number in description
    null

  // Last resort: fetch system_prompt from Supabase and extract
  // Fixes the known bug where inbound route doesn't write phone to action_details
  if (!rawPhone && clientId) {
    try {
      const config = await getClientConfig(clientId)
      if (config?.system_prompt) {
        // For consignee calls, try to find the specific consignee line first
        if (callType === 'consignee_delay_alert' && d.consignee_name) {
          for (const line of config.system_prompt.split('\n')) {
            if (line.toLowerCase().includes(d.consignee_name.toLowerCase())) {
              rawPhone = extractPhoneNumber(line)
              if (rawPhone) {
                console.log('[DisruptionHub Voice] consignee matched in system_prompt:', line.trim())
                break
              }
            }
          }
        }
        // Generic fallback — first number in system_prompt
        if (!rawPhone) {
          rawPhone = extractPhoneNumber(config.system_prompt)
          if (rawPhone) console.log('[DisruptionHub Voice] generic phone from system_prompt:', rawPhone)
        }
      }
    } catch (e) {
      console.warn('[DisruptionHub Voice] system_prompt fetch failed:', e.message)
    }
  }

  if (!rawPhone) {
    const msg = `No phone number found for ${callType} — call aborted`
    console.warn('[DisruptionHub Voice]', msg, JSON.stringify(d))
    await logAction(clientId, approvalId, 'make_call', d, { error: msg }, false)
    return { success: false, error: msg }
  }

  // ── Step 2: Normalise to E.164 ────────────────────────────────────────────
  const toPhone = toE164UK(rawPhone)
  if (!toPhone) {
    const msg = `Cannot normalise "${rawPhone}" to E.164 — call aborted`
    console.warn('[DisruptionHub Voice]', msg)
    await logAction(clientId, approvalId, 'make_call', d, { error: msg }, false)
    return { success: false, error: msg }
  }

  // ── Step 3: Build spoken message based on call type ───────────────────────
  const voiceMessage = callType === 'consignee_delay_alert'
    ? buildConsigneeVoiceMessage({
        consigneeName: d.consignee_name,
        clientName:    d.client_name        || 'your supplier',
        vehicleReg:    d.vehicle_reg        || d.registration,
        revisedEta:    d.revised_eta        || d.eta,
        delayMinutes:  d.delay_minutes,
        reason:        d.delay_reason       || d.incident_description,
        opsPhone:      d.ops_callback_phone || d.ops_phone,
        ref:           d.ref                || d.job_ref
      })
    : buildCarrierVoiceMessage({
        carrierName:         d.carrier_name         || 'your breakdown provider',
        vehicleReg:          d.vehicle_reg          || d.registration,
        clientName:          d.client_name          || 'the haulage operator',
        incidentDescription: d.incident_description || d.action_label,
        opsPhone:            d.ops_callback_phone   || d.ops_phone,
        ref:                 d.ref                  || d.job_ref
      })

  console.log(`[DisruptionHub Voice] ${callType} → ${toPhone}`)
  console.log(`[DisruptionHub Voice] Script preview: ${voiceMessage.substring(0, 120)}`)

  // ── Step 4: Fire the call ─────────────────────────────────────────────────
  const result = await makeCall(toPhone, voiceMessage)

  await logAction(
    clientId, approvalId, 'make_call',
    { to: toPhone, raw_phone: rawPhone, call_type: callType, consignee_name: d.consignee_name, vehicle_reg: d.vehicle_reg },
    result,
    result.success
  )

  return result
}

export async function executeAction(approval) {
  const { action_type, action_details } = approval

  switch (action_type) {
    case 'send_sms':
    case 'sms':
      return sendSMS({
        to:         action_details.recipient || action_details.to,
        body:       action_details.content   || action_details.body,
        clientId:   approval.client_id,
        approvalId: approval.id
      })

    case 'send_email':
    case 'email':
      return sendEmail({
        to:         action_details.recipient || action_details.to,
        subject:    action_details.subject,
        body:       action_details.content   || action_details.body,
        clientId:   approval.client_id,
        approvalId: approval.id
      })

    case 'make_call':
    case 'call':
      return placeCall({
        action_details,
        clientId:   approval.client_id,
        approvalId: approval.id
      })

    default:
      // reroute, notify, dispatch, emergency handled upstream by SMS loop
      console.log('[DisruptionHub executeAction] Unhandled type:', action_type, '— logged only')
      return { success: true, status: 'logged', action_type }
  }
}
