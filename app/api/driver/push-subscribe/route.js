import { savePushSubscription } from '../../../../lib/push.js'

// POST /api/driver/push-subscribe
// Registers a driver's browser for Web Push notifications
export async function POST(request) {
  try {
    const { client_id, driver_id, driver_name, subscription } = await request.json()

    if (!client_id || !subscription?.endpoint) {
      return Response.json({ error: 'client_id and subscription required' }, { status: 400 })
    }

    const userAgent = request.headers.get('user-agent') || ''

    await savePushSubscription({
      clientId: client_id,
      driverId: driver_id || null,
      driverName: driver_name || null,
      subscription,
      userAgent
    })

    return Response.json({ success: true, message: 'Push notifications enabled' })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

// GET - return the VAPID public key (needed by client to subscribe)
export async function GET() {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
  if (!vapidPublicKey) {
    return Response.json({ error: 'Push notifications not configured' }, { status: 503 })
  }
  return Response.json({ vapid_public_key: vapidPublicKey })
}
