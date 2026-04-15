import { createClient } from '@supabase/supabase-js'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

export async function POST(request) {
  try {
    let { client_id, vehicle_reg, driver_name, driver_phone, ref, status, alert, pod, session_id } = await request.json()
    if (client_id) client_id = client_id.toLowerCase().trim()
    if (vehicle_reg) vehicle_reg = vehicle_reg.toUpperCase().trim()

    if (!client_id || !vehicle_reg || !ref || !status) {
      return Response.json({ error: 'client_id, vehicle_reg, ref, status required' }, { status: 400 })
    }

    const db = getDB()
    if (!db) return Response.json({ success: true, saved: false, reason: 'no_db' })

    // Session ownership check — the active SHIFT_START row for this vehicle owns the session.
    // If the incoming session_id does not match the owner, this client has been superseded.
    if (session_id) {
      const { data: activeRows } = await db.from('driver_progress')
        .select('session_id')
        .eq('client_id', client_id)
        .eq('vehicle_reg', vehicle_reg)
        .eq('ref', 'SHIFT_START')
        .eq('status', 'on_shift')
        .limit(1)
      const active = (activeRows || [])[0]
      if (active && active.session_id && active.session_id !== session_id) {
        return Response.json({
          error: 'session_superseded',
          message: 'Another driver has taken over this vehicle. Your session has ended.'
        }, { status: 409 })
      }
    }

    const { error } = await db.from('driver_progress').upsert({
      client_id,
      vehicle_reg,
      driver_name: driver_name || null,
      driver_phone: driver_phone || null,
      ref,
      status,
      alert: alert || null,
      pod: pod || null,
      session_id: session_id || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'client_id,vehicle_reg,ref,driver_phone'
    })

    if (error) {
      // If session_id column doesn't exist yet (pre-migration), retry without it
      if (error.message?.includes('session_id')) {
        const { error: eSess } = await db.from('driver_progress').upsert({
          client_id, vehicle_reg, driver_name: driver_name || null, driver_phone: driver_phone || null,
          ref, status, alert: alert || null, pod: pod || null, updated_at: new Date().toISOString(),
        }, { onConflict: 'client_id,vehicle_reg,ref,driver_phone' })
        if (eSess) return Response.json({ success: false, error: eSess.message })
        return Response.json({ success: true, saved: true, note: 'session_id_column_missing' })
      }
      // If pod column doesn't exist yet, retry without it
      if (error.message?.includes('pod')) {
        const { error: ePod } = await db.from('driver_progress').upsert({
          client_id, vehicle_reg, driver_name: driver_name || null, driver_phone: driver_phone || null,
          ref, status, alert: alert || null, session_id: session_id || null, updated_at: new Date().toISOString(),
        }, { onConflict: 'client_id,vehicle_reg,ref' })
        if (ePod) return Response.json({ success: false, error: ePod.message })
        return Response.json({ success: true, saved: true, note: 'pod_column_missing' })
      }
      // If driver_phone column doesn't exist yet, retry without it
      if (error.message?.includes('driver_phone')) {
        const { error: e2 } = await db.from('driver_progress').upsert({
          client_id, vehicle_reg, driver_name: driver_name || null,
          ref, status, alert: alert || null, pod: pod || null, session_id: session_id || null, updated_at: new Date().toISOString(),
        }, { onConflict: 'client_id,vehicle_reg,ref' })
        if (e2) return Response.json({ success: false, error: e2.message })
        return Response.json({ success: true, saved: true, note: 'phone_column_missing' })
      }
      return Response.json({ success: false, error: error.message })
    }

    // When a new shift starts, reset all previous job rows for this vehicle
    // so Live Fleet SLA badge logic finds active refs immediately
    if (ref === 'SHIFT_START') {
      const { error: resetErr } = await db.from('driver_progress')
        .update({ status: 'on-track', alert: null, pod: null, updated_at: new Date().toISOString() })
        .eq('client_id', client_id)
        .eq('vehicle_reg', vehicle_reg)
        .neq('ref', 'SHIFT_START')
        .eq('status', 'completed')
      if (resetErr) console.error('[progress] shift-start reset error:', resetErr.message)
    }

    return Response.json({ success: true, saved: true })

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// PATCH — bulk reset job rows to on-track for a new shift
export async function PATCH(request) {
  try {
    let { client_id, vehicle_reg, refs } = await request.json()
    if (client_id) client_id = client_id.toLowerCase().trim()
    if (vehicle_reg) vehicle_reg = vehicle_reg.toUpperCase().trim()
    if (!client_id || !vehicle_reg || !refs?.length) {
      return Response.json({ error: 'client_id, vehicle_reg, refs[] required' }, { status: 400 })
    }
    const db = getDB()
    if (!db) return Response.json({ success: true, reset: 0, reason: 'no_db' })

    const { data, error } = await db.from('driver_progress')
      .update({ status: 'on-track', alert: null, pod: null, updated_at: new Date().toISOString() })
      .eq('client_id', client_id)
      .eq('vehicle_reg', vehicle_reg)
      .in('ref', refs)

    if (error) {
      console.error('[progress] bulk reset error:', error.message)
      return Response.json({ success: false, error: error.message })
    }
    return Response.json({ success: true })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    let client_id = searchParams.get('client_id')
    let vehicle_reg = searchParams.get('vehicle_reg')
    if (client_id) client_id = client_id.toLowerCase().trim()
    if (vehicle_reg) vehicle_reg = vehicle_reg.toUpperCase().trim()

    if (!client_id || !vehicle_reg) return Response.json({ progress: [] })

    const db = getDB()
    if (!db) return Response.json({ progress: [] })

    const { data, error } = await db.from('driver_progress')
      .select('ref, status, alert, updated_at')
      .eq('client_id', client_id)
      .eq('vehicle_reg', vehicle_reg)
      .order('updated_at', { ascending: false })

    if (error) return Response.json({ progress: [] })
    return Response.json({ progress: data || [] })

  } catch (e) {
    return Response.json({ progress: [] })
  }
}
