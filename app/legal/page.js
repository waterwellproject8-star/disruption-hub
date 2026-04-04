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
    <div style={{ maxWidth:800, margin:'0 auto', padding:'60px 32px', fontFamily:'IBM Plex Sans, sans-serif', color:'#e8eaed', background:'#0a0c0e', minHeight:'100vh' }}>
      <div style={{ marginBottom:48 }}><Link href="/" style={{ fontFamily:'monospace', fontSize:11, color:'#00e5b0', textDecoration:'none', letterSpacing:'0.08em' }}>← DISRUPTIONHUB</Link></div>
      <h1 style={{ fontSize:32, fontWeight:300, marginBottom:8, color:'#e8eaed' }}>Legal</h1>
      <p style={{ fontSize:14, color:'#8a9099', marginBottom:48 }}>DisruptionHub operates under English law. These documents govern your use of the platform.</p>
      {[['terms','Terms of Service'],['privacy','Privacy Policy'],['acceptable-use','Acceptable Use Policy'],['dpa','Data Processing Agreement']].map(([slug,label]) => (
        <Link key={slug} href={`/legal/${slug}`} style={{ display:'block', padding:'20px 24px', background:'#111418', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, marginBottom:12, textDecoration:'none' }}>
          <div style={{ fontSize:15, color:'#e8eaed', fontWeight:500, marginBottom:4 }}>{label}</div>
          <div style={{ fontSize:12, color:'#4a5260', fontFamily:'monospace' }}>disruptionhub.ai/legal/{slug}</div>
        </Link>
      ))}
      <div style={{ marginTop:48, fontSize:13, color:'#4a5260' }}>Questions: <a href="mailto:hello@disruptionhub.ai" style={{ color:'#00e5b0', textDecoration:'none' }}>hello@disruptionhub.ai</a></div>
    </div>
    </>
  )
}
