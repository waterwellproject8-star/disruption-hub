# DisruptionHub — Flow Test Documentation

Run these 5 flows before every push that touches driver, approvals, webhooks, or dashboard code.

---

## FLOW 1 — Single delivery, no incidents

### Trigger
1. Driver opens app, enters details, starts shift
2. Pre-shift checks all pass
3. Driver progresses through: at_collection → loaded → at_customer → delivered (with POD)
4. Driver ends shift with mileage + notes

### Expected ops SMS
None — no incidents, no alerts.

### Expected driver app state
- SHIFT_START row visible in driver_progress
- Each progress step updates status in real time
- POD method stored on the completed row
- Post-shift form shows, mileage enforced
- Shift summary screen with stats

### Expected Supabase rows
- `driver_progress`: SHIFT_START (on_shift → completed), job ref rows (at_collection → loaded → at_customer → completed with pod)
- `end_of_shift_reports`: 1 row with mileage, notes, post_shift_checks, jobs_completed=1, unresolved_count=0

### Expected dashboard state
- Live Fleet: driver visible during shift, disappears after end-shift
- COMMAND tab: no approval cards
- Active drivers: shows during shift, removed after

### Known failure modes
- If `dh_postshift_draft` localStorage corrupted → post-shift form may not restore on browser close
- If end-shift POST fails → localStorage not wiped → stale session on next login (handled by stale-session screen)
- If driver_progress upsert key mismatch → progress rows fail silently (check Vercel logs)

---

## FLOW 2 — Breakdown mid-shift, single job

### Trigger
1. Driver on a single job (at_customer or loaded status)
2. Taps BREAKDOWN → enters description → sendAlert fires
3. Ops receives SMS → replies YES
4. Driver taps Resolve → enters resolution

### Expected ops SMS
```
🔴 CRITICAL — BREAKDOWN
DH [sev] [vehicle_reg]
[situation]
[£ exposure]YES=dispatch recovery / NO / OPEN
```
After YES: second SMS for consignee notification:
```
DH: Recovery confirmed for LK72 ABX.
Consignee: [name]
Reply YES to call them automatically
Reply NO to skip
```

### Expected driver app state
- All non-completed jobs → at_risk (red status)
- Emergency buttons disabled (shows "Alert already active")
- Medical button still active
- Delivery completion still possible
- OPS_MSG banner appears: "Recovery dispatched. Stay with vehicle. N deliveries affected"
- After resolve: all at_risk → on-track, alert cleared

### Expected Supabase rows
- `incidents`: 1 row (severity HIGH or CRITICAL, ref=DRIVER-ALERT or job ref)
- `approvals`: 2 rows — dispatch (status pending → executed on YES), consignee_delay_alert (status pending)
- `driver_progress`: job rows updated to at_risk then back to on-track after resolve
- After resolve: `approvals` dispatch row status=executed, resolve notification row status=executed

### Expected dashboard state
- COMMAND tab: 2 pending cards (dispatch + consignee)
- After ops approves dispatch: 1 executed + 1 pending (consignee)
- After consignee approved: both executed
- Financial exposure shown on dispatch card

### Known failure modes
- If SMS webhook URL points to `/api/sms/inbound` instead of `/api/webhooks/sms` → YES reply logs as approval instead of executing
- If `clients.contact_phone` not in E.164 format → ops number not matched → "Number not recognised"
- If resolve fires before alert POST lands → approval never marked resolved (race condition — 3-second delay mitigates)
- If dedup check triggers on second tap → returns deduplicated without processing (by design)

---

## FLOW 3 — Breakdown mid-shift, multi-drop (3+ jobs)

### Trigger
1. Driver has 3+ jobs assigned, currently on job 1
2. Taps BREAKDOWN → all 3+ jobs set to at_risk
3. Ops receives SMS, approves recovery
4. Cascade consignee notifications fire for jobs 2, 3, 4

### Expected ops SMS
Same as Flow 2, plus after dispatch approval: second SMS for job 1 consignee. Jobs 2-4 consignee cards appear in dashboard COMMAND tab (built by Phase A cascade logic, if implemented).

### Expected driver app state
- All non-completed jobs → at_risk
- After OPS_MSG: revised ETAs shown if available
- Jobs with revised_eta > sla_window flagged as SLA AT RISK (if Phase B implemented)

### Expected Supabase rows
- `incidents`: 1 row
- `approvals`: 1 dispatch + N consignee_delay_alert rows (1 per at_risk job)
- `driver_progress`: all job refs at_risk, then on-track after resolve
- `shipments`: revised_eta updated for each at_risk job (if Phase A implemented)

### Expected dashboard state
- COMMAND tab: 1 dispatch card + N consignee cards, ordered by severity/urgency
- Each consignee card shows: consignee name, original ETA, revised ETA, SLA deadline, penalty
- Cards flagged SLA_AT_RISK shown in red with penalty amount

### Known failure modes
- If shipments table has no consignee_phone → consignee call fails (ops notified to call manually)
- If delay_minutes extraction returns wrong number → revised ETAs are incorrect
- If driver resolves before all consignee cards are approved → cards stay pending until end-shift expires them

---

## FLOW 4 — Webhook reefer fault → ops approve → driver notified

### Trigger
1. SETUP tab: fire Webfleet → Reefer Unit Fault
2. Ops sees pending card in COMMAND tab
3. Ops taps YES (or replies YES to SMS)

### Expected ops SMS
```
🔴 CRITICAL — REEFER FAULT
LK72 ABX · M62 westbound J27
£14,000 exposure
YES = dispatch recovery + notify driver
Reply YES · NO · OPEN
```

### Expected driver app state
- If driver is on shift with matching vehicle_reg: OPS_MSG banner appears on next 60-second poll
- If driver not on shift: no driver-side effect (ops-only flow)

### Expected Supabase rows
- `webhook_log`: 1 row (severity=CRITICAL, financial_impact=14000, sms_fired=true)
- `approvals`: 1+ rows (status pending, escalation_at=now+15min, action_details.severity=CRITICAL)
- After approve: approval status=executed, driver_progress.alert=OPS_MSG

### Expected dashboard state
- COMMAND tab: pending card with 🔴 severity, £14,000 exposure
- After approve: card shows ✓ DONE
- Webhook log in SETUP tab shows the event

### Known failure modes
- If dedup fires (same event within 60 seconds) → returns { deduplicated: true }, no approval created
- If unknown client_id → returns 404, no processing
- If Claude Sonnet timeout (>30s on Hobby plan) → AI analysis empty, fallback approval with generic label

---

## FLOW 5 — End of shift with unresolved jobs

### Trigger
1. Driver has 2 jobs: 1 completed, 1 still at_risk from earlier breakdown
2. Driver taps End Shift → post-shift form
3. Fills mileage, notes, post-shift checks
4. Taps Submit

### Expected ops SMS
None directly from end-shift. If unresolved jobs exist → an approval card with action_type='notify' appears in COMMAND tab.

### Expected driver app state
- Post-shift form enforces mileage
- Form data auto-saved to `dh_postshift_draft` on each keystroke
- After submit: shift summary screen with stats including unresolved count
- localStorage cleared only after server confirms (res.ok)

### Expected Supabase rows
- `end_of_shift_reports`: 1 row with mileage, notes, post_shift_checks, unresolved_count=1, unresolved_jobs JSONB array containing the at_risk job snapshot
- `driver_progress`: all rows set to completed, including the at_risk one
- `approvals`: pending approvals for this vehicle expired with "SHIFT ENDED — " prefix
- `approvals`: 1 new row with action_type='notify', label="SHIFT ENDED WITH UNRESOLVED JOBS — [vehicle]: [refs]", status='executed'

### Expected dashboard state
- COMMAND tab: previous pending cards now show "SHIFT ENDED — ..." with expired status
- New notify card shows unresolved jobs
- Live Fleet: driver removed (all rows completed)

### Known failure modes
- If end-shift POST returns 500 → localStorage NOT wiped → stale session on next login catches it
- If `unresolvedJobs` declared after reference → TDZ error (fixed in commit a5a3b40)
- If postShiftChecks contains non-serializable values → JSON.stringify fails → end-shift POST never fires (fixed with safeChecks sanitisation)
- If end-shift report insert fails but driver_progress update succeeds → compliance data lost but shift ends cleanly

---

## Pre-push checklist

Before pushing any change to driver, approvals, webhooks, or dashboard code:

1. [ ] Mentally trace the change through all 5 flows above
2. [ ] Check if any action_type values were changed — verify all downstream handlers
3. [ ] Check if any Supabase column names were changed — verify all routes that read/write them
4. [ ] Verify no duplicate `const` declarations in the same scope
5. [ ] Verify no fire-and-forget fetch calls that should await
6. [ ] Check that `safeChecks` sanitisation still runs before any JSON.stringify of postShiftChecks
