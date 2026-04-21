'use client'
import Link from 'next/link'

export default function ApiDocs() {
  return (
    <div style={{maxWidth:800,margin:'0 auto',padding:'60px 32px',fontFamily:"'Barlow',sans-serif",color:'#e8eaed',background:'#06080d',minHeight:'100vh'}}>
      <div style={{marginBottom:48}}>
        <Link href="/" style={{fontFamily:'monospace',fontSize:11,color:'#f5a623',textDecoration:'none',letterSpacing:'0.08em'}}>{'←'} HOME</Link>
      </div>
      <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:32,fontWeight:700,color:'#f5a623',marginBottom:8}}>API Reference</h1>
      <div style={{fontSize:12,color:'#4a5260',fontFamily:'monospace',marginBottom:48}}>v1 · Last updated April 2026</div>

      <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:700,color:'#f5a623',marginBottom:12}}>Authentication</h2>
        <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>All requests require an API key passed as a header:</p>
        <div style={{background:'#0f1826',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,padding:'14px 16px',fontFamily:'monospace',fontSize:12,color:'#8a9099',marginBottom:12}}>
          x-api-key: your_api_key_here
        </div>
        <p style={{fontSize:13,color:'#4a5260',lineHeight:1.6}}>API keys are issued during onboarding. Contact hello@disruptionhub.ai to request access.</p>
      </div>

      <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:700,color:'#f5a623',marginBottom:12}}>POST /api/v1/ingest</h2>
        <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Submit an operational event for processing.</p>
        <div style={{background:'#0f1826',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,padding:'14px 16px',fontFamily:'monospace',fontSize:12,color:'#8a9099',lineHeight:1.8,whiteSpace:'pre-wrap',marginBottom:12}}>
{`{
  "client_id": "your-client-id",
  "asset_id": "LK72 ABX",
  "event_type": "breakdown",
  "severity": "CRITICAL",
  "description": "M1 J18 — engine failure",
  "ref": "optional-your-reference"
}`}
        </div>
        <p style={{fontSize:13,color:'#4a5260',lineHeight:1.6}}>Returns: {'{ success, ref, message, status }'}</p>
      </div>

      <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:700,color:'#f5a623',marginBottom:12}}>GET /api/v1/status</h2>
        <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Retrieve current fleet status for your account.</p>
        <div style={{background:'#0f1826',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,padding:'14px 16px',fontFamily:'monospace',fontSize:12,color:'#8a9099',lineHeight:1.8,marginBottom:12}}>
          GET /api/v1/status?client_id=your-client-id&asset_id=LK72+ABX
        </div>
        <p style={{fontSize:13,color:'#4a5260',lineHeight:1.6}}>Returns: {'{ fleet: [{ ref, route, status, eta, sla_window, cargo_type }] }'}</p>
      </div>

      <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:700,color:'#f5a623',marginBottom:12}}>Error Codes</h2>
        <div style={{display:'grid',gap:8}}>
          {[
            {code:'ERR_001',desc:'Authentication failure — invalid or missing API key'},
            {code:'ERR_002',desc:'Validation failure — required fields missing'},
            {code:'ERR_003',desc:'Resource not found'},
            {code:'ERR_004',desc:'Server error — request could not be processed'},
          ].map(e=>(
            <div key={e.code} style={{display:'flex',gap:16,alignItems:'baseline'}}>
              <span style={{fontFamily:'monospace',fontSize:12,color:'#f5a623',flexShrink:0}}>{e.code}</span>
              <span style={{fontSize:13,color:'#8a9099'}}>{e.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{marginTop:48,fontSize:13,color:'#4a5260'}}>Questions: <a href="mailto:hello@disruptionhub.ai" style={{color:'#f5a623',textDecoration:'none'}}>hello@disruptionhub.ai</a></div>
    </div>
  )
}
