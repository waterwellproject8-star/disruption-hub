import { createClient } from '@supabase/supabase-js'

const CANONICAL_REFS = [
  'FF-INV-99001',
  'FF-INV-DAY9-DEMO',
  'INV-001',
  'INV-002',
  'XPO-INV-44821'
]

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder') || key.includes('placeholder')) {
    return null
  }
  return createClient(url, key)
}

function checkInternalKey(request) {
  const headerKey = request.headers.get('x-dh-key')
  return headerKey === process.env.DH_INTERNAL_KEY
}

export async function POST(request) {
  if (!checkInternalKey(request)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  let body = {}
  try {
    body = await request.json()
  } catch {
    // empty body is fine — we default client_id below
  }

  const clientId = (body.client_id || 'pearson-haulage').toLowerCase().trim()

  const db = getDB()
  if (!db) {
    return Response.json({ ok: false, error: 'db_unavailable' }, { status: 503 })
  }

  try {
    // NOTE: do NOT null dispute_email_to or dispute_email_body — those
    // are audit-time fields composed by the pipeline. Reset only clears
    // send-time markers (dispute_email_id, dispute_email_sent_at).
    const { data, error } = await db
      .from('invoices')
      .update({
        status: 'pending_review',
        dispute_email_id: null,
        dispute_email_sent_at: null,
        recovered_amount: 0,
        recovered_at: null
      })
      .eq('client_id', clientId)
      .in('invoice_ref', CANONICAL_REFS)
      .select('invoice_ref, status, total_overcharge')

    if (error) {
      console.error('[demo/reset-invoices] supabase error', error)
      return Response.json({ ok: false, error: 'db_error' }, { status: 500 })
    }

    const total = (data || []).reduce(
      (sum, row) => sum + (Number(row.total_overcharge) || 0),
      0
    )

    return Response.json({
      ok: true,
      client_id: clientId,
      reset_count: (data || []).length,
      total_overcharge: Number(total.toFixed(2)),
      refs: (data || []).map((r) => r.invoice_ref).sort()
    })
  } catch (err) {
    console.error('[demo/reset-invoices] unexpected', err)
    return Response.json({ ok: false, error: 'internal' }, { status: 500 })
  }
}
