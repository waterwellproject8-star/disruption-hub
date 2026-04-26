import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { vocabFor } from '../../../../lib/sectorVocabulary.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

// Inlined SMS — no lib import needed
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

const DRIVER_ALERT_SYSTEM = `You are a Senior Logistics Crisis Director. You are direct and prioritise by financial impact and urgency.

IMPORTANT: The ops manager is already being alerted — they are receiving this analysis right now. Do NOT make "notify the ops manager" or "contact the ops manager" your Action 1. They are already aware. Action 1 should be the operational response they need to take immediately.

When given a driver alert, respond with this exact structure:

## DISRUPTION ASSESSMENT
- Severity: [CRITICAL / HIGH / MEDIUM / LOW]
- Estimated Financial Impact: £[X,XXX]
- Affected Shipments: [number]
- Time to Resolution: [X hours]

## IMMEDIATE ACTIONS (Do these NOW)
1. [Specific operational action — named owner — specific deadline]
2. [Specific operational action — named owner — deadline]
3. [Specific operational action — named owner — deadline]

## WHO TO CONTACT
[Carrier / customer — with exact message to send]

## DOWNSTREAM RISKS
[What breaks next if unresolved]

Rules:
1. Never invent location names — if uncertain say "verify via Google Maps before dispatching"
2. Apply 1.5x buffer to all UK road time estimates
3. If driver is injured — 999 is the first call, not the ops manager
4. If location is driver-reported, Action 1 must be: confirm exact vehicle location with driver
5. Never put the ops manager's own contact details in Action 1 — they are already reading this

Temperature rules:
- Chilled (0–5°C): alarm above 5°C = cold chain risk
- Frozen (−18°C to −22°C): alarm above −15°C = critical
- Pharmaceutical: disclose any breach to consignee before delivery`

function extractFirstAction(text) {
  const lines = text.split('\n')
  const actions = []
  for (const line of lines) {
    const match = line.match(/^([123])\.?\s+(.{15,120})/)
    if (match) {
      const action = match[2].replace(/\*\*/g, '').split('—')[0].trim().substring(0, 100)
      actions.push(action)
    }
  }
  // Skip boilerplate that shouldn't appear in the SMS action line
  const boilerplate = /confirm.*location|exact.*vehicle.*location|verify.*position|notify.*ops|contact.*ops|inform.*ops|alert.*ops|ops.*manager.*already/i
  for (const action of actions) {
    if (!boilerplate.test(action)) return action
  }
  return actions[0] || null
}

// Build a clean ops SMS — what happened, exposure, what YES does
// Never dump raw AI action text — ops needs to scan in 2 seconds
function buildOpsSMS({ severity, vehicle_reg, human_description, financialImpact, detectedType, force_alert, force_financial_zero, location_description, vocab }) {
  const v = vocab || vocabFor('haulage')
  const sev = force_alert && severity === 'MEDIUM' ? 'HIGH' : severity
  const situation = (human_description || 'Driver alert').substring(0, 50).replace(/\n/g, ' ')
  const loc = location_description ? ` Driver at ${location_description}.` : ''
  const money = (!force_financial_zero && financialImpact > 0) ? `\n${v.breach_consequence_label}: £${financialImpact.toLocaleString()} if slot missed.` : ''

  const yesAction = {
    dispatch:  'confirm recovery is being arranged',
    sms:       'send driver instruction',
    reroute:   'reroute driver',
    call:      'call carrier for recovery',
    emergency: 'confirm emergency dispatch',
    preshift:  'clear driver to depart',
  }[detectedType] || 'execute action'

  return `DisruptionHub — ${sev}\n${vehicle_reg || ''}: ${situation}.${loc}${money}\nReply YES to ${yesAction}, NO to reject, OPEN for dashboard.`
}

function extractCarrierPhone(systemPrompt) {
  if (!systemPrompt) return null
  const phones = systemPrompt.match(/0800[\s\d]{8,12}|07[\d\s]{9,11}/g)
  return phones?.[0]?.replace(/\s/g, '') || null
}

function extractCarrierName(responseText) {
  const match = responseText.match(/(?:call|contact|notify)\s+([A-Z][A-Za-z\s]+(?:UK|Express|Logistics|Freight|Transport|Recovery|Breakdown))/i)
  return match?.[1]?.trim() || null
}

// Determine action type from issue context + AI response
// This is the key function — must be correct for each scenario
function detectActionType(issueType, firstAction) {
  // Emergency/safety issues always need dispatch confirmation to driver
  const dispatchIssues = ['breakdown', 'medical', 'accident', 'vehicle_theft', 'theft_threat']
  if (issueType && dispatchIssues.some(d => issueType.toLowerCase().includes(d))) {
    return 'dispatch'
  }

  // Driver hours/cant_complete → SMS instruction to driver
  const smsIssues = ['hours', 'cant_complete', 'delayed', 'reroute', 'diversion', 'road_closure']
  if (issueType && smsIssues.some(s => issueType.toLowerCase().includes(s))) {
    return 'sms'
  }

  // Fall back to pattern matching on AI response text
  if (!firstAction) return 'sms'

  if (/999|police|ambulance|emergency.service/i.test(firstAction)) return 'emergency'
  if (/dispatch|relief.vehicle|recovery.vehicle|breakdown.cover|send.recovery/i.test(firstAction)) return 'dispatch'
  if (/reroute|re-route|divert|exit.junction|alternative.route/i.test(firstAction)) return 'reroute'
  if (/send.sms|text.driver|message.driver|notify.driver|instruction.to.driver/i.test(firstAction)) return 'sms'
  // "call carrier" = Phase 3 voice call — only valid if a carrier phone exists in system prompt
  if (/call.{0,30}(carrier|recovery|breakdown|haulage|express|freight)/i.test(firstAction)) return 'call'
  // Default: SMS to driver
  return 'sms'
}

const extractDelayMinutes = (text) => {
  const patterns = [
    /(\d+)\s*(?:to\s*\d+)?\s*hours?/i,
    /(\d+)\s*(?:to\s*\d+)?\s*(?:minutes?|mins?)/i,
    /(\d+)hr/i
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) {
      const n = parseInt(m[1])
      if (n >= 1 && n <= 600) {
        return /hour|hr/i.test(p.source) ? n * 60 : n
      }
    }
  }
  return 60
}

export async function POST(request) {
  try {
    const body = await request.json()
    let {
      client_id,
      driver_name,
      driver_phone,
      vehicle_reg,
      issue_description,
      human_description,
      latitude,
      longitude,
      location_description,
      ref,
      force_alert,
      force_financial_zero,
      issue_type,
      at_risk_refs,
      delay_minutes,
      reason,
      heading_direction,
    } = body
    if (client_id) client_id = client_id.toLowerCase().trim()
    if (vehicle_reg) vehicle_reg = vehicle_reg.toUpperCase().trim()

    if (!issue_description) {
      return Response.json({ error: 'issue_description is required' }, { status: 400 })
    }

    // Safety scenarios always warrant at minimum HIGH — AI can underrate these
    const alwaysHighIssues = ['vehicle_theft', 'theft_threat', 'accident', 'medical', 'breakdown']
    const forceHighSeverity = issue_type && alwaysHighIssues.includes(issue_type)

    const locationStr = (latitude && longitude)
      ? `GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}. Area: ${location_description || 'verify via maps'}`
      : location_description || 'Location not confirmed — verify with driver'

    let w3wAddress = null
    if (latitude && longitude && process.env.W3W_API_KEY) {
      try {
        const w3wRes = await fetch(`https://api.what3words.com/v3/convert-to-3wa?coordinates=${latitude},${longitude}&language=en&key=${process.env.W3W_API_KEY}`)
        const w3wData = await w3wRes.json()
        if (w3wData?.words) w3wAddress = `///${w3wData.words}`
      } catch (e) { console.error('[alert] W3W lookup failed:', e?.message) }
    }

    const opsLocationStr = (() => {
      const dir = heading_direction ? ` ${heading_direction}` : ''
      const area = location_description || 'Location not confirmed'
      const parts = []
      parts.push(`Area: ${area}${dir}`)
      if (w3wAddress) parts.push(`What3Words: ${w3wAddress}`)
      if (latitude && longitude) {
        parts.push(`Map: https://maps.google.com/?q=${latitude.toFixed(5)},${longitude.toFixed(5)}`)
      }
      return parts.join('\n')
    })()

    const analysisPrompt = `DRIVER ALERT
Driver: ${driver_name || 'Unknown'}
Vehicle: ${vehicle_reg || 'Unknown'}
Ref: ${ref || 'DRIVER-ALERT'}
Location: ${locationStr}
Report: "${issue_description}"

Provide immediate disruption analysis and action plan.`

    let systemPrompt = null
    let contactPhone = null
    let clientSector = null
    const db = getDB()

    // Dedup — skip if a pending approval already exists for this vehicle in the last 5 minutes
    // Running late alerts bypass dedup — they should always log even if another alert is pending
    if (db && vehicle_reg && client_id && issue_type !== 'running_late') {
      const since = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data: recent } = await db.from('approvals')
        .select('id')
        .eq('client_id', client_id)
        .eq('status', 'pending')
        .contains('action_details', { vehicle_reg })
        .gt('created_at', since)
        .limit(1)
      if (recent?.length > 0) {
        console.log('[ALERT] Dedup HIT — returning early', { existing_id: recent[0].id })
        return Response.json({ success: true, deduplicated: true, existing_id: recent[0].id })
      }
    }

    if (db && client_id) {
      const { data } = await db
        .from('clients')
        .select('system_prompt, contact_phone, contact_name, sector')
        .eq('id', client_id)
        .single()
      if (data) {
        systemPrompt = data.system_prompt
        contactPhone = data.contact_phone
        clientSector = data.sector
      }
    }
    const vocab = vocabFor(clientSector)

    // ── RUNNING LATE — fast path, no AI call needed ──────────────────────
    if (issue_type === 'running_late' && delay_minutes) {
      if (!db) return Response.json({ success: true, severity: 'LOW', financial_impact: 0, sms_sent: false, action_type: 'running_late' })
      const mins = parseInt(delay_minutes, 10) || 0
      let slaWindow = null
      let consigneeName = null
      let consigneePhone = null
      let penalty = 0
      let timeToSla = 999

      if (ref && client_id) {
        try {
          const { data: shipment } = await db.from('shipments')
            .select('sla_window, consignee, consignee_phone, penalty_if_breached')
            .eq('client_id', client_id).eq('ref', ref).maybeSingle()
          if (shipment) {
            slaWindow = shipment.sla_window
            consigneeName = shipment.consignee || ref
            consigneePhone = shipment.consignee_phone || null
            penalty = shipment.penalty_if_breached || 0
            if (slaWindow) {
              const slaEnd = slaWindow.includes('-') ? slaWindow.split('-')[1].trim() : slaWindow
              const today = new Date().toLocaleDateString('en-CA')
              const slaDate = slaEnd.includes('T') ? new Date(slaEnd) : new Date(`${today}T${slaEnd}:00`)
              timeToSla = Math.round((slaDate.getTime() - Date.now()) / 60000)
            }
          }
        } catch (e) { console.error('[running_late] shipment lookup:', e?.message) }
      }

      let severity
      if (mins >= timeToSla) severity = 'HIGH'
      else if (mins >= 15) severity = 'MEDIUM'
      else severity = 'LOW'

      const { error: incErr } = await db.from('incidents').insert({
        client_id, user_input: issue_description, ai_response: `Running late: ${mins}min delay. Reason: ${reason || 'not specified'}. SLA in ${timeToSla}min.`,
        severity, financial_impact: severity === 'HIGH' ? penalty : 0, ref: ref || 'DRIVER-ALERT'
      })
      if (incErr) console.error('[running_late] incident insert:', incErr.message)

      try {
        await db.from('webhook_log').insert({
          client_id, system_name: 'driver_pwa', direction: 'inbound', event_type: 'running_late',
          severity, financial_impact: severity === 'HIGH' ? penalty : 0,
          payload: { vehicle_reg, ref, driver_name, delay_minutes: mins, reason },
          sms_fired: severity !== 'LOW' && !!contactPhone, created_at: new Date().toISOString()
        })
      } catch (e) { console.error('[running_late] webhook_log:', e?.message) }

      let smsSent = false
      if (severity === 'HIGH' && contactPhone) {
        const smsBody = `DisruptionHub — HIGH\n${vehicle_reg || ''}: Running late — ${mins} mins delay reported.\n${vocab.breach_consequence_label}: £${penalty.toLocaleString()} at risk.\n${consigneeName || vocab.delivery_recipient_short} being notified automatically.\nReply OPEN for dashboard.`
        const result = await sendSMS(contactPhone, smsBody)
        smsSent = result.success || false

        if (consigneePhone) {
          const nowIso = new Date().toISOString()
          const { data: consRow, error: consErr } = await db.from('approvals').insert({
            client_id, action_type: 'call',
            action_label: `Auto-notified ${consigneeName} of ${mins}min delay — SLA breach`,
            action_details: { vehicle_reg, ref, driver_name, driver_phone, call_type: 'consignee_delay_alert', consignee_name: consigneeName, consignee_phone: consigneePhone, delay_reason: reason || 'Running late', delay_minutes: mins, source: 'running_late', severity: 'HIGH' },
            financial_value: penalty, status: 'executed', approved_by: 'system_auto', approved_at: nowIso, executed_at: nowIso
          }).select('id').single()
          if (consErr) console.error('[running_late] consignee approval:', consErr.message)

          // Fire consignee call immediately — no ops approval needed for delay notifications
          try {
            const sid = process.env.TWILIO_ACCOUNT_SID
            const token = process.env.TWILIO_AUTH_TOKEN
            const from = process.env.TWILIO_PHONE_NUMBER
            if (sid && token && from && !sid.includes('placeholder') && !sid.startsWith('AC_')) {
              const spokenVehicle = (vehicle_reg || '').replace(/\s/g, '').replace(/./g, c => c + '. ').trim()
              const delaySpoken = mins >= 60 ? `${Math.floor(mins / 60)} hour${Math.floor(mins / 60) > 1 ? 's' : ''}${mins % 60 > 0 ? ` and ${mins % 60} minutes` : ''}` : `${mins} minutes`
              const voiceMsg = `This is an automated call from DisruptionHub. ${vocab.voice_intro_delay} ${spokenVehicle} is running approximately ${delaySpoken} late. ${reason ? `The reason given is ${reason}.` : ''} No action is required from you at this time. If you need to discuss, please contact the operations team. Thank you.`
              const safe = voiceMsg.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')
              const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Amy" language="en-GB">${safe}</Say><Pause length="1"/><Say voice="Polly.Amy" language="en-GB">I will repeat that message.</Say><Pause length="1"/><Say voice="Polly.Amy" language="en-GB">${safe}</Say></Response>`
              const e164 = consigneePhone.startsWith('+') ? consigneePhone : consigneePhone.startsWith('0') ? '+44' + consigneePhone.slice(1) : consigneePhone
              const callRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
                method: 'POST',
                headers: { 'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ To: e164, From: from, Twiml: twiml })
              })
              const callData = await callRes.json()
              if (consRow?.id) {
                await db.from('approvals').update({ execution_result: { twilio_sid: callData.sid, twilio_status: callData.status, auto_fired: true } }).eq('id', consRow.id)
              }
              console.log('[running_late] consignee call fired:', callRes.ok ? 'ok' : 'failed', callData.sid || callData.message)
            } else {
              console.log('[running_late] consignee call skipped — Twilio not configured')
            }
          } catch (callErr) { console.error('[running_late] consignee call error:', callErr?.message) }
        }
      } else if (severity === 'MEDIUM' && contactPhone) {
        const smsBody = `DisruptionHub — MEDIUM\n${vehicle_reg || ''}: Running late — ${mins} mins delay reported.\nReason: ${reason || 'not specified'}. ${vocab.breach_consequence_label}: ${timeToSla} mins remaining.\nDashboard: disruptionhub.ai/unlock`
        const result = await sendSMS(contactPhone, smsBody)
        smsSent = result.success || false
      }

      return Response.json({ success: true, severity, financial_impact: severity === 'HIGH' ? penalty : 0, sms_sent: smsSent, action_type: 'running_late' })
    }

    const finalSystem = systemPrompt
      ? `${DRIVER_ALERT_SYSTEM}\n\nCLIENT CONTEXT:\n${systemPrompt}`
      : DRIVER_ALERT_SYSTEM

    // Use Haiku — fast enough to beat 30s Vercel hobby limit
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: finalSystem,
      messages: [{ role: 'user', content: analysisPrompt }]
    })

    const fullResponse = response.content[0]?.text || ''

    const sevMatch = fullResponse.match(/\b(CRITICAL|HIGH|MEDIUM|LOW)\b/)
    let severity = sevMatch?.[1] || 'HIGH'
    // Safety scenarios: never allow AI to rate below HIGH
    if (forceHighSeverity && (severity === 'MEDIUM' || severity === 'LOW')) {
      severity = 'HIGH'
    }

    const moneyMatch = fullResponse.match(/£([\d,]+)/)
    const financialImpact = moneyMatch ? parseInt(moneyMatch[1].replace(/,/g, '')) : 0

    const firstAction = extractFirstAction(fullResponse)

    // Use issue_type (passed from driver app) for precise action detection
    // Fall back to human_description text matching
    const issueContext = issue_type || human_description || ''
    let detectedType = detectActionType(issueContext, firstAction)
    if (force_alert && force_financial_zero) detectedType = 'preshift'

    let primaryApprovalId = null

    if (db) {
      // Log incident
      const { error: incidentErr } = await db.from('incidents').insert({
        client_id,
        user_input: analysisPrompt,
        ai_response: fullResponse,
        severity,
        financial_impact: financialImpact,
        ref: ref || 'DRIVER-ALERT'
      })
      if (incidentErr) console.error('incident insert:', incidentErr.message, incidentErr.code)

      // Mirror to webhook_log so driver-triggered events appear in the dashboard INCIDENTS panel
      try {
        const { error: whErr } = await db.from('webhook_log').insert({
          client_id,
          system_name: 'driver_pwa',
          direction: 'inbound',
          event_type: issue_type || 'driver_breakdown',
          severity,
          financial_impact: Math.round(financialImpact || 0),
          payload: { vehicle_reg, ref, driver_name, description: human_description },
          sms_fired: !!contactPhone,
          created_at: new Date().toISOString()
        })
        if (whErr) console.error('webhook_log insert (driver alert):', whErr.message, whErr.code)
      } catch (e) {
        console.error('webhook_log insert threw (driver alert):', e?.message)
      }

      // Create approval for HIGH/CRITICAL
      // Skip for pre-shift defects — the pre-shift-specific branch below handles those
      if (firstAction && (severity === 'CRITICAL' || severity === 'HIGH' || force_alert) && !(force_alert && force_financial_zero)) {
        const { data: approvalRow, error: approvalErr } = await db.from('approvals').insert({
          client_id,
          action_type: detectedType,
          action_label: firstAction.substring(0, 200),
          action_details: {
            vehicle_reg,
            ref: ref || 'DRIVER-ALERT',
            driver_name: driver_name || null,
            driver_phone: driver_phone || null,
            carrier_name: extractCarrierName(fullResponse),
            carrier_phone: extractCarrierPhone(systemPrompt),
            script: firstAction,
            source: 'driver_alert',
            issue_context: issueContext.substring(0, 100),
            severity,
            ...((issue_type === 'goods_refused' || issue_type === 'access_problem' || issue_type === 'damage_found') ? { type: 'failed_delivery' } : {})
          },
          financial_value: force_financial_zero ? 0 : financialImpact,
          status: 'pending',
          escalation_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        }).select('id').single()
        if (approvalErr) console.error('approval insert:', approvalErr.message, approvalErr.code)
        primaryApprovalId = approvalRow?.id || null

        // Detect breakdown for consignee call type — shared by primary + cascade approvals
        const isBreakdownAlert = issue_type === 'breakdown' || (issueContext && /breakdown/i.test(issueContext))

        // Create second approval for consignee delay notification
        // Sits as a pending card in COMMAND tab — ops fires it after handling recovery
        if (severity === 'CRITICAL' || severity === 'HIGH') {
          let consigneeName = null
          let consigneePhone = null
          let shipmentEta = null
          if (ref) {
            try {
              const { data: shipment } = await db.from('shipments')
                .select('consignee, consignee_phone, eta')
                .eq('client_id', client_id)
                .eq('ref', ref)
                .maybeSingle()
              if (shipment) {
                consigneeName = shipment.consignee || null
                consigneePhone = shipment.consignee_phone || null
                shipmentEta = shipment.eta || null
              }
            } catch (e) {
              console.error('shipment lookup for consignee_phone failed:', e?.message)
            }
          }
          if (!consigneeName) consigneeName = ref || 'consignee'
          if (!consigneePhone) {
            console.warn(`[alert] consignee_phone missing for ${ref} — approval will be failed at execute time (no fallback — never auto-dial ops manager)`)
          }
          let delayMins = 30
          if (shipmentEta) {
            const calc = Math.round((new Date(shipmentEta).getTime() - Date.now()) / 60000)
            delayMins = calc > 0 ? calc : 0
          }
          const consigneeCallType = isBreakdownAlert ? 'breakdown' : 'consignee_delay_alert'
          const { error: consigneeErr } = await db.from('approvals').insert({
            client_id,
            action_type: 'call',
            action_label: isBreakdownAlert ? `Notify ${consigneeName} of breakdown delay — automated call` : `Notify ${consigneeName} of delay — automated call`,
            action_details: {
              vehicle_reg,
              ref: ref || 'DRIVER-ALERT',
              driver_name: driver_name || null,
              driver_phone: driver_phone || null,
              call_type: consigneeCallType,
              ...(isBreakdownAlert ? { alert_type: 'breakdown' } : {}),
              consignee_name: consigneeName,
              consignee_phone: consigneePhone,
              delay_reason: human_description || issueContext || null,
              delay_minutes: delayMins,
              source: 'driver_alert',
              severity
            },
            financial_value: 0,
            status: 'pending',
            escalation_at: new Date(Date.now() + 20 * 60 * 1000).toISOString()
          })
          if (consigneeErr) console.error('consignee approval insert:', consigneeErr.message, consigneeErr.code)
        }

      }

      // Failed/refused delivery — create consignee callback approval
      if (issue_type === 'goods_refused' || issue_type === 'short_load' || issue_type === 'damage_found') {
        let fdConsignee = null
        let fdPhone = null
        if (ref) {
          try {
            const { data: s } = await db.from('shipments').select('consignee, consignee_phone').eq('client_id', client_id).eq('ref', ref).maybeSingle()
            if (s) { fdConsignee = s.consignee || ref; fdPhone = s.consignee_phone || null }
          } catch {}
        }
        const { error: fdErr } = await db.from('approvals').insert({
          client_id,
          action_type: 'call',
          action_label: `Call ${fdConsignee || ref || 'consignee'} — failed delivery callback`,
          action_details: { vehicle_reg, ref: ref || 'DRIVER-ALERT', driver_name: driver_name || null, driver_phone: driver_phone || null, call_type: 'failed_delivery_callback', type: 'failed_delivery', consignee_name: fdConsignee || ref, consignee_phone: fdPhone, source: 'driver_alert', severity },
          financial_value: 0,
          status: 'pending',
          escalation_at: new Date(Date.now() + 20 * 60 * 1000).toISOString()
        })
        if (fdErr) console.error('failed delivery callback insert:', fdErr.message, fdErr.code)
      }

      // Pre-shift defect — action_type is 'sms' so YES sends instruction to driver
      if (force_alert && force_financial_zero) {
        const { error: preshiftErr } = await db.from('approvals').insert({
          client_id,
          action_type: 'sms',
          action_label: `Pre-shift defect: ${human_description?.replace('Pre-shift fail: ', '') || 'vehicle issue'} — ${driver_name || 'driver'} (${vehicle_reg}) awaiting ops decision`,
          action_details: {
            vehicle_reg,
            ref: 'PRE-SHIFT',
            driver_name: driver_name || null,
            driver_phone: driver_phone || null,
            script: `OPS CLEARED: ${vehicle_reg} confirmed safe to depart. Start your shift.`,
            source: 'preshift_check',
            severity: 'HIGH'
          },
          financial_value: 0,
          status: 'pending',
          escalation_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        })
        if (preshiftErr) console.error('preshift approval insert:', preshiftErr.message, preshiftErr.code)
      }
    }

    // SMS ops manager
    let smsSent = false
    if ((force_alert || severity === 'CRITICAL' || severity === 'HIGH') && contactPhone) {
      let smsBody
      if (issue_type === 'medical' || issue_type === 'driver_unwell') {
        smsBody = `DisruptionHub — CRITICAL\n${vehicle_reg || ''}: Medical emergency. Driver: ${driver_name || 'Unknown'}.${driver_phone ? `\nCall driver: ${driver_phone}.` : ''}${opsLocationStr ? `\nDriver at: ${opsLocationStr}.` : ''}\nReply YES to acknowledge, NO to dismiss, OPEN for dashboard.\nIf driver unresponsive — call 999 immediately.`
      } else if (issue_type === 'goods_refused' || issue_type === 'access_problem' || issue_type === 'damage_found') {
        const reason = (human_description || 'No reason given').substring(0, 60).replace(/\n/g, ' ')
        const consignee = ref || 'consignee'
        smsBody = `DisruptionHub — HIGH\n${vehicle_reg || ''}: ${vocab.delivery_refused_phrase} ${consignee}.\nReason: ${reason}.\nReply YES to return to base, HOLD to keep driver on site, ALT for alternative.\nDashboard: disruptionhub.ai/unlock`
      } else {
        smsBody = buildOpsSMS({
          severity,
          vehicle_reg,
          human_description,
          financialImpact,
          detectedType,
          force_alert,
          force_financial_zero,
          location_description: opsLocationStr,
          vocab
        })
      }
      if (primaryApprovalId) smsBody += `\nRef: ${primaryApprovalId.slice(0, 8)}`
      const result = await sendSMS(contactPhone, smsBody)
      smsSent = result.success || false
    }

    return Response.json({
      success: true,
      severity,
      financial_impact: financialImpact,
      analysis: fullResponse,
      sms_sent: smsSent,
      action_type: detectedType
    })

  } catch (error) {
    console.error('[ALERT] Top-level catch:', error.message, error.stack)
    return Response.json({ error: 'ERR_004', message: 'Request could not be processed' }, { status: 500 })
  }
}
