import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { sendSMS } from '../../../../lib/twilio.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

async function buildClientStats(db, clientId, periodStart, periodEnd) {
  const [incRes, appRes, modRes] = await Promise.all([
    db.from('incidents').select('*').eq('client_id',clientId).gte('created_at',periodStart).lte('created_at',periodEnd),
    db.from('approvals').select('*').eq('client_id',clientId).gte('created_at',periodStart).lte('created_at',periodEnd),
    db.from('module_runs').select('*').eq('client_id',clientId).gte('created_at',periodStart).lte('created_at',periodEnd),
  ])
  const incidents = incRes.data || []
  const approvals = appRes.data || []
  const moduleRuns = modRes.data || []

  const totalIncidents    = incidents.length
  const criticalCount     = incidents.filter(i=>i.severity==='CRITICAL').length
  const highCount         = incidents.filter(i=>i.severity==='HIGH').length
  const actionsExecuted   = approvals.filter(a=>a.status==='executed').length
  const actionsRejected   = approvals.filter(a=>a.status==='rejected').length
  const slaBreachesPrevented = incidents.filter(i=>
    i.user_input?.toLowerCase().includes('sla') ||
    i.ai_response?.toLowerCase().includes('slot') ||
    i.ai_response?.toLowerCase().includes('sla breach prevented')
  ).length
  const minutesSaved      = totalIncidents * 25
  const hoursSaved        = Math.round(minutesSaved / 60 * 10) / 10
  const financialProtected = incidents.filter(i=>i.financial_impact>0).reduce((s,i)=>s+(i.financial_impact||0),0)
  const invoiceRecovery   = moduleRuns.filter(m=>m.module==='invoice').reduce((s,m)=>s+(m.output?.total_overcharge||m.financial_impact||0),0)
  const moduleRunsTotal   = moduleRuns.length
  const severityBreakdown = {
    CRITICAL: criticalCount, HIGH: highCount,
    MEDIUM: incidents.filter(i=>i.severity==='MEDIUM').length,
    LOW: incidents.filter(i=>i.severity==='LOW').length
  }
  return { totalIncidents, criticalCount, highCount, actionsExecuted, actionsRejected,
    slaBreachesPrevented, hoursSaved, financialProtected, invoiceRecovery,
    moduleRunsTotal, severityBreakdown }
}

async function generateNarrative(client, stats, period) {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{ role: 'user', content:
`Write a concise professional monthly operations report for ${client.name} (${client.fleet_size} vehicles, ${client.tier} tier). Period: ${period}.

Stats: ${stats.totalIncidents} disruptions, ${stats.criticalCount} critical, ${stats.highCount} high severity, ${stats.actionsExecuted} actions executed, ${stats.slaBreachesPrevented} SLA breaches prevented, £${stats.financialProtected.toLocaleString()} financial exposure managed, £${stats.invoiceRecovery.toLocaleString()} invoice recovery identified, ${stats.hoursSaved} hours saved, ${stats.moduleRunsTotal} module runs.

Write exactly 3 short paragraphs: (1) performance summary with headline numbers, (2) key wins this month with specific financial impact, (3) what to watch next month based on patterns. Be specific, no filler. Max 180 words.` }]
  })
  return msg.content[0].text.trim()
}

async function gradeModules(db, clientId, periodStart, periodEnd) {
  const { data: runs } = await db.from('module_runs').select('*')
    .eq('client_id',clientId).gte('created_at',periodStart).lte('created_at',periodEnd)
    .order('created_at',{ascending:false})
  if (!runs?.length) return null

  const ALL_MODULES = [
    'disruption','sla_prediction','invoice','driver_hours','hazmat','carrier','fuel',
    'vehicle_health','driver_retention','carbon','tender','regulation','consolidation',
    'forecast','benchmarking','insurance','cargo_theft','ghost_freight','subcontractor',
    'cash_flow','churn_prediction','workforce_pipeline'
  ]
  const grades = {}
  for (const m of ALL_MODULES) {
    const mr = runs.filter(r=>r.module===m)
    if (!mr.length) { grades[m]={grade:'NOT_RUN',runs:0,issues_found:0,financial:0}; continue }
    const issues = mr.filter(r=>r.severity==='HIGH'||r.severity==='CRITICAL')
    const financial = mr.reduce((s,r)=>s+(r.financial_impact||0),0)
    grades[m]={ grade: issues.length>0?'A':'B', runs:mr.length, issues_found:issues.length, financial, last_ran:mr[0].created_at }
  }
  const aCount = Object.values(grades).filter(g=>g.grade==='A').length
  const bCount = Object.values(grades).filter(g=>g.grade==='B').length
  const notRun = Object.values(grades).filter(g=>g.grade==='NOT_RUN').length
  return { grades, summary:{ active:aCount+bCount, issues_found:aCount, clean:bCount, not_run:notRun } }
}

export async function POST(request) {
  try {
    const { client_id, period_override } = await request.json()
    const db = getDB()
    if (!db) return Response.json({ error:'Database not configured' },{status:500})

    const { data: client } = await db.from('clients').select('*').eq('id',client_id).single()
    if (!client) return Response.json({ error:'Client not found' },{status:404})

    const now = new Date()
    const periodStart = period_override?.start || new Date(now.getFullYear(),now.getMonth()-1,1).toISOString()
    const periodEnd   = period_override?.end   || new Date(now.getFullYear(),now.getMonth(),0,23,59,59).toISOString()
    const periodLabel = period_override?.label || new Date(now.getFullYear(),now.getMonth()-1,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'})

    const stats       = await buildClientStats(db, client_id, periodStart, periodEnd)
    const narrative   = await generateNarrative(client, stats, periodLabel)
    const moduleAudit = await gradeModules(db, client_id, periodStart, periodEnd)

    const report = {
      client_id, client_name:client.name, period:periodLabel,
      generated_at: now.toISOString(),
      stats:{
        total_incidents: stats.totalIncidents,
        critical_incidents: stats.criticalCount,
        high_incidents: stats.highCount,
        sla_breaches_prevented: stats.slaBreachesPrevented,
        actions_executed: stats.actionsExecuted,
        hours_saved: stats.hoursSaved,
        financial_exposure_managed: stats.financialProtected,
        invoice_recovery_identified: stats.invoiceRecovery,
        total_value_protected: stats.financialProtected + stats.invoiceRecovery,
        module_runs: stats.moduleRunsTotal,
        severity_breakdown: stats.severityBreakdown,
      },
      narrative, module_audit: moduleAudit
    }

    // Save report
    await db.from('monthly_reports').insert({ client_id, period:periodLabel, report_data:report, generated_at:now.toISOString() }).catch(()=>{})

    // SMS notification to ops manager
    if (client.contact_phone) {
      const valueLine = report.stats.total_value_protected > 0
        ? `£${report.stats.total_value_protected.toLocaleString()} protected`
        : `${report.stats.total_incidents} disruptions handled`
      await sendSMS(client.contact_phone,
        `DisruptionHub Monthly Report — ${periodLabel}\n${client.name}\n\n${valueLine} · ${report.stats.hours_saved}h saved · ${report.stats.sla_breaches_prevented} SLA breaches prevented\n\nFull report in dashboard. Reply OPEN to review.`)
    }

    return Response.json({ success:true, report })
  } catch (e) {
    console.error('Monthly report error:', e.message)
    return Response.json({ error:e.message },{status:500})
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const client_id = searchParams.get('client_id')
    if (!client_id) return Response.json({ error:'client_id required' },{status:400})
    const db = getDB()
    if (!db) return Response.json({ report:null })
    const { data } = await db.from('monthly_reports').select('*').eq('client_id',client_id)
      .order('generated_at',{ascending:false}).limit(1)
    return Response.json({ report: data?.[0]?.report_data || null })
  } catch (e) {
    return Response.json({ error:e.message },{status:500})
  }
}
