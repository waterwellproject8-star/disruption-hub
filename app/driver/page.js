'use client'
import { useState, useEffect, useRef } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY PROGRESSION — tap to advance through the run
// ─────────────────────────────────────────────────────────────────────────────
const PROGRESS_STEPS = [
  { id:'arrived_collection', label:'Arrived at Collection', icon:'📍', color:'#3b82f6', status:'at_collection' },
  { id:'loading_complete',   label:'Loaded & Secured',     icon:'✅', color:'#00e5b0', status:'loaded' },
  { id:'arrived_delivery',   label:'Arrived at Customer',  icon:'🏭', color:'#3b82f6', status:'at_customer' },
  { id:'delivered',          label:'Delivered — POD Signed', icon:'📦', color:'#00e5b0', status:'completed', isDelivery:true },
]

// ─────────────────────────────────────────────────────────────────────────────
// ISSUE SCENARIOS — grouped by context
// ─────────────────────────────────────────────────────────────────────────────
const ISSUE_GROUPS = [
  {
    id: 'road',
    label: 'ON THE ROAD',
    color: '#f59e0b',
    issues: [
      { id:'delayed',       label:'Running Late',          icon:'⏰', needsText:true,  placeholder:'What is causing the delay?' },
      { id:'temp_alarm',    label:'Temp Alarm',            icon:'🌡', needsText:true,  placeholder:'e.g. Unit showing 8°C, cargo is chilled pharma' },
      { id:'load_movement', label:'Load Movement',         icon:'📦', needsText:false, note:'Pull over safely before continuing.' },
      { id:'road_closure',  label:'Road Closure / Weather',icon:'🌧', needsText:true,  placeholder:'e.g. M62 closed, flooding at J25' },
      { id:'low_bridge',    label:'Low Bridge / Restriction',icon:'🚧',needsText:true,  placeholder:'e.g. 14ft 6in bridge, my vehicle is 14ft 9in' },
      { id:'diversion',     label:'Wrong Route / Lost',    icon:'🗺', needsText:true,  placeholder:'Where are you and where are you trying to get to?' },
    ]
  },
  {
    id: 'stop',
    label: 'AT A STOP',
    color: '#3b82f6',
    issues: [
      { id:'customer_not_ready', label:'Customer Not Ready',   icon:'⏳', needsText:true,  placeholder:'How long have you been waiting?' },
      { id:'goods_refused',      label:'Goods Refused',        icon:'❌', needsText:true,  placeholder:'Why did they refuse? Damage, wrong spec, temp breach?' },
      { id:'pod_problem',        label:'POD / Signature Issue',icon:'✍', needsText:true,  placeholder:'What is the problem?' },
      { id:'access_problem',     label:'Can\'t Access Site',   icon:'🚪', needsText:true,  placeholder:'e.g. Height barrier, locked gate, no loading bay' },
      { id:'short_load',         label:'Wrong / Short Load',   icon:'📋', needsText:true,  placeholder:'What is missing or wrong?' },
      { id:'loading_damage',     label:'Damage Found',         icon:'⚠️', needsText:true,  placeholder:'Describe the damage and when it was noticed' },
      { id:'overweight',         label:'Overweight',           icon:'⚖️', needsText:true,  placeholder:'What did the weigh bridge show?' },
      { id:'part_delivery',      label:'Part Delivery Only',   icon:'🔢', needsText:true,  placeholder:'What can you deliver and what can\'t you?' },
    ]
  },
  {
    id: 'driver',
    label: 'DRIVER',
    color: '#a855f7',
    issues: [
      { id:'driver_unwell',    label:'Feeling Unwell',       icon:'🤒', needsText:true,  placeholder:'How are you feeling? Can you drive safely?' },
      { id:'theft_threat',     label:'Suspicious / Threat',  icon:'🦺', needsText:true,  placeholder:'Describe what you can see — stay in your cab' },
      { id:'hours_running_out',label:'Hours Running Out',    icon:'⏱', needsText:false, note:'System will calculate your remaining legal hours.' },
      { id:'adrhazmat',        label:'ADR / Hazmat Issue',   icon:'☢️', needsText:true,  placeholder:'What is the issue with the dangerous goods documentation?' },
      { id:'cant_complete',    label:'Can\'t Complete Runs', icon:'⛔', needsText:true,  placeholder:'Reason — e.g. hours almost up, major delay on first run' },
    ]
  }
]

// Pre-shift checklist items
const PRESHIFT_CHECKS = [
  { id:'lights',   label:'Lights & indicators',         icon:'💡' },
  { id:'tyres',    label:'Tyres — no damage or flats',  icon:'⚫' },
  { id:'mirrors',  label:'Mirrors — clean & adjusted',  icon:'🔲' },
  { id:'brakes',   label:'Brakes — no issues',          icon:'🛑' },
  { id:'fuel',     label:'Fuel level — checked',        icon:'⛽' },
  { id:'docs',     label:'Licence & documents',         icon:'📄' },
  { id:'load',     label:'Load — secured properly',     icon:'🔒' },
  { id:'fridge',   label:'Fridge unit — at temp',       icon:'❄' },
]

const STATUS_COLORS = {
  'on-track':      { dot:'#00e5b0', label:'ON TRACK',      border:'rgba(0,229,176,0.2)',   bg:'rgba(0,229,176,0.03)' },
  'at_collection': { dot:'#3b82f6', label:'AT COLLECTION', border:'rgba(59,130,246,0.2)',  bg:'rgba(59,130,246,0.03)' },
  'loaded':        { dot:'#00e5b0', label:'LOADED',        border:'rgba(0,229,176,0.2)',   bg:'rgba(0,229,176,0.03)' },
  'at_customer':   { dot:'#3b82f6', label:'AT CUSTOMER',   border:'rgba(59,130,246,0.2)',  bg:'rgba(59,130,246,0.03)' },
  'at_risk':       { dot:'#ef4444', label:'AT RISK',       border:'rgba(239,68,68,0.3)',   bg:'rgba(239,68,68,0.04)' },
  disrupted:       { dot:'#ef4444', label:'DISRUPTED',     border:'rgba(239,68,68,0.3)',   bg:'rgba(239,68,68,0.04)' },
  delayed:         { dot:'#f59e0b', label:'DELAYED',       border:'rgba(245,158,11,0.3)',  bg:'rgba(245,158,11,0.04)' },
  pending:         { dot:'#3b82f6', label:'PENDING',       border:'rgba(59,130,246,0.2)',  bg:'rgba(59,130,246,0.03)' },
  completed:       { dot:'#4a5260', label:'DONE',          border:'rgba(74,82,96,0.15)',   bg:'rgba(74,82,96,0.02)' },
}

const SEV = {
  CRITICAL: { bg:'rgba(239,68,68,0.12)',  border:'rgba(239,68,68,0.4)',  color:'#ef4444', icon:'🚨' },
  HIGH:     { bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.4)', color:'#f59e0b', icon:'⚠️' },
  MEDIUM:   { bg:'rgba(59,130,246,0.1)',  border:'rgba(59,130,246,0.35)',color:'#3b82f6', icon:'ℹ️' },
  LOW:      { bg:'rgba(0,229,176,0.08)',  border:'rgba(0,229,176,0.3)',  color:'#00e5b0', icon:'✅' },
  OK:       { bg:'rgba(0,229,176,0.08)',  border:'rgba(0,229,176,0.3)',  color:'#00e5b0', icon:'✅' },
}

// ─────────────────────────────────────────────────────────────────────────────
export default function DriverApp() {
  const [jobs, setJobs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [activeJob, setActiveJob] = useState(null)
  const [driverInfo, setDriverInfo] = useState({ name:'', clientId:'', vehicleReg:'' })
  const [setupDone, setSetupDone]   = useState(false)
  const [view, setView]             = useState('run') // run | preshift | issues | allruns

  const [toast, setToast]           = useState(null)
  const [pendingUndo, setPendingUndo] = useState(null)
  const [undoCountdown, setUndoCountdown] = useState(0)
  const undoTimer = useRef(null)
  const countdownTimer = useRef(null)
  const shiftStartTime = useRef(null)

  const [preShiftChecks, setPreShiftChecks] = useState({})
  const [shiftStarted, setShiftStarted]     = useState(false)
  const [shiftEnded, setShiftEnded]         = useState(false)
  const [shiftSummary, setShiftSummary]     = useState(null)

  const [panelOpen, setPanelOpen]       = useState(false)
  const [panelIssue, setPanelIssue]     = useState(null)
  const [panelState, setPanelState]     = useState('idle')
  const [inputText, setInputText]       = useState('')
  const [parsedResult, setParsedResult] = useState(null)
  const [showDetail, setShowDetail]     = useState(false)
  const [lastAlert, setLastAlert]       = useState(null)
  const [resolvedEta, setResolvedEta]   = useState('')

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
    } else { setLoading(false) }
    const savedAlert = localStorage.getItem('dh_last_alert')
    if (savedAlert) { try { setLastAlert(JSON.parse(savedAlert)) } catch {} }
    const shiftDone = localStorage.getItem('dh_shift_started')
    if (shiftDone) setShiftStarted(true)
    return () => { clearTimeout(undoTimer.current); clearInterval(countdownTimer.current) }
  }, [])

  const showToast = (msg, type='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000) }

  async function loadJobs(info) {
    if (!info?.clientId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/shipments?client_id=${info.clientId}`)
      const data = await res.json()
      const mapped = (data.shipments||[]).map(s=>({
        ref:s.ref, route:s.route, carrier:s.carrier, status:s.status,
        eta:s.eta, sla_window:s.sla_window, cargo_type:s.cargo_type,
        alert:s.alert, penalty_if_breached:s.penalty_if_breached, cargo_value:s.cargo_value
      }))
      setJobs(mapped)
      if (mapped.length>0) setActiveJob(mapped[0])
    } catch { showToast('Could not load jobs','error') }
    finally { setLoading(false) }
  }

  function getGPS() {
    if (!navigator.geolocation) { setGpsStatus('failed'); return }
    setGpsStatus('getting')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const {latitude,longitude} = pos.coords
        setGpsCoords({latitude,longitude})
        setGpsStatus('got')
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
          const data = await res.json()
          const road = data.address?.road||data.address?.motorway||''
          const area = data.address?.suburb||data.address?.town||data.address?.county||''
          setGpsDescription([road,area].filter(Boolean).join(', ')||`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
        } catch { setGpsDescription(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`) }
      },
      ()=>setGpsStatus('failed'),
      {enableHighAccuracy:true,timeout:10000,maximumAge:0}
    )
  }

  // ── PROGRESS LOG ──────────────────────────────────────────────────────────
  function logProgress(step) {
    const job = activeJob
    if (!job) return
    const isComplete = step.status === 'completed'
    const prevStatus = job.status

    setJobs(prev=>{
      const updated = prev.map(j=>j.ref===job.ref?{...j,status:step.status,alert:null}:j)
      if (isComplete) return [...updated.filter(j=>j.status!=='completed'),...updated.filter(j=>j.status==='completed')]
      return updated
    })
    setActiveJob(prev=>({...prev,status:step.status,alert:null}))

    if (isComplete) {
      setJobs(prev=>{ const next=prev.find(j=>j.status!=='completed'&&j.ref!==job.ref); if(next)setActiveJob(next); return prev })
      if (lastAlert) { setLastAlert(null); localStorage.removeItem('dh_last_alert') }
      clearTimeout(undoTimer.current); clearInterval(countdownTimer.current)
      setPendingUndo({job,prevStatus})
      setUndoCountdown(5)
      countdownTimer.current = setInterval(()=>setUndoCountdown(n=>{if(n<=1){clearInterval(countdownTimer.current);return 0}return n-1}),1000)
      undoTimer.current = setTimeout(()=>{setPendingUndo(null);setUndoCountdown(0)},5000)
    } else {
      showToast(`✓ ${step.label}`)
    }
  }

  function undoDelivered() {
    if (!pendingUndo) return
    clearTimeout(undoTimer.current); clearInterval(countdownTimer.current)
    const {job,prevStatus} = pendingUndo
    setJobs(prev=>prev.map(j=>j.ref===job.ref?{...j,status:prevStatus}:j))
    setActiveJob(job)
    setPendingUndo(null); setUndoCountdown(0)
    showToast('Delivery undone')
  }

  // ── ISSUE PANEL ───────────────────────────────────────────────────────────
  function openIssue(issue) {
    setPanelIssue(issue)
    setPanelOpen(true)
    setPanelState('idle')
    setInputText('')
    setParsedResult(null)
    setShowDetail(false)
    setResolvedEta('')
    getGPS()
  }

  function closePanel() {
    if (parsedResult && panelState==='result') {
      const alert={...parsedResult,issueId:panelIssue?.id,issueLabel:panelIssue?.label,time:new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
      setLastAlert(alert); localStorage.setItem('dh_last_alert',JSON.stringify(alert))
    }
    if (panelState==='resolved') { setLastAlert(null); localStorage.removeItem('dh_last_alert') }
    setPanelOpen(false); setPanelIssue(null); setPanelState('idle')
    setInputText(''); setParsedResult(null); setShowDetail(false); setResolvedEta('')
  }

  function reopenLastAlert() {
    if (!lastAlert) return
    const issue = ISSUE_GROUPS.flatMap(g=>g.issues).find(i=>i.id===lastAlert.issueId)||{id:lastAlert.issueId,label:lastAlert.issueLabel||'Alert'}
    setPanelIssue(issue); setParsedResult(lastAlert)
    setPanelState('result'); setPanelOpen(true); setShowDetail(false)
  }

  async function resolveIssue(reason) {
    setPanelState('resolving_loading')
    const job = activeJob
    try {
      const res = await fetch('/api/driver/resolve',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({client_id:driverInfo.clientId,driver_name:driverInfo.name,vehicle_reg:driverInfo.vehicleReg,ref:job?.ref,resolution:reason,location_description:gpsDescription,route:job?.route,sla_window:job?.sla_window,original_issue:panelIssue?.id})
      })
      const data = await res.json()
      setJobs(prev=>prev.map(j=>j.ref===job?.ref?{...j,status:'on-track',alert:null}:j))
      if (activeJob?.ref===job?.ref) setActiveJob(p=>({...p,status:'on-track',alert:null}))
      setResolvedEta(data.revised_eta||'')
      setPanelState('resolved')
    } catch { setPanelState('resolved') }
  }

  function parseResponse(text) {
    const headline = text.match(/HEADLINE:\s*(.+)/i)?.[1]?.trim()||''
    const severity = text.match(/SEVERITY:\s*(CRITICAL|HIGH|MEDIUM|LOW|OK)/i)?.[1]?.toUpperCase()||'MEDIUM'
    const actions=[]
    for (const m of text.matchAll(/ACTION\s*\d+:\s*(.+)/gi)){const a=m[1].trim();if(a)actions.push(a)}
    const detail = text.match(/DETAIL:\s*([\s\S]+)/i)?.[1]?.trim()||''
    return {headline,severity,actions,detail}
  }

  function buildPrompt(issueId) {
    const loc = gpsDescription||'location not confirmed'
    const job = activeJob
    const remaining = jobs.filter(j=>j.status!=='completed'&&j.ref!==job?.ref)
    const remainingList = remaining.map(j=>`${j.ref}: ${j.route} (SLA: ${j.sla_window||'unknown'}, penalty: £${j.penalty_if_breached?.toLocaleString()||'unknown'})`).join('; ')
    const cargo = `${job?.cargo_type||'unknown'}, value: £${job?.cargo_value?.toLocaleString()||'unknown'}`
    const input = inputText||'no additional detail'

    const prompts = {
      delayed:           `Driver ${driverInfo.name} (${driverInfo.vehicleReg}) running late. Location: ${loc}. Job: ${job?.route||'unknown'}. SLA: ${job?.sla_window||'unknown'}. Penalty: £${job?.penalty_if_breached?.toLocaleString()||'unknown'}. Reason: ${input}`,
      temp_alarm:        `TEMPERATURE ALARM. Driver ${driverInfo.name} (${driverInfo.vehicleReg}). Location: ${loc}. Cargo: ${cargo}. Reading: ${input}. Assess breach severity against cargo type thresholds. Is cargo compromised? Can delivery proceed?`,
      load_movement:     `LOAD MOVEMENT REPORTED. Driver ${driverInfo.name} (${driverInfo.vehicleReg}). Location: ${loc}. Cargo: ${cargo}. Driver has pulled over. Advise on safe inspection procedure and whether load can continue.`,
      road_closure:      `ROAD CLOSURE / WEATHER. Driver ${driverInfo.name} (${driverInfo.vehicleReg}). Location: ${loc}. Job: ${job?.route||'unknown'}. SLA: ${job?.sla_window||'unknown'}. Detail: ${input}. Provide specific reroute options with UK road names. Apply 1.5x buffer.`,
      low_bridge:        `LOW BRIDGE / RESTRICTION. Driver ${driverInfo.name} (${driverInfo.vehicleReg}). Location: ${loc}. Vehicle height/weight restriction issue. Detail: ${input}. Advise on legal requirements and alternative route.`,
      diversion:         `DRIVER NEEDS NAVIGATION HELP. ${driverInfo.vehicleReg}. Current location: ${loc}. Job: ${job?.route||'unknown'}. Issue: ${input}. Give clear routing instructions using road numbers and junctions.`,
      customer_not_ready:`CUSTOMER NOT READY. Driver ${driverInfo.name} (${driverInfo.vehicleReg}). Location: ${loc}. Job: ${job?.route||'unknown'}. SLA: ${job?.sla_window||'unknown'}. Waiting detail: ${input}. How long to wait before escalating? What to communicate to customer?`,
      goods_refused:     `GOODS REFUSED AT DELIVERY. Driver ${driverInfo.name} (${driverInfo.vehicleReg}). Location: ${loc}. Job: ${job?.route||'unknown'}. Cargo: ${cargo}. Reason for refusal: ${input}. What should driver do with the goods? Who to call?`,
      pod_problem:       `POD / SIGNATURE PROBLEM. Driver ${driverInfo.name} (${driverInfo.vehicleReg}). Location: ${loc}. Job: ${job?.route||'unknown'}. Issue: ${input}. What alternatives are acceptable? Who has authority to resolve?`,
      access_problem:    `CANNOT ACCESS DELIVERY SITE. Driver ${driverInfo.name} (${driverInfo.vehicleReg}). Location: ${loc}. Job: ${job?.route||'unknown'}. SLA: ${job?.sla_window||'unknown'}. Issue: ${input}. How long to wait and who to call?`,
      short_load:        `WRONG OR SHORT LOAD. Driver ${driverInfo.name} (${driverInfo.vehicleReg}). Location: ${loc}. Job: ${job?.route||'unknown'}. Issue: ${input}. Should driver depart partial or wait? Who needs to know?`,
      loading_damage:    `DAMAGE FOUND. Driver ${driverInfo.name} (${driverInfo.vehicleReg}). Location: ${loc}. Job: ${job?.route||'unknown'}. Cargo: ${cargo}. Damage description: ${input}. Can goods still be delivered? What evidence to collect?`,
      overweight:        `OVERWEIGHT VEHICLE. Driver ${driverInfo.name} (${driverInfo.vehicleReg}). Location: ${loc}. Weigh bridge reading: ${input}. What are the legal limits? What action must driver take before proceeding?`,
      part_delivery:     `PART DELIVERY ONLY. Driver ${driverInfo.name} (${driverInfo.vehicleReg}). Location: ${loc}. Job: ${job?.route||'unknown'}. Detail: ${input}. What paperwork is needed? What happens to the remaining goods?`,
      driver_unwell:     `DRIVER UNWELL. ${driverInfo.name} (${driverInfo.vehicleReg}). Location: ${loc}. Job: ${job?.route||'unknown'}. Cargo: ${cargo}. Symptoms: ${input}. Is it safe to continue driving? Who takes over the vehicle?`,
      theft_threat:      `SECURITY THREAT / SUSPICIOUS ACTIVITY. Driver ${driverInfo.name} (${driverInfo.vehicleReg}). Location: ${loc}. Cargo: ${cargo}. Description: ${input}. Immediate safety actions. Whether to call 999. Cargo protection protocol.`,
      hours_running_out: `DRIVER HOURS CRITICAL. Driver ${driverInfo.name} (${driverInfo.vehicleReg}). Location: ${loc}. Current job: ${job?.route||'unknown'}. Remaining jobs: ${remainingList||'none'}. Calculate legal remaining drive time. Which jobs can still be completed legally?`,
      adrhazmat:         `ADR / HAZMAT DOCUMENTATION ISSUE. Driver ${driverInfo.name} (${driverInfo.vehicleReg}). Location: ${loc}. Cargo: ${cargo}. Issue: ${input}. Can driver legally continue? What are the legal requirements?`,
      cant_complete:     `DRIVER CANNOT COMPLETE ALL RUNS. Driver ${driverInfo.name} (${driverInfo.vehicleReg}). Location: ${loc}. Current job: ${job?.route||'unknown'}. Reason: ${input}. Remaining jobs: ${remainingList||'none'}. Prioritise which to attempt. Draft customer notifications for abandoned jobs. Relief vehicle required?`,
      breakdown:         `BREAKDOWN EMERGENCY. ${driverInfo.vehicleReg}, ${driverInfo.name}. Location: ${loc}. ${input?'Issue: '+input:'Vehicle broken down.'} Job: ${job?.route||'unknown'}. Cargo: ${cargo}. Safety first, then recovery, then SLA mitigation.`,
    }
    return prompts[issueId]||`Driver ${driverInfo.name} reports: ${input}. Location: ${loc}. Job: ${job?.route||'unknown'}.`
  }

  async function sendAlert() {
    // Block non-emergency alerts when all jobs are done
    const emergencyIds = ['breakdown','medical','theft_threat','driver_unwell']
    if (!activeJob || activeJob.status==='completed') {
      if (!emergencyIds.includes(panelIssue?.id)) {
        setPanelState('no_active_job')
        return
      }
    }
    setPanelState('loading')
    const prompt = buildPrompt(panelIssue?.id)
    const job = activeJob

    if (panelIssue?.id==='cant_complete'||panelIssue?.id==='hours_running_out') {
      setJobs(prev=>prev.map(j=>j.status!=='completed'&&j.ref!==job?.ref?{...j,status:'at_risk'}:j))
    }

    fetch('/api/driver/alert',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({client_id:driverInfo.clientId,driver_name:driverInfo.name,vehicle_reg:driverInfo.vehicleReg,ref:job?.ref,issue_description:prompt,human_description:inputText||panelIssue?.label,location_description:gpsDescription,latitude:gpsCoords?.latitude,longitude:gpsCoords?.longitude})
    }).catch(()=>{})

    try {
      const res = await fetch('/api/agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:prompt}],driver_mode:true})})
      const reader=res.body.getReader(); const decoder=new TextDecoder(); let full=''
      while(true){const{done,value}=await reader.read();if(done)break;for(const line of decoder.decode(value).split('\n')){if(line.startsWith('data: ')&&line!=='data: [DONE]'){try{const p=JSON.parse(line.slice(6));if(p.text)full+=p.text}catch{}}}}
      if(full){setParsedResult(parseResponse(full));setPanelState('result')}else setPanelState('sent')
    } catch {setPanelState('sent')}
  }

  function saveDriverInfo() {
    if (!driverInfo.name||!driverInfo.clientId) return
    localStorage.setItem('dh_driver_info',JSON.stringify(driverInfo))
    setSetupDone(true); loadJobs(driverInfo)
  }

  function startShift() {
    localStorage.setItem('dh_shift_started','true')
    shiftStartTime.current = new Date()
    setShiftStarted(true)
    setView('run')

    // Fire alert if any pre-checks failed
    const failed = PRESHIFT_CHECKS.filter(c => preShiftChecks[c.id] === false).map(c => c.label)
    if (failed.length > 0) {
      fetch('/api/driver/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: driverInfo.clientId,
          driver_name: driverInfo.name,
          vehicle_reg: driverInfo.vehicleReg,
          issue_description: `PRE-SHIFT DEFECT REPORT. Driver ${driverInfo.name} (${driverInfo.vehicleReg}) has flagged the following as NOT OK before starting shift: ${failed.join(', ')}. Vehicle may not be roadworthy. Ops manager must assess before driver departs.`,
          human_description: `Pre-shift fail: ${failed.join(', ')}`,
          location_description: 'At depot — pre-departure',
        })
      }).catch(() => {})
    }
  }

  function endShift() {
    const completed = jobs.filter(j=>j.status==='completed').length
    const total = jobs.length
    const incidents = lastAlert ? 1 : 0
    const start = shiftStartTime.current
    const end = new Date()
    const duration = start ? Math.round((end-start)/60000) : null
    setShiftSummary({ completed, total, incidents, duration, endTime: end.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) })
    setShiftEnded(true)
    localStorage.removeItem('dh_shift_started')
    localStorage.removeItem('dh_last_alert')
  }

  const cargoIcon = t=>!t?'📦':t.includes('pharma')?'💊':t.includes('frozen')?'🧊':t.includes('chilled')?'❄':'📦'
  const sortedJobs = [...jobs.filter(j=>j.status!=='completed'),...jobs.filter(j=>j.status==='completed')]

  // ── SETUP SCREEN ─────────────────────────────────────────────────────────
  if (!setupDone) return (
    <div style={{minHeight:'100vh',background:'#0a0c0e',color:'#e8eaed',fontFamily:'IBM Plex Sans,sans-serif',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{width:'100%',maxWidth:380}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:36}}>
          <div style={{width:40,height:40,background:'#00e5b0',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'#000',fontFamily:'monospace'}}>DH</div>
          <div><div style={{fontSize:18,fontWeight:600}}>DisruptionHub</div><div style={{fontSize:12,color:'#4a5260'}}>Driver App</div></div>
        </div>
        <div style={{fontSize:12,color:'#4a5260',fontFamily:'monospace',letterSpacing:'0.08em',marginBottom:20}}>FIRST TIME SETUP</div>
        {[{label:'Your full name',key:'name',placeholder:'e.g. Carl Hughes'},{label:'Vehicle registration',key:'vehicleReg',placeholder:'e.g. BK21 XYZ'},{label:'Company access code',key:'clientId',placeholder:'Given by your manager'}].map(f=>(
          <div key={f.key} style={{marginBottom:16}}>
            <div style={{fontSize:14,color:'#8a9099',marginBottom:6}}>{f.label}</div>
            <input value={driverInfo[f.key]} onChange={e=>setDriverInfo(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder}
              style={{width:'100%',padding:'14px',background:'#111418',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#e8eaed',fontSize:16,outline:'none',boxSizing:'border-box'}}/>
          </div>
        ))}
        <button onClick={saveDriverInfo} style={{width:'100%',padding:16,background:'#00e5b0',border:'none',borderRadius:8,color:'#000',fontWeight:700,fontSize:16,cursor:'pointer',marginTop:8}}>Get started →</button>
      </div>
    </div>
  )

  // ── PRE-SHIFT CHECK ───────────────────────────────────────────────────────
  if (!shiftStarted || view==='preshift') return (
    <div style={{minHeight:'100vh',background:'#0a0c0e',color:'#e8eaed',fontFamily:'IBM Plex Sans,sans-serif',paddingBottom:40}}>
      <div style={{padding:'16px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:28,height:28,background:'#00e5b0',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'#000',fontFamily:'monospace'}}>DH</div>
          <div>
            <div style={{fontSize:13,fontWeight:500}}>{driverInfo.name}</div>
            <div style={{fontSize:10,color:'#4a5260',fontFamily:'monospace'}}>{driverInfo.vehicleReg}</div>
          </div>
        </div>
        {view==='preshift'&&<button onClick={()=>setView('run')} style={{background:'none',border:'none',color:'#4a5260',fontSize:13,cursor:'pointer'}}>Skip →</button>}
      </div>

      <div style={{padding:'24px 16px 16px'}}>
        <div style={{fontSize:22,fontWeight:700,marginBottom:4}}>Pre-Shift Check</div>
        <div style={{fontSize:14,color:'#8a9099',marginBottom:24}}>Tick each one before you start your shift</div>

        {PRESHIFT_CHECKS.map(check=>{
          const passed = preShiftChecks[check.id]
          const failed = preShiftChecks[check.id]===false
          return (
            <div key={check.id} style={{display:'flex',alignItems:'center',gap:14,padding:'16px',background:failed?'rgba(239,68,68,0.06)':passed?'rgba(0,229,176,0.05)':'#111418',border:`1px solid ${failed?'rgba(239,68,68,0.3)':passed?'rgba(0,229,176,0.25)':'rgba(255,255,255,0.06)'}`,borderRadius:10,marginBottom:8,transition:'all 0.15s'}}>
              <span style={{fontSize:24,flexShrink:0}}>{check.icon}</span>
              <div style={{flex:1,fontSize:15,color: failed?'#ef4444':passed?'#00e5b0':'#e8eaed',fontWeight:passed||failed?500:400}}>{check.label}</div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>setPreShiftChecks(p=>({...p,[check.id]:true}))}
                  style={{width:44,height:44,borderRadius:8,border:`2px solid ${passed?'#00e5b0':'rgba(0,229,176,0.3)'}`,background:passed?'rgba(0,229,176,0.15)':'transparent',color:passed?'#00e5b0':'#4a5260',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✓</button>
                <button onClick={()=>setPreShiftChecks(p=>({...p,[check.id]:false}))}
                  style={{width:44,height:44,borderRadius:8,border:`2px solid ${failed?'#ef4444':'rgba(239,68,68,0.25)'}`,background:failed?'rgba(239,68,68,0.12)':'transparent',color:failed?'#ef4444':'#4a5260',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✗</button>
              </div>
            </div>
          )
        })}

        {Object.values(preShiftChecks).some(v=>v===false)&&(
          <div style={{padding:'12px 14px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,marginTop:8,marginBottom:16,fontSize:13,color:'#ef4444',fontWeight:500}}>
            ⚠ You have flagged defects — ops will be notified automatically when you start
          </div>
        )}

        {Object.keys(preShiftChecks).length>0&&(
          <button onClick={startShift}
            style={{width:'100%',padding:16,background:'#00e5b0',border:'none',borderRadius:10,color:'#000',fontWeight:700,fontSize:16,cursor:'pointer',marginTop:16}}>
            ✓ Start shift
          </button>
        )}
        {Object.keys(preShiftChecks).length===0&&(
          <div style={{textAlign:'center',padding:'20px 0',fontSize:13,color:'#4a5260'}}>Tick each item above to continue</div>
        )}
      </div>
    </div>
  )

  // ── SHIFT SUMMARY ─────────────────────────────────────────────────────────
  if (shiftEnded && shiftSummary) return (
    <div style={{minHeight:'100vh',background:'#0a0c0e',color:'#e8eaed',fontFamily:'IBM Plex Sans,sans-serif',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{width:'100%',maxWidth:400}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:56,marginBottom:12}}>🏁</div>
          <div style={{fontSize:26,fontWeight:700,color:'#00e5b0',marginBottom:4}}>Shift Complete</div>
          <div style={{fontSize:14,color:'#4a5260'}}>Signed off at {shiftSummary.endTime}</div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
          <div style={{padding:'20px',background:'rgba(0,229,176,0.06)',border:'1px solid rgba(0,229,176,0.2)',borderRadius:12,textAlign:'center'}}>
            <div style={{fontSize:36,fontWeight:700,color:'#00e5b0',fontFamily:'monospace'}}>{shiftSummary.completed}</div>
            <div style={{fontSize:13,color:'#8a9099',marginTop:4}}>Runs delivered</div>
          </div>
          <div style={{padding:'20px',background:'rgba(59,130,246,0.06)',border:'1px solid rgba(59,130,246,0.2)',borderRadius:12,textAlign:'center'}}>
            <div style={{fontSize:36,fontWeight:700,color:'#3b82f6',fontFamily:'monospace'}}>{shiftSummary.total}</div>
            <div style={{fontSize:13,color:'#8a9099',marginTop:4}}>Total jobs today</div>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:28}}>
          <div style={{padding:'16px',background:'#111418',border:'1px solid rgba(255,255,255,0.06)',borderRadius:12,textAlign:'center'}}>
            <div style={{fontSize:28,fontWeight:700,color:shiftSummary.incidents>0?'#f59e0b':'#00e5b0',fontFamily:'monospace'}}>{shiftSummary.incidents}</div>
            <div style={{fontSize:13,color:'#8a9099',marginTop:4}}>Incidents logged</div>
          </div>
          <div style={{padding:'16px',background:'#111418',border:'1px solid rgba(255,255,255,0.06)',borderRadius:12,textAlign:'center'}}>
            <div style={{fontSize:28,fontWeight:700,color:'#e8eaed',fontFamily:'monospace'}}>{shiftSummary.duration ? `${shiftSummary.duration}m` : '—'}</div>
            <div style={{fontSize:13,color:'#8a9099',marginTop:4}}>Shift duration</div>
          </div>
        </div>

        {shiftSummary.completed===shiftSummary.total&&(
          <div style={{padding:'14px',background:'rgba(0,229,176,0.06)',border:'1px solid rgba(0,229,176,0.2)',borderRadius:10,textAlign:'center',marginBottom:20,fontSize:14,color:'#00e5b0',fontWeight:500}}>
            ✓ All runs delivered — full shift complete
          </div>
        )}

        <button onClick={()=>{localStorage.removeItem('dh_driver_info');localStorage.removeItem('dh_shift_started');setSetupDone(false);setShiftStarted(false);setShiftEnded(false);setJobs([]);setActiveJob(null);setShiftSummary(null)}}
          style={{width:'100%',padding:'16px',background:'#111418',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,color:'#4a5260',fontWeight:500,fontSize:14,cursor:'pointer'}}>
          Sign out
        </button>
      </div>
    </div>
  )

  // ── MAIN APP ──────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:'100vh',background:'#0a0c0e',color:'#e8eaed',fontFamily:'IBM Plex Sans,sans-serif',paddingBottom:88}}>

      {/* Toast */}
      {toast&&<div style={{position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',zIndex:999,padding:'10px 22px',borderRadius:8,background:'#111418',border:'1px solid rgba(0,229,176,0.35)',color:'#00e5b0',fontSize:14,fontWeight:500,whiteSpace:'nowrap',boxShadow:'0 4px 24px rgba(0,0,0,0.6)'}}>{toast.msg}</div>}

      {/* Undo delivered bar */}
      {pendingUndo&&(
        <div style={{position:'fixed',top:0,left:0,right:0,zIndex:998,padding:'14px 16px',background:'#1a2218',borderBottom:'2px solid #00e5b0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:14,color:'#e8eaed',fontWeight:600}}>📦 {pendingUndo.job.ref} marked as delivered</div>
            <div style={{fontSize:12,color:'#4a5260',marginTop:2}}>Undoing in {undoCountdown}s...</div>
          </div>
          <button onClick={undoDelivered} style={{padding:'9px 20px',background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.5)',borderRadius:8,color:'#ef4444',fontWeight:700,fontSize:14,cursor:'pointer'}}>UNDO</button>
        </div>
      )}

      {/* NAV */}
      <div style={{padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(255,255,255,0.06)',background:'rgba(10,12,14,0.98)',position:'sticky',top:pendingUndo?56:0,zIndex:50,transition:'top 0.2s'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:28,height:28,background:'#00e5b0',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'#000',fontFamily:'monospace'}}>DH</div>
          <div>
            <div style={{fontSize:13,fontWeight:600}}>{driverInfo.name}</div>
            <div style={{fontSize:10,color:'#4a5260',fontFamily:'monospace'}}>{driverInfo.vehicleReg}</div>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={()=>setView(view==='allruns'?'run':'allruns')} style={{padding:'6px 12px',background:view==='allruns'?'rgba(0,229,176,0.1)':'transparent',border:`1px solid ${view==='allruns'?'rgba(0,229,176,0.3)':'rgba(255,255,255,0.08)'}`,borderRadius:6,color:view==='allruns'?'#00e5b0':'#4a5260',fontSize:11,cursor:'pointer',fontFamily:'monospace'}}>
            ALL RUNS
          </button>
          <div style={{fontSize:11,color:'#4a5260',fontFamily:'monospace'}}>{new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}).toUpperCase()}</div>
        </div>
      </div>

      {/* ALL RUNS VIEW */}
      {view==='allruns'&&(
        <div style={{padding:'16px'}}>
          <div style={{fontSize:18,fontWeight:600,marginBottom:16}}>{jobs.length} runs today</div>
          {sortedJobs.map(job=>{
            const sc=STATUS_COLORS[job.status]||STATUS_COLORS['on-track']
            const isDone=job.status==='completed'
            return(
              <div key={job.ref} onClick={()=>{if(!isDone){setActiveJob(job);setView('run')}}}
                style={{padding:'14px',borderRadius:10,marginBottom:8,border:`1px solid ${sc.border}`,background:sc.bg,opacity:isDone?0.4:1,cursor:isDone?'default':'pointer'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                  <span style={{fontFamily:'monospace',fontSize:14,fontWeight:700}}>{job.ref}</span>
                  <div style={{display:'flex',alignItems:'center',gap:5}}>
                    <div style={{width:7,height:7,borderRadius:'50%',background:sc.dot}}/>
                    <span style={{fontFamily:'monospace',fontSize:11,color:sc.dot}}>{sc.label}</span>
                  </div>
                </div>
                <div style={{fontSize:14,color:'#8a9099',marginBottom:3}}>{job.route}</div>
                {!isDone&&<div style={{display:'flex',gap:10,fontSize:12,color:'#4a5260',flexWrap:'wrap'}}>
                  {job.eta&&<span>ETA {job.eta}</span>}
                  {job.sla_window&&<span>Slot {job.sla_window}</span>}
                  {job.cargo_type&&<span>{cargoIcon(job.cargo_type)} {job.cargo_type}</span>}
                </div>}
              </div>
            )
          })}
          <button onClick={()=>{localStorage.removeItem('dh_driver_info');localStorage.removeItem('dh_shift_started');setSetupDone(false);setShiftStarted(false);setJobs([]);setActiveJob(null)}}
            style={{width:'100%',padding:12,background:'transparent',border:'1px solid rgba(255,255,255,0.06)',borderRadius:8,color:'#4a5260',fontSize:13,cursor:'pointer',marginTop:8}}>
            Change driver / vehicle
          </button>
        </div>
      )}

      {/* MAIN RUN VIEW */}
      {view==='run'&&(
        <div style={{padding:'12px 0'}}>

          {/* Last alert */}
          {lastAlert&&(
            <div onClick={reopenLastAlert} style={{margin:'0 12px 12px',padding:'13px 14px',borderRadius:10,cursor:'pointer',border:`1px solid ${SEV[lastAlert.severity]?.border||'rgba(245,158,11,0.35)'}`,background:SEV[lastAlert.severity]?.bg}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div style={{display:'flex',gap:10,flex:1}}>
                  <span style={{fontSize:20,flexShrink:0}}>{SEV[lastAlert.severity]?.icon||'⚠️'}</span>
                  <div>
                    <div style={{fontSize:10,color:SEV[lastAlert.severity]?.color,fontFamily:'monospace',fontWeight:700,letterSpacing:'0.06em',marginBottom:3}}>LAST ALERT · {lastAlert.time}</div>
                    <div style={{fontSize:14,color:'#e8eaed',fontWeight:600,lineHeight:1.4}}>{lastAlert.headline}</div>
                    {lastAlert.actions?.[0]&&<div style={{fontSize:12,color:'#8a9099',marginTop:5}}>→ {lastAlert.actions[0]}</div>}
                  </div>
                </div>
                <div style={{fontSize:11,color:'#4a5260',flexShrink:0,marginLeft:8}}>Tap →</div>
              </div>
            </div>
          )}

          {/* ACTIVE JOB CARD */}
          {activeJob&&(()=>{
            const sc=STATUS_COLORS[activeJob.status]||STATUS_COLORS['on-track']
            const isDone=activeJob.status==='completed'
            const currentStepIdx=PROGRESS_STEPS.findIndex(s=>s.status===activeJob.status)
            return(
              <div style={{margin:'0 12px 16px',borderRadius:12,border:`1px solid ${sc.border}`,background:sc.bg,overflow:'hidden'}}>
                {/* Job header */}
                <div style={{padding:'16px 16px 12px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                    <span style={{fontFamily:'monospace',fontSize:20,fontWeight:700,color:'#e8eaed'}}>{activeJob.ref}</span>
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:sc.dot}}/>
                      <span style={{fontFamily:'monospace',fontSize:11,fontWeight:600,color:sc.dot}}>{sc.label}</span>
                    </div>
                  </div>
                  <div style={{fontSize:17,color:'#e8eaed',fontWeight:500,marginBottom:8}}>{activeJob.route}</div>
                  <div style={{display:'flex',gap:12,fontSize:13,color:'#8a9099',flexWrap:'wrap'}}>
                    {activeJob.eta&&<span>ETA {activeJob.eta}</span>}
                    {activeJob.sla_window&&<span>Slot {activeJob.sla_window}</span>}
                    {activeJob.carrier&&<span>{activeJob.carrier}</span>}
                  </div>
                  {activeJob.cargo_type&&<div style={{marginTop:8,fontSize:13,color:'#3b82f6',fontWeight:500}}>{cargoIcon(activeJob.cargo_type)} {activeJob.cargo_type}</div>}
                  {activeJob.alert&&<div style={{marginTop:8,padding:'7px 10px',background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:6,fontSize:12,color:'#f59e0b'}}>⚠ {activeJob.alert}</div>}
                  {activeJob.status==='at_risk'&&<div style={{marginTop:8,padding:'8px 10px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:6,fontSize:12,color:'#ef4444',fontWeight:500}}>⚠ Reassignment required — ops notified</div>}
                </div>

                {/* Progress buttons */}
                {!isDone&&(
                  <div style={{padding:'14px 16px'}}>
                    <div style={{fontSize:10,color:'#4a5260',fontFamily:'monospace',letterSpacing:'0.08em',marginBottom:10}}>LOG YOUR PROGRESS</div>

                    {/* Three progress steps */}
                    <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:8}}>
                      {PROGRESS_STEPS.filter(s=>!s.isDelivery).map((step,i)=>{
                        const isDoneStep = currentStepIdx>i
                        const isNext = currentStepIdx<i && currentStepIdx===i-1 || (currentStepIdx===-1&&i===0)
                        const isCurrent = currentStepIdx===i
                        return(
                          <button key={step.id} onClick={()=>logProgress(step)}
                            style={{width:'100%',padding:'13px 16px',borderRadius:9,border:`1px solid ${isDoneStep?'rgba(74,82,96,0.3)':isCurrent?step.color+'44':isNext?step.color+'33':'rgba(255,255,255,0.06)'}`,background:isDoneStep?'rgba(74,82,96,0.08)':isCurrent?step.color+'15':'transparent',cursor:isDoneStep?'default':'pointer',display:'flex',alignItems:'center',gap:12,transition:'all 0.15s',opacity:isDoneStep?0.5:1}}>
                            <span style={{fontSize:20,flexShrink:0}}>{isDoneStep?'✓':step.icon}</span>
                            <span style={{fontSize:15,color:isDoneStep?'#4a5260':isCurrent?step.color:'#e8eaed',fontWeight:isCurrent?600:400}}>{step.label}</span>
                            {isCurrent&&<span style={{marginLeft:'auto',fontSize:11,color:step.color,fontFamily:'monospace'}}>TAP →</span>}
                          </button>
                        )
                      })}
                    </div>

                    {/* Delivered — big, separate, prominent */}
                    <button onClick={()=>logProgress(PROGRESS_STEPS.find(s=>s.isDelivery))}
                      style={{width:'100%',padding:'16px',borderRadius:10,border:'2px solid rgba(0,229,176,0.4)',background:'rgba(0,229,176,0.08)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
                      <span style={{fontSize:22}}>📦</span>
                      <span style={{fontSize:16,color:'#00e5b0',fontWeight:700}}>Mark as Delivered</span>
                    </button>
                  </div>
                )}
              </div>
            )
          })()}

          {/* ISSUE SECTIONS — only show if there are active jobs */}
          {jobs.some(j=>j.status!=='completed') ? (
            <>
              {ISSUE_GROUPS.map(group=>(
                <div key={group.id} style={{marginBottom:4}}>
                  <div style={{padding:'6px 16px',fontSize:10,color:group.color,fontFamily:'monospace',fontWeight:700,letterSpacing:'0.1em'}}>{group.label}</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,padding:'0 12px 10px'}}>
                    {group.issues.map(issue=>(
                      <button key={issue.id} onClick={()=>openIssue(issue)}
                        style={{padding:'13px 10px',borderRadius:9,background:'#111418',border:`1px solid rgba(255,255,255,0.07)`,display:'flex',alignItems:'center',gap:10,cursor:'pointer',outline:'none',textAlign:'left'}}>
                        <span style={{fontSize:22,flexShrink:0}}>{issue.icon}</span>
                        <span style={{fontSize:13,color:'#e8eaed',lineHeight:1.3,fontWeight:400}}>{issue.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          ) : (
            /* All runs complete */
            <div style={{margin:'8px 12px 16px',padding:'24px 20px',borderRadius:12,background:'rgba(0,229,176,0.05)',border:'1px solid rgba(0,229,176,0.2)',textAlign:'center'}}>
              <div style={{fontSize:40,marginBottom:10}}>🎉</div>
              <div style={{fontSize:20,fontWeight:700,color:'#00e5b0',marginBottom:6}}>All runs complete</div>
              <div style={{fontSize:14,color:'#8a9099',marginBottom:24,lineHeight:1.5}}>
                {jobs.length} run{jobs.length!==1?'s':''} delivered today. Good work.
              </div>
              <button onClick={endShift}
                style={{width:'100%',padding:'16px',background:'#00e5b0',border:'none',borderRadius:10,color:'#000',fontWeight:700,fontSize:16,cursor:'pointer',marginBottom:12}}>
                ✓ End shift
              </button>
              <div style={{fontSize:11,color:'#4a5260'}}>This will generate your shift summary</div>
            </div>
          )}

          {/* Pre-shift check link */}
          <div style={{padding:'4px 12px 16px'}}>
            <button onClick={()=>setView('preshift')} style={{width:'100%',padding:'12px',background:'transparent',border:'1px solid rgba(255,255,255,0.06)',borderRadius:8,color:'#4a5260',fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              🔍 Run vehicle pre-check
            </button>
          </div>
        </div>
      )}

      {/* ── STICKY BAR ──────────────────────────────────────────────────── */}
      <div style={{position:'fixed',bottom:0,left:0,right:0,padding:'10px 12px 24px',background:'rgba(10,12,14,0.97)',borderTop:'1px solid rgba(255,255,255,0.07)',backdropFilter:'blur(10px)',zIndex:100,display:'grid',gridTemplateColumns:'5fr 3fr 3fr',gap:8}}>
        <button onClick={()=>openIssue({id:'breakdown',label:'Breakdown',icon:'🚨',needsText:true,placeholder:'What happened?'})}
          style={{padding:'14px',background:'#ef4444',border:'none',borderRadius:10,color:'#fff',fontWeight:700,fontSize:15,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          🚨 BREAKDOWN
        </button>
        <button onClick={()=>openIssue({id:'medical',label:'Medical Emergency',icon:'🚑',needsText:false})}
          style={{padding:'14px',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:10,color:'#ef4444',fontWeight:600,fontSize:12,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3}}>
          <span style={{fontSize:18}}>🚑</span><span>Medical</span>
        </button>
        <button onClick={()=>openIssue({id:'cant_complete',label:"Can't Complete Runs",icon:'⛔',needsText:true,placeholder:'Reason — e.g. hours almost up'})}
          style={{padding:'14px',background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:10,color:'#ef4444',fontWeight:500,fontSize:12,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3}}>
          <span style={{fontSize:18}}>⛔</span><span>Can't Complete</span>
        </button>
      </div>

      {/* ── ISSUE PANEL ──────────────────────────────────────────────── */}
      {panelOpen&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}
          onClick={e=>{if(e.target===e.currentTarget)closePanel()}}>
          <div style={{background:'#111418',borderRadius:'18px 18px 0 0',maxHeight:'92vh',display:'flex',flexDirection:'column',borderTop:'2px solid rgba(255,255,255,0.08)'}}>

            {/* Panel header */}
            <div style={{padding:'18px 20px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:24}}>{panelIssue?.icon}</span>
                <span style={{fontSize:16,fontWeight:700,color:'#e8eaed'}}>{panelIssue?.label}</span>
              </div>
              <button onClick={closePanel} style={{background:'rgba(255,255,255,0.06)',border:'none',color:'#8a9099',fontSize:16,cursor:'pointer',width:32,height:32,borderRadius:16,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>

            <div style={{overflowY:'auto',flex:1,padding:'0 20px 32px'}}>

              {/* GPS bar */}
              <div style={{padding:'10px 12px',background:'#0d1014',borderRadius:8,display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
                <div style={{width:8,height:8,borderRadius:'50%',flexShrink:0,background:gpsStatus==='got'?'#00e5b0':gpsStatus==='getting'?'#f59e0b':'#4a5260'}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,color:'#4a5260',fontFamily:'monospace',marginBottom:2}}>YOUR LOCATION</div>
                  <div style={{fontSize:13,color:gpsStatus==='got'?'#e8eaed':'#8a9099'}}>{gpsStatus==='getting'?'Getting your location...':gpsStatus==='got'?gpsDescription:'GPS unavailable — describe your location below'}</div>
                </div>
                {gpsStatus!=='got'&&gpsStatus!=='getting'&&<button onClick={getGPS} style={{padding:'6px 12px',background:'rgba(0,229,176,0.08)',border:'1px solid rgba(0,229,176,0.2)',borderRadius:6,color:'#00e5b0',fontSize:12,cursor:'pointer',flexShrink:0}}>Get GPS</button>}
              </div>

              {/* Special notices */}
              {panelIssue?.id==='breakdown'&&<div style={{padding:'12px 14px',background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:9,marginBottom:14,fontSize:14,color:'#ef4444',fontWeight:600}}>🚑 If anyone is injured — call 999 first before anything else</div>}
              {panelIssue?.id==='medical'&&<div style={{padding:'12px 14px',background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:9,marginBottom:14,fontSize:14,color:'#ef4444',fontWeight:600}}>🚑 Call 999 immediately if this is life-threatening</div>}
              {panelIssue?.id==='theft_threat'&&<div style={{padding:'12px 14px',background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:9,marginBottom:14,fontSize:14,color:'#ef4444',fontWeight:600}}>🔒 Stay in your cab. Lock doors. Do not confront anyone.</div>}
              {panelIssue?.id==='temp_alarm'&&<div style={{padding:'12px 14px',background:'rgba(6,182,212,0.07)',border:'1px solid rgba(6,182,212,0.25)',borderRadius:9,marginBottom:14,fontSize:14,color:'#06b6d4',fontWeight:500}}>Enter probe reading — not the unit display. They can differ.</div>}
              {panelIssue?.id==='cant_complete'&&<div style={{padding:'12px 14px',background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:9,marginBottom:14,fontSize:13,color:'#ef4444'}}>Remaining jobs will be flagged AT RISK. Ops will be notified immediately with reassignment instructions.</div>}
              {panelIssue?.note&&<div style={{padding:'12px 14px',background:'rgba(59,130,246,0.07)',border:'1px solid rgba(59,130,246,0.25)',borderRadius:9,marginBottom:14,fontSize:13,color:'#3b82f6'}}>{panelIssue.note}</div>}

              {/* RESULT */}
              {panelState==='result'&&parsedResult&&(()=>{
                const s=SEV[parsedResult.severity]||SEV.MEDIUM
                return(
                  <div>
                    <div style={{padding:'16px',background:s.bg,border:`1px solid ${s.border}`,borderRadius:12,marginBottom:16,display:'flex',gap:12,alignItems:'flex-start'}}>
                      <span style={{fontSize:28,flexShrink:0}}>{s.icon}</span>
                      <div>
                        <div style={{fontSize:11,color:s.color,fontFamily:'monospace',fontWeight:700,letterSpacing:'0.08em',marginBottom:5}}>{parsedResult.severity}</div>
                        <div style={{fontSize:17,fontWeight:700,color:'#e8eaed',lineHeight:1.4}}>{parsedResult.headline}</div>
                      </div>
                    </div>
                    {parsedResult.actions.length>0&&(
                      <div style={{marginBottom:16}}>
                        <div style={{fontSize:11,color:'#4a5260',fontFamily:'monospace',letterSpacing:'0.08em',marginBottom:10}}>WHAT TO DO</div>
                        {parsedResult.actions.map((action,i)=>(
                          <div key={i} style={{display:'flex',gap:12,marginBottom:10,padding:'14px',background:'rgba(0,0,0,0.35)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:10,alignItems:'flex-start'}}>
                            <div style={{width:28,height:28,borderRadius:'50%',background:i===0?s.color:'rgba(255,255,255,0.08)',color:i===0?'#000':'#8a9099',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,flexShrink:0}}>{i+1}</div>
                            <div style={{fontSize:15,color:'#e8eaed',lineHeight:1.5,fontWeight:i===0?600:400}}>{action}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {parsedResult.detail&&(
                      <div style={{marginBottom:16}}>
                        <button onClick={()=>setShowDetail(v=>!v)} style={{width:'100%',padding:'11px 14px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:9,color:'#4a5260',fontSize:13,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <span>Full analysis for ops</span><span>{showDetail?'▲':'▼'}</span>
                        </button>
                        {showDetail&&<div style={{padding:'14px',background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'0 0 9px 9px',borderTop:'none'}}>
                          {parsedResult.detail.split('\n').map((line,i)=>{
                            if(!line.trim())return <div key={i} style={{height:5}}/>
                            const cl=line.replace(/\*\*/g,'').replace(/^[#\-]\s*/,'').trim()
                            const bold=line.match(/^[A-Z\s\/]+:$/)
                            return <div key={i} style={{fontSize:13,color:bold?'#e8eaed':'#8a9099',lineHeight:1.7,fontWeight:bold?500:400,marginBottom:1}}>{cl}</div>
                          })}
                        </div>}
                      </div>
                    )}
                    <button onClick={closePanel} style={{width:'100%',padding:16,background:'#00e5b0',border:'none',borderRadius:10,color:'#000',fontWeight:700,fontSize:16,cursor:'pointer',marginBottom:10}}>Got it — close</button>
                    {!['cant_complete','hours_running_out','medical'].includes(panelIssue?.id)&&(
                      <button onClick={()=>setPanelState('resolving')} style={{width:'100%',padding:14,background:'transparent',border:'1px solid rgba(0,229,176,0.3)',borderRadius:10,color:'#00e5b0',fontWeight:500,fontSize:15,cursor:'pointer'}}>
                        ✅ Issue resolved — back on track
                      </button>
                    )}
                  </div>
                )
              })()}

              {/* RESOLVING */}
              {panelState==='resolving'&&(
                <div>
                  <div style={{fontSize:18,fontWeight:700,color:'#e8eaed',marginBottom:6}}>What happened?</div>
                  <div style={{fontSize:14,color:'#4a5260',marginBottom:16}}>Ops will be notified and your job updates to on-track.</div>
                  {[
                    {id:'breakdown_recovered',  label:'🔧 Breakdown recovered',   sub:'Vehicle moving again'},
                    {id:'delay_cleared',         label:'🟢 Delay cleared',         sub:'Back on schedule'},
                    {id:'temp_back_in_range',    label:'❄ Temp back in range',    sub:'Cold chain restored'},
                    {id:'rerouted_clear',         label:'🛣 Rerouted — clear now', sub:'New route confirmed'},
                    {id:'collection_complete',   label:'📍 Collection complete',  sub:'Loading done, departing'},
                    {id:'delivery_accepted',     label:'📦 Delivery accepted',     sub:'POD signed'},
                    {id:'access_resolved',       label:'🚪 Access resolved',       sub:'Now at site'},
                    {id:'other_resolved',        label:'✅ Other — resolved',      sub:'Issue no longer active'},
                  ].map(opt=>(
                    <button key={opt.id} onClick={()=>resolveIssue(opt.label)}
                      style={{width:'100%',marginBottom:8,padding:'14px',background:'rgba(0,229,176,0.04)',border:'1px solid rgba(0,229,176,0.12)',borderRadius:10,cursor:'pointer',textAlign:'left',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div><div style={{fontSize:15,color:'#e8eaed',fontWeight:500}}>{opt.label}</div><div style={{fontSize:12,color:'#4a5260',marginTop:2}}>{opt.sub}</div></div>
                      <span style={{color:'#00e5b0',fontSize:16}}>→</span>
                    </button>
                  ))}
                  <button onClick={()=>setPanelState('result')} style={{width:'100%',padding:10,background:'transparent',border:'none',color:'#4a5260',fontSize:13,cursor:'pointer',marginTop:4}}>← Back</button>
                </div>
              )}

              {panelState==='resolving_loading'&&<div style={{textAlign:'center',padding:'48px 0'}}><div style={{width:40,height:40,border:'3px solid rgba(0,229,176,0.15)',borderTop:'3px solid #00e5b0',borderRadius:'50%',margin:'0 auto 16px',animation:'spin 1s linear infinite'}}/><div style={{fontSize:14,color:'#00e5b0',fontFamily:'monospace'}}>NOTIFYING OPS...</div><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}

              {panelState==='resolved'&&(
                <div style={{textAlign:'center',padding:'24px 0'}}>
                  <div style={{fontSize:48,marginBottom:12}}>✅</div>
                  <div style={{fontSize:20,color:'#00e5b0',fontWeight:700,marginBottom:6}}>Back on track</div>
                  <div style={{fontSize:14,color:'#8a9099',marginBottom:resolvedEta?14:24}}>Ops notified. Job updated.</div>
                  {resolvedEta&&<div style={{padding:'12px 16px',background:'rgba(0,229,176,0.06)',border:'1px solid rgba(0,229,176,0.2)',borderRadius:10,marginBottom:24,fontSize:14,color:'#e8eaed',lineHeight:1.6,textAlign:'left'}}>{resolvedEta}</div>}
                  <button onClick={closePanel} style={{padding:'14px 48px',background:'#00e5b0',border:'none',borderRadius:10,color:'#000',fontWeight:700,fontSize:15,cursor:'pointer'}}>Close</button>
                </div>
              )}

              {panelState==='sent'&&(
                <div style={{textAlign:'center',padding:'32px 0'}}>
                  <div style={{fontSize:44,marginBottom:12}}>✅</div>
                  <div style={{fontSize:18,color:'#00e5b0',fontWeight:700,marginBottom:6}}>Ops notified</div>
                  <div style={{fontSize:14,color:'#4a5260',marginBottom:24}}>Your manager has been alerted.</div>
                  <button onClick={closePanel} style={{padding:'13px 40px',background:'#00e5b0',border:'none',borderRadius:10,color:'#000',fontWeight:700,fontSize:15,cursor:'pointer'}}>Close</button>
                </div>
              )}

              {panelState==='no_active_job'&&(
                <div style={{textAlign:'center',padding:'32px 0'}}>
                  <div style={{fontSize:44,marginBottom:12}}>✅</div>
                  <div style={{fontSize:18,color:'#00e5b0',fontWeight:700,marginBottom:8}}>All runs are complete</div>
                  <div style={{fontSize:14,color:'#8a9099',marginBottom:8,lineHeight:1.6}}>There is no active delivery to raise this against.</div>
                  <div style={{fontSize:13,color:'#4a5260',marginBottom:24}}>If this is a vehicle or personal emergency, use the Breakdown or Medical buttons.</div>
                  <button onClick={closePanel} style={{padding:'13px 40px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,color:'#8a9099',fontWeight:500,fontSize:14,cursor:'pointer'}}>Close</button>
                </div>
              )}

              {panelState==='loading'&&(
                <div style={{textAlign:'center',padding:'48px 0'}}>
                  <div style={{width:44,height:44,border:'3px solid rgba(0,229,176,0.12)',borderTop:'3px solid #00e5b0',borderRadius:'50%',margin:'0 auto 16px',animation:'spin 1s linear infinite'}}/>
                  <div style={{fontSize:14,color:'#00e5b0',fontFamily:'monospace',marginBottom:6}}>GETTING INSTRUCTIONS...</div>
                  <div style={{fontSize:13,color:'#4a5260'}}>Ops manager alerted</div>
                </div>
              )}

              {/* IDLE */}
              {panelState==='idle'&&(
                <>
                  {panelIssue?.needsText&&(
                    <textarea value={inputText} onChange={e=>setInputText(e.target.value)} rows={4}
                      placeholder={panelIssue.placeholder||'Describe what has happened...'}
                      style={{width:'100%',padding:'14px',background:'#0d1014',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,color:'#e8eaed',fontSize:15,lineHeight:1.6,outline:'none',resize:'none',boxSizing:'border-box',marginBottom:14}}/>
                  )}
                  {activeJob&&(
                    <div style={{padding:'9px 12px',background:'rgba(0,229,176,0.04)',border:'1px solid rgba(0,229,176,0.1)',borderRadius:8,fontSize:12,color:'#8a9099',marginBottom:16}}>
                      Job: <span style={{color:'#00e5b0',fontWeight:500}}>{activeJob.ref}</span> · {activeJob.route}
                    </div>
                  )}
                  <button onClick={sendAlert}
                    style={{width:'100%',padding:16,background:['breakdown','cant_complete','theft_threat','driver_unwell','medical'].includes(panelIssue?.id)?'#ef4444':'#00e5b0',border:'none',borderRadius:10,color:['breakdown','cant_complete','theft_threat','driver_unwell','medical'].includes(panelIssue?.id)?'#fff':'#000',fontWeight:700,fontSize:16,cursor:'pointer',marginBottom:10}}>
                    {panelIssue?.id==='breakdown'?'🚨 Alert ops now':
                     panelIssue?.id==='medical'?'🚑 Alert ops — medical':
                     panelIssue?.id==='theft_threat'?'🦺 Alert ops — security threat':
                     panelIssue?.id==='cant_complete'?'⛔ Flag and alert ops':
                     panelIssue?.id==='rest'?'🛌 Find safe parking →':
                     panelIssue?.id==='temp_alarm'?'🌡 Log and check →':
                     '⚠ Get instructions →'}
                  </button>
                  <div style={{fontSize:12,color:'#4a5260',textAlign:'center',lineHeight:1.5}}>
                    {['breakdown','delayed','defect','temp_alarm','cant_complete','driver_unwell','theft_threat','medical','hours_running_out'].includes(panelIssue?.id)?'Ops manager will be notified immediately':'AI instructions in seconds'}
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
