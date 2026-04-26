import { createClient } from '@supabase/supabase-js'
import { sendSMS } from '../../../../lib/twilio.js'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

const STATUS_CONFIG = {
  fixable_roadside: {
    action_type: 'notify',
    label: '🔧 Engineer fixing on scene',
    sms: null
  },
  replacement_needed: {
    action_type: 'replacement',
    label: '🚛 Replacement vehicle needed — engineer assessment',
    sms: (vreg) => `DisruptionHub — UPDATE\n${vreg}: Engineer says replacement vehicle needed.\nDriver waiting on scene with load.`
  },
  tow_only: {
    action_type: 'tow_dispatched',
    label: '🏗 Tow only — vehicle dead — engineer assessment',
    sms: (vreg) => `DisruptionHub — UPDATE\n${vreg}: Engineer says tow only — vehicle dead.\nDriver needs onward transport.`
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    let { client_id, driver_name, vehicle_reg, ref, status } = body

    if (!client_id || !status || !STATUS_CONFIG[status]) {
      return Response.json({ error: 'client_id and valid status required' }, { status: 400 })
    }

    if (client_id) client_id = client_id.toLowerCase().trim()
    if (vehicle_reg) vehicle_reg = vehicle_reg.toUpperCase().trim()

    const cfg = STATUS_CONFIG[status]
    const db = getDB()
    if (!db) return Response.json({ error: 'service unavailable' }, { status: 500 })

    const { error: insertErr } = await db.from('approvals').insert({
      client_id,
      action_type: cfg.action_type,
      action_label: cfg.label,
      action_details: { ref, source: 'engineer_status', vehicle_reg, driver_name, status },
      financial_value: 0,
      status: 'executed',
      approved_by: 'driver_pwa',
      executed_at: new Date().toISOString()
    })
    if (insertErr) {
      console.error('[engineer-status] approvals insert failed:', insertErr.message)
      return Response.json({ error: 'write failed' }, { status: 500 })
    }

    if (cfg.sms) {
      try {
        const lookupId = client_id === 'demo' ? 'pearson-haulage' : client_id
        const { data: clientRow } = await db.from('clients').select('contact_phone').eq('id', lookupId).single()
        if (clientRow?.contact_phone) {
          const result = await sendSMS(clientRow.contact_phone, cfg.sms(vehicle_reg || 'UNKNOWN'))
          if (!result.success) console.error('[engineer-status] SMS failed:', result.error)
        }
      } catch (smsErr) {
        console.error('[engineer-status] SMS error:', smsErr?.message)
      }
    }

    return Response.json({ success: true, status, action_type: cfg.action_type })

  } catch (err) {
    console.error('[engineer-status] error:', err)
    return Response.json({ error: 'internal error' }, { status: 500 })
  }
}
