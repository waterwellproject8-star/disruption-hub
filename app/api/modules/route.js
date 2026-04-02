import { runModule } from '../../../lib/anthropic.js'
import { logModuleRun, queueAction, getClientConfig } from '../../../lib/supabase.js'

// POST /api/modules
// Body: { module, data, client_id }
export async function POST(request) {
  try {
    const body = await request.json()
    const { module, data, client_id } = body

    if (!module || !data) {
      return Response.json({ error: 'module and data are required' }, { status: 400 })
    }

    // Get client config and system prompt if client_id provided
    let clientSystemPrompt = ''
    let clientConfig = null

    if (client_id) {
      try {
        clientConfig = await getClientConfig(client_id)
        clientSystemPrompt = clientConfig?.system_prompt || ''
      } catch {
        // Client not found — proceed without client context
      }
    }

    // Run the module
    const result = await runModule(module, data, clientSystemPrompt)

    // Log the run
    let moduleRun = null
    if (client_id) {
      try {
        moduleRun = await logModuleRun(client_id, module, data, result)
      } catch (e) {
        console.error('Failed to log module run:', e)
      }
    }

    // Queue any actions from the result
    const queuedActions = []
    if (result.actions && Array.isArray(result.actions) && client_id && moduleRun) {
      for (const action of result.actions) {
        try {
          const approval = await queueAction({
            client_id,
            module_run_id: moduleRun.id,
            action_type: action.type,
            action_label: action.label,
            action_details: {
              recipient: action.recipient,
              content: action.content,
              subject: action.subject,
              to: action.recipient
            },
            financial_value: action.financial_value || 0,
            auto_approve: action.auto_approve || false
          })
          queuedActions.push({ ...action, approval_id: approval.id, approval_status: approval.status })
        } catch (e) {
          console.error('Failed to queue action:', e)
          queuedActions.push({ ...action, queue_error: e.message })
        }
      }
    }

    return Response.json({
      success: true,
      module,
      result,
      module_run_id: moduleRun?.id,
      actions_queued: queuedActions.length,
      actions: queuedActions
    })

  } catch (error) {
    console.error('Module error:', error)
    return Response.json(
      { error: 'Module failed', details: error.message },
      { status: 500 }
    )
  }
}

// GET /api/modules?module=invoice&client_id=xxx — return module status/history
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const module = searchParams.get('module')
  const client_id = searchParams.get('client_id')

  return Response.json({
    available_modules: [
      'disruption', 'invoice', 'carrier', 'driver_hours', 'driver_retention',
      'vehicle_health', 'carbon', 'tender', 'fuel', 'regulation',
      'hazmat', 'sla_prediction', 'consolidation', 'forecast',
      'benchmarking', 'insurance'
    ],
    requested_module: module,
    client_id
  })
}
