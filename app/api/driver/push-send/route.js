import { sendPushToDriver, sendPushToClient } from '../../../../lib/push.js'

// POST /api/driver/push-send
// Body: { driver_id?, client_id, title, body, data, urgent, tag }
// If driver_id omitted, sends to all drivers for the client
export async function POST(request) {
  try {
    const { driver_id, client_id, title, body, data, urgent, tag } = await request.json()

    if (!client_id) {
      return Response.json({ error: 'client_id required' }, { status: 400 })
    }

    const payload = { title, body, data, urgent, tag }
    let result

    if (driver_id) {
      result = await sendPushToDriver(driver_id, payload)
    } else {
      result = await sendPushToClient(client_id, payload)
    }

    return Response.json({ success: true, ...result })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
