import { createTrackingLink } from '../../../../lib/tracking.js'

// POST /api/tracking/create
// Creates a shareable tracking link for a shipment
export async function POST(request) {
  try {
    const body = await request.json()
    const {
      client_id,
      job_ref,
      vehicle_reg,
      driver_name,
      origin,
      destination,
      cargo_description,
      estimated_arrival,
      client_branding,
      expires_hours
    } = body

    if (!client_id || !job_ref) {
      return Response.json({ error: 'client_id and job_ref required' }, { status: 400 })
    }

    const link = await createTrackingLink({
      clientId: client_id,
      jobRef: job_ref,
      vehicleReg: vehicle_reg,
      driverName: driver_name,
      origin,
      destination,
      cargoDescription: cargo_description,
      estimatedArrival: estimated_arrival,
      clientBranding: client_branding || {},
      expiresHours: expires_hours || 48
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.ai'
    const trackingUrl = `${appUrl}/track/${link.token}`

    return Response.json({
      success: true,
      token: link.token,
      tracking_url: trackingUrl,
      expires_at: link.expires_at,
      sms_message: `Track your delivery from ${origin || 'us'}: ${trackingUrl}`
    })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
