import twilio from 'twilio'
import { Resend } from 'resend'
import { logAction } from './supabase.js'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)
const resend = new Resend(process.env.RESEND_API_KEY)

// ── SEND SMS ─────────────────────────────────────────────────────────────────
export async function sendSMS({ to, body, clientId, approvalId }) {
  try {
    const msg = await twilioClient.messages.create({
      body: `[DisruptionHub]\n${body}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to
    })

    await logAction(clientId, approvalId, 'send_sms', { to, body }, { sid: msg.sid, status: msg.status }, true)

    return { success: true, sid: msg.sid }
  } catch (error) {
    await logAction(clientId, approvalId, 'send_sms', { to, body }, { error: error.message }, false)
    throw error
  }
}

// ── SEND EMAIL ───────────────────────────────────────────────────────────────
export async function sendEmail({ to, subject, body, clientId, approvalId, attachments = [] }) {
  try {
    const result = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'ops@disruptionhub.ai',
      to: Array.isArray(to) ? to : [to],
      subject,
      text: body,
      html: body.replace(/\n/g, '<br>'),
      attachments
    })

    await logAction(clientId, approvalId, 'send_email', { to, subject }, { id: result.id }, true)

    return { success: true, id: result.id }
  } catch (error) {
    await logAction(clientId, approvalId, 'send_email', { to, subject }, { error: error.message }, false)
    throw error
  }
}

// ── MAKE CALL ────────────────────────────────────────────────────────────────
export async function makeCall({ to, script, clientId, approvalId }) {
  try {
    const twiml = `
      <Response>
        <Say voice="Polly.Amy" language="en-GB">
          ${script}
        </Say>
        <Pause length="1"/>
        <Say voice="Polly.Amy" language="en-GB">
          Press 1 to acknowledge this message. Press 2 to speak to the operations team.
        </Say>
        <Gather numDigits="1" action="/api/webhooks/call-response" method="POST">
          <Pause length="5"/>
        </Gather>
      </Response>`

    const call = await twilioClient.calls.create({
      twiml,
      from: process.env.TWILIO_PHONE_NUMBER,
      to
    })

    await logAction(clientId, approvalId, 'make_call', { to, script }, { sid: call.sid, status: call.status }, true)

    return { success: true, sid: call.sid }
  } catch (error) {
    await logAction(clientId, approvalId, 'make_call', { to, script }, { error: error.message }, false)
    throw error
  }
}

// ── EXECUTE ANY ACTION ────────────────────────────────────────────────────────
export async function executeAction(approval) {
  const { action_type, action_details, client_id, id: approvalId } = approval

  switch (action_type) {
    case 'send_sms':
      return sendSMS({ ...action_details, clientId: client_id, approvalId })

    case 'send_email':
      return sendEmail({ ...action_details, clientId: client_id, approvalId })

    case 'make_call':
      return makeCall({ ...action_details, clientId: client_id, approvalId })

    case 'internal_flag':
      // Internal flags just log to the action log — no external communication
      await logAction(client_id, approvalId, 'internal_flag', action_details, { logged: true }, true)
      return { success: true, type: 'internal_flag' }

    case 'block_dispatch':
      // This would integrate with the client's TMS if available
      // For now, sends an urgent SMS to ops manager
      return sendSMS({
        to: action_details.ops_manager_mobile || process.env.DEFAULT_OPS_MOBILE,
        body: `🚨 DISPATCH BLOCKED: ${action_details.content}`,
        clientId: client_id,
        approvalId
      })

    case 'book_service':
      // Sends email to fleet manager
      return sendEmail({
        to: action_details.fleet_manager_email || action_details.recipient,
        subject: action_details.subject || 'Predictive Maintenance Booking Request',
        body: action_details.content,
        clientId: client_id,
        approvalId
      })

    default:
      throw new Error(`Unknown action type: ${action_type}`)
  }
}
