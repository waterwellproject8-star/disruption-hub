import { calculateTheftRisk, THEFT_PATTERNS } from '../../../../lib/intelligence.js'
import { runIntelligenceModule } from '../../../../lib/intelligence-modules.js'
import { supabase } from '../../../../lib/supabase.js'

// POST /api/intelligence/cargo-theft
// Real-time risk score + full agent analysis
// Also called automatically when a new job is created with high-value cargo
export async function POST(request) {
  try {
    const body = await request.json()
    const {
      client_id, job_ref, cargo_type, cargo_value,
      vehicle_reg, driver_name, driver_hours_remaining,
      origin, destination, route, departure_time,
      skip_ai = false // set true for fast pre-screening only
    } = body

    if (!cargo_type) {
      return Response.json({ error: 'cargo_type required' }, { status: 400 })
    }

    // Step 1: Fast local risk calculation (no AI, instant)
    const localRisk = calculateTheftRisk({
      cargo_type, cargo_value, route: `${origin} ${destination} ${route}`,
      departure_time, driver_hours_remaining
    })

    // If low risk and skip_ai, return immediately
    if (skip_ai || localRisk.score < 35) {
      return Response.json({
        success: true,
        source: 'local_calculation',
        risk_score: localRisk.score,
        risk_level: localRisk.level,
        factors: localRisk.factors,
        dangerous_stops: localRisk.dangerous_stops,
        recommended_stops: localRisk.recommended_stops,
        full_analysis: null,
        message: localRisk.score < 35 ? 'Low risk — full AI analysis not required' : null
      })
    }

    // Step 2: Full AI analysis for MEDIUM/HIGH/CRITICAL
    const aiInput = {
      job_ref, cargo_type, cargo_value, vehicle_reg,
      driver_name, driver_hours_remaining,
      origin, destination, route, departure_time,
      pre_calculated_risk: localRisk,
      navci_patterns: {
        cargo_category_risk: THEFT_PATTERNS.cargo_risk[
          Object.keys(THEFT_PATTERNS.cargo_risk).find(k =>
            cargo_type?.toLowerCase().includes(k)
          ) || 'general freight'
        ],
        high_risk_corridors: THEFT_PATTERNS.high_risk_corridors.filter(c =>
          (`${origin} ${destination} ${route}`).toUpperCase().includes(c.name.split(' ')[0])
        ),
        secure_parking_options: THEFT_PATTERNS.secure_parking,
      }
    }

    let clientContext = ''
    if (client_id) {
      const { data } = await supabase.from('clients').select('system_prompt').eq('id', client_id).single()
      clientContext = data?.system_prompt || ''
    }

    const result = await runIntelligenceModule('cargo_theft', aiInput, clientContext)

    // Save to database
    if (client_id && result.threat_assessment) {
      await supabase.from('theft_risk_assessments').insert({
        client_id, job_ref: job_ref || 'ASSESSMENT',
        vehicle_reg, driver_name, cargo_type, cargo_value,
        route_origin: origin, route_destination: destination,
        departure_time,
        risk_score: result.threat_assessment.risk_score,
        risk_level: result.threat_assessment.risk_level,
        risk_factors: result.threat_factors || [],
        dangerous_stops: result.dangerous_stops || [],
        recommended_stops: result.recommended_stops || [],
        reroute_recommended: (result.dangerous_stops || []).length > 0,
      })
    }

    return Response.json({ success: true, source: 'ai_analysis', ...result })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

// GET /api/intelligence/cargo-theft?client_id=xxx&days=30
// Returns historical risk assessments and patterns
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')
  const days = parseInt(searchParams.get('days') || '30')

  if (!clientId) return Response.json({ error: 'client_id required' }, { status: 400 })

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('theft_risk_assessments')
    .select('*')
    .eq('client_id', clientId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const summary = {
    total_assessments: data.length,
    critical: data.filter(r => r.risk_level === 'CRITICAL').length,
    high: data.filter(r => r.risk_level === 'HIGH').length,
    medium: data.filter(r => r.risk_level === 'MEDIUM').length,
    low: data.filter(r => r.risk_level === 'LOW').length,
    avg_risk_score: data.length ? Math.round(data.reduce((a, r) => a + r.risk_score, 0) / data.length) : 0,
  }

  return Response.json({ assessments: data, summary })
}
