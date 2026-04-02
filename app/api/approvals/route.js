import { supabase, approveAction, rejectAction, logAction } from '../../../lib/supabase.js'
import { executeAction } from '../../../lib/actions.js'

// GET /api/approvals?client_id=xxx&status=pending
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')
    const status = searchParams.get('status') || 'pending'

    let query = supabase
      .from('approvals')
      .select(`*, module_runs(module, created_at)`)
      .order('created_at', { ascending: false })

    if (clientId) query = query.eq('client_id', clientId)
    if (status !== 'all') query = query.eq('status', status)

    const { data, error } = await query.limit(50)
    if (error) throw error

    return Response.json({ approvals: data, count: data.length })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/approvals  — approve or reject an action
export async function POST(request) {
  try {
    const { approval_id, action, approved_by, reason } = await request.json()

    if (!approval_id || !action) {
      return Response.json({ error: 'approval_id and action (approve|reject) required' }, { status: 400 })
    }

    if (action === 'approve') {
      // Mark as approved
      const approval = await approveAction(approval_id, approved_by || 'ops_manager')

      // Execute immediately
      try {
        const result = await executeAction(approval)

        // Mark as executed
        await supabase
          .from('approvals')
          .update({ status: 'executed', executed_at: new Date().toISOString(), execution_result: result })
          .eq('id', approval_id)

        return Response.json({ success: true, status: 'executed', result })
      } catch (execError) {
        await supabase
          .from('approvals')
          .update({ status: 'execution_failed', execution_result: { error: execError.message } })
          .eq('id', approval_id)

        return Response.json({ success: false, status: 'execution_failed', error: execError.message }, { status: 500 })
      }
    }

    if (action === 'reject') {
      await rejectAction(approval_id, reason)
      return Response.json({ success: true, status: 'rejected' })
    }

    return Response.json({ error: 'action must be approve or reject' }, { status: 400 })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
