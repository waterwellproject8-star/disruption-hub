import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ])
}

async function checkDatabase(db) {
  const start = Date.now()
  const { error } = await withTimeout(
    db.from('clients').select('id').limit(1),
    4000
  )
  const latency_ms = Date.now() - start
  if (error) return { ok: false, latency_ms, reason: 'check_failed' }
  return { ok: latency_ms < 2000, latency_ms }
}

async function checkMessagingInbound(db) {
  const { data, error } = await withTimeout(
    db.from('webhook_log')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    4000
  )

  if (error) return { ok: false, last_inbound_at: null, minutes_since_last_inbound: null, stale: true, threshold_minutes: 4320, reason: 'check_failed' }

  if (!data) {
    return { ok: false, last_inbound_at: null, minutes_since_last_inbound: null, stale: true, threshold_minutes: 4320 }
  }

  const lastAt = new Date(data.created_at)
  const now = new Date()
  const minutes_since_last_inbound = Math.round((now - lastAt) / 60000)
  // Pre-client phase: 72hr threshold catches "lost number" scenarios without
  // false-positive on quiet test days. Tighten to 720 (12hr) when first
  // production client onboards.
  const stale = minutes_since_last_inbound > 4320

  return {
    ok: !stale,
    last_inbound_at: lastAt.toISOString(),
    minutes_since_last_inbound,
    stale,
    threshold_minutes: 4320
  }
}

async function checkOrphanedApprovals(db) {
  const now = new Date()
  const thirtyMinAgo = new Date(now - 30 * 60 * 1000).toISOString()
  const twentyFourHAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString()

  const { count, error } = await withTimeout(
    db.from('approvals')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lt('created_at', thirtyMinAgo)
      .gt('created_at', twentyFourHAgo),
    4000
  )

  if (error) return { ok: false, count: null, window_minutes: 30, reason: 'check_failed' }

  return { ok: count === 0, count, window_minutes: 30 }
}

export async function GET() {
  const db = getDB()
  if (!db) {
    return Response.json({ ok: false, reason: 'config' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const [dbResult, msgResult, appResult] = await Promise.allSettled([
      checkDatabase(db),
      checkMessagingInbound(db),
      checkOrphanedApprovals(db)
    ])

    const dbCheck = dbResult.status === 'fulfilled' ? dbResult.value : { ok: false, latency_ms: null, reason: dbResult.reason?.message === 'timeout' ? 'timeout' : 'check_failed' }
    const msg = msgResult.status === 'fulfilled' ? msgResult.value : { ok: false, last_inbound_at: null, minutes_since_last_inbound: null, stale: true, threshold_minutes: 4320, reason: msgResult.reason?.message === 'timeout' ? 'timeout' : 'check_failed' }
    const app = appResult.status === 'fulfilled' ? appResult.value : { ok: false, count: null, window_minutes: 30, reason: appResult.reason?.message === 'timeout' ? 'timeout' : 'check_failed' }

    const ok = dbCheck.ok && msg.ok && app.ok

    return Response.json({
      ok,
      checked_at: new Date().toISOString(),
      checks: {
        database: dbCheck,
        messaging_inbound: msg,
        approvals_orphaned: app
      }
    }, {
      status: ok ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' }
    })

  } catch (err) {
    return Response.json({
      ok: false,
      checked_at: new Date().toISOString(),
      checks: {
        database: { ok: false, reason: 'check_failed' },
        messaging_inbound: { ok: false, reason: 'check_failed' },
        approvals_orphaned: { ok: false, reason: 'check_failed' }
      }
    }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' }
    })
  }
}
