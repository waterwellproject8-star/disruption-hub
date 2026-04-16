'use client'
import { useEffect, useRef, useState } from 'react'
export default function AnimatedStat({ value, prefix = '', suffix = '', duration = 2000 }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  const animated = useRef(false)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !animated.current) {
        animated.current = true
        const start = Date.now()
        const tick = () => {
          const elapsed = Date.now() - start
          const progress = Math.min(elapsed / duration, 1)
          const ease = 1 - Math.pow(1 - progress, 3)
          setDisplay(Math.round(ease * value))
          if (progress < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
        observer.disconnect()
      }
    }, { threshold: 0.5 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [value, duration])
  return <span ref={ref}>{prefix}{display.toLocaleString()}{suffix}</span>
}
