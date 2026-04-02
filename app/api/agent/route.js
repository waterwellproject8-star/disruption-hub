import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are an expert logistics operations intelligence agent with 20+ years of experience managing global supply chains, freight forwarding, last-mile delivery, and crisis response.

Your role is to analyse disruptions and provide IMMEDIATE, ACTIONABLE decisions. You do not waffle. You prioritise by financial impact and urgency.

When given a logistics problem, you ALWAYS respond with this exact structure:

## DISRUPTION ASSESSMENT
- Severity: [CRITICAL / HIGH / MEDIUM / LOW]
- Estimated Financial Impact: £[X,XXX]
- Affected Shipments: [number]
- Time to Resolution: [X hours/days]

## IMMEDIATE ACTIONS (Do these NOW)
1. [Specific action with owner and deadline]
2. [Specific action with owner and deadline]
3. [Specific action with owner and deadline]

## REROUTING / REORDER RECOMMENDATIONS
[Specific alternatives with cost comparisons where relevant]

## WHO TO CONTACT
[Carrier / supplier / customer / customs — with what message to send]

## STOCK / INVENTORY IMPACT
[Reorder triggers, safety stock recommendations, affected SKUs]

## DOWNSTREAM RISKS
[What breaks next if this isn't resolved — cascade failures]

## PREVENTION FOR NEXT TIME
[One or two specific process changes to avoid recurrence]

Always be direct. Give specific numbers, timeframes, and named actions. Never say "it depends" without immediately saying what it depends on and both options.`

export async function POST(request) {
  try {
    const { messages } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = await client.messages.stream({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 2000,
            system: SYSTEM_PROMPT,
            messages: messages
          })

          for await (const chunk of anthropicStream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              const data = JSON.stringify({ text: chunk.delta.text })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err) {
          controller.error(err)
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })
  } catch (error) {
    console.error('Agent API error:', error)
    return new Response(JSON.stringify({ error: 'Agent error', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
