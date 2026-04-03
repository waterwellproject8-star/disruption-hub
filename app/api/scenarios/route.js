// Scenarios API — pre-built demo results, no AI calls in demo mode
// Same pattern as modules — instant results, zero timeout risk

const DEMO_RESULTS = {
  driver_silent: {
    scenario: 'driver_silent',
    severity: 'HIGH',
    financial_impact: 12000,
    escalation_level: 'ALERT',
    minutes_silent: 35,
    driver: 'Carl Hughes',
    vehicle: 'BK21 XYZ',
    assessment: 'Carl Hughes (BK21 XYZ) has been silent for 35 minutes on M1 Southbound between J28 and J27. Last GPS ping confirmed stationary. Mixed retail cargo value £12,000. No medical emergency confirmed yet — escalation protocol initiated.',
    immediate_action: 'Call Carl Hughes NOW on primary number. If no answer within 3 minutes, call emergency contact. Do not send another driver until location confirmed.',
    escalation_sequence: [
      { step: 1, action: 'Call driver primary number', owner: 'Ops Manager', deadline: '05:02', message_to_send: 'Carl — calling to check in. Please call back immediately.' },
      { step: 2, action: 'Call driver emergency contact if no answer', owner: 'Ops Manager', deadline: '05:05', message_to_send: null },
      { step: 3, action: 'Contact Highways England if vehicle is obstructing traffic', owner: 'Ops Controller', deadline: '05:10', message_to_send: '0300 123 5000 — HGV BK21 XYZ stationary M1 SB J28-J27, driver not responding' },
      { step: 4, action: 'Dispatch relief driver to last known location', owner: 'Fleet Controller', deadline: '05:15', message_to_send: null },
    ]
  },

  delivery_rejection: {
    scenario: 'delivery_rejection',
    severity: 'HIGH',
    financial_impact: 4200,
    driver: 'Mark Davies',
    customer: 'Tesco DC Bradford',
    rejection_reason: 'Arrived 2 hours outside booking window',
    assessment: 'Tesco DC Bradford refused delivery of 8 pallets fresh produce as vehicle arrived outside the 06:00-08:00 booking window. Cargo is temperature-controlled — deterioration risk increases every hour.',
    contact_message_to_customer: 'Apologies for the delay on this morning\'s delivery. We take full responsibility for the missed window. Can we agree a same-day re-delivery slot, or would you accept the load with a signed temperature deviation record? We will absorb any reasonable costs.',
    contractual_position: 'Tesco T&Cs clause 14.2 — late delivery outside booking window entitles DC to refuse. However same-day re-booking is typically accepted for fresh produce if temperature compliance is demonstrated.',
    options: [
      { id: 'rebook_same_day', label: 'Rebook same-day slot', cost: 180, time_mins: 240, feasibility: 'YES', recommended: true, description: 'Call Tesco DC now and book a PM slot (14:00-16:00 typically available). Driver waits in cab or returns for afternoon run.' },
      { id: 'alternative_customer', label: 'Redirect to alternative customer', cost: 95, time_mins: 90, feasibility: 'CONDITIONAL', recommended: false, description: 'If any other customer can take this product today — call them now. Requires same product spec acceptance.' },
      { id: 'cold_storage_hold', label: 'Cold storage hold overnight', cost: 380, time_mins: 60, feasibility: 'YES', recommended: false, description: 'Nearest cold store: Bradford Industrial Estate. £380 overnight. Redeliver tomorrow with new booking window.' },
    ]
  },

  churn_prediction: {
    scenario: 'churn_prediction',
    client: 'Midlands Fresh Logistics',
    risk_score: 72,
    risk_level: 'HIGH',
    annual_revenue_at_risk: 86400,
    signals: [
      { signal: 'order_volume_drop', severity: 'HIGH', detail: 'Orders this month: 6 vs average 18 — 67% volume drop' },
      { signal: 'open_dispute', severity: 'HIGH', detail: '1 unresolved dispute (CLM-2026-028 — NHS penalty invoice)' },
      { signal: 'sla_breaches', severity: 'HIGH', detail: '3 SLA breaches in last 30 days — above account threshold' },
      { signal: 'renewal_approaching', severity: 'MEDIUM', detail: 'Contract renewal in 45 days — not yet discussed' },
    ],
    recommended_action: 'Call today. Do not email. Ask directly what is happening.',
    call_script: '"Hi Dave, just calling to check in — we noticed your volumes have been quieter this month and I wanted to make sure everything is working well for you. Is there anything we can do better on our end?"'
  },

  subcontractor_noshow: {
    scenario: 'subcontractor_noshow',
    severity: 'HIGH',
    financial_impact: 2800,
    cancelled_sub: 'JK Transport Ltd',
    hours_notice: 14,
    assessment: 'JK Transport cancelled with 14 hours notice. 3 loads committed for tomorrow: Leeds-London, Leeds-Bristol. £2,800 revenue at risk. Need replacement confirmed within 2 hours to allow driver briefing.',
    customer_communication: 'Contact all three customers now and give a 2-hour window — "We have a vehicle change for tomorrow\'s run. Delivery time confirmed by 20:00 tonight."',
    parallel_outreach_plan: 'Contact all three alternatives simultaneously — do not wait for one reply before calling the next.',
    ranked_alternatives: [
      { name: 'Apex Haulage', contact: '07700000003', priority: 1, why_suitable: 'General freight specialist, Yorkshire base, available Fridays historically', message_to_send: 'Hi, we have 3 loads tomorrow Leeds-London/Bristol, good rates, confirmed by tonight — are you available?' },
      { name: 'Northern Freight Co', contact: '07700000004', priority: 2, why_suitable: 'Temperature controlled capability matches our fresh produce requirements', message_to_send: 'Emergency cover needed tomorrow — 3 loads, Leeds base, can discuss rates now if available.' },
      { name: 'FastMove Ltd', contact: '07700000005', priority: 3, why_suitable: 'Express capability for time-critical loads, backup option', message_to_send: 'Last minute cover needed tomorrow — 3 loads from Leeds, reply ASAP.' },
    ]
  },

  fuel_card_declined: {
    scenario: 'fuel_card_declined',
    severity: 'MEDIUM',
    driver: 'James Reid',
    can_reach_depot: false,
    can_reach_delivery: true,
    fuel_level_pct: 14,
    immediate_instruction_to_driver: 'James — do NOT try to reach depot on current fuel. You will run dry on the A1. Complete your next delivery (42 miles — you have enough). At Edinburgh RDC, ask if they have an onsite fuel point. Call me immediately after delivery.',
    ops_action: 'Call card provider NOW to establish why card declined — likely a fraud block or limit reached. If limit: authorise emergency top-up. If fraud block: get temporary override code. Have a backup card number ready to relay to James by phone.',
    alternative_payment_options: [
      'Call card provider for override code — fastest option',
      'Bank transfer to driver personal account for cash purchase — last resort',
      'Company credit card number relayed securely by phone',
    ],
    nearest_fuel_note: 'Nearest fuel to current location: BP Motorway A1 Wetherby 139.4ppl — 8 miles ahead. Can reach this on current fuel.'
  },

  planned_closures: {
    scenario: 'planned_closures',
    checked_at: new Date().toISOString(),
    closures_found: 2,
    affected_routes: ['Leeds → London', 'Leeds → Edinburgh'],
    recommendation: '2 planned closures affect your routes in the next 72 hours. Review and reroute before dispatch.',
    closures: [
      { route: 'Leeds → London', road: 'M1 Northbound J28-J29, Derbyshire', starts: 'Tomorrow 22:00', ends: 'Day after 06:00', type: 'Overnight resurfacing works', hours_until: 18 },
      { route: 'Leeds → Edinburgh', road: 'A1(M) J47 slip road closure, North Yorkshire', starts: 'Saturday 07:00', ends: 'Sunday 18:00', type: 'Bridge maintenance', hours_until: 42 },
    ]
  },

  licence_check: {
    scenario: 'licence_check',
    checked_at: new Date().toISOString(),
    drivers_checked: 4,
    flags_found: 2,
    all_clear: false,
    flags: [
      {
        driver: 'James Reid', vehicle: 'SF68 PQR',
        action_required: 'REMOVE FROM SCHEDULE IMMEDIATELY',
        issues: [
          { type: 'points_risk', severity: 'HIGH', detail: '10 penalty points — 2 away from mandatory disqualification. Do not assign to any run until legal advice obtained.' },
          { type: 'dqc_expiry', severity: 'CRITICAL', detail: 'DQC expires in 11 days (14 April 2026). Cannot legally drive HGV after this date without renewal. Book CPC training immediately.' },
        ]
      },
      {
        driver: 'Paul Wright', vehicle: 'YX70 MNO',
        action_required: 'REVIEW BEFORE NEXT DISPATCH',
        issues: [
          { type: 'dqc_expiry', severity: 'HIGH', detail: 'ADR certificate expired November 2025. Cannot carry hazardous goods. Remove from any ADR-flagged runs until renewed.' },
        ]
      }
    ]
  },

  claim_pre_emption: {
    scenario: 'claim_pre_emption',
    delivery_ref: 'REF-7201',
    claim_value: 4200,
    liability_assessment: 'NO_LIABILITY',
    evidence_strength: 'STRONG',
    verdict: 'Evidence strongly supports no liability. GPS confirms delivery vehicle stationary at delivery point for 23 minutes. Signed POD with no damage noted. Recommend full defence — do not settle.',
    recommended_action: 'Send formal response within 5 working days. Request claimant provide evidence that damage occurred during your custody, not at their premises.',
    settlement_recommendation: 'DO NOT SETTLE. Evidence supports full defence. Any settlement offer would signal liability and invite future claims on this account.',
    response_letter: 'We formally dispute liability for claim CLM-2026-041. Our GPS records confirm delivery vehicle YX70 MNO was stationary at the delivery address for 23 minutes on 15 March. Our driver obtained a signed proof of delivery with no damage noted at the time of delivery. We require the claimant to provide evidence that the alleged damage occurred while goods were in our custody, and not subsequently at their premises.',
    evidence_pack: [
      { document: 'GPS track log 15 March', status: 'Available', supports_defence: true },
      { document: 'Signed POD — no damage noted', status: 'Available', supports_defence: true },
      { document: 'Pre-trip vehicle walkaround', status: 'Available', supports_defence: true },
      { document: 'Delivery photograph', status: 'NOT AVAILABLE — driver did not photograph', supports_defence: false },
    ],
    missing_evidence: [
      { document: 'Delivery photograph', urgency: 'HIGH', how_to_obtain: 'Driver policy: photograph every delivery going forward. Cannot recover for this incident.' }
    ],
    pattern_flags: ['Yodel-handled loads have generated 4 damage claims in 90 days on this route. Pattern suggests mishandling at Yodel depot rather than in-transit damage. Flag for carrier scorecard review.']
  },

  border_doc_failure: {
    scenario: 'border_doc_failure',
    severity: 'HIGH',
    driver: 'Carl Hughes',
    border_point: 'Dover Eastern Docks',
    hours_to_crossing: 3.5,
    errors_found: 2,
    can_fix_before_border: true,
    financial_impact: 28000,
    delay_if_unfixed_hours: 6,
    fixes: [
      {
        error: 'EORI number missing from exporter field on Commercial Invoice',
        fix: 'Add EORI number GB123456789000 to exporter field on invoice. Reissue document.',
        owner: 'Back office — Sarah',
        time_to_fix_mins: 15,
        instructions: 'Open the commercial invoice template. Exporter field line 3 — add GB123456789000. Save as PDF, email to driver. Driver prints at Dover services.'
      },
      {
        error: 'Gross weight discrepancy — invoice 2,400kg, packing list 2,650kg',
        fix: 'Correct packing list to match actual weighed gross weight. Confirm actual weight with warehouse.',
        owner: 'Warehouse — call now',
        time_to_fix_mins: 20,
        instructions: 'Call warehouse on 01234 000000. Confirm actual gross weight of consignment. Whichever figure is correct — update the other document to match. Both must show identical weight.'
      }
    ],
    contact_customs_message: 'Not needed if fixed within the next 45 minutes. If unable to fix: call Dover HMRC advice line 0300 200 3700 before driver arrives.'
  },

  cascade_calculator: {
    scenario: 'cascade_calculator',
    initial_ref: 'REF-4421',
    cascade_depth: 4,
    total_exposure: 1040,
    mitigatable_penalties: 700,
    verdict: 'CRITICAL — £1,040 cascade exposure across 4 connected deliveries. £700 is still avoidable if you act in the next 20 minutes.',
    mitigation_actions: [
      { ref: 'REF-5517', action: 'Call XPO Logistics NOW — 25 minute buffer remaining on Leeds-Cardiff slot. Ask them to hold bay for 30 minutes.', saves: 500 },
      { ref: 'REF-SUPPLIER-881', action: 'Call supplier on 01234 000000 — 20 minute buffer on 16:00 pickup. Ask if 16:30 is acceptable.', saves: 200 },
    ],
    cascade: [
      { level: 0, type: 'initial_delay', ref: 'REF-4421', description: 'M1 J28 closure — Carl Hughes 90 minutes late to Tesco Bradford', delay_minutes: 90, penalty: 340, sla_breached: true, can_be_mitigated: false },
      { level: 1, type: 'return_collection', ref: 'REF-RETURN-4421', description: 'Return collection from Tesco DC delayed — 30min buffer absorbed', delay_minutes: 60, penalty: 0, sla_breached: false, can_be_mitigated: false },
      { level: 2, type: 'connected_delivery', ref: 'REF-5517', description: 'Leeds-Cardiff run using same vehicle — now 45 minutes late', delay_minutes: 45, penalty: 500, sla_breached: true, can_be_mitigated: true },
      { level: 3, type: 'supplier_pickup', ref: 'REF-SUPPLIER-881', description: '16:00 supplier pickup — same driver, now showing 16:20 arrival', delay_minutes: 20, penalty: 200, sla_breached: false, can_be_mitigated: true },
    ]
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { scenario } = body

    if (!scenario) {
      return Response.json({ error: 'scenario is required' }, { status: 400 })
    }

    const result = DEMO_RESULTS[scenario]
    if (!result) {
      return Response.json({ error: `Unknown scenario: ${scenario}` }, { status: 400 })
    }

    return Response.json({ success: true, scenario, result })

  } catch (error) {
    console.error('Scenario error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({ available_scenarios: Object.keys(DEMO_RESULTS) })
}
