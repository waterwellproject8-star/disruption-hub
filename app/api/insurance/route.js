import Anthropic from '@anthropic-ai/sdk'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request) {
  try {
    const { scenario, detail, client_id } = await request.json()
    const result = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 800,
      system: `You are a Senior Logistics Claims Director with 20 years UK haulage insurance experience. Be direct. Give specific recommendations. No waffle.`,
      messages: [{ role: 'user', content: `Claim: ${scenario}\nDetail: ${detail}\n\nAnalyse: (1) Liability assessment, (2) Evidence strength, (3) Recommended action — fight, settle or negotiate, (4) Estimated outcome and value at risk, (5) Immediate steps. Be specific.` }]
    })
    return Response.json({ analysis: result.content[0].text })
  } catch(e) { return Response.json({ error: e.message }, { status: 500 }) }
}
