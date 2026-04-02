import { logAction } from './supabase.js'

// Lazy clients — only init when env vars are real
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
  try {
    const result = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'hello@disruptionhub.ai',
      to, subject,
      html: body.replace(/\n/g, '<br>')
    })
    await logAction(clientId, approvalId, 'send_email', { to, subject }, result, true)
    return { success: true, id: result.id }
  } catch (error) {
    await logAction(clientId, approvalId, 'send_email', { to, subject }, { error: error.message }, false)
    throw error
  }
}

export async function executeAction(approval) {
  const { action_type, action_details } = approval
  switch (action_type) {
    case 'send_sms':
      return sendSMS({ to: action_details.recipient, body: action_details.content, clientId: approval.client_id, approvalId: approval.id })
    case 'send_email':
      return sendEmail({ to: action_details.recipient, subject: action_details.subject, body: action_details.content, clientId: approval.client_id, approvalId: approval.id })
    default:
      return { success: true, status: 'logged', action_type }
  }
}
