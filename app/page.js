'use client'
import { useState } from 'react'
import Link from 'next/link'

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────────
const T = {
  navy:       '#080c14',
  navyMid:    '#0d1420',
  navyCard:   '#0f1826',
  navyRow:    '#111927',
  amber:      '#f5a623',
  amberBright:'#ffb733',
  amberDim:   'rgba(245,166,35,0.15)',
  amberBorder:'rgba(245,166,35,0.25)',
  border:     'rgba(255,255,255,0.07)',
  text:       '#e8eaed',
  textDim:    '#8a9099',
  textFaint:  '#4a5260',
  green:      '#22c55e',
  red:        '#ef4444',
}

const FF = {
  body:      "'Barlow', sans-serif",
  condensed: "'Barlow Condensed', sans-serif",
  mono:      "'IBM Plex Mono', monospace",
}

// ── HEXAGON LOGO MARK ─────────────────────────────────────────────────────────
function HexMark({ size = 28 }) {
  return (
    <div style={{
      width: size, height: size,
      background: T.amber,
      clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
      flexShrink: 0,
      filter: 'drop-shadow(0 0 8px rgba(245,166,35,0.7)) drop-shadow(0 0 16px rgba(245,166,35,0.35))',
    }} />
  )
}

export default function HomePage() {

  const [videoOpen, setVideoOpen] = useState(false)

  const handleMailto = (e) => {
    const href = e.currentTarget.getAttribute('href')
    let left = true
    const onBlur = () => { left = false }
    window.addEventListener('blur', onBlur, { once: true })
    setTimeout(() => {
      window.removeEventListener('blur', onBlur)
      if (left) return
      const url = new URL(href)
      const to = url.pathname
      const subject = url.searchParams.get('subject') || ''
      const body = url.searchParams.get('body') || ''
      const gmail = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      window.open(gmail, '_blank')
    }, 500)
  }

  return (
    <div style={{ background: T.navy, color: T.text, fontFamily: FF.body, overflowX: 'hidden' }}>

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .ticker-track { animation: marquee 30s linear infinite; display:inline-flex; gap:48px; white-space:nowrap; }
        .ticker-track:hover { animation-play-state: paused; }
        .amber-glow { text-shadow: 0 0 30px rgba(245,166,35,0.65), 0 0 60px rgba(245,166,35,0.3); }
        .amber-btn-glow { box-shadow: 0 0 25px rgba(245,166,35,0.5), 0 0 50px rgba(245,166,35,0.2) !important; }
        .amber-btn-glow:hover { box-shadow: 0 0 35px rgba(245,166,35,0.7), 0 0 70px rgba(245,166,35,0.35) !important; transform: translateY(-2px); }
        .stat-card-hover:hover { transform: translateY(-3px); transition: all 0.2s; }
        .stat-card-hover:hover .stat-val { text-shadow: 0 0 40px rgba(245,166,35,0.8), 0 0 80px rgba(245,166,35,0.4); }
        .how-card-hover:hover { border-color: rgba(245,166,35,0.5) !important; box-shadow: 0 0 20px rgba(245,166,35,0.15), inset 0 0 20px rgba(245,166,35,0.04); }
        .hex-glow { filter: drop-shadow(0 0 8px rgba(245,166,35,0.7)) drop-shadow(0 0 16px rgba(245,166,35,0.35)); }
        .nav-link { color: ${T.textDim}; text-decoration: none; font-size: 14px; font-weight: 500; letter-spacing: 0.02em; transition: color 0.2s; font-family: ${FF.body}; }
        .nav-link:hover { color: ${T.text}; }
        .btn-primary { background: ${T.amber}; color: #000; border: none; padding: 11px 24px; font-family: ${FF.condensed}; font-size: 15px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s; border-radius: 3px; }
        .btn-primary:hover { background: ${T.amberBright}; transform: translateY(-1px); box-shadow: 0 6px 24px rgba(245,166,35,0.3); }
        .btn-hero { background: ${T.amber}; color: #000; border: none; padding: 16px 40px; font-family: ${FF.condensed}; font-size: 18px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 10px; transition: all 0.2s; border-radius: 3px; box-shadow: 0 0 25px rgba(245,166,35,0.5), 0 0 50px rgba(245,166,35,0.2); }
        .btn-hero:hover { background: ${T.amberBright}; transform: translateY(-2px); box-shadow: 0 0 35px rgba(245,166,35,0.7), 0 0 70px rgba(245,166,35,0.35); }
        .btn-outline { background: transparent; color: ${T.amber}; border: 1px solid ${T.amber}; padding: 11px 24px; font-family: ${FF.condensed}; font-size: 15px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s; border-radius: 3px; }
        .btn-outline:hover { background: rgba(245,166,35,0.08); }
        .btn-cta-large { background: ${T.amber}; color: #000; border: none; padding: 18px 48px; font-family: ${FF.condensed}; font-size: 19px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 10px; transition: all 0.2s; border-radius: 3px; }
        .btn-cta-large:hover { background: ${T.amberBright}; transform: translateY(-2px); box-shadow: 0 12px 40px rgba(245,166,35,0.4); }
        .stat-card:hover { border-color: ${T.amberBorder}; transform: translateY(-2px); }
        .how-card:hover { border-color: ${T.amberBorder}; }
        .pricing-card:hover { transform: translateY(-3px); }
        /* Hero — centre-left on desktop */
        .hero-section { justify-content: flex-start; padding-left: max(5%, calc(50vw - 680px)); }
        .hero-truck-bg { background-position: 70% center; }
        @media (max-width: 768px) {
          .hero-truck-bg { background-position: 60% center !important; }
        }
        .hero-content { text-align: left; }
        .hero-sub { margin-left: 0; }
        .hero-ctas { justify-content: flex-start; }
        .hero-badge { justify-content: flex-start; }

        @media (min-width: 769px) and (max-width: 1024px) {
          .pricing-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .enterprise-card { flex-direction: column !important; align-items: flex-start !important; }
          .enterprise-card .enterprise-divider { display: none !important; }
          .enterprise-card .enterprise-cta { width: 100% !important; text-align: center !important; }
        }
        @media (max-width: 768px) {
          .nav-links-desktop { display: none !important; }
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .how-grid { grid-template-columns: 1fr !important; }
          .pricing-grid { grid-template-columns: 1fr !important; }
          .enterprise-card { flex-direction: column !important; align-items: stretch !important; }
          .enterprise-card .enterprise-divider { display: none !important; }
          .enterprise-card .enterprise-features { grid-template-columns: 1fr !important; }
          .enterprise-card .enterprise-cta { width: 100% !important; text-align: center !important; }
          .footer-cols { flex-direction: column !important; gap: 32px !important; }
          /* Hero — center on mobile */
          .hero-section { justify-content: center; padding: 80px 20px 60px !important; }
          .hero-truck-bg { display: none !important; }
          .hero-overlay { display: none !important; }
          .hero-glow { display: none !important; }
          .hero-content { text-align: center; max-width: 100% !important; }
          .hero-sub { margin: 0 auto 32px !important; font-size: 16px !important; }
          .hero-ctas { justify-content: center; flex-direction: column; align-items: center; }
          .hero-badge { justify-content: center; }
        }
        @media (max-width: 640px) {
          .founder-card { grid-template-columns: 80px 1fr !important; column-gap: 16px !important; padding: 28px 20px !important; }
          .founder-photo { grid-row: 1 !important; align-self: center; }
          .founder-photo-ring { width: 80px !important; height: 80px !important; padding: 2px !important; }
          .founder-meta { grid-column: 2 !important; grid-row: 1 !important; align-self: center; }
          .founder-meta h3 { font-size: 24px !important; }
          .founder-body { grid-column: 1 / span 2 !important; grid-row: 2 !important; margin-top: 24px !important; }
        }
      `}</style>

      {/* ── NAV ──────────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(8,12,20,0.96)', backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${T.border}`,
        height: 60, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 40px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HexMark size={26} />
          <span style={{
            fontFamily: FF.condensed, fontSize: 22, fontWeight: 800,
            letterSpacing: '0.04em', color: '#fff', textTransform: 'uppercase',
          }}>
            Disruption<span style={{ color: T.amber }}>Hub</span>
          </span>
        </div>

        <ul className="nav-links-desktop" style={{ display: 'flex', alignItems: 'center', gap: 32, listStyle: 'none' }}>
          <li><a href="#how" className="nav-link">Platform</a></li>
          <li><a href="#pricing" className="nav-link">Pricing</a></li>
          <li><Link href="/dashboard" className="nav-link">Dashboard</Link></li>
        </ul>

        <a
          className="btn-primary"
          href="mailto:hello@disruptionhub.ai?subject=Demo request — DisruptionHub&body=Hi, I'd like to book a demo of DisruptionHub for my haulage operation."
          onClick={handleMailto}
        >
          Book a Demo
        </a>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="hero-section" style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        padding: '120px 5% 80px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Truck photo background */}
        <div className="hero-truck-bg" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'url(/hero-bg.jpg)',
          backgroundSize: 'cover', backgroundPosition: '70% center',
        }} />
        {/* Dark overlay — heavy left so text pops, fades right to show trucks */}
        <div className="hero-overlay" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(90deg, rgba(8,12,20,0.97) 0%, rgba(8,12,20,0.9) 30%, rgba(8,12,20,0.65) 55%, rgba(8,12,20,0.15) 100%)',
        }} />
        {/* Amber glow */}
        <div className="hero-glow" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 50% 60% at 20% 55%, rgba(245,166,35,0.07) 0%, transparent 70%)',
        }} />

        <div className="hero-content" style={{ position: 'relative', zIndex: 2, maxWidth: 720 }}>
          {/* Label */}
          <div style={{
            fontFamily: FF.mono, fontSize: 11, fontWeight: 500,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            color: T.amber, marginBottom: 24,
            display: 'inline-flex', alignItems: 'center', gap: 12,
            textShadow: '0 0 20px rgba(245,166,35,0.6)',
          }}>
            <span style={{ width: 28, height: 1, background: T.amber, display: 'inline-block', boxShadow: '0 0 8px rgba(245,166,35,0.8)' }} />
            AI Operations Intelligence
            <span style={{ width: 28, height: 1, background: T.amber, display: 'inline-block' }} />
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: FF.condensed,
            fontSize: 'clamp(48px, 8vw, 88px)',
            fontWeight: 900, lineHeight: 0.93,
            letterSpacing: '-0.01em', textTransform: 'uppercase',
            color: '#fff', marginBottom: 28,
          }}>
            Your Ops Never Sleep.
            <span style={{
              color: T.amber, display: 'block',
              textShadow: '0 0 30px rgba(245,166,35,0.65), 0 0 60px rgba(245,166,35,0.3), 0 0 100px rgba(245,166,35,0.15)',
            }}>
              Neither Does Ours.
            </span>
          </h1>

          {/* Subheadline */}
          <p className="hero-sub" style={{
            fontSize: 18, color: T.textDim,
            maxWidth: 520, margin: '0 0 44px',
            lineHeight: 1.7, fontWeight: 400,
          }}>
            Triage disruptions in 30 seconds. Protect SLAs.
            Save £40K+ a year. Not a luxury add-on — so operators can sleep at night knowing everything is in place to protect what they've built.
          </p>

          {/* CTAs */}
          <div className="hero-ctas" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <a
              className="btn-hero"
              href="mailto:hello@disruptionhub.ai?subject=Pilot request — DisruptionHub&body=Hi, I'd like to start the £149 pilot for my haulage operation."
              onClick={handleMailto}
            >
              Start Your Pilot
            </a>
            <Link href="/dashboard" className="btn-outline">
              View Dashboard →
            </Link>
          </div>

          {/* Watch Demo button */}
          <div className="hero-ctas" style={{ marginTop: 20 }}>
            <button
              onClick={() => setVideoOpen(true)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 10,
                color: '#8a9099', fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 15, fontWeight: 600, letterSpacing: '0.06em',
                textTransform: 'uppercase', padding: '8px 0',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#f5a623'}
              onMouseLeave={e => e.currentTarget.style.color = '#8a9099'}
            >
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                border: '1px solid rgba(245,166,35,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <div style={{
                  width: 0, height: 0,
                  borderTop: '7px solid transparent',
                  borderBottom: '7px solid transparent',
                  borderLeft: '12px solid #f5a623',
                  marginLeft: 3,
                }} />
              </div>
              Watch 29-second demo
            </button>
          </div>

          {/* Social proof */}
          <div className="hero-badge" style={{
            marginTop: 48, display: 'flex',
            alignItems: 'center', gap: 8,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.green, animation: 'pulse 2s infinite' }} />
            <span style={{ fontFamily: FF.mono, fontSize: 11, color: T.textFaint, letterSpacing: '0.08em' }}>
              LIVE PLATFORM — DEMO AVAILABLE
            </span>
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ──────────────────────────────────────────────────────── */}
      <div style={{
        background: T.navyMid,
        borderTop: `1px solid ${T.amberBorder}`,
        borderBottom: `1px solid ${T.amberBorder}`,
        padding: '0 40px',
      }}>
        <div className="stats-grid" style={{
          maxWidth: 1100, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        }}>
          {[
            { value: '30 SEC', label: 'Avg. Triage Time' },
            { value: '£40K+', label: 'Disruption Cost Avoided / Year' },
            { value: '85%', label: 'Decisions Before Escalation' },
            { value: 'ZERO', label: 'New Software to Learn' },
          ].map((s, i) => (
            <div key={i} className="stat-card stat-card-hover" style={{
              padding: '44px 32px', textAlign: 'center',
              borderRight: i < 3 ? `1px solid ${T.border}` : 'none',
              transition: 'all 0.2s', cursor: 'default',
            }}>
              <div className="stat-val" style={{
                fontFamily: FF.condensed, fontSize: 54, fontWeight: 900,
                color: T.amber, lineHeight: 1, letterSpacing: '-0.02em',
                marginBottom: 10,
                textShadow: '0 0 30px rgba(245,166,35,0.5), 0 0 60px rgba(245,166,35,0.25)',
                transition: 'text-shadow 0.2s',
              }}>
                {s.value}
              </div>
              <div style={{
                fontSize: 12, color: T.textDim,
                textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600,
              }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── LIVE INCIDENT TICKER ─────────────────────────────────────────────── */}
      <div style={{ background: '#0d1420', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '14px 0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 0 }}>
          <div style={{ paddingLeft: 32, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: '#4a5260', letterSpacing: '0.15em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>LIVE FEED</span>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div className="ticker-track" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#f5a623', letterSpacing: '0.1em', textTransform: 'uppercase', textShadow: '0 0 15px rgba(245,166,35,0.5)' }}>
              {['REEFER FAULT · M62 J27 · RESOLVED IN 28s','TEMP ALARM · NHS LOAD · SLA PROTECTED £2,400','DRIVER HOURS · CASCADE PREVENTED · £900 SAVED','PANIC BUTTON · DRIVER SAFE · OPS NOTIFIED IN 12s','JOB DELAYED · TESCO DC · AUTO-REROUTED · £1,200 PROTECTED','REEFER FAULT · M62 J27 · RESOLVED IN 28s','TEMP ALARM · NHS LOAD · SLA PROTECTED £2,400','DRIVER HOURS · CASCADE PREVENTED · £900 SAVED','PANIC BUTTON · DRIVER SAFE · OPS NOTIFIED IN 12s','JOB DELAYED · TESCO DC · AUTO-REROUTED · £1,200 PROTECTED'].map((item, i) => (
                <span key={i} style={{ flexShrink: 0 }}>⬥ {item}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────────── */}
      <section id="how" style={{ padding: '100px 40px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{
          fontFamily: FF.mono, fontSize: 11, fontWeight: 600,
          letterSpacing: '0.2em', textTransform: 'uppercase',
          color: T.amber, textAlign: 'center', marginBottom: 16,
        }}>
          How It Works
        </div>
        <h2 style={{
          fontFamily: FF.condensed, fontSize: 'clamp(32px, 4vw, 48px)',
          fontWeight: 800, textTransform: 'uppercase',
          letterSpacing: '0.02em', color: '#fff',
          textAlign: 'center', marginBottom: 64,
        }}>
          Three Steps. Thirty Seconds.
        </h2>

        <div className="how-grid" style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 0, position: 'relative',
        }}>
          {/* Connector line */}
          <div style={{
            position: 'absolute', top: 52, left: '25%', right: '25%',
            height: 1,
            background: `linear-gradient(90deg, transparent, ${T.amberBorder}, transparent)`,
            pointerEvents: 'none',
          }} />

          {[
            {
              num: '01', title: 'Connect',
              desc: 'Webhook connects to Mandata, Webfleet, Microlise, Samsara — your existing systems, no new software.',
              icon: (
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke={T.amber} strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="18" cy="18" r="3"/>
                  <path d="M18 7v4M18 25v4M7 18h4M25 18h4"/>
                  <circle cx="18" cy="18" r="10" strokeDasharray="3 3"/>
                </svg>
              ),
            },
            {
              num: '02', title: 'Analyse',
              desc: 'AI analyses disruptions in real time — severity, financial exposure, cascade risk, recommended action.',
              icon: (
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke={T.amber} strokeWidth="1.5" strokeLinecap="round">
                  <polyline points="6,26 13,16 19,20 26,10 30,14"/>
                  <circle cx="30" cy="10" r="2" fill={T.amber}/>
                </svg>
              ),
            },
            {
              num: '03', title: 'Decide',
              desc: 'Ops gets SMS with YES/NO decision ready to execute. Reply YES — driver notified, consignee called, SLA protected.',
              icon: (
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke={T.amber} strokeWidth="1.5" strokeLinecap="round">
                  <rect x="8" y="8" width="20" height="14" rx="2"/>
                  <path d="M8 22l4 5h12l4-5"/>
                  <path d="M13 14l3 3 7-7"/>
                </svg>
              ),
            },
          ].map((step, i) => (
            <div key={i} className="how-card how-card-hover" style={{
              textAlign: 'center', padding: '40px 32px', position: 'relative', zIndex: 1,
              background: T.navyCard,
              border: `1px solid ${T.border}`,
              borderRadius: 4,
              margin: '0 8px',
              transition: 'all 0.2s',
            }}>
              {/* Step number */}
              <div style={{
                fontFamily: FF.mono, fontSize: 10, color: T.amberBorder,
                letterSpacing: '0.15em', marginBottom: 16,
              }}>
                {step.num}
              </div>

              {/* Icon box */}
              <div style={{
                width: 80, height: 80,
                border: `1px solid ${T.amberBorder}`,
                borderRadius: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px',
                background: `linear-gradient(135deg, ${T.navyMid}, ${T.navyCard})`,
                boxShadow: '0 0 20px rgba(245,166,35,0.15), inset 0 0 10px rgba(245,166,35,0.05)',
              }}>
                {step.icon}
              </div>

              {/* Arrow between cards */}
              {i < 2 && (
                <div style={{
                  position: 'absolute', right: -20, top: '50%',
                  transform: 'translateY(-50%)',
                  color: T.amber, fontSize: 18, fontWeight: 700, zIndex: 3,
                  letterSpacing: '-2px',
                }}>
                  --›
                </div>
              )}

              <h3 style={{
                fontFamily: FF.condensed, fontSize: 22, fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                color: '#fff', marginBottom: 12,
              }}>
                {step.title}
              </h3>
              <p style={{ fontSize: 14, color: T.textDim, lineHeight: 1.7 }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────────────── */}
      <section id="pricing" style={{
        padding: '80px 40px 100px',
        background: T.navyMid,
        borderTop: `1px solid ${T.border}`,
        borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{
            fontFamily: FF.mono, fontSize: 11, fontWeight: 600,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            color: T.amber, textAlign: 'center', marginBottom: 16,
          }}>
            Simple Pricing
          </div>
          <h2 style={{
            fontFamily: FF.condensed, fontSize: 'clamp(32px, 4vw, 48px)',
            fontWeight: 800, textTransform: 'uppercase',
            color: '#fff', textAlign: 'center', marginBottom: 56,
          }}>
            Start Small. Scale Fast.
          </h2>

          <div className="pricing-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16, marginBottom: 16,
          }}>

            {/* PILOT */}
            <div className="pricing-card" style={{
              background: T.navyCard,
              border: `1px solid ${T.border}`,
              borderRadius: 4, padding: '32px 28px',
              transition: 'transform 0.2s',
            }}>
              <div style={{
                fontFamily: FF.mono, fontSize: 10, color: T.textFaint,
                letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 20,
              }}>
                Pilot
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                <div style={{
                  fontFamily: FF.condensed, fontSize: 48, fontWeight: 900,
                  color: T.amber, lineHeight: 1,
                  textShadow: '0 0 20px rgba(245,166,35,0.2)',
                }}>
                  £149
                </div>
                <div style={{
                  fontFamily: FF.condensed, fontSize: 20, fontWeight: 700, color: T.amber,
                }}>
                  / 30 days
                </div>
              </div>
              <div style={{ height: 16 }} />
              <div style={{
                fontFamily: FF.condensed, fontSize: 18, fontWeight: 700,
                color: '#fff', marginBottom: 20,
              }}>
                Prove the Value
              </div>
              <div style={{ height: 1, background: T.border, marginBottom: 20 }} />
              {['Non-refundable after onboarding call', '30 Days Full Access', 'Proof of Value Report', 'Dedicated Success Manager'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <span style={{ color: T.green, fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span>
                  <span style={{ fontSize: 13, color: T.textDim, lineHeight: 1.5 }}>{f}</span>
                </div>
              ))}
            </div>

            {/* FOUNDING COHORT — highlighted */}
            <div className="pricing-card" style={{
              background: `linear-gradient(135deg, ${T.navyCard}, rgba(245,166,35,0.04))`,
              border: `1px solid ${T.amberBorder}`,
              borderRadius: 4, padding: '32px 28px',
              position: 'relative',
              boxShadow: `0 0 40px rgba(245,166,35,0.25), 0 0 80px rgba(245,166,35,0.1), inset 0 1px 0 rgba(245,166,35,0.2)`,
              transform: 'scale(1.02)',
              transition: 'transform 0.2s',
            }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                background: `linear-gradient(90deg, transparent, #f5a623, transparent)`,
                boxShadow: '0 0 20px rgba(245,166,35,0.8)',
                borderRadius: '4px 4px 0 0',
              }} />
              <div style={{
                fontFamily: FF.mono, fontSize: 10, color: T.textFaint,
                letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 20,
              }}>
                Founding Cohort
              </div>
              <div style={{
                fontFamily: FF.condensed, fontSize: 48, fontWeight: 900,
                color: T.amber, lineHeight: 1, marginBottom: 4,
                textShadow: '0 0 30px rgba(245,166,35,0.7), 0 0 60px rgba(245,166,35,0.35)',
              }}>
                £349
              </div>
              <div style={{ fontSize: 13, color: T.textDim, marginBottom: 24 }}>/month · locked for life</div>
              <div style={{
                fontFamily: FF.condensed, fontSize: 18, fontWeight: 700,
                color: '#fff', marginBottom: 20,
              }}>
                Locked for Life
              </div>
              <div style={{ height: 1, background: T.amberBorder, marginBottom: 20 }} />
              {['All Full Platform Features', 'Priority Onboarding', "Founder's Circle Access", 'Lifetime Price Lock'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ color: T.amber, fontSize: 13, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 13, color: T.textDim }}>{f}</span>
                </div>
              ))}
              <div style={{ marginTop: 12, fontSize: 11, color: T.textFaint, lineHeight: 1.6 }}>
                5 founding spots — once filled, this rate closes permanently. No exceptions.
              </div>
            </div>

            {/* STANDARD */}
            <div className="pricing-card" style={{
              background: T.navyCard,
              border: `1px solid ${T.border}`,
              borderRadius: 4, padding: '32px 28px',
              transition: 'transform 0.2s',
            }}>
              <div style={{
                fontFamily: FF.mono, fontSize: 10, color: T.textFaint,
                letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 20,
              }}>
                Standard
              </div>
              <div style={{
                fontFamily: FF.condensed, fontSize: 48, fontWeight: 900,
                color: T.amber, lineHeight: 1, marginBottom: 4,
                textShadow: '0 0 20px rgba(245,166,35,0.2)',
              }}>
                £499
              </div>
              <div style={{ fontSize: 13, color: T.textDim, marginBottom: 24 }}>/month · up to 30 vehicles</div>
              <div style={{
                fontFamily: FF.condensed, fontSize: 18, fontWeight: 700,
                color: '#fff', marginBottom: 20,
              }}>
                Full Platform Access
              </div>
              <div style={{ height: 1, background: T.border, marginBottom: 20 }} />
              {['Unlimited AI Triage', 'Real-time Alerts', 'SLA Protection', '24/7 Support', 'API Access'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ color: T.green, fontSize: 13, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 13, color: T.textDim }}>{f}</span>
                </div>
              ))}
            </div>

            {/* GROWTH */}
            <div className="pricing-card" style={{
              background: T.navyCard,
              border: `1px solid ${T.border}`,
              borderRadius: 4, padding: '32px 28px',
              transition: 'transform 0.2s',
            }}>
              <div style={{
                fontFamily: FF.mono, fontSize: 10, color: T.textFaint,
                letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 20,
              }}>
                Growth
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                <div style={{
                  fontFamily: FF.condensed, fontSize: 48, fontWeight: 900,
                  color: T.amber, lineHeight: 1,
                  textShadow: '0 0 20px rgba(245,166,35,0.2)',
                }}>
                  £499
                </div>
                <div style={{
                  fontFamily: FF.condensed, fontSize: 18, fontWeight: 700, color: T.amber,
                }}>
                  + £8/vehicle
                </div>
              </div>
              <div style={{ fontSize: 13, color: T.textDim, marginBottom: 24 }}>above 30 vehicles · e.g. 40 vehicles = £579/mo</div>
              <div style={{
                fontFamily: FF.condensed, fontSize: 18, fontWeight: 700,
                color: '#fff', marginBottom: 20,
              }}>
                Scale Without Limits
              </div>
              <div style={{ height: 1, background: T.border, marginBottom: 20 }} />
              {['Everything in Standard', 'Unlimited Vehicles', 'Volume Pricing', 'Dedicated Account Manager'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ color: T.green, fontSize: 13, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 13, color: T.textDim }}>{f}</span>
                </div>
              ))}
            </div>

          </div>

          {/* ENTERPRISE — full width below the 4-column grid */}
          <div className="pricing-card enterprise-card" style={{
            background: T.navyCard,
            border: `1px solid ${T.border}`,
            borderRadius: 4, padding: '32px 36px',
            marginBottom: 48,
            display: 'flex', alignItems: 'center', gap: 40, flexWrap: 'wrap',
            transition: 'transform 0.2s',
          }}>
            <div style={{ flex: '0 0 220px' }}>
              <div style={{
                fontFamily: FF.mono, fontSize: 10, color: T.textFaint,
                letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 14,
              }}>
                Enterprise
              </div>
              <div style={{
                fontFamily: FF.condensed, fontSize: 48, fontWeight: 900,
                color: T.amber, lineHeight: 1, marginBottom: 6,
                textShadow: '0 0 20px rgba(245,166,35,0.2)',
              }}>
                Custom
              </div>
              <div style={{ fontSize: 13, color: T.textDim, lineHeight: 1.5 }}>51+ vehicles · multi-depot<br />complex integrations</div>
            </div>
            <div className="enterprise-divider" style={{ height: 80, width: 1, background: T.border, flexShrink: 0 }} />
            <div className="enterprise-features" style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 28px', minWidth: 200 }}>
              {['Everything in Growth', 'Multi-depot Support', 'Custom Integrations', 'Dedicated Engineering', 'SLA Guarantee', 'White-label Options'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: T.green, fontSize: 13, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 13, color: T.textDim }}>{f}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 13, color: T.textDim, lineHeight: 1.6, margin: '12px 0' }}>
              In a 2% margin industry, one lost Tesco contract ends a business. DisruptionHub exists so that doesn't happen.
            </p>
            <a
              className="amber-btn-glow enterprise-cta"
              href="mailto:hello@disruptionhub.ai?subject=Enterprise enquiry — DisruptionHub&body=Hi, I'd like to discuss enterprise pricing for my fleet."
              onClick={handleMailto}
              style={{
                display: 'inline-block', padding: '14px 28px',
                background: T.amber, color: '#000', borderRadius: 4,
                fontFamily: FF.condensed, fontSize: 16, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              Book a Call →
            </a>
          </div>

          {/* ── FOUNDER ────────────────────────────────────────────────────── */}
          <div className="founder-card" style={{
            marginTop: 72, marginBottom: 64,
            padding: '40px 32px',
            background: T.navyCard,
            border: `1px solid ${T.border}`,
            borderRadius: 4,
            display: 'grid',
            gridTemplateColumns: '120px 1fr',
            columnGap: 32,
            rowGap: 0,
            alignItems: 'start',
          }}>
            {/* Photo — spans both rows on desktop, row 1 col 1 on mobile */}
            <div className="founder-photo" style={{ gridColumn: 1, gridRow: '1 / span 2' }}>
              <div className="founder-photo-ring" style={{
                width: 120, height: 120, borderRadius: '50%',
                padding: 3,
                background: `linear-gradient(135deg, ${T.amber}, rgba(245,166,35,0.25))`,
                boxShadow: '0 0 24px rgba(245,166,35,0.35), 0 0 48px rgba(245,166,35,0.15)',
              }}>
                <img
                  src="/nomaan.jpg"
                  alt="Nomaan, Founder of DisruptionHub"
                  style={{
                    width: '100%', height: '100%',
                    borderRadius: '50%', objectFit: 'cover',
                    display: 'block',
                    border: `2px solid ${T.navyCard}`,
                  }}
                />
              </div>
            </div>

            {/* Meta — name, title, LinkedIn. Sits next to photo on both desktop and mobile */}
            <div className="founder-meta" style={{ gridColumn: 2, gridRow: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: FF.mono, fontSize: 11, fontWeight: 600,
                letterSpacing: '0.2em', textTransform: 'uppercase',
                color: T.amber, marginBottom: 12,
              }}>
                Built By
              </div>

              <h3 style={{
                fontFamily: FF.condensed, fontSize: 32, fontWeight: 800,
                textTransform: 'uppercase', color: '#fff',
                lineHeight: 1, marginBottom: 6, letterSpacing: '0.02em',
              }}>
                Nomaan
              </h3>

              <div style={{
                fontFamily: FF.body, fontSize: 14, color: T.textDim,
                marginBottom: 8,
              }}>
                Founder, DisruptionHub
              </div>

              <a
                href="https://linkedin.com/in/mohammed-nomaan-027382283"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontFamily: FF.mono, fontSize: 11,
                  color: T.amber, textDecoration: 'none',
                  letterSpacing: '0.04em',
                  marginBottom: 24,
                  borderBottom: `1px solid ${T.amberBorder}`,
                  paddingBottom: 2,
                  wordBreak: 'break-all',
                }}
              >
                linkedin.com/in/mohammed-nomaan-027382283 →
              </a>
            </div>

            {/* Body — paragraphs + pull quote. Sits next to photo on desktop, full width below on mobile */}
            <div className="founder-body" style={{ gridColumn: 2, gridRow: 2, minWidth: 0 }}>
              <p style={{
                fontFamily: FF.body, fontSize: 15, color: T.text,
                lineHeight: 1.75, marginBottom: 18,
              }}>
                I spent the past year researching the specific pain points hitting UK haulage operators — the data is real, not assumed. In a 2% margin industry, a single Tesco contract lost to repeated SLA penalties isn&apos;t a setback. It&apos;s the end of the business.
              </p>

              <p style={{
                fontFamily: FF.body, fontSize: 15, color: T.text,
                lineHeight: 1.75, marginBottom: 24,
              }}>
                I come from a background where protecting the downside wasn&apos;t optional. When AI reached the point where a system like this became buildable, I built it — not as a luxury add-on. So that operators can sleep at night knowing everything is in place to protect what they&apos;ve built.
              </p>

              <div style={{
                fontFamily: FF.mono, fontSize: 12,
                color: T.amber, letterSpacing: '0.06em',
                paddingTop: 16,
                borderTop: `1px solid ${T.border}`,
              }}>
                &ldquo;Built for operators. By someone who gets it.&rdquo;
              </div>
            </div>
          </div>

          {/* Main CTA */}
          <div style={{ textAlign: 'center' }}>
            <a
              className="btn-cta-large amber-btn-glow"
              href="mailto:hello@disruptionhub.ai?subject=Onboarding call request — DisruptionHub pilot&body=Hi, I'd like to book my onboarding call to start the £149 pilot."
              onClick={handleMailto}
            >
              Book Your Onboarding Call
            </a>
            <div style={{
              marginTop: 14, fontFamily: FF.mono, fontSize: 11,
              color: T.textFaint, letterSpacing: '0.06em',
            }}>
              £149 pilot · 30 days · bank transfer or PayPal
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer style={{
        background: T.navyMid,
        borderTop: `1px solid ${T.border}`,
        padding: '48px 40px 32px',
      }}>
        <div className="footer-cols" style={{
          maxWidth: 1100, margin: '0 auto',
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', flexWrap: 'wrap', gap: 40,
          marginBottom: 40,
        }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <HexMark size={22} />
              <span style={{
                fontFamily: FF.condensed, fontSize: 19, fontWeight: 800,
                letterSpacing: '0.04em', color: '#fff', textTransform: 'uppercase',
              }}>
                Disruption<span style={{ color: T.amber }}>Hub</span>
              </span>
            </div>
            <div style={{ fontSize: 12, color: T.textDim, maxWidth: 240, lineHeight: 1.7 }}>
              AI operations intelligence for UK haulage.
              Not a luxury add-on — one prevented SLA breach pays for a year.
            </div>
            <div style={{ marginTop: 16 }}>
              <a
                href="mailto:hello@disruptionhub.ai"
                onClick={handleMailto}
                style={{ fontFamily: FF.mono, fontSize: 12, color: T.amber, textDecoration: 'none' }}
              >
                hello@disruptionhub.ai
              </a>
            </div>
          </div>

          {/* Links */}
          <div style={{ display: 'flex', gap: 56, flexWrap: 'wrap' }}>
            <div>
              <div style={{
                fontFamily: FF.mono, fontSize: 10, color: T.textFaint,
                letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14,
              }}>
                Product
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <a href="#how" style={{ fontSize: 13, color: T.textDim, textDecoration: 'none' }}>Platform</a>
                <a href="#pricing" style={{ fontSize: 13, color: T.textDim, textDecoration: 'none' }}>Pricing</a>
                <Link href="/dashboard" style={{ fontSize: 13, color: T.textDim, textDecoration: 'none' }}>Dashboard</Link>
              </div>
            </div>
            <div>
              <div style={{
                fontFamily: FF.mono, fontSize: 10, color: T.textFaint,
                letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14,
              }}>
                Legal
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Link href="/legal/terms" style={{ fontSize: 13, color: T.textDim, textDecoration: 'none' }}>Terms of Service</Link>
                <Link href="/legal/privacy" style={{ fontSize: 13, color: T.textDim, textDecoration: 'none' }}>Privacy Policy</Link>
                <Link href="/legal/acceptable-use" style={{ fontSize: 13, color: T.textDim, textDecoration: 'none' }}>Acceptable Use</Link>
                <Link href="/legal/dpa" style={{ fontSize: 13, color: T.textDim, textDecoration: 'none' }}>Data Processing</Link>
              </div>
            </div>
            <div>
              <div style={{
                fontFamily: FF.mono, fontSize: 10, color: T.textFaint,
                letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14,
              }}>
                Contact
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <a onClick={handleMailto} href="mailto:hello@disruptionhub.ai" style={{ fontSize: 13, color: T.textDim, textDecoration: 'none' }}>hello@disruptionhub.ai</a>
                <a onClick={handleMailto} href="mailto:hello@disruptionhub.ai?subject=Pilot request" style={{ fontSize: 13, color: T.amber, textDecoration: 'none' }}>Start £149 pilot →</a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          borderTop: `1px solid ${T.border}`, paddingTop: 24,
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexWrap: 'wrap', gap: 8,
          maxWidth: 1100, margin: '0 auto',
        }}>
          <span style={{ fontFamily: FF.mono, fontSize: 11, color: T.textFaint }}>
            © 2026 DisruptionHub Ltd. All rights reserved. · Decision support only · Always verify before acting.
          </span>
          <span style={{ fontFamily: FF.mono, fontSize: 11, color: T.textFaint }}>
            London, UK
          </span>
        </div>
      </footer>


      {/* ── VIDEO MODAL ── */}
      {videoOpen && (
        <div
          onClick={() => setVideoOpen(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
            backgroundColor: 'rgba(0,0,0,0.93)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ position: 'relative', width: '100%', maxWidth: 960 }}
          >
            <button
              onClick={() => setVideoOpen(false)}
              style={{
                position: 'absolute', top: -44, right: 0,
                background: 'none', border: 'none', cursor: 'pointer',
                color: T.textDim, fontSize: 13, fontFamily: FF.mono,
                letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              ESC / CLOSE ✕
            </button>
            <video
              src="/demo.mp4"
              controls
              autoPlay
              style={{
                width: '100%', borderRadius: 4,
                border: `1px solid ${T.amberBorder}`,
                display: 'block',
              }}
            />
          </div>
        </div>
      )}

    </div>
  )
}
