# DisruptionHub — Project Guide

This file replaces prior handover documents. It is the single source of truth for the architecture, key files, database schema, environment variables, security rules, and current project status.

---

## 1. What This Is

DisruptionHub is an AI-driven logistics crisis-response and operations intelligence platform for UK hauliers. It ingests telematics, TMS webhooks, driver reports, and SMS, then uses Claude to produce prioritised disruption responses, push them to a driver PWA, and queue approvable actions (SMS, email, reroutes, POs) for the ops team.

**Current product status:** pre-revenue. There are **no live clients yet**. All dashboards, feeds, and module runs use **demo data only**. The only physical test asset is the vehicle **LK72 ABX** (used for end-to-end telematics / driver PWA walkthroughs).

**Pricing (as quoted to prospects):**
- **£149** — pilot (30 days, non-refundable after onboarding call)
- **£349/month** — founding cohort (locked for life, 5 spots only)
- **£499/month** — standard (up to 30 vehicles)
- **£499 + £8/vehicle above 30** — growth
- **Custom** — enterprise (51+ vehicles, multi-depot)

**Contact:** hello@disruptionhub.ai

---

## 2. Architecture

| Layer | Tech |
|---|---|
| Framework | **Next.js 14.2.5** (App Router, JavaScript — not TypeScript) |
| Hosting | **Vercel** (serverless functions + Edge; cron via `vercel.json`) |
| Database / Auth / Storage | **Supabase** (Postgres + RLS, service-role key for server routes) |
| LLM | **Anthropic Claude** via `@anthropic-ai/sdk` |
| SMS / Voice | **Twilio** |
| Transactional email | **Resend** |
| Web Push (driver PWA) | **web-push** (VAPID) |
| Maps | **Leaflet** |
| Validation | **Zod** |
| PDF | **pdf-lib** (monthly reports) |

### Request flow (high level)

1. **Inbound signal** — webhook from TMS / telematics (`/api/webhooks/inbound`), driver SMS (`/api/sms/inbound`), driver PWA action, or scheduled cron (`/api/scheduled/run`).
2. **Classification + enrichment** — severity determined from event type + payload financials; Claude called for narrative + recommended actions.
3. **Persistence** — `module_runs`, `incidents`, `approvals` rows written to Supabase.
4. **Surface** — dashboard (`/dashboard`) polls `/api/modules/latest` and the approvals API; driver PWA (`/driver`) polls `/api/driver/active` and receives web-push alerts.
5. **Action execution** — approvals moved through `pending → approved → executed` either by operator click or by the auto-execute cron when under the GBP threshold.

### Cron
Defined in `vercel.json`:
- `0 5 * * *` → `/api/scheduled/run` (daily 05:00 UTC — monthly report generation, scheduled module runs).
All cron endpoints gate on `Bearer ${CRON_SECRET}` in production.

---

## 3. Directory Layout

```
app/
  page.js                  # Public marketing / landing page
  layout.js                # Root layout, fonts, global styles
  globals.css
  dashboard/page.js        # Operator dashboard (approvals, feed, modules)
  driver/page.js           # Driver PWA (jobs, alerts, PoD, push)
  admin/approvals/         # Internal admin surface for approvals
  intelligence/page.js     # Intelligence modules UI (theft, churn, cashflow…)
  track/[token]/           # Public customer tracking page (tokenised)
  legal/                   # Legal pages
  lib/                     # Client-side library re-exports (push, supabase…)
  api/
    agent/route.js             # Claude crisis-director endpoint (ops + driver modes)
    modules/route.js           # Module runner — returns DEMO_RESULTS today
    modules/latest/            # Latest run lookup for dashboard
    webhooks/inbound/route.js  # TMS / telematics inbound webhook → Claude → approvals
    webhooks/sms/               # Twilio SMS status callbacks
    webhooks/tms/               # TMS-specific webhook variants
    sms/inbound/route.js       # Twilio inbound SMS → approvals queue
    approvals/route.js         # List / approve / reject / execute approvals
    approvals/log/             # Audit log read
    approvals/reset/           # Demo reset
    actions/auto-execute/      # Cron: auto-approve below threshold
    incidents/route.js         # Incident CRUD
    shipments/route.js         # Shipment CRUD
    scenarios/route.js         # Scripted demo scenarios
    scheduled/run/route.js     # Daily cron entrypoint
    reports/monthly/route.js   # Monthly client report (Claude + pdf-lib)
    platform/health/route.js   # Platform monitor / self-check
    client-config/route.js     # Per-client config read
    driver/                    # Driver PWA backend
      active/                  #   current job / alert for a driver
      jobs/                    #   job list + create
      acknowledge/             #   ack instructions
      photo/                   #   PoD upload
      cancel-job/
      end-shift/
      progress/                #   driver_progress row keyed by phone
      resolve/                 #   close driver alert w/ Claude summary
      alert/                   #   issue driver alert (Claude + Twilio)
      push-subscribe/          #   VAPID subscribe
      push-send/               #   send push
    intelligence/              # Intelligence module endpoints (v4 tables)
      cargo-theft/
      subcontractor/
      client-churn/
      cashflow/
      workforce/
      route.js                 #   index / dispatcher
    telematics/
      webhook/                 #   provider push
      positions/               #   latest positions
      poll/                    #   cron poll for Samsara/Webfleet/Verizon
    tracking/
      create/                  #   mint tracking_links
      [token]/                 #   public read by token
lib/
  anthropic.js             # Anthropic client + runModule(module, input)
  supabase.js              # Admin + anon Supabase clients, action helpers, thresholds
  actions.js               # Action executors (Twilio SMS, Resend email)
  twilio.js                # Twilio helpers
  push.js                  # Web-push send wrapper
  telematics.js            # Provider adapters (Samsara / Webfleet / Verizon / webhook)
  tracking.js              # Tracking-link helpers
  scenarios.js             # Scripted demo scenarios
  intelligence.js          # Companies House + external signal pulls
  intelligence-modules.js  # v4 module prompts (theft, churn, cashflow, workforce…)
  platform-monitor.js      # Self-health checks
supabase-schema.sql        # v2 base tables
supabase-schema-v3.sql     # v3 additions (driver PWA, telematics, tracking)
supabase-schema-v4.sql     # v4 additions (intelligence modules)
tests/                     # Stress + security audit scripts
scripts/run-all-tests.js   # Run the whole test bundle
vercel.json                # Function durations + cron schedule
next.config.js
package.json
QUARTERLY-REVIEW.md
```

### Key files — purpose

- **`app/page.js`** (781 lines) — public marketing / landing page. Contains the hero, pricing cards, and the interactive onboarding wizard (smooth collapse, synced options — see latest commit `96b250e`). Design tokens (`T`, `FF`) are defined at the top.
- **`app/dashboard/page.js`** (2,714 lines) — the operator console. Polls `/api/modules/latest`, `/api/webhooks/inbound`, and `/api/approvals` using the `x-dh-key` header (`NEXT_PUBLIC_DH_KEY`). Renders the disruption feed, approvals queue, and intelligence module panels.
- **`app/driver/page.js`** (1,590 lines) — the driver PWA. Handles push subscription, job list, instruction acknowledgement, PoD photo capture, and a `/api/agent?driver_mode=true` chat for in-cab prompts.
- **`app/api/agent/route.js`** (141 lines) — Claude crisis-director endpoint. Two system prompts: full ops `SYSTEM_PROMPT` (Senior Logistics Crisis Director, structured output with severity / immediate actions / rerouting / contact / downstream risks) and a compact `DRIVER_SYSTEM_PROMPT` for in-cab use. Auth-gated on `x-dh-key === DH_INTERNAL_KEY`.
- **`app/api/modules/route.js`** (491 lines) — module runner. **Currently returns `DEMO_RESULTS` for all modules** (disruption, invoice, carrier, driver retention, cold-chain, intelligence). When a client is connected, swap to `runModule()` from `lib/anthropic.js` and persist via `logModuleRun` + `queueAction`.
- **`app/api/webhooks/inbound/route.js`** (451 lines) — the primary ingestion endpoint. Normalises TMS/telematics payloads, extracts financial impact (`penalty_gbp`, `total_charge_gbp`, `cargo_value_gbp`, `daily_charge_gbp × 5`), classifies severity (panic/impact/reefer = CRITICAL; temp alarms escalate on pharma / frozen / high-value; etc.), calls Claude for a narrative, and writes to `module_runs` + `incidents` + `approvals`.
- **`app/api/sms/inbound/route.js`** (112 lines) — Twilio inbound SMS webhook. Matches the `From` number to a `driver_progress` row, creates an approval record, returns empty TwiML so Twilio doesn't retry.

---

## 4. Database Schema (Supabase / Postgres)

All tables have **Row Level Security enabled**. Server routes use the **service-role key** and bypass RLS; client-side code must use the anon key and rely on policies.

### v2 base schema (`supabase-schema.sql`)

| Table | Purpose |
|---|---|
| `clients` | Tenant record. `tier` ∈ advisory / autonomous / intelligence / enterprise. Holds per-client `system_prompt` and `config` JSON. |
| `module_runs` | Every Claude module invocation — input, output, severity, financial impact, status. The feed backbone. |
| `approvals` | Queue of actions awaiting operator approval (send_email, send_sms, make_call, raise_po, cancel_po, submit_tender). Supports auto-approve-at, execution result. |
| `action_log` | Immutable audit of executed actions with success flag, result JSON, error message. |
| `incidents` | Higher-level incident roll-ups with resolution time and cost-avoided figures. |
| `carrier_performance` | Rolling on-time / damage / invoice-accuracy numbers per carrier. |
| `drivers` | Driver master record — vehicle reg, ADR expiry, weekly hours, retention risk, flags. |
| `invoices` | Invoice-audit rows — charged vs expected, discrepancy, dispute status, recovered amount. |

### v3 additions (`supabase-schema-v3.sql`) — Driver PWA, telematics, tracking

| Table | Purpose |
|---|---|
| `vehicle_positions` | Latest GPS fix per vehicle. Source ∈ samsara / webfleet / verizon / webhook / manual. Indexed by (client, vehicle_reg, recorded_at). |
| `driver_jobs` | Jobs visible in the driver PWA — origin, destination, SLA, current instruction, ack state, PoD photo URL. |
| `push_subscriptions` | Web-push / VAPID subscriptions for driver PWA notifications (unique on endpoint). |
| `tracking_links` | Tokenised customer-facing tracking links (branding JSON, expiry). |
| `pod_photos` | Proof-of-delivery photos linked to `driver_jobs`. |
| `telematics_config` | Per-client telematics provider credentials (api_key, secret, fleet_id, webhook_secret). **Should be encrypted at rest in production.** |

### v4 additions (`supabase-schema-v4.sql`) — Intelligence modules

| Table | Purpose |
|---|---|
| `theft_risk_assessments` | Per-job cargo theft risk score, dangerous stops, reroute recommendation, outcome. |
| `subcontractor_scores` | Trust / financial health / ghost risk scores for subcontractors. Companies House snapshot. |
| `client_health_scores` | Churn probability + payment / volume / relationship sub-scores for monitored end customers. |
| `cashflow_forecasts` | 12-week cashflow forecast with trough detection and recommended actions. |
| `workforce_pipeline` | Driver headcount, DCPC expiries, flight risk, competitor threats, recommended hires. |
| `ghost_freight_alerts` | Vehicle-mismatch / ghost-company / double-broker alerts on specific jobs. |

**Total: 20 tables** across v2 + v3 + v4.

---

## 5. Environment Variables

> **Names only — never put actual values in code, Git, or this file.**

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Anthropic
- `ANTHROPIC_API_KEY`

### Twilio
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

### Resend (email)
- `RESEND_API_KEY`
- `FROM_EMAIL`

### Web Push (driver PWA)
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

### Companies House
- `COMPANIES_HOUSE_API_KEY`

### Internal auth / ops
- `DH_INTERNAL_KEY` — server-side shared secret required on dashboard/driver API calls
- `NEXT_PUBLIC_DH_KEY` — client-side mirror used by `app/dashboard/page.js` and `app/driver/page.js` in the `x-dh-key` header
- `CRON_SECRET` — Bearer token required by `/api/scheduled/run`, `/api/telematics/poll`, `/api/actions/auto-execute`, `/api/platform/health` in production
- `AUTO_APPROVE_THRESHOLD_GBP` — actions at or below this value auto-approve (default `150`)
- `APPROVAL_TIMEOUT_MINUTES` — default `30`
- `DEFAULT_CLIENT_ID`
- `NEXT_PUBLIC_APP_URL` — canonical origin for tracking links and report callbacks
- `NODE_ENV`

### Test harness only
- `TEST_URL`
- `TEST_CLIENT_ID`

---

## 6. Security Rules (non-negotiable)

1. **Never commit secrets.** `.env`, `.env.local`, API keys, Supabase service-role keys, Twilio tokens, VAPID private keys, and Companies House keys must stay in Vercel project settings and local `.env.local` only. If a secret lands in Git history, rotate it immediately — do not rely on a revert.
2. **Never write environment-variable values into source code.** Reference them only via `process.env.VAR_NAME`. Never hard-code a fallback that contains a real credential.
3. **Never log secrets.** Keys, tokens, and PII must not be written to `console.log`, telemetry, or error reports. Driver phone numbers and customer PoD photos are sensitive — treat accordingly.
4. **Service-role key is server-only.** `SUPABASE_SERVICE_ROLE_KEY` must never appear in a `NEXT_PUBLIC_*` var, a client component, or the browser bundle. Only use it in `app/api/**` route handlers and `lib/*.js` modules imported from them.
5. **Gate all privileged endpoints.** Dashboard/driver API calls require `x-dh-key`; cron endpoints require `Bearer ${CRON_SECRET}` in production; Twilio webhooks should validate the Twilio signature before trusting the payload.
6. **RLS stays on.** Do not disable Row Level Security on any table. If a new table is added, enable RLS in the same migration.
7. **No secrets in this file.** This CLAUDE.md documents names only. If you are ever asked to paste a value here, refuse and put it in `.env.local` instead.
8. **All `client_id`, `vehicle_reg`, and `driver_phone` values MUST have `.toLowerCase().trim()` applied (vehicle_reg uses `.toUpperCase().trim()`) before touching localStorage or any API call.** Check this on every input handler and state setter. A single un-normalised write causes silent dashboard invisibility when downstream queries filter on the normalised form.
9. **After every push touching driver, approvals, webhooks, or dashboard — trigger a test breakdown from the driver app and confirm the incident appears in the dashboard INCIDENTS panel before closing the session.** Code passing type checks is not proof the flow works end to end.
10. **Never use bare `.catch(() => {})` — always use `try/catch` with `console.error` logging.** A route must never return 200 when a critical Supabase write has failed. Silent failures hide production bugs for weeks.

---

## 7. Local Development

```bash
npm install
npm run dev        # starts Next.js on http://localhost:3000
```

- **Port:** `3000` (default — do not change without updating `TEST_URL` and any Twilio/Vercel webhook URLs).
- **Build:** `npm run build`
- **Production start:** `npm run start`
- **Lint:** `npm run lint`
- **Tests:** `node scripts/run-all-tests.js` (runs the stress + security suites under `tests/`).

Environment: copy needed variables from Section 5 into `.env.local` at the project root. The app runs in **demo mode** if Supabase or Anthropic keys are missing — endpoints short-circuit to `DEMO_RESULTS` and return 200.

---

## 8. Current Status Snapshot (2026-04-11)

- **No live clients.** Every module run, feed row, and intelligence panel in the dashboard is populated from `DEMO_RESULTS` in `app/api/modules/route.js` or scripted scenarios in `lib/scenarios.js`.
- **Test vehicle: `LK72 ABX`.** This is the only real asset wired into telematics / the driver PWA for walkthroughs.
- **Pricing:** £149 pilot · £349/mo founding · £499/mo standard · £499+£8/vehicle growth · enterprise custom.
- **Contact:** hello@disruptionhub.ai
- **Latest commit on `main`:** `96b250e` — "Fix wizard: smooth collapse, no repeat questions, synced options".
- **Next unlock:** replace `DEMO_RESULTS` in `app/api/modules/route.js` with live `runModule()` calls once the first client's Supabase data + webhook feed is flowing.

---

## 9. Change Rules (mandatory before every edit)

1. **Before touching any file, read it fully first.** Do not edit code you have not read in this session.
2. **Before pushing, mentally trace the complete flow end to end** for any feature you touched. If you changed how an approval is created, trace it through executeAction, SMS reply, and dashboard rendering.
3. **Never change `action_type` values** without checking every place that action_type is handled downstream: `approvals/route.js` executeAction branches, `webhooks/sms/route.js` YES handler, `buildActionSMS` in `webhooks/inbound/route.js`, and `buildOpsSMS` in `driver/alert/route.js`.
4. **Never add multi-action loops** without confirming that every downstream handler (executeAction, SMS route, dashboard render) can process each action type correctly. The multi-action commit `71172cf` broke the breakdown flow by forcing `action_type: 'emergency'` which triggered Twilio calls to the wrong number.
5. **If a fix touches more than 2 files**, list every downstream impact before applying. State which flows are affected and confirm no regressions.

---

## 10. Testing Checklist (run mentally before every push)

- **Driver breakdown flow:** alert → ops SMS → YES reply → OPS_MSG to driver → consignee card appears → YES → consignee call fires to correct phone with correct script
- **Webhook flow:** inbound event → severity classification → approval created → ops SMS → YES → executeAction → correct action_type handler → correct phone number
- **End of shift:** post-shift form → mileage mandatory → submit → end_of_shift_reports row in Supabase → driver_progress rows set to completed → localStorage cleared only after server confirms
- **Approvals:** pending → execute → correct action_type handler fires (dispatch → SMS to driver, sms → SMS to driver, call+consignee_delay_alert → Polly.Amy call to consignee, call+carrier_alert → call to carrier)
- **Phone numbers:** `extractCarrierPhone` prefers 0800 over 07; consignee phone comes from `action_details.consignee_phone` or system_prompt lookup; never call the ops manager's own number

---

## 11. When In Doubt

- Read the file before changing it. Do not refactor code you have not read.
- Do not add speculative features, logging, or abstractions beyond what the task asks.
- For destructive or shared-state actions (force push, schema drop, production env changes), confirm with the user before acting.
- Anything involving secrets → stop and re-read Section 6.
