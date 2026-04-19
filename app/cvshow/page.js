'use client'
import { useState } from 'react'
import Link from 'next/link'

const FLEET_SIZES = ['1–10', '11–30', '31–100', '100+']
const PAIN_POINTS = ['SLA breaches', 'Breakdown response', 'Driver comms', 'All of the above']

export default function CVShowPage() {
  const [fleetSize, setFleetSize] = useState('')
  const [painPoint, setPainPoint] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)

  const canSubmit = name.trim() && phone.trim() && fleetSize && painPoint

  async function handleSubmit() {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/cvshow-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), fleet_size: fleetSize, pain_point: painPoint })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Something went wrong')
        return
      }
      setDone(true)
    } catch (e) {
      setError('Network error — try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#06080d', color: '#e8eaed', fontFamily: "'Barlow', 'DM Sans', -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;900&family=Barlow:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
        .cv-btn { transition: all 0.15s; -webkit-tap-highlight-color: transparent; }
        .cv-btn:active { transform: scale(0.97); }
        .cv-input { transition: border-color 0.15s; }
        .cv-input:focus { border-color: rgba(245,166,35,0.4) !important; }
        .cv-opt { transition: all 0.15s; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .cv-opt:active { transform: scale(0.97); }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 22, height: 22, background: '#f5a623', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', flexShrink: 0 }} />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: '#f5a623', letterSpacing: '0.02em' }}>DisruptionHub</span>
        </div>
        <Link href="/" style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'rgba(255,255,255,0.3)', textDecoration: 'none', letterSpacing: '0.04em' }}>
          {'←'} disruptionhub.ai
        </Link>
      </div>

      <div style={{ maxWidth: 440, margin: '0 auto', padding: '32px 20px 40px' }}>

        {!done ? (
          <>
            {/* Hero */}
            <div style={{ marginBottom: 32, textAlign: 'center' }}>
              <div style={{ display: 'inline-block', padding: '5px 14px', background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.25)', borderRadius: 20, fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 600, color: '#f5a623', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
                CV SHOW 2026
              </div>
              <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 36, color: '#e8eaed', letterSpacing: '-0.5px', lineHeight: 1.1, margin: '0 0 12px', textTransform: 'uppercase' }}>
                See it live<br />in 90 seconds
              </h1>
              <p style={{ fontSize: 17, color: '#d1d5db', lineHeight: 1.6, margin: 0, fontWeight: 400 }}>
                We just showed you the demo. Book a pilot call and we'll set it up for your fleet this week.
              </p>
            </div>

            {/* Q1: Fleet size */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: '#e5e7eb', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                How many vehicles in your fleet?
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {FLEET_SIZES.map(s => (
                  <button key={s} className="cv-opt" onClick={() => setFleetSize(s)} style={{
                    padding: '14px 10px', borderRadius: 12, fontSize: 15, fontWeight: 600, textAlign: 'center',
                    background: fleetSize === s ? 'rgba(245,166,35,0.12)' : 'rgba(255,255,255,0.04)',
                    border: fleetSize === s ? '1px solid rgba(245,166,35,0.35)' : '1px solid rgba(255,255,255,0.08)',
                    color: fleetSize === s ? '#f5a623' : 'rgba(255,255,255,0.5)',
                    fontFamily: "'Barlow', sans-serif"
                  }}>{s}</button>
                ))}
              </div>
            </div>

            {/* Q2: Pain point */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: '#e5e7eb', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                What's your biggest daily ops headache?
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {PAIN_POINTS.map(p => (
                  <button key={p} className="cv-opt" onClick={() => setPainPoint(p)} style={{
                    padding: '14px 10px', borderRadius: 12, fontSize: 14, fontWeight: 500, textAlign: 'center',
                    background: painPoint === p ? 'rgba(245,166,35,0.12)' : 'rgba(255,255,255,0.04)',
                    border: painPoint === p ? '1px solid rgba(245,166,35,0.35)' : '1px solid rgba(255,255,255,0.08)',
                    color: painPoint === p ? '#f5a623' : 'rgba(255,255,255,0.5)',
                    fontFamily: "'Barlow', sans-serif", lineHeight: 1.3
                  }}>{p}</button>
                ))}
              </div>
            </div>

            {/* Q3: Name + Phone */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: '#e5e7eb', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                Your name and mobile
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input className="cv-input" value={name} onChange={e => setName(e.target.value)} placeholder="Name"
                  style={{ padding: '14px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#e8eaed', fontSize: 15, outline: 'none', fontFamily: "'Barlow', sans-serif", width: '100%', boxSizing: 'border-box' }} />
                <input className="cv-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Mobile" type="tel"
                  style={{ padding: '14px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#e8eaed', fontSize: 15, outline: 'none', fontFamily: "'Barlow', sans-serif", width: '100%', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, fontSize: 13, color: '#ef4444', marginBottom: 16, textAlign: 'center' }}>
                {error}
              </div>
            )}

            {/* CTA */}
            <button className="cv-btn" onClick={handleSubmit} disabled={!canSubmit || submitting} style={{
              width: '100%', padding: '18px 20px', borderRadius: 14, border: 'none',
              background: canSubmit ? '#f5a623' : 'rgba(255,255,255,0.06)',
              color: canSubmit ? '#06080d' : 'rgba(255,255,255,0.2)',
              fontSize: 18, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'default',
              fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.03em',
              boxShadow: canSubmit ? '0 6px 28px rgba(245,166,35,0.3)' : 'none',
              marginBottom: 24
            }}>
              {submitting ? 'Submitting...' : 'Book my pilot call \u2192'}
            </button>

            {/* Footer */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 8, lineHeight: 1.5 }}>
                No commitment. No contract. Just 30 minutes.
              </div>
              <div style={{ fontSize: 13, color: '#f5a623', fontWeight: 600 }}>
                Founding rate: £349/mo locked for life — 5 spots remaining
              </div>
            </div>
          </>
        ) : (
          /* Thank you state */
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: 56, height: 56, background: '#f5a623', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', margin: '0 auto 24px' }} />
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, color: '#e8eaed', textTransform: 'uppercase', margin: '0 0 12px', letterSpacing: '-0.3px' }}>
              You're in
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: '0 0 24px' }}>
              We'll call you before Friday.<br />See you on the floor. {'🟡'}
            </p>
            <div style={{ fontSize: 13, color: '#f5a623', fontWeight: 600 }}>
              Founding rate: £349/mo locked for life
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
