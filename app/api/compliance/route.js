import Anthropic from '@anthropic-ai/sdk'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request) {
  try {
    const { scenario, detail, client_id } = await request.json()
    const result = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 800,
      system: `You are a Senior Transport Compliance Officer. Expert in EU Reg 561/2006 WTD driver hours, DVSA standards, CPC/DQC requirements, operator licence conditions. Be direct and specific. Flag any legal risk clearly.`,
      messages: [{ role: 'user', content: `Compliance query: ${scenario}\nDetail: ${detail}\n\nProvide: (1) Compliance status — compliant or breach risk, (2) Specific regulation reference, (3) Risk level and consequence if breached, (4) Immediate action required, (5) Prevention for next time.` }]
    })
    return Response.json({ analysis: result.content[0].text })
  } catch(e) { return Response.json({ error: e.message }, { status: 500 }) }
}
