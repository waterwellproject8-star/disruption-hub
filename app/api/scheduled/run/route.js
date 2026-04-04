import { runModule } from '../../../../lib/anthropic.js'
import { runRegulationMonitor, generateWeeklyComplianceDigest } from '../../../../lib/regulation-monitor.js'
import { createClient } from '@supabase/supabase-js'
import { sendSMS } from '../../../../lib/twilio.js'

const DAILY_MODULES   = ['driver_hours','fuel','vehicle_health','sla_prediction','hazmat','regulation']
const WEEKLY_MODULES  = ['invoice','carrier','benchmarking','tender','consolidation','driver_retention']
const MONTHLY_MODULES = ['carbon','forecast','insurance']

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now     = new Date()
  const dow     = now.getDay()
  const dom     = now.getDate()
  const isMonday = dow === 1
  const isFirst  = dom === 1

  const modulesToRun = [...DAILY_MODULES]
  if (isMonday) modulesToRun.push(...WEEKLY_MODULES)
  if (isFirst)  modulesToRun.push(...MONTHLY_MODULES)

  const results = { ran_at: now.toISOString(), clients: [], errors: [] }
  const db = getDB()
  if (!db) return Response.json({ success: false, reason: 'no_db' })

  // Get all active clients
  const { data: clients } = await db.from('clients').select('*').eq('active', true)
  if (!clients?.length) return Response.json({ success: true, message: 'No active clients', ...results })

  for (const client of clients) {
    const clientResult = { id: client.id, modules_run: 0, alerts_sent: 0, errors: [] }

    for (const moduleId of modulesToRun) {
      try {
        // Run the module with client system prompt context
        const moduleData = {
          client_id: client.id,
          fleet_size: client.fleet_size,
          trigger: 'scheduled',
          timestamp: now.toISOString()
        }
        const result = await runModule(moduleId, moduleData, client.system_prompt)

        // Save to module_runs table
        const { data: savedRun } = await db.from('module_runs').insert({
          client_id: client.id,
          module: moduleId,
          input: moduleData,
          output: result,
          severity: result?.severity || result?.result?.severity || null,
          financial_impact: result?.financial_impact || result?.result?.financial_impact || 0,
          status: 'complete'
        }).select().single()

        clientResult.modules_run++

        // Determine if this result needs an alert
        const severity = result?.severity || result?.result?.severity ||
          result?.all_clear === false ? 'HIGH' : null
        const financial = result?.financial_impact || result?.result?.financial_impact ||
          result?.total_overcharge || result?.total_breakdown_risk || 0

        const needsAlert = severity === 'CRITICAL' || severity === 'HIGH' ||
          (financial > 500) ||
          (result?.compliance_failures?.length > 0) ||
          (result?.flags_found > 0) ||
          (result?.drivers_at_risk?.length > 0) ||
          (result?.vehicles_at_risk?.length > 0) ||
          (result?.discrepancies?.length > 0)

        // Send SMS alert for Autonomous tier clients
        if (needsAlert && client.tier === 'autonomous' && client.contact_phone) {
          const moduleLabel = {
            driver_hours: 'Driver Hours Monitor',
            vehicle_health: 'Vehicle Health',
            sla_prediction: 'SLA Prediction',
            invoice: 'Invoice Recovery',
            hazmat: 'Hazmat Check',
            regulation: 'Regulation Alert',
            carrier: 'Carrier Scorecard',
            fuel: 'Fuel Optimisation',
            driver_retention: 'Driver Retention'
          }[moduleId] || moduleId

          const alertDetail = buildModuleAlertSummary(moduleId, result)
          const smsBody = `DisruptionHub — ${severity || 'ACTION REQUIRED'}\n${moduleLabel}\n${alertDetail}\nFinancial: £${Number(financial).toLocaleString()}\n\nOpen dashboard to review. Reply OPEN for link.`

          await sendSMS(client.contact_phone, smsBody)
          clientResult.alerts_sent++

          // Also create a pending approval for the first recommended action
          const firstAction = result?.actions?.[0] || result?.result?.actions?.[0]
          if (firstAction && savedRun) {
            await db.from('approvals').insert({
              client_id: client.id,
              module_run_id: savedRun.id,
              action_type: firstAction.type || 'email',
              action_label: firstAction.label || firstAction.content?.substring(0,100) || 'Review module results',
              action_details: firstAction,
              financial_value: financial,
              status: 'pending'
            })
          }
        }

      } catch (e) {
        clientResult.errors.push(`${moduleId}: ${e.message}`)
        results.errors.push(`${client.id}/${moduleId}: ${e.message}`)
      }
    }

    // Run regulation monitor for all clients
    try {
      const regResult = await runRegulationMonitor({ fleet_type: client.system_prompt })
      if (regResult.relevant_changes?.length > 0) {
        await db.from('module_runs').insert({
          client_id: client.id,
          module: 'regulation',
          input: { trigger: 'scheduled' },
          output: regResult,
          severity: regResult.relevant_changes[0]?.urgency === 'IMMEDIATE' ? 'CRITICAL' : 'MEDIUM',
          status: 'complete'
        })
      }
    } catch (e) {
      results.errors.push(`${client.id}/regulation: ${e.message}`)
    }

    // Weekly digest on Mondays
    if (isMonday) {
      try {
        const digest = await generateWeeklyComplianceDigest()
        if (client.contact_phone && client.tier === 'autonomous') {
          await sendSMS(client.contact_phone, `DisruptionHub Weekly Digest\n${digest.headline}\n${digest.summary?.substring(0,160)}\n\nOpen dashboard for full details.`)
        }
      } catch {}
    }

    results.clients.push(clientResult)
  }

  // ── 6. MONTHLY REPORT — runs on 1st of each month ────────────────────────
  if (isFirst) {
    for (const client of clients) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://disruptionhub.ai'}/api/reports/monthly`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: client.id })
        })
      } catch (e) {
        results.errors.push(`${client.id}/monthly_report: ${e.message}`)
      }
    }
  }

  return Response.json({
    success: true,
    ran_at: now.toISOString(),
    clients_processed: clients.length,
    total_modules_run: results.clients.reduce((s,c) => s + c.modules_run, 0),
    total_alerts_sent: results.clients.reduce((s,c) => s + c.alerts_sent, 0),
    monthly_reports_triggered: isFirst ? clients.length : 0,
    errors: results.errors
  })
}

function buildModuleAlertSummary(moduleId, result) {
  const r = result?.result || result
  switch (moduleId) {
    case 'driver_hours':
      const atRisk = r?.drivers_at_risk?.length || 0
      return atRisk > 0 ? `${atRisk} driver${atRisk>1?'s':''} at WTD breach risk` : 'Driver hours flag found'
    case 'vehicle_health':
      const veh = r?.vehicles_at_risk?.length || 0
      return veh > 0 ? `${veh} vehicle${veh>1?'s':''} flagged for maintenance` : 'Vehicle health flag found'
    case 'invoice':
      const disc = r?.discrepancies?.length || 0
      return disc > 0 ? `${disc} overcharge${disc>1?'s':''} found — recoverable` : 'Invoice discrepancy found'
    case 'sla_prediction':
      const sla = r?.at_risk_deliveries?.length || 0
      return sla > 0 ? `${sla} deliver${sla>1?'ies':'y'} at SLA breach risk` : 'SLA risk detected'
    case 'hazmat':
      return `Compliance failure — dispatch blocked`
    case 'regulation':
      return `Regulatory change requires action`
    case 'carrier':
      return `Carrier performance below threshold`
    case 'fuel':
      return `Fuel saving opportunity identified`
    default:
      return `Action required — open dashboard`
  }
}

// GET — health check and manual trigger
export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return Response.json({
    status: 'scheduled runner ready',
    next_run: '05:00 UTC daily',
    daily_modules: DAILY_MODULES,
    weekly_modules: WEEKLY_MODULES,
    monthly_modules: MONTHLY_MODULES
  })
}
