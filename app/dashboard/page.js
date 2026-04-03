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
    if (pin.toUpperCase() === DASHBOARD_PIN) {
      if (typeof window !== 'undefined') localStorage.setItem('dh_unlocked','true')
      onUnlock()
    }
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

// ── AGENT RESPONSE RENDERER — Option B (colour-coded cards) ──────────────────
function money(text) {
  return text.replace(/(£[\d,]+(?:[–-]£[\d,]+)?(?:K)?)/g,
    '<span style="color:#00e5b0;font-weight:600;font-family:monospace">$1</span>')
}
function bold(text) {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#e8eaed;font-weight:500">$1</strong>')
}
function fmt(text) { return money(bold(text)) }
function clean(line) {
  return line.replace(/<strong[^>]*>(.*?)<\/strong>/g,'$1')
             .replace(/<span[^>]*>(.*?)<\/span>/g,'$1')
             .replace(/<[^>]+>/g,'')
}

const SECTION_STYLES = {
  'DISRUPTION ASSESSMENT':   { bg:'rgba(59,130,246,0.05)',  border:'rgba(59,130,246,0.18)',  label:'#3b82f6' },
  'ASSESSMENT':              { bg:'rgba(59,130,246,0.05)',  border:'rgba(59,130,246,0.18)',  label:'#3b82f6' },
  'SITUATION':               { bg:'rgba(59,130,246,0.05)',  border:'rgba(59,130,246,0.18)',  label:'#3b82f6' },
  'IMMEDIATE ACTIONS':       { bg:'rgba(239,68,68,0.05)',   border:'rgba(239,68,68,0.18)',   label:'#ef4444' },
  'IMMEDIATE ACTIONS (DO THESE NOW)': { bg:'rgba(239,68,68,0.05)', border:'rgba(239,68,68,0.18)', label:'#ef4444' },
  'ACTION PLAN':             { bg:'rgba(239,68,68,0.05)',   border:'rgba(239,68,68,0.18)',   label:'#ef4444' },
  'WHO TO CONTACT':          { bg:'rgba(0,229,176,0.04)',   border:'rgba(0,229,176,0.15)',   label:'#00e5b0' },
  'CONTACTS':                { bg:'rgba(0,229,176,0.04)',   border:'rgba(0,229,176,0.15)',   label:'#00e5b0' },
  'REROUTING':               { bg:'rgba(168,85,247,0.05)', border:'rgba(168,85,247,0.15)', label:'#a855f7' },
  'REROUTING / REORDER RECOMMENDATIONS': { bg:'rgba(168,85,247,0.05)', border:'rgba(168,85,247,0.15)', label:'#a855f7' },
  'REROUTE OPTIONS':         { bg:'rgba(168,85,247,0.05)', border:'rgba(168,85,247,0.15)', label:'#a855f7' },
  'STOCK / INVENTORY IMPACT':{ bg:'rgba(245,158,11,0.05)', border:'rgba(245,158,11,0.15)', label:'#f59e0b' },
  'DOWNSTREAM RISKS':        { bg:'rgba(245,158,11,0.05)', border:'rgba(245,158,11,0.15)', label:'#f59e0b' },
  'RISKS':                   { bg:'rgba(245,158,11,0.05)', border:'rgba(245,158,11,0.15)', label:'#f59e0b' },
  'PREVENTION':              { bg:'rgba(255,255,255,0.02)', border:'rgba(255,255,255,0.08)', label:'#4a5260' },
  'PREVENTION FOR NEXT TIME':{ bg:'rgba(255,255,255,0.02)', border:'rgba(255,255,255,0.08)', label:'#4a5260' },
}

function getSectionStyle(title) {
  const upper = title.toUpperCase().trim()
  return SECTION_STYLES[upper] || { bg:'rgba(255,255,255,0.02)', border:'rgba(255,255,255,0.08)', label:'#8a9099' }
}

function AgentResponse({ text }) {
  const lines = text.split('\n')
  const sections = []
  let currentSection = null
  let currentLines = []
  let preamble = []
  let inPreamble = true

  // Parse into sections
  for (const rawLine of lines) {
    const line = clean(rawLine)
    const isHeader = line.startsWith('## ')
    if (isHeader) {
      inPreamble = false
      if (currentSection !== null) sections.push({ title: currentSection, lines: currentLines })
      currentSection = line.replace('## ', '')
      currentLines = []
    } else if (inPreamble) {
      preamble.push(line)
    } else {
      currentLines.push(line)
    }
  }
  if (currentSection !== null) sections.push({ title: currentSection, lines: currentLines })

  // Extract severity and financials from preamble
  let severity = null, financialLine = null
  for (const l of preamble) {
    const sevMatch = l.match(/\b(CRITICAL|HIGH|MEDIUM|LOW)\b/)
    if (sevMatch && !severity) severity = sevMatch[1]
    if (l.match(/£[\d,]+/) && (l.toLowerCase().includes('impact') || l.toLowerCase().includes('exposure') || l.toLowerCase().includes('financial'))) {
      financialLine = l
    }
  }

  const SEV_COLOR = { CRITICAL:'#ef4444', HIGH:'#f59e0b', MEDIUM:'#3b82f6', LOW:'#8a9099' }
  const SEV_BG = { CRITICAL:'rgba(239,68,68,0.1)', HIGH:'rgba(245,158,11,0.1)', MEDIUM:'rgba(59,130,246,0.1)', LOW:'rgba(138,144,153,0.1)' }

  function renderLines(lines, sectionTitle) {
    const items = []
    let k = 0
    for (const line of lines) {
      if (!line.trim()) { items.push(<div key={k++} style={{height:4}}/>); continue }
      if (line.match(/^---+$/)) { items.push(<div key={k++} style={{height:1,background:'rgba(255,255,255,0.06)',margin:'8px 0'}}/>); continue }

      // Blockquote callout
      if (line.startsWith('> ')) {
        items.push(
          <div key={k++} style={{margin:'8px 0',padding:'10px 14px',background:'rgba(239,68,68,0.06)',borderLeft:'3px solid #ef4444',borderRadius:'0 6px 6px 0'}}>
            <span style={{fontSize:12,color:'#e8eaed',lineHeight:1.6}} dangerouslySetInnerHTML={{__html:fmt(line.replace(/^> /,''))}}/>
          </div>
        )
        continue
      }

      // Numbered action
      const numMatch = line.match(/^(\d+)\.?\s+(.+)/)
      if (numMatch) {
        const [,num,content] = numMatch
        const urgent = content.includes('NOW') || content.includes('IMMEDIATELY') || content.includes('999')
        const titleUp = (sectionTitle || '').toUpperCase()
        const isContact = titleUp.includes('CONTACT') || titleUp.includes('WHO TO')
        const isReroute = titleUp.includes('REROUTE') || titleUp.includes('REROUTING') || titleUp.includes('OPTION')
        const isPrevention = titleUp.includes('PREVENTION')
        const dotBg = isContact ? '#00e5b0' : isReroute ? '#a855f7' : isPrevention ? '#4a5260' : urgent ? '#ef4444' : '#ef4444'
        const dotText = isContact ? '#000' : '#fff'
        // Contact items get a different card style — teal left border, no dark bg
        if (isContact) {
          items.push(
            <div key={k++} style={{margin:'6px 0',padding:'10px 14px',background:'rgba(0,229,176,0.04)',borderRadius:6,borderLeft:'3px solid rgba(0,229,176,0.3)'}}>
              <div style={{fontSize:11,fontWeight:600,color:'#00e5b0',marginBottom:4}}>Contact {num}</div>
              <div style={{fontSize:12,color:'#e8eaed',lineHeight:1.7}} dangerouslySetInnerHTML={{__html:fmt(content)}}/>
            </div>
          )
          continue
        }
        items.push(
          <div key={k++} style={{display:'flex',gap:10,margin:'5px 0',padding:'10px 12px',background:'rgba(0,0,0,0.2)',borderRadius:6,border:'1px solid rgba(255,255,255,0.06)'}}>
            <div style={{width:22,height:22,borderRadius:'50%',background:dotBg,color:dotText,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0,marginTop:1}}>{num}</div>
            <div style={{fontSize:12,color:'#e8eaed',lineHeight:1.7,flex:1}} dangerouslySetInnerHTML={{__html:fmt(content)}}/>
          </div>
        )
        continue
      }

      // Bullet
      if (line.startsWith('- ') || line.startsWith('— ')) {
        const content = line.replace(/^[-—]\s+/,'')
        items.push(
          <div key={k++} style={{display:'flex',gap:8,margin:'3px 0',paddingLeft:4}}>
            <span style={{color:'#00e5b0',fontSize:11,marginTop:2,flexShrink:0}}>—</span>
            <span style={{fontSize:12,color:'#8a9099',lineHeight:1.7}} dangerouslySetInnerHTML={{__html:fmt(content)}}/>
          </div>
        )
        continue
      }

      // Bold-only line (e.g. "**Call the driver back NOW**")
      if (line.match(/^\*\*.+\*\*$/)) {
        items.push(<div key={k++} style={{fontSize:13,color:'#e8eaed',fontWeight:500,margin:'6px 0'}} dangerouslySetInnerHTML={{__html:fmt(line)}}/>)
        continue
      }

      // Default body text
      items.push(<div key={k++} style={{fontSize:12,color:'#8a9099',lineHeight:1.8,margin:'2px 0'}} dangerouslySetInnerHTML={{__html:fmt(line)}}/>)
    }
    return items
  }

  return (
    <div style={{padding:'4px 0'}}>
      {/* Severity + financial header strip */}
      {(severity || financialLine) && (
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'#111418',borderRadius:8,marginBottom:14,flexWrap:'wrap',border:'1px solid rgba(255,255,255,0.06)'}}>
          {severity && (
            <span style={{background:SEV_BG[severity],color:SEV_COLOR[severity],fontSize:11,fontFamily:'monospace',fontWeight:700,padding:'3px 10px',borderRadius:4,border:`1px solid ${SEV_COLOR[severity]}30`,letterSpacing:'0.05em'}}>{severity}</span>
          )}
          {financialLine && (
            <span style={{fontSize:12,color:'#8a9099'}} dangerouslySetInnerHTML={{__html:fmt(financialLine)}}/>
          )}
        </div>
      )}

      {/* Preamble lines that aren't severity/financial */}
      {preamble.filter(l => l.trim() && !l.match(/\b(CRITICAL|HIGH|MEDIUM|LOW)\b/) && !l.match(/£[\d,]+/)).map((l,i) => (
        <div key={i} style={{fontSize:12,color:'#8a9099',lineHeight:1.8,marginBottom:4}} dangerouslySetInnerHTML={{__html:fmt(l)}}/>
      ))}

      {/* Colour-coded section cards */}
      {sections.map((section, i) => {
        const style = getSectionStyle(section.title)
        const hasContent = section.lines.some(l => l.trim())
        if (!hasContent) return null
        return (
          <div key={i} style={{background:style.bg,border:`1px solid ${style.border}`,borderRadius:8,padding:'12px 14px',marginBottom:10}}>
            <div style={{fontSize:11,fontFamily:'monospace',color:style.label,letterSpacing:'0.08em',fontWeight:600,marginBottom:8}}>{section.title.toUpperCase()}</div>
            {renderLines(section.lines, section.title)}
          </div>
        )
      })}
    </div>
  )
}

// ── MODULE RESULT RENDERER ─────────────────────────────────────────────────
function MetricBadge({ label, value, color = '#00e5b0', prefix = '' }) {
  return (
    <div style={{ padding:'6px 14px', borderRadius:6, background:`${color}10`, border:`1px solid ${color}25` }}>
      <div style={{ fontSize:9, color:'#4a5260', fontFamily:'monospace', marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:700, color, fontFamily:'monospace' }}>{prefix}{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
  )
}

function SectionBlock({ label, children, labelColor = '#4a5260' }) {
  return (
    <div style={{ padding:'12px 14px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ fontSize:9, fontFamily:'monospace', color:labelColor, letterSpacing:'0.08em', marginBottom:8 }}>{label}</div>
      {children}
    </div>
  )
}

function ActionCard({ text, index, urgent }) {
  return (
    <div style={{ display:'flex', gap:10, marginBottom:6, padding:'8px 10px', background:'#111418', borderRadius:5, border: urgent ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ width:18, height:18, borderRadius:'50%', background: urgent ? '#ef4444' : '#00e5b0', color:'#000', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, flexShrink:0, marginTop:1 }}>{index + 1}</div>
      <div style={{ fontSize:11, color:'#e8eaed', lineHeight:1.6 }}>{text}</div>
    </div>
  )
}

function ItemCard({ children, bg = 'rgba(255,255,255,0.03)', border = 'rgba(255,255,255,0.08)' }) {
  return (
    <div style={{ padding:'10px 12px', background:bg, border:`1px solid ${border}`, borderRadius:6, marginBottom:6 }}>
      {children}
    </div>
  )
}

function KV({ k, v, valueColor = '#e8eaed' }) {
  if (v === null || v === undefined || v === '') return null
  return (
    <div style={{ display:'flex', gap:6, marginBottom:3, flexWrap:'wrap' }}>
      <span style={{ fontSize:10, color:'#4a5260', fontFamily:'monospace', flexShrink:0 }}>{k.replace(/_/g,' ').toUpperCase()}:</span>
      <span style={{ fontSize:11, color:valueColor }}>{String(v)}</span>
    </div>
  )
}

function ModuleResult({ result, moduleName }) {
  if (!result) return null
  const r = result.result || result
  const SEV = { CRITICAL:'#ef4444', HIGH:'#f59e0b', MEDIUM:'#3b82f6', LOW:'#8a9099' }

  // Collect all top-level numeric financial fields for the metrics bar
  const financialKeys = ['financial_impact','total_overcharge','annual_projection','total_breach_cost',
    'renegotiation_saving','total_daily_saving','total_planning_saving','total_annual_opportunity',
    'total_breakdown_risk','total_preventive_cost','total_replacement_cost_at_risk',
    'total_penalty_risk','total_compliance_cost','dvsa_penalty_risk','total_saving',
    'saving','claim_value']
  const financialMetrics = financialKeys.filter(k => r[k] > 0)

  return (
    <div style={{ marginTop:16 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'rgba(0,229,176,0.06)', border:'1px solid rgba(0,229,176,0.15)', borderRadius:'8px 8px 0 0', fontFamily:'monospace', fontSize:11, color:'#00e5b0' }}>
        <span>MODULE RESULT — {moduleName?.toUpperCase()}</span>
        {result.demo_mode && <span style={{ color:'#4a5260' }}>DEMO DATA</span>}
        {result.actions_queued > 0 && <span style={{ color:'#f59e0b' }}>● {result.actions_queued} actions queued</span>}
      </div>

      <div style={{ border:'1px solid rgba(0,229,176,0.15)', borderTop:'none', borderRadius:'0 0 8px 8px', overflow:'hidden' }}>

        {/* Metrics bar */}
        {(r.severity || financialMetrics.length > 0 || r.all_clear === false) && (
          <div style={{ display:'flex', gap:8, padding:'12px 14px', background:'#0d1014', borderBottom:'1px solid rgba(255,255,255,0.06)', flexWrap:'wrap' }}>
            {r.severity && <MetricBadge label="SEVERITY" value={r.severity} color={SEV[r.severity] || '#8a9099'} />}
            {r.all_clear === false && <MetricBadge label="STATUS" value="ACTION REQUIRED" color="#ef4444" />}
            {r.all_clear === true && <MetricBadge label="STATUS" value="ALL CLEAR" color="#00e5b0" />}
            {financialMetrics.slice(0,3).map(k => (
              <MetricBadge key={k} label={k.replace(/_/g,' ').toUpperCase()} value={r[k]} color="#00e5b0" prefix="£" />
            ))}
            {(r.drivers_at_risk?.length > 0) && <MetricBadge label="DRIVERS AT RISK" value={r.drivers_at_risk.length} color="#f59e0b" />}
            {(r.vehicles_at_risk?.length > 0) && <MetricBadge label="VEHICLES AT RISK" value={r.vehicles_at_risk.length} color="#ef4444" />}
            {(r.at_risk_deliveries?.length > 0) && <MetricBadge label="DELIVERIES AT RISK" value={r.at_risk_deliveries.length} color="#f59e0b" />}
            {(r.at_risk_drivers?.length > 0) && <MetricBadge label="DRIVERS AT RISK" value={r.at_risk_drivers.length} color="#f59e0b" />}
            {(r.flags_found > 0) && <MetricBadge label="FLAGS FOUND" value={r.flags_found} color="#ef4444" />}
            {(r.compliance_failures?.length > 0) && <MetricBadge label="COMPLIANCE FAILURES" value={r.compliance_failures.length} color="#ef4444" />}
            {(r.discrepancies?.length > 0) && <MetricBadge label="OVERCHARGES FOUND" value={r.discrepancies.length} color="#ef4444" />}
            {(r.matching_tenders?.length > 0) && <MetricBadge label="MATCHING TENDERS" value={r.matching_tenders.length} color="#a855f7" />}
            {(r.opportunities?.length > 0) && <MetricBadge label="OPPORTUNITIES" value={r.opportunities.length} color="#00e5b0" />}
          </div>
        )}

        {/* ── DISRUPTION / SLA sections format ── */}
        {r.sections?.assessment && (
          <SectionBlock label="ASSESSMENT">
            <div style={{ fontSize:12, color:'#8a9099', lineHeight:1.7 }}>{r.sections.assessment}</div>
          </SectionBlock>
        )}
        {r.sections?.immediate_actions?.length > 0 && (
          <SectionBlock label="IMMEDIATE ACTIONS">
            {r.sections.immediate_actions.map((a,i) => <ActionCard key={i} text={a} index={i} urgent={a.includes('NOW')||a.includes('999')} />)}
          </SectionBlock>
        )}
        {r.sections?.who_to_contact && (
          <SectionBlock label="WHO TO CONTACT">
            <div style={{ fontSize:12, color:'#8a9099', lineHeight:1.7 }}>{r.sections.who_to_contact}</div>
          </SectionBlock>
        )}
        {r.sections?.downstream_risks && (
          <SectionBlock label="DOWNSTREAM RISKS" labelColor="#f59e0b">
            <div style={{ fontSize:12, color:'#8a9099', lineHeight:1.7 }}>{r.sections.downstream_risks}</div>
          </SectionBlock>
        )}
        {r.sections?.prevention && (
          <SectionBlock label="PREVENTION">
            <div style={{ fontSize:12, color:'#8a9099', lineHeight:1.7 }}>{r.sections.prevention}</div>
          </SectionBlock>
        )}

        {/* ── INVOICE discrepancies ── */}
        {r.discrepancies?.length > 0 && (
          <SectionBlock label="OVERCHARGES FOUND">
            {r.discrepancies.map((d,i) => (
              <ItemCard key={i} bg="rgba(239,68,68,0.06)" border="rgba(239,68,68,0.15)">
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:'#e8eaed', fontFamily:'monospace' }}>{d.invoice_ref} — {d.carrier}</span>
                  <span style={{ fontSize:12, color:'#00e5b0', fontFamily:'monospace', fontWeight:700 }}>+£{(d.delta||0).toLocaleString()}</span>
                </div>
                <div style={{ fontSize:10, color:'#8a9099' }}>{d.issue_type?.replace(/_/g,' ').toUpperCase()}</div>
                <div style={{ fontSize:11, color:'#8a9099', marginTop:3 }}>{d.evidence}</div>
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── CARRIERS ── */}
        {r.carriers?.length > 0 && (
          <SectionBlock label="CARRIER PERFORMANCE">
            {r.carriers.map((c,i) => (
              <ItemCard key={i} bg={c.below_threshold ? 'rgba(239,68,68,0.05)' : 'rgba(0,229,176,0.03)'} border={c.below_threshold ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.08)'}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, color:'#e8eaed', fontWeight:500 }}>{c.name}</span>
                  <span style={{ fontSize:11, color: c.recommendation==='terminate'?'#ef4444':c.recommendation==='renegotiate'?'#f59e0b':'#00e5b0', fontFamily:'monospace', fontWeight:700 }}>{c.recommendation?.toUpperCase()}</span>
                </div>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  <span style={{ fontSize:10, color: c.on_time_rate < c.contract_threshold_otr ? '#ef4444' : '#8a9099' }}>OTR: {c.on_time_rate}% (min {c.contract_threshold_otr}%)</span>
                  <span style={{ fontSize:10, color:'#8a9099' }}>Damage: {c.damage_rate}%</span>
                  {c.sla_breach_cost > 0 && <span style={{ fontSize:10, color:'#f59e0b' }}>Breach cost: £{c.sla_breach_cost?.toLocaleString()}</span>}
                </div>
                <div style={{ fontSize:10, color:'#4a5260', marginTop:4 }}>{c.evidence_summary}</div>
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── DRIVERS AT RISK (hours/retention) ── */}
        {(r.drivers_at_risk?.length > 0 || r.at_risk_drivers?.length > 0) && (
          <SectionBlock label="DRIVERS FLAGGED">
            {[...(r.drivers_at_risk||[]), ...(r.at_risk_drivers||[])].map((d,i) => (
              <ItemCard key={i} bg={d.breach_risk||d.risk_level==='HIGH' ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.04)'} border={d.breach_risk||d.risk_level==='HIGH' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, color:'#e8eaed', fontWeight:500 }}>{d.name} — {d.vehicle_reg || d.vehicle}</span>
                  {d.risk_level && <span style={{ fontSize:10, color: d.risk_level==='HIGH'?'#ef4444':'#f59e0b', fontFamily:'monospace', fontWeight:700 }}>{d.risk_level}</span>}
                </div>
                <div style={{ fontSize:11, color:'#f59e0b' }}>{d.specific_instruction || d.recommended_interventions?.[0]}</div>
                {d.signals?.map((s,si) => <div key={si} style={{ fontSize:10, color:'#4a5260', marginTop:2 }}>— {s}</div>)}
                {d.breach_risk && <div style={{ fontSize:10, color:'#ef4444', marginTop:3 }}>Hours worked: {d.hours_worked} / {d.wtd_limit} limit · {d.remaining_hours}h remaining</div>}
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── VEHICLES AT RISK ── */}
        {r.vehicles_at_risk?.length > 0 && (
          <SectionBlock label="VEHICLES FLAGGED">
            {r.vehicles_at_risk.map((v,i) => (
              <ItemCard key={i} bg="rgba(239,68,68,0.05)" border="rgba(239,68,68,0.15)">
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, color:'#e8eaed', fontWeight:500 }}>{v.reg}</span>
                  <span style={{ fontSize:11, color:'#ef4444', fontFamily:'monospace' }}>{v.failure_probability}% failure risk</span>
                </div>
                <div style={{ fontSize:11, color:'#f59e0b', marginBottom:3 }}>{v.preventive_fix}</div>
                <div style={{ fontSize:10, color:'#4a5260' }}>Breakdown cost if ignored: £{v.breakdown_cost?.toLocaleString()} · Preventive fix: £{v.preventive_cost?.toLocaleString()}</div>
                <div style={{ fontSize:10, color:'#8a9099', marginTop:2 }}>Optimal slot: {v.optimal_service_slot}</div>
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── SLA at-risk deliveries ── */}
        {r.at_risk_deliveries?.length > 0 && (
          <SectionBlock label="DELIVERIES AT RISK">
            {r.at_risk_deliveries.map((d,i) => (
              <ItemCard key={i} bg={d.breach_probability > 80 ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.04)'} border={d.breach_probability > 80 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, color:'#e8eaed', fontWeight:500 }}>{d.ref} — {d.client}</span>
                  <span style={{ fontSize:11, color: d.breach_probability > 80 ? '#ef4444' : '#f59e0b', fontFamily:'monospace' }}>{d.breach_probability}% breach risk</span>
                </div>
                <div style={{ fontSize:10, color:'#8a9099' }}>SLA closes: {d.sla_window_closes} · Current ETA: {d.current_eta} · Penalty: £{d.penalty_if_breached?.toLocaleString()}</div>
                {d.reroute_saves_sla && <div style={{ fontSize:11, color:'#00e5b0', marginTop:4 }}>✓ REROUTE AVAILABLE: {d.reroute_instruction}</div>}
                {!d.reroute_saves_sla && <div style={{ fontSize:11, color:'#ef4444', marginTop:4 }}>{d.reroute_instruction}</div>}
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── FUEL vehicles ── */}
        {r.vehicles_to_fill?.length > 0 && (
          <SectionBlock label={`FILL NOW — ${r.recommendation?.toUpperCase().replace(/_/g,' ')}`} labelColor={r.recommendation==='fill_now'?'#00e5b0':'#f59e0b'}>
            <div style={{ fontSize:12, color:'#8a9099', marginBottom:8, lineHeight:1.6 }}>{r.reasoning}</div>
            {r.vehicles_to_fill.map((v,i) => (
              <ItemCard key={i}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:11, color:'#e8eaed' }}>{v.reg} — {v.driver}</span>
                  <span style={{ fontSize:11, color:'#00e5b0', fontFamily:'monospace' }}>Save £{v.saving?.toFixed(2)}</span>
                </div>
                <div style={{ fontSize:10, color:'#8a9099', marginTop:2 }}>{v.current_level_pct}% fuel · {v.nearest_fuel_stop}</div>
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── COMPLIANCE failures / flags ── */}
        {r.compliance_failures?.length > 0 && (
          <SectionBlock label="COMPLIANCE FAILURES — DISPATCH BLOCKED" labelColor="#ef4444">
            {r.compliance_failures.map((f,i) => (
              <ItemCard key={i} bg="rgba(239,68,68,0.07)" border="rgba(239,68,68,0.2)">
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:'#e8eaed', fontFamily:'monospace' }}>{f.job_ref} — {f.assigned_driver}</span>
                  <span style={{ fontSize:10, color:'#ef4444', fontFamily:'monospace' }}>BLOCKED</span>
                </div>
                <div style={{ fontSize:11, color:'#f59e0b' }}>{f.failure_reason?.replace(/_/g,' ').toUpperCase()}</div>
                <div style={{ fontSize:11, color:'#8a9099', marginTop:3 }}>{f.resolution}</div>
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── LICENCE flags ── */}
        {r.flags?.length > 0 && (
          <SectionBlock label="LICENCE FLAGS">
            {r.flags.map((f,i) => (
              <ItemCard key={i} bg="rgba(239,68,68,0.05)" border="rgba(239,68,68,0.15)">
                <div style={{ fontSize:12, color:'#e8eaed', fontWeight:500, marginBottom:4 }}>{f.driver} — {f.vehicle}</div>
                <div style={{ fontSize:10, color:'#ef4444', fontFamily:'monospace', marginBottom:6 }}>{f.action_required}</div>
                {f.issues?.map((iss,ii) => (
                  <div key={ii} style={{ fontSize:11, color: iss.severity==='CRITICAL'?'#ef4444':'#f59e0b', marginBottom:2 }}>— {iss.detail}</div>
                ))}
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── REGULATION changes ── */}
        {r.relevant_changes?.length > 0 && (
          <SectionBlock label="REGULATORY CHANGES AFFECTING YOUR FLEET">
            {r.relevant_changes.map((c,i) => (
              <ItemCard key={i} bg={c.urgency==='IMMEDIATE'?'rgba(239,68,68,0.05)':'rgba(245,158,11,0.04)'} border={c.urgency==='IMMEDIATE'?'rgba(239,68,68,0.15)':'rgba(245,158,11,0.15)'}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:'#e8eaed', fontWeight:500 }}>{c.title}</span>
                  <span style={{ fontSize:10, color: c.urgency==='IMMEDIATE'?'#ef4444':'#f59e0b', fontFamily:'monospace' }}>{c.urgency?.replace(/_/g,' ')}</span>
                </div>
                <div style={{ fontSize:11, color:'#8a9099', marginBottom:4 }}>{c.impact_description}</div>
                <div style={{ fontSize:11, color:'#00e5b0' }}>Action: {c.compliance_action}</div>
                {c.penalty_if_ignored > 0 && <div style={{ fontSize:10, color:'#ef4444', marginTop:3 }}>Penalty if ignored: £{c.penalty_if_ignored?.toLocaleString()}</div>}
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── TENDERS ── */}
        {r.matching_tenders?.length > 0 && (
          <SectionBlock label="MATCHING TENDERS">
            {r.matching_tenders.map((t,i) => (
              <ItemCard key={i} bg="rgba(168,85,247,0.05)" border="rgba(168,85,247,0.15)">
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:'#e8eaed', fontWeight:500, flex:1, marginRight:8 }}>{t.title}</span>
                  <span style={{ fontSize:11, color:'#a855f7', fontFamily:'monospace', flexShrink:0 }}>{t.win_probability}% win</span>
                </div>
                <div style={{ fontSize:10, color:'#8a9099', marginBottom:3 }}>{t.buyer} · Value: £{t.value?.toLocaleString()} · Deadline: {t.deadline_days} days</div>
                <div style={{ fontSize:11, color:'#8a9099' }}>{t.briefing}</div>
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── CONSOLIDATION opportunities ── */}
        {r.opportunities?.length > 0 && (
          <SectionBlock label="CONSOLIDATION OPPORTUNITIES">
            {r.opportunities.map((o,i) => (
              <ItemCard key={i} bg={o.feasibility==='YES'?'rgba(0,229,176,0.04)':'rgba(245,158,11,0.04)'} border={o.feasibility==='YES'?'rgba(0,229,176,0.15)':'rgba(245,158,11,0.15)'}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:'#e8eaed', fontWeight:500 }}>{o.route_a} + {o.route_b}</span>
                  <span style={{ fontSize:11, color:'#00e5b0', fontFamily:'monospace' }}>Save £{o.total_saving?.toLocaleString()}</span>
                </div>
                <div style={{ fontSize:10, color:'#8a9099', marginBottom:3 }}>{o.feasibility} · {o.vehicles_saved} vehicle saved · {o.combined_utilisation_pct}% utilisation</div>
                <div style={{ fontSize:11, color:'#8a9099' }}>{o.new_schedule}</div>
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── LANE benchmarking ── */}
        {r.lane_analysis?.length > 0 && (
          <SectionBlock label="LANE RATE ANALYSIS">
            <div style={{ fontSize:12, color:'#8a9099', marginBottom:8 }}>{r.net_recommendation}</div>
            {r.lane_analysis.map((l,i) => (
              <ItemCard key={i} bg={l.status==='underpriced'?'rgba(239,68,68,0.04)':'rgba(0,229,176,0.03)'}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontSize:11, color:'#e8eaed', fontWeight:500 }}>{l.lane}</span>
                  <span style={{ fontSize:10, color: l.status==='underpriced'?'#ef4444':'#00e5b0', fontFamily:'monospace' }}>{l.status?.toUpperCase()}</span>
                </div>
                <div style={{ fontSize:10, color:'#8a9099' }}>Current: £{l.current_rate_per_mile}/mi · Market: £{l.market_rate_per_mile}/mi · Gap: £{l.annual_revenue_gap?.toLocaleString()}/yr</div>
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── FORECAST periods ── */}
        {r.forecast_periods?.length > 0 && (
          <SectionBlock label="DEMAND FORECAST">
            {r.forecast_periods.map((f,i) => (
              <ItemCard key={i} bg={f.capacity_gap > 0 ? 'rgba(239,68,68,0.05)' : 'rgba(0,229,176,0.03)'}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:'#e8eaed', fontWeight:500 }}>{f.week}</span>
                  <span style={{ fontSize:11, color: f.capacity_gap > 0 ? '#ef4444' : '#00e5b0', fontFamily:'monospace' }}>{f.capacity_gap > 0 ? `${f.capacity_gap} jobs over capacity` : 'Within capacity'}</span>
                </div>
                {f.preparation_actions?.map((a,ai) => <div key={ai} style={{ fontSize:10, color:'#8a9099', marginBottom:1 }}>— {a}</div>)}
                {f.saving_by_planning > 0 && <div style={{ fontSize:10, color:'#00e5b0', marginTop:3 }}>Plan now and save: £{f.saving_by_planning?.toLocaleString()}</div>}
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── CARBON report ── */}
        {r.annual_report?.narrative && (
          <SectionBlock label="ESG SUMMARY">
            <div style={{ fontSize:12, color:'#8a9099', lineHeight:1.7, marginBottom:8 }}>{r.annual_report.narrative}</div>
            <div style={{ fontSize:10, color:'#4a5260' }}>Methodology: {r.annual_report.methodology}</div>
          </SectionBlock>
        )}
        {r.optimisation_opportunities?.length > 0 && (
          <SectionBlock label="EMISSION REDUCTION OPPORTUNITIES">
            {r.optimisation_opportunities.map((o,i) => (
              <ItemCard key={i}>
                <div style={{ fontSize:11, color:'#e8eaed', marginBottom:3 }}>{o.description}</div>
                <div style={{ fontSize:10, color:'#00e5b0' }}>-{o.emission_reduction_pct}% emissions · Save £{o.cost_saving?.toLocaleString()}/yr</div>
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── INSURANCE claim ── */}
        {r.verdict && (
          <SectionBlock label={`VERDICT — ${r.liability_assessment?.replace(/_/g,' ')}`} labelColor={r.liability_assessment==='NO_LIABILITY'?'#00e5b0':'#ef4444'}>
            <div style={{ fontSize:12, color:'#e8eaed', lineHeight:1.7, marginBottom:8 }}>{r.verdict}</div>
            {r.response_letter && <div style={{ fontSize:11, color:'#8a9099', lineHeight:1.6, padding:'8px 10px', background:'#111418', borderRadius:5, border:'1px solid rgba(255,255,255,0.06)' }}>{r.response_letter}</div>}
          </SectionBlock>
        )}

        {/* ── Generic all-clear ── */}
        {!r.sections && !r.discrepancies && !r.carriers && !r.drivers_at_risk && !r.vehicles_at_risk
          && !r.at_risk_deliveries && !r.vehicles_to_fill && !r.compliance_failures && !r.flags
          && !r.relevant_changes && !r.matching_tenders && !r.opportunities && !r.lane_analysis
          && !r.forecast_periods && !r.verdict && !r.at_risk_drivers && (
          <div style={{ padding:'20px 14px', textAlign:'center' }}>
            <div style={{ fontFamily:'monospace', fontSize:11, color:'#00e5b0', marginBottom:6 }}>✓ ALL CLEAR</div>
            <div style={{ fontSize:12, color:'#4a5260' }}>No issues detected. Module continues monitoring.</div>
          </div>
        )}

      </div>
    </div>
  )
}

// ── SCENARIO RESULT RENDERER ──────────────────────────────────────────────────
function ScenarioResult({ result }) {
  if (!result) return null
  const skip = ['scenario','actions','cascade']
  const entries = Object.entries(result).filter(([k]) => !skip.includes(k))

  return (
    <div>
      {entries.map(([k, v]) => (
        <div key={k} style={{ marginBottom: 16 }}>
          <div style={{ fontFamily:'monospace', fontSize:10, color:'#00e5b0', letterSpacing:'0.08em', marginBottom:6, display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ height:1, width:12, background:'#00e5b0' }} />
            {k.replace(/_/g,' ').toUpperCase()}
          </div>
          {Array.isArray(v) ? (
            v.length === 0
              ? <div style={{ fontSize:12, color:'#4a5260' }}>None</div>
              : v.map((item, i) => (
                <div key={i} style={{ padding:'8px 10px', background:'#111418', borderRadius:5, border:'1px solid rgba(255,255,255,0.06)', marginBottom:6 }}>
                  {typeof item === 'object'
                    ? Object.entries(item).map(([ik,iv]) => (
                        <div key={ik} style={{ fontSize:11, color:'#8a9099', marginBottom:2 }}>
                          <span style={{ color:'#e8eaed', fontWeight:500 }}>{ik.replace(/_/g,' ')}: </span>
                          {typeof iv === 'boolean' ? (iv ? 'Yes' : 'No') : String(iv)}
                        </div>
                      ))
                    : <div style={{ fontSize:12, color:'#8a9099' }}>{String(item)}</div>
                  }
                </div>
              ))
          ) : typeof v === 'object' && v !== null ? (
            <div style={{ padding:'8px 10px', background:'#111418', borderRadius:5, border:'1px solid rgba(255,255,255,0.06)' }}>
              {Object.entries(v).map(([ik,iv]) => (
                <div key={ik} style={{ fontSize:11, color:'#8a9099', marginBottom:2 }}>
                  <span style={{ color:'#e8eaed', fontWeight:500 }}>{ik.replace(/_/g,' ')}: </span>
                  {String(iv)}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize:12, color:'#8a9099', lineHeight:1.7 }}>{String(v)}</div>
          )}
        </div>
      ))}
      {result.cascade && result.cascade.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontFamily:'monospace', fontSize:10, color:'#ef4444', letterSpacing:'0.08em', marginBottom:6 }}>CASCADE CHAIN</div>
          {result.cascade.map((c,i) => (
            <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom:4 }}>
              <div style={{ width:20, height:20, borderRadius:'50%', background: c.sla_breached?'#ef4444':'#00e5b0', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, flexShrink:0 }}>{i}</div>
              <div style={{ fontSize:11, color:'#8a9099', flex:1 }}>
                <span style={{ color:'#e8eaed' }}>{c.ref}</span> — {c.description}
                {c.penalty > 0 && <span style={{ color:'#00e5b0', marginLeft:8 }}>£{c.penalty.toLocaleString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── MAIN DASHBOARD ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [unlocked, setUnlocked] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dh_unlocked') === 'true'
    }
    return false
  })
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
  const [localApprovals, setLocalApprovals] = useState([])
  const [cancelAssessment, setCancelAssessment] = useState(null)
  const [scenarioResult, setScenarioResult] = useState(null)
  const [scenarioRunning, setScenarioRunning] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)
  const [agentActions, setAgentActions] = useState([])
  const [moduleActions, setModuleActions] = useState([])
  const [actionStates, setActionStates] = useState({})
  const [sessionIncidents, setSessionIncidents] = useState([])
  const [liveShipments, setLiveShipments] = useState([])

  async function assessCancelAction(approvalId, sentAt) {
    const now = Date.now()
    const sentTime = sentAt ? new Date(sentAt).getTime() : null
    const minutesSinceSent = sentTime ? Math.round((now - sentTime) / 60000) : 0

    let assessment
    if (!sentAt) {
      assessment = { type: 'clean_cancel', risk: 'NONE', message: 'Action not yet sent. Cancel removes it completely — no impact on driver.', approvalId }
    } else if (minutesSinceSent < 8) {
      assessment = { type: 'disregard_cancel', risk: 'LOW', message: `SMS sent ${minutesSinceSent} min ago. Driver may not have seen it. Cancel sends "DISREGARD — continue original route" immediately.`, approvalId, minutesSinceSent }
    } else {
      const estimatedMiles = Math.round(minutesSinceSent * 0.5)
      assessment = {
        type: 'partial_revert', risk: 'HIGH',
        message: `SMS sent ${minutesSinceSent} minutes ago. Driver is likely ~${estimatedMiles} miles into the diversion.`,
        approvalId, minutesSinceSent, estimatedMiles,
        options: [
          { id: 'continue_new_route', label: 'Continue on new route', description: `Driver is already ${estimatedMiles} miles in. Recalculate ETA and update customer. Recommended.`, recommended: estimatedMiles > 3 },
          { id: 'ask_driver_position', label: 'Ask driver for position first', description: 'Send SMS asking driver to confirm their current position before deciding.', recommended: estimatedMiles <= 3 }
        ]
      }
    }
    setCancelAssessment(assessment)
  }

  async function executeCancelAction(approvalId, cancelType) {
    setCancellingId(approvalId)
    try {
      await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_id: approvalId, action: 'reject', cancel_type: cancelType })
      })
      setCancelAssessment(null)
      await loadApprovals()
    } catch {}
    finally { setCancellingId(null) }
  }
  const responseRef = useRef(null)

  useEffect(() => {
    if (responseRef.current) responseRef.current.scrollTop = responseRef.current.scrollHeight
  }, [response])

  useEffect(() => {
    if (!unlocked) return
    loadApprovals()
    loadShipments()
    const i = setInterval(loadApprovals, 30000)
    return () => clearInterval(i)
  }, [unlocked])

  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />

  async function loadApprovals() {
    try {
      const res = await fetch('/api/approvals?client_id=pearson-haulage')
      if (!res.ok) return
      const data = await res.json()
      setPendingApprovals(data.approvals || [])
    } catch {}
  }

  async function loadShipments() {
    try {
      const res = await fetch('/api/shipments?client_id=pearson-haulage')
      if (!res.ok) return
      const data = await res.json()
      if (data.shipments?.length > 0) setLiveShipments(data.shipments)
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
      // Extract suggested actions from the response
      const extracted = extractActionsFromResponse(full)
      setAgentActions(extracted)
      setModuleActions([]) // clear module actions when agent runs
      setActionStates({})
      // Log to session incident history in sidebar
      const sevMatch = full.match(/\b(CRITICAL|HIGH|MEDIUM|LOW)\b/)
      const moneyMatch = full.match(/£([\d,]+)/)
      const sev = sevMatch ? sevMatch[1] : 'MEDIUM'
      const saved = moneyMatch ? '£' + moneyMatch[1] : null
      const ref = newMessages[newMessages.length-1]?.content?.match(/(?:REF|PH)-[\w]+/)?.[0] ||
                  newMessages[0]?.content?.match(/(?:REF|PH)-[\w]+/)?.[0] || 'MANUAL'
      const incidentType = newMessages[0]?.content?.split('\n')[0]?.slice(0,35) || 'Analysis'
      setSessionIncidents(prev => [{
        ref, type: incidentType, severity: sev,
        saved, date: 'Just now'
      }, ...prev].slice(0, 8))
      // Save to Supabase incidents table
      try {
        await fetch('/api/incidents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: 'pearson-haulage',
            user_input: newMessages[newMessages.length-1]?.content || '',
            ai_response: full,
            severity: sev,
            financial_impact: moneyMatch ? parseInt(moneyMatch[1].replace(/,/g,'')) : 0,
            ref
          })
        })
      } catch {}
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
      // Generate action buttons from module findings
      const extracted = extractActionsFromModuleResult(data.result, moduleId)
      setModuleActions(extracted)
      setAgentActions([]) // clear agent actions when running a module
      setActiveTab('modules')
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

  function extractActionsFromResponse(text) {
    const actions = []
    const lines = text.split('\n')

    // Match any numbered action line (1., 2., etc.)
    const actionPatterns = [
      { pattern: /999|emergency.service|ambulance|police/i, type: 'emergency', icon: '🚨', label: 'Call 999 — emergency services' },
      { pattern: /call.{0,60}(driver|carl|james|mark|paul|depot|carrier|ops|manager|controller|haulage|express|freight|yodel|dhl|xpo)/i, type: 'call', icon: '📞' },
      { pattern: /telematics|webfleet|samsara|gps.{0,20}(pull|check|confirm)/i, type: 'call', icon: '📍', label: 'Pull telematics — confirm vehicle position' },
      { pattern: /send.{0,40}(sms|text|message|whatsapp|instruction|alert)/i, type: 'sms', icon: '💬' },
      { pattern: /send|email|notify|notification/i, type: 'email', icon: '✉' },
      { pattern: /dispatch.{0,40}(relief|vehicle|driver|replace)/i, type: 'dispatch', icon: '🚛' },
      { pattern: /relief.{0,20}vehicle|relief.{0,20}driver|dispatch.{0,20}vehicle/i, type: 'dispatch', icon: '🚛' },
      { pattern: /reroute|re-route|divert|alternative.{0,20}route/i, type: 'reroute', icon: '🗺' },
      { pattern: /highways.england|0300|motorway/i, type: 'call', icon: '🛣' },
      { pattern: /contact|speak|inform|update|alert.{0,20}(tesco|nhs|dc|customer|client|consignee)/i, type: 'notify', icon: '📣' },
    ]

    for (const line of lines) {
      // Only process numbered action lines
      const numMatch = line.match(/^(\d+)\.?\s+(.{15,180})/)
      if (!numMatch) continue
      const clean = numMatch[2].replace(/\*\*/g,'').trim()

      for (const { pattern, type, icon, label: forcedLabel } of actionPatterns) {
        if (pattern.test(clean)) {
          const label = forcedLabel || clean.split('—')[0].split('·')[0].split('.')[0].trim().substring(0, 65)
          if (!actions.find(a => a.label === label)) {
            actions.push({ label, type, icon, full: clean })
          }
          break
        }
      }
    }

    // If no numbered matches found, try key phrase scan across all lines
    if (actions.length === 0) {
      for (const line of lines) {
        const clean = line.replace(/^[-—*\d.]+\s*/,'').replace(/\*\*/g,'').trim()
        if (clean.length < 15 || clean.length > 180) continue
        if (/call 999|call.{0,30}(driver|ops|carrier)|dispatch.{0,20}(vehicle|relief)|send.{0,20}(sms|message)/i.test(clean)) {
          const label = clean.split('—')[0].trim().substring(0,65)
          if (!actions.find(a => a.label === label)) {
            const type = /999/.test(clean) ? 'emergency' : /call/.test(clean) ? 'call' : /dispatch/.test(clean) ? 'dispatch' : 'sms'
            const icon = /999/.test(clean) ? '🚨' : /call/.test(clean) ? '📞' : /dispatch/.test(clean) ? '🚛' : '💬'
            actions.push({ label, type, icon, full: clean })
          }
        }
        if (actions.length >= 4) break
      }
    }

    return actions.slice(0, 4).map(a => ({
      ...a,
      id: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
      })
    }))
  }

  function extractActionsFromModuleResult(result, moduleId) {
    if (!result) return []
    const actions = []

    // Invoice — dispute actions
    if (result.discrepancies?.length > 0) {
      actions.push({ id:'inv-dispute', label:`Dispute ${result.discrepancies.length} overcharge${result.discrepancies.length>1?'s':''} — recover £${(result.total_overcharge||0).toLocaleString()}`, type:'email', icon:'✉' })
    }
    // SLA — reroute instructions
    if (result.at_risk_deliveries?.length > 0) {
      result.at_risk_deliveries.filter(d=>d.reroute_saves_sla).forEach(d => {
        actions.push({ id:`reroute-${d.ref}`, label:`Reroute ${d.ref} — saves £${(d.penalty_if_breached||0).toLocaleString()} penalty`, type:'sms', icon:'💬' })
      })
    }
    // Driver hours — notify affected drivers
    if (result.drivers_at_risk?.length > 0) {
      result.drivers_at_risk.filter(d=>d.breach_risk).slice(0,2).forEach(d => {
        actions.push({ id:`hours-${d.name}`, label:`Alert ${d.name} — ${d.remaining_hours}h remaining this week`, type:'sms', icon:'💬' })
      })
    }
    // Vehicle health — book service
    if (result.vehicles_at_risk?.length > 0) {
      result.vehicles_at_risk.slice(0,2).forEach(v => {
        actions.push({ id:`vehicle-${v.reg}`, label:`Book service for ${v.reg} — ${v.failure_probability}% breakdown risk`, type:'book', icon:'🔧' })
      })
    }
    // Compliance failures — block dispatch
    if (result.compliance_failures?.length > 0) {
      actions.push({ id:'compliance-block', label:`Block dispatch — ${result.compliance_failures.length} compliance failure${result.compliance_failures.length>1?'s':''}`, type:'block', icon:'🚨' })
    }
    // Licence flags
    if (result.flags?.length > 0) {
      actions.push({ id:'licence-flag', label:`Flag ${result.flags.length} driver${result.flags.length>1?'s':''} — licence issues found`, type:'notify', icon:'📣' })
    }
    // Fuel — send fill instruction
    if (result.vehicles_to_fill?.length > 0) {
      actions.push({ id:'fuel-fill', label:`Send fuel instruction to ${result.vehicles_to_fill.length} driver${result.vehicles_to_fill.length>1?'s':''} — save £${(result.total_saving||0).toFixed(0)}`, type:'sms', icon:'⛽' })
    }
    // Tenders found
    if (result.matching_tenders?.length > 0) {
      actions.push({ id:'tender-brief', label:`Send tender briefing — ${result.matching_tenders.length} match${result.matching_tenders.length>1?'es':''}`, type:'email', icon:'🏆' })
    }

    return actions.slice(0, 4).map(a => ({
      ...a,
      id: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
      })
    }))
  }

  async function fireAction(actionId, actionLabel, actionType) {
    setActionStates(prev => ({ ...prev, [actionId]: 'firing' }))
    await new Promise(r => setTimeout(r, 1200))
    setActionStates(prev => ({ ...prev, [actionId]: 'done' }))

    // Add to local approvals list for demo — shows in APPROVALS tab immediately
    const typeConfig = {
      call:     { ico: '📞', bg: 'rgba(59,130,246,0.07)',   border: 'rgba(59,130,246,0.2)' },
      sms:      { ico: '💬', bg: 'rgba(245,158,11,0.07)',   border: 'rgba(245,158,11,0.22)' },
      email:    { ico: '✉',  bg: 'rgba(0,229,176,0.05)',    border: 'rgba(0,229,176,0.18)' },
      dispatch: { ico: '🚛', bg: 'rgba(168,85,247,0.06)',   border: 'rgba(168,85,247,0.2)' },
      notify:   { ico: '📣', bg: 'rgba(0,229,176,0.05)',    border: 'rgba(0,229,176,0.18)' },
      reroute:  { ico: '🗺', bg: 'rgba(168,85,247,0.06)',   border: 'rgba(168,85,247,0.2)' },
      book:     { ico: '🔧', bg: 'rgba(59,130,246,0.07)',   border: 'rgba(59,130,246,0.2)' },
      block:    { ico: '🚨', bg: 'rgba(239,68,68,0.07)',    border: 'rgba(239,68,68,0.2)' },
      emergency:{ ico: '🚨', bg: 'rgba(239,68,68,0.07)',    border: 'rgba(239,68,68,0.2)' },
    }
    const cfg = typeConfig[actionType] || typeConfig.email
    setLocalApprovals(prev => [{
      id: actionId,
      action_label: actionLabel,
      action_type: actionType,
      status: 'executed',
      ico: cfg.ico,
      bg: cfg.bg,
      border: cfg.border,
      executed_at: new Date().toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'}),
      financial_value: 0
    }, ...prev])

    // Write to Supabase approvals via dedicated endpoint
    try {
      await fetch('/api/approvals/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: actionId,
          client_id: 'pearson-haulage',
          action_type: actionType,
          action_label: actionLabel,
          status: 'executed',
          approved_by: 'ops_manager',
          executed_at: new Date().toISOString()
        })
      })
    } catch {}
  }

  async function runScenario(scenarioId) {
    setScenarioRunning(scenarioId)
    setScenarioResult(null)
    setActiveTab('scenarios')
    try {
      const res = await fetch('/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenarioId, use_demo: true })
      })
      const data = await res.json()
      setScenarioResult(data)
    } catch (e) {
      setScenarioResult({ error: e.message })
    } finally {
      setScenarioRunning(null)
    }
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
            {[...sessionIncidents, ...INCIDENT_LOG].slice(0,8).map((inc,i) => (
              <div key={i} style={{ padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.03)', display:'grid', gridTemplateColumns:'1fr auto' }}>
                <div>
                  <div style={{ fontSize:10, color: i===0&&sessionIncidents.length>0?'#00e5b0':'#e8eaed', fontFamily:'monospace' }}>{inc.ref} — {inc.type.substring(0,22)}</div>
                  <div style={{ fontSize:9, color:'#4a5260', marginTop:1 }}>{inc.date}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:9, color:SEV_COLORS[inc.severity], fontFamily:'monospace', padding:'1px 5px', borderRadius:2, background:SEV_BG[inc.severity], display:'inline-block' }}>{inc.severity}</div>
                  {inc.saved && <div style={{ fontSize:9, color:'#00e5b0', marginTop:3 }}>{inc.saved}</div>}
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
            <button style={{ ...TAB_STYLE(activeTab==='approvals'), ...(pendingApprovals.length>0?{borderColor:'rgba(239,68,68,0.4)',color:'#ef4444',background:'rgba(239,68,68,0.08)'}:{}) }} onClick={() => { setActiveTab('approvals'); loadApprovals() }}>
              APPROVALS {pendingApprovals.length > 0 ? `(${pendingApprovals.length})` : ''}
            </button>
            <button style={TAB_STYLE(activeTab==='scenarios')} onClick={() => setActiveTab('scenarios')}>SCENARIOS</button>
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background: loading ? '#f59e0b' : '#00e5b0', animation: loading ? 'pulse 1s infinite' : 'none' }} />
              <span style={{ fontFamily:'monospace', fontSize:10, color:'#4a5260' }}>{loading ? 'ANALYSING...' : 'AGENT READY'}</span>
              {messages.length > 0 && (
                <button onClick={() => { setMessages([]); setResponse(''); setActiveShipment(null); setAgentActions([]); setModuleActions([]); setActionStates({}) }} style={{ fontSize:10, color:'#4a5260', background:'none', border:'1px solid rgba(255,255,255,0.06)', borderRadius:4, padding:'3px 8px', cursor:'pointer', fontFamily:'monospace', marginLeft:4 }}>CLEAR ×</button>
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

                {/* ── SUGGESTED ACTIONS ── */}
                {agentActions.length > 0 && !loading && (
                  <div style={{ marginTop:16, padding:'12px 14px', background:'#0d1014', borderRadius:8, border:'1px solid rgba(0,229,176,0.12)' }}>
                    <div style={{ fontSize:10, fontFamily:'monospace', color:'#00e5b0', letterSpacing:'0.08em', marginBottom:10 }}>SUGGESTED ACTIONS — click to execute</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {agentActions.map(action => {
                        const state = actionStates[action.id]
                        const isDone = state === 'done'
                        const isFiring = state === 'firing'
                        return (
                          <div key={action.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background: isDone ? 'rgba(0,229,176,0.06)' : '#111418', borderRadius:6, border: isDone ? '1px solid rgba(0,229,176,0.2)' : '1px solid rgba(255,255,255,0.06)', transition:'all 0.3s' }}>
                            <span style={{ fontSize:14, flexShrink:0 }}>{action.icon}</span>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:11, color: isDone ? '#00e5b0' : '#e8eaed', lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                {action.label}
                              </div>
                              <div style={{ fontSize:9, color:'#4a5260', fontFamily:'monospace', marginTop:1 }}>{action.type.toUpperCase()}</div>
                            </div>
                            {isDone ? (
                              <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                                <div style={{ width:6, height:6, borderRadius:'50%', background:'#00e5b0' }} />
                                <span style={{ fontSize:10, color:'#00e5b0', fontFamily:'monospace' }}>SENT</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => fireAction(action.id, action.label, action.type)}
                                disabled={isFiring}
                                style={{ padding:'5px 12px', background: isFiring ? 'transparent' : '#00e5b0', color: isFiring ? '#00e5b0' : '#000', border: isFiring ? '1px solid rgba(0,229,176,0.3)' : 'none', borderRadius:5, fontSize:10, fontWeight:600, cursor: isFiring ? 'default' : 'pointer', fontFamily:'monospace', flexShrink:0, minWidth:60, transition:'all 0.2s' }}>
                                {isFiring ? '...' : 'FIRE →'}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {Object.values(actionStates).some(s => s === 'done') && (
                      <div style={{ marginTop:8, fontSize:10, color:'#4a5260', fontFamily:'monospace' }}>
                        Executed actions logged · <span style={{ color:'#00e5b0', cursor:'pointer' }} onClick={() => setActiveTab('approvals')}>View in approvals →</span>
                      </div>
                    )}
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

              {/* Module action buttons */}
              {moduleActions.length > 0 && !moduleRunning && (
                <div style={{ marginTop:16, padding:'12px 14px', background:'#0d1014', borderRadius:8, border:'1px solid rgba(0,229,176,0.12)' }}>
                  <div style={{ fontSize:10, fontFamily:'monospace', color:'#00e5b0', letterSpacing:'0.08em', marginBottom:10 }}>SUGGESTED ACTIONS — click to execute</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {moduleActions.map(action => {
                      const state = actionStates[action.id]
                      const isDone = state === 'done'
                      const isFiring = state === 'firing'
                      return (
                        <div key={action.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background: isDone ? 'rgba(0,229,176,0.06)' : '#111418', borderRadius:6, border: isDone ? '1px solid rgba(0,229,176,0.2)' : '1px solid rgba(255,255,255,0.06)', transition:'all 0.3s' }}>
                          <span style={{ fontSize:14, flexShrink:0 }}>{action.icon}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:11, color: isDone ? '#00e5b0' : '#e8eaed', lineHeight:1.4 }}>{action.label}</div>
                            <div style={{ fontSize:9, color:'#4a5260', fontFamily:'monospace', marginTop:1 }}>{action.type.toUpperCase()}</div>
                          </div>
                          {isDone ? (
                            <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                              <div style={{ width:6, height:6, borderRadius:'50%', background:'#00e5b0' }} />
                              <span style={{ fontSize:10, color:'#00e5b0', fontFamily:'monospace' }}>SENT</span>
                            </div>
                          ) : (
                            <button onClick={() => fireAction(action.id, action.label, action.type)} disabled={isFiring}
                              style={{ padding:'5px 12px', background: isFiring ? 'transparent' : '#00e5b0', color: isFiring ? '#00e5b0' : '#000', border: isFiring ? '1px solid rgba(0,229,176,0.3)' : 'none', borderRadius:5, fontSize:10, fontWeight:600, cursor: isFiring ? 'default' : 'pointer', fontFamily:'monospace', flexShrink:0, minWidth:60, transition:'all 0.2s' }}>
                              {isFiring ? '...' : 'FIRE →'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {moduleResult && !moduleRunning && (
                moduleResult.error
                  ? <div style={{ padding:'12px 14px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, fontFamily:'monospace', fontSize:11, color:'#ef4444' }}>Error: {moduleResult.error}</div>
                  : <ModuleResult result={moduleResult} moduleName={activeModuleName} />
              )}
            </div>
          )}

          {/* ── SCENARIOS TAB ─────────────────────────────────────────────── */}
          {activeTab === 'scenarios' && (
            <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>
              <div style={{ fontSize:10, color:'#4a5260', fontFamily:'monospace', marginBottom:14 }}>// 10 OPERATIONAL SCENARIOS — click any to run with demo data</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:8, marginBottom:20 }}>
                {[
                  { id:'driver_silent', label:'Driver Goes Silent', icon:'📵', color:'#ef4444' },
                  { id:'delivery_rejection', label:'Delivery Rejection', icon:'🚫', color:'#f59e0b' },
                  { id:'churn_prediction', label:'Client Churn Risk', icon:'📉', color:'#f59e0b' },
                  { id:'subcontractor_noshow', label:'Subcontractor No-Show', icon:'👻', color:'#ef4444' },
                  { id:'fuel_card_declined', label:'Fuel Card Declined', icon:'⛽', color:'#f59e0b' },
                  { id:'planned_closures', label:'Planned Road Closures', icon:'🚧', color:'#3b82f6' },
                  { id:'licence_check', label:'Driver Licence Check', icon:'🪪', color:'#f59e0b' },
                  { id:'claim_pre_emption', label:'Insurance Claim Pack', icon:'🛡', color:'#3b82f6' },
                  { id:'border_doc_failure', label:'Border Doc Failure', icon:'🛃', color:'#ef4444' },
                  { id:'cascade_calculator', label:'Cascade Calculator', icon:'🌊', color:'#ef4444' },
                ].map(s => (
                  <button key={s.id} onClick={() => runScenario(s.id)} disabled={!!scenarioRunning}
                    style={{ textAlign:'left', padding:'12px 13px', borderRadius:7, border:`1px solid ${s.color}30`, background:`${s.color}08`, cursor:scenarioRunning?'default':'pointer', opacity:scenarioRunning&&scenarioRunning!==s.id?0.4:1, transition:'all 0.15s' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
                      <span style={{ fontSize:15 }}>{s.icon}</span>
                      <span style={{ fontSize:11, fontWeight:500, color:'#e8eaed', lineHeight:1.3 }}>{s.label}</span>
                    </div>
                    <div style={{ fontSize:9, color:s.color, fontFamily:'monospace' }}>
                      {scenarioRunning===s.id ? '● RUNNING...' : 'CLICK TO RUN DEMO'}
                    </div>
                  </button>
                ))}
              </div>
              {scenarioRunning && (
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px', background:'#111418', borderRadius:8, border:'1px solid rgba(0,229,176,0.15)' }}>
                  <div style={{ width:16, height:16, border:'2px solid #00e5b0', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', flexShrink:0 }} />
                  <span style={{ fontFamily:'monospace', fontSize:11, color:'#00e5b0' }}>Analysing scenario...</span>
                </div>
              )}
              {scenarioResult && !scenarioRunning && (
                <div style={{ border:'1px solid rgba(0,229,176,0.15)', borderRadius:8, overflow:'hidden' }}>
                  <div style={{ padding:'10px 14px', background:'rgba(0,229,176,0.06)', borderBottom:'1px solid rgba(0,229,176,0.1)', fontFamily:'monospace', fontSize:11, color:'#00e5b0' }}>
                    SCENARIO RESULT — {scenarioResult.scenario?.toUpperCase().replace(/_/g,' ')}
                  </div>
                  {scenarioResult.error
                    ? <div style={{ padding:'14px', color:'#ef4444', fontSize:12, fontFamily:'monospace' }}>Error: {scenarioResult.error}</div>
                    : <div style={{ padding:'14px', maxHeight:400, overflowY:'auto' }}>
                        <ScenarioResult result={scenarioResult.result} />
                      </div>
                  }
                </div>
              )}
            </div>
          )}

          {/* ── APPROVALS TAB ──────────────────────────────────────────────── */}
          {activeTab === 'approvals' && (
            <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>

              {/* Session executed actions */}
              {localApprovals.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:10, color:'#4a5260', fontFamily:'monospace', marginBottom:10 }}>// EXECUTED THIS SESSION</div>
                  {localApprovals.map(a => (
                    <div key={a.id} style={{ border:`1px solid ${a.border}`, borderRadius:8, background:a.bg, marginBottom:7 }}>
                      <div style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ fontSize:15 }}>{a.ico}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, color:'#e8eaed', fontWeight:500 }}>{a.action_label}</div>
                          <div style={{ fontSize:9, color:'#4a5260', fontFamily:'monospace', marginTop:2 }}>{(a.action_type||'').toUpperCase()} · sent at {a.executed_at}</div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                          <div style={{ width:6, height:6, borderRadius:'50%', background:'#00e5b0' }} />
                          <span style={{ fontSize:10, color:'#00e5b0', fontFamily:'monospace' }}>EXECUTED</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {pendingApprovals.length > 0 && <div style={{ height:1, background:'rgba(255,255,255,0.06)', margin:'12px 0' }} />}
                </div>
              )}

              {/* Supabase records */}
              {pendingApprovals.length > 0 ? (
                <>
                  <div style={{ fontSize:10, color:'#4a5260', fontFamily:'monospace', marginBottom:10 }}>// LOGGED ACTIONS — {pendingApprovals.length} record{pendingApprovals.length!==1?'s':''}</div>
                  {pendingApprovals.map(a => {
                    const typeMap = {
                      call:      { bg:'rgba(59,130,246,0.07)',  border:'rgba(59,130,246,0.2)',  ico:'📞' },
                      email:     { bg:'rgba(0,229,176,0.05)',   border:'rgba(0,229,176,0.18)',  ico:'✉' },
                      sms:       { bg:'rgba(245,158,11,0.07)',  border:'rgba(245,158,11,0.22)', ico:'💬' },
                      dispatch:  { bg:'rgba(168,85,247,0.06)', border:'rgba(168,85,247,0.2)',  ico:'🚛' },
                      notify:    { bg:'rgba(0,229,176,0.05)',   border:'rgba(0,229,176,0.18)',  ico:'📣' },
                      emergency: { bg:'rgba(239,68,68,0.07)',   border:'rgba(239,68,68,0.2)',   ico:'🚨' },
                      reroute:   { bg:'rgba(168,85,247,0.06)', border:'rgba(168,85,247,0.2)',  ico:'🗺' },
                      send_sms:  { bg:'rgba(245,158,11,0.07)',  border:'rgba(245,158,11,0.22)', ico:'💬' },
                      send_email:{ bg:'rgba(0,229,176,0.05)',   border:'rgba(0,229,176,0.18)',  ico:'✉' },
                      make_call: { bg:'rgba(59,130,246,0.07)',  border:'rgba(59,130,246,0.2)',  ico:'📞' },
                    }
                    const ac = typeMap[a.action_type] || { bg:'rgba(0,229,176,0.05)', border:'rgba(0,229,176,0.18)', ico:'✉' }
                    const isExecuted = a.status === 'executed'
                    const isPending = a.status === 'pending'
                    const isProcessing = approvingId === a.id
                    const timeStr = a.executed_at ? new Date(a.executed_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : ''
                    return (
                      <div key={a.id} style={{ border:`1px solid ${ac.border}`, borderRadius:8, background:ac.bg, marginBottom:8 }}>
                        <div style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
                          <span style={{ fontSize:15 }}>{ac.ico}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, color:'#e8eaed', fontWeight:500 }}>{a.action_label}</div>
                            <div style={{ fontSize:9, color:'#4a5260', fontFamily:'monospace', marginTop:2 }}>
                              {(a.action_type||'').toUpperCase()}
                              {timeStr && <span style={{ marginLeft:8 }}>{timeStr}</span>}
                              {a.financial_value > 0 && <span style={{ marginLeft:8, color:'#00e5b0' }}>£{Number(a.financial_value).toLocaleString()}</span>}
                            </div>
                          </div>
                          {isExecuted ? (
                            <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                              <div style={{ width:6, height:6, borderRadius:'50%', background:'#00e5b0' }} />
                              <span style={{ fontSize:10, color:'#00e5b0', fontFamily:'monospace' }}>EXECUTED</span>
                            </div>
                          ) : isPending ? (
                            <div style={{ display:'flex', gap:6 }}>
                              <button onClick={() => handleApproval(a.id,'approve')} disabled={isProcessing}
                                style={{ padding:'6px 12px', borderRadius:5, border:'none', background:'#00e5b0', color:'#000', fontWeight:600, fontSize:11, cursor:isProcessing?'default':'pointer', fontFamily:'monospace' }}>
                                {isProcessing?'...':'✓ SEND'}
                              </button>
                              <button onClick={() => assessCancelAction(a.id, a.sent_at)} disabled={isProcessing}
                                style={{ padding:'6px 10px', borderRadius:5, fontSize:11, cursor:'pointer', border:'1px solid rgba(245,158,11,0.4)', background:'rgba(245,158,11,0.06)', color:'#f59e0b', fontFamily:'monospace' }}>
                                CANCEL
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize:10, color:'#4a5260', fontFamily:'monospace' }}>{(a.status||'').toUpperCase()}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </>
              ) : localApprovals.length === 0 ? (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60%', gap:12, opacity:0.3 }}>
                  <div style={{ fontFamily:'monospace', fontSize:32, color:'#4a5260' }}>✓</div>
                  <div style={{ fontSize:12, color:'#4a5260' }}>No actions yet</div>
                  <div style={{ fontSize:11, color:'#4a5260', textAlign:'center', maxWidth:240 }}>Fire actions from agent analyses to see them here</div>
                </div>
              ) : null}

              {/* ── CANCEL ASSESSMENT MODAL ── */}
              {cancelAssessment && (
                <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
                  <div style={{ background:'#111418', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, padding:'24px', maxWidth:480, width:'90%' }}>
                    <div style={{ fontFamily:'monospace', fontSize:11, color: cancelAssessment.risk === 'NONE' ? '#00e5b0' : cancelAssessment.risk === 'LOW' ? '#f59e0b' : '#ef4444', letterSpacing:'0.08em', marginBottom:12 }}>
                      CANCEL ASSESSMENT — {cancelAssessment.risk} RISK
                    </div>
                    <div style={{ fontSize:13, color:'#e8eaed', lineHeight:1.7, marginBottom:20 }}>
                      {cancelAssessment.message}
                    </div>

                    {cancelAssessment.type === 'clean_cancel' && (
                      <div style={{ display:'flex', gap:8 }}>
                        <button onClick={() => executeCancelAction(cancelAssessment.approvalId, 'clean_cancel')}
                          style={{ flex:1, padding:'10px', background:'#ef4444', border:'none', borderRadius:6, color:'#fff', fontWeight:600, fontSize:12, cursor:'pointer', fontFamily:'monospace' }}>
                          CONFIRM CANCEL
                        </button>
                        <button onClick={() => setCancelAssessment(null)}
                          style={{ padding:'10px 16px', background:'transparent', border:'1px solid rgba(255,255,255,0.12)', borderRadius:6, color:'#8a9099', fontSize:12, cursor:'pointer', fontFamily:'monospace' }}>
                          KEEP ACTION
                        </button>
                      </div>
                    )}

                    {cancelAssessment.type === 'disregard_cancel' && (
                      <div>
                        <div style={{ padding:'10px 12px', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:6, fontSize:12, color:'#f59e0b', fontFamily:'monospace', marginBottom:14 }}>
                          Will send to driver: "DISREGARD previous route instruction. Continue on original route."
                        </div>
                        <div style={{ display:'flex', gap:8 }}>
                          <button onClick={() => executeCancelAction(cancelAssessment.approvalId, 'disregard')}
                            style={{ flex:1, padding:'10px', background:'#f59e0b', border:'none', borderRadius:6, color:'#000', fontWeight:600, fontSize:12, cursor:'pointer', fontFamily:'monospace' }}>
                            SEND DISREGARD + CANCEL
                          </button>
                          <button onClick={() => setCancelAssessment(null)}
                            style={{ padding:'10px 16px', background:'transparent', border:'1px solid rgba(255,255,255,0.12)', borderRadius:6, color:'#8a9099', fontSize:12, cursor:'pointer', fontFamily:'monospace' }}>
                            KEEP ACTION
                          </button>
                        </div>
                      </div>
                    )}

                    {cancelAssessment.type === 'partial_revert' && (
                      <div>
                        <div style={{ padding:'10px 12px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:6, fontSize:12, color:'#ef4444', fontFamily:'monospace', marginBottom:14 }}>
                          ⚠ Driver likely already {cancelAssessment.estimatedMiles} miles into diversion. Choose carefully.
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
                          {cancelAssessment.options?.map(opt => (
                            <button key={opt.id} onClick={() => executeCancelAction(cancelAssessment.approvalId, opt.id)}
                              style={{ padding:'10px 14px', background: opt.recommended ? 'rgba(0,229,176,0.1)' : 'rgba(255,255,255,0.04)', border: opt.recommended ? '1px solid rgba(0,229,176,0.3)' : '1px solid rgba(255,255,255,0.08)', borderRadius:6, color: opt.recommended ? '#00e5b0' : '#8a9099', fontSize:12, cursor:'pointer', textAlign:'left', fontFamily:'monospace' }}>
                              {opt.recommended ? '✓ ' : ''}{opt.label}
                              <div style={{ fontSize:10, color:'#4a5260', marginTop:3, fontFamily:'IBM Plex Sans' }}>{opt.description}</div>
                            </button>
                          ))}
                        </div>
                        <button onClick={() => setCancelAssessment(null)}
                          style={{ width:'100%', padding:'8px', background:'transparent', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, color:'#4a5260', fontSize:11, cursor:'pointer', fontFamily:'monospace' }}>
                          DISMISS — TAKE NO ACTION
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
