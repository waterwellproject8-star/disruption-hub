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
    console.log('[Twilio SMS - not configured] To:', to, '| Body:', body)
    return { success: false, simulated: true }
  }
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ To: to, From: from, Body: body })
      }
    )
    const data = await res.json()
    return { success: res.ok, sid: data.sid, error: data.message }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// POST /api/driver/cancel-job
// Ops cancels one or all active jobs for a vehicle from the dashboard
export async function POST(request) {
  try {
    const { client_id, vehicle_reg, ref, cancel_all, reason, approved_by = 'ops_manager' } = await request.json()

    if (!client_id || !vehicle_reg) {
      return Response.json({ error: 'client_id and vehicle_reg required' }, { status: 400 })
    }

    const db = getDB()
    if (!db) return Response.json({ error: 'DB not configured' }, { status: 500 })

    // Get driver phone from existing progress records
    const { data: progressRecords } = await db
      .from('driver_progress')
      .select('ref, status, driver_name, alert')
      .eq('client_id', client_id)
      .eq('vehicle_reg', vehicle_reg)
      .not('status', 'eq', 'completed')
      .not('status', 'eq', 'cancelled')

    // Get driver phone from clients or from a recent approval
    const { data: recentApproval } = await db
      .from('approvals')
      .select('action_details')
      .eq('client_id', client_id)
      .contains('action_details', { vehicle_reg })
      .order('created_at', { ascending: false })
      .limit(1)

    const driverPhone = recentApproval?.[0]?.action_details?.driver_phone || null
    const driverName = progressRecords?.[0] ? (await db.from('driver_progress').select('driver_name').eq('client_id', client_id).eq('vehicle_reg', vehicle_reg).limit(1)).data?.[0]?.driver_name : null

    // Cancel specific job or all active jobs
    let cancelledRefs = []

    if (cancel_all) {
      // Cancel all non-completed jobs for this vehicle
      const { error } = await db
        .from('driver_progress')
        .update({
          status: 'cancelled',
          alert: `Cancelled by ops: ${reason || 'reassigned to another driver'}`,
          updated_at: new Date().toISOString()
        })
        .eq('client_id', client_id)
        .eq('vehicle_reg', vehicle_reg)
        .not('status', 'eq', 'completed')

      if (error) throw error
      cancelledRefs = progressRecords?.map(r => r.ref) || []

    } else if (ref) {
      // Cancel specific job
      const { error } = await db
        .from('driver_progress')
        .update({
          status: 'cancelled',
          alert: `Cancelled by ops: ${reason || 'reassigned to another driver'}`,
          updated_at: new Date().toISOString()
        })
        .eq('client_id', client_id)
        .eq('vehicle_reg', vehicle_reg)
        .eq('ref', ref)

      if (error) throw error
      cancelledRefs = [ref]

    } else {
      return Response.json({ error: 'Either ref or cancel_all required' }, { status: 400 })
    }

    // Log the cancellation
    try {
      await db.from('incidents').insert({
        client_id,
        user_input: `OPS JOB CANCELLATION: ${vehicle_reg} — ${cancelledRefs.join(', ')} — ${reason || 'reassigned'}. Approved by: ${approved_by}`,
        ai_response: `Jobs cancelled from dashboard: ${cancelledRefs.join(', ')}`,
        severity: 'MEDIUM',
        financial_impact: 0,
        ref: `CANCEL-${vehicle_reg}-${Date.now().toString(36).toUpperCase()}`
      })
    } catch {}

    // SMS driver with clear instruction
    let smsSent = false
    if (driverPhone && cancelledRefs.length > 0) {
      const jobList = cancelledRefs.join(', ')
      const msg = cancel_all
        ? `DisruptionHub OPS UPDATE\n\nOps has reassigned all your remaining jobs.\n\nPlease end your shift and return to depot.\nReason: ${reason || 'jobs reassigned'}`
        : `DisruptionHub OPS UPDATE\n\nJob ${jobList} has been reassigned by ops.\n\nRemove from your schedule and continue with remaining jobs.\nReason: ${reason || 'reassigned'}`

      const result = await sendSMS(driverPhone, msg)
      smsSent = result.success || false
    }

    return Response.json({
      success: true,
      cancelled_refs: cancelledRefs,
      driver_notified: smsSent,
      driver_phone_found: !!driverPhone
    })

  } catch (error) {
    console.error('Cancel job error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}

// GET /api/driver/cancel-job — fetch active fleet status for dashboard
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const client_id = searchParams.get('client_id')

    if (!client_id) return Response.json({ error: 'client_id required' }, { status: 400 })

    const db = getDB()
    if (!db) return Response.json({ fleet: [] })

    // Get all active (non-completed, non-cancelled) driver progress
    const { data, error } = await db
      .from('driver_progress')
      .select('vehicle_reg, driver_name, ref, status, alert, updated_at')
      .eq('client_id', client_id)
      .not('status', 'eq', 'completed')
      .not('status', 'eq', 'cancelled')
      .order('updated_at', { ascending: false })

    if (error) throw error

    // Group by vehicle_reg
    const grouped = {}
    for (const row of (data || [])) {
      if (!grouped[row.vehicle_reg]) {
        grouped[row.vehicle_reg] = {
          vehicle_reg: row.vehicle_reg,
          driver_name: row.driver_name,
          jobs: []
        }
      }
      grouped[row.vehicle_reg].jobs.push({
        ref: row.ref,
        status: row.status,
        alert: row.alert,
        updated_at: row.updated_at
      })
    }

    return Response.json({ fleet: Object.values(grouped) })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
