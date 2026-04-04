import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

async function sendSMSAlert(to, message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER
  if (!accountSid || !authToken || !from || accountSid.includes('placeholder')) return false
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ To: to, From: from, Body: message })
    })
    return res.ok
  } catch { return false }
}

// POST /api/driver/alert
// Called when driver submits an issue report from the /driver app
export async function POST(request) {
  try {
    const body = await request.json()
    const {
      client_id,
      driver_name,
      vehicle_reg,
      issue_description,
      ref,
      latitude,
      longitude,
      location_description
    } = body

    if (!issue_description) {
      return Response.json({ error: 'issue_description required' }, { status: 400 })
    }

    // Build location context
    const locationStr = latitude && longitude
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

    // Get client system prompt from Supabase
    let systemPrompt = null
    const db = getDB()
    if (db && client_id) {
      const { data } = await db.from('clients').select('system_prompt, contact_phone, contact_name').eq('id', client_id).single()
      if (data) {
        systemPrompt = data.system_prompt
        // Store contact details for SMS alert
        body._contact_phone = data.contact_phone
        body._contact_name = data.contact_name
      }
    }

    // Run the AI analysis
    const messages = [{ role: 'user', content: analysisPrompt }]
    let fullResponse = ''

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: systemPrompt || undefined,
      messages
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        fullResponse += chunk.delta.text
      }
    }

    // Determine severity
    const sevMatch = fullResponse.match(/\b(CRITICAL|HIGH|MEDIUM|LOW)\b/)
    const severity = sevMatch?.[1] || 'HIGH'
    const moneyMatch = fullResponse.match(/£([\d,]+)/)
    const financialImpact = moneyMatch ? parseInt(moneyMatch[1].replace(/,/g, '')) : 0

    // Save to incidents table
    if (db) {
      await db.from('incidents').insert({
        client_id,
        user_input: analysisPrompt,
        ai_response: fullResponse,
        severity,
        financial_impact: financialImpact,
        ref: ref || 'DRIVER-ALERT'
      })

      // Extract carrier details from system prompt for approval actions
      function extractCarrierPhone(systemPrompt, responseText) {
        if (!systemPrompt) return null
        // Look for 24hr numbers in system prompt e.g. "0800 111 2222"
        const phones = systemPrompt.match(/0800[\s\d]{8,12}|07[\d\s]{9,11}/g)
        return phones?.[0]?.replace(/\s/g,'') || null
      }

      function extractCarrierName(responseText) {
        const match = responseText.match(/(?:call|contact|notify)\s+([A-Z][A-Za-z\s]+(?:UK|Express|Logistics|Freight|Transport))/i)
        return match?.[1]?.trim() || null
      }

      // Create a pending approval for the first recommended action
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

        const carrierPhone = extractCarrierPhone(systemPrompt, fullResponse)
        const carrierName = extractCarrierName(fullResponse)

        await db.from('approvals').insert({
          client_id,
          action_type: detectedType,
          action_label: firstAction.substring(0, 200),
          action_details: {
            vehicle_reg: vehicle_reg,
            ref: ref || 'DRIVER-ALERT',
            carrier_name: carrierName,
            carrier_phone: carrierPhone,
            driver_phone: null, // ops manager to add if needed
            script: firstAction,
            source: 'driver_alert'
          },
          financial_value: financialImpact,
          status: 'pending'
        })
      }
    }

    // Extract the first specific action from the analysis
    function extractFirstAction(text) {
      const lines = text.split('\n')
      for (const line of lines) {
        const match = line.match(/^1\.?\s+(.{20,120})/)
        if (match) {
          // Strip markdown bold markers and trim
          return match[1].replace(/\*\*/g,'').split('—')[0].trim().substring(0, 100)
        }
      }
      return null
    }

    const firstAction = extractFirstAction(fullResponse)
    const actionLine = firstAction
      ? `Recommended action 1: ${firstAction}`
      : 'Full action plan ready in dashboard'

    // Send SMS alert to ops manager for HIGH/CRITICAL
    if ((severity === 'CRITICAL' || severity === 'HIGH') && body._contact_phone) {
      const smsBody = `DisruptionHub ${severity} — ${vehicle_reg}\n${issue_description.substring(0, 60)}\nExposure: £${financialImpact.toLocaleString()}\n\n${actionLine}\n\nReply YES to execute this action, NO to reject, or OPEN to review full plan.`
      await sendSMSAlert(body._contact_phone, smsBody)
    }

    return Response.json({
      success: true,
      severity,
      financial_impact: financialImpact,
      analysis: fullResponse,
      sms_sent: !!(body._contact_phone && (severity === 'CRITICAL' || severity === 'HIGH'))
    })

  } catch (e) {
    console.error('Driver alert error:', e.message)
    return Response.json({ error: e.message }, { status: 500 })
  }
}
