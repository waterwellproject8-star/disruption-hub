import { getDCPCDeadlines, checkCompetitorHiring } from '../../../../lib/intelligence.js'
import { runIntelligenceModule } from '../../../../lib/intelligence-modules.js'
import { supabase } from '../../../../lib/supabase.js'

// POST /api/intelligence/workforce
export async function POST(request) {
  try {
    const { client_id, drivers, contract_pipeline, current_schedule } = await request.json()

    if (!drivers || !Array.isArray(drivers)) {
      return Response.json({ error: 'drivers array required' }, { status: 400 })
    }

    // Pre-calculate DCPC deadlines locally
    const dcpcStatus = getDCPCDeadlines(drivers)

    // Check competitor hiring landscape
    const competitorData = await checkCompetitorHiring()

    let clientContext = ''
    if (client_id) {
      const { data } = await supabase.from('clients').select('system_prompt').eq('id', client_id).single()
      clientContext = data?.system_prompt || ''
    }

    const result = await runIntelligenceModule('workforce', {
      drivers,
      dcpc_urgent: dcpcStatus.urgent,
      dcpc_upcoming: dcpcStatus.upcoming,
      contract_pipeline: contract_pipeline || [],
      current_schedule: current_schedule || {},
      competitor_intelligence: competitorData,
      industry_context: {
        uk_driver_shortage: 50000,
        average_replacement_cost: 7200,
        dcpc_course_cost_estimate: 340,
        agency_driver_cost_premium: '40-60% above employed driver rate',
      }
    }, clientContext)

    // Persist
    if (client_id && result.current_state) {
      await supabase.from('workforce_pipeline').insert({
        client_id,
        assessment_date: new Date().toISOString().split('T')[0],
        total_drivers: result.current_state.total_drivers,
        available_drivers: result.current_state.fully_available,
        dcpc_expiring_30_days: result.current_state.dcpc_lapsing_30_days,
        dcpc_expiring_90_days: result.current_state.dcpc_lapsing_90_days,
        competitor_threats: result.competitor_threat?.competing_operators || [],
        headcount_gap_forecast: result.headcount_forecast || [],
        recommended_actions: result.actions || [],
      })
    }

    return Response.json({ success: true, ...result })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

// GET — latest workforce assessment
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')
  if (!clientId) return Response.json({ error: 'client_id required' }, { status: 400 })

  const { data } = await supabase
    .from('workforce_pipeline')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return Response.json({ assessment: data || null })
}
