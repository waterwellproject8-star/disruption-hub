import { createClient } from '@supabase/supabase-js'

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
    const { client_id, vehicle_reg, driver_phone, reason } = await request.json()

    if (!vehicle_reg && !driver_phone) {
      return Response.json({ error: 'vehicle_reg or driver_phone required' }, { status: 400 })
    }

    const db = getDB()
    if (!db) return Response.json({ success: false, error: 'DB not configured' })

    const now = new Date().toISOString()
    const endReason = reason || 'shift_ended'

    let rowsUpdated = 0

    // Mark active rows by vehicle_reg
    // NOTE: driver_progress has no client_id column — never filter by it here
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

    return Response.json({
      success: true,
      rows_updated: rowsUpdated,
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
