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

export async function POST(request) {
  try {
    const body = await request.json()
    const {
      client_id,
      driver_name,
      vehicle_reg,
      ref,
      resolution,
      location_description,
      route,
      sla_window,
      original_issue,
    } = body

    const db = getDB()
    let contactPhone = null
    let contactName = 'Ops Manager'

    // Get client contact for SMS
    // For demo client — fall back to pearson-haulage contact so SMS always fires
    if (db && client_id) {
      const lookupId = client_id === 'demo' ? 'pearson-haulage' : client_id
      const { data } = await db
        .from('clients')
        .select('contact_phone, contact_name')
        .eq('id', lookupId)
        .single()
      if (data) {
        contactPhone = data.contact_phone
        contactName = data.contact_name || 'Ops Manager'
      }
    }

    // Quick Haiku analysis — revised ETA and SLA status
    const prompt = `Driver ${driver_name} (${vehicle_reg}) has resolved an issue and is back on track.
Resolution: ${resolution}
Current location: ${location_description || 'not confirmed'}
Route: ${route || 'unknown'}
SLA slot: ${sla_window || 'unknown'}
Original issue type: ${original_issue || 'unknown'}

In one sentence: give a revised ETA with 1.5x buffer applied, and state in plain English whether the SLA is still achievable. Then one sentence on what to tell the customer if needed.`

    let revisedEta = ''
    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      })
      revisedEta = response.content[0]?.text?.trim() || ''
    } catch { /* non-fatal */ }

    // Update incident in Supabase as resolved
    if (db) {
      // Log resolution event to incidents
      await db.from('incidents').insert({
        client_id,
        user_input: `RESOLVED: ${resolution} — ${driver_name} (${vehicle_reg}) — ${location_description || ''}`,
        ai_response: revisedEta,
        severity: 'LOW',
        financial_impact: 0,
        ref: ref || 'DRIVER-RESOLVE'
      })

      // Update any pending approvals for this vehicle to resolved
      if (ref) {
        await db.from('approvals')
          .update({ status: 'resolved' })
          .eq('client_id', client_id)
          .eq('status', 'pending')
          .like('action_details->>ref', ref)
      }

      // Insert a visible resolve record into approvals so ops dashboard shows it
      await db.from('approvals').insert({
        client_id,
        action_type: 'notify',
        action_label: `✅ ${vehicle_reg} — ${driver_name} back on track · ${resolution}${revisedEta ? ' · ' + revisedEta.substring(0, 100) : ''}`,
        action_details: { source: 'driver_resolved', vehicle_reg, driver_name, ref, resolution, revised_eta: revisedEta },
        financial_value: 0,
        status: 'executed',
        approved_by: 'driver',
        executed_at: new Date().toISOString()
      })
    }

    // SMS ops manager
    if (contactPhone) {
      const smsBody = `✅ DH RESOLVED — ${vehicle_reg}\n${resolution}\n${revisedEta ? revisedEta.substring(0, 80) : 'Back on track.'}`
      await sendSMS(contactPhone, smsBody).catch(() => {})
    }

    return Response.json({
      success: true,
      revised_eta: revisedEta,
      sms_sent: !!contactPhone
    })

  } catch (error) {
    console.error('Driver resolve error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
