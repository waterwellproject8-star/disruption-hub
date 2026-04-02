'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'

const DASHBOARD_PIN = 'DH2026'

const ACTIVE_SHIPMENTS = [
  { ref: 'REF-4421', route: 'Manchester → Bristol', status: 'on-track', eta: '14:22', carrier: 'DHL Express', alert: null },
  { ref: 'REF-8832', route: 'Glasgow → London', status: 'disrupted', eta: '???', carrier: 'FastFreight UK', alert: 'M74 closure — agent analysis ready' },
  { ref: 'REF-9103', route: 'Birmingham → Edinburgh', status: 'delayed', eta: '17:45', carrier: 'Yodel', alert: 'Weather delay — 45min behind' },
  { ref: 'REF-5517', route: 'Leeds → Cardiff', status: 'on-track', eta: '16:00', carrier: 'XPO Logistics', alert: null },
]

const INCIDENT_LOG = [
  { date: 'Today 07:35', ref: 'REF-8832', type: 'Weather', severity: 'CRITICAL', saved: '£7,450' },
  { date: 'Yesterday', ref: 'REF-7741', type: 'Invoice Recovery', severity: 'HIGH', saved: '£4,280' },
  { date: '3 days ago', ref: 'REF-6602', type: 'Driver Hours', severity: 'MEDIUM', saved: '£900' },
]

const STATUS_COLORS = { 'on-track': '#00e5b0', 'disrupted': '#ef4444', 'delayed': '#f59e0b' }
const SEV_COLORS = { 'CRITICAL': '#ef4444', 'HIGH': '#f59e0b', 'MEDIUM': '#3b82f6', 'LOW': '#8a9099' }
const SEV_BG = { 'CRITICAL': 'rgba(239,68,68,0.1)', 'HIGH': 'rgba(245,158,11,0.1)', 'MEDIUM': 'rgba(59,130,246,0.1)', 'LOW': 'rgba(138,144,153,0.1)' }

const MODULES = [
  { id: 'disruption', label: 'Disruption Analysis', icon: '⚡', cat: 'ops' },
  { id: 'sla_prediction', label: 'SLA Breach Prediction', icon: '🔮', cat: 'ops' },
  { id: 'invoice', label: 'Invoice Recovery', icon: '🧾', cat: 'save' },
  { id: 'driver_hours', label: 'Driver Hours Monitor', icon: '⏱', cat: 'compliance' },
  { id: 'hazmat', label: 'Hazmat Checker', icon: '⚠️', cat: 'compliance' },
  { id: 'carrier', label: 'Carrier Scorecard', icon: '📊', cat: 'ops' },
  { id: 'fuel', label: 'Fuel Optimisation', icon: '⛽', cat: 'save' },
  { id: 'vehicle_health', label: 'Vehicle Health', icon: '🔧', cat: 'ops' },
  { id: 'driver_retention', label: 'Driver Retention', icon: '👤', cat: 'ops' },
  { id: 'carbon', label: 'Carbon & ESG', icon: '🌱', cat: 'growth' },
  { id: 'tender', label: 'Tender Intelligence', icon: '🏆', cat: 'growth' },
  { id: 'regulation', label: 'Regulation Monitor', icon: '📜', cat: 'compliance' },
  { id: 'consolidation', label: 'Load Consolidation', icon: '📦', cat: 'save' },
  { id: 'forecast', label: 'Demand Forecast', icon: '📈', cat: 'ops' },
  { id: 'benchmarking', label: 'Rate Benchmarking', icon: '💹', cat: 'growth' },
  { id: 'insurance', label: 'Claims Intelligence', icon: '🛡', cat: 'compliance' },
]

const CAT_COLORS = {
  ops:        { bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.2)',  text: '#3b82f6' },
  save:       { bg: 'rgba(0,229,176,0.08)',   border: 'rgba(0,229,176,0.2)',   text: '#00e5b0' },
  compliance: { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)', text: '#f59e0b' },
  growth:     { bg: 'rgba(168,85,247,0.08)',  border: 'rgba(168,85,247,0.2)', text: '#a855f7' },
}

const TAB_STYLE = (active) => ({
  padding: '6px 16px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
  fontFamily: 'monospace', letterSpacing: '0.04em',
  border: active ? '1px solid #00e5b0' : '1px solid rgba(255,255,255,0.08)',
  background: active ? 'rgba(0,229,176,0.1)' : 'transparent',
  color: active ? '#00e5b0' : '#8a9099', transition: 'all 0.15s'
})

// ── PIN GATE ─────────────────────────────────────────────────────────────────
function PinGate({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const handleSubmit = () => {
    if (pin.toUpperCase() === DASHBOARD_PIN) { onUnlock() }
    else { setError(true); setPin(''); setTimeout(() => setError(false), 2000) }
  }
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0a0c0e', fontFamily:'IBM Plex Sans, sans-serif' }}>
      <div style={{ width:360, padding:'40px 36px', background:'#111418', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, textAlign:'center' }}>
        <div style={{ width:44, height:44, background:'#00e5b0', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:'#000', fontFamily:'monospace', margin:'0 auto 20px' }}>DH</div>
        <div style={{ fontFamily:'monospace', fontSize:11, color:'#00e5b0', letterSpacing:'0.1em', marginBottom:8 }}>DISRUPTIONHUB</div>
        <div style={{ fontSize:15, color:'#e8eaed', marginBottom:6 }}>Operations Dashboard</div>
        <div style={{ fontSize:12, color:'#4a5260', marginBottom:28 }}>Authorised access only</div>
        <input type="password" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} placeholder="Enter access code" autoFocus
          style={{ width:'100%', padding:'12px 14px', background:'#0a0c0e', border: error ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.12)', borderRadius:6, color:'#e8eaed', fontSize:14, outline:'none', fontFamily:'IBM Plex Mono, monospace', letterSpacing:'0.2em', textAlign:'center', marginBottom:12, boxSizing:'border-box', transition:'border 0.2s' }} />
        {error && <div style={{ fontSize:11, color:'#ef4444', fontFamily:'monospace', marginBottom:10 }}>Invalid access code</div>}
        <button onClick={handleSubmit} style={{ width:'100%', padding:'11px', background:'#00e5b0', border:'none', borderRadius:6, color:'#000', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'IBM Plex Sans, sans-serif' }}>Access Dashboard →</button>
        <div style={{ marginTop:20, fontSize:11, color:'#4a5260' }}>Not a client? <a href="/" style={{ color:'#00e5b0', textDecoration:'none' }}>View live demo →</a></div>
      </div>
    </div>
  )
}

// ── AGENT RESPONSE RENDERER ────────────────────────────────────────────────
function AgentResponse({ text }) {
  const lines = text.split('\n')
  const rendered = []
  let key = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Section headers
    if (line.startsWith('## ')) {
      rendered.push(
        <div key={key++} style={{ display:'flex', alignItems:'center', gap:8, margin:'20px 0 10px', paddingTop:16, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ height:1, width:12, background:'#00e5b0' }} />
          <span style={{ fontFamily:'monospace', fontSize:10, color:'#00e5b0', letterSpacing:'0.1em', fontWeight:600 }}>{line.replace('## ', '').toUpperCase()}</span>
        </div>
      )
      continue
    }

    // Severity lines
    if (line.includes('CRITICAL')) {
      rendered.push(<div key={key++} style={{ display:'flex', alignItems:'center', gap:8, margin:'3px 0' }}>
        <span style={{ background:'#ef4444', color:'#fff', fontSize:9, fontFamily:'monospace', padding:'2px 6px', borderRadius:3, fontWeight:700 }}>CRITICAL</span>
        <span style={{ fontSize:12, color:'#e8eaed' }}>{line.replace(/.*CRITICAL[:\s]*/,'')}</span>
      </div>)
      continue
    }
    if (line.includes('Severity: HIGH') || line.match(/^- Severity: HIGH/)) {
      rendered.push(<div key={key++} style={{ display:'flex', alignItems:'center', gap:8, margin:'3px 0' }}>
        <span style={{ background:'#f59e0b', color:'#000', fontSize:9, fontFamily:'monospace', padding:'2px 6px', borderRadius:3, fontWeight:700 }}>HIGH</span>
        <span style={{ fontSize:12, color:'#e8eaed' }}>{line.replace(/.*HIGH[:\s]*/,'')}</span>
      </div>)
      continue
    }

    // Financial impact lines - highlight in green
    if (line.match(/£[\d,]+/) && (line.includes('Impact') || line.includes('Exposure') || line.includes('exposure') || line.includes('Financial'))) {
      const highlighted = line.replace(/(£[\d,]+(?:–£[\d,]+)?(?:K)?)/g, '<span style="color:#00e5b0;font-weight:600;font-family:monospace">$1</span>')
      rendered.push(<div key={key++} style={{ fontSize:12, color:'#8a9099', margin:'3px 0', lineHeight:1.6 }} dangerouslySetInnerHTML={{ __html: highlighted.replace(/^- /, '') }} />)
      continue
    }

    // Numbered actions - make them cards
    const actionMatch = line.match(/^(\d+)\.\s+(.+)/)
    if (actionMatch) {
      const [, num, content] = actionMatch
      const isUrgent = content.includes('NOW') || content.includes('IMMEDIATELY') || content.includes('05:0') || content.includes('14:')
      rendered.push(
        <div key={key++} style={{ display:'flex', gap:10, margin:'6px 0', padding:'10px 12px', background:'#111418', borderRadius:6, border: isUrgent ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width:20, height:20, borderRadius:'50%', background: isUrgent ? '#ef4444' : '#00e5b0', color:'#000', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0, marginTop:1 }}>{num}</div>
          <div style={{ fontSize:12, color:'#e8eaed', lineHeight:1.6, flex:1 }}>{content}</div>
        </div>
      )
      continue
    }

    // Bullet points
    if (line.startsWith('- ') || line.startsWith('— ')) {
      const content = line.replace(/^[-—]\s+/, '')
      const hasAmount = content.match(/£[\d,]+/)
      rendered.push(
        <div key={key++} style={{ display:'flex', gap:8, margin:'2px 0', paddingLeft:4 }}>
          <span style={{ color:'#00e5b0', fontSize:10, marginTop:3, flexShrink:0 }}>—</span>
          <span style={{ fontSize:12, color: hasAmount ? '#e8eaed' : '#8a9099', lineHeight:1.6 }}>
            {hasAmount ? content.replace(/(£[\d,]+(?:–£[\d,]+)?(?:\s*(?:total|exposure|cargo|penalty))?)/gi, (m) => `<strong style="color:#00e5b0">${m}</strong>`) : content}
          </span>
        </div>
      )
      continue
    }

    // Bold text
    if (line.includes('**')) {
      const html = line.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#e8eaed;font-weight:600">$1</strong>')
      rendered.push(<div key={key++} style={{ fontSize:12, color:'#8a9099', margin:'2px 0', lineHeight:1.6 }} dangerouslySetInnerHTML={{ __html: html }} />)
      continue
    }

    // Empty lines
    if (!line.trim()) {
      rendered.push(<div key={key++} style={{ height:4 }} />)
      continue
    }

    // Default
    rendered.push(<div key={key++} style={{ fontSize:12, color:'#8a9099', margin:'2px 0', lineHeight:1.6 }}>{line}</div>)
  }

  return <div style={{ padding:'4px 0' }}>{rendered}</div>
}

// ── MODULE RESULT RENDERER ─────────────────────────────────────────────────
function ModuleResult({ result, moduleName }) {
  if (!result) return null
  const r = result.result || result

  const sevColor = SEV_COLORS[r.severity] || '#8a9099'
  const sevBg = SEV_BG[r.severity] || 'rgba(138,144,153,0.1)'

  return (
    <div style={{ marginTop:16 }}>
      {/* Header bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'rgba(0,229,176,0.06)', border:'1px solid rgba(0,229,176,0.15)', borderRadius:'8px 8px 0 0', fontFamily:'monospace', fontSize:11, color:'#00e5b0' }}>
        <span>MODULE RESULT — {moduleName?.toUpperCase()}</span>
        {result.actions_queued > 0 && <span style={{ color:'#f59e0b' }}>● {result.actions_queued} action{result.actions_queued !== 1 ? 's' : ''} queued for approval</span>}
      </div>

      <div style={{ border:'1px solid rgba(0,229,176,0.15)', borderTop:'none', borderRadius:'0 0 8px 8px', overflow:'hidden' }}>

        {/* Severity + financials row */}
        {(r.severity || r.financial_impact || r.total_overcharge) && (
          <div style={{ display:'flex', gap:10, padding:'12px 14px', background:'#0d1014', borderBottom:'1px solid rgba(255,255,255,0.06)', flexWrap:'wrap' }}>
            {r.severity && (
              <div style={{ padding:'6px 14px', borderRadius:6, background:sevBg, border:`1px solid ${sevColor}30` }}>
                <div style={{ fontSize:9, color:'#4a5260', fontFamily:'monospace', marginBottom:2 }}>SEVERITY</div>
                <div style={{ fontSize:14, fontWeight:700, color:sevColor, fontFamily:'monospace' }}>{r.severity}</div>
              </div>
            )}
            {(r.financial_impact > 0 || r.total_overcharge > 0) && (
              <div style={{ padding:'6px 14px', borderRadius:6, background:'rgba(0,229,176,0.06)', border:'1px solid rgba(0,229,176,0.15)' }}>
                <div style={{ fontSize:9, color:'#4a5260', fontFamily:'monospace', marginBottom:2 }}>{r.total_overcharge ? 'RECOVERABLE' : 'FINANCIAL EXPOSURE'}</div>
                <div style={{ fontSize:14, fontWeight:700, color:'#00e5b0', fontFamily:'monospace' }}>£{(r.financial_impact || r.total_overcharge || 0).toLocaleString()}</div>
              </div>
            )}
            {r.affected_shipments > 0 && (
              <div style={{ padding:'6px 14px', borderRadius:6, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize:9, color:'#4a5260', fontFamily:'monospace', marginBottom:2 }}>AFFECTED</div>
                <div style={{ fontSize:14, fontWeight:700, color:'#e8eaed', fontFamily:'monospace' }}>{r.affected_shipments} shipment{r.affected_shipments !== 1 ? 's' : ''}</div>
              </div>
            )}
            {r.time_to_resolution && r.time_to_resolution !== 'N/A – No disruption detected' && (
              <div style={{ padding:'6px 14px', borderRadius:6, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize:9, color:'#4a5260', fontFamily:'monospace', marginBottom:2 }}>RESOLUTION</div>
                <div style={{ fontSize:12, fontWeight:500, color:'#e8eaed', fontFamily:'monospace' }}>{r.time_to_resolution}</div>
              </div>
            )}
            {r.annual_projection > 0 && (
              <div style={{ padding:'6px 14px', borderRadius:6, background:'rgba(0,229,176,0.06)', border:'1px solid rgba(0,229,176,0.15)' }}>
                <div style={{ fontSize:9, color:'#4a5260', fontFamily:'monospace', marginBottom:2 }}>ANNUAL PROJECTION</div>
                <div style={{ fontSize:14, fontWeight:700, color:'#00e5b0', fontFamily:'monospace' }}>£{r.annual_projection?.toLocaleString()}</div>
              </div>
            )}
          </div>
        )}

        {/* Assessment */}
        {r.sections?.assessment && r.sections.assessment !== 'N/A – No disruption detected' && (
          <div style={{ padding:'12px 14px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize:9, fontFamily:'monospace', color:'#4a5260', letterSpacing:'0.08em', marginBottom:6 }}>ASSESSMENT</div>
            <div style={{ fontSize:12, color:'#8a9099', lineHeight:1.7 }}>{r.sections.assessment}</div>
          </div>
        )}

        {/* Immediate actions */}
        {r.sections?.immediate_actions?.length > 0 && (
          <div style={{ padding:'12px 14px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize:9, fontFamily:'monospace', color:'#4a5260', letterSpacing:'0.08em', marginBottom:8 }}>IMMEDIATE ACTIONS</div>
            {r.sections.immediate_actions.map((action, i) => (
              <div key={i} style={{ display:'flex', gap:10, marginBottom:6, padding:'8px 10px', background:'#111418', borderRadius:5, border:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width:18, height:18, borderRadius:'50%', background:'#00e5b0', color:'#000', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, flexShrink:0, marginTop:1 }}>{i+1}</div>
                <div style={{ fontSize:11, color:'#e8eaed', lineHeight:1.6 }}>{action}</div>
              </div>
            ))}
          </div>
        )}

        {/* Discrepancies (invoice module) */}
        {r.discrepancies?.length > 0 && (
          <div style={{ padding:'12px 14px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize:9, fontFamily:'monospace', color:'#4a5260', letterSpacing:'0.08em', marginBottom:8 }}>DISCREPANCIES FOUND</div>
            {r.discrepancies.map((d, i) => (
              <div key={i} style={{ padding:'8px 10px', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:5, marginBottom:6 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontSize:11, color:'#e8eaed', fontFamily:'monospace' }}>{d.invoice_ref} — {d.carrier}</span>
                  <span style={{ fontSize:11, color:'#00e5b0', fontFamily:'monospace', fontWeight:700 }}>+£{(d.delta || 0).toLocaleString()}</span>
                </div>
                <div style={{ fontSize:10, color:'#8a9099' }}>{d.issue_type?.replace(/_/g,' ').toUpperCase()} · {d.evidence}</div>
              </div>
            ))}
          </div>
        )}

        {/* Who to contact */}
        {r.sections?.who_to_contact && (
          <div style={{ padding:'12px 14px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize:9, fontFamily:'monospace', color:'#4a5260', letterSpacing:'0.08em', marginBottom:6 }}>WHO TO CONTACT</div>
            <div style={{ fontSize:12, color:'#8a9099', lineHeight:1.7 }}>{r.sections.who_to_contact}</div>
          </div>
        )}

        {/* Downstream risks */}
        {r.sections?.downstream_risks && (
          <div style={{ padding:'12px 14px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize:9, fontFamily:'monospace', color:'#f59e0b', letterSpacing:'0.08em', marginBottom:6 }}>DOWNSTREAM RISKS</div>
            <div style={{ fontSize:12, color:'#8a9099', lineHeight:1.7 }}>{r.sections.downstream_risks}</div>
          </div>
        )}

        {/* Prevention */}
        {r.sections?.prevention && (
          <div style={{ padding:'12px 14px' }}>
            <div style={{ fontSize:9, fontFamily:'monospace', color:'#4a5260', letterSpacing:'0.08em', marginBottom:6 }}>PREVENTION</div>
            <div style={{ fontSize:12, color:'#8a9099', lineHeight:1.7 }}>{r.sections.prevention}</div>
          </div>
        )}

        {/* Fallback for modules with different structure */}
        {!r.sections && !r.discrepancies && r.time_to_resolution === 'N/A – No disruption detected' && (
          <div style={{ padding:'16px 14px', textAlign:'center' }}>
            <div style={{ fontFamily:'monospace', fontSize:11, color:'#00e5b0', marginBottom:6 }}>✓ ALL CLEAR</div>
            <div style={{ fontSize:12, color:'#4a5260' }}>No issues detected at this time. Module will continue monitoring.</div>
          </div>
        )}

      </div>
    </div>
  )
}

// ── MAIN DASHBOARD ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [unlocked, setUnlocked] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState('')
  const [activeShipment, setActiveShipment] = useState(null)
  const [activeTab, setActiveTab] = useState('agent')
  const [pendingApprovals, setPendingApprovals] = useState([])
  const [moduleRunning, setModuleRunning] = useState(null)
  const [moduleResult, setModuleResult] = useState(null)
  const [activeModuleName, setActiveModuleName] = useState(null)
  const [approvingId, setApprovingId] = useState(null)
  const responseRef = useRef(null)

  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />

  useEffect(() => {
    if (responseRef.current) responseRef.current.scrollTop = responseRef.current.scrollHeight
  }, [response])

  useEffect(() => {
    loadApprovals()
    const i = setInterval(loadApprovals, 30000)
    return () => clearInterval(i)
  }, [])

  async function loadApprovals() {
    try {
      const res = await fetch('/api/approvals?status=pending')
      if (!res.ok) return
      const data = await res.json()
      setPendingApprovals(data.approvals || [])
    } catch {}
  }

  const runAnalysis = async (text) => {
    if (!text.trim() || loading) return
    const userMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setResponse('')
    setActiveTab('agent')
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages })
      })
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.text) { full += data.text; setResponse(full) }
            } catch {}
          }
        }
      }
      setMessages([...newMessages, { role: 'assistant', content: full }])
    } catch { setResponse('Connection error. Check your API key.') }
    finally { setLoading(false) }
  }

  const analyseShipment = (s) => {
    setActiveShipment(s.ref)
    runAnalysis(`DISRUPTION ALERT — ${s.ref}\nRoute: ${s.route}\nCarrier: ${s.carrier}\nStatus: ${s.status.toUpperCase()}\nAlert: ${s.alert || 'Manual analysis requested'}\nETA: ${s.eta}\n\nProvide immediate disruption analysis and action plan.`)
  }

  async function runModule(moduleId) {
    setModuleRunning(moduleId)
    setModuleResult(null)
    setActiveModuleName(MODULES.find(m => m.id === moduleId)?.label || moduleId)
    setActiveTab('modules')
    try {
      const res = await fetch('/api/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: moduleId, data: { trigger: 'manual', timestamp: new Date().toISOString() } })
      })
      const data = await res.json()
      setModuleResult(data)
      if (data.actions_queued > 0) loadApprovals()
    } catch (e) {
      setModuleResult({ error: e.message })
    } finally {
      setModuleRunning(null)
    }
  }

  async function handleApproval(approvalId, action) {
    setApprovingId(approvalId)
    try {
      await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_id: approvalId, action, approved_by: 'ops_manager' })
      })
      await loadApprovals()
    } catch {}
    finally { setApprovingId(null) }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', fontFamily:'IBM Plex Sans, sans-serif', background:'#0a0c0e', color:'#e8eaed' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* NAV */}
      <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 24px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(10,12,14,0.98)', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <Link href="/" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none' }}>
            <div style={{ width:24, height:24, background:'#00e5b0', borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#000', fontFamily:'monospace' }}>DH</div>
            <span style={{ fontFamily:'monospace', fontSize:12, color:'#8a9099' }}>DisruptionHub</span>
          </Link>
          <span style={{ color:'rgba(255,255,255,0.1)' }}>|</span>
          <span style={{ fontSize:12, color:'#e8eaed', fontWeight:500 }}>Operations Dashboard</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          {pendingApprovals.length > 0 && (
            <button onClick={() => setActiveTab('approvals')} style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:6, padding:'5px 10px', cursor:'pointer' }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'#ef4444', animation:'pulse 2s infinite' }} />
              <span style={{ fontSize:11, color:'#ef4444', fontFamily:'monospace' }}>{pendingApprovals.length} AWAITING APPROVAL</span>
            </button>
          )}
          <span style={{ fontSize:11, color:'#4a5260' }}>Acme Logistics Ltd</span>
        </div>
      </nav>

      <div style={{ display:'grid', gridTemplateColumns:'290px 1fr', flex:1, minHeight:0 }}>

        {/* ── LEFT SIDEBAR ──────────────────────────────────────────────────── */}
        <div style={{ borderRight:'1px solid rgba(255,255,255,0.06)', background:'#0d1014', overflowY:'auto', display:'flex', flexDirection:'column' }}>

          {/* Metrics */}
          <div style={{ padding:'14px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize:9, fontFamily:'monospace', color:'#4a5260', letterSpacing:'0.08em', marginBottom:8 }}>TODAY — {new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}).toUpperCase()}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {[{l:'Active shipments',v:'4'},{l:'Alerts',v:'1',vc:'#ef4444'},{l:'On time',v:'75%'},{l:'Saved today',v:'£7.4K',vc:'#00e5b0'}].map(m=>(
                <div key={m.l} style={{ background:'#111418', borderRadius:6, padding:'10px 10px' }}>
                  <div style={{ fontSize:9, color:'#4a5260', marginBottom:3 }}>{m.l}</div>
                  <div style={{ fontSize:18, fontWeight:500, fontFamily:'monospace', color:m.vc||'#e8eaed' }}>{m.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Shipments */}
          <div style={{ padding:'14px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize:9, fontFamily:'monospace', color:'#4a5260', letterSpacing:'0.08em', marginBottom:8 }}>ACTIVE SHIPMENTS</div>
            {ACTIVE_SHIPMENTS.map(s => (
              <div key={s.ref} onClick={() => analyseShipment(s)} style={{ padding:'9px 10px', borderRadius:6, marginBottom:5, cursor:'pointer', border:activeShipment===s.ref?'1px solid #00e5b0':'1px solid rgba(255,255,255,0.05)', background:s.status==='disrupted'?'rgba(239,68,68,0.07)':s.status==='delayed'?'rgba(245,158,11,0.05)':'#111418', transition:'all 0.15s' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                  <span style={{ fontFamily:'monospace', fontSize:11, color:'#e8eaed', fontWeight:500 }}>{s.ref}</span>
                  <span style={{ fontFamily:'monospace', fontSize:9, color:STATUS_COLORS[s.status], textTransform:'uppercase' }}>{s.status}</span>
                </div>
                <div style={{ fontSize:10, color:'#8a9099', marginBottom:2 }}>{s.route}</div>
                <div style={{ fontSize:9, color:'#4a5260' }}>{s.carrier} · ETA {s.eta}</div>
                {s.alert && <div style={{ marginTop:5, fontSize:9, color:'#f59e0b', background:'rgba(245,158,11,0.08)', padding:'3px 6px', borderRadius:3 }}>⚠ {s.alert}</div>}
              </div>
            ))}
          </div>

          {/* Recent Incidents */}
          <div style={{ padding:'14px' }}>
            <div style={{ fontSize:9, fontFamily:'monospace', color:'#4a5260', letterSpacing:'0.08em', marginBottom:8 }}>RECENT INCIDENTS</div>
            {INCIDENT_LOG.map((inc,i) => (
              <div key={i} style={{ padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.03)', display:'grid', gridTemplateColumns:'1fr auto' }}>
                <div>
                  <div style={{ fontSize:10, color:'#e8eaed', fontFamily:'monospace' }}>{inc.ref} — {inc.type}</div>
                  <div style={{ fontSize:9, color:'#4a5260', marginTop:1 }}>{inc.date}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:9, color:SEV_COLORS[inc.severity], fontFamily:'monospace', padding:'1px 5px', borderRadius:2, background:SEV_BG[inc.severity], display:'inline-block' }}>{inc.severity}</div>
                  <div style={{ fontSize:9, color:'#00e5b0', marginTop:3 }}>saved {inc.saved}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT PANEL ───────────────────────────────────────────────────── */}
        <div style={{ display:'flex', flexDirection:'column', background:'#0a0c0e', overflow:'hidden' }}>

          {/* Tab bar */}
          <div style={{ padding:'10px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:8 }}>
            <button style={TAB_STYLE(activeTab==='agent')} onClick={() => setActiveTab('agent')}>AGENT</button>
            <button style={TAB_STYLE(activeTab==='modules')} onClick={() => setActiveTab('modules')}>MODULES</button>
            <button style={{ ...TAB_STYLE(activeTab==='approvals'), ...(pendingApprovals.length>0?{borderColor:'rgba(239,68,68,0.4)',color:'#ef4444',background:'rgba(239,68,68,0.08)'}:{}) }} onClick={() => setActiveTab('approvals')}>
              APPROVALS {pendingApprovals.length > 0 ? `(${pendingApprovals.length})` : ''}
            </button>
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background: loading ? '#f59e0b' : '#00e5b0', animation: loading ? 'pulse 1s infinite' : 'none' }} />
              <span style={{ fontFamily:'monospace', fontSize:10, color:'#4a5260' }}>{loading ? 'ANALYSING...' : 'AGENT READY'}</span>
              {messages.length > 0 && (
                <button onClick={() => { setMessages([]); setResponse(''); setActiveShipment(null) }} style={{ fontSize:10, color:'#4a5260', background:'none', border:'1px solid rgba(255,255,255,0.06)', borderRadius:4, padding:'3px 8px', cursor:'pointer', fontFamily:'monospace', marginLeft:4 }}>CLEAR ×</button>
              )}
            </div>
          </div>

          {/* ── AGENT TAB ──────────────────────────────────────────────────── */}
          {activeTab === 'agent' && (
            <>
              <div style={{ flex:1, overflowY:'auto', padding:'20px' }} ref={responseRef}>
                {!response && !loading && (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:14, opacity:0.3 }}>
                    <div style={{ fontFamily:'monospace', fontSize:32, color:'#4a5260' }}>◈</div>
                    <div style={{ fontSize:12, color:'#4a5260', textAlign:'center', maxWidth:280, lineHeight:1.7 }}>Click a shipment alert to trigger analysis, or type a disruption below</div>
                  </div>
                )}
                {loading && !response && (
                  <div style={{ display:'flex', gap:5, padding:'4px 0' }}>
                    {[0,1,2].map(i => <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:'#00e5b0', animation:`pulse 1.2s ${i*0.2}s infinite` }} />)}
                  </div>
                )}
                {response && <AgentResponse text={response} />}
                {messages.length >= 2 && (
                  <div style={{ marginTop:12, fontSize:10, color:'#4a5260', fontFamily:'monospace' }}>
                    // Ask a follow-up — "draft the client email", "cheapest option that hits SLA", "what's our liability here"
                  </div>
                )}
              </div>
              <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'12px 20px', background:'#0d1014' }}>
                <div style={{ display:'flex', gap:8 }}>
                  <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if(e.key==='Enter') runAnalysis(input) }} placeholder="Type a disruption or follow-up question..."
                    style={{ flex:1, background:'#111418', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, padding:'10px 13px', color:'#e8eaed', fontFamily:'IBM Plex Sans', fontSize:12, outline:'none' }} />
                  <button onClick={() => runAnalysis(input)} disabled={!input.trim()||loading}
                    style={{ background:loading?'#111418':'#00e5b0', color:'#000', border:'none', padding:'10px 18px', borderRadius:6, fontWeight:600, fontSize:12, cursor:loading?'default':'pointer', whiteSpace:'nowrap' }}>
                    {loading ? '...' : 'Analyse →'}
                  </button>
                </div>
                <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
                  {['Draft client email','Cheapest reroute','What\'s our liability?','Reorder recommendations'].map(q => (
                    <button key={q} onClick={() => { setInput(q); runAnalysis(q) }}
                      style={{ fontSize:10, color:'#4a5260', background:'none', border:'1px solid rgba(255,255,255,0.06)', borderRadius:4, padding:'3px 8px', cursor:'pointer', fontFamily:'IBM Plex Sans' }}>{q}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── MODULES TAB ────────────────────────────────────────────────── */}
          {activeTab === 'modules' && (
            <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>
              <div style={{ fontSize:10, color:'#4a5260', fontFamily:'monospace', marginBottom:14 }}>// INTELLIGENCE MODULES — click any to run manually · they also scan automatically on schedule</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:8, marginBottom:20 }}>
                {MODULES.map(m => {
                  const c = CAT_COLORS[m.cat]
                  const isRunning = moduleRunning === m.id
                  return (
                    <button key={m.id} onClick={() => runModule(m.id)} disabled={!!moduleRunning}
                      style={{ textAlign:'left', padding:'12px 13px', borderRadius:7, border:`1px solid ${c.border}`, background:c.bg, cursor:moduleRunning?'default':'pointer', transition:'all 0.15s', opacity:moduleRunning&&moduleRunning!==m.id?0.4:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
                        <span style={{ fontSize:15 }}>{m.icon}</span>
                        <span style={{ fontSize:11, fontWeight:500, color:'#e8eaed', lineHeight:1.3 }}>{m.label}</span>
                      </div>
                      <div style={{ fontSize:9, color:c.text, fontFamily:'monospace', letterSpacing:'0.04em' }}>
                        {isRunning ? '● RUNNING...' : m.cat.toUpperCase()}
                      </div>
                    </button>
                  )
                })}
              </div>

              {moduleRunning && (
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px', background:'#111418', borderRadius:8, border:'1px solid rgba(0,229,176,0.15)' }}>
                  <div style={{ width:16, height:16, border:'2px solid #00e5b0', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', flexShrink:0 }} />
                  <span style={{ fontFamily:'monospace', fontSize:11, color:'#00e5b0' }}>Running {MODULES.find(m=>m.id===moduleRunning)?.label}...</span>
                </div>
              )}

              {moduleResult && !moduleRunning && (
                moduleResult.error
                  ? <div style={{ padding:'12px 14px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, fontFamily:'monospace', fontSize:11, color:'#ef4444' }}>Error: {moduleResult.error}</div>
                  : <ModuleResult result={moduleResult} moduleName={activeModuleName} />
              )}
            </div>
          )}

          {/* ── APPROVALS TAB ──────────────────────────────────────────────── */}
          {activeTab === 'approvals' && (
            <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>
              {pendingApprovals.length === 0 ? (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60%', gap:12, opacity:0.3 }}>
                  <div style={{ fontFamily:'monospace', fontSize:32, color:'#4a5260' }}>✓</div>
                  <div style={{ fontSize:12, color:'#4a5260' }}>No pending approvals</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize:10, color:'#4a5260', fontFamily:'monospace', marginBottom:14 }}>// {pendingApprovals.length} ACTION{pendingApprovals.length!==1?'S':''} AWAITING YOUR APPROVAL</div>
                  {pendingApprovals.map(a => {
                    const ac = {
                      send_sms:   { bg:'rgba(245,158,11,0.07)', border:'rgba(245,158,11,0.22)', ico:'💬' },
                      send_email: { bg:'rgba(0,229,176,0.05)',  border:'rgba(0,229,176,0.18)', ico:'✉' },
                      make_call:  { bg:'rgba(59,130,246,0.07)', border:'rgba(59,130,246,0.2)', ico:'📞' },
                      raise_po:   { bg:'rgba(168,85,247,0.06)', border:'rgba(168,85,247,0.2)', ico:'🛒' },
                    }[a.action_type] || { bg:'rgba(0,229,176,0.05)', border:'rgba(0,229,176,0.18)', ico:'✉' }
                    const isProcessing = approvingId === a.id
                    return (
                      <div key={a.id} style={{ border:`1px solid ${ac.border}`, borderRadius:8, background:ac.bg, marginBottom:10, overflow:'hidden' }}>
                        <div style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
                          <span style={{ fontSize:18 }}>{ac.ico}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:500, marginBottom:2 }}>{a.action_label}</div>
                            <div style={{ fontSize:10, color:'#8a9099', fontFamily:'monospace' }}>
                              {a.action_type?.replace(/_/g,' ').toUpperCase()}
                              {a.financial_value > 0 && <span style={{ marginLeft:10, color:'#00e5b0' }}>£{Number(a.financial_value).toLocaleString()} value</span>}
                            </div>
                          </div>
                          <div style={{ display:'flex', gap:6 }}>
                            <button onClick={() => handleApproval(a.id,'approve')} disabled={isProcessing}
                              style={{ padding:'7px 14px', borderRadius:5, border:'none', background:'#00e5b0', color:'#000', fontWeight:600, fontSize:11, cursor:isProcessing?'default':'pointer', fontFamily:'monospace' }}>
                              {isProcessing?'...':'✓ APPROVE'}
                            </button>
                            <button onClick={() => handleApproval(a.id,'reject')} disabled={isProcessing}
                              style={{ padding:'7px 12px', borderRadius:5, fontSize:11, cursor:isProcessing?'default':'pointer', border:'1px solid rgba(239,68,68,0.3)', background:'transparent', color:'#ef4444', fontFamily:'monospace' }}>✕</button>
                          </div>
                        </div>
                        {a.action_details?.content && (
                          <div style={{ padding:'9px 14px', borderTop:'1px solid rgba(255,255,255,0.04)', fontFamily:'monospace', fontSize:10, color:'#8a9099', lineHeight:1.6, maxHeight:80, overflow:'hidden' }}>
                            {a.action_details.content}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
