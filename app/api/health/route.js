import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return Response.json({ ok: false, reason: 'config' }, { status: 503 })
  }
  try {
    const db = createClient(url, key)
    const t0 = Date.now()
    const { error } = await db.from('clients').select('id').limit(1)
    if (error) throw error
    return Response.json({
      ok: true,
      checked_at: new Date().toISOString(),
      database: { ok: true, latency_ms: Date.now() - t0 }
    }, {
      headers: { 'Cache-Control': 'no-store' }
    })
  } catch (err) {
    return Response.json({
      ok: false,
      checked_at: new Date().toISOString(),
      error: err.message
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
