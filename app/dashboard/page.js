// Public-facing "invite only" page at /dashboard.
// The real operator console lives at /ops-9x7k (cookie-gated via middleware).
// This page exists so the legacy /dashboard URL is not broken and to route
// cold visitors towards early-access contact rather than a 404.

export const metadata = {
  title: 'DisruptionHub — Invite only',
  description: 'DisruptionHub is currently invite-only. Five founding-cohort spots at £349/mo locked for life.'
}

export default function DashboardInvitePage() {
  return (
    <main style={{
      minHeight: '100vh',
      background: '#06080d',
      color: '#e8eaed',
      fontFamily: 'Barlow, sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 520,
        textAlign: 'center'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 40
        }}>
          <div style={{
            width: 36,
            height: 36,
            background: '#F5A623',
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
          }} />
          <span style={{
            fontFamily: 'monospace',
            fontSize: 13,
            color: '#F5A623',
            letterSpacing: '0.18em',
            fontWeight: 600
          }}>DISRUPTIONHUB</span>
        </div>

        <h1 style={{
          fontSize: 32,
          fontWeight: 500,
          color: '#e8eaed',
          margin: '0 0 18px',
          letterSpacing: '-0.01em',
          lineHeight: 1.2
        }}>DisruptionHub is currently invite-only</h1>

        <p style={{
          fontSize: 16,
          color: '#8a9099',
          lineHeight: 1.6,
          margin: '0 0 36px'
        }}>We&rsquo;re onboarding our founding client cohort &mdash; 5 spots at <span style={{ color: '#F5A623', fontWeight: 600 }}>&pound;349/mo locked for life</span>.</p>

        <a href="mailto:hello@disruptionhub.ai" style={{
          display: 'inline-block',
          padding: '13px 26px',
          background: '#F5A623',
          color: '#06080d',
          fontWeight: 600,
          fontSize: 14,
          borderRadius: 6,
          textDecoration: 'none',
          letterSpacing: '0.01em'
        }}>Interested in early access? Email hello@disruptionhub.ai</a>

        <div style={{
          marginTop: 48,
          paddingTop: 24,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          fontSize: 12,
          color: '#4a5260'
        }}>
          <a href="https://disruptionhub.ai" style={{ color: '#4a5260', textDecoration: 'none' }}>&larr; disruptionhub.ai</a>
        </div>
      </div>
    </main>
  )
}
