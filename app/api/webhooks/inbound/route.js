import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// ── EXTRACT REAL FINANCIAL VALUE FROM PAYLOAD ─────────────────────────────────
function extractPayloadFinancial(payload) {
  if (!payload) return null
  if (payload.penalty_gbp      && payload.penalty_gbp > 0)      return Number(payload.penalty_gbp)
  if (payload.total_charge_gbp && payload.total_charge_gbp > 0) return Number(payload.total_charge_gbp)
  if (payload.cargo_value_gbp  && payload.cargo_value_gbp > 0)  return Number(payload.cargo_value_gbp)
  if (payload.value_gbp        && payload.value_gbp > 0)         return Number(payload.value_gbp)
  if (payload.daily_charge_gbp && payload.daily_charge_gbp > 0) return Number(payload.daily_charge_gbp) * 5
  return null
}

// ── RULES-BASED SEVERITY ──────────────────────────────────────────────────────
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

  if (confirmedFinancial && confirmedFinancial >= 5000) return 'HIGH'

  if (eventType === 'failed_delivery') {
    const consignee = (payload?.consignee || '').toLowerCase()
    if (consignee.includes('nhs') || consignee.includes('hospital') || consignee.includes('pharma')) return 'CRITICAL'
    return 'HIGH'
  }

  const highSeverity = [
    'door_open_transit', 'geofence_breach', 'cargo_theft', 'job_cancelled',
    'driver_change', 'engine_fault', 'fuel_critical', 'collection_no_show',
    'border_doc_failure', 'ulez_entry', 'night_out_required', 'route_deviation'
  ]
  if (highSeverity.includes(eventType)) return 'HIGH'

  if (eventType === 'detention_charge' && confirmedFinancial && confirmedFinancial > 100) return 'HIGH'

  const lowSeverity = ['harsh_braking', 'harsh_acceleration', 'overspeed', 'idle_excess']
  if (lowSeverity.includes(eventType)) return 'LOW'

  return 'MEDIUM'
}

// ── PARSE AI JSON — ROBUST EXTRACTION ────────────────────────────────────────
// FIX 1: AI sometimes prepends text e.g. "CRITICAL\n```json\n{".
// Extract by finding first { and last } — ignores any prefix or suffix text.
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

// ── BUILD READABLE ANALYSIS SUMMARY ──────────────────────────────────────────
// FIX 2: Store plain-text markdown summary not raw JSON.
// AgentResponse renders this cleanly — no JSON fences visible to user.
function buildAnalysisSummary(parsed, eventType, severity, financialImpact) {
  if (!parsed) return `**${severity}** — ${eventType.replace(/_/g,' ')}\n\nAI analysis unavailable.`

  const parts = []

  if (parsed.sections?.assessment) {
    parts.push(`## Assessment\n${parsed.sections.assessment}`)
  }

  if (parsed.sections?.immediate_actions?.length) {
    parts.push(`## Immediate Actions\n${parsed.sections.immediate_actions.map((a, i) => `${i+1}. ${a}`).join('\n')}`)
  }

  if (parsed.sections?.who_to_contact) {
    parts.push(`## Who to Contact\n${parsed.sections.who_to_contact}`)
  }

  if (parsed.sections?.downstream_risks) {
    parts.push(`## Downstream Risks\n${parsed.sections.downstream_risks}`)
  }

  if (financialImpact > 0) {
    parts.push(`**Financial exposure: £${financialImpact.toLocaleString()}** · Time to resolution: ${parsed.time_to_resolution || 'unknown'}`)
  }

  return parts.join('\n\n') || `**${severity}** — ${eventType.replace(/_/g,' ')}`
}

// ── GET CLIENT CONFIG ─────────────────────────────────────────────────────────
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

// ── SEND OPS SMS ──────────────────────────────────────────────────────────────
async function sendOpsSMS(toPhone, body) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return false
  const { default: twilio } = await import('twilio')
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  try {
    await client.messages.create({
      body,
      // FIX 3: match Vercel env var name, with fallbacks
      from: process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER || '+447700139349',
      to: toPhone
    })
    return true
  } catch (err) {
    console.error('Twilio SMS error:', err.message)
    return false
  }
}

// ── BUILD OPS SMS BODY ────────────────────────────────────────────────────────
function buildOpsSMS(eventType, payload, severity, financialImpact, parsedResult) {
  const reg = payload?.vehicle_reg || 'Unknown'
  const location = payload?.location || payload?.current_location || ''
  const driver = payload?.driver_name || ''
  const sevEmoji = severity === 'CRITICAL' ? '🔴' : severity === 'HIGH' ? '🟠' : '🟡'
  const eventLabel = eventType.replace(/_/g, ' ').toUpperCase()

  const firstAction = parsedResult?.sections?.immediate_actions?.[0] || ''

  const parts = [
    `${sevEmoji} DISRUPTIONHUB — ${severity}`,
    `${eventLabel} · ${reg}${driver ? ` · ${driver}` : ''}`,
    location ? `Location: ${location}` : '',
    financialImpact > 0 ? `Exposure: £${financialImpact.toLocaleString()}` : '',
    firstAction ? `Action: ${firstAction.substring(0, 100)}` : '',
    'Reply YES to execute · NO to dismiss · OPEN for dashboard'
  ].filter(Boolean)

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

    // 1. Client config
    const client = await getClientConfig(client_id)
    const systemPrompt = client?.system_prompt || ''
    const opsPhone = client?.contact_phone || null
    const simulated = !opsPhone

    // 2. Financial from payload
    const confirmedFinancial = extractPayloadFinancial(payload)

    // 3. Severity from rules
    const severity = determineEventSeverity(event_type, payload, confirmedFinancial)

    // 4. AI prompt — instructs JSON only, no preamble
    const fullSystemPrompt = `You are DisruptionHub's autonomous UK logistics operations agent.
20 years HGV freight, cold chain, NHS supply, compliance experience.
Be direct. Give specific phone numbers, junction numbers, deadlines.

IMPORTANT: Return ONLY the JSON object below. No preamble. No markdown. No explanation. Start your response with { and end with }.

{
  "severity": "${severity}",
  "financial_impact": ${confirmedFinancial !== null ? confirmedFinancial : 0},
  "time_to_resolution": "string e.g. 2-4 hours",
  "affected_shipments": 1,
  "sections": {
    "assessment": "2-3 sentence plain text",
    "immediate_actions": ["action 1", "action 2", "action 3"],
    "who_to_contact": "numbered contacts with phone numbers",
    "downstream_risks": "plain text"
  },
  "actions": [
    {
      "type": "send_sms",
      "label": "string",
      "recipient": "string",
      "content": "string",
      "priority": "immediate",
      "auto_approve": false,
      "financial_value": ${confirmedFinancial !== null ? confirmedFinancial : 0}
    }
  ]
}

RULES: severity must be "${severity}". financial_impact must be ${confirmedFinancial !== null ? confirmedFinancial : 'your conservative estimate'}.

CLIENT CONTEXT:
${systemPrompt}`

    // 5. Call AI
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

    // 6. Build clean analysis summary
    const analysisSummary = buildAnalysisSummary(parsedResult, event_type, severity, financialImpact)

    // 7. Log to webhook_log
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
            financial_source: confirmedFinancial !== null ? 'payload' : 'ai_estimate',
            analysis: analysisSummary,
            sms_fired: false,
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

    // 8. Send SMS if HIGH/CRITICAL
    let smsSent = false
    const shouldSendSMS = ['HIGH', 'CRITICAL'].includes(severity)

    if (shouldSendSMS && opsPhone && !simulated) {
      const smsBody = buildOpsSMS(event_type, payload, severity, financialImpact, parsedResult)
      smsSent = await sendOpsSMS(opsPhone, smsBody)
      if (supabase && logId) {
        try {
          await supabase.from('webhook_log').update({ sms_fired: smsSent }).eq('id', logId)
        } catch {}
      }
    }

    // 9. Write approvals
    const vehicleReg = payload?.vehicle_reg || null
    if (supabase && shouldSendSMS && parsedResult?.actions?.length) {
      try {
        for (const action of parsedResult.actions.slice(0, 3)) {
          await supabase.from('approvals').insert({
            client_id,
            action_type: action.type || 'notify',
            action_label: action.label || 'AI recommended action',
            action_details: {
              vehicle_reg: vehicleReg,
              event_type,
              system,
              recipient: action.recipient,
              content: action.content,
              payload,
              financial_impact: financialImpact
            },
            financial_value: action.financial_value || financialImpact || 0,
            requires_approval: true,
            status: 'pending',
            created_at: new Date().toISOString()
          })
        }
      } catch (err) {
        console.error('approvals insert error:', err.message)
      }
    }

    // 10. Return
    return Response.json({
      success: true,
      severity,
      financial_impact: financialImpact,
      financial_source: confirmedFinancial !== null ? 'payload' : 'ai_estimate',
      sms_sent: smsSent,
      simulated,
      analysis: analysisSummary,
      event_type,
      vehicle_reg: vehicleReg,
      actions_queued: parsedResult?.actions?.length || 0
    })

  } catch (err) {
    console.error('Inbound webhook error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}

// ── GET: Webhook audit log ────────────────────────────────────────────────────
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
