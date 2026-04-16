'use client'
import { useEffect, useRef, useState } from 'react'
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
export default function ScrambleText({ text, delay = 200, speed = 40 }) {
  const [display, setDisplay] = useState(text)
  const ref = useRef(null)
  const animated = useRef(false)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !animated.current) {
        animated.current = true
        let iteration = 0
        const interval = setInterval(() => {
          setDisplay(text.split('').map((char, i) => {
            if (char === ' ') return ' '
            if (i < iteration) return text[i]
            return CHARS[Math.floor(Math.random() * CHARS.length)]
          }).join(''))
          iteration += 0.5
          if (iteration >= text.length) clearInterval(interval)
        }, speed)
        observer.disconnect()
      }
    }, { threshold: 0.3 })
    setTimeout(() => {
      if (ref.current) observer.observe(ref.current)
    }, delay)
    return () => observer.disconnect()
  }, [text, delay, speed])
  return <span ref={ref}>{display}</span>
}
