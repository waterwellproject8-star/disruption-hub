import Link from 'next/link'

// Shared chrome for /legal/*. Matches main site branding:
// bg #06080d, amber accent #F5A623, Barlow Condensed.
export default function LegalLayout({ children }) {
  const amber = '#F5A623'
  const bg = '#06080d'
  const text = '#e5e7eb'
  const textDim = '#8a9099'
  const textFaint = '#4a5260'
  const borderFaint = '1px solid rgba(255,255,255,0.06)'

  return (
    <div style={{
      minHeight: '100vh',
      background: bg,
      color: text,
      fontFamily: "'Barlow Condensed', sans-serif",
      display: 'flex',
      flexDirection: 'column'
    }}>
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 5%', borderBottom: borderFaint,
        background: 'rgba(6,8,13,0.95)', backdropFilter: 'blur(10px)',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <div style={{
            width: 28, height: 28, background: amber,
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            filter: 'drop-shadow(0 0 8px rgba(245,166,35,0.7))'
          }} />
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 22, fontWeight: 800, letterSpacing: '0.04em',
            color: '#fff', textTransform: 'uppercase'
          }}>
            Disruption<span style={{ color: amber }}>Hub</span>
          </span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link href="/" style={{ fontSize: 13, color: textDim, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Home</Link>
          <Link href="/legal" style={{ fontSize: 13, color: textDim, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Legal</Link>
          <a href="mailto:hello@disruptionhub.ai" style={{
            padding: '9px 18px', background: amber, color: bg,
            fontSize: 13, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            borderRadius: 4, textDecoration: 'none'
          }}>Book a Demo</a>
        </div>
      </nav>

      <main style={{ flex: 1 }}>{children}</main>

      <footer style={{ padding: '48px 5% 32px', borderTop: borderFaint, background: bg }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 64, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ maxWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 22, height: 22, background: amber,
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
              }} />
              <span style={{ fontSize: 17, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Disruption<span style={{ color: amber }}>Hub</span>
              </span>
            </div>
            <div style={{ fontSize: 12, color: textDim, lineHeight: 1.7 }}>
              AI operations intelligence for UK haulage.
            </div>
            <div style={{ marginTop: 14 }}>
              <a href="mailto:hello@disruptionhub.ai" style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12, color: amber, textDecoration: 'none'
              }}>
                hello@disruptionhub.ai
              </a>
            </div>
          </div>
          <div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: textFaint,
              letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12
            }}>Legal</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href="/legal/terms" style={{ fontSize: 13, color: textDim, textDecoration: 'none' }}>Terms of Service</Link>
              <Link href="/legal/privacy" style={{ fontSize: 13, color: textDim, textDecoration: 'none' }}>Privacy Policy</Link>
              <Link href="/legal/acceptable-use" style={{ fontSize: 13, color: textDim, textDecoration: 'none' }}>Acceptable Use</Link>
              <Link href="/legal/dpa" style={{ fontSize: 13, color: textDim, textDecoration: 'none' }}>Data Processing</Link>
            </div>
          </div>
          <div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: textFaint,
              letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12
            }}>Contact</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a href="mailto:hello@disruptionhub.ai" style={{ fontSize: 13, color: textDim, textDecoration: 'none' }}>hello@disruptionhub.ai</a>
            </div>
          </div>
        </div>
        <div style={{
          maxWidth: 1200, margin: '40px auto 0', paddingTop: 24,
          borderTop: '1px solid rgba(255,255,255,0.04)',
          fontSize: 11, color: textFaint,
          fontFamily: "'IBM Plex Mono', monospace"
        }}>
          © {new Date().getFullYear()} DisruptionHub. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
