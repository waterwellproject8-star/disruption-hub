'use client'
import { useState, useEffect, useRef } from 'react'

// DisruptionHub Driver App — Progressive Web App
// Add to home screen for full app experience

const STATUS_COLORS = {
  pending:   { bg: '#1a2230', border: 'rgba(245,158,11,0.3)',  dot: '#f59e0b', label: 'PENDING'    },
  en_route:  { bg: '#0d1f15', border: 'rgba(0,229,176,0.3)',  dot: '#00e5b0', label: 'EN ROUTE'   },
  completed: { bg: '#111418', border: 'rgba(59,130,246,0.2)', dot: '#3b82f6', label: 'COMPLETED'  },
}

export default function DriverApp() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeJob, setActiveJob] = useState(null)
  const [acknowledging, setAcknowledging] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [notification, setNotification] = useState(null)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [driverInfo, setDriverInfo] = useState({ id: '', name: '', clientId: '', vehicleReg: '' })
  const [setupDone, setSetupDone] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(null)
  const fileRef = useRef(null)

  // Load driver info from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dh_driver_info')
    if (saved) {
      const info = JSON.parse(saved)
      setDriverInfo(info)
      setSetupDone(true)
      loadJobs(info)
      registerServiceWorker(info)
    } else {
      setLoading(false)
    }
  }, [])

  async function loadJobs(info) {
    if (!info?.clientId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ client_id: info.clientId })
      if (info.id) params.set('driver_id', info.id)
      if (info.vehicleReg) params.set('vehicle_reg', info.vehicleReg)
      const res = await fetch(`/api/driver/jobs?${params}`)
      const data = await res.json()
      setJobs(data.jobs || [])
      if (data.jobs?.length > 0 && !activeJob) {
        setActiveJob(data.jobs[0])
      }
    } catch (e) {
      showNotification('Could not load jobs — check connection', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function registerServiceWorker(info) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      const keyRes = await fetch('/api/driver/push-subscribe')
      if (!keyRes.ok) return
      const { vapid_public_key } = await keyRes.json()
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid_public_key)
      })
      await fetch('/api/driver/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: info.clientId,
          driver_id: info.id,
          driver_name: info.name,
          subscription: sub.toJSON()
        })
      })
      setPushEnabled(true)
    } catch {}
  }

  async function acknowledgeJob(job, response = 'acknowledged') {
    setAcknowledging(true)
    try {
      await fetch('/api/driver/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: job.id,
          driver_id: driverInfo.id,
          client_id: driverInfo.clientId,
          response,
          status: response === 'acknowledged' ? 'en_route' : undefined
        })
      })
      showNotification(response === 'acknowledged' ? 'Confirmed — safe driving!' : 'Issue reported to ops', 'success')
      loadJobs(driverInfo)
    } catch {
      showNotification('Could not send — check connection', 'error')
    } finally {
      setAcknowledging(false)
    }
  }

  async function handlePhotoUpload(file) {
    if (!file || !activeJob) return
    setUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('job_id', activeJob.id)
      formData.append('client_id', driverInfo.clientId)
      formData.append('driver_id', driverInfo.id || '')
      formData.append('notes', 'POD photo')
      formData.append('photo', file)
      const res = await fetch('/api/driver/photo', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.success) {
        showNotification('Delivery confirmed — photo uploaded!', 'success')
        setPhotoPreview(null)
        loadJobs(driverInfo)
      } else {
        showNotification('Upload failed — try again', 'error')
      }
    } catch {
      showNotification('Upload failed — check connection', 'error')
    } finally {
      setUploadingPhoto(false)
    }
  }

  function saveDriverInfo() {
    localStorage.setItem('dh_driver_info', JSON.stringify(driverInfo))
    setSetupDone(true)
    loadJobs(driverInfo)
    registerServiceWorker(driverInfo)
  }

  function showNotification(msg, type = 'info') {
    setNotification({ msg, type })
    setTimeout(() => setNotification(null), 4000)
  }

  const fmt = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  const fmtDeadline = (iso) => {
    if (!iso) return null
    const d = new Date(iso)
    const now = new Date()
    const mins = Math.round((d - now) / 60000)
    if (mins < 0) return { label: 'OVERDUE', color: '#ef4444' }
    if (mins < 30) return { label: `${mins}min`, color: '#ef4444' }
    if (mins < 60) return { label: `${mins}min`, color: '#f59e0b' }
    return { label: fmt(iso), color: '#8a9099' }
  }

  // ── SETUP SCREEN ─────────────────────────────────────────────────────────────
  if (!setupDone) {
    return (
      <div style={{ minHeight:'100vh', background:'#0a0c0e', color:'#e8eaed', fontFamily:'IBM Plex Sans, sans-serif', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px' }}>
        <div style={{ width:48, height:48, background:'#00e5b0', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, color:'#000', fontFamily:'monospace', marginBottom:20 }}>DH</div>
        <h1 style={{ fontSize:22, fontWeight:500, marginBottom:6, textAlign:'center' }}>DisruptionHub Driver</h1>
        <p style={{ color:'#8a9099', fontSize:13, marginBottom:32, textAlign:'center' }}>Enter your details to get started. Your ops manager will give you these.</p>
        <div style={{ width:'100%', maxWidth:340, display:'flex', flexDirection:'column', gap:12 }}>
          {[
            { label:'Your name', key:'name', placeholder:'e.g. Paul Fletcher' },
            { label:'Client ID', key:'clientId', placeholder:'Provided by your ops manager' },
            { label:'Driver ID (optional)', key:'id', placeholder:'Provided by your ops manager' },
            { label:'Vehicle reg (optional)', key:'vehicleReg', placeholder:'e.g. LM71 KHT' },
          ].map(f => (
            <div key={f.key}>
              <div style={{ fontSize:11, color:'#8a9099', marginBottom:5, fontFamily:'monospace' }}>{f.label.toUpperCase()}</div>
              <input
                value={driverInfo[f.key] || ''}
                onChange={e => setDriverInfo(d => ({ ...d, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                style={{ width:'100%', padding:'12px 14px', background:'#111418', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'#e8eaed', fontSize:15, fontFamily:'IBM Plex Sans, sans-serif', outline:'none' }}
              />
            </div>
          ))}
          <button onClick={saveDriverInfo} disabled={!driverInfo.name || !driverInfo.clientId} style={{ marginTop:8, padding:'14px', background:'#00e5b0', border:'none', borderRadius:8, fontSize:15, fontWeight:600, color:'#000', cursor:'pointer' }}>
            Get Started →
          </button>
        </div>
      </div>
    )
  }

  // ── MAIN DRIVER APP ──────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:'#0a0c0e', color:'#e8eaed', fontFamily:'IBM Plex Sans, sans-serif', maxWidth:480, margin:'0 auto', display:'flex', flexDirection:'column' }}>

      {/* Notification toast */}
      {notification && (
        <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', zIndex:999, padding:'10px 18px', borderRadius:8, fontSize:13, fontWeight:500, background:notification.type==='error'?'#B91C1C':'#0F6E56', color:'#fff', boxShadow:'0 4px 20px rgba(0,0,0,0.4)', whiteSpace:'nowrap' }}>
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ padding:'16px 20px 12px', background:'rgba(10,12,14,0.98)', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 }}>
        <div>
          <div style={{ fontFamily:'monospace', fontSize:10, color:'#00e5b0', letterSpacing:'0.08em' }}>DISRUPTION<span style={{ color:'#e8eaed' }}>HUB</span> DRIVER</div>
          <div style={{ fontSize:14, fontWeight:500, marginTop:1 }}>{driverInfo.name}</div>
          {driverInfo.vehicleReg && <div style={{ fontSize:11, color:'#8a9099', fontFamily:'monospace' }}>{driverInfo.vehicleReg}</div>}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {pushEnabled && <div style={{ fontSize:10, color:'#00e5b0', fontFamily:'monospace' }}>🔔 ON</div>}
          <button onClick={() => loadJobs(driverInfo)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'6px 10px', color:'#8a9099', fontSize:11, cursor:'pointer', fontFamily:'monospace' }}>↺</button>
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ display:'flex', padding:'10px 20px', gap:16, borderBottom:'1px solid rgba(255,255,255,0.06)', background:'#0d1014' }}>
        {[
          { l:'Jobs today', v: jobs.length },
          { l:'En route', v: jobs.filter(j=>j.status==='en_route').length, c:'#00e5b0' },
          { l:'Pending', v: jobs.filter(j=>j.status==='pending').length, c:'#f59e0b' },
        ].map(s => (
          <div key={s.l} style={{ flex:1, textAlign:'center' }}>
            <div style={{ fontSize:20, fontWeight:500, fontFamily:'monospace', color:s.c||'#e8eaed' }}>{s.v}</div>
            <div style={{ fontSize:10, color:'#4a5260' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Job list */}
      <div style={{ flex:1, overflowY:'auto', padding:'14px 16px' }}>
        {loading && <div style={{ textAlign:'center', padding:40, color:'#4a5260', fontFamily:'monospace', fontSize:12 }}>Loading jobs...</div>}

        {!loading && jobs.length === 0 && (
          <div style={{ textAlign:'center', padding:40, opacity:0.4 }}>
            <div style={{ fontSize:32, marginBottom:12 }}>✓</div>
            <div style={{ fontSize:13, color:'#8a9099' }}>No active jobs</div>
          </div>
        )}

        {jobs.map(job => {
          const sc = STATUS_COLORS[job.status] || STATUS_COLORS.pending
          const deadline = fmtDeadline(job.sla_deadline)
          const isActive = activeJob?.id === job.id

          return (
            <div key={job.id} onClick={() => setActiveJob(isActive ? null : job)} style={{ border:`1px solid ${isActive ? '#00e5b0' : sc.border}`, borderRadius:10, background:sc.bg, marginBottom:10, overflow:'hidden', transition:'all 0.15s' }}>

              {/* Job header */}
              <div style={{ padding:'13px 14px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:sc.dot, flexShrink:0 }} />
                    <span style={{ fontFamily:'monospace', fontSize:13, fontWeight:600 }}>{job.ref}</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {deadline && <span style={{ fontFamily:'monospace', fontSize:11, color:deadline.color, fontWeight:500 }}>{deadline.label}</span>}
                    <span style={{ fontFamily:'monospace', fontSize:9, color:sc.dot, letterSpacing:'0.06em' }}>{sc.label}</span>
                  </div>
                </div>
                <div style={{ fontSize:13, color:'#e8eaed', marginBottom:2 }}>
                  {job.origin && <span style={{ color:'#8a9099' }}>{job.origin} → </span>}
                  <span style={{ fontWeight:500 }}>{job.destination || 'See manifest'}</span>
                </div>
                {job.cargo && <div style={{ fontSize:11, color:'#8a9099' }}>{job.cargo}</div>}
              </div>

              {/* Expanded detail */}
              {isActive && (
                <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'14px' }}>

                  {/* Agent instruction */}
                  {job.instructions && (
                    <div style={{ background:'rgba(0,229,176,0.07)', border:'1px solid rgba(0,229,176,0.2)', borderRadius:7, padding:'11px 13px', marginBottom:14 }}>
                      <div style={{ fontFamily:'monospace', fontSize:10, color:'#00e5b0', marginBottom:5, letterSpacing:'0.06em' }}>AGENT INSTRUCTION</div>
                      <div style={{ fontSize:13, color:'#e8eaed', lineHeight:1.6 }}>{job.instructions}</div>
                      {job.instruction_acknowledged && (
                        <div style={{ marginTop:6, fontSize:10, color:'#00e5b0', fontFamily:'monospace' }}>✓ Acknowledged {job.instruction_acknowledged_at ? `at ${fmt(job.instruction_acknowledged_at)}` : ''}</div>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                    {!job.instruction_acknowledged && job.instructions && (
                      <button onClick={(e) => { e.stopPropagation(); acknowledgeJob(job, 'acknowledged') }} disabled={acknowledging} style={{ flex:2, padding:'12px', background:'#00e5b0', border:'none', borderRadius:8, fontWeight:700, fontSize:13, color:'#000', cursor:'pointer' }}>
                        {acknowledging ? '...' : '✓ GOT IT'}
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); acknowledgeJob(job, 'issue') }} disabled={acknowledging} style={{ flex:1, padding:'12px', background:'transparent', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, fontSize:12, color:'#ef4444', cursor:'pointer' }}>
                      ⚠ Issue
                    </button>
                  </div>

                  {/* POD photo upload */}
                  {job.status !== 'completed' && (
                    <div>
                      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={e => { const f = e.target.files[0]; if(f){setPhotoPreview(URL.createObjectURL(f)); handlePhotoUpload(f)} }} />
                      {photoPreview && <img src={photoPreview} style={{ width:'100%', borderRadius:6, marginBottom:8, maxHeight:160, objectFit:'cover' }} />}
                      <button onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }} disabled={uploadingPhoto} style={{ width:'100%', padding:'11px', background:'#111418', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, fontSize:12, color:'#8a9099', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                        {uploadingPhoto ? 'Uploading...' : '📷  Take POD photo — confirm delivery'}
                      </button>
                    </div>
                  )}

                  {job.pod_photo_url && (
                    <div style={{ marginTop:8, padding:'8px 10px', background:'rgba(59,130,246,0.1)', borderRadius:6, fontSize:11, color:'#3b82f6', fontFamily:'monospace' }}>
                      ✓ POD photo submitted
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ padding:'10px 16px', borderTop:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#0d1014' }}>
        <span style={{ fontSize:10, color:'#4a5260', fontFamily:'monospace' }}>DisruptionHub Driver v3</span>
        <button onClick={() => { localStorage.removeItem('dh_driver_info'); setSetupDone(false); setJobs([]) }} style={{ fontSize:10, color:'#4a5260', background:'none', border:'none', cursor:'pointer' }}>Sign out</button>
      </div>
    </div>
  )
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}
