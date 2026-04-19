import { createClient } from '@supabase/supabase-js'
import { formatDelayForSpeech } from '../../../lib/twilio.js'

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

async function makeCall(to, twimlMessage, rawTwiml) {
  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from  = process.env.TWILIO_PHONE_NUMBER
  if (!sid || !token || !from || sid.includes('placeholder') || sid.startsWith('AC_')) {
    console.error('[Twilio Voice - NOT CONFIGURED — call simulated only] To:', to)
    return { success: false, reason: 'not_configured', simulated: true }
  }
  const twiml = rawTwiml || `<?xml version="1.0" encoding="UTF-8"?><Response><Pause length="1"/><Say voice="Polly.Amy" language="en-GB">${twimlMessage}</Say><Pause length="1"/><Say voice="Polly.Amy" language="en-GB">I will repeat that.</Say><Pause length="1"/><Say voice="Polly.Amy" language="en-GB">${twimlMessage}</Say></Response>`
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
  const match = text.match(/(\+44[\s\d]{10,12}|\b0800[\s\d]{8,12}|\b07[\d\s]{9,11}|\b01[\d\s]{9,11}|\b02[\d\s]{9,11})/)
  if (!match) return null
  return match[1].replace(/\s/g, '')
}

function twimlSafe(name) {
  if (!name) return 'your delivery contact'
  return name.replace(/\b([A-Z]{2,})\b/g, (match) => match.split('').join('. ') + '.')
}

function speakReg(reg) {
  if (!reg) return 'unknown'
  return reg.replace(/\s/g, '').replace(/./g, c => c + '. ').trim()
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
      .in('status', ['pending', 'executed', 'rejected', 'expired'])
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    const sevScore = { CRITICAL:4, HIGH:3, MEDIUM:2, LOW:1 }
    const now = Date.now()
    const enriched = (data || []).map(a => {
      const sev = a.action_details?.severity || 'MEDIUM'
      let score = sevScore[sev] || 2
      if (a.status === 'pending' && a.escalation_at && new Date(a.escalation_at).getTime() - now < 5 * 60 * 1000) score += 2
      return { ...a, priority_score: score }
    })
    enriched.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1
      if (a.status !== 'pending' && b.status === 'pending') return 1
      if (a.priority_score !== b.priority_score) return b.priority_score - a.priority_score
      return new Date(b.created_at) - new Date(a.created_at)
    })
    return Response.json({ approvals: enriched })
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
          await sendSMS(driverPhone, `DisruptionHub OPS${approval.action_details?.ref ? ` — ${approval.action_details.ref}` : ''}\n\nDISREGARD previous instruction. Continue on original planned route.`).catch(err => console.error('[approvals] sendSMS to driver failed:', err?.message))
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

    if (approval.status === 'executed' || approval.status === 'resolved' || approval.status === 'expired') {
      return Response.json({ success: true, action: 'already_handled' })
    }

    // 4-hour expiry check (matches SMS webhook behaviour)
    const ageHours = (Date.now() - new Date(approval.created_at).getTime()) / 3600000
    if (ageHours > 4) {
      await db.from('approvals').update({ status: 'expired' }).eq('id', approval_id)
      return Response.json({ success: false, error: 'Action expired — over 4 hours old. Do not execute stale actions.' }, { status: 409 })
    }

    // Atomic reserve — claim the approval by setting approved_at. Status stays
    // 'pending' until the action result is known; finalise() writes 'executed'
    // or 'failed'. Race protection: .is('approved_at', null) ensures exactly
    // one claimant even under concurrent clicks / SMS YES.
    const { data: updated } = await db.from('approvals').update({
      approved_by,
      approved_at: new Date().toISOString()
    }).eq('id', approval_id).eq('status', 'pending').is('approved_at', null).select('id')

    if (!updated?.length) {
      return Response.json({ error: 'already_executed' }, { status: 409 })
    }

    const actionType = approval.action_type || ''
    const actionLabel = approval.action_label || ''
    const details = approval.action_details || {}
    const clientId = approval.client_id

    // Write final status once we know whether the action actually went out.
    // SMS: result.success === true → executed.
    // Call: callResult.success && !callResult.simulated → executed.
    // Any other outcome (Twilio not configured, API failure, no phone) → failed,
    // with the reason recorded inside action_details.failure_reason.
    async function finalise(success, failureReason = null, extra = null) {
      const nowIso = new Date().toISOString()
      const patch = { status: success ? 'executed' : 'failed', executed_at: nowIso }
      if (!success) {
        patch.action_details = { ...(approval.action_details || {}), failure_reason: failureReason || 'unknown', failed_at: nowIso }
      } else if (extra) {
        patch.execution_result = extra
      }
      const { error: finErr } = await db.from('approvals').update(patch).eq('id', approval_id)
      if (finErr) console.error('approvals finalise failed:', finErr.message)
    }

    const { data: client } = await db
      .from('clients')
      .select('contact_name, contact_phone, system_prompt')
      .eq('id', clientId)
      .single()

    // ── DRIVER PHONE LOOKUP ──────────────────────────────────────────────
    // Priority: 1) driver_phone in action_details (set by driver app alerts)
    //           2) look up by vehicle_reg from driver_progress
    //           3) fall back to most recent non-null phone for this client
    async function resolveDriverPhone() {
      // 1. Direct — driver app alerts always include driver_phone in details
      if (details.driver_phone) return details.driver_phone

      try {
        // 2. Look up by vehicle_reg — driver_progress has no client_id column
        if (details.vehicle_reg) {
          const { data: byReg } = await db
            .from('driver_progress')
            .select('driver_phone')
            .eq('vehicle_reg', details.vehicle_reg.trim())
            .not('driver_phone', 'is', null)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (byReg?.driver_phone) return byReg.driver_phone
        }

        // 3. Fall back to most recently active driver with a phone number
        const { data: progress } = await db
          .from('driver_progress')
          .select('driver_phone')
          .not('driver_phone', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        return progress?.driver_phone || null
      } catch { return null }
    }

    // ── DISPATCH — recovery confirmation to driver ────────────────────────
    if (actionType === 'dispatch') {
      const driverPhone = await resolveDriverPhone()
      if (driverPhone) {
        // Count pending consignee notifications for this vehicle to inform driver
        let affectedCount = 0
        if (details.vehicle_reg) {
          try {
            const { data: pending } = await db.from('approvals')
              .select('id')
              .eq('client_id', clientId)
              .eq('status', 'pending')
              .contains('action_details', { vehicle_reg: details.vehicle_reg, call_type: 'consignee_delay_alert' })
            affectedCount = pending?.length || 0
          } catch {}
        }
        const affectedNote = affectedCount > 0 ? `\n${affectedCount} delivery${affectedCount > 1 ? 'ies' : 'y'} affected — ops managing consignee notifications.` : ''
        const msg = `DisruptionHub OPS${details.ref ? ` — ${details.ref}` : ''}\n\nOps have confirmed. Recovery is being arranged — you will receive a further update shortly. Stay with your vehicle, hazards on.${affectedNote}`
        const result = await sendSMS(driverPhone, msg)

        if (details.vehicle_reg) {
          try {
            await db
              .from('driver_progress')
              .update({
                alert: `OPS_MSG: Ops have confirmed. Recovery is being arranged — you will receive a further update shortly. Stay with your vehicle, hazards on.${affectedCount > 0 ? ` ${affectedCount} delivery${affectedCount > 1 ? 'ies' : 'y'} affected — ops managing notifications.` : ''}`,
                updated_at: new Date().toISOString()
              })
              .eq('vehicle_reg', details.vehicle_reg.trim())
          } catch {}

          // Trigger second SMS for pending consignee delay notification
          try {
            const { data: consigneeApproval } = await db.from('approvals')
              .select('id, action_label, action_details')
              .eq('client_id', clientId)
              .eq('status', 'pending')
              .contains('action_details', { vehicle_reg: details.vehicle_reg.trim(), call_type: 'consignee_delay_alert' })
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            if (consigneeApproval && client?.contact_phone) {
              const cName = consigneeApproval.action_details?.consignee_name || 'consignee'
              await sendSMS(client.contact_phone, `DH: Recovery confirmed for ${details.vehicle_reg}.\nConsignee: ${cName}\nReply YES to call them automatically\nReply NO to skip`)
              await db.from('approvals').update({ action_label: `${consigneeApproval.action_label} (SMS sent)` }).eq('id', consigneeApproval.id)
            }
          } catch {}
        }

        await finalise(result.success, result.success ? null : (result.error || 'driver_sms_failed'), result.success ? { twilio_sid: result.sid } : null)
        return Response.json({ success: true, action: result.success ? 'executed' : 'failed', driver_notified: result.success, phase: 2 })
      }
      await finalise(false, 'no_driver_phone_on_file')
      return Response.json({ success: true, action: 'failed', driver_notified: false, note: 'No driver phone — call directly' })
    }

    // ── SMS / REROUTE / NOTIFY — instruction to driver ───────────────────
    if (['sms', 'send_sms', 'reroute', 'notify', 'send_email'].includes(actionType)) {
      const driverPhone = await resolveDriverPhone()
      if (driverPhone) {
        const instructionText = details.script || actionLabel
        const smsText = [
          `DisruptionHub OPS INSTRUCTION${details.ref ? ` — ${details.ref}` : ''}`,
          '',
          instructionText,
          '',
          'Reply DONE when complete.'
        ].join('\n')
        const result = await sendSMS(driverPhone, smsText)

        // Write OPS_MSG to driver_progress so app banner shows
        if (details.vehicle_reg) {
          try {
            await db
              .from('driver_progress')
              .update({
                alert: `OPS_MSG: ${details.script || actionLabel}`,
                updated_at: new Date().toISOString()
              })
              .eq('vehicle_reg', details.vehicle_reg.trim())
          } catch {}
        }

        await finalise(result.success, result.success ? null : (result.error || 'driver_sms_failed'), result.success ? { twilio_sid: result.sid } : null)
        return Response.json({ success: true, action: result.success ? 'executed' : 'failed', driver_notified: result.success, phase: 2 })
      }
      await finalise(false, 'no_driver_phone_on_file')
      return Response.json({ success: true, action: 'failed', driver_notified: false, note: 'No driver phone on file' })
    }

    // ── CONSIGNEE DELAY / BREAKDOWN ALERT — one-way notification call ──
    if (['call', 'emergency', 'make_call'].includes(actionType) && (details.call_type === 'consignee_delay_alert' || details.call_type === 'breakdown')) {
      // delay > 60 mins → manual rebook (bypass for breakdowns — always call)
      if (details.call_type !== 'breakdown' && details.alert_type !== 'breakdown' && details.delay_minutes && details.delay_minutes > 60) {
        if (client?.contact_phone) {
          await sendSMS(client.contact_phone, `DisruptionHub — Action needed.\n${details.vehicle_reg || ''}: Delay over 60 mins — ${details.consignee_name || 'consignee'} slot rebook required.\nCall ${details.consignee_name || 'consignee'} directly to rearrange.\nDashboard: disruptionhub.ai/unlock`).catch(err => console.error('[approvals] manual rebook SMS failed:', err?.message))
        }
        await finalise(false, 'delay_exceeds_60_mins_manual_rebook_required')
        return Response.json({ success: true, action: 'failed', note: 'Delay >60 mins — manual rebook required' })
      }

      const rawConsigneePhone = details.consignee_phone || extractPhoneNumber(client?.system_prompt)
      if (rawConsigneePhone) {
        const contactName = client?.contact_name || 'your supplier'
        const spokenVehicle = speakReg(details.vehicle_reg)
        const delayNum = parseInt(details.delay_minutes, 10) || 0
        const delaySpoken = delayNum > 0 ? formatDelayForSpeech(delayNum) : '30 minutes'
        const parts = [
          `${contactName} is calling to advise that your delivery from vehicle ${spokenVehicle} is running approximately ${delaySpoken} late.`,
          details.revised_eta ? `Expected arrival is now ${details.revised_eta}.` : '',
          `No action is required from you at this time. If you need to discuss, please contact our operations team. Thank you.`
        ].filter(Boolean)

        const safe = parts.join(' ').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
        const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Amy" language="en-GB">${safe}</Say><Pause length="1"/><Say voice="Polly.Amy" language="en-GB">I will repeat that message.</Say><Pause length="1"/><Say voice="Polly.Amy" language="en-GB">${safe}</Say></Response>`
        const callResult = await makeCall(rawConsigneePhone, null, twiml)

        if (details.vehicle_reg) {
          try {
            await db.from('driver_progress').update({
              alert: `OPS_MSG: Consignee ${details.consignee_name || ''} being notified of delay`,
              updated_at: new Date().toISOString()
            }).eq('vehicle_reg', details.vehicle_reg.trim())
          } catch {}
        }

        const driverPhone = await resolveDriverPhone()
        if (driverPhone) {
          await sendSMS(driverPhone, `DisruptionHub — Confirmed.\n${details.vehicle_reg || ''}: ${details.consignee_name || 'Consignee'} being called. Continue to destination.`).catch(err => console.error('[approvals] sendSMS to driver failed:', err?.message))
        }

        const callSuccess = callResult.success && !callResult.simulated
        await finalise(
          callSuccess,
          !callResult.success ? (callResult.error || 'twilio_call_failed') : callResult.simulated ? 'twilio_not_configured' : null,
          callSuccess ? { twilio_sid: callResult.sid, twilio_status: callResult.status, consignee_phone: rawConsigneePhone } : null
        )
        return Response.json({
          success: true, action: callSuccess ? 'executed' : 'failed',
          call_result: callResult.success ? 'placed' : callResult.simulated ? 'simulated' : 'failed',
          consignee: details.consignee_name || rawConsigneePhone,
          driver_notified: !!driverPhone,
          phase: 3
        })
      }
      // No consignee phone — notify driver, ops calls manually
      const driverPhone = await resolveDriverPhone()
      if (driverPhone) {
        await sendSMS(driverPhone, `DisruptionHub OPS${details.ref ? ` — ${details.ref}` : ''}\n\nOps approved delay notification. No consignee phone on file — ops will call directly.\nContinue to destination.`).catch(err => console.error('driver fallback SMS failed:', err?.message))
      }
      await finalise(false, 'no_consignee_phone')
      return Response.json({ success: true, action: 'failed', driver_notified: !!driverPhone, note: `No consignee phone for ${details.consignee_name || 'this delivery'} — call manually` })
    }

    // ── FAILED DELIVERY CALLBACK — one-way notification call ──────────────
    if (['call', 'make_call'].includes(actionType) && details.call_type === 'failed_delivery_callback') {
      const fdPhone = details.consignee_phone || extractPhoneNumber(client?.system_prompt)
      if (fdPhone) {
        const contactName = client?.contact_name || 'your supplier'
        const fdMsg = `${contactName} is calling to advise that we attempted delivery of your order today but were unable to complete it. Please contact our operations team to rearrange. Thank you.`
        const fdSafe = fdMsg.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
        const fdTwiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Amy" language="en-GB">${fdSafe}</Say><Pause length="1"/><Say voice="Polly.Amy" language="en-GB">I will repeat that message.</Say><Pause length="1"/><Say voice="Polly.Amy" language="en-GB">${fdSafe}</Say></Response>`
        const callResult = await makeCall(fdPhone, null, fdTwiml)
        const callSuccess = callResult.success && !callResult.simulated
        await finalise(callSuccess, !callResult.success ? (callResult.error || 'twilio_call_failed') : callResult.simulated ? 'twilio_not_configured' : null, callSuccess ? { twilio_sid: callResult.sid } : null)
        return Response.json({ success: true, action: callSuccess ? 'executed' : 'failed', call_result: callResult.success ? 'placed' : callResult.simulated ? 'simulated' : 'failed' })
      }
      await finalise(false, 'no_consignee_phone')
      return Response.json({ success: true, action: 'failed', note: 'No consignee phone for failed delivery callback' })
    }

    // ── CALL / EMERGENCY / MAKE_CALL — Phase 3 voice call to carrier ────
    if (['call', 'emergency', 'make_call'].includes(actionType)) {
      const carrierPhone = details.carrier_phone
        || extractPhoneNumber(actionLabel)
        || extractPhoneNumber(client?.system_prompt)

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

        const resolvedDriverPhone = await resolveDriverPhone()
        if (resolvedDriverPhone) {
          const driverMsg = `DisruptionHub OPS${details.ref ? ` — ${details.ref}` : ''}\n\nOps approved. Carrier being contacted.\nStay safe.`
          await sendSMS(resolvedDriverPhone, driverMsg).catch(err => console.error('[approvals] sendSMS to driver failed:', err?.message))
        }

        const callSuccess = callResult.success && !callResult.simulated
        await finalise(
          callSuccess,
          !callResult.success ? (callResult.error || 'twilio_call_failed') : callResult.simulated ? 'twilio_not_configured' : null,
          callSuccess ? { twilio_sid: callResult.sid, twilio_status: callResult.status, carrier_phone: carrierPhone } : null
        )
        return Response.json({
          success: true,
          action: callSuccess ? 'executed' : 'failed',
          call_result: callResult.success ? 'placed' : callResult.simulated ? 'simulated' : 'failed',
          driver_notified: !!resolvedDriverPhone,
          phase: 3
        })
      }

      // No carrier phone — still notify driver
      const resolvedDriverPhone2 = await resolveDriverPhone()
      if (resolvedDriverPhone2) {
        const driverMsg = `DisruptionHub OPS${details.ref ? ` — ${details.ref}` : ''}\n\nOps have confirmed. Recovery is being arranged — you will receive a further update shortly. Stay with your vehicle, hazards on.`
        const result = await sendSMS(resolvedDriverPhone2, driverMsg)
        await finalise(false, 'no_carrier_phone_driver_notified_only')
        return Response.json({ success: true, action: 'failed', driver_notified: result.success, note: 'No carrier phone — driver notified directly' })
      }

      await finalise(false, 'no_carrier_or_driver_phone')
      return Response.json({ success: true, action: 'failed', driver_notified: false, note: 'No carrier or driver phone — action manually' })
    }

    await finalise(true)
    return Response.json({ success: true, action: 'executed' })

  } catch (error) {
    console.error('Approvals error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
