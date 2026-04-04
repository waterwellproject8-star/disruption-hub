'use client'
import { useState, useEffect } from 'react'

// ── ROUTINE ACTIONS — one tap, instant log, no panel ─────────────────────────
const ROUTINE_ACTIONS = [
  { id:'arrived_collection', label:'At Collection', icon:'📍', color:'#3b82f6', status:'at_collection', toast:'Logged — arrived at collection' },
  { id:'loading_complete',   label:'Loaded',        icon:'✅', color:'#00e5b0', status:'loaded',         toast:'Logged — load secured, departing' },
  { id:'arrived_delivery',   label:'At Customer',   icon:'🏭', color:'#3b82f6', status:'at_customer',    toast:'Logged — arrived at delivery point' },
  { id:'delivered',          label:'Delivered',     icon:'📦', color:'#00e5b0', status:'completed',      toast:'Job complete — delivery confirmed' },
]

// ── ISSUE ACTIONS — open panel with AI analysis ───────────────────────────────
const ISSUE_ACTIONS = [
  { id:'delayed',    label:'Running Late', icon:'⏰', color:'#f59e0b' },
  { id:'rest',       label:'Rest Break',   icon:'🛌', color:'#a855f7' },
  { id:'temp_check', label:'Temp Check',   icon:'🌡', color:'#06b6d4' },
  { id:'fuel',       label:'Fuel Stop',    icon:'⛽', color:'#f59e0b' },
  { id:'defect',     label:'Vehicle Issue',icon:'🔧', color:'#f59e0b' },
]

const STATUS_COLORS = {
  'on-track':      { dot:'#00e5b0', label:'ON-TRACK',     border:'rgba(0,229,176,0.25)',  bg:'rgba(0,229,176,0.04)' },
  'at_collection': { dot:'#3b82f6', label:'AT COLLECTION', border:'rgba(59,130,246,0.25)', bg:'rgba(59,130,246,0.04)' },
  'loaded':        { dot:'#00e5b0', label:'LOADED',        border:'rgba(0,229,176,0.25)',  bg:'rgba(0,229,176,0.04)' },
  'at_customer':   { dot:'#3b82f6', label:'AT CUSTOMER',   border:'rgba(59,130,246,0.25)', bg:'rgba(59,130,246,0.04)' },
  disrupted:       { dot:'#ef4444', label:'DISRUPTED',     border:'rgba(239,68,68,0.25)',  bg:'rgba(239,68,68,0.04)' },
  delayed:         { dot:'#f59e0b', label:'DELAYED',       border:'rgba(245,158,11,0.25)', bg:'rgba(245,158,11,0.04)' },
  pending:         { dot:'#3b82f6', label:'PENDING',       border:'rgba(59,130,246,0.25)', bg:'rgba(59,130,246,0.04)' },
  completed:       { dot:'#4a5260', label:'DONE',          border:'rgba(74,82,96,0.2)',    bg:'rgba(74,82,96,0.04)' },
}

const SEV_STYLES = {
  CRITICAL: { bg:'rgba(239,68,68,0.12)',  border:'rgba(239,68,68,0.35)',  color:'#ef4444', icon:'🚨' },
  HIGH:     { bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.35)', color:'#f59e0b', icon:'⚠️' },
  MEDIUM:   { bg:'rgba(59,130,246,0.12)', border:'rgba(59,130,246,0.35)', color:'#3b82f6', icon:'ℹ️' },
  LOW:      { bg:'rgba(0,229,176,0.08)',  border:'rgba(0,229,176,0.25)',  color:'#00e5b0', icon:'✅' },
  OK:       { bg:'rgba(0,229,176,0.08)',  border:'rgba(0,229,176,0.25)',  color:'#00e5b0', icon:'✅' },
}

export default function DriverApp() {
  const [jobs, setJobs]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [activeJob, setActiveJob]   = useState(null)
  const [driverInfo, setDriverInfo] = useState({ name:'', clientId:'', vehicleReg:'' })
  const [setupDone, setSetupDone]   = useState(false)
  const [toast, setToast]           = useState(null)

  // Issue panel state
  const [panelOpen, setPanelOpen]     = useState(false)
  const [panelAction, setPanelAction] = useState(null)
  const [panelState, setPanelState]   = useState('idle')
  const [inputText, setInputText]     = useState('')
  const [parsedResult, setParsedResult] = useState(null)
  const [showDetail, setShowDetail]   = useState(false)
  const [lastAlert, setLastAlert]     = useState(null)
  const [resolvedEta, setResolvedEta] = useState('')

  // GPS
  const [gpsCoords, setGpsCoords]           = useState(null)
  const [gpsDescription, setGpsDescription] = useState('')
  const [gpsStatus, setGpsStatus]           = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem('dh_driver_info')
    if (saved) {
      const info = JSON.parse(saved)
      setDriverInfo(info)
      setSetupDone(true)
      loadJobs(info)
    } else {
      setLoading(false)
    }
    const savedAlert = localStorage.getItem('dh_last_alert')
    if (savedAlert) { try { setLastAlert(JSON.parse(savedAlert)) } catch {} }
  }, [])

  function showToast(msg, type='ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function loadJobs(info) {
    if (!info?.clientId) return
    setLoading(true)
    try {
      const res  = await fetch(`/api/shipments?client_id=${info.clientId}`)
      const data = await res.json()
      const mapped = (data.shipments||[]).map(s => ({
        ref:s.ref, route:s.route, carrier:s.carrier,
        status:s.status, eta:s.eta, sla_window:s.sla_window,
        cargo_type:s.cargo_type, alert:s.alert,
        penalty_if_breached:s.penalty_if_breached,
        cargo_value:s.cargo_value
      }))
      setJobs(mapped)
      if (mapped.length > 0) setActiveJob(mapped[0])
    } catch { showToast('Could not load jobs','error') }
    finally { setLoading(false) }
  }

  function getGPS() {
    if (!navigator.geolocation) { setGpsStatus('failed'); return }
    setGpsStatus('getting')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords
        setGpsCoords({ latitude, longitude })
        setGpsStatus('got')
        try {
          const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
          const data = await res.json()
          const road = data.address?.road || data.address?.motorway || ''
          const area = data.address?.suburb || data.address?.town || data.address?.county || ''
          setGpsDescription([road, area].filter(Boolean).join(', ') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
        } catch { setGpsDescription(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`) }
      },
      () => setGpsStatus('failed'),
      { enableHighAccuracy:true, timeout:10000, maximumAge:0 }
    )
  }

  // ── ROUTINE ACTION — instant log, no panel ────────────────────────────────
  function logRoutine(action) {
    const job = activeJob
    if (!job) return

    // Update job status immediately
    const newStatus = action.status
    const isComplete = newStatus === 'completed'

    setJobs(prev => {
      const updated = prev.map(j =>
        j.ref === job.ref ? { ...j, status: newStatus, alert: null } : j
      )
      if (isComplete) {
        return [
          ...updated.filter(j => j.status !== 'completed'),
          ...updated.filter(j => j.status === 'completed'),
        ]
      }
      return updated
    })
    setActiveJob(prev => ({ ...prev, status: newStatus, alert: null }))

    // Move active job to next non-completed job if delivered
    if (isComplete) {
      setJobs(prev => {
        const next = prev.find(j => j.status !== 'completed' && j.ref !== job.ref)
        if (next) setActiveJob(next)
        return prev
      })
      if (lastAlert) {
        setLastAlert(null)
        localStorage.removeItem('dh_last_alert')
      }
    }

    showToast(action.toast, 'ok')
  }

  // ── ISSUE PANEL ───────────────────────────────────────────────────────────
  function openPanel(actionId) {
    setPanelAction(actionId)
    setPanelOpen(true)
    setPanelState('idle')
    setInputText('')
    setParsedResult(null)
    setShowDetail(false)
    setResolvedEta('')
    getGPS()
  }

  function closePanel() {
    if (parsedResult && panelState === 'result') {
      const alert = {
        ...parsedResult,
        actionType: panelAction,
        time: new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }),
      }
      setLastAlert(alert)
      localStorage.setItem('dh_last_alert', JSON.stringify(alert))
    }
    if (panelState === 'resolved') {
      setLastAlert(null)
      localStorage.removeItem('dh_last_alert')
    }
    setPanelOpen(false)
    setPanelAction(null)
    setPanelState('idle')
    setInputText('')
    setParsedResult(null)
    setShowDetail(false)
    setResolvedEta('')
  }

  function reopenLastAlert() {
    if (!lastAlert) return
    setParsedResult(lastAlert)
    setPanelAction(lastAlert.actionType || 'breakdown')
    setPanelState('result')
    setPanelOpen(true)
    setShowDetail(false)
  }

  async function resolveIssue(reason) {
    setPanelState('resolving_loading')
    const job = activeJob
    try {
      const res = await fetch('/api/driver/resolve', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          client_id: driverInfo.clientId,
          driver_name: driverInfo.name,
          vehicle_reg: driverInfo.vehicleReg,
          ref: job?.ref,
          resolution: reason,
          location_description: gpsDescription,
          route: job?.route,
          sla_window: job?.sla_window,
          original_issue: panelAction,
        })
      })
      const data = await res.json()
      setJobs(prev => prev.map(j =>
        j.ref === job?.ref ? { ...j, status:'on-track', alert:null } : j
      ))
      if (activeJob?.ref === job?.ref) setActiveJob(p => ({...p, status:'on-track', alert:null}))
      setResolvedEta(data.revised_eta || '')
      setPanelState('resolved')
    } catch { setPanelState('resolved') }
  }

  function parseResponse(text) {
    const headline = text.match(/HEADLINE:\s*(.+)/i)?.[1]?.trim() || ''
    const severity = text.match(/SEVERITY:\s*(CRITICAL|HIGH|MEDIUM|LOW|OK)/i)?.[1]?.toUpperCase() || 'MEDIUM'
    const actions = []
    for (const m of text.matchAll(/ACTION\s*\d+:\s*(.+)/gi)) {
      const a = m[1].trim(); if (a) actions.push(a)
    }
    const detail = text.match(/DETAIL:\s*([\s\S]+)/i)?.[1]?.trim() || ''
    return { headline, severity, actions, detail }
  }

  function buildPrompt(actionId) {
    const loc = gpsDescription || 'location not confirmed'
    const job = activeJob
    const prompts = {
      fuel:      `Driver ${driverInfo.name} (${driverInfo.vehicleReg}) stopping for fuel at ${loc}. Job: ${job?.route||'unknown'}. Cargo: ${job?.cargo_type||'unknown'}. SLA: ${job?.sla_window||'unknown'}.`,
      rest:      `Driver ${driverInfo.name} (${driverInfo.vehicleReg}) needs mandatory WTD rest. Location: ${loc}. Job: ${job?.route||'unknown'}. Cargo: ${job?.cargo_type||'unknown'}, value: £${job?.cargo_value?.toLocaleString()||'unknown'}.`,
      delayed:   `Driver ${driverInfo.name} (${driverInfo.vehicleReg}) running late. Location: ${loc}. Job: ${job?.route||'unknown'}. SLA: ${job?.sla_window||'unknown'}. Penalty: £${job?.penalty_if_breached?.toLocaleString()||'unknown'}. ${inputText ? 'Reason: '+inputText : ''}`,
      temp_check:`Cold chain log. Driver ${driverInfo.name} (${driverInfo.vehicleReg}). Location: ${loc}. Cargo: ${job?.cargo_type||'temperature controlled'}. Reading: ${inputText||'not entered'}.`,
      defect:    `Vehicle defect. ${driverInfo.vehicleReg}, ${driverInfo.name}. Location: ${loc}. Defect: ${inputText||'driver reported defect'}.`,
      breakdown: `BREAKDOWN. ${driverInfo.vehicleReg}, ${driverInfo.name}. Location: ${loc}. ${inputText ? 'Issue: '+inputText : 'Vehicle broken down.'} Job: ${job?.route||'unknown'}. Cargo: ${job?.cargo_type||'unknown'}, value: £${job?.cargo_value?.toLocaleString()||'unknown'}.`,
    }
    return prompts[actionId] || `Driver ${driverInfo.name} reports: ${inputText || actionId}. Location: ${loc}.`
  }

  async function sendAlert() {
    setPanelState('loading')
    const prompt = buildPrompt(panelAction)
    const job = activeJob

    fetch('/api/driver/alert', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        client_id: driverInfo.clientId, driver_name: driverInfo.name,
        vehicle_reg: driverInfo.vehicleReg, ref: job?.ref,
        issue_description: prompt, human_description: inputText || panelAction,
        location_description: gpsDescription,
        latitude: gpsCoords?.latitude, longitude: gpsCoords?.longitude,
      })
    }).catch(()=>{})

    try {
      const res = await fetch('/api/agent', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ messages:[{role:'user',content:prompt}], driver_mode:true })
      })
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value).split('\n')) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try { const p = JSON.parse(line.slice(6)); if (p.text) fullText += p.text } catch {}
          }
        }
      }
      if (fullText) { setParsedResult(parseResponse(fullText)); setPanelState('result') }
      else setPanelState('sent')
    } catch { setPanelState('sent') }
  }

  function saveDriverInfo() {
    if (!driverInfo.name || !driverInfo.clientId) return
    localStorage.setItem('dh_driver_info', JSON.stringify(driverInfo))
    setSetupDone(true)
    loadJobs(driverInfo)
  }

  const cargoIcon = t => !t?'📦':t.includes('pharma')?'💊':t.includes('frozen')?'🧊':t.includes('chilled')?'❄':'📦'

  // ── SETUP ─────────────────────────────────────────────────────────────────
  if (!setupDone) {
    return (
      <div style={{minHeight:'100vh',background:'#0a0c0e',color:'#e8eaed',fontFamily:'IBM Plex Sans,sans-serif',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
        <div style={{width:'100%',maxWidth:360}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:32}}>
            <div style={{width:32,height:32,background:'#00e5b0',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#000',fontFamily:'monospace'}}>DH</div>
            <div><div style={{fontSize:14,fontWeight:500}}>DisruptionHub</div><div style={{fontSize:11,color:'#4a5260',fontFamily:'monospace'}}>Driver App</div></div>
          </div>
          <div style={{fontSize:11,color:'#4a5260',fontFamily:'monospace',letterSpacing:'0.08em',marginBottom:16}}>SETUP — ONE TIME ONLY</div>
          {[{label:'Your name',key:'name',placeholder:'e.g. Carl Hughes'},{label:'Vehicle registration',key:'vehicleReg',placeholder:'e.g. BK21 XYZ'},{label:'Company access code',key:'clientId',placeholder:'Given by your manager'}].map(f=>(
            <div key={f.key} style={{marginBottom:14}}>
              <div style={{fontSize:11,color:'#8a9099',marginBottom:5}}>{f.label}</div>
              <input value={driverInfo[f.key]} onChange={e=>setDriverInfo(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder}
                style={{width:'100%',padding:'11px 14px',background:'#111418',border:'1px solid rgba(255,255,255,0.1)',borderRadius:7,color:'#e8eaed',fontSize:14,outline:'none',boxSizing:'border-box'}}/>
            </div>
          ))}
          <button onClick={saveDriverInfo} style={{width:'100%',padding:13,background:'#00e5b0',border:'none',borderRadius:7,color:'#000',fontWeight:600,fontSize:14,cursor:'pointer',marginTop:8}}>Set up my app →</button>
        </div>
      </div>
    )
  }

  // ── SORTED JOBS ───────────────────────────────────────────────────────────
  const sortedJobs = [
    ...jobs.filter(j => j.status !== 'completed'),
    ...jobs.filter(j => j.status === 'completed'),
  ]

  // ── MAIN APP ──────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:'100vh',background:'#0a0c0e',color:'#e8eaed',fontFamily:'IBM Plex Sans,sans-serif',paddingBottom:80}}>

      {/* Toast */}
      {toast && (
        <div style={{position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',zIndex:999,padding:'10px 20px',borderRadius:8,background:toast.type==='error'?'#ef4444':'#00e5b0',color:toast.type==='error'?'#fff':'#000',fontSize:13,fontWeight:600,whiteSpace:'nowrap',boxShadow:'0 4px 20px rgba(0,0,0,0.5)',display:'flex',alignItems:'center',gap:8}}>
          {toast.type==='ok'?'✓':''} {toast.msg}
        </div>
      )}

      {/* NAV */}
      <div style={{padding:'10px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(255,255,255,0.06)',background:'rgba(10,12,14,0.98)',position:'sticky',top:0,zIndex:50}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:26,height:26,background:'#00e5b0',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'#000',fontFamily:'monospace'}}>DH</div>
          <div>
            <div style={{fontSize:12,fontWeight:500}}>{driverInfo.name}</div>
            <div style={{fontSize:10,color:'#4a5260',fontFamily:'monospace'}}>{driverInfo.vehicleReg}</div>
          </div>
        </div>
        <div style={{fontSize:10,color:'#4a5260',fontFamily:'monospace'}}>
          {new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}).toUpperCase()}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{padding:'12px 0 0'}}>

        {/* Last alert card */}
        {lastAlert && (
          <div onClick={reopenLastAlert} style={{margin:'0 12px 10px',padding:'12px 14px',borderRadius:10,cursor:'pointer',border:`1px solid ${SEV_STYLES[lastAlert.severity]?.border||'rgba(245,158,11,0.35)'}`,background:SEV_STYLES[lastAlert.severity]?.bg||'rgba(245,158,11,0.08)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div style={{display:'flex',alignItems:'flex-start',gap:8,flex:1}}>
                <span style={{fontSize:18,flexShrink:0}}>{SEV_STYLES[lastAlert.severity]?.icon||'⚠️'}</span>
                <div>
                  <div style={{fontSize:9,color:SEV_STYLES[lastAlert.severity]?.color||'#f59e0b',fontFamily:'monospace',fontWeight:700,letterSpacing:'0.06em',marginBottom:3}}>LAST ALERT · {lastAlert.time}</div>
                  <div style={{fontSize:13,color:'#e8eaed',fontWeight:500,lineHeight:1.4}}>{lastAlert.headline}</div>
                  {lastAlert.actions?.[0] && <div style={{fontSize:11,color:'#8a9099',marginTop:4}}>Step 1: {lastAlert.actions[0]}</div>}
                </div>
              </div>
              <div style={{fontSize:10,color:'#4a5260',flexShrink:0,marginLeft:8,marginTop:2}}>Tap →</div>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{padding:'4px 16px 10px'}}>
          <div style={{fontSize:17,fontWeight:500}}>{loading?'Loading...':`${jobs.length} run${jobs.length!==1?'s':''} today`}</div>
        </div>

        {/* JOB CARDS */}
        {sortedJobs.map(job => {
          const sc = STATUS_COLORS[job.status] || STATUS_COLORS['on-track']
          const isActive = activeJob?.ref === job.ref
          const isDone = job.status === 'completed'
          return (
            <div key={job.ref} onClick={() => !isDone && setActiveJob(job)}
              style={{margin:'0 12px 8px',padding:'13px 14px',borderRadius:10,cursor:isDone?'default':'pointer',border:`1px solid ${isActive&&!isDone?'#00e5b0':sc.border}`,background:sc.bg,opacity:isDone?0.5:1,transition:'all 0.2s'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                <span style={{fontFamily:'monospace',fontSize:13,fontWeight:600,color:isDone?'#4a5260':'#e8eaed'}}>{job.ref}</span>
                <div style={{display:'flex',alignItems:'center',gap:5}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:sc.dot}}/>
                  <span style={{fontFamily:'monospace',fontSize:10,color:sc.dot}}>{sc.label}</span>
                </div>
              </div>
              <div style={{fontSize:13,color:isDone?'#4a5260':'#8a9099',marginBottom:3}}>{job.route}</div>
              {!isDone && (
                <div style={{display:'flex',gap:12,fontSize:11,color:'#4a5260',flexWrap:'wrap'}}>
                  {job.carrier && <span>{job.carrier}</span>}
                  {job.eta && <span>ETA {job.eta}</span>}
                  {job.sla_window && <span>Slot {job.sla_window}</span>}
                </div>
              )}
              {!isDone && job.cargo_type && <div style={{marginTop:6,fontSize:11,color:'#3b82f6'}}>{cargoIcon(job.cargo_type)} {job.cargo_type}</div>}
              {job.alert && !isDone && <div style={{marginTop:7,padding:'5px 9px',background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:5,fontSize:10,color:'#f59e0b'}}>⚠ {job.alert}</div>}

              {/* Routine action buttons — only for active non-completed job */}
              {isActive && !isDone && (
                <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid rgba(255,255,255,0.06)'}}>
                  <div style={{fontSize:9,color:'#4a5260',fontFamily:'monospace',letterSpacing:'0.06em',marginBottom:8}}>LOG PROGRESS</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                    {ROUTINE_ACTIONS.map(action => (
                      <button key={action.id} onClick={e => { e.stopPropagation(); logRoutine(action) }}
                        style={{padding:'9px 8px',borderRadius:7,fontSize:12,fontWeight:500,cursor:'pointer',background:`${action.color}0f`,border:`1px solid ${action.color}33`,color:action.color,display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
                        <span>{action.icon}</span> {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* ISSUE ACTIONS GRID */}
        <div style={{padding:'10px 16px 6px',fontSize:9,color:'#4a5260',fontFamily:'monospace',letterSpacing:'0.08em',marginTop:4}}>REPORT AN ISSUE</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6,padding:'0 12px 12px'}}>
          {ISSUE_ACTIONS.map(action => (
            <button key={action.id} onClick={() => openPanel(action.id)}
              style={{padding:'10px 2px',borderRadius:8,background:'#111418',border:'1px solid rgba(255,255,255,0.06)',display:'flex',flexDirection:'column',alignItems:'center',gap:4,cursor:'pointer',outline:'none'}}>
              <span style={{fontSize:18}}>{action.icon}</span>
              <span style={{fontSize:8,color:'#8a9099',textAlign:'center',lineHeight:1.3}}>{action.label}</span>
            </button>
          ))}
        </div>

        <div style={{padding:'4px 16px 16px'}}>
          <button onClick={() => { localStorage.removeItem('dh_driver_info'); setSetupDone(false); setJobs([]); setActiveJob(null) }}
            style={{width:'100%',padding:10,background:'transparent',border:'1px solid rgba(255,255,255,0.06)',borderRadius:6,color:'#4a5260',fontSize:11,cursor:'pointer'}}>
            Change driver / vehicle
          </button>
        </div>
      </div>

      {/* ── STICKY EMERGENCY BAR ──────────────────────────────────────────────── */}
      <div style={{position:'fixed',bottom:0,left:0,right:0,padding:'12px 16px 24px',background:'rgba(10,12,14,0.97)',borderTop:'1px solid rgba(239,68,68,0.2)',backdropFilter:'blur(10px)',zIndex:100,display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <button onClick={() => openPanel('breakdown')}
          style={{padding:'14px',background:'#ef4444',border:'none',borderRadius:10,color:'#fff',fontWeight:700,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          🚨 Breakdown
        </button>
        <button onClick={() => openPanel('delayed')}
          style={{padding:'14px',background:'rgba(245,158,11,0.12)',border:'1px solid rgba(245,158,11,0.35)',borderRadius:10,color:'#f59e0b',fontWeight:600,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          ⏰ Running Late
        </button>
      </div>

      {/* ── ISSUE PANEL (bottom sheet) ────────────────────────────────────────── */}
      {panelOpen && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:200,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}
          onClick={e => { if (e.target===e.currentTarget) closePanel() }}>
          <div style={{background:'#111418',borderRadius:'16px 16px 0 0',maxHeight:'90vh',display:'flex',flexDirection:'column',borderTop:'1px solid rgba(255,255,255,0.08)'}}>

            <div style={{padding:'16px 20px 12px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <span style={{fontSize:12,fontWeight:600,color: panelAction==='breakdown'?'#ef4444':panelAction==='delayed'?'#f59e0b':'#00e5b0',fontFamily:'monospace',letterSpacing:'0.06em'}}>
                {panelAction==='breakdown'?'BREAKDOWN ALERT':panelAction==='rest'?'REST BREAK':panelAction==='temp_check'?'TEMPERATURE LOG':panelAction==='delayed'?'RUNNING LATE':panelAction==='defect'?'VEHICLE DEFECT':'FUEL STOP'}
              </span>
              <button onClick={closePanel} style={{background:'none',border:'none',color:'#4a5260',fontSize:20,cursor:'pointer',lineHeight:1}}>✕</button>
            </div>

            <div style={{overflowY:'auto',flex:1,padding:'0 20px 32px'}}>

              {/* GPS */}
              <div style={{padding:'9px 11px',background:'#0d1014',borderRadius:7,display:'flex',alignItems:'center',gap:9,marginBottom:14}}>
                <div style={{width:7,height:7,borderRadius:'50%',flexShrink:0,background:gpsStatus==='got'?'#00e5b0':gpsStatus==='getting'?'#f59e0b':'#4a5260'}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:9,color:'#4a5260',fontFamily:'monospace'}}>YOUR LOCATION</div>
                  <div style={{fontSize:11,color:gpsStatus==='got'?'#e8eaed':'#8a9099'}}>{gpsStatus==='getting'?'Getting GPS...':gpsStatus==='got'?gpsDescription:'GPS unavailable — include location below'}</div>
                </div>
                {gpsStatus!=='got'&&gpsStatus!=='getting'&&(
                  <button onClick={getGPS} style={{padding:'4px 10px',background:'rgba(0,229,176,0.08)',border:'1px solid rgba(0,229,176,0.2)',borderRadius:5,color:'#00e5b0',fontSize:11,cursor:'pointer'}}>Get GPS</button>
                )}
              </div>

              {/* RESULT */}
              {panelState==='result' && parsedResult && (() => {
                const sev = SEV_STYLES[parsedResult.severity] || SEV_STYLES.MEDIUM
                return (
                  <div>
                    <div style={{padding:'14px',background:sev.bg,border:`1px solid ${sev.border}`,borderRadius:10,marginBottom:14,display:'flex',gap:10,alignItems:'flex-start'}}>
                      <span style={{fontSize:22,flexShrink:0}}>{sev.icon}</span>
                      <div>
                        <div style={{fontSize:10,color:sev.color,fontFamily:'monospace',fontWeight:700,letterSpacing:'0.08em',marginBottom:4}}>{parsedResult.severity}</div>
                        <div style={{fontSize:15,fontWeight:600,color:'#e8eaed',lineHeight:1.4}}>{parsedResult.headline}</div>
                      </div>
                    </div>
                    {parsedResult.actions.length > 0 && (
                      <div style={{marginBottom:14}}>
                        <div style={{fontSize:9,color:'#4a5260',fontFamily:'monospace',letterSpacing:'0.08em',marginBottom:8}}>WHAT TO DO NOW</div>
                        {parsedResult.actions.map((action, i) => (
                          <div key={i} style={{display:'flex',gap:10,marginBottom:8,padding:'11px 13px',background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:8,alignItems:'flex-start'}}>
                            <div style={{width:22,height:22,borderRadius:'50%',background:i===0?sev.color:'rgba(255,255,255,0.08)',color:i===0?'#000':'#8a9099',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0,marginTop:1}}>{i+1}</div>
                            <div style={{fontSize:14,color:'#e8eaed',lineHeight:1.5,fontWeight:i===0?500:400}}>{action}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {parsedResult.detail && (
                      <div style={{marginBottom:14}}>
                        <button onClick={() => setShowDetail(v=>!v)} style={{width:'100%',padding:'9px 13px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:8,color:'#4a5260',fontSize:12,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <span>Full ops analysis</span><span>{showDetail?'▲':'▼'}</span>
                        </button>
                        {showDetail && (
                          <div style={{padding:'12px 14px',background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'0 0 8px 8px',borderTop:'none'}}>
                            {parsedResult.detail.split('\n').map((line,i) => {
                              if (!line.trim()) return <div key={i} style={{height:5}}/>
                              const cl = line.replace(/\*\*/g,'').replace(/^[#\-]\s*/,'').trim()
                              const bold = line.match(/^[A-Z\s\/]+:$/)
                              return <div key={i} style={{fontSize:12,color:bold?'#e8eaed':'#8a9099',lineHeight:1.7,fontWeight:bold?500:400,marginBottom:1}}>{cl}</div>
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    <button onClick={closePanel} style={{width:'100%',padding:14,background:'#00e5b0',border:'none',borderRadius:8,color:'#000',fontWeight:600,fontSize:15,cursor:'pointer',marginBottom:8}}>
                      Got it — close
                    </button>
                    <button onClick={() => setPanelState('resolving')} style={{width:'100%',padding:12,background:'transparent',border:'1px solid rgba(0,229,176,0.25)',borderRadius:8,color:'#00e5b0',fontWeight:500,fontSize:14,cursor:'pointer'}}>
                      ✅ Issue resolved — back on track
                    </button>
                  </div>
                )
              })()}

              {/* RESOLVING — pick reason */}
              {panelState==='resolving' && (
                <div>
                  <div style={{fontSize:15,fontWeight:600,color:'#e8eaed',marginBottom:4}}>What happened?</div>
                  <div style={{fontSize:12,color:'#4a5260',marginBottom:14}}>Ops will be notified and your job updates to on-track.</div>
                  {[
                    { id:'breakdown_recovered', label:'🔧 Breakdown recovered',    sub:'Vehicle moving again' },
                    { id:'delay_cleared',        label:'🟢 Delay cleared',          sub:'Back on schedule' },
                    { id:'temp_back_in_range',   label:'❄ Temp back in range',     sub:'Cold chain restored' },
                    { id:'rerouted_clear',        label:'🛣 Rerouted — clear now',  sub:'New route confirmed' },
                    { id:'collection_complete',  label:'📍 Collection complete',   sub:'Loading done, departing' },
                    { id:'delivery_accepted',    label:'📦 Delivery accepted',      sub:'POD signed' },
                    { id:'other_resolved',       label:'✅ Other — resolved',       sub:'Issue no longer active' },
                  ].map(opt => (
                    <button key={opt.id} onClick={() => resolveIssue(opt.label)}
                      style={{width:'100%',marginBottom:7,padding:'11px 13px',background:'rgba(0,229,176,0.04)',border:'1px solid rgba(0,229,176,0.12)',borderRadius:9,cursor:'pointer',textAlign:'left',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div>
                        <div style={{fontSize:14,color:'#e8eaed',fontWeight:500}}>{opt.label}</div>
                        <div style={{fontSize:11,color:'#4a5260',marginTop:1}}>{opt.sub}</div>
                      </div>
                      <span style={{color:'#00e5b0',fontSize:14}}>→</span>
                    </button>
                  ))}
                  <button onClick={() => setPanelState('result')} style={{width:'100%',padding:9,background:'transparent',border:'none',color:'#4a5260',fontSize:12,cursor:'pointer',marginTop:2}}>← Back</button>
                </div>
              )}

              {/* RESOLVING LOADING */}
              {panelState==='resolving_loading' && (
                <div style={{textAlign:'center',padding:'40px 0'}}>
                  <div style={{width:36,height:36,border:'3px solid rgba(0,229,176,0.15)',borderTop:'3px solid #00e5b0',borderRadius:'50%',margin:'0 auto 14px',animation:'spin 1s linear infinite'}}/>
                  <div style={{fontSize:13,color:'#00e5b0',fontFamily:'monospace'}}>NOTIFYING OPS...</div>
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
              )}

              {/* RESOLVED */}
              {panelState==='resolved' && (
                <div style={{textAlign:'center',padding:'20px 0'}}>
                  <div style={{fontSize:40,marginBottom:10}}>✅</div>
                  <div style={{fontSize:18,color:'#00e5b0',fontWeight:600,marginBottom:5}}>Back on track</div>
                  <div style={{fontSize:12,color:'#8a9099',marginBottom:resolvedEta?12:20}}>Ops notified. Job updated.</div>
                  {resolvedEta && <div style={{padding:'10px 14px',background:'rgba(0,229,176,0.06)',border:'1px solid rgba(0,229,176,0.2)',borderRadius:8,marginBottom:20,fontSize:13,color:'#e8eaed',lineHeight:1.5}}>{resolvedEta}</div>}
                  <button onClick={closePanel} style={{padding:'12px 40px',background:'#00e5b0',border:'none',borderRadius:8,color:'#000',fontWeight:600,fontSize:14,cursor:'pointer'}}>Close</button>
                </div>
              )}

              {/* SENT */}
              {panelState==='sent' && (
                <div style={{textAlign:'center',padding:'28px 0'}}>
                  <div style={{fontSize:36,marginBottom:10}}>✅</div>
                  <div style={{fontSize:15,color:'#00e5b0',fontWeight:600,marginBottom:5}}>Ops notified</div>
                  <div style={{fontSize:12,color:'#4a5260',marginBottom:20}}>Your manager has been alerted.</div>
                  <button onClick={closePanel} style={{padding:'11px 32px',background:'#00e5b0',border:'none',borderRadius:7,color:'#000',fontWeight:600,fontSize:13,cursor:'pointer'}}>Close</button>
                </div>
              )}

              {/* LOADING */}
              {panelState==='loading' && (
                <div style={{textAlign:'center',padding:'40px 0'}}>
                  <div style={{width:36,height:36,border:'3px solid rgba(0,229,176,0.15)',borderTop:'3px solid #00e5b0',borderRadius:'50%',margin:'0 auto 14px',animation:'spin 1s linear infinite'}}/>
                  <div style={{fontSize:12,color:'#00e5b0',fontFamily:'monospace',marginBottom:4}}>GETTING INSTRUCTIONS...</div>
                  <div style={{fontSize:11,color:'#4a5260'}}>Ops manager alerted</div>
                </div>
              )}

              {/* IDLE */}
              {panelState==='idle' && (
                <>
                  {panelAction==='breakdown' && <div style={{padding:'10px 12px',background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:8,marginBottom:12,fontSize:12,color:'#ef4444',fontWeight:500}}>🚑 If anyone is injured — call 999 first</div>}
                  {panelAction==='rest' && <div style={{padding:'10px 12px',background:'rgba(168,85,247,0.06)',border:'1px solid rgba(168,85,247,0.2)',borderRadius:8,marginBottom:12,fontSize:12,color:'#a855f7'}}>Nearest safe truck park for your break</div>}
                  {panelAction==='temp_check' && <div style={{padding:'10px 12px',background:'rgba(6,182,212,0.06)',border:'1px solid rgba(6,182,212,0.2)',borderRadius:8,marginBottom:12,fontSize:12,color:'#06b6d4'}}>Enter probe reading — not the unit display</div>}
                  {['breakdown','delayed','temp_check','defect'].includes(panelAction) && (
                    <textarea value={inputText} onChange={e=>setInputText(e.target.value)} rows={3}
                      placeholder={panelAction==='breakdown'?'What happened? e.g. Engine warning light, white smoke, M62 J25':panelAction==='delayed'?'What is causing the delay?':panelAction==='temp_check'?'e.g. 3.2°C probe reading':'Describe the issue...'}
                      style={{width:'100%',padding:'11px 12px',background:'#0d1014',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#e8eaed',fontSize:14,lineHeight:1.6,outline:'none',resize:'none',boxSizing:'border-box',marginBottom:12}}/>
                  )}
                  {activeJob && (
                    <div style={{padding:'7px 11px',background:'rgba(0,229,176,0.04)',border:'1px solid rgba(0,229,176,0.1)',borderRadius:7,fontSize:11,color:'#8a9099',marginBottom:14}}>
                      Job: <span style={{color:'#00e5b0'}}>{activeJob.ref}</span> · {activeJob.route}
                    </div>
                  )}
                  <button onClick={sendAlert}
                    style={{width:'100%',padding:14,background:panelAction==='breakdown'?'#ef4444':'#00e5b0',border:'none',borderRadius:8,color:panelAction==='breakdown'?'#fff':'#000',fontWeight:600,fontSize:15,cursor:'pointer',marginBottom:8}}>
                    {panelAction==='breakdown'?'🚨 Alert ops now':panelAction==='rest'?'🛌 Find safe parking →':panelAction==='temp_check'?'🌡 Log & check →':'⚠ Get instructions →'}
                  </button>
                  <div style={{fontSize:11,color:'#4a5260',textAlign:'center'}}>
                    {['breakdown','delayed','defect','temp_check','rest'].includes(panelAction)?'Ops manager notified immediately':'Instructions in seconds'}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
