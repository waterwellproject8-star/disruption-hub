'use client'
import Link from 'next/link'

const S = {
  page: {maxWidth:800,margin:'0 auto',padding:'60px 32px',fontFamily:"'Barlow',sans-serif",color:'#e8eaed',background:'#06080d',minHeight:'100vh'},
  h1: {fontFamily:"'Barlow Condensed',sans-serif",fontSize:32,fontWeight:700,color:'#f5a623',marginBottom:8},
  h2: {fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:700,color:'#f5a623',marginBottom:12,marginTop:0},
  h3: {fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:700,color:'#e8eaed',marginBottom:8,marginTop:20},
  p: {fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12},
  muted: {fontSize:13,color:'#4a5260',lineHeight:1.6},
  section: {marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'},
  code: {background:'#0f1826',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,padding:'14px 16px',fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:'#8a9099',lineHeight:1.8,whiteSpace:'pre-wrap',marginBottom:16,display:'block',overflowX:'auto'},
  warn: {padding:'12px 16px',borderLeft:'3px solid #f5a623',background:'rgba(245,166,35,0.06)',borderRadius:'0 6px 6px 0',fontSize:13,color:'#f5a623',lineHeight:1.6,marginBottom:16},
  table: {width:'100%',borderCollapse:'collapse',marginBottom:16,fontSize:13},
  th: {textAlign:'left',padding:'8px 12px',borderBottom:'2px solid #f5a623',fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:'#f5a623',letterSpacing:'0.04em'},
  td: {padding:'8px 12px',borderBottom:'1px solid rgba(255,255,255,0.04)',color:'#8a9099'},
  tdVal: {padding:'8px 12px',borderBottom:'1px solid rgba(255,255,255,0.04)',color:'#e5e7eb',fontFamily:"'IBM Plex Mono',monospace",fontSize:12},
  mono: {fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:'#f5a623'},
}

export default function ApiDocs() {
  return (
    <div style={S.page}>
      <div style={{marginBottom:48}}>
        <Link href="/" style={{fontFamily:'monospace',fontSize:11,color:'#f5a623',textDecoration:'none',letterSpacing:'0.08em'}}>{'<-'} HOME</Link>
      </div>
      <h1 style={S.h1}>Partner API v1</h1>
      <div style={{fontSize:12,color:'#4a5260',fontFamily:'monospace',marginBottom:12}}>v1 · Updated April 27 2026 · Live in production</div>
      <div style={S.warn}>Always use the <code style={S.mono}>www.</code> subdomain. The bare <code style={S.mono}>disruptionhub.ai</code> domain redirects (HTTP 307) which some POST clients do not follow correctly.</div>

      {/* OVERVIEW */}
      <div style={S.section}>
        <h2 style={S.h2}>Overview</h2>
        <p style={S.p}>The DisruptionHub Partner API lets external systems (TMS platforms, telematics providers, freight integrators) push operational events into DisruptionHub for AI-driven triage, and pull fleet / incident data for their own dashboards.</p>
        <p style={S.p}><strong>Inbound:</strong> partner POSTs events (<code style={S.mono}>POST /v1/ingest</code>). DisruptionHub triages, surfaces to ops, optionally fires SMS / voice actions, and resolves the event.</p>
        <p style={S.p}><strong>Outbound:</strong> when an event resolves, DisruptionHub fires an HMAC-signed POST to the partner{"'"}s pre-registered <code style={S.mono}>callback_url</code> so the partner{"'"}s system can update its own state.</p>
      </div>

      {/* AUTHENTICATION */}
      <div style={S.section}>
        <h2 style={S.h2}>Authentication</h2>
        <p style={S.p}>Every request requires an API key. Two equivalent header formats:</p>
        <pre style={S.code}>x-api-key: {'<your-key>'}</pre>
        <p style={S.p}>Or:</p>
        <pre style={S.code}>Authorization: Bearer {'<your-key>'}</pre>
        <p style={S.p}>API keys are issued manually during onboarding. Each key has:</p>
        <ul style={{...S.p,paddingLeft:20}}>
          <li><strong>Permissions</strong> — array of scopes the key can use</li>
          <li><strong>Allowed clients</strong> — array of <code style={S.mono}>client_id</code> values the key may read or write data for. Cross-client access is impossible.</li>
          <li><strong>Active flag</strong> — inactive keys return <code style={S.mono}>ERR_001</code> regardless of permissions</li>
        </ul>

        <h3 style={S.h3}>Permissions</h3>
        <table style={S.table}>
          <thead><tr><th style={S.th}>Permission</th><th style={S.th}>Grants</th></tr></thead>
          <tbody>
            <tr><td style={S.tdVal}>webhook_inbound</td><td style={S.td}>POST to /v1/ingest</td></tr>
            <tr style={{background:'rgba(255,255,255,0.02)'}}><td style={S.tdVal}>incidents_read</td><td style={S.td}>GET /v1/incidents</td></tr>
            <tr><td style={S.tdVal}>fleet_read</td><td style={S.td}>GET /v1/fleet</td></tr>
          </tbody>
        </table>
        <p style={S.muted}>Request additional scopes from hello@disruptionhub.ai.</p>
      </div>

      {/* ERRORS */}
      <div style={S.section}>
        <h2 style={S.h2}>Errors</h2>
        <p style={S.p}>All errors follow a consistent shape:</p>
        <pre style={S.code}>{`{
  "error": "ERR_001",
  "message": "Unauthorised",
  "request_id": "req_a1b2c3"
}`}</pre>
        <table style={S.table}>
          <thead><tr><th style={S.th}>Code</th><th style={S.th}>HTTP</th><th style={S.th}>Meaning</th></tr></thead>
          <tbody>
            <tr><td style={S.tdVal}>ERR_001</td><td style={S.tdVal}>401</td><td style={S.td}>Missing key, invalid key, inactive key, missing permission, or client_id outside scope. Intentionally opaque.</td></tr>
            <tr style={{background:'rgba(255,255,255,0.02)'}}><td style={S.tdVal}>ERR_002</td><td style={S.tdVal}>400</td><td style={S.td}>Required parameter missing or invalid (e.g. missing client_id, missing event_type)</td></tr>
            <tr><td style={S.tdVal}>ERR_004</td><td style={S.tdVal}>500</td><td style={S.td}>Internal error. Retry once after 5 seconds; if persistent, contact support.</td></tr>
          </tbody>
        </table>
        <p style={S.muted}><code style={S.mono}>request_id</code> is returned on every response. Include it when contacting support.</p>
      </div>

      {/* POST /v1/ingest */}
      <div style={S.section}>
        <h2 style={S.h2}>POST /v1/ingest</h2>
        <p style={S.p}>Submit an operational event for triage. Requires <code style={S.mono}>webhook_inbound</code> permission.</p>
        <h3 style={S.h3}>Request body</h3>
        <pre style={S.code}>{`{
  "client_id": "pearson-haulage",
  "event_type": "breakdown",
  "ref": "PH-4421",
  "severity": "CRITICAL",
  "sector": "haulage",
  "payload": {
    "vehicle_reg": "VC16BJJ",
    "driver_name": "Mark Jones",
    "lat": 53.76401,
    "lng": -1.75014,
    "what3words": "dads.names.hurt",
    "description": "Engine warning light, vehicle stationary",
    "location": "M62 westbound near J28"
  }
}`}</pre>
        <table style={S.table}>
          <thead><tr><th style={S.th}>Field</th><th style={S.th}>Required</th><th style={S.th}>Notes</th></tr></thead>
          <tbody>
            <tr><td style={S.tdVal}>client_id</td><td style={S.tdVal}>yes</td><td style={S.td}>Must be in your key{"'"}s allowed scope</td></tr>
            <tr style={{background:'rgba(255,255,255,0.02)'}}><td style={S.tdVal}>event_type</td><td style={S.tdVal}>yes</td><td style={S.td}>See event_type enum below</td></tr>
            <tr><td style={S.tdVal}>ref</td><td style={S.tdVal}>optional</td><td style={S.td}>Your reference (job/order/shipment ID)</td></tr>
            <tr style={{background:'rgba(255,255,255,0.02)'}}><td style={S.tdVal}>severity</td><td style={S.tdVal}>optional</td><td style={S.td}>LOW / MEDIUM / HIGH / CRITICAL. Inferred if omitted.</td></tr>
            <tr><td style={S.tdVal}>sector</td><td style={S.tdVal}>optional</td><td style={S.td}>haulage / lgv / psv / coach. Defaults to haulage.</td></tr>
            <tr style={{background:'rgba(255,255,255,0.02)'}}><td style={S.tdVal}>payload</td><td style={S.tdVal}>yes</td><td style={S.td}>Free-form event detail (vehicle_reg, GPS, descriptions)</td></tr>
          </tbody>
        </table>
        <h3 style={S.h3}>Response</h3>
        <pre style={S.code}>{`{
  "event_id": "evt_a1b2c3d4",
  "received_at": "2026-04-27T09:50:20.441Z",
  "request_id": "req_..."
}`}</pre>
        <div style={S.warn}>The current implementation does NOT deduplicate by ref. Resubmitting the same event creates a new internal record. Implement client-side dedupe.</div>
      </div>

      {/* GET /v1/fleet */}
      <div style={S.section}>
        <h2 style={S.h2}>GET /v1/fleet</h2>
        <p style={S.p}>Retrieve current shipments + client metadata. Requires <code style={S.mono}>fleet_read</code> permission.</p>
        <table style={S.table}>
          <thead><tr><th style={S.th}>Parameter</th><th style={S.th}>Required</th><th style={S.th}>Notes</th></tr></thead>
          <tbody>
            <tr><td style={S.tdVal}>client_id</td><td style={S.tdVal}>yes</td><td style={S.td}>Must be in your key{"'"}s allowed scope</td></tr>
            <tr style={{background:'rgba(255,255,255,0.02)'}}><td style={S.tdVal}>limit</td><td style={S.tdVal}>optional</td><td style={S.td}>Default 50, max 200</td></tr>
            <tr><td style={S.tdVal}>offset</td><td style={S.tdVal}>optional</td><td style={S.td}>Default 0</td></tr>
            <tr style={{background:'rgba(255,255,255,0.02)'}}><td style={S.tdVal}>status</td><td style={S.tdVal}>optional</td><td style={S.td}>Filter by shipment status enum</td></tr>
          </tbody>
        </table>
        <h3 style={S.h3}>Response</h3>
        <pre style={S.code}>{`{
  "shipments": [{
    "id": "uuid",
    "client_id": "pearson-haulage",
    "ref": "PH-4421",
    "route": "Leeds -> Bradford (Tesco DC)",
    "status": "on-track",
    "eta": "14:30",
    "sla_window": "12:00-15:00",
    "penalty_if_breached": 1200,
    "cargo_type": "ambient",
    "cargo_value": 8500,
    "consignee": "Tesco DC Bradford"
  }],
  "client": {
    "id": "pearson-haulage",
    "name": "Pearson Haulage Ltd",
    "sector": "haulage",
    "fleet_size": 25
  },
  "count": 4,
  "has_more": false,
  "request_id": "req_..."
}`}</pre>
        <p style={S.muted}>Fields stripped from response: consignee_phone, contact_phone, contact_email, contact_name, secondary_contact_phone, tier, pilot_started_at, system_prompt, active.</p>
      </div>

      {/* GET /v1/incidents */}
      <div style={S.section}>
        <h2 style={S.h2}>GET /v1/incidents</h2>
        <p style={S.p}>Retrieve operational events. Requires <code style={S.mono}>incidents_read</code> permission.</p>
        <table style={S.table}>
          <thead><tr><th style={S.th}>Parameter</th><th style={S.th}>Required</th><th style={S.th}>Notes</th></tr></thead>
          <tbody>
            <tr><td style={S.tdVal}>client_id</td><td style={S.tdVal}>yes</td><td style={S.td}>Must be in your key{"'"}s allowed scope</td></tr>
            <tr style={{background:'rgba(255,255,255,0.02)'}}><td style={S.tdVal}>event_type</td><td style={S.tdVal}>optional</td><td style={S.td}>Filter by event type enum</td></tr>
            <tr><td style={S.tdVal}>severity</td><td style={S.tdVal}>optional</td><td style={S.td}>Filter by severity enum</td></tr>
            <tr style={{background:'rgba(255,255,255,0.02)'}}><td style={S.tdVal}>since</td><td style={S.tdVal}>optional</td><td style={S.td}>ISO timestamp; only events created at or after</td></tr>
            <tr><td style={S.tdVal}>limit</td><td style={S.tdVal}>optional</td><td style={S.td}>Default 50, max 200</td></tr>
            <tr style={{background:'rgba(255,255,255,0.02)'}}><td style={S.tdVal}>offset</td><td style={S.tdVal}>optional</td><td style={S.td}>Default 0</td></tr>
          </tbody>
        </table>
        <h3 style={S.h3}>Response</h3>
        <pre style={S.code}>{`{
  "incidents": [{
    "id": "uuid",
    "event_type": "breakdown",
    "severity": "CRITICAL",
    "financial_impact": 1200,
    "payload": {
      "vehicle_reg": "VC16BJJ",
      "driver_name": "M. Jones",
      "lat": 53.76401,
      "area": "Wyke",
      "what3words": "///dads.names.hurt",
      "map_url": "https://maps.google.com/?q=53.76401,-1.75014"
    },
    "created_at": "2026-04-27T09:50:20.441Z",
    "resolved_at": "2026-04-27T09:51:58.112Z",
    "resolution_method": "towed"
  }],
  "count": 3,
  "has_more": false,
  "request_id": "req_..."
}`}</pre>
        <h3 style={S.h3}>Field anonymisation</h3>
        <ul style={{...S.p,paddingLeft:20}}>
          <li><code style={S.mono}>driver_name</code> is masked: {"\"Mark Jones\" -> \"M. Jones\""}</li>
          <li><code style={S.mono}>consignee_phone</code> is stripped entirely</li>
          <li>Internal fields omitted: direction, system_name, analysis, sms_fired, simulated, financial_source, callback_fired_at</li>
        </ul>
      </div>

      {/* CALLBACKS */}
      <div style={S.section}>
        <h2 style={S.h2}>Outbound callbacks</h2>
        <p style={S.p}>When an event submitted via <code style={S.mono}>/v1/ingest</code> is resolved, DisruptionHub POSTs a callback to your registered <code style={S.mono}>callback_url</code>.</p>
        <h3 style={S.h3}>Request</h3>
        <pre style={S.code}>{`POST <your-callback_url>
Content-Type: application/json
x-dh-signature: <hmac-sha256 of body using your callback_secret>`}</pre>
        <pre style={S.code}>{`{
  "event_id": "evt_...",
  "ref": "PH-4421",
  "status": "resolved",
  "resolution_method": "towed",
  "resolved_at": "2026-04-27T09:51:58.112Z",
  "client_id": "pearson-haulage"
}`}</pre>
        <h3 style={S.h3}>Verification</h3>
        <p style={S.p}>Compute HMAC-SHA256 of the raw request body using your <code style={S.mono}>callback_secret</code>. Compare to the <code style={S.mono}>x-dh-signature</code> header. Reject if they do not match.</p>
        <p style={S.muted}>Retries: up to 3 attempts with exponential backoff. After 3 failures the callback is logged but not retried.</p>
      </div>

      {/* ENUMS */}
      <div style={S.section}>
        <h2 style={S.h2}>Enums</h2>

        <h3 style={S.h3}>event_type</h3>
        <pre style={S.code}>{`breakdown               carrier_overcharge      delayed
driver_breakdown        engine_fault            failed_delivery
goods_refused           harsh_braking           job_cancelled
job_delayed             medical                 multi_drop_change
panic_button            reefer_fault            running_late
temp_alarm              temp_probe_failure      wtd_hours_breach`}</pre>
        <p style={S.muted}>New event types may be added. Partners should treat unknown types as informational.</p>

        <h3 style={S.h3}>severity</h3>
        <pre style={S.code}>{`LOW    MEDIUM    HIGH    CRITICAL`}</pre>

        <h3 style={S.h3}>shipment.status</h3>
        <table style={S.table}>
          <thead><tr><th style={S.th}>Value</th><th style={S.th}>Meaning</th></tr></thead>
          <tbody>
            <tr><td style={S.tdVal}>on-track</td><td style={S.td}>Default state, no concerns</td></tr>
            <tr style={{background:'rgba(255,255,255,0.02)'}}><td style={S.tdVal}>delayed</td><td style={S.td}>Behind schedule but recoverable</td></tr>
            <tr><td style={S.tdVal}>at_risk</td><td style={S.td}>SLA breach probable without intervention</td></tr>
            <tr style={{background:'rgba(255,255,255,0.02)'}}><td style={S.tdVal}>disrupted</td><td style={S.td}>Active disruption in progress</td></tr>
            <tr><td style={S.tdVal}>not_completed</td><td style={S.td}>Shift ended with this shipment unfulfilled</td></tr>
          </tbody>
        </table>

        <h3 style={S.h3}>resolution_method</h3>
        <table style={S.table}>
          <thead><tr><th style={S.th}>Value</th><th style={S.th}>Meaning</th></tr></thead>
          <tbody>
            <tr><td style={S.tdVal}>driver_fixed</td><td style={S.td}>Driver resolved roadside without external help</td></tr>
            <tr style={{background:'rgba(255,255,255,0.02)'}}><td style={S.tdVal}>recovery_fixed</td><td style={S.td}>Recovery engineer fixed at scene</td></tr>
            <tr><td style={S.tdVal}>towed</td><td style={S.td}>Vehicle towed to depot</td></tr>
            <tr style={{background:'rgba(255,255,255,0.02)'}}><td style={S.tdVal}>other_resolved</td><td style={S.td}>Other / details in description</td></tr>
            <tr><td style={S.tdVal}>driver_ok</td><td style={S.td}>Medical: driver continued shift</td></tr>
            <tr style={{background:'rgba(255,255,255,0.02)'}}><td style={S.tdVal}>driver_unwell_cover</td><td style={S.td}>Medical: cover dispatched</td></tr>
            <tr><td style={S.tdVal}>false_alarm</td><td style={S.td}>Event was a false alarm</td></tr>
            <tr style={{background:'rgba(255,255,255,0.02)'}}><td style={S.tdVal}>other_medical</td><td style={S.td}>Other medical resolution</td></tr>
          </tbody>
        </table>
      </div>

      {/* ONBOARDING */}
      <div style={S.section}>
        <h2 style={S.h2}>Onboarding</h2>
        <ol style={{...S.p,paddingLeft:20}}>
          <li style={{marginBottom:8}}>Email <a href="mailto:hello@disruptionhub.ai" style={{color:'#f5a623',textDecoration:'none'}}>hello@disruptionhub.ai</a> to request a partner API key. Provide: company name, technical contact email, required permissions, client IDs needed, callback URL (if applicable).</li>
          <li style={{marginBottom:8}}>DisruptionHub issues your key and <code style={S.mono}>callback_secret</code> out-of-band (encrypted email or shared password manager).</li>
          <li>Test against a sandbox client_id provided during onboarding before requesting production scope.</li>
        </ol>
      </div>

      {/* KNOWN LIMITATIONS */}
      <div style={{marginBottom:40}}>
        <h2 style={S.h2}>Known limitations</h2>
        <div style={S.warn}>Rate limiting is not currently enforced. Partners are expected to use sensible request rates (recommended: 10 req/sec sustained, 50 burst). Limits will be introduced before second commercial partner signs.</div>
        <div style={S.warn}>Idempotency on /v1/ingest is not implemented. Implement client-side dedupe.</div>
        <div style={S.warn}>Self-serve callback registration is not yet available. Manual configuration during onboarding.</div>
      </div>

      <div style={{marginTop:48,fontSize:13,color:'#4a5260'}}>Questions: <a href="mailto:hello@disruptionhub.ai" style={{color:'#f5a623',textDecoration:'none'}}>hello@disruptionhub.ai</a></div>
    </div>
  )
}
