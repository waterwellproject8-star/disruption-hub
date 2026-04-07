import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

function fmt(date) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function buildHistory(now) {
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
  const t1 = new Date(now.getTime() - rand(90, 360) * 60000)
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(rand(8,18), rand(0,59), 0, 0)
  const threeDays = new Date(now); threeDays.setDate(threeDays.getDate() - 3); threeDays.setHours(rand(9,17), rand(0,59), 0, 0)
  const types = ['Invoice Recovery','SLA Breach Prevented','Cold Chain Alert','Driver Hours','Cargo Theft Flag','Cascade Prevented']
  return [
    { ref:`DH-${rand(4200,4390)}`, type:types[rand(0,2)], severity:'HIGH', saved:`£${(rand(18,68)*100).toLocaleString()}`, date:`Today ${fmt(t1)}` },
    { ref:`DH-${rand(4100,4199)}`, type:types[rand(3,5)], severity:'MEDIUM', saved:`£${(rand(6,18)*100).toLocaleString()}`, date:`Yesterday ${fmt(yesterday)}` },
    { ref:`DH-${rand(3900,4099)}`, type:types[rand(0,5)], severity:'HIGH', saved:`£${(rand(12,42)*100).toLocaleString()}`, date:`${threeDays.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})} ${fmt(threeDays)}` }
  ]
}

export async function POST(request) {
  const { prompt, current_time } = await request.json()

  const now = current_time ? new Date(current_time) : new Date()
  const timeStr = fmt(now)
  const dateStr = now.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })
  const sessionId = 'demo'

  const systemPrompt = `You are a UK logistics scenario builder. Your job is to turn a natural language incident description into a complete, fully-populated logistics scenario.

TWO RULES:
1. VERBATIM FIRST — if the person mentions a driver name, location, cargo type, temperature, customer, vehicle reg, number of deliveries — use those exact details everywhere. Never replace or paraphrase what they said.
2. AUTO-FILL EVERYTHING ELSE — any field not mentioned must be invented with realistic UK haulage data. Never leave a field blank or null unless it genuinely cannot apply (e.g. temp_reading on a non-refrigerated load).

Fields you must always populate regardless of what was mentioned:
- Driver full name (first + surname). If first name given, invent realistic UK surname.
- Vehicle reg (UK format e.g. BN21 XKT). If not given, generate one matching the cargo.
- Vehicle type: infer from cargo. Pharma/cold chain = Fridge/Reefer. General = Artic 44t or Rigid.
- Company/carrier name: invent a realistic UK haulage company name (e.g. "Midland Express Ltd", "Northern Freight Services").
- Emergency contact: depot manager name + realistic UK landline number.
- Consignee for each delivery: real-sounding UK business with location (NHS trust, Tesco DC, Asda RDC, Boots warehouse, etc.)
- Route: "Origin city → Destination (Customer Name)" — e.g. "Manchester → Leeds (NHS Royal Infirmary Pharmacy)"
- SLA window: realistic 90-120 min booking slot relative to current time
- Cargo value: realistic for cargo type (pharma: £8,000-£28,000, retail: £6,000-£22,000)
- SLA penalty: realistic (NHS pharma: £2,400-£4,500; retail: £800-£2,400; ambient: £0-£1,200)
- Number of deliveries: read from the prompt. "3 deliveries pending" = 3. "2 drops" = 2. If unspecified, infer logically from the scenario type and time of day.

Current time: ${timeStr} on ${dateStr}. All ETAs and slots MUST be relative to this exact time.`

  const userPrompt = `Incident description: "${prompt}"

Generate this JSON exactly. Deliveries array length = however many deliveries are in or implied by the incident:

{
  "driver": {
    "name": "first name — verbatim from prompt or invented",
    "surname": "UK surname — verbatim if given, invented if not",
    "vehicle_reg": "UK format — verbatim if given, invented if not",
    "vehicle_type": "Fridge/Reefer or Artic 44t or Rigid — inferred from cargo",
    "phone": "+44 7700 XXXXXX — invented realistic mobile",
    "company": "Realistic UK haulage company name — invented",
    "emergency_contact": "Depot manager [name]: [01XXX XXXXXX]"
  },
  "incident": {
    "type": "breakdown or temp_alarm or delay or accident or goods_refused or driver_ill",
    "severity": "CRITICAL or HIGH or MEDIUM",
    "location": "specific UK road and junction — verbatim if given",
    "description": "verbatim re-statement of what happened from the prompt",
    "financial_impact": 2400,
    "time_occurred": "${timeStr}"
  },
  "cargo": {
    "type": "pharmaceutical or chilled 0-5C or frozen -18C or mixed retail or ambient — verbatim if given",
    "description": "specific product description e.g. 'insulin pens and IV bags' or 'chilled ready meals'",
    "temp_reading": 7.8 or null,
    "temp_threshold": 5.0 or null,
    "temp_unit": "°C",
    "pharma_flag": true or false,
    "value_gbp": 14000
  },
  "deliveries": [
    {
      "ref": "DH-XXXX — sequential from 4421",
      "route": "Origin → Destination (Full Customer Name) — verbatim destination if given",
      "carrier": "same company name as driver.company",
      "status": "disrupted for affected job, delayed for cascade jobs, on-track for unaffected",
      "eta": "??? if disrupted, HH:MM relative to now if delayed or on-track",
      "sla_window": "HH:MM-HH:MM — realistic 90-120 min slot",
      "cargo_type": "verbatim from cargo.type",
      "cargo_value": 14000,
      "penalty_if_breached": 2400,
      "alert": "one line — verbatim incident if disrupted, cascade warning if delayed, null if on-track",
      "drops": 1
    }
  ],
  "agent_prompt": "Rich 180-220 word ops director brief. USE VERBATIM details from the prompt. Include: driver full name and vehicle reg, exact location with junction as described, cargo type and temperature if cold chain, each delivery ref with full consignee name and SLA deadline and penalty, total financial exposure across all runs, time-critical actions. Write as a live ops system alert at ${timeStr}."
}

No markdown. JSON only.`

  try {
    const result = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2200,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })

    const text = result.content[0].text.trim().replace(/```json|```/g, '').trim()
    const data = JSON.parse(text)

    if (!data.driver || !data.deliveries?.length || !data.agent_prompt) {
      throw new Error('Incomplete generation')
    }

    // Ensure carrier is set on every delivery
    data.deliveries = data.deliveries.map((d, i) => ({
      ...d,
      carrier: d.carrier || data.driver.company || `${data.driver.name} ${data.driver.surname}`,
      ref: d.ref || `DH-${4421 + i}`,
      drops: d.drops || 1
    }))

    data.history = buildHistory(now)

    // Write to shipments — all fields driver app maps
    const db = getSupabase()
    if (db) {
      await db.from('shipments').delete().eq('client_id', sessionId)
      await db.from('shipments').insert(
        data.deliveries.map((d, i) => ({
          client_id:           sessionId,
          ref:                 d.ref,
          route:               d.route,
          carrier:             d.carrier,
          status:              d.status,
          eta:                 d.eta,
          sla_window:          d.sla_window,
          cargo_type:          d.cargo_type,
          cargo_value:         d.cargo_value  || 0,
          penalty_if_breached: d.penalty_if_breached || 0,
          alert:               d.alert || null,
          drops:               d.drops || 1,
          sequence:            i + 1
        }))
      )
    }

    return Response.json({
      success: true,
      scenario: data,
      session_id: sessionId,
      driver_code: sessionId
    })

  } catch (e) {
    const fallback = buildFallback(prompt, now)
    fallback.history = buildHistory(now)

    const db = getSupabase()
    if (db) {
      try {
        await db.from('shipments').delete().eq('client_id', sessionId)
        await db.from('shipments').insert(
          fallback.deliveries.map((d, i) => ({
            client_id: sessionId, ref: d.ref, route: d.route,
            carrier: d.carrier, status: d.status, eta: d.eta,
            sla_window: d.sla_window, cargo_type: d.cargo_type,
            cargo_value: d.cargo_value || 0,
            penalty_if_breached: d.penalty_if_breached || 0,
            alert: d.alert || null, drops: d.drops || 1, sequence: i + 1
          }))
        )
      } catch {}
    }

    return Response.json({
      success: false, error: e.message,
      scenario: fallback, session_id: sessionId, driver_code: sessionId
    })
  }
}

function buildFallback(prompt, now) {
  const f = d => d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
  const win = (offset, dur) => {
    const s = new Date(now.getTime() + offset * 60000)
    const e = new Date(now.getTime() + (offset + dur) * 60000)
    return `${f(s)}-${f(e)}`
  }
  const countMatch = prompt.match(/(\d+)\s*(delivery|deliveries|drop|drops|run|runs|stop|stops)/i)
  const count = Math.min(countMatch ? parseInt(countMatch[1]) : 2, 5)
  const offsets = [0, 90, 180, 270, 360]
  const statuses = ['disrupted','delayed','on-track','on-track','on-track']
  const penalties = [2400, 1200, 0, 0, 0]
  const alerts = ['Breakdown — driver stationary','Cascade risk from first run', null, null, null]

  const deliveries = Array.from({ length: count }, (_, i) => ({
    ref: `DH-${4421 + i}`,
    route: `Origin → Customer ${String.fromCharCode(65 + i)}`,
    carrier: 'Demo Haulage Ltd',
    status: statuses[i] || 'on-track',
    eta: i === 0 ? '???' : f(new Date(now.getTime() + offsets[i] * 60000)),
    sla_window: win(offsets[i] + 30, 90),
    cargo_type: 'mixed retail',
    cargo_value: 12000 - (i * 2000),
    penalty_if_breached: penalties[i] || 0,
    alert: alerts[i] || null,
    drops: 1
  }))

  return {
    driver: { name:'John', surname:'Driver', vehicle_reg:'BN21 XKT', vehicle_type:'Artic 44t', company:'Demo Haulage Ltd', phone:'+44 7700 000000', emergency_contact:'Depot: 0113 234 5678' },
    incident: { type:'breakdown', severity:'HIGH', location:'M62 northbound J25', description: prompt.slice(0,80), financial_impact:2400, time_occurred: f(now) },
    cargo: { type:'mixed retail', description:'Mixed freight', temp_reading:null, temp_threshold:null, pharma_flag:false, value_gbp:12000 },
    deliveries,
    agent_prompt: prompt
  }
}
