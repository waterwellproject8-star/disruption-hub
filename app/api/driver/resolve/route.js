import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { sendSMS } from '../../../../lib/twilio.js'
import { fireCallbackIfPartnerEvent } from '../../../../lib/fireCallback.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

const METHOD_PHRASES = {
  driver_fixed:        'fixed roadside by driver',
  recovery_fixed:      'fixed by recovery engineer',
  towed:               'vehicle towed to depot',
  other_resolved:      'resolved',
  driver_ok:           'driver OK, back on shift',
  driver_unwell_cover: 'driver unwell — replacement needed',
  false_alarm:         'false alarm',
  other_medical:       'medical issue resolved'
}

const MEDICAL_METHODS = ['driver_ok', 'driver_unwell_cover', 'false_alarm', 'other_medical']

export async function POST(request) {
  try {
    const body = await request.json()
    let {
      client_id,
      driver_name,
      vehicle_reg,
      ref,
      resolution,
      resolution_method,
      location_description,
      route,
      sla_window,
      original_issue,
    } = body
    if (client_id) client_id = client_id.toLowerCase().trim()
    if (vehicle_reg) vehicle_reg = vehicle_reg.toUpperCase().trim()

    const db = getDB()
    let contactPhone = null
    let contactName = 'Ops Manager'

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

    if (db) {
      const { error: incidentErr } = await db.from('incidents').insert({
        client_id,
        user_input: `RESOLVED: ${resolution} — ${driver_name} (${vehicle_reg}) — ${location_description || ''}`,
        ai_response: revisedEta,
        severity: 'LOW',
        financial_impact: 0,
        ref: ref || 'DRIVER-RESOLVE'
      })
      if (incidentErr) console.error('resolve incident insert:', incidentErr.message, incidentErr.code)

      if (ref) {
        const { error: pendingErr } = await db.from('approvals')
          .update({ status: 'resolved' })
          .eq('client_id', client_id)
          .eq('status', 'pending')
          .eq('action_details->>ref', ref)
        if (pendingErr) console.error('resolve pending update:', pendingErr.message, pendingErr.code)
      }

      if (vehicle_reg) {
        const twoHoursAgo = new Date(Date.now() - 7200000).toISOString()
        const { error: cascadeErr } = await db.from('approvals')
          .update({ status: 'expired' })
          .eq('client_id', client_id)
          .eq('status', 'pending')
          .eq('action_type', 'call')
          .gte('created_at', twoHoursAgo)
          .filter('action_details->>vehicle_reg', 'eq', vehicle_reg)
        if (cascadeErr) console.error('resolve cascade cancel:', cascadeErr.message, cascadeErr.code)
      }

      // Update webhook_log directly — covers both driver_pwa and api_v1 rows
      if (ref && vehicle_reg) {
        try {
          const { error: wlErr } = await db.from('webhook_log')
            .update({
              resolved_at: new Date().toISOString(),
              resolution_method: resolution_method || 'other_resolved'
            })
            .eq('client_id', client_id)
            .filter('payload->>vehicle_reg', 'eq', vehicle_reg)
            .filter('payload->>ref', 'eq', ref)
            .is('resolved_at', null)
          if (wlErr) console.error('[resolve] webhook_log update error:', wlErr.message)
        } catch (e) {
          console.error('[resolve] webhook_log update threw:', e?.message)
        }
      }

      if (ref) {
        fireCallbackIfPartnerEvent({ ref, client_id, resolution_method: resolution_method || 'driver', db })
          .catch(err => console.error('[driver/resolve] callback helper error:', err))
      }

      const { error: resolveErr } = await db.from('approvals').insert({
        client_id,
        action_type: 'notify',
        action_label: `✅ ${vehicle_reg} — ${driver_name} back on track · ${resolution}${revisedEta ? ' · ' + revisedEta.substring(0, 100) : ''}`,
        action_details: { source: 'driver_resolved', vehicle_reg, driver_name, ref, resolution, resolution_method: resolution_method || null, revised_eta: revisedEta },
        financial_value: 0,
        status: 'executed',
        approved_by: 'driver',
        executed_at: new Date().toISOString()
      })
      if (resolveErr) console.error('resolve approval insert:', resolveErr.message, resolveErr.code)
    }

    if (contactPhone) {
      const methodPhrase = METHOD_PHRASES[resolution_method] || 'resolved'
      const isMedical = MEDICAL_METHODS.includes(resolution_method)
      const alertType = isMedical ? 'medical alert' : 'breakdown'
      const smsBody = `DisruptionHub — Resolved.\n${vehicle_reg}: ${alertType} ${methodPhrase}.\n${driver_name || 'Driver'} is back on track.${ref ? `\nRef: ${ref}` : ''}`
      await sendSMS(contactPhone, smsBody).catch(err => console.error('[resolve] sendSMS failed:', err?.message))
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
