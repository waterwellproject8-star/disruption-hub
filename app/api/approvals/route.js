import { createClient } from '@supabase/supabase-js'
import { approveAction, rejectAction } from '../../../lib/supabase.js'
import { executeAction } from '../../../lib/actions.js'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

// GET /api/approvals?client_id=pearson-haulage
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id') || 'pearson-haulage'
    const db = getDB()
    if (!db) return Response.json({ approvals: [], count: 0 })

    // Return all recent approvals — both executed and pending
    const { data, error } = await db
      .from('approvals')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error
    return Response.json({ approvals: data || [], count: data?.length || 0 })
  } catch (error) {
    console.error('Approvals GET error:', error.message)
    return Response.json({ approvals: [], count: 0 })
  }
}

// POST /api/approvals
export async function POST(request) {
  try {
    const { approval_id, action, approved_by } = await request.json()
    if (!approval_id || !action) {
      return Response.json({ error: 'approval_id and action required' }, { status: 400 })
    }
    if (action === 'approve') {
      try {
        const approval = await approveAction(approval_id, approved_by || 'ops_manager')
        const result = await executeAction(approval)
        return Response.json({ success: true, status: 'executed', result })
      } catch {
        return Response.json({ success: false, status: 'no_supabase' })
      }
    }
    if (action === 'reject') {
      try { await rejectAction(approval_id) } catch {}
      return Response.json({ success: true, status: 'rejected' })
    }
    return Response.json({ error: 'action must be approve or reject' }, { status: 400 })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
