'use client'
import { useEffect, useState } from 'react'

export default function TypewriterText({ text, speed = 28, delay = 400 }) {
  const [displayed, setDisplayed] = useState('')
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const delayTimer = setTimeout(() => setStarted(true), delay)
    return () => clearTimeout(delayTimer)
  }, [delay])

  useEffect(() => {
    if (!started) return
    if (displayed.length >= text.length) return
    const timer = setTimeout(() => {
      setDisplayed(text.slice(0, displayed.length + 1))
    }, speed)
    return () => clearTimeout(timer)
  }, [started, displayed, text, speed])

  return (
    <span>
      {displayed}
      {displayed.length < text.length && (
        <span style={{
          display: 'inline-block',
          width: 2,
          height: '1em',
          background: '#f5a623',
          marginLeft: 2,
          verticalAlign: 'text-bottom',
          animation: 'blink 1s step-end infinite'
        }} />
      )}
    </span>
  )
}
