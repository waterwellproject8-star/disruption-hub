import { normaliseWebhookPosition, savePositions, checkSLABreaches } from '../../../../lib/telematics.js'
import { supabase } from '../../../../lib/supabase.js'

// POST /api/telematics/webhook
// Receives position data pushed from telematics devices or providers
// Header: x-webhook-key or x-client-id to identify the client

export async function POST(request) {
  try {
    const webhookKey = request.headers.get('x-webhook-key')
    const clientIdHeader = request.headers.get('x-client-id')
    const body = await request.json()

    // Resolve client from webhook key or header
    let clientId = clientIdHeader

    if (webhookKey && !clientId) {
      const { data: config } = await supabase
        .from('telematics_config')
        .select('client_id')
        .eq('webhook_secret', webhookKey)
        .single()

      if (!config) {
        return Response.json({ error: 'Invalid webhook key' }, { status: 401 })
      }
      clientId = config.client_id
    }

    if (!clientId) {
      return Response.json({ error: 'x-webhook-key or x-client-id header required' }, { status: 401 })
    }

    // Handle both single position and batch payloads
    const items = Array.isArray(body) ? body : [body]
    const positions = []

    for (const item of items) {
      const pos = normaliseWebhookPosition(item, clientId)
      if (pos) positions.push(pos)
    }

    if (positions.length === 0) {
      return Response.json({ error: 'No valid position data found in payload' }, { status: 400 })
    }

    await savePositions(clientId, positions, 'webhook')
    await checkSLABreaches(clientId, positions)

    return Response.json({
      success: true,
      positions_saved: positions.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Telematics webhook error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
