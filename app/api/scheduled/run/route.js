import { supabase } from '../../../lib/supabase.js'
import { runModule } from '../../../lib/anthropic.js'
import { logModuleRun, queueAction } from '../../../lib/supabase.js'

// POST /api/scheduled/run
// Vercel cron: runs at 06:00 every day
// { "crons": [{ "path": "/api/scheduled/run", "schedule": "0 6 * * *" }] }

const DAILY_MODULES = ['driver_hours', 'fuel', 'vehicle_health', 'driver_retention', 'regulation']
const WEEKLY_MODULES = ['invoice', 'carrier', 'benchmarking', 'tender', 'consolidation']
const MONTHLY_MODULES = ['carbon', 'forecast', 'insurance']

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun, 1=Mon
  const dayOfMonth = now.getDate()

  // Determine which modules to run today
  const modulesToRun = [...DAILY_MODULES]
  if (dayOfWeek === 1) modulesToRun.push(...WEEKLY_MODULES) // Monday
  if (dayOfMonth === 1) modulesToRun.push(...MONTHLY_MODULES) // 1st of month

  const results = { modules_run: 0, actions_queued: 0, errors: [] }

  try {
    // Get all active clients on Autonomous or higher
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*')
      .in('tier', ['autonomous', 'intelligence', 'enterprise'])

    if (error) throw error

    for (const client of clients || []) {
      for (const moduleName of modulesToRun) {
        try {
          // Get the latest data for this module from client config
          const moduleData = getModuleData(moduleName, client)
          if (!moduleData) continue

          const result = await runModule(moduleName, moduleData, client.system_prompt || '')
          const moduleRun = await logModuleRun(client.id, moduleName, moduleData, result)

          results.modules_run++

          // Queue actions
          for (const action of result.actions || []) {
            await queueAction({
              client_id: client.id,
              module_run_id: moduleRun.id,
              action_type: action.type,
              action_label: action.label,
              action_details: { recipient: action.recipient, content: action.content, subject: action.subject, to: action.recipient },
              financial_value: action.financial_value || 0,
              auto_approve: action.auto_approve || false
            })
            results.actions_queued++
          }

        } catch (err) {
          results.errors.push({ client: client.id, module: moduleName, error: err.message })
        }
      }
    }

    return Response.json({ success: true, ...results, modules_checked: modulesToRun })

  } catch (error) {
    return Response.json({ error: error.message, ...results }, { status: 500 })
  }
}

// Get appropriate input data for each scheduled module
// In production this would pull from the client's config/TMS feed
function getModuleData(module, client) {
  const config = client.config || {}

  switch (module) {
    case 'driver_hours':
      return config.drivers || null
    case 'fuel':
      return { vehicles: config.vehicles || [], fuel_card_data: config.fuel || {} }
    case 'vehicle_health':
      return { vehicles: config.vehicles || [] }
    case 'driver_retention':
      return { drivers: config.drivers || [], schedule_data: config.schedule || {} }
    case 'regulation':
      return { fleet_types: config.fleet_types || [], regions: config.regions || ['UK'] }
    case 'invoice':
      return { invoices: config.pending_invoices || [], rate_cards: config.rate_cards || {} }
    case 'carrier':
      return { delivery_data: config.carrier_data || {} }
    case 'benchmarking':
      return { lanes: config.lanes || [], current_rates: config.rates || {} }
    case 'tender':
      return { capabilities: config.capabilities || {}, regions: config.regions || [] }
    case 'consolidation':
      return { schedule: config.todays_schedule || [] }
    case 'carbon':
      return { routes: config.annual_routes || [], fleet: config.vehicles || [] }
    case 'forecast':
      return { historical_volumes: config.historical_volumes || {}, current_capacity: config.capacity || {} }
    case 'insurance':
      return { pending_claims: config.pending_claims || [] }
    default:
      return null
  }
}
