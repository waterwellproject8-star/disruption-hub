// Twilio integration — SMS and voice calls
// Requires env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

function getTwilioCredentials() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const from       = process.env.TWILIO_PHONE_NUMBER
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

// Make outbound voice call with TwiML
// Voice: Amazon Polly Amy Generative — British English, natural sounding
export async function makeCall(to, twimlMessage) {
  const creds = getTwilioCredentials()
  if (!creds) {
    console.log('[Twilio Voice - not configured] To:', to, 'Message:', twimlMessage)
    return { success: false, reason: 'not_configured', simulated: true }
  }

  // Escape XML special characters to prevent TwiML injection
  const safe = twimlMessage
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

  // Polly.Amy-Generative — highest quality British English voice
  // language must be en-GB to match the generative model
  // Polly.Amy standard — British English, instant playback, no synthesis delay
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy" language="en-GB">${safe}</Say>
  <Pause length="1"/>
  <Say voice="Polly.Amy" language="en-GB">I will repeat that message.</Say>
  <Pause length="1"/>
  <Say voice="Polly.Amy" language="en-GB">${safe}</Say>
</Response>`

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ To: to, From: creds.from, Twiml: twiml })
      }
    )
    const data = await res.json()
    return { success: res.ok, sid: data.sid, status: data.status, error: data.message }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// Spell out alphanumeric string character by character for TTS
// "MAN-44821" → "M, A, N, 4, 4, 8, 2, 1" — prevents Polly reading numbers as integers
function spellOut(str) {
  if (!str) return ''
  return str.replace(/[^a-zA-Z0-9]/g, '').split('').join(', ')
}

// Extract any UK phone number from a block of text
export function extractPhoneNumber(text) {
  if (!text) return null
  const match = text.match(/\b(0800[\s\d]{8,12}|07[\d\s]{9,11}|01[\d\s]{9,11}|02[\d\s]{9,11}|\+44[\s\d]{10,12})\b/)
  if (!match) return null
  return match[1].replace(/\s/g, '')
}

// Convert raw minutes into natural spoken English for Polly.Amy scripts
export function formatDelayForSpeech(mins) {
  const m = parseInt(mins, 10)
  if (!m || m <= 0) return 'some time'
  const hours = Math.floor(m / 60)
  const remainder = m % 60
  if (hours === 0) return `${m} minutes`
  const h = hours === 1 ? 'one hour' : `${hours} hours`
  if (remainder === 0) return h
  return `${h} and ${remainder} minutes`
}

// ── VOICE MESSAGE BUILDERS ────────────────────────────────────────────────────

// Carrier / recovery alert
// Use when: breakdown, reefer fault, vehicle needs recovery
// Tone: urgent, operational
export function buildCarrierVoiceMessage({ carrierName, vehicleReg, clientName, incidentDescription, opsPhone, ref }) {
  const spokenReg      = vehicleReg ? vehicleReg.replace(/\s/g,'').split('').join(', ') : 'unknown'
  const spokenOpsPhone = opsPhone   ? opsPhone.replace(/\s/g,'').split('').join(', ')   : null

  return [
    `This is an automated alert from DisruptionHub on behalf of ${clientName || 'your client'}.`,
    `Vehicle registration ${spokenReg}${ref ? `, job reference ${spellOut(ref)},` : ''} requires immediate assistance.`,
    incidentDescription ? incidentDescription.substring(0, 200) : 'Please check your dispatch system for details.',
    spokenOpsPhone
      ? `Please call the operations manager urgently on ${spokenOpsPhone}.`
      : `Please contact the operations manager urgently.`,
    `This is an automated message from DisruptionHub.`
  ].join(' ')
}

// Consignee delay alert
// Use when: delivery will be late — one-way notification only
// Tone: professional, factual — goods-in team just needs the revised ETA
// No callback instruction — ops contacts consignee directly if rescheduling needed
export function buildConsigneeVoiceMessage({ consigneeName, clientName, vehicleReg, revisedEta, delayMinutes, reason, ref }) {
  const spokenReg = vehicleReg ? vehicleReg.replace(/\s/g,'').split('').join(', ') : null

  const parts = [
    `Hello. This is an automated delivery update from ${clientName || 'your supplier'}.`
  ]

  if (consigneeName) {
    parts.push(`This message is for the goods in team at ${consigneeName}.`)
  }

  parts.push(
    spokenReg
      ? `Vehicle ${spokenReg} is running approximately ${formatDelayForSpeech(delayMinutes)} late.`
      : `Your scheduled delivery is running late.`
  )

  if (revisedEta) parts.push(`Revised estimated arrival is ${revisedEta}.`)
  if (reason)     parts.push(`Reason: ${reason.substring(0, 120)}.`)
  if (ref)        parts.push(`Delivery reference: ${spellOut(ref)}.`)

  parts.push(`No action is required from you. Thank you.`)

  return parts.join(' ')
}

// Driver instruction SMS
export function buildDriverInstructionSMS({ driverName, action, carrierName, carrierPhone, script, ref }) {
  const lines = [
    `DisruptionHub OPS INSTRUCTION${ref ? ` — ${ref}` : ''}`,
    ``,
    action,
    ``
  ]
  if (carrierPhone) lines.push(`Call ${carrierName || 'carrier'}: ${carrierPhone}`)
  if (script) {
    lines.push(``)
    lines.push(`Say exactly:`)
    lines.push(`"${script.substring(0, 160)}"`)
  }
  lines.push(``)
  lines.push(`Reply DONE when complete.`)
  return lines.join('\n')
}
