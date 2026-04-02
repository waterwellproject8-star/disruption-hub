import { runPlatformHealthCheck } from '../../../../lib/platform-monitor.js'

// GET /api/platform/health?client_id=xxx
// POST /api/platform/health — for cron trigger

// Vercel cron: run first Monday of every month at 08:00
// vercel.json: { "path": "/api/platform/health", "schedule": "0 8 1-7 * 1" }

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id') || null
  const secret   = searchParams.get('secret')

  // Simple auth — either the cron secret or no auth (for admin use)
  if (process.env.NODE_ENV === 'production' && secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const report = await runPlatformHealthCheck(clientId)
  return Response.json(report)
}

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const clientId = body.client_id || process.env.DEFAULT_CLIENT_ID || null

  const report = await runPlatformHealthCheck(clientId)

  return Response.json({
    success: true,
    action_required: report.summary.action_required,
    critical: report.summary.critical,
    high: report.summary.high,
    checked_at: report.checked_at,
  })
}
