import { createClient } from '@supabase/supabase-js'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

async function sendSMS(to, body) {
  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from  = process.env.TWILIO_PHONE_NUMBER
  if (!sid || !token || !from || sid.includes('placeholder') || sid.startsWith('AC_')) {
    console.log('[Twilio SMS - not configured] To:', to)
    return { success: false, simulated: true }
  }
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      { method: 'POST',
        headers: { 'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: to, From: from, Body: body }) }
    )
    const data = await res.json()
    return { success: res.ok, sid: data.sid, error: data.message }
  } catch (e) { return { success: false, error: e.message } }
}

async function getDriverPhone(db, client_id, vehicle_reg) {
  try {
    const { data } = await db.from('approvals').select('action_details')
      .eq('client_id', client_id).filter('action_details->>vehicle_reg', 'eq', vehicle_reg)
      .order('created_at', { ascending: false }).limit(1)
    return data?.[0]?.action_details?.driver_phone || null
  } catch { return null }
}

async function getDriverName(db, client_id, vehicle_reg) {
  try {
    const { data } = await db.from('driver_progress').select('driver_name')
      .eq('client_id', client_id).eq('vehicle_reg', vehicle_reg).not('driver_name', 'is', null).limit(1)
    return data?.[0]?.driver_name || null
  } catch { return null }
}

export async function POST(request) {
  try {
    const { client_id, vehicle_reg, ref, cancel_all, reason, reassign_to, approved_by = 'ops_manager' } = await request.json()
    if (!client_id || !vehicle_reg) return Response.json({ error: 'client_id and vehicle_reg required' }, { status: 400 })

    const db = getDB()
    if (!db) return Response.json({ error: 'DB not configured' }, { status: 500 })

    const { data: activeJobs } = await db.from('driver_progress').select('ref, status, driver_name, alert')
      .eq('client_id', client_id).eq('vehicle_reg', vehicle_reg)
      .not('status', 'eq', 'completed').not('status', 'eq', 'cancelled')

    const originalDriverPhone = await getDriverPhone(db, client_id, vehicle_reg)

    let cancelledRefs = []
    if (cancel_all) cancelledRefs = (activeJobs || []).map(r => r.ref)
    else if (ref) cancelledRefs = [ref]
    else return Response.json({ error: 'Either ref or cancel_all required' }, { status: 400 })

    if (cancelledRefs.length === 0) return Response.json({ success: true, cancelled_refs: [], message: 'No active jobs to cancel' })

    const cancelNote = reassign_to
      ? `Reassigned to ${reassign_to}${reason ? ` — ${reason}` : ''}`
      : (reason || 'Cancelled by ops')

    // Cancel for original driver
    for (const jobRef of cancelledRefs) {
      try {
        await db.from('driver_progress').update({ status: 'cancelled', alert: cancelNote, updated_at: new Date().toISOString() })
          .eq('client_id', client_id).eq('vehicle_reg', vehicle_reg).eq('ref', jobRef)
      } catch(e) { console.error('cancel update:', e.message) }
    }

    // Reassign to new driver
    let reassignedDriverPhone = null
    if (reassign_to) {
      reassignedDriverPhone = await getDriverPhone(db, client_id, reassign_to)
      const reassignedDriverName = await getDriverName(db, client_id, reassign_to)
      for (const jobRef of cancelledRefs) {
        try {
          await db.from('driver_progress').upsert({
            client_id, vehicle_reg: reassign_to, driver_name: reassignedDriverName,
            ref: jobRef, status: 'on-track',
            alert: `Assigned by ops from ${vehicle_reg}${reason ? ` — ${reason}` : ''}`,
            updated_at: new Date().toISOString()
          }, { onConflict: 'client_id,vehicle_reg,ref' })
        } catch(e) { console.error('reassign upsert:', e.message) }
      }
    }

    // Log
    try {
      await db.from('incidents').insert({
        client_id,
        user_input: `${reassign_to ? 'OPS REASSIGNMENT' : 'OPS CANCELLATION'}: ${vehicle_reg}${reassign_to ? ` → ${reassign_to}` : ''} — jobs: ${cancelledRefs.join(', ')}. Reason: ${cancelNote}. By: ${approved_by}`,
        ai_response: reassign_to ? `Reassigned to ${reassign_to}` : 'Jobs cancelled',
        severity: 'LOW', financial_impact: 0,
        ref: `OPS-${vehicle_reg}-${Date.now().toString(36).toUpperCase()}`
      })
    } catch {}

    // SMS original driver
    let originalNotified = false
    if (originalDriverPhone) {
      const msg = cancel_all
        ? `DisruptionHub OPS\n\nAll your remaining jobs have been reassigned${reassign_to ? ` to ${reassign_to}` : ''}. Please end your shift and return to depot.${reason ? `\nReason: ${reason}` : ''}`
        : `DisruptionHub OPS\n\nJob ${cancelledRefs.join(', ')} removed from your schedule${reassign_to ? ` and reassigned to ${reassign_to}` : ''}. Continue with remaining runs.${reason ? `\nReason: ${reason}` : ''}`
      const result = await sendSMS(originalDriverPhone, msg)
      originalNotified = result.success || false
    }

    // SMS new driver
    let newDriverNotified = false
    if (reassign_to && reassignedDriverPhone) {
      const jobList = cancelledRefs.join(', ')
      const msg = `DisruptionHub OPS — NEW JOB ASSIGNED\n\nJob${cancelledRefs.length > 1 ? 's' : ''} ${jobList} added to your schedule.\nCheck your driver app — it updates automatically.${reason ? `\nNote: ${reason}` : ''}`
      const result = await sendSMS(reassignedDriverPhone, msg)
      newDriverNotified = result.success || false
    }

    return Response.json({
      success: true, cancelled_refs: cancelledRefs, reassigned_to: reassign_to || null,
      original_driver_notified: originalNotified, new_driver_notified: newDriverNotified,
      new_driver_phone_found: !!reassignedDriverPhone
    })

  } catch (error) {
    console.error('Cancel/reassign error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const client_id = searchParams.get('client_id')
    if (!client_id) return Response.json({ error: 'client_id required' }, { status: 400 })
    const db = getDB()
    if (!db) return Response.json({ fleet: [] })

    const { data, error } = await db.from('driver_progress')
      .select('vehicle_reg, driver_name, ref, status, alert, updated_at')
      .eq('client_id', client_id).not('status', 'eq', 'completed').not('status', 'eq', 'cancelled')
      .order('updated_at', { ascending: false })

    if (error) throw error

    const grouped = {}
    for (const row of (data || [])) {
      if (!grouped[row.vehicle_reg]) grouped[row.vehicle_reg] = { vehicle_reg: row.vehicle_reg, driver_name: row.driver_name, jobs: [] }
      grouped[row.vehicle_reg].jobs.push({ ref: row.ref, status: row.status, alert: row.alert, updated_at: row.updated_at })
    }
    return Response.json({ fleet: Object.values(grouped) })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
