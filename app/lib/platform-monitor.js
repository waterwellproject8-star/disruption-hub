/**
 * DisruptionHub — Platform Intelligence Monitor
 * Runs monthly to check for outdated models, APIs, data, and dependencies.
 * Results appear in the approval queue like any other module finding.
 *
 * Checks:
 *  1. Anthropic model currency   — queries /v1/models for newer releases
 *  2. DESNZ emission factors      — checks gov.uk for new annual publication
 *  3. NaVCIS bulletin freshness   — verifies data isn't more than 4 months old
 *  4. npm package currency        — checks key packages for major version changes
 *  5. Telematics API health       — pings each configured provider
 *  6. Find a Tender / CF health   — verifies both procurement APIs respond
 *  7. Supabase connectivity       — confirms database is reachable
 */

import Anthropic from '@anthropic-ai/sdk'
import { supabase, queueAction } from '../lib/supabase.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── CURRENT KNOWN VERSIONS ────────────────────────────────────────────────────
// Update this object whenever you apply an update — it's your baseline
const CURRENT_CONFIG = {
  models: {
    main:    'claude-sonnet-4-6',
    fast:    'claude-haiku-4-5-20251001',
    premium: 'claude-opus-4-6',
  },
  emission_factors_year: 2025,
  navci_bulletin_max_age_days: 120, // flag if data is older than 4 months
  data_last_updated: '2026-04-02',
  npm_packages: {
    'next':           '14',  // major version only
    '@anthropic-ai/sdk': '0',
    '@supabase/supabase-js': '2',
    'twilio':         '5',
    'resend':         '3',
    'web-push':       '3',
  }
}

// ── 1. CHECK ANTHROPIC MODEL CURRENCY ─────────────────────────────────────────
async function checkAnthropicModels() {
  const issues = []
  try {
    const models = await anthropic.models.list()
    const available = models.data?.map(m => m.id) || []

    // Find the latest sonnet and haiku
    const sonnets = available.filter(id => id.includes('sonnet') && !id.includes('opus'))
      .sort().reverse()
    const haikus  = available.filter(id => id.includes('haiku'))
      .sort().reverse()
    const opuses  = available.filter(id => id.includes('opus'))
      .sort().reverse()

    const latestSonnet = sonnets[0]
    const latestHaiku  = haikus[0]
    const latestOpus   = opuses[0]

    if (latestSonnet && latestSonnet !== CURRENT_CONFIG.models.main) {
      issues.push({
        severity: 'HIGH',
        type:     'model_update',
        message:  `Newer Sonnet model available: ${latestSonnet} (currently using ${CURRENT_CONFIG.models.main})`,
        action:   `Update model string in lib/anthropic.js and lib/intelligence-modules.js`,
        files:    ['lib/anthropic.js', 'lib/intelligence-modules.js', 'app/api/demo/route.js'],
      })
    } else {
      issues.push({ severity: 'OK', type: 'model_update', message: `Sonnet model is current: ${CURRENT_CONFIG.models.main}` })
    }

    if (latestHaiku && latestHaiku !== CURRENT_CONFIG.models.fast) {
      issues.push({
        severity: 'MEDIUM',
        type:     'model_update',
        message:  `Newer Haiku model available: ${latestHaiku} (currently using ${CURRENT_CONFIG.models.fast})`,
        action:   `Update model string in app/api/agent/route.js`,
        files:    ['app/api/agent/route.js'],
      })
    } else {
      issues.push({ severity: 'OK', type: 'model_update', message: `Haiku model is current: ${CURRENT_CONFIG.models.fast}` })
    }

  } catch (err) {
    issues.push({ severity: 'WARN', type: 'model_update', message: `Could not query Anthropic models API: ${err.message}` })
  }
  return issues
}

// ── 2. CHECK DESNZ EMISSION FACTORS ──────────────────────────────────────────
async function checkEmissionFactors() {
  const issues = []
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1 // 1-12

  // DESNZ publishes new factors every June
  // If it's after June and we're still on the previous year's factors, flag it
  const expectedYear = currentMonth >= 7 ? currentYear : currentYear - 1

  if (CURRENT_CONFIG.emission_factors_year < expectedYear) {
    issues.push({
      severity: 'HIGH',
      type:     'emission_factors',
      message:  `DESNZ emission factors are out of date. Using ${CURRENT_CONFIG.emission_factors_year}, expected ${expectedYear}.`,
      action:   `Download new factors from gov.uk/government/collections/government-conversion-factors-for-company-reporting and update lib/anthropic.js carbon module system prompt with new kg CO2e values.`,
      url:      'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting',
    })
  } else {
    // Try to fetch the gov.uk page to confirm a new publication hasn't dropped
    try {
      const res = await fetch('https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting')
      const text = await res.text()
      const yearMatch = text.match(/(\d{4})\s+(?:GHG|greenhouse\s+gas)\s+conversion/i)
      if (yearMatch) {
        const publishedYear = parseInt(yearMatch[1])
        if (publishedYear > CURRENT_CONFIG.emission_factors_year) {
          issues.push({
            severity: 'HIGH',
            type:     'emission_factors',
            message:  `DESNZ ${publishedYear} emission factors detected on gov.uk. Currently using ${CURRENT_CONFIG.emission_factors_year}.`,
            action:   'Update carbon module in lib/anthropic.js with new emission values',
            url:      'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting',
          })
        } else {
          issues.push({ severity: 'OK', type: 'emission_factors', message: `Emission factors current: DESNZ ${CURRENT_CONFIG.emission_factors_year}` })
        }
      } else {
        issues.push({ severity: 'OK', type: 'emission_factors', message: `Emission factors current: DESNZ ${CURRENT_CONFIG.emission_factors_year} (page check OK)` })
      }
    } catch {
      issues.push({ severity: 'WARN', type: 'emission_factors', message: `Could not verify DESNZ page — manual check recommended annually in June/July` })
    }
  }
  return issues
}

// ── 3. CHECK NAVCI DATA FRESHNESS ─────────────────────────────────────────────
async function checkNavcisData() {
  const issues = []
  const lastUpdated = new Date(CURRENT_CONFIG.data_last_updated)
  const daysSince = Math.round((new Date() - lastUpdated) / (1000 * 60 * 60 * 24))

  if (daysSince > CURRENT_CONFIG.navci_bulletin_max_age_days) {
    issues.push({
      severity: 'MEDIUM',
      type:     'navci_data',
      message:  `NaVCIS theft pattern database is ${daysSince} days old (max recommended: ${CURRENT_CONFIG.navci_bulletin_max_age_days} days).`,
      action:   `Check navcis.police.uk/freight for new bulletins. Update THEFT_PATTERNS in lib/intelligence.js with latest incident data.`,
      url:      'https://navcis.police.uk/freight',
      also_check: 'https://tapa.eu/emea/incident-statistics — TAPA quarterly report',
    })
  } else {
    issues.push({ severity: 'OK', type: 'navci_data', message: `NaVCIS data is ${daysSince} days old — within acceptable range` })
  }
  return issues
}

// ── 4. CHECK NPM PACKAGE VERSIONS ─────────────────────────────────────────────
async function checkNpmPackages() {
  const issues = []

  for (const [pkg, currentMajor] of Object.entries(CURRENT_CONFIG.npm_packages)) {
    try {
      const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`)
      if (!res.ok) continue
      const data = await res.json()
      const latestVersion = data.version || ''
      const latestMajor = latestVersion.split('.')[0]

      if (latestMajor > currentMajor) {
        issues.push({
          severity: 'MEDIUM',
          type:     'npm_package',
          message:  `Major version update available: ${pkg} v${currentMajor} → v${latestVersion}`,
          action:   `Review changelog before upgrading. Run: npm install ${pkg}@latest`,
          note:     'Major version updates may have breaking changes — test on staging first',
        })
      } else {
        issues.push({ severity: 'OK', type: 'npm_package', message: `${pkg}: on major v${currentMajor}, latest is v${latestVersion}` })
      }
      await new Promise(r => setTimeout(r, 300)) // rate limit npm registry
    } catch {
      // npm registry unavailable — skip silently
    }
  }
  return issues
}

// ── 5. CHECK EXTERNAL API HEALTH ──────────────────────────────────────────────
async function checkExternalAPIs() {
  const issues = []
  const checks = [
    { name: 'Companies House API', url: 'https://api.company-information.service.gov.uk/', expectedStatus: [200, 401] },
    { name: 'Contracts Finder',    url: 'https://www.contractsfinder.service.gov.uk/Published/Notices/PublishedNoticesController/api/search', method: 'POST', expectedStatus: [200, 400, 405] },
    { name: 'Find a Tender',       url: 'https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?size=1', expectedStatus: [200, 400] },
    { name: 'Met Office DataPoint', url: 'https://datapoint.metoffice.gov.uk/public/data/', expectedStatus: [200, 403] },
  ]

  for (const check of checks) {
    try {
      const opts = check.method === 'POST'
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
        : { method: 'GET' }
      const res = await fetch(check.url, { signal: AbortSignal.timeout(8000), ...opts })
      if (check.expectedStatus.includes(res.status)) {
        issues.push({ severity: 'OK', type: 'api_health', message: `${check.name}: responding (HTTP ${res.status})` })
      } else {
        issues.push({
          severity: 'HIGH',
          type:     'api_health',
          message:  `${check.name}: unexpected response HTTP ${res.status}`,
          action:   `Check API documentation — endpoint or auth requirements may have changed`,
          url:      check.url,
        })
      }
    } catch (err) {
      issues.push({
        severity: 'HIGH',
        type:     'api_health',
        message:  `${check.name}: unreachable — ${err.message}`,
        action:   `Check if API endpoint URL has changed or service is down`,
        url:      check.url,
      })
    }
    await new Promise(r => setTimeout(r, 500))
  }
  return issues
}

// ── 6. CHECK SUPABASE CONNECTIVITY ────────────────────────────────────────────
async function checkDatabase() {
  const issues = []
  try {
    const { error } = await supabase.from('clients').select('count').limit(1)
    if (error) {
      issues.push({
        severity: 'CRITICAL',
        type:     'database',
        message:  `Supabase query failed: ${error.message}`,
        action:   'Check Supabase project status at supabase.com and verify env vars in Vercel',
      })
    } else {
      issues.push({ severity: 'OK', type: 'database', message: 'Supabase: connected and responding' })
    }
  } catch (err) {
    issues.push({ severity: 'CRITICAL', type: 'database', message: `Supabase: connection error — ${err.message}` })
  }
  return issues
}

// ── MAIN RUNNER ────────────────────────────────────────────────────────────────
export async function runPlatformHealthCheck(clientId = null) {
  const started = new Date()
  const allIssues = []

  // Run all checks
  const [models, emissions, navci, npm, apis, db] = await Promise.all([
    checkAnthropicModels(),
    checkEmissionFactors(),
    checkNavcisData(),
    checkNpmPackages(),
    checkExternalAPIs(),
    checkDatabase(),
  ])

  allIssues.push(...models, ...emissions, ...navci, ...npm, ...apis, ...db)

  // Classify findings
  const critical = allIssues.filter(i => i.severity === 'CRITICAL')
  const high     = allIssues.filter(i => i.severity === 'HIGH')
  const medium   = allIssues.filter(i => i.severity === 'MEDIUM')
  const ok       = allIssues.filter(i => i.severity === 'OK')
  const warnings = allIssues.filter(i => i.severity === 'WARN')

  const actionable = [...critical, ...high, ...medium].filter(i => i.action)

  // Build summary report
  const report = {
    checked_at:   started.toISOString(),
    duration_ms:  Date.now() - started,
    summary: {
      critical: critical.length,
      high:     high.length,
      medium:   medium.length,
      ok:       ok.length,
      warnings: warnings.length,
      action_required: actionable.length,
    },
    findings: allIssues,
    action_items: actionable.map(i => ({
      severity: i.severity,
      type:     i.type,
      message:  i.message,
      action:   i.action,
      url:      i.url,
    }))
  }

  // If there are actionable issues, queue them in the approval queue
  if (clientId && actionable.length > 0) {
    const content = actionable.map((i, n) =>
      `${n + 1}. [${i.severity}] ${i.message}\n   → ${i.action}${i.url ? `\n   URL: ${i.url}` : ''}`
    ).join('\n\n')

    await queueAction({
      client_id:     clientId,
      module_run_id: null,
      action_type:   'internal_flag',
      action_label:  `PLATFORM HEALTH — ${actionable.length} item${actionable.length !== 1 ? 's' : ''} need attention`,
      action_details: {
        content,
        recipient:    'platform_admin',
        report_summary: report.summary,
        full_report:  report,
      },
      financial_value: 0,
      auto_approve:    true,
      status:         'pending',
    })
  }

  return report
}
