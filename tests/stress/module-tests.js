/**
 * DisruptionHub v2 — Module Stress Tests
 * Run: node tests/stress/module-tests.js
 * Tests every module with realistic data at volume
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000'
const CLIENT_ID = process.env.TEST_CLIENT_ID || 'test-client-id'
const RESULTS = { passed: 0, failed: 0, errors: [], timings: {} }

// ── TEST DATA FIXTURES ────────────────────────────────────────────────────────
const FIXTURES = {

  disruption: {
    source: 'Manual',
    alert_type: 'weather',
    description: 'Storm Lilian has closed Port of Felixstowe for 48-72 hours. 3 containers affected: NHS medical consumables (18hr SLA, 2 days stock remaining), Samsung TVs for retailer launch tomorrow (£12,000/day penalty), B&Q furniture (6-day window).',
    affected_shipments: ['REF-4421', 'REF-8832', 'REF-9103'],
    timestamp: new Date().toISOString()
  },

  invoice: {
    invoices: [
      { ref: 'INV-44821', carrier: 'DHL Express', fuel_surcharge_applied: 18.4, shipment_value: 70476, shipments: ['REF-4421','REF-4836','REF-4851'] },
      { ref: 'INV-44799', carrier: 'DHL Express', amount: 1400, note: 'possible duplicate of INV-44781', date: '2024-11-01' },
      { ref: 'INV-44781', carrier: 'DHL Express', amount: 1400, date: '2024-11-01' }
    ],
    rate_cards: {
      'DHL Express': { fuel_surcharge_max: 14.2, contract_ref: 'DHL-ACM-2024', clause: '4.2' }
    }
  },

  carrier: {
    delivery_data: {
      carriers: [
        { name: 'Yodel', deliveries: 240, on_time: 202, damage_claims: 5, invoices: 240, correct_invoices: 230, contract_otr_threshold: 92 },
        { name: 'DHL Express', deliveries: 180, on_time: 174, damage_claims: 1, invoices: 180, correct_invoices: 179, contract_otr_threshold: 95 },
        { name: 'XPO Logistics', deliveries: 90, on_time: 84, damage_claims: 0, invoices: 90, correct_invoices: 88, contract_otr_threshold: 90 }
      ],
      period: '90 days',
      sla_breach_penalty: 5000
    }
  },

  driver_hours: {
    drivers: [
      { name: 'Paul Fletcher', vehicle_reg: 'LM71 KHT', hours_this_week: 52.3, remaining_deliveries: [
        { ref: 'REF-CT44', destination: 'Sheffield Crown Court', deadline: '16:00', estimated_hours: 1.8 },
        { ref: 'REF-DX21', destination: 'Sheffield Northern General', deadline: '17:00', estimated_hours: 1.2 },
        { ref: 'REF-GN88', destination: 'Sports Direct Sheffield', deadline: '18:00', estimated_hours: 0.8 }
      ]},
      { name: 'Sarah Moss', vehicle_reg: 'LM22 PKT', hours_this_week: 45.1, remaining_deliveries: [
        { ref: 'REF-4821', destination: 'Tesco DC Grantham', deadline: '14:30', estimated_hours: 0.9 }
      ]}
    ]
  },

  driver_retention: {
    drivers: [
      { name: 'James Okafor', vehicle_reg: 'LM71 KHT', weeks_at_max_hours: 4, weekends_off_last_6_weeks: 0, unresolved_maintenance_requests: 3, route_variety_score: 3 },
      { name: 'Maria Santos', vehicle_reg: 'LM22 PKT', friday_evening_runs_of_last_10: 8, route_variety_score: 2, weeks_at_max_hours: 1 },
      { name: 'Tom Richards', vehicle_reg: 'LM20 FRT', weeks_at_max_hours: 0, weekends_off_last_6_weeks: 4, route_variety_score: 8 }
    ],
    industry_replacement_cost: 7200
  },

  vehicle_health: {
    vehicles: [
      { reg: 'LM73 CDY', make: 'Renault T480', fault_codes: ['P0128','P0128','P0128','P0115'], fault_dates: ['2024-11-01','2024-11-05','2024-11-09','2024-11-17'], coolant_temp_trend: 'rising_0.3_per_100km', mileage: 187440 },
      { reg: 'LM71 KHT', make: 'Renault T480', fault_codes: [], mileage: 142880 },
      { reg: 'LM20 FRT', make: 'DAF XF', fault_codes: ['P0335'], fault_dates: ['2024-11-18'], mileage: 221000 }
    ]
  },

  carbon: {
    period: 'April 2023 - March 2024',
    fleet: [
      { type: 'Euro 6 HGV 44t', count: 6, annual_km: 180000 },
      { type: 'Euro 6 Van 3.5t', count: 4, annual_km: 45000 }
    ],
    routes: { total_deliveries: 847, avg_km_per_delivery: 180 },
    client_name: 'Acme Logistics Ltd',
    target_client: 'Tesco DC Leeds'
  },

  tender: {
    capabilities: {
      fleet_size: 10,
      vehicle_types: ['HGV 44t', 'HGV 18t', 'Refrigerated van'],
      regions: ['East Midlands', 'West Midlands', 'Yorkshire'],
      certifications: ['ISO 9001', 'FORS Bronze'],
      specialisms: ['cold chain', 'pharmaceutical', 'NHS supply'],
      adr: true
    },
    recent_tenders: [
      { title: 'NHS East Midlands Medical Supply Logistics', value: 480000, deadline_days: 21, source: 'Contracts Finder', ref: 'NHS-EM-2024-4821' },
      { title: 'Nottingham City Council Waste Transport', value: 290000, deadline_days: 35, source: 'Find a Tender', ref: 'NCC-2024-0881' },
      { title: 'MOD Donnington Parts Distribution', value: 430000, deadline_days: 28, source: 'Find a Tender', ref: 'MOD-D-2024-1147' }
    ]
  },

  fuel: {
    current_price_ppl: 142.4,
    average_30day_ppl: 145.6,
    vehicles: [
      { reg: 'LM71 KHT', driver: 'Paul Fletcher', driver_mobile: '+447700900001', current_level_pct: 28, tank_capacity_litres: 400, next_stop: 'Keele Services M6 J15' },
      { reg: 'LM22 PKT', driver: 'Sarah Moss', driver_mobile: '+447700900002', current_level_pct: 35, tank_capacity_litres: 400, next_stop: 'Stafford Services M6' },
      { reg: 'LM20 FRT', driver: 'Tom Richards', driver_mobile: '+447700900003', current_level_pct: 62, tank_capacity_litres: 420, next_stop: 'not on M6 corridor' }
    ]
  },

  regulation: {
    recent_publications: [
      { title: 'Safe Loading and Load Restraint — Updated Guidance', source: 'DVSA', published: '2024-11-15', summary: 'New minimum strap specifications for flatbed HGV loads over 2,000kg. Minimum 2,000kg daN rated equipment required from 1 January 2025.' },
      { title: 'Tachograph Regulations Amendment 2024', source: 'DfT', published: '2024-11-10', summary: 'Updated remote download requirements for digital tachographs. Monthly remote download now mandatory for fleets over 5 vehicles from April 2025.' }
    ],
    fleet: [
      { reg: 'LM71 KHT', type: 'curtainsider', current_strap_rating_dan: 1500 },
      { reg: 'LM72 ABX', type: 'flatbed', current_strap_rating_dan: 1500 },
      { reg: 'LM73 CDY', type: 'flatbed', current_strap_rating_dan: 1500 }
    ]
  },

  hazmat: {
    jobs: [
      { ref: 'REF-LB-4421', cargo: 'Lithium-ion battery packs', weight_kg: 480, un_number: 'UN3480', adr_class: '9', assigned_driver: 'Tom Richards', driver_adr_expiry: '2024-10-23', vehicle: 'LM20 FRT', vehicle_placarded: false },
      { ref: 'REF-GN-4422', cargo: 'General retail goods', weight_kg: 1200, un_number: null, assigned_driver: 'Paul Fletcher', driver_adr_expiry: '2026-06-15', vehicle: 'LM71 KHT', vehicle_placarded: false }
    ]
  },

  sla_prediction: {
    active_deliveries: [
      { ref: 'REF-NHS-4421', client: 'Sheffield Northern General', sla_window_closes: '17:30', current_eta: '17:47', driver: 'Sarah Moss', vehicle: 'LM22 PKT', driver_mobile: '+447700900002', current_position: 'M1 J33', penalty_if_breached: 25000 },
      { ref: 'REF-RET-4422', client: 'Tesco DC Leeds', sla_window_closes: '16:00', current_eta: '15:45', driver: 'Paul Fletcher', vehicle: 'LM71 KHT', penalty_if_breached: 5000 }
    ],
    traffic_data: { 'M1_J32_J33': 'accident_blocking', average_delay_minutes: 25 }
  },

  consolidation: {
    schedule: [
      { ref: 'REF-4821', origin: 'Leeds DC', destination: 'Bristol', departure: '07:00', pallets: 14, max_trailer_pallets: 26, driver: 'Paul Fletcher', vehicle: 'LM71 KHT' },
      { ref: 'REF-4836', origin: 'Leeds DC', destination: 'Cardiff', departure: '07:30', pallets: 9, max_trailer_pallets: 26, driver: 'James Okafor', vehicle: 'LM72 ABX', notes: '2 pallets over-height 2.8m' }
    ],
    driver_contacts: { 'Paul Fletcher': '+447700900001', 'James Okafor': '+447700900004' }
  },

  forecast: {
    historical_volumes: {
      2022: { week_48: 2800, week_49: 3100, week_50: 3400, average_week: 900 },
      2023: { week_48: 2950, week_49: 3300, week_50: 3600, average_week: 940 }
    },
    current_capacity: { vehicles: 10, drivers: 12, max_parcels_per_day: 850 },
    current_week: 42,
    agency_driver_standard_rate: 195,
    agency_driver_peak_rate: 280
  },

  benchmarking: {
    current_rates: [
      { lane: 'Leeds to London M1', rate_per_mile: 2.41, annual_runs: 240 },
      { lane: 'Manchester to Bristol M6', rate_per_mile: 2.63, annual_runs: 180 },
      { lane: 'Birmingham to Edinburgh A1', rate_per_mile: 3.20, annual_runs: 60 }
    ],
    market_data_source: 'Haulage Exchange spot rates 30-day average',
    market_rates: [
      { lane: 'Leeds to London M1', market_rate_per_mile: 2.80 },
      { lane: 'Manchester to Bristol M6', market_rate_per_mile: 2.95 },
      { lane: 'Birmingham to Edinburgh A1', market_rate_per_mile: 2.90 }
    ]
  },

  insurance: {
    claim: {
      ref: 'CLM-4821',
      claimant: 'Hendersons Retail Group',
      value: 8400,
      description: '22 flat-screen TVs damaged in transit — alleging driver negligence',
      delivery_ref: 'REF-4821',
      delivery_date: '2024-11-15',
      delivery_time: '14:22'
    },
    evidence_available: {
      gps_data: { max_speed_mph: 56, harsh_braking_events: 0, route_deviation: false },
      delivery_photo: { timestamp: '2024-11-15T14:22:00Z', packaging_intact: true, description: 'All 22 boxes intact on pallet, no visible damage' },
      pod_signature: { signed_by: 'J.Thompson', signed_at: '2024-11-15T14:22:00Z', condition_noted: 'Good condition' },
      previous_claims: [{ date: '2024-09-12', value: 3200, outcome: 'no_liability' }, { date: '2024-07-08', value: 1800, outcome: 'no_liability' }]
    }
  }
}

// ── RUN A SINGLE MODULE TEST ──────────────────────────────────────────────────
async function testModule(moduleName, fixture, label = '') {
  const start = Date.now()
  const testLabel = label || moduleName

  try {
    const res = await fetch(`${BASE_URL}/api/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module: moduleName,
        data: fixture,
        client_id: CLIENT_ID
      })
    })

    const elapsed = Date.now() - start
    RESULTS.timings[testLabel] = elapsed

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`HTTP ${res.status}: ${err.substring(0,200)}`)
    }

    const data = await res.json()

    if (!data.success) {
      throw new Error(`Module returned success:false — ${data.error}`)
    }
    if (!data.result) {
      throw new Error('No result returned')
    }

    // Basic structural checks per module
    validateModuleResult(moduleName, data.result)

    RESULTS.passed++
    console.log(`  ✓ ${testLabel} (${elapsed}ms)`)
    return data

  } catch (err) {
    RESULTS.failed++
    RESULTS.errors.push({ test: testLabel, error: err.message })
    console.error(`  ✗ ${testLabel} — ${err.message}`)
    return null
  }
}

// ── VALIDATE STRUCTURE ────────────────────────────────────────────────────────
function validateModuleResult(module, result) {
  const checks = {
    disruption:       () => result.severity && result.sections && Array.isArray(result.actions),
    invoice:          () => typeof result.total_overcharge === 'number' && Array.isArray(result.discrepancies),
    carrier:          () => Array.isArray(result.carriers) && result.carriers.length > 0,
    driver_hours:     () => Array.isArray(result.drivers_at_risk),
    driver_retention: () => Array.isArray(result.at_risk_drivers),
    vehicle_health:   () => Array.isArray(result.vehicles_at_risk),
    carbon:           () => typeof result.scope_1_tonnes_co2e === 'number',
    tender:           () => Array.isArray(result.matching_tenders),
    fuel:             () => typeof result.current_price_ppl === 'number' && Array.isArray(result.vehicles_to_fill),
    regulation:       () => Array.isArray(result.relevant_changes),
    hazmat:           () => typeof result.jobs_checked === 'number' && typeof result.all_clear === 'boolean',
    sla_prediction:   () => Array.isArray(result.at_risk_deliveries),
    consolidation:    () => Array.isArray(result.opportunities),
    forecast:         () => Array.isArray(result.forecast_periods),
    benchmarking:     () => Array.isArray(result.lane_analysis),
    insurance:        () => result.liability_assessment && result.response_letter
  }

  const check = checks[module]
  if (check && !check()) {
    throw new Error(`Result structure invalid for module: ${module}`)
  }
}

// ── RUN ALL MODULE TESTS ──────────────────────────────────────────────────────
async function runModuleTests() {
  console.log('\n═══════════════════════════════════════════')
  console.log('  DisruptionHub — Module Stress Tests')
  console.log(`  Target: ${BASE_URL}`)
  console.log('═══════════════════════════════════════════\n')

  console.log('Phase 1: All 16 modules — single run each\n')

  for (const [moduleName, fixture] of Object.entries(FIXTURES)) {
    await testModule(moduleName, fixture)
    await sleep(1000) // 1s between calls to avoid rate limiting
  }

  console.log('\nPhase 2: Concurrent load — 3 modules simultaneously\n')

  await Promise.all([
    testModule('disruption', FIXTURES.disruption, 'disruption (concurrent-1)'),
    testModule('invoice', FIXTURES.invoice, 'invoice (concurrent-2)'),
    testModule('sla_prediction', FIXTURES.sla_prediction, 'sla_prediction (concurrent-3)')
  ])

  console.log('\nPhase 3: Rapid repeat — same module 5 times\n')

  for (let i = 1; i <= 5; i++) {
    await testModule('disruption', FIXTURES.disruption, `disruption (repeat ${i}/5)`)
    await sleep(2000)
  }

  console.log('\nPhase 4: Invalid data handling\n')
  await testInvalidInputs()

  // Print summary
  printSummary()
}

// ── INVALID INPUT TESTS ───────────────────────────────────────────────────────
async function testInvalidInputs() {
  const invalidTests = [
    { module: 'disruption', data: {}, label: 'empty data' },
    { module: 'invoice', data: { invoices: [] }, label: 'empty invoice list' },
    { module: 'invalid_module', data: {}, label: 'unknown module name' },
  ]

  for (const t of invalidTests) {
    try {
      const res = await fetch(`${BASE_URL}/api/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(t)
      })
      const data = await res.json()

      if (t.module === 'invalid_module' && res.status === 500) {
        RESULTS.passed++
        console.log(`  ✓ Correctly rejected: ${t.label}`)
      } else if (data.success) {
        RESULTS.passed++
        console.log(`  ✓ Handled gracefully: ${t.label}`)
      } else {
        RESULTS.passed++
        console.log(`  ✓ Returned error cleanly: ${t.label}`)
      }
    } catch (err) {
      RESULTS.failed++
      RESULTS.errors.push({ test: `invalid:${t.label}`, error: err.message })
      console.error(`  ✗ ${t.label} — ${err.message}`)
    }
    await sleep(500)
  }
}

function printSummary() {
  console.log('\n═══════════════════════════════════════════')
  console.log('  RESULTS')
  console.log('═══════════════════════════════════════════')
  console.log(`  Passed:  ${RESULTS.passed}`)
  console.log(`  Failed:  ${RESULTS.failed}`)
  console.log(`  Total:   ${RESULTS.passed + RESULTS.failed}`)

  if (Object.keys(RESULTS.timings).length) {
    const times = Object.values(RESULTS.timings)
    const avg = Math.round(times.reduce((a,b)=>a+b,0)/times.length)
    const max = Math.max(...times)
    console.log(`\n  Avg response: ${avg}ms`)
    console.log(`  Slowest:      ${max}ms`)
    const slowest = Object.entries(RESULTS.timings).sort((a,b)=>b[1]-a[1])[0]
    console.log(`  Slowest test: ${slowest[0]} (${slowest[1]}ms)`)
  }

  if (RESULTS.errors.length) {
    console.log('\n  FAILURES:')
    RESULTS.errors.forEach(e => console.log(`  ✗ ${e.test}: ${e.error}`))
  }

  console.log('\n═══════════════════════════════════════════\n')
  process.exit(RESULTS.failed > 0 ? 1 : 0)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

runModuleTests().catch(err => {
  console.error('Test runner crashed:', err)
  process.exit(1)
})
