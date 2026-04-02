-- ═══════════════════════════════════════════════════════════════
-- DisruptionHub v4 — Intelligence Module Tables
-- Run in Supabase SQL editor AFTER v2 and v3 schemas
-- ═══════════════════════════════════════════════════════════════

-- ── CARGO THEFT RISK ASSESSMENTS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS theft_risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  job_ref TEXT NOT NULL,
  vehicle_reg TEXT,
  driver_name TEXT,
  cargo_type TEXT,
  cargo_value NUMERIC,
  route_origin TEXT,
  route_destination TEXT,
  departure_time TIMESTAMPTZ,
  risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100),
  risk_level TEXT, -- LOW | MEDIUM | HIGH | CRITICAL
  risk_factors JSONB DEFAULT '[]',
  dangerous_stops JSONB DEFAULT '[]',
  recommended_stops JSONB DEFAULT '[]',
  reroute_recommended BOOLEAN DEFAULT FALSE,
  outcome TEXT, -- safe | theft_occurred | near_miss | not_tracked
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_theft_risk_client ON theft_risk_assessments(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_theft_risk_job ON theft_risk_assessments(job_ref);

-- ── SUBCONTRACTOR TRUST SCORES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS subcontractor_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  subcontractor_name TEXT NOT NULL,
  company_number TEXT,
  trust_score INTEGER CHECK (trust_score BETWEEN 0 AND 100),
  financial_health_score INTEGER,
  operational_score INTEGER,
  ghost_risk_score INTEGER,
  red_flags JSONB DEFAULT '[]',
  positive_signals JSONB DEFAULT '[]',
  jobs_completed INTEGER DEFAULT 0,
  jobs_late INTEGER DEFAULT 0,
  damage_claims INTEGER DEFAULT 0,
  companies_house_data JSONB,
  last_full_assessment TIMESTAMPTZ,
  status TEXT DEFAULT 'active', -- active | suspended | blocked
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subcontractor_client ON subcontractor_scores(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subcontractor_unique ON subcontractor_scores(client_id, subcontractor_name);

-- ── CLIENT HEALTH SCORES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  monitored_client_name TEXT NOT NULL,
  churn_probability INTEGER CHECK (churn_probability BETWEEN 0 AND 100),
  payment_health_score INTEGER,
  volume_trend_score INTEGER,
  relationship_score INTEGER,
  external_signals JSONB DEFAULT '[]',
  internal_signals JSONB DEFAULT '[]',
  contracts_finder_alerts JSONB DEFAULT '[]',
  companies_house_alerts JSONB DEFAULT '[]',
  recommended_actions JSONB DEFAULT '[]',
  last_assessed TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_health ON client_health_scores(client_id, churn_probability DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_health_unique ON client_health_scores(client_id, monitored_client_name);

-- ── CASH FLOW FORECASTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cashflow_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  forecast_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  weekly_forecasts JSONB NOT NULL, -- array of 12 weekly entries
  total_expected_inflows NUMERIC,
  total_expected_outflows NUMERIC,
  trough_detected BOOLEAN DEFAULT FALSE,
  trough_week TEXT,
  trough_amount NUMERIC,
  trough_actions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cashflow_client ON cashflow_forecasts(client_id, created_at DESC);

-- ── WORKFORCE PIPELINE ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workforce_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  assessment_date DATE DEFAULT CURRENT_DATE,
  total_drivers INTEGER,
  available_drivers INTEGER,
  dcpc_expiring_30_days INTEGER DEFAULT 0,
  dcpc_expiring_90_days INTEGER DEFAULT 0,
  flight_risk_drivers JSONB DEFAULT '[]',
  competitor_threats JSONB DEFAULT '[]',
  headcount_gap_forecast JSONB DEFAULT '[]',
  recommended_hires INTEGER DEFAULT 0,
  recommended_actions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workforce_client ON workforce_pipeline(client_id, created_at DESC);

-- ── GHOST FREIGHT ALERTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ghost_freight_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  job_ref TEXT NOT NULL,
  subcontractor_name TEXT,
  expected_vehicle_reg TEXT,
  actual_vehicle_reg TEXT,
  collection_time TIMESTAMPTZ,
  alert_type TEXT, -- vehicle_mismatch | new_company | flagged_company | double_broker
  risk_level TEXT, -- HIGH | CRITICAL
  resolved BOOLEAN DEFAULT FALSE,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ghost_alerts_client ON ghost_freight_alerts(client_id, resolved, created_at DESC);

-- Enable RLS
ALTER TABLE theft_risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractor_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workforce_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghost_freight_alerts ENABLE ROW LEVEL SECURITY;
