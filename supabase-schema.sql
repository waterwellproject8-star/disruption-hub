-- ═══════════════════════════════════════════════════════════════
-- DisruptionHub v2 — Complete Supabase Schema
-- Run this in your Supabase SQL editor
-- ═══════════════════════════════════════════════════════════════

-- ── CLIENTS ──────────────────────────────────────────────────────
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'advisory', -- advisory | autonomous | intelligence | enterprise
  system_prompt TEXT,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── MODULE RUNS ───────────────────────────────────────────────────
CREATE TABLE module_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  module TEXT NOT NULL,
  input JSONB,
  output JSONB,
  severity TEXT, -- CRITICAL | HIGH | MEDIUM | LOW | OPPORTUNITY
  financial_impact NUMERIC,
  status TEXT DEFAULT 'complete', -- running | complete | error
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── APPROVAL QUEUE ─────────────────────────────────────────────────
CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  module_run_id UUID REFERENCES module_runs(id),
  action_type TEXT NOT NULL, -- send_email | send_sms | make_call | raise_po | cancel_po | submit_tender
  action_label TEXT NOT NULL,
  action_details JSONB NOT NULL,
  financial_value NUMERIC,
  requires_approval BOOLEAN DEFAULT TRUE,
  auto_approve_at TIMESTAMPTZ, -- null = no auto-approve
  status TEXT DEFAULT 'pending', -- pending | approved | rejected | executed | expired | auto_executed
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  execution_result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── ACTION LOG ─────────────────────────────────────────────────────
CREATE TABLE action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  approval_id UUID REFERENCES approvals(id),
  action_type TEXT NOT NULL,
  action_details JSONB,
  result JSONB,
  success BOOLEAN,
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── INCIDENTS ──────────────────────────────────────────────────────
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  module TEXT NOT NULL,
  title TEXT,
  severity TEXT,
  financial_impact NUMERIC,
  resolved BOOLEAN DEFAULT FALSE,
  resolution_time_seconds INTEGER,
  cost_avoided NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ── CARRIER PERFORMANCE ────────────────────────────────────────────
CREATE TABLE carrier_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  carrier_name TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  on_time_rate NUMERIC,
  damage_rate NUMERIC,
  invoice_accuracy NUMERIC,
  total_deliveries INTEGER,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── DRIVER RECORDS ─────────────────────────────────────────────────
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  name TEXT NOT NULL,
  vehicle_reg TEXT,
  adr_cert_expiry DATE,
  hours_this_week NUMERIC DEFAULT 0,
  retention_risk_score INTEGER DEFAULT 0,
  flags JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── INVOICES ───────────────────────────────────────────────────────
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  carrier TEXT,
  invoice_ref TEXT,
  amount_charged NUMERIC,
  amount_expected NUMERIC,
  discrepancy NUMERIC,
  dispute_status TEXT DEFAULT 'none', -- none | disputed | resolved | recovered
  dispute_amount NUMERIC,
  recovered_amount NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── ROW LEVEL SECURITY ─────────────────────────────────────────────
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrier_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- ── INDEXES ────────────────────────────────────────────────────────
CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_approvals_client ON approvals(client_id);
CREATE INDEX idx_module_runs_client ON module_runs(client_id);
CREATE INDEX idx_incidents_client ON incidents(client_id);
CREATE INDEX idx_action_log_client ON action_log(client_id);

-- ── SECONDARY CONTACT ESCALATION (added 2026-04-11) ────────────────
-- Run in Supabase SQL editor; repo file is advisory.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS secondary_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS secondary_contact_phone TEXT;

ALTER TABLE approvals
  ADD COLUMN IF NOT EXISTS escalation_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS approvals_escalation_lookup
  ON approvals (status, escalation_at)
  WHERE escalated_at IS NULL;

-- ── END OF SHIFT REPORTS (added 2026-04-11) ────────────────────────
-- Compliance-grade record of each shift's close-out data: mileage,
-- notes, post-shift vehicle checks, job counts. Written by
-- /api/driver/end-shift on shift submission.
-- Run in Supabase SQL editor; repo file is advisory.
CREATE TABLE IF NOT EXISTS end_of_shift_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT,
  vehicle_reg TEXT,
  driver_name TEXT,
  driver_phone TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  mileage TEXT,
  notes TEXT,
  post_shift_checks JSONB DEFAULT '{}'::jsonb,
  jobs_completed INTEGER,
  jobs_total INTEGER,
  incidents_count INTEGER DEFAULT 0,
  unresolved_count INTEGER DEFAULT 0,
  fuel_level TEXT,
  defects_flagged BOOLEAN DEFAULT false,
  defect_details TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_end_of_shift_reports_vehicle
  ON end_of_shift_reports (client_id, vehicle_reg, ended_at DESC);

CREATE INDEX IF NOT EXISTS idx_end_of_shift_reports_driver
  ON end_of_shift_reports (driver_phone, ended_at DESC);

ALTER TABLE end_of_shift_reports ENABLE ROW LEVEL SECURITY;

-- ── UNRESOLVED JOBS COLUMN (added 2026-04-12) ──────────────────────
-- Stores the at_risk / part_delivered job snapshots captured before
-- the end-shift bulk update wipes their status.
-- Run in Supabase SQL editor; repo file is advisory.
ALTER TABLE end_of_shift_reports
  ADD COLUMN IF NOT EXISTS unresolved_jobs JSONB;

-- ── DRIVER PROGRESS UNIQUE KEY FIX (added 2026-04-12) ───────────────
-- Original key (client_id, vehicle_reg, ref) causes collisions when
-- two drivers share a vehicle. Adding driver_phone to the key lets
-- each driver own their own progress rows.
-- NULLS NOT DISTINCT ensures null phones still deduplicate correctly.
-- Run in Supabase SQL editor; repo file is advisory.
ALTER TABLE driver_progress
  DROP CONSTRAINT IF EXISTS driver_progress_client_id_vehicle_reg_ref_key;

CREATE UNIQUE INDEX IF NOT EXISTS driver_progress_client_vehicle_ref_phone_key
  ON driver_progress (client_id, vehicle_reg, ref, driver_phone)
  NULLS NOT DISTINCT;
