import { runScenario } from '../../../lib/scenarios.js'

// Demo data for each scenario so they work without real client data
const SCENARIO_DEMOS = {
  driver_silent: {
    driver: { name: 'Carl Hughes', phone: '+447700000001' },
    vehicle: { reg: 'BK21 XYZ', type: 'HGV 18t' },
    lastKnownPosition: 'M1 Southbound between J28 and J27, Derbyshire',
    minutesSilent: 35,
    cargo: { type: 'mixed retail', value: 12000, temperature_controlled: false }
  },
  delivery_rejection: {
    driver: { name: 'Mark Davies' },
    vehicle: { reg: 'LN70 ABC' },
    cargo: { type: 'fresh produce', value: 4200, pallets: 8, temperature_controlled: true },
    customer: { name: 'Tesco DC Bradford', contact: '01274 000000' },
    rejectionReason: 'Arrived 2 hours outside booking window — DC refused to accept',
    currentLocation: 'Tesco DC Bradford, Canal Road'
  },
  churn_prediction: {
    name: 'Midlands Fresh Logistics',
    contact_name: 'Dave Pearson',
    orders_this_month: 6,
    avg_monthly_orders: 18,
    days_since_last_order: 11,
    typical_order_interval_days: 5,
    open_disputes: 1,
    sla_breaches_last_30_days: 3,
    days_to_contract_renewal: 45,
    annual_revenue: 86400
  },
  subcontractor_noshow: {
    bookedSub: { name: 'JK Transport Ltd', contact: '07700000002' },
    jobDetails: { date: 'tomorrow', loads: 3, routes: ['Leeds → London', 'Leeds → Bristol'], total_value: 2800 },
    hoursNotice: 14,
    approvedSubs: [
      { name: 'Apex Haulage', specialisms: ['general freight', 'curtainsider'], contact: '07700000003' },
      { name: 'Northern Freight Co', specialisms: ['temperature controlled', 'general freight'], contact: '07700000004' },
      { name: 'FastMove Ltd', specialisms: ['express', 'general freight'], contact: '07700000005' }
    ]
  },
  fuel_card_declined: {
    driver: { name: 'James Reid' },
    vehicle: { reg: 'SF68 PQR' },
    currentLocation: 'A1 Northbound near Newark, Nottinghamshire',
    fuelLevelPct: 14,
    distanceToDepotMiles: 85,
    nextDeliveryMiles: 42
  },
  planned_closures: [
    { name: 'Leeds → London', corridor: 'M1' },
    { name: 'Leeds → Edinburgh', corridor: 'A1(M)' },
    { name: 'Manchester → Bristol', corridor: 'M6' }
  ],
  licence_check: [
    { name: 'Carl Hughes', vehicle: 'BK21 XYZ', penalty_points: 6, licence_expiry: '2027-03-15', dqc_expiry: '2026-06-01', licence_status: 'valid' },
    { name: 'James Reid', vehicle: 'SF68 PQR', penalty_points: 10, licence_expiry: '2026-05-20', dqc_expiry: '2026-04-14', licence_status: 'valid' },
    { name: 'Mark Davies', vehicle: 'LN70 ABC', penalty_points: 3, licence_expiry: '2029-08-10', dqc_expiry: '2027-11-30', licence_status: 'valid' },
    { name: 'Paul Wright', vehicle: 'YX70 MNO', penalty_points: 2, licence_expiry: '2028-02-28', dqc_expiry: '2025-11-30', licence_status: 'valid' }
  ],
  claim_pre_emption: {
    deliveryRef: 'REF-7201',
    claimValue: 4200,
    claimType: 'cargo_damage',
    claimantDescription: 'Customer claims 6 pallets of electronics damaged during transit on 15 March. Seeks full replacement value.',
    availableEvidence: [
      { type: 'gps_data', available: true, detail: 'Full GPS track for delivery date' },
      { type: 'pod_signature', available: true, detail: 'Signed POD with no damage noted' },
      { type: 'driver_walkaround', available: true, detail: 'Pre-trip vehicle check completed' },
      { type: 'delivery_photo', available: false, detail: 'Driver did not photograph delivery' },
      { type: 'temperature_log', available: false, detail: 'Non temperature controlled cargo' }
    ]
  },
  border_doc_failure: {
    driver: { name: 'Carl Hughes' },
    vehicle: { reg: 'BK21 XYZ' },
    borderPoint: 'Dover Eastern Docks',
    cargo: { description: 'Industrial components', value: 28000, commodity_code: '8483409900', origin: 'UK', destination: 'Germany' },
    documentErrors: [
      { document: 'Commercial Invoice', error: 'EORI number missing from exporter field', field: 'exporter_eori' },
      { document: 'Packing List', error: 'Gross weight discrepancy — invoice says 2,400kg, packing list says 2,650kg', field: 'gross_weight' }
    ],
    hoursToPlannedCrossing: 3.5
  },
  cascade_calculator: {
    ref: 'REF-4421',
    description: 'M1 J28 closure — Carl Hughes 90 minutes late',
    delay_minutes: 90,
    penalty: 340,
    downstream_dependencies: [
      { ref: 'REF-RETURN-4421', type: 'return_collection', description: 'Return collection from Tesco DC scheduled after delivery', delay_minutes: 90, buffer_minutes: 30, penalty: 0 },
      { ref: 'REF-5517', type: 'connected_delivery', description: 'Leeds → Cardiff run using same vehicle after return', delay_minutes: 90, buffer_minutes: 45, penalty: 500 },
      { ref: 'REF-SUPPLIER-881', type: 'supplier_pickup', description: 'Supplier pickup booked at 16:00 — same driver', delay_minutes: 90, buffer_minutes: 20, penalty: 200 }
    ]
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { scenario, data, use_demo } = body

    if (!scenario) {
      return Response.json({ error: 'scenario is required' }, { status: 400 })
    }

    // Use demo data if no real data provided
    const inputData = (use_demo || !data) ? SCENARIO_DEMOS[scenario] : data

    if (!inputData) {
      return Response.json({ error: `No data available for scenario: ${scenario}` }, { status: 400 })
    }

    const result = await runScenario(scenario, inputData)

    return Response.json({ success: true, scenario, result })

  } catch (error) {
    console.error('Scenario error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({
    available_scenarios: [
      { id: 'driver_silent',        label: 'Driver Goes Silent',               description: 'Escalation protocol when driver stops responding' },
      { id: 'delivery_rejection',   label: 'Delivery Rejection at Door',       description: 'Options when customer refuses delivery' },
      { id: 'churn_prediction',     label: 'Client Churn Prediction',          description: 'Early warning signals for client loss' },
      { id: 'subcontractor_noshow', label: 'Subcontractor No-Show',            description: 'Find alternatives when booked sub cancels' },
      { id: 'fuel_card_declined',   label: 'Fuel Card Declined',               description: 'Driver stranded mid-route' },
      { id: 'planned_closures',     label: 'Planned Road Closure Pre-Warning', description: '72hr advance warning on Highways England works' },
      { id: 'licence_check',        label: 'Driver Licence Check',             description: 'Points, expiry and DQC monitoring' },
      { id: 'claim_pre_emption',    label: 'Insurance Claim Pre-Emption',      description: 'Build evidence pack before claim escalates' },
      { id: 'border_doc_failure',   label: 'Border Documentation Failure',     description: 'Fix customs errors before driver reaches border' },
      { id: 'cascade_calculator',   label: 'Cascade Penalty Calculator',       description: 'Map total exposure from one delay across all connected deliveries' }
    ]
  })
}
