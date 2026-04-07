import Anthropic from '@anthropic-ai/sdk'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request) {
  try {
    const { scenario, detail, client_id } = await request.json()
    const result = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 800,
      system: `You are a Senior Cargo Security and Freight Intelligence Analyst. Expert in UK cargo theft patterns, ghost freight fraud, high-risk rest stop locations (the banned 7 motorway services for high-value cargo), and subcontractor verification. Be direct. Give specific named locations and actions.`,
      messages: [{ role: 'user', content: `Threat query: ${scenario}\nDetail: ${detail}\n\nAssess: (1) Threat level — LOW/MEDIUM/HIGH/CRITICAL, (2) Specific risks identified, (3) Recommended actions and named safe alternatives, (4) Red flags to watch for, (5) Verification steps if applicable.` }]
    })
    return Response.json({ analysis: result.content[0].text })
  } catch(e) { return Response.json({ error: e.message }, { status: 500 }) }
}
