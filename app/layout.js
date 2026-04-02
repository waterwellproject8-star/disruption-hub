import './globals.css'

export const metadata = {
  title: 'DisruptionHub — AI Logistics Operations Intelligence',
  description: 'Real-time AI disruption analysis for logistics companies. Weather, delays, stock failures — triaged and resolved in seconds, not hours.',
  openGraph: {
    title: 'DisruptionHub — AI Logistics Operations Intelligence',
    description: 'Replace 30-minute crisis calls with 30-second AI analysis.',
  }
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </body>
    </html>
  )
}
