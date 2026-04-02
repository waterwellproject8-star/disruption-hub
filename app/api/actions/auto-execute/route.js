import { supabase } from '../../../lib/supabase.js'
import { executeAction } from '../../../lib/actions.js'

// POST /api/actions/auto-execute
// Called by Vercel Cron every 5 minutes
// Vercel cron.json: { "crons": [{ "path": "/api/actions/auto-execute", "schedule": "*/5 * * * *" }] }

export async function POST(request) {
  // Verify this is a cron request
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow in development
    if (process.env.NODE_ENV === 'production') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const results = { executed: 0, failed: 0, errors: [] }

  try {
    // Find all actions ready for auto-execution
    const now = new Date().toISOString()
    const { data: ready, error } = await supabase
      .from('approvals')
      .select('*')
      .or(`status.eq.auto_approved,and(status.eq.pending,auto_approve_at.lte.${now})`)

    if (error) throw error

    for (const approval of ready || []) {
      try {
        const result = await executeAction(approval)

        await supabase
          .from('approvals')
          .update({
            status: 'executed',
            executed_at: now,
            execution_result: result
          })
          .eq('id', approval.id)

        results.executed++
      } catch (err) {
        await supabase
          .from('approvals')
          .update({
            status: 'execution_failed',
            execution_result: { error: err.message }
          })
          .eq('id', approval.id)

        results.failed++
        results.errors.push({ id: approval.id, error: err.message })
      }
    }

    return Response.json({ success: true, ...results })

  } catch (error) {
    return Response.json({ error: error.message, ...results }, { status: 500 })
  }
}
