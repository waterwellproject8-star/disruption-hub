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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;0,900;1,700;1,800&family=Barlow:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <style>{`
          :root {
            --bg:      #06080d;
            --bg2:     #0d1118;
            --bg3:     #0f1420;
            --accent:  #00e5a8;
            --blue:    #00b8ff;
            --amber:   #ffb627;
            --red:     #ff4545;
            --text:    #eef1f6;
            --text2:   #8a95a8;
            --text3:   #3a4555;
            --border:  rgba(255,255,255,0.07);
            --border2: rgba(255,255,255,0.14);
            --font-sans: 'Barlow', -apple-system, sans-serif;
            --font-disp: 'Barlow Condensed', 'Barlow', sans-serif;
            --font-mono: 'IBM Plex Mono', 'Courier New', monospace;
          }
          body {
            font-family: var(--font-sans);
            -webkit-font-smoothing: antialiased;
            background: var(--bg);
            color: var(--text);
          }
          h1, h2, h3 {
            font-family: var(--font-disp);
          }
          input, textarea, select {
            font-size: 16px !important;
          }
          button, a {
            touch-action: manipulation;
          }
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
