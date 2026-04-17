import { createClient } from '@supabase/supabase-js'

async function sendSMS(to, body) {
  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from  = process.env.TWILIO_PHONE_NUMBER
  if (!sid || !token || !from || sid.includes('placeholder') || sid.startsWith('AC_')) {
    console.log('[end-shift SMS - not configured] To:', to)
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

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

// POST /api/driver/end-shift
// Called when driver ends shift, clears stale session, or changes driver
// Marks all active driver_progress rows for this vehicle as completed
// Prevents stale data from triggering banner notifications on next shift

export async function POST(request) {
  try {
    let {
      client_id,
      vehicle_reg,
      driver_phone,
      driver_name,
      reason,
      started_at,
      ended_at,
      duration_minutes,
      mileage,
      notes,
      post_shift_checks,
      jobs_completed,
      jobs_total,
      incidents_count,
      unresolved_count,
      fuel_level,
      defects_flagged,
      defect_details
    } = await request.json()
    if (client_id) client_id = client_id.toLowerCase().trim()
    if (vehicle_reg) vehicle_reg = vehicle_reg.toUpperCase().trim()

    if (!vehicle_reg && !driver_phone) {
      return Response.json({ error: 'vehicle_reg or driver_phone required' }, { status: 400 })
    }

    const db = getDB()
    if (!db) return Response.json({ success: false, error: 'DB not configured' })

    const now = new Date().toISOString()
    const endReason = reason || 'shift_ended'

    let rowsUpdated = 0
    let unresolvedJobs = []

    // Snapshot at_risk / part_delivered jobs before the bulk update wipes their status
    if (vehicle_reg) {
      const { data: atRiskRows } = await db.from('driver_progress')
        .select('ref, status, alert, updated_at')
        .eq('vehicle_reg', vehicle_reg)
        .in('status', ['at_risk', 'part_delivered'])
      unresolvedJobs = (atRiskRows || []).map(r => ({ ref: r.ref, status: r.status, alert: r.alert, last_update: r.updated_at }))
    }

    // Persist the end-of-shift compliance record before updating driver_progress
    const { error: reportErr } = await db.from('end_of_shift_reports').insert({
      client_id: client_id || null,
      vehicle_reg: vehicle_reg || null,
      driver_name: driver_name || null,
      driver_phone: driver_phone || null,
      started_at: started_at || null,
      ended_at: ended_at || now,
      duration_minutes: duration_minutes ?? null,
      mileage: mileage ? String(mileage) : null,
      notes: notes || null,
      post_shift_checks: post_shift_checks || {},
      jobs_completed: jobs_completed ?? null,
      jobs_total: jobs_total ?? null,
      incidents_count: incidents_count ?? 0,
      unresolved_count: unresolved_count ?? 0,
      unresolved_jobs: unresolvedJobs.length > 0 ? unresolvedJobs : null,
      fuel_level: fuel_level || null,
      defects_flagged: defects_flagged ?? false,
      defect_details: defect_details || null,
      reason: endReason
    })
    if (reportErr) console.error('[end-shift] report insert:', reportErr.message, reportErr.code)
    const reportSaved = !reportErr

    // Mark active rows by vehicle_reg
    if (vehicle_reg) {
      const { data, error } = await db
        .from('driver_progress')
        .update({
          status: 'completed',
          alert: null,
          updated_at: now
        })
        .eq('vehicle_reg', vehicle_reg)
        .not('status', 'eq', 'completed')

      if (error) {
        console.error('[end-shift] vehicle_reg update error:', error.message)
      } else {
        console.log(`[end-shift] Marked completed by vehicle_reg ${vehicle_reg} — reason: ${endReason}`)
        rowsUpdated++
      }
    }

    // Also mark by driver_phone if provided — catches any rows that don't match vehicle_reg
    if (driver_phone) {
      const { error } = await db
        .from('driver_progress')
        .update({
          status: 'completed',
          alert: null,
          updated_at: now
        })
        .eq('driver_phone', driver_phone)
        .not('status', 'eq', 'completed')

      if (error) {
        console.error('[end-shift] driver_phone update error:', error.message)
      } else {
        rowsUpdated++
      }
    }

    // Timestamp before any notification inserts — used to scope the expire query
    // so freshly created SHIFT ENDED notifications are not immediately expired.
    const shiftEndTime = new Date().toISOString()

    // Expire any pending approvals for this vehicle so they don't sit in the ops queue
    // overnight and don't trigger spurious escalation SMSs for resolved incidents
    if (client_id && vehicle_reg) {
      const { data: staleApprovals } = await db.from('approvals')
        .select('id, action_label')
        .eq('client_id', client_id)
        .eq('status', 'pending')
        .contains('action_details', { vehicle_reg: vehicle_reg })
        .lt('created_at', shiftEndTime)

      for (const a of (staleApprovals || [])) {
        const { error: expireErr } = await db.from('approvals')
          .update({ status: 'expired', action_label: `SHIFT ENDED — ${a.action_label}` })
          .eq('id', a.id)
        if (expireErr) console.error('[end-shift] approval expiry error:', expireErr.message, expireErr.code)
      }
    }

    // Clean up orphaned approvals with null vehicle_reg (older than 1 hour)
    if (client_id) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { data: orphans } = await db.from('approvals')
        .select('id, action_label')
        .eq('client_id', client_id)
        .eq('status', 'pending')
        .is('action_details->>vehicle_reg', null)
        .lt('created_at', oneHourAgo)

      for (const a of (orphans || [])) {
        const { error: orphanErr } = await db.from('approvals')
          .update({ status: 'expired', action_label: `SHIFT ENDED — ${a.action_label}` })
          .eq('id', a.id)
        if (orphanErr) console.error('[end-shift] orphan expiry error:', orphanErr.message, orphanErr.code)
      }
    }

    // Notify ops if there were unresolved jobs at shift end
    if (client_id && unresolvedJobs.length > 0) {
      const refs = unresolvedJobs.map(j => j.ref).join(', ')
      const { error: notifyErr } = await db.from('approvals').insert({
        client_id,
        action_type: 'notify',
        action_label: `⚠ SHIFT ENDED WITH UNRESOLVED JOBS — ${vehicle_reg || 'unknown'}: ${refs}`,
        action_details: { vehicle_reg, driver_name: driver_name || null, source: 'end_shift_unresolved', unresolved_jobs: unresolvedJobs },
        financial_value: 0,
        status: 'executed',
        approved_by: 'system',
        executed_at: now
      })
      if (notifyErr) console.error('[end-shift] unresolved notify error:', notifyErr.message, notifyErr.code)

      // SMS ops manager about unresolved jobs so they don't go unnoticed
      try {
        const { data: clientRow } = await db.from('clients')
          .select('contact_phone, contact_name')
          .eq('id', client_id)
          .single()
        if (clientRow?.contact_phone) {
          const smsBody = `DisruptionHub — Shift ended.\n${vehicle_reg || 'unknown'}: ${driver_name || 'Driver'} ended shift with ${unresolvedJobs.length} unresolved job${unresolvedJobs.length > 1 ? 's' : ''}.\nReview required. Dashboard: disruptionhub.ai/unlock`
          const smsResult = await sendSMS(clientRow.contact_phone, smsBody)
          if (!smsResult.success) console.error('[end-shift] ops SMS failed:', smsResult.error)
        }
      } catch (e) {
        console.error('[end-shift] ops SMS lookup failed:', e?.message)
      }
    }

    return Response.json({
      success: true,
      rows_updated: rowsUpdated,
      report_saved: reportSaved,
      unresolved_jobs: unresolvedJobs,
      vehicle_reg,
      driver_phone,
      reason: endReason,
      ended_at: now
    })

  } catch (err) {
    console.error('[end-shift] error:', err.message)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
