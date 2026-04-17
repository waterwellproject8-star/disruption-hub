import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

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
function buildOpsSMS({ severity, vehicle_reg, human_description, financialImpact, detectedType, force_alert, force_financial_zero, location_description }) {
  const sev = force_alert && severity === 'MEDIUM' ? 'HIGH' : severity
  const situation = (human_description || 'Driver alert').substring(0, 50).replace(/\n/g, ' ')
  const loc = location_description ? ` Driver at ${location_description}.` : ''
  const money = (!force_financial_zero && financialImpact > 0) ? `\nSLA risk: £${financialImpact.toLocaleString()} if slot missed.` : ''

  const yesAction = {
    dispatch:  'dispatch recovery vehicle',
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

    const analysisPrompt = `DRIVER ALERT
Driver: ${driver_name || 'Unknown'}
Vehicle: ${vehicle_reg || 'Unknown'}
Ref: ${ref || 'DRIVER-ALERT'}
Location: ${locationStr}
Report: "${issue_description}"

Provide immediate disruption analysis and action plan.`

    let systemPrompt = null
    let contactPhone = null
    const db = getDB()

    // Dedup — skip if a pending approval already exists for this vehicle in the last 5 minutes
    if (db && vehicle_reg && client_id) {
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
        .select('system_prompt, contact_phone, contact_name')
        .eq('id', client_id)
        .single()
      if (data) {
        systemPrompt = data.system_prompt
        contactPhone = data.contact_phone
      }
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
            severity
          },
          financial_value: force_financial_zero ? 0 : financialImpact,
          status: 'pending',
          escalation_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        }).select('id').single()
        if (approvalErr) console.error('approval insert:', approvalErr.message, approvalErr.code)
        primaryApprovalId = approvalRow?.id || null

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
          const { error: consigneeErr } = await db.from('approvals').insert({
            client_id,
            action_type: 'call',
            action_label: `Notify ${consigneeName} of delay — automated call`,
            action_details: {
              vehicle_reg,
              ref: ref || 'DRIVER-ALERT',
              driver_name: driver_name || null,
              driver_phone: driver_phone || null,
              call_type: 'consignee_delay_alert',
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

        // CASCADE — create consignee notifications for all OTHER at_risk jobs
        if ((severity === 'CRITICAL' || severity === 'HIGH') && vehicle_reg) {
          try {
            const delayMins = extractDelayMinutes(fullResponse)
            // Prefer at_risk_refs from request body (avoids race condition where
            // driver_progress rows haven't been written yet). Fall back to DB query.
            let otherRefs = (Array.isArray(at_risk_refs) && at_risk_refs.length > 0)
              ? at_risk_refs.filter(r => r && r !== ref && r !== 'SHIFT_START')
              : []
            if (otherRefs.length === 0) {
              const { data: atRiskJobs } = await db.from('driver_progress')
                .select('ref')
                .eq('vehicle_reg', vehicle_reg)
                .eq('status', 'at_risk')
              otherRefs = (atRiskJobs || []).map(j => j.ref).filter(r => r && r !== ref && r !== 'SHIFT_START')
            }
            if (otherRefs.length > 0) {
              const { data: shipments } = await db.from('shipments')
                .select('ref, consignee, consignee_phone, eta, sla_window, penalty_if_breached')
                .eq('client_id', client_id)
                .in('ref', otherRefs)
              for (const s of (shipments || [])) {
                let cascadeDelayMins = delayMins
                if (s.eta) {
                  const calc = Math.round((new Date(s.eta).getTime() - Date.now()) / 60000)
                  cascadeDelayMins = calc > 0 ? calc : 0
                }
                const revisedEta = s.eta ? new Date(new Date().getTime() + cascadeDelayMins * 60000).toISOString() : null
                const slaBreach = s.sla_window && revisedEta ? new Date(revisedEta) > new Date(s.sla_window.split('-')[1]?.trim() || s.sla_window) : false
                const penalty = s.penalty_if_breached || 0
                const cascadeConsignee = s.consignee || s.ref || 'consignee'
                const label = slaBreach
                  ? `⚠ SLA AT RISK — Notify ${cascadeConsignee} of delay — £${penalty.toLocaleString()} exposure`
                  : `Notify ${cascadeConsignee} of delay — automated call`
                const cascadePhone = s.consignee_phone || null
                if (!cascadePhone) {
                  console.warn(`[cascade] consignee_phone missing for ${s.ref} — approval will be failed at execute time (no fallback — never auto-dial ops manager)`)
                }
                const { error: cascadeErr } = await db.from('approvals').insert({
                  client_id,
                  action_type: 'call',
                  action_label: label,
                  action_details: {
                    vehicle_reg,
                    ref: s.ref,
                    driver_name: driver_name || null,
                    driver_phone: driver_phone || null,
                    call_type: 'consignee_delay_alert',
                    consignee_name: cascadeConsignee,
                    consignee_phone: cascadePhone,
                    delay_reason: human_description || issueContext || null,
                    delay_minutes: cascadeDelayMins,
                    revised_eta: revisedEta,
                    sla_breach: slaBreach,
                    penalty_gbp: penalty,
                    source: 'driver_alert_cascade',
                    severity
                  },
                  financial_value: slaBreach ? penalty : 0,
                  status: 'pending',
                  escalation_at: new Date(Date.now() + 20 * 60 * 1000).toISOString()
                })
                if (cascadeErr) console.error(`cascade approval [${s.ref}]:`, cascadeErr.message, cascadeErr.code)
                else console.log(`[cascade] Created consignee notification for ${s.ref} → ${s.consignee || 'unknown'} (SLA breach: ${slaBreach})`)
              }
              // Update shipments with revised ETAs
              for (const s of (shipments || [])) {
                if (s.eta) {
                  const revisedEta = new Date(new Date().getTime() + delayMins * 60000).toISOString()
                  await db.from('shipments').update({ eta: revisedEta }).eq('client_id', client_id).eq('ref', s.ref).catch(err => console.error('[alert] shipments ETA update failed:', err?.message))
                }
              }
            }
          } catch (e) { console.error('[cascade] error:', e.message) }
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
          action_details: { vehicle_reg, ref: ref || 'DRIVER-ALERT', driver_name: driver_name || null, driver_phone: driver_phone || null, call_type: 'failed_delivery_callback', consignee_name: fdConsignee || ref, consignee_phone: fdPhone, source: 'driver_alert', severity },
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
        smsBody = `DisruptionHub — CRITICAL\n${vehicle_reg || ''}: Medical emergency. Driver: ${driver_name || 'Unknown'}.${driver_phone ? `\nCall driver: ${driver_phone}.` : ''}${location_description ? `\nDriver at: ${location_description}.` : ''}\nReply YES to acknowledge, NO to dismiss, OPEN for dashboard.\nIf driver unresponsive — call 999 immediately.`
      } else {
        smsBody = buildOpsSMS({
          severity,
          vehicle_reg,
          human_description,
          financialImpact,
          detectedType,
          force_alert,
          force_financial_zero,
          location_description
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
    return Response.json({ error: error.message }, { status: 500 })
  }
}
