'use client'
import { useState, useEffect } from 'react'

const QUICK_ACTIONS = [
  { id:'arrived_collection', label:'At Collection', icon:'📍', color:'#3b82f6' },
  { id:'loading_complete',   label:'Loaded',        icon:'✅', color:'#00e5b0' },
  { id:'arrived_delivery',   label:'At Customer',   icon:'🏭', color:'#3b82f6' },
  { id:'delivered',          label:'Delivered',     icon:'📦', color:'#00e5b0' },
  { id:'fuel',               label:'Fuel Stop',     icon:'⛽', color:'#f59e0b' },
  { id:'rest',               label:'Rest Break',    icon:'🛌', color:'#a855f7', highlight: true },
  { id:'temp_check',         label:'Temp Check',    icon:'🌡', color:'#06b6d4' },
  { id:'breakdown',          label:'Breakdown',     icon:'🚨', color:'#ef4444', highlight: true },
]

const STATUS_COLORS = {
  'on-track':  { dot:'#00e5b0', label:'ON-TRACK',  border:'rgba(0,229,176,0.25)',  bg:'rgba(0,229,176,0.04)' },
  disrupted:   { dot:'#ef4444', label:'DISRUPTED', border:'rgba(239,68,68,0.25)',  bg:'rgba(239,68,68,0.04)' },
  delayed:     { dot:'#f59e0b', label:'DELAYED',   border:'rgba(245,158,11,0.25)', bg:'rgba(245,158,11,0.04)' },
  pending:     { dot:'#3b82f6', label:'PENDING',   border:'rgba(59,130,246,0.25)', bg:'rgba(59,130,246,0.04)' },
  completed:   { dot:'#3b82f6', label:'DONE',      border:'rgba(59,130,246,0.15)', bg:'#111418' },
}

export default function DriverApp() {
  const [jobs, setJobs]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [activeJob, setActiveJob]   = useState(null)
  const [driverInfo, setDriverInfo] = useState({ name:'', clientId:'', vehicleReg:'' })
  const [setupDone, setSetupDone]   = useState(false)
  const [notification, setNotification] = useState(null)

  const [panelOpen, setPanelOpen]     = useState(false)
  const [panelAction, setPanelAction] = useState(null)
  const [panelState, setPanelState]   = useState('idle')
  const [inputText, setInputText]     = useState('')
  const [resultText, setResultText]   = useState('')

  const [gpsCoords, setGpsCoords]         = useState(null)
  const [gpsDescription, setGpsDescription] = useState('')
  const [gpsStatus, setGpsStatus]         = useState(null)

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
  }, [])

  function showNotif(msg, type='info') {
    setNotification({ msg, type })
    setTimeout(() => setNotification(null), 4000)
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
    } catch { showNotif('Could not load jobs','error') }
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

  function openPanel(actionId) {
    setPanelAction(actionId)
    setPanelOpen(true)
    setPanelState('idle')
    setInputText('')
    setResultText('')
    getGPS()
  }

  function closePanel() {
    setPanelOpen(false)
    setPanelAction(null)
    setPanelState('idle')
    setInputText('')
    setResultText('')
  }

  function buildPrompt(actionId) {
    const loc = gpsDescription || 'location not confirmed'
    const job = activeJob
    const prompts = {
      fuel:              `Driver ${driverInfo.name} (${driverInfo.vehicleReg}) stopping for fuel at ${loc}. Job: ${job?.route||'unknown'}. Cargo: ${job?.cargo_type||'unknown'}. Find cheapest fuel nearby and SLA risk for ${job?.sla_window ? 'slot '+job.sla_window : 'current delivery'}.`,
      rest:              `DRIVER REST BREAK — ${driverInfo.name} (${driverInfo.vehicleReg}). Location: ${loc}. Job: ${job?.route||'unknown'}. Cargo: ${job?.cargo_type||'unknown'}, value: £${job?.cargo_value?.toLocaleString()||'unknown'}. Assess theft risk. Recommend nearest accredited secure truck parks with name, junction, distance, cost. SLA impact after rest.`,
      delayed:           `Driver ${driverInfo.name} (${driverInfo.vehicleReg}) running late. Location: ${loc}. Job: ${job?.route||'unknown'}. SLA: ${job?.sla_window||'unknown'}. Penalty: £${job?.penalty_if_breached?.toLocaleString()||'unknown'}. ${inputText ? 'Reason: '+inputText : ''} Revised ETA with 1.5x buffer. Is SLA salvageable?`,
      temp_check:        `Cold chain log — ${driverInfo.name} (${driverInfo.vehicleReg}). Location: ${loc}. Cargo: ${job?.cargo_type||'temperature controlled'}. Reading: ${inputText||'not entered'}. Assess against thresholds. Action required?`,
      defect:            `Vehicle defect — ${driverInfo.vehicleReg}, ${driverInfo.name}. Location: ${loc}. Defect: ${inputText||'driver reported defect'}. Roadworthiness risk, DVSA prohibition likelihood. Can vehicle continue?`,
      breakdown:         `BREAKDOWN EMERGENCY — ${driverInfo.vehicleReg}, ${driverInfo.name}. Location: ${loc}. ${inputText ? 'Issue: '+inputText : 'Vehicle breakdown.'} Job: ${job?.route||'unknown'}. Cargo: ${job?.cargo_type||'unknown'}, value: £${job?.cargo_value?.toLocaleString()||'unknown'}. Immediate action plan — safety, recovery, SLA mitigation.`,
      arrived_collection:`${driverInfo.name} (${driverInfo.vehicleReg}) arrived at collection. Location: ${loc}. Job: ${job?.route||'unknown'}. Cargo: ${job?.cargo_type||'unknown'}. Load security checklist and pre-departure checks.`,
      loading_complete:  `${driverInfo.name} (${driverInfo.vehicleReg}) loaded, ready to depart. Job: ${job?.route||'unknown'}. Cargo: ${job?.cargo_type||'unknown'}. SLA: ${job?.sla_window||'unknown'}. ETA with 1.5x buffer and route hazards.`,
      arrived_delivery:  `${driverInfo.name} (${driverInfo.vehicleReg}) arrived at delivery. Location: ${loc}. Job: ${job?.route||'unknown'}. SLA: ${job?.sla_window||'unknown'}. Delivery checklist — POD, cold chain log, rejected goods procedure.`,
      delivered:         `Delivery confirmed — ${driverInfo.name} (${driverInfo.vehicleReg}). Job: ${job?.route||'unknown'} complete. ${inputText ? 'Notes: '+inputText : ''} Log completion, confirm POD, advise next steps.`,
    }
    return prompts[actionId] || `Driver ${driverInfo.name} reports: ${inputText || actionId}. Location: ${loc}.`
  }

  async function sendAlert() {
    setPanelState('loading')
    const prompt = buildPrompt(panelAction)
    const job = activeJob

    // Fire SMS immediately — no await, fire and forget
    const significantActions = ['rest','breakdown','delayed','defect','temp_check']
    if (significantActions.includes(panelAction)) {
      fetch('/api/driver/alert', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          client_id: driverInfo.clientId,
          driver_name: driverInfo.name,
          vehicle_reg: driverInfo.vehicleReg,
          ref: job?.ref,
          issue_description: prompt,
          location_description: gpsDescription,
          latitude: gpsCoords?.latitude,
          longitude: gpsCoords?.longitude,
        })
      }).catch(()=>{})
    }

    // Stream agent analysis for display
    try {
      const res = await fetch('/api/agent', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ messages:[{ role:'user', content:prompt }] })
      })
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      setPanelState('result')
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const parsed = JSON.parse(line.slice(6))
              if (parsed.text) { fullText += parsed.text; setResultText(fullText) }
            } catch {}
          }
        }
      }
    } catch {
      setPanelState('sent')
    }
  }

  function saveDriverInfo() {
    if (!driverInfo.name || !driverInfo.clientId) return
    localStorage.setItem('dh_driver_info', JSON.stringify(driverInfo))
    setSetupDone(true)
    loadJobs(driverInfo)
  }

  const cargoIcon = (type) => {
    if (!type) return '📦'
    if (type.includes('pharma')) return '💊'
    if (type.includes('frozen')) return '🧊'
    if (type.includes('chilled')) return '❄'
    return '📦'
  }

  // ── SETUP SCREEN ──────────────────────────────────────────────────────────────
  if (!setupDone) {
    return (
      <div style={{minHeight:'100vh',background:'#0a0c0e',color:'#e8eaed',fontFamily:'IBM Plex Sans,sans-serif',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
        <div style={{width:'100%',maxWidth:360}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:32}}>
            <div style={{width:32,height:32,background:'#00e5b0',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#000',fontFamily:'monospace'}}>DH</div>
            <div>
              <div style={{fontSize:14,fontWeight:500}}>DisruptionHub</div>
              <div style={{fontSize:11,color:'#4a5260',fontFamily:'monospace'}}>Driver App</div>
            </div>
          </div>
          <div style={{fontSize:11,color:'#4a5260',fontFamily:'monospace',letterSpacing:'0.08em',marginBottom:16}}>SETUP — ONE TIME ONLY</div>
          {[
            { label:'Your name',            key:'name',       placeholder:'e.g. Carl Hughes' },
            { label:'Vehicle registration', key:'vehicleReg', placeholder:'e.g. BK21 XYZ' },
            { label:'Company access code',  key:'clientId',   placeholder:'Given by your manager' },
          ].map(f => (
            <div key={f.key} style={{marginBottom:14}}>
              <div style={{fontSize:11,color:'#8a9099',marginBottom:5}}>{f.label}</div>
              <input value={driverInfo[f.key]} onChange={e => setDriverInfo(p => ({...p,[f.key]:e.target.value}))}
                placeholder={f.placeholder}
                style={{width:'100%',padding:'11px 14px',background:'#111418',border:'1px solid rgba(255,255,255,0.1)',borderRadius:7,color:'#e8eaed',fontSize:14,outline:'none',boxSizing:'border-box'}}/>
            </div>
          ))}
          <button onClick={saveDriverInfo}
            style={{width:'100%',padding:13,background:'#00e5b0',border:'none',borderRadius:7,color:'#000',fontWeight:600,fontSize:14,cursor:'pointer',marginTop:8}}>
            Set up my app →
          </button>
        </div>
      </div>
    )
  }

  // ── MAIN APP ──────────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:'100vh',background:'#0a0c0e',color:'#e8eaed',fontFamily:'IBM Plex Sans,sans-serif',position:'relative'}}>

      {notification && (
        <div style={{position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',zIndex:999,padding:'10px 20px',borderRadius:8,background:notification.type==='error'?'#ef4444':'#00e5b0',color:notification.type==='error'?'#fff':'#000',fontSize:13,fontWeight:500,whiteSpace:'nowrap',boxShadow:'0 4px 20px rgba(0,0,0,0.4)'}}>
          {notification.msg}
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
        <button onClick={() => openPanel('breakdown')}
          style={{padding:'7px 12px',background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.35)',borderRadius:7,color:'#ef4444',fontSize:11,fontWeight:600,cursor:'pointer'}}>
          ⚠ Alert Ops
        </button>
      </div>

      {/* CONTENT */}
      <div style={{paddingBottom:40}}>

        {/* Today header */}
        <div style={{padding:'14px 16px 8px'}}>
          <div style={{fontSize:10,color:'#4a5260',fontFamily:'monospace',letterSpacing:'0.08em',marginBottom:3}}>
            TODAY — {new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}).toUpperCase()}
          </div>
          <div style={{fontSize:17,fontWeight:500}}>
            {loading ? 'Loading...' : `${jobs.length} run${jobs.length!==1?'s':''} today`}
          </div>
        </div>

        {/* JOB CARDS */}
        {jobs.map(job => {
          const sc = STATUS_COLORS[job.status] || STATUS_COLORS['on-track']
          const isActive = activeJob?.ref === job.ref
          return (
            <div key={job.ref} onClick={() => setActiveJob(job)}
              style={{margin:'0 12px 8px',padding:'13px 14px',borderRadius:10,cursor:'pointer',border:`1px solid ${isActive?'#00e5b0':sc.border}`,background:sc.bg,transition:'all 0.15s'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                <span style={{fontFamily:'monospace',fontSize:13,fontWeight:600}}>{job.ref}</span>
                <div style={{display:'flex',alignItems:'center',gap:5}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:sc.dot}}/>
                  <span style={{fontFamily:'monospace',fontSize:10,color:sc.dot}}>{sc.label}</span>
                </div>
              </div>
              <div style={{fontSize:13,color:'#8a9099',marginBottom:3}}>{job.route}</div>
              <div style={{display:'flex',gap:12,fontSize:11,color:'#4a5260',flexWrap:'wrap'}}>
                {job.carrier && <span>{job.carrier}</span>}
                {job.eta && <span>ETA {job.eta}</span>}
                {job.sla_window && <span>Slot {job.sla_window}</span>}
              </div>
              {job.cargo_type && (
                <div style={{marginTop:6,fontSize:11,color:'#3b82f6'}}>{cargoIcon(job.cargo_type)} {job.cargo_type}</div>
              )}
              {job.alert && (
                <div style={{marginTop:7,padding:'5px 9px',background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:5,fontSize:10,color:'#f59e0b'}}>⚠ {job.alert}</div>
              )}
              {isActive && (
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginTop:12,paddingTop:12,borderTop:'1px solid rgba(255,255,255,0.06)'}}>
                  <button onClick={e => { e.stopPropagation(); openPanel('defect') }}
                    style={{padding:'9px 8px',borderRadius:7,fontSize:12,fontWeight:500,cursor:'pointer',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',color:'#ef4444'}}>
                    ⚠ Report issue
                  </button>
                  <button onClick={e => { e.stopPropagation(); openPanel('delivered') }}
                    style={{padding:'9px 8px',borderRadius:7,fontSize:12,fontWeight:500,cursor:'pointer',background:'rgba(0,229,176,0.06)',border:'1px solid rgba(0,229,176,0.2)',color:'#00e5b0'}}>
                    ✓ Confirm delivery
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {/* QUICK ACTIONS */}
        <div style={{padding:'10px 16px 6px',fontSize:9,color:'#4a5260',fontFamily:'monospace',letterSpacing:'0.08em'}}>QUICK ACTIONS — TAP TO LOG</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,padding:'0 12px 12px'}}>
          {QUICK_ACTIONS.map(action => (
            <button key={action.id} onClick={() => openPanel(action.id)}
              style={{padding:'10px 4px',borderRadius:8,background:action.highlight?`${action.color}0f`:'#111418',border:`1px solid ${action.highlight?`${action.color}4d`:'rgba(255,255,255,0.06)'}`,display:'flex',flexDirection:'column',alignItems:'center',gap:5,cursor:'pointer',outline:'none'}}>
              <span style={{fontSize:18}}>{action.icon}</span>
              <span style={{fontSize:9,color:action.highlight?action.color:'#8a9099',textAlign:'center',lineHeight:1.3}}>{action.label}</span>
            </button>
          ))}
        </div>

        <div style={{padding:'0 16px'}}>
          <button onClick={() => { localStorage.removeItem('dh_driver_info'); setSetupDone(false); setJobs([]); setActiveJob(null) }}
            style={{width:'100%',padding:10,background:'transparent',border:'1px solid rgba(255,255,255,0.06)',borderRadius:6,color:'#4a5260',fontSize:11,cursor:'pointer'}}>
            Change driver / vehicle
          </button>
        </div>
      </div>

      {/* ALERT PANEL */}
      {panelOpen && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:200,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}
          onClick={e => { if (e.target===e.currentTarget) closePanel() }}>
          <div style={{background:'#111418',borderRadius:'16px 16px 0 0',maxHeight:'88vh',display:'flex',flexDirection:'column',borderTop:'1px solid rgba(255,255,255,0.08)'}}>

            <div style={{padding:'18px 20px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <span style={{fontSize:12,fontWeight:600,color:'#ef4444',fontFamily:'monospace',letterSpacing:'0.06em'}}>
                {panelAction==='breakdown'?'BREAKDOWN ALERT':panelAction==='rest'?'REST BREAK REQUEST':panelAction==='temp_check'?'TEMPERATURE LOG':'ALERT OPS — AUTO ANALYSIS'}
              </span>
              <button onClick={closePanel} style={{background:'none',border:'none',color:'#4a5260',fontSize:20,cursor:'pointer',lineHeight:1}}>✕</button>
            </div>

            <div style={{overflowY:'auto',flex:1,padding:'0 20px 28px'}}>

              {/* GPS bar */}
              <div style={{padding:'9px 11px',background:'#0d1014',borderRadius:7,display:'flex',alignItems:'center',gap:9,marginBottom:12}}>
                <div style={{width:7,height:7,borderRadius:'50%',flexShrink:0,background:gpsStatus==='got'?'#00e5b0':gpsStatus==='getting'?'#f59e0b':'#4a5260'}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:9,color:'#4a5260',fontFamily:'monospace'}}>YOUR LOCATION</div>
                  <div style={{fontSize:11,color:gpsStatus==='got'?'#e8eaed':'#8a9099'}}>
                    {gpsStatus==='getting'?'Getting GPS...':gpsStatus==='got'?gpsDescription:'GPS unavailable — include location below'}
                  </div>
                </div>
                {gpsStatus!=='got'&&gpsStatus!=='getting'&&(
                  <button onClick={getGPS} style={{padding:'4px 10px',background:'rgba(0,229,176,0.08)',border:'1px solid rgba(0,229,176,0.2)',borderRadius:5,color:'#00e5b0',fontSize:11,cursor:'pointer'}}>Get GPS</button>
                )}
              </div>

              {/* RESULT STATE */}
              {panelState==='result' && (
                <div>
                  <div style={{fontSize:10,color:'#00e5b0',fontFamily:'monospace',letterSpacing:'0.06em',marginBottom:10}}>INSTRUCTIONS FROM OPS</div>
                  {resultText.split('\n').map((line,i) => {
                    if (!line.trim()) return null
                    const isHeading = line.startsWith('##')
                    const isAction  = /^[123]\.\s/.test(line)
                    const isDash    = line.startsWith('—')||line.startsWith('- ')
                    const cl = line.replace(/^##\s*/,'').replace(/\*\*/g,'').replace(/^[—\-]\s*/,'').replace(/^[123]\.\s*/,'').trim()
                    if (!cl) return null
                    if (isHeading) return <div key={i} style={{fontSize:10,color:'#00e5b0',fontFamily:'monospace',letterSpacing:'0.06em',marginTop:14,marginBottom:6,paddingTop:10,borderTop:'1px solid rgba(255,255,255,0.06)'}}>{cl}</div>
                    if (isAction) return (
                      <div key={i} style={{display:'flex',gap:8,marginBottom:8,padding:'8px 10px',background:'rgba(239,68,68,0.05)',border:'1px solid rgba(239,68,68,0.12)',borderRadius:6}}>
                        <span style={{fontSize:11,color:'#ef4444',fontFamily:'monospace',fontWeight:700,flexShrink:0}}>{line.match(/^[123]/)?.[0]}.</span>
                        <span style={{fontSize:12,color:'#e8eaed',lineHeight:1.5}}>{cl}</span>
                      </div>
                    )
                    return <div key={i} style={{fontSize:12,color:isDash?'#8a9099':'#e8eaed',lineHeight:1.6,marginBottom:4,paddingLeft:isDash?8:0}}>{cl}</div>
                  })}
                  <button onClick={closePanel} style={{width:'100%',marginTop:20,padding:13,background:'#00e5b0',border:'none',borderRadius:8,color:'#000',fontWeight:600,fontSize:14,cursor:'pointer'}}>Got it — close</button>
                </div>
              )}

              {/* SENT STATE */}
              {panelState==='sent' && (
                <div style={{textAlign:'center',padding:'28px 0'}}>
                  <div style={{fontSize:32,marginBottom:12}}>✅</div>
                  <div style={{fontSize:14,color:'#00e5b0',fontWeight:500,marginBottom:6}}>Alert sent to ops</div>
                  <div style={{fontSize:12,color:'#4a5260',marginBottom:20}}>Your ops manager has been notified.</div>
                  <button onClick={closePanel} style={{padding:'10px 28px',background:'#00e5b0',border:'none',borderRadius:7,color:'#000',fontWeight:600,fontSize:13,cursor:'pointer'}}>Close</button>
                </div>
              )}

              {/* LOADING STATE */}
              {panelState==='loading' && (
                <div style={{textAlign:'center',padding:'32px 0'}}>
                  <div style={{fontSize:11,color:'#00e5b0',fontFamily:'monospace',marginBottom:8}}>ALERTING OPS...</div>
                  <div style={{fontSize:12,color:'#4a5260'}}>AI analysis running</div>
                </div>
              )}

              {/* IDLE STATE */}
              {panelState==='idle' && (
                <>
                  {panelAction==='breakdown' && <div style={{padding:'9px 11px',background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:7,marginBottom:12,fontSize:11,color:'#ef4444'}}>If anyone is injured — call 999 first</div>}
                  {panelAction==='rest' && <div style={{padding:'9px 11px',background:'rgba(168,85,247,0.06)',border:'1px solid rgba(168,85,247,0.2)',borderRadius:7,marginBottom:12,fontSize:11,color:'#a855f7'}}>Theft risk check + secure parking recommendations</div>}
                  {panelAction==='temp_check' && <div style={{padding:'9px 11px',background:'rgba(6,182,212,0.06)',border:'1px solid rgba(6,182,212,0.2)',borderRadius:7,marginBottom:12,fontSize:11,color:'#06b6d4'}}>Enter probe reading — not the unit display</div>}

                  <textarea value={inputText} onChange={e => setInputText(e.target.value)} rows={3}
                    placeholder={
                      panelAction==='breakdown'?'e.g. Engine warning light, white smoke, M62 near J25...':
                      panelAction==='delayed'?'e.g. M62 standstill, accident ahead':
                      panelAction==='temp_check'?'e.g. 3.2°C probe reading':
                      panelAction==='defect'?'e.g. Pull to left on braking, front nearside':
                      'Describe what has happened...'
                    }
                    style={{width:'100%',padding:'10px 12px',background:'#0d1014',border:'1px solid rgba(255,255,255,0.1)',borderRadius:7,color:'#e8eaed',fontSize:13,lineHeight:1.6,outline:'none',resize:'none',boxSizing:'border-box',marginBottom:10}}/>

                  {activeJob && (
                    <div style={{padding:'7px 11px',background:'rgba(0,229,176,0.04)',border:'1px solid rgba(0,229,176,0.1)',borderRadius:6,fontSize:11,color:'#8a9099',marginBottom:12}}>
                      Alerting against: <span style={{color:'#00e5b0'}}>{activeJob.ref}</span> · {activeJob.route}
                    </div>
                  )}

                  <button onClick={sendAlert}
                    style={{width:'100%',padding:13,background:panelAction==='breakdown'?'#ef4444':'#00e5b0',border:'none',borderRadius:8,color:panelAction==='breakdown'?'#fff':'#000',fontWeight:600,fontSize:14,cursor:'pointer',marginBottom:8}}>
                    {panelAction==='breakdown'?'🚨 Send alert to ops now':panelAction==='rest'?'🛌 Get secure parking options →':panelAction==='temp_check'?'🌡 Log temperature →':'⚠ Send alert to ops now'}
                  </button>
                  <div style={{fontSize:11,color:'#4a5260',textAlign:'center'}}>Triggers immediate AI analysis · wakes ops manager if CRITICAL</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
