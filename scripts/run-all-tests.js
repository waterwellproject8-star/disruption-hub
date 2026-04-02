/**
 * DisruptionHub v2 — Run All Tests
 * node scripts/run-all-tests.js
 */

const { execSync } = require('child_process')

const tests = [
  { name: 'Module Tests',    cmd: 'node tests/stress/module-tests.js',   required: true  },
  { name: 'Security Audit',  cmd: 'node tests/audit/security-audit.js',  required: true  },
]

let allPassed = true

console.log('╔══════════════════════════════════════╗')
console.log('║  DisruptionHub v2 — Full Test Suite  ║')
console.log('╚══════════════════════════════════════╝\n')

for (const test of tests) {
  console.log(`\n▶ Running: ${test.name}`)
  console.log('─'.repeat(40))
  try {
    execSync(test.cmd, { stdio: 'inherit', env: { ...process.env } })
    console.log(`\n✓ ${test.name} — PASSED`)
  } catch {
    console.error(`\n✗ ${test.name} — FAILED`)
    if (test.required) allPassed = false
  }
}

console.log('\n' + '═'.repeat(40))
console.log(allPassed ? '✓ ALL TESTS PASSED — ready to deploy' : '✗ TESTS FAILED — fix before deploying')
console.log('═'.repeat(40) + '\n')
process.exit(allPassed ? 0 : 1)
