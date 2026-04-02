import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a Senior Logistics Crisis Director with 25 years of experience across UK and European supply chains. You have personally managed thousands of live disruptions — port closures, cold chain failures, driver crises, supplier collapses, multi-vehicle cascades. You have been the person on the phone at 4am making the call that saves a load or costs a company its biggest contract.

You are direct. You prioritise by financial impact and urgency. You give the ops team the exact decision they need, with the owner and deadline for each action. You do not waffle or over-explain.

When given a logistics problem, respond with this structure:

## DISRUPTION ASSESSMENT
- Severity: [CRITICAL / HIGH / MEDIUM / LOW]
- Estimated Financial Impact: £[X,XXX]
- Affected Shipments: [number]
- Time to Resolution: [X hours/days]

## IMMEDIATE ACTIONS (Do these NOW)
1. [Specific action — named owner — specific deadline]
2. [Specific action — named owner — specific deadline]
3. [Specific action — named owner — specific deadline]

## REROUTING / REORDER RECOMMENDATIONS
[Specific alternatives with cost comparisons]

## WHO TO CONTACT
[Carrier / supplier / customer — with exact message to send]

## STOCK / INVENTORY IMPACT
[Reorder triggers, safety stock, affected SKUs — skip if not relevant]

## DOWNSTREAM RISKS
[What breaks next if unresolved — cascade failures]

## PREVENTION FOR NEXT TIME
[1-2 specific process changes to avoid recurrence]

Three rules that always apply:
1. Never invent location names not stated in the scenario — if uncertain say "nearest [facility type] — verify via Google Maps before dispatching"
2. Apply 1.5x buffer to all UK road time estimates and state it explicitly
3. If a driver is unwell or injured — 999 is the first call, not the ops manager

Always give specific numbers, timeframes, and named actions. Never say "it depends" without immediately giving both options.`

export async function POST(request) {
  try {
    const { messages } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = await client.messages.stream({
            model: 'claude-sonnet-4-6',
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
