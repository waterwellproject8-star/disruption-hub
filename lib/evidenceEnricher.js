// Operational evidence enricher for the invoice recovery module.
// Given a job_ref, pulls all available operational data from across the
// schema and assembles a structured evidence object that the dispute
// email composer (Day 3) will cite.
//
// Pure data — no AI calls in this module. Deterministic, fast, cheap.
// Resilient to missing data: returns null fields rather than throwing
// when a source is empty.

// ── Helpers ─────────────────────────────────────────────────────────────────
function lastN(arr, n) {
  if (!Array.isArray(arr)) return []
  return arr.slice(-n)
}

function isoOrNull(ts) {
  if (!ts) return null
  try { return new Date(ts).toISOString() } catch { return null }
}

// ── Source: shipments ───────────────────────────────────────────────────────
async function fetchShipment(db, clientId, jobRef) {
  try {
    const { data, error } = await db
      .from('shipments')
      .select('ref, route, carrier, status, eta, sla_window, penalty_if_breached, cargo_type, cargo_value, alert, agreed_rate, agreed_rate_source, drops, multi_collection, consignee, created_at')
      .eq('client_id', clientId)
      .eq('ref', jobRef)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error(`[enricher:shipment] ${jobRef}:`, error.message)
      return null
    }
    return data
  } catch (err) {
    console.error(`[enricher:shipment] ${jobRef} exception:`, err.message)
    return null
  }
}

// ── Source: driver_progress (latest row per job_ref) ───────────────────────
async function fetchLatestProgress(db, clientId, jobRef) {
  try {
    const { data, error } = await db
      .from('driver_progress')
      .select('vehicle_reg, driver_name, driver_phone, status, alert, last_known_location, pod, shift_started_at, updated_at')
      .eq('client_id', clientId)
      .eq('ref', jobRef)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error(`[enricher:progress] ${jobRef}:`, error.message)
      return null
    }
    if (!data) return null

    return {
      vehicle_reg: data.vehicle_reg,
      driver_name: data.driver_name,
      // Don't expose driver_phone in evidence pack — PII not needed for dispute
      status: data.status,
      alert: data.alert,
      last_known_location: data.last_known_location,
      pod_captured: !!(data.pod && data.pod.length > 0),
      pod_length_chars: data.pod ? data.pod.length : 0,
      shift_started_at: isoOrNull(data.shift_started_at),
      last_updated_at: isoOrNull(data.updated_at)
    }
  } catch (err) {
    console.error(`[enricher:progress] ${jobRef} exception:`, err.message)
    return null
  }
}

// ── Source: webhook_log events (linked by payload.job_ref OR payload.ref) ──
async function fetchWebhookEvents(db, clientId, jobRef) {
  try {
    // Postgres JSONB containment — match on either job_ref or ref keys
    const { data, error } = await db
      .from('webhook_log')
      .select('event_type, severity, created_at, resolved_at, resolution_method, payload, financial_impact, system_name')
      .eq('client_id', clientId)
      .or(`payload->>job_ref.eq.${jobRef},payload->>ref.eq.${jobRef}`)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error(`[enricher:webhooks] ${jobRef}:`, error.message)
      return []
    }

    return (data || []).map(ev => ({
      event_type: ev.event_type,
      severity: ev.severity,
      system_name: ev.system_name,
      vehicle_reg: ev.payload?.vehicle_reg || null,
      description: ev.payload?.description || null,
      financial_impact: ev.financial_impact || 0,
      created_at: isoOrNull(ev.created_at),
      resolved_at: isoOrNull(ev.resolved_at),
      resolution_method: ev.resolution_method
    }))
  } catch (err) {
    console.error(`[enricher:webhooks] ${jobRef} exception:`, err.message)
    return []
  }
}

// ── Source: incidents (AI-captured) ─────────────────────────────────────────
async function fetchIncidents(db, clientId, jobRef) {
  try {
    const { data, error } = await db
      .from('incidents')
      .select('severity, financial_impact, ai_response, created_at')
      .eq('client_id', clientId)
      .eq('ref', jobRef)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      console.error(`[enricher:incidents] ${jobRef}:`, error.message)
      return []
    }

    return (data || []).map(inc => ({
      severity: inc.severity,
      financial_impact: inc.financial_impact || 0,
      // Truncate AI response to first 200 chars — full text not needed in evidence pack
      ai_summary: inc.ai_response ? String(inc.ai_response).substring(0, 200) : null,
      created_at: isoOrNull(inc.created_at)
    }))
  } catch (err) {
    console.error(`[enricher:incidents] ${jobRef} exception:`, err.message)
    return []
  }
}

// ── Source: end_of_shift_reports (linked by vehicle_reg + shift window) ────
async function fetchEndOfShift(db, clientId, vehicleReg, shiftStartedAt) {
  if (!vehicleReg || !shiftStartedAt) return null
  try {
    // Find the EOS report for this vehicle whose shift window overlaps the job's shift_started_at
    const startBuffer = new Date(new Date(shiftStartedAt).getTime() - 1000 * 60 * 60).toISOString() // -1h buffer
    const endBuffer   = new Date(new Date(shiftStartedAt).getTime() + 1000 * 60 * 60 * 24).toISOString() // +24h

    const { data, error } = await db
      .from('end_of_shift_reports')
      .select('mileage, fuel_level, defects_flagged, defect_details, jobs_completed, jobs_total, duration_minutes, reason, shift_ended_at, post_shift_checks')
      .eq('client_id', clientId)
      .eq('vehicle_reg', vehicleReg)
      .gte('shift_started_at', startBuffer)
      .lte('shift_started_at', endBuffer)
      .order('shift_ended_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error(`[enricher:eos] ${vehicleReg}:`, error.message)
      return null
    }
    return data
  } catch (err) {
    console.error(`[enricher:eos] ${vehicleReg} exception:`, err.message)
    return null
  }
}

// ── Summary builder (deterministic prose) ──────────────────────────────────
function buildSummary({ jobRef, shipment, progress, events, incidents, endOfShift }) {
  const parts = []

  if (shipment) {
    const route = shipment.route || 'route unknown'
    const cargo = shipment.cargo_type ? `${shipment.cargo_type}` : 'cargo'
    const sla = shipment.sla_window ? `SLA window ${shipment.sla_window}` : 'no SLA window captured'
    const penalty = shipment.penalty_if_breached ? `, penalty £${shipment.penalty_if_breached} on breach` : ''
    parts.push(`Job ${jobRef}: ${route}, ${cargo}, ${sla}${penalty}.`)
  } else {
    parts.push(`Job ${jobRef}: no shipment record found.`)
  }

  if (progress) {
    const vr = progress.vehicle_reg ? `vehicle ${progress.vehicle_reg}` : 'vehicle unknown'
    const dr = progress.driver_name ? ` driven by ${progress.driver_name}` : ''
    const status = progress.status || 'status unknown'
    const pod = progress.pod_captured ? 'POD captured' : 'no POD recorded'
    parts.push(`Operational: ${vr}${dr}, status ${status}, ${pod}.`)
  }

  const criticalEvents = events.filter(e => e.severity === 'CRITICAL' || e.severity === 'HIGH')
  if (criticalEvents.length > 0) {
    const summary = criticalEvents.slice(0, 3).map(e =>
      `${e.event_type}${e.resolution_method ? ` (${e.resolution_method})` : ''}`
    ).join(', ')
    parts.push(`${criticalEvents.length} CRITICAL/HIGH event(s) during job: ${summary}.`)
  } else if (events.length > 0) {
    parts.push(`${events.length} routine event(s) logged during job — no critical incidents.`)
  } else {
    parts.push(`No webhook events linked to this job.`)
  }

  if (endOfShift) {
    const defects = endOfShift.defects_flagged ? `defects flagged (${endOfShift.defect_details || 'see report'})` : 'no defects flagged'
    parts.push(`End-of-shift: ${endOfShift.jobs_completed}/${endOfShift.jobs_total} jobs completed, ${defects}.`)
  }

  return parts.join(' ')
}

// ── Public API ──────────────────────────────────────────────────────────────
export async function enrichEvidence(db, clientId, jobRef) {
  if (!db || !clientId || !jobRef) {
    return { job_ref: jobRef, error: 'missing_inputs', summary: null }
  }

  // Parallel fetches — independent reads, all bounded
  const [shipment, progress, events, incidents] = await Promise.all([
    fetchShipment(db, clientId, jobRef),
    fetchLatestProgress(db, clientId, jobRef),
    fetchWebhookEvents(db, clientId, jobRef),
    fetchIncidents(db, clientId, jobRef)
  ])

  // EOS lookup needs vehicle_reg + shift_started_at from progress
  const endOfShift = progress
    ? await fetchEndOfShift(db, clientId, progress.vehicle_reg, progress.shift_started_at)
    : null

  const summary = buildSummary({ jobRef, shipment, progress, events, incidents, endOfShift })

  return {
    job_ref: jobRef,
    shipment,
    latest_progress: progress,
    events: lastN(events, 10),
    incidents,
    end_of_shift: endOfShift,
    summary,
    enriched_at: new Date().toISOString()
  }
}

// Convenience: enrich many job_refs in parallel, dedupe by ref
export async function enrichEvidenceBatch(db, clientId, jobRefs) {
  const unique = [...new Set((jobRefs || []).filter(Boolean))]
  const results = await Promise.all(
    unique.map(ref => enrichEvidence(db, clientId, ref))
  )
  // Return as map keyed by job_ref for easy attach
  const byRef = {}
  for (const r of results) byRef[r.job_ref] = r
  return byRef
}
