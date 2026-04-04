import Link from 'next/link'
export default function Page() {
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
    <div style={{
  maxWidth:800, margin:'0 auto', padding:'60px 32px',
  fontFamily:'IBM Plex Sans, sans-serif', color:'#e8eaed',
  background:'#0a0c0e', minHeight:'100vh'
}}>
      <div style={{marginBottom:48}}><Link href="/legal" style={{fontFamily:'monospace',fontSize:11,color:'#00e5b0',textDecoration:'none',letterSpacing:'0.08em'}}>← LEGAL</Link></div>
      <h1 style={{fontSize:32,fontWeight:300,marginBottom:8,color:'#e8eaed'}}>Acceptable Use Policy</h1>
      <div style={{fontSize:12,color:'#4a5260',fontFamily:'monospace',marginBottom:48}}>Last updated: April 2026</div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#e8eaed',marginBottom:16}}>1. Purpose</h2>
      <p style={{fontSize:14,color:'#8a9099',lineHeight:1.8,marginBottom:12}}>This policy sets out what you may and may not do with DisruptionHub. It exists to protect you, other users, and the integrity of the platform. Breach of this policy may result in immediate suspension of your account without refund.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#e8eaed',marginBottom:16}}>2. Permitted Use</h2>
      <p style={{fontSize:14,color:'#8a9099',lineHeight:1.8,marginBottom:12}}>DisruptionHub is licensed for use by logistics operators to assist with operational decision-making relating to freight transport, vehicle management, carrier communication, compliance monitoring, and related logistics functions.</p>
      <p style={{fontSize:14,color:'#8a9099',lineHeight:1.8,marginBottom:12}}>Use is permitted by employees and contractors of the subscribing organisation in the ordinary course of that organisation's logistics operations.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#e8eaed',marginBottom:16}}>3. Prohibited Use — Operations</h2>
      <p style={{fontSize:14,color:'#8a9099',lineHeight:1.8,marginBottom:12}}>You must not rely on DisruptionHub as your sole source of information in any safety-critical decision, welfare emergency, or situation where an error could cause harm to a person.</p>
      <p style={{fontSize:14,color:'#8a9099',lineHeight:1.8,marginBottom:12}}>You must not instruct a driver to reroute, stop, or change cargo handling based solely on an AI output without human verification of the routing instruction.</p>
      <p style={{fontSize:14,color:'#8a9099',lineHeight:1.8,marginBottom:12}}>You must not use DisruptionHub outputs as evidence in legal proceedings, regulatory submissions, or insurance claims without independent verification.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#e8eaed',marginBottom:16}}>4. Prohibited Use — Data and Technical</h2>
      <p style={{fontSize:14,color:'#8a9099',lineHeight:1.8,marginBottom:12}}>You must not input personal data about third parties (drivers, customers, individuals) beyond what is operationally necessary.</p>
      <p style={{fontSize:14,color:'#8a9099',lineHeight:1.8,marginBottom:12}}>You must not attempt to extract, reverse-engineer, or replicate the underlying system prompts, module logic, or AI training of the platform.</p>
      <p style={{fontSize:14,color:'#8a9099',lineHeight:1.8,marginBottom:12}}>You must not attempt to circumvent rate limits, access controls, or security measures.</p>
      <p style={{fontSize:14,color:'#8a9099',lineHeight:1.8,marginBottom:12}}>You must not share your login credentials with anyone outside your subscribing organisation.</p>
      <p style={{fontSize:14,color:'#8a9099',lineHeight:1.8,marginBottom:12}}>You must not use the platform to generate content for resale or to compete with DisruptionHub.</p>
      <p style={{fontSize:14,color:'#8a9099',lineHeight:1.8,marginBottom:12}}>You must not use the platform for any unlawful purpose or in violation of any applicable regulation.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#e8eaed',marginBottom:16}}>5. Prohibited Use — Content</h2>
      <p style={{fontSize:14,color:'#8a9099',lineHeight:1.8,marginBottom:12}}>You must not input content that is defamatory, offensive, or designed to harass any individual.</p>
      <p style={{fontSize:14,color:'#8a9099',lineHeight:1.8,marginBottom:12}}>You must not input content that contains trade secrets or confidential information of a third party without authorisation to do so.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#e8eaed',marginBottom:16}}>6. Shared Responsibility</h2>
      <p style={{fontSize:14,color:'#8a9099',lineHeight:1.8,marginBottom:12}}>AI outputs may be incorrect. You are responsible for reviewing every output before acting. The existence of a suggested action does not constitute authorisation or approval.</p>
      <p style={{fontSize:14,color:'#8a9099',lineHeight:1.8,marginBottom:12}}>You are responsible for ensuring your team understands that DisruptionHub is a decision-support tool, not an autonomous decision-maker.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#e8eaed',marginBottom:16}}>7. Reporting Misuse</h2>
      <p style={{fontSize:14,color:'#8a9099',lineHeight:1.8,marginBottom:12}}>If you become aware of misuse of the platform or a security issue, report it immediately to hello@disruptionhub.ai.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#e8eaed',marginBottom:16}}>8. Consequences of Breach</h2>
      <p style={{fontSize:14,color:'#8a9099',lineHeight:1.8,marginBottom:12}}>Breach of this policy may result in suspension or termination of your account. No refund is due where termination arises from breach of this policy.</p>
      <p style={{fontSize:14,color:'#8a9099',lineHeight:1.8,marginBottom:12}}>We reserve the right to report serious breaches (including unlawful use) to relevant authorities.</p>
    </div>
      <div style={{marginTop:48,padding:'20px 24px',background:'#111418',borderRadius:8,border:'1px solid rgba(255,255,255,0.08)'}}>
        <div style={{fontFamily:'monospace',fontSize:11,color:'#00e5b0',marginBottom:8,letterSpacing:'0.08em'}}>PLAIN ENGLISH SUMMARY</div>
        <p style={{fontSize:13,color:'#8a9099',lineHeight:1.7,margin:0}}>Use the platform for logistics operations decisions. Verify everything before acting. Do not share your login. Do not input unnecessary personal data. Do not try to reverse-engineer the system. Act like a professional and use it as the decision-support tool it is.</p>
      </div>
      <div style={{marginTop:48,fontSize:13,color:'#4a5260'}}>Questions: <a href="mailto:hello@disruptionhub.ai" style={{color:'#00e5b0',textDecoration:'none'}}>hello@disruptionhub.ai</a></div>
    </div>
    </>
  )
}
