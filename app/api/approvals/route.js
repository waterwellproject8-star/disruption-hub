import { createClient } from '@supabase/supabase-js'
import { sendSMS, makeCall, extractPhoneNumber, buildCarrierVoiceMessage, buildDriverInstructionSMS } from '../../../lib/twilio.js'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

// POST /api/approvals
// Called from dashboard SEND button — must execute same Phase 2/3 logic as SMS YES
export async function POST(request) {
  try {
    const { approval_id, action, approved_by = 'ops_manager' } = await request.json()

    if (!approval_id) {
      return Response.json({ error: 'approval_id required' }, { status: 400 })
    }

    const db = getDB()
    if (!db) return Response.json({ error: 'DB not configured' }, { status: 500 })

    // Reject action
    if (action === 'reject') {
      await db.from('approvals').update({
        status: 'rejected',
        approved_by,
        approved_at: new Date().toISOString()
      }).eq('id', approval_id)
      return Response.json({ success: true, action: 'rejected' })
    }

    // Approve — fetch full approval details
    const { data: approval } = await db.from('approvals')
      .select('*')
      .eq('id', approval_id)
      .single()

    if (!approval) return Response.json({ error: 'Approval not found' }, { status: 404 })

    // Check not already executed
    if (approval.status === 'executed') {
      return Response.json({ success: true, action: 'already_executed' })
    }

    // Mark as executed
    await db.from('approvals').update({
      status: 'executed',
      approved_by,
      approved_at: new Date().toISOString(),
      executed_at: new Date().toISOString()
    }).eq('id', approval_id)

    const actionType = approval.action_type || ''
    const actionLabel = approval.action_label || ''
    const details = approval.action_details || {}
    const clientId = approval.client_id

    // Get client for contact details
    const { data: client } = await db.from('clients')
      .select('contact_name, contact_phone, system_prompt')
      .eq('id', clientId)
      .single()

    // ── PHASE 2: SMS instruction to driver ──────────────────────────────────
    if (actionType === 'sms' || actionType === 'reroute') {
      const driverPhone = details.driver_phone
      if (driverPhone) {
        const smsText = buildDriverInstructionSMS({
          action: actionLabel,
          carrierName: details.carrier_name,
          carrierPhone: details.carrier_phone,
          script: details.script,
          ref: details.ref
        })
        const result = await sendSMS(driverPhone, smsText)
        return Response.json({ success: true, action: 'executed', driver_notified: result.success, phase: 2 })
      }
      return Response.json({ success: true, action: 'executed', driver_notified: false, note: 'No driver phone on file' })
    }

    // ── DISPATCH: Send driver confirmation SMS ──────────────────────────────
    if (actionType === 'dispatch') {
      const driverPhone = details.driver_phone
      if (driverPhone) {
        const dispatchMsg = `DisruptionHub OPS UPDATE${details.ref ? ` — ${details.ref}` : ''}\n\nRecovery vehicle dispatched to your location.\nStay with vehicle. Keep hazards on.\nOps monitoring. Call ops if situation changes.`
        const result = await sendSMS(driverPhone, dispatchMsg)
        return Response.json({ success: true, action: 'executed', driver_notified: result.success, phase: 2 })
      }
      return Response.json({ success: true, action: 'executed', driver_notified: false, note: 'No driver phone — call manually' })
    }

    // ── PHASE 3: Outbound voice call to carrier ─────────────────────────────
    if (actionType === 'call' || actionType === 'emergency') {
      const carrierPhone = details.carrier_phone
        || extractPhoneNumber(actionLabel)
        || extractPhoneNumber(client?.system_prompt)

      if (carrierPhone) {
        const { data: recentIncident } = await db.from('incidents')
          .select('user_input, ref')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(1)

        const voiceMessage = buildCarrierVoiceMessage({
          carrierName: details.carrier_name || 'the carrier',
          vehicleReg: details.vehicle_reg,
          clientName: client?.contact_name || 'your client',
          incidentDescription: recentIncident?.[0]?.user_input?.substring(0, 180),
          opsPhone: client?.contact_phone,
          ref: details.ref
        })

        const result = await makeCall(carrierPhone, voiceMessage)
        return Response.json({ success: true, action: 'executed', call_placed: result.success, phase: 3 })
      }
      return Response.json({ success: true, action: 'executed', note: 'No carrier phone found' })
    }

    // Default — just mark executed
    return Response.json({ success: true, action: 'executed', phase: 0 })

  } catch (error) {
    console.error('Approvals error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}

// GET /api/approvals — fetch pending approvals for a client
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')

    if (!clientId) return Response.json({ approvals: [] })

    const db = getDB()
    if (!db) return Response.json({ approvals: [] })

    // Auto-expire approvals older than 4 hours
    const expiryTime = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
    await db.from('approvals')
      .update({ status: 'expired' })
      .eq('client_id', clientId)
      .eq('status', 'pending')
      .lt('created_at', expiryTime)

    const { data: approvals } = await db.from('approvals')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(50)

    return Response.json({ approvals: approvals || [] })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
