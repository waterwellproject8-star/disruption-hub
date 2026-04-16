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
  fontFamily:"'Barlow Condensed', sans-serif", color:'#F5A623',
  background:'#06080d', minHeight:'100vh'
}}>
      <div style={{marginBottom:48}}><Link href="/legal" style={{fontFamily:'monospace',fontSize:11,color:'#F5A623',textDecoration:'none',letterSpacing:'0.08em'}}>← LEGAL</Link></div>
      <h1 style={{fontSize:32,fontWeight:300,marginBottom:8,color:'#F5A623'}}>Privacy Policy</h1>
      <div style={{fontSize:12,color:'#4a5260',fontFamily:'monospace',marginBottom:48}}>Last updated: April 2026</div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>1. Who We Are</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Mohammed Nomaan trading as DisruptionHub ("DisruptionHub", "we", "us"). Data controller for the purposes of UK GDPR.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Contact for data matters: hello@disruptionhub.ai</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>2. What Data We Collect</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Account data: name, email address, company name, phone number provided during onboarding.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Operational data: text you input into the platform describing logistics disruptions, vehicle references, route information, cargo details, and carrier names.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Usage data: pages visited, features used, timestamps, browser type, IP address, device type.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Payment data: invoicing information. Card payments are processed by our payment provider and we do not store card details.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Communications: emails and messages you send to hello@disruptionhub.ai.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>3. How We Use Your Data</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>To provide and improve the DisruptionHub service: your operational inputs are sent to Anthropic's API to generate AI responses. Anthropic's privacy policy applies to this processing.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>To manage your account, send invoices, and provide support.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>To send service updates and material changes to terms (legitimate interest / contract performance).</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>To analyse usage patterns and improve platform performance (legitimate interest).</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>We do not use your operational data to train AI models. We do not sell your data to third parties.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>4. Anthropic API Processing</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Text you input is transmitted to Anthropic's API (api.anthropic.com) for AI processing. By using DisruptionHub you acknowledge this transmission.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Anthropic's data processing and privacy practices: anthropic.com/privacy. Anthropic is based in the United States. Transmission to the US is covered by appropriate safeguards under UK GDPR (Standard Contractual Clauses or equivalent).</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>We recommend you do not input personal data about individuals (such as driver personal phone numbers or home addresses) unless operationally necessary.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>5. Data Storage and Security</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Account and operational data is stored in Supabase (supabase.com), hosted in the EU (Ireland region). Data is encrypted in transit (TLS) and at rest.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Access to operational data is restricted to authorised personnel only. We maintain access logs.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>In the event of a data breach affecting your personal data, we will notify you within 72 hours of becoming aware where required by UK GDPR.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>6. Data Retention</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Account data is retained for the duration of your subscription and for 6 years after termination for legal and accounting purposes.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Operational inputs and AI outputs (incidents, approvals, module runs) are retained for 12 months from creation, then deleted.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>You may request deletion of your operational data at any time by contacting hello@disruptionhub.ai. Account data required for legal compliance cannot be deleted early.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>7. Your Rights Under UK GDPR</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>You have the right to: access the personal data we hold about you; correct inaccurate data; request deletion (subject to legal retention obligations); restrict or object to processing; data portability; and to withdraw consent where processing is based on consent.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>To exercise any right, email hello@disruptionhub.ai. We will respond within 30 days.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>You have the right to lodge a complaint with the Information Commissioner's Office (ICO) at ico.org.uk or 0303 123 1113.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>8. Cookies</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>The dashboard uses localStorage to store your PIN unlock state and session preferences. We do not use third-party tracking cookies.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>The landing page does not set any cookies at this time.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>9. Children</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>DisruptionHub is a B2B platform intended for use by logistics professionals. We do not knowingly collect data from anyone under 18. If you believe a minor has provided us with data, contact hello@disruptionhub.ai.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>10. Changes to This Policy</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>We may update this policy. Material changes will be communicated by email to active subscribers. Continued use constitutes acceptance.</p>
    </div>
      <div style={{marginTop:48,padding:'20px 24px',background:'#0f1826',borderRadius:8,border:'1px solid rgba(255,255,255,0.08)'}}>
        <div style={{fontFamily:'monospace',fontSize:11,color:'#F5A623',marginBottom:8,letterSpacing:'0.08em'}}>PLAIN ENGLISH SUMMARY</div>
        <p style={{fontSize:13,color:'#e5e7eb',lineHeight:1.7,margin:0}}>We collect your name, email, and the operational text you type into the platform. We send that text to Anthropic's AI to generate responses. We store it in an EU database for 12 months. We do not sell it. You can request deletion at any time. Complaints go to the ICO.</p>
      </div>
      <div style={{marginTop:48,fontSize:13,color:'#4a5260'}}>Questions: <a href="mailto:hello@disruptionhub.ai" style={{color:'#F5A623',textDecoration:'none'}}>hello@disruptionhub.ai</a></div>
    </div>
    </>
  )
}
