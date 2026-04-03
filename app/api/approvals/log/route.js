import { createClient } from '@supabase/supabase-js'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

// POST — log an executed action to the approvals table
export async function POST(request) {
  try {
    const body = await request.json()
    const { id, client_id, action_type, action_label, status, approved_by, executed_at } = body

    const db = getDB()
    if (!db) return Response.json({ success: false, reason: 'no_db' })

    const { data, error } = await db.from('approvals').insert({
      id,
      client_id,
      action_type,
      action_label,
      action_details: { source: 'agent_action' },
      financial_value: 0,
      status: status || 'executed',
      approved_by: approved_by || 'ops_manager',
      approved_at: new Date().toISOString(),
      executed_at: executed_at || new Date().toISOString()
    }).select().single()

    if (error) throw error
    return Response.json({ success: true, id: data.id })
  } catch (e) {
    console.error('Approval log error:', e.message)
    return Response.json({ success: false, error: e.message })
  }
}
