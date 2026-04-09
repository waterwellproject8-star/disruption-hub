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
    }} />
  )
}

export default function HomePage() {

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
        .nav-link { color: ${T.textDim}; text-decoration: none; font-size: 14px; font-weight: 500; letter-spacing: 0.02em; transition: color 0.2s; font-family: ${FF.body}; }
        .nav-link:hover { color: ${T.text}; }
        .btn-primary { background: ${T.amber}; color: #000; border: none; padding: 11px 24px; font-family: ${FF.condensed}; font-size: 15px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s; border-radius: 3px; }
        .btn-primary:hover { background: ${T.amberBright}; transform: translateY(-1px); box-shadow: 0 6px 24px rgba(245,166,35,0.3); }
        .btn-hero { background: ${T.amber}; color: #000; border: none; padding: 16px 40px; font-family: ${FF.condensed}; font-size: 18px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 10px; transition: all 0.2s; border-radius: 3px; }
        .btn-hero:hover { background: ${T.amberBright}; transform: translateY(-2px); box-shadow: 0 10px 36px rgba(245,166,35,0.35); }
        .btn-outline { background: transparent; color: ${T.amber}; border: 1px solid ${T.amber}; padding: 11px 24px; font-family: ${FF.condensed}; font-size: 15px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s; border-radius: 3px; }
        .btn-outline:hover { background: rgba(245,166,35,0.08); }
        .btn-cta-large { background: ${T.amber}; color: #000; border: none; padding: 18px 48px; font-family: ${FF.condensed}; font-size: 19px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 10px; transition: all 0.2s; border-radius: 3px; }
        .btn-cta-large:hover { background: ${T.amberBright}; transform: translateY(-2px); box-shadow: 0 12px 40px rgba(245,166,35,0.4); }
        .stat-card:hover { border-color: ${T.amberBorder}; transform: translateY(-2px); }
        .how-card:hover { border-color: ${T.amberBorder}; }
        .pricing-card:hover { transform: translateY(-3px); }
        @media (max-width: 768px) {
          .nav-links-desktop { display: none !important; }
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .how-grid { grid-template-columns: 1fr !important; }
          .pricing-grid { grid-template-columns: 1fr !important; }
          .footer-cols { flex-direction: column !important; gap: 32px !important; }
          .hero h1 { font-size: 52px !important; }
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
      <section style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', textAlign: 'center',
        padding: '120px 40px 80px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Ambient amber glow */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `
            radial-gradient(ellipse 80% 60% at 50% 35%, rgba(245,166,35,0.07) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 20% 80%, rgba(245,166,35,0.03) 0%, transparent 60%)
          `,
        }} />

        {/* UK road network SVG */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.07, pointerEvents: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'%3E%3Cdefs%3E%3Cfilter id='glow'%3E%3CfeGaussianBlur stdDeviation='2' result='blur'/%3E%3CfeMerge%3E%3CfeMergeNode in='blur'/%3E%3CfeMergeNode in='SourceGraphic'/%3E%3C/feMerge%3E%3C/filter%3E%3C/defs%3E%3Cg stroke='%23f5a623' stroke-width='1' fill='none' filter='url(%23glow)'%3E%3Cpath d='M400 30 L385 100 L360 165 L330 240 L305 315 L285 395 L265 470 L245 545'/%3E%3Cpath d='M400 30 L415 85 L445 150 L475 215 L505 295 L525 375 L545 445'/%3E%3Cpath d='M80 190 L160 200 L245 210 L330 222 L415 232 L495 228 L575 222 L655 215 L720 205'/%3E%3Cpath d='M130 340 L205 332 L285 323 L365 315 L445 310 L525 318 L605 328'/%3E%3Cpath d='M180 140 L255 192 L318 252 L362 315'/%3E%3Cpath d='M620 140 L555 192 L495 252 L455 315'/%3E%3Cpath d='M245 210 L285 323'/%3E%3Cpath d='M330 222 L365 315'/%3E%3Cpath d='M495 228 L445 310'/%3E%3C/g%3E%3Cg fill='%23f5a623' filter='url(%23glow)'%3E%3Ccircle cx='400' cy='30' r='4'/%3E%3Ccircle cx='305' cy='315' r='3.5'/%3E%3Ccircle cx='505' cy='295' r='3.5'/%3E%3Ccircle cx='415' cy='232' r='3'/%3E%3Ccircle cx='265' cy='470' r='3'/%3E%3Ccircle cx='525' cy='375' r='3'/%3E%3Ccircle cx='180' cy='140' r='3'/%3E%3Ccircle cx='620' cy='140' r='3'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: 'cover', backgroundPosition: 'center',
        }} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: 820 }}>
          {/* Label */}
          <div style={{
            fontFamily: FF.mono, fontSize: 11, fontWeight: 500,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            color: T.amber, marginBottom: 24,
            display: 'inline-flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ width: 28, height: 1, background: T.amber, display: 'inline-block' }} />
            AI Operations Intelligence
            <span style={{ width: 28, height: 1, background: T.amber, display: 'inline-block' }} />
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: FF.condensed,
            fontSize: 'clamp(52px, 9vw, 92px)',
            fontWeight: 900, lineHeight: 0.93,
            letterSpacing: '-0.01em', textTransform: 'uppercase',
            color: '#fff', marginBottom: 28,
          }}>
            Your AI Operations
            <span style={{
              color: T.amber, display: 'block',
              textShadow: '0 0 40px rgba(245,166,35,0.3)',
            }}>
              Room for UK
            </span>
            Haulage
          </h1>

          {/* Subheadline */}
          <p style={{
            fontSize: 18, color: T.textDim,
            maxWidth: 520, margin: '0 auto 44px',
            lineHeight: 1.7, fontWeight: 400,
          }}>
            Triage disruptions in 30 seconds. Protect SLAs.
            Save £40K+ a year. Zero new software to learn.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              className="btn-hero"
              href="mailto:hello@disruptionhub.ai?subject=Pilot request — DisruptionHub&body=Hi, I'd like to start the £99 pilot for my haulage operation."
              onClick={handleMailto}
            >
              Start Your Pilot
            </a>
            <Link href="/dashboard" className="btn-outline">
              View Dashboard →
            </Link>
          </div>

          {/* Social proof */}
          <div style={{
            marginTop: 48, display: 'flex', justifyContent: 'center',
            alignItems: 'center', gap: 8,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.green, animation: 'pulse 2s infinite' }} />
            <span style={{ fontFamily: FF.mono, fontSize: 11, color: T.textFaint, letterSpacing: '0.08em' }}>
              LIVE ON PEARSON HAULAGE — 35 VEHICLES
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
            <div key={i} className="stat-card" style={{
              padding: '44px 32px', textAlign: 'center',
              borderRight: i < 3 ? `1px solid ${T.border}` : 'none',
              transition: 'all 0.2s',
            }}>
              <div style={{
                fontFamily: FF.condensed, fontSize: 54, fontWeight: 900,
                color: T.amber, lineHeight: 1, letterSpacing: '-0.02em',
                marginBottom: 10,
                textShadow: '0 0 30px rgba(245,166,35,0.25)',
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
            <div key={i} className="how-card" style={{
              textAlign: 'center', padding: '40px 32px', position: 'relative', zIndex: 1,
              background: T.navyCard,
              border: `1px solid ${T.border}`,
              borderRadius: 4,
              margin: '0 8px',
              transition: 'border-color 0.2s',
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
                boxShadow: `0 0 20px rgba(245,166,35,0.08)`,
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
            No Tiers. No Complexity.
          </h2>

          <div className="pricing-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16, marginBottom: 48,
          }}>

            {/* MAIN */}
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
                Main
              </div>
              <div style={{
                fontFamily: FF.condensed, fontSize: 56, fontWeight: 900,
                color: T.amber, lineHeight: 1, marginBottom: 4,
                textShadow: '0 0 20px rgba(245,166,35,0.2)',
              }}>
                £399
              </div>
              <div style={{ fontSize: 13, color: T.textDim, marginBottom: 24 }}>/month</div>
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

            {/* FOUNDING CLIENT — highlighted */}
            <div className="pricing-card" style={{
              background: `linear-gradient(135deg, ${T.navyCard}, rgba(245,166,35,0.04))`,
              border: `1px solid ${T.amberBorder}`,
              borderRadius: 4, padding: '32px 28px',
              position: 'relative',
              boxShadow: `0 0 40px rgba(245,166,35,0.1), inset 0 1px 0 rgba(245,166,35,0.15)`,
              transform: 'scale(1.02)',
              transition: 'transform 0.2s',
            }}>
              {/* Top accent line */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                background: `linear-gradient(90deg, transparent, ${T.amber}, transparent)`,
                borderRadius: '4px 4px 0 0',
              }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <div style={{
                  fontFamily: FF.mono, fontSize: 10, color: T.textFaint,
                  letterSpacing: '0.15em', textTransform: 'uppercase',
                }}>
                  Founding Client
                </div>
                <div style={{
                  background: T.red, color: '#fff',
                  fontFamily: FF.condensed, fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  padding: '2px 7px', borderRadius: 2,
                }}>
                  3 Spots Remaining
                </div>
              </div>
              <div style={{
                fontFamily: FF.condensed, fontSize: 56, fontWeight: 900,
                color: T.amber, lineHeight: 1, marginBottom: 4,
                textShadow: '0 0 30px rgba(245,166,35,0.35)',
              }}>
                £299
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
            </div>

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
                  fontFamily: FF.condensed, fontSize: 56, fontWeight: 900,
                  color: T.amber, lineHeight: 1,
                  textShadow: '0 0 20px rgba(245,166,35,0.2)',
                }}>
                  £99
                </div>
                <div style={{
                  fontFamily: FF.condensed, fontSize: 22, fontWeight: 700, color: T.amber,
                }}>
                  / 2 Weeks
                </div>
              </div>
              <div style={{ height: 16 }} />
              <div style={{
                fontFamily: FF.condensed, fontSize: 18, fontWeight: 700,
                color: '#fff', marginBottom: 20,
              }}>
                Pilot Program
              </div>
              <div style={{ height: 1, background: T.border, marginBottom: 20 }} />
              {['Non-refundable after onboarding call', '2 Weeks Full Access', 'Proof of Value Report', 'Dedicated Success Manager'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <span style={{ color: T.green, fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span>
                  <span style={{ fontSize: 13, color: T.textDim, lineHeight: 1.5 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Main CTA */}
          <div style={{ textAlign: 'center' }}>
            <a
              className="btn-cta-large"
              href="mailto:hello@disruptionhub.ai?subject=Onboarding call request — DisruptionHub pilot&body=Hi, I'd like to book my onboarding call to start the £99 pilot."
              onClick={handleMailto}
            >
              Book Your Onboarding Call
            </a>
            <div style={{
              marginTop: 14, fontFamily: FF.mono, fontSize: 11,
              color: T.textFaint, letterSpacing: '0.06em',
            }}>
              £99 pilot · 2 weeks · bank transfer or PayPal
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
              30-second decisions. Zero new software.
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
                <a onClick={handleMailto} href="mailto:hello@disruptionhub.ai?subject=Pilot request" style={{ fontSize: 13, color: T.amber, textDecoration: 'none' }}>Start £99 pilot →</a>
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
            © 2025 DisruptionHub Ltd. All rights reserved. · Decision support only · Always verify before acting.
          </span>
          <span style={{ fontFamily: FF.mono, fontSize: 11, color: T.textFaint }}>
            London, UK
          </span>
        </div>
      </footer>

    </div>
  )
}
