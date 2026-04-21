'use client'

export default function TwoAmTest() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800;900&family=Barlow+Condensed:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes amber-glow-pulse{0%,100%{box-shadow:0 0 20px rgba(245,166,35,0.3),0 0 40px rgba(245,166,35,0.1)}50%{box-shadow:0 0 40px rgba(245,166,35,0.6),0 0 80px rgba(245,166,35,0.25)}}
        @keyframes red-pulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.6)}70%{box-shadow:0 0 0 12px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}
        @keyframes scan{0%{left:-100%}100%{left:200%}}
        @keyframes number-flash{0%,100%{color:#ef4444}50%{color:#ff6b6b;text-shadow:0 0 30px rgba(239,68,68,0.8)}}
        @keyframes timer-drain{from{width:100%}to{width:0%}}
        @keyframes float{0%,100%{transform:translateY(0px)}50%{transform:translateY(-6px)}}
        @keyframes blink-bg{0%,100%{opacity:1}50%{opacity:0.3}}
        .twoam-body{background:#0a0c0e;color:#e8eaed;font-family:'Barlow',sans-serif;overflow-x:hidden;min-height:100vh}
        .twoam-hero{min-height:100vh;display:flex;align-items:center;padding:120px 40px 80px;position:relative;overflow:hidden}
        .hero-grid{position:absolute;inset:0;pointer-events:none;opacity:0.04;background-image:linear-gradient(rgba(245,166,35,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(245,166,35,0.8) 1px,transparent 1px);background-size:80px 80px}
        .hero-glow{position:absolute;inset:0;background:radial-gradient(ellipse 60% 50% at 50% 60%,rgba(245,166,35,0.04) 0%,transparent 70%);pointer-events:none}
        .hero-timebg{position:absolute;right:-20px;top:50%;transform:translateY(-50%);font-family:'IBM Plex Mono',monospace;font-size:clamp(80px,14vw,180px);font-weight:600;color:rgba(255,255,255,0.05);line-height:1;pointer-events:none;letter-spacing:-4px;user-select:none;animation:blink-bg 4s ease-in-out infinite}
        .eyebrow{display:inline-flex;align-items:center;gap:12px;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#f5a623;margin-bottom:24px;text-shadow:0 0 20px rgba(245,166,35,0.5)}
        .eyebrow::before,.eyebrow::after{content:'';width:28px;height:1px;background:#f5a623;box-shadow:0 0 8px rgba(245,166,35,0.8)}
        .hero-h1{font-family:'Barlow Condensed',sans-serif;font-size:clamp(52px,8vw,96px);font-weight:900;line-height:0.93;letter-spacing:-0.01em;text-transform:uppercase;color:#fff;margin-bottom:24px}
        .hero-h1 em{font-style:normal;color:#f5a623;text-shadow:0 0 40px rgba(245,166,35,0.5),0 0 80px rgba(245,166,35,0.2)}
        .hero-sub{font-size:18px;color:#8a9099;max-width:560px;margin:0 0 40px;line-height:1.7}
        .hero-sub strong{color:#e8eaed;font-weight:600}
        .btn-hero{background:#f5a623;color:#000;border:none;padding:16px 36px;font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:10px;border-radius:3px;box-shadow:0 0 25px rgba(245,166,35,0.5),0 0 50px rgba(245,166,35,0.2)}
        .btn-ghost{background:transparent;color:#8a9099;border:1px solid rgba(255,255,255,0.12);padding:16px 28px;font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;text-decoration:none;border-radius:3px}
        .divider{padding:40px;background:#0a0c0e;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
        .divider::before,.divider::after{content:'';position:absolute;left:0;right:0;height:1px;background:linear-gradient(to right,transparent,rgba(245,166,35,0.3),transparent)}
        .divider::before{top:0}.divider::after{bottom:0}
        .divider-text{font-family:'Barlow Condensed',sans-serif;font-size:clamp(20px,3vw,30px);font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#e8eaed;text-align:center;max-width:800px;line-height:1.3}
        .divider-text em{color:#f5a623;font-style:normal}
        .comparison{padding:80px 40px;max-width:1100px;margin:0 auto}
        .cmp-eyebrow{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#f5a623;margin-bottom:16px;text-align:center}
        .cmp-title{font-family:'Barlow Condensed',sans-serif;font-size:clamp(48px,7vw,88px);font-weight:900;line-height:0.93;letter-spacing:-1px;text-transform:uppercase;text-align:center;margin-bottom:60px}
        .cmp-title .red{color:#ef4444;text-shadow:0 0 30px rgba(239,68,68,0.4)}
        .cmp-title .amber{color:#f5a623;text-shadow:0 0 30px rgba(245,166,35,0.5)}
        .col-headers{display:grid;grid-template-columns:1fr 60px 1fr;margin-bottom:0}
        .col-hdr-without{background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-bottom:none;border-radius:3px 3px 0 0;padding:28px 32px;position:relative;overflow:hidden}
        .col-hdr-without::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:#ef4444}
        .col-hdr-with{background:rgba(245,166,35,0.04);border:1px solid rgba(245,166,35,0.25);border-bottom:none;border-radius:3px 3px 0 0;padding:28px 32px;position:relative;overflow:hidden}
        .col-hdr-with::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:#f5a623;box-shadow:0 0 20px rgba(245,166,35,0.6)}
        .col-hdr-label{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;margin-bottom:8px}
        .col-hdr-without .col-hdr-label{color:rgba(239,68,68,0.7)}
        .col-hdr-with .col-hdr-label{color:rgba(245,166,35,0.7)}
        .col-hdr-title{font-family:'Barlow Condensed',sans-serif;font-size:clamp(32px,4vw,54px);font-weight:900;line-height:0.95;letter-spacing:-0.5px;text-transform:uppercase}
        .col-hdr-without .col-hdr-title{color:#ef4444}
        .col-hdr-with .col-hdr-title{color:#f5a623}
        .col-hdr-sub{font-size:14px;color:#8a9099;margin-top:8px;line-height:1.5}
        .col-vs{display:flex;align-items:flex-end;justify-content:center;padding-bottom:0}
        .vs-circle{width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;color:#4a5260;background:#0a0c0e}
        .grid-cols{display:grid;grid-template-columns:1fr 60px 1fr}
        .without-col{background:rgba(239,68,68,0.03);border:1px solid rgba(239,68,68,0.15);border-top:none;border-radius:0 0 3px 3px}
        .with-col{background:rgba(245,166,35,0.02);border:1px solid rgba(245,166,35,0.18);border-top:none;border-radius:0 0 3px 3px}
        .mid-col{display:flex;flex-direction:column;align-items:center;padding:0 8px}
        .mid-step{flex:1;display:flex;align-items:center;justify-content:center;position:relative;width:100%;min-height:80px}
        .mid-line{position:absolute;top:0;bottom:0;left:50%;width:1px;background:rgba(255,255,255,0.06);transform:translateX(-50%)}
        .tl-item{display:flex;gap:16px;padding:22px 24px;border-bottom:1px solid rgba(255,255,255,0.05)}
        .tl-item:last-child{border-bottom:none}
        .tl-dot-wrap{display:flex;flex-direction:column;align-items:center;flex-shrink:0;width:28px}
        .tl-dot-red{width:12px;height:12px;border-radius:50%;background:#ef4444;margin-top:4px;animation:red-pulse 2s infinite}
        .tl-dot-amber{width:12px;height:12px;border-radius:50%;background:#f5a623;margin-top:4px;box-shadow:0 0 10px rgba(245,166,35,0.5)}
        .tl-dot-dim{width:12px;height:12px;border-radius:50%;background:rgba(255,255,255,0.15);margin-top:4px}
        .tl-vline-red{flex:1;width:1px;background:rgba(239,68,68,0.12);margin-top:4px}
        .tl-vline-amber{flex:1;width:1px;background:rgba(245,166,35,0.15);margin-top:4px}
        .tl-time-red{font-family:'IBM Plex Mono',monospace;font-size:10px;color:rgba(239,68,68,0.6);letter-spacing:0.08em;margin-bottom:4px}
        .tl-time-amber{font-family:'IBM Plex Mono',monospace;font-size:10px;color:rgba(245,166,35,0.6);letter-spacing:0.08em;margin-bottom:4px}
        .tl-title{font-size:15px;font-weight:700;color:#e8eaed;margin-bottom:4px;line-height:1.3}
        .tl-sub{font-size:13px;color:#8a9099;line-height:1.55}
        .sms{margin-top:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:3px 12px 12px 3px;padding:10px 13px;font-size:12px;color:#8a9099;line-height:1.55;font-family:'IBM Plex Mono',monospace;letter-spacing:0.02em}
        .sms strong{color:#f5a623;font-weight:600}
        .sms-reply{margin-top:8px;margin-left:auto;max-width:80%;background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.2);border-radius:12px 3px 3px 12px;padding:10px 13px;font-size:12px;color:rgba(255,255,255,0.85);font-family:'IBM Plex Mono',monospace;text-align:right}
        .totals{display:grid;grid-template-columns:1fr 60px 1fr;margin-top:16px;gap:0}
        .total-without{background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:3px;padding:28px 32px;display:flex;align-items:center;justify-content:space-between}
        .total-with{background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.25);border-radius:3px;padding:28px 32px;display:flex;align-items:center;justify-content:space-between;animation:amber-glow-pulse 3s ease-in-out infinite}
        .total-label{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#4a5260;margin-bottom:6px}
        .total-val-red{font-family:'Barlow Condensed',sans-serif;font-size:clamp(40px,5vw,64px);font-weight:900;line-height:0.95;letter-spacing:-1px;color:#ef4444;animation:number-flash 3s ease-in-out infinite}
        .total-val-amber{font-family:'Barlow Condensed',sans-serif;font-size:clamp(40px,5vw,64px);font-weight:900;line-height:0.95;letter-spacing:-1px;color:#f5a623;text-shadow:0 0 30px rgba(245,166,35,0.5)}
        .approval-wrap{padding:0 40px 80px;max-width:1100px;margin:0 auto}
        .approval-inner{background:#0d1014;border:1px solid rgba(255,255,255,0.12);border-radius:3px;padding:56px;position:relative;overflow:hidden}
        .approval-inner::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(to right,transparent,#f5a623,transparent);box-shadow:0 0 20px rgba(245,166,35,0.4)}
        .scan-line{position:absolute;top:0;left:-100%;bottom:0;width:40%;background:linear-gradient(to right,transparent,rgba(245,166,35,0.03),transparent);animation:scan 4s ease-in-out infinite;pointer-events:none}
        .approval-grid{display:grid;grid-template-columns:1fr 300px;gap:56px;align-items:center}
        .approval-tag{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#f5a623;margin-bottom:16px}
        .approval-title{font-family:'Barlow Condensed',sans-serif;font-size:clamp(36px,4vw,54px);font-weight:900;line-height:0.95;letter-spacing:-0.5px;text-transform:uppercase;color:#fff;margin-bottom:20px}
        .approval-title em{font-style:normal;color:#f5a623}
        .approval-body{font-size:15px;color:#8a9099;line-height:1.7;margin-bottom:32px}
        .steps-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .step-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:3px;padding:16px 18px}
        .step-num{font-family:'IBM Plex Mono',monospace;font-size:9px;color:rgba(245,166,35,0.5);letter-spacing:0.12em;margin-bottom:8px}
        .step-title{font-size:14px;font-weight:700;color:#e8eaed;margin-bottom:5px;line-height:1.3}
        .step-sub{font-size:12px;color:#8a9099;line-height:1.5}
        .phone-wrap{background:#14161c;border:1px solid rgba(255,255,255,0.15);border-radius:24px;padding:18px;width:100%;box-shadow:0 0 60px rgba(0,0,0,0.5),0 0 30px rgba(245,166,35,0.1);animation:float 4s ease-in-out infinite}
        .phone-bar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding:0 4px}
        .phone-time{font-family:'IBM Plex Mono',monospace;font-size:13px;color:#fff;font-weight:600}
        .phone-icons{font-family:'IBM Plex Mono',monospace;font-size:10px;color:rgba(255,255,255,0.5)}
        .phone-msg{border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)}
        .phone-hdr{background:#0d1014;padding:12px 14px 10px;border-bottom:1px solid rgba(255,255,255,0.06)}
        .phone-from{font-family:'IBM Plex Mono',monospace;font-size:9px;color:#f5a623;letter-spacing:0.1em;margin-bottom:2px}
        .phone-name{font-size:13px;font-weight:700;color:#e8eaed}
        .phone-body{background:#0a0c0e;padding:14px}
        .phone-text{font-family:'IBM Plex Mono',monospace;font-size:11px;color:rgba(255,255,255,0.65);line-height:1.6;margin-bottom:14px}
        .phone-text strong{color:#f5a623;font-weight:600}
        .phone-btns{display:flex;gap:8px}
        .phone-btn-yes{flex:1;padding:9px 6px;border-radius:4px;background:rgba(245,166,35,0.15);border:1px solid rgba(245,166,35,0.4);color:#f5a623;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:0.08em;text-align:center;box-shadow:0 0 12px rgba(245,166,35,0.2)}
        .phone-btn-no{flex:1;padding:9px 6px;border-radius:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#4a5260;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:0.08em;text-align:center}
        .phone-timer{height:2px;background:rgba(255,255,255,0.06);border-radius:1px;margin-top:10px;overflow:hidden}
        .phone-timer-bar{height:100%;background:#f5a623;border-radius:1px;animation:timer-drain 8s linear infinite}
        .stat-wrap{max-width:1100px;margin:0 auto;padding:0 40px 80px}
        .stat-inner{display:grid;grid-template-columns:1fr 1px 1fr 1px 1fr;border:1px solid rgba(255,255,255,0.12);border-radius:3px;overflow:hidden}
        .stat-item{padding:40px;text-align:center}
        .stat-divider{background:rgba(255,255,255,0.08)}
        .stat-red{font-family:'Barlow Condensed',sans-serif;font-size:clamp(56px,7vw,88px);font-weight:900;line-height:0.9;letter-spacing:-2px;display:block;margin-bottom:10px;color:#ef4444;animation:number-flash 4s ease-in-out infinite}
        .stat-amber{font-family:'Barlow Condensed',sans-serif;font-size:clamp(56px,7vw,88px);font-weight:900;line-height:0.9;letter-spacing:-2px;display:block;margin-bottom:10px;color:#f5a623;text-shadow:0 0 40px rgba(245,166,35,0.5),0 0 80px rgba(245,166,35,0.2)}
        .stat-green{font-family:'Barlow Condensed',sans-serif;font-size:clamp(56px,7vw,88px);font-weight:900;line-height:0.9;letter-spacing:-2px;display:block;margin-bottom:10px;color:#00e5b0;text-shadow:0 0 30px rgba(0,229,176,0.4)}
        .stat-lbl-title{font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:700;letter-spacing:0.02em;text-transform:uppercase;color:#e8eaed;display:block;margin-bottom:4px}
        .stat-lbl-sub{font-size:13px;color:#8a9099}
        .cta-sec{border-top:1px solid rgba(255,255,255,0.08);padding:80px 40px;text-align:center;background:#0a0c0e;position:relative;overflow:hidden}
        .cta-sec::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 50% 60% at 50% 100%,rgba(245,166,35,0.06),transparent);pointer-events:none}
        .cta-title{font-family:'Barlow Condensed',sans-serif;font-size:clamp(42px,6vw,68px);font-weight:900;line-height:0.93;letter-spacing:-0.5px;text-transform:uppercase;margin-bottom:18px}
        .cta-title em{font-style:normal;color:#f5a623}
        .cta-sub{font-size:16px;color:#8a9099;margin-bottom:36px;line-height:1.6;max-width:500px;margin-left:auto;margin-right:auto}
        .btn-cta{background:#f5a623;color:#000;border:none;padding:18px 44px;font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;text-decoration:none;border-radius:3px;display:inline-flex;align-items:center;gap:10px;box-shadow:0 0 30px rgba(245,166,35,0.4),0 0 60px rgba(245,166,35,0.15)}
        .btn-outline-cta{background:transparent;color:#8a9099;border:1px solid rgba(255,255,255,0.12);padding:18px 32px;font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;text-decoration:none;border-radius:3px}
      `}</style>

      <div className="twoam-body">

        {/* NAV */}
        <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 40px',borderBottom:'1px solid rgba(255,255,255,0.06)',position:'fixed',top:0,left:0,right:0,zIndex:100,background:'rgba(10,12,14,0.95)',backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)'}}>
          <a href="/" style={{display:'flex',alignItems:'center',gap:8,textDecoration:'none'}}>
            <div style={{width:22,height:22,background:'#f5a623',clipPath:'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',flexShrink:0}}/>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:'#f5a623'}}>DisruptionHub</span>
          </a>
          <ul style={{display:'flex',alignItems:'center',gap:28,listStyle:'none',margin:0,padding:0}}>
            <li><a href="/" style={{color:'#8a9099',textDecoration:'none',fontSize:14,fontWeight:500}}>Home</a></li>
            <li><span style={{color:'#f5a623',fontSize:14,fontWeight:600}}>The 60-Second Fix</span></li>
            <li><a href="/#how" style={{color:'#8a9099',textDecoration:'none',fontSize:14,fontWeight:500}}>Platform</a></li>
            <li><a href="/#pricing" style={{color:'#8a9099',textDecoration:'none',fontSize:14,fontWeight:500}}>Pricing</a></li>
          </ul>
        </nav>

        {/* HERO */}
        <section className="twoam-hero">
          <div className="hero-grid" />
          <div className="hero-glow" />
          <div className="hero-timebg">02:14</div>
          <div style={{maxWidth:1100,margin:'0 auto',width:'100%',position:'relative',zIndex:2}}>
            <div className="eyebrow">The 60-Second Fix</div>
            <h1 className="hero-h1">
              A breakdown hits.<br/>
              You get a text.<br/>
              <em>You reply YES.</em><br/>
              Back to sleep.
            </h1>
            <p className="hero-sub">
              Without DisruptionHub, that breakdown means <strong>34 minutes of calls</strong> to recovery, the driver, and the consignee — while your SLA bleeds out. With DisruptionHub, ops handles all three with a single text reply. Total time awake: <strong>60 seconds.</strong>
            </p>
            <div style={{display:'flex',gap:14,alignItems:'center',flexWrap:'wrap'}}>
              <a href="#comparison" className="btn-hero">See the 60-second proof ↓</a>
              <a href="mailto:hello@disruptionhub.ai" className="btn-ghost">Start £149 pilot →</a>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginTop:40}}>
              <div style={{width:7,height:7,borderRadius:'50%',background:'#00e5b0',animation:'pulse 2s infinite'}} />
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:'#4a5260',letterSpacing:'0.08em'}}>LIVE PLATFORM · DEMO AVAILABLE NOW</span>
            </div>
          </div>
        </section>

        {/* DIVIDER 1 */}
        <div className="divider">
          <p className="divider-text">One breakdown. <em>34 minutes of chaos</em> — or 60 seconds.</p>
        </div>

        {/* COMPARISON */}
        <div id="comparison" className="comparison">
          <div className="cmp-eyebrow">Side by side</div>
          <h2 className="cmp-title">
            <span className="red">Without DH</span><br/>
            vs<br/>
            <span className="amber">With DH</span>
          </h2>

          {/* Column headers */}
          <div className="col-headers">
            <div className="col-hdr-without">
              <div className="col-hdr-label">Without DisruptionHub</div>
              <div className="col-hdr-title">34 Minutes<br/>Of Chaos</div>
              <div className="col-hdr-sub">Phone calls, hold music, voicemails. No audit trail. SLA haemorrhaging.</div>
            </div>
            <div className="col-vs"><div className="vs-circle">VS</div></div>
            <div className="col-hdr-with">
              <div className="col-hdr-label">With DisruptionHub</div>
              <div className="col-hdr-title">60 Seconds.<br/>Back To Bed.</div>
              <div className="col-hdr-sub">One text. One reply. Recovery arranged, driver briefed, consignee updated.</div>
            </div>
          </div>

          {/* Main grid */}
          <div className="grid-cols">
            {/* WITHOUT */}
            <div className="without-col">
              {[
                {time:'02:14',title:'Driver calls ops manager',sub:'Woken from sleep. Scrambling to understand location, vehicle, load type. Still half-asleep.',red:true},
                {time:'02:18',title:'Ops calls breakdown recovery',sub:'Finds the number, explains the situation, listens to hold music. Eventually gets an ETA of 55 minutes.',red:true},
                {time:'02:29',title:'Ops calls the driver back',sub:'Relays the ETA. Asks about cargo temperature. Realises the Tesco slot closes at 23:30 — SLA at risk.',red:true},
                {time:'02:35',title:'Ops tries to call the consignee',sub:'Rings the main number. No answer. Tries out-of-hours. Leaves a voicemail nobody hears until 8am.',red:false},
                {time:'02:48',title:'Tries to write it up. Gives up.',sub:'Notes on their phone. Nothing formal. No audit trail. No confirmation sent to anyone. Goes back to bed, still stressed.',red:false,last:true},
              ].map((item,i)=>(
                <div className="tl-item" key={i} style={item.last?{borderBottom:'none'}:{}}>
                  <div className="tl-dot-wrap">
                    <div className={item.red?'tl-dot-red':'tl-dot-dim'} />
                    {!item.last&&<div className="tl-vline-red" />}
                  </div>
                  <div>
                    <div className="tl-time-red">{item.time}</div>
                    <div className="tl-title">{item.title}</div>
                    <div className="tl-sub">{item.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* MID */}
            <div className="mid-col">
              {[0,1,2,3,4].map(i=>(
                <div className="mid-step" key={i}><div className="mid-line" /></div>
              ))}
            </div>

            {/* WITH */}
            <div className="with-col">
              <div className="tl-item">
                <div className="tl-dot-wrap">
                  <div className="tl-dot-amber" />
                  <div className="tl-vline-amber" />
                </div>
                <div>
                  <div className="tl-time-amber">02:14</div>
                  <div className="tl-title">Driver reports a breakdown</div>
                  <div className="tl-sub">Location confirmed. Vehicle, cargo, and SLA exposure identified instantly. Ops gets one text with everything they need.</div>
                  <div className="sms"><strong>DisruptionHub — CRITICAL</strong><br/>LK72 ABX: Breakdown M1 J18. Tesco DC slot 23:30. SLA risk: <strong>£2,400</strong>.<br/>Reply <strong>YES</strong> to confirm recovery is being arranged, NO to handle manually.</div>
                </div>
              </div>
              <div className="tl-item">
                <div className="tl-dot-wrap">
                  <div className="tl-dot-amber" />
                  <div className="tl-vline-amber" />
                </div>
                <div>
                  <div className="tl-time-amber">02:14</div>
                  <div className="tl-title">Ops replies YES</div>
                  <div className="tl-sub">One word. That's the entire job done.</div>
                  <div className="sms-reply">YES</div>
                </div>
              </div>
              <div className="tl-item">
                <div className="tl-dot-wrap">
                  <div className="tl-dot-amber" />
                  <div className="tl-vline-amber" />
                </div>
                <div>
                  <div className="tl-time-amber">02:15</div>
                  <div className="tl-title">Recovery contacted. ETA confirmed.</div>
                  <div className="tl-sub">Your recovery provider is reached and a confirmed arrival time is secured — automatically.</div>
                </div>
              </div>
              <div className="tl-item">
                <div className="tl-dot-wrap">
                  <div className="tl-dot-amber" />
                  <div className="tl-vline-amber" />
                </div>
                <div>
                  <div className="tl-time-amber">02:15</div>
                  <div className="tl-title">Driver briefed. Nothing left to chance.</div>
                  <div className="tl-sub">The driver receives everything they need — what to do, what to protect, when help arrives.</div>
                </div>
              </div>
              <div className="tl-item" style={{borderBottom:'none'}}>
                <div className="tl-dot-wrap">
                  <div className="tl-dot-amber" />
                </div>
                <div>
                  <div className="tl-time-amber">02:15</div>
                  <div className="tl-title">Everyone who needs to know, knows.</div>
                  <div className="tl-sub">Consignee updated. Ops confirmed. Full record saved. Nothing chased. Nothing missed.</div>
                  <div className="sms"><strong>DisruptionHub — Done ✓</strong><br/>Recovery ETA <strong>55 min</strong>. Driver briefed. Tesco DC notified. Full record saved.</div>
                </div>
              </div>
            </div>
          </div>

          {/* TOTALS */}
          <div className="totals">
            <div className="total-without">
              <div>
                <div className="total-label">Time awake · calls made · nothing logged</div>
                <div className="total-val-red">34 min<br/>of chaos</div>
              </div>
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none" style={{flexShrink:0,opacity:0.5}}><circle cx="28" cy="28" r="26" stroke="#ef4444" strokeWidth="1.5"/><circle cx="28" cy="28" r="2" fill="#ef4444"/><line x1="28" y1="28" x2="38" y2="16" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/><line x1="28" y1="28" x2="28" y2="8" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/><line x1="28" y1="4" x2="28" y2="8" stroke="#ef4444" strokeWidth="1.5" opacity="0.4"/><line x1="28" y1="48" x2="28" y2="52" stroke="#ef4444" strokeWidth="1.5" opacity="0.4"/><line x1="4" y1="28" x2="8" y2="28" stroke="#ef4444" strokeWidth="1.5" opacity="0.4"/><line x1="48" y1="28" x2="52" y2="28" stroke="#ef4444" strokeWidth="1.5" opacity="0.4"/><path d="M20 22c0-1.1.9-2 2-2h3l1.5 3.5-2 1.5c.8 1.6 2 2.8 3.5 3.5l1.5-2L33 28v3c0 1.1-.9 2-2 2-6.1-.3-10.7-5-11-11z" fill="#ef4444" opacity="0.6"/></svg>
            </div>
            <div />
            <div className="total-with">
              <div>
                <div className="total-label">Total ops manager time · everything handled · full audit</div>
                <div className="total-val-amber">60 sec<br/>back to bed</div>
              </div>
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none" style={{flexShrink:0}}><path d="M28 4 L48 12 L48 28 C48 38 38 46 28 52 C18 46 8 38 8 28 L8 12 Z" stroke="#f5a623" strokeWidth="1.5" fill="rgba(245,166,35,0.06)"/><path d="M18 28 L24 34 L38 20" stroke="#f5a623" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="28" cy="28" r="24" stroke="#f5a623" strokeWidth="0.5" opacity="0.2"/></svg>
            </div>
          </div>
        </div>

        {/* DIVIDER 2 */}
        <div className="divider" style={{marginTop:60}}>
          <p className="divider-text">Not a replacement for your ops manager. Just the <em>25 minutes you're losing</em> every incident.</p>
        </div>

        {/* APPROVAL SECTION */}
        <div className="approval-wrap">
          <div className="approval-inner">
            <div className="scan-line" />
            <div className="approval-grid">
              <div>
                <div className="approval-tag">How it works for you</div>
                <h2 className="approval-title">One text.<br/><em>Everything</em><br/>handled.</h2>
                <p className="approval-body">You get one SMS with the situation, the financial exposure, and a YES / NO choice. Reply YES and everything is handled — recovery arranged, driver briefed, consignee notified — all confirmed back in one message. No app to open. No hold music.</p>
                <div className="steps-grid">
                  {[
                    {n:'STEP 01',t:'Recovery contacted',s:'Your recovery provider is reached, location confirmed, arrival time secured.'},
                    {n:'STEP 02',t:'Driver briefed',s:'The driver gets clear instructions — what to do, what to protect, when help arrives.'},
                    {n:'STEP 03',t:'Consignee updated',s:'Your customer is notified with a revised delivery time and reason for delay.'},
                    {n:'STEP 04',t:'Ops confirmed',s:'You get a single confirmation: everything handled, full record saved.'},
                  ].map((s,i)=>(
                    <div className="step-card" key={i}>
                      <div className="step-num">{s.n}</div>
                      <div className="step-title">{s.t}</div>
                      <div className="step-sub">{s.s}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="phone-wrap">
                  <div className="phone-bar">
                    <span className="phone-time">02:14</span>
                    <span className="phone-icons">{'▲▲'} WiFi</span>
                  </div>
                  <div className="phone-msg">
                    <div className="phone-hdr">
                      <div className="phone-from">DISRUPTIONHUB</div>
                      <div className="phone-name">Ops Alert — LK72 ABX</div>
                    </div>
                    <div className="phone-body">
                      <div className="phone-text">
                        <strong>CRITICAL — Breakdown</strong><br/>
                        M1 J18, northbound.<br/>
                        Tesco DC slot: 23:30<br/>
                        SLA risk: <strong>£2,400</strong><br/><br/>
                        Reply <strong>YES</strong> to handle everything.<br/>
                        Reply <strong>NO</strong> to handle manually.
                      </div>
                      <div className="phone-btns">
                        <div className="phone-btn-yes">{'YES →'}</div>
                        <div className="phone-btn-no">NO</div>
                      </div>
                      <div className="phone-timer"><div className="phone-timer-bar" /></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STAT BAR */}
        <div className="stat-wrap">
          <div className="stat-inner">
            <div className="stat-item">
              <span className="stat-red">34<span style={{fontSize:'0.5em'}}>min</span></span>
              <span className="stat-lbl-title">Without DisruptionHub</span>
              <span className="stat-lbl-sub">Ops awake, making calls, no audit trail</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-amber">60<span style={{fontSize:'0.5em'}}>sec</span></span>
              <span className="stat-lbl-title">With DisruptionHub</span>
              <span className="stat-lbl-sub">Read SMS, reply YES, back to sleep</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-green">3</span>
              <span className="stat-lbl-title">People reached, not chased</span>
              <span className="stat-lbl-sub">Recovery, driver, consignee — all handled</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <section className="cta-sec">
          <div style={{maxWidth:580,margin:'0 auto',position:'relative',zIndex:1}}>
            <h2 className="cta-title">One cold-chain breach<br/>costs <em>£5k–£20k.</em></h2>
            <p className="cta-sub">DisruptionHub at £499/mo pays for itself after one prevented incident. Start with a 30-day pilot for £149.</p>
            <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
              <a href="mailto:hello@disruptionhub.ai" className="btn-cta">Book a demo →</a>
              <a href="/#pricing" className="btn-outline-cta">See pricing</a>
            </div>
          </div>
        </section>

      </div>
    </>
  )
}
