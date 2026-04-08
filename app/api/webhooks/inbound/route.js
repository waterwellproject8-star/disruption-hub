import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
}

// ── STEP 1: EXTRACT REAL FINANCIAL VALUE FROM PAYLOAD ────────────────────────
// Pull confirmed financial figures directly from the webhook payload.
// These come from the TMS/telematics system — they are real numbers, not estimates.
// Only fall back to null if no payload field exists (AI will then estimate).
function extractPayloadFinancial(payload) {
  if (!payload) return null

  // Direct penalty/charge fields (most reliable — contractually defined)
  if (payload.penalty_gbp       && payload.penalty_gbp > 0)       return payload.penalty_gbp
  if (payload.total_charge_gbp  && payload.total_charge_gbp > 0)  return payload.total_charge_gbp

  // Cargo/consignment value (exposure if lost/spoiled/delayed)
  if (payload.cargo_value_gbp   && payload.cargo_value_gbp > 0)   return payload.cargo_value_gbp
  if (payload.value_gbp         && payload.value_gbp > 0)          return payload.value_gbp

  // Daily charges annualised conservatively (5 working days)
  if (payload.daily_charge_gbp  && payload.daily_charge_gbp > 0)  return payload.daily_charge_gbp * 5

  return null // No payload financial — AI will estimate from context
}

// ── STEP 2: RULES-BASED SEVERITY ─────────────────────────────────────────────
// Severity should not be left entirely to AI estimation.
// These rules are grounded in UK logistics risk standards:
//   CRITICAL = immediate safety/legal risk or >£5,000 confirmed exposure
//   HIGH     = SLA breach likely, cargo at risk, or customer-facing failure
//   MEDIUM   = operational disruption, manageable within shift
//   LOW      = advisory, no immediate impact
function determineEventSeverity(eventType, payload, confirmedFinancial) {

  // Safety events — always CRITICAL regardless of cargo value
  const alwaysCritical = ['panic_button', 'impact_detected', 'reefer_fault']
  if (alwaysCritical.includes(eventType)) return 'CRITICAL'

  // Cold chain: pharmaceutical or high-value frozen → CRITICAL
  if (eventType === 'temp_alarm' || eventType === 'temp_probe_failure') {
    const cargo = (payload?.cargo_type || payload?.cargo || '').toLowerCase()
    const isPharmaceutical = cargo.includes('pharma') || cargo.includes('nhs') || cargo.includes('medical')
    const isFrozen = cargo.includes('frozen') || cargo.includes('-18') || cargo.includes('-20')
    const isHighValue = confirmedFinancial && confirmedFinancial > 5000
    if (isPharmaceutical || isFrozen || isHighValue) return 'CRITICAL'
    return 'HIGH'
  }

  // Confirmed financial > £5,000 → HIGH minimum
  if (confirmedFinancial && confirmedFinancial >= 5000) return 'HIGH'

  // Failed NHS/pharmaceutical delivery → CRITICAL (legal SLA obligations)
  if (eventType === 'failed_delivery') {
    const consignee = (payload?.consignee || '').toLowerCase()
    if (consignee.includes('nhs') || consignee.includes('hospital') || consignee.includes('pharma')) return 'CRITICAL'
    return 'HIGH'
  }

  // Security events → HIGH
  const highSeverity = [
    'panic_button', 'door_open_transit', 'geofence_breach', 'cargo_theft',
    'job_cancelled', 'driver_change', 'engine_fault', 'fuel_critical',
    'collection_no_show', 'border_doc_failure', 'ulez_entry'
  ]
  if (highSeverity.includes(eventType)) return 'HIGH'

  // Compliance events with confirmed charge → HIGH
  if (eventType === 'detention_charge' && confirmedFinancial && confirmedFinancial > 100) return 'HIGH'

  // Behavioural/minor → LOW
  const lowSeverity = ['harsh_braking', 'harsh_acceleration', 'overspeed', 'idle_excess']
  if (lowSeverity.includes(eventType)) return 'LOW'

  // Everything else: MEDIUM
  return 'MEDIUM'
}

// ── GET CLIENT CONFIG ─────────────────────────────────────────────────────────
async function getClientConfig(clientId) {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data } = await supabase
    .from('clients')
    .select('id, name, system_prompt, contact_phone, contact_name, pilot_started_at')
    .eq('slug', clientId)
    .single()
  return data
}

// ── SEND OPS SMS VIA TWILIO ───────────────────────────────────────────────────
async function sendOpsSMS(toPhone, body) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return false
  const { default: twilio } = await import('twilio')
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  try {
    await client.messages.create({
      body,
      from: process.env.TWILIO_FROM_NUMBER || '+447700139349',
      to: toPhone
    })
    return true
  } catch (err) {
    console.error('Twilio error:', err.message)
    return false
  }
}

// ── BUILD CLEAN OPS SMS ───────────────────────────────────────────────────────
function buildOpsSMS(eventType, payload, severity, financialImpact, analysis) {
  const reg = payload?.vehicle_reg || 'Unknown'
  const location = payload?.location || payload?.current_location || ''
  const driver = payload?.driver_name || ''
  const eventLabel = eventType.replace(/_/g, ' ').toUpperCase()
  const sevEmoji = severity === 'CRITICAL' ? '🔴' : severity === 'HIGH' ? '🟠' : '🟡'

  let line1 = `${sevEmoji} DISRUPTIONHUB ALERT — ${severity}`
  let line2 = `${eventLabel} · ${reg}${driver ? ` · ${driver}` : ''}`
  let line3 = location ? `Location: ${location}` : ''
  let line4 = financialImpact > 0 ? `Exposure: £${financialImpact.toLocaleString()}` : ''

  // Extract first action from AI analysis if available
  let actionLine = ''
  if (analysis) {
    const actionMatch = analysis.match(/"immediate_actions"\s*:\s*\[\s*"([^"]{10,80})"/i)
      || analysis.match(/immediate.{0,20}action[^:]*:\s*["']?([^"'\n]{15,80})/i)
    if (actionMatch) actionLine = `Action: ${actionMatch[1].trim()}`
  }

  const parts = [line1, line2, line3, line4, actionLine, 'Reply YES to execute · NO to dismiss · OPEN for dashboard']
    .filter(Boolean)
  return parts.join('\n')
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const body = await request.json()
    const { system, event_type, payload, client_id } = body

    if (!event_type || !client_id) {
      return Response.json({ error: 'Missing event_type or client_id' }, { status: 400 })
    }

    const supabase = getSupabase()

    // ── 1. Get client config ──────────────────────────────────────────────────
    const client = await getClientConfig(client_id)
    const systemPrompt = client?.system_prompt || ''
    const opsPhone = client?.contact_phone || null
    const simulated = !opsPhone // no ops phone = simulated only

    // ── 2. Extract confirmed financial from payload ───────────────────────────
    const confirmedFinancial = extractPayloadFinancial(payload)

    // ── 3. Determine severity via rules (not AI guesswork) ───────────────────
    const severity = determineEventSeverity(event_type, payload, confirmedFinancial)

    // ── 4. Build AI prompt with grounded financial constraint ─────────────────
    const financialConstraint = confirmedFinancial
      ? `\n\nCONFIRMED FINANCIAL EXPOSURE: £${confirmedFinancial.toLocaleString()}. Use this exact figure as financial_impact. Do not estimate a different value.`
      : `\n\nNo confirmed financial figure in payload. Estimate financial_impact conservatively based on event type and client context only.`

    const severityConstraint = `\n\nCONFIRMED SEVERITY: ${severity}. Use this exact value. Do not override it.`

    const fullSystemPrompt = `You are DisruptionHub's autonomous logistics operations agent.
You have 20 years of UK freight and supply chain experience.
Be direct. Give specific names, numbers, deadlines. Never say "it depends" without giving both options.

Analyse this logistics event and return this exact JSON — no preamble, no markdown fences:
{
  "severity": "${severity}",
  "financial_impact": ${confirmedFinancial || 'number'},
  "time_to_resolution": "string",
  "affected_shipments": number,
  "sections": {
    "assessment": "string — 2-3 sentences max",
    "immediate_actions": ["string", "string", "string"],
    "who_to_contact": "string",
    "downstream_risks": "string"
  },
  "actions": [
    {
      "type": "send_sms|send_email|make_call",
      "label": "string",
      "recipient": "string",
      "content": "string",
      "priority": "immediate|within_1hr|within_4hr",
      "auto_approve": false,
      "financial_value": number
    }
  ]
}
${financialConstraint}${severityConstraint}

CLIENT CONTEXT:
${systemPrompt}`

    // ── 5. Call AI ────────────────────────────────────────────────────────────
    let aiAnalysis = ''
    let parsedResult = null
    let financialImpact = confirmedFinancial || 0

    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: fullSystemPrompt,
        messages: [{
          role: 'user',
          content: `EVENT: ${event_type}\nSYSTEM: ${system || 'unknown'}\nPAYLOAD: ${JSON.stringify(payload, null, 2)}`
        }]
      })

      aiAnalysis = msg.content[0]?.text?.trim() || ''
      let clean = aiAnalysis.replace(/^```json\s*/,'').replace(/^```\s*/,'').replace(/\s*```$/,'').trim()

      try {
        parsedResult = JSON.parse(clean)
        // Use payload financial if available — never let AI override a confirmed figure
        if (confirmedFinancial) {
          financialImpact = confirmedFinancial
        } else {
          // AI estimate: cap at reasonable values to prevent hallucinated large numbers
          const aiFinancial = parsedResult?.financial_impact || 0
          financialImpact = Math.min(aiFinancial, 50000) // cap at £50k — flag anything higher
        }
      } catch {
        // AI returned invalid JSON — use payload financial or 0
        financialImpact = confirmedFinancial || 0
      }
    } catch (aiErr) {
      console.error('AI error:', aiErr.message)
    }

    // ── 6. Log to webhook_log ─────────────────────────────────────────────────
    let logId = null
    if (supabase) {
      try {
        const { data: logRow } = await supabase
          .from('webhook_log')
          .insert({
            client_id,
            system_name: system || 'manual',
            event_type,
            payload,
            severity,
            financial_impact: financialImpact,
            analysis: aiAnalysis,
            sms_fired: false, // updated below after SMS attempt
            simulated,
            created_at: new Date().toISOString()
          })
          .select('id')
          .single()
        logId = logRow?.id
      } catch (err) {
        console.error('webhook_log insert error:', err.message)
      }
    }

    // ── 7. Send ops SMS if HIGH or CRITICAL ──────────────────────────────────
    let smsSent = false
    const shouldSendSMS = ['HIGH', 'CRITICAL'].includes(severity)

    if (shouldSendSMS && opsPhone && !simulated) {
      const smsBody = buildOpsSMS(event_type, payload, severity, financialImpact, aiAnalysis)
      smsSent = await sendOpsSMS(opsPhone, smsBody)

      // Update webhook_log with sms_fired status
      if (supabase && logId) {
        try {
          await supabase
            .from('webhook_log')
            .update({ sms_fired: smsSent })
            .eq('id', logId)
        } catch {}
      }
    }

    // ── 8. Write to approvals table ───────────────────────────────────────────
    // vehicle_reg at top level of action_details (Session 9 fix — required for SMS loop)
    const vehicleReg = payload?.vehicle_reg || null
    if (supabase && shouldSendSMS) {
      try {
        const actions = parsedResult?.actions || []
        for (const action of actions.slice(0, 3)) { // max 3 actions per event
          await supabase
            .from('approvals')
            .insert({
              client_id,
              action_type: action.type || 'notify',
              action_label: action.label || 'AI recommended action',
              action_details: {
                vehicle_reg: vehicleReg,         // TOP LEVEL — required by resolveDriverPhone()
                event_type,
                system,
                recipient: action.recipient,
                content: action.content,
                payload,
                financial_impact: financialImpact
              },
              financial_value: action.financial_value || financialImpact || 0,
              requires_approval: !action.auto_approve,
              status: 'pending',
              created_at: new Date().toISOString()
            })
        }
      } catch (err) {
        console.error('approvals insert error:', err.message)
      }
    }

    // ── 9. Return result to dashboard ─────────────────────────────────────────
    return Response.json({
      success: true,
      severity,
      financial_impact: financialImpact,
      financial_source: confirmedFinancial ? 'payload' : 'ai_estimate',
      sms_sent: smsSent,
      simulated,
      analysis: aiAnalysis,
      event_type,
      vehicle_reg: vehicleReg,
      actions_queued: parsedResult?.actions?.length || 0
    })

  } catch (err) {
    console.error('Inbound webhook error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}

// ── GET: Return webhook audit log ─────────────────────────────────────────────
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')
    const limit = parseInt(searchParams.get('limit') || '30')

    const supabase = getSupabase()
    if (!supabase) return Response.json({ logs: [] })

    const { data, error } = await supabase
      .from('webhook_log')
      .select('id, system_name, event_type, severity, financial_impact, sms_fired, simulated, payload, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return Response.json({ logs: data || [] })
  } catch (err) {
    return Response.json({ error: err.message, logs: [] }, { status: 500 })
  }
}
