import { supabase } from '../../lib/supabase.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ])
}

async function checkDatabase() {
  const start = Date.now()
  const { error } = await withTimeout(
    supabase.from('clients').select('id').limit(1),
    4000
  )
  const latency_ms = Date.now() - start
  if (error) return { ok: false, latency_ms, reason: 'check_failed' }
  return { ok: latency_ms < 2000, latency_ms }
}

async function checkMessagingInbound() {
  const { data, error } = await withTimeout(
    supabase.from('webhook_log')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    4000
  )

  if (error) return { ok: false, last_inbound_at: null, minutes_since_last_inbound: null, stale: true, business_hours: false, reason: 'check_failed' }

  if (!data) {
    return { ok: false, last_inbound_at: null, minutes_since_last_inbound: null, stale: true, business_hours: false }
  }

  const lastAt = new Date(data.created_at)
  const now = new Date()
  const minutes_since_last_inbound = Math.round((now - lastAt) / 60000)

  const ukFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hour12: false, weekday: 'short' })
  const parts = ukFormatter.formatToParts(now)
  const ukHour = Number(parts.find(p => p.type === 'hour').value)
  const ukDay = parts.find(p => p.type === 'weekday').value
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const business_hours = weekdays.includes(ukDay) && ukHour >= 8 && ukHour < 20

  let stale = false
  if (business_hours && minutes_since_last_inbound > 360) stale = true
  if (minutes_since_last_inbound > 4320) stale = true

  return {
    ok: !stale,
    last_inbound_at: lastAt.toISOString(),
    minutes_since_last_inbound,
    stale,
    business_hours
  }
}

async function checkOrphanedApprovals() {
  const now = new Date()
  const thirtyMinAgo = new Date(now - 30 * 60 * 1000).toISOString()
  const twentyFourHAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString()

  const { count, error } = await withTimeout(
    supabase.from('approvals')
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
  try {
    const [dbResult, msgResult, appResult] = await Promise.allSettled([
      checkDatabase(),
      checkMessagingInbound(),
      checkOrphanedApprovals()
    ])

    const db = dbResult.status === 'fulfilled' ? dbResult.value : { ok: false, latency_ms: null, reason: dbResult.reason?.message === 'timeout' ? 'timeout' : 'check_failed' }
    const msg = msgResult.status === 'fulfilled' ? msgResult.value : { ok: false, last_inbound_at: null, minutes_since_last_inbound: null, stale: true, business_hours: false, reason: msgResult.reason?.message === 'timeout' ? 'timeout' : 'check_failed' }
    const app = appResult.status === 'fulfilled' ? appResult.value : { ok: false, count: null, window_minutes: 30, reason: appResult.reason?.message === 'timeout' ? 'timeout' : 'check_failed' }

    const ok = db.ok && msg.ok && app.ok

    return Response.json({
      ok,
      checked_at: new Date().toISOString(),
      checks: {
        database: db,
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
