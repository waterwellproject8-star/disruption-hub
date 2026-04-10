import { runModule } from '../../../lib/anthropic.js'
import { logModuleRun, queueAction, getClientConfig } from '../../../lib/supabase.js'

// ── DEMO RESULTS ──────────────────────────────────────────────────────────────
// Returned instantly when no real client data is connected.
// Real AI calls happen once client data is flowing via webhooks/Supabase.
const DEMO_RESULTS = {
  disruption: {
    severity: 'HIGH',
    financial_impact: 8500,
    time_to_resolution: '2-3 hours',
    affected_shipments: 2,
    sections: {
      assessment: 'REF-8832 (Glasgow → London) is stopped due to M74 closure. FastFreight UK driver stationary for 40 minutes. REF-9103 running 45 minutes behind schedule on Birmingham → Edinburgh route due to weather.',
      immediate_actions: [
        'Call FastFreight UK 24hr line NOW — confirm M74 clearance time and request reroute via A74(M). Owner: Ops Manager. Deadline: within 10 minutes.',
        'Notify London consignee for REF-8832 — revised ETA 3 hours later than booked. Draft proactive message now. Owner: Account Manager.',
        'REF-9103 driver to confirm current position and updated ETA. If gap exceeds 90 minutes, call Edinburgh DC to hold bay. Owner: Dispatcher.'
      ],
      who_to_contact: 'FastFreight UK 24hr: 0800 XXX XXXX — "REF-8832 stationary M74, requesting authorised reroute via A74(M) southbound, confirm clearance ETA." London consignee: notify delay, provide revised ETA.',
      downstream_risks: 'If M74 remains closed beyond 2 hours, Edinburgh delivery REF-9103 will breach SLA window. FastFreight UK has 3 active loads affected by this closure — cascade risk to tomorrow\'s collections.',
      prevention: '1. Pre-route all Glasgow-London runs via M74/A74(M) with automatic weather monitoring trigger. 2. FastFreight UK contract to include 30-minute notification SLA on all incidents causing >15 minute delays.'
    },
    actions: []
  },

  invoice: {
    total_overcharge: 847.89,
    discrepancies: [
      {
        invoice_ref: 'INV-2024-8821',
        carrier: 'FastFreight UK',
        issue_type: 'fuel_surcharge',
        charged: 1847.50,
        expected: 1629.41,
        delta: 218.09,
        evidence: 'Fuel surcharge charged at 18.5% — contracted maximum is 15.0%. Overcharge on this invoice: £218.09.'
      },
      {
        invoice_ref: 'INV-2024-8756',
        carrier: 'XPO Logistics',
        issue_type: 'fuel_surcharge',
        charged: 890.00,
        expected: 731.70,
        delta: 158.30,
        evidence: 'Fuel surcharge charged at 22.0% — contracted maximum is 15.0%. Overcharge on this invoice: £158.30.'
      },
      {
        invoice_ref: 'INV-2024-8742',
        carrier: 'FastFreight UK',
        issue_type: 'duplicate',
        charged: 1650.00,
        expected: 0,
        delta: 471.50,
        evidence: 'This invoice appears to duplicate INV-2024-8698 for the same Bristol-Edinburgh run on the same date. Full amount disputed.'
      }
    ],
    annual_projection: 10174,
    actions: []
  },

  sla_prediction: {
    total_penalty_risk: 1590,
    total_penalty_avoidable: 840,
    at_risk_deliveries: [
      {
        ref: 'REF-4421',
        client: 'Tesco DC Bradford',
        driver: 'Carl Hughes',
        sla_window_closes: '14:30',
        current_eta: '14:38',
        breach_probability: 85,
        breach_margin_minutes: -8,
        reroute_available: true,
        reroute_via: 'Exit M62 at J26, take A638 direct to Bradford',
        reroute_eta: '14:27',
        reroute_saves_sla: true,
        penalty_if_breached: 340,
        reroute_instruction: 'Carl — exit M62 now at J26, take A638 northbound into Bradford. Saves 11 mins. ETA 14:27.'
      },
      {
        ref: 'REF-9103',
        client: 'Sainsburys RDC Edinburgh',
        driver: 'James Reid',
        sla_window_closes: '17:30',
        current_eta: '18:10',
        breach_probability: 100,
        breach_margin_minutes: -40,
        reroute_available: false,
        reroute_saves_sla: false,
        penalty_if_breached: 750,
        reroute_instruction: 'No reroute will recover this slot. Call Sainsburys Edinburgh now to negotiate late acceptance or reschedule.'
      }
    ],
    actions: []
  },

  fuel: {
    current_price_ppl: 141.2,
    average_30day_ppl: 148.6,
    delta_ppl: -7.4,
    recommendation: 'fill_now',
    reasoning: 'Diesel is 7.4ppl below 30-day average. Price trend is falling — now is optimal fill window. Carl Hughes and James Reid are both below 30% and have long runs today.',
    vehicles_to_fill: [
      { reg: 'BK21 XYZ', driver: 'Carl Hughes', nearest_fuel_stop: 'Moto Trowell M1 J25 — 138.9ppl', current_level_pct: 28, fill_capacity_litres: 288, saving: 26.42 },
      { reg: 'SF68 PQR', driver: 'James Reid', nearest_fuel_stop: 'BP Motorway A1 Wetherby — 139.4ppl', current_level_pct: 19, fill_capacity_litres: 340, saving: 31.28 }
    ],
    total_saving: 57.70,
    annual_projection: 2100,
    actions: []
  },

  driver_hours: {
    licence_risk: true,
    dvsa_penalty_risk: 1500,
    drivers_at_risk: [
      {
        name: 'James Reid',
        vehicle_reg: 'SF68 PQR',
        hours_worked: 57,
        wtd_limit: 60,
        remaining_hours: 3,
        remaining_deliveries_hrs: 4.5,
        breach_risk: true,
        breach_margin_hrs: -1.5,
        recommended_action: 'reassign_stops',
        specific_instruction: 'James cannot legally complete Edinburgh RDC run. Relief driver required from depot — 45 min lead time. Reassign Edinburgh stop to relief or reschedule with customer.'
      },
      {
        name: 'Carl Hughes',
        vehicle_reg: 'BK21 XYZ',
        hours_worked: 52,
        wtd_limit: 60,
        remaining_hours: 8,
        remaining_deliveries_hrs: 5.5,
        breach_risk: false,
        breach_margin_hrs: 2.5,
        recommended_action: 'continue',
        specific_instruction: 'Carl within limits — monitor. 2.5 hour buffer remaining after planned runs.'
      }
    ],
    actions: []
  },

  carrier: {
    total_breach_cost: 4200,
    renegotiation_saving: 8500,
    carriers: [
      { name: 'FastFreight UK', on_time_rate: 83, damage_rate: 2.8, invoice_accuracy: 94, contract_threshold_otr: 90, below_threshold: true, sla_breaches_caused: 8, sla_breach_cost: 2720, recommendation: 'renegotiate', evidence_summary: 'OTR 83% vs 90% contracted threshold. 8 SLA breaches caused in 90 days at £340 average penalty. Invoice fuel surcharge consistently above contracted cap.' },
      { name: 'Yodel', on_time_rate: 84, damage_rate: 4.4, invoice_accuracy: 94, contract_threshold_otr: 92, below_threshold: true, sla_breaches_caused: 9, sla_breach_cost: 1480, recommendation: 'warn', evidence_summary: 'Damage rate 4.4% is highest in fleet — 9 incidents in 90 days. Below OTR threshold. Issue formal warning — if not improved in 30 days, consider termination.' },
      { name: 'DHL Express', on_time_rate: 96, damage_rate: 1.1, invoice_accuracy: 99, contract_threshold_otr: 95, below_threshold: false, sla_breaches_caused: 0, sla_breach_cost: 0, recommendation: 'continue', evidence_summary: 'Best performer in fleet. 96% OTR, near-zero damage and invoice disputes. Preferred carrier for high-value loads.' },
      { name: 'XPO Logistics', on_time_rate: 96, damage_rate: 0, invoice_accuracy: 97, contract_threshold_otr: 93, below_threshold: false, sla_breaches_caused: 1, sla_breach_cost: 0, recommendation: 'continue', evidence_summary: 'Strong performer. Fuel surcharge invoicing above contract cap needs addressing — raise at next review.' }
    ],
    actions: []
  },

  vehicle_health: {
    total_breakdown_risk: 28500,
    total_preventive_cost: 1840,
    vehicles_at_risk: [
      { reg: 'SF68 PQR', fault_codes: ['engine oil pressure low intermittent', 'coolant temp sensor fault'], trend_analysis: 'Two concurrent faults on a 231,800 mile vehicle. Oil pressure fluctuation combined with coolant sensor failure indicates potential head gasket risk.', failure_probability: 78, failure_timeframe: '2-4 weeks without intervention', preventive_fix: 'Full engine diagnostic, oil system pressure test, coolant system check. Replace coolant temp sensor.', preventive_cost: 850, breakdown_cost: 14000, optimal_service_slot: 'This weekend — do not dispatch on long-haul runs until assessed.' },
      { reg: 'BK21 XYZ', fault_codes: ['P0420 catalytic efficiency', 'brake pad wear 2mm left front'], trend_analysis: 'Brake pad at 2mm is below DVSA minimum safe threshold of 3mm. Immediate roadworthiness risk.', failure_probability: 95, failure_timeframe: 'Immediate — brake failure risk', preventive_fix: 'Replace front brake pads before next dispatch. Cat efficiency code — monitor, book at next service.', preventive_cost: 320, breakdown_cost: 8500, optimal_service_slot: 'Before tomorrow morning — do not dispatch until brakes replaced.' }
    ],
    actions: []
  },

  driver_retention: {
    total_replacement_cost_at_risk: 67000,
    at_risk_drivers: [
      { name: 'Paul Wright', risk_score: 82, risk_level: 'HIGH', signals: ['15% below market rate', '2 complaints in 90 days', '5 absence days', 'consistently at weekly hours limit'], recommended_interventions: ['Immediate pay review — bring to market rate £38,500', 'Schedule 1-2-1 within 7 days', 'Reduce weekend work allocation for next month'], replacement_cost: 18000 },
      { name: 'James Reid', risk_score: 71, risk_level: 'HIGH', signals: ['12% below market rate', 'consistently breaching hours limits', '5 weekend shifts last month', '3 absence days'], recommended_interventions: ['Pay review to market rate', 'Reduce scheduled hours to sustainable level', 'Review route allocation to reduce overnight stays'], replacement_cost: 18000 }
    ],
    actions: []
  },

  carbon: {
    scope_1_tonnes_co2e: 142.8,
    scope_3_tonnes_co2e: 28.6,
    per_delivery_kg_co2e: 18.4,
    industry_benchmark_kg: 22.1,
    vs_benchmark_pct: -16.7,
    annual_report: {
      methodology: 'DESNZ GHG Conversion Factors 2025 (June 2025 edition)',
      period: 'Q1 2026',
      fleet_summary: '4 HGV fleet. 29,500 miles operated in Q1 2026.',
      emissions_breakdown: 'Scope 1 (direct diesel combustion): 142.8 tCO2e. Scope 3 (well-to-tank): 28.6 tCO2e. Total: 171.4 tCO2e.',
      reduction_target: '15% reduction by Q1 2027 — achievable via load consolidation and route optimisation.',
      narrative: 'Fleet is performing 16.7% better than industry benchmark on emissions per delivery. Tesco and NHS reporting requirements met with 2025 DEFRA methodology.'
    },
    optimisation_opportunities: [
      { description: 'Load consolidation on Leeds-Manchester corridor — 2 runs combinable 3x per week', emission_reduction_pct: 8, cost_saving: 4200 }
    ],
    actions: []
  },

  tender: {
    total_pipeline_value: 2840000,
    matching_tenders: [
      { title: 'NHS Yorkshire — Medical Consumables Distribution Framework 2026-2029', reference: 'NHS-YH-2026-0441', buyer: 'NHS Yorkshire and Humber ICB', value: 1200000, deadline_days: 18, capability_match_pct: 91, recommended: true, key_requirements: ['NHS Approved Supplier status', 'Temperature controlled capacity', 'Same-day emergency capability'], win_probability: 68, briefing: 'Strong match. You hold NHS Approved Supplier status and operate temperature-controlled vehicles in Yorkshire. Framework contract — 3 years, £400K/year.' },
      { title: 'West Yorkshire Combined Authority — Freight Consolidation Service', reference: 'WYCA-2026-FRT-12', buyer: 'West Yorkshire Combined Authority', value: 480000, deadline_days: 31, capability_match_pct: 84, recommended: true, key_requirements: ['FORS Bronze minimum', 'Yorkshire base of operations', 'Carbon reporting capability'], win_probability: 55, briefing: 'Good match. FORS Bronze held. Your Q1 2026 carbon report satisfies their ESG submission requirement.' }
    ],
    actions: []
  },

  regulation: {
    total_compliance_cost: 2400,
    total_penalty_risk: 45000,
    relevant_changes: [
      { title: 'DVSA HGV Inspection Manual Update — April 2026', source: 'DVSA', effective_date: '2026-04-01', days_to_comply: 0, impact_description: 'Updated brake testing requirements. Laden roller brake test now mandatory — EBPMS is only accepted alternative. Affects all HGV annual tests from April 1st.', affected_vehicles: ['All 4 HGVs'], compliance_action: 'Review next MOT bookings. Confirm test centre has laden brake test capability. BK21 XYZ has brake pad issue — do not present for MOT until fixed.', compliance_cost: 0, penalty_if_ignored: 2500, urgency: 'IMMEDIATE' },
      { title: 'Smart Tachograph 2 — LCV Retrofit Deadline', source: 'DfT', effective_date: '2026-07-01', days_to_comply: 89, impact_description: 'Light commercial vehicles 2.5-3.5t operating international/cabotage routes must have ST2 fitted by July 1 2026.', affected_vehicles: ['Any LCVs on international runs'], compliance_action: 'Confirm if any vans operate EU routes. If yes, book ST2 retrofit now — lead time 6-8 weeks.', compliance_cost: 2400, penalty_if_ignored: 5000, urgency: 'WITHIN_90_DAYS' }
    ],
    actions: []
  },

  hazmat: {
    all_clear: false,
    jobs_checked: 3,
    penalty_risk: 5000,
    compliance_failures: [
      { job_ref: 'JOB-7732', cargo_description: 'Paint and solvents — Class 3 flammable liquid', un_number: 'UN1263', adr_class: '3', failure_reason: 'expired_cert', assigned_driver: 'Paul Wright', driver_cert_expiry: '2025-11-30', block_dispatch: true, resolution: 'Paul Wright ADR certificate expired November 2025. Do not dispatch JOB-7732 until reassigned to ADR-certified driver or Paul renews certificate (minimum 2 day course).' }
    ],
    actions: []
  },

  consolidation: {
    total_daily_saving: 620,
    annual_projection: 14880,
    opportunities: [
      { route_a: 'JOB-A: Leeds → Manchester (800kg)', route_b: 'JOB-B: Leeds → Salford (600kg)', combined_utilisation_pct: 68, vehicles_saved: 1, fuel_saving: 180, driver_saving: 280, total_saving: 460, feasibility: 'YES', condition: 'JOB-B deadline is 15:30 — sufficient buffer after JOB-A 14:00 delivery. Same vehicle, same driver, back-to-back.', new_schedule: 'LN70 ABC: depart Leeds 11:00 → Manchester (JOB-A, deliver 14:00) → Salford (JOB-B, deliver 15:15). YX70 MNO freed up for other work.' },
      { route_a: 'JOB-C: Leeds → Sheffield (1200kg)', route_b: 'JOB-D: Leeds → Sheffield Meadowhall (900kg)', combined_utilisation_pct: 74, vehicles_saved: 1, fuel_saving: 95, driver_saving: 65, total_saving: 160, feasibility: 'CONDITIONAL', condition: 'Combined weight 2100kg — within vehicle capacity. JOB-C deadline 13:00, JOB-D deadline 14:30. Feasible if JOB-C delivered first.', new_schedule: 'BK21 XYZ: Leeds → Sheffield city (JOB-C, 12:45) → Meadowhall (JOB-D, 14:15). SF68 PQR freed up.' }
    ],
    actions: []
  },

  forecast: {
    total_planning_saving: 8400,
    forecast_periods: [
      { week: 'Week of April 7 (Easter)', demand_multiplier: 0.6, volume_forecast: 57, current_capacity: 95, capacity_gap: -38, weeks_to_prepare: 1, preparation_actions: ['Reduce agency driver bookings this week', 'Defer non-urgent maintenance to this window', 'Pre-position vehicles for post-Easter peak'], cost_if_prepared_now: 0, cost_if_last_minute: 0, saving_by_planning: 1200 },
      { week: 'Week of April 28 (NHS Quarter End)', demand_multiplier: 1.45, volume_forecast: 138, current_capacity: 95, capacity_gap: 43, weeks_to_prepare: 3, preparation_actions: ['Book 2 additional agency drivers for Apr 28-30', 'Pre-book emergency refrigerated hire unit', 'Notify NHS Sheffield of capacity plan'], cost_if_prepared_now: 1800, cost_if_last_minute: 4600, saving_by_planning: 2800 }
    ],
    actions: []
  },

  benchmarking: {
    total_annual_opportunity: 31200,
    net_recommendation: 'Increase rates on Leeds-London and Leeds-Edinburgh lanes at next renewal. Both underpriced vs April 2026 market by 12-18%.',
    lane_analysis: [
      { lane: 'Leeds → London', current_rate_per_mile: 3.10, market_rate_per_mile: 3.65, delta_pct: -15.1, status: 'underpriced', annual_runs: 416, annual_revenue_gap: 22880, recommended_rate: 3.60, action: 'increase', timing: 'next_renewal' },
      { lane: 'Leeds → Edinburgh', current_rate_per_mile: 3.20, market_rate_per_mile: 3.72, delta_pct: -14.0, status: 'underpriced', annual_runs: 208, annual_revenue_gap: 10816, recommended_rate: 3.68, action: 'increase', timing: 'next_renewal' },
      { lane: 'Manchester → Bristol', current_rate_per_mile: 2.95, market_rate_per_mile: 3.10, delta_pct: -4.8, status: 'underpriced', annual_runs: 260, annual_revenue_gap: 3900, recommended_rate: 3.08, action: 'increase', timing: 'next_renewal' },
      { lane: 'Glasgow → Birmingham', current_rate_per_mile: 3.40, market_rate_per_mile: 3.38, delta_pct: 0.6, status: 'competitive', annual_runs: 156, annual_revenue_gap: 0, recommended_rate: 3.40, action: 'hold', timing: 'monitor' }
    ],
    actions: []
  },

  insurance: {
    claim_ref: 'CLM-2026-041',
    claim_value: 4200,
    liability_assessment: 'NO_LIABILITY',
    verdict: 'Evidence strongly supports no liability. GPS data confirms vehicle was stationary at delivery point for 23 minutes before departure — inconsistent with claimant\'s account of damage during transit. Recommend full defence.',
    response_letter: 'We dispute liability for claim CLM-2026-041. GPS records confirm delivery vehicle YX70 MNO was stationary at the delivery address for 23 minutes. Temperature logs show cargo maintained at correct temperature throughout. Signed POD confirms goods received in satisfactory condition. We request the claimant provide evidence that damage occurred during our custody.',
    pattern_flags: ['Yodel — 4 damage claims in 90 days on same route. Pattern suggests mishandling at Yodel depot, not in-transit damage.'],
    evidence: [
      { type: 'gps_data', description: 'Vehicle stationary at delivery point 14:22-14:45. Departed 14:45 with empty trailer.', exonerates_driver: true, timestamp: '2026-03-15T14:22:00' },
      { type: 'pod_signature', description: 'Signed POD with no damage noted at time of delivery.', exonerates_driver: true, timestamp: '2026-03-15T14:43:00' }
    ],
    actions: []
  },

  cargo_theft: {
    demo_mode: true,
    overall_risk: 'HIGH',
    total_cargo_at_risk: 18500,
    risk_flags: [
      {
        vehicle_reg: 'BK21 XYZ',
        driver: 'Carl Hughes',
        flag_type: 'unauthorised_stop',
        location: 'Watford Gap Services, M1 J17',
        duration_mins: 94,
        time_of_day: '02:15',
        cargo_value: 12000,
        action_required: 'Contact Carl immediately — 94-minute stop at 02:15 with £12,000 retail cargo at Watford Gap. This is the highest-theft services on the M1. If he is resting, redirect to Northampton Truck Stop (M1 J15A — 4 miles south) or Rugby Truck Stop (M45 junction — 8 miles). Both are Sold Secure accredited with CCTV and security patrols. Cost: £28-35 per night. Against £12,000 cargo at risk this is non-negotiable.',
        urgency: 'IMMEDIATE',
        secure_parking_options: [
          { name: 'Northampton Truck Stop', distance_miles: 4, direction: 'M1 J15A southbound', cost_gbp: 28, accredited: true, cctv: true, security_patrol: true },
          { name: 'Rugby Truck Stop (M45)', distance_miles: 8, direction: 'M45 junction exit', cost_gbp: 32, accredited: true, cctv: true, security_patrol: true },
          { name: 'Toddington Services (Gridserve)', distance_miles: 12, direction: 'M1 J11A northbound', cost_gbp: 0, accredited: false, cctv: true, security_patrol: false, note: 'Free but not accredited — acceptable for cargo under £5k only' }
        ]
      },
      {
        vehicle_reg: 'LK19 FGH',
        driver: 'Mark Davies',
        flag_type: 'high_risk_zone',
        location: 'A406 North Circular — Wembley stretch',
        duration_mins: 22,
        time_of_day: '23:40',
        cargo_value: 6500,
        action_required: 'Monitor — North Circular Wembley is a known cargo theft hotspot after 22:00. If Mark needs to stop, direct him to Staples Corner BP Truck Park (0.6 miles) at £22/night. Do not allow roadside or lay-by stops with cargo above £3,000 in this zone.',
        urgency: 'WITHIN_1HR',
        secure_parking_options: [
          { name: 'Staples Corner BP Truck Park', distance_miles: 0.6, direction: 'A406 eastbound, Staples Corner', cost_gbp: 22, accredited: true, cctv: true, security_patrol: false }
        ]
      }
    ],
    secure_parking_policy: {
      threshold_cargo_value: 5000,
      policy: 'All overnight stops with cargo exceeding £5,000 must use an accredited secure truck park. Drivers to book via company account — cost recoverable against client surcharge on high-value loads.',
      annual_cost_estimate: 1680,
      annual_theft_risk_mitigated: 45000,
      roi: '27x return on secure parking spend'
    },
    high_risk_routes: [
      { route: 'M1 J15-J19 overnight', known_risk: 'Highest cargo theft density in East Midlands corridor — 47 recorded incidents in 2025', recommendation: 'Mandate Northampton or Rugby Truck Stop for any overnight rest on this stretch. Brief all drivers on no lay-by stops.' },
      { route: 'A406 North Circular after 22:00', known_risk: 'Organised gang activity targeting unattended vehicles — average loss £8,400', recommendation: 'Reroute overnight M25 if possible. If North Circular unavoidable — Staples Corner Truck Park only.' }
    ],
    prevention_measures: [
      'Set telematics alert: any stop exceeding 45 minutes between 22:00-06:00 triggers automatic ops notification',
      'Brief all drivers: Watford Gap, Leicester Forest East, and Toddington are the three highest-theft services on the M1 — never leave vehicle unattended',
      'Company Truck Stop Account with Truckstop Network — £180/year, covers 200+ accredited sites, pays for itself on first prevented theft',
      'High-value loads above £10,000: pre-book secure parking at route planning stage, not on the road',
      'SMS instruction to driver before departure on any run with cargo above £8,000: confirm they have the secure parking list for their route'
    ],
    actions: []
  },

  ghost_freight: {
    demo_mode: true,
    fraud_risk: 'MEDIUM',
    flagged_count: 2,
    total_financial_exposure: 3400,
    all_clear: false,
    suspicious_entries: [
      {
        type: 'double_broker',
        entity: 'SpeedFreight Solutions Ltd',
        evidence: 'Booked via broker at £3.20/mile but carrier charged £4.80/mile — 50% uplift suggests double brokering. Carrier on delivery note differs from carrier on booking confirmation.',
        financial_exposure: 2100,
        confidence: 'HIGH',
        action: 'Do not pay invoice INV-2024-8901. Request original carrier booking confirmation and CMR. If double-brokered without consent, dispute in full.'
      },
      {
        type: 'no_show_carrier',
        entity: 'Premier Haulage UK',
        evidence: 'Vehicle registration on CMR (YK18 TRP) does not match DVLA records for this operator. Operator VAT number returns a dissolved company. Load was collected and delivered but by unverified entity.',
        financial_exposure: 1300,
        confidence: 'MEDIUM',
        action: 'Flag for investigation. Do not rebook. Report to National Vehicle Crime Intelligence Service if goods were at risk.'
      }
    ],
    verification_failures: [
      { carrier: 'Premier Haulage UK', issue: 'VAT number matches dissolved company', check_required: 'Verify via Companies House and DVLA before rebooking' }
    ],
    actions: []
  },

  subcontractor: {
    demo_mode: true,
    total_assessed: 4,
    approved_count: 2,
    recommended_for_removal: 1,
    trust_scores: [
      { name: 'FastFreight UK', overall_score: 84, score_breakdown: { on_time_performance: 88, dvsa_compliance: 92, insurance_validity: 100, payment_behaviour: 78, incident_history: 82 }, risk_level: 'LOW', recommendation: 'approved', flags: ['Two late payments in last 6 months'], last_incident: 'Minor delay M1 closure — Feb 2026' },
      { name: 'DHL Express', overall_score: 91, score_breakdown: { on_time_performance: 94, dvsa_compliance: 98, insurance_validity: 100, payment_behaviour: 95, incident_history: 88 }, risk_level: 'LOW', recommendation: 'approved', flags: [], last_incident: 'None in last 12 months' },
      { name: 'Yodel', overall_score: 61, score_breakdown: { on_time_performance: 67, dvsa_compliance: 71, insurance_validity: 100, payment_behaviour: 82, incident_history: 45 }, risk_level: 'MEDIUM', recommendation: 'use_with_caution', flags: ['OTR below contract threshold 3 of last 4 months', '2 DVSA improvement notices in last 18 months', '4 damage claims outstanding'], last_incident: 'Damaged pharmaceutical load — Mar 2026' },
      { name: 'XPO Logistics', overall_score: 38, score_breakdown: { on_time_performance: 44, dvsa_compliance: 52, insurance_validity: 85, payment_behaviour: 61, incident_history: 28 }, risk_level: 'CRITICAL', recommendation: 'terminate', flags: ['OTR 44% — 26 points below contract minimum', 'Insurance renewal overdue 3 months', '3 prohibition notices last 6 months', '7 damage claims unresolved'], last_incident: 'Load rejected at DC — Apr 2026' }
    ],
    actions: []
  },

  cash_flow: {
    demo_mode: true,
    overall_health: 'STRAINED',
    total_penalty_exposure: 4800,
    outstanding_receivables: 28400,
    recommended_credit_facility: 15000,
    forecast_weeks: [
      { week: 'Week 1 (7-13 Apr)', cash_in: 18200, cash_out: 22600, net: -4400, risk_items: [ { type: 'carrier_invoice', description: 'FastFreight UK monthly invoice due', amount: 8400, due_date: '10 Apr', mitigation: '30-day terms — push to day 28' }, { type: 'sla_penalty', description: 'Tesco Bradford slot breach REF-PH4421', amount: 340, due_date: '8 Apr', mitigation: 'Dispute filed — likely waived' } ], alert: 'Net negative — fuel costs and carrier invoices coinciding' },
      { week: 'Week 2 (14-20 Apr)', cash_in: 31600, cash_out: 19800, net: 11800, risk_items: [], alert: null },
      { week: 'Week 3 (21-27 Apr)', cash_in: 22100, cash_out: 26300, net: -4200, risk_items: [ { type: 'fuel_bill', description: 'Bunker fuel account settlement', amount: 6800, due_date: '24 Apr', mitigation: 'Consider weekly settlement to smooth cash flow' }, { type: 'customer_late_payment', description: 'B&Q 60-day terms — Feb invoice outstanding', amount: 4200, due_date: 'Overdue', mitigation: 'Chase accounts payable directly' } ], alert: 'Two simultaneous outgoings — consider revolving credit' }
    ],
    actions: []
  },

  churn_prediction: {
    demo_mode: true,
    total_revenue_at_risk: 48000,
    high_risk_count: 1,
    clients_at_risk: [
      { client: 'Tesco DC Bradford', churn_risk: 'HIGH', churn_probability_pct: 68, risk_signals: ['3 SLA breaches in last 6 weeks — up from 0 previously', 'Booking volume down 22% month on month', 'Account manager site visit 4 months ago', 'Two informal complaints logged'], days_to_contract_renewal: 47, revenue_at_risk: 38000, recommended_action: 'Urgent account review. Schedule senior visit within 7 days. Contract renewal in 47 days — non-renewal is likely without intervention.', relationship_score: 42 },
      { client: 'NHS Sheffield', churn_risk: 'LOW', churn_probability_pct: 12, risk_signals: ['One minor delivery query — resolved same day'], days_to_contract_renewal: 180, revenue_at_risk: 10000, recommended_action: 'Relationship healthy. Maintain current service level.', relationship_score: 87 }
    ],
    actions: []
  },

  workforce_pipeline: {
    demo_mode: true,
    workforce_health: 'AT_RISK',
    total_replacement_cost_at_risk: 24000,
    headcount_risk: { current_drivers: 35, required_drivers: 38, shortfall: 3, agency_dependency_pct: 22 },
    upcoming_issues: [
      { driver: 'Terry Walsh', issue_type: 'cpc_expiry', date: '2026-06-14', days_remaining: 71, replacement_lead_time_days: 90, action: 'URGENT — CPC expiry in 71 days, lead time 90 days. Book CPC refresher now or begin recruitment immediately.' },
      { driver: 'Robert Holt', issue_type: 'retirement', date: '2026-08-01', days_remaining: 119, replacement_lead_time_days: 90, action: 'Begin Class 1 recruitment now. 4 weeks advertising + 4 weeks notice + 4 weeks onboarding = 12 weeks minimum.' },
      { driver: 'Dean Ashworth', issue_type: 'licence_expiry', date: '2026-05-22', days_remaining: 48, replacement_lead_time_days: 14, action: 'Remind driver to renew DVLA licence. Medical renewal required — book GP appointment.' }
    ],
    recruitment_recommendations: ['Post Class 1 HGV vacancy on regional job boards', 'Consider DfT-funded apprenticeship scheme', 'Reduce agency dependency from 22% to below 15% target'],
    actions: []
  }
}

// POST /api/modules
export async function POST(request) {
  try {
    // ── AUTH CHECK ──────────────────────────────────────────────────
    const dhKey = request.headers.get('x-dh-key')
    if (dhKey !== process.env.DH_INTERNAL_KEY) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // ───────────────────────────────────────────────────────────────

    const body = await request.json()
    const { module, data, client_id } = body

    if (!module) {
      return Response.json({ error: 'module is required' }, { status: 400 })
    }

    // Check if real client data is connected
    const isEmptyTrigger = !data || Object.keys(data).filter(k => k !== 'trigger' && k !== 'timestamp').length === 0
    const hasRealClientData = client_id && !isEmptyTrigger

    let result

    if (hasRealClientData) {
      // Real client mode — call AI with actual data
      let clientSystemPrompt = ''
      if (client_id) {
        try {
          const clientConfig = await getClientConfig(client_id)
          clientSystemPrompt = clientConfig?.system_prompt || ''
        } catch {}
      }
      result = await runModule(module, data, clientSystemPrompt)
    } else {
      // Demo mode — return pre-built results instantly
      result = DEMO_RESULTS[module]
      if (!result) {
        result = { severity: 'LOW', financial_impact: 0, sections: { assessment: `${module} module — connect client data to activate.`, immediate_actions: [] }, actions: [] }
      }
    }

    // Log to Supabase silently if available
    let moduleRun = null
    if (client_id) {
      try { moduleRun = await logModuleRun(client_id, module, data, result) } catch {}
    }

    // Queue actions silently if available
    const queuedActions = []
    if (result.actions?.length && client_id && moduleRun) {
      for (const action of result.actions) {
        try {
          const approval = await queueAction({
            client_id, module_run_id: moduleRun.id,
            action_type: action.type, action_label: action.label,
            action_details: { recipient: action.recipient, content: action.content, subject: action.subject },
            financial_value: action.financial_value || 0,
            auto_approve: action.auto_approve || false
          })
          queuedActions.push({ ...action, approval_id: approval?.id })
        } catch {}
      }
    }

    return Response.json({
      success: true, module, result,
      module_run_id: moduleRun?.id,
      actions_queued: queuedActions.length,
      actions: queuedActions,
      demo_mode: !hasRealClientData
    })

  } catch (error) {
    console.error('Module error:', error)
    return Response.json({ error: 'Module failed', details: error.message }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({ available_modules: Object.keys(DEMO_RESULTS), status: 'operational' })
}
