import './globals.css'

export const metadata = {
  title: 'DisruptionHub — AI Logistics Operations Intelligence',
  description: 'Real-time AI disruption analysis for logistics companies. Weather, delays, stock failures — triaged and resolved in seconds, not hours.',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  openGraph: {
    title: 'DisruptionHub — AI Logistics Operations Intelligence',
    description: 'Replace 30-minute crisis calls with 30-second AI analysis.',
  }
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <style>{`
          /* Prevent iOS zoom on input focus — minimum 16px on all inputs */
          input, textarea, select {
            font-size: 16px !important;
          }
          /* Prevent double-tap zoom on buttons */
          button, a {
            touch-action: manipulation;
          }
          /* Lock scroll bounce on iOS */
          html {
            overflow: hidden;
            height: 100%;
          }
          body {
            height: 100%;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior-y: none;
          }
        `}</style>
      </head>
      <body style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </body>
    </html>
  )
}
