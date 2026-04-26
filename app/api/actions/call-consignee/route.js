import { createClient } from '@supabase/supabase-js'
import { vocabFor } from '../../../../lib/sectorVocabulary.js'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

function toE164UK(phone) {
  if (!phone) return null
  const digits = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '')
  if (digits.startsWith('+44')) return digits
  if (digits.startsWith('0')) return '+44' + digits.slice(1)
  if (digits.startsWith('44')) return '+' + digits
  return null
}

function twimlSafe(name) {
  if (!name) return 'your contact'
  return name.replace(/\b([A-Z]{2,})\b/g, (match) => match.split('').join('. ') + '.')
}

function speakReg(reg) {
  if (!reg) return 'unknown'
  return reg.replace(/\s/g, '').replace(/./g, c => c + '. ').trim()
}

async function makeCall(to, twimlMessage) {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER
  if (!sid || !token || !from || sid.includes('placeholder') || sid.startsWith('AC_')) {
    console.log('[call-consignee] Twilio not configured, to:', to)
    return { success: false, simulated: true }
  }
  const safe = twimlMessage.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Amy" language="en-GB">${safe}</Say><Pause length="1"/><Say voice="Polly.Amy" language="en-GB">I will repeat that message.</Say><Pause length="1"/><Say voice="Polly.Amy" language="en-GB">${safe}</Say></Response>`
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: from, Twiml: twiml })
    })
    const data = await res.json()
    return { success: res.ok, sid: data.sid, status: data.status, error: data.message }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

export async function POST(request) {
  try {
    const dhKey = request.headers.get('x-dh-key')
    if (!dhKey || dhKey !== process.env.DH_INTERNAL_KEY) {
      return Response.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { clientId, vehicleReg, contactName } = await request.json()
    if (!clientId || !vehicleReg) {
      return Response.json({ error: 'clientId and vehicleReg required' }, { status: 400 })
    }

    await new Promise(r => setTimeout(r, 4000))

    const db = getDB()
    if (!db) return Response.json({ error: 'No DB' }, { status: 500 })

    let vocab = vocabFor('haulage')
    try {
      const { data: cl } = await db.from('clients').select('sector').eq('id', clientId).maybeSingle()
      if (cl?.sector) vocab = vocabFor(cl.sector)
    } catch {}

    const { data: callApprovals } = await db.from('approvals').select('*')
      .eq('client_id', clientId).eq('status', 'pending')
      .in('action_type', ['call', 'make_call'])
      .contains('action_details', { vehicle_reg: vehicleReg })
      .gt('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true })
      .limit(1)

    const ca = (callApprovals || [])[0]
    if (!ca) {
      console.log('[call-consignee] no pending call approval found for', vehicleReg)
      return Response.json({ success: true, called: false, reason: 'no_pending_call' })
    }

    const cad = ca.action_details || {}
    const consigneePhone = toE164UK(cad.consignee_phone)

    if (!consigneePhone) {
      await db.from('approvals').update({ status: 'failed', executed_at: new Date().toISOString(), execution_result: { failure_reason: 'no_consignee_phone' } }).eq('id', ca.id)
      console.log(`[call-consignee] ${ca.id} skipped — no phone for ${cad.consignee_name || 'consignee'}`)
      return Response.json({ success: true, called: false, reason: 'no_phone' })
    }

    const spokenVehicle = speakReg(vehicleReg)
    const isBreakdown = cad.call_type === 'breakdown' || cad.alert_type === 'breakdown'
    const voiceMsg = isBreakdown
      ? `${twimlSafe(contactName || 'your supplier')} is calling to advise that ${vocab.voice_intro_breakdown}. We are arranging recovery and will provide an update as soon as possible. No action is required from you at this time. Thank you.`
      : `${twimlSafe(contactName || 'your supplier')} is calling to advise that ${vocab.voice_intro_delay} ${spokenVehicle} is running late. No action is required from you at this time. Thank you.`

    const callResult = await makeCall(consigneePhone, voiceMsg)
    const nowIso = new Date().toISOString()
    await db.from('approvals').update({
      status: 'executed', approved_by: 'system_auto_dispatch',
      approved_at: nowIso, executed_at: nowIso,
      execution_result: { twilio_sid: callResult.sid, auto_fired: true }
    }).eq('id', ca.id)

    console.log(`[call-consignee] ${ca.id} → ${cad.consignee_name || 'consignee'}: ${callResult.success ? 'ok' : callResult.error || 'failed'}`)
    return Response.json({ success: true, called: true, callSid: callResult.sid })

  } catch (err) {
    console.error('[call-consignee] error:', err)
    return Response.json({ error: 'ERR_004', message: 'Request could not be processed' }, { status: 500 })
  }
}
