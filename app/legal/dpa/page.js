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
      <h1 style={{fontSize:32,fontWeight:300,marginBottom:8,color:'#F5A623'}}>Data Processing Agreement</h1>
      <div style={{fontSize:12,color:'#4a5260',fontFamily:'monospace',marginBottom:48}}>Last updated: April 2026</div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>1. Background and Purpose</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>This Data Processing Agreement ("DPA") forms part of the agreement between DisruptionHub ("Processor") and the subscribing organisation ("Controller") for the use of the DisruptionHub platform.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>This DPA is required where the Controller shares personal data with DisruptionHub in the course of using the platform, and sets out the terms of that processing under UK GDPR Article 28.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>2. Definitions</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>"Personal Data" means any information relating to an identified or identifiable natural person within the meaning of UK GDPR.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>"Processing" means any operation performed on Personal Data including collection, storage, use, and deletion.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>"Sub-processor" means any third party engaged by DisruptionHub to process Personal Data on behalf of the Controller.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>3. Nature and Purpose of Processing</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>DisruptionHub processes Personal Data on behalf of the Controller for the following purposes: providing AI-assisted logistics decision support; storing incident and operational records; generating analysis and recommendations.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Categories of data subjects: employees and contractors of the Controller (including drivers and operations staff); third parties whose details are entered operationally (carrier contacts, customer contacts).</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Categories of personal data: names; job titles; contact telephone numbers; vehicle registration numbers (which may be linked to individuals); location data entered as part of disruption descriptions.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>4. Controller Obligations</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>The Controller warrants that it has a lawful basis under UK GDPR for sharing Personal Data with DisruptionHub.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>The Controller is responsible for ensuring data subjects have been informed about this processing in accordance with UK GDPR Articles 13 and 14.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>The Controller should minimise personal data inputs — operational descriptions can typically be completed using reference numbers, vehicle registrations, and role titles rather than individual names.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>5. Processor Obligations</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>DisruptionHub will process Personal Data only on documented instructions from the Controller.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>DisruptionHub will implement appropriate technical and organisational measures to protect Personal Data against accidental or unlawful destruction, loss, alteration, or unauthorised disclosure.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>DisruptionHub will not engage a new sub-processor without informing the Controller and providing an opportunity to object.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>DisruptionHub will assist the Controller in responding to data subject rights requests within 30 days.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>DisruptionHub will notify the Controller without undue delay (and within 72 hours where feasible) upon becoming aware of a personal data breach.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>6. Sub-Processors</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>The Controller authorises DisruptionHub to engage the following sub-processors:</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Our AI services provider (United States) — AI processing of operational inputs. Transfer to the US is covered by appropriate UK GDPR safeguards including Standard Contractual Clauses.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Our secure database provider (data hosted in the European Economic Area) — database storage and management.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Our hosting provider (United States) — application hosting and delivery. Transfer covered by Standard Contractual Clauses.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Our SMS and voice communications provider — message and call delivery for operational notifications.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>DisruptionHub will maintain an up-to-date list of sub-processors and notify the Controller of any changes.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>7. International Transfers</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Processing by our AI services provider and our hosting provider involves transfer of data to the United States. DisruptionHub has satisfied itself that appropriate safeguards are in place under UK GDPR for these transfers, including Standard Contractual Clauses or equivalent mechanisms.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>If you require copies of the relevant transfer safeguards, contact hello@disruptionhub.ai.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>8. Deletion and Return</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>Upon termination of the subscription, DisruptionHub will delete or anonymise Personal Data within 90 days, except where retention is required by law.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>The Controller may request a data export in JSON format before deletion by contacting hello@disruptionhub.ai.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>9. Audit Rights</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>The Controller may request evidence of DisruptionHub's compliance with this DPA by written request to hello@disruptionhub.ai. DisruptionHub will respond within 30 days with relevant documentation or, where applicable, third-party audit certifications.</p>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>On-site audit rights may be exercised with 30 days notice, at the Controller's cost, no more than once per calendar year.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>10. Term</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>This DPA remains in force for the duration of the subscription agreement and survives termination for as long as DisruptionHub processes Personal Data on behalf of the Controller.</p>
    </div>
  
    <div style={{marginBottom:40,paddingBottom:40,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <h2 style={{fontSize:16,fontWeight:500,color:'#F5A623',marginBottom:16}}>11. Governing Law</h2>
      <p style={{fontSize:14,color:'#e5e7eb',lineHeight:1.8,marginBottom:12}}>This DPA is governed by the laws of England and Wales.</p>
    </div>
      <div style={{marginTop:48,padding:'20px 24px',background:'#0f1826',borderRadius:8,border:'1px solid rgba(255,255,255,0.08)'}}>
        <div style={{fontFamily:'monospace',fontSize:11,color:'#F5A623',marginBottom:8,letterSpacing:'0.08em'}}>PLAIN ENGLISH SUMMARY</div>
        <p style={{fontSize:13,color:'#e5e7eb',lineHeight:1.7,margin:0}}>You are the Controller — you own your data and are responsible for having a lawful reason to share it with us. We are the Processor — we only use it to provide the service. We store it in the EEA. We pass it to our AI services provider (US-based) to generate responses. We delete it within 90 days of you leaving. You can audit us. Contact us for any data requests.</p>
      </div>
      <div style={{marginTop:48,fontSize:13,color:'#4a5260'}}>Questions: <a href="mailto:hello@disruptionhub.ai" style={{color:'#F5A623',textDecoration:'none'}}>hello@disruptionhub.ai</a></div>
    </div>
    </>
  )
}
