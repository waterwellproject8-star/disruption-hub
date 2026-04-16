import Link from 'next/link'
export default function LegalIndex() {
  return (
    <>
  <style>{`
    @media (max-width: 640px) {
      .legal-wrap { padding: 32px 20px !important; }
      .legal-wrap h1 { font-size: 24px !important; }
      .legal-wrap h2 { font-size: 15px !important; }
      .legal-wrap p { font-size: 13px !important; }
    }
  `}</style>
    <div style={{ maxWidth:800, margin:'0 auto', padding:'60px 32px', fontFamily:"'Barlow Condensed', sans-serif", color:'#e5e7eb', background:'#06080d', minHeight:'100vh' }}>
      <div style={{ marginBottom:48 }}><Link href="/" style={{ fontFamily:'monospace', fontSize:11, color:'#F5A623', textDecoration:'none', letterSpacing:'0.08em' }}>← DISRUPTIONHUB</Link></div>
      <h1 style={{ fontSize:32, fontWeight:300, marginBottom:8, color:'#F5A623' }}>Legal</h1>
      <p style={{ fontSize:14, color:'#e5e7eb', marginBottom:48 }}>DisruptionHub operates under English law. These documents govern your use of the platform.</p>
      {[['terms','Terms of Service'],['privacy','Privacy Policy'],['acceptable-use','Acceptable Use Policy'],['dpa','Data Processing Agreement']].map(([slug,label]) => (
        <Link key={slug} href={`/legal/${slug}`} style={{ display:'block', padding:'20px 24px', background:'#0f1826', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, marginBottom:12, textDecoration:'none' }}>
          <div style={{ fontSize:15, color:'#e5e7eb', fontWeight:500, marginBottom:4 }}>{label}</div>
          <div style={{ fontSize:12, color:'#4a5260', fontFamily:'monospace' }}>disruptionhub.ai/legal/{slug}</div>
        </Link>
      ))}
      <div style={{ marginTop:48, fontSize:13, color:'#4a5260' }}>Questions: <a href="mailto:hello@disruptionhub.ai" style={{ color:'#F5A623', textDecoration:'none' }}>hello@disruptionhub.ai</a></div>
    </div>
    </>
  )
}
