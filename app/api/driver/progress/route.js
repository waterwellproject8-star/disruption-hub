import { createClient } from '@supabase/supabase-js'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

export async function POST(request) {
  try {
    const { client_id, vehicle_reg, driver_name, driver_phone, ref, status, alert } = await request.json()

    if (!client_id || !vehicle_reg || !ref || !status) {
      return Response.json({ error: 'client_id, vehicle_reg, ref, status required' }, { status: 400 })
    }

    const db = getDB()
    if (!db) return Response.json({ success: true, saved: false, reason: 'no_db' })

    const { error } = await db.from('driver_progress').upsert({
      client_id,
      vehicle_reg,
      driver_name: driver_name || null,
      driver_phone: driver_phone || null,
      ref,
      status,
      alert: alert || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'client_id,vehicle_reg,ref'
    })

    if (error) {
      // If driver_phone column doesn't exist yet, retry without it
      if (error.message?.includes('driver_phone')) {
        const { error: e2 } = await db.from('driver_progress').upsert({
          client_id, vehicle_reg, driver_name: driver_name || null,
          ref, status, alert: alert || null, updated_at: new Date().toISOString(),
        }, { onConflict: 'client_id,vehicle_reg,ref' })
        if (e2) return Response.json({ success: false, error: e2.message })
        return Response.json({ success: true, saved: true, note: 'phone_column_missing' })
      }
      return Response.json({ success: false, error: error.message })
    }

    return Response.json({ success: true, saved: true })

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const client_id = searchParams.get('client_id')
    const vehicle_reg = searchParams.get('vehicle_reg')

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
