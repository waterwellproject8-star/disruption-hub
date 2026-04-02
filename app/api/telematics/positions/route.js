import { getLatestPositions } from '../../../../lib/telematics.js'

// GET /api/telematics/positions?client_id=xxx
// Returns the most recent GPS position for every vehicle for this client
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')

    if (!clientId) {
      return Response.json({ error: 'client_id required' }, { status: 400 })
    }

    const positions = await getLatestPositions(clientId)

    return Response.json({
      success: true,
      positions,
      count: positions.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
