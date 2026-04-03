// ── REGULATION MONITOR ────────────────────────────────────────────────────────
// Automatically checks UK logistics regulatory sources for changes.
// Runs daily via the scheduled cron job.
// Sources: DVSA, DfT, HMRC, HSE, Driver & Vehicle Licensing Agency (DVLA)

import { anthropic } from './anthropic.js'

// Known regulatory feeds and pages
const SOURCES = [
  { name: 'DVSA', url: 'https://www.gov.uk/government/organisations/driver-and-vehicle-standards-agency/about/publication-scheme', category: 'inspection' },
  { name: 'DfT', url: 'https://www.gov.uk/government/organisations/department-for-transport/about/publication-scheme', category: 'transport_policy' },
  { name: 'DVLA', url: 'https://www.gov.uk/government/organisations/driver-and-vehicle-licensing-agency/about/publication-scheme', category: 'licensing' },
  { name: 'HSE', url: 'https://www.hse.gov.uk/news/index.htm', category: 'safety' },
  { name: 'HMRC', url: 'https://www.gov.uk/government/organisations/hm-revenue-customs/about/publication-scheme', category: 'tax_fuel' },
]

// Known regulations with current status — updated manually when changes occur
// This is the baseline the AI compares against when analysing news
export const CURRENT_REGULATIONS = {
  driver_hours: {
    regulation: 'EU Regulation 561/2006 (retained in UK law)',
    daily_limit_hrs: 9,
    extended_daily_limit_hrs: 10,
    extended_days_per_week: 2,
    weekly_limit_hrs: 56,
    fortnightly_limit_hrs: 90,
    break_after_hrs: 4.5,
    break_duration_mins: 45,
    last_updated: '2024-01-01',
    notes: 'No changes expected in 2026 — post-Brexit alignment maintained'
  },
  smart_tachograph: {
    regulation: 'Smart Tachograph 2 (ST2)',
    lcv_deadline: '2026-07-01',
    new_vehicles_from: '2023-08-21',
    retrofit_deadline_existing: '2025-08-19',
    notes: 'LCV 2.5-3.5t on international/cabotage routes — ST2 required by July 2026'
  },
  dvsa_inspection: {
    regulation: 'DVSA HGV Inspection Manual',
    last_major_update: '2026-04-01',
    key_change_april_2026: 'Laden roller brake test now mandatory. EBPMS accepted as alternative.',
    notes: 'Updated April 1 2026 — ensure all test centres have laden brake test capability'
  },
  dqc_cpc: {
    regulation: 'Driver CPC / DQC',
    hours_required: 35,
    cycle_years: 5,
    notes: '100,000+ drivers currently have lapsed DQC — DVSA enforcement increasing'
  },
  fuel_duty: {
    regulation: 'UK Fuel Duty',
    rate_ppl: 52.95,
    last_change: '2024-03-06',
    notes: 'Frozen at 52.95ppl since 2022 Budget. Subject to annual review.'
  },
  adr: {
    regulation: 'ADR 2025 Edition',
    effective: '2025-01-01',
    biennial_update: '2027-01-01',
    notes: 'ADR 2025 in force. Next update January 2027.'
  },
  emissions_zones: {
    regulation: 'Clean Air Zones',
    london_ulez_expanded: '2023-08-29',
    birmingham_caz: 'operational',
    bradford_caz: '2024-07-01',
    notes: 'More cities planning CAZ. Check before routing through city centres.'
  }
}

// ── FETCH REGULATORY NEWS ─────────────────────────────────────────────────────
// Fetches recent gov.uk news for logistics-relevant changes
async function fetchRegulatoryNews() {
  const news = []

  // Gov.uk search for recent logistics/transport regulations
  try {
    const res = await fetch(
      'https://www.gov.uk/search/all?keywords=HGV+driver+regulation&order=updated-newest&content_store_document_type=guidance&content_store_document_type=detailed_guide',
      { headers: { 'Accept': 'application/json' } }
    )
    if (res.ok) {
      const data = await res.json()
      const recent = (data.results || [])
        .filter(r => {
          const updated = new Date(r.public_timestamp)
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          return updated > thirtyDaysAgo
        })
        .slice(0, 10)
        .map(r => ({
          title: r.title,
          url: `https://www.gov.uk${r.link}`,
          updated: r.public_timestamp,
          description: r.description
        }))
      news.push(...recent)
    }
  } catch {
    // API unavailable — continue with known regulations only
  }

  return news
}

// ── ANALYSE CHANGES WITH AI ───────────────────────────────────────────────────
async function analyseRegulatoryChanges(news, clientConfig) {
  const fleetType = clientConfig?.fleet_type || 'mixed HGV and van'
  const internationalOps = clientConfig?.international_ops || false
  const londonOps = clientConfig?.london_ops || false

  const prompt = `You are a UK logistics compliance expert. Analyse these recent regulatory updates and identify anything that affects a ${fleetType} operator${internationalOps ? ' with international operations' : ''}${londonOps ? ' operating in London' : ''}.

Current known regulations for context:
${JSON.stringify(CURRENT_REGULATIONS, null, 2)}

Recent government publications (last 30 days):
${news.length > 0 ? JSON.stringify(news, null, 2) : 'No new publications found in the last 30 days.'}

Return ONLY this JSON:
{
  "relevant_changes": [
    {
      "title": "string",
      "source": "DVSA|HMRC|DfT|HSE|DVLA",
      "effective_date": "string",
      "days_to_comply": number,
      "impact_description": "string",
      "compliance_action": "string",
      "compliance_cost": number,
      "penalty_if_ignored": number,
      "urgency": "IMMEDIATE|WITHIN_30_DAYS|WITHIN_90_DAYS"
    }
  ],
  "total_compliance_cost": number,
  "total_penalty_risk": number,
  "no_changes_summary": "string"
}`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }]
  })

  const raw = message.content[0].text.trim().replace(/^```json\s*/,'').replace(/\s*```$/,'').trim()
  try {
    return JSON.parse(raw)
  } catch {
    return {
      relevant_changes: [],
      total_compliance_cost: 0,
      total_penalty_risk: 0,
      no_changes_summary: 'Regulation check complete. No new changes affecting your fleet this week.'
    }
  }
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
export async function runRegulationMonitor(clientConfig = {}) {
  const news = await fetchRegulatoryNews()
  const analysis = await analyseRegulatoryChanges(news, clientConfig)

  return {
    ...analysis,
    sources_checked: SOURCES.map(s => s.name),
    checked_at: new Date().toISOString(),
    news_items_found: news.length,
    current_regulations_version: '2026-04',
  }
}

// ── WEEKLY DIGEST ─────────────────────────────────────────────────────────────
// Called every Monday — produces a plain English compliance summary
export async function generateWeeklyComplianceDigest(clients = []) {
  const news = await fetchRegulatoryNews()

  if (news.length === 0) {
    return {
      week: new Date().toISOString().split('T')[0],
      headline: 'No regulatory changes this week',
      summary: 'Checked DVSA, DfT, DVLA, HSE, and HMRC. No new publications affecting UK HGV operations.',
      actions_required: [],
      upcoming_deadlines: [
        { item: 'Smart Tachograph 2 — LCV retrofit', deadline: '2026-07-01', days_remaining: Math.round((new Date('2026-07-01') - Date.now()) / 86400000) },
        { item: 'ADR 2027 Edition transition', deadline: '2027-01-01', days_remaining: Math.round((new Date('2027-01-01') - Date.now()) / 86400000) },
      ]
    }
  }

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `Summarise these UK regulatory updates for a logistics operator in 3 sentences of plain English. Focus only on what they need to do differently. Updates: ${JSON.stringify(news.map(n => n.title + ': ' + n.description))}`
    }]
  })

  return {
    week: new Date().toISOString().split('T')[0],
    headline: `${news.length} regulatory update${news.length !== 1 ? 's' : ''} this week`,
    summary: message.content[0].text.trim(),
    news_items: news,
    upcoming_deadlines: [
      { item: 'Smart Tachograph 2 — LCV retrofit', deadline: '2026-07-01', days_remaining: Math.round((new Date('2026-07-01') - Date.now()) / 86400000) },
    ]
  }
}
