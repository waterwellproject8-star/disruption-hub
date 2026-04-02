'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'

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

const MODULES = [
  { id: 'disruption',       label: 'Disruption Analysis', icon: '⚡', cat: 'ops' },
  { id: 'sla_prediction',   label: 'SLA Breach Prediction', icon: '🔮', cat: 'ops' },
  { id: 'invoice',          label: 'Invoice Recovery', icon: '🧾', cat: 'save' },
  { id: 'driver_hours',     label: 'Driver Hours Monitor', icon: '⏱', cat: 'compliance' },
  { id: 'hazmat',           label: 'Hazmat Checker', icon: '⚠️', cat: 'compliance' },
  { id: 'carrier',          label: 'Carrier Scorecard', icon: '📊', cat: 'ops' },
  { id: 'fuel',             label: 'Fuel Optimisation', icon: '⛽', cat: 'save' },
  { id: 'vehicle_health',   label: 'Vehicle Health', icon: '🔧', cat: 'ops' },
  { id: 'driver_retention', label: 'Driver Retention', icon: '👤', cat: 'ops' },
  { id: 'carbon',           label: 'Carbon & ESG', icon: '🌱', cat: 'growth' },
  { id: 'tender',           label: 'Tender Intelligence', icon: '🏆', cat: 'growth' },
  { id: 'regulation',       label: 'Regulation Monitor', icon: '📜', cat: 'compliance' },
  { id: 'consolidation',    label: 'Load Consolidation', icon: '📦', cat: 'save' },
  { id: 'forecast',         label: 'Demand Forecast', icon: '📈', cat: 'ops' },
  { id: 'benchmarking',     label: 'Rate Benchmarking', icon: '💹', cat: 'growth' },
  { id: 'insurance',        label: 'Claims Intelligence', icon: '🛡', cat: 'compliance' },
]

const CAT_COLORS = {
  ops:        { bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.25)',  text: '#3b82f6' },
  save:       { bg: 'rgba(0,229,176,0.1)',   border: 'rgba(0,229,176,0.25)',   text: '#00e5b0' },
  compliance: { bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)', text: '#f59e0b' },
  growth:     { bg: 'rgba(168,85,247,0.1)',  border: 'rgba(168,85,247,0.25)', text: '#a855f7' },
}

const TAB_STYLE = (active) => ({
  padding: '6px 14px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
  fontFamily: 'monospace', letterSpacing: '0.04em',
  border: active ? '1px solid #00e5b0' : '1px solid rgba(255,255,255,0.08)',
  background: active ? 'rgba(0,229,176,0.1)' : 'transparent',
  color: active ? '#00e5b0' : '#8a9099', transition: 'all 0.15s'
})

export default function DashboardPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState('')
  const [activeShipment, setActiveShipment] = useState(null)
  const [activeTab, setActiveTab] = useState('agent') // agent | modules | approvals
  const [pendingApprovals, setPendingApprovals] = useState([])
  const [moduleRunning, setModuleRunning] = useState(null)
  const [moduleResult, setModuleResult] = useState(null)
  const [approvingId, setApprovingId] = useState(null)
  const responseRef = useRef(null)

  useEffect(() => {
    if (responseRef.current) responseRef.current.scrollTop = responseRef.current.scrollHeight
  }, [response])

  // Poll for pending approvals every 30s
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

  // ── AGENT ANALYSIS ──────────────────────────────────────────────────────────
  const runAnalysis = async (text) => {
    if (!text.trim() || loading) return
    const userMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setResponse('')
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
        for (const line of decoder.decode(value).split('\n')) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try { const d = JSON.parse(line.slice(6)); if (d.text) { full += d.text; setResponse(full) } } catch {}
          }
        }
      }
      setMessages([...newMessages, { role: 'assistant', content: full }])
    } catch { setResponse('Connection error — check ANTHROPIC_API_KEY.') }
    finally { setLoading(false) }
  }

  const analyseShipment = (s) => {
    setActiveShipment(s.ref)
    setActiveTab('agent')
    runAnalysis(`DISRUPTION ALERT — ${s.ref}\nRoute: ${s.route}\nCarrier: ${s.carrier}\nStatus: ${s.status.toUpperCase()}\nAlert: ${s.alert || 'Manual analysis requested'}\nETA: ${s.eta}\n\nProvide immediate disruption analysis.`)
  }

  // ── RUN A MODULE ────────────────────────────────────────────────────────────
  async function runModule(moduleId) {
    setModuleRunning(moduleId)
    setModuleResult(null)
    setActiveTab('modules')
    try {
      const res = await fetch('/api/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: moduleId, data: { trigger: 'manual', timestamp: new Date().toISOString() } })
      })
      const data = await res.json()
      setModuleResult({ module: moduleId, ...data })
      if (data.actions_queued > 0) loadApprovals()
    } catch (e) {
      setModuleResult({ module: moduleId, error: e.message })
    } finally {
      setModuleRunning(null)
    }
  }

  // ── APPROVE / REJECT ────────────────────────────────────────────────────────
  async function handleApproval(approvalId, action) {
    setApprovingId(approvalId)
    try {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_id: approvalId, action, approved_by: 'ops_manager' })
      })
      await res.json()
      await loadApprovals()
    } catch {}
    finally { setApprovingId(null) }
  }

  const formatResponse = (text) => text
    .replace(/## (.*)/g, '<div style="color:#00e5b0;font-family:monospace;font-size:11px;letter-spacing:0.08em;margin:16px 0 6px;text-transform:uppercase;border-top:1px solid rgba(255,255,255,0.06);padding-top:12px">$1</div>')
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#e8eaed">$1</strong>')
    .replace(/- (CRITICAL.*)/g, '<div style="color:#ef4444;margin:2px 0">— $1</div>')
    .replace(/- (HIGH.*)/g, '<div style="color:#f59e0b;margin:2px 0">— $1</div>')
    .replace(/- (.*)/g, '<div style="color:#8a9099;margin:2px 0">— $1</div>')
    .replace(/\n/g, '<br>')

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', fontFamily:'IBM Plex Sans, sans-serif', background:'#0a0c0e', color:'#e8eaed' }}>

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
          <Link href="/admin/approvals" style={{ fontSize:11, color:'#4a5260', fontFamily:'monospace', textDecoration:'none' }}>Full queue →</Link>
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      </nav>

      <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', flex:1, minHeight:0 }}>

        {/* LEFT SIDEBAR */}
        <div style={{ borderRight:'1px solid rgba(255,255,255,0.06)', background:'#0d1014', overflowY:'auto', display:'flex', flexDirection:'column' }}>

          {/* Metrics */}
          <div style={{ padding:'14px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize:10, fontFamily:'monospace', color:'#4a5260', letterSpacing:'0.08em', marginBottom:8 }}>TODAY — {new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}).toUpperCase()}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {[{l:'Active shipments',v:'4'},{l:'Alerts',v:'1',vc:'#ef4444'},{l:'On time',v:'75%'},{l:'Saved today',v:'£7.4K',vc:'#00e5b0'}].map(m=>(
                <div key={m.l} style={{ background:'#111418', borderRadius:5, padding:'9px 10px' }}>
                  <div style={{ fontSize:9, color:'#4a5260', marginBottom:3 }}>{m.l}</div>
                  <div style={{ fontSize:16, fontWeight:500, fontFamily:'monospace', color:m.vc||'#e8eaed' }}>{m.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Shipments */}
          <div style={{ padding:'14px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize:10, fontFamily:'monospace', color:'#4a5260', letterSpacing:'0.08em', marginBottom:8 }}>ACTIVE SHIPMENTS</div>
            {ACTIVE_SHIPMENTS.map(s => (
              <div key={s.ref} onClick={() => analyseShipment(s)} style={{ padding:'9px 10px', borderRadius:5, marginBottom:5, cursor:'pointer', border:activeShipment===s.ref?'1px solid #00e5b0':'1px solid rgba(255,255,255,0.05)', background:s.status==='disrupted'?'rgba(239,68,68,0.06)':s.status==='delayed'?'rgba(245,158,11,0.04)':'#111418', transition:'all 0.15s' }}>
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

          {/* Incident log */}
          <div style={{ padding:'14px' }}>
            <div style={{ fontSize:10, fontFamily:'monospace', color:'#4a5260', letterSpacing:'0.08em', marginBottom:8 }}>RECENT INCIDENTS</div>
            {INCIDENT_LOG.map((inc,i) => (
              <div key={i} style={{ padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,0.03)', display:'grid', gridTemplateColumns:'1fr auto' }}>
                <div>
                  <div style={{ fontSize:10, color:'#e8eaed', fontFamily:'monospace' }}>{inc.ref} — {inc.type}</div>
                  <div style={{ fontSize:9, color:'#4a5260', marginTop:1 }}>{inc.date}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:10, color:SEV_COLORS[inc.severity], fontFamily:'monospace' }}>{inc.severity}</div>
                  <div style={{ fontSize:9, color:'#00e5b0', marginTop:1 }}>saved {inc.saved}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{ display:'flex', flexDirection:'column', background:'#0a0c0e', overflow:'hidden' }}>

          {/* Tab bar */}
          <div style={{ padding:'10px 18px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:8 }}>
            <button style={TAB_STYLE(activeTab==='agent')} onClick={() => setActiveTab('agent')}>AGENT</button>
            <button style={TAB_STYLE(activeTab==='modules')} onClick={() => setActiveTab('modules')}>MODULES</button>
            <button style={{ ...TAB_STYLE(activeTab==='approvals'), ...(pendingApprovals.length>0 ? { borderColor:'rgba(239,68,68,0.4)', color:'#ef4444', background:'rgba(239,68,68,0.08)' } : {}) }} onClick={() => setActiveTab('approvals')}>
              APPROVALS {pendingApprovals.length > 0 ? `(${pendingApprovals.length})` : ''}
            </button>
            {messages.length > 0 && (
              <button onClick={() => { setMessages([]); setResponse(''); setActiveShipment(null) }} style={{ marginLeft:'auto', fontSize:10, color:'#4a5260', background:'none', border:'none', cursor:'pointer', fontFamily:'monospace' }}>CLEAR ×</button>
            )}
          </div>

          {/* ── AGENT TAB ─────────────────────────────────────────────────── */}
          {activeTab === 'agent' && (
            <>
              <div style={{ flex:1, overflowY:'auto', padding:'18px' }} ref={responseRef}>
                {!response && !loading && (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:14, opacity:0.35 }}>
                    <div style={{ fontFamily:'monospace', fontSize:28, color:'#4a5260' }}>◈</div>
                    <div style={{ fontSize:12, color:'#4a5260', textAlign:'center', maxWidth:280, lineHeight:1.6 }}>Click a shipment alert to trigger analysis, or type a disruption below</div>
                  </div>
                )}
                {loading && !response && (
                  <div style={{ display:'flex', gap:5 }}>
                    {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'#00e5b0', animation:`pulse 1.2s ${i*0.2}s infinite` }} />)}
                  </div>
                )}
                {response && <div style={{ color:'#8a9099', fontSize:12, lineHeight:1.8 }} dangerouslySetInnerHTML={{ __html: formatResponse(response) }} />}
              </div>
              <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'10px 18px', background:'#0d1014' }}>
                <div style={{ display:'flex', gap:8 }}>
                  <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if(e.key==='Enter') runAnalysis(input) }} placeholder="Type a disruption or follow-up question..." style={{ flex:1, background:'#111418', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, padding:'9px 13px', color:'#e8eaed', fontFamily:'IBM Plex Sans', fontSize:12, outline:'none' }} />
                  <button onClick={() => runAnalysis(input)} disabled={!input.trim()||loading} style={{ background:loading?'#111418':'#00e5b0', color:'#000', border:'none', padding:'9px 16px', borderRadius:6, fontWeight:600, fontSize:12, cursor:loading?'default':'pointer', whiteSpace:'nowrap' }}>
                    {loading ? '...' : 'Analyse →'}
                  </button>
                </div>
                <div style={{ marginTop:6, display:'flex', gap:6, flexWrap:'wrap' }}>
                  {['Draft client email','Cheapest reroute','What\'s our liability?'].map(q => (
                    <button key={q} onClick={() => { setInput(q); runAnalysis(q) }} style={{ fontSize:10, color:'#4a5260', background:'none', border:'1px solid rgba(255,255,255,0.06)', borderRadius:4, padding:'3px 7px', cursor:'pointer' }}>{q}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── MODULES TAB ───────────────────────────────────────────────── */}
          {activeTab === 'modules' && (
            <div style={{ flex:1, overflowY:'auto', padding:'18px' }}>
              <div style={{ fontSize:11, color:'#4a5260', fontFamily:'monospace', marginBottom:14 }}>// INTELLIGENCE MODULES — click any to run manually or they scan automatically on schedule</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:8, marginBottom:20 }}>
                {MODULES.map(m => {
                  const c = CAT_COLORS[m.cat]
                  const isRunning = moduleRunning === m.id
                  return (
                    <button key={m.id} onClick={() => runModule(m.id)} disabled={!!moduleRunning} style={{ textAlign:'left', padding:'11px 13px', borderRadius:7, border:`1px solid ${c.border}`, background:c.bg, cursor:moduleRunning?'default':'pointer', transition:'all 0.15s', opacity:moduleRunning&&moduleRunning!==m.id?0.5:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
                        <span style={{ fontSize:14 }}>{m.icon}</span>
                        <span style={{ fontSize:11, fontWeight:500, color:'#e8eaed' }}>{m.label}</span>
                      </div>
                      <div style={{ fontSize:10, color:c.text, fontFamily:'monospace' }}>
                        {isRunning ? '● RUNNING...' : m.cat.toUpperCase()}
                      </div>
                    </button>
                  )
                })}
              </div>

              {moduleResult && (
                <div style={{ border:`1px solid rgba(0,229,176,0.2)`, borderRadius:8, overflow:'hidden' }}>
                  <div style={{ padding:'10px 14px', background:'rgba(0,229,176,0.06)', borderBottom:'1px solid rgba(0,229,176,0.15)', fontFamily:'monospace', fontSize:11, color:'#00e5b0' }}>
                    MODULE RESULT — {moduleResult.module?.toUpperCase()} {moduleResult.actions_queued > 0 && `· ${moduleResult.actions_queued} actions queued for approval`}
                  </div>
                  <div style={{ padding:'14px', fontFamily:'monospace', fontSize:10, color:'#8a9099', lineHeight:1.7, maxHeight:300, overflowY:'auto' }}>
                    {moduleResult.error
                      ? <span style={{ color:'#ef4444' }}>Error: {moduleResult.error}</span>
                      : <pre style={{ whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{JSON.stringify(moduleResult.result, null, 2).substring(0, 2000)}</pre>
                    }
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── APPROVALS TAB ─────────────────────────────────────────────── */}
          {activeTab === 'approvals' && (
            <div style={{ flex:1, overflowY:'auto', padding:'18px' }}>
              {pendingApprovals.length === 0 ? (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60%', gap:12, opacity:0.35 }}>
                  <div style={{ fontFamily:'monospace', fontSize:28, color:'#4a5260' }}>✓</div>
                  <div style={{ fontSize:12, color:'#4a5260' }}>No pending approvals</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize:11, color:'#4a5260', fontFamily:'monospace', marginBottom:14 }}>// {pendingApprovals.length} ACTION{pendingApprovals.length!==1?'S':''} AWAITING YOUR APPROVAL</div>
                  {pendingApprovals.map(a => {
                    const actionColors = {
                      send_sms:    { bg:'rgba(245,158,11,0.07)', border:'rgba(245,158,11,0.22)', ico:'💬' },
                      send_email:  { bg:'rgba(0,229,176,0.05)',  border:'rgba(0,229,176,0.18)', ico:'✉' },
                      make_call:   { bg:'rgba(59,130,246,0.07)', border:'rgba(59,130,246,0.2)', ico:'📞' },
                      raise_po:    { bg:'rgba(168,85,247,0.06)', border:'rgba(168,85,247,0.2)', ico:'🛒' },
                      cancel_po:   { bg:'rgba(239,68,68,0.07)',  border:'rgba(239,68,68,0.2)', ico:'✕' },
                    }
                    const ac = actionColors[a.action_type] || actionColors.send_email
                    const isProcessing = approvingId === a.id

                    return (
                      <div key={a.id} style={{ border:`1px solid ${ac.border}`, borderRadius:8, background:ac.bg, marginBottom:10, overflow:'hidden' }}>
                        <div style={{ padding:'11px 14px', display:'flex', alignItems:'center', gap:10 }}>
                          <span style={{ fontSize:18 }}>{ac.ico}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:500, marginBottom:2 }}>{a.action_label}</div>
                            <div style={{ fontSize:10, color:'#8a9099', fontFamily:'monospace' }}>
                              {a.action_type.replace(/_/g,' ').toUpperCase()}
                              {a.financial_value > 0 && <span style={{ marginLeft:10, color:'#00e5b0' }}>£{Number(a.financial_value).toLocaleString()} value</span>}
                            </div>
                          </div>
                          <div style={{ display:'flex', gap:6 }}>
                            <button onClick={() => handleApproval(a.id,'approve')} disabled={isProcessing} style={{ padding:'6px 14px', borderRadius:5, border:'none', background:'#00e5b0', color:'#000', fontWeight:600, fontSize:11, cursor:isProcessing?'default':'pointer', fontFamily:'monospace' }}>
                              {isProcessing?'...':'✓ APPROVE'}
                            </button>
                            <button onClick={() => handleApproval(a.id,'reject')} disabled={isProcessing} style={{ padding:'6px 12px', borderRadius:5, fontSize:11, cursor:isProcessing?'default':'pointer', border:'1px solid rgba(239,68,68,0.3)', background:'transparent', color:'#ef4444', fontFamily:'monospace' }}>
                              ✕
                            </button>
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
