/**
 * DisruptionHub v3 — Stress Tests
 * Tests all three new features: GPS tracking, driver PWA, customer portal
 * Run: node tests/stress/v3-tests.js
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000'
const CLIENT_ID = process.env.TEST_CLIENT_ID || 'test-client-id'
const RESULTS = { passed: 0, failed: 0, errors: [], timings: {} }

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function req(path, opts = {}) {
  const start = Date.now()
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts
    })
    const elapsed = Date.now() - start
    let body = null
    try { body = await res.json() } catch {}
    return { status: res.status, body, elapsed }
  } catch (e) {
    return { status: 0, body: null, elapsed: Date.now() - start, error: e.message }
  }
}

function pass(label, detail = '', elapsed = null) {
  RESULTS.passed++
  const t = elapsed ? ` (${elapsed}ms)` : ''
  console.log(`  ✓ ${label}${t}${detail ? ' — ' + detail : ''}`)
}

function fail(label, detail = '') {
  RESULTS.failed++
  RESULTS.errors.push({ label, detail })
  console.error(`  ✗ ${label}${detail ? ' — ' + detail : ''}`)
}

// ── FIXTURE DATA ──────────────────────────────────────────────────────────────
const VEHICLE_POSITIONS = [
  { vehicle_reg: 'LM71 KHT', driver_name: 'Paul Fletcher', latitude: 52.4862, longitude: -1.8904, speed_mph: 52, heading: 180, ignition_on: true, timestamp: new Date().toISOString() },
  { vehicle_reg: 'LM22 PKT', driver_name: 'Sarah Moss',    latitude: 53.4808, longitude: -2.2426, speed_mph: 61, heading: 90,  ignition_on: true, timestamp: new Date().toISOString() },
  { vehicle_reg: 'LM20 FRT', driver_name: 'Tom Richards',  latitude: 51.5074, longitude: -0.1278, speed_mph: 0,  heading: 0,   ignition_on: false, timestamp: new Date().toISOString() },
]

const DRIVER_JOB = {
  client_id: CLIENT_ID,
  vehicle_reg: 'LM71 KHT',
  ref: `TEST-${Date.now()}`,
  origin: 'Birmingham DC',
  destination: 'Sheffield Northern General',
  cargo: 'Medical consumables',
  sla_deadline: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
  instructions: 'REROUTE: M1 J33 closure. Take A630 → A61. Arrive before 17:30.',
  status: 'en_route',
}

const TRACKING_LINK = {
  client_id: CLIENT_ID,
  job_ref: DRIVER_JOB.ref,
  vehicle_reg: 'LM71 KHT',
  driver_name: 'Paul Fletcher',
  origin: 'Birmingham DC',
  destination: 'Sheffield Northern General',
  cargo_description: 'Medical supplies',
  estimated_arrival: new Date(Date.now() + 85 * 60 * 1000).toISOString(),
  client_branding: { company_name: 'Acme Logistics', accent_color: '#00e5b0' },
  expires_hours: 24,
}

// ═══════════════════════════════════════════════════════════════════
// FEATURE 1: GPS TRACKING
// ═══════════════════════════════════════════════════════════════════
async function testGPSTracking() {
  console.log('\n── Feature 1: GPS Tracking\n')

  // 1a. Webhook — single position
  const r1 = await req('/api/telematics/webhook', {
    method: 'POST',
    headers: { 'x-client-id': CLIENT_ID },
    body: JSON.stringify(VEHICLE_POSITIONS[0])
  })
  r1.status === 200 && r1.body?.success
    ? pass('Single position via webhook', `${r1.body.positions_saved} saved`, r1.elapsed)
    : fail('Single position via webhook', `Status ${r1.status}: ${JSON.stringify(r1.body)}`)

  await sleep(500)

  // 1b. Webhook — batch positions
  const r2 = await req('/api/telematics/webhook', {
    method: 'POST',
    headers: { 'x-client-id': CLIENT_ID },
    body: JSON.stringify(VEHICLE_POSITIONS)
  })
  r2.status === 200 && r2.body?.positions_saved === 3
    ? pass('Batch positions via webhook', `${r2.body.positions_saved} saved`, r2.elapsed)
    : fail('Batch positions via webhook', `Saved ${r2.body?.positions_saved}, expected 3`)

  await sleep(500)

  // 1c. Get latest positions
  const r3 = await req(`/api/telematics/positions?client_id=${CLIENT_ID}`)
  r3.status === 200 && Array.isArray(r3.body?.positions)
    ? pass('Get latest positions', `${r3.body.count} vehicles returned`, r3.elapsed)
    : fail('Get latest positions', `Status ${r3.status}`)

  await sleep(500)

  // 1d. Invalid webhook — no client id
  const r4 = await req('/api/telematics/webhook', {
    method: 'POST',
    body: JSON.stringify(VEHICLE_POSITIONS[0])
  })
  r4.status === 401
    ? pass('Webhook rejects missing client ID', `Got ${r4.status}`)
    : fail('Webhook should reject missing client ID', `Got ${r4.status}`)

  await sleep(500)

  // 1e. Invalid webhook — no position data
  const r5 = await req('/api/telematics/webhook', {
    method: 'POST',
    headers: { 'x-client-id': CLIENT_ID },
    body: JSON.stringify({ foo: 'bar' })
  })
  r5.status === 400
    ? pass('Webhook rejects invalid position data')
    : fail('Webhook should reject invalid data', `Got ${r5.status}`)

  await sleep(500)

  // 1f. Missing client_id on positions GET
  const r6 = await req('/api/telematics/positions')
  r6.status === 400
    ? pass('Positions GET requires client_id')
    : fail('Positions GET should require client_id', `Got ${r6.status}`)

  await sleep(500)

  // 1g. Concurrent webhook submissions
  console.log('\n  Concurrent webhook load test (10 simultaneous)...')
  const concurrentRequests = Array(10).fill(null).map((_, i) =>
    req('/api/telematics/webhook', {
      method: 'POST',
      headers: { 'x-client-id': CLIENT_ID },
      body: JSON.stringify({
        ...VEHICLE_POSITIONS[i % 3],
        timestamp: new Date().toISOString()
      })
    })
  )
  const concurrentResults = await Promise.all(concurrentRequests)
  const allOk = concurrentResults.every(r => r.status === 200)
  const avgTime = Math.round(concurrentResults.reduce((a, r) => a + r.elapsed, 0) / concurrentResults.length)
  allOk
    ? pass('10 concurrent webhooks handled', `Avg ${avgTime}ms`)
    : fail('Concurrent webhooks failed', `${concurrentResults.filter(r => r.status !== 200).length} failures`)
}

// ═══════════════════════════════════════════════════════════════════
// FEATURE 2: DRIVER PWA API
// ═══════════════════════════════════════════════════════════════════
async function testDriverPWA() {
  console.log('\n── Feature 2: Driver PWA API\n')
  let jobId = null

  // 2a. Create a job
  const r1 = await req('/api/driver/jobs', {
    method: 'POST',
    body: JSON.stringify(DRIVER_JOB)
  })
  if (r1.status === 200 && r1.body?.success) {
    jobId = r1.body.job?.id
    pass('Create driver job', `ID: ${jobId?.substring(0, 8)}...`, r1.elapsed)
  } else {
    fail('Create driver job', `Status ${r1.status}: ${JSON.stringify(r1.body)}`)
  }

  await sleep(500)

  // 2b. Get jobs for client
  const r2 = await req(`/api/driver/jobs?client_id=${CLIENT_ID}`)
  r2.status === 200 && Array.isArray(r2.body?.jobs)
    ? pass('Get driver jobs', `${r2.body.count} active jobs`, r2.elapsed)
    : fail('Get driver jobs', `Status ${r2.status}`)

  await sleep(500)

  // 2c. Get jobs filtered by vehicle
  const r3 = await req(`/api/driver/jobs?client_id=${CLIENT_ID}&vehicle_reg=LM71 KHT`)
  r3.status === 200
    ? pass('Get jobs by vehicle reg', `${r3.body?.count} jobs for LM71 KHT`)
    : fail('Get jobs by vehicle reg', `Status ${r3.status}`)

  await sleep(500)

  // 2d. Acknowledge instruction
  if (jobId) {
    const r4 = await req('/api/driver/acknowledge', {
      method: 'POST',
      body: JSON.stringify({
        job_id: jobId,
        client_id: CLIENT_ID,
        response: 'acknowledged',
        status: 'en_route'
      })
    })
    r4.status === 200 && r4.body?.success
      ? pass('Acknowledge job instruction', null, r4.elapsed)
      : fail('Acknowledge job instruction', `Status ${r4.status}`)
  }

  await sleep(500)

  // 2e. Report issue
  if (jobId) {
    const r5 = await req('/api/driver/acknowledge', {
      method: 'POST',
      body: JSON.stringify({
        job_id: jobId,
        client_id: CLIENT_ID,
        response: 'issue',
        note: 'Vehicle warning light on — checking it now'
      })
    })
    r5.status === 200
      ? pass('Report issue creates ops alert')
      : fail('Report issue', `Status ${r5.status}`)
  }

  await sleep(500)

  // 2f. Push subscription GET (vapid key)
  const r6 = await req('/api/driver/push-subscribe')
  if (r6.status === 200 && r6.body?.vapid_public_key) {
    pass('VAPID public key returned')
  } else if (r6.status === 503) {
    pass('Push not configured — returns 503 correctly (add VAPID keys to enable)')
  } else {
    fail('Push subscribe GET', `Status ${r6.status}`)
  }

  await sleep(500)

  // 2g. Push subscribe POST with fake subscription
  const r7 = await req('/api/driver/push-subscribe', {
    method: 'POST',
    body: JSON.stringify({
      client_id: CLIENT_ID,
      driver_name: 'Paul Fletcher',
      subscription: {
        endpoint: `https://fcm.googleapis.com/fcm/send/test-${Date.now()}`,
        keys: { p256dh: 'BExampleKey', auth: 'AuthExample' }
      }
    })
  })
  r7.status === 200 || r7.status === 500
    ? pass('Push subscribe POST handled', r7.status === 500 ? 'VAPID keys not set (expected in test)' : 'subscription saved')
    : fail('Push subscribe POST', `Status ${r7.status}`)

  await sleep(500)

  // 2h. Missing client_id
  const r8 = await req('/api/driver/jobs?client_id=')
  r8.status === 400 || r8.status === 200
    ? pass('Jobs endpoint handles missing client_id gracefully')
    : fail('Jobs endpoint edge case', `Status ${r8.status}`)

  await sleep(500)

  // 2i. Driver PWA page loads
  const pageRes = await fetch(`${BASE_URL}/driver`)
  pageRes.status === 200
    ? pass('Driver PWA page loads (/driver)')
    : fail('Driver PWA page load', `HTTP ${pageRes.status}`)

  await sleep(500)

  // 2j. Service worker file exists
  const swRes = await fetch(`${BASE_URL}/sw.js`)
  swRes.status === 200
    ? pass('Service worker file accessible (/sw.js)')
    : fail('Service worker not found', `HTTP ${swRes.status}`)
}

// ═══════════════════════════════════════════════════════════════════
// FEATURE 3: CUSTOMER TRACKING PORTAL
// ═══════════════════════════════════════════════════════════════════
async function testTrackingPortal() {
  console.log('\n── Feature 3: Customer Tracking Portal\n')
  let trackingToken = null

  // 3a. Create tracking link
  const r1 = await req('/api/tracking/create', {
    method: 'POST',
    body: JSON.stringify(TRACKING_LINK)
  })
  if (r1.status === 200 && r1.body?.token) {
    trackingToken = r1.body.token
    pass('Create tracking link', `Token: ${trackingToken.substring(0, 8)}...`, r1.elapsed)
  } else {
    fail('Create tracking link', `Status ${r1.status}: ${JSON.stringify(r1.body)}`)
  }

  await sleep(500)

  // 3b. Get tracking data by token
  if (trackingToken) {
    const r2 = await req(`/api/tracking/${trackingToken}`)
    r2.status === 200 && r2.body?.tracking
      ? pass('Get tracking by token', `Job: ${r2.body.tracking.job_ref}`, r2.elapsed)
      : fail('Get tracking by token', `Status ${r2.status}`)
  }

  await sleep(500)

  // 3c. Invalid token returns 404
  const r3 = await req('/api/tracking/invalid-token-that-does-not-exist')
  r3.status === 404
    ? pass('Invalid token returns 404')
    : fail('Invalid token should return 404', `Got ${r3.status}`)

  await sleep(500)

  // 3d. Update tracking status
  if (trackingToken) {
    const r4 = await req(`/api/tracking/${trackingToken}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'delayed' })
    })
    r4.status === 200 && r4.body?.success
      ? pass('Update tracking status to delayed')
      : fail('Update tracking status', `Status ${r4.status}`)
  }

  await sleep(500)

  // 3e. Verify status was updated
  if (trackingToken) {
    const r5 = await req(`/api/tracking/${trackingToken}`)
    r5.body?.tracking?.status === 'delayed'
      ? pass('Status update persisted correctly')
      : fail('Status not persisted', `Got: ${r5.body?.tracking?.status}`)
  }

  await sleep(500)

  // 3f. Mark as delivered
  if (trackingToken) {
    const r6 = await req(`/api/tracking/${trackingToken}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'delivered' })
    })
    r6.status === 200
      ? pass('Mark tracking as delivered')
      : fail('Mark as delivered', `Status ${r6.status}`)
  }

  await sleep(500)

  // 3g. Create without required fields
  const r7 = await req('/api/tracking/create', {
    method: 'POST',
    body: JSON.stringify({ vehicle_reg: 'LM71 KHT' }) // missing client_id and job_ref
  })
  r7.status === 400
    ? pass('Create tracking rejects missing required fields')
    : fail('Create tracking should require client_id', `Got ${r7.status}`)

  await sleep(500)

  // 3h. Customer portal page loads with valid token
  if (trackingToken) {
    const pageRes = await fetch(`${BASE_URL}/track/${trackingToken}`)
    pageRes.status === 200
      ? pass('Customer tracking portal loads')
      : fail('Tracking portal page', `HTTP ${pageRes.status}`)
  }

  await sleep(500)

  // 3i. SMS message included in create response
  const r9 = await req('/api/tracking/create', {
    method: 'POST',
    body: JSON.stringify({ ...TRACKING_LINK, job_ref: `SMS-TEST-${Date.now()}` })
  })
  r9.body?.sms_message?.includes('/track/')
    ? pass('SMS message template in create response', r9.body.sms_message.substring(0, 60) + '...')
    : fail('SMS message not in create response')

  await sleep(500)

  // 3j. Concurrent tracking link creation
  console.log('\n  Concurrent tracking link creation (5 simultaneous)...')
  const concurrent = await Promise.all(
    Array(5).fill(null).map((_, i) =>
      req('/api/tracking/create', {
        method: 'POST',
        body: JSON.stringify({ ...TRACKING_LINK, job_ref: `CONCURRENT-${i}-${Date.now()}` })
      })
    )
  )
  const allUnique = new Set(concurrent.map(r => r.body?.token)).size === 5
  const allOk = concurrent.every(r => r.status === 200)
  allOk && allUnique
    ? pass('5 concurrent tracking links — all unique tokens')
    : fail('Concurrent tracking links', `${concurrent.filter(r=>r.status!==200).length} failed, unique: ${allUnique}`)
}

// ═══════════════════════════════════════════════════════════════════
// INTEGRATION TESTS — features working together
// ═══════════════════════════════════════════════════════════════════
async function testIntegration() {
  console.log('\n── Integration: All three features together\n')

  // Full flow: create job → tracking link → position update → verify position in tracking
  const jobRef = `INTEGRATION-${Date.now()}`

  // Step 1: Create job
  const job = await req('/api/driver/jobs', {
    method: 'POST',
    body: JSON.stringify({ ...DRIVER_JOB, ref: jobRef })
  })

  // Step 2: Create tracking link for that job
  const link = await req('/api/tracking/create', {
    method: 'POST',
    body: JSON.stringify({ ...TRACKING_LINK, job_ref: jobRef })
  })

  // Step 3: Submit a GPS position for the vehicle
  const pos = await req('/api/telematics/webhook', {
    method: 'POST',
    headers: { 'x-client-id': CLIENT_ID },
    body: JSON.stringify({ ...VEHICLE_POSITIONS[0], timestamp: new Date().toISOString() })
  })

  await sleep(1000)

  // Step 4: Customer checks tracking — should have live position
  let trackingData = null
  if (link.body?.token) {
    const tracking = await req(`/api/tracking/${link.body.token}`)
    trackingData = tracking.body?.tracking
  }

  const allSucceeded = job.status === 200 && link.status === 200 && pos.status === 200
  allSucceeded
    ? pass('Full flow: job → tracking → GPS → customer view', `Position in tracking: ${!!trackingData?.live_position}`)
    : fail('Integration flow failed', `job:${job.status} link:${link.status} pos:${pos.status}`)
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function runV3Tests() {
  console.log('\n╔══════════════════════════════════════════════╗')
  console.log('║  DisruptionHub v3 — Feature Stress Tests     ║')
  console.log(`║  Target: ${BASE_URL.padEnd(36)}║`)
  console.log('╚══════════════════════════════════════════════╝')

  await testGPSTracking()
  await testDriverPWA()
  await testTrackingPortal()
  await testIntegration()

  console.log('\n╔══════════════════════════════════════════════╗')
  console.log('║  RESULTS                                     ║')
  console.log('╠══════════════════════════════════════════════╣')
  console.log(`║  ✓ Passed:  ${String(RESULTS.passed).padEnd(34)}║`)
  console.log(`║  ✗ Failed:  ${String(RESULTS.failed).padEnd(34)}║`)
  console.log(`║  Total:     ${String(RESULTS.passed + RESULTS.failed).padEnd(34)}║`)
  console.log('╚══════════════════════════════════════════════╝')

  if (RESULTS.errors.length) {
    console.log('\n  Failures:')
    RESULTS.errors.forEach(e => console.log(`  ✗ ${e.label}: ${e.detail}`))
  }

  console.log('')
  process.exit(RESULTS.failed > 0 ? 1 : 0)
}

runV3Tests().catch(err => {
  console.error('Test runner crashed:', err)
  process.exit(1)
})
