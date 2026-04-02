import { runIntelligenceModule } from '../../../lib/intelligence-modules.js'
import { getClientConfig, logModuleRun, queueAction } from '../../../lib/supabase.js'
import { supabase } from '../../../lib/supabase.js'

// POST /api/intelligence
// Body: { module, data, client_id }
// Modules: cargo_theft | workforce | client_churn | cashflow | subcontractor
export async function POST(request) {
  try {
    const { module, data, client_id } = await request.json()

    if (!module || !data) {
      return Response.json({ error: 'module and data required' }, { status: 400 })
    }

    const valid = ['cargo_theft', 'workforce', 'client_churn', 'cashflow', 'subcontractor']
    if (!valid.includes(module)) {
      return Response.json({
        error: `Unknown module: ${module}`,
        available: valid
      }, { status: 400 })
    }

    let clientContext = ''
    let clientTier = 'intelligence'

    if (client_id) {
      try {
        const config = await getClientConfig(client_id)
        clientContext = config?.system_prompt || ''
        clientTier = config?.tier || 'intelligence'
      } catch {}
    }

    // Run the intelligence module
    const result = await runIntelligenceModule(module, data, clientContext)

    // Persist result to module-specific table
    if (client_id) {
      await persistResult(module, client_id, data, result)
    }

    // Queue any actions
    const queuedActions = []
    if (result.actions && Array.isArray(result.actions) && client_id) {
      for (const action of result.actions) {
        try {
          const approval = await queueAction({
            client_id,
            module_run_id: null,
            action_type: action.type,
            action_label: action.label,
            action_details: {
              recipient: action.recipient,
              content: action.content,
              subject: action.label,
              to: action.recipient,
              client: action.client,
              subcontractor: action.subcontractor,
            },
            financial_value: action.financial_value || 0,
            auto_approve: action.auto_approve || false
          })
          queuedActions.push({ ...action, approval_id: approval.id })
        } catch (e) {
          queuedActions.push({ ...action, queue_error: e.message })
        }
      }
    }

    return Response.json({
      success: true,
      module,
      result,
      actions_queued: queuedActions.length,
      actions: queuedActions
    })

  } catch (error) {
    console.error('Intelligence module error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({
    available_modules: [
      { id: 'cargo_theft',   label: 'Cargo Theft Intelligence',     tier: 'intelligence', category: 'security'  },
      { id: 'workforce',     label: 'Driver Workforce Pipeline',     tier: 'intelligence', category: 'people'    },
      { id: 'client_churn',  label: 'Client Churn Prediction',       tier: 'intelligence', category: 'commercial'},
      { id: 'cashflow',      label: 'Cash Flow Intelligence',         tier: 'intelligence', category: 'financial' },
      { id: 'subcontractor', label: 'Subcontractor Trust Score',      tier: 'intelligence', category: 'security'  },
    ]
  })
}

// ── PERSIST RESULTS TO MODULE-SPECIFIC TABLES ─────────────────────────────────
async function persistResult(module, clientId, input, result) {
  try {
    switch (module) {
      case 'cargo_theft':
        if (result.threat_assessment) {
          await supabase.from('theft_risk_assessments').insert({
            client_id: clientId,
            job_ref: input.job_ref || 'ASSESSMENT',
            vehicle_reg: input.vehicle_reg,
            driver_name: input.driver_name,
            cargo_type: input.cargo_type,
            cargo_value: input.cargo_value,
            route_origin: input.origin,
            route_destination: input.destination,
            departure_time: input.departure_time,
            risk_score: result.threat_assessment.risk_score,
            risk_level: result.threat_assessment.risk_level,
            risk_factors: result.threat_factors || [],
            dangerous_stops: result.dangerous_stops || [],
            recommended_stops: result.recommended_stops || [],
            reroute_recommended: (result.dangerous_stops || []).length > 0,
          })
        }
        break

      case 'workforce':
        if (result.current_state) {
          await supabase.from('workforce_pipeline').upsert({
            client_id: clientId,
            assessment_date: new Date().toISOString().split('T')[0],
            total_drivers: result.current_state.total_drivers,
            available_drivers: result.current_state.fully_available,
            dcpc_expiring_30_days: result.current_state.dcpc_lapsing_30_days,
            dcpc_expiring_90_days: result.current_state.dcpc_lapsing_90_days,
            flight_risk_drivers: result.current_state.at_risk_of_departure || 0,
            competitor_threats: result.competitor_threat?.competing_operators || [],
            headcount_gap_forecast: result.headcount_forecast || [],
            recommended_hires: result.hiring_recommendation ? 1 : 0,
            recommended_actions: result.actions || [],
          }, { onConflict: 'client_id,assessment_date' })
        }
        break

      case 'client_churn':
        if (result.client_assessments) {
          for (const client of result.client_assessments) {
            await supabase.from('client_health_scores').upsert({
              client_id: clientId,
              monitored_client_name: client.client_name,
              churn_probability: client.churn_probability,
              internal_signals: client.all_signals || [],
              recommended_actions: client.retention_plan ? [client.retention_plan] : [],
              last_assessed: new Date().toISOString(),
            }, { onConflict: 'client_id,monitored_client_name' })
          }
        }
        break

      case 'cashflow':
        if (result.weekly_forecast) {
          const today = new Date()
          const endDate = new Date(today.getTime() + 84 * 24 * 60 * 60 * 1000)
          await supabase.from('cashflow_forecasts').insert({
            client_id: clientId,
            forecast_date: today.toISOString().split('T')[0],
            period_start: today.toISOString().split('T')[0],
            period_end: endDate.toISOString().split('T')[0],
            weekly_forecasts: result.weekly_forecast,
            trough_detected: result.summary?.trough_detected || false,
            trough_week: result.summary?.trough_week,
            trough_amount: result.summary?.trough_amount,
            trough_actions: result.actions || [],
          })
        }
        break

      case 'subcontractor':
        if (result.subcontractor_scores) {
          for (const sub of result.subcontractor_scores) {
            await supabase.from('subcontractor_scores').upsert({
              client_id: clientId,
              subcontractor_name: sub.name,
              trust_score: sub.trust_score,
              financial_health_score: sub.financial_health_score,
              operational_score: sub.operational_score,
              ghost_risk_score: sub.ghost_risk_score,
              red_flags: sub.red_flags || [],
              positive_signals: sub.positive_signals || [],
              jobs_completed: sub.jobs_completed || 0,
              status: sub.status === 'BLOCKED' ? 'blocked' : sub.status === 'SUSPENDED' ? 'suspended' : 'active',
              last_full_assessment: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'client_id,subcontractor_name' })
          }

          // Persist ghost freight alerts
          for (const alert of result.ghost_freight_alerts || []) {
            await supabase.from('ghost_freight_alerts').insert({
              client_id: clientId,
              job_ref: alert.job_ref,
              subcontractor_name: alert.subcontractor,
              alert_type: alert.alert_type,
              risk_level: alert.severity,
            })
          }
        }
        break
    }
  } catch (err) {
    console.error('Failed to persist intelligence result:', err)
    // Non-fatal — module result is still returned
  }
}
