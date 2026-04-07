import { createClient } from '@supabase/supabase-js'

// Inlined Twilio — no lib import
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

function extractPhoneNumber(text) {
  if (!text) return null
  const match = text.match(/\b(0800[\s\d]{8,12}|07[\d\s]{9,11}|01[\d\s]{9,11}|02[\d\s]{9,11})\b/)
  if (!match) return null
  return match[1].replace(/\s/g, '')
}

function buildCarrierVoiceMessage({ carrierName, vehicleReg, clientName, incidentDescription, opsPhone, ref }) {
  return `This is an automated emergency alert from DisruptionHub on behalf of ${clientName || 'your client'}. ` +
    `Vehicle registration ${vehicleReg ? vehicleReg.split('').join(' ') : 'unknown'} requires immediate assistance. ` +
    `${incidentDescription ? incidentDescription.substring(0, 150) : 'Please see your dispatch system.'} ` +
    `Please call the operations manager back urgently${opsPhone ? ` on ${opsPhone.split('').join(' ')}` : ''}.` +
    ` This is an automated message from DisruptionHub.`
}

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

// GET /api/approvals — fetch pending approvals for dashboard
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const client_id = searchParams.get('client_id')

    if (!client_id) return Response.json({ error: 'client_id required' }, { status: 400 })

    const db = getDB()
    if (!db) return Response.json({ approvals: [] })

    const { data, error } = await db
      .from('approvals')
      .select('*')
      .eq('client_id', client_id)
      .in('status', ['pending', 'executed', 'rejected'])
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    return Response.json({ approvals: data || [] })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/approvals — approve or reject from dashboard (same logic as SMS YES/NO)
export async function POST(request) {
  try {
    const { approval_id, action, approved_by = 'ops_manager', cancel_type } = await request.json()

    if (!approval_id) return Response.json({ error: 'approval_id required' }, { status: 400 })

    const db = getDB()
    if (!db) return Response.json({ error: 'DB not configured' }, { status: 500 })

    // ── REJECT / CANCEL ──────────────────────────────────────────────────
    if (action === 'reject') {
      await db.from('approvals').update({
        status: 'rejected',
        approved_by,
        approved_at: new Date().toISOString()
      }).eq('id', approval_id)

      // If cancel_type indicates we should notify driver (e.g. disregard reroute)
      if (cancel_type === 'disregard') {
        const { data: approval } = await db.from('approvals').select('*').eq('id', approval_id).single()
        const driverPhone = approval?.action_details?.driver_phone
        if (driverPhone) {
          await sendSMS(driverPhone, `DisruptionHub OPS${approval.action_details?.ref ? ` — ${approval.action_details.ref}` : ''}\n\nDISREGARD previous instruction. Continue on original planned route.`).catch(() => {})
        }
      }

      return Response.json({ success: true, action: 'rejected' })
    }

    // ── APPROVE ──────────────────────────────────────────────────────────
    const { data: approval } = await db
      .from('approvals')
      .select('*')
      .eq('id', approval_id)
      .single()

    if (!approval) return Response.json({ error: 'Approval not found' }, { status: 404 })

    if (approval.status === 'executed') {
      return Response.json({ success: true, action: 'already_executed' })
    }

    // 4-hour expiry check (matches SMS webhook behaviour)
    const ageHours = (Date.now() - new Date(approval.created_at).getTime()) / 3600000
    if (ageHours > 4) {
      await db.from('approvals').update({ status: 'expired' }).eq('id', approval_id)
      return Response.json({ success: false, error: 'Action expired — over 4 hours old. Do not execute stale actions.' }, { status: 409 })
    }

    // Mark executed
    await db.from('approvals').update({
      status: 'executed',
      approved_by,
      approved_at: new Date().toISOString(),
      executed_at: new Date().toISOString()
    }).eq('id', approval_id)

    const actionType = approval.action_type || ''
    const actionLabel = approval.action_label || ''
    const details = approval.action_details || {}
    const clientId = approval.client_id

    const { data: client } = await db
      .from('clients')
      .select('contact_name, contact_phone, system_prompt')
      .eq('id', clientId)
      .single()

    // ── DRIVER PHONE FALLBACK ────────────────────────────────────────────
    // If action_details has no driver_phone, look up from driver_progress
    // This covers demo mode where fictional driver reg ≠ real driver's phone
    async function resolveDriverPhone() {
      if (details.driver_phone) return details.driver_phone
      try {
        // Look up most recently active driver for this client
        const { data: progress } = await db
          .from('driver_progress')
          .select('driver_phone')
          .eq('client_id', clientId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single()
        return progress?.driver_phone || null
      } catch { return null }
    }

    // ── DISPATCH — recovery confirmation to driver ────────────────────────
    if (actionType === 'dispatch') {
      const driverPhone = await resolveDriverPhone()
      if (driverPhone) {
        const msg = `DisruptionHub OPS UPDATE${details.ref ? ` — ${details.ref}` : ''}\n\nOps confirmed. Recovery/assistance dispatched.\nStay with vehicle. Help is coming.`
        const result = await sendSMS(driverPhone, msg)
        return Response.json({ success: true, action: 'executed', driver_notified: result.success, phase: 2 })
      }
      return Response.json({ success: true, action: 'executed', driver_notified: false, note: 'No driver phone — call directly' })
    }

    // ── SMS / REROUTE / NOTIFY — instruction to driver ───────────────────
    if (actionType === 'sms' || actionType === 'reroute' || actionType === 'notify') {
      const driverPhone = await resolveDriverPhone()
      if (driverPhone) {
        const smsText = [
          `DisruptionHub OPS INSTRUCTION${details.ref ? ` — ${details.ref}` : ''}`,
          '',
          actionLabel,
          '',
          'Reply DONE when complete.'
        ].join('\n')
        const result = await sendSMS(driverPhone, smsText)
        return Response.json({ success: true, action: 'executed', driver_notified: result.success, phase: 2 })
      }
      return Response.json({ success: true, action: 'executed', driver_notified: false, note: 'No driver phone on file' })
    }

    // ── CALL / EMERGENCY — Phase 3 voice call to carrier ────────────────
    if (actionType === 'call' || actionType === 'emergency') {
      const carrierPhone = details.carrier_phone
        || extractPhoneNumber(actionLabel)
        || extractPhoneNumber(client?.system_prompt)

      // Make voice call if carrier phone available
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
          clientName: client?.contact_name || 'your client',
          incidentDescription: recentIncidents?.[0]?.user_input?.substring(0, 150),
          opsPhone: client?.contact_phone,
          ref: details.ref || recentIncidents?.[0]?.ref
        })

        const callResult = await makeCall(carrierPhone, voiceMessage)

        // Always also notify driver if phone available
        const resolvedDriverPhone = await resolveDriverPhone()
        if (resolvedDriverPhone) {
          const driverMsg = `DisruptionHub OPS${details.ref ? ` — ${details.ref}` : ''}\n\nOps approved. Carrier being contacted.\nStay safe.`
          await sendSMS(resolvedDriverPhone, driverMsg).catch(() => {})
        }

        return Response.json({
          success: true,
          action: 'executed',
          call_result: callResult.success ? 'placed' : callResult.simulated ? 'simulated' : 'failed',
          driver_notified: !!resolvedDriverPhone,
          phase: 3
        })
      }

      // No carrier phone — still notify driver
      const resolvedDriverPhone2 = await resolveDriverPhone()
      if (resolvedDriverPhone2) {
        const driverMsg = `DisruptionHub OPS${details.ref ? ` — ${details.ref}` : ''}\n\nOps has reviewed your situation. Action approved.\nHelp is being arranged.`
        const result = await sendSMS(resolvedDriverPhone2, driverMsg)
        return Response.json({ success: true, action: 'executed', driver_notified: result.success, note: 'No carrier phone — driver notified directly' })
      }

      return Response.json({ success: true, action: 'executed', driver_notified: false, note: 'No carrier or driver phone — action manually' })
    }

    return Response.json({ success: true, action: 'executed' })

  } catch (error) {
    console.error('Approvals error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
