import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Two concerns in this middleware:
//   1. /api/driver/push-send — server-to-server endpoint, requires x-dh-key === DH_INTERNAL_KEY.
//   2. /ops-9x7k* — authenticated dashboard. 404 without dh_ops_auth cookie so the
//      route is invisible to unauthenticated traffic. Cookie is set by /unlock
//      after a correct PIN. /unlock itself is intentionally NOT matched so first-time
//      visitors can reach the PIN screen.
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (path === '/ops-9x7k' || path.startsWith('/ops-9x7k/')) {
    const cookie = request.cookies.get('dh_ops_auth')?.value
    if (cookie !== 'true') {
      return new NextResponse(null, { status: 404 })
    }
    return NextResponse.next()
  }

  if (path === '/api/driver/push-send') {
    const key = request.headers.get('x-dh-key')
    if (!key || key !== process.env.DH_INTERNAL_KEY) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/driver/push-send', '/ops-9x7k', '/ops-9x7k/:path*']
}
