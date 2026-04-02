/**
 * DisruptionHub v4 — Intelligence Module Stress Tests
 * Run: node tests/stress/v4-tests.js
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000'
const CLIENT_ID = process.env.TEST_CLIENT_ID || 'test-client-id'
const R = { passed: 0, failed: 0, errors: [] }
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function req(path, opts = {}) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...opts.headers },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    })
    let body = null
    try { body = await res.json() } catch {}
    return { status: res.status, body }
  } catch (e) { return { status: 0, body: null, error: e.message } }
}

const pass = (l, d='') => { R.passed++; console.log(`  ✓ ${l}${d?' — '+d:''}`) }
const fail = (l, d='') => { R.failed++; R.errors.push({ l, d }); console.error(`  ✗ ${l}${d?' — '+d:''}`) }

// ── FIXTURES ──────────────────────────────────────────────────────────────────
const F = {
  cargo_theft: {
    job_ref: 'TEST-CT-001', cargo_type: 'electronics', cargo_value: 145000,
    vehicle_reg: 'LM71 KHT', driver_name: 'Paul Fletcher', driver_hours_remaining: 3.5,
    origin: 'Heathrow', destination: 'Edinburgh', route: 'M25 M1 A1',
    departure_time: new Date().setHours(23, 0, 0, 0), client_id: CLIENT_ID
  },
  workforce: {
    client_id: CLIENT_ID,
    drivers: [
      { name: 'James Okafor', dcpc_expiry: new Date(Date.now() + 18*24*60*60*1000).toISOString(), weeks_at_max_hours: 4 },
      { name: 'Maria Santos', dcpc_expiry: new Date(Date.now() + 45*24*60*60*1000).toISOString() },
      { name: 'Tom Richards', dcpc_expiry: new Date(Date.now() + 200*24*60*60*1000).toISOString() },
    ],
    contract_pipeline: [{ client: 'NHS Sheffield', routes_needed: 3, start_date: '2025-02-01' }],
  },
  client_churn: {
    client_id: CLIENT_ID,
    clients: [
      { name: 'Test Retail Ltd', annual_revenue: 280000, order_volume_trend: -18, avg_payment_days: 67, complaint_rate: 2.1, last_contact_days: 28 },
      { name: 'NHS Test Trust', annual_revenue: 180000, order_volume_trend: 5, avg_payment_days: 28, complaint_rate: 0.3, last_contact_days: 7 },
    ]
  },
  cashflow: {
    client_id: CLIENT_ID,
    invoices: [
      { client: 'Test Retail', amount: 42000, due_date: new Date(Date.now() + 5*24*60*60*1000).toISOString(), payment_pattern_days: 67 },
      { client: 'NHS Trust', amount: 18500, due_date: new Date(Date.now() - 3*24*60*60*1000).toISOString(), payment_pattern_days: 28 },
    ],
    payroll: { weekly_cost: 28000, next_payroll: new Date(Date.now() + 4*24*60*60*1000).toISOString() },
  },
  subcontractor: {
    client_id: CLIENT_ID,
    subcontractors: [
      { name: 'FastMove Ltd', jobs_completed: 120, jobs_late: 18, damage_claims: 3 },
      { name: 'NewCo Freight', jobs_completed: 5, jobs_late: 1, damage_claims: 0 },
    ],
    active_jobs: [
      { ref: 'TEST-001', subcontractor: 'NewCo Freight', cargo_type: 'electronics', cargo_value: 68000, expected_vehicle_reg: 'LM99 ABC' }
    ]
  },
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 1: CARGO THEFT
// ═══════════════════════════════════════════════════════════════════
async function testCargoTheft() {
  console.log('\n── Module 1: Cargo Theft Intelligence\n')

  // Fast local risk scoring
  const r1 = await req('/api/intelligence/cargo-theft', { method:'POST', body: { ...F.cargo_theft, skip_ai: false } })
  r1.status === 200 && r1.body?.success
    ? pass('Full cargo theft analysis', `Risk: ${r1.body.threat_assessment?.risk_level}`)
    : fail('Cargo theft analysis', `${r1.status}: ${JSON.stringify(r1.body).substring(0,100)}`)
  await sleep(2000)

  // Low-risk cargo (should return quickly without AI)
  const r2 = await req('/api/intelligence/cargo-theft', { method:'POST', body: { ...F.cargo_theft, cargo_type: 'general freight', cargo_value: 3000, skip_ai: false } })
  r2.status === 200 && r2.body?.success
    ? pass('Low-risk cargo assessment returns cleanly')
    : fail('Low-risk cargo', `${r2.status}`)
  await sleep(1000)

  // Missing required field
  const r3 = await req('/api/intelligence/cargo-theft', { method:'POST', body: { job_ref: 'TEST' } })
  r3.status === 400 ? pass('Rejects missing cargo_type') : fail('Should reject missing cargo_type', `Got ${r3.status}`)
  await sleep(500)

  // Historical GET
  const r4 = await req(`/api/intelligence/cargo-theft?client_id=${CLIENT_ID}`)
  r4.status === 200 ? pass('Historical assessments GET') : fail('Historical GET', `${r4.status}`)
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 2: WORKFORCE
// ═══════════════════════════════════════════════════════════════════
async function testWorkforce() {
  console.log('\n── Module 2: Driver Workforce Pipeline\n')

  const r1 = await req('/api/intelligence/workforce', { method:'POST', body: F.workforce })
  r1.status === 200 && r1.body?.success
    ? pass('Workforce pipeline analysis', `DCPC urgent: ${r1.body.current_state?.dcpc_lapsing_30_days}`)
    : fail('Workforce analysis', `${r1.status}: ${JSON.stringify(r1.body).substring(0,100)}`)
  await sleep(2000)

  // Via universal endpoint
  const r2 = await req('/api/intelligence', { method:'POST', body: { module:'workforce', data: F.workforce, client_id: CLIENT_ID } })
  r2.status === 200 && r2.body?.success
    ? pass('Workforce via universal endpoint')
    : fail('Workforce via universal endpoint', `${r2.status}`)
  await sleep(2000)

  // Missing drivers
  const r3 = await req('/api/intelligence/workforce', { method:'POST', body: { client_id: CLIENT_ID } })
  r3.status === 400 ? pass('Rejects missing drivers array') : fail('Should reject missing drivers', `${r3.status}`)

  // GET latest
  const r4 = await req(`/api/intelligence/workforce?client_id=${CLIENT_ID}`)
  r4.status === 200 ? pass('Workforce GET latest assessment') : fail('Workforce GET', `${r4.status}`)
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 3: CLIENT CHURN
// ═══════════════════════════════════════════════════════════════════
async function testClientChurn() {
  console.log('\n── Module 3: Client Churn Prediction\n')

  const r1 = await req('/api/intelligence/client-churn', { method:'POST', body: F.client_churn })
  r1.status === 200 && r1.body?.success
    ? pass('Client churn analysis', `High risk: ${r1.body.portfolio_summary?.high_risk} clients`)
    : fail('Client churn analysis', `${r1.status}: ${JSON.stringify(r1.body).substring(0,100)}`)
  await sleep(2000)

  // Single high-risk client
  const r2 = await req('/api/intelligence/client-churn', { method:'POST', body: {
    client_id: CLIENT_ID,
    clients: [{ name: 'Crisis Client Ltd', annual_revenue: 500000, order_volume_trend: -35, avg_payment_days: 90, complaint_rate: 5.2, last_contact_days: 60 }]
  }})
  r2.status === 200 && (r2.body?.client_assessments?.[0]?.churn_probability > 50)
    ? pass('High-risk single client returns elevated churn score', `${r2.body.client_assessments[0].churn_probability}%`)
    : fail('High-risk client should score > 50%', `Got: ${r2.body?.client_assessments?.[0]?.churn_probability}`)
  await sleep(2000)

  // Missing clients array
  const r3 = await req('/api/intelligence/client-churn', { method:'POST', body: { client_id: CLIENT_ID } })
  r3.status === 400 ? pass('Rejects missing clients array') : fail('Should reject missing clients', `${r3.status}`)

  // GET scores
  const r4 = await req(`/api/intelligence/client-churn?client_id=${CLIENT_ID}`)
  r4.status === 200 ? pass('Client churn GET scores') : fail('Churn GET', `${r4.status}`)
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 4: CASH FLOW
// ═══════════════════════════════════════════════════════════════════
async function testCashflow() {
  console.log('\n── Module 4: Cash Flow Intelligence\n')

  const r1 = await req('/api/intelligence/cashflow', { method:'POST', body: F.cashflow })
  r1.status === 200 && r1.body?.success
    ? pass('Cashflow 12-week forecast', `Trough: ${r1.body.summary?.trough_detected ? 'DETECTED' : 'none'}`)
    : fail('Cashflow analysis', `${r1.status}: ${JSON.stringify(r1.body).substring(0,100)}`)
  await sleep(2000)

  // Verify 12-week forecast has correct structure
  const forecast = r1.body?.weekly_forecast
  forecast && forecast.length >= 10
    ? pass('12-week forecast has sufficient weeks', `${forecast.length} weeks`)
    : fail('Forecast should have 10+ weeks', `Got ${forecast?.length}`)

  // Overdue invoices should trigger IMMEDIATE actions
  const r2 = await req('/api/intelligence/cashflow', { method:'POST', body: {
    client_id: CLIENT_ID,
    invoices: [
      { client: 'Overdue Corp', amount: 95000, due_date: new Date(Date.now() - 30*24*60*60*1000).toISOString(), payment_pattern_days: 60 },
    ]
  }})
  r2.status === 200
    ? pass('Handles overdue invoice scenario')
    : fail('Overdue invoice handling', `${r2.status}`)
  await sleep(2000)

  // Missing data
  const r3 = await req('/api/intelligence/cashflow', { method:'POST', body: { client_id: CLIENT_ID } })
  r3.status === 400 ? pass('Rejects missing invoice data') : fail('Should reject empty cashflow data', `${r3.status}`)

  // GET latest forecast
  const r4 = await req(`/api/intelligence/cashflow?client_id=${CLIENT_ID}`)
  r4.status === 200 ? pass('Cashflow GET latest forecast') : fail('Cashflow GET', `${r4.status}`)
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 5: SUBCONTRACTOR
// ═══════════════════════════════════════════════════════════════════
async function testSubcontractor() {
  console.log('\n── Module 5: Subcontractor Trust Score\n')

  const r1 = await req('/api/intelligence/subcontractor', { method:'POST', body: F.subcontractor })
  r1.status === 200 && r1.body?.success
    ? pass('Subcontractor trust scoring', `Scores: ${r1.body.subcontractor_scores?.length}, Ghost alerts: ${r1.body.ghost_freight_alerts?.length}`)
    : fail('Subcontractor analysis', `${r1.status}: ${JSON.stringify(r1.body).substring(0,100)}`)
  await sleep(2000)

  // Vehicle mismatch should generate ghost alert
  const r2 = await req('/api/intelligence/subcontractor', { method:'POST', body: {
    client_id: CLIENT_ID,
    subcontractors: [{ name: 'Test Haulier', jobs_completed: 50, jobs_late: 2 }],
    active_jobs: [{ ref: 'GHOST-TEST', subcontractor: 'Test Haulier', cargo_type: 'electronics', cargo_value: 80000, expected_vehicle_reg: 'AA11 BBB', actual_vehicle_reg: 'ZZ99 XYZ' }]
  }})
  r2.status === 200 && (r2.body.ghost_freight_alerts?.length > 0)
    ? pass('Vehicle mismatch triggers ghost freight alert', `Alert type: ${r2.body.ghost_freight_alerts[0]?.alert_type}`)
    : fail('Vehicle mismatch should trigger ghost alert', `Alerts: ${r2.body?.ghost_freight_alerts?.length}`)
  await sleep(2000)

  // Missing subcontractors
  const r3 = await req('/api/intelligence/subcontractor', { method:'POST', body: { client_id: CLIENT_ID } })
  r3.status === 400 ? pass('Rejects missing subcontractors') : fail('Should reject missing array', `${r3.status}`)

  // GET trust scores
  const r4 = await req(`/api/intelligence/subcontractor?client_id=${CLIENT_ID}`)
  r4.status === 200 ? pass('Subcontractor GET trust scores') : fail('Subcontractor GET', `${r4.status}`)
}

// ═══════════════════════════════════════════════════════════════════
// UNIVERSAL ENDPOINT + VALIDATION
// ═══════════════════════════════════════════════════════════════════
async function testUniversalEndpoint() {
  console.log('\n── Universal Endpoint & Validation\n')

  const r1 = await req('/api/intelligence')
  r1.status === 200 && r1.body?.available_modules?.length === 5
    ? pass('Universal GET lists all 5 modules')
    : fail('Universal GET', `Got ${r1.body?.available_modules?.length} modules`)

  const r2 = await req('/api/intelligence', { method:'POST', body: { module: 'nonexistent', data: {} } })
  r2.status === 400 ? pass('Rejects unknown module') : fail('Should reject unknown module', `${r2.status}`)

  const r3 = await req('/api/intelligence', { method:'POST', body: {} })
  r3.status === 400 ? pass('Rejects empty body') : fail('Should reject empty body', `${r3.status}`)

  // Intelligence dashboard page loads
  const page = await fetch(`${BASE_URL}/intelligence`)
  page.status === 200 ? pass('Intelligence dashboard page loads') : fail('Dashboard page', `HTTP ${page.status}`)
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n╔══════════════════════════════════════════════╗')
  console.log('║  DisruptionHub v4 — Intelligence Tests       ║')
  console.log(`║  ${BASE_URL.padEnd(44)}║`)
  console.log('╚══════════════════════════════════════════════╝')

  await testCargoTheft()
  await testWorkforce()
  await testClientChurn()
  await testCashflow()
  await testSubcontractor()
  await testUniversalEndpoint()

  console.log('\n╔══════════════════════════════════════════════╗')
  console.log(`║  ✓ Passed:  ${String(R.passed).padEnd(34)}║`)
  console.log(`║  ✗ Failed:  ${String(R.failed).padEnd(34)}║`)
  console.log('╚══════════════════════════════════════════════╝')
  if (R.errors.length) {
    console.log('\n  Failures:')
    R.errors.forEach(e => console.log(`  ✗ ${e.l}: ${e.d}`))
  }
  console.log('')
  process.exit(R.failed > 0 ? 1 : 0)
}

run().catch(e => { console.error('Crash:', e); process.exit(1) })
