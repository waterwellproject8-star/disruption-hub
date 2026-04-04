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

const DRIVER_ALERT_SYSTEM = `You are a Senior Logistics Crisis Director with 25 years of experience across UK and European supply chains. You have personally managed thousands of live disruptions — port closures, cold chain failures, driver crises, supplier collapses, multi-vehicle cascades.

You are direct. You prioritise by financial impact and urgency. You give the ops team the exact decision they need, with the owner and deadline for each action.

When given a driver alert, respond with this structure:

## DISRUPTION ASSESSMENT
- Severity: [CRITICAL / HIGH / MEDIUM / LOW]
- Estimated Financial Impact: £[X,XXX]
- Affected Shipments: [number]
- Time to Resolution: [X hours/days]

## IMMEDIATE ACTIONS (Do these NOW)
1. [Specific action — named owner — specific deadline]
2. [Specific action — named owner — specific deadline]
3. [Specific action — named owner — specific deadline]

## REROUTING / REORDER RECOMMENDATIONS
[Specific alternatives with cost comparisons]

## WHO TO CONTACT
[Carrier / supplier / customer — with exact message to send]

## DOWNSTREAM RISKS
[What breaks next if unresolved — cascade failures]

Four rules that always apply:
1. Never invent location names not stated in the scenario — if uncertain say "nearest [facility type] — verify via Google Maps before dispatching"
2. Apply 1.5x buffer to all UK road time estimates and state it explicitly
3. If a driver is unwell or injured — 999 is the first call, not the ops manager
4. If location was provided by a driver report (not ops manager), always include as Action 1: "Confirm exact vehicle location with driver — ask for the junction number on the last gantry sign they passed, not their estimated position." Do not issue reroute instructions until position is confirmed.

Temperature rules for cold chain cargo:
- Chilled (0–5°C): alarm above 5°C = cold chain integrity risk. State this explicitly.
- Frozen (−18°C to −22°C): alarm above −15°C = critical. Cargo may be unsalvageable.
- Pharmaceutical chilled: any reading above 5°C must be disclosed to the consignee pharmacist before delivery.

Always give specific numbers, timeframes, and named actions.`

function extractFirstAction(text) {
  const lines = text.split('\n')
  for (const line of lines) {
    const match = line.match(/^1\.?\s+(.{20,120})/)
    if (match) {
      return match[1].replace(/\*\*/g, '').split('—')[0].trim().substring(0, 100)
    }
  }
  return null
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
      latitude,
      longitude,
      location_description,
      ref
    } = body

    if (!issue_description) {
      return Response.json({ error: 'issue_description is required' }, { status: 400 })
    }

    // Build location string
    const locationStr = (latitude && longitude)
      ? `GPS coordinates: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}. Nearest known location: ${location_description || 'verify via maps'}`
      : location_description || 'Location not confirmed — verify with driver before rerouting'

    // Build the analysis prompt
    const analysisPrompt = `DRIVER ALERT — AUTO-TRIGGERED
Driver: ${driver_name || 'Unknown'}
Vehicle: ${vehicle_reg || 'Unknown'}
Reference: ${ref || 'No ref'}
Location: ${locationStr}

Driver report: "${issue_description}"

Provide immediate disruption analysis and action plan.`

    // Get client details from Supabase
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

    // Run AI analysis
    const finalSystem = systemPrompt
      ? `${DRIVER_ALERT_SYSTEM}\n\nCLIENT CONTEXT:\n${systemPrompt}`
      : DRIVER_ALERT_SYSTEM

    const messages = [{ role: 'user', content: analysisPrompt }]
    let fullResponse = ''

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: finalSystem,
      messages
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        fullResponse += chunk.delta.text
      }
    }

    // Determine severity and financial impact
    const sevMatch = fullResponse.match(/\b(CRITICAL|HIGH|MEDIUM|LOW)\b/)
    const severity = sevMatch?.[1] || 'HIGH'
    const moneyMatch = fullResponse.match(/£([\d,]+)/)
    const financialImpact = moneyMatch ? parseInt(moneyMatch[1].replace(/,/g, '')) : 0

    // Extract first action BEFORE db block to avoid temporal dead zone
    const firstAction = extractFirstAction(fullResponse)

    // Save to Supabase
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

        const carrierPhone = extractCarrierPhone(systemPrompt)
        const carrierName = extractCarrierName(fullResponse)

        await db.from('approvals').insert({
          client_id,
          action_type: detectedType,
          action_label: firstAction.substring(0, 200),
          action_details: {
            vehicle_reg,
            ref: ref || 'DRIVER-ALERT',
            carrier_name: carrierName,
            carrier_phone: carrierPhone,
            driver_phone: null,
            script: firstAction,
            source: 'driver_alert'
          },
          financial_value: financialImpact,
          status: 'pending'
        })
      }
    }

    // Send SMS alert to ops manager for HIGH/CRITICAL
    let smsSent = false
    if ((severity === 'CRITICAL' || severity === 'HIGH') && contactPhone) {
      const actionLine = firstAction
        ? `Action 1: ${firstAction}`
        : 'Full action plan ready in dashboard'

      const smsBody = `DisruptionHub ${severity} — ${vehicle_reg || 'Vehicle'}\n${issue_description.substring(0, 60)}\nExposure: £${financialImpact.toLocaleString()}\n\n${actionLine}\n\nReply YES to execute, NO to reject, OPEN to review.`

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
