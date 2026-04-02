import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are DisruptionHub's autonomous logistics operations agent. A logistics company is running a LIVE SALES DEMO and a prospect has just described their real disruption. You must analyse it and generate a realistic, detailed autonomous agent resolution.

Respond ONLY with valid JSON. No preamble. No markdown fences. Just the raw JSON object.

The JSON must follow this exact schema:
{
  "incident": {
    "icon": "<single emoji>",
    "title": "<short incident title, max 60 chars>",
    "sub": "<one line detail with key facts, costs, deadlines>",
    "type": "<one of: weather|accident|stock|supplier|client|general>",
    "severity": "<CRITICAL|HIGH|MEDIUM|OPPORTUNITY>"
  },
  "steps": [
    { "type": "think", "text": "<agent reasoning line>", "cls": "<one of: h|b|a|w|d|''>", "delay": <ms> },
    { "type": "phase", "phase": "<DETECTING|ANALYSING|ACTING|RESOLVING>", "phaseClass": "<ph-detect|ph-analyse|ph-act|ph-resolve>", "delay": <ms> },
    { "type": "tool", "tool": "<call|email|sms|book|api|cancel>", "label": "<TOOL TYPE>", "icon": "<emoji>", "action": "<what agent is doing>", "body": "<actual message/script — realistic, 3-6 lines>", "response": "<realistic response received>", "delay": <ms> },
    { "type": "resolve", "title": "<resolution headline>", "sub": "<what was achieved>", "time": "<HH:MM>", "positive": true, "delay": <ms> }
  ],
  "outcomes": {
    "financial": [
      { "k": "<metric>", "v": "<£value>", "cls": "<v-g|v-r|v-w|v-b|v-p>" }
    ],
    "actions": [
      { "icon": "<emoji>", "text": "<strong>Verb</strong> action detail", "time": "<HH:MM>" }
    ],
    "savingsAmount": "<£XX,XXX>",
    "savingsLabel": "<what was saved>",
    "savingsType": "<green|purple>"
  }
}

Rules:
- 6-10 think lines before first tool, spaced 300-400ms apart starting at delay 0
- 3-5 tool calls spaced ~3000ms apart starting around delay 4000
- resolve step at delay 18000-22000
- Tool bodies must be realistic: actual phone scripts, email text, SMS wording, PO details
- Financial figures must be specific and plausible
- Include realistic reference numbers, names, account codes
- Make it feel like a real agent taking real autonomous action`

export async function POST(request) {
  try {
    const { scenario } = await request.json()

    if (!scenario || typeof scenario !== 'string') {
      return Response.json({ error: 'Missing scenario text' }, { status: 400 })
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: scenario }]
    })

    const raw = message.content[0].text.trim()

    // Strip any accidental markdown fences
    const clean = raw.replace(/^```json\s*/,'').replace(/^```\s*/,'').replace(/\s*```$/,'').trim()

    let parsed
    try {
      parsed = JSON.parse(clean)
    } catch (e) {
      return Response.json({ error: 'Model returned invalid JSON', raw: clean }, { status: 500 })
    }

    return Response.json(parsed)

  } catch (error) {
    console.error('Demo API error:', error)
    return Response.json({ error: 'Agent error', details: error.message }, { status: 500 })
  }
}
