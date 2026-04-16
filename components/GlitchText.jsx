'use client'
import { useEffect, useRef, useState } from 'react'

export default function GlitchText({ text, delay = 0 }) {
  const [glitching, setGlitching] = useState(false)
  const [done, setDone] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          setGlitching(true)
          setTimeout(() => {
            setGlitching(false)
            setDone(true)
          }, 600)
        }, delay)
        observer.disconnect()
      }
    }, { threshold: 0.3 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [delay])

  return (
    <span
      ref={ref}
      style={{
        display: 'inline-block',
        position: 'relative',
        animation: glitching ? 'dh-glitch 0.6s steps(2) forwards' : 'none',
      }}
    >
      {text}
    </span>
  )
}
