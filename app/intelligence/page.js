'use client'
import { useState } from 'react'
import Link from 'next/link'

// ── SAMPLE FIXTURES ───────────────────────────────────────────────────────────
const FIXTURES = {
  cargo_theft: {
    job_ref: 'REF-LT-4821',
    cargo_type: 'electronics',
    cargo_value: 145000,
    vehicle_reg: 'LM71 KHT',
    driver_name: 'Paul Fletcher',
    driver_hours_remaining: 3.5,
    origin: 'Heathrow Cargo Centre',
    destination: 'Edinburgh DC',
    route: 'M25 M1 A1',
    departure_time: new Date(Date.now() + 2 * 60 * 60 * 1000).setHours(23, 0, 0, 0)
  },
  workforce: {
    drivers: [
      { name: 'James Okafor', dcpc_expiry: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString(), weeks_at_max_hours: 4 },
      { name: 'Maria Santos', dcpc_expiry: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(), weeks_at_max_hours: 1 },
      { name: 'Tom Richards', dcpc_expiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString() },
      { name: 'Paul Fletcher', dcpc_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() },
    ],
    contract_pipeline: [{ client: 'NHS Sheffield', routes_needed: 3, start_date: '2025-02-01' }],
  },
  client_churn: {
    clients: [
      { name: 'Hendersons Retail Group', annual_revenue: 280000, order_volume_trend: -18, avg_payment_days: 67, complaint_rate: 2.1, last_contact_days: 28 },
      { name: 'Sheffield NHS Trust', annual_revenue: 180000, order_volume_trend: 5, avg_payment_days: 28, complaint_rate: 0.3, last_contact_days: 7 },
      { name: 'AstraZeneca Distribution', annual_revenue: 420000, order_volume_trend: -8, avg_payment_days: 45, complaint_rate: 0.8, last_contact_days: 14 },
    ]
  },
  cashflow: {
    invoices: [
      { client: 'Hendersons Retail', amount: 42000, due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), payment_pattern_days: 67 },
      { client: 'Sheffield NHS', amount: 18500, due_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), payment_pattern_days: 28 },
      { client: 'B&Q Logistics', amount: 31000, due_date: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000).toISOString(), payment_pattern_days: 55 },
    ],
    payroll: { weekly_cost: 28000, next_payroll: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString() },
    upcoming_costs: [{ description: 'Fleet insurance renewal', amount: 24000, date: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString() }],
  },
  subcontractor: {
    subcontractors: [
      { name: 'FastMove Ltd', jobs_completed: 120, jobs_late: 18, damage_claims: 3 },
      { name: 'Northern Haulage Co', jobs_completed: 85, jobs_late: 4, damage_claims: 0 },
      { name: 'QuickFreight Solutions', jobs_completed: 12, jobs_late: 3, damage_claims: 1 },
    ],
    active_jobs: [
      { ref: 'REF-SF-4821', subcontractor: 'QuickFreight Solutions', cargo_type: 'electronics', cargo_value: 68000, expected_vehicle_reg: 'LM99 ABC' },
    ]
  }
}

const MODULES = [
  {
    id: 'cargo_theft', label: 'Cargo Theft Intelligence', icon: '🛡',
    tagline: 'Pre-crime prevention. Real-time threat scoring on every high-value load.',
    color: '#ef4444', colorBg: 'rgba(239,68,68,0.08)', colorBorder: 'rgba(239,68,68,0.25)',
    badge: 'SECURITY', badgeBg: 'rgba(239,68,68,0.12)', badgeColor: '#ef4444',
    stat: { label: 'UK freight crime 2024', value: '£111M' },
    endpoint: '/api/intelligence/cargo-theft',
  },
  {
    id: 'workforce', label: 'Driver Workforce Pipeline', icon: '👥',
    tagline: '12-week headcount intelligence. Know your driver gaps before they happen.',
    color: '#a855f7', colorBg: 'rgba(168,85,247,0.08)', colorBorder: 'rgba(168,85,247,0.25)',
    badge: 'PEOPLE', badgeBg: 'rgba(168,85,247,0.12)', badgeColor: '#a855f7',
    stat: { label: 'UK driver shortage', value: '50,000' },
    endpoint: '/api/intelligence/workforce',
  },
  {
    id: 'client_churn', label: 'Client Churn Prediction', icon: '📡',
    tagline: 'Detect clients planning to leave — before they tell you.',
    color: '#f59e0b', colorBg: 'rgba(245,158,11,0.08)', colorBorder: 'rgba(245,158,11,0.25)',
    badge: 'COMMERCIAL', badgeBg: 'rgba(245,158,11,0.12)', badgeColor: '#f59e0b',
    stat: { label: 'Avg notice of churn', value: '4 weeks' },
    endpoint: '/api/intelligence/client-churn',
  },
  {
    id: 'cashflow', label: 'Cash Flow Intelligence', icon: '💷',
    tagline: '12-week rolling forecast. Detect cash crises before they hit.',
    color: '#00e5b0', colorBg: 'rgba(0,229,176,0.08)', colorBorder: 'rgba(0,229,176,0.25)',
    badge: 'FINANCIAL', badgeBg: 'rgba(0,229,176,0.12)', badgeColor: '#00e5b0',
    stat: { label: 'Avg payment terms', value: '47 days' },
    endpoint: '/api/intelligence/cashflow',
  },
  {
    id: 'subcontractor', label: 'Subcontractor Trust Score', icon: '🔍',
    tagline: 'Ghost freight detection. Know exactly who has your cargo.',
    color: '#3b82f6', colorBg: 'rgba(59,130,246,0.08)', colorBorder: 'rgba(59,130,246,0.25)',
    badge: 'SECURITY', badgeBg: 'rgba(59,130,246,0.12)', badgeColor: '#3b82f6',
    stat: { label: 'Double-brokering incidents', value: 'Rising 2025' },
    endpoint: '/api/intelligence/subcontractor',
  },
]

const CLIENT_ID = typeof window !== 'undefined'
  ? (new URLSearchParams(window.location.search).get('client_id') || '')
  : ''

export default function IntelligencePage() {
  const [active, setActive] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [elapsed, setElapsed] = useState(null)

  async function runModule(mod) {
    setActive(mod.id)
    setLoading(true)
    setResult(null)
    setError(null)
    const start = Date.now()

    try {
      const fixture = FIXTURES[mod.id]
      const body = { module: mod.id, data: fixture, client_id: CLIENT_ID || undefined }

      const res = await fetch('/api/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()
      setElapsed(Date.now() - start)

      if (!res.ok || !data.success) {
        setError(data.error || 'Module failed')
      } else {
        setResult({ module: mod, data })
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const activeMod = MODULES.find(m => m.id === active)

  return (
    <div style={{ minHeight: '100vh', background: '#0a0c0e', color: '#e8eaed', fontFamily: 'IBM Plex Sans, sans-serif' }}>

      {/* Nav */}
      <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 24px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(10,12,14,.98)', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <Link href="/unlock" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none' }}>
            <div style={{ width:24, height:24, background:'#00e5b0', borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#000', fontFamily:'monospace' }}>DH</div>
            <span style={{ fontFamily:'monospace', fontSize:12, color:'#8a9099' }}>DisruptionHub</span>
          </Link>
          <span style={{ color:'rgba(255,255,255,.1)' }}>|</span>
          <span style={{ fontSize:13, fontWeight:500 }}>Intelligence Platform</span>
          <span style={{ fontFamily:'monospace', fontSize:9, padding:'2px 7px', background:'rgba(168,85,247,.12)', border:'1px solid rgba(168,85,247,.25)', borderRadius:3, color:'#a855f7', letterSpacing:'.06em' }}>5 REVOLUTIONARY MODULES</span>
        </div>
        <Link href="/unlock" style={{ fontSize:11, color:'#4a5260', fontFamily:'monospace', textDecoration:'none' }}>← Dashboard</Link>
      </nav>

      <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', minHeight:'calc(100vh - 52px)' }}>

        {/* LEFT — MODULE SELECTOR */}
        <div style={{ borderRight:'1px solid rgba(255,255,255,.06)', background:'#0d1014', padding:'18px', display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ fontFamily:'monospace', fontSize:9, color:'#4a5260', letterSpacing:'.12em', marginBottom:6 }}>SELECT INTELLIGENCE MODULE</div>

          {MODULES.map(mod => (
            <button key={mod.id} onClick={() => runModule(mod)} disabled={loading}
              style={{ textAlign:'left', padding:'14px', borderRadius:8, border:`1px solid ${active===mod.id ? mod.color : 'rgba(255,255,255,.06)'}`, background:active===mod.id ? mod.colorBg : '#111418', cursor:loading?'not-allowed':'pointer', transition:'all .15s', opacity:loading&&active!==mod.id?.5:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:6 }}>
                <span style={{ fontSize:18 }}>{mod.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#e8eaed' }}>{mod.label}</div>
                </div>
                <span style={{ fontSize:8, padding:'2px 6px', background:mod.badgeBg, color:mod.badgeColor, borderRadius:3, fontFamily:'monospace', letterSpacing:'.05em', flexShrink:0 }}>{mod.badge}</span>
              </div>
              <div style={{ fontSize:10, color:'#6b7280', lineHeight:1.5, marginBottom:6 }}>{mod.tagline}</div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontFamily:'monospace', fontSize:9, color:'#3a4656' }}>{mod.stat.label}</span>
                <span style={{ fontFamily:'monospace', fontSize:11, fontWeight:600, color:mod.color }}>{mod.stat.value}</span>
              </div>
              {loading && active === mod.id && (
                <div style={{ marginTop:8, height:2, background:'rgba(255,255,255,.04)', borderRadius:1, overflow:'hidden' }}>
                  <div style={{ height:'100%', background:mod.color, animation:'progress 2s ease infinite', width:'40%', borderRadius:1 }} />
                </div>
              )}
            </button>
          ))}
          <style>{`@keyframes progress{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
        </div>

        {/* RIGHT — RESULTS */}
        <div style={{ overflowY:'auto', padding:'24px' }}>

          {!active && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:16, opacity:.3 }}>
              <div style={{ fontFamily:'monospace', fontSize:48, color:'#4a5260' }}>◈</div>
              <div style={{ fontSize:14, color:'#6b7280', textAlign:'center', maxWidth:380, lineHeight:1.7 }}>
                Five intelligence modules that no competitor has built. Select one to run a live analysis using realistic scenario data.
              </div>
            </div>
          )}

          {loading && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:16 }}>
              <div style={{ width:48, height:48, border:`3px solid rgba(255,255,255,.06)`, borderTop:`3px solid ${activeMod?.color || '#00e5b0'}`, borderRadius:'50%', animation:'spin 1s linear infinite' }} />
              <div style={{ fontFamily:'monospace', fontSize:11, color:activeMod?.color || '#00e5b0', letterSpacing:'.08em' }}>AGENT RUNNING — {activeMod?.label?.toUpperCase()}</div>
              <div style={{ fontSize:12, color:'#6b7280' }}>Querying external data sources + running AI analysis...</div>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {error && (
            <div style={{ padding:'16px', background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.25)', borderRadius:8, color:'#ef4444', fontFamily:'monospace', fontSize:12 }}>
              ✗ {error}
            </div>
          )}

          {result && !loading && (
            <ResultPanel result={result} elapsed={elapsed} />
          )}
        </div>
      </div>
    </div>
  )
}

// ── RESULT RENDERING ──────────────────────────────────────────────────────────
function ResultPanel({ result, elapsed }) {
  const { module: mod, data } = result
  const r = data.result

  const header = (label, color) => (
    <div style={{ fontFamily:'monospace', fontSize:10, color: color || mod.color, letterSpacing:'.1em', marginBottom:10, marginTop:18 }}>{label}</div>
  )

  const card = (children, borderColor) => (
    <div style={{ background:'#0d1014', border:`1px solid ${borderColor || 'rgba(255,255,255,.08)'}`, borderRadius:8, padding:'14px', marginBottom:10 }}>
      {children}
    </div>
  )

  const stat = (label, value, color) => (
    <div style={{ background:'#111418', borderRadius:6, padding:'10px 12px', textAlign:'center' }}>
      <div style={{ fontSize:11, color:'#4a5260', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:18, fontWeight:500, fontFamily:'monospace', color: color || mod.color }}>{value}</div>
    </div>
  )

  const pill = (text, bg, color) => (
    <span style={{ display:'inline-block', padding:'2px 8px', background:bg, color, borderRadius:3, fontSize:10, fontFamily:'monospace', marginRight:4, marginBottom:4 }}>{text}</span>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, paddingBottom:16, borderBottom:'1px solid rgba(255,255,255,.06)' }}>
        <span style={{ fontSize:24 }}>{mod.icon}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:16, fontWeight:500, color:'#e8eaed', marginBottom:2 }}>{mod.label}</div>
          <div style={{ fontFamily:'monospace', fontSize:10, color:'#4a5260' }}>COMPLETED IN {elapsed}ms · {data.actions_queued} actions queued</div>
        </div>
        <div style={{ fontFamily:'monospace', fontSize:9, padding:'4px 10px', background:mod.colorBg, border:`1px solid ${mod.colorBorder}`, borderRadius:4, color:mod.color }}>ANALYSIS COMPLETE</div>
      </div>

      {/* ── CARGO THEFT RESULT ─────────────────────────────────────── */}
      {mod.id === 'cargo_theft' && r.threat_assessment && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:16 }}>
            {stat('Risk Score', r.threat_assessment.risk_score + '/100', r.threat_assessment.risk_level === 'CRITICAL' ? '#ef4444' : r.threat_assessment.risk_level === 'HIGH' ? '#f59e0b' : '#00e5b0')}
            {stat('Risk Level', r.threat_assessment.risk_level, r.threat_assessment.risk_level === 'CRITICAL' ? '#ef4444' : '#f59e0b')}
            {stat('Exposure', '£' + Number(r.threat_assessment.estimated_exposure || 0).toLocaleString(), '#ef4444')}
            {stat('Dangerous Stops', r.dangerous_stops?.length || 0, '#f59e0b')}
          </div>
          {header('THREAT FACTORS')}
          {(r.threat_factors || []).map((f, i) => (
            <div key={i} style={{ display:'flex', gap:10, padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,.04)', alignItems:'flex-start' }}>
              <span style={{ fontSize:10, padding:'2px 6px', background:f.severity==='HIGH'?'rgba(239,68,68,.12)':'rgba(245,158,11,.12)', color:f.severity==='HIGH'?'#ef4444':'#f59e0b', borderRadius:3, fontFamily:'monospace', flexShrink:0 }}>{f.severity}</span>
              <div>
                <div style={{ fontSize:12, color:'#e8eaed', fontWeight:500 }}>{f.factor}</div>
                <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{f.detail}</div>
              </div>
            </div>
          ))}
          {r.prevention_plan && (<>
            {header('PREVENTION PLAN')}
            {card(<>
              <div style={{ fontSize:12, color:'#e8eaed', marginBottom:6 }}><strong style={{ color:mod.color }}>Departure:</strong> {r.prevention_plan.departure_window}</div>
              <div style={{ fontSize:12, color:'#e8eaed', marginBottom:6 }}><strong style={{ color:mod.color }}>Route:</strong> {r.prevention_plan.route_recommendation}</div>
              <div style={{ fontSize:12, color:'#e8eaed', marginBottom:6 }}><strong style={{ color:mod.color }}>Rest strategy:</strong> {r.prevention_plan.rest_strategy}</div>
              {r.prevention_plan.driver_briefing && <div style={{ marginTop:8, padding:'8px 10px', background:'rgba(239,68,68,.06)', borderRadius:5, fontSize:11, color:'#fca5a5', fontStyle:'italic' }}>Driver briefing: {r.prevention_plan.driver_briefing}</div>}
            </>)}
          </>)}
          {(r.recommended_stops || []).length > 0 && (<>
            {header('RECOMMENDED SECURE STOPS')}
            {r.recommended_stops.map((s, i) => card(<>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:12, fontWeight:500, color:'#e8eaed' }}>{s.name || s.road}</span>
                <span style={{ fontFamily:'monospace', fontSize:11, color:'#00e5b0' }}>{s.rating} rated</span>
              </div>
              <div style={{ fontSize:11, color:'#6b7280' }}>{s.why_safer || s.reason} · £{s.cost_per_night || 35}/night</div>
            </>, 'rgba(0,229,176,.15)'), i)}
          </>)}
        </>
      )}

      {/* ── WORKFORCE RESULT ───────────────────────────────────────── */}
      {mod.id === 'workforce' && r.current_state && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:16 }}>
            {stat('Total Drivers', r.current_state.total_drivers)}
            {stat('DCPC Urgent', r.current_state.dcpc_lapsing_30_days, '#ef4444')}
            {stat('At Risk', r.current_state.at_risk_of_departure, '#f59e0b')}
            {stat('Cost if Lost', '£' + Number((r.current_state.at_risk_of_departure || 0) * 7200).toLocaleString(), '#ef4444')}
          </div>
          {(r.dcpc_urgent || []).length > 0 && (<>
            {header('DCPC URGENT ACTIONS', '#ef4444')}
            {r.dcpc_urgent.map((d, i) => (
              <div key={i} style={{ display:'flex', gap:10, padding:'10px', background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.2)', borderRadius:6, marginBottom:6 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:'#e8eaed' }}>{d.driver_name}</div>
                  <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{d.recommended_course} · Est. £{d.estimated_cost}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontFamily:'monospace', fontSize:11, color: d.status === 'LAPSED' ? '#ef4444' : '#f59e0b', fontWeight:600 }}>{d.status}</div>
                  <div style={{ fontFamily:'monospace', fontSize:10, color:'#4a5260' }}>{d.days_remaining >= 0 ? d.days_remaining + 'd left' : Math.abs(d.days_remaining || 0) + 'd overdue'}</div>
                </div>
              </div>
            ))}
          </>)}
          {r.competitor_threat && r.competitor_threat.severity !== 'LOW' && (<>
            {header('COMPETITOR HIRING THREAT', '#f59e0b')}
            {card(<>
              <div style={{ fontSize:11, color:'#e8eaed', marginBottom:8 }}>{r.competitor_threat.recommended_response}</div>
              {(r.competitor_threat.competing_operators || []).map((c, i) => (
                <div key={i} style={{ fontSize:11, color:'#6b7280', padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                  <strong style={{ color:'#e8eaed' }}>{c.company}</strong> — advertising {c.advertised_rate} — gap vs your rate: {c.your_rate_gap}
                </div>
              ))}
            </>, 'rgba(245,158,11,.2)')}
          </>)}
          {(r.headcount_forecast || []).filter(w => w.gap > 0).length > 0 && (<>
            {header('HEADCOUNT GAP FORECAST')}
            {r.headcount_forecast.filter(w => w.gap > 0).map((w, i) => (
              <div key={i} style={{ display:'flex', gap:12, padding:'8px 10px', background:'rgba(168,85,247,.06)', border:'1px solid rgba(168,85,247,.2)', borderRadius:6, marginBottom:5 }}>
                <div style={{ fontFamily:'monospace', fontSize:12, color:'#a855f7', flexShrink:0, paddingTop:2 }}>{w.week}</div>
                <div style={{ flex:1, fontSize:11, color:'#e8eaed' }}>Gap of {w.gap} driver{w.gap!==1?'s':''} — {w.trigger}</div>
              </div>
            ))}
          </>)}
        </>
      )}

      {/* ── CHURN RESULT ───────────────────────────────────────────── */}
      {mod.id === 'client_churn' && r.portfolio_summary && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:16 }}>
            {stat('High Risk', r.portfolio_summary.high_risk, '#ef4444')}
            {stat('Medium Risk', r.portfolio_summary.medium_risk, '#f59e0b')}
            {stat('Revenue at Risk', '£' + Number(r.portfolio_summary.total_revenue_at_risk || 0).toLocaleString(), '#ef4444')}
            {stat('Clients Assessed', r.portfolio_summary.clients_assessed)}
          </div>
          {(r.client_assessments || []).sort((a, b) => b.churn_probability - a.churn_probability).map((c, i) => (
            <div key={i} style={{ background:'#0d1014', border:`1px solid ${c.churn_probability >= 70 ? 'rgba(239,68,68,.3)' : c.churn_probability >= 40 ? 'rgba(245,158,11,.25)' : 'rgba(255,255,255,.08)'}`, borderRadius:8, padding:'14px', marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#e8eaed', marginBottom:2 }}>{c.client_name}</div>
                  <div style={{ fontSize:11, color:'#6b7280' }}>{c.primary_signal}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontFamily:'monospace', fontSize:20, fontWeight:600, color: c.churn_probability >= 70 ? '#ef4444' : c.churn_probability >= 40 ? '#f59e0b' : '#00e5b0' }}>{c.churn_probability}%</div>
                  <div style={{ fontFamily:'monospace', fontSize:9, color:'#4a5260' }}>CHURN RISK</div>
                </div>
              </div>
              {c.retention_plan && (
                <div style={{ padding:'8px 10px', background:'rgba(255,255,255,.03)', borderRadius:5, fontSize:11, color:'#e8eaed' }}>
                  <span style={{ color:'#f59e0b', fontWeight:600 }}>Action: </span>{c.retention_plan.recommended_action}
                  {c.retention_plan.call_by && <span style={{ color:'#4a5260' }}> · by {c.retention_plan.call_by}</span>}
                </div>
              )}
              <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:4 }}>
                {(c.all_signals || []).slice(0, 4).map((s, j) => pill(s.signal?.substring(0, 30), s.severity === 'HIGH' ? 'rgba(239,68,68,.12)' : 'rgba(245,158,11,.1)', s.severity === 'HIGH' ? '#ef4444' : '#f59e0b'))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── CASHFLOW RESULT ────────────────────────────────────────── */}
      {mod.id === 'cashflow' && r.summary && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:16 }}>
            {stat('30-day Net', '£' + Number(r.summary.next_30_days_net || 0).toLocaleString(), r.summary.next_30_days_net > 0 ? '#00e5b0' : '#ef4444')}
            {stat('Trough Detected', r.summary.trough_detected ? 'YES' : 'NO', r.summary.trough_detected ? '#ef4444' : '#00e5b0')}
            {stat('Trough Week', r.summary.trough_week || 'None', r.summary.trough_week ? '#f59e0b' : '#00e5b0')}
            {stat('Trough Amount', r.summary.trough_amount ? '£' + Number(r.summary.trough_amount).toLocaleString() : 'N/A', '#ef4444')}
          </div>
          {r.summary.trough_detected && card(<>
            <div style={{ fontFamily:'monospace', fontSize:10, color:'#ef4444', marginBottom:6 }}>CASH TROUGH ALERT</div>
            <div style={{ fontSize:13, color:'#e8eaed' }}>{r.summary.headline}</div>
          </>, 'rgba(239,68,68,.3)')}
          {header('12-WEEK FORECAST')}
          {(r.weekly_forecast || []).map((w, i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'80px 1fr 1fr 1fr 90px', gap:8, padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,.04)', alignItems:'center' }}>
              <span style={{ fontFamily:'monospace', fontSize:10, color:'#4a5260' }}>{w.week}</span>
              <span style={{ fontFamily:'monospace', fontSize:11, color:'#00e5b0' }}>+£{Number(w.expected_inflows || 0).toLocaleString()}</span>
              <span style={{ fontFamily:'monospace', fontSize:11, color:'#6b7280' }}>-£{Number(w.expected_outflows || 0).toLocaleString()}</span>
              <span style={{ fontFamily:'monospace', fontSize:11, color:w.net > 0 ? '#00e5b0' : '#ef4444' }}>£{Number(w.net || 0).toLocaleString()}</span>
              <span style={{ fontSize:9, padding:'2px 6px', background:w.risk_level==='CRITICAL'?'rgba(239,68,68,.12)':w.risk_level==='CONCERN'?'rgba(245,158,11,.1)':'rgba(0,229,176,.08)', color:w.risk_level==='CRITICAL'?'#ef4444':w.risk_level==='CONCERN'?'#f59e0b':'#00e5b0', borderRadius:3, fontFamily:'monospace', textAlign:'center' }}>{w.risk_level}</span>
            </div>
          ))}
          {(r.invoice_actions || []).length > 0 && (<>
            {header('INVOICE ACTIONS REQUIRED')}
            {r.invoice_actions.slice(0, 4).map((inv, i) => (
              <div key={i} style={{ display:'flex', gap:10, padding:'9px 10px', background:'rgba(0,229,176,.04)', border:'1px solid rgba(0,229,176,.15)', borderRadius:6, marginBottom:5 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:'#e8eaed' }}>{inv.client} — £{Number(inv.amount || 0).toLocaleString()}</div>
                  <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{inv.recommended_action}</div>
                </div>
                <span style={{ fontFamily:'monospace', fontSize:9, color: inv.priority === 'IMMEDIATE' ? '#ef4444' : '#f59e0b', alignSelf:'center', flexShrink:0 }}>{inv.priority}</span>
              </div>
            ))}
          </>)}
        </>
      )}

      {/* ── SUBCONTRACTOR RESULT ───────────────────────────────────── */}
      {mod.id === 'subcontractor' && r.portfolio_summary && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:16 }}>
            {stat('Ghost Alerts', r.portfolio_summary.ghost_freight_alerts || data.ghost_freight_alerts?.length || 0, '#ef4444')}
            {stat('High Trust', r.portfolio_summary.high_trust, '#00e5b0')}
            {stat('Low Trust', r.portfolio_summary.low_trust, '#f59e0b')}
            {stat('Blocked', r.portfolio_summary.blocked, '#ef4444')}
          </div>
          {(data.ghost_freight_alerts || r.ghost_freight_alerts || []).length > 0 && (<>
            {header('GHOST FREIGHT ALERTS', '#ef4444')}
            {(data.ghost_freight_alerts || r.ghost_freight_alerts || []).map((a, i) => (
              <div key={i} style={{ padding:'12px 14px', background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.3)', borderRadius:8, marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:12, fontWeight:600, color:'#e8eaed' }}>{a.job_ref} — {a.alert_type?.replace(/_/g,' ').toUpperCase()}</span>
                  <span style={{ fontFamily:'monospace', fontSize:9, color:'#ef4444' }}>{a.severity}</span>
                </div>
                <div style={{ fontSize:11, color:'#fca5a5', marginBottom:6 }}>{a.detail}</div>
                <div style={{ fontSize:11, color:'#e8eaed', fontWeight:500 }}>→ {a.recommended_action}</div>
              </div>
            ))}
          </>)}
          {header('SUBCONTRACTOR TRUST SCORES')}
          {(r.subcontractor_scores || []).sort((a, b) => a.trust_score - b.trust_score).map((s, i) => (
            <div key={i} style={{ display:'flex', gap:12, padding:'11px 12px', background:'#0d1014', border:`1px solid ${s.trust_score < 50 ? 'rgba(239,68,68,.25)' : s.trust_score < 70 ? 'rgba(245,158,11,.2)' : 'rgba(0,229,176,.15)'}`, borderRadius:8, marginBottom:7 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#e8eaed', marginBottom:2 }}>{s.name}</div>
                <div style={{ fontSize:11, color:'#6b7280' }}>{s.volume_recommendation}</div>
                {(s.red_flags || []).length > 0 && (
                  <div style={{ marginTop:5, display:'flex', flexWrap:'wrap', gap:3 }}>
                    {s.red_flags.slice(0, 2).map((f, j) => pill(f.substring(0, 35), 'rgba(239,68,68,.1)', '#ef4444'))}
                  </div>
                )}
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontFamily:'monospace', fontSize:20, fontWeight:600, color: s.trust_score >= 70 ? '#00e5b0' : s.trust_score >= 50 ? '#f59e0b' : '#ef4444' }}>{s.trust_score}</div>
                <div style={{ fontFamily:'monospace', fontSize:9, color:'#4a5260' }}>TRUST</div>
                <div style={{ fontFamily:'monospace', fontSize:9, padding:'2px 5px', background: s.status === 'BLOCKED' ? 'rgba(239,68,68,.15)' : s.status === 'CAUTION' ? 'rgba(245,158,11,.12)' : 'rgba(0,229,176,.1)', color: s.status === 'BLOCKED' ? '#ef4444' : s.status === 'CAUTION' ? '#f59e0b' : '#00e5b0', borderRadius:2, marginTop:3 }}>{s.status}</div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Actions queued */}
      {(data.actions || []).length > 0 && (
        <div style={{ marginTop:20, padding:'12px 14px', background:'rgba(0,229,176,.05)', border:'1px solid rgba(0,229,176,.2)', borderRadius:8 }}>
          <div style={{ fontFamily:'monospace', fontSize:10, color:'#00e5b0', marginBottom:8 }}>ACTIONS QUEUED FOR APPROVAL</div>
          {data.actions.slice(0, 3).map((a, i) => (
            <div key={i} style={{ fontSize:11, color:'#8a9099', padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
              {a.auto_approve ? '⚡ Auto' : '✋ Approval needed'} — {a.label}
            </div>
          ))}
          <Link href="/admin/approvals" style={{ display:'block', marginTop:8, fontSize:11, color:'#00e5b0', textDecoration:'none' }}>View approval queue →</Link>
        </div>
      )}
    </div>
  )
}
