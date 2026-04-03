import { createClient } from '@supabase/supabase-js'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { client_id, user_input, ai_response, severity, financial_impact, ref } = body
    const db = getDB()
    if (!db) return Response.json({ success: false, reason: 'no_db' })
    const { data, error } = await db.from('incidents').insert({
      client_id, user_input, ai_response, severity,
      financial_impact: financial_impact || 0, ref
    }).select().single()
    if (error) throw error
    return Response.json({ success: true, id: data.id })
  } catch (e) {
    return Response.json({ success: false, error: e.message })
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const client_id = searchParams.get('client_id')
    const db = getDB()
    if (!db) return Response.json({ incidents: [] })
    let q = db.from('incidents').select('*').order('created_at', { ascending: false }).limit(20)
    if (client_id) q = q.eq('client_id', client_id)
    const { data, error } = await q
    if (error) throw error
    return Response.json({ incidents: data || [] })
  } catch (e) {
    return Response.json({ incidents: [], error: e.message })
  }
}
