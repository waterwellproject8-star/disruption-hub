import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

// GET /api/driver/active?client_id=pearson-haulage
// Returns all drivers currently on shift (driver_progress status != completed)
// Used by SETUP tab to show active fleet and pre-fill webhook payloads

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')
    if (!clientId) return Response.json({ drivers: [] })

    const db = getDB()
    if (!db) return Response.json({ drivers: [] })

    // NOTE: driver_progress has no client_id column — cannot filter by it
    // Get all active rows, then match by checking against shipments for this client
    const { data, error } = await db
      .from('driver_progress')
      .select('vehicle_reg, driver_name, driver_phone, status, alert, last_known_location, ref, updated_at')
      .not('status', 'eq', 'completed')
      .not('driver_phone', 'is', null)
      .gt('updated_at', new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString())
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('[active-drivers] full error:', error?.message, error?.code, error?.details, error?.hint)
      return Response.json({ drivers: [] })
    }

    // Deduplicate by vehicle_reg — keep most recent row per vehicle
    const seen = new Set()
    const unique = (data || []).filter(row => {
      if (seen.has(row.vehicle_reg)) return false
      seen.add(row.vehicle_reg)
      return true
    })

    // Also fetch active shipments to enrich with cargo/route info
    const { data: shipments } = await db
      .from('shipments')
      .select('ref, route, cargo_type, eta, sla_window, status')
      .eq('client_id', clientId)
      .neq('status', 'completed')

    // Match drivers to their current job
    const enriched = unique.map(driver => {
      const job = shipments?.find(s => s.ref === driver.ref) || null
      return {
        vehicle_reg:          driver.vehicle_reg,
        driver_name:          driver.driver_name || 'Unknown driver',
        driver_phone:         driver.driver_phone,
        status:               driver.status,
        last_known_location:  driver.last_known_location || null,
        current_ref:          driver.ref || null,
        current_route:        job?.route || null,
        cargo_type:           job?.cargo_type || null,
        eta:                  job?.eta || null,
        sla_window:           job?.sla_window || null,
        last_seen:            driver.updated_at
      }
    })

    return Response.json({ drivers: enriched })

  } catch (err) {
    console.error('[active-drivers] error:', err.message)
    return Response.json({ drivers: [], error: err.message })
  }
}
