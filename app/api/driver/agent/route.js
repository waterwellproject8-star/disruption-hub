// POST /api/driver/agent
// Browser-facing proxy that attaches the server-only DH_INTERNAL_KEY and forwards
// to /api/agent. Lets the driver PWA call the crisis-director endpoint without
// shipping the internal key to the browser bundle.

export const runtime = 'nodejs'

export async function POST(request) {
  if (!process.env.DH_INTERNAL_KEY) {
    return Response.json({ error: 'Missing DH_INTERNAL_KEY' }, { status: 500 })
  }

  const body = await request.text()

  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const agentUrl = host ? `${proto}://${host}/api/agent` : new URL('/api/agent', request.url).toString()

  try {
    const upstream = await fetch(agentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-dh-key': process.env.DH_INTERNAL_KEY
      },
      body
    })

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive'
      }
    })
  } catch (err) {
    console.error('driver/agent proxy failed:', err)
    return Response.json({ error: 'Upstream unreachable' }, { status: 502 })
  }
}
