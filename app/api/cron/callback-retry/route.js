import { createClient } from '@supabase/supabase-js'
import { deliverCallback, nextAttemptISO } from '../../../../lib/callbackDelivery.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

async function handle(request, mode) {
  const db = getDB()
  if (!db) return Response.json({ error: 'db_not_configured' }, { status: 503 })

  // Auth
  if (mode === 'cron') {
    const auth = request.headers.get('authorization')
    const expected = process.env.CRON_SECRET
    if (!expected || auth !== `Bearer ${expected}`) {
      return Response.json({ error: 'unauthorised' }, { status: 401 })
    }
  } else {
    const provided = request.headers.get('x-dh-key')
    const expected = process.env.DH_INTERNAL_KEY
    if (!expected || provided !== expected) {
      return Response.json({ error: 'unauthorised' }, { status: 401 })
    }
  }

  const startedAt = new Date().toISOString()

  try {
    // 1. Pick up eligible rows
    const { data: candidates, error: pickErr } = await db
      .from('callback_log')
      .select('id, api_key_id, event_type, callback_url, callback_secret, payload, attempt_number, max_attempts')
      .is('succeeded_at', null)
      .is('failed_at', null)
      .lte('next_attempt_at', new Date().toISOString())
      .order('next_attempt_at', { ascending: true })
      .limit(50)

    if (pickErr) {
      console.error('[callback-retry] query failed:', pickErr.message)
      return Response.json({ error: 'query_failed', message: pickErr.message }, { status: 500 })
    }

    if (!candidates || candidates.length === 0) {
      return Response.json({ ok: true, started_at: startedAt, processed: 0, message: 'no eligible rows' })
    }

    // Lease: bump next_attempt_at by +30s to prevent overlapping cron ticks
    const reservedUntil = new Date(Date.now() + 30 * 1000).toISOString()
    const ids = candidates.map(c => c.id)
    await db
      .from('callback_log')
      .update({ next_attempt_at: reservedUntil })
      .in('id', ids)

    // 2. Process each candidate
    let succeeded = 0, failedFinal = 0, requeued = 0

    for (const row of candidates) {
      const thisAttempt = (row.attempt_number || 1) + 1
      const result = await deliverCallback({
        url: row.callback_url,
        secret: row.callback_secret,
        payload: row.payload
      })

      const nowISO = new Date().toISOString()

      if (result.ok) {
        await db.from('callback_log').update({
          attempt_number: thisAttempt,
          last_attempted_at: nowISO,
          succeeded_at: nowISO,
          status_code: result.status_code,
          response_body: result.response_body || null,
          next_attempt_at: null,
          last_error: null
        }).eq('id', row.id)
        succeeded++
        continue
      }

      // Failed — schedule next or terminate
      const nextISO = nextAttemptISO(thisAttempt, row.max_attempts || 4)
      if (nextISO) {
        await db.from('callback_log').update({
          attempt_number: thisAttempt,
          last_attempted_at: nowISO,
          status_code: result.status_code,
          response_body: result.response_body || null,
          last_error: result.error || `http_${result.status_code}`,
          next_attempt_at: nextISO
        }).eq('id', row.id)
        requeued++
      } else {
        await db.from('callback_log').update({
          attempt_number: thisAttempt,
          last_attempted_at: nowISO,
          status_code: result.status_code,
          response_body: result.response_body || null,
          last_error: result.error || `http_${result.status_code}`,
          next_attempt_at: null,
          failed_at: nowISO
        }).eq('id', row.id)
        failedFinal++
      }
    }

    return Response.json({
      ok: true,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      processed: candidates.length,
      succeeded,
      requeued,
      failed_final: failedFinal
    })
  } catch (err) {
    console.error('[callback-retry] unhandled:', err)
    return Response.json({ error: 'internal_error', message: err.message }, { status: 500 })
  }
}

export async function GET(request) { return handle(request, 'cron') }
export async function POST(request) { return handle(request, 'manual') }
