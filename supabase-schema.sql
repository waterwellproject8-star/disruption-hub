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
