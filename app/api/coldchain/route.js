import Anthropic from '@anthropic-ai/sdk'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request) {
  try {
    const { scenario, detail, client_id } = await request.json()
    const result = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 900,
      system: `You are a Senior Cold Chain Compliance Manager with expertise in pharmaceutical logistics, GDP guidelines, MHRA requirements, and retail cold chain protocols. Expert in temperature excursion assessment and Mean Kinetic Temperature calculations. Be precise and specific.`,
      messages: [{ role: 'user', content: `Cold chain query: ${scenario}\nDetail: ${detail}\n\nAssess: (1) Compliance status — GDP/MHRA compliant or breach, (2) Product safety assessment — can cargo be delivered or must it be quarantined, (3) Documentation required, (4) Customer notification wording, (5) Regulatory reporting requirements if any. Be specific about temperature thresholds and duration limits.` }]
    })
    return Response.json({ analysis: result.content[0].text })
  } catch(e) { return Response.json({ error: e.message }, { status: 500 }) }
}
