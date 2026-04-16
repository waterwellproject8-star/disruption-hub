'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const DASHBOARD_PIN = 'DH2026'

export default function UnlockPage() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    if (typeof document !== 'undefined' && document.cookie.split(';').some(c => c.trim().startsWith('dh_ops_auth=true'))) {
      router.replace('/ops-9x7k')
    }
  }, [router])

  const handleSubmit = () => {
    if (pin.toUpperCase() === DASHBOARD_PIN) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('dh_unlocked', 'true')
        document.cookie = 'dh_ops_auth=true; path=/; max-age=31536000; SameSite=Strict'
      }
      router.replace('/ops-9x7k')
    } else {
      setError(true); setPin(''); setTimeout(() => setError(false), 2000)
    }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#080c14', fontFamily:'Barlow, sans-serif' }}>
      <div style={{ width:360, padding:'40px 36px', background:'#0f1826', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, textAlign:'center' }}>
        <div style={{ width:48, height:48, background:'#f5a623', clipPath:'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', margin:'0 auto 20px' }} />
        <div style={{ fontFamily:'monospace', fontSize:11, color:'#f5a623', letterSpacing:'0.1em', marginBottom:8 }}>DISRUPTIONHUB</div>
        <div style={{ fontSize:15, color:'#e8eaed', marginBottom:6 }}>Operations Dashboard</div>
        <div style={{ fontSize:12, color:'#4a5260', marginBottom:28 }}>Authorised access only</div>
        <input type="password" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} placeholder="Enter access code" autoFocus
          style={{ width:'100%', padding:'12px 14px', background:'#080c14', border: error ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.12)', borderRadius:6, color:'#e8eaed', fontSize:14, outline:'none', fontFamily:'IBM Plex Mono, monospace', letterSpacing:'0.2em', textAlign:'center', marginBottom:12, boxSizing:'border-box', transition:'border 0.2s' }} />
        {error && <div style={{ fontSize:11, color:'#ef4444', fontFamily:'monospace', marginBottom:10 }}>Invalid access code</div>}
        <button onClick={handleSubmit} style={{ width:'100%', padding:'11px', background:'#f5a623', border:'none', borderRadius:6, color:'#000', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'Barlow, sans-serif' }}>Access Dashboard →</button>
        <div style={{ marginTop:20, fontSize:11, color:'#4a5260' }}>Not a client? <a href="/" style={{ color:'#f5a623', textDecoration:'none' }}>View live demo →</a></div>
      </div>
    </div>
  )
}
