import { createClient } from '@supabase/supabase-js'

/*
-- Run this in Supabase SQL editor:

CREATE TABLE dvsa_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  vehicle_reg TEXT NOT NULL,
  mot_expiry DATE,
  tax_expiry DATE,
  operator_licence TEXT,
  last_inspection_date DATE,
  last_inspection_result TEXT,
  defects JSONB,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_dvsa_client ON dvsa_records (client_id, vehicle_reg);
CREATE UNIQUE INDEX idx_dvsa_upsert ON dvsa_records (client_id, vehicle_reg);
ALTER TABLE dvsa_records ENABLE ROW LEVEL SECURITY;
*/

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const client_id = searchParams.get('client_id')
    if (!client_id) return Response.json({ error: 'client_id required' }, { status: 400 })

    const db = getDB()
    if (!db) return Response.json({ records: [] })

    const { data, error } = await db
      .from('dvsa_records')
      .select('*')
      .eq('client_id', client_id)
      .order('vehicle_reg', { ascending: true })

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ records: data || [] })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { client_id, records: batch, vehicle_reg, mot_expiry, tax_expiry, operator_licence, last_inspection_date, last_inspection_result, defects, source } = body

    if (!client_id) return Response.json({ error: 'client_id required' }, { status: 400 })

    const db = getDB()
    if (!db) return Response.json({ success: false, error: 'DB not configured' })

    const now = new Date().toISOString()
    const rows = []

    if (batch && Array.isArray(batch)) {
      for (const r of batch) {
        if (!r.vehicle_reg) continue
        rows.push({
          client_id,
          vehicle_reg: r.vehicle_reg.toUpperCase().trim(),
          mot_expiry: r.mot_expiry || null,
          tax_expiry: r.tax_expiry || null,
          operator_licence: r.operator_licence || null,
          last_inspection_date: r.last_inspection_date || null,
          last_inspection_result: r.last_inspection_result || null,
          defects: r.defects || null,
          source: r.source || source || 'csv_upload',
          updated_at: now
        })
      }
    } else if (vehicle_reg) {
      rows.push({
        client_id,
        vehicle_reg: vehicle_reg.toUpperCase().trim(),
        mot_expiry: mot_expiry || null,
        tax_expiry: tax_expiry || null,
        operator_licence: operator_licence || null,
        last_inspection_date: last_inspection_date || null,
        last_inspection_result: last_inspection_result || null,
        defects: defects || null,
        source: source || 'manual',
        updated_at: now
      })
    } else {
      return Response.json({ error: 'Provide vehicle_reg or records batch' }, { status: 400 })
    }

    const { data, error } = await db.from('dvsa_records').upsert(rows, { onConflict: 'client_id,vehicle_reg' }).select()
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({ success: true, upserted: data?.length || 0, records: data })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json()
    const { id, ...updates } = body
    if (!id) return Response.json({ error: 'id required' }, { status: 400 })

    const db = getDB()
    if (!db) return Response.json({ success: false, error: 'DB not configured' })

    const { error } = await db.from('dvsa_records').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({ success: true, id })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
