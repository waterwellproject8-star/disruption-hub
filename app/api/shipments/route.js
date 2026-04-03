import { createClient } from '@supabase/supabase-js'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const client_id = searchParams.get('client_id') || 'pearson-haulage'
    const db = getDB()
    if (!db) return Response.json({ shipments: [] })

    const { data, error } = await db
      .from('shipments')
      .select('*')
      .eq('client_id', client_id)
      .order('created_at', { ascending: true })

    if (error) throw error

    // Map to the shape the dashboard expects
    const shipments = (data || []).map(s => ({
      ref: s.ref,
      route: s.route,
      carrier: s.carrier,
      status: s.status,
      eta: s.eta,
      sla_window: s.sla_window,
      alert: s.alert,
      penalty_if_breached: s.penalty_if_breached,
      cargo_type: s.cargo_type
    }))

    return Response.json({ shipments })
  } catch (e) {
    console.error('Shipments error:', e.message)
    return Response.json({ shipments: [] })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const db = getDB()
    if (!db) return Response.json({ success: false })
    const { data, error } = await db.from('shipments').insert(body).select().single()
    if (error) throw error
    return Response.json({ success: true, shipment: data })
  } catch (e) {
    return Response.json({ success: false, error: e.message })
  }
}

export async function PATCH(request) {
  try {
    const { id, ...updates } = await request.json()
    const db = getDB()
    if (!db) return Response.json({ success: false })
    const { error } = await db.from('shipments').update(updates).eq('id', id)
    if (error) throw error
    return Response.json({ success: true })
  } catch (e) {
    return Response.json({ success: false, error: e.message })
  }
}
