import { createClient } from '@supabase/supabase-js'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

export async function POST(request) {
  try {
    const { name, phone, fleet_size, pain_point } = await request.json()
    if (!name || !phone) {
      return Response.json({ error: 'Name and phone are required' }, { status: 400 })
    }

    const db = getDB()
    if (!db) {
      console.log('[cvshow-lead] No DB configured. Lead:', { name, phone, fleet_size, pain_point })
      return Response.json({ success: true, saved: false, reason: 'no_db' })
    }

    const { error } = await db.from('cvshow_leads').insert({
      name: name.trim(),
      phone: phone.trim(),
      fleet_size: fleet_size || null,
      pain_point: pain_point || null,
      created_at: new Date().toISOString()
    })

    if (error) {
      console.error('[cvshow-lead] insert error:', error.message, error.code)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, saved: true })
  } catch (e) {
    console.error('[cvshow-lead] error:', e.message)
    return Response.json({ error: e.message }, { status: 500 })
  }
}
