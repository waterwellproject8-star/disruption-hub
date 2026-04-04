import { runModule } from '../../../../lib/anthropic.js'
import { logModuleRun, queueAction, getClientConfig } from '../../../../lib/supabase.js'

// POST /api/webhooks/tms
// Receives disruption alerts from TMS systems (Mandata, Microlise, Truckcom, Descartes)
// and auto-triggers the disruption analysis module

export async function POST(request) {
  try {
    const body = await request.json()

    // Each TMS sends slightly different formats — normalise them
    const alert = normaliseTMSAlert(body)

    if (!alert) {
      return Response.json({ error: 'Unrecognised TMS format' }, { status: 400 })
    }

    // Look up client by API key in header or webhook secret
    const webhookKey = request.headers.get('x-webhook-key') || request.headers.get('authorization')?.replace('Bearer ', '')
    const clientId = await getClientByWebhookKey(webhookKey)

    if (!clientId) {
      return Response.json({ error: 'Invalid webhook key' }, { status: 401 })
    }

    const clientConfig = await getClientConfig(clientId)

    // Run disruption analysis automatically
    const result = await runModule('disruption', alert, clientConfig?.system_prompt || '')
    const moduleRun = await logModuleRun(clientId, 'disruption', alert, result)

    // Queue all recommended actions
    const queuedActions = []
    for (const action of result.actions || []) {
      const approval = await queueAction({
        client_id: clientId,
        module_run_id: moduleRun.id,
        action_type: action.type,
        action_label: action.label,
        action_details: { recipient: action.recipient, content: action.content, subject: action.subject, to: action.recipient },
        financial_value: action.financial_value || 0,
        auto_approve: action.auto_approve || false
      })
      queuedActions.push(approval)
    }

    return Response.json({
      success: true,
      module_run_id: moduleRun.id,
      severity: result.severity,
      financial_impact: result.financial_impact,
      actions_queued: queuedActions.length
    })

  } catch (error) {
    console.error('TMS webhook error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}

// ── NORMALISE TMS FORMATS ─────────────────────────────────────────────────────
function normaliseTMSAlert(body) {
  // Mandata format
  if (body.alert_type && body.vehicle_id) {
    return {
      source: 'Mandata',
      alert_type: body.alert_type,
      vehicle: body.vehicle_id,
      driver: body.driver_name,
      location: body.location,
      shipment_refs: body.job_refs || [],
      description: body.alert_description,
      timestamp: body.timestamp
    }
  }

  // Microlise format
  if (body.eventType && body.vehicleRegistration) {
    return {
      source: 'Microlise',
      alert_type: body.eventType,
      vehicle: body.vehicleRegistration,
      driver: body.driverName,
      location: body.location?.address,
      shipment_refs: [],
      description: body.eventDescription,
      timestamp: body.eventTime
    }
  }

  // Truckcom format
  if (body.incident_code && body.reg_no) {
    return {
      source: 'Truckcom',
      alert_type: body.incident_code,
      vehicle: body.reg_no,
      driver: body.driver,
      location: body.gps_location,
      shipment_refs: body.consignments || [],
      description: body.incident_description,
      timestamp: body.incident_time
    }
  }

  // Generic / custom format
  if (body.description || body.disruption) {
    return {
      source: 'Custom',
      alert_type: body.type || 'unknown',
      vehicle: body.vehicle || body.reg,
      driver: body.driver,
      location: body.location,
      shipment_refs: body.refs || body.shipments || [],
      description: body.description || body.disruption,
      timestamp: body.timestamp || new Date().toISOString()
    }
  }

  return null
}

// Stub — in production this would look up the webhook key in Supabase
async function getClientByWebhookKey(key) {
  if (!key) return null
  // In production: query clients table for webhook_key = key
  // For now return a default during development
  return process.env.DEFAULT_CLIENT_ID || null
}
