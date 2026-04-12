import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function extractPayloadFinancial(payload) {
  if (!payload) return null
  if (payload.penalty_gbp      && payload.penalty_gbp > 0)      return Number(payload.penalty_gbp)
  if (payload.total_charge_gbp && payload.total_charge_gbp > 0) return Number(payload.total_charge_gbp)
  if (payload.cargo_value_gbp  && payload.cargo_value_gbp > 0)  return Number(payload.cargo_value_gbp)
  if (payload.value_gbp        && payload.value_gbp > 0)         return Number(payload.value_gbp)
  if (payload.daily_charge_gbp && payload.daily_charge_gbp > 0) return Number(payload.daily_charge_gbp) * 5
  return null
}

function determineEventSeverity(eventType, payload, confirmedFinancial) {
  const alwaysCritical = ['panic_button', 'impact_detected', 'reefer_fault']
  if (alwaysCritical.includes(eventType)) return 'CRITICAL'

  if (eventType === 'temp_alarm' || eventType === 'temp_probe_failure') {
    const cargo = (payload?.cargo_type || payload?.cargo || '').toLowerCase()
    const isPharmaceutical = cargo.includes('pharma') || cargo.includes('nhs') || cargo.includes('medical')
    const isFrozen = cargo.includes('frozen') || cargo.includes('-18') || cargo.includes('-20')
    const isHighValue = confirmedFinancial && confirmedFinancial > 5000
    if (isPharmaceutical || isFrozen || isHighValue) return 'CRITICAL'
    return 'HIGH'
  }

  if (eventType === 'failed_delivery') {
    const consignee = (payload?.consignee || '').toLowerCase()
    if (consignee.includes('nhs') || consignee.includes('hospital') || consignee.includes('pharma')) return 'CRITICAL'
    return 'HIGH'
  }

  if (confirmedFinancial && confirmedFinancial >= 500) return 'HIGH'

  const highSeverity = [
    'door_open_transit', 'geofence_breach', 'cargo_theft', 'job_cancelled',
    'driver_change', 'engine_fault', 'fuel_critical', 'collection_no_show',
    'border_doc_failure', 'ulez_entry', 'night_out_required', 'route_deviation',
    'job_delayed', 'pod_overdue', 'detention_charge', 'multi_drop_change'
  ]
  if (highSeverity.includes(eventType)) return 'HIGH'

  const lowSeverity = ['harsh_braking', 'harsh_acceleration', 'overspeed', 'idle_excess']
  if (lowSeverity.includes(eventType)) return 'LOW'

  return 'MEDIUM'
}

function extractJSON(rawText) {
  if (!rawText) return null
  try {
    const start = rawText.indexOf('{')
    const end = rawText.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) return null
    return JSON.parse(rawText.slice(start, end + 1))
  } catch {
    return null
  }
}

function buildAnalysisSummary(parsed, eventType, severity, financialImpact) {
  if (!parsed) return `**${severity}** — ${eventType.replace(/_/g,' ')}\n\nAI analysis unavailable.`
  const parts = []
  if (parsed.sections?.assessment) parts.push(`## Assessment\n${parsed.sections.assessment}`)
  if (parsed.sections?.immediate_actions?.length) parts.push(`## Immediate Actions\n${parsed.sections.immediate_actions.map((a, i) => `${i+1}. ${a}`).join('\n')}`)
  if (parsed.sections?.who_to_contact) parts.push(`## Who to Contact\n${parsed.sections.who_to_contact}`)
  if (parsed.sections?.downstream_risks) parts.push(`## Downstream Risks\n${parsed.sections.downstream_risks}`)
  if (financialImpact > 0) parts.push(`**Financial exposure: £${financialImpact.toLocaleString()}** · Time to resolution: ${parsed.time_to_resolution || 'unknown'}`)
  return parts.join('\n\n') || `**${severity}** — ${eventType.replace(/_/g,' ')}`
}

async function getClientConfig(clientId) {
  const supabase = getSupabase()
  if (!supabase) return null
  let { data } = await supabase
    .from('clients')
    .select('id, name, system_prompt, contact_phone, contact_name, pilot_started_at')
    .eq('id', clientId)
    .single()
  if (!data) {
    const res = await supabase
      .from('clients')
      .select('id, name, system_prompt, contact_phone, contact_name, pilot_started_at')
      .eq('slug', clientId)
      .single()
    data = res.data
  }
  return data
}

async function sendOpsSMS(toPhone, body) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return false
  const { default: twilio } = await import('twilio')
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  try {
    await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER || '+447700139349',
      to: toPhone
    })
    return true
  } catch (err) {
    console.error('Twilio SMS error:', err.message)
    return false
  }
}

// Build targeted ops SMS per action type — each tells ops exactly what YES executes
function buildActionSMS(eventType, payload, severity, financialImpact, action) {
  const reg        = payload?.vehicle_reg || 'Unknown'
  const location   = payload?.location || payload?.current_location || payload?.current_position || ''
  const consignee  = payload?.consignee || action?.consignee_name || ''
  const delayMins  = payload?.delay_minutes || ''
  const sevEmoji   = severity === 'CRITICAL' ? '🔴' : severity === 'HIGH' ? '🟠' : '🟡'
  const eventLabel = eventType.replace(/_/g, ' ').toUpperCase()
  const actionType = action?.type || 'send_sms'
  const callType   = action?.call_type || ''

  // Line 1: severity + event
  // Line 2: vehicle + location + delay
  // Line 3: consignee + exposure
  // Line 4: what YES does — specific to this action
  // Line 5: reply options

  const line1 = `${sevEmoji} ${severity} — ${eventLabel}`
  const line2 = [reg, location ? location : '', delayMins ? `${delayMins}min` : ''].filter(Boolean).join(' · ')
  const line3 = [consignee, financialImpact > 0 ? `£${financialImpact.toLocaleString()} exposure` : ''].filter(Boolean).join(' · ')

  let line4 = ''
  if (actionType === 'send_sms' || actionType === 'sms' || actionType === 'reroute' || actionType === 'notify') {
    line4 = 'YES = notify driver of situation'
  } else if (actionType === 'dispatch') {
    line4 = 'YES = dispatch recovery + notify driver'
  } else if (actionType === 'call' && callType === 'consignee_delay_alert') {
    const name = action?.consignee_name || consignee || 'consignee'
    line4 = `YES = call ${name} automatically`
  } else if (actionType === 'call' && callType === 'carrier_alert') {
    const name = action?.carrier_name || 'carrier'
    line4 = `YES = call ${name} for recovery`
  } else if (actionType === 'call') {
    line4 = 'YES = make automated call'
  } else if (actionType === 'emergency') {
    line4 = 'YES = emergency dispatch + 999 if needed'
  } else {
    line4 = 'YES = execute action'
  }

  return [line1, line2, line3, line4, 'Reply YES · NO · OPEN'].filter(Boolean).join('\n')
}

// ── EVENT CATEGORIES FOR CALL ROUTING ────────────────────────────────────────
// Delay events → consignee_delay_alert call (notify delivery contact of late arrival)
const DELAY_EVENTS = ['job_delayed', 'route_deviation', 'night_out_required', 'failed_delivery', 'collection_no_show', 'job_cancelled']
// Recovery events → carrier_alert call (dispatch breakdown/recovery)
const RECOVERY_EVENTS = ['panic_button', 'reefer_fault', 'impact_detected', 'engine_fault']

export async function POST(request) {
  try {
    // ── AUTH CHECK ──────────────────────────────────────────────────
    // Blocks unauthenticated webhook calls that would trigger AI + SMS costs
    const dhKey = request.headers.get('x-dh-key')
    if (dhKey !== process.env.DH_INTERNAL_KEY) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // ───────────────────────────────────────────────────────────────

    const body = await request.json()
    const { system, event_type, payload, client_id } = body

    if (!event_type || !client_id) {
      return Response.json({ error: 'Missing event_type or client_id' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Deduplication — skip if an identical event was logged in the last 60 seconds
    if (supabase) {
      const dedupReg = payload?.vehicle_reg || ''
      const since = new Date(Date.now() - 60 * 1000).toISOString()
      const { data: recent } = await supabase.from('webhook_log')
        .select('id')
        .eq('client_id', client_id)
        .eq('event_type', event_type)
        .eq('payload->>vehicle_reg', dedupReg)
        .gt('created_at', since)
        .limit(1)
      if (recent?.length > 0) {
        return Response.json({ success: true, deduplicated: true, existing_id: recent[0].id })
      }
    }
    const client = await getClientConfig(client_id)
    if (!client) {
      return Response.json({ error: 'Unknown client_id', client_id }, { status: 404 })
    }
    const systemPrompt = client.system_prompt || ''
    const opsPhone = client.contact_phone || null
    const simulated = !opsPhone

    const confirmedFinancial = extractPayloadFinancial(payload)
    const severity = determineEventSeverity(event_type, payload, confirmedFinancial)

    const needsConsigneeCall = DELAY_EVENTS.includes(event_type)
    const needsCarrierCall   = RECOVERY_EVENTS.includes(event_type)
    const vehicleReg         = payload?.vehicle_reg || ''
    const confirmedFin       = confirmedFinancial !== null ? confirmedFinancial : 0

    // ── AI PROMPT ─────────────────────────────────────────────────────────────
    // Actions schema is built dynamically — call actions only injected when relevant
    const callActionsSchema = needsConsigneeCall ? `,
    {
      "type": "call",
      "call_type": "consignee_delay_alert",
      "label": "Call [consignee name] — delay notification",
      "consignee_name": "exact site name from payload consignee field e.g. Tesco DC Donington",
      "consignee_phone": "phone number from CONSIGNEE CONTACTS in CLIENT CONTEXT matching consignee_name — blank if not found",
      "vehicle_reg": "${vehicleReg}",
      "delay_minutes": ${payload?.delay_minutes || 'null'},
      "revised_eta": "calculate revised ETA string e.g. 17:15 based on current time + delay",
      "delay_reason": "concise reason e.g. M62 congestion J26",
      "ops_callback_phone": "${opsPhone || ''}",
      "recipient": "consignee",
      "content": "",
      "priority": "immediate",
      "auto_approve": false,
      "financial_value": ${confirmedFin}
    }` : (needsCarrierCall ? `,
    {
      "type": "call",
      "call_type": "carrier_alert",
      "label": "Call [carrier name] — breakdown recovery",
      "carrier_name": "carrier name from PRIMARY CARRIER in CLIENT CONTEXT",
      "carrier_phone": "breakdown phone number from PRIMARY CARRIER in CLIENT CONTEXT",
      "vehicle_reg": "${vehicleReg}",
      "incident_description": "one sentence description of the incident for voice message",
      "ops_callback_phone": "${opsPhone || ''}",
      "recipient": "carrier",
      "content": "",
      "priority": "immediate",
      "auto_approve": false,
      "financial_value": ${confirmedFin}
    }` : '')

    const fullSystemPrompt = `You are DisruptionHub's autonomous UK logistics operations agent.
20 years HGV freight, cold chain, NHS supply, compliance experience.
Be direct. Give specific phone numbers, junction numbers, deadlines.

IMPORTANT: Return ONLY the JSON object below. No preamble. No markdown. No explanation. Start your response with { and end with }.

{
  "severity": "${severity}",
  "financial_impact": ${confirmedFin},
  "time_to_resolution": "string e.g. 2-4 hours",
  "affected_shipments": 1,
  "sections": {
    "assessment": "2-3 sentence plain text assessment",
    "immediate_actions": ["action 1", "action 2", "action 3"],
    "who_to_contact": "numbered contacts with phone numbers",
    "downstream_risks": "plain text"
  },
  "actions": [
    {
      "type": "send_sms",
      "label": "SHORT factual label — vehicle reg, event type, location only. Never ops instructions.",
      "recipient": "driver",
      "content": "driver-facing instruction — plain English, what they need to do",
      "priority": "immediate",
      "auto_approve": false,
      "financial_value": ${confirmedFin}
    }${callActionsSchema}
  ]
}

LABEL RULES — label must be SHORT and FACTUAL:
GOOD: "BN21 XKT delayed 45min — M62 J26 — Tesco DC at risk"
BAD: "Contact driver via cab phone and instruct reroute"
The label is shown to ops in an SMS and dashboard card. Keep it to one line, no instructions.

CALL ACTION RULES:
- For consignee_delay_alert: look up consignee_name in the CONSIGNEE CONTACTS section of CLIENT CONTEXT. Extract the matching phone number exactly as written.
- For carrier_alert: look up the breakdown phone from PRIMARY CARRIER in CLIENT CONTEXT.
- If a phone number is not found in CLIENT CONTEXT, leave consignee_phone or carrier_phone as an empty string — do not invent numbers.

severity must be "${severity}". financial_impact must be ${confirmedFinancial !== null ? confirmedFinancial : 'your conservative estimate based on the event'}.

CLIENT CONTEXT:
${systemPrompt}`

    let rawAIResponse = ''
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
      rawAIResponse = msg.content[0]?.text?.trim() || ''
      parsedResult = extractJSON(rawAIResponse)
      if (parsedResult && confirmedFinancial === null) {
        financialImpact = Math.min(parsedResult.financial_impact || 0, 50000)
      }
    } catch (aiErr) {
      console.error('AI error:', aiErr.message)
    }

    const analysisSummary = buildAnalysisSummary(parsedResult, event_type, severity, financialImpact)

    let logId = null
    if (supabase) {
      try {
        const { data: logRow } = await supabase
          .from('webhook_log')
          .insert({
            client_id, system_name: system || 'manual', event_type, payload, severity,
            financial_impact: financialImpact,
            financial_source: confirmedFinancial !== null ? 'payload' : 'ai_estimate',
            analysis: analysisSummary, sms_fired: false, simulated,
            created_at: new Date().toISOString()
          })
          .select('id')
          .single()
        logId = logRow?.id
      } catch (err) { console.error('webhook_log insert error:', err.message) }
    }

    const shouldSendSMS = ['HIGH', 'CRITICAL'].includes(severity)

    // ── WRITE APPROVALS + SEND ONE SMS PER ACTION ─────────────────────────────
    // Each action gets its own approval row AND its own targeted ops SMS
    // SMS 1 (driver action): "YES = notify driver of delay"
    // SMS 2 (call action):   "YES = call Tesco DC automatically"
    // Ops can approve or reject each independently
    const actionsToWrite = parsedResult?.actions?.length
      ? parsedResult.actions.slice(0, 4)
      : [{
          type: 'send_sms',
          label: `${severity} — ${event_type.replace(/_/g,' ')} · ${vehicleReg || 'unknown vehicle'}`,
          recipient: 'driver',
          content: analysisSummary.split('\n').slice(0,2).join(' '),
          priority: 'immediate',
          auto_approve: false,
          financial_value: financialImpact
        }]

    // Life-safety events — force the first action type to 'emergency' so the
    // ops SMS YES label reads as a life-safety dispatch, not "notify driver".
    // Claude's first action for panic_button tends to default to 'send_sms'.
    const LIFE_SAFETY_EVENTS = ['panic_button', 'impact_detected']
    if (LIFE_SAFETY_EVENTS.includes(event_type) && actionsToWrite[0]) {
      actionsToWrite[0] = { ...actionsToWrite[0], type: 'emergency' }
    }

    let approvalsWritten = 0
    let approvalsError = null
    let smsSent = false

    if (supabase && shouldSendSMS) {
      for (let i = 0; i < actionsToWrite.length; i++) {
        const action = actionsToWrite[i]

        // Write approval row first
        // NOTE: Supabase insert does NOT throw — always check { error } object
        const { error: approvalErr } = await supabase
          .from('approvals')
          .insert({
            client_id,
            action_type: action.type || 'send_sms',
            action_label: action.label || `${severity} alert — ${event_type.replace(/_/g,' ')}`,
            action_details: {
              vehicle_reg:        vehicleReg || null,
              event_type,
              system,
              source:             'webhook_inbound',
              recipient:          action.recipient,
              content:            action.content,
              payload,
              financial_impact:   financialImpact,
              ref:                payload?.job_id || payload?.booking_ref || null,
              call_type:          action.call_type          || null,
              consignee_name:     action.consignee_name     || null,
              consignee_phone:    action.consignee_phone    || null,
              carrier_phone:      action.carrier_phone      || null,
              carrier_name:       action.carrier_name       || null,
              delay_minutes:      action.delay_minutes       || null,
              revised_eta:        action.revised_eta         || null,
              delay_reason:       action.delay_reason        || null,
              incident_description: action.incident_description || null,
              ops_callback_phone: action.ops_callback_phone || opsPhone || null,
              severity
            },
            financial_value: action.financial_value || financialImpact || 0,
            status: 'pending',
            escalation_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            created_at: new Date().toISOString()
          })

        if (approvalErr) {
          approvalsError = approvalErr.message
          console.error('approvals insert error:', approvalErr.message, approvalErr.code)
          continue
        }

        approvalsWritten++

        // Only SMS the FIRST action immediately
        // Subsequent actions are queued as pending — their SMS fires after the first is executed
        // This gives ops a sequential decision flow rather than simultaneous messages
        if (i === 0 && opsPhone && !simulated) {
          const smsBody = buildActionSMS(event_type, payload, severity, financialImpact, action)
          const sent = await sendOpsSMS(opsPhone, smsBody)
          if (sent) smsSent = true
        }
      }

      if (logId) {
        try { await supabase.from('webhook_log').update({ sms_fired: smsSent }).eq('id', logId) } catch {}
      }
    }

    // ── STORE LAST KNOWN LOCATION ────────────────────────────────────────────
    // Pilot GPS strategy: store last known position from webhook payload
    // Real Webfleet GPS integration comes when client connects their account
    const payloadLocation = payload?.location || payload?.current_location || payload?.current_position || null
    if (supabase && vehicleReg && payloadLocation) {
      try {
        await supabase
          .from('driver_progress')
          .update({ last_known_location: payloadLocation, updated_at: new Date().toISOString() })
          .eq('vehicle_reg', vehicleReg)
          .not('status', 'eq', 'completed')
      } catch (e) {
        console.log('[inbound] last_known_location update skipped:', e.message)
      }
    }

    return Response.json({
      success: true, severity, financial_impact: financialImpact,
      financial_source: confirmedFinancial !== null ? 'payload' : 'ai_estimate',
      sms_sent: smsSent, simulated, analysis: analysisSummary,
      event_type, vehicle_reg: vehicleReg,
      actions_queued: parsedResult?.actions?.length || 0,
      approvals_written: approvalsWritten,
      approvals_error: approvalsError || undefined
    })

  } catch (err) {
    console.error('Inbound webhook error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')
    const limit = parseInt(searchParams.get('limit') || '30')
    const supabase = getSupabase()
    if (!supabase) return Response.json({ logs: [] })
    const { data, error } = await supabase
      .from('webhook_log')
      .select('id, system_name, event_type, severity, financial_impact, financial_source, sms_fired, simulated, payload, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return Response.json({ logs: data || [] })
  } catch (err) {
    return Response.json({ error: err.message, logs: [] }, { status: 500 })
  }
}
