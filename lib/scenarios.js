// ── SCENARIO HANDLERS ─────────────────────────────────────────────────────────
// All 10 operational scenarios built at foundation level.
// Each scenario: detects the trigger, calculates impact, produces actions.
// Connects to modules and agent for AI analysis where needed.

import { anthropic } from './anthropic.js'

const BASE = `You are a Senior Logistics Crisis Director with 25 years UK experience. 
Be direct. Give specific numbers, owners, deadlines. No waffle.
Respond in valid JSON only. No markdown fences.`

// ── 1. DRIVER GOES SILENT ─────────────────────────────────────────────────────
export async function handleDriverSilent({ driver, vehicle, lastKnownPosition, minutesSilent, cargo }) {
  const escalationLevel = minutesSilent < 20 ? 'MONITOR' : minutesSilent < 45 ? 'ALERT' : 'EMERGENCY'

  const result = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    system: BASE,
    messages: [{
      role: 'user',
      content: `Driver silent scenario:
Driver: ${driver.name}, Vehicle: ${vehicle.reg}
Last position: ${lastKnownPosition}
Minutes silent: ${minutesSilent}
Cargo: ${JSON.stringify(cargo)}
Escalation level: ${escalationLevel}

Return JSON: { severity, financial_impact, escalation_sequence: [{step, action, owner, deadline, message_to_send}], assessment, immediate_action }`
    }]
  })

  const parsed = JSON.parse(result.content[0].text.trim())
  return {
    scenario: 'driver_silent',
    escalation_level: escalationLevel,
    minutes_silent: minutesSilent,
    driver: driver.name,
    vehicle: vehicle.reg,
    ...parsed
  }
}

// ── 2. DELIVERY REJECTION AT DOOR ─────────────────────────────────────────────
export async function handleDeliveryRejection({ driver, vehicle, cargo, customer, rejectionReason, currentLocation }) {
  const result = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    system: BASE,
    messages: [{
      role: 'user',
      content: `Delivery rejection:
Driver: ${driver.name} at ${currentLocation}
Customer: ${customer.name}
Rejection reason: ${rejectionReason}
Cargo: ${JSON.stringify(cargo)}
Vehicle capacity used: ${cargo.pallets} pallets

Return JSON: {
  severity, financial_impact,
  options: [{id, label, cost, time_mins, feasibility, recommended}],
  immediate_action,
  contact_message_to_customer,
  contractual_position
}`
    }]
  })

  return {
    scenario: 'delivery_rejection',
    driver: driver.name,
    customer: customer.name,
    rejection_reason: rejectionReason,
    ...JSON.parse(result.content[0].text.trim())
  }
}

// ── 3. CLIENT CHURN PREDICTION ────────────────────────────────────────────────
export function detectChurnSignals(clientData) {
  const signals = []
  let riskScore = 0

  // Order frequency drop
  if (clientData.orders_this_month < clientData.avg_monthly_orders * 0.7) {
    signals.push({ signal: 'order_volume_drop', severity: 'HIGH', detail: `Orders this month: ${clientData.orders_this_month} vs average ${clientData.avg_monthly_orders}` })
    riskScore += 35
  }

  // Missed usual order day
  if (clientData.days_since_last_order > clientData.typical_order_interval_days * 1.5) {
    signals.push({ signal: 'overdue_order', severity: 'MEDIUM', detail: `${clientData.days_since_last_order} days since last order (typical: ${clientData.typical_order_interval_days})` })
    riskScore += 25
  }

  // Complaint or dispute recently
  if (clientData.open_disputes > 0) {
    signals.push({ signal: 'open_dispute', severity: 'HIGH', detail: `${clientData.open_disputes} unresolved dispute(s)` })
    riskScore += 30
  }

  // Recent SLA breaches
  if (clientData.sla_breaches_last_30_days > 2) {
    signals.push({ signal: 'sla_breaches', severity: 'HIGH', detail: `${clientData.sla_breaches_last_30_days} SLA breaches in last 30 days` })
    riskScore += 20
  }

  // Contract renewal approaching
  if (clientData.days_to_contract_renewal < 60) {
    signals.push({ signal: 'renewal_approaching', severity: 'MEDIUM', detail: `Contract renewal in ${clientData.days_to_contract_renewal} days` })
    riskScore += 15
  }

  const riskLevel = riskScore >= 60 ? 'CRITICAL' : riskScore >= 35 ? 'HIGH' : riskScore >= 15 ? 'MEDIUM' : 'LOW'

  return {
    scenario: 'churn_prediction',
    client: clientData.name,
    risk_score: riskScore,
    risk_level: riskLevel,
    signals,
    annual_revenue_at_risk: clientData.annual_revenue,
    recommended_action: riskLevel === 'CRITICAL'
      ? 'Call today. Do not email. Ask directly what is happening.'
      : riskLevel === 'HIGH'
      ? 'Call within 48 hours. Reference their recent activity and ask how things are going.'
      : 'Schedule a check-in call this week.',
    call_script: `"Hi ${clientData.contact_name}, just calling to check in — we noticed your volumes have been a bit quieter lately and wanted to make sure everything is working well for you. Is there anything we can do better on our end?"`
  }
}

// ── 4. SUBCONTRACTOR NO-SHOW ──────────────────────────────────────────────────
export async function handleSubcontractorNoShow({ bookedSub, jobDetails, hoursNotice, approvedSubs }) {
  const result = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    system: BASE,
    messages: [{
      role: 'user',
      content: `Subcontractor no-show:
Booked: ${bookedSub.name}, cancelled with ${hoursNotice}hrs notice
Job: ${JSON.stringify(jobDetails)}
Available approved subs: ${JSON.stringify(approvedSubs.map(s => ({ name: s.name, specialisms: s.specialisms, contact: s.contact })))}

Return JSON: {
  severity, financial_impact,
  ranked_alternatives: [{name, contact, why_suitable, message_to_send, priority}],
  parallel_outreach_plan,
  customer_communication
}`
    }]
  })

  return {
    scenario: 'subcontractor_noshow',
    cancelled_sub: bookedSub.name,
    hours_notice: hoursNotice,
    ...JSON.parse(result.content[0].text.trim())
  }
}

// ── 5. FUEL CARD DECLINED ─────────────────────────────────────────────────────
export async function handleFuelCardDeclined({ driver, vehicle, currentLocation, fuelLevelPct, distanceToDepotMiles, nextDeliveryMiles }) {
  const canReachDepot = fuelLevelPct > (distanceToDepotMiles / 5)
  const canReachNextDelivery = fuelLevelPct > (nextDeliveryMiles / 5)

  const result = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system: BASE,
    messages: [{
      role: 'user',
      content: `Fuel card declined:
Driver: ${driver.name}, Vehicle: ${vehicle.reg}
Location: ${currentLocation}
Fuel level: ${fuelLevelPct}%
Distance to depot: ${distanceToDepotMiles} miles
Next delivery: ${nextDeliveryMiles} miles
Can reach depot on current fuel: ${canReachDepot}
Can reach next delivery: ${canReachNextDelivery}

Return JSON: { severity, immediate_instruction_to_driver, ops_action, alternative_payment_options, nearest_fuel_note }`
    }]
  })

  return {
    scenario: 'fuel_card_declined',
    driver: driver.name,
    can_reach_depot: canReachDepot,
    can_reach_delivery: canReachNextDelivery,
    fuel_level_pct: fuelLevelPct,
    ...JSON.parse(result.content[0].text.trim())
  }
}

// ── 6. PLANNED ROAD CLOSURE PRE-WARNING ───────────────────────────────────────
export async function checkPlannedClosures(clientRoutes) {
  // Fetch from Highways England planned works API
  const closures = []

  for (const route of clientRoutes) {
    try {
      const res = await fetch(
        `https://api.data.highways.gov.uk/its/v1/DATEX/plannedworks?corridor=${encodeURIComponent(route.corridor)}`,
        { headers: { Accept: 'application/json' } }
      )
      if (!res.ok) continue
      const data = await res.json()
      const relevant = (data.features || []).filter(f => {
        const start = new Date(f.properties?.startTime)
        const hoursUntil = (start - Date.now()) / (1000 * 60 * 60)
        return hoursUntil > 0 && hoursUntil < 72 // Within 72 hours
      })
      relevant.forEach(f => closures.push({
        route: route.name,
        road: f.properties?.locationDescription,
        starts: f.properties?.startTime,
        ends: f.properties?.endTime,
        type: f.properties?.situationType,
        hours_until: Math.round((new Date(f.properties?.startTime) - Date.now()) / (1000 * 60 * 60))
      }))
    } catch {
      // API unavailable — skip silently
    }
  }

  return {
    scenario: 'planned_closures',
    checked_at: new Date().toISOString(),
    closures_found: closures.length,
    closures,
    affected_routes: [...new Set(closures.map(c => c.route))],
    recommendation: closures.length > 0
      ? `${closures.length} planned closure(s) affect your routes in the next 72 hours. Review and reroute before dispatch.`
      : 'No planned closures affecting your routes in the next 72 hours.'
  }
}

// ── 7. DRIVER LICENCE CHECK ───────────────────────────────────────────────────
export function checkLicenceStatus(drivers) {
  const flags = []

  drivers.forEach(driver => {
    const issues = []

    if (driver.penalty_points >= 9) {
      issues.push({ type: 'points_risk', severity: 'HIGH', detail: `${driver.penalty_points} points — approaching ban threshold` })
    }
    if (driver.penalty_points >= 12) {
      issues.push({ type: 'ban_risk', severity: 'CRITICAL', detail: `${driver.penalty_points} points — mandatory disqualification likely` })
    }
    if (driver.licence_expiry) {
      const daysToExpiry = Math.floor((new Date(driver.licence_expiry) - Date.now()) / (1000 * 60 * 60 * 24))
      if (daysToExpiry < 30) {
        issues.push({ type: 'expiry_imminent', severity: daysToExpiry < 7 ? 'CRITICAL' : 'HIGH', detail: `Licence expires in ${daysToExpiry} days` })
      }
    }
    if (driver.dqc_expiry) {
      const daysToExpiry = Math.floor((new Date(driver.dqc_expiry) - Date.now()) / (1000 * 60 * 60 * 24))
      if (daysToExpiry < 60) {
        issues.push({ type: 'dqc_expiry', severity: daysToExpiry < 14 ? 'CRITICAL' : 'HIGH', detail: `DQC expires in ${daysToExpiry} days — driver cannot legally operate after expiry` })
      }
    }
    if (driver.licence_status === 'suspended' || driver.licence_status === 'revoked') {
      issues.push({ type: 'licence_invalid', severity: 'CRITICAL', detail: `Licence ${driver.licence_status} — DO NOT DISPATCH` })
    }

    if (issues.length > 0) {
      flags.push({ driver: driver.name, vehicle: driver.vehicle, issues, action_required: issues.some(i => i.severity === 'CRITICAL') ? 'REMOVE FROM SCHEDULE IMMEDIATELY' : 'REVIEW BEFORE NEXT DISPATCH' })
    }
  })

  return {
    scenario: 'licence_check',
    checked_at: new Date().toISOString(),
    drivers_checked: drivers.length,
    flags_found: flags.length,
    flags,
    all_clear: flags.length === 0
  }
}

// ── 8. INSURANCE CLAIM PRE-EMPTION ────────────────────────────────────────────
export async function buildClaimEvidencePack({ deliveryRef, claimValue, claimType, claimantDescription, availableEvidence }) {
  const result = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    system: BASE,
    messages: [{
      role: 'user',
      content: `Insurance claim received:
Delivery: ${deliveryRef}
Claim value: £${claimValue}
Claim type: ${claimType}
Claimant says: ${claimantDescription}
Available evidence: ${JSON.stringify(availableEvidence)}

Return JSON: {
  liability_assessment,
  evidence_strength,
  evidence_pack: [{document, status, supports_defence}],
  missing_evidence: [{document, urgency, how_to_obtain}],
  response_letter,
  recommended_action,
  settlement_recommendation
}`
    }]
  })

  return {
    scenario: 'claim_pre_emption',
    delivery_ref: deliveryRef,
    claim_value: claimValue,
    ...JSON.parse(result.content[0].text.trim())
  }
}

// ── 9. CROSS-BORDER DOCUMENTATION FAILURE ─────────────────────────────────────
export async function handleBorderDocFailure({ driver, vehicle, borderPoint, cargo, documentErrors, hoursToPlannedCrossing }) {
  const result = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    system: BASE,
    messages: [{
      role: 'user',
      content: `Border documentation failure:
Driver: ${driver.name} approaching ${borderPoint}
Time to crossing: ${hoursToPlannedCrossing} hours
Cargo: ${JSON.stringify(cargo)}
Document errors: ${JSON.stringify(documentErrors)}

Return JSON: {
  severity, can_fix_before_border,
  fixes: [{error, fix, owner, time_to_fix_mins, instructions}],
  contact_customs_message,
  delay_if_unfixed_hours,
  financial_impact
}`
    }]
  })

  return {
    scenario: 'border_doc_failure',
    driver: driver.name,
    border_point: borderPoint,
    hours_to_crossing: hoursToPlannedCrossing,
    errors_found: documentErrors.length,
    ...JSON.parse(result.content[0].text.trim())
  }
}

// ── 10. CASCADE PENALTY CALCULATOR ────────────────────────────────────────────
export function calculateCascade(initialDelay) {
  const cascade = []
  let totalExposure = 0
  let currentDelay = initialDelay.delay_minutes

  // Add initial impact
  cascade.push({
    level: 0,
    type: 'initial_delay',
    ref: initialDelay.ref,
    description: initialDelay.description,
    delay_minutes: currentDelay,
    penalty: initialDelay.penalty || 0,
    sla_breached: currentDelay > 0
  })
  totalExposure += initialDelay.penalty || 0

  // Map downstream dependencies
  const dependencies = initialDelay.downstream_dependencies || []
  dependencies.forEach((dep, i) => {
    const depDelay = dep.buffer_minutes ? Math.max(0, currentDelay - dep.buffer_minutes) : currentDelay
    const penaltyTriggered = depDelay > 0 && dep.penalty > 0
    const depPenalty = penaltyTriggered ? dep.penalty : 0

    cascade.push({
      level: i + 1,
      type: dep.type,
      ref: dep.ref,
      description: dep.description,
      delay_minutes: depDelay,
      buffer_available: dep.buffer_minutes || 0,
      penalty: depPenalty,
      sla_breached: depDelay > 0,
      can_be_mitigated: dep.buffer_minutes > 0 && depDelay < dep.buffer_minutes * 0.5
    })
    totalExposure += depPenalty
    currentDelay = depDelay
  })

  const mitigatable = cascade.filter(c => c.can_be_mitigated)

  return {
    scenario: 'cascade_calculator',
    initial_ref: initialDelay.ref,
    cascade_depth: cascade.length,
    cascade,
    total_exposure: totalExposure,
    mitigatable_penalties: mitigatable.reduce((sum, c) => sum + c.penalty, 0),
    mitigation_actions: mitigatable.map(c => ({
      ref: c.ref,
      action: `Contact ${c.ref} NOW — ${c.buffer_available - c.delay_minutes} minute buffer remaining. Call to hold slot.`,
      saves: c.penalty
    })),
    verdict: totalExposure > 5000
      ? `CRITICAL — £${totalExposure.toLocaleString()} cascade exposure. Intervene immediately on all ${mitigatable.length} mitigatable points.`
      : `£${totalExposure.toLocaleString()} total exposure across ${cascade.length} affected deliveries.`
  }
}

// ── SCENARIO ROUTER ───────────────────────────────────────────────────────────
// Single entry point — routes to correct handler based on scenario type
export async function runScenario(scenarioType, data) {
  switch (scenarioType) {
    case 'driver_silent':       return handleDriverSilent(data)
    case 'delivery_rejection':  return handleDeliveryRejection(data)
    case 'churn_prediction':    return detectChurnSignals(data)
    case 'subcontractor_noshow': return handleSubcontractorNoShow(data)
    case 'fuel_card_declined':  return handleFuelCardDeclined(data)
    case 'planned_closures':    return checkPlannedClosures(data)
    case 'licence_check':       return checkLicenceStatus(data)
    case 'claim_pre_emption':   return buildClaimEvidencePack(data)
    case 'border_doc_failure':  return handleBorderDocFailure(data)
    case 'cascade_calculator':  return calculateCascade(data)
    default: throw new Error(`Unknown scenario: ${scenarioType}`)
  }
}
