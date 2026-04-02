import { getPendingApprovals, approveAction, rejectAction } from '../../../lib/supabase.js'
import { executeAction } from '../../../lib/actions.js'

// GET /api/approvals?status=pending
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')

    // No Supabase yet — return empty approvals list
    try {
      const approvals = await getPendingApprovals(clientId || 'demo')
      return Response.json({ approvals: approvals || [], count: approvals?.length || 0 })
    } catch {
      return Response.json({ approvals: [], count: 0 })
    }
  } catch (error) {
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
