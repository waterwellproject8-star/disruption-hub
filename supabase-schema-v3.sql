-- ═══════════════════════════════════════════════════════════════
-- DisruptionHub v3 — ADDITIONAL TABLES ONLY
-- Run this in Supabase SQL editor AFTER the v2 schema
-- Do NOT re-run the full v2 schema — this adds new tables only
-- ═══════════════════════════════════════════════════════════════

-- ── LIVE VEHICLE POSITIONS ────────────────────────────────────────
-- Stores the most recent GPS position per vehicle
CREATE TABLE IF NOT EXISTS vehicle_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  vehicle_reg TEXT NOT NULL,
  driver_name TEXT,
  driver_id UUID REFERENCES drivers(id),
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  speed_mph NUMERIC(5,1),
  heading INTEGER, -- degrees 0-360
  ignition_on BOOLEAN DEFAULT TRUE,
  source TEXT DEFAULT 'unknown', -- samsara | webfleet | verizon | webhook | manual
  raw_data JSONB,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by client + vehicle
CREATE INDEX IF NOT EXISTS idx_positions_client_vehicle
  ON vehicle_positions(client_id, vehicle_reg, recorded_at DESC);

-- ── DRIVER JOBS ───────────────────────────────────────────────────
-- Jobs visible to drivers through the PWA
CREATE TABLE IF NOT EXISTS driver_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  driver_id UUID REFERENCES drivers(id),
  vehicle_reg TEXT,
  ref TEXT NOT NULL,
  origin TEXT,
  destination TEXT,
  cargo TEXT,
  sla_deadline TIMESTAMPTZ,
  status TEXT DEFAULT 'pending', -- pending | en_route | completed | cancelled
  instructions TEXT, -- current agent instruction
  instruction_acknowledged BOOLEAN DEFAULT FALSE,
  instruction_acknowledged_at TIMESTAMPTZ,
  pod_photo_url TEXT,
  pod_signed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_jobs_driver
  ON driver_jobs(driver_id, status);

-- ── DRIVER PUSH SUBSCRIPTIONS ─────────────────────────────────────
-- Web Push API subscriptions for driver PWA notifications
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  driver_id UUID REFERENCES drivers(id),
  driver_name TEXT,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── CUSTOMER TRACKING LINKS ───────────────────────────────────────
-- Shareable tracking links for end customers
CREATE TABLE IF NOT EXISTS tracking_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  token TEXT NOT NULL UNIQUE,
  job_ref TEXT NOT NULL,
  vehicle_reg TEXT,
  driver_name TEXT,
  origin TEXT,
  destination TEXT,
  cargo_description TEXT,
  estimated_arrival TIMESTAMPTZ,
  status TEXT DEFAULT 'in_transit', -- in_transit | delivered | delayed | cancelled
  client_branding JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tracking_token ON tracking_links(token);

-- ── POD PHOTOS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pod_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  job_id UUID REFERENCES driver_jobs(id),
  driver_id UUID REFERENCES drivers(id),
  storage_path TEXT NOT NULL,
  public_url TEXT,
  notes TEXT,
  taken_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── TELEMATICS CONFIG ─────────────────────────────────────────────
-- Stores telematics provider credentials per client (encrypted in prod)
CREATE TABLE IF NOT EXISTS telematics_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) UNIQUE,
  provider TEXT NOT NULL, -- samsara | webfleet | verizon | generic_webhook
  api_key TEXT,
  api_secret TEXT,
  fleet_id TEXT,
  webhook_secret TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  last_poll_at TIMESTAMPTZ,
  last_position_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE vehicle_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE telematics_config ENABLE ROW LEVEL SECURITY;
