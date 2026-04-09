import './globals.css'

export const metadata = {
  title: 'DisruptionHub — AI Logistics Operations Intelligence',
  description: 'Real-time AI disruption analysis for logistics companies. Weather, delays, stock failures — triaged and resolved in seconds, not hours.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'DisruptionHub',
    statusBarStyle: 'black-translucent',
  },
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
  },
}

export const viewport = {
  themeColor: '#06080d',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,   // prevents iOS auto-zoom on tap/focus
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </body>
    </html>
  )
}
