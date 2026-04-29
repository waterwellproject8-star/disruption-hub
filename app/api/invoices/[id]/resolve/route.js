import { createClient } from '@supabase/supabase-js'
import { fireInvoiceCallback } from '../../../../../lib/invoiceDispatch.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

function checkInternalKey(request) {
  const provided = request.headers.get('x-dh-key')
  const expected = process.env.DH_INTERNAL_KEY
  if (!expected) {
    console.error('[invoice-resolve] DH_INTERNAL_KEY not set')
    return false
  }
  return provided === expected
}

export async function POST(request, context) {
  if (!checkInternalKey(request)) {
    return Response.json({ error: 'unauthorised' }, { status: 401 })
  }

  const params = await context.params
  const invoiceId = params?.id
  if (!invoiceId) return Response.json({ error: 'invoice_id_required' }, { status: 400 })

  let body
  try { body = await request.json() } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }) }

  const { recovered_amount, resolution_notes, response_received_at } = body || {}
  if (recovered_amount === undefined || recovered_amount === null) {
    return Response.json({ error: 'recovered_amount_required' }, { status: 400 })
  }
  const recoveredNum = Number(recovered_amount)
  if (Number.isNaN(recoveredNum) || recoveredNum < 0) {
    return Response.json({ error: 'recovered_amount_must_be_non_negative_number' }, { status: 400 })
  }

  const db = getDB()
  if (!db) return Response.json({ error: 'db_not_configured' }, { status: 503 })

  try {
    // 1. Load invoice
    const { data: inv, error: loadErr } = await db
      .from('invoices')
      .select('id, client_id, invoice_ref, carrier, status, total_overcharge, dispute_email_sent_at, created_by_api_key, recovered_amount')
      .eq('id', invoiceId)
      .single()

    if (loadErr || !inv) {
      console.error('[invoice-resolve] not found:', loadErr?.message)
      return Response.json({ error: 'invoice_not_found' }, { status: 404 })
    }

    // 2. Must have been disputed first
    if (inv.status !== 'disputed') {
      return Response.json({
        error: 'invalid_state',
        message: `Cannot resolve invoice in status '${inv.status}'. Must be 'disputed' first.`
      }, { status: 409 })
    }

    // 3. Idempotency: already resolved?
    if (inv.recovered_amount !== null && inv.recovered_amount !== undefined && inv.recovered_amount !== 0) {
      return Response.json({
        success: true,
        already_resolved: true,
        invoice_id: invoiceId,
        recovered_amount: Number(inv.recovered_amount),
        message: 'Invoice already resolved.'
      })
    }

    // 4. Update
    const resolvedAt = new Date().toISOString()
    const responseAt = response_received_at || resolvedAt

    const { error: updateErr } = await db
      .from('invoices')
      .update({
        status: 'resolved',
        recovered_amount: recoveredNum,
        recovered_at: resolvedAt,
        response_received_at: responseAt,
        ...(resolution_notes ? { resolution_notes } : {}),
        updated_at: resolvedAt
      })
      .eq('id', invoiceId)

    if (updateErr) {
      console.error('[invoice-resolve] update failed:', updateErr.message)
      return Response.json({ error: 'storage_failed', message: updateErr.message }, { status: 500 })
    }

    // 5. Fire callback if partner-created
    let callbackFired = false
    let callbackError = null
    if (inv.created_by_api_key) {
      try {
        await fireInvoiceCallback(db, inv.created_by_api_key, 'invoice.dispute_resolved', {
          invoice_id: inv.id,
          invoice_ref: inv.invoice_ref,
          carrier: inv.carrier,
          client_id: inv.client_id,
          total_overcharge: Number(inv.total_overcharge) || 0,
          recovered_amount: recoveredNum,
          recovered_at: resolvedAt,
          response_received_at: responseAt,
          resolution_notes: resolution_notes || null
        })
        callbackFired = true
      } catch (cbErr) {
        console.error('[invoice-resolve] callback fire failed (non-fatal):', cbErr.message)
        callbackError = cbErr.message
      }
    }

    return Response.json({
      success: true,
      invoice_id: invoiceId,
      invoice_ref: inv.invoice_ref,
      status: 'resolved',
      recovered_amount: recoveredNum,
      recovered_at: resolvedAt,
      callback_fired: callbackFired,
      ...(callbackError ? { callback_error: callbackError } : {})
    })
  } catch (err) {
    console.error('[invoice-resolve] unhandled:', err)
    return Response.json({ error: 'internal_error', message: err.message }, { status: 500 })
  }
}
