'use client'
import { useState, useEffect } from 'react'

const C = {
  bg:      '#0a0c0e',
  surface: '#111418',
  teal:    '#00e5b0',
  red:     '#ef4444',
  amber:   '#f59e0b',
  text:    '#e8eaed',
  muted:   '#8a9099',
  dim:     '#4a5260',
}

const MONO = "'IBM Plex Mono', monospace"
const BODY = "'IBM Plex Sans', sans-serif"

const ANALYSIS_TEXT = `## DISRUPTION ASSESSMENT
- Severity: CRITICAL
- Estimated Financial Impact: £14,000
- Affected Shipments: 3
- Time to Resolution: 4–6 hours

## IMMEDIATE ACTIONS (Do these NOW)
1. Dispatch refrigerated recovery vehicle to M62 J27 — ops manager — within 30 minutes
2. Transfer chilled cargo to replacement reefer before core temp exceeds 5°C — driver + recovery crew — on arrival
3. Notify consignee (Tesco DC Bradford) of revised ETA and cold chain status — ops manager — within 15 minutes`

export default function DashboardPreview() {
  const [charCount, setCharCount] = useState(0)

  useEffect(() => {
    if (charCount >= ANALYSIS_TEXT.length) return
    const speed = charCount < 40 ? 20 : 12
    const t = setTimeout(() => setCharCount(c => Math.min(c + 1, ANALYSIS_TEXT.length)), speed)
    return () => clearTimeout(t)
  }, [charCount])

  const visibleText = ANALYSIS_TEXT.slice(0, charCount)

  return (
    <div style={{
      background: C.bg,
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.08)',
      overflow: 'hidden',
      fontFamily: BODY,
      fontSize: 12,
      color: C.text,
      boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
      width: '100%',
      maxWidth: 960,
    }}>
      <style>{`
        @keyframes dh-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes dh-glow { 0%,100%{box-shadow:0 0 6px rgba(245,158,11,.4)} 50%{box-shadow:0 0 14px rgba(245,158,11,.7)} }
      `}</style>

      {/* ── NAV ───────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', background: C.surface,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
            <polygon points="9,1 17,5 17,13 9,17 1,13 1,5" fill="#f5a623"/>
          </svg>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>Operations Dashboard</span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 4,
          background: 'rgba(245,158,11,0.12)',
          border: '1px solid rgba(245,158,11,0.25)',
          animation: 'dh-glow 2s ease-in-out infinite',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: C.amber,
            animation: 'dh-pulse 1.5s ease-in-out infinite',
          }} />
          <span style={{ fontFamily: MONO, fontSize: 10, color: C.amber, fontWeight: 600, letterSpacing: '0.04em' }}>
            2 AWAITING APPROVAL
          </span>
        </div>
      </div>

      {/* ── BODY ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', minHeight: 420 }}>

        {/* ── LEFT SIDEBAR ────────────────────────────────────────── */}
        <div style={{
          width: 290, flexShrink: 0,
          borderRight: '1px solid rgba(255,255,255,0.06)',
          background: C.bg, padding: '14px 14px 16px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* TODAY metrics */}
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: C.dim, letterSpacing: '0.1em', marginBottom: 10 }}>TODAY</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Metric label="Active" value="4" color={C.text} />
              <Metric label="Alerts" value="2" color={C.red} />
              <Metric label="On Time" value="75%" color={C.text} />
              <Metric label="Saved" value="£7.4K" color={C.teal} />
            </div>
          </div>

          {/* ACTIVE SHIPMENTS */}
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: C.dim, letterSpacing: '0.1em', marginBottom: 10 }}>ACTIVE SHIPMENTS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <ShipmentRow ref_="PH-8832" route="Leeds → London" status="DISRUPTED" color={C.red} />
              <ShipmentRow ref_="PH-5517" route="Leeds → Sheffield" status="DELAYED" color={C.amber} />
              <ShipmentRow ref_="PH-4421" route="Leeds → Bradford" status="ON-TRACK" color={C.teal} />
            </div>
          </div>

          {/* RECENT INCIDENTS */}
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: C.dim, letterSpacing: '0.1em', marginBottom: 10 }}>RECENT INCIDENTS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <IncidentRow sev="CRITICAL" text="Reefer fault — LK72 ABX" time="2m ago" />
              <IncidentRow sev="HIGH" text="M1 breakdown — PH-8832" time="18m ago" />
              <IncidentRow sev="MEDIUM" text="Delayed — NHS Supply" time="42m ago" />
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ─────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg }}>
          {/* Tabs */}
          <div style={{
            display: 'flex', gap: 0,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <Tab label="AGENT" active />
            <Tab label="FEED" />
            <Tab label="COMMAND" badge="2" />
          </div>

          {/* Agent panel */}
          <div style={{ flex: 1, padding: 16, overflow: 'hidden' }}>
            {/* Status bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 14, padding: '8px 12px',
              background: 'rgba(245,158,11,0.06)',
              border: '1px solid rgba(245,158,11,0.15)',
              borderRadius: 6,
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%', background: C.amber,
                animation: 'dh-pulse 1s ease-in-out infinite',
              }} />
              <span style={{ fontFamily: MONO, fontSize: 10, color: C.amber, letterSpacing: '0.06em' }}>
                ANALYSING...
              </span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: C.dim, marginLeft: 'auto' }}>
                LK72 ABX · Reefer Unit Fault
              </span>
            </div>

            {/* Streaming analysis */}
            <div style={{
              background: C.surface,
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 8,
              padding: '14px 16px',
              minHeight: 220,
              overflow: 'hidden',
            }}>
              <AnalysisRender text={visibleText} />
              {charCount < ANALYSIS_TEXT.length && (
                <span style={{
                  display: 'inline-block', width: 7, height: 14,
                  background: C.amber, marginLeft: 2,
                  animation: 'dh-pulse 0.6s step-end infinite',
                }} />
              )}
            </div>

            {/* Action queue buttons */}
            <div style={{
              display: 'flex', gap: 8, marginTop: 12,
            }}>
              <ActionBtn label="APPROVE" color={C.teal} />
              <ActionBtn label="REJECT" color={C.red} />
              <ActionBtn label="ESCALATE" color={C.amber} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, color }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 6,
      background: C.surface,
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ fontFamily: MONO, fontSize: 9, color: C.dim, letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

function ShipmentRow({ ref_, route, status, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 10px', borderRadius: 5,
      background: C.surface,
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: C.text, fontWeight: 600 }}>{ref_}</div>
        <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{route}</div>
      </div>
      <span style={{
        fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
        padding: '3px 8px', borderRadius: 3,
        color, background: `${color}18`, border: `1px solid ${color}30`,
      }}>{status}</span>
    </div>
  )
}

function IncidentRow({ sev, text, time }) {
  const sevColor = { CRITICAL: C.red, HIGH: C.amber, MEDIUM: '#3b82f6' }[sev] || C.muted
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 10px', borderRadius: 5,
      background: C.surface,
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <span style={{
        fontFamily: MONO, fontSize: 9, fontWeight: 700,
        padding: '2px 6px', borderRadius: 3, flexShrink: 0,
        color: sevColor, background: `${sevColor}15`, border: `1px solid ${sevColor}30`,
      }}>{sev}</span>
      <span style={{ fontSize: 11, color: C.text, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
      <span style={{ fontFamily: MONO, fontSize: 9, color: C.dim, flexShrink: 0 }}>{time}</span>
    </div>
  )
}

function Tab({ label, active, badge }) {
  return (
    <div style={{
      padding: '10px 20px',
      fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', fontWeight: 600,
      color: active ? C.amber : C.dim,
      borderBottom: active ? `2px solid ${C.amber}` : '2px solid transparent',
      cursor: 'default',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {label}
      {badge && (
        <span style={{
          fontFamily: MONO, fontSize: 9, fontWeight: 700,
          padding: '1px 5px', borderRadius: 3,
          background: 'rgba(245,158,11,0.15)', color: C.amber,
        }}>{badge}</span>
      )}
    </div>
  )
}

function ActionBtn({ label, color }) {
  return (
    <div style={{
      padding: '8px 16px', borderRadius: 5,
      fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
      color, background: `${color}12`, border: `1px solid ${color}30`,
      cursor: 'default',
    }}>
      {label}
    </div>
  )
}

function AnalysisRender({ text }) {
  const lines = text.split('\n')
  const elements = []
  let k = 0

  for (const line of lines) {
    if (line.startsWith('## ')) {
      const title = line.replace('## ', '')
      const isAction = title.toUpperCase().includes('IMMEDIATE')
      const isAssessment = title.toUpperCase().includes('ASSESSMENT')
      const labelColor = isAction ? C.red : isAssessment ? '#3b82f6' : C.amber
      elements.push(
        <div key={k++} style={{
          fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em',
          color: labelColor, fontWeight: 600,
          marginTop: k > 1 ? 14 : 0, marginBottom: 6,
        }}>{title.toUpperCase()}</div>
      )
      continue
    }
    if (line.startsWith('- ')) {
      const content = line.replace(/^- /, '')
      const hasFinancial = content.includes('£')
      elements.push(
        <div key={k++} style={{ display: 'flex', gap: 6, marginBottom: 3, paddingLeft: 2 }}>
          <span style={{ color: C.dim, fontSize: 10, marginTop: 1 }}>—</span>
          <span style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
            {hasFinancial
              ? content.split(/(£[\d,]+)/).map((part, i) =>
                  part.match(/£[\d,]+/)
                    ? <span key={i} style={{ color: C.amber, fontWeight: 600, fontFamily: MONO }}>{part}</span>
                    : part
                )
              : content}
          </span>
        </div>
      )
      continue
    }
    const numMatch = line.match(/^(\d+)\.\s+(.+)/)
    if (numMatch) {
      const [, num, content] = numMatch
      const urgent = content.includes('NOW') || content.includes('within')
      elements.push(
        <div key={k++} style={{
          display: 'flex', gap: 8, margin: '5px 0', padding: '8px 10px',
          background: 'rgba(0,0,0,0.25)', borderRadius: 5,
          border: urgent ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            background: urgent ? C.red : C.amber,
            color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1,
          }}>{num}</div>
          <div style={{ fontSize: 11, color: C.text, lineHeight: 1.6 }}>{content}</div>
        </div>
      )
      continue
    }
    if (line.trim()) {
      elements.push(
        <div key={k++} style={{ fontSize: 11, color: C.muted, lineHeight: 1.6, marginBottom: 2 }}>{line}</div>
      )
    }
  }
  return <>{elements}</>
}
