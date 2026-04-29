import { createClient } from '@supabase/supabase-js'
import { auditInvoice } from '../../../../../lib/invoicePipeline.js'

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
    console.error('[invoice-run] DH_INTERNAL_KEY env var not set — refusing all requests')
    return false
  }
  return provided === expected
}

export async function POST(request) {
  // 1. Auth
  if (!checkInternalKey(request)) {
    return Response.json({ error: 'unauthorised' }, { status: 401 })
  }

  // 2. Parse body
  let body
  try {
    body = await request.json()
  } catch (err) {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { client_id, file_content, file_type, filename } = body
  if (!client_id || !file_content || !file_type) {
    return Response.json({
      error: 'missing_required_fields',
      message: 'client_id, file_content, file_type required'
    }, { status: 400 })
  }

  if (!['txt', 'csv'].includes(file_type.toLowerCase())) {
    return Response.json({
      error: 'unsupported_file_type',
      message: 'Only txt and csv supported. PDF support coming in Phase 2.'
    }, { status: 400 })
  }

  const db = getDB()
  if (!db) {
    return Response.json({ error: 'db_not_configured' }, { status: 503 })
  }

  // 3. Run shared pipeline
  let result
  try {
    result = await auditInvoice({ db, clientId: client_id, fileContent: file_content, fileType: file_type, filename })
  } catch (err) {
    console.error('[invoice-run] Pipeline failed:', err.message)
    const msg = err.message || 'pipeline_failed'
    if (msg.startsWith('parse_failed') || msg === 'no_line_items_found') {
      return Response.json({ error: msg.split(':')[0], message: msg }, { status: 400 })
    }
    if (msg.startsWith('ai_module_failed')) {
      return Response.json({ error: 'ai_failed', message: 'Invoice analysis could not complete. Please retry.' }, { status: 502 })
    }
    return Response.json({ error: 'storage_failed', message: msg }, { status: 500 })
  }

  // 4. Handle duplicate
  if (result.duplicate) {
    return Response.json({
      success: true,
      duplicate: true,
      existing_invoice_id: result.invoice_id,
      message: 'This invoice was already processed in the last 24 hours.'
    })
  }

  // 5. Return result to dashboard (same shape as before)
  return Response.json({
    success: true,
    invoice_id: result.invoice_id,
    invoice_ref: result.parsed.invoice_ref,
    carrier: result.parsed.carrier,
    summary: {
      total_charged: result.summary.total_charged,
      total_overcharge: result.summary.total_overcharge,
      annual_projection: result.aiResult?.annual_projection || null,
      discrepancy_count: result.summary.discrepancy_count,
      unvalidated_count: result.summary.unvalidated_count
    },
    discrepancies: result.discrepancies,
    rate_cards_matched: result.rateCardsMatched,
    shipments_matched: result.shipmentsMatched,
    line_items_count: (result.parsed.line_items || []).length,
    dispute_draft_available: result.summary.dispute_draft_available,
    dispute_email_to: result.dispute_draft?.to || null,
    dispute_subject: result.dispute_draft?.subject || null,
    dispute_internal_summary: result.dispute_draft?.internal_summary || null
  })
}
