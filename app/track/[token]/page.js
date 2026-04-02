'use client'
import { useState, useEffect, useRef } from 'react'

export default function TrackingPage({ params }) {
  const { token } = params
  const [tracking, setTracking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const markerRef = useRef(null)

  useEffect(() => {
    loadTracking()
    const interval = setInterval(loadTracking, 30000) // refresh every 30s
    return () => clearInterval(interval)
  }, [token])

  // Init Leaflet map once tracking data arrives
  useEffect(() => {
    if (!tracking || !mapRef.current) return
    if (tracking.status === 'delivered') return

    const initMap = async () => {
      if (typeof window === 'undefined') return
      const L = (await import('leaflet')).default

      // Fix Leaflet icon path issue in Next.js
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      const pos = tracking.live_position
      const lat = pos?.latitude || 52.4862
      const lng = pos?.longitude || -1.8904

      if (!mapInstance.current) {
        mapInstance.current = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView([lat, lng], 11)

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors'
        }).addTo(mapInstance.current)
      }

      if (pos) {
        const icon = L.divIcon({
          html: `<div style="width:32px;height:32px;background:#00e5b0;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:14px;">🚛</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          className: ''
        })

        if (markerRef.current) {
          markerRef.current.setLatLng([pos.latitude, pos.longitude])
        } else {
          markerRef.current = L.marker([pos.latitude, pos.longitude], { icon })
            .addTo(mapInstance.current)
            .bindPopup(`<strong>${tracking.driver_name || 'Your driver'}</strong><br>${pos.speed_mph || 0} mph`)
          mapInstance.current.panTo([pos.latitude, pos.longitude])
        }
      }
    }

    initMap()
  }, [tracking])

  async function loadTracking() {
    try {
      const res = await fetch(`/api/tracking/${token}`)
      if (res.status === 404) { setError('not_found'); setLoading(false); return }
      if (res.status === 410) { setError('expired'); setLoading(false); return }
      const data = await res.json()
      if (data.success) {
        setTracking(data.tracking)
        setLastUpdate(new Date())
      }
    } catch {
      setError('connection')
    } finally {
      setLoading(false)
    }
  }

  const fmt = iso => iso ? new Date(iso).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }) : '—'
  const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' }) : '—'

  const branding = tracking?.client_branding || {}
  const accentColor = branding.accent_color || '#00e5b0'
  const companyName = branding.company_name || 'Your delivery'
  const logoUrl = branding.logo_url || null

  // ── ERROR STATES ────────────────────────────────────────────────────────────
  if (error === 'not_found') return <ErrorScreen msg="Tracking link not found" detail="This tracking link doesn't exist. Check the link in your message." />
  if (error === 'expired') return <ErrorScreen msg="Tracking link expired" detail="This link is no longer active. Contact the sender for an updated link." />
  if (loading) return <LoadingScreen />

  const isDelivered = tracking?.status === 'delivered'
  const isDelayed = tracking?.status === 'delayed'
  const hasLivePosition = !!tracking?.live_position

  return (
    <div style={{ minHeight:'100vh', background:'#f9fafb', fontFamily:'IBM Plex Sans, system-ui, sans-serif' }}>

      {/* Link Leaflet CSS */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />

      {/* Header */}
      <div style={{ background:isDelivered?'#0F6E56':'#0a0c0e', padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {logoUrl
            ? <img src={logoUrl} style={{ height:32, borderRadius:4 }} alt="logo" />
            : <div style={{ width:36, height:36, background:accentColor, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#000' }}>DH</div>
          }
          <div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.5)', marginBottom:1 }}>{companyName}</div>
            <div style={{ fontSize:15, fontWeight:500, color:'white' }}>{tracking?.job_ref}</div>
          </div>
        </div>
        {isDelivered
          ? <div style={{ fontSize:12, color:accentColor, fontFamily:'monospace', fontWeight:600 }}>✓ DELIVERED</div>
          : <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:isDelayed?'#f59e0b':accentColor, animation:'pulse 2s infinite' }} />
              <span style={{ fontSize:12, color:isDelayed?'#f59e0b':accentColor, fontFamily:'monospace' }}>{isDelayed?'DELAYED':'LIVE'}</span>
            </div>
        }
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* Map */}
      {!isDelivered && (
        <div ref={mapRef} style={{ width:'100%', height:260, background:'#e5e7eb', position:'relative' }}>
          {!hasLivePosition && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:10, background:'rgba(0,0,0,0.05)', flexDirection:'column', gap:8 }}>
              <div style={{ fontSize:28 }}>🚛</div>
              <div style={{ fontSize:13, color:'#6b7280', fontWeight:500 }}>Live location updating...</div>
            </div>
          )}
        </div>
      )}

      {/* Delivered banner */}
      {isDelivered && (
        <div style={{ margin:'20px 16px 0', background:'#E1F5EE', border:'1px solid #5DCAA5', borderRadius:12, padding:'20px', textAlign:'center' }}>
          <div style={{ fontSize:36, marginBottom:8 }}>✅</div>
          <div style={{ fontSize:18, fontWeight:600, color:'#0F6E56', marginBottom:4 }}>Delivered!</div>
          <div style={{ fontSize:13, color:'#1D9E75' }}>Your delivery was completed on {fmtDate(tracking?.delivered_at)} at {fmt(tracking?.delivered_at)}</div>
        </div>
      )}

      <div style={{ padding:'16px' }}>

        {/* ETA card */}
        {!isDelivered && (
          <div style={{ background:'white', borderRadius:12, padding:'16px', marginBottom:14, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', border:'1px solid #f3f4f6' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ fontSize:11, color:'#9ca3af', fontFamily:'monospace', marginBottom:4 }}>ESTIMATED ARRIVAL</div>
                <div style={{ fontSize:28, fontWeight:500, color:'#111827' }}>
                  {tracking?.estimated_arrival ? fmt(tracking.estimated_arrival) : '—'}
                </div>
                {tracking?.estimated_arrival && (
                  <div style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>{fmtDate(tracking.estimated_arrival)}</div>
                )}
              </div>
              <div style={{ textAlign:'right' }}>
                {tracking?.live_position && (
                  <>
                    <div style={{ fontSize:11, color:'#9ca3af', fontFamily:'monospace', marginBottom:4 }}>SPEED</div>
                    <div style={{ fontSize:20, fontWeight:500, color:'#374151' }}>{tracking.live_position.speed_mph || 0}<span style={{ fontSize:12, color:'#9ca3af', fontWeight:400 }}> mph</span></div>
                  </>
                )}
              </div>
            </div>
            {isDelayed && (
              <div style={{ marginTop:10, padding:'8px 10px', background:'#FFFBEB', borderRadius:6, fontSize:12, color:'#B45309', border:'1px solid #FCD34D' }}>
                ⚠ Running slightly behind schedule — your driver is on the way.
              </div>
            )}
          </div>
        )}

        {/* Journey card */}
        <div style={{ background:'white', borderRadius:12, padding:'16px', marginBottom:14, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', border:'1px solid #f3f4f6' }}>
          <div style={{ fontSize:11, color:'#9ca3af', fontFamily:'monospace', marginBottom:12 }}>YOUR DELIVERY</div>
          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
            {[
              { label:'From', value:tracking?.origin, icon:'📍' },
              { label:'To', value:tracking?.destination, icon:'🏁' },
              { label:'Contents', value:tracking?.cargo_description, icon:'📦' },
              { label:'Driver', value:tracking?.driver_name, icon:'👤' },
            ].filter(r => r.value).map(row => (
              <div key={row.label} style={{ display:'flex', gap:12, padding:'8px 0', borderBottom:'1px solid #f9fafb', alignItems:'center' }}>
                <span style={{ fontSize:16, flexShrink:0 }}>{row.icon}</span>
                <div>
                  <div style={{ fontSize:10, color:'#9ca3af', marginBottom:1 }}>{row.label}</div>
                  <div style={{ fontSize:13, color:'#374151', fontWeight:500 }}>{row.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        {tracking?.updates?.length > 0 && (
          <div style={{ background:'white', borderRadius:12, padding:'16px', marginBottom:14, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', border:'1px solid #f3f4f6' }}>
            <div style={{ fontSize:11, color:'#9ca3af', fontFamily:'monospace', marginBottom:12 }}>UPDATES</div>
            {tracking.updates.map((ev, i) => (
              <div key={i} style={{ display:'flex', gap:12, marginBottom:12, position:'relative' }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:accentColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, flexShrink:0, color:'#000' }}>
                  {ev.icon === 'delivered' ? '✓' : ev.icon === 'delayed' ? '⚠' : '●'}
                </div>
                {i < tracking.updates.length - 1 && (
                  <div style={{ position:'absolute', left:13, top:28, width:2, height:'calc(100% + 4px)', background:'#f3f4f6' }} />
                )}
                <div style={{ paddingTop:4 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:'#111827' }}>{ev.label}</div>
                  <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>{ev.detail}</div>
                  <div style={{ fontSize:11, color:'#9ca3af', fontFamily:'monospace', marginTop:3 }}>{fmt(ev.time)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Last update */}
        {lastUpdate && (
          <div style={{ textAlign:'center', fontSize:11, color:'#9ca3af', fontFamily:'monospace', padding:'8px 0' }}>
            Last updated {fmt(lastUpdate.toISOString())} · Updates automatically
          </div>
        )}
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{ minHeight:'100vh', background:'#f9fafb', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'sans-serif' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:40, height:40, border:'3px solid #e5e7eb', borderTop:'3px solid #00e5b0', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto 16px' }} />
        <div style={{ fontSize:14, color:'#6b7280' }}>Loading your tracking info...</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function ErrorScreen({ msg, detail }) {
  return (
    <div style={{ minHeight:'100vh', background:'#f9fafb', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'sans-serif', padding:24 }}>
      <div style={{ textAlign:'center', maxWidth:320 }}>
        <div style={{ fontSize:40, marginBottom:16 }}>🔍</div>
        <div style={{ fontSize:18, fontWeight:600, color:'#111827', marginBottom:8 }}>{msg}</div>
        <div style={{ fontSize:14, color:'#6b7280', lineHeight:1.6 }}>{detail}</div>
      </div>
    </div>
  )
}
