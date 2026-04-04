import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { sendSMS } from '../../../../lib/twilio.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

const DRIVER_ALERT_SYSTEM = `You are a Senior Logistics Crisis Director. You are direct and prioritise by financial impact and urgency.

When given a driver alert, respond with this exact structure:

## DISRUPTION ASSESSMENT
- Severity: [CRITICAL / HIGH / MEDIUM / LOW]
- Estimated Financial Impact: £[X,XXX]
- Affected Shipments: [number]
- Time to Resolution: [X hours]

## IMMEDIATE ACTIONS (Do these NOW)
1. [Specific action — named owner — specific deadline]
2. [Specific action — named owner — specific deadline]
3. [Specific action — named owner — specific deadline]

## WHO TO CONTACT
[Carrier / customer — with exact message to send]

## DOWNSTREAM RISKS
[What breaks next if unresolved]

Rules:
1. Never invent location names — if uncertain say "verify via Google Maps before dispatching"
2. Apply 1.5x buffer to all UK road time estimates
3. If driver is injured — 999 is the first call
4. If location is driver-reported, Action 1 must be: confirm exact vehicle location with driver

Temperature rules:
- Chilled (0–5°C): alarm above 5°C = cold chain risk
- Frozen (−18°C to −22°C): alarm above −15°C = critical
- Pharmaceutical: disclose any breach to consignee before delivery`

function extractFirstAction(text) {
  const lines = text.split('\n')
  const skipPatterns = /confirm.*location|exact.*vehicle.*location|verify.*position|location.*unconfirmed/i
  
  // Try to get action 2 or 3 if action 1 is just the location-confirm boilerplate
  const actions = []
  for (const line of lines) {
    const match = line.match(/^([123])\.?\s+(.{15,120})/)
    if (match) {
      const action = match[2].replace(/\*\*/g, '').split('—')[0].trim().substring(0, 100)
      actions.push(action)
    }
  }
  
  // Return first non-boilerplate action
  for (const action of actions) {
    if (!skipPatterns.test(action)) return action
  }
  
  // Fall back to first action even if boilerplate
  return actions[0] || null
}

function extractCarrierPhone(systemPrompt) {
  if (!systemPrompt) return null
  const phones = systemPrompt.match(/0800[\s\d]{8,12}|07[\d\s]{9,11}/g)
  return phones?.[0]?.replace(/\s/g, '') || null
}

function extractCarrierName(responseText) {
  const match = responseText.match(/(?:call|contact|notify)\s+([A-Z][A-Za-z\s]+(?:UK|Express|Logistics|Freight|Transport))/i)
  return match?.[1]?.trim() || null
}

export async function POST(request) {
  try {
    const body = await request.json()
    const {
      client_id,
      driver_name,
      vehicle_reg,
      issue_description,
      human_description,
      latitude,
      longitude,
      location_description,
      ref
    } = body

    if (!issue_description) {
      return Response.json({ error: 'issue_description is required' }, { status: 400 })
    }

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
    const severity = sevMatch?.[1] || 'HIGH'
    const moneyMatch = fullResponse.match(/£([\d,]+)/)
    const financialImpact = moneyMatch ? parseInt(moneyMatch[1].replace(/,/g, '')) : 0

    // Extract first action BEFORE db block — fixes temporal dead zone bug
    const firstAction = extractFirstAction(fullResponse)

    if (db) {
      await db.from('incidents').insert({
        client_id,
        user_input: analysisPrompt,
        ai_response: fullResponse,
        severity,
        financial_impact: financialImpact,
        ref: ref || 'DRIVER-ALERT'
      })

      if (firstAction && (severity === 'CRITICAL' || severity === 'HIGH')) {
        const actionTypeMap = {
          call: /call|phone|contact|ring/i,
          sms: /send|message|text|whatsapp|notify driver/i,
          reroute: /reroute|re-route|divert|exit|junction/i,
          dispatch: /dispatch|relief|vehicle|swap/i,
          emergency: /999|police|ambulance|emergency service/i,
        }

        let detectedType = 'call'
        for (const [type, pattern] of Object.entries(actionTypeMap)) {
          if (pattern.test(firstAction)) { detectedType = type; break }
        }

        await db.from('approvals').insert({
          client_id,
          action_type: detectedType,
          action_label: firstAction.substring(0, 200),
          action_details: {
            vehicle_reg,
            ref: ref || 'DRIVER-ALERT',
            carrier_name: extractCarrierName(fullResponse),
            carrier_phone: extractCarrierPhone(systemPrompt),
            driver_phone: null,
            script: firstAction,
            source: 'driver_alert'
          },
          financial_value: financialImpact,
          status: 'pending'
        })
      }
    }

    let smsSent = false
    if ((severity === 'CRITICAL' || severity === 'HIGH') && contactPhone) {
      // Use what the driver actually typed, not the system prompt
      const shortDesc = (human_description || location_description || 'Driver alert')
        .substring(0, 50)
        .replace(/\n/g, ' ')
      const actionLine = firstAction ? firstAction.substring(0, 60) : 'See dashboard'
      const smsBody = `DH ${severity} ${vehicle_reg || ''}\n${shortDesc}\n£${financialImpact.toLocaleString()} ${actionLine}\nYES/NO/OPEN`
      const result = await sendSMS(contactPhone, smsBody)
      smsSent = result.success || false
    }

    return Response.json({
      success: true,
      severity,
      financial_impact: financialImpact,
      analysis: fullResponse,
      sms_sent: smsSent
    })

  } catch (error) {
    console.error('Driver alert error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
