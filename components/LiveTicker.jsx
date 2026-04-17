'use client'
import { useEffect, useRef } from 'react'

const ITEMS = [
  'REEFER FAULT · M62 J27 · RESOLVED IN 28S',
  'INVOICE RECOVERY · £4,280 OVERCHARGE DISPUTED · RECOVERED IN 24HRS',
  'TEMP ALARM · NHS LOAD · SLA PROTECTED £2,400',
  'LICENCE CHECK · EXPIRED CPC DETECTED · DRIVER STOOD DOWN',
  'DRIVER HOURS · CASCADE PREVENTED · £900 SAVED',
  'FAILED DELIVERY · NHS SUPPLY CHAIN · CONSIGNEE REBOOKED · SLA SAVED',
  'PANIC BUTTON · DRIVER SAFE · OPS NOTIFIED IN 12S',
  'ROUTE DEVIATION · A1(M) NORTHBOUND · OPS MANAGER ALERTED',
  'JOB DELAYED · TESCO DC · AUTO-REROUTED · £1,200 PROTECTED',
]

export default function LiveTicker() {
  const trackRef = useRef(null)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    let pos = 0
    const speed = 0.4
    let raf
    const step = () => {
      pos -= speed
      if (Math.abs(pos) >= track.scrollWidth / 2) pos = 0
      track.style.transform = `translateX(${pos}px)`
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  const doubled = [...ITEMS, ...ITEMS]

  return (
    <div style={{
      background: '#0a0c0e',
      padding: '10px 0',
      overflow: 'hidden',
      borderTop: '1px solid rgba(255,255,255,0.04)',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
      }}>
        <div style={{
          paddingLeft: 20,
          paddingRight: 16,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          borderRight: '1px solid rgba(255,255,255,0.06)',
          marginRight: 0,
        }}>
          <div style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: '#00e5b0',
          }} />
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 9,
            color: '#4a5260',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}>LIVE FEED</span>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div
            ref={trackRef}
            style={{
              display: 'inline-flex',
              whiteSpace: 'nowrap',
              willChange: 'transform',
            }}
          >
            {doubled.map((item, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  paddingLeft: 28,
                  paddingRight: 28,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 9,
                  color: '#f5a623',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  textShadow: '0 0 12px rgba(245,166,35,0.4)',
                  flexShrink: 0,
                }}
              >
                <span style={{
                  color: 'rgba(245,166,35,0.35)',
                  marginRight: 10,
                  fontSize: 9,
                }}>⬥</span>
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
