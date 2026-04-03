'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

const SCENARIOS = {
  weather: {
    label: 'Storm closes port',
    input: `Storm Lilian has closed Port of Felixstowe for 48-72 hours.

AFFECTED:
- 3 containers of electronics (Samsung TVs, 400 units) — due tomorrow, retailer launch in 4 days, penalty clause £12,000/day late
- 1 container of medical consumables — NHS contract, 18hr delivery SLA, trust has 2 days stock remaining
- 2 containers seasonal furniture — B&Q launch in 6 days

Alternative ports: Tilbury (3hrs further, available), Immingham (5hrs, available)
Air freight for medical goods: ~£8,000 for consignment`
  },
  supplier: {
    label: 'Supplier goes under',
    input: `Primary supplier FastPack Ltd (Manchester) went into administration overnight.

AFFECTED STOCK:
- SKU-4421 Foam inserts: 200 units stock, 180/day usage — used in ALL fragile shipments
- SKU-8832 Custom printed boxes: 0 stock, AstraZeneca quarterly dispatch in 5 days (£45,000 contract)
- SKU-1190 Bubble wrap: 3 days supply remaining

Alternatives: PackRight Leeds (3-day lead), EcoPack Birmingham (5-day, 15% more expensive)`
  },
  driver: {
    label: 'Driver shortage + system down',
    input: `Monday 06:00. Two simultaneous failures.

PROBLEM 1: 12 of 34 drivers called sick. 847 parcels to deliver today including 23 next-day-guaranteed, 8 medical (dialysis equipment), 4 legal documents (court deadline 4pm).

PROBLEM 2: WMS crashed at 05:30. IT says 4-6 hours to restore. 560 parcels loaded but manifests are digital-only. 287 parcels not yet allocated.

Available: 22 drivers, 3 agency drivers (2hr lead, £45/hr), CitySprint on standby.`
  }
}

const STATS = [
  { value: '30sec', label: 'Avg triage time' },
  { value: '£40K+', label: 'Avg annual disruption cost avoided' },
  { value: '85%', label: 'Of decisions made before crisis escalates' },
  { value: '0', label: 'New software to learn' },
]

export default function HomePage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState('')
  const [activeScenario, setActiveScenario] = useState(null)
  const responseRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight
    }
  }, [response])

  const loadScenario = (key) => {
    setActiveScenario(key)
    setInput(SCENARIOS[key].input)
    inputRef.current?.focus()
  }

  const runAnalysis = async (text) => {
    if (!text.trim() || loading) return

    const userMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setResponse('')

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages })
      })

      if (!res.ok) throw new Error('API error')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullResponse = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.text) {
                fullResponse += data.text
                setResponse(fullResponse)
              }
            } catch {}
          }
        }
      }

      setMessages([...newMessages, { role: 'assistant', content: fullResponse }])
    } catch (err) {
      setResponse('Connection error — check your API key in Vercel environment variables.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    runAnalysis(input)
  }

  const reset = () => {
    setMessages([])
    setResponse('')
    setInput('')
    setActiveScenario(null)
  }

  const formatResponse = (text) => {
    return text
      // Strip any raw HTML tags the AI might output
      .replace(/<strong[^>]*>(.*?)<\/strong>/g, '$1')
      .replace(/<span[^>]*>(.*?)<\/span>/g, '$1')
      .replace(/<[^>]+>/g, '')
      // Section headers
      .replace(/^## (.*)$/gm, '<div style="display:flex;align-items:center;gap:8px;margin:20px 0 8px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.06)"><div style="height:1px;width:10px;background:#00e5b0;flex-shrink:0"></div><span style="color:#00e5b0;font-family:IBM Plex Mono,monospace;font-size:10px;letter-spacing:0.1em;font-weight:600;text-transform:uppercase">$1</span></div>')
      // Blockquotes - callouts
      .replace(/^> (.*)$/gm, '<div style="margin:8px 0;padding:8px 12px;background:rgba(239,68,68,0.06);border-left:3px solid #ef4444;border-radius:0 5px 5px 0;font-size:12px;color:#e8eaed;line-height:1.6">$1</div>')
      // Severity badges
      .replace(/^(CRITICAL|HIGH|MEDIUM|LOW)$/gm, (m) => {
        const c = {CRITICAL:'#ef4444',HIGH:'#f59e0b',MEDIUM:'#3b82f6',LOW:'#8a9099'}[m]
        const bg = {CRITICAL:'rgba(239,68,68,0.1)',HIGH:'rgba(245,158,11,0.1)',MEDIUM:'rgba(59,130,246,0.1)',LOW:'rgba(138,144,153,0.1)'}[m]
        return \`<span style="background:\${bg};color:\${c};font-family:monospace;font-size:10px;padding:2px 8px;border-radius:4px;font-weight:700">\${m}</span>\`
      })
      // Bold text
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#e8eaed;font-weight:600">$1</strong>')
      // Money amounts
      .replace(/(£[\d,]+(?:–£[\d,]+)?(?:K)?)/g, '<span style="color:#00e5b0;font-weight:600;font-family:monospace">$1</span>')
      // Numbered actions
      .replace(/^(\d+)\.?\s+(.+)$/gm, (match, num, text) => {
        const urgent = text.includes('NOW') || text.includes('IMMEDIATELY') || text.includes('999')
        const border = urgent ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'
        const bg = urgent ? '#ef4444' : '#00e5b0'
        return \`<div style="display:flex;gap:10px;margin:6px 0;padding:10px 12px;background:#111418;border-radius:6px;border:1px solid \${border}"><div style="width:20px;height:20px;border-radius:50%;background:\${bg};color:#000;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:1px">\${num}</div><div style="font-size:12px;color:#e8eaed;line-height:1.6;flex:1">\${text}</div></div>\`
      })
      // Bullet points
      .replace(/^[-—]\s+(.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0;padding-left:4px"><span style="color:#00e5b0;font-size:10px;margin-top:3px;flex-shrink:0">—</span><span style="font-size:12px;color:#8a9099;line-height:1.6">$1</span></div>')
      // Horizontal rules
      .replace(/^---+$/gm, '<div style="height:1px;background:rgba(255,255,255,0.06);margin:12px 0"></div>')
      // Line breaks
      .replace(/\n/g, '<br>')
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>

      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'sticky', top: 0, background: 'rgba(10,12,14,0.95)',
        backdropFilter: 'blur(12px)', zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, background: 'var(--accent)', borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 600, color: '#000', fontFamily: 'var(--font-mono)'
          }}>DH</div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.05em', color: 'var(--text)' }}>
            Disruption<span style={{ color: 'var(--accent)' }}>Hub</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <a href="#demo" style={{ color: 'var(--text2)', fontSize: 13 }}>Live demo</a>
          <a href="#pricing" style={{ color: 'var(--text2)', fontSize: 13 }}>Pricing</a>
          <Link href="/dashboard" style={{
            background: 'var(--accent)', color: '#000', padding: '7px 16px',
            borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: 'none'
          }}>Dashboard →</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: '80px 32px 60px', maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        <div style={{
          display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--accent)', letterSpacing: '0.12em', padding: '4px 12px',
          border: '1px solid rgba(0,229,176,0.3)', borderRadius: 3, marginBottom: 24
        }}>
          AI LOGISTICS DISRUPTION INTELLIGENCE
        </div>
        <h1 style={{
          fontSize: 'clamp(32px, 5vw, 54px)', fontWeight: 300, lineHeight: 1.15,
          letterSpacing: '-0.02em', marginBottom: 20, color: 'var(--text)'
        }}>
          30 minutes of crisis calls.<br />
          <span style={{ color: 'var(--accent)', fontWeight: 500 }}>Compressed to 30 seconds.</span>
        </h1>
        <p style={{ fontSize: 17, color: 'var(--text2)', maxWidth: 580, margin: '0 auto 36px', fontWeight: 300, lineHeight: 1.7 }}>
          AI that analyses logistics disruptions and tells your ops team exactly what to do — before the situation compounds. No new software to learn. Live in a day.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="#demo" style={{
            background: 'var(--accent)', color: '#000', padding: '12px 28px',
            borderRadius: 8, fontWeight: 600, fontSize: 15, textDecoration: 'none'
          }}>Try it live below ↓</a>
          <a href="mailto:hello@disruptionhub.ai" style={{
            border: '1px solid var(--border2)', color: 'var(--text)', padding: '12px 28px',
            borderRadius: 8, fontSize: 15, textDecoration: 'none'
          }}>Book a demo</a>
        </div>
      </section>

      {/* Stats bar */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 0,
        borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
        margin: '0 0 60px'
      }}>
        {STATS.map((s, i) => (
          <div key={i} style={{
            padding: '20px 40px', textAlign: 'center',
            borderRight: i < STATS.length - 1 ? '1px solid var(--border)' : 'none'
          }}>
            <div style={{ fontSize: 24, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* LIVE DEMO */}
      <section id="demo" style={{ maxWidth: 900, margin: '0 auto 80px', padding: '0 32px' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: 8 }}>
            LIVE AGENT — POWERED BY CLAUDE AI
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 400, color: 'var(--text)', marginBottom: 8 }}>
            Type any disruption. Get an action plan instantly.
          </h2>
          <p style={{ color: 'var(--text2)', fontSize: 14 }}>
            Use a pre-built scenario or describe your own situation in plain English.
          </p>
        </div>

        {/* Scenario buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {Object.entries(SCENARIOS).map(([key, s]) => (
            <button key={key} onClick={() => loadScenario(key)} style={{
              padding: '7px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
              border: activeScenario === key ? '1px solid var(--accent)' : '1px solid var(--border2)',
              background: activeScenario === key ? 'rgba(0,229,176,0.1)' : 'var(--bg2)',
              color: activeScenario === key ? 'var(--accent)' : 'var(--text2)',
              transition: 'all 0.15s'
            }}>{s.label}</button>
          ))}
          {messages.length > 0 && (
            <button onClick={reset} style={{
              padding: '7px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text3)', fontFamily: 'var(--font-mono)'
            }}>Clear ×</button>
          )}
        </div>

        {/* Main demo interface */}
        <div style={{
          border: '1px solid var(--border2)', borderRadius: 10,
          background: 'var(--bg2)', overflow: 'hidden'
        }}>
          {/* Terminal header */}
          <div style={{
            padding: '10px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 8
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
              disruption-agent — ops terminal
            </span>
            {loading && (
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>
                ● ANALYSING...
              </span>
            )}
          </div>

          {/* Input area */}
          <form onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Describe your disruption in plain English — weather, flight delay, stock issue, driver shortage, anything..."
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) runAnalysis(input) }}
              style={{
                width: '100%', minHeight: 120, padding: '16px',
                background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text)', fontFamily: 'var(--font-sans)', fontSize: 13,
                resize: 'vertical', lineHeight: 1.6,
              }}
            />
            <div style={{
              padding: '10px 16px', borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
                ⌘↵ to run · or click →
              </span>
              <button type="submit" disabled={!input.trim() || loading} style={{
                background: loading ? 'var(--bg3)' : 'var(--accent)',
                color: loading ? 'var(--text3)' : '#000',
                border: 'none', padding: '8px 20px', borderRadius: 6,
                fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
                fontFamily: 'var(--font-sans)', transition: 'all 0.15s'
              }}>
                {loading ? 'Analysing...' : 'Run analysis →'}
              </button>
            </div>
          </form>

          {/* Response */}
          {(response || loading) && (
            <div ref={responseRef} style={{
              borderTop: '1px solid var(--border)', padding: '20px 24px',
              maxHeight: 520, overflowY: 'auto', background: 'var(--bg)'
            }}>
              {loading && !response && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
                      animation: `pulse 1.2s ${i*0.2}s infinite`,
                    }} />
                  ))}
                  <style>{`@keyframes pulse{0%,100%{opacity:0.3}50%{opacity:1}}`}</style>
                </div>
              )}
              {response && (
                <div
                  style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.8 }}
                  dangerouslySetInnerHTML={{ __html: formatResponse(response) }}
                />
              )}
            </div>
          )}
        </div>

        {/* Follow-up hint */}
        {messages.length >= 2 && (
          <p style={{ marginTop: 10, color: 'var(--text3)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
            // Ask a follow-up — "draft the client email", "cheapest option that hits SLA", "what's our liability here"
          </p>
        )}
      </section>

      {/* How it works */}
      <section style={{
        padding: '60px 32px', borderTop: '1px solid var(--border)',
        background: 'var(--bg2)', marginBottom: 0
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: 16 }}>HOW IT WORKS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 24 }}>
            {[
              { n: '01', t: 'Tell it what happened', d: 'Type any disruption in plain English. Weather, delay, stock failure, driver issue — no forms, no dropdowns.' },
              { n: '02', t: 'Agent analyses instantly', d: 'Claude AI draws on 20+ years of logistics expertise baked into the system prompt. Severity, financial impact, cascade risks — all in seconds.' },
              { n: '03', t: 'Get a structured action plan', d: '7 sections every time: who to call, what to say, how to reroute, what stock to reorder, what breaks next if you don\'t act.' },
              { n: '04', t: 'Connect your systems', d: 'Link your TMS or WMS via webhook. Agent auto-triggers on exceptions — no manual input needed at all.' },
            ].map(s => (
              <div key={s.n} style={{ padding: '20px 0' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, color: 'var(--border2)', marginBottom: 12 }}>{s.n}</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }}>{s.t}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: '80px 32px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: 16 }}>PRICING</div>
        <h2 style={{ fontSize: 26, fontWeight: 400, marginBottom: 8 }}>Simple. No contracts. Cancel anytime.</h2>
        <p style={{ color: 'var(--text2)', marginBottom: 12, fontSize: 14 }}>One missed SLA typically costs more than a year of DisruptionHub.</p>

        {/* Founding client banner */}
        <div style={{ background: 'rgba(0,229,176,0.06)', border: '1px solid rgba(0,229,176,0.2)', borderRadius: 8, padding: '12px 20px', marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.08em' }}>FOUNDING CLIENT OFFER</span>
            <p style={{ fontSize: 13, color: 'var(--text2)', margin: '4px 0 0' }}>First 5 clients lock in at <strong style={{ color: 'var(--text)' }}>£499/month for life</strong> — never increases regardless of what we add. 3 of 5 spots remaining.</p>
          </div>
          <a href="mailto:hello@disruptionhub.ai?subject=Founding client enquiry" style={{ background: 'var(--accent)', color: '#000', padding: '8px 16px', borderRadius: 6, fontWeight: 600, fontSize: 12, textDecoration: 'none', whiteSpace: 'nowrap' }}>Claim your spot →</a>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
          {[
            {
              name: 'Advisory',
              price: '£399',
              period: '/month',
              target: '1–20 vehicles',
              badge: null,
              features: [
                'Live disruption analysis',
                'Unlimited agent analyses',
                'Structured action plans',
                'Driver PWA app',
                'Customer tracking portal',
                'Manual incident input',
              ],
              note: null,
              cta: 'Start £99 pilot',
              featured: false,
            },
            {
              name: 'Autonomous',
              price: '£799',
              period: '/month',
              target: '20–50 vehicles',
              badge: 'MOST POPULAR',
              features: [
                'Everything in Advisory',
                '16 AI modules running 24/7',
                'Auto-triggered on disruptions',
                'SLA breach prediction',
                'Driver hours monitoring',
                'Vehicle health alerts',
                'Fuel optimisation',
                'Invoice recovery',
                'Planned closure alerts',
                'TMS & telematics webhook',
                'Cascade penalty calculator',
              ],
              note: '→ Founding clients: £499/mo for life',
              cta: 'Start £99 pilot',
              featured: true,
            },
            {
              name: 'Intelligence',
              price: '£1,499',
              period: '/month',
              target: '50+ vehicles',
              badge: null,
              features: [
                'Everything in Autonomous',
                'Cargo theft prevention',
                'Cash flow forecasting',
                'Client churn prediction',
                'Workforce pipeline',
                'Subcontractor trust scores',
                'Rate benchmarking',
                'Insurance claim pre-emption',
                'Border doc failure handler',
                'Carbon & ESG reporting',
              ],
              note: null,
              cta: 'Talk to us',
              featured: false,
            },
          ].map(p => (
            <div key={p.name} style={{
              border: p.featured ? '1px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 10, padding: '24px',
              background: p.featured ? 'rgba(0,229,176,0.04)' : 'var(--bg2)',
              position: 'relative'
            }}>
              {p.badge && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--accent)', color: '#000', fontSize: 11, fontWeight: 600,
                  padding: '3px 12px', borderRadius: 3, fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.05em', whiteSpace: 'nowrap'
                }}>{p.badge}</div>
              )}
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 32, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--text)', marginBottom: 2 }}>
                {p.price}<span style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 400 }}>{p.period}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: p.note ? 6 : 20 }}>{p.target}</div>
              {p.note && (
                <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 16, fontWeight: 500 }}>{p.note}</div>
              )}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginBottom: 20 }}>
                {p.features.map(f => (
                  <div key={f} style={{ fontSize: 13, color: 'var(--text2)', padding: '3px 0', display: 'flex', gap: 8 }}>
                    <span style={{ color: 'var(--accent)' }}>✓</span> {f}
                  </div>
                ))}
              </div>
              <a href={p.cta === 'Talk to us' ? 'mailto:hello@disruptionhub.ai?subject=Intelligence tier enquiry' : 'mailto:hello@disruptionhub.ai?subject=Pilot request'} style={{
                display: 'block', textAlign: 'center',
                background: p.featured ? 'var(--accent)' : 'transparent',
                color: p.featured ? '#000' : 'var(--text)',
                border: p.featured ? 'none' : '1px solid var(--border2)',
                padding: '10px', borderRadius: 6, fontWeight: 600,
                fontSize: 13, textDecoration: 'none'
              }}>{p.cta} →</a>
              <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: 10 }}>
                £99 pilot · 2 weeks · cancel anytime
              </div>
            </div>
          ))}
        </div>

        {/* Pilot explanation */}
        <div style={{ marginTop: 24, padding: '16px 20px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)', letterSpacing: '0.08em', marginBottom: 6 }}>HOW THE PILOT WORKS</div>
          <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>Pay £99. We customise the system with your actual carriers, routes, clients, and SLA thresholds. Run it for two weeks on real disruptions. If you want to continue, you choose your tier. If not, walk away — no questions. The £99 is non-refundable once your onboarding call has taken place.</p>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: '60px 32px', textAlign: 'center',
        borderTop: '1px solid var(--border)', background: 'var(--bg2)'
      }}>
        <h2 style={{ fontSize: 28, fontWeight: 400, marginBottom: 12 }}>
          Your worst disruption happened last week.<br />
          <span style={{ color: 'var(--accent)' }}>What would you have saved?</span>
        </h2>
        <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 28 }}>
          Tell us your worst disruption in the last 6 months. We'll run a live analysis and show you exactly what DisruptionHub would have done. No commitment.
        </p>
        <a href="mailto:hello@disruptionhub.ai?subject=Demo request — live disruption analysis" style={{
          background: 'var(--accent)', color: '#000', padding: '14px 32px',
          borderRadius: 8, fontWeight: 600, fontSize: 15, textDecoration: 'none',
          display: 'inline-block'
        }}>Book a 20-min live demo →</a>
      </section>

      {/* Footer */}
      <footer style={{ padding: '24px 32px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text3)' }}>
          DisruptionHub © 2026
        </span>
        <div style={{ display: 'flex', gap: 20 }}>
          <a href="mailto:hello@disruptionhub.ai" style={{ fontSize: 12, color: 'var(--text3)' }}>Contact</a>
          <Link href="/dashboard" style={{ fontSize: 12, color: 'var(--text3)' }}>Dashboard</Link>
        </div>
      </footer>
    </div>
  )
}
