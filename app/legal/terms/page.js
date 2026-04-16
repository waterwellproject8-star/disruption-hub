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
      <h1 style={{fontSize:32,fontWeight:300,marginBottom:8,color:'#F5A623'}}>Terms of Service</h1>
      <div style={{fontSize:12,color:'#4a5260',fontFamily:'monospace',marginBottom:48}}>Last updated: April 2026</div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>1. About DisruptionHub</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>DisruptionHub is an AI-assisted decision support platform for UK logistics operations, operated by Mohammed Nomaan trading as DisruptionHub ("we", "us", "our"). Registered address and company details available on request.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>By accessing or using DisruptionHub you agree to these terms. If you do not agree, do not use the platform.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>2. Nature of the Service — Decision Support Only</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>DisruptionHub provides AI-generated analysis, routing suggestions, action plans, module intelligence, and operational recommendations for informational purposes only.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>The platform does not make operational decisions on your behalf. All outputs are advisory. The operations manager or responsible person at your organisation retains full legal and operational responsibility for every decision taken.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>You must verify all routing suggestions against live traffic data before instructing a driver. You must verify carrier contact details independently. You must validate any regulatory guidance against current DVSA, DfT, and relevant authority publications before acting.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>3. Regulated and High-Risk Cargo</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>If your operation involves temperature-controlled cargo (pharmaceutical, chilled, frozen), dangerous goods (ADR), food products, or any regulated cargo, you accept that DisruptionHub's recommendations must be validated against your own compliance procedures, HACCP plans, and qualified advisors before action.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>DisruptionHub is not a licensed food safety advisor, pharmaceutical logistics consultant, ADR safety adviser, or regulatory compliance officer. Cold chain outputs, ADR outputs, and compliance outputs are operational guidance only.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>You are responsible for maintaining all legally required competencies, certifications, and procedures within your organisation independently of this platform.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>4. NHS and Patient-Critical Deliveries</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>For pharmaceutical, blood product, or any patient-critical delivery, DisruptionHub outputs must be reviewed by a qualified person before action. A delay or error in patient-critical delivery arising from reliance on AI-generated recommendations without human verification is entirely the responsibility of the operator.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>DisruptionHub accepts no liability for any patient harm, clinical incident, or NHS contract consequence.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>5. Accuracy and Limitations</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>AI outputs may contain errors, outdated information, or incorrect junction numbers, contact details, or regulatory figures. The underlying AI models have knowledge cutoffs and do not have real-time access to road conditions, traffic incidents, or live carrier status unless explicitly integrated.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>We use 1.5x time buffers on UK road estimates as standard. These are estimates and not guarantees.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Never rely solely on DisruptionHub for emergency routing, welfare emergencies, or situations where an error could cause harm.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>6. Limitation of Liability</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>To the maximum extent permitted by English law, DisruptionHub's total aggregate liability for any claim arising from use of the platform shall not exceed the total fees paid in the three calendar months immediately preceding the event giving rise to the claim.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>DisruptionHub shall not be liable for: cargo loss or damage; SLA penalty charges; contract termination or suspension; regulatory fines or enforcement action; driver welfare incidents; cold chain integrity failures; loss of profit or revenue; indirect or consequential loss of any kind — whether or not such losses were foreseeable at the date of these terms.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Nothing in these terms excludes liability for death or personal injury caused by negligence, or for fraudulent misrepresentation.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>7. Availability and Continuity</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>The platform is provided on a commercially reasonable efforts basis. We do not guarantee uninterrupted availability. The service depends on third-party infrastructure including Vercel (vercel.com/status) and Anthropic AI API (status.anthropic.com), both subject to independent outages.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>You must maintain your own operational procedures, emergency contact lists, and escalation processes that function independently of DisruptionHub being available.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Planned maintenance will be communicated via hello@disruptionhub.ai where reasonably practicable.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>8. Pilot and Subscription Terms</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>The two-week pilot fee of £99 is non-refundable once the onboarding call has taken place. Cancellation before the onboarding call entitles you to a full refund.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Monthly subscriptions continue until cancelled with 30 days written notice to hello@disruptionhub.ai. No refunds are given for partial months.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Founding client pricing (£499/month) is locked for the lifetime of the account provided the subscription remains active. A break in subscription of more than 60 consecutive days voids the locked rate and the account reverts to standard pricing on reinstatement.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>We reserve the right to adjust standard pricing with 60 days notice. Founding client locked rates are unaffected by standard price changes.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>9. Acceptable Use</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>You must not use the platform to process data about individuals without appropriate legal basis. You must not attempt to reverse-engineer the AI models. You must not share access credentials with third parties outside your organisation. You must not use outputs to make decisions that you have not reviewed.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Full acceptable use requirements are set out in the Acceptable Use Policy at disruptionhub.ai/legal/acceptable-use.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>10. Intellectual Property</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>The DisruptionHub platform, branding, system prompts, module logic, and all associated software remain the intellectual property of DisruptionHub. Use of the platform does not grant you any licence to the underlying technology.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Data you input remains yours. AI-generated outputs produced from your inputs are provided to you for your operational use.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>11. Governing Law</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>These terms are governed exclusively by the laws of England and Wales. Any dispute arising from these terms or your use of the platform is subject to the exclusive jurisdiction of the courts of England and Wales.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>12. Changes to These Terms</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>We may update these terms. Continued use of the platform after notification of changes constitutes acceptance. Material changes will be notified to active subscribers by email at least 30 days before taking effect.</p>
    </div>
      <div style={{marginTop:48,padding:'20px 24px',background:'#0f1826',borderRadius:8,border:'1px solid rgba(255,255,255,0.08)'}}>
        <div style={{fontFamily:'monospace',fontSize:11,color:'#F5A623',marginBottom:8,letterSpacing:'0.08em'}}>PLAIN ENGLISH SUMMARY</div>
        <p style={{fontSize:13,color:'#e5e7eb',lineHeight:1.7,margin:0}}>DisruptionHub helps you make faster, better-informed decisions. It does not make decisions for you. Verify everything before acting. Our liability is capped at 3 months of fees. The pilot is non-refundable after onboarding. Founding client pricing is locked for life while your subscription is active.</p>
      </div>
      <div style={{marginTop:48,fontSize:13,color:'#4a5260'}}>Questions: <a href="mailto:hello@disruptionhub.ai" style={{color:'#F5A623',textDecoration:'none'}}>hello@disruptionhub.ai</a></div>
    </div>
    </>
  )
}
