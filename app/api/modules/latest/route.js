import { createClient } from '@supabase/supabase-js'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

// GET /api/modules/latest?client_id=pearson-haulage
// Returns the most recent run result for each module
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const client_id = searchParams.get('client_id') || 'pearson-haulage'
    const db = getDB()
    if (!db) return Response.json({ latest: {} })

    // Get most recent run for each module
    const { data, error } = await db
      .from('module_runs')
      .select('module, output, severity, financial_impact, status, created_at')
      .eq('client_id', client_id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    // Deduplicate — keep only the latest run per module
    const latest = {}
    for (const row of (data || [])) {
      if (!latest[row.module]) {
        latest[row.module] = {
          severity: row.severity,
          financial_impact: row.financial_impact,
          ran_at: row.created_at,
          status: row.status,
          has_issues: row.severity === 'CRITICAL' || row.severity === 'HIGH' ||
            (row.output?.discrepancies?.length > 0) ||
            (row.output?.result?.discrepancies?.length > 0) ||
            (row.output?.compliance_failures?.length > 0) ||
            (row.output?.result?.compliance_failures?.length > 0) ||
            (row.output?.drivers_at_risk?.length > 0) ||
            (row.output?.result?.drivers_at_risk?.length > 0) ||
            (row.output?.vehicles_at_risk?.length > 0) ||
            (row.output?.result?.vehicles_at_risk?.length > 0) ||
            (row.output?.flags?.length > 0) ||
            (row.output?.result?.flags?.length > 0) ||
            (row.output?.all_clear === false) ||
            (row.output?.result?.all_clear === false)
        }
      }
    }

    return Response.json({ latest })
  } catch (e) {
    console.error('Module latest error:', e.message)
    return Response.json({ latest: {} })
  }
}
