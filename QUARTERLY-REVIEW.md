# DisruptionHub — Quarterly Maintenance Checklist

The automated platform health check runs on the first Monday of every month.
This checklist covers things that need human judgement — run it once per quarter.

---

## When to run this
- End of March (Q1 close)
- End of June (Q2 close — coincides with DESNZ annual publication)
- End of September (Q3 close)
- End of December (Q4 close)

---

## 1. Model performance review (30 min)

- [ ] Check console.anthropic.com for new models released since last quarter
- [ ] Review your approval queue for any module outputs that looked wrong or generic
      — these often indicate a model handling a scenario poorly
- [ ] If new Sonnet or Haiku model released: test it on 5 real client scenarios
      before updating CURRENT_CONFIG in lib/platform-monitor.js
- [ ] Update CURRENT_CONFIG.models in platform-monitor.js when you change a model string
- [ ] Update CURRENT_CONFIG.data_last_updated to today's date

---

## 2. NaVCIS + TAPA data refresh (45 min)

NaVCIS publishes quarterly bulletins (approx Feb, May, Aug, Nov).
TAPA publishes EMEA quarterly statistics.

- [ ] Go to navcis.police.uk/freight — check for new bulletins since last update
- [ ] Go to tapa.eu/emea/incident-statistics — check TAPA quarterly report
- [ ] Check RHA rha.uk.net for freight crime updates
- [ ] Update THEFT_PATTERNS in lib/intelligence.js if:
      - New hotspot locations have emerged
      - Incident counts have changed significantly (>20%)
      - New cargo categories are being targeted
      - Secure parking costs have changed
- [ ] Update CURRENT_CONFIG.data_last_updated in platform-monitor.js

---

## 3. DESNZ emission factors (15 min — June only)

- [ ] (June/July only) Check gov.uk/government/collections/government-conversion-factors-for-company-reporting
- [ ] If new year's factors published: download the Excel file
- [ ] Update HGV diesel, van diesel, and grid electricity values in
      lib/anthropic.js carbon module system prompt
- [ ] Update CURRENT_CONFIG.emission_factors_year in platform-monitor.js
- [ ] Update methodology string in the carbon module JSON output schema

---

## 4. Procurement API check (15 min)

The Procurement Act 2023 is still bedding in. Government may make further changes.

- [ ] Check gov.uk/guidance/procurement-policy-notes for new PPNs (Procurement Policy Notes)
- [ ] Verify Find a Tender API is still at the same endpoint:
      find-tender.service.gov.uk/api/1.0/ocdsReleasePackages
- [ ] Check if any new procurement portals are now mandatory
      (Scotland: PCS, Wales: Sell2Wales, NI: eTendersNI — all separate)
- [ ] If you have clients operating in Scotland, Wales, or NI, consider adding those APIs

---

## 5. Telematics provider API health (20 min)

- [ ] Check Samsara changelog: developers.samsara.com/changelog
- [ ] Check Webfleet API docs: webfleet.com/en_gb/developer-portal
- [ ] Check Verizon Connect API docs: developer.fleetmatics.com
- [ ] Test the telematics webhook with a live client if any provider updated their format
- [ ] Check if any client has switched telematics provider — update their config in Supabase

---

## 6. Companies House API (10 min)

- [ ] Check developer.company-information.service.gov.uk for API changelog
- [ ] Note: identity verification for directors rolling out through 2026
      — data quality will improve, no code changes needed
- [ ] Check if API key is still valid (keys don't expire but can be revoked)

---

## 7. npm dependency review (15 min)

Dependabot handles minor/patch updates automatically.
This covers major versions that Dependabot flags but doesn't auto-merge.

- [ ] Review any open Dependabot PRs for major version upgrades
- [ ] Pay particular attention to:
      next — Next.js major versions change routing and API patterns
      @anthropic-ai/sdk — Anthropic occasionally changes streaming format
      twilio — TwiML deprecations sometimes require code changes
- [ ] Run: npm audit — fix any HIGH or CRITICAL vulnerabilities
- [ ] Run: npm outdated — review anything flagged as out of date

---

## 8. Client-specific data review (variable)

For each active client:

- [ ] Confirm their carrier list is still accurate (carriers change, merge, go bust)
- [ ] Confirm SLA penalties in system prompt match their current contracts
- [ ] Confirm depot opening hours haven't changed
- [ ] Confirm their key client contacts are still correct
- [ ] Check if they've onboarded any new high-value clients that need priority rules

---

## After completing this checklist

1. Update CURRENT_CONFIG.data_last_updated in lib/platform-monitor.js to today's date
2. Commit any changes: git add . && git commit -m "Q[X] maintenance: [summary of changes]"
3. Push: git push — Vercel redeploys automatically

---

## Setting a calendar reminder

Put a recurring quarterly reminder in your calendar titled
"DisruptionHub quarterly maintenance" on the last working day of:
March, June, September, December.

The June one is the most important because DESNZ publishes new emission factors
and that directly affects client ESG reports submitted to major retailers.
