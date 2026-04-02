import { pollAllClients } from '../../../../lib/telematics.js'

// POST /api/telematics/poll
// Called by Vercel Cron every 2 minutes
// vercel.json: { "path": "/api/telematics/poll", "schedule": "*/2 * * * *" }

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = await pollAllClients()
    return Response.json({ success: true, ...results, timestamp: new Date().toISOString() })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

// GET for manual trigger during testing
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('secret') !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const results = await pollAllClients()
    return Response.json({ success: true, ...results })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
