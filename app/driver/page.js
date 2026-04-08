'use client'
import { useState, useEffect, useRef } from 'react'

const PROGRESS_STEPS = [
  { id:'arrived_collection', label:'Arrived at Collection', icon:'📍', color:'#3b82f6', status:'at_collection' },
  { id:'loading_complete',   label:'Loaded & Secured',     icon:'✅', color:'#00e5b0', status:'loaded' },
  { id:'arrived_delivery',   label:'Arrived at Customer',  icon:'🏭', color:'#3b82f6', status:'at_customer' },
]

const VEHICLE_TYPES = [
  { id:'artic',    label:'Artic (44t)',      icon:'🚛' },
  { id:'rigid',    label:'Rigid',            icon:'🚚' },
  { id:'fridge',   label:'Fridge / Reefer',  icon:'❄' },
  { id:'flatbed',  label:'Flatbed',          icon:'🔲' },
  { id:'taillift', label:'Tail-lift',        icon:'⬇' },
  { id:'van',      label:'Van / Sprinter',   icon:'🚐' },
]

const ISSUE_GROUPS = [
  {
    id:'road', label:'ON THE ROAD', color:'#f59e0b',
    issues:[
      { id:'delayed',         label:'Running Late',            icon:'⏰', needsText:true,  placeholder:'What is causing the delay?' },
      { id:'temp_alarm',      label:'Temp Alarm',              icon:'🌡', needsText:true,  placeholder:'Probe reading? e.g. 8°C — not the unit display' },
      { id:'load_movement',   label:'Load Movement',           icon:'📦', needsText:false, note:'Pull over safely before continuing.' },
      { id:'road_closure',    label:'Road Closure / Weather',  icon:'🌧', needsText:true,  placeholder:'e.g. M62 closed, flooding at J25' },
      { id:'low_bridge',      label:'Low Bridge / Restriction',icon:'🚧', needsText:true,  placeholder:'e.g. 14ft 6in bridge, my vehicle is 14ft 9in' },
      { id:'diversion',       label:'Wrong Route / Lost',      icon:'🗺', needsText:true,  placeholder:'Where are you and where are you trying to get to?' },
      { id:'tacho_fault',     label:'Tacho Fault',             icon:'📟', needsText:true,  placeholder:'What is the tacho showing? e.g. card error, mode fault' },
      { id:'accident',        label:'Accident',                icon:'💥', needsText:true,  placeholder:'What happened? Any injuries? Third party involved?' },
    ]
  },
  {
    id:'stop', label:'AT A STOP', color:'#3b82f6',
    issues:[
      { id:'customer_not_ready', label:'Customer Not Ready',     icon:'⏳', needsText:true,  placeholder:'How long have you been waiting?' },
      { id:'goods_refused',      label:'Goods Refused',          icon:'❌', needsText:true,  placeholder:'Why refused? Damage, wrong spec, temp breach?' },
      { id:'pod_problem',        label:'POD / Signature Issue',  icon:'✍', needsText:true,  placeholder:'What is the problem?' },
      { id:'access_problem',     label:"Can't Access Site",      icon:'🚪', needsText:true,  placeholder:'e.g. Height barrier, locked gate, no loading bay' },
      { id:'short_load',         label:'Wrong / Short Load',     icon:'📋', needsText:true,  placeholder:'What is missing or wrong?' },
      { id:'manifest_mismatch',  label:'Manifest Mismatch',      icon:'📄', needsText:true,  placeholder:'What does not match?' },
      { id:'damage_found',       label:'Damage Found',           icon:'⚠️', needsText:true,  placeholder:'What is damaged? When did you notice?' },
      { id:'overweight',         label:'Overweight',             icon:'⚖️', needsText:true,  placeholder:'What does the weighbridge show?' },
      { id:'part_delivery',      label:'Part Delivery',          icon:'📦', needsText:true,  placeholder:'What could not be delivered and why?' },
      { id:'difficult_customer', label:'Difficult Customer',     icon:'😤', needsText:true,  placeholder:'What is happening?' },
    ]
  },
  {
    id:'driver', label:'DRIVER', color:'#a855f7',
    issues:[
      { id:'driver_unwell',    label:'Feeling Unwell',        icon:'🤒', needsText:true,  placeholder:'What symptoms? Can you safely pull over?' },
      { id:'theft_threat',     label:'Suspicious / Threat',   icon:'🦺', needsText:true,  placeholder:'Describe what you have seen or what is happening.' },
      { id:'vehicle_theft',    label:'Vehicle Stolen',        icon:'🚨', needsText:true,  placeholder:'Where was it last? How long ago?' },
      { id:'hours_running_out',label:'Hours Running Out',     icon:'⏱', needsText:false, note:'System will calculate your remaining legal hours.' },
      { id:'adrhazmat',        label:'ADR / Hazmat Issue',    icon:'☢️', needsText:true,  placeholder:'What is the issue with the dangerous goods documentation?' },
      { id:'cant_complete',    label:"Can't Complete Runs",   icon:'⛔', needsText:true,  placeholder:'Reason — e.g. hours almost up, delay on first run' },
      { id:'rest',             label:'Need Rest Break',       icon:'🛌', needsText:false, note:'System will find nearest safe truck park.' },
    ]
  },
]

const PRESHIFT_CHECKS_BASE = [
  { id:'lights',  label:'Lights & indicators',        icon:'💡' },
  { id:'tyres',   label:'Tyres — no damage or flats', icon:'⚫' },
  { id:'mirrors', label:'Mirrors — clean & adjusted', icon:'🔲' },
  { id:'brakes',  label:'Brakes — no issues',         icon:'🛑' },
  { id:'fuel',    label:'Fuel level — checked',       icon:'⛽' },
  { id:'docs',    label:'Licence & documents',        icon:'📄' },
  { id:'load',    label:'Load — secured properly',    icon:'🔒' },
]
const PRESHIFT_FRIDGE = { id:'fridge', label:'Fridge unit — at temp', icon:'❄' }

const POSTSHIFT_CHECKS = [
  { id:'body_damage',  label:'No new body damage',   icon:'🔍' },
  { id:'tyres_post',   label:'Tyres still OK',       icon:'⚫' },
  { id:'lights_post',  label:'Lights still working', icon:'💡' },
  { id:'cab_clean',    label:'Cab left clean',       icon:'🧹' },
  { id:'fuel_logged',  label:'Fuel level noted',     icon:'⛽' },
]

const STATUS_COLORS = {
  'on-track':       { dot:'#00e5b0', label:'ON TRACK',       border:'rgba(0,229,176,0.2)',  bg:'rgba(0,229,176,0.03)' },
  'at_collection':  { dot:'#3b82f6', label:'AT COLLECTION',  border:'rgba(59,130,246,0.2)', bg:'rgba(59,130,246,0.03)' },
  'loaded':         { dot:'#00e5b0', label:'LOADED',         border:'rgba(0,229,176,0.2)',  bg:'rgba(0,229,176,0.03)' },
  'at_customer':    { dot:'#3b82f6', label:'AT CUSTOMER',    border:'rgba(59,130,246,0.2)', bg:'rgba(59,130,246,0.03)' },
  'part_delivered': { dot:'#f59e0b', label:'PART DELIVERED', border:'rgba(245,158,11,0.25)',bg:'rgba(245,158,11,0.04)' },
  'at_risk':        { dot:'#ef4444', label:'AT RISK',        border:'rgba(239,68,68,0.3)',  bg:'rgba(239,68,68,0.04)' },
  'disrupted':      { dot:'#ef4444', label:'DISRUPTED',      border:'rgba(239,68,68,0.3)',  bg:'rgba(239,68,68,0.04)' },
  'delayed':        { dot:'#f59e0b', label:'DELAYED',        border:'rgba(245,158,11,0.25)',bg:'rgba(245,158,11,0.04)' },
  'pending':        { dot:'#3b82f6', label:'PENDING',        border:'rgba(59,130,246,0.2)', bg:'rgba(59,130,246,0.03)' },
  'completed':      { dot:'#4a5260', label:'DONE',           border:'rgba(74,82,96,0.15)',  bg:'rgba(74,82,96,0.02)' },
}

const SEV = {
  CRITICAL: { bg:'rgba(239,68,68,0.12)',  border:'rgba(239,68,68,0.4)',  color:'#ef4444', icon:'🚨' },
  HIGH:     { bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.4)', color:'#f59e0b', icon:'⚠️' },
  MEDIUM:   { bg:'rgba(59,130,246,0.1)',  border:'rgba(59,130,246,0.35)',color:'#3b82f6', icon:'ℹ️' },
  LOW:      { bg:'rgba(0,229,176,0.08)',  border:'rgba(0,229,176,0.3)',  color:'#00e5b0', icon:'✅' },
  OK:       { bg:'rgba(0,229,176,0.08)',  border:'rgba(0,229,176,0.3)',  color:'#00e5b0', icon:'✅' },
}

export default function DriverApp() {
  const [jobs, setJobs]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [activeJob, setActiveJob]   = useState(null)
  const [driverInfo, setDriverInfo] = useState({ name:'', clientId:'', vehicleReg:'', phone:'', vehicleType:'' })
  const [setupDone, setSetupDone]   = useState(false)
  const [view, setView]             = useState('run')

  const [toast, setToast]               = useState(null)
  const [pendingUndo, setPendingUndo]   = useState(null)
  const [undoCountdown, setUndoCountdown] = useState(0)
  const undoTimer      = useRef(null)
  const countdownTimer = useRef(null)
  const shiftStartTime = useRef(null)
  const notifiedCancellations = useRef(new Set()) // track which cancelled refs we've already shown banners for

  const [preShiftChecks, setPreShiftChecks]     = useState({})
  const [shiftStarted, setShiftStarted]         = useState(false)
  const [shiftEnded, setShiftEnded]             = useState(false)
  const [shiftSummary, setShiftSummary]         = useState(null)
  const [staleSession, setStaleSession]         = useState(null)
  const [opsMessages, setOpsMessages]           = useState([])
  const [shiftNotes, setShiftNotes]             = useState('')
  const [shiftMileage, setShiftMileage]         = useState('')
  const [mileageError, setMileageError]         = useState(false)
  const [postShiftChecks, setPostShiftChecks]   = useState({})
  const [showPostShift, setShowPostShift]       = useState(false)
  const [podFlow, setPodFlow]                   = useState(null)
  const [defectBlocked, setDefectBlocked]       = useState(false)
  const [opsAcknowledged, setOpsAcknowledged]   = useState(false)
  const [escalationTimer, setEscalationTimer]   = useState(null)
  const [resumeConfirm, setResumeConfirm]       = useState(false)
  const [opsJobUpdate, setOpsJobUpdate]         = useState(null)
  const [driverHistory, setDriverHistory]       = useState({ name:'', phone:'', clientId:'', regs:[] })
  const [regInputMode, setRegInputMode]         = useState('dropdown') // 'dropdown' | 'manual' // banner when ops cancels jobs

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
    // Load driver history for pre-filling setup screen
    try {
      const hist = localStorage.getItem('dh_driver_history')
      if (hist) {
        const h = JSON.parse(hist)
        setDriverHistory(h)
        // Pre-fill form fields from history if no active session
        const activeSession = localStorage.getItem('dh_driver_info')
        if (!activeSession) {
          const lastReg = h.regs?.[0]
          setDriverInfo({
            name: h.name || '',
            phone: h.phone || '',
            clientId: h.clientId || '',
            vehicleReg: lastReg?.reg || '',
            vehicleType: lastReg?.type || ''
          })
        }
      }
    } catch {}

    const saved = localStorage.getItem('dh_driver_info')
    if (saved) {
      const info = JSON.parse(saved)
      setDriverInfo(info)
      setSetupDone(true)

      const shiftStartedAt = localStorage.getItem('dh_shift_started_at')
      const shiftDone      = localStorage.getItem('dh_shift_started')
      const savedAlert     = localStorage.getItem('dh_last_alert')
      const savedMessages  = localStorage.getItem('dh_ops_messages')
      if (savedMessages) { try { setOpsMessages(JSON.parse(savedMessages)) } catch {} }

      if (shiftDone && shiftStartedAt) {
        const hoursAgo = (Date.now() - parseInt(shiftStartedAt)) / 3600000
        if (hoursAgo > 16) {
          let lastAlertTime = null
          if (savedAlert) { try { lastAlertTime = JSON.parse(savedAlert).time } catch {} }
          setStaleSession({ startedAt: new Date(parseInt(shiftStartedAt)).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}), hoursAgo: Math.round(hoursAgo), lastAlertTime })
          setLoading(false); return
        }
      }

      if (shiftDone) setShiftStarted(true)
      if (savedAlert) { try { setLastAlert(JSON.parse(savedAlert)) } catch {} }
      loadJobs(info).then(loaded => {
        // FIX: only auto-clear if all jobs completed AND we have actual jobs
        // Don't clear on new shift — localStorage progress will be empty so no false positives
        if (loaded && loaded.length > 0 && loaded.every(j => j.status === 'completed')) clearSession()
      })
    } else { setLoading(false) }
    return () => { clearTimeout(undoTimer.current); clearInterval(countdownTimer.current) }
  }, [])

  // ── OPS-INITIATED JOB POLL — checks every 60s for cancelled or newly assigned jobs ──
  useEffect(() => {
    if (!shiftStarted || !driverInfo.clientId || !driverInfo.vehicleReg) return

    const checkForOpsChanges = async () => {
      try {
        const res = await fetch(`/api/driver/progress?client_id=${driverInfo.clientId}&vehicle_reg=${encodeURIComponent(driverInfo.vehicleReg)}`)
        if (!res.ok) return
        const data = await res.json()
        const remote = data.progress || []

        // Detect cancelled jobs — only act on refs we haven't already processed
        const allCancelled = remote.filter(p => p.status === 'cancelled')
        const newlyCancelled = allCancelled.filter(p => !notifiedCancellations.current.has(p.ref))

        if (newlyCancelled.length > 0) {
          const cancelledRefs = newlyCancelled.map(c => c.ref)

          // Mark as handled immediately so repeat polls don't re-trigger
          cancelledRefs.forEach(ref => notifiedCancellations.current.add(ref))

          // Only update state if driver actually had these jobs
          let hadJobs = false
          setJobs(prev => {
            const affected = prev.filter(j => cancelledRefs.includes(j.ref))
            if (affected.length === 0) return prev
            hadJobs = true
            const updated = prev.filter(j => !cancelledRefs.includes(j.ref))
            saveJobProgress(updated)
            return updated
          })
          setActiveJob(prev => prev && cancelledRefs.includes(prev.ref) ? null : prev)

          // Only show banner if we actually removed jobs from this driver's list
          // Use a small delay to let setJobs settle before checking hadJobs
          setTimeout(() => {
            setJobs(prev => {
              const wasPresent = prev.some(j => cancelledRefs.includes(j.ref)) ||
                                 hadJobs
              if (wasPresent || hadJobs) {
                const refs = cancelledRefs.join(', ')
                setOpsJobUpdate(`📋 Ops has removed job${cancelledRefs.length > 1 ? 's' : ''} ${refs} from your schedule`)
                setTimeout(() => setOpsJobUpdate(null), 10000)
              }
              return prev
            })
          }, 100)
        }

        // Detect newly assigned jobs — refs with 'on-track' and 'Assigned by ops' alert
        const newAssignments = remote.filter(p =>
          p.status === 'on-track' &&
          p.alert?.includes('Assigned by ops') &&
          !notifiedCancellations.current.has('assigned_' + p.ref)
        )
        if (newAssignments.length > 0) {
          newAssignments.forEach(a => notifiedCancellations.current.add('assigned_' + a.ref))
          setJobs(prev => {
            const existingRefs = new Set(prev.map(j => j.ref))
            const trulyNew = newAssignments.filter(a => !existingRefs.has(a.ref))
            if (trulyNew.length === 0) return prev
            // Reload all jobs to get full details
            loadJobs(driverInfo)
            const refs = trulyNew.map(a => a.ref).join(', ')
            setOpsJobUpdate(`📋 New job${trulyNew.length > 1 ? 's' : ''} ${refs} added to your schedule`)
            setTimeout(() => setOpsJobUpdate(null), 10000)
            return prev
          })
        }

        // Detect ops instructions written to driver_progress.alert
        // When ops approves a webhook action, instruction is written as OPS_MSG:...
        const opsInstructions = remote.filter(p => p.alert?.startsWith('OPS_MSG:'))
        if (opsInstructions.length > 0) {
          const latest = opsInstructions[opsInstructions.length - 1]
          const msg = latest.alert.replace('OPS_MSG:', '').trim()
          const msgKey = 'ops_msg_' + latest.updated_at
          if (!notifiedCancellations.current.has(msgKey)) {
            notifiedCancellations.current.add(msgKey)
            setOpsMessages(prev => {
              const updated = [...prev, msg]
              try { localStorage.setItem('dh_ops_messages', JSON.stringify(updated)) } catch {}
              return updated
            })
          }
        }

      } catch {}
    }

    const interval = setInterval(checkForOpsChanges, 60000)
    return () => clearInterval(interval)
  }, [shiftStarted, driverInfo.clientId, driverInfo.vehicleReg])

  const showToast = (msg, type='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500) }

  function saveJobProgress(updatedJobs) {
    const progress = {}
    updatedJobs.forEach(j => { progress[j.ref] = { status:j.status, alert:j.alert||null } })
    localStorage.setItem('dh_job_progress', JSON.stringify(progress))
  }

  // FIX: if localStorage has no progress entries (new shift), ignore Supabase remote data
  function mergeJobProgress(jobs, remote) {
    const local = (() => { try { return JSON.parse(localStorage.getItem('dh_job_progress')||'{}') } catch { return {} } })()
    const isNewShift = Object.keys(local).length === 0
    const rem = {}
    if (!isNewShift && remote) remote.forEach(r => { rem[r.ref] = { status:r.status, alert:r.alert } })
    return jobs.map(j => rem[j.ref] ? {...j,...rem[j.ref]} : local[j.ref] ? {...j,...local[j.ref]} : j)
  }

  function pushProgressToSupabase(ref, status, alert) {
    if (!driverInfo.clientId || !driverInfo.vehicleReg || !ref) return
    fetch('/api/driver/progress', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ client_id:driverInfo.clientId, vehicle_reg:driverInfo.vehicleReg, driver_name:driverInfo.name, ref, status, alert:alert||null })
    }).catch(()=>{})
  }

  async function loadJobs(info) {
    if (!info?.clientId) return []
    setLoading(true)
    try {
      const [jobsRes, progressRes] = await Promise.all([
        fetch(`/api/shipments?client_id=${info.clientId}`),
        fetch(`/api/driver/progress?client_id=${info.clientId}&vehicle_reg=${encodeURIComponent(info.vehicleReg||'')}`)
      ])
      const jobsData  = await jobsRes.json()
      const progData  = await progressRes.json().catch(()=>({progress:[]}))
      const mapped = (jobsData.shipments||[]).map(s=>({
        ref:s.ref, route:s.route, carrier:s.carrier, status:s.status,
        eta:s.eta, sla_window:s.sla_window, cargo_type:s.cargo_type,
        alert:s.alert, penalty_if_breached:s.penalty_if_breached, cargo_value:s.cargo_value,
        drops:s.drops||null
      }))
      const merged = mergeJobProgress(mapped, progData.progress||[])
      setJobs(merged)
      const first = merged.find(j=>j.status!=='completed')||merged[0]
      if (first) setActiveJob(first)
      return merged
    } catch { showToast('Could not load jobs','error'); return [] }
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
          setGpsDescription([road,area].filter(Boolean).join(', ')||`${latitude.toFixed(4)},${longitude.toFixed(4)}`)
        } catch { setGpsDescription(`${latitude.toFixed(4)},${longitude.toFixed(4)}`) }
      },
      ()=>setGpsStatus('failed'),
      {enableHighAccuracy:true,timeout:10000,maximumAge:0}
    )
  }

  function logProgress(step) {
    const job = activeJob
    if (!job) return
    setJobs(prev=>{
      const updated = prev.map(j=>j.ref===job.ref?{...j,status:step.status,alert:null}:j)
      saveJobProgress(updated)
      return updated
    })
    setActiveJob(prev=>({...prev,status:step.status,alert:null}))
    pushProgressToSupabase(job.ref, step.status, null)
    showToast(`✓ ${step.label}`)
  }

  function initiateDelivered() {
    setPodFlow({ jobRef: activeJob?.ref })
  }

  function confirmDelivered(podOption) {
    const job = activeJob
    if (!job) return
    const prevStatus = job.status
    setPodFlow(null)
    setJobs(prev=>{
      const updated = prev.map(j=>j.ref===job.ref?{...j,status:'completed',alert:null,pod:podOption}:j)
      const reordered = [...updated.filter(j=>j.status!=='completed'),...updated.filter(j=>j.status==='completed')]
      saveJobProgress(reordered)
      return reordered
    })
    setActiveJob(prev=>({...prev,status:'completed',alert:null}))
    setJobs(prev=>{
      const next = prev.find(j=>j.status!=='completed'&&j.ref!==job.ref)
      if (next) setActiveJob(next)
      return prev
    })
    if (lastAlert) { setLastAlert(null); localStorage.removeItem('dh_last_alert') }
    pushProgressToSupabase(job.ref, 'completed', null)
    clearTimeout(undoTimer.current); clearInterval(countdownTimer.current)
    setPendingUndo({job,prevStatus})
    setUndoCountdown(5)
    countdownTimer.current = setInterval(()=>setUndoCountdown(n=>{if(n<=1){clearInterval(countdownTimer.current);return 0}return n-1}),1000)
    undoTimer.current = setTimeout(()=>{setPendingUndo(null);setUndoCountdown(0)},5000)
  }

  function undoDelivered() {
    if (!pendingUndo) return
    clearTimeout(undoTimer.current); clearInterval(countdownTimer.current)
    const {job,prevStatus} = pendingUndo
    setJobs(prev=>{ const updated=prev.map(j=>j.ref===job.ref?{...j,status:prevStatus}:j); saveJobProgress(updated); return updated })
    setActiveJob(job)
    setPendingUndo(null); setUndoCountdown(0)
    pushProgressToSupabase(job.ref, prevStatus, null)
    showToast('Delivery undone')
  }

  function openIssue(issue) {
    setPanelIssue(issue); setPanelOpen(true); setPanelState('idle')
    setInputText(''); setParsedResult(null); setShowDetail(false); setResolvedEta('')
    getGPS()
  }

  function closePanel() {
    if (parsedResult && panelState==='result') {
      const a = {...parsedResult, issueId:panelIssue?.id, issueLabel:panelIssue?.label, time:new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
      setLastAlert(a); localStorage.setItem('dh_last_alert',JSON.stringify(a))
    }
    if (panelState==='resolved') { setLastAlert(null); localStorage.removeItem('dh_last_alert') }
    setPanelOpen(false); setPanelIssue(null); setPanelState('idle')
    setInputText(''); setParsedResult(null); setShowDetail(false); setResolvedEta('')
  }

  function reopenLastAlert() {
    if (!lastAlert) return
    const issue = ISSUE_GROUPS.flatMap(g=>g.issues).find(i=>i.id===lastAlert.issueId)||{id:lastAlert.issueId,label:lastAlert.issueLabel||'Alert'}
    setPanelIssue(issue); setParsedResult(lastAlert); setPanelState('result'); setPanelOpen(true); setShowDetail(false)
  }

  async function resolveIssue(reason) {
    setPanelState('resolving_loading')
    const job = activeJob
    try {
      const res = await fetch('/api/driver/resolve',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({client_id:driverInfo.clientId,driver_name:driverInfo.name,vehicle_reg:driverInfo.vehicleReg,ref:job?.ref,resolution:reason,location_description:gpsDescription,route:job?.route,sla_window:job?.sla_window,original_issue:panelIssue?.id})})
      const data = await res.json()
      setJobs(prev=>{const u=prev.map(j=>j.ref===job?.ref?{...j,status:'on-track',alert:null}:j);saveJobProgress(u);return u})
      if (activeJob?.ref===job?.ref) setActiveJob(p=>({...p,status:'on-track',alert:null}))
      pushProgressToSupabase(job?.ref,'on-track',null)
      setResolvedEta(data.revised_eta||'')
      setPanelState('resolved')
    } catch { setPanelState('resolved') }
  }

  function parseResponse(text) {
    const headline = text.match(/HEADLINE:\s*(.+)/i)?.[1]?.trim()||''
    const severity = text.match(/SEVERITY:\s*(CRITICAL|HIGH|MEDIUM|LOW|OK)/i)?.[1]?.toUpperCase()||'MEDIUM'
    const actions=[]; for(const m of text.matchAll(/ACTION\s*\d+:\s*(.+)/gi)){const a=m[1].trim();if(a)actions.push(a)}
    const detail = text.match(/DETAIL:\s*([\s\S]+)/i)?.[1]?.trim()||''
    return { headline, severity, actions, detail }
  }

  function buildPrompt(issueId) {
    const job = activeJob
    const loc = gpsDescription||'location not confirmed'
    const cargo = job?.cargo_type||'general freight'
    const vtype = VEHICLE_TYPES.find(v=>v.id===driverInfo.vehicleType)?.label||driverInfo.vehicleType||'HGV'
    const input = inputText.trim()
    const remainingList = jobs.filter(j=>j.status!=='completed'&&j.ref!==job?.ref).map(j=>j.route).join(', ')
    const p = {
      delayed:          `DRIVER RUNNING LATE. ${driverInfo.name} (${driverInfo.vehicleReg}). Location:${loc}. Job:${job?.route||'?'}. SLA window:${job?.sla_window||'?'}. Reason:${input}. Penalty if breached:£${job?.penalty_if_breached||0}. Best action?`,
      temp_alarm:       `TEMPERATURE ALARM. ${driverInfo.vehicleReg} fridge/reefer. Location:${loc}. Cargo:${cargo}. Reading:${input}. Cold chain breach risk. What to do?`,
      load_movement:    `LOAD MOVEMENT REPORTED. ${driverInfo.vehicleReg}. Location:${loc}. Cargo:${cargo}. Driver has pulled over safely. Next steps for safe load re-securing?`,
      road_closure:     `ROAD CLOSURE / WEATHER. ${driverInfo.name} (${driverInfo.vehicleReg}). Location:${loc}. Issue:${input}. Job:${job?.route||'?'}. Best reroute avoiding affected roads?`,
      low_bridge:       `LOW BRIDGE / RESTRICTION. ${driverInfo.vehicleReg} (${vtype}). Location:${loc}. ${input}. Safe alternative route?`,
      diversion:        `WRONG ROUTE / LOST. ${driverInfo.name} (${driverInfo.vehicleReg}). Location:${loc}. Job:${job?.route||'?'}. ${input}. Correct route guidance?`,
      tacho_fault:      `TACHO FAULT. Driver ${driverInfo.name} (${driverInfo.vehicleReg}). Location:${loc}. Fault:${input}. Legal requirements. Can driver continue?`,
      accident:         `ACCIDENT. ${driverInfo.vehicleReg}, ${driverInfo.name}. Location:${loc}. ${input}. Injuries? Third party? Insurance steps. 999 needed?`,
      customer_not_ready:`CUSTOMER NOT READY. ${driverInfo.name} at ${job?.route?.split('→')[1]||'delivery point'}. Waiting ${input}. SLA window:${job?.sla_window||'?'}. Options?`,
      goods_refused:    `GOODS REFUSED. ${driverInfo.vehicleReg}. Location:${loc}. Cargo:${cargo}. Reason:${input}. What to do with the load?`,
      pod_problem:      `POD PROBLEM. ${driverInfo.name} (${driverInfo.vehicleReg}). Location:${loc}. Issue:${input}. How to proceed legally?`,
      access_problem:   `CANNOT ACCESS SITE. ${driverInfo.vehicleReg}. Location:${loc}. ${input}. Alternative delivery options?`,
      short_load:       `WRONG / SHORT LOAD. ${driverInfo.vehicleReg}. Location:${loc}. Issue:${input}. Delivery value:£${job?.cargo_value||0}. Next steps?`,
      manifest_mismatch:`MANIFEST MISMATCH. ${driverInfo.vehicleReg}. Location:${loc}. ${input}. Do not sign. What should driver do?`,
      damage_found:     `DAMAGE FOUND. ${driverInfo.vehicleReg}. Location:${loc}. ${input}. CCTV nearby? Evidence steps. Insurance process?`,
      overweight:       `OVERWEIGHT LOAD. ${driverInfo.vehicleReg} (${vtype}). Location:${loc}. ${input}. Legal weight limits. Can vehicle move?`,
      part_delivery:    `PART DELIVERY. ${driverInfo.name} (${driverInfo.vehicleReg}). Location:${loc}. ${input}. What to do with remainder?`,
      difficult_customer:`DIFFICULT CUSTOMER. ${driverInfo.name}. Location:${loc}. ${input}. How to handle professionally and protect driver?`,
      rest:             `REST BREAK NEEDED. ${driverInfo.name} (${driverInfo.vehicleReg}, ${vtype}). Location:${loc}. Remaining jobs:${remainingList||'none'}. Find nearest safe, accredited truck park. Avoid seven banned services for cargo above £5k.`,
      driver_unwell:    `DRIVER UNWELL. ${driverInfo.name} (${driverInfo.vehicleReg}). Location:${loc}. Cargo:${cargo}. Symptoms:${input}. Safe to continue? Who takes over?`,
      theft_threat:     `SECURITY THREAT. Driver ${driverInfo.name} (${driverInfo.vehicleReg}). Location:${loc}. Cargo:${cargo}. Description:${input}. Immediate safety actions. Call 999?`,
      vehicle_theft:    `VEHICLE STOLEN. Driver ${driverInfo.name}. Vehicle:${driverInfo.vehicleReg}. Last seen:${input}. Location:${loc}. Cargo:${cargo}. Immediate actions — 999, insurance, cargo owner, depot.`,
      hours_running_out:`DRIVER HOURS CRITICAL. ${driverInfo.name} (${driverInfo.vehicleReg}). Location:${loc}. Current job:${job?.route||'?'}. Remaining jobs:${remainingList||'none'}. Calculate legal remaining drive time. Which jobs legally completable?`,
      adrhazmat:        `ADR/HAZMAT ISSUE. Driver ${driverInfo.name} (${driverInfo.vehicleReg}). Location:${loc}. Cargo:${cargo}. Issue:${input}. Legal requirements. Can driver continue?`,
      cant_complete:    `CANNOT COMPLETE ALL RUNS. Driver ${driverInfo.name} (${driverInfo.vehicleReg}). Location:${loc}. Current job:${job?.route||'?'}. Reason:${input}. Remaining:${remainingList||'none'}. Prioritise which to attempt. Customer notifications. Relief vehicle needed?`,
      breakdown:        `BREAKDOWN EMERGENCY. ${driverInfo.vehicleReg} (${vtype}), ${driverInfo.name}. Location:${loc}. ${input?'Issue:'+input:'Vehicle broken down.'}. Job:${job?.route||'?'}. Cargo:${cargo}. Safety first, then recovery, then SLA.`,
      medical:          `MEDICAL EMERGENCY. Driver ${driverInfo.name} (${driverInfo.vehicleReg}). Location:${loc}. Situation:${input||'medical emergency reported'}. Is driver safe? What should they do?`,
    }
    return p[issueId]||`Driver ${driverInfo.name} reports: ${input||issueId}. Location:${loc}. Job:${job?.route||'?'}.`
  }

  async function sendAlert() {
    const emergencyIds = ['breakdown','medical','theft_threat','driver_unwell','accident','vehicle_theft']
    const noJobIds = [...emergencyIds, 'hours_running_out', 'tacho_fault']
    if (!activeJob || activeJob.status==='completed') {
      if (!noJobIds.includes(panelIssue?.id)) { setPanelState('no_active_job'); return }
    }
    setPanelState('loading')
    const prompt = buildPrompt(panelIssue?.id)
    const job = activeJob

    if (emergencyIds.includes(panelIssue?.id)) {
      const placeholder = { headline:`${panelIssue.label} — ops alerted`, severity:'HIGH', actions:['Ops manager has been notified — awaiting instructions'], detail:'', issueId:panelIssue.id, issueLabel:panelIssue.label, time:new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) }
      setLastAlert(placeholder); localStorage.setItem('dh_last_alert',JSON.stringify(placeholder))
    }

    if (['cant_complete','hours_running_out','driver_unwell','vehicle_theft','accident','theft_threat'].includes(panelIssue?.id)) {
      const atRiskReason = panelIssue?.id === 'vehicle_theft'
        ? 'Vehicle stolen — all runs undeliverable'
        : panelIssue?.id === 'accident'
        ? 'Accident reported — driver and vehicle status unknown'
        : panelIssue?.id === 'theft_threat'
        ? 'Security threat — driver safety priority, runs on hold'
        : 'Driver cannot complete — reassignment required'
      setJobs(prev=>{
        const updated = prev.map(j=>j.status!=='completed'?{...j,status:'at_risk',alert:atRiskReason}:j)
        saveJobProgress(updated)
        updated.filter(j=>j.status==='at_risk').forEach(j=>pushProgressToSupabase(j.ref,'at_risk',atRiskReason))
        return updated
      })
      if (activeJob) setActiveJob(prev=>({...prev,status:'at_risk',alert:atRiskReason}))
    }

    if (panelIssue?.id==='part_delivery') {
      setJobs(prev=>{const u=prev.map(j=>j.ref===job?.ref?{...j,status:'part_delivered'}:j);saveJobProgress(u);return u})
      if (activeJob?.ref===job?.ref) setActiveJob(p=>({...p,status:'part_delivered'}))
      pushProgressToSupabase(job?.ref,'part_delivered',null)
    }

    fetch('/api/driver/alert',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({client_id:driverInfo.clientId,driver_name:driverInfo.name,driver_phone:driverInfo.phone||null,vehicle_reg:driverInfo.vehicleReg,ref:job?.ref,issue_type:panelIssue?.id,issue_description:prompt,human_description:inputText||panelIssue?.label,location_description:gpsDescription,latitude:gpsCoords?.latitude,longitude:gpsCoords?.longitude})
    }).catch(()=>{})

    if (emergencyIds.includes(panelIssue?.id)) {
      const timer = setTimeout(()=>{
        setOpsAcknowledged(prev => {
          if (!prev) showToast('⚠ Ops not yet responded — try calling directly','error')
          return prev
        })
      }, 15 * 60 * 1000)
      setEscalationTimer(timer)
    }

    try {
      const res = await fetch('/api/agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:prompt}],driver_mode:true})})
      const reader=res.body.getReader(); const decoder=new TextDecoder(); let full=''
      while(true){const{done,value}=await reader.read();if(done)break;for(const line of decoder.decode(value).split('\n')){if(line.startsWith('data: ')&&line!=='data: [DONE]'){try{const p=JSON.parse(line.slice(6));if(p.text)full+=p.text}catch{}}}}
      if(full){setParsedResult(parseResponse(full));setPanelState('result')}else setPanelState('sent')
    } catch {setPanelState('sent')}
  }

  // Save driver history for pre-filling future setup screens
  function saveDriverHistory(info) {
    try {
      const existing = (() => { try { return JSON.parse(localStorage.getItem('dh_driver_history')||'{}') } catch { return {} } })()
      const regs = existing.regs || []
      // Add current reg+type to front of list, remove duplicates, cap at 5
      const newReg = { reg: info.vehicleReg.toUpperCase(), type: info.vehicleType }
      const filtered = regs.filter(r => r.reg !== newReg.reg)
      const updated = { name: info.name, phone: info.phone, clientId: info.clientId, regs: [newReg, ...filtered].slice(0, 5) }
      localStorage.setItem('dh_driver_history', JSON.stringify(updated))
      setDriverHistory(updated)
    } catch {}
  }

  function normalisePhone(raw) {
    if (!raw) return ''
    const d = raw.replace(/\s|-|\(|\)/g,'')
    if (d.startsWith('+44')) return d
    if (d.startsWith('44')) return '+'+d
    if (d.startsWith('0')) return '+44'+d.slice(1)
    return d
  }

  function saveDriverInfo() {
    if (!driverInfo.name||!driverInfo.clientId||!driverInfo.phone||!driverInfo.vehicleType||!driverInfo.vehicleReg) return
    const n = {...driverInfo, vehicleReg: driverInfo.vehicleReg.toUpperCase().trim(), phone:normalisePhone(driverInfo.phone)}
    localStorage.setItem('dh_driver_info',JSON.stringify(n))
    setDriverInfo(n)
    saveDriverHistory(n)
    setSetupDone(true)
    loadJobs(n)
  }

  function startShift() {
    const now = Date.now()
    localStorage.setItem('dh_shift_started','true')
    localStorage.setItem('dh_shift_started_at',String(now))
    shiftStartTime.current = new Date(now)

    const failed = Object.entries(preShiftChecks).filter(([,v])=>v===false)
    if (failed.length > 0) {
      setDefectBlocked(true)
      const failedLabels = preShift().filter(c=>preShiftChecks[c.id]===false).map(c=>c.label.split(' — ')[0])
      fetch('/api/driver/alert',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({client_id:driverInfo.clientId,driver_name:driverInfo.name,driver_phone:driverInfo.phone||null,vehicle_reg:driverInfo.vehicleReg,issue_description:`PRE-SHIFT VEHICLE DEFECT. Driver ${driverInfo.name} (${driverInfo.vehicleReg}) flagged issues: ${failedLabels.join(', ')}. Vehicle may not be roadworthy.`,human_description:`⚠ Vehicle defects: ${failedLabels.join(', ')}`,location_description:'At depot — pre-departure',force_alert:true,force_financial_zero:true})
      }).catch(()=>{})
    } else {
      // FIX: reload jobs fresh on new shift start so empty state is never shown
      setShiftStarted(true); setView('run')
      loadJobs(driverInfo)
    }
  }

  function clearSession() {
    ['dh_shift_started','dh_shift_started_at','dh_last_alert','dh_job_progress','dh_ops_messages'].forEach(k=>localStorage.removeItem(k))
    setShiftStarted(false); setShiftEnded(false); setShiftSummary(null); setJobs([]); setActiveJob(null); setLastAlert(null); setStaleSession(null); setPreShiftChecks({}); setOpsMessages([]); setView('run')
  }

  function resumeSession() {
    const info = driverInfo
    setStaleSession(null)
    setShiftStarted(true)
    // Restore shift start time so duration calculates correctly in summary
    const savedAt = localStorage.getItem('dh_shift_started_at')
    if (savedAt) shiftStartTime.current = new Date(parseInt(savedAt))
    const s = localStorage.getItem('dh_last_alert')
    if (s) { try { setLastAlert(JSON.parse(s)) } catch {} }
    loadJobs(info)
  }

  function endShift() { setShowPostShift(true) }

  // FIX: mileage is now mandatory
  function submitEndShift() {
    if (!shiftMileage.trim()) {
      setMileageError(true)
      showToast('Mileage is required before ending shift', 'error')
      setTimeout(()=>setMileageError(false), 3000)
      return
    }
    const completed = jobs.filter(j=>j.status==='completed').length
    const total = jobs.length
    const start = shiftStartTime.current
    const end = new Date()
    const duration = start ? Math.round((end-start)/60000) : null
    setShiftSummary({ completed, total, incidents:lastAlert?1:0, duration, endTime:end.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}), notes:shiftNotes, mileage:shiftMileage, postShiftChecks, unresolved:jobs.filter(j=>j.status==='at_risk'||j.status==='part_delivered').length })
    setShiftEnded(true); setShowPostShift(false)
    ;['dh_shift_started','dh_shift_started_at','dh_last_alert','dh_job_progress'].forEach(k=>localStorage.removeItem(k))
  }

  function preShift() {
    const checks = [...PRESHIFT_CHECKS_BASE]
    if (driverInfo.vehicleType==='fridge') checks.push(PRESHIFT_FRIDGE)
    return checks
  }

  const cargoIcon = t=>!t?'📦':t.includes('pharma')?'💊':t.includes('frozen')?'🧊':t.includes('chilled')?'❄':'📦'

  // ── SETUP ─────────────────────────────────────────────────────────────────
  if (!setupDone) {
    const hasHistory = driverHistory.regs && driverHistory.regs.length > 0
    const isReturning = !!(driverHistory.name || driverHistory.phone)
    const ready = driverInfo.name && driverInfo.phone && driverInfo.vehicleType && driverInfo.clientId && driverInfo.vehicleReg

    return (
    <div style={{minHeight:'100vh',background:'#0a0c0e',color:'#e8eaed',fontFamily:'IBM Plex Sans,sans-serif',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{width:'100%',maxWidth:380}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
          <div style={{width:36,height:36,background:'#00e5b0',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#000',fontFamily:'monospace'}}>DH</div>
          <div>
            <div style={{fontSize:17,fontWeight:600}}>DisruptionHub</div>
            <div style={{fontSize:12,color:'#4a5260'}}>Driver App</div>
          </div>
        </div>

        <div style={{fontSize:11,color:'#4a5260',fontFamily:'monospace',letterSpacing:'0.08em',marginBottom:20}}>
          {isReturning ? 'CONFIRM YOUR DETAILS' : 'FIRST TIME SETUP'}
        </div>

        {/* Name — pre-filled from history */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:13,color:'#8a9099',marginBottom:5}}>Your full name</div>
          <input
            value={driverInfo.name}
            onChange={e=>setDriverInfo(p=>({...p,name:e.target.value}))}
            placeholder='e.g. Carl Hughes'
            style={{width:'100%',padding:'13px',background:'#111418',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#e8eaed',fontSize:16,outline:'none',boxSizing:'border-box'}}/>
        </div>

        {/* Phone — pre-filled from history */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:13,color:'#8a9099',marginBottom:5}}>Your mobile number</div>
          <input
            value={driverInfo.phone}
            onChange={e=>setDriverInfo(p=>({...p,phone:e.target.value}))}
            placeholder='e.g. 07810 499983'
            inputMode='tel'
            style={{width:'100%',padding:'13px',background:'#111418',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#e8eaed',fontSize:16,outline:'none',boxSizing:'border-box'}}/>
        </div>

        {/* Vehicle reg — dropdown if history exists, plain input if not */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:13,color:'#8a9099',marginBottom:5}}>Vehicle registration</div>
          {hasHistory && regInputMode === 'dropdown' ? (
            <div>
              <select
                value={driverInfo.vehicleReg}
                onChange={e=>{
                  const val = e.target.value
                  if (val === '__new__') {
                    setRegInputMode('manual')
                    setDriverInfo(p=>({...p,vehicleReg:'',vehicleType:''}))
                  } else {
                    const found = driverHistory.regs.find(r=>r.reg===val)
                    setDriverInfo(p=>({...p,vehicleReg:val,vehicleType:found?.type||p.vehicleType}))
                  }
                }}
                style={{width:'100%',padding:'13px',background:'#111418',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:driverInfo.vehicleReg?'#e8eaed':'#4a5260',fontSize:16,outline:'none',boxSizing:'border-box',cursor:'pointer'}}>
                <option value=''>Select vehicle...</option>
                {driverHistory.regs.map(r=>(
                  <option key={r.reg} value={r.reg}>
                    {r.reg} — {VEHICLE_TYPES.find(v=>v.id===r.type)?.label||r.type}
                  </option>
                ))}
                <option value='__new__'>＋ Different registration...</option>
              </select>
              {driverInfo.vehicleReg && (
                <div style={{fontSize:11,color:'#00e5b0',marginTop:5,fontFamily:'monospace'}}>
                  ✓ Vehicle type auto-selected — check below and change if needed
                </div>
              )}
            </div>
          ) : (
            <div>
              <input
                value={driverInfo.vehicleReg}
                onChange={e=>setDriverInfo(p=>({...p,vehicleReg:e.target.value.toUpperCase()}))}
                placeholder='e.g. BK21 XYZ'
                autoCapitalize='characters'
                style={{width:'100%',padding:'13px',background:'#111418',border:'1px solid rgba(0,229,176,0.3)',borderRadius:8,color:'#e8eaed',fontSize:16,outline:'none',boxSizing:'border-box'}}/>
              {hasHistory && (
                <button onClick={()=>{setRegInputMode('dropdown');setDriverInfo(p=>({...p,vehicleReg:''}))}}
                  style={{marginTop:6,background:'none',border:'none',color:'#4a5260',fontSize:12,cursor:'pointer',padding:0}}>
                  ← Back to saved vehicles
                </button>
              )}
            </div>
          )}
        </div>

        {/* Vehicle type — auto-selected when reg picked from dropdown */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:13,color:'#8a9099',marginBottom:8}}>Vehicle type</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:7}}>
            {VEHICLE_TYPES.map(v=>(
              <button key={v.id} onClick={()=>setDriverInfo(p=>({...p,vehicleType:v.id}))}
                style={{padding:'10px 6px',borderRadius:8,border:`1px solid ${driverInfo.vehicleType===v.id?'#00e5b0':'rgba(255,255,255,0.08)'}`,background:driverInfo.vehicleType===v.id?'rgba(0,229,176,0.1)':'#111418',display:'flex',flexDirection:'column',alignItems:'center',gap:4,cursor:'pointer'}}>
                <span style={{fontSize:18}}>{v.icon}</span>
                <span style={{fontSize:10,color:driverInfo.vehicleType===v.id?'#00e5b0':'#8a9099',textAlign:'center',lineHeight:1.2}}>{v.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Company code — pre-filled from history */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:13,color:'#8a9099',marginBottom:5}}>Company access code</div>
          <input
            value={driverInfo.clientId}
            onChange={e=>setDriverInfo(p=>({...p,clientId:e.target.value}))}
            placeholder='Given by your manager'
            style={{width:'100%',padding:'13px',background:'#111418',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#e8eaed',fontSize:16,outline:'none',boxSizing:'border-box'}}/>
        </div>

        {!ready && <div style={{fontSize:12,color:'#4a5260',textAlign:'center',marginBottom:10}}>All fields required to continue</div>}
        <button onClick={saveDriverInfo} disabled={!ready}
          style={{width:'100%',padding:15,background:ready?'#00e5b0':'rgba(0,229,176,0.3)',border:'none',borderRadius:10,color:'#000',fontWeight:700,fontSize:16,cursor:ready?'pointer':'default'}}>
          {isReturning ? 'Start shift →' : 'Get started →'}
        </button>
      </div>
    </div>
  )}

  // ── STALE SESSION ─────────────────────────────────────────────────────────
  if (setupDone && staleSession) return (
    <div style={{minHeight:'100vh',background:'#0a0c0e',color:'#e8eaed',fontFamily:'IBM Plex Sans,sans-serif',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{width:'100%',maxWidth:380}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:28}}>
          <div style={{width:32,height:32,background:'#00e5b0',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#000',fontFamily:'monospace'}}>DH</div>
          <div><div style={{fontSize:15,fontWeight:600}}>{driverInfo.name}</div><div style={{fontSize:11,color:'#4a5260',fontFamily:'monospace'}}>{driverInfo.vehicleReg}</div></div>
        </div>
        <div style={{padding:'18px',background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.25)',borderRadius:12,marginBottom:20}}>
          <div style={{fontSize:12,color:'#f59e0b',fontFamily:'monospace',fontWeight:700,marginBottom:6}}>PREVIOUS SESSION FOUND</div>
          <div style={{fontSize:15,color:'#e8eaed',fontWeight:500,marginBottom:3}}>Started {staleSession.startedAt}</div>
          <div style={{fontSize:13,color:'#8a9099'}}>{staleSession.hoursAgo} hours ago</div>
          {staleSession.lastAlertTime&&<div style={{fontSize:12,color:'#f59e0b',marginTop:5}}>⚠ Last alert at {staleSession.lastAlertTime}</div>}
        </div>
        <div style={{fontSize:13,color:'#8a9099',marginBottom:20,lineHeight:1.6}}>Starting a new shift or continuing from before?</div>
        <button onClick={clearSession} style={{width:'100%',padding:'15px',background:'#00e5b0',border:'none',borderRadius:10,color:'#000',fontWeight:700,fontSize:16,cursor:'pointer',marginBottom:10}}>Start new shift</button>
        <button onClick={resumeSession} style={{width:'100%',padding:'14px',background:'transparent',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,color:'#8a9099',fontWeight:500,fontSize:15,cursor:'pointer'}}>Continue previous session</button>
        <div style={{marginTop:14,fontSize:11,color:'#4a5260',textAlign:'center'}}>Overnight or trunking drivers — tap Continue.</div>
      </div>
    </div>
  )

  // ── PRE-SHIFT CHECK ───────────────────────────────────────────────────────
  if (!shiftStarted || view==='preshift') {
    const checks = preShift()
    const allChecked = checks.every(c=>preShiftChecks[c.id]!==undefined)
    const hasFails = checks.some(c=>preShiftChecks[c.id]===false)
    return (
      <div style={{minHeight:'100vh',background:'#0a0c0e',color:'#e8eaed',fontFamily:'IBM Plex Sans,sans-serif',paddingBottom:40}}>
        <div style={{padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:26,height:26,background:'#00e5b0',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'#000',fontFamily:'monospace'}}>DH</div>
            <div><div style={{fontSize:13,fontWeight:500}}>{driverInfo.name}</div><div style={{fontSize:10,color:'#4a5260',fontFamily:'monospace'}}>{driverInfo.vehicleReg} · {VEHICLE_TYPES.find(v=>v.id===driverInfo.vehicleType)?.label||''}</div></div>
          </div>
          {view==='preshift'&&<button onClick={()=>setView('run')} style={{background:'none',border:'none',color:'#4a5260',fontSize:13,cursor:'pointer'}}>Skip →</button>}
        </div>
        <div style={{padding:'22px 16px 16px'}}>
          <div style={{fontSize:22,fontWeight:700,marginBottom:3}}>Pre-Shift Check</div>
          <div style={{fontSize:14,color:'#8a9099',marginBottom:22}}>Check each item before starting. This is a legal record.</div>
          {checks.map(check=>{
            const passed=preShiftChecks[check.id]; const failed=preShiftChecks[check.id]===false
            return (
              <div key={check.id} style={{display:'flex',alignItems:'center',gap:12,padding:'15px',background:failed?'rgba(239,68,68,0.06)':passed?'rgba(0,229,176,0.04)':'#111418',border:`1px solid ${failed?'rgba(239,68,68,0.3)':passed?'rgba(0,229,176,0.2)':'rgba(255,255,255,0.06)'}`,borderRadius:10,marginBottom:8,transition:'all 0.15s'}}>
                <span style={{fontSize:22,flexShrink:0}}>{check.icon}</span>
                <div style={{flex:1,fontSize:15,color:failed?'#ef4444':passed?'#00e5b0':'#e8eaed',fontWeight:passed||failed?500:400}}>{check.label}</div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>setPreShiftChecks(p=>({...p,[check.id]:true}))} style={{width:44,height:44,borderRadius:8,border:`2px solid ${passed?'#00e5b0':'rgba(0,229,176,0.3)'}`,background:passed?'rgba(0,229,176,0.15)':'transparent',color:passed?'#00e5b0':'#4a5260',fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✓</button>
                  <button onClick={()=>setPreShiftChecks(p=>({...p,[check.id]:false}))} style={{width:44,height:44,borderRadius:8,border:`2px solid ${failed?'#ef4444':'rgba(239,68,68,0.2)'}`,background:failed?'rgba(239,68,68,0.12)':'transparent',color:failed?'#ef4444':'#4a5260',fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✗</button>
                </div>
              </div>
            )
          })}
          {hasFails&&(
            <div style={{padding:'12px 14px',background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:9,marginTop:6,marginBottom:8,fontSize:13,color:'#ef4444'}}>
              ⚠ Defects flagged — ops will be alerted. Wait for their reply before departing.
            </div>
          )}
          {defectBlocked&&(
            <div style={{padding:'14px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.35)',borderRadius:9,marginTop:8,marginBottom:14}}>
              <div style={{fontSize:14,color:'#ef4444',fontWeight:600,marginBottom:4}}>🛑 Departure blocked — defects flagged</div>
              <div style={{fontSize:13,color:'#8a9099',marginBottom:10}}>Ops has been alerted. Wait for confirmation before departing.</div>
              <button onClick={()=>{setDefectBlocked(false);setShiftStarted(true);setView('run');loadJobs(driverInfo)}}
                style={{width:'100%',padding:11,background:'transparent',border:'1px solid rgba(239,68,68,0.3)',borderRadius:7,color:'#ef4444',fontSize:13,cursor:'pointer'}}>
                Ops confirmed — depart anyway
              </button>
            </div>
          )}
          {allChecked&&!defectBlocked&&(
            <button onClick={startShift} style={{width:'100%',padding:16,background:'#00e5b0',border:'none',borderRadius:10,color:'#000',fontWeight:700,fontSize:16,cursor:'pointer',marginTop:14}}>
              ✓ Start shift
            </button>
          )}
          {!allChecked&&<div style={{textAlign:'center',padding:'18px 0',fontSize:13,color:'#4a5260'}}>Tick or cross each item above to continue</div>}
        </div>
      </div>
    )
  }

  // ── POST-SHIFT CHECK ──────────────────────────────────────────────────────
  if (showPostShift) return (
    <div style={{minHeight:'100vh',background:'#0a0c0e',color:'#e8eaed',fontFamily:'IBM Plex Sans,sans-serif',paddingBottom:40}}>
      <div style={{padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        <div style={{fontSize:16,fontWeight:600}}>Return Check</div>
        <div style={{fontSize:12,color:'#4a5260',marginTop:2}}>Vehicle walkaround before handing back</div>
      </div>
      <div style={{padding:'20px 16px'}}>
        {POSTSHIFT_CHECKS.map(check=>{
          const passed=postShiftChecks[check.id]; const failed=postShiftChecks[check.id]===false
          return (
            <div key={check.id} style={{display:'flex',alignItems:'center',gap:12,padding:'14px',background:failed?'rgba(239,68,68,0.06)':passed?'rgba(0,229,176,0.04)':'#111418',border:`1px solid ${failed?'rgba(239,68,68,0.3)':passed?'rgba(0,229,176,0.2)':'rgba(255,255,255,0.06)'}`,borderRadius:10,marginBottom:8}}>
              <span style={{fontSize:22,flexShrink:0}}>{check.icon}</span>
              <div style={{flex:1,fontSize:15,color:failed?'#ef4444':passed?'#00e5b0':'#e8eaed'}}>{check.label}</div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>setPostShiftChecks(p=>({...p,[check.id]:true}))} style={{width:44,height:44,borderRadius:8,border:`2px solid ${passed?'#00e5b0':'rgba(0,229,176,0.3)'}`,background:passed?'rgba(0,229,176,0.15)':'transparent',color:passed?'#00e5b0':'#4a5260',fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✓</button>
                <button onClick={()=>setPostShiftChecks(p=>({...p,[check.id]:false}))} style={{width:44,height:44,borderRadius:8,border:`2px solid ${failed?'#ef4444':'rgba(239,68,68,0.2)'}`,background:failed?'rgba(239,68,68,0.12)':'transparent',color:failed?'#ef4444':'#4a5260',fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✗</button>
              </div>
            </div>
          )
        })}
        <div style={{marginTop:16}}>
          <div style={{fontSize:13,color:mileageError?'#ef4444':'#8a9099',marginBottom:6,fontWeight:mileageError?600:400}}>
            Mileage at end of shift {mileageError&&'— required ⚠'}
          </div>
          <input value={shiftMileage} onChange={e=>{setShiftMileage(e.target.value);setMileageError(false)}} placeholder='e.g. 48,320' inputMode='numeric'
            style={{width:'100%',padding:'12px',background:'#111418',border:`1px solid ${mileageError?'rgba(239,68,68,0.6)':'rgba(255,255,255,0.1)'}`,borderRadius:8,color:'#e8eaed',fontSize:15,outline:'none',boxSizing:'border-box',marginBottom:14,transition:'border 0.2s'}}/>
          <div style={{fontSize:13,color:'#8a9099',marginBottom:6}}>Shift notes (optional)</div>
          <textarea value={shiftNotes} onChange={e=>setShiftNotes(e.target.value)} rows={3} placeholder='Any notes for ops — customer issues, delays, anything to flag...'
            style={{width:'100%',padding:'12px',background:'#111418',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#e8eaed',fontSize:14,outline:'none',resize:'none',boxSizing:'border-box',lineHeight:1.6}}/>
        </div>
        {Object.values(postShiftChecks).some(v=>v===false)&&(
          <div style={{padding:'10px 12px',background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:7,marginTop:10,fontSize:12,color:'#ef4444'}}>⚠ Defects noted — ops will be informed in shift summary</div>
        )}
        <button onClick={submitEndShift} style={{width:'100%',padding:15,background:'#00e5b0',border:'none',borderRadius:10,color:'#000',fontWeight:700,fontSize:16,cursor:'pointer',marginTop:18}}>
          ✓ Submit and end shift
        </button>
      </div>
    </div>
  )

  // ── SHIFT SUMMARY ─────────────────────────────────────────────────────────
  if (shiftEnded && shiftSummary) return (
    <div style={{minHeight:'100vh',background:'#0a0c0e',color:'#e8eaed',fontFamily:'IBM Plex Sans,sans-serif',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{width:'100%',maxWidth:400}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{fontSize:52,marginBottom:10}}>🏁</div>
          <div style={{fontSize:24,fontWeight:700,color:'#00e5b0',marginBottom:3}}>Shift Complete</div>
          <div style={{fontSize:13,color:'#4a5260'}}>Signed off {shiftSummary.endTime}</div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
          {[
            {val:shiftSummary.completed,  sub:'Delivered',   color:'#00e5b0', bg:'rgba(0,229,176,0.06)',  border:'rgba(0,229,176,0.2)'},
            {val:shiftSummary.total,      sub:'Total runs',  color:'#3b82f6', bg:'rgba(59,130,246,0.06)', border:'rgba(59,130,246,0.2)'},
            {val:shiftSummary.incidents,  sub:'Incidents',   color:shiftSummary.incidents>0?'#f59e0b':'#00e5b0', bg:'#111418', border:'rgba(255,255,255,0.06)'},
            {val:shiftSummary.duration?`${shiftSummary.duration}m`:'—', sub:'Duration', color:'#e8eaed', bg:'#111418', border:'rgba(255,255,255,0.06)'},
          ].map((s,i)=>(
            <div key={i} style={{padding:'16px',background:s.bg,border:`1px solid ${s.border}`,borderRadius:10,textAlign:'center'}}>
              <div style={{fontSize:30,fontWeight:700,color:s.color,fontFamily:'monospace'}}>{s.val}</div>
              <div style={{fontSize:12,color:'#8a9099',marginTop:3}}>{s.sub}</div>
            </div>
          ))}
        </div>
        {shiftSummary.mileage&&<div style={{padding:'10px 14px',background:'#111418',border:'1px solid rgba(255,255,255,0.06)',borderRadius:8,marginBottom:8,fontSize:13,color:'#8a9099'}}>Mileage: <span style={{color:'#e8eaed'}}>{shiftSummary.mileage}</span></div>}
        {shiftSummary.unresolved>0&&<div style={{padding:'10px 14px',background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:8,marginBottom:8,fontSize:13,color:'#f59e0b'}}>⚠ {shiftSummary.unresolved} unresolved job{shiftSummary.unresolved>1?'s':''} — ops have been notified</div>}
        {shiftSummary.notes&&<div style={{padding:'10px 14px',background:'#111418',border:'1px solid rgba(255,255,255,0.06)',borderRadius:8,marginBottom:8,fontSize:13,color:'#8a9099'}}>Notes: <span style={{color:'#e8eaed'}}>{shiftSummary.notes}</span></div>}
        {shiftSummary.completed===shiftSummary.total&&<div style={{padding:'12px',background:'rgba(0,229,176,0.05)',border:'1px solid rgba(0,229,176,0.2)',borderRadius:9,textAlign:'center',marginBottom:12,fontSize:14,color:'#00e5b0',fontWeight:500}}>✓ Full shift — all runs delivered</div>}
        <button onClick={()=>{['dh_driver_info','dh_shift_started','dh_shift_started_at','dh_last_alert','dh_job_progress','dh_ops_messages'].forEach(k=>localStorage.removeItem(k));setSetupDone(false);setShiftStarted(false);setShiftEnded(false);setJobs([]);setActiveJob(null);setShiftSummary(null)}}
          style={{width:'100%',padding:'14px',background:'#111418',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,color:'#4a5260',fontWeight:500,fontSize:14,cursor:'pointer'}}>
          Sign out
        </button>
      </div>
    </div>
  )

  // ── POD CONFIRMATION ──────────────────────────────────────────────────────
  if (podFlow) return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.9)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{width:'100%',maxWidth:360,background:'#111418',borderRadius:14,padding:24,border:'1px solid rgba(255,255,255,0.08)'}}>
        <div style={{fontSize:18,fontWeight:700,color:'#e8eaed',marginBottom:6}}>Delivery confirmation</div>
        <div style={{fontSize:13,color:'#8a9099',marginBottom:20}}>How was the delivery confirmed?</div>
        {[
          {id:'signature',label:'✍ Signature obtained',     sub:'Consignee signed POD'},
          {id:'photo',    label:'📸 Photo evidence taken',   sub:'Photographed at delivery point'},
          {id:'refused',  label:'❌ Delivery refused',        sub:'Consignee refused — reason logged'},
          {id:'safe_place',label:'📦 Safe place delivery',   sub:'Left in agreed safe location'},
        ].map(opt=>(
          <button key={opt.id} onClick={()=>confirmDelivered(opt.id)}
            style={{width:'100%',marginBottom:8,padding:'13px',background:'rgba(0,229,176,0.04)',border:'1px solid rgba(0,229,176,0.12)',borderRadius:10,cursor:'pointer',textAlign:'left',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><div style={{fontSize:14,color:'#e8eaed',fontWeight:500}}>{opt.label}</div><div style={{fontSize:11,color:'#4a5260',marginTop:2}}>{opt.sub}</div></div>
            <span style={{color:'#00e5b0',fontSize:15}}>→</span>
          </button>
        ))}
        <button onClick={()=>setPodFlow(null)} style={{width:'100%',padding:10,background:'transparent',border:'none',color:'#4a5260',fontSize:12,cursor:'pointer',marginTop:4}}>← Cancel</button>
      </div>
    </div>
  )

  // ── MAIN RUN VIEW ─────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:'100vh',background:'#0a0c0e',color:'#e8eaed',fontFamily:'IBM Plex Sans,sans-serif',paddingBottom:90}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* Toast */}
      {toast&&(
        <div style={{position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',zIndex:500,padding:'10px 18px',borderRadius:10,background:toast.type==='error'?'rgba(239,68,68,0.95)':'rgba(0,229,176,0.95)',color:toast.type==='error'?'#fff':'#000',fontWeight:600,fontSize:13,boxShadow:'0 4px 20px rgba(0,0,0,0.4)',whiteSpace:'nowrap'}}>
          {toast.msg}
        </div>
      )}

      {/* Undo bar */}
      {pendingUndo&&(
        <div style={{position:'fixed',top:0,left:0,right:0,zIndex:400,padding:'12px 16px',background:'rgba(245,158,11,0.95)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontSize:13,color:'#000',fontWeight:600}}>Marked as delivered</span>
          <button onClick={undoDelivered} style={{padding:'6px 14px',background:'#000',border:'none',borderRadius:6,color:'#f59e0b',fontWeight:700,fontSize:12,cursor:'pointer'}}>UNDO ({undoCountdown}s)</button>
        </div>
      )}

      {/* Header */}
      <div style={{padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:28,height:28,background:'#00e5b0',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'#000',fontFamily:'monospace'}}>DH</div>
          <div><div style={{fontSize:13,fontWeight:500}}>{driverInfo.name}</div><div style={{fontSize:10,color:'#4a5260',fontFamily:'monospace'}}>{driverInfo.vehicleReg}</div></div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {loading&&<div style={{width:16,height:16,border:'2px solid rgba(0,229,176,0.2)',borderTop:'2px solid #00e5b0',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>}
        </div>
      </div>

      {/* Ops messages banner */}
      {opsMessages.length>0&&(
        <div style={{margin:'8px 12px 0',padding:'10px 13px',background:'rgba(59,130,246,0.08)',border:'1px solid rgba(59,130,246,0.25)',borderRadius:9}}>
          <div style={{fontSize:9,color:'#3b82f6',fontFamily:'monospace',fontWeight:700,letterSpacing:'0.08em',marginBottom:4}}>OPS MESSAGE</div>
          <div style={{fontSize:13,color:'#e8eaed'}}>{opsMessages[opsMessages.length-1]}</div>
        </div>
      )}

      {/* Ops job cancellation banner */}
      {opsJobUpdate&&(
        <div style={{margin:'8px 12px 0',padding:'12px 14px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:9,display:'flex',alignItems:'flex-start',gap:10}}>
          <span style={{fontSize:18,flexShrink:0}}>📋</span>
          <div>
            <div style={{fontSize:12,color:'#ef4444',fontFamily:'monospace',fontWeight:700,marginBottom:3}}>SCHEDULE UPDATED BY OPS</div>
            <div style={{fontSize:13,color:'#e8eaed'}}>{opsJobUpdate}</div>
            <div style={{fontSize:11,color:'#8a9099',marginTop:3}}>Your job list has been updated automatically.</div>
          </div>
        </div>
      )}

      {view==='run'&&(
        <div>

          {/* ── DATE + RUN COUNT STRIP ── */}
          <div style={{padding:'8px 16px',borderBottom:'1px solid rgba(255,255,255,0.04)',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#0d1014'}}>
            <div style={{fontSize:11,color:'#4a5260',fontFamily:'monospace',letterSpacing:'0.06em'}}>
              {new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}).toUpperCase()}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              {loading
                ? <div style={{fontSize:11,color:'#4a5260',fontFamily:'monospace'}}>Loading...</div>
                : <div style={{fontSize:11,fontFamily:'monospace',color:'#4a5260'}}>
                    <span style={{color:'#00e5b0',fontWeight:700}}>{jobs.filter(j=>j.status==='completed').length}</span>
                    <span style={{color:'#4a5260'}}> / {jobs.length} runs</span>
                  </div>
              }
            </div>
          </div>

          {/* ── LAST ALERT BANNER ── */}
          {lastAlert&&(
            <div onClick={reopenLastAlert} style={{margin:'8px 12px 0',padding:'12px 14px',borderRadius:10,cursor:'pointer',border:`1px solid ${SEV[lastAlert.severity]?.border||'rgba(245,158,11,0.35)'}`,background:SEV[lastAlert.severity]?.bg}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div style={{display:'flex',gap:9,flex:1}}>
                  <span style={{fontSize:18,flexShrink:0}}>{SEV[lastAlert.severity]?.icon||'⚠️'}</span>
                  <div>
                    <div style={{fontSize:9,color:SEV[lastAlert.severity]?.color,fontFamily:'monospace',fontWeight:700,letterSpacing:'0.06em',marginBottom:2}}>LAST ALERT · {lastAlert.time}</div>
                    <div style={{fontSize:14,color:'#e8eaed',fontWeight:600,lineHeight:1.4}}>{lastAlert.headline}</div>
                    {lastAlert.actions?.[0]&&<div style={{fontSize:11,color:'#8a9099',marginTop:4}}>→ {lastAlert.actions[0]}</div>}
                  </div>
                </div>
                <div style={{fontSize:10,color:'#4a5260',flexShrink:0,marginLeft:8}}>Tap →</div>
              </div>
            </div>
          )}

          {/* ── ACTIVE JOB — PROMINENT ── */}
          {activeJob && activeJob.status!=='completed' ? (()=>{
            const isAtRisk = activeJob.status==='at_risk'
            const sc = STATUS_COLORS[activeJob.status]||STATUS_COLORS['on-track']
            const currentStepIndex = PROGRESS_STEPS.findIndex(s=>s.status===activeJob.status)
            return (
              <div style={{margin:'10px 12px 0',background:'#111418',border:`1px solid ${sc.border}`,borderRadius:14,overflow:'hidden'}}>
                {/* Active job header */}
                <div style={{padding:'12px 14px',borderBottom:'1px solid rgba(255,255,255,0.05)',background:sc.bg}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontFamily:'monospace',fontSize:13,color:sc.dot,fontWeight:700}}>{activeJob.ref}</span>
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <div style={{width:7,height:7,borderRadius:'50%',background:sc.dot,animation:isAtRisk?'pulse 1.5s infinite':'none'}}/>
                      <span style={{fontFamily:'monospace',fontSize:10,color:sc.dot}}>{sc.label}</span>
                    </div>
                  </div>
                  <div style={{fontSize:15,color:'#e8eaed',fontWeight:600,marginBottom:4}}>{activeJob.route}</div>
                  <div style={{display:'flex',gap:12,fontSize:11,color:'#4a5260',flexWrap:'wrap'}}>
                    {activeJob.eta&&<span>ETA {activeJob.eta}</span>}
                    {activeJob.sla_window&&<span style={{color:activeJob.status==='at_risk'?'#ef4444':'#f59e0b'}}>⏱ Slot {activeJob.sla_window}</span>}
                    {activeJob.cargo_type&&<span>{cargoIcon(activeJob.cargo_type)} {activeJob.cargo_type}</span>}
                    {activeJob.penalty_if_breached>0&&<span style={{color:'#ef4444'}}>£{activeJob.penalty_if_breached.toLocaleString()} if late</span>}
                  </div>
                </div>

                {/* Progress steps */}
                {!isAtRisk&&(
                  <div style={{padding:'10px 14px 6px'}}>
                    {PROGRESS_STEPS.map((step,i)=>{
                      const isDoneStep = currentStepIndex > i
                      const isCurrent = step.status===activeJob.status || (activeJob.status==='on-track'&&i===0) || (activeJob.status==='pending'&&i===0)
                      return (
                        <button key={step.id} onClick={()=>{if(!isDoneStep)logProgress(step)}} disabled={isDoneStep}
                          style={{width:'100%',marginBottom:7,padding:'13px',background:isDoneStep?'rgba(0,229,176,0.03)':isCurrent?'rgba(0,229,176,0.06)':'rgba(255,255,255,0.02)',border:`1px solid ${isDoneStep?'rgba(0,229,176,0.12)':isCurrent?'rgba(0,229,176,0.3)':'rgba(255,255,255,0.06)'}`,borderRadius:10,cursor:isDoneStep?'default':'pointer',display:'flex',alignItems:'center',gap:12,opacity:isDoneStep?0.5:1}}>
                          <span style={{fontSize:20,flexShrink:0}}>{isDoneStep?'✓':step.icon}</span>
                          <span style={{fontSize:15,color:isDoneStep?'#4a5260':isCurrent?step.color:'#e8eaed',fontWeight:isCurrent?600:400}}>{step.label}</span>
                          {isCurrent&&<span style={{marginLeft:'auto',fontSize:11,color:step.color,fontFamily:'monospace'}}>TAP →</span>}
                        </button>
                      )
                    })}
                    <button onClick={initiateDelivered}
                      style={{width:'100%',padding:'15px',borderRadius:10,border:'2px solid rgba(0,229,176,0.4)',background:'rgba(0,229,176,0.07)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginBottom:6}}>
                      <span style={{fontSize:22}}>📦</span>
                      <span style={{fontSize:16,color:'#00e5b0',fontWeight:700}}>Mark as Delivered</span>
                    </button>
                  </div>
                )}

                {/* AT RISK state */}
                {isAtRisk&&(
                  <div style={{padding:'13px 16px'}}>
                    <div style={{padding:'11px 13px',background:'rgba(239,68,68,0.05)',border:'1px solid rgba(239,68,68,0.18)',borderRadius:8,marginBottom:9,fontSize:13,color:'#ef4444'}}>
                      🛑 Progress locked — jobs handed to ops.
                    </div>

                    {!resumeConfirm ? (
                      <>
                        {/* Primary action — continue */}
                        <button onClick={()=>setResumeConfirm(true)}
                          style={{width:'100%',padding:'13px',borderRadius:9,border:'1px solid rgba(0,229,176,0.28)',background:'rgba(0,229,176,0.04)',color:'#00e5b0',fontSize:14,fontWeight:500,cursor:'pointer',marginBottom:8}}>
                          ✓ Situation resolved — I can continue
                        </button>
                        {/* End shift — always available when jobs are locked */}
                        <button onClick={endShift}
                          style={{width:'100%',padding:'13px',borderRadius:9,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'#8a9099',fontSize:14,fontWeight:500,cursor:'pointer'}}>
                          End shift now
                        </button>
                      </>
                    ) : (
                      /* Confirmation screen — warn about potential conflict */
                      <div style={{padding:'12px',background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.25)',borderRadius:9}}>
                        <div style={{fontSize:14,fontWeight:600,color:'#f59e0b',marginBottom:6}}>⚠ Check with ops first</div>
                        <div style={{fontSize:13,color:'#8a9099',marginBottom:14,lineHeight:1.6}}>
                          If ops has already assigned your runs to another driver, pressing continue will create a conflict. Confirm with ops before proceeding.
                        </div>
                        <div style={{display:'flex',gap:8}}>
                          <button onClick={()=>{
                            setResumeConfirm(false)
                            setJobs(prev=>{const u=prev.map(j=>j.status==='at_risk'?{...j,status:'on-track',alert:null}:j);saveJobProgress(u);u.filter(j=>j.status==='on-track').forEach(j=>pushProgressToSupabase(j.ref,'on-track',null));return u})
                            setActiveJob(prev=>({...prev,status:'on-track',alert:null}))
                            showToast('Resumed — ops notified')
                            fetch('/api/driver/alert',{method:'POST',headers:{'Content-Type':'application/json'},
                              body:JSON.stringify({
                                client_id:driverInfo.clientId,
                                driver_name:driverInfo.name,
                                driver_phone:driverInfo.phone||null,
                                vehicle_reg:driverInfo.vehicleReg,
                                issue_description:`⚠ DRIVER SELF-RESUMED: ${driverInfo.name} (${driverInfo.vehicleReg}) has pressed continue and resumed their runs. If you have already assigned these jobs to another driver please call them immediately to avoid conflict.`,
                                human_description:`${driverInfo.name} self-resumed — check for conflict`,
                                location_description:gpsDescription||'location not confirmed',
                                force_alert:false
                              })
                            }).catch(()=>{})
                          }} style={{flex:1,padding:'11px',borderRadius:8,border:'none',background:'#00e5b0',color:'#000',fontWeight:700,fontSize:13,cursor:'pointer'}}>
                            Confirmed — continue
                          </button>
                          <button onClick={()=>setResumeConfirm(false)}
                            style={{padding:'11px 14px',borderRadius:8,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'#8a9099',fontSize:13,cursor:'pointer'}}>
                            Back
                          </button>
                        </div>
                        <button onClick={()=>{setResumeConfirm(false);endShift()}}
                          style={{width:'100%',marginTop:8,padding:'10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.08)',background:'transparent',color:'#4a5260',fontSize:12,cursor:'pointer'}}>
                          End shift instead
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })() : null}

          {/* ── ALL RUNS COMPLETE ── */}
          {!loading && jobs.length > 0 && jobs.every(j=>j.status==='completed') && (
            <div style={{margin:'10px 12px 0',padding:'22px 18px',borderRadius:12,background:'rgba(0,229,176,0.04)',border:'1px solid rgba(0,229,176,0.18)',textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:8}}>🎉</div>
              <div style={{fontSize:19,fontWeight:700,color:'#00e5b0',marginBottom:5}}>All runs complete</div>
              <div style={{fontSize:13,color:'#8a9099',marginBottom:20}}>{jobs.length} run{jobs.length!==1?'s':''} delivered today.</div>
              <button onClick={endShift} style={{width:'100%',padding:'15px',background:'#00e5b0',border:'none',borderRadius:10,color:'#000',fontWeight:700,fontSize:16,cursor:'pointer',marginBottom:10}}>✓ End shift</button>
              <div style={{fontSize:11,color:'#4a5260'}}>Vehicle return check and shift summary</div>
            </div>
          )}

          {/* ── REMAINING RUNS ── */}
          {jobs.filter(j=>j.status!=='completed'&&j.ref!==activeJob?.ref).length > 0 && (
            <div style={{margin:'12px 12px 0'}}>
              <div style={{fontSize:9,color:'#4a5260',fontFamily:'monospace',letterSpacing:'0.08em',marginBottom:6,paddingLeft:2}}>
                REMAINING RUNS — {jobs.filter(j=>j.status!=='completed'&&j.ref!==activeJob?.ref).length} to go
              </div>
              {jobs.filter(j=>j.status!=='completed'&&j.ref!==activeJob?.ref).map(job=>{
                const sc = STATUS_COLORS[job.status]||STATUS_COLORS['on-track']
                const isAtRisk = job.status==='at_risk'||job.status==='part_delivered'
                return (
                  <div key={job.ref} onClick={()=>setActiveJob(job)}
                    style={{padding:'10px 12px',background:'#111418',border:`1px solid ${isAtRisk?sc.border:'rgba(255,255,255,0.06)'}`,borderRadius:10,marginBottom:6,cursor:'pointer',display:'flex',alignItems:'center',gap:10,transition:'all 0.15s'}}>
                    <div style={{width:6,height:6,borderRadius:'50%',background:sc.dot,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:2}}>
                        <span style={{fontFamily:'monospace',fontSize:12,fontWeight:700,color:'#e8eaed'}}>{job.ref}</span>
                        <span style={{fontFamily:'monospace',fontSize:9,color:sc.dot}}>{sc.label}</span>
                      </div>
                      <div style={{fontSize:12,color:'#8a9099',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{job.route}</div>
                      <div style={{display:'flex',gap:8,fontSize:10,color:'#4a5260',marginTop:2,flexWrap:'wrap'}}>
                        {job.eta&&<span>ETA {job.eta}</span>}
                        {job.sla_window&&<span style={{color:isAtRisk?'#ef4444':'#f59e0b'}}>Slot {job.sla_window}</span>}
                        {job.cargo_type&&<span>{cargoIcon(job.cargo_type)} {job.cargo_type}</span>}
                        {job.penalty_if_breached>0&&isAtRisk&&<span style={{color:'#ef4444'}}>£{job.penalty_if_breached.toLocaleString()} at risk</span>}
                      </div>
                    </div>
                    <span style={{fontSize:12,color:'#4a5260',flexShrink:0}}>→</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── COMPLETED RUNS ── */}
          {jobs.filter(j=>j.status==='completed').length > 0 && (
            <div style={{margin:'10px 12px 0'}}>
              <div style={{fontSize:9,color:'#4a5260',fontFamily:'monospace',letterSpacing:'0.08em',marginBottom:6,paddingLeft:2}}>
                COMPLETED — {jobs.filter(j=>j.status==='completed').length} done
              </div>
              {jobs.filter(j=>j.status==='completed').map(job=>(
                <div key={job.ref} style={{padding:'8px 12px',background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.04)',borderRadius:8,marginBottom:4,display:'flex',alignItems:'center',gap:10,opacity:0.5}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:'#4a5260',flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <span style={{fontFamily:'monospace',fontSize:11,color:'#4a5260',fontWeight:600,marginRight:8}}>{job.ref}</span>
                    <span style={{fontSize:11,color:'#4a5260',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{job.route}</span>
                  </div>
                  <span style={{fontSize:10,color:'#4a5260',fontFamily:'monospace'}}>✓ DONE</span>
                </div>
              ))}
            </div>
          )}

          {/* ── ISSUE GROUPS ── */}
          {jobs.some(j=>j.status!=='completed')&&(
            <div style={{marginTop:16}}>
              <div style={{padding:'0 16px 8px',fontSize:9,color:'#4a5260',fontFamily:'monospace',letterSpacing:'0.08em'}}>REPORT AN ISSUE</div>
              {ISSUE_GROUPS.map(group=>(
                <div key={group.id} style={{marginBottom:4}}>
                  <div style={{padding:'5px 16px',fontSize:9,color:group.color,fontFamily:'monospace',fontWeight:700,letterSpacing:'0.1em'}}>{group.label}</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,padding:'0 12px 8px'}}>
                    {group.issues.map(issue=>(
                      <button key={issue.id} onClick={()=>openIssue(issue)}
                        style={{padding:'12px 10px',borderRadius:9,background:'#111418',border:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',gap:9,cursor:'pointer',outline:'none',textAlign:'left'}}>
                        <span style={{fontSize:20,flexShrink:0}}>{issue.icon}</span>
                        <span style={{fontSize:13,color:'#e8eaed',lineHeight:1.3}}>{issue.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── BOTTOM UTILITIES ── */}
          <div style={{padding:'6px 12px 12px',marginTop:8,display:'flex',gap:8}}>
            <button onClick={()=>setView('preshift')} style={{flex:1,padding:'10px',background:'transparent',border:'1px solid rgba(255,255,255,0.06)',borderRadius:8,color:'#4a5260',fontSize:12,cursor:'pointer'}}>
              🔍 Vehicle check
            </button>
            <button onClick={()=>{['dh_driver_info','dh_shift_started','dh_shift_started_at','dh_last_alert','dh_job_progress','dh_ops_messages'].forEach(k=>localStorage.removeItem(k));setSetupDone(false);setShiftStarted(false);setJobs([]);setActiveJob(null)}}
              style={{flex:1,padding:'10px',background:'transparent',border:'1px solid rgba(255,255,255,0.06)',borderRadius:8,color:'#4a5260',fontSize:12,cursor:'pointer'}}>
              Change driver
            </button>
          </div>

        </div>
      )}

      {/* STICKY BAR */}
      <div style={{position:'fixed',bottom:0,left:0,right:0,padding:'9px 12px 22px',background:'rgba(10,12,14,0.97)',borderTop:'1px solid rgba(255,255,255,0.06)',backdropFilter:'blur(10px)',zIndex:100,display:'grid',gridTemplateColumns:'5fr 3fr 3fr',gap:8}}>
        <button onClick={()=>openIssue({id:'breakdown',label:'Breakdown',icon:'🚨',needsText:true,placeholder:'What happened?'})}
          style={{padding:'13px',background:'#ef4444',border:'none',borderRadius:10,color:'#fff',fontWeight:700,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:7}}>
          🚨 BREAKDOWN
        </button>
        <button onClick={()=>openIssue({id:'medical',label:'Medical Emergency',icon:'🚑',needsText:false})}
          style={{padding:'13px',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:10,color:'#ef4444',fontWeight:600,fontSize:11,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2}}>
          <span style={{fontSize:18}}>🚑</span><span>Medical</span>
        </button>
        <button onClick={()=>openIssue({id:'cant_complete',label:"Can't Complete",icon:'⛔',needsText:true,placeholder:"Reason — e.g. hours up"})}
          style={{padding:'13px',background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:10,color:'#ef4444',fontWeight:600,fontSize:11,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2}}>
          <span style={{fontSize:18}}>⛔</span><span>Can't Complete</span>
        </button>
      </div>

      {/* ISSUE PANEL */}
      {panelOpen&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:200,display:'flex',alignItems:'flex-end'}}>
          <div style={{width:'100%',background:'#0d1014',borderRadius:'16px 16px 0 0',maxHeight:'90vh',overflowY:'auto',padding:'20px 16px 36px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div>
                <div style={{fontSize:9,color:'#4a5260',fontFamily:'monospace',letterSpacing:'0.08em',marginBottom:3}}>ISSUE REPORT</div>
                <div style={{fontSize:18,fontWeight:700,color:'#e8eaed'}}>{panelIssue?.icon} {panelIssue?.label}</div>
              </div>
              <button onClick={closePanel} style={{width:34,height:34,borderRadius:8,background:'rgba(255,255,255,0.06)',border:'none',color:'#8a9099',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>

            {/* GPS status */}
            {gpsStatus==='getting'&&<div style={{fontSize:11,color:'#3b82f6',fontFamily:'monospace',marginBottom:10}}>📍 Getting location...</div>}
            {gpsStatus==='got'&&gpsDescription&&<div style={{fontSize:11,color:'#00e5b0',fontFamily:'monospace',marginBottom:10}}>📍 {gpsDescription}</div>}
            {gpsStatus==='failed'&&<div style={{fontSize:11,color:'#f59e0b',fontFamily:'monospace',marginBottom:10}}>📍 Location not available</div>}

            {/* Contextual warnings */}
            {panelIssue?.id==='theft_threat'&&<div style={{padding:'11px 13px',background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:9,marginBottom:13,fontSize:13,color:'#ef4444'}}>🚨 If in immediate danger — call 999 first. Note any CCTV nearby.</div>}
            {panelIssue?.id==='tacho_fault'&&<div style={{padding:'11px 13px',background:'rgba(59,130,246,0.07)',border:'1px solid rgba(59,130,246,0.25)',borderRadius:9,marginBottom:13,fontSize:13,color:'#3b82f6'}}>⚖️ A tacho fault must be recorded. Do not continue without guidance.</div>}
            {panelIssue?.id==='temp_alarm'&&<div style={{padding:'11px 13px',background:'rgba(6,182,212,0.07)',border:'1px solid rgba(6,182,212,0.25)',borderRadius:9,marginBottom:13,fontSize:13,color:'#06b6d4'}}>Enter probe reading — not the unit display. They can differ.</div>}
            {panelIssue?.id==='cant_complete'&&<div style={{padding:'11px 13px',background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:9,marginBottom:13,fontSize:12,color:'#ef4444'}}>Remaining jobs will be flagged AT RISK. Ops notified immediately.</div>}
            {panelIssue?.id==='manifest_mismatch'&&<div style={{padding:'11px 13px',background:'rgba(245,158,11,0.07)',border:'1px solid rgba(245,158,11,0.25)',borderRadius:9,marginBottom:13,fontSize:13,color:'#f59e0b'}}>⚖️ Do not sign for goods that don't match the manifest. Wait for guidance.</div>}
            {panelIssue?.note&&<div style={{padding:'11px 13px',background:'rgba(59,130,246,0.07)',border:'1px solid rgba(59,130,246,0.25)',borderRadius:9,marginBottom:13,fontSize:13,color:'#3b82f6'}}>{panelIssue.note}</div>}

            {/* RESULT state */}
            {panelState==='result'&&parsedResult&&(()=>{
              const s=SEV[parsedResult.severity]||SEV.MEDIUM
              return (
                <div>
                  <div style={{padding:'15px',background:s.bg,border:`1px solid ${s.border}`,borderRadius:12,marginBottom:15,display:'flex',gap:11,alignItems:'flex-start'}}>
                    <span style={{fontSize:26,flexShrink:0}}>{s.icon}</span>
                    <div>
                      <div style={{fontSize:10,color:s.color,fontFamily:'monospace',fontWeight:700,letterSpacing:'0.08em',marginBottom:4}}>{parsedResult.severity}</div>
                      <div style={{fontSize:17,fontWeight:700,color:'#e8eaed',lineHeight:1.4}}>{parsedResult.headline}</div>
                    </div>
                  </div>
                  {parsedResult.actions.length>0&&(
                    <div style={{marginBottom:15}}>
                      <div style={{fontSize:9,color:'#4a5260',fontFamily:'monospace',letterSpacing:'0.08em',marginBottom:8}}>WHAT TO DO</div>
                      {parsedResult.actions.map((action,i)=>(
                        <div key={i} style={{display:'flex',gap:11,marginBottom:9,padding:'13px',background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:10,alignItems:'flex-start'}}>
                          <div style={{width:26,height:26,borderRadius:'50%',background:i===0?s.color:'rgba(255,255,255,0.08)',color:i===0?'#000':'#8a9099',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0}}>{i+1}</div>
                          <div style={{fontSize:15,color:'#e8eaed',lineHeight:1.5,fontWeight:i===0?600:400}}>{action}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {parsedResult.detail&&(
                    <div style={{marginBottom:15}}>
                      <button onClick={()=>setShowDetail(v=>!v)} style={{width:'100%',padding:'10px 13px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:9,color:'#4a5260',fontSize:12,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span>Full ops analysis</span><span>{showDetail?'▲':'▼'}</span>
                      </button>
                      {showDetail&&<div style={{padding:'12px 13px',background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'0 0 9px 9px',borderTop:'none'}}>
                        {parsedResult.detail.split('\n').map((line,i)=>{
                          if(!line.trim())return <div key={i} style={{height:5}}/>
                          const cl=line.replace(/\*\*/g,'').replace(/^[#\-]\s*/,'').trim()
                          const bold=line.match(/^[A-Z\s\/]+:$/)
                          return <div key={i} style={{fontSize:12,color:bold?'#e8eaed':'#8a9099',lineHeight:1.7,fontWeight:bold?500:400,marginBottom:1}}>{cl}</div>
                        })}
                      </div>}
                    </div>
                  )}
                  <button onClick={closePanel} style={{width:'100%',padding:15,background:'#00e5b0',border:'none',borderRadius:10,color:'#000',fontWeight:700,fontSize:16,cursor:'pointer',marginBottom:9}}>Got it — close</button>
                  {!['cant_complete','hours_running_out','medical','vehicle_theft'].includes(panelIssue?.id)&&(
                    <button onClick={()=>setPanelState('resolving')} style={{width:'100%',padding:13,background:'transparent',border:'1px solid rgba(0,229,176,0.28)',borderRadius:10,color:'#00e5b0',fontWeight:500,fontSize:14,cursor:'pointer'}}>
                      ✅ Issue resolved — back on track
                    </button>
                  )}
                </div>
              )
            })()}

            {/* RESOLVING state */}
            {panelState==='resolving'&&(
              <div>
                <div style={{fontSize:17,fontWeight:700,color:'#e8eaed',marginBottom:5}}>What happened?</div>
                <div style={{fontSize:13,color:'#4a5260',marginBottom:14}}>Ops will be notified. Job updates to on-track.</div>
                {[
                  {id:'breakdown_recovered',label:'🔧 Breakdown recovered',sub:'Vehicle moving again'},
                  {id:'delay_cleared',label:'🟢 Delay cleared',sub:'Back on schedule'},
                  {id:'temp_back_in_range',label:'❄ Temp back in range',sub:'Cold chain restored'},
                  {id:'rerouted_clear',label:'🛣 Rerouted — clear now',sub:'New route confirmed'},
                  {id:'access_resolved',label:'🚪 Access resolved',sub:'Now at site'},
                  {id:'delivery_accepted',label:'📦 Delivery accepted',sub:'POD signed'},
                  {id:'tacho_cleared',label:'📟 Tacho cleared',sub:'Issue resolved by depot'},
                  {id:'other_resolved',label:'✅ Other — resolved',sub:'Issue no longer active'},
                ].map(opt=>(
                  <button key={opt.id} onClick={()=>resolveIssue(opt.label)}
                    style={{width:'100%',marginBottom:8,padding:'13px',background:'rgba(0,229,176,0.04)',border:'1px solid rgba(0,229,176,0.12)',borderRadius:10,cursor:'pointer',textAlign:'left',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div><div style={{fontSize:14,color:'#e8eaed',fontWeight:500}}>{opt.label}</div><div style={{fontSize:11,color:'#4a5260',marginTop:2}}>{opt.sub}</div></div>
                    <span style={{color:'#00e5b0',fontSize:15}}>→</span>
                  </button>
                ))}
                <button onClick={()=>setPanelState('result')} style={{width:'100%',padding:9,background:'transparent',border:'none',color:'#4a5260',fontSize:12,cursor:'pointer',marginTop:3}}>← Back</button>
              </div>
            )}

            {panelState==='resolving_loading'&&<div style={{textAlign:'center',padding:'44px 0'}}><div style={{width:38,height:38,border:'3px solid rgba(0,229,176,0.15)',borderTop:'3px solid #00e5b0',borderRadius:'50%',margin:'0 auto 14px',animation:'spin 1s linear infinite'}}/><div style={{fontSize:13,color:'#00e5b0',fontFamily:'monospace'}}>NOTIFYING OPS...</div></div>}

            {/* RESOLVED state */}
            {panelState==='resolved'&&(
              <div style={{textAlign:'center',padding:'22px 0'}}>
                <div style={{fontSize:46,marginBottom:10}}>✅</div>
                <div style={{fontSize:19,color:'#00e5b0',fontWeight:700,marginBottom:5}}>Back on track</div>
                <div style={{fontSize:13,color:'#8a9099',marginBottom:resolvedEta?12:22}}>Ops notified. Job updated.</div>
                {resolvedEta&&<div style={{padding:'10px 14px',background:'rgba(0,229,176,0.05)',border:'1px solid rgba(0,229,176,0.2)',borderRadius:9,marginBottom:22,fontSize:13,color:'#e8eaed',lineHeight:1.6,textAlign:'left'}}>{resolvedEta}</div>}
                <button onClick={closePanel} style={{padding:'13px 44px',background:'#00e5b0',border:'none',borderRadius:10,color:'#000',fontWeight:700,fontSize:15,cursor:'pointer'}}>Close</button>
              </div>
            )}

            {/* SENT state */}
            {panelState==='sent'&&(
              <div style={{textAlign:'center',padding:'30px 0'}}>
                <div style={{fontSize:42,marginBottom:10}}>✅</div>
                <div style={{fontSize:17,color:'#00e5b0',fontWeight:700,marginBottom:5}}>Ops notified</div>
                <div style={{fontSize:13,color:'#4a5260',marginBottom:22}}>Your manager has been alerted.</div>
                <button onClick={closePanel} style={{padding:'12px 38px',background:'#00e5b0',border:'none',borderRadius:10,color:'#000',fontWeight:700,fontSize:14,cursor:'pointer'}}>Close</button>
              </div>
            )}

            {/* NO ACTIVE JOB state */}
            {panelState==='no_active_job'&&(
              <div style={{textAlign:'center',padding:'30px 0'}}>
                <div style={{fontSize:42,marginBottom:10}}>✅</div>
                <div style={{fontSize:17,color:'#00e5b0',fontWeight:700,marginBottom:7}}>All runs are complete</div>
                <div style={{fontSize:13,color:'#8a9099',marginBottom:7,lineHeight:1.6}}>No active delivery to raise this against.</div>
                <div style={{fontSize:12,color:'#4a5260',marginBottom:22}}>For vehicle or medical emergencies use Breakdown or Medical.</div>
                <button onClick={closePanel} style={{padding:'12px 38px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,color:'#8a9099',fontWeight:500,fontSize:13,cursor:'pointer'}}>Close</button>
              </div>
            )}

            {/* LOADING state */}
            {panelState==='loading'&&(
              <div style={{textAlign:'center',padding:'44px 0'}}>
                <div style={{width:42,height:42,border:'3px solid rgba(0,229,176,0.12)',borderTop:'3px solid #00e5b0',borderRadius:'50%',margin:'0 auto 14px',animation:'spin 1s linear infinite'}}/>
                <div style={{fontSize:13,color:'#00e5b0',fontFamily:'monospace',marginBottom:5}}>GETTING INSTRUCTIONS...</div>
                <div style={{fontSize:12,color:'#4a5260'}}>Ops manager alerted</div>
              </div>
            )}

            {/* IDLE state — input form */}
            {panelState==='idle'&&(
              <>
                {panelIssue?.needsText&&(
                  <textarea value={inputText} onChange={e=>setInputText(e.target.value)} rows={4}
                    onFocus={e=>{setTimeout(()=>e.target.scrollIntoView({behavior:'smooth',block:'center'}),350)}}
                    placeholder={panelIssue.placeholder||'Describe what has happened...'}
                    style={{width:'100%',padding:'13px',background:'#1a1f26',border:'2px solid rgba(255,255,255,0.16)',borderRadius:10,color:'#e8eaed',fontSize:16,lineHeight:1.6,outline:'none',resize:'none',boxSizing:'border-box',marginBottom:13,WebkitAppearance:'none'}}/>
                )}
                {activeJob&&(
                  <div style={{padding:'8px 11px',background:'rgba(0,229,176,0.03)',border:'1px solid rgba(0,229,176,0.1)',borderRadius:7,fontSize:12,color:'#8a9099',marginBottom:14}}>
                    Job: <span style={{color:'#00e5b0',fontWeight:500}}>{activeJob.ref}</span> · {activeJob.route}
                  </div>
                )}
                <button onClick={sendAlert}
                  style={{width:'100%',padding:15,background:['breakdown','cant_complete','theft_threat','driver_unwell','medical','accident','vehicle_theft'].includes(panelIssue?.id)?'#ef4444':'#00e5b0',border:'none',borderRadius:10,color:['breakdown','cant_complete','theft_threat','driver_unwell','medical','accident','vehicle_theft'].includes(panelIssue?.id)?'#fff':'#000',fontWeight:700,fontSize:16,cursor:'pointer',marginBottom:9}}>
                  {panelIssue?.id==='breakdown'?'🚨 Alert ops now':
                   panelIssue?.id==='accident'?'💥 Alert ops — accident':
                   panelIssue?.id==='medical'?'🚑 Alert ops — medical':
                   panelIssue?.id==='theft_threat'?'🦺 Alert ops — security':
                   panelIssue?.id==='vehicle_theft'?'🚨 Alert ops — vehicle stolen':
                   panelIssue?.id==='cant_complete'?'⛔ Flag and alert ops':
                   panelIssue?.id==='rest'?'🛌 Find safe parking →':
                   panelIssue?.id==='temp_alarm'?'🌡 Log and check →':
                   '⚠ Get instructions →'}
                </button>
                <div style={{fontSize:11,color:'#4a5260',textAlign:'center',lineHeight:1.5}}>
                  {['breakdown','delayed','defect','temp_alarm','cant_complete','driver_unwell','theft_threat','medical','accident','vehicle_theft','tacho_fault','hours_running_out'].includes(panelIssue?.id)?'Ops manager notified immediately':'AI instructions in seconds'}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
