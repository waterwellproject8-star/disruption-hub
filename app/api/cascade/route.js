import Anthropic from '@anthropic-ai/sdk'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request) {
  try {
    const { scenario, detail, client_id, shipments } = await request.json()
    const shipmentsContext = shipments ? `Active shipments: ${JSON.stringify(shipments.map(s=>({ref:s.ref,route:s.route,status:s.status,penalty:s.penalty_if_breached,sla:s.sla_window})))}` : ''
    const result = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 900,
      system: `You are a Senior Logistics Operations Director. Calculate cascade financial exposure across multiple jobs when one disruption occurs. Be precise with numbers.`,
      messages: [{ role: 'user', content: `Cascade scenario: ${scenario}\nDetail: ${detail}\n${shipmentsContext}\n\nCalculate: (1) Primary disruption cost, (2) Each cascading job — ref, SLA status, penalty exposure, (3) Total financial exposure in £, (4) Priority order to protect, (5) Recovery actions. Lead with the total number.` }]
    })
    const text = result.content[0].text
    const moneyMatch = text.match(/£([\d,]+)/)
    const total = moneyMatch ? parseInt(moneyMatch[1].replace(/,/g,'')) : 0
    return Response.json({ analysis: text, total_exposure: total })
  } catch(e) { return Response.json({ error: e.message }, { status: 500 }) }
}
