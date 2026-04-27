import assert from 'node:assert/strict'
import {
  maskDriverName, normalizeTimestamp, transformPayload,
  clientToView, shipmentToView, webhookLogToIncidentView,
  applyPartnerView, FORBIDDEN_KEYS
} from '../partnerView.js'

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    failed++
    console.log(`  ✗ ${name}`)
    console.log(`    ${e.message}`)
  }
}

function containsForbiddenKey(obj) {
  if (!obj || typeof obj !== 'object') return null
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_KEYS.includes(key)) return key
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      const nested = containsForbiddenKey(obj[key])
      if (nested) return nested
    }
  }
  return null
}

console.log('\nLayer 1 — maskDriverName')
test('two-word name', () => assert.equal(maskDriverName('Mark Jones'), 'M. Jones'))
test('single name', () => assert.equal(maskDriverName('Mark'), 'M.'))
test('empty string', () => assert.equal(maskDriverName(''), null))
test('null', () => assert.equal(maskDriverName(null), null))
test('undefined', () => assert.equal(maskDriverName(undefined), null))
test('three-word name', () => assert.equal(maskDriverName('Mark Jackson Senior'), 'M. Senior'))
test('whitespace padding', () => assert.equal(maskDriverName('  Jane Smith  '), 'J. Smith'))
test('single letter', () => assert.equal(maskDriverName('M'), 'M.'))
test('non-string input', () => assert.equal(maskDriverName(42), null))

console.log('\nLayer 1 — normalizeTimestamp')
test('postgres timestamptz', () => {
  const result = normalizeTimestamp('2026-04-27 09:52:03.074223+00')
  assert.ok(result.startsWith('2026-04-27T09:52:03'))
  assert.ok(result.endsWith('Z'))
})
test('null input', () => assert.equal(normalizeTimestamp(null), null))
test('undefined input', () => assert.equal(normalizeTimestamp(undefined), null))

console.log('\nLayer 2 — Transformer fixture invariants')

function buildForbiddenRow() {
  const row = {}
  for (const key of FORBIDDEN_KEYS) row[key] = '__SHOULD_NEVER_APPEAR__'
  return row
}

test('clientToView strips FORBIDDEN_KEYS', () => {
  const row = { id: '1', name: 'Test', sector: 'haulage', ...buildForbiddenRow() }
  const view = clientToView(row)
  const found = containsForbiddenKey(view)
  assert.equal(found, null, `Forbidden key leaked: ${found}`)
})

test('shipmentToView strips FORBIDDEN_KEYS', () => {
  const row = { id: '1', ref: 'SH-1', route: 'A→B', status: 'on-track', ...buildForbiddenRow() }
  const view = shipmentToView(row)
  const found = containsForbiddenKey(view)
  assert.equal(found, null, `Forbidden key leaked: ${found}`)
})

test('webhookLogToIncidentView strips FORBIDDEN_KEYS', () => {
  const row = { id: '1', event_type: 'breakdown', severity: 'HIGH', payload: { ref: 'R1', ...buildForbiddenRow() }, ...buildForbiddenRow() }
  const view = webhookLogToIncidentView(row)
  const found = containsForbiddenKey(view)
  assert.equal(found, null, `Forbidden key leaked: ${found}`)
})

test('transformPayload redacts consignee_phone', () => {
  const result = transformPayload({ ref: 'R1', consignee_phone: '+447700900000', vehicle_reg: 'AB12CDE' })
  assert.equal(result.consignee_phone, undefined)
  assert.equal(result.ref, 'R1')
  assert.equal(result.vehicle_reg, 'AB12CDE')
})

test('transformPayload masks driver_name', () => {
  const result = transformPayload({ driver_name: 'Mark Jones', ref: 'R1' })
  assert.equal(result.driver_name, 'M. Jones')
})

console.log('\nLayer 3 — Permission enforcement')

const dummyRow = { id: '1', ref: 'R1', status: 'ok', event_type: 'test', severity: 'LOW' }

test('shipment without fleet_read throws', () => {
  assert.throws(() => applyPartnerView([dummyRow], 'shipment', []), /fleet_read/)
})
test('shipment with incidents_read throws', () => {
  assert.throws(() => applyPartnerView([dummyRow], 'shipment', ['incidents_read']), /fleet_read/)
})
test('shipment with fleet_read succeeds', () => {
  const result = applyPartnerView([dummyRow], 'shipment', ['fleet_read'])
  assert.ok(Array.isArray(result))
})
test('incident without incidents_read throws', () => {
  assert.throws(() => applyPartnerView([dummyRow], 'incident', ['fleet_read']), /incidents_read/)
})
test('incident with incidents_read succeeds', () => {
  const result = applyPartnerView([dummyRow], 'incident', ['incidents_read'])
  assert.ok(Array.isArray(result))
})
test('unknown type throws', () => {
  assert.throws(() => applyPartnerView([dummyRow], 'unknown_type', ['fleet_read']), /Unknown/)
})

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
