import { getCompaniesHouseData } from '../../../../lib/intelligence.js'
import { runIntelligenceModule } from '../../../../lib/intelligence-modules.js'
import { supabase } from '../../../../lib/supabase.js'

// POST /api/intelligence/subcontractor
export async function POST(request) {
  try {
    const { client_id, subcontractors, active_jobs } = await request.json()

    if (!subcontractors || !Array.isArray(subcontractors)) {
      return Response.json({ error: 'subcontractors array required' }, { status: 400 })
    }

    // Enrich each subcontractor with Companies House data
    const enriched = []
    for (const sub of subcontractors) {
      const enrichedSub = { ...sub }
      try {
        const chData = await getCompaniesHouseData(sub.name)
        enrichedSub.companies_house = chData
        enrichedSub.financial_health_score = chData.financial_health_score || 70
        enrichedSub.ch_red_flags = chData.red_flags || []
        enrichedSub.company_status = chData.status
        enrichedSub.incorporation_date = chData.incorporation_date
        enrichedSub.charges_outstanding = chData.charges_outstanding || 0
      } catch {}

      enriched.push(enrichedSub)
      await new Promise(r => setTimeout(r, 300))
    }

    // Ghost freight detection — cross-reference active jobs
    const ghostSignals = []
    for (const job of active_jobs || []) {
      const sub = enriched.find(s => s.name === job.subcontractor)
      if (!sub) continue

      // New company on high-value load
      if (sub.incorporation_date) {
        const ageMonths = (new Date() - new Date(sub.incorporation_date)) / (1000 * 60 * 60 * 24 * 30)
        if (ageMonths < 6 && job.cargo_value > 10000) {
          ghostSignals.push({
            job_ref: job.ref,
            subcontractor: sub.name,
            alert_type: 'new_company',
            severity: ageMonths < 3 ? 'CRITICAL' : 'HIGH',
            detail: `${sub.name} incorporated ${Math.round(ageMonths)} months ago — unusually new company for a ${job.cargo_type} load worth £${Number(job.cargo_value).toLocaleString()}`,
            recommended_action: 'Verify identity documents and vehicle ownership before cargo release',
            block_dispatch: ageMonths < 3,
          })
        }
      }

      // Vehicle mismatch detection
      if (job.expected_vehicle_reg && job.actual_vehicle_reg &&
          job.expected_vehicle_reg !== job.actual_vehicle_reg) {
        ghostSignals.push({
          job_ref: job.ref,
          subcontractor: sub.name,
          alert_type: 'vehicle_mismatch',
          severity: 'HIGH',
          detail: `Expected ${job.expected_vehicle_reg} but ${job.actual_vehicle_reg} presented at collection`,
          recommended_action: 'Do not release cargo. Call subcontractor MD directly on known number. Not on number they gave at collection.',
          block_dispatch: true,
        })
      }

      // Dissolved company
      if (sub.company_status === 'dissolved' || sub.company_status === 'liquidation') {
        ghostSignals.push({
          job_ref: job.ref,
          subcontractor: sub.name,
          alert_type: 'flagged_company',
          severity: 'CRITICAL',
          detail: `${sub.name} is ${sub.company_status} at Companies House`,
          recommended_action: 'Block all jobs immediately. Do not release any cargo. Review all recent jobs with this subcontractor.',
          block_dispatch: true,
        })
      }
    }

    let clientContext = ''
    if (client_id) {
      const { data } = await supabase.from('clients').select('system_prompt').eq('id', client_id).single()
      clientContext = data?.system_prompt || ''
    }

    const result = await runIntelligenceModule('subcontractor', {
      subcontractors: enriched,
      active_jobs: active_jobs || [],
      pre_detected_ghost_signals: ghostSignals,
    }, clientContext)

    // Merge pre-detected ghost signals with AI results
    const allAlerts = [...(result.ghost_freight_alerts || []), ...ghostSignals.filter(g =>
      !(result.ghost_freight_alerts || []).some(r => r.job_ref === g.job_ref && r.alert_type === g.alert_type)
    )]

    // Persist
    if (client_id) {
      for (const sub of result.subcontractor_scores || []) {
        await supabase.from('subcontractor_scores').upsert({
          client_id,
          subcontractor_name: sub.name,
          trust_score: sub.trust_score,
          financial_health_score: sub.financial_health_score,
          operational_score: sub.operational_score,
          ghost_risk_score: sub.ghost_risk_score,
          red_flags: sub.red_flags || [],
          positive_signals: sub.positive_signals || [],
          jobs_completed: sub.jobs_completed || 0,
          status: sub.status === 'BLOCKED' ? 'blocked' : 'active',
          last_full_assessment: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'client_id,subcontractor_name' })
      }

      for (const alert of allAlerts) {
        await supabase.from('ghost_freight_alerts').insert({
          client_id, job_ref: alert.job_ref, subcontractor_name: alert.subcontractor,
          alert_type: alert.alert_type, risk_level: alert.severity,
        }).select()
      }
    }

    return Response.json({ success: true, ...result, ghost_freight_alerts: allAlerts })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

// GET — current trust scores
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')
  if (!clientId) return Response.json({ error: 'client_id required' }, { status: 400 })

  const [{ data: scores }, { data: alerts }] = await Promise.all([
    supabase.from('subcontractor_scores').select('*').eq('client_id', clientId).order('trust_score'),
    supabase.from('ghost_freight_alerts').select('*').eq('client_id', clientId).eq('resolved', false).order('created_at', { ascending: false }).limit(20)
  ])

  return Response.json({ subcontractors: scores || [], ghost_alerts: alerts || [] })
}
