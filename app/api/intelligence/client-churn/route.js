import { monitorClientForTenders, getCompaniesHouseData } from '../../../../lib/intelligence.js'
import { runIntelligenceModule } from '../../../../lib/intelligence-modules.js'
import { supabase } from '../../../../lib/supabase.js'

// POST /api/intelligence/client-churn
// Runs churn analysis with live Contracts Finder + Companies House data
export async function POST(request) {
  try {
    const { client_id, clients } = await request.json()

    if (!clients || !Array.isArray(clients) || clients.length === 0) {
      return Response.json({ error: 'clients array required' }, { status: 400 })
    }

    // Enrich each client with live external data
    const enriched = []
    for (const client of clients) {
      const enrichedClient = { ...client }

      // Contracts Finder — is this client running a quiet tender?
      try {
        const tenderAlerts = await monitorClientForTenders(client.name)
        enrichedClient.contracts_finder_alerts = tenderAlerts
        if (tenderAlerts.length > 0) {
          enrichedClient.tender_detected = true
          enrichedClient.latest_tender = tenderAlerts[0]
        }
      } catch {}

      // Companies House — financial health
      try {
        const chData = await getCompaniesHouseData(client.name)
        enrichedClient.companies_house = chData
        if (chData.found) {
          enrichedClient.company_status = chData.status
          enrichedClient.financial_flags = chData.red_flags || []
        }
      } catch {}

      enriched.push(enrichedClient)
      // Rate limit — be respectful to free APIs
      await new Promise(r => setTimeout(r, 300))
    }

    // Get client system context
    let clientContext = ''
    if (client_id) {
      const { data } = await supabase.from('clients').select('system_prompt').eq('id', client_id).single()
      clientContext = data?.system_prompt || ''
    }

    // Run AI analysis
    const result = await runIntelligenceModule('client_churn', { clients: enriched }, clientContext)

    // Persist scores
    if (client_id && result.client_assessments) {
      for (const assessment of result.client_assessments) {
        await supabase.from('client_health_scores').upsert({
          client_id,
          monitored_client_name: assessment.client_name,
          churn_probability: assessment.churn_probability,
          internal_signals: assessment.all_signals || [],
          external_signals: enriched.find(c => c.name === assessment.client_name)?.contracts_finder_alerts || [],
          contracts_finder_alerts: enriched.find(c => c.name === assessment.client_name)?.contracts_finder_alerts || [],
          recommended_actions: assessment.retention_plan ? [assessment.retention_plan] : [],
          last_assessed: new Date().toISOString(),
        }, { onConflict: 'client_id,monitored_client_name' })
      }
    }

    return Response.json({ success: true, ...result, enriched_client_count: enriched.length })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

// GET /api/intelligence/client-churn?client_id=xxx
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')
  if (!clientId) return Response.json({ error: 'client_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('client_health_scores')
    .select('*')
    .eq('client_id', clientId)
    .order('churn_probability', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({
    clients: data,
    high_risk: data.filter(c => c.churn_probability >= 70).length,
    total_monitored: data.length
  })
}
