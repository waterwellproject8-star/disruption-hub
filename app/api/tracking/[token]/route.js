import { getTrackingByToken, updateTrackingStatus } from '../../../../lib/tracking.js'

// GET /api/tracking/[token]
export async function GET(request, { params }) {
  try {
    const { token } = params

    if (!token) {
      return Response.json({ error: 'Token required' }, { status: 400 })
    }

    const data = await getTrackingByToken(token)

    if (!data) {
      return Response.json({ error: 'Tracking link not found' }, { status: 404 })
    }

    if (data.expired) {
      return Response.json({ error: 'This tracking link has expired', expired: true }, { status: 410 })
    }

    // Strip internal IDs before returning to customer
    const {
      id: _id,
      client_id: _cid,
      ...publicData
    } = data

    return Response.json({ success: true, tracking: publicData })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/tracking/[token] — update status (called by driver/ops)
export async function PATCH(request, { params }) {
  try {
    const { token } = params
    const { status, estimated_arrival } = await request.json()

    if (!status) {
      return Response.json({ error: 'status required' }, { status: 400 })
    }

    await updateTrackingStatus(token, status, estimated_arrival)
    return Response.json({ success: true })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
