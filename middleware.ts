import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Server-to-server only — no browser caller exists today.
// Browser-facing routes (dashboard + driver PWA polling, inbound/agent/sms webhooks,
// cron endpoints with their own Bearer CRON_SECRET) are intentionally NOT matched
// and pass through untouched.
export function middleware(request: NextRequest) {
  const key = request.headers.get('x-dh-key')
  if (!key || key !== process.env.DH_INTERNAL_KEY) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/driver/push-send']
}
