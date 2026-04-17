'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import TypewriterText from '../components/TypewriterText'
import AnimatedStat from '../components/AnimatedStat'
import ScrambleText from '../components/ScrambleText'
import GlitchText from '../components/GlitchText'

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────────
const T = {
  navy:       '#0a0c0e',
  navyMid:    '#0a0c0e',
  navyCard:   '#0a0c0e',
  navyRow:    '#0a0c0e',
  amber:      '#f5a623',
  amberBright:'#ffb733',
  amberDim:   'rgba(245,166,35,0.15)',
  amberBorder:'rgba(245,166,35,0.25)',
  border:     'rgba(255,255,255,0.12)',
  text:       '#e8eaed',
  textDim:    '#8a9099',
  textFaint:  '#4a5260',
  green:      '#00e5b0',
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
  const timelineRef = useRef(null)
  const [tlStep, setTlStep] = useState(-1)

  useEffect(() => {
    const delays = [0, 900, 700, 800, 700]
    let timeouts = []

    function runSequence() {
      setTlStep(-1)
      let cumulative = 400
      delays.forEach((d, i) => {
        cumulative += d
        const t = setTimeout(() => {
          setTlStep(i)
          if (i === delays.length - 1) {
            const reset = setTimeout(runSequence, 2000)
            timeouts.push(reset)
          }
        }, cumulative)
        timeouts.push(t)
      })
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          runSequence()
          observer.disconnect()
        }
      },
      { threshold: 0.3 }
    )
    if (timelineRef.current) observer.observe(timelineRef.current)

    return () => {
      timeouts.forEach(t => clearTimeout(t))
      observer.disconnect()
    }
  }, [])

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
    <div style={{ background: '#0a0c0e', color: T.text, fontFamily: FF.body, overflowX: 'hidden' }}>

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .cta-primary-btn { position: relative; overflow: hidden; }
        .cta-primary-btn:hover { box-shadow: 0 0 0 1px rgba(245,166,35,0.8), 0 0 20px rgba(245,166,35,0.4), 0 0 40px rgba(245,166,35,0.15); transform: translateY(-1px); }
        .cta-primary-btn:active { transform: translateY(0px); box-shadow: 0 0 0 1px rgba(245,166,35,0.6), 0 0 10px rgba(245,166,35,0.3); }
        @keyframes dh-glitch { 0%{transform:translate(0);opacity:1;color:#fff} 10%{transform:translate(-3px,1px);opacity:0.8;color:#f5a623} 20%{transform:translate(3px,-1px);opacity:1;color:#fff} 30%{transform:translate(-2px,2px);opacity:0.9;color:#f5a623} 40%{transform:translate(2px,-2px);opacity:1;color:#fff} 50%{transform:translate(-1px,1px);clip-path:inset(30% 0 20% 0);color:#f5a623} 60%{transform:translate(1px,-1px);clip-path:inset(0);opacity:0.95;color:#fff} 70%{transform:translate(-2px,0);opacity:1;color:#fff} 85%{transform:translate(1px,0);color:#f5a623} 100%{transform:translate(0);opacity:1;color:#fff} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes tl-pulse { 0%{box-shadow:0 0 0 0 rgba(245,166,35,0.6)} 70%{box-shadow:0 0 0 10px rgba(245,166,35,0)} 100%{box-shadow:0 0 0 0 rgba(245,166,35,0)} }
        @keyframes tl-pulse-red { 0%{box-shadow:0 0 0 0 rgba(239,68,68,0.6)} 70%{box-shadow:0 0 0 10px rgba(239,68,68,0)} 100%{box-shadow:0 0 0 0 rgba(239,68,68,0)} }
        @keyframes tl-fill { from{width:0%} to{width:100%} }
        @keyframes tl-fill-v { from{height:0%} to{height:100%} }
        @keyframes dot-travel { 0%{left:0} 100%{left:calc(100% - 6px)} }
        @keyframes marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .ticker-track { animation: marquee 60s linear infinite; display:inline-flex; gap:0; white-space:nowrap; font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; }
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
          .ticker-track { font-size: 9px !important; letter-spacing: 0.06em !important; }
          .ticker-track span { padding-left: 20px !important; padding-right: 20px !important; }
          .nav-links-desktop { display: none !important; }
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .how-grid { grid-template-columns: 1fr !important; }
          .how-connector { display: none !important; }
          .how-timeline-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
          .tl-desktop { display: none !important; }
          .tl-mobile { display: flex !important; }
          .pricing-grid { grid-template-columns: 1fr !important; gap: 20px !important; }
          .pricing-card { padding: 24px 20px 32px !important; }
          .pricing-card .pc-spacer { height: 8px !important; }
          .pricing-card .pc-divider { margin-bottom: 12px !important; }
          .pricing-card .pc-subtitle { margin-bottom: 12px !important; }
          .enterprise-card { flex-direction: column !important; align-items: stretch !important; gap: 16px !important; padding: 24px 20px !important; }
          .enterprise-card .enterprise-divider { display: none !important; }
          .enterprise-card .enterprise-features { grid-template-columns: 1fr !important; gap: 6px 0 !important; margin-top: 0 !important; }
          .enterprise-card .enterprise-cta { width: 100% !important; text-align: center !important; }
          .footer-cols { flex-direction: column !important; gap: 32px !important; }
          /* Hero — center on mobile */
          .hero-section { justify-content: center; padding: 80px 20px 40px !important; }
          .hero-truck-bg { display: none !important; }
          .hero-overlay { display: none !important; }
          .hero-glow { display: none !important; }
          .hero-content { text-align: center; max-width: 100% !important; }
          .hero-sub { margin: 0 auto 32px !important; font-size: 16px !important; }
          .hero-ctas { justify-content: center; flex-direction: column; align-items: center; }
          .hero-badge { justify-content: center; }

        }
        @media (min-width: 769px) {
          .tl-desktop { display: block !important; }
          .tl-mobile { display: none !important; }
        }
        @media (max-width: 640px) {
          .founder-card { grid-template-columns: 80px 1fr !important; column-gap: 16px !important; padding: 28px 20px !important; }
          .founder-photo { grid-row: 1 !important; align-self: center; }
          .founder-photo-ring { width: 80px !important; height: 80px !important; padding: 2px !important; }
          .founder-meta { grid-column: 2 !important; grid-row: 1 !important; align-self: center; }
          .founder-meta h3 { font-size: 24px !important; }
          .founder-body { grid-column: 1 / span 2 !important; grid-row: 2 !important; margin-top: 24px !important; }
          .founder-body p { font-size: 14px !important; }
          .founder-grid { display: flex !important; flex-direction: column !important; align-items: flex-start !important; gap: 24px !important; width: 100% !important; }
          .founder-grid > * { width: 100% !important; max-width: 100% !important; }
          .founder-bio { font-size: 15px !important; line-height: 1.8 !important; padding: 0 !important; }
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
            <GlitchText text="Your Ops Never Sleep." delay={400} />
            <span style={{
              color: T.amber, display: 'block',
              textShadow: '0 0 30px rgba(245,166,35,0.65), 0 0 60px rgba(245,166,35,0.3), 0 0 100px rgba(245,166,35,0.15)',
            }}>
              <GlitchText text="Neither Does Ours." delay={900} />
            </span>
          </h1>

          {/* Subheadline */}
          <p className="hero-sub" style={{
            fontSize: 18, color: T.textDim,
            maxWidth: 520, margin: '0 0 44px',
            lineHeight: 1.7, fontWeight: 400,
          }}>
            <TypewriterText text="It's 2:30am. A reefer fault hits on the M62. One SMS. One tap. Back to sleep." speed={28} delay={600} />
          </p>

          {/* CTAs */}
          <div className="hero-ctas" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              className="cta-primary-btn"
              onClick={() => setVideoOpen(true)}
              style={{
                background: '#f5a623', border: 'none', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 10,
                color: '#000', fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 16, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', padding: '16px 32px',
                borderRadius: 6, transition: 'all 0.3s ease',
              }}
            >
              See What Happens At 2:30AM →
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

      {/* ── LIVE INCIDENT TICKER ─────────────────────────────────────────────── */}
      <div style={{ background: '#0a0c0e', padding: '14px 0', marginBottom: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 0 }}>
          <div style={{ paddingLeft: 32, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00e5b0', animation: 'pulse 2s infinite' }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: '#4a5260', letterSpacing: '0.15em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>LIVE FEED</span>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div className="ticker-track ticker-content" style={{ color: '#f5a623', textShadow: '0 0 15px rgba(245,166,35,0.5)', fontSize: 'clamp(9px, 2.5vw, 11px)' }}>
              {['REEFER FAULT · M62 J27 · RESOLVED IN 28s','INVOICE RECOVERY · £4,280 OVERCHARGE DISPUTED · RECOVERED IN 24HRS','TEMP ALARM · NHS LOAD · SLA PROTECTED £2,400','LICENCE CHECK · EXPIRED CPC DETECTED · DRIVER STOOD DOWN','DRIVER HOURS · CASCADE PREVENTED · £900 SAVED','FAILED DELIVERY · NHS SUPPLY CHAIN · CONSIGNEE REBOOKED · SLA SAVED','PANIC BUTTON · DRIVER SAFE · OPS NOTIFIED IN 12s','ROUTE DEVIATION · A1(M) NORTHBOUND · OPS MANAGER ALERTED · JOB PROTECTED','JOB DELAYED · TESCO DC · AUTO-REROUTED · £1,200 PROTECTED','REEFER FAULT · M62 J27 · RESOLVED IN 28s','INVOICE RECOVERY · £4,280 OVERCHARGE DISPUTED · RECOVERED IN 24HRS','TEMP ALARM · NHS LOAD · SLA PROTECTED £2,400','LICENCE CHECK · EXPIRED CPC DETECTED · DRIVER STOOD DOWN','DRIVER HOURS · CASCADE PREVENTED · £900 SAVED','FAILED DELIVERY · NHS SUPPLY CHAIN · CONSIGNEE REBOOKED · SLA SAVED','PANIC BUTTON · DRIVER SAFE · OPS NOTIFIED IN 12s','ROUTE DEVIATION · A1(M) NORTHBOUND · OPS MANAGER ALERTED · JOB PROTECTED','JOB DELAYED · TESCO DC · AUTO-REROUTED · £1,200 PROTECTED'].map((item, i) => (
                <span key={i} style={{ flexShrink: 0, paddingLeft: 'clamp(16px, 4vw, 40px)', paddingRight: 'clamp(16px, 4vw, 40px)', fontSize: 'clamp(9px, 2.5vw, 11px)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase' }}><span style={{ color: 'rgba(245,166,35,0.4)', marginRight: 12 }}>⬥</span>{item}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: '2px', background: 'linear-gradient(to right, rgba(245,166,35,0.03), rgba(245,166,35,0.4), rgba(245,166,35,0.03))' }} />

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────────── */}
      <section id="how" style={{ background: '#0a0c0e', padding: '80px 40px 60px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}>
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
          </motion.div>

          <div className="how-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 24, position: 'relative', alignItems: 'start',
          }}>
            {/* ── Card 1: CONNECT ── */}
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5, delay: 0 }}>
            <div style={{ background: T.navyCard, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '32px 24px', position: 'relative', overflow: 'hidden', boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.4)' }}>
              <div style={{ position: 'absolute', top: 12, right: 16, fontFamily: 'monospace', fontSize: 64, fontWeight: 900, color: 'rgba(245,166,35,0.10)', lineHeight: 1, zIndex: 0 }}>01</div>
              <div style={{ marginBottom: 16, position: 'relative', zIndex: 1 }}>
                <svg width="28" height="28" viewBox="0 0 18 18"><polygon points="9,1 17,5 17,13 9,17 1,13 1,5" fill="#f5a623"/></svg>
              </div>
              <h3 style={{ fontFamily: FF.condensed, fontSize: 22, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#fff', marginBottom: 12 }}>Connect</h3>
              <p style={{ fontSize: 13, color: '#c8cdd4', lineHeight: 1.7, marginBottom: 20, fontWeight: 400 }}>Plugs directly into your existing systems — Mandata, Webfleet, Microlise, Samsara. No new software. No driver training.</p>
              <div style={{ background: T.navyCard, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '12px 14px' }}>
                {[
                  { src: 'Webfleet', evt: 'reefer unit fault detected', hot: true },
                  { src: 'Mandata', evt: 'job running late', hot: false },
                  { src: 'Microlise', evt: 'driver hours at limit', hot: false },
                ].map((w, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: w.hot ? '#f5a623' : '#4a5260' }} />
                    <span style={{ fontFamily: FF.mono, fontSize: 10, color: '#e8eaed', fontWeight: 600 }}>{w.src}</span>
                    <span style={{ fontFamily: FF.mono, fontSize: 10, color: '#4a5260' }}>—</span>
                    <span style={{ fontFamily: FF.mono, fontSize: 10, color: '#f5a623' }}>{w.evt}</span>
                  </div>
                ))}
              </div>
            </div>
            </motion.div>

            {/* ── Connector 1 ── */}
            <div className="how-connector" style={{ position: 'absolute', left: 'calc(33.33% - 12px)', top: 80, width: 24, height: 2, background: 'rgba(255,255,255,0.07)', zIndex: 2 }}>
              <div style={{ position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: '#f5a623', top: -2, animation: 'dot-travel 2s ease-in-out infinite' }} />
            </div>

            {/* ── Card 2: ANALYSE ── */}
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5, delay: 0.15 }}>
            <div style={{ background: T.navyCard, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '32px 24px', position: 'relative', overflow: 'hidden', boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.4)' }}>
              <div style={{ position: 'absolute', top: 12, right: 16, fontFamily: 'monospace', fontSize: 64, fontWeight: 900, color: 'rgba(245,166,35,0.10)', lineHeight: 1, zIndex: 0 }}>02</div>
              <div style={{ marginBottom: 16, position: 'relative', zIndex: 1 }}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#f5a623" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="3" y="5" width="22" height="16" rx="2"/>
                  <circle cx="22" cy="8" r="3" fill="#ef4444" stroke="none"/>
                  <polyline points="7,17 11,12 15,14 20,9"/>
                </svg>
              </div>
              <h3 style={{ fontFamily: FF.condensed, fontSize: 22, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#fff', marginBottom: 12 }}>Analyse</h3>
              <p style={{ fontSize: 13, color: '#c8cdd4', lineHeight: 1.7, marginBottom: 20, fontWeight: 400 }}>AI reads the incident instantly — how serious, what it costs, what breaks next if you do nothing.</p>
              <div style={{ background: T.navyCard, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '12px 14px' }}>
                <div style={{ fontFamily: FF.mono, fontSize: 9, color: '#8a9099', letterSpacing: '0.1em', marginBottom: 8 }}>ASSESSMENT OUTPUT</div>
                {[
                  { k: 'Severity', v: 'CRITICAL', c: '#ef4444' },
                  { k: 'Exposure', v: '£14,000', c: '#f5a623' },
                  { k: 'Cascade risk', v: '3 shipments', c: '#f5a623' },
                  { k: 'Action', v: 'dispatch recovery', c: '#00e5b0' },
                ].map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <span style={{ fontFamily: FF.mono, fontSize: 10, color: '#c8cdd4' }}>— {r.k}</span>
                    <span style={{ fontFamily: FF.mono, fontSize: 10, color: r.c, fontWeight: 600 }}>{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
            </motion.div>

            {/* ── Connector 2 ── */}
            <div className="how-connector" style={{ position: 'absolute', left: 'calc(66.66% - 12px)', top: 80, width: 24, height: 2, background: 'rgba(255,255,255,0.07)', zIndex: 2 }}>
              <div style={{ position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: '#f5a623', top: -2, animation: 'dot-travel 2s ease-in-out infinite', animationDelay: '1s' }} />
            </div>

            {/* ── Card 3: DECIDE ── */}
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5, delay: 0.3 }}>
            <div style={{ background: T.navyCard, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '32px 24px', position: 'relative', overflow: 'hidden', boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.4)' }}>
              <div style={{ position: 'absolute', top: 12, right: 16, fontFamily: 'monospace', fontSize: 64, fontWeight: 900, color: 'rgba(245,166,35,0.10)', lineHeight: 1, zIndex: 0 }}>03</div>
              <div style={{ marginBottom: 16, position: 'relative', zIndex: 1 }}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#f5a623" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="8" y="2" width="12" height="24" rx="2"/>
                  <line x1="11" y1="22" x2="17" y2="22"/>
                </svg>
              </div>
              <h3 style={{ fontFamily: FF.condensed, fontSize: 22, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#fff', marginBottom: 12 }}>Decide</h3>
              <p style={{ fontSize: 13, color: '#c8cdd4', lineHeight: 1.7, marginBottom: 20, fontWeight: 400 }}>One text to ops. Reply YES — driver instructed, consignee called, SLA protected.</p>
              <div style={{ background: T.navyCard, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '14px 14px 12px' }}>
                <div style={{ fontFamily: FF.mono, fontSize: 10, color: '#e8eaed', lineHeight: 1.6, marginBottom: 12 }}>
                  CRITICAL — LK72 ABX reefer fault M62 J27. £14,000 cargo at risk. Reply YES to dispatch recovery, instruct driver, and notify Tesco DC Bradford.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ fontFamily: FF.mono, fontSize: 10, fontWeight: 700, padding: '6px 16px', borderRadius: 4, background: 'rgba(0,229,176,0.12)', border: '1px solid rgba(0,229,176,0.3)', color: '#00e5b0' }}>YES</div>
                  <div style={{ fontFamily: FF.mono, fontSize: 10, fontWeight: 700, padding: '6px 16px', borderRadius: 4, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>NO</div>
                </div>
              </div>
            </div>
            </motion.div>
          </div>

          {/* ── ANIMATED TIMELINE ── */}
          {(() => {
            const steps = [
              { dot: '!', pulse: 'tl-pulse-red', activeColor: '#ef4444', activeBg: 'rgba(239,68,68,0.15)', time: '02:31', label: 'Fault detected', sub: 'Webfleet webhook', big: true },
              { dot: 'AI', pulse: 'tl-pulse', activeColor: '#f5a623', activeBg: 'rgba(245,166,35,0.15)', time: '+3s', label: 'AI analyses', sub: 'Action plan built' },
              { dot: 'SMS', pulse: 'tl-pulse', activeColor: '#f5a623', activeBg: 'rgba(245,166,35,0.15)', time: '+8s', label: 'Ops notified', sub: 'Full brief sent' },
              { dot: 'YES', pulse: 'tl-pulse', activeColor: '#f5a623', activeBg: 'rgba(245,166,35,0.15)', time: '+28s', label: 'Approved', sub: 'One reply from bed' },
              { dot: 'tick', pulse: 'tl-pulse', activeColor: '#00e5b0', activeBg: 'rgba(0,229,176,0.12)', time: '+30s', label: 'Resolved', sub: 'SLA protected', big: true },
            ]
            const nodeStyle = (i) => {
              if (tlStep > i) return { background: 'rgba(0,229,176,0.12)', border: '2px solid #00e5b0', color: '#00e5b0' }
              if (tlStep === i) return { background: steps[i].activeBg, border: `2px solid ${steps[i].activeColor}`, color: steps[i].activeColor, animation: `${steps[i].pulse} 1.5s infinite` }
              return { background: '#0a0c0e', border: '2px solid rgba(255,255,255,0.08)', color: '#4a5260' }
            }
            return (
              <div ref={timelineRef} style={{ marginTop: 56, padding: '32px 24px', background: T.navyCard, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.4)' }}>
                <div style={{ fontFamily: FF.mono, fontSize: 10, color: '#8a9099', letterSpacing: '0.1em', marginBottom: 20, textAlign: 'center' }}>REAL SCENARIO — 2:30AM REEFER FAULT ON M62</div>

                {/* DESKTOP */}
                <div className="tl-desktop">
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {steps.map((s, i) => (
                      <div key={i} style={{ display: 'contents' }}>
                        <div style={{ width: s.big ? 48 : 44, height: s.big ? 48 : 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FF.mono, fontSize: s.dot === '!' ? 16 : 10, fontWeight: s.dot === '!' ? 900 : 700, flexShrink: 0, transition: 'all 0.4s', ...nodeStyle(i) }}>{s.dot === 'tick' ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> : s.dot}</div>
                        {i < steps.length - 1 && (
                          <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #00e5b0, #f5a623)', width: tlStep > i ? '100%' : '0%', transition: 'width 0.6s ease-out' }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', marginTop: 12 }}>
                    {steps.map((s, i) => (
                      <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontFamily: FF.mono, fontSize: 12, color: tlStep >= i ? '#e8eaed' : '#4a5260', fontWeight: 600, transition: 'color 0.3s' }}>{s.time}</div>
                        <div style={{ fontFamily: FF.mono, fontSize: 10, color: tlStep >= i ? '#ffffff' : '#4a5260', fontWeight: 500, marginTop: 2, transition: 'color 0.3s' }}>{s.label}</div>
                        <div style={{ fontFamily: FF.mono, fontSize: 9, color: '#8a9099', marginTop: 1 }}>{s.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* MOBILE */}
                <div className="tl-mobile" style={{ display: 'none', flexDirection: 'column', gap: 0 }}>
                  {steps.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: s.big ? 48 : 36, height: s.big ? 48 : 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FF.mono, fontSize: s.dot === '!' ? 16 : 9, fontWeight: s.dot === '!' ? 900 : 700, flexShrink: 0, transition: 'all 0.4s', ...nodeStyle(i) }}>{s.dot === 'tick' ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> : s.dot}</div>
                        {i < steps.length - 1 && (
                          <div style={{ width: 2, flex: 1, minHeight: 24, margin: '4px auto', background: 'rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', background: 'linear-gradient(to bottom, #00e5b0, #f5a623)', height: tlStep > i ? '100%' : '0%', transition: 'height 0.6s ease-out' }} />
                          </div>
                        )}
                      </div>
                      <div style={{ paddingTop: 6 }}>
                        <div style={{ fontFamily: FF.mono, fontSize: 12, color: tlStep >= i ? '#e8eaed' : '#4a5260', fontWeight: 600, transition: 'color 0.3s' }}>{s.time}</div>
                        <div style={{ fontFamily: FF.mono, fontSize: 11, color: tlStep >= i ? '#ffffff' : '#4a5260', fontWeight: 500, transition: 'color 0.3s' }}>{s.label}</div>
                        <div style={{ fontFamily: FF.mono, fontSize: 9, color: '#8a9099', marginTop: 1, marginBottom: 8 }}>{s.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      </section>

      <div style={{ height: '2px', background: 'linear-gradient(to right, rgba(245,166,35,0.03), rgba(245,166,35,0.4), rgba(245,166,35,0.03))' }} />

      {/* ── PRICING ──────────────────────────────────────────────────────────── */}
      <section id="pricing" style={{
        padding: '60px 40px 100px',
        background: '#0a0c0e',
      }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}>
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
          </motion.div>

          <div className="pricing-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16, marginBottom: 16,
          }}>

            {/* PILOT */}
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5, delay: 0 }}>
            <div className="pricing-card" style={{
              background: T.navyCard,
              border: `1px solid ${T.border}`,
              borderRadius: 4, padding: '32px 28px',
              transition: 'transform 0.2s',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.4)',
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
              <div className="pc-spacer" style={{ height: 16 }} />
              <div className="pc-subtitle" style={{
                fontFamily: FF.condensed, fontSize: 18, fontWeight: 700,
                color: '#fff', marginBottom: 20,
              }}>
                Prove the Value
              </div>
              <div className="pc-divider" style={{ height: 1, background: T.border, marginBottom: 20 }} />
              {['Non-refundable after onboarding call', '30 Days Full Access', 'Proof of Value Report', 'Dedicated Success Manager'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <span style={{ color: T.green, fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span>
                  <span style={{ fontSize: 13, color: T.textDim, lineHeight: 1.5 }}>{f}</span>
                </div>
              ))}
            </div>
            </motion.div>

            {/* FOUNDING COHORT — highlighted */}
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5, delay: 0.1 }}>
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
              <div className="pc-spacer" style={{ fontSize: 13, color: T.textDim, marginBottom: 16 }}>/month · locked for life</div>
              <div className="pc-subtitle" style={{
                fontFamily: FF.condensed, fontSize: 18, fontWeight: 700,
                color: '#fff', marginBottom: 20,
              }}>
                Locked for Life
              </div>
              <div className="pc-divider" style={{ height: 1, background: T.amberBorder, marginBottom: 20 }} />
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
            </motion.div>

            {/* STANDARD */}
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5, delay: 0.2 }}>
            <div className="pricing-card" style={{
              background: T.navyCard,
              border: `1px solid ${T.border}`,
              borderRadius: 4, padding: '32px 28px',
              transition: 'transform 0.2s',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.4)',
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
              <div className="pc-spacer" style={{ fontSize: 13, color: T.textDim, marginBottom: 24 }}>/month · up to 30 vehicles</div>
              <div className="pc-subtitle" style={{
                fontFamily: FF.condensed, fontSize: 18, fontWeight: 700,
                color: '#fff', marginBottom: 20,
              }}>
                Full Platform Access
              </div>
              <div className="pc-divider" style={{ height: 1, background: T.border, marginBottom: 20 }} />
              {['Unlimited AI Triage', 'Real-time Alerts', 'SLA Protection', '24/7 Support', 'API Access'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ color: T.green, fontSize: 13, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 13, color: T.textDim }}>{f}</span>
                </div>
              ))}
            </div>
            </motion.div>

            {/* GROWTH */}
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5, delay: 0.3 }}>
            <div className="pricing-card" style={{
              background: T.navyCard,
              border: `1px solid ${T.border}`,
              borderRadius: 4, padding: '32px 28px',
              transition: 'transform 0.2s',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.4)',
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
              <div className="pc-spacer" style={{ fontSize: 13, color: T.textDim, marginBottom: 24 }}>above 30 vehicles · e.g. 40 vehicles = £579/mo</div>
              <div className="pc-subtitle" style={{
                fontFamily: FF.condensed, fontSize: 18, fontWeight: 700,
                color: '#fff', marginBottom: 20,
              }}>
                Scale Without Limits
              </div>
              <div className="pc-divider" style={{ height: 1, background: T.border, marginBottom: 20 }} />
              {['Everything in Standard', 'Unlimited Vehicles', 'Volume Pricing', 'Dedicated Account Manager'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ color: T.green, fontSize: 13, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 13, color: T.textDim }}>{f}</span>
                </div>
              ))}
            </div>

          </motion.div>
          </div>

          {/* ENTERPRISE — full width below the 4-column grid */}
          <div className="pricing-card enterprise-card" style={{
            background: T.navyCard,
            border: `1px solid ${T.border}`,
            borderRadius: 4, padding: '32px 36px',
            marginBottom: 48,
            display: 'flex', alignItems: 'center', gap: 40, flexWrap: 'wrap',
            transition: 'transform 0.2s',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.4)',
          }}>
            <div style={{ flex: '0 0 220px' }}>
              <div style={{
                fontFamily: FF.mono, fontSize: 10, color: T.textFaint,
                letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 14,
              }}>
                Enterprise
              </div>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 48, fontWeight: 900,
                color: '#f5a623', lineHeight: 1, marginBottom: 6,
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
          </div>

          <div style={{ height: '2px', marginTop: 64, background: 'linear-gradient(to right, rgba(245,166,35,0.03), rgba(245,166,35,0.4), rgba(245,166,35,0.03))' }} />

          {/* ── FOUNDER ────────────────────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}>
          <div className="founder-card founder-grid" style={{
            marginTop: 72, marginBottom: 64,
            padding: '40px 32px',
            background: T.navyCard,
            border: `1px solid ${T.border}`,
            borderRadius: 4,
            boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.4)',
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
            <div className="founder-body founder-bio" style={{ gridColumn: 2, gridRow: 2, minWidth: 0 }}>
              <p style={{
                fontFamily: FF.body, fontSize: 'clamp(14px, 4vw, 16px)', color: T.text,
                lineHeight: 1.8, marginBottom: 18, maxWidth: '100%', wordBreak: 'break-word',
              }}>
                I spent the past year researching the specific pain points hitting UK haulage operators — the data is real, not assumed. In a 2% margin industry, a single Tesco contract lost to repeated SLA penalties isn&apos;t a setback. It&apos;s the end of the business.
              </p>

              <p style={{
                fontFamily: FF.body, fontSize: 'clamp(14px, 4vw, 16px)', color: T.text,
                lineHeight: 1.8, marginBottom: 24, maxWidth: '100%', wordBreak: 'break-word',
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
          </motion.div>

          {/* Main CTA */}
          <div style={{ textAlign: 'center' }}>
            <a
              href="mailto:hello@disruptionhub.ai?subject=Onboarding call — DisruptionHub&body=Hi, I'd like to book my onboarding call to start the £149 pilot."
              onClick={handleMailto}
              style={{
                display: 'inline-block',
                background: '#f5a623', color: '#000',
                fontFamily: 'monospace', fontWeight: 700,
                fontSize: 13, padding: '14px 40px',
                borderRadius: 6, textDecoration: 'none',
                letterSpacing: '0.05em',
              }}
            >
              BOOK YOUR ONBOARDING CALL →
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

      <div style={{ height: '2px', background: 'linear-gradient(to right, rgba(245,166,35,0.03), rgba(245,166,35,0.4), rgba(245,166,35,0.03))' }} />

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer style={{
        background: '#0a0c0e',
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
              src="/demo.mp4?v=2026041502"
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
