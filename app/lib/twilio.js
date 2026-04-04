// Twilio integration — SMS and voice calls
// Requires env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

function getTwilioCredentials() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER
  if (!accountSid || !authToken || !from ||
      accountSid.includes('placeholder') ||
      accountSid.startsWith('AC_')) return null
  return { accountSid, authToken, from }
}

// Send SMS
export async function sendSMS(to, body) {
  const creds = getTwilioCredentials()
  if (!creds) {
    console.log('[Twilio SMS - not configured] To:', to, 'Body:', body)
    return { success: false, reason: 'not_configured', simulated: true }
  }
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ To: to, From: creds.from, Body: body })
      }
    )
    const data = await res.json()
    return { success: res.ok, sid: data.sid, error: data.message }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// Make outbound voice call with TwiML message
export async function makeCall(to, twimlMessage) {
  const creds = getTwilioCredentials()
  if (!creds) {
    console.log('[Twilio Voice - not configured] To:', to, 'Message:', twimlMessage)
    return { success: false, reason: 'not_configured', simulated: true }
  }

  // Build TwiML — Twilio reads this aloud when the call connects
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Say voice="alice" language="en-GB">${twimlMessage}</Say>
  <Pause length="1"/>
  <Say voice="alice" language="en-GB">I will repeat that.</Say>
  <Pause length="1"/>
  <Say voice="alice" language="en-GB">${twimlMessage}</Say>
  <Pause length="1"/>
  <Say voice="alice" language="en-GB">End of message from DisruptionHub. Please call the operations manager back on the number in your system.</Say>
</Response>`

  // We need to host the TwiML — use Twilio's TwiML Bins or our own endpoint
  // For now we use a data URI approach via the calls endpoint with Twiml parameter
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          To: to,
          From: creds.from,
          Twiml: twiml
        })
      }
    )
    const data = await res.json()
    return { success: res.ok, sid: data.sid, status: data.status, error: data.message }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// Parse carrier phone number from action label or client system prompt
export function extractPhoneNumber(text) {
  if (!text) return null
  const match = text.match(/\b(0800[\s\d]{8,12}|07[\d\s]{9,11}|01[\d\s]{9,11}|02[\d\s]{9,11})\b/)
  if (!match) return null
  return match[1].replace(/\s/g, '')
}

// Build a professional voice message for carrier alert
export function buildCarrierVoiceMessage({
  carrierName,
  vehicleReg,
  clientName,
  incidentDescription,
  opsPhone,
  ref
}) {
  return `This is an automated emergency alert from Disruption Hub on behalf of ${clientName || 'your client'}. ` +
    `Vehicle registration ${vehicleReg ? vehicleReg.split('').join(' ') : 'unknown'} ` +
    `${ref ? `, job reference ${ref},` : ''} ` +
    `requires immediate assistance. ` +
    `${incidentDescription ? incidentDescription.substring(0, 200) : 'Please see your dispatch system for details.'} ` +
    `Please call the operations manager back urgently` +
    `${opsPhone ? ` on ${opsPhone.split('').join(' ')}` : ''}.` +
    ` This is an automated message from Disruption Hub.`
}

// Build driver instruction SMS
export function buildDriverInstructionSMS({
  driverName,
  action,
  carrierName,
  carrierPhone,
  script,
  ref
}) {
  const lines = [
    `DisruptionHub OPS INSTRUCTION${ref ? ` — ${ref}` : ''}`,
    ``,
    action,
    ``
  ]

  if (carrierPhone) {
    lines.push(`Call ${carrierName || 'carrier'}: ${carrierPhone}`)
  }

  if (script) {
    lines.push(``)
    lines.push(`Say exactly:`)
    lines.push(`"${script.substring(0, 160)}"`)
  }

  lines.push(``)
  lines.push(`Reply DONE when complete.`)

  return lines.join('\n')
}
