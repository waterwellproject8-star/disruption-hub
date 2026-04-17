import { createClient } from '@supabase/supabase-js'
import { sendSMS } from '../../../../lib/twilio.js'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

// POST /api/actions/escalate
// Cron: every 5 minutes. Escalates any pending approval whose
// escalation_at has passed and which hasn't been escalated yet.
// Sends a single SMS to the client's secondary contact.

export async function POST(request) {
  if (process.env.NODE_ENV === 'production') {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const db = getDB()
  if (!db) return Response.json({ success: true, escalated: 0, reason: 'no_db' })

  const nowIso = new Date().toISOString()
  const summary = { escalated: 0, no_secondary_contact: 0, no_phone_match: 0, errors: [] }

  try {
    const { data: pending, error } = await db
      .from('approvals')
      .select('id, client_id, action_label, action_details')
      .eq('status', 'pending')
      .is('escalated_at', null)
      .lte('escalation_at', nowIso)

    if (error) return Response.json({ error: error.message }, { status: 500 })

    for (const approval of pending || []) {
      try {
        const { data: client } = await db
          .from('clients')
          .select('secondary_contact_phone, secondary_contact_name')
          .eq('id', approval.client_id)
          .single()

        const secondaryPhone = client?.secondary_contact_phone
        if (!secondaryPhone) {
          summary.no_secondary_contact++
          // Stamp escalated_at anyway so we don't retry every cron tick
          await db.from('approvals').update({ escalated_at: nowIso }).eq('id', approval.id)
          continue
        }

        const severity = approval.action_details?.severity || 'HIGH'
        const vehicleReg = approval.action_details?.vehicle_reg || ''
        const driverName = approval.action_details?.driver_name || ''
        const alertType = (approval.action_details?.issue_context || approval.action_type || 'alert').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        const smsBody = `DisruptionHub — ESCALATION ${severity}\n${vehicleReg}: ${alertType}${driverName ? ` (${driverName})` : ''}.\nPrimary ops has not responded.\nReply YES to execute, NO to dismiss.`.substring(0, 160)

        const result = await sendSMS(secondaryPhone, smsBody)
        await db.from('approvals').update({ escalated_at: nowIso }).eq('id', approval.id)

        if (result?.success) summary.escalated++
        else {
          summary.errors.push({ id: approval.id, reason: result?.reason || 'sms_failed' })
          await db.from('incidents').insert({
            client_id: approval.client_id,
            user_input: `Escalation SMS failed for approval ${approval.id} — secondary contact ${secondaryPhone} unreachable`,
            ai_response: JSON.stringify(result || {}),
            severity: 'LOW',
            financial_impact: 0,
            ref: `ESCALATION-FAIL-${approval.id.substring(0,8)}`
          }).catch(err => console.error('[escalate] incidents insert failed:', err?.message))
        }
      } catch (e) {
        summary.errors.push({ id: approval.id, error: e.message })
      }
    }

    return Response.json({ success: true, ...summary })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
