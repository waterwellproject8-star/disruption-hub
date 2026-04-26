'use client'
import React, { useState, useEffect, useRef } from 'react'

const PROGRESS_STEPS = [
  { id:'arrived_collection', label:'Arrived at Collection', icon:'📍', color:'#3b82f6', status:'at_collection' },
  { id:'loading_complete',   label:'Loaded & Secured',     icon:'✅', color:'#f5a623', status:'loaded' },
  { id:'arrived_delivery',   label:'Arrived at Customer',  icon:'🏭', color:'#3b82f6', status:'at_customer' },
]

const VEHICLE_TYPES_HAULAGE = [
  { id:'artic',    label:'Artic (44t)',      icon:'🚛' },
  { id:'rigid',    label:'Rigid',            icon:'🚚' },
  { id:'fridge',   label:'Fridge / Reefer',  icon:'❄' },
  { id:'flatbed',  label:'Flatbed',          icon:'🔲' },
  { id:'taillift', label:'Tail-lift',        icon:'⬇' },
  { id:'van',      label:'Van / Sprinter',   icon:'🚐' },
]

const VEHICLE_TYPES_PSV = [
  { id:'minibus',     label:'Minibus',            icon:'🚐' },
  { id:'single_deck', label:'Single-decker bus',  icon:'🚌' },
  { id:'double_deck', label:'Double-decker bus',  icon:'🚌' },
  { id:'coach',       label:'Coach',              icon:'🚍' },
  { id:'exec_coach',  label:'Executive coach',    icon:'🚍' },
  { id:'school_bus',  label:'School bus',         icon:'🚌' },
]

const ISSUE_GROUPS = [
  {
    id:'road', label:'ON THE ROAD', color:'#f59e0b',
    issues:[
      { id:'delayed',         label:'Running Late',            icon:'⏱', needsText:true,  placeholder:'What is causing the delay?' },
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

const PRESHIFT_CHECKS_HAULAGE_BASE = [
  { id:'lights',  label:'Lights & indicators',        icon:'💡' },
  { id:'tyres',   label:'Tyres — no damage or flats', icon:'⚫' },
  { id:'mirrors', label:'Mirrors — clean & adjusted', icon:'🔲' },
  { id:'brakes',  label:'Brakes — no issues',         icon:'🛑' },
  { id:'fuel',    label:'Fuel level — checked',       icon:'⛽' },
  { id:'docs',    label:'Licence & documents',        icon:'📄' },
  { id:'load',    label:'Load — secured properly',    icon:'🔒' },
]
const PRESHIFT_FRIDGE   = { id:'fridge',   label:'Fridge unit — at temp',        icon:'❄' }
const PRESHIFT_CURTAINS = { id:'curtains', label:'Curtains & straps — secure',   icon:'🪢' }
const PRESHIFT_TAILLIFT = { id:'taillift', label:'Tail lift — operational',      icon:'⬇' }

const PRESHIFT_CHECKS_PSV = [
  { id:'tyres_wheels',       label:'Tyres + wheel fixings — 1mm tread, no cuts, nuts secure', icon:'⚫' },
  { id:'lights_psv',         label:'Lights, indicators, brake lights all working',             icon:'💡' },
  { id:'doors_exits',        label:'Passenger doors + emergency exits open/close fully',       icon:'🚪' },
  { id:'brakes_psv',         label:'Service + parking brake, air build-up, no leaks',          icon:'🛑' },
  { id:'mirrors_visibility', label:'Mirrors — clean, secure, no glass damage',                 icon:'🔲' },
  { id:'seat_belts',         label:'Driver + passenger seat belts functional',                  icon:'🔒' },
  { id:'accessibility',      label:'Wheelchair lift / ramp + priority seating working',         icon:'♿' },
  { id:'fire_extinguisher',  label:'Fire extinguisher — present, sealed, in date',              icon:'🧯' },
  { id:'first_aid_kit',      label:'First aid kit — present + in date (16+ seats)',             icon:'🩹' },
  { id:'emergency_hammer',   label:'Emergency exit hammer — present + accessible',              icon:'🔨' },
]

const POSTSHIFT_CHECKS = [
  { id:'body_damage',  label:'No new body damage',   icon:'🔍' },
  { id:'tyres_post',   label:'Tyres still OK',       icon:'⚫' },
  { id:'lights_post',  label:'Lights still working', icon:'💡' },
  { id:'cab_clean',    label:'Cab left clean',       icon:'🧹' },
  { id:'fuel_logged',  label:'Fuel level noted',     icon:'⛽' },
]

const STATUS_COLORS = {
  'on-track':       { dot:'#f5a623', label:'ON TRACK',       border:'rgba(245,166,35,0.2)',  bg:'rgba(245,166,35,0.03)' },
  'at_collection':  { dot:'#3b82f6', label:'AT COLLECTION',  border:'rgba(59,130,246,0.2)', bg:'rgba(59,130,246,0.03)' },
  'loaded':         { dot:'#f5a623', label:'LOADED',         border:'rgba(245,166,35,0.2)',  bg:'rgba(245,166,35,0.03)' },
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
  LOW:      { bg:'rgba(245,166,35,0.08)',  border:'rgba(245,166,35,0.3)',  color:'#f5a623', icon:'✅' },
  OK:       { bg:'rgba(245,166,35,0.08)',  border:'rgba(245,166,35,0.3)',  color:'#f5a623', icon:'✅' },
}

const normaliseReg = (reg) => (reg || '').toString().toUpperCase().replace(/\s+/g, '').trim()

export default function DriverApp() {
  const [jobs, setJobs]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [activeJob, setActiveJob]   = useState(null)
  const [driverInfo, setDriverInfo] = useState({ name:'', clientId:'', vehicleReg:'', phone:'', vehicleType:'' })
  const [setupDone, setSetupDone]   = useState(false)
  const [view, setView]             = useState('run')

  const [toast, setToast]               = useState(null)
  const [syncStatus, setSyncStatus]     = useState('ok')
  const [pendingUndo, setPendingUndo]   = useState(null)
  const [undoCountdown, setUndoCountdown] = useState(0)
  const undoTimer      = useRef(null)
  const countdownTimer = useRef(null)
  const shiftStartTime = useRef(null)
  const notifiedCancellations = useRef(new Set())
  const gpsIntervalRef = useRef(null)

  const [preShiftChecks, setPreShiftChecks]     = useState({})
  const [shiftStarted, setShiftStarted]         = useState(false)
  const [shiftEnded, setShiftEnded]             = useState(false)
  const [shiftSummary, setShiftSummary]         = useState(null)
  const [staleSession, setStaleSession]         = useState(null)
  const [duplicateSession, setDuplicateSession] = useState(null)
  const [duplicateChecking, setDuplicateChecking] = useState(false)
  const [sessionSuperseded, setSessionSuperseded] = useState(false)
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
  const [priorAlert, setPriorAlert]     = useState(null)
  const [priorAlertExpanded, setPriorAlertExpanded] = useState(false)
  const [resolvedEta, setResolvedEta]   = useState('')

  const [gpsCoords, setGpsCoords]           = useState(null)
  const [gpsDescription, setGpsDescription] = useState('')
  const [gpsStatus, setGpsStatus]           = useState(null)
  const [failedDeliveryHold, setFailedDeliveryHold] = useState(null)
  const [runningLateModal, setRunningLateModal] = useState(false)
  const [secUpNext, setSecUpNext] = useState(false)
  const [secReport, setSecReport] = useState(false)
  const [secCompleted, setSecCompleted] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [passengerCount, setPassengerCount] = useState('')
  const [engineerStatusSent, setEngineerStatusSent] = useState(null)
  const [lastResolveMethod, setLastResolveMethod] = useState(null)
  const [rptOpen, setRptOpen] = useState({})
  const [lateMinutes, setLateMinutes]     = useState('')
  const [lateReason, setLateReason]       = useState('Traffic')

  const VEHICLE_TYPES = (driverInfo?.sector === 'psv' || driverInfo?.sector === 'coach') ? VEHICLE_TYPES_PSV : VEHICLE_TYPES_HAULAGE

  useEffect(() => {
    // Load driver history for pre-filling setup screen
    try {
      const hist = localStorage.getItem('dh_driver_history')
      if (hist) {
        const h = JSON.parse(hist)
        if (!localStorage.getItem('dh_savedVehicles_normalised_v1') && h.regs?.length) {
          const seen = new Map()
          for (const r of h.regs) {
            const key = normaliseReg(r.reg)
            if (!seen.has(key)) seen.set(key, { reg: key, type: r.type })
          }
          h.regs = [...seen.values()]
          try { localStorage.setItem('dh_driver_history', JSON.stringify(h)) } catch {}
          localStorage.setItem('dh_savedVehicles_normalised_v1', '1')
        }
        setDriverHistory(h)
        const activeSession = localStorage.getItem('dh_driver_info')
        if (!activeSession) {
          const lastReg = h.regs?.[0]
          setDriverInfo({
            name: h.name || '',
            phone: h.phone ? normalisePhone(h.phone) : '',
            clientId: (h.clientId || '').toLowerCase().trim(),
            vehicleReg: normaliseReg(lastReg?.reg),
            vehicleType: lastReg?.type || ''
          })
        }
      }
    } catch {}

    const saved = localStorage.getItem('dh_driver_info')
    if (saved) {
      const info = JSON.parse(saved)
      // Normalise legacy-cased values from any pre-fix session so downstream API calls match Supabase rows.
      info.clientId = (info.clientId || '').toLowerCase().trim()
      if (info.vehicleReg) info.vehicleReg = info.vehicleReg.toUpperCase().trim()
      if (info.phone) info.phone = normalisePhone(info.phone)
      // Overwrite the stale entry so the tainted value never rehydrates again on this device.
      try { localStorage.setItem('dh_driver_info', JSON.stringify(info)) } catch {}
      setDriverInfo(info)
      setSetupDone(true)

      const shiftStartedAt = localStorage.getItem('dh_shift_started_at')
      const shiftDone      = localStorage.getItem('dh_shift_started')
      const savedAlert     = localStorage.getItem('dh_last_alert')
      const savedMessages  = localStorage.getItem('dh_ops_messages')
      if (savedMessages) {
        try {
          const all = JSON.parse(savedMessages)
          const readList = JSON.parse(localStorage.getItem('dh_ops_messages_read') || '[]')
          const dismissed = JSON.parse(localStorage.getItem('dh_dismissed_notifications') || '[]')
          setOpsMessages(all.filter(m => !readList.includes(m) && !dismissed.includes('ops_' + m.substring(0, 40))))
        } catch {}
      }

      // Only an active, non-stale shift may carry alert banners forward.
      // Any other case — wipe both alert keys so a prior shift's banners
      // don't leak into a new session.
      const hoursSinceStart = shiftStartedAt ? (Date.now() - parseInt(shiftStartedAt)) / 3600000 : Infinity
      const hasActiveShift = !!shiftDone && !!shiftStartedAt && hoursSinceStart <= 16

      if (shiftDone && shiftStartedAt && hoursSinceStart > 16) {
        let lastAlertTime = null
        if (savedAlert) { try { lastAlertTime = JSON.parse(savedAlert).time } catch {} }

        setStaleSession({ startedAt: new Date(parseInt(shiftStartedAt)).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}), hoursAgo: Math.round(hoursSinceStart), lastAlertTime })
        setLoading(false); return
      }

      if (!hasActiveShift) {
        localStorage.removeItem('dh_last_alert')
        localStorage.removeItem('dh_prior_alert')
      }

      if (shiftStartedAt) shiftStartTime.current = new Date(parseInt(shiftStartedAt))
      try { const sg = localStorage.getItem('dh_last_gps'); if (sg) { const p = JSON.parse(sg); if (p?.latitude) setGpsCoords(p) } } catch {}
      if (shiftDone) { setShiftStarted(true); startGpsRefresh() }
      if (hasActiveShift && savedAlert) { try { setLastAlert(JSON.parse(savedAlert)) } catch {} }
      if (hasActiveShift) {
        const savedPrior = localStorage.getItem('dh_prior_alert')
        if (savedPrior) { try { setPriorAlert(JSON.parse(savedPrior)) } catch {} }
      }
      loadJobs(info).then(loaded => {
        // Auto-clear only if all REAL jobs are completed (not SHIFT_START rows)
        // and there is actually job progress saved locally (not a brand new shift)
        const hasLocalProgress = !!localStorage.getItem('dh_job_progress')
        const realJobs = (loaded || []).filter(j => j.ref !== 'SHIFT_START')
        if (hasLocalProgress && realJobs.length > 0 && realJobs.every(j => j.status === 'completed')) clearSession()
      })
    } else { setLoading(false) }
    return () => { clearTimeout(undoTimer.current); clearInterval(countdownTimer.current); stopGpsRefresh() }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const swVersion = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'dev'
    navigator.serviceWorker.register(`/sw.js?v=${swVersion}`)
      .then(registration => {
        setInterval(() => { registration.update().catch(() => {}) }, 60_000)
      })
      .catch(err => console.error('[SW] registration failed:', err))
    let refreshingPage = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshingPage) return
      refreshingPage = true
      window.location.reload()
    })
  }, [])

  useEffect(() => {
    const code = (driverInfo.clientId || '').toLowerCase().trim()
    if (!code || code.length < 3) {
      setDriverInfo(prev => prev?.sector ? ({...prev, sector: null}) : prev)
      return
    }
    const t = setTimeout(() => {
      fetch(`/api/client-config?client_id=${encodeURIComponent(code)}`)
        .then(r => r.ok ? r.json() : null)
        .then(cfg => {
          if (!cfg?.sector) return
          setDriverInfo(prev => {
            if (!prev) return prev
            const next = { ...prev, sector: cfg.sector }
            const isPsv = cfg.sector === 'psv' || cfg.sector === 'coach'
            const validIds = isPsv ? VEHICLE_TYPES_PSV.map(v => v.id) : VEHICLE_TYPES_HAULAGE.map(v => v.id)
            if (prev.vehicleType && !validIds.includes(prev.vehicleType)) next.vehicleType = ''
            return next
          })
        })
        .catch(() => {})
    }, 600)
    return () => clearTimeout(t)
  }, [driverInfo.clientId])

  // ── OPS-INITIATED JOB POLL — checks every 60s for cancelled or newly assigned jobs ──
  // Also refreshes ETAs every 5 minutes so shipment times stay accurate
  const etaRefreshCount = useRef(0)
  useEffect(() => {
    if ((!shiftStarted && !defectBlocked) || !driverInfo.clientId || !driverInfo.vehicleReg) return

    const checkForOpsChanges = async () => {
      // Refresh ETAs every 5 polls (5 minutes) — prevents stale ETAs from shift start
      etaRefreshCount.current += 1
      if (etaRefreshCount.current % 5 === 0) {
        try {
          const fresh = await fetch(`/api/shipments?client_id=${driverInfo.clientId}`)
          if (fresh.ok) {
            const freshData = await fresh.json()
            const freshShipments = freshData.shipments || []
            if (freshShipments.length > 0) {
              setJobs(prev => prev.map(j => {
                const updated = freshShipments.find(s => s.ref === j.ref)
                // Only update ETA and sla_window — preserve driver's progress status
                return updated ? { ...j, eta: updated.eta, sla_window: updated.sla_window } : j
              }))
            }
          }
        } catch {}
      }
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
          const dismissKey = 'ops_' + msg.substring(0, 40)
          const alreadyDismissed = (() => { try { return JSON.parse(localStorage.getItem('dh_dismissed_notifications') || '[]').includes(dismissKey) } catch { return false } })()
          if (!notifiedCancellations.current.has(msgKey) && !alreadyDismissed) {
            notifiedCancellations.current.add(msgKey)
            setOpsMessages(prev => {
              const updated = [...prev, msg]
              try { localStorage.setItem('dh_ops_messages', JSON.stringify(updated)) } catch {}
              return updated
            })
            // Ops has responded — cancel the escalation timer and mark acknowledged
            setOpsAcknowledged(true)
            setEscalationTimer(prev => { if (prev) clearTimeout(prev); return null })
            if (defectBlocked) {
              setDefectBlocked(false)
              setShiftStarted(true)
              setView('run')
              localStorage.setItem('dh_shift_started','true')
              localStorage.setItem('dh_shift_started_at', String(Date.now()))
              loadJobs(driverInfo)
            }
          }
        }

      } catch {}
    }

    checkForOpsChanges() // Run immediately on shift start
    const interval = setInterval(checkForOpsChanges, 60000)
    return () => clearInterval(interval)
  }, [shiftStarted, defectBlocked, driverInfo.clientId, driverInfo.vehicleReg])

  useEffect(() => {
    const warn = e => { e.preventDefault(); e.returnValue = '' }
    if (shiftStarted) window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [shiftStarted])

  const showToast = (msg, type='ok', sub=null) => { setToast({msg,type,sub}); setTimeout(()=>setToast(null),4000) }

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

  function handleSessionSuperseded() {
    setSessionSuperseded(true)
    ;['dh_driver_info','dh_shift_started','dh_shift_started_at','dh_last_alert','dh_prior_alert','dh_job_progress','dh_ops_messages','dh_ops_messages_read','dh_dismissed_notifications','dh_session_id','dh_postshift_draft'].forEach(k=>localStorage.removeItem(k))
  }

  function pushProgressToSupabase(ref, status, alert, pod=null) {
    if (!driverInfo.clientId || !driverInfo.vehicleReg || !ref) return
    const session_id = typeof window !== 'undefined' ? localStorage.getItem('dh_session_id') : null
    setSyncStatus('pending')
    fetch('/api/driver/progress', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ client_id:driverInfo.clientId, vehicle_reg:driverInfo.vehicleReg, driver_name:driverInfo.name, driver_phone:driverInfo.phone||null, ref, status, alert:alert||null, pod: pod||null, session_id })
    }).then(async r => {
      if (r.status === 409) {
        try {
          const body = await r.json()
          if (body?.error === 'session_superseded') { handleSessionSuperseded(); return }
        } catch {}
      }
      setSyncStatus(r.ok ? 'ok' : 'error')
    }).catch(()=>{ setSyncStatus('error'); showToast('⚠ Sync failed','error') })
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
        drops:s.drops||null, multi_collection:s.multi_collection??true, collection_sequence:s.collection_sequence??1
      }))
      const merged = mergeJobProgress(mapped, progData.progress||[])

      // Check if ETAs are stale — if first active job ETA is in the past, use fresh shipment times
      // This fixes the issue where ETAs are loaded from localStorage at shift start hours ago
      const now = new Date()
      const activeJobs = merged.filter(j => j.status !== 'completed' && j.eta && j.eta !== '???')
      const firstActiveEta = activeJobs[0]?.eta
      let finalJobs = merged
      if (firstActiveEta) {
        const [h, m] = firstActiveEta.split(':').map(Number)
        const etaDate = new Date(now)
        etaDate.setHours(h, m, 0, 0)
        const staleByMins = (now - etaDate) / 60000
        // If ETA is more than 30 minutes in the past, use fresh times from shipments API
        if (staleByMins > 30) {
          finalJobs = merged.map(j => {
            const fresh = mapped.find(s => s.ref === j.ref)
            return fresh ? { ...j, eta: fresh.eta, sla_window: fresh.sla_window } : j
          })
        }
      }

      setJobs(finalJobs)
      const first = finalJobs.find(j=>j.status!=='completed')||finalJobs[0]
      if (first) setActiveJob(first)
      return finalJobs
    } catch { showToast('Could not load jobs','error'); return [] }
    finally { setLoading(false) }
  }

  function getGPS(silent) {
    if (!navigator.geolocation) { if (!silent) setGpsStatus('failed'); return }
    if (!silent) setGpsStatus('getting')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const {latitude,longitude,accuracy} = pos.coords
        const coords = {latitude,longitude,accuracy,timestamp:Date.now()}
        setGpsCoords(coords)
        if (!silent) setGpsStatus('got')
        try { localStorage.setItem('dh_last_gps',JSON.stringify(coords)) } catch {}
        try {
          const r = await fetch(`https://api.postcodes.io/postcodes?lon=${longitude}&lat=${latitude}&limit=1`)
          if (r.ok) {
            const j = await r.json()
            const result = j?.result?.[0]
            const ward = result?.admin_ward || result?.admin_district || result?.parliamentary_constituency || null
            setGpsDescription(ward || `${latitude.toFixed(4)},${longitude.toFixed(4)}`)
          } else {
            setGpsDescription(`${latitude.toFixed(4)},${longitude.toFixed(4)}`)
          }
        } catch { setGpsDescription(`${latitude.toFixed(4)},${longitude.toFixed(4)}`) }
      },
      (err)=>{ if (!silent) setGpsStatus('failed'); console.warn('[gps] position error:',err?.message) },
      {enableHighAccuracy:true,timeout:10000,maximumAge:0}
    )
  }

  function startGpsRefresh() {
    if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current)
    getGPS()
    gpsIntervalRef.current = setInterval(()=>getGPS(true), 120000)
  }

  function stopGpsRefresh() {
    if (gpsIntervalRef.current) { clearInterval(gpsIntervalRef.current); gpsIntervalRef.current = null }
  }

  function refreshGpsIfStale() {
    const age = gpsCoords?.timestamp ? Date.now() - gpsCoords.timestamp : Infinity
    if (age > 300000) getGPS(true)
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

    if (podOption === 'refused') {
      setJobs(prev=>{const u=prev.map(j=>j.ref===job.ref?{...j,status:'at_risk',alert:'Delivery refused — awaiting ops'}:j);saveJobProgress(u);return u})
      setActiveJob(prev=>({...prev,status:'at_risk',alert:'Delivery refused — awaiting ops'}))
      pushProgressToSupabase(job.ref,'at_risk','Delivery refused — awaiting ops')
      fetch('/api/driver/alert',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:driverInfo.clientId,driver_name:driverInfo.name,driver_phone:driverInfo.phone||null,vehicle_reg:driverInfo.vehicleReg,ref:job.ref,issue_type:'goods_refused',issue_description:`DELIVERY REFUSED. ${driverInfo.name} (${driverInfo.vehicleReg}). Job: ${job.route||'?'}. Ref: ${job.ref}.`,human_description:'Delivery refused by consignee',location_description:gpsDescription||null,latitude:gpsCoords?.latitude,longitude:gpsCoords?.longitude})}).catch(()=>{})
      setFailedDeliveryHold('refused')
      setTimeout(()=>setFailedDeliveryHold(null),10*60*1000)
      return
    }

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
    pushProgressToSupabase(job.ref, 'completed', null, podOption)
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
    setInputText(''); setParsedResult(null); setShowDetail(false); setResolvedEta(''); setEngineerStatusSent(null)
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

  function resolvePriorAlert() {
    if (!priorAlert) return
    const original_issue = priorAlert.issueId
    fetch('/api/driver/resolve', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        client_id: driverInfo.clientId,
        driver_name: driverInfo.name,
        vehicle_reg: driverInfo.vehicleReg,
        ref: activeJob?.ref,
        resolution: `${priorAlert.issueLabel || 'Breakdown'} — resolved while medical emergency active`,
        location_description: gpsDescription,
        route: activeJob?.route,
        sla_window: activeJob?.sla_window,
        original_issue
      })
    }).catch(() => {})
    setPriorAlert(null)
    setPriorAlertExpanded(false)
    localStorage.removeItem('dh_prior_alert')
    showToast('Breakdown marked resolved — ops notified')
  }

  async function resolveIssue(reason, methodId) {
    setPanelState('resolving_loading')
    await new Promise(r => setTimeout(r, 3000))
    const job = activeJob
    try {
      const res = await fetch('/api/driver/resolve',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({client_id:driverInfo.clientId,driver_name:driverInfo.name,vehicle_reg:driverInfo.vehicleReg,ref:job?.ref,resolution:reason,resolution_method:methodId||null,location_description:gpsDescription,route:job?.route,sla_window:job?.sla_window,original_issue:panelIssue?.id})})
      const data = await res.json()
      setJobs(prev=>{const u=prev.map(j=>j.status==='at_risk'?{...j,status:'on-track',alert:null}:j);saveJobProgress(u);u.filter(j=>j.status==='on-track'&&j.ref!=='SHIFT_START').forEach(j=>pushProgressToSupabase(j.ref,'on-track',null));return u})
      if (activeJob) setActiveJob(p=>({...p,status:'on-track',alert:null}))
      setLastAlert(null); localStorage.removeItem('dh_last_alert')
      setPriorAlert(null); localStorage.removeItem('dh_prior_alert')
      setResolvedEta(data.revised_eta||'')
      setEngineerStatusSent(null)
      setLastResolveMethod(methodId || null)
      setPanelState('resolved')
    } catch { setLastAlert(null); localStorage.removeItem('dh_last_alert'); setPriorAlert(null); localStorage.removeItem('dh_prior_alert'); setEngineerStatusSent(null); setLastResolveMethod(null); setPanelState('resolved') }
  }

  async function sendEngineerStatus(statusId, label) {
    const job = activeJob
    try {
      await fetch('/api/driver/engineer-status', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ client_id: driverInfo.clientId, driver_name: driverInfo.name, vehicle_reg: driverInfo.vehicleReg, ref: job?.ref, status: statusId })
      })
      setEngineerStatusSent(statusId)
      showToast(`Engineer status sent: ${label}`)
    } catch (e) {
      console.error('[engineer-status] send failed:', e)
      showToast('Failed to send — try again', 'error')
    }
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
      breakdown:        `BREAKDOWN EMERGENCY. ${driverInfo.vehicleReg} (${vtype}), ${driverInfo.name}. Location:${loc}. ${input?'Issue:'+input:'Vehicle broken down.'}. Job:${job?.route||'?'}. Cargo:${cargo}. IMPORTANT: Tell the driver to stay with their vehicle — ops have been notified and are arranging recovery. Driver will receive confirmation shortly. Then assess SLA risk.`,
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
      // If medical triggers while a non-medical breakdown is active, preserve
      // the existing alert in priorAlert so the driver can still see and resolve it
      if (panelIssue?.id === 'medical' && lastAlert && lastAlert.issueId !== 'medical') {
        setPriorAlert(lastAlert); localStorage.setItem('dh_prior_alert', JSON.stringify(lastAlert))
      }
      // Clear stale ops messages/instructions from prior incidents
      setOpsMessages([]); try { localStorage.removeItem('dh_ops_messages') } catch {}
      const placeholder = { headline:`${panelIssue.label} — ops alerted`, severity:'HIGH', actions:['Stay with your vehicle. Ops have been notified and are arranging recovery — you will receive confirmation shortly.'], detail:'', issueId:panelIssue.id, issueLabel:panelIssue.label, time:new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) }
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

    refreshGpsIfStale()
    console.log('[breakdown] firing alert, client_id:', driverInfo.clientId, 'vehicle:', driverInfo.vehicleReg, 'issue:', panelIssue?.id, 'ref:', job?.ref)
    fetch('/api/driver/alert',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({client_id:driverInfo.clientId,driver_name:driverInfo.name,driver_phone:driverInfo.phone||null,vehicle_reg:driverInfo.vehicleReg,ref:job?.ref,issue_type:panelIssue?.id,issue_description:prompt,human_description:inputText||panelIssue?.label,location_description:gpsDescription,latitude:gpsCoords?.latitude,longitude:gpsCoords?.longitude,passenger_count:passengerCount?parseInt(passengerCount,10):null,at_risk_refs:jobs.filter(j=>j.status!=='completed').map(j=>j.ref).filter(r=>r&&r!=='SHIFT_START')})
    }).then(r=>{console.log('[breakdown] alert response:',r.status);if(!r.ok)r.text().then(t=>console.error('[breakdown] server error:',r.status,t))}).catch(e=>console.error('[breakdown] fetch error:',e?.message))

    if (emergencyIds.includes(panelIssue?.id)) {
      setOpsAcknowledged(false)
      setEscalationTimer(prev => { if (prev) clearTimeout(prev); return null })
      const timer = setTimeout(()=>{
        setOpsAcknowledged(prev => {
          if (!prev) showToast('⚠ Ops not yet responded — try calling directly','error')
          return prev
        })
      }, 15 * 60 * 1000)
      setEscalationTimer(timer)
    }

    try {
      const res = await fetch('/api/driver/agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:prompt}],driver_mode:true})})
      const reader=res.body.getReader(); const decoder=new TextDecoder(); let full=''
      while(true){const{done,value}=await reader.read();if(done)break;for(const line of decoder.decode(value).split('\n')){if(line.startsWith('data: ')&&line!=='data: [DONE]'){try{const p=JSON.parse(line.slice(6));if(p.text)full+=p.text}catch{}}}}
      if(full){setParsedResult(parseResponse(full));setPanelState('result')}else setPanelState('sent')
    } catch {setPanelState('sent')}

    // Show holding panel for failed/refused deliveries
    if (['goods_refused','short_load','damage_found'].includes(panelIssue?.id)) {
      setFailedDeliveryHold(panelIssue.id)
      setTimeout(() => setFailedDeliveryHold(null), 10 * 60 * 1000)
    }
  }

  // Save driver history for pre-filling future setup screens
  function saveDriverHistory(info) {
    try {
      const existing = (() => { try { return JSON.parse(localStorage.getItem('dh_driver_history')||'{}') } catch { return {} } })()
      const regs = existing.regs || []
      // Add current reg+type to front of list, remove duplicates, cap at 5
      const newReg = { reg: normaliseReg(info.vehicleReg), type: info.vehicleType }
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

  function proceedWithSetup(n) {
    const sessionId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`
    localStorage.setItem('dh_driver_info',JSON.stringify(n))
    localStorage.setItem('dh_session_id', sessionId)
    setDriverInfo(n)
    saveDriverHistory(n)
    setSetupDone(true)
    loadJobs(n)
  }

  async function saveDriverInfo() {
    if (!driverInfo.name||!driverInfo.clientId||!driverInfo.phone||!driverInfo.vehicleType||!driverInfo.vehicleReg) return
    const n = {...driverInfo, clientId: driverInfo.clientId.toLowerCase().trim(), vehicleReg: driverInfo.vehicleReg.toUpperCase().trim(), phone:normalisePhone(driverInfo.phone)}
    setDuplicateChecking(true)
    try {
      const res = await fetch(`/api/driver/progress?client_id=${encodeURIComponent(n.clientId)}&vehicle_reg=${encodeURIComponent(n.vehicleReg)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const active = (data.progress || []).find(r => r.ref === 'SHIFT_START' && r.status === 'on_shift')
      if (active) {
        setDuplicateSession({ info: n, activeSince: active.updated_at })
        setDuplicateChecking(false)
        return
      }
    } catch {
      setDuplicateChecking(false)
      showToast('Could not verify active sessions — please try again', 'error')
      return
    }
    setDuplicateChecking(false)
    proceedWithSetup(n)
  }

  async function confirmOverwriteSession() {
    const n = duplicateSession?.info
    if (!n) return
    try {
      const res = await fetch('/api/driver/end-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: n.clientId,
          vehicle_reg: n.vehicleReg,
          reason: 'superseded_by_new_driver'
        })
      })
      if (!res.ok) {
        showToast('Could not end previous session — please try again', 'error')
        return
      }
    } catch {
      showToast('Could not end previous session — please try again', 'error')
      return
    }
    setDuplicateSession(null)
    proceedWithSetup(n)
  }

  function cancelDuplicateSession() {
    setDuplicateSession(null)
    // Keep driverInfo state intact so the setup form reappears with their input
  }

  function startShift() {
    const now = Date.now()
    // Clear any residual alert/panel state from a previous shift before starting fresh
    setLastAlert(null); localStorage.removeItem('dh_last_alert')
    setPriorAlert(null); localStorage.removeItem('dh_prior_alert')
    setPriorAlertExpanded(false)
    setPanelOpen(false)
    setPanelState('idle')
    setPanelIssue(null)
    setParsedResult(null)
    setOpsAcknowledged(false)
    setShowDetail(false); setResolvedEta(''); setEscalationTimer(null); setResumeConfirm(false); setOpsJobUpdate(null); setFailedDeliveryHold(null); setOpsMessages([]); setGpsStatus(null)
    notifiedCancellations.current = new Set()
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

      // Write a defect-blocked SHIFT_START row so ops has something to UPDATE with OPS_MSG
      fetch('/api/driver/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:    driverInfo.clientId,
          vehicle_reg:  driverInfo.vehicleReg,
          driver_name:  driverInfo.name,
          driver_phone: driverInfo.phone || null,
          ref:    'SHIFT_START',
          status: 'defect_blocked',
          alert:  null,
          session_id: typeof window !== 'undefined' ? localStorage.getItem('dh_session_id') : null
        })
      }).then(async r => {
        if (r.status === 409) {
          try { const b = await r.json(); if (b?.error === 'session_superseded') handleSessionSuperseded() } catch {}
        }
      }).catch(() => {})
    } else {
      // Clear old job progress from localStorage BEFORE loading jobs
      // Prevents mergeJobProgress reading stale completed statuses and auto-firing clearSession
      // which would immediately mark the new SHIFT_START row as completed
      localStorage.removeItem('dh_job_progress')

      setShiftStarted(true); setView('run')

      // Write SHIFT_START row to driver_progress FIRST with driver phone
      // This ensures the driver appears in Live Fleet on ops dashboard immediately
      // Must happen before loadJobs to avoid the clearSession race condition
      fetch('/api/driver/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:    driverInfo.clientId,
          vehicle_reg:  driverInfo.vehicleReg,
          driver_name:  driverInfo.name,
          driver_phone: driverInfo.phone || null,
          ref:    'SHIFT_START',
          status: 'on_shift',
          alert:  null,
          session_id: typeof window !== 'undefined' ? localStorage.getItem('dh_session_id') : null
        })
      }).then(async r => {
        if (r.status === 409) {
          try { const b = await r.json(); if (b?.error === 'session_superseded') handleSessionSuperseded() } catch {}
        }
      }).catch(() => {})

      loadJobs(driverInfo)
    }
    startGpsRefresh()
    if (driverInfo.clientId) {
      fetch(`/api/client-config?client_id=${driverInfo.clientId}`).then(r=>r.json()).then(cfg=>{
        if (cfg?.sector) setDriverInfo(prev=>({...prev, sector: cfg.sector}))
      }).catch(()=>{})
    }
  }

  function clearSession(reason = 'session_cleared') {
    // Read session data from storage BEFORE wiping so end-shift POST has full context
    let savedInfo = null
    let startedAtIso = null
    try {
      const raw = localStorage.getItem('dh_driver_info')
      if (raw) savedInfo = JSON.parse(raw)
      const sa = localStorage.getItem('dh_shift_started_at')
      if (sa) startedAtIso = new Date(parseInt(sa)).toISOString()
    } catch {}

    const clientId    = savedInfo?.clientId    || driverInfo.clientId
    const vehicleReg  = savedInfo?.vehicleReg  || driverInfo.vehicleReg
    const driverPhone = savedInfo?.phone       || driverInfo.phone
    const driverName  = savedInfo?.name        || driverInfo.name

    // 1. Fire-and-forget end-shift POST with full session context
    if (vehicleReg || driverPhone) {
      fetch('/api/driver/end-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:    clientId,
          vehicle_reg:  vehicleReg || null,
          driver_phone: driverPhone || null,
          driver_name:  driverName || null,
          started_at:   startedAtIso,
          reason
        })
      }).catch(err => console.error('clearSession end-shift failed:', err))
    }

    // 2. Wipe shift/session keys — keep dh_driver_info so name + phone pre-fill on next login
    stopGpsRefresh()
    ;['dh_shift_started','dh_shift_started_at','dh_last_alert','dh_prior_alert','dh_job_progress','dh_ops_messages','dh_ops_messages_read','dh_dismissed_notifications','dh_session_id','dh_postshift_draft','dh_last_gps'].forEach(k=>localStorage.removeItem(k))

    // 3-5. Reset state so the SHIFT EXPIRED guard (setupDone && staleSession) falsifies and setup screen re-renders.
    // Pre-populate name + phone from dh_driver_info (same driver, same phone every shift).
    // vehicleReg stays blank — dh_driver_history handles the reg dropdown separately.
    setStaleSession(null)
    setSetupDone(false)
    setDriverInfo(savedInfo
      ? { name: savedInfo.name || '', phone: savedInfo.phone || '', clientId: savedInfo.clientId || '', vehicleReg: '', vehicleType: '' }
      : { name:'', clientId:'', vehicleReg:'', phone:'', vehicleType:'' })
    setShiftStarted(false); setShiftEnded(false); setShiftSummary(null); setJobs([]); setActiveJob(null); setLastAlert(null); setPriorAlert(null); setPreShiftChecks({}); setOpsMessages([]); setView('run')
    setOpsAcknowledged(false); setPriorAlertExpanded(false); setPanelOpen(false); setPanelState('idle'); setPanelIssue(null); setParsedResult(null); setShowDetail(false); setResolvedEta(''); setEscalationTimer(null); setResumeConfirm(false); setOpsJobUpdate(null); setFailedDeliveryHold(null); setGpsCoords(null); setGpsDescription(''); setGpsStatus(null); setPassengerCount(''); setEngineerStatusSent(null); setLastResolveMethod(null)
    notifiedCancellations.current = new Set()
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
    const unresolved = jobs.filter(j=>j.status==='at_risk'||j.status==='part_delivered').length
    const safeChecks = Object.fromEntries(Object.entries(postShiftChecks).map(([k,v])=>[k,!!v]))
    const summary = { completed, total, incidents:lastAlert?1:0, duration, endTime:end.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}), notes:shiftNotes, mileage:shiftMileage, postShiftChecks:safeChecks, unresolved }
    setShiftSummary(summary)
    // Persist locally so a network failure during submit doesn't lose the report
    try { localStorage.setItem('dh_last_shift_summary', JSON.stringify({ ...summary, savedAt: end.toISOString(), vehicleReg: driverInfo.vehicleReg, driverName: driverInfo.name })) } catch {}
    setShiftEnded(true); setShowPostShift(false)
    // Mark driver_progress completed in Supabase — clean exit, no stale data
    if (driverInfo.vehicleReg || driverInfo.phone) {
      fetch('/api/driver/end-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:    driverInfo.clientId,
          vehicle_reg:  driverInfo.vehicleReg || null,
          driver_phone: driverInfo.phone || null,
          driver_name:  driverInfo.name || null,
          reason: 'shift_completed',
          started_at:  start ? start.toISOString() : null,
          ended_at:    end.toISOString(),
          duration_minutes: duration,
          mileage: shiftMileage,
          notes: shiftNotes || null,
          post_shift_checks: safeChecks,
          jobs_completed: completed,
          jobs_total: total,
          incidents_count: lastAlert ? 1 : 0,
          unresolved_count: unresolved,
          unresolved_jobs: jobs.filter(j=>j.status!=='completed').map(j=>({ref:j.ref,route:j.route||null,status:j.status||'pending',alert:j.alert||null})),
          fuel_level: null,
          defects_flagged: false,
          defect_details: null
        })
      }).then(res => {
        if (res.ok) ['dh_shift_started','dh_shift_started_at','dh_last_alert','dh_prior_alert','dh_job_progress','dh_postshift_draft','dh_dismissed_notifications','dh_session_id'].forEach(k=>localStorage.removeItem(k))
      }).catch(() => {})
    } else {
      ['dh_shift_started','dh_shift_started_at','dh_last_alert','dh_prior_alert','dh_job_progress','dh_dismissed_notifications','dh_session_id'].forEach(k=>localStorage.removeItem(k))
    }
  }

  function preShift() {
    const isPsv = driverInfo?.sector === 'psv' || driverInfo?.sector === 'coach'
    if (isPsv) return [...PRESHIFT_CHECKS_PSV]
    const checks = [...PRESHIFT_CHECKS_HAULAGE_BASE]
    const vt = (driverInfo.vehicleType || '').toLowerCase()
    if (!vt) return checks
    if (/fridge|reefer|cold/.test(vt)) checks.push(PRESHIFT_FRIDGE)
    if (/artic|flatbed|curtain/.test(vt)) checks.push(PRESHIFT_CURTAINS)
    if (/tail/.test(vt)) checks.push(PRESHIFT_TAILLIFT)
    return checks
  }

  const cargoIcon = t=>!t?'📦':t.includes('pharma')?'💊':t.includes('frozen')?'🧊':t.includes('chilled')?'❄':'📦'

  function formatSlot(raw) {
    if (!raw) return null
    const d = new Date(raw.includes('T') || raw.includes('+') || raw.includes(' ') ? raw : raw)
    if (isNaN(d)) return raw
    const today = new Date()
    const isToday = d.toDateString() === today.toDateString()
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    if (isToday) return `${time} today`
    return `${time} ${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`
  }

  // ── SESSION SUPERSEDED (hard lockout — takes precedence over everything) ──
  if (sessionSuperseded) {
    return (
      <div style={{minHeight:'100vh',background:'#090b0d',color:'#e8eaed',fontFamily:'Barlow,sans-serif',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
        <div style={{width:'100%',maxWidth:380,textAlign:'center'}}>
          <div style={{width:56,height:56,margin:'0 auto 24px',background:'#ef4444',clipPath:'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'}} />
          <div style={{fontSize:12,fontFamily:'monospace',color:'#ef4444',fontWeight:700,letterSpacing:'0.1em',marginBottom:10}}>SESSION ENDED</div>
          <div style={{fontSize:18,color:'#e8eaed',fontWeight:600,lineHeight:1.5,marginBottom:14}}>Your session has ended — this vehicle has been taken over by another driver.</div>
          <div style={{fontSize:13,color:'#8a9099',lineHeight:1.6}}>Contact ops if this is unexpected. You can start a fresh session by reloading this page.</div>
        </div>
      </div>
    )
  }

  // ── DUPLICATE SESSION WARNING ─────────────────────────────────────────────
  if (duplicateSession) {
    const activeSinceStr = duplicateSession.activeSince
      ? new Date(duplicateSession.activeSince).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})
      : null
    return (
      <div style={{minHeight:'100vh',background:'#090b0d',color:'#e8eaed',fontFamily:'Barlow,sans-serif',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
        <div style={{width:'100%',maxWidth:380}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:22}}>
            <div style={{width:32,height:32,background:'#f5a623',clipPath:'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'}} />
            <div>
              <div style={{fontSize:15,fontWeight:600}}>{duplicateSession.info.name}</div>
              <div style={{fontSize:11,color:'#4a5260',fontFamily:'monospace'}}>{duplicateSession.info.vehicleReg}</div>
            </div>
          </div>
          <div style={{padding:'18px',background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:12,marginBottom:20}}>
            <div style={{fontSize:12,color:'#ef4444',fontFamily:'monospace',fontWeight:700,letterSpacing:'0.06em',marginBottom:6}}>⚠ VEHICLE ALREADY ON SHIFT</div>
            <div style={{fontSize:15,color:'#e8eaed',fontWeight:500,lineHeight:1.5,marginBottom:activeSinceStr?6:0}}>This vehicle is already on shift. Starting a new session will end the previous one.</div>
            {activeSinceStr && <div style={{fontSize:12,color:'#8a9099'}}>Previous session active since {activeSinceStr}</div>}
          </div>
          <div style={{fontSize:13,color:'#8a9099',marginBottom:20,lineHeight:1.6}}>Tap Continue to proceed — the previous driver's session will be closed out. Tap Cancel to go back and choose a different vehicle.</div>
          <button onClick={confirmOverwriteSession} style={{width:'100%',padding:'15px',background:'#f5a623',border:'none',borderRadius:10,color:'#000',fontWeight:700,fontSize:16,cursor:'pointer',marginBottom:10}}>Continue — end previous session</button>
          <button onClick={cancelDuplicateSession} style={{width:'100%',padding:'14px',background:'transparent',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,color:'#8a9099',fontWeight:500,fontSize:15,cursor:'pointer'}}>Cancel</button>
        </div>
      </div>
    )
  }

  // ── SETUP ─────────────────────────────────────────────────────────────────
  if (!setupDone) {
    const hasHistory = driverHistory.regs && driverHistory.regs.length > 0
    const isReturning = !!(driverHistory.name || driverHistory.phone)
    const ready = driverInfo.name && driverInfo.phone && driverInfo.vehicleType && driverInfo.clientId && driverInfo.vehicleReg

    return (
    <div style={{minHeight:'100vh',background:'#0a0a0f',color:'rgba(255,255,255,0.92)',fontFamily:"'DM Sans',-apple-system,sans-serif",display:'flex',flexDirection:'column',justifyContent:'center',padding:'32px 24px'}}>
      <div style={{width:'100%',maxWidth:380,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{width:44,height:44,background:'#f5a623',clipPath:'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',margin:'0 auto 16px'}} />
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:13,color:'rgba(255,255,255,0.35)',letterSpacing:'0.1em',textTransform:'uppercase'}}>DisruptionHub</div>
        </div>

        <div style={{fontSize:26,fontWeight:700,color:'rgba(255,255,255,0.92)',letterSpacing:'-0.5px',marginBottom:6}}>Sign in to start your shift</div>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:'rgba(255,255,255,0.3)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:20}}>
          {isReturning ? 'CONFIRM YOUR DETAILS' : 'FIRST TIME SETUP'}
        </div>

        {/* Name — pre-filled from history */}
        <div style={{marginBottom:12}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:'rgba(255,255,255,0.3)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:6}}>Your full name</div>
          <input
            value={driverInfo.name}
            onChange={e=>setDriverInfo(p=>({...p,name:e.target.value}))}
            placeholder='e.g. Carl Hughes'
            style={{width:'100%',padding:'13px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.09)',borderRadius:14,color:'rgba(255,255,255,0.92)',fontSize:16,fontFamily:"'DM Sans',sans-serif",outline:'none',boxSizing:'border-box'}}/>
        </div>

        {/* Phone — pre-filled from history */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:13,color:'#8a9099',marginBottom:5}}>Your mobile number</div>
          <input
            value={driverInfo.phone}
            onChange={e=>setDriverInfo(p=>({...p,phone:e.target.value}))}
            placeholder='e.g. 07810 499983'
            inputMode='tel'
            style={{width:'100%',padding:'13px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.09)',borderRadius:14,color:'rgba(255,255,255,0.92)',fontSize:16,fontFamily:"'DM Sans',sans-serif",outline:'none',boxSizing:'border-box'}}/>
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
                style={{width:'100%',padding:'13px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.09)',borderRadius:14,color:driverInfo.vehicleReg?'rgba(255,255,255,0.92)':'rgba(255,255,255,0.3)',fontSize:16,fontFamily:"'DM Sans',sans-serif",outline:'none',boxSizing:'border-box',cursor:'pointer'}}>
                <option value=''>Select vehicle...</option>
                {driverHistory.regs.map(r=>{
                  const typeLabel = VEHICLE_TYPES.find(v=>v.id===r.type)?.label
                  return (
                    <option key={r.reg} value={r.reg}>
                      {r.reg}{typeLabel ? ` — ${typeLabel}` : ''}
                    </option>
                  )
                })}
                <option value='__new__'>＋ Different registration...</option>
              </select>
              {driverInfo.vehicleReg && (
                <div style={{fontSize:11,color:'#f5a623',marginTop:5,fontFamily:'monospace'}}>
                  ✓ Vehicle type auto-selected — check below and change if needed
                </div>
              )}
            </div>
          ) : (
            <div>
              <input
                value={driverInfo.vehicleReg}
                onChange={e=>setDriverInfo(p=>({...p,vehicleReg:normaliseReg(e.target.value)}))}
                placeholder='e.g. BK21XYZ'
                autoCapitalize='characters'
                style={{width:'100%',padding:'13px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(245,166,35,0.3)',borderRadius:14,color:'rgba(255,255,255,0.92)',fontSize:16,fontFamily:"'DM Sans',sans-serif",outline:'none',boxSizing:'border-box'}}/>
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
                style={{padding:'10px 6px',borderRadius:12,border:`1px solid ${driverInfo.vehicleType===v.id?'#f5a623':'rgba(255,255,255,0.09)'}`,background:driverInfo.vehicleType===v.id?'rgba(245,166,35,0.1)':'rgba(255,255,255,0.06)',display:'flex',flexDirection:'column',alignItems:'center',gap:4,cursor:'pointer'}}>
                <span style={{fontSize:18}}>{v.icon}</span>
                <span style={{fontSize:10,color:driverInfo.vehicleType===v.id?'#f5a623':'rgba(255,255,255,0.45)',textAlign:'center',lineHeight:1.2}}>{v.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Company code — pre-filled from history */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:13,color:'#8a9099',marginBottom:5}}>Company access code</div>
          <input
            value={driverInfo.clientId}
            onChange={e=>setDriverInfo(p=>({...p,clientId:e.target.value.toLowerCase().trim()}))}
            placeholder='Given by your manager'
            style={{width:'100%',padding:'13px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.09)',borderRadius:14,color:'rgba(255,255,255,0.92)',fontSize:16,fontFamily:"'DM Sans',sans-serif",outline:'none',boxSizing:'border-box'}}/>
        </div>

        {!ready && <div style={{fontSize:12,color:'#4a5260',textAlign:'center',marginBottom:10}}>All fields required to continue</div>}
        <button onClick={saveDriverInfo} disabled={!ready || duplicateChecking}
          style={{width:'100%',padding:18,background:(ready&&!duplicateChecking)?'#f5a623':'rgba(255,255,255,0.06)',border:'none',borderRadius:16,color:(ready&&!duplicateChecking)?'#000':'rgba(255,255,255,0.25)',fontWeight:700,fontSize:17,fontFamily:"'DM Sans',sans-serif",letterSpacing:'-0.2px',cursor:(ready&&!duplicateChecking)?'pointer':'default',boxShadow:(ready&&!duplicateChecking)?'0 6px 24px rgba(245,166,35,0.3)':'none',marginTop:8}}>
          {duplicateChecking ? 'Checking...' : isReturning ? 'Start shift →' : 'Get started →'}
        </button>
      </div>
    </div>
  )}

  // ── STALE SESSION ─────────────────────────────────────────────────────────
  if (setupDone && staleSession) return (
    <div style={{minHeight:'100vh',background:'#090b0d',color:'#e8eaed',fontFamily:'Barlow,sans-serif',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{width:'100%',maxWidth:380}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:28}}>
          <div style={{width:32,height:32,background:'#f5a623',clipPath:'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'}} />
          <div><div style={{fontSize:15,fontWeight:600}}>{driverInfo.name}</div><div style={{fontSize:11,color:'#4a5260',fontFamily:'monospace'}}>{driverInfo.vehicleReg}</div></div>
        </div>
        <div style={{padding:'18px',background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.25)',borderRadius:12,marginBottom:20}}>
          <div style={{fontSize:12,color:'#f59e0b',fontFamily:'monospace',fontWeight:700,marginBottom:6}}>SHIFT EXPIRED</div>
          <div style={{fontSize:15,color:'#e8eaed',fontWeight:500,marginBottom:3}}>Started {staleSession.startedAt}</div>
          <div style={{fontSize:13,color:'#8a9099'}}>{staleSession.hoursAgo} hours ago — automatically signed out</div>
          {staleSession.lastAlertTime&&<div style={{fontSize:12,color:'#f59e0b',marginTop:5}}>⚠ Last alert at {staleSession.lastAlertTime}</div>}
        </div>
        <div style={{fontSize:13,color:'#8a9099',marginBottom:20,lineHeight:1.6}}>Your previous shift has expired. Tap below to start fresh, or continue if you're on a trunking or overnight run.</div>
        <button onClick={() => clearSession('expired_new_shift')} style={{width:'100%',padding:'15px',background:'#f5a623',border:'none',borderRadius:10,color:'#000',fontWeight:700,fontSize:16,cursor:'pointer',marginBottom:10}}>Start new shift</button>
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
      <div style={{minHeight:'100vh',background:'#0a0a0f',color:'rgba(255,255,255,0.92)',fontFamily:"'DM Sans',-apple-system,sans-serif",paddingBottom:100,touchAction:'manipulation',position:'relative',zIndex:10}}>
        <div style={{padding:'56px 24px 20px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:'#f5a623',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:6}}>PRE-SHIFT</div>
              <div style={{fontSize:28,fontWeight:700,color:'rgba(255,255,255,0.92)',letterSpacing:'-0.6px'}}>Vehicle Check</div>
            </div>
            {view==='preshift'&&<button onClick={()=>setView('run')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.3)',fontSize:13,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Skip →</button>}
          </div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:'rgba(255,255,255,0.3)',marginBottom:20}}>{driverInfo.vehicleReg} · {VEHICLE_TYPES.find(v=>v.id===driverInfo.vehicleType)?.label||''}</div>
          {checks.map(check=>{
            const passed=preShiftChecks[check.id]; const failed=preShiftChecks[check.id]===false
            return (
              <div key={check.id} style={{display:'flex',alignItems:'center',gap:14,padding:'15px 18px',background:'rgba(255,255,255,0.05)',border:`1px solid ${failed?'rgba(255,69,58,0.2)':'rgba(255,255,255,0.07)'}`,borderRadius:16,marginBottom:8,cursor:'pointer',opacity:passed?0.65:1,transition:'opacity 0.2s'}}>
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>setPreShiftChecks(p=>({...p,[check.id]:true}))} style={{width:26,height:26,borderRadius:'50%',border:passed?'none':'2px solid rgba(255,255,255,0.15)',background:passed?'#f5a623':'transparent',color:passed?'#000':'rgba(255,255,255,0.3)',fontSize:13,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,touchAction:'manipulation',WebkitTapHighlightColor:'transparent'}}>{passed?'✓':''}</button>
                  <button onClick={()=>setPreShiftChecks(p=>({...p,[check.id]:false}))} style={{width:26,height:26,borderRadius:'50%',border:failed?'none':'2px solid rgba(255,255,255,0.15)',background:failed?'#ff453a':'transparent',color:failed?'#fff':'rgba(255,255,255,0.3)',fontSize:13,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,touchAction:'manipulation',WebkitTapHighlightColor:'transparent'}}>{failed?'✗':''}</button>
                </div>
                <span style={{fontSize:22,flexShrink:0}}>{check.icon}</span>
                <div style={{flex:1,fontSize:15,fontWeight:500,color:passed?'rgba(255,255,255,0.4)':failed?'#ff453a':'rgba(255,255,255,0.85)'}}>{check.label}</div>
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
                Override — depart without ops clearance
              </button>
            </div>
          )}
          {allChecked&&!defectBlocked&&(
            <button onClick={startShift} style={{width:'100%',padding:18,background:'#f5a623',border:'none',borderRadius:16,color:'#000',fontWeight:700,fontSize:17,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",boxShadow:'0 6px 24px rgba(245,166,35,0.3)',marginTop:16}}>
              ✓ Start shift
            </button>
          )}
          {!allChecked&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:'rgba(255,255,255,0.3)',textAlign:'center',marginTop:16,letterSpacing:'0.06em'}}>{Object.keys(preShiftChecks).length} of {checks.length} items checked</div>}
        </div>
      </div>
    )
  }

  // ── POST-SHIFT CHECK ──────────────────────────────────────────────────────
  if (showPostShift) {
    if (!shiftMileage && !shiftNotes) {
      try { const draft=JSON.parse(localStorage.getItem('dh_postshift_draft')||'{}'); if(draft.mileage)setShiftMileage(draft.mileage); if(draft.notes)setShiftNotes(draft.notes) } catch {}
    }
    return (
    <div style={{minHeight:'100vh',background:'#090b0d',color:'#e8eaed',fontFamily:'Barlow,sans-serif',paddingBottom:40}}>
      <div style={{padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        <div style={{fontSize:16,fontWeight:600}}>Return Check</div>
        <div style={{fontSize:12,color:'#4a5260',marginTop:2}}>Vehicle walkaround before handing back</div>
      </div>
      <div style={{padding:'20px 16px'}}>
        {POSTSHIFT_CHECKS.map(check=>{
          const passed=postShiftChecks[check.id]; const failed=postShiftChecks[check.id]===false
          return (
            <div key={check.id} style={{display:'flex',alignItems:'center',gap:12,padding:'14px',background:failed?'rgba(239,68,68,0.06)':passed?'rgba(245,166,35,0.04)':'#0f1826',border:`1px solid ${failed?'rgba(239,68,68,0.3)':passed?'rgba(245,166,35,0.2)':'rgba(255,255,255,0.06)'}`,borderRadius:10,marginBottom:8}}>
              <span style={{fontSize:22,flexShrink:0}}>{check.icon}</span>
              <div style={{flex:1,fontSize:15,color:failed?'#ef4444':passed?'#f5a623':'#e8eaed'}}>{check.label}</div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>setPostShiftChecks(p=>({...p,[check.id]:true}))} style={{width:44,height:44,borderRadius:8,border:`2px solid ${passed?'#f5a623':'rgba(245,166,35,0.3)'}`,background:passed?'rgba(245,166,35,0.15)':'transparent',color:passed?'#f5a623':'#4a5260',fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✓</button>
                <button onClick={()=>setPostShiftChecks(p=>({...p,[check.id]:false}))} style={{width:44,height:44,borderRadius:8,border:`2px solid ${failed?'#ef4444':'rgba(239,68,68,0.2)'}`,background:failed?'rgba(239,68,68,0.12)':'transparent',color:failed?'#ef4444':'#4a5260',fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✗</button>
              </div>
            </div>
          )
        })}
        <div style={{marginTop:16}}>
          <div style={{fontSize:13,color:mileageError?'#ef4444':'#8a9099',marginBottom:6,fontWeight:mileageError?600:400}}>
            Mileage at end of shift {mileageError&&'— required ⚠'}
          </div>
          <input value={shiftMileage} onChange={e=>{setShiftMileage(e.target.value);setMileageError(false);try{localStorage.setItem('dh_postshift_draft',JSON.stringify({mileage:e.target.value,notes:shiftNotes}))}catch{}}} placeholder='e.g. 48,320' inputMode='numeric'
            style={{width:'100%',padding:'12px',background:'linear-gradient(135deg,#0d1520,#0a1018)',border:`1px solid ${mileageError?'rgba(239,68,68,0.6)':'rgba(255,255,255,0.1)'}`,borderRadius:8,color:'#e8eaed',fontSize:15,outline:'none',boxSizing:'border-box',marginBottom:14,transition:'border 0.2s'}}/>
          <div style={{fontSize:13,color:'#8a9099',marginBottom:6}}>Shift notes (optional)</div>
          <textarea value={shiftNotes} onChange={e=>{setShiftNotes(e.target.value);try{localStorage.setItem('dh_postshift_draft',JSON.stringify({mileage:shiftMileage,notes:e.target.value}))}catch{}}} rows={3} placeholder='Any notes for ops — customer issues, delays, anything to flag...'
            style={{width:'100%',padding:'12px',background:'linear-gradient(135deg,#0d1520,#0a1018)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#e8eaed',fontSize:14,outline:'none',resize:'none',boxSizing:'border-box',lineHeight:1.6}}/>
        </div>
        {Object.values(postShiftChecks).some(v=>v===false)&&(
          <div style={{padding:'10px 12px',background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:7,marginTop:10,fontSize:12,color:'#ef4444'}}>⚠ Defects noted — ops will be informed in shift summary</div>
        )}
        <button onClick={submitEndShift} style={{width:'100%',padding:15,background:'#f5a623',border:'none',borderRadius:10,color:'#000',fontWeight:700,fontSize:16,cursor:'pointer',marginTop:18}}>
          ✓ Submit and end shift
        </button>
      </div>
    </div>
  )}

  // ── SHIFT SUMMARY ─────────────────────────────────────────────────────────
  if (shiftEnded && shiftSummary) return (
    <div style={{minHeight:'100vh',background:'#0a0a0f',color:'rgba(255,255,255,0.92)',fontFamily:"'DM Sans',-apple-system,sans-serif",display:'flex',alignItems:'center',justifyContent:'center',padding:'32px 24px'}}>
      <div style={{width:'100%',maxWidth:400}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{width:44,height:44,background:'#f5a623',clipPath:'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',margin:'0 auto 20px'}} />
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:'#f5a623',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:8}}>Shift Complete</div>
          <div style={{fontSize:28,fontWeight:700,color:'rgba(255,255,255,0.92)',letterSpacing:'-0.5px'}}>{driverInfo.name||'Driver'}</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:'rgba(255,255,255,0.3)',marginTop:6}}>Signed off {shiftSummary.endTime}</div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
          {[
            {val:shiftSummary.completed,  sub:'Delivered'},
            {val:shiftSummary.total,      sub:'Total runs'},
            {val:shiftSummary.incidents,  sub:'Incidents'},
            {val:shiftSummary.duration?`${shiftSummary.duration}m`:'—', sub:'Duration'},
          ].map((s,i)=>(
            <div key={i} style={{padding:'18px 16px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,textAlign:'center'}}>
              <div style={{fontSize:28,fontWeight:700,color:'rgba(255,255,255,0.92)',letterSpacing:'-0.5px',fontFamily:"'DM Sans',sans-serif"}}>{s.val}</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:'rgba(255,255,255,0.3)',letterSpacing:'0.1em',textTransform:'uppercase',marginTop:4}}>{s.sub}</div>
            </div>
          ))}
        </div>
        {shiftSummary.mileage&&<div style={{padding:'12px 14px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,marginBottom:8,fontSize:13,color:'rgba(255,255,255,0.45)'}}>Mileage: <span style={{color:'rgba(255,255,255,0.92)'}}>{shiftSummary.mileage}</span></div>}
        {shiftSummary.unresolved>0&&<div style={{padding:'12px 14px',background:'rgba(255,69,58,0.08)',border:'1px solid rgba(255,69,58,0.2)',borderRadius:12,marginBottom:8,fontSize:13,color:'#ff453a'}}>⚠ {shiftSummary.unresolved} unresolved job{shiftSummary.unresolved>1?'s':''} — ops notified</div>}
        {shiftSummary.notes&&<div style={{padding:'12px 14px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,marginBottom:8,fontSize:13,color:'rgba(255,255,255,0.45)'}}>Notes: <span style={{color:'rgba(255,255,255,0.92)'}}>{shiftSummary.notes}</span></div>}
        {shiftSummary.completed===shiftSummary.total&&<div style={{padding:'12px',background:'rgba(245,166,35,0.06)',border:'1px solid rgba(245,166,35,0.18)',borderRadius:12,textAlign:'center',marginBottom:12,fontSize:14,color:'#f5a623',fontWeight:600}}>✓ Full shift — all runs delivered</div>}
        <button onClick={()=>{['dh_driver_info','dh_shift_started','dh_shift_started_at','dh_last_alert','dh_prior_alert','dh_job_progress','dh_ops_messages','dh_ops_messages_read','dh_dismissed_notifications','dh_session_id'].forEach(k=>localStorage.removeItem(k));setSetupDone(false);setShiftStarted(false);setShiftEnded(false);setJobs([]);setActiveJob(null);setShiftSummary(null)}}
          style={{width:'100%',padding:18,background:'#f5a623',border:'none',borderRadius:16,color:'#000',fontWeight:700,fontSize:17,fontFamily:"'DM Sans',sans-serif",letterSpacing:'-0.2px',cursor:'pointer',boxShadow:'0 6px 24px rgba(245,166,35,0.3)',marginTop:8}}>
          Start New Shift
        </button>
      </div>
    </div>
  )

  // ── POD CONFIRMATION ──────────────────────────────────────────────────────
  if (podFlow) return (
    <>
      <div onClick={()=>setPodFlow(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(6px)',WebkitBackdropFilter:'blur(6px)',zIndex:300}}/>
      <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#0e0e12',borderTop:'1px solid rgba(245,166,35,0.2)',borderRadius:'24px 24px 0 0',padding:'0 0 40px',zIndex:301,fontFamily:"'DM Sans',-apple-system,sans-serif"}}>
        <div style={{position:'absolute',top:0,left:0,right:0,height:80,pointerEvents:'none',background:'radial-gradient(ellipse 60% 80px at 50% 0%,rgba(245,166,35,0.07),transparent)'}}/>
        <div style={{padding:'12px 0 0',display:'flex',justifyContent:'center'}}><div style={{width:36,height:5,borderRadius:3,background:'rgba(255,255,255,0.18)'}}/></div>
        <div style={{padding:'10px 24px 0',position:'relative',zIndex:1}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:'#f5a623',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:6}}>PROOF OF DELIVERY</div>
          <div style={{fontSize:26,fontWeight:700,color:'rgba(255,255,255,0.92)',letterSpacing:'-0.5px',marginBottom:4}}>Delivery Confirmation</div>
          <div style={{fontSize:14,color:'rgba(255,255,255,0.45)',marginBottom:24}}>How was the delivery confirmed?</div>
          {[
            {id:'signature',label:'✍ Signature obtained',sub:'Consignee signed POD'},
            {id:'photo',label:'📸 Photo evidence taken',sub:'Photographed at delivery point'},
            {id:'refused',label:'❌ Delivery refused',sub:'Consignee refused — reason logged'},
            {id:'safe_place',label:'📦 Safe place delivery',sub:'Left in agreed safe location'},
          ].map(opt=>(
            <button key={opt.id} onClick={()=>confirmDelivered(opt.id)}
              style={{width:'100%',marginBottom:8,padding:'14px 16px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.09)',borderRadius:14,cursor:'pointer',textAlign:'left',display:'flex',justifyContent:'space-between',alignItems:'center',fontFamily:"'DM Sans',sans-serif",WebkitTapHighlightColor:'transparent',transition:'background 0.15s'}}>
              <div>
                <div style={{fontSize:15,color:'rgba(255,255,255,0.92)',fontWeight:600}}>{opt.label}</div>
                <div style={{fontSize:12,color:'rgba(255,255,255,0.35)',marginTop:2}}>{opt.sub}</div>
              </div>
              <span style={{color:'#f5a623',fontSize:15,flexShrink:0}}>→</span>
            </button>
          ))}
          <button onClick={()=>setPodFlow(null)} style={{width:'100%',padding:12,background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:15,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",marginTop:4}}>Cancel</button>
        </div>
      </div>
    </>
  )

  // ── MAIN RUN VIEW ─────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:'100vh',background:'#090b0d',color:'#e8eaed',fontFamily:'Barlow,sans-serif',paddingBottom:90,paddingTop:'env(safe-area-inset-top, 0px)'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes dh-expand{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        .dh-sb-wrap{padding:13px 24px 0;height:56px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;z-index:10}
        .dh-time{font-size:17px;font-weight:600;color:rgba(255,255,255,0.92);letter-spacing:-0.3px;font-family:'DM Sans',-apple-system,sans-serif}
        .dh-synced{display:flex;align-items:center;gap:5px;font-family:'DM Mono',monospace;font-size:9px;color:#30d158;letter-spacing:0.1em}
        .dh-synced::before{content:'';width:5px;height:5px;border-radius:50%;background:#30d158;box-shadow:0 0 6px #30d158}
        .dh-more-btn{width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;cursor:pointer;color:rgba(255,255,255,0.4);font-size:16px;letter-spacing:2px;user-select:none;flex-shrink:0;-webkit-tap-highlight-color:transparent;font-family:monospace;padding-bottom:4px}
        .dh-more-pop{position:absolute;top:54px;right:0;background:#18181f;border:1px solid rgba(255,255,255,0.1);border-radius:14px;overflow:hidden;z-index:500;box-shadow:0 12px 40px rgba(0,0,0,0.7);min-width:190px}
        .dh-pop-item{display:flex;align-items:center;gap:12px;padding:13px 16px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.07);-webkit-tap-highlight-color:transparent;transition:background 0.1s}
        .dh-pop-item:last-child{border-bottom:none}
        .dh-pop-item:active{background:rgba(255,255,255,0.05)}
        .dh-greeting{font-family:'DM Sans',-apple-system,sans-serif;font-size:13px;color:rgba(255,255,255,0.48);margin-bottom:3px;padding:14px 24px 0;flex-shrink:0}
        .dh-driver-name{font-family:'DM Sans',-apple-system,sans-serif;font-size:26px;font-weight:700;color:rgba(255,255,255,0.92);letter-spacing:-0.7px;line-height:1;padding:0 24px;flex-shrink:0}
        .dh-pips-row{display:flex;align-items:center;gap:6px;padding:10px 24px 14px;flex-shrink:0}
        .dh-pip{width:26px;height:4px;border-radius:2px;background:rgba(255,255,255,0.08);flex-shrink:0}
        .dh-pip.done{background:#f5a623}
        .dh-pip.active{background:rgba(245,166,35,0.45)}
        .dh-pip-txt{font-family:'DM Mono',monospace;font-size:11px;color:rgba(255,255,255,0.24);letter-spacing:0.08em;margin-left:4px}
        .dh-job-card{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07);border-radius:22px;margin-bottom:10px;overflow:hidden;position:relative}
        .dh-job-card::before{content:'';position:absolute;top:0;left:24px;right:24px;height:1px;background:linear-gradient(to right,transparent,rgba(245,166,35,0.5),transparent)}
        .dh-job-top{padding:16px 18px 13px}
        .dh-job-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}
        .dh-job-ref{font-family:'DM Mono',monospace;font-size:12px;color:#f5a623;letter-spacing:0.05em;font-weight:500}
        .dh-status-pill{display:flex;align-items:center;gap:5px;font-family:'DM Mono',monospace;font-size:10px;font-weight:500;padding:4px 10px;border-radius:20px;letter-spacing:0.06em}
        .dh-pill-dot{width:5px;height:5px;border-radius:50%;background:currentColor;animation:pulse 2s infinite}
        .dh-job-from{font-family:'DM Sans',-apple-system,sans-serif;font-size:13px;color:rgba(255,255,255,0.48);margin-bottom:2px}
        .dh-job-dest{font-family:'DM Sans',-apple-system,sans-serif;font-size:21px;font-weight:700;color:rgba(255,255,255,0.92);letter-spacing:-0.5px;line-height:1.15;margin-bottom:9px}
        .dh-chips{display:flex;gap:6px;flex-wrap:wrap}
        .dh-chip{font-family:'DM Sans',-apple-system,sans-serif;font-size:11px;color:rgba(255,255,255,0.48);background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.07);padding:2px 8px;border-radius:7px}
        .dh-chip-warn{color:#ff453a;background:rgba(255,69,58,0.1);border-color:transparent}
        .dh-prog-row{display:flex;align-items:center;gap:6px;padding:10px 18px 12px;border-top:1px solid rgba(255,255,255,0.07)}
        .dh-pd{display:flex;align-items:center;gap:3px;font-family:'DM Mono',monospace;font-size:9px;color:rgba(255,255,255,0.24);letter-spacing:0.06em}
        .dh-pd.done{color:#f5a623}
        .dh-pd.active{color:rgba(255,255,255,0.9);font-weight:500}
        .dh-pd-dot{width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,0.1);flex-shrink:0}
        .dh-pd-dot.done{background:#f5a623}
        .dh-pd-dot.active{background:rgba(255,255,255,0.9)}
        .dh-pd-line{flex:1;height:1px;background:rgba(255,255,255,0.07)}
        .dh-pd-line.done{background:rgba(245,166,35,0.3)}
        .dh-cta{padding:18px 20px;background:#f5a623;border-radius:20px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;box-shadow:0 6px 28px rgba(245,166,35,0.3);border:none;width:100%;text-align:left;margin-bottom:12px;transition:transform 0.12s cubic-bezier(0.34,1.56,0.64,1);font-family:'DM Sans',-apple-system,sans-serif;-webkit-tap-highlight-color:transparent}
        .dh-cta:active{transform:scale(0.98)}
        .dh-cta-hint{font-size:10px;font-weight:600;color:rgba(0,0,0,0.4);letter-spacing:0.05em;text-transform:uppercase;margin-bottom:3px}
        .dh-cta-label{font-size:20px;font-weight:700;color:#000;letter-spacing:-0.4px;line-height:1.1}
        .dh-cta-arrow{width:40px;height:40px;background:rgba(0,0,0,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
        .dh-section{margin-bottom:7px;border-radius:14px;overflow:hidden;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07)}
        .dh-sec-toggle{display:flex;align-items:center;gap:12px;padding:13px 16px;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;transition:background 0.15s}
        .dh-sec-toggle:active{background:rgba(255,255,255,0.07)}
        .dh-sec-icon{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .dh-sec-title{font-family:'DM Sans',-apple-system,sans-serif;font-size:14px;font-weight:600;letter-spacing:-0.2px;flex:1}
        .dh-sec-count{font-family:'DM Mono',monospace;font-size:10px;color:rgba(255,255,255,0.24);letter-spacing:0.05em}
        .dh-sec-chev{font-size:11px;color:rgba(255,255,255,0.24);transition:transform 0.22s cubic-bezier(0.34,1.56,0.64,1);margin-left:4px}
        .dh-section.dh-open .dh-sec-chev{transform:rotate(180deg)}
        .dh-sec-body{display:none;border-top:1px solid rgba(255,255,255,0.07)}
        .dh-section.dh-open .dh-sec-body{display:block;animation:dh-expand 0.18s ease}
        .dh-up-item{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.07);cursor:pointer;-webkit-tap-highlight-color:transparent}
        .dh-up-item:last-child{border-bottom:none}
        .dh-up-item:active{background:rgba(255,255,255,0.04)}
        .dh-up-bar{width:3px;border-radius:2px;align-self:stretch;min-height:28px;flex-shrink:0}
        .dh-up-ref{font-family:'DM Mono',monospace;font-size:10px;color:rgba(255,255,255,0.24);margin-bottom:2px}
        .dh-up-route{font-family:'DM Sans',-apple-system,sans-serif;font-size:14px;font-weight:600;color:rgba(255,255,255,0.92);letter-spacing:-0.2px}
        .dh-up-sub{font-family:'DM Sans',-apple-system,sans-serif;font-size:12px;color:rgba(255,255,255,0.45);margin-top:1px}
        .dh-up-sp{font-family:'DM Mono',monospace;font-size:9px;font-weight:600;letter-spacing:0.08em;padding:2px 7px;border-radius:7px}
        .dh-rpt-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:10px}
        .dh-rpt-btn{padding:12px 11px;border-radius:11px;display:flex;flex-direction:column;align-items:flex-start;gap:3px;cursor:pointer;border:1px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.03);-webkit-tap-highlight-color:transparent;transition:background 0.15s}
        .dh-rpt-btn:active{background:rgba(255,255,255,0.07)}
        .dh-rpt-btn.dh-hl{background:rgba(245,166,35,0.1);border-color:rgba(245,166,35,0.22)}
        .dh-rpt-ico{font-size:18px;margin-bottom:1px}
        .dh-rpt-lbl{font-family:'DM Sans',-apple-system,sans-serif;font-size:12px;font-weight:600;color:rgba(255,255,255,0.9);letter-spacing:-0.1px;line-height:1.2}
        .dh-rpt-lbl.hl{color:#f5a623}
        .dh-rpt-sub{font-family:'DM Sans',-apple-system,sans-serif;font-size:10px;color:rgba(255,255,255,0.28);line-height:1.3}
        .dh-comp-item{display:flex;align-items:center;gap:12px;padding:11px 16px;opacity:0.5;border-bottom:1px solid rgba(255,255,255,0.07)}
        .dh-comp-item:last-child{border-bottom:none}
        .dh-comp-chk{width:20px;height:20px;border-radius:6px;background:rgba(245,166,35,0.1);display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;color:#f5a623}
        .dh-comp-ref{font-family:'DM Mono',monospace;font-size:10px;color:#f5a623;margin-bottom:1px}
        .dh-comp-route{font-family:'DM Sans',-apple-system,sans-serif;font-size:12px;font-weight:500;color:rgba(255,255,255,0.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .dh-comp-time{font-family:'DM Mono',monospace;font-size:10px;color:rgba(255,255,255,0.24);margin-left:auto}
        .dh-bottom-bar{position:fixed;bottom:0;left:0;right:0;padding:10px 16px;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 10px);background:linear-gradient(to bottom,transparent,rgba(10,10,15,0.99) 24%);display:grid;grid-template-columns:1fr 1fr;gap:8px;z-index:100}
        .dh-bar-btn{border-radius:18px;display:flex;align-items:center;cursor:pointer;overflow:hidden;position:relative;border:1px solid transparent;-webkit-tap-highlight-color:transparent;transition:transform 0.12s cubic-bezier(0.34,1.56,0.64,1)}
        .dh-bar-btn:active{transform:scale(0.96)}
        .dh-bar-btn.bd{background:linear-gradient(135deg,#ff3b30,#ff453a);box-shadow:0 5px 20px rgba(255,59,48,0.4);border-color:rgba(255,100,90,0.25)}
        .dh-bar-btn.bd::before{content:'';position:absolute;inset:0;background:linear-gradient(to bottom,rgba(255,255,255,0.1),transparent);pointer-events:none}
        .dh-bar-btn.md{background:linear-gradient(135deg,rgba(10,132,255,0.16),rgba(10,132,255,0.09));border-color:rgba(10,132,255,0.25);box-shadow:0 3px 14px rgba(10,132,255,0.12)}
        .dh-bar-btn.md::before{content:'';position:absolute;inset:0;background:linear-gradient(to bottom,rgba(255,255,255,0.05),transparent);pointer-events:none}
        .dh-bar-inner{display:flex;align-items:center;gap:9px;padding:14px 18px;width:100%;position:relative;z-index:1}
        .dh-bar-lbl{font-family:'DM Sans',-apple-system,sans-serif;font-size:14px;font-weight:700;letter-spacing:-0.2px;display:block}
        .dh-bar-sub{font-family:'DM Sans',-apple-system,sans-serif;font-size:10px;display:block;margin-top:1px;opacity:0.65}
        .dh-bar-btn.bd .dh-bar-lbl{color:#fff}
        .dh-bar-btn.bd .dh-bar-sub{color:rgba(255,255,255,0.7)}
        .dh-bar-btn.md .dh-bar-lbl{color:#0a84ff}
        .dh-bar-btn.md .dh-bar-sub{color:rgba(10,132,255,0.7)}
        @keyframes dh-banner-in{from{opacity:0;transform:translateY(-16px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes dh-toast-drain{from{width:100%}to{width:0%}}
        .dh-end-btn{width:100%;padding:12px;margin-top:6px;border-radius:12px;border:1px solid rgba(245,166,35,0.18);background:rgba(245,166,35,0.06);color:#f5a623;font-size:13px;font-weight:600;cursor:pointer;font-family:'DM Sans',-apple-system,sans-serif;letter-spacing:-0.1px;-webkit-tap-highlight-color:transparent}
      `}</style>

      {/* Toast */}
      {toast&&(
        <div style={{position:'fixed',top:58,left:16,right:16,background:'#1e1e26',border:'1px solid rgba(255,255,255,0.1)',borderRadius:18,padding:'13px 14px',display:'flex',alignItems:'center',gap:12,boxShadow:'0 10px 40px rgba(0,0,0,0.6)',zIndex:500,overflow:'hidden',fontFamily:"'DM Sans',-apple-system,sans-serif",animation:'dh-banner-in 0.35s cubic-bezier(0.34,1.56,0.64,1)'}}>
          <div style={{width:36,height:36,borderRadius:11,background:toast.type==='error'?'rgba(255,69,58,0.12)':'rgba(48,209,88,0.12)',border:`1px solid ${toast.type==='error'?'rgba(255,69,58,0.2)':'rgba(48,209,88,0.2)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,flexShrink:0}}>{toast.type==='error'?'⚠️':'✅'}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:700,color:'rgba(255,255,255,0.92)',marginBottom:1}}>{toast.msg}</div>
            {toast.sub&&<div style={{fontSize:11,color:'rgba(255,255,255,0.35)',fontFamily:"'DM Mono',monospace",letterSpacing:'0.04em'}}>{toast.sub}</div>}
          </div>
          <div style={{position:'absolute',bottom:0,left:0,height:2,background:'#f5a623',opacity:0.5,borderRadius:'0 2px 2px 0',animation:'dh-toast-drain 4s linear forwards'}}/>
        </div>
      )}

      {/* Undo bar */}
      {pendingUndo&&(
        <div style={{position:'fixed',top:58,left:16,right:16,background:'#1e1e26',border:'1px solid rgba(255,255,255,0.1)',borderRadius:18,padding:'13px 14px',display:'flex',alignItems:'center',gap:12,boxShadow:'0 10px 40px rgba(0,0,0,0.6)',zIndex:400,overflow:'hidden',fontFamily:"'DM Sans',-apple-system,sans-serif",animation:'dh-banner-in 0.35s cubic-bezier(0.34,1.56,0.64,1)'}}>
          <div style={{width:36,height:36,borderRadius:11,background:'rgba(48,209,88,0.12)',border:'1px solid rgba(48,209,88,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,flexShrink:0}}>📦</div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:700,color:'rgba(255,255,255,0.92)'}}>Marked as delivered</div>
          </div>
          <button onClick={undoDelivered} style={{padding:'7px 14px',background:'rgba(245,166,35,0.1)',border:'1px solid rgba(245,166,35,0.2)',borderRadius:10,fontSize:13,fontWeight:700,color:'#f5a623',cursor:'pointer',flexShrink:0,fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:6}}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="rgba(245,166,35,0.5)" strokeWidth="1.5"/><path d="M6 3v3l2 1.5" stroke="rgba(245,166,35,0.9)" strokeWidth="1.3" strokeLinecap="round"/></svg>
            Undo ({undoCountdown}s)
          </button>
          <div style={{position:'absolute',bottom:0,left:0,height:2,background:'#f5a623',opacity:0.5,borderRadius:'0 2px 2px 0',animation:'dh-toast-drain 5s linear forwards'}}/>
        </div>
      )}

      {/* Ops messages banner */}
      {opsMessages.length>0&&(
        <div style={{margin:'8px 14px 0',background:'#1e1e26',border:'1px solid rgba(255,255,255,0.09)',borderRadius:16,overflow:'hidden',boxShadow:'0 4px 20px rgba(0,0,0,0.4)'}}>
          <div style={{padding:'10px 14px 8px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,fontWeight:700,color:'#f5a623',letterSpacing:'0.12em'}}>OPS MESSAGE</div>
            <button onClick={()=>{const msg=opsMessages[opsMessages.length-1];if(msg){try{const read=JSON.parse(localStorage.getItem('dh_ops_messages_read')||'[]');read.push(msg);localStorage.setItem('dh_ops_messages_read',JSON.stringify(read));const dismissed=JSON.parse(localStorage.getItem('dh_dismissed_notifications')||'[]');dismissed.push('ops_'+msg.substring(0,40));localStorage.setItem('dh_dismissed_notifications',JSON.stringify(dismissed))}catch{}}setOpsMessages(prev=>prev.filter(m=>m!==msg))}} style={{background:'transparent',border:'none',color:'rgba(255,255,255,0.35)',fontSize:16,cursor:'pointer',padding:'0 2px',lineHeight:1}}>✕</button>
          </div>
          <div style={{padding:'0 14px 14px',fontSize:14,color:'rgba(255,255,255,0.8)',lineHeight:1.5,fontFamily:"'DM Sans',-apple-system,sans-serif"}}>{opsMessages[opsMessages.length-1]}</div>
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
        <div style={{fontFamily:"'DM Sans',-apple-system,sans-serif",paddingBottom:120}}>

          {/* ── STATUS BAR ── */}
          <div className="dh-sb-wrap">
            <div/>
            <div style={{display:'flex',alignItems:'center',gap:10,position:'relative'}}>
              <div className="dh-synced">SYNCED</div>
              <div className="dh-more-btn" onClick={()=>setShowMoreMenu(v=>!v)}>···</div>
              {showMoreMenu&&(
                <div className="dh-more-pop" style={{position:'absolute',top:42,right:0,left:'auto',minWidth:200,zIndex:500}}>
                  <div className="dh-pop-item" onClick={()=>{setShowMoreMenu(false);setView('preshift')}}>
                    <span style={{fontSize:17}}>🔍</span>
                    <div><div style={{fontSize:14,fontWeight:600,color:'rgba(255,255,255,0.9)'}}>Vehicle Check</div><div style={{fontSize:11,color:'rgba(255,255,255,0.3)',marginTop:1}}>Pre/post shift defects</div></div>
                  </div>
                  <div className="dh-pop-item" onClick={()=>{setShowMoreMenu(false);if(driverInfo.vehicleReg||driverInfo.phone){fetch('/api/driver/end-shift',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:driverInfo.clientId,vehicle_reg:driverInfo.vehicleReg||null,driver_phone:driverInfo.phone||null,reason:'driver_change'})}).catch(()=>{})};['dh_driver_info','dh_shift_started','dh_shift_started_at','dh_last_alert','dh_prior_alert','dh_job_progress','dh_ops_messages','dh_ops_messages_read','dh_session_id'].forEach(k=>localStorage.removeItem(k));setSetupDone(false);setShiftStarted(false);setJobs([]);setActiveJob(null)}}>
                    <span style={{fontSize:17}}>↩</span>
                    <div><div style={{fontSize:14,fontWeight:600,color:'rgba(255,255,255,0.9)'}}>Change Driver</div><div style={{fontSize:11,color:'rgba(255,255,255,0.3)',marginTop:1}}>Switch to different profile</div></div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="dh-greeting">{driverInfo.name||'Driver'}</div>
          <div className="dh-driver-name">{driverInfo.vehicleReg||''}</div>
          <div className="dh-pips-row">
            {jobs.map((j)=>(<div key={j.ref} className={'dh-pip'+(j.status==='completed'?' done':'')+(j.ref===activeJob?.ref&&j.status!=='completed'?' active':'')}/>))}
            {!loading&&jobs.length>0&&(<span className="dh-pip-txt">Run {jobs.filter(j=>j.status==='completed').length+1} of {jobs.length}</span>)}
          </div>

          {/* ── LAST ALERT BANNER ── */}
          {lastAlert&&(
            <div style={{margin:'10px 14px 0',borderRadius:12,overflow:'hidden',border:`1px solid ${SEV[lastAlert.severity]?.border||'rgba(245,158,11,0.35)'}`,background:SEV[lastAlert.severity]?.bg,boxShadow:'0 4px 20px rgba(0,0,0,0.3)'}}>
              <div onClick={reopenLastAlert} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',cursor:'pointer',padding:'10px 14px 9px',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                <div style={{display:'flex',gap:9,flex:1}}>
                  <span style={{fontSize:18,flexShrink:0}}>{SEV[lastAlert.severity]?.icon||'⚠️'}</span>
                  <div>
                    <div style={{fontSize:9,color:SEV[lastAlert.severity]?.color,fontFamily:'monospace',fontWeight:700,letterSpacing:'0.1em',marginBottom:2}}>LAST ALERT · {lastAlert.time}</div>
                    <div style={{fontSize:16,color:'#e8eaed',fontWeight:700,lineHeight:1.4}}>{lastAlert.headline}</div>
                    {lastAlert.actions?.[0]&&<div style={{fontSize:11,color:'#8a9099',marginTop:4}}>→ {lastAlert.actions[0]}</div>}
                  </div>
                </div>
                <div style={{fontSize:10,color:'#4a5260',flexShrink:0,marginLeft:8}}>Tap →</div>
              </div>
              {(lastAlert.issueId==='medical'||lastAlert.issueId==='driver_unwell')&&(
                <button onClick={async(e)=>{e.stopPropagation();try{await fetch('/api/driver/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:driverInfo.clientId,vehicle_reg:driverInfo.vehicleReg,driver_name:driverInfo.name,ref:activeJob?.ref||'MEDICAL',resolution:'Driver confirmed OK — resuming shift',original_issue:lastAlert.issueId})})}catch{}setLastAlert(null);localStorage.removeItem('dh_last_alert');showToast('Medical cleared — ops notified','ok')}} style={{margin:'0 14px 10px',width:'calc(100% - 28px)',padding:'10px',background:'rgba(245,166,35,0.1)',border:'1px solid rgba(245,166,35,0.3)',borderRadius:8,color:'#f5a623',fontWeight:600,fontSize:13,cursor:'pointer'}}>
                  ✅ I'm OK — Continue shift
                </button>
              )}
            </div>
          )}

          {/* ── PRIOR ALERT BANNER (e.g. breakdown preserved during medical) ── */}
          {priorAlert && (
            <div style={{margin:'6px 14px 0', padding:'9px 13px', background:SEV[priorAlert.severity]?.bg||'rgba(245,158,11,0.05)', border:`1px solid ${SEV[priorAlert.severity]?.border||'rgba(245,158,11,0.3)'}`, borderRadius:8, display:'flex', alignItems:'center', gap:8}}>
              <div onClick={()=>{ setPanelIssue({id:priorAlert.issueId, label:priorAlert.issueLabel}); setParsedResult(priorAlert); setPanelState('result'); setPanelOpen(true); setShowDetail(false) }} style={{flex:1, cursor:'pointer', display:'flex', gap:9, alignItems:'flex-start'}}>
                <span style={{fontSize:16, flexShrink:0}}>{SEV[priorAlert.severity]?.icon||'⚠️'}</span>
                <div>
                  <div style={{fontSize:9, color:SEV[priorAlert.severity]?.color, fontFamily:'monospace', fontWeight:700, letterSpacing:'0.1em', marginBottom:2}}>PRIOR · {priorAlert.issueLabel||'BREAKDOWN'} · {priorAlert.time}</div>
                  <div style={{fontSize:13, color:'#e8eaed', fontWeight:600, lineHeight:1.4}}>{priorAlert.headline}</div>
                </div>
              </div>
              <button onClick={resolvePriorAlert} style={{padding:'5px 10px', background:'transparent', border:'1px solid rgba(245,166,35,0.25)', borderRadius:6, color:'#f5a623', fontSize:11, fontWeight:600, cursor:'pointer', flexShrink:0}}>✅ Resolved</button>
            </div>
          )}

          {/* ── ACTIVE JOB CARD ── */}
          {activeJob&&activeJob.status!=='completed'?(()=>{
            const isAtRisk=activeJob.status==='at_risk'
            const sc=STATUS_COLORS[activeJob.status]||STATUS_COLORS['on-track']
            const skipCollection = activeJob.multi_collection===false && (activeJob.collection_sequence||1) > 1
            const jobSteps = skipCollection ? PROGRESS_STEPS.filter(s=>s.id!=='arrived_collection'&&s.id!=='loading_complete') : PROGRESS_STEPS
            const progressStatusValues = jobSteps.map(s=>s.status)
            const isInitialStatus = !activeJob.status||activeJob.status==='on-track'||activeJob.status==='pending'||activeJob.status==='delayed'||activeJob.status==='disrupted'||activeJob.status==='part_delivered'||(!progressStatusValues.includes(activeJob.status)&&activeJob.status!=='completed'&&activeJob.status!=='at_risk')
            const completedIndex = jobSteps.findIndex(s=>s.status===activeJob.status)
            let nextStepIndex
            if (completedIndex >= 0) {
              nextStepIndex = completedIndex + 1
            } else if (isInitialStatus) {
              nextStepIndex = 0
            } else {
              nextStepIndex = jobSteps.length
            }
            const currentStepIndex = nextStepIndex
            const currentStep = nextStepIndex < jobSteps.length ? jobSteps[nextStepIndex] : null
            const prevStep = nextStepIndex > 0 ? jobSteps[nextStepIndex - 1] : null
            const [routeFrom,routeTo]=(activeJob.route||'').split('→').map(s=>s?.trim())
            return (
              <div style={{padding:'0 14px'}}>
                <div className="dh-job-card">
                  <div className="dh-job-top">
                    <div className="dh-job-row">
                      <span className="dh-job-ref">{activeJob.ref}</span>
                      <div className="dh-status-pill" style={{color:sc.dot,background:`${sc.dot}20`,border:`1px solid ${sc.dot}33`}}><div className="dh-pill-dot"/>{sc.label}</div>
                    </div>
                    {routeFrom&&<div className="dh-job-from">{routeFrom}</div>}
                    <div className="dh-job-dest">{routeTo||activeJob.route}</div>
                    <div className="dh-chips">
                      {activeJob.cargo_type&&<span className="dh-chip">{cargoIcon(activeJob.cargo_type)} {activeJob.cargo_type}</span>}
                      {activeJob.sla_window&&<span className="dh-chip">Slot {formatSlot(activeJob.sla_window)||activeJob.sla_window}</span>}
                      {activeJob.penalty_if_breached>0&&<span className={`dh-chip${activeJob.status==='at_risk'?' dh-chip-warn':''}`}>£{activeJob.penalty_if_breached.toLocaleString()} if late</span>}
                    </div>
                  </div>
                  {!isAtRisk&&(
                    <div className="dh-prog-row">
                      {(()=>{const SHORT={arrived_collection:'Collection',loading_complete:'Loaded',arrived_delivery:'Customer'};return jobSteps.map((step,i)=>{const isDone=currentStepIndex>i;const isCurr=step.status===activeJob.status||(activeJob.status==='on-track'&&i===0)||(activeJob.status==='pending'&&i===0);return(<React.Fragment key={step.id}><div className={`dh-pd${isDone?' done':isCurr?' active':''}`}><div className={`dh-pd-dot${isDone?' done':isCurr?' active':''}`}/>{SHORT[step.id]||step.label.split(' ')[0]}</div>{i<jobSteps.length-1&&<div className={`dh-pd-line${isDone?' done':''}`}/>}</React.Fragment>)})})()}
                      <div className="dh-pd-line"/><div className="dh-pd"><div className="dh-pd-dot"/>Deliver</div>
                    </div>
                  )}
                </div>
                {!isAtRisk&&(
                  <>
                    {prevStep&&currentStepIndex>0&&(
                      <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 2px 4px',opacity:0.38}}>
                        <span style={{fontSize:12,color:'#f5a623'}}>✓</span>
                        <span style={{fontSize:12,color:'#f5a623',fontWeight:500,flex:1}}>{prevStep.label}</span>
                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:'rgba(255,255,255,0.24)'}}>done</span>
                      </div>
                    )}
                    {currentStep?(
                      <button className="dh-cta" onClick={()=>logProgress(currentStep)}><div><div className="dh-cta-hint">Tap to confirm</div><div className="dh-cta-label">{currentStep.label}</div></div><div className="dh-cta-arrow">→</div></button>
                    ):(
                      <button className="dh-cta" onClick={initiateDelivered}><div><div className="dh-cta-hint">All steps complete</div><div className="dh-cta-label">Mark as Delivered</div></div><div className="dh-cta-arrow">📦</div></button>
                    )}
                  </>
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
                          style={{width:'100%',padding:'13px',borderRadius:9,border:'1px solid rgba(245,166,35,0.28)',background:'rgba(245,166,35,0.04)',color:'#f5a623',fontSize:14,fontWeight:500,cursor:'pointer',marginBottom:8}}>
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
                          }} style={{flex:1,padding:'11px',borderRadius:8,border:'none',background:'#f5a623',color:'#000',fontWeight:700,fontSize:13,cursor:'pointer'}}>
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
            <div style={{margin:'10px 12px 0',padding:'22px 18px',borderRadius:12,background:'rgba(245,166,35,0.04)',border:'1px solid rgba(245,166,35,0.18)',textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:8}}>🎉</div>
              <div style={{fontSize:19,fontWeight:700,color:'#f5a623',marginBottom:5}}>All runs complete</div>
              <div style={{fontSize:13,color:'#8a9099',marginBottom:20}}>{jobs.length} run{jobs.length!==1?'s':''} delivered today.</div>
              <button onClick={endShift} style={{width:'100%',padding:'15px',background:'#f5a623',border:'none',borderRadius:10,color:'#000',fontWeight:700,fontSize:16,cursor:'pointer',marginBottom:10}}>✓ End shift</button>
              <div style={{fontSize:11,color:'#4a5260'}}>Vehicle return check and shift summary</div>
            </div>
          )}

          {/* ── COLLAPSIBLE SECTIONS ── */}
          <div style={{padding:'4px 14px 0'}}>
          {/* UP NEXT */}
          {jobs.filter(j=>j.status!=='completed'&&j.ref!==activeJob?.ref).length>0&&(
            <div className={`dh-section${secUpNext?' dh-open':''}`}>
              <div className="dh-sec-toggle" onClick={()=>setSecUpNext(v=>!v)}>
                <div className="dh-sec-icon" style={{background:'rgba(245,166,35,0.08)'}}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#f5a623" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="4" cy="8" r="1.5" fill="#f5a623" stroke="none"/><circle cx="12" cy="8" r="1.5" fill="rgba(245,166,35,0.4)" stroke="none"/><line x1="5.5" y1="8" x2="10.5" y2="8"/><polyline points="9,5.5 12,8 9,10.5"/></svg></div>
                <span className="dh-sec-title" style={{color:'rgba(255,255,255,0.9)'}}>Up Next</span>
                <span className="dh-sec-count">{jobs.filter(j=>j.status!=='completed'&&j.ref!==activeJob?.ref).length} runs</span>
                <span className="dh-sec-chev">▾</span>
              </div>
              <div className="dh-sec-body">
              {jobs.filter(j=>j.status!=='completed'&&j.ref!==activeJob?.ref).map(job=>{
                const sc = STATUS_COLORS[job.status]||STATUS_COLORS['on-track']
                const isAtRisk = job.status==='at_risk'||job.status==='part_delivered'
                return (
                  <div key={job.ref} className="dh-up-item" onClick={()=>setActiveJob(job)}>
                    <div className="dh-up-bar" style={{background:sc.dot}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div className="dh-up-ref">{job.ref}</div>
                      <div className="dh-up-route">{job.route}</div>
                      {job.cargo_type&&<div className="dh-up-sub">{cargoIcon(job.cargo_type)} {job.cargo_type}{job.penalty_if_breached>0&&isAtRisk?` · £${job.penalty_if_breached.toLocaleString()} at risk`:''}</div>}
                    </div>
                    <span className="dh-up-sp" style={{color:sc.dot,background:`${sc.dot}18`}}>{sc.label}</span>
                  </div>
                )
              })}
              </div>
            </div>
          )}

          {/* COMPLETED */}
          {jobs.filter(j=>j.status==='completed').length>0&&(
            <div className={`dh-section${secCompleted?' dh-open':''}`}>
              <div className="dh-sec-toggle" onClick={()=>setSecCompleted(v=>!v)}>
                <div className="dh-sec-icon" style={{background:'rgba(245,166,35,0.06)'}}>✓</div>
                <span className="dh-sec-title" style={{color:'rgba(255,255,255,0.4)'}}>Completed</span>
                <span className="dh-sec-count">{jobs.filter(j=>j.status==='completed').length} done</span>
                <span className="dh-sec-chev">▾</span>
              </div>
              <div className="dh-sec-body">
                {jobs.filter(j=>j.status==='completed').map(job=>(
                  <div key={job.ref} className="dh-comp-item">
                    <div className="dh-comp-chk">✓</div>
                    <div style={{flex:1,minWidth:0}}><div className="dh-comp-ref">{job.ref}</div><div className="dh-comp-route">{job.route}</div></div>
                    <span className="dh-comp-time">✓ DONE</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REPORT AN ISSUE */}
          {jobs.some(j=>j.status!=='completed')&&(
            <div className={`dh-section${secReport?' dh-open':''}`}>
              <div className="dh-sec-toggle" onClick={()=>setSecReport(v=>!v)}>
                <div className="dh-sec-icon" style={{background:'rgba(255,69,58,0.08)'}}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="rgba(255,69,58,0.75)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6"/><line x1="8" y1="5" x2="8" y2="8.5"/><circle cx="8" cy="11" r="0.75" fill="rgba(255,69,58,0.75)" stroke="none"/></svg>
                </div>
                <span className="dh-sec-title" style={{color:'rgba(255,255,255,0.6)'}}>Report an Issue</span>
                <span className="dh-sec-count"></span>
                <span className="dh-sec-chev">▾</span>
              </div>
              <div className="dh-sec-body">
                {ISSUE_GROUPS.map((group,gi)=>(
                  <div key={group.id} style={{borderBottom:gi<ISSUE_GROUPS.length-1?'1px solid rgba(255,255,255,0.06)':'none'}}>
                    <div onClick={()=>setRptOpen(prev=>({...prev,[group.id]:!prev[group.id]}))} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',cursor:'pointer',WebkitTapHighlightColor:'transparent',userSelect:'none'}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:group.color,flexShrink:0,opacity:0.8}}/>
                      <span style={{flex:1,fontSize:13,fontWeight:600,color:group.color,fontFamily:"'DM Mono',monospace",letterSpacing:'0.08em',textTransform:'uppercase'}}>{group.label}</span>
                      <span style={{fontSize:11,color:'rgba(255,255,255,0.24)',transition:'transform 0.22s ease',display:'inline-block',transform:rptOpen[group.id]?'rotate(180deg)':'none'}}>▾</span>
                    </div>
                    {rptOpen[group.id]&&(
                      <div className="dh-rpt-grid" style={{padding:'0 10px 12px'}}>
                        {group.issues.map(issue=>{
                          const alertActive=!!lastAlert||panelState==='sent'||panelState==='result'||panelState==='resolving_loading'
                          const isDelay=issue.id==='delayed'
                          return (
                            <button key={issue.id} onClick={()=>{if(alertActive)return;if(isDelay){setRunningLateModal(true)}else{openIssue(issue)}}} disabled={alertActive}
                              className={`dh-rpt-btn${isDelay?' dh-hl':''}`} style={{opacity:alertActive?0.4:1}}>
                              <span className="dh-rpt-ico">{issue.icon}</span>
                              <span className={`dh-rpt-lbl${isDelay?' hl':''}`}>{isDelay?'Report Delay':issue.label}</span>
                              <span className="dh-rpt-sub">{issue.placeholder?issue.placeholder.split('?')[0].substring(0,28):issue.note?issue.note.substring(0,28):''}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* END SHIFT */}
          {jobs.length>0&&(
            <button className="dh-end-btn" onClick={endShift}>
              {'✓ End Shift'}
            </button>
          )}
          </div>

        </div>
      )}

      {/* FAILED DELIVERY HOLDING PANEL */}
      {failedDeliveryHold && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
          <div style={{maxWidth:380,width:'100%',background:'#0a0c0e',border:'1px solid rgba(239,68,68,0.25)',borderRadius:12,padding:'32px 24px',textAlign:'center'}}>
            <div style={{fontSize:32,marginBottom:12}}>📋</div>
            <div style={{fontSize:16,fontWeight:600,color:'#e8eaed',marginBottom:16}}>Delivery could not be completed</div>
            <div style={{textAlign:'left',fontSize:13,color:'#8a9099',lineHeight:1.8,marginBottom:20}}>
              <div style={{marginBottom:8}}>What to do now:</div>
              <div>1. Retain all paperwork and note the reason</div>
              <div>2. Ops have been notified — await instructions before leaving the site</div>
              <div>3. Do not reattempt without ops confirmation</div>
            </div>
            <div style={{fontFamily:'monospace',fontSize:10,color:'#f59e0b',letterSpacing:'0.08em',marginBottom:16}}>WAITING FOR OPS INSTRUCTIONS...</div>
            <button onClick={()=>{try{const dismissed=JSON.parse(localStorage.getItem('dh_dismissed_notifications')||'[]');dismissed.push('fdh_'+activeJob?.ref+'_'+Date.now());localStorage.setItem('dh_dismissed_notifications',JSON.stringify(dismissed))}catch{};setFailedDeliveryHold(null)}} style={{padding:'10px 24px',background:'transparent',border:'1px solid rgba(255,255,255,0.12)',borderRadius:6,color:'#8a9099',fontSize:12,cursor:'pointer'}}>Dismiss</button>
          </div>
        </div>
      )}

      {/* RUNNING LATE MODAL */}
      {runningLateModal&&(<>
        <div onClick={()=>setRunningLateModal(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(6px)',WebkitBackdropFilter:'blur(6px)',zIndex:300}}/>
        <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#0e0e12',borderTop:'1px solid rgba(245,166,35,0.2)',borderRadius:'24px 24px 0 0',padding:'0 0 40px',zIndex:301,fontFamily:"'DM Sans',-apple-system,sans-serif"}}>
          <div style={{position:'absolute',top:0,left:0,right:0,height:80,pointerEvents:'none',background:'radial-gradient(ellipse 60% 80px at 50% 0%,rgba(245,166,35,0.07),transparent)'}}/>
          <div style={{padding:'12px 0 0',display:'flex',justifyContent:'center'}}><div style={{width:36,height:5,borderRadius:3,background:'rgba(255,255,255,0.18)'}}/></div>
          <div style={{padding:'10px 24px 0',position:'relative',zIndex:1}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:500,color:'#f5a623',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:6}}>⏱ Report Delay</div>
            <div style={{fontSize:30,fontWeight:700,color:'rgba(255,255,255,0.92)',letterSpacing:'-0.8px',marginBottom:4}}>How Late?</div>
            <div style={{fontSize:14,color:'rgba(255,255,255,0.45)',marginBottom:24}}>Ops will be notified and SLA assessed</div>

            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:'rgba(255,255,255,0.3)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:8}}>Minutes late</div>
            <div style={{display:'flex',gap:8,marginBottom:20}}>
              {['10','20','30','45','60'].map(m=>(
                <button key={m} onClick={()=>setLateMinutes(m)} style={{flex:1,padding:'13px 4px',borderRadius:12,background:lateMinutes===m?'rgba(245,166,35,0.15)':'rgba(255,255,255,0.05)',border:lateMinutes===m?'1px solid rgba(245,166,35,0.35)':'1px solid rgba(255,255,255,0.08)',color:lateMinutes===m?'#f5a623':'rgba(255,255,255,0.45)',fontSize:15,fontWeight:700,cursor:'pointer',textAlign:'center',fontFamily:"'DM Sans',sans-serif",transition:'all 0.15s'}}>{m==='60'?'60+':m}</button>
              ))}
            </div>

            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:'rgba(255,255,255,0.3)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:8}}>Reason</div>
            <div style={{marginBottom:20}}>
              <select value={lateReason} onChange={e=>setLateReason(e.target.value)} style={{width:'100%',padding:14,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:14,color:lateReason?'rgba(255,255,255,0.92)':'rgba(255,255,255,0.3)',fontSize:15,outline:'none',fontFamily:"'DM Sans',sans-serif",appearance:'none',WebkitAppearance:'none',cursor:'pointer'}}>
                <option value="">Select reason...</option>
                <option value="Traffic">Traffic</option>
                <option value="Roadworks">Roadworks</option>
                <option value="Customer delay">Customer delay</option>
                <option value="Loading delay">Loading delay</option>
                <option value="Vehicle issue">Vehicle issue</option>
                <option value="Weather">Weather</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {activeJob?.penalty_if_breached>0&&lateMinutes&&(
              <div style={{padding:'12px 14px',background:'rgba(255,69,58,0.08)',border:'1px solid rgba(255,69,58,0.2)',borderRadius:12,marginBottom:20,fontSize:13,color:'#ff453a',lineHeight:1.5}}>
                ⚠ {lateMinutes}{lateMinutes==='60'?'+':''} min delay — £{activeJob.penalty_if_breached.toLocaleString()} penalty exposure
              </div>
            )}

            <button disabled={!lateMinutes||!lateReason} onClick={async()=>{
              const mins=parseInt(lateMinutes,10)||0
              if(!mins){showToast('Enter minutes','error');return}
              try{
                const sid=typeof window!=='undefined'?localStorage.getItem('dh_session_id'):null
                const alertBody={client_id:driverInfo.clientId,driver_name:driverInfo.name,driver_phone:driverInfo.phone||null,vehicle_reg:driverInfo.vehicleReg,ref:activeJob?.ref||null,session_id:sid,issue_type:'running_late',delay_minutes:mins,reason:lateReason,issue_description:`DRIVER RUNNING LATE. ${driverInfo.name} (${driverInfo.vehicleReg}). ${mins} minutes. Reason: ${lateReason}. Job: ${activeJob?.route||'?'}.`,human_description:`Running ${mins}min late — ${lateReason}`,location_description:gpsDescription||null,latitude:gpsCoords?.latitude||null,longitude:gpsCoords?.longitude||null}
                console.log('[running-late] submitting with:',{vehicleReg:driverInfo.vehicleReg,clientId:driverInfo.clientId,driverName:driverInfo.name,driverPhone:driverInfo.phone,sessionId:sid,delayMinutes:mins,reason:lateReason,ref:activeJob?.ref})
                let res
                try{
                  res=await fetch('/api/driver/alert',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(alertBody)})
                }catch(fetchErr){console.error('[running-late] fetch threw:',fetchErr.message);showToast('Network error — check connection','error');return}
                console.log('[running-late] response status:',res.status)
                if(!res.ok){const errText=await res.text().catch(()=>'');console.error('[running-late] server error:',res.status,errText);showToast('Failed to report delay — try again','error');return}
                const data=await res.json()
                console.log('[running-late] response data:',data)
                if(data.error){console.error('[running-late] API error:',data.error);showToast(data.error,'error');return}
                setRunningLateModal(false);setLateMinutes('');setLateReason('Traffic')
                showToast(data.severity==='LOW'?'Delay logged':data.sms_sent?'Delay reported — ops notified':'Delay reported','ok')
              }catch(e){console.error('[running-late] outer exception:',e);showToast('Network error — try again','error')}
            }} style={{width:'100%',padding:18,background:lateMinutes&&lateReason?'#f5a623':'rgba(255,255,255,0.06)',border:'none',borderRadius:16,color:lateMinutes&&lateReason?'#000':'rgba(255,255,255,0.2)',fontWeight:700,fontSize:17,cursor:lateMinutes&&lateReason?'pointer':'default',marginBottom:10,fontFamily:"'DM Sans',sans-serif",letterSpacing:'-0.2px',boxShadow:lateMinutes&&lateReason?'0 6px 24px rgba(245,166,35,0.3)':'none',transition:'all 0.2s'}}>
              {lateMinutes?`⏱ Report ${lateMinutes==='60'?'60+':lateMinutes}-min Delay`:'Select minutes to continue'}
            </button>
            <button onClick={()=>setRunningLateModal(false)} style={{width:'100%',padding:12,background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:15,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
          </div>
        </div>
      </>)}

      {/* BOTTOM BAR */}
      {(()=>{
        const alertActive = !!lastAlert||panelState==='sent'||panelState==='result'||panelState==='resolving_loading'
        return (
          <div className="dh-bottom-bar">
            {alertActive?(<>
              <button onClick={reopenLastAlert} style={{width:'100%',padding:'14px 16px',background:'rgba(255,69,58,0.08)',border:'1px solid rgba(255,69,58,0.2)',borderRadius:16,color:'#ff453a',fontWeight:600,fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',gap:6,fontFamily:"'DM Sans',sans-serif",cursor:'pointer'}}>⚠ Alert active — tap to resolve</button>
              <button onClick={()=>openIssue({id:'medical',label:'Medical Emergency',icon:'🚑',needsText:false})} className="dh-bar-btn md" style={{border:'none',cursor:'pointer'}}><div className="dh-bar-inner"><span style={{fontSize:20}}>🚑</span><div><span className="dh-bar-lbl">Medical</span><span className="dh-bar-sub">Emergency alert</span></div></div></button>
            </>):(<>
              <button onClick={()=>openIssue({id:'breakdown',label:'Breakdown',icon:'🚨',needsText:true,placeholder:'What happened?'})} className="dh-bar-btn bd" style={{border:'none',cursor:'pointer'}}><div className="dh-bar-inner"><span style={{fontSize:20}}>🚨</span><div><span className="dh-bar-lbl">Breakdown</span><span className="dh-bar-sub">Alert ops now</span></div></div></button>
              <button onClick={()=>openIssue({id:'medical',label:'Medical Emergency',icon:'🚑',needsText:false})} className="dh-bar-btn md" style={{border:'none',cursor:'pointer'}}><div className="dh-bar-inner"><span style={{fontSize:20}}>🚑</span><div><span className="dh-bar-lbl">Medical</span><span className="dh-bar-sub">Emergency alert</span></div></div></button>
            </>)}
          </div>
        )
      })()}

      {/* ISSUE PANEL */}
      {panelOpen&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:200,display:'flex',alignItems:'flex-end'}}>
          <div style={{width:'100%',background:'#0f1117',borderRadius:'20px 20px 0 0',maxHeight:'90vh',overflowY:'auto',padding:'20px 16px 36px',borderTop:`2px solid ${['breakdown','accident','vehicle_theft','theft_threat','cant_complete'].includes(panelIssue?.id)?'#ef4444':panelIssue?.id==='medical'||panelIssue?.id==='driver_unwell'?'#3b82f6':'#f5a623'}`}}>
            <div style={{display:'flex',justifyContent:'center',marginBottom:12,marginTop:-8}}><div style={{width:36,height:4,borderRadius:2,background:'rgba(255,255,255,0.15)'}}/></div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div>
                <div style={{fontSize:9,color:'#4a5260',fontFamily:'monospace',letterSpacing:'0.1em',marginBottom:4}}>ISSUE REPORT</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:900,textTransform:'uppercase',letterSpacing:'0.03em',color:'#fff'}}>{panelIssue?.icon} {panelIssue?.label}</div>
              </div>
              <button onClick={closePanel} style={{width:34,height:34,borderRadius:8,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',color:'#8a9099',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>

            {/* GPS status */}
            {gpsStatus==='getting'&&<div style={{fontSize:11,color:'#3b82f6',fontFamily:'monospace',marginBottom:10}}>📍 Getting location...</div>}
            {gpsStatus==='got'&&gpsDescription&&<div style={{fontSize:11,color:gpsCoords?.timestamp&&(Date.now()-gpsCoords.timestamp)<300000?'#22c55e':'#f5a623',fontFamily:'monospace',marginBottom:10}}>📍 {gpsDescription}{gpsCoords?.timestamp&&(Date.now()-gpsCoords.timestamp)<300000?' · location captured':''}</div>}
            {gpsStatus==='failed'&&!gpsCoords&&<div style={{fontSize:11,color:'#f59e0b',fontFamily:'monospace',marginBottom:10}}>⚠ Location not confirmed</div>}
            {gpsStatus==='failed'&&gpsCoords&&<div style={{fontSize:11,color:'#f5a623',fontFamily:'monospace',marginBottom:10}}>📍 Using last known location</div>}

            {/* Passenger count — PSV/coach only */}
            {(driverInfo?.sector==='psv'||driverInfo?.sector==='coach')&&panelState==='idle'&&(
              <div style={{marginBottom:12}}>
                <label style={{display:'block',fontSize:12,color:'#9ca3af',marginBottom:6,fontFamily:"'DM Mono',monospace",textTransform:'uppercase',letterSpacing:0.5}}>Passengers on board</label>
                <input type="number" inputMode="numeric" pattern="[0-9]*" min="0" max="120" placeholder="e.g. 38" value={passengerCount} onChange={e=>setPassengerCount(e.target.value)}
                  style={{width:'100%',padding:'10px 12px',background:'rgba(245,166,35,0.05)',border:'1px solid rgba(245,166,35,0.3)',borderRadius:8,color:'#fff',fontSize:16,fontFamily:"'DM Sans',sans-serif",boxSizing:'border-box'}}/>
              </div>
            )}

            {/* Prior alert (e.g. breakdown) preserved when medical triggers */}
            {panelIssue?.id==='medical' && priorAlert && (
              <div style={{marginBottom:13, border:`1px solid ${SEV[priorAlert.severity]?.border||'rgba(245,158,11,0.35)'}`, borderRadius:9, background:SEV[priorAlert.severity]?.bg||'rgba(245,158,11,0.05)', overflow:'hidden'}}>
                <button onClick={()=>setPriorAlertExpanded(v=>!v)} style={{width:'100%', padding:'11px 13px', background:'transparent', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', textAlign:'left'}}>
                  <span style={{fontSize:13, color:'#e8eaed', fontWeight:600}}>{priorAlertExpanded?'▼':'▶'} {priorAlert.issueLabel||'Breakdown'} instructions — tap to review</span>
                  <span style={{fontSize:10, color:SEV[priorAlert.severity]?.color, fontFamily:'monospace', fontWeight:700}}>{priorAlert.time}</span>
                </button>
                {priorAlertExpanded && (
                  <div style={{padding:'0 13px 13px', borderTop:'1px solid rgba(255,255,255,0.05)'}}>
                    <div style={{fontSize:14, color:'#e8eaed', fontWeight:600, lineHeight:1.4, margin:'10px 0 8px'}}>{priorAlert.headline}</div>
                    {priorAlert.actions && priorAlert.actions.length>0 && (
                      <div style={{marginBottom:10}}>
                        {priorAlert.actions.map((action,i)=>(
                          <div key={i} style={{display:'flex', gap:9, marginBottom:6, padding:'9px 11px', background:'rgba(0,0,0,0.25)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, alignItems:'flex-start'}}>
                            <div style={{width:20, height:20, borderRadius:'50%', background:'rgba(255,255,255,0.08)', color:'#8a9099', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0, marginTop:1}}>{i+1}</div>
                            <div style={{fontSize:13, color:'#e8eaed', lineHeight:1.5}}>{action}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={resolvePriorAlert} style={{width:'100%', padding:'11px', background:'transparent', border:'1px solid rgba(245,166,35,0.28)', borderRadius:8, color:'#f5a623', fontWeight:500, fontSize:13, cursor:'pointer'}}>
                      ✅ Mark {priorAlert.issueLabel||'breakdown'} resolved
                    </button>
                  </div>
                )}
              </div>
            )}

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
                  <button onClick={closePanel} style={{width:'100%',padding:14,background:'#f5a623',border:'none',borderRadius:12,color:'#000',fontWeight:800,fontSize:16,cursor:'pointer',marginBottom:9,fontFamily:"'Barlow Condensed',sans-serif",textTransform:'uppercase'}}>Got it — close</button>
                  {panelIssue?.id==='breakdown'&&(
                    <div style={{marginTop:12,marginBottom:12,padding:14,background:'rgba(245,166,35,0.06)',border:'1px solid rgba(245,166,35,0.2)',borderRadius:14}}>
                      <div style={{fontSize:13,fontWeight:700,color:'#f5a623',marginBottom:10,fontFamily:"'Barlow Condensed',sans-serif",textTransform:'uppercase',letterSpacing:0.5}}>🔧 Recovery engineer status</div>
                      <div style={{fontSize:11,color:'#4a5260',marginBottom:12}}>Tap when engineer arrives and gives assessment.</div>
                      {[
                        {id:'fixable_roadside',label:'✅ Fixable roadside',sub:'Engineer fixing on scene'},
                        {id:'replacement_needed',label:'🚛 Replacement vehicle needed',sub:'Load needs another truck — ops notified'},
                        {id:'tow_only',label:'🏗 Tow only — vehicle dead',sub:'Driver needs onward transport — ops notified'},
                      ].map(opt=>(
                        <button key={opt.id} onClick={()=>sendEngineerStatus(opt.id,opt.label)} disabled={engineerStatusSent===opt.id}
                          style={{width:'100%',marginBottom:7,padding:'12px 13px',background:engineerStatusSent===opt.id?'rgba(245,166,35,0.15)':'rgba(255,255,255,0.03)',border:'1px solid '+(engineerStatusSent===opt.id?'#f5a623':'rgba(255,255,255,0.07)'),borderRadius:10,cursor:engineerStatusSent===opt.id?'default':'pointer',textAlign:'left',display:'flex',justifyContent:'space-between',alignItems:'center',opacity:engineerStatusSent&&engineerStatusSent!==opt.id?0.4:1}}>
                          <div><div style={{fontSize:14,color:'#e8eaed',fontWeight:500}}>{opt.label}</div><div style={{fontSize:11,color:'#4a5260',marginTop:2}}>{opt.sub}</div></div>
                          {engineerStatusSent===opt.id&&<span style={{color:'#f5a623',fontSize:13}}>✓ Sent</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {!['cant_complete','hours_running_out','vehicle_theft'].includes(panelIssue?.id)&&(
                    <button onClick={()=>setPanelState('resolving')} style={{width:'100%',padding:13,background:'transparent',border:'1px solid rgba(245,166,35,0.25)',borderRadius:12,color:'#f5a623',fontWeight:600,fontSize:14,cursor:'pointer'}}>
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
                {(panelIssue?.id==='breakdown'?[
                  {id:'driver_fixed',label:'🔧 Driver fixed it roadside',sub:'Vehicle moving again'},
                  {id:'recovery_fixed',label:'🚛 Recovery arrived and fixed',sub:'Back on the road'},
                  {id:'towed',label:'🏗 Towed to depot',sub:'Vehicle off road'},
                  {id:'other_resolved',label:'✅ Other — resolved',sub:'Issue no longer active'},
                ]:panelIssue?.id==='medical'||panelIssue?.id==='driver_unwell'?[
                  {id:'driver_ok',label:'👍 Driver OK — back on shift',sub:'Fit to continue'},
                  {id:'driver_unwell_cover',label:'🚑 Driver unwell — needs cover',sub:'Replacement driver needed'},
                  {id:'false_alarm',label:'🟢 False alarm',sub:'No medical issue'},
                  {id:'other_medical',label:'✅ Other — resolved',sub:'Issue no longer active'},
                ]:[
                  {id:'breakdown_recovered',label:'🔧 Breakdown recovered',sub:'Vehicle moving again'},
                  {id:'delay_cleared',label:'🟢 Delay cleared',sub:'Back on schedule'},
                  {id:'temp_back_in_range',label:'❄ Temp back in range',sub:'Cold chain restored'},
                  {id:'rerouted_clear',label:'🛣 Rerouted — clear now',sub:'New route confirmed'},
                  {id:'access_resolved',label:'🚪 Access resolved',sub:'Now at site'},
                  {id:'delivery_accepted',label:'📦 Delivery accepted',sub:'POD signed'},
                  {id:'tacho_cleared',label:'📟 Tacho cleared',sub:'Issue resolved by depot'},
                  {id:'other_resolved',label:'✅ Other — resolved',sub:'Issue no longer active'},
                ]).map(opt=>(
                  <button key={opt.id} onClick={()=>resolveIssue(opt.label, opt.id)}
                    style={{width:'100%',marginBottom:7,padding:'12px 13px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:10,cursor:'pointer',textAlign:'left',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div><div style={{fontSize:14,color:'#e8eaed',fontWeight:500}}>{opt.label}</div><div style={{fontSize:11,color:'#4a5260',marginTop:2}}>{opt.sub}</div></div>
                    <span style={{color:'#f5a623',fontSize:15}}>→</span>
                  </button>
                ))}
                <button onClick={()=>setPanelState('result')} style={{width:'100%',padding:9,background:'transparent',border:'none',color:'#4a5260',fontSize:12,cursor:'pointer',marginTop:3}}>← Back</button>
              </div>
            )}

            {panelState==='resolving_loading'&&<div style={{textAlign:'center',padding:'44px 0'}}><div style={{width:38,height:38,border:'3px solid rgba(245,166,35,0.15)',borderTop:'3px solid #f5a623',borderRadius:'50%',margin:'0 auto 14px',animation:'spin 1s linear infinite'}}/><div style={{fontSize:13,color:'#f5a623',fontFamily:'monospace'}}>NOTIFYING OPS...</div></div>}

            {/* RESOLVED state */}
            {panelState==='resolved'&&(
              <div style={{textAlign:'center',padding:'22px 0'}}>
                <div style={{fontSize:46,marginBottom:10}}>✅</div>
                <div style={{fontSize:19,color:'#f5a623',fontWeight:700,marginBottom:5}}>Back on track</div>
                <div style={{fontSize:13,color:'#8a9099',marginBottom:resolvedEta?12:22}}>Ops notified. Job updated.</div>
                {resolvedEta&&<div style={{padding:'10px 14px',background:'rgba(245,166,35,0.05)',border:'1px solid rgba(245,166,35,0.2)',borderRadius:9,marginBottom:22,fontSize:13,color:'#e8eaed',lineHeight:1.6,textAlign:'left'}}>{resolvedEta}</div>}
                {(engineerStatusSent==='tow_only'||lastResolveMethod==='towed')&&(
                  <div style={{marginBottom:16,padding:14,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:12,textAlign:'left'}}>
                    <div style={{fontSize:14,fontWeight:700,color:'#ff453a',marginBottom:6,fontFamily:"'Barlow Condensed',sans-serif",textTransform:'uppercase'}}>Vehicle out of service</div>
                    <div style={{fontSize:12,color:'#8a9099',marginBottom:12}}>Vehicle towed — end shift now?</div>
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={()=>{
                        closePanel()
                        const start = shiftStartTime.current
                        const end = new Date()
                        const duration = start ? Math.round((end-start)/60000) : null
                        const completed = jobs.filter(j=>j.status==='completed').length
                        const total = jobs.length
                        const unresolved = jobs.filter(j=>j.status!=='completed').length
                        setShiftSummary({completed,total,incidents:1,duration,endTime:end.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),notes:'Vehicle towed — shift ended early',mileage:shiftMileage||'0',unresolved})
                        setShiftEnded(true)
                        fetch('/api/driver/end-shift',{method:'POST',headers:{'Content-Type':'application/json'},
                          body:JSON.stringify({client_id:driverInfo.clientId,vehicle_reg:driverInfo.vehicleReg||null,driver_phone:driverInfo.phone||null,driver_name:driverInfo.name||null,reason:'vehicle_breakdown',started_at:start?start.toISOString():null,ended_at:end.toISOString(),duration_minutes:duration,mileage:shiftMileage||'0',notes:'Vehicle towed — shift ended early',jobs_completed:completed,jobs_total:total,incidents_count:1,unresolved_count:unresolved,unresolved_jobs:jobs.filter(j=>j.status!=='completed').map(j=>({ref:j.ref,route:j.route||null,status:'not_completed',alert:'breakdown_shift_ended'})),defects_flagged:true,defect_details:'Vehicle towed after breakdown'})
                        }).then(res=>{if(res.ok)['dh_shift_started','dh_shift_started_at','dh_last_alert','dh_prior_alert','dh_job_progress','dh_postshift_draft','dh_dismissed_notifications','dh_session_id'].forEach(k=>localStorage.removeItem(k))}).catch(err=>console.error('[end-shift-breakdown]',err))
                      }} style={{flex:1,padding:'12px',background:'#ff453a',border:'none',borderRadius:8,color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer'}}>End shift now</button>
                      <button onClick={closePanel} style={{flex:1,padding:'12px',background:'transparent',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#8a9099',fontWeight:600,fontSize:13,cursor:'pointer'}}>Continue manually</button>
                    </div>
                  </div>
                )}
                <button onClick={closePanel} style={{padding:'13px 44px',background:'#f5a623',border:'none',borderRadius:10,color:'#000',fontWeight:700,fontSize:15,cursor:'pointer'}}>Close</button>
              </div>
            )}

            {/* SENT state */}
            {panelState==='sent'&&(
              <div style={{textAlign:'center',padding:'30px 0'}}>
                <div style={{fontSize:42,marginBottom:10}}>✅</div>
                <div style={{fontSize:17,color:'#f5a623',fontWeight:700,marginBottom:5}}>Ops notified</div>
                <div style={{fontSize:13,color:'#4a5260',marginBottom:22}}>Your manager has been alerted.</div>
                <button onClick={closePanel} style={{padding:'12px 38px',background:'#f5a623',border:'none',borderRadius:10,color:'#000',fontWeight:700,fontSize:14,cursor:'pointer'}}>Close</button>
              </div>
            )}

            {/* NO ACTIVE JOB state */}
            {panelState==='no_active_job'&&(
              <div style={{textAlign:'center',padding:'30px 0'}}>
                <div style={{fontSize:42,marginBottom:10}}>✅</div>
                <div style={{fontSize:17,color:'#f5a623',fontWeight:700,marginBottom:7}}>All runs are complete</div>
                <div style={{fontSize:13,color:'#8a9099',marginBottom:7,lineHeight:1.6}}>No active delivery to raise this against.</div>
                <div style={{fontSize:12,color:'#4a5260',marginBottom:22}}>For vehicle or medical emergencies use Breakdown or Medical.</div>
                <button onClick={closePanel} style={{padding:'12px 38px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,color:'#8a9099',fontWeight:500,fontSize:13,cursor:'pointer'}}>Close</button>
              </div>
            )}

            {/* LOADING state */}
            {panelState==='loading'&&(
              <div style={{textAlign:'center',padding:'44px 0'}}>
                <div style={{width:42,height:42,border:'3px solid rgba(245,166,35,0.12)',borderTop:'3px solid #f5a623',borderRadius:'50%',margin:'0 auto 14px',animation:'spin 1s linear infinite'}}/>
                <div style={{fontSize:13,color:'#f5a623',fontFamily:'monospace',marginBottom:5}}>GETTING INSTRUCTIONS...</div>
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
                    style={{width:'100%',padding:'13px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,color:'#e8eaed',fontSize:16,lineHeight:1.6,outline:'none',resize:'none',boxSizing:'border-box',marginBottom:13,WebkitAppearance:'none',minHeight:88}}/>
                )}
                {activeJob&&(
                  <div style={{padding:'8px 11px',background:'rgba(245,166,35,0.03)',border:'1px solid rgba(245,166,35,0.1)',borderRadius:7,fontSize:12,color:'#8a9099',marginBottom:14}}>
                    Job: <span style={{color:'#f5a623',fontWeight:500}}>{activeJob.ref}</span> · {activeJob.route}
                  </div>
                )}
                <button onClick={sendAlert}
                  style={{width:'100%',padding:15,background:panelIssue?.id==='medical'||panelIssue?.id==='driver_unwell'?'#3b82f6':['breakdown','cant_complete','theft_threat','accident','vehicle_theft'].includes(panelIssue?.id)?'#ef4444':'#f5a623',border:'none',borderRadius:12,color:['breakdown','cant_complete','theft_threat','accident','vehicle_theft','medical','driver_unwell'].includes(panelIssue?.id)?'#fff':'#000',fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,letterSpacing:'0.05em',textTransform:'uppercase',cursor:'pointer',marginBottom:9,boxShadow:panelIssue?.id==='medical'||panelIssue?.id==='driver_unwell'?'0 6px 24px rgba(59,130,246,0.3)':['breakdown','cant_complete','theft_threat','accident','vehicle_theft'].includes(panelIssue?.id)?'0 6px 24px rgba(239,68,68,0.35)':'none'}}>
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
