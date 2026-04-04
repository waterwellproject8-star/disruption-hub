'use client'
import { useState, useEffect } from 'react'

// ── QUICK ACTIONS ─────────────────────────────────────────────────────────────
// Each action has an id, label, icon, colour, and what it does
const QUICK_ACTIONS = [
  // Row 1 — delivery flow
  { id:'arrived_collection', label:'At Collection', icon:'📍', color:'#3b82f6', desc:'Arrived at pickup' },
  { id:'loading_complete',   label:'Loaded',        icon:'✅', color:'#00e5b0', desc:'Load secured, ready to go' },
  { id:'arrived_delivery',   label:'At Customer',   icon:'🏭', color:'#3b82f6', desc:'Arrived at drop-off' },
  { id:'delivered',          label:'Delivered',     icon:'📦', color:'#00e5b0', desc:'POD signed, delivery complete' },
  // Row 2 — stops and breaks
  { id:'fuel',               label:'Fuel Stop',     icon:'⛽', color:'#f59e0b', desc:'Stopping for fuel' },
  { id:'rest',               label:'Rest Break',    icon:'🛌', color:'#a855f7', desc:'Mandatory rest — gets secure parking' },
  { id:'service_station',    label:'Services',      icon:'🅿', color:'#6b7280', desc:'Brief services stop' },
  { id:'weigh_bridge',       label:'Weigh Bridge',  icon:'⚖️', color:'#6b7280', desc:'At weigh station' },
  // Row 3 — issues and compliance
  { id:'delayed',            label:'Running Late',  icon:'⏰', color:'#f59e0b', desc:'Behind schedule' },
  { id:'temp_check',         label:'Temp Check',    icon:'🌡', color:'#06b6d4', desc:'Cold chain temperature log' },
  { id:'defect',             label:'Vehicle Issue', icon:'🔧', color:'#f59e0b', desc:'Non-urgent defect to report' },
  { id:'breakdown',          label:'Breakdown',     icon:'🚨', color:'#ef4444', desc:'Vehicle broken down — urgent' },
]

const STATUS_COLORS = {
  'on-track':  { bg:'#0d1f15', border:'rgba(0,229,176,0.25)', dot:'#00e5b0', label:'ON-TRACK'  },
  disrupted:   { bg:'#1f0d0d', border:'rgba(239,68,68,0.25)',  dot:'#ef4444', label:'DISRUPTED' },
  delayed:     { bg:'#1f1a0d', border:'rgba(245,158,11,0.25)', dot:'#f59e0b', label:'DELAYED'   },
  pending:     { bg:'#0d1220', border:'rgba(59,130,246,0.25)', dot:'#3b82f6', label:'PENDING'   },
  completed:   { bg:'#111418', border:'rgba(59,130,246,0.15)', dot:'#3b82f6', label:'DONE'      },
}

export default function DriverApp() {
  const [jobs, setJobs]               = useState([])
  const [loading, setLoading]         = useState(true)
  const [activeJob, setActiveJob]     = useState(null)
  const [notification, setNotification] = useState(null)
  const [driverInfo, setDriverInfo]   = useState({ id:'', name:'', clientId:'', vehicleReg:'' })
  const [setupDone, setSetupDone]     = useState(false)

  // Active panel state — which quick action is open
  const [activePanel, setActivePanel] = useState(null) // action id
  const [panelState, setPanelState]   = useState('idle') // idle | loading | result | error
  const [panelData, setPanelData]     = useState(null)

  // GPS state
  const [gpsCoords, setGpsCoords]     = useState(null)
  const [gpsDescription, setGpsDescription] = useState('')
  const [gpsStatus, setGpsStatus]     = useState(null)

  // Form inputs for panels that need text
  const [inputText, setInputText]     = useState('')

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
      const mapped = (data.shipments||[]).map(s=>({
        ref:s.ref, route:s.route, carrier:s.carrier,
        status:s.status, eta:s.eta, sla_window:s.sla_window,
        cargo_type:s.cargo_type, alert:s.alert,
        penalty_if_breached:s.penalty_if_breached,
        cargo_value:s.cargo_value
      }))
      setJobs(mapped)
      if (mapped.length>0) setActiveJob(mapped[0])
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
          const road = data.address?.road||data.address?.motorway||''
          const area = data.address?.suburb||data.address?.town||data.address?.county||''
          setGpsDescription([road,area].filter(Boolean).join(', ')||`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
        } catch { setGpsDescription(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`) }
      },
      () => setGpsStatus('failed'),
      { enableHighAccuracy:true, timeout:10000, maximumAge:0 }
    )
  }

  function openPanel(actionId) {
    setActivePanel(actionId)
    setPanelState('idle')
    setPanelData(null)
    setInputText('')
    // Auto-get GPS for location-sensitive actions
    const gpsActions = ['fuel','rest','service_station','delayed','breakdown','defect','arrived_collection','arrived_delivery']
    if (gpsActions.includes(actionId)) getGPS()
  }

  function closePanel() {
    setActivePanel(null)
    setPanelState('idle')
    setPanelData(null)
    setInputText('')
  }

  async function submitAction(actionId) {
    setPanelState('loading')
    const loc = gpsDescription || 'location not confirmed'
    const job = activeJob

    try {
      // Build a natural-language prompt for the agent based on the action type
      const prompts = {
        fuel: `Driver ${driverInfo.name} (${driverInfo.vehicleReg}) is stopping for fuel at ${loc}. Current job: ${job?.route||'unknown'}. Cargo: ${job?.cargo_type||'unknown'}. Find cheapest fuel nearby and advise on whether to fill now or wait. Also check if this stop creates any SLA risk for ${job?.sla_window ? 'slot '+job.sla_window : 'current delivery'}.`,

        rest: `DRIVER REST BREAK REQUEST — ${driverInfo.name} (${driverInfo.vehicleReg}) needs to take a mandatory WTD rest break. Current location: ${loc}. Job: ${job?.route||'unknown'}. Cargo: ${job?.cargo_type||'unknown'}, value: £${job?.cargo_value?.toLocaleString()||'unknown'}. Assess theft risk at current location and nearby rest options. Provide specific accredited secure truck park recommendations with name, junction, distance, and cost. Compare cost of secure parking vs cargo value at risk. Also calculate impact on delivery ETA and whether SLA can still be met after the break.`,

        service_station: `Driver ${driverInfo.name} (${driverInfo.vehicleReg}) is stopping at services at ${loc}. Job: ${job?.route||'unknown'}. Cargo: ${job?.cargo_type||'unknown'}, value: £${job?.cargo_value?.toLocaleString()||'unknown'}. Assess: (1) theft risk for this services stop, (2) maximum safe stop duration before SLA is at risk, (3) any action required before stopping (locking cargo, checking refrigeration unit).`,

        delayed: `Driver ${driverInfo.name} (${driverInfo.vehicleReg}) is running late. Current location: ${loc}. Job: ${job?.route||'unknown'}. SLA window: ${job?.sla_window||'unknown'}. Penalty if breached: £${job?.penalty_if_breached?.toLocaleString()||'unknown'}. ${inputText ? 'Reason: '+inputText : 'No reason given yet.'}. Calculate revised ETA with 1.5x buffer. Advise whether SLA is salvageable, what to communicate to the customer, and whether to escalate.`,

        temp_check: `Cold chain temperature log — Driver ${driverInfo.name} (${driverInfo.vehicleReg}). Current location: ${loc}. Cargo: ${job?.cargo_type||'temperature controlled'}. Driver-reported temperature: ${inputText||'not yet entered'}. Assess against cargo type thresholds. Advise on action required — continue, notify ops, or refuse delivery.`,

        defect: `Vehicle defect report — ${driverInfo.vehicleReg}, Driver ${driverInfo.name}. Location: ${loc}. Defect reported: ${inputText||'driver has noted a defect'}. Assess roadworthiness risk, DVSA prohibition likelihood, and advise whether vehicle can continue or requires immediate DVSA authorisation before proceeding.`,

        breakdown: `BREAKDOWN EMERGENCY — ${driverInfo.vehicleReg}, Driver ${driverInfo.name}. Location: ${loc}. ${inputText ? 'Issue: '+inputText : 'Vehicle breakdown — unable to continue.'} Job: ${job?.route||'unknown'}. Cargo: ${job?.cargo_type||'unknown'}, value: £${job?.cargo_value?.toLocaleString()||'unknown'}. Provide immediate action plan — safety first, then recovery, then cargo protection and SLA mitigation.`,

        arrived_collection: `Driver ${driverInfo.name} (${driverInfo.vehicleReg}) has arrived at collection point. Location: ${loc}. Job: ${job?.route||'unknown'}. Cargo to collect: ${job?.cargo_type||'unknown'}. Provide load security checklist, temperature unit check if cold chain, and key items to verify before departure.`,

        loading_complete: `Driver ${driverInfo.name} (${driverInfo.vehicleReg}) has loaded and is ready to depart. Job: ${job?.route||'unknown'}. Cargo: ${job?.cargo_type||'unknown'}. SLA window: ${job?.sla_window||'unknown'}. Confirm departure time vs SLA, provide ETA with 1.5x buffer, and flag any known hazards on route.`,

        arrived_delivery: `Driver ${driverInfo.name} (${driverInfo.vehicleReg}) has arrived at delivery point. Location: ${loc}. Job: ${job?.route||'unknown'}. SLA window: ${job?.sla_window||'unknown'}. Provide delivery checklist — POD requirements, temperature log if cold chain, any specific unloading instructions, and what to do if goods are rejected.`,

        delivered: `Delivery confirmed — ${driverInfo.name} (${driverInfo.vehicleReg}). Job: ${job?.route||'unknown'} completed. ${inputText ? 'Notes: '+inputText : ''} Log delivery completion, confirm POD obtained, and advise on next steps — return to depot, next job, or overnight rest.`,

        weigh_bridge: `Driver ${driverInfo.name} (${driverInfo.vehicleReg}) is at a weigh bridge. Location: ${loc}. Vehicle weight: ${inputText||'not yet confirmed'}. Advise on compliance — if overweight, what action is required before proceeding. Reference DVSA axle weight limits for HGV.`,
      }

      const prompt = prompts[actionId] || `Driver ${driverInfo.name} reports: ${inputText}. Location: ${loc}.`

      const res  = await fetch('/api/agent', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ messages:[{role:'user',content:prompt}] })
      })

      // Stream the response
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      setPanelState('result')
      setPanelData({ text:'' })

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const parsed = JSON.parse(line.slice(6))
              if (parsed.text) {
                fullText += parsed.text
                setPanelData({ text: fullText })
              }
            } catch {}
          }
        }
      }

      // Log to incidents via alert API for significant actions
      const significantActions = ['rest','breakdown','delayed','defect','temp_check']
      if (significantActions.includes(actionId)) {
        await fetch('/api/driver/alert', {
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

    } catch(e) {
      setPanelState('error')
      setPanelData({ error: e.message })
    }
  }

  function saveDriverInfo() {
    if (!driverInfo.name||!driverInfo.clientId) return
    localStorage.setItem('dh_driver_info', JSON.stringify(driverInfo))
    setSetupDone(true)
    loadJobs(driverInfo)
  }

  // ── SETUP SCREEN ──────────────────────────────────────────────────────────
  if (!setupDone) {
    return (
      <div style={{minHeight:'100vh',background:'#0a0c0e',color:'#e8eaed',fontFamily:'IBM Plex Sans,sans-serif',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
        <div style={{width:'100%',maxWidth:360}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:32}}>
            <div style={{width:32,height:32,background:'#00e5b0',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#000',fontFamily:'monospace'}}>DH</div>
            <div><div style={{fontSize:14,fontWeight:500,color:'#e8eaed'}}>DisruptionHub</div><div style={{fontSize:11,color:'#4a5260',fontFamily:'monospace'}}>Driver App</div></div>
          </div>
          <div style={{fontSize:11,color:'#4a5260',fontFamily:'monospace',letterSpacing:'0.08em',marginBottom:16}}>SETUP — ONE TIME ONLY</div>
          {[{label:'Your name',key:'name',placeholder:'e.g. Carl Hughes'},{label:'Vehicle registration',key:'vehicleReg',placeholder:'e.g. BK21 XYZ'},{label:'Company access code',key:'clientId',placeholder:'Given by your manager'}].map(f=>(
            <div key={f.key} style={{marginBottom:14}}>
              <div style={{fontSize:11,color:'#8a9099',marginBottom:5}}>{f.label}</div>
              <input value={driverInfo[f.key]} onChange={e=>setDriverInfo(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder}
                style={{width:'100%',padding:'11px 14px',background:'#111418',border:'1px solid rgba(255,255,255,0.1)',borderRadius:7,color:'#e8eaed',fontSize:14,outline:'none',boxSizing:'border-box'}}/>
            </div>
          ))}
          <button onClick={saveDriverInfo} disabled={!driverInfo.name||!driverInfo.clientId}
            style={{width:'100%',padding:14,background:'#00e5b0',border:'none',borderRadius:8,color:'#000',fontWeight:600,fontSize:14,cursor:'pointer',marginTop:8}}>
            Set up my app →
          </button>
        </div>
      </div>
    )
  }

  const currentAction = QUICK_ACTIONS.find(a=>a.id===activePanel)
  const needsText = ['delayed','temp_check','defect','breakdown','delivered','weigh_bridge'].includes(activePanel)

  return (
    <div style={{minHeight:'100vh',background:'#0a0c0e',color:'#e8eaed',fontFamily:'IBM Plex Sans,sans-serif',maxWidth:480,margin:'0 auto'}}>

      {/* Notification toast */}
      {notification && (
        <div style={{position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',zIndex:1000,padding:'10px 20px',borderRadius:8,
          background:notification.type==='error'?'rgba(239,68,68,0.95)':notification.type==='success'?'rgba(0,229,176,0.95)':'rgba(59,130,246,0.95)',
          color:notification.type==='success'?'#000':'#fff',fontSize:13,fontWeight:500,maxWidth:340,textAlign:'center',boxShadow:'0 4px 20px rgba(0,0,0,0.5)'}}>
          {notification.msg}
        </div>
      )}

      {/* NAV */}
      <div style={{padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(255,255,255,0.06)',background:'rgba(10,12,14,0.98)',position:'sticky',top:0,zIndex:50}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:24,height:24,background:'#00e5b0',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'#000',fontFamily:'monospace'}}>DH</div>
          <div>
            <div style={{fontSize:12,fontWeight:500,color:'#e8eaed'}}>{driverInfo.name}</div>
            <div style={{fontSize:10,color:'#4a5260',fontFamily:'monospace'}}>{driverInfo.vehicleReg}</div>
          </div>
        </div>
        <button onClick={()=>openPanel('breakdown')}
          style={{padding:'7px 14px',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.35)',borderRadius:7,color:'#ef4444',fontSize:12,fontWeight:600,cursor:'pointer'}}>
          🚨 Emergency
        </button>
      </div>

      {/* ACTIVE JOB STRIP */}
      {activeJob && (
        <div style={{margin:'12px 16px 0',padding:'12px 14px',background:'#111418',border:'1px solid rgba(255,255,255,0.07)',borderRadius:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
            <div>
              <span style={{fontFamily:'monospace',fontSize:13,color:'#e8eaed',fontWeight:600}}>{activeJob.ref}</span>
              <span style={{fontSize:12,color:'#8a9099',marginLeft:8}}>{activeJob.route}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:5}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:STATUS_COLORS[activeJob.status]?.dot||'#4a5260'}}/>
              <span style={{fontSize:10,color:STATUS_COLORS[activeJob.status]?.dot||'#4a5260',fontFamily:'monospace'}}>{STATUS_COLORS[activeJob.status]?.label||activeJob.status?.toUpperCase()}</span>
            </div>
          </div>
          <div style={{display:'flex',gap:12,fontSize:11,color:'#4a5260'}}>
            <span>{activeJob.carrier}</span>
            {activeJob.eta && <span>ETA {activeJob.eta}</span>}
            {activeJob.sla_window && <span>Slot {activeJob.sla_window}</span>}
            {activeJob.cargo_type && <span>{activeJob.cargo_type.includes('pharma')?'💊':activeJob.cargo_type.includes('frozen')?'🧊':activeJob.cargo_type.includes('chilled')?'❄':'📦'} {activeJob.cargo_type}</span>}
          </div>
          {activeJob.alert && (
            <div style={{marginTop:7,padding:'5px 9px',background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:5,fontSize:11,color:'#f59e0b'}}>⚠ {activeJob.alert}</div>
          )}
          {/* Switch job */}
          {jobs.length>1 && (
            <div style={{marginTop:8,display:'flex',gap:6,overflowX:'auto'}}>
              {jobs.map(j=>(
                <button key={j.ref} onClick={()=>setActiveJob(j)}
                  style={{padding:'4px 10px',border:`1px solid ${j.ref===activeJob.ref?'#00e5b0':'rgba(255,255,255,0.08)'}`,borderRadius:5,background:'transparent',color:j.ref===activeJob.ref?'#00e5b0':'#4a5260',fontSize:10,fontFamily:'monospace',cursor:'pointer',whiteSpace:'nowrap'}}>
                  {j.ref}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* QUICK ACTIONS GRID */}
      <div style={{padding:'16px 16px 0'}}>
        <div style={{fontSize:10,color:'#4a5260',fontFamily:'monospace',letterSpacing:'0.08em',marginBottom:10}}>QUICK ACTIONS</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
          {QUICK_ACTIONS.map(action=>(
            <button key={action.id} onClick={()=>openPanel(action.id)}
              style={{padding:'12px 6px 10px',background:'#111418',border:`1px solid rgba(255,255,255,0.07)`,borderRadius:10,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:5,transition:'all 0.15s',outline:'none'}}>
              <span style={{fontSize:22}}>{action.icon}</span>
              <span style={{fontSize:10,color:'#e8eaed',fontWeight:500,textAlign:'center',lineHeight:1.2}}>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ALL JOBS */}
      {jobs.length>1 && (
        <div style={{padding:'16px 16px 0'}}>
          <div style={{fontSize:10,color:'#4a5260',fontFamily:'monospace',letterSpacing:'0.08em',marginBottom:10}}>ALL RUNS TODAY</div>
          {jobs.map(job=>{
            const sc=STATUS_COLORS[job.status]||{}
            return (
              <div key={job.ref} onClick={()=>setActiveJob(job)}
                style={{padding:'10px 12px',borderRadius:8,marginBottom:6,cursor:'pointer',border:activeJob?.ref===job.ref?'1px solid #00e5b0':sc.border||'1px solid rgba(255,255,255,0.06)',background:sc.bg||'#111418'}}>
                <div style={{display:'flex',justifyContent:'space-between'}}>
                  <span style={{fontFamily:'monospace',fontSize:11,color:'#e8eaed',fontWeight:600}}>{job.ref}</span>
                  <span style={{fontSize:9,color:sc.dot||'#4a5260',fontFamily:'monospace'}}>{sc.label||job.status?.toUpperCase()}</span>
                </div>
                <div style={{fontSize:11,color:'#8a9099',marginTop:2}}>{job.route}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* FOOTER */}
      <div style={{padding:'20px 16px 40px',marginTop:16}}>
        <button onClick={()=>{localStorage.removeItem('dh_driver_info');setSetupDone(false);setJobs([]);setActiveJob(null)}}
          style={{width:'100%',padding:10,background:'transparent',border:'1px solid rgba(255,255,255,0.06)',borderRadius:6,color:'#4a5260',fontSize:11,cursor:'pointer'}}>
          Change driver / vehicle
        </button>
      </div>

      {/* ── ACTION PANEL (bottom sheet) ─────────────────────────────────────────── */}
      {activePanel && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:200,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>{if(e.target===e.currentTarget)closePanel()}}>
          <div style={{background:'#111418',borderRadius:'16px 16px 0 0',maxHeight:'88vh',display:'flex',flexDirection:'column'}}>

            {/* Panel header */}
            <div style={{padding:'16px 20px 12px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:22}}>{currentAction?.icon}</span>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:'#e8eaed'}}>{currentAction?.label}</div>
                  <div style={{fontSize:11,color:'#4a5260'}}>{currentAction?.desc}</div>
                </div>
              </div>
              <button onClick={closePanel} style={{background:'none',border:'none',color:'#4a5260',fontSize:22,cursor:'pointer',padding:'0 4px',lineHeight:1}}>✕</button>
            </div>

            {/* Panel body — scrollable */}
            <div style={{overflowY:'auto',flex:1,padding:'16px 20px 24px'}}>

              {/* GPS status */}
              {['fuel','rest','service_station','delayed','breakdown','defect','arrived_collection','arrived_delivery'].includes(activePanel) && (
                <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'#0d1014',borderRadius:7,marginBottom:14}}>
                  <div style={{width:7,height:7,borderRadius:'50%',flexShrink:0,background:gpsStatus==='got'?'#00e5b0':gpsStatus==='getting'?'#f59e0b':'#4a5260'}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:10,color:'#4a5260',fontFamily:'monospace'}}>YOUR LOCATION</div>
                    <div style={{fontSize:12,color:gpsStatus==='got'?'#e8eaed':'#8a9099'}}>
                      {gpsStatus==='getting'?'Getting GPS...' : gpsStatus==='got'?gpsDescription : 'GPS unavailable — include location in description'}
                    </div>
                  </div>
                  {gpsStatus!=='got'&&gpsStatus!=='getting'&&(
                    <button onClick={getGPS} style={{padding:'4px 10px',background:'rgba(0,229,176,0.08)',border:'1px solid rgba(0,229,176,0.2)',borderRadius:5,color:'#00e5b0',fontSize:11,cursor:'pointer'}}>Get GPS</button>
                  )}
                </div>
              )}

              {/* Context-specific prompts */}
              {activePanel==='rest' && (
                <div style={{padding:'10px 12px',background:'rgba(168,85,247,0.06)',border:'1px solid rgba(168,85,247,0.2)',borderRadius:7,marginBottom:14}}>
                  <div style={{fontSize:11,color:'#a855f7',fontWeight:500,marginBottom:4}}>Theft risk check + secure parking</div>
                  <div style={{fontSize:12,color:'#8a9099'}}>The system will assess your current location, check the cargo value on this job, and return the nearest accredited secure truck parks with costs. Motorway services are not recommended for loads over £5,000.</div>
                </div>
              )}

              {activePanel==='breakdown' && (
                <div style={{padding:'10px 12px',background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:7,marginBottom:14}}>
                  <div style={{fontSize:11,color:'#ef4444',fontWeight:500,marginBottom:4}}>If anyone is injured — call 999 first</div>
                  <div style={{fontSize:12,color:'#8a9099'}}>This alert will notify your ops manager immediately. Describe what has happened and what you can see.</div>
                </div>
              )}

              {activePanel==='temp_check' && (
                <div style={{padding:'10px 12px',background:'rgba(6,182,212,0.06)',border:'1px solid rgba(6,182,212,0.2)',borderRadius:7,marginBottom:14}}>
                  <div style={{fontSize:11,color:'#06b6d4',fontWeight:500,marginBottom:4}}>Cold chain compliance log</div>
                  <div style={{fontSize:12,color:'#8a9099'}}>Enter the probe temperature from inside the load — not the unit display. They can differ. Your log will be saved as evidence of compliance.</div>
                </div>
              )}

              {/* Text input for actions that need it */}
              {needsText && panelState!=='result' && (
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:11,color:'#8a9099',marginBottom:6}}>
                    {activePanel==='delayed'?'What is causing the delay? (optional)' :
                     activePanel==='temp_check'?'Temperature reading (e.g. 3.2°C)' :
                     activePanel==='defect'?'Describe the defect' :
                     activePanel==='breakdown'?'What has happened?' :
                     activePanel==='delivered'?'Any notes for ops? (optional)' :
                     activePanel==='weigh_bridge'?'Indicated weight (e.g. 26.4 tonnes)' : 'Notes'}
                  </div>
                  <textarea value={inputText} onChange={e=>setInputText(e.target.value)} rows={3}
                    placeholder={
                      activePanel==='delayed'?'e.g. M62 standstill near J26, accident ahead' :
                      activePanel==='temp_check'?'e.g. 3.2°C probe reading, unit showing 3.8°C' :
                      activePanel==='defect'?'e.g. Pull to left on braking, front nearside' :
                      activePanel==='breakdown'?'e.g. Engine warning light, white smoke, pulled over safely' :
                      'Notes...'
                    }
                    style={{width:'100%',padding:'10px 12px',background:'#0d1014',border:'1px solid rgba(255,255,255,0.1)',borderRadius:7,color:'#e8eaed',fontSize:13,lineHeight:1.6,outline:'none',resize:'none',boxSizing:'border-box'}}/>
                </div>
              )}

              {/* Loading state */}
              {panelState==='loading' && (
                <div style={{textAlign:'center',padding:'32px 0'}}>
                  <div style={{fontSize:11,color:'#00e5b0',fontFamily:'monospace',marginBottom:8}}>ANALYSING...</div>
                  <div style={{fontSize:12,color:'#4a5260'}}>Getting your instructions</div>
                </div>
              )}

              {/* Result — streamed AI response, simplified for mobile */}
              {panelState==='result' && panelData?.text && (
                <div>
                  <div style={{fontSize:10,color:'#00e5b0',fontFamily:'monospace',letterSpacing:'0.06em',marginBottom:10}}>INSTRUCTIONS FROM OPS</div>
                  {/* Parse and render the key sections simply for mobile */}
                  {panelData.text.split('\n').map((line,i)=>{
                    if (!line.trim()) return null
                    const isHeading = line.startsWith('##')
                    const isAction  = /^[123]\.\s/.test(line)
                    const isDash    = line.startsWith('—') || line.startsWith('- ')
                    const isBold    = line.startsWith('**')
                    const clean     = line.replace(/^##\s*/,'').replace(/\*\*/g,'').replace(/^[—\-]\s*/,'').replace(/^[123]\.\s*/,'').trim()
                    if (!clean) return null
                    if (isHeading) return (
                      <div key={i} style={{fontSize:10,color:'#00e5b0',fontFamily:'monospace',letterSpacing:'0.06em',marginTop:14,marginBottom:6,paddingTop:10,borderTop:'1px solid rgba(255,255,255,0.06)'}}>{clean}</div>
                    )
                    if (isAction) return (
                      <div key={i} style={{display:'flex',gap:8,marginBottom:8,padding:'8px 10px',background:'rgba(239,68,68,0.05)',border:'1px solid rgba(239,68,68,0.12)',borderRadius:6}}>
                        <span style={{fontSize:11,color:'#ef4444',fontFamily:'monospace',fontWeight:700,flexShrink:0}}>{line.match(/^[123]/)?.[0]}.</span>
                        <span style={{fontSize:12,color:'#e8eaed',lineHeight:1.5}}>{clean}</span>
                      </div>
                    )
                    return <div key={i} style={{fontSize:12,color:isDash?'#8a9099':'#e8eaed',lineHeight:1.6,marginBottom:4,paddingLeft:isDash?8:0}}>{clean}</div>
                  })}
                  <button onClick={closePanel}
                    style={{width:'100%',marginTop:20,padding:12,background:'#00e5b0',border:'none',borderRadius:8,color:'#000',fontWeight:600,fontSize:14,cursor:'pointer'}}>
                    Got it — close
                  </button>
                </div>
              )}

              {/* Error state */}
              {panelState==='error' && (
                <div style={{padding:'12px 14px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:7,marginBottom:14}}>
                  <div style={{fontSize:12,color:'#ef4444',marginBottom:6}}>Could not get instructions. Check your connection.</div>
                  <div style={{fontSize:11,color:'#8a9099'}}>Call your ops manager directly if this is urgent.</div>
                </div>
              )}

              {/* Submit button — only show when not yet submitted */}
              {(panelState==='idle') && (
                <button onClick={()=>submitAction(activePanel)}
                  style={{width:'100%',padding:14,background:currentAction?.color||'#00e5b0',border:'none',borderRadius:8,
                    color:currentAction?.id==='breakdown'?'#fff':currentAction?.color==='#f59e0b'||currentAction?.color==='#a855f7'?'#000':'#000',
                    fontWeight:600,fontSize:14,cursor:'pointer',marginTop:4}}>
                  {activePanel==='rest' ? '🛌 Get secure parking options →' :
                   activePanel==='fuel' ? '⛽ Check fuel options →' :
                   activePanel==='breakdown' ? '🚨 Alert ops now →' :
                   activePanel==='delayed' ? '⏰ Alert ops + get options →' :
                   activePanel==='temp_check' ? '🌡 Log temperature →' :
                   activePanel==='delivered' ? '📦 Confirm delivery →' :
                   `${currentAction?.icon} Confirm & get instructions →`}
                </button>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
