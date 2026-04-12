import { createClient } from '@supabase/supabase-js'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const client_id = searchParams.get('client_id')
    if (!client_id) return Response.json({ error: 'client_id required' }, { status: 400 })

    const db = getDB()
    if (!db) return Response.json({ invoices: [] })

    const { data, error } = await db
      .from('invoices')
      .select('*')
      .eq('client_id', client_id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ invoices: data || [] })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { client_id, invoices: batch, carrier, invoice_ref, invoice_date, line_items, source } = body

    if (!client_id) return Response.json({ error: 'client_id required' }, { status: 400 })

    const db = getDB()
    if (!db) return Response.json({ success: false, error: 'DB not configured' })

    const rows = []

    if (batch && Array.isArray(batch)) {
      for (const inv of batch) {
        const items = inv.line_items || []
        const totalCharged = items.reduce((s, i) => s + (Number(i.charged) || 0), 0)
        const totalAgreed = items.reduce((s, i) => s + (Number(i.agreed_rate) || 0), 0)
        rows.push({
          client_id,
          carrier: inv.carrier || 'Unknown',
          invoice_ref: inv.invoice_ref || 'N/A',
          invoice_date: inv.invoice_date || null,
          line_items: items,
          total_charged: totalCharged,
          total_agreed: totalAgreed,
          total_overcharge: Math.max(0, totalCharged - totalAgreed),
          status: 'pending_review',
          source: inv.source || source || 'csv_upload'
        })
      }
    } else if (carrier && invoice_ref) {
      const items = line_items || []
      const totalCharged = items.reduce((s, i) => s + (Number(i.charged) || 0), 0)
      const totalAgreed = items.reduce((s, i) => s + (Number(i.agreed_rate) || 0), 0)
      rows.push({
        client_id,
        carrier,
        invoice_ref,
        invoice_date: invoice_date || null,
        line_items: items,
        total_charged: totalCharged,
        total_agreed: totalAgreed,
        total_overcharge: Math.max(0, totalCharged - totalAgreed),
        status: 'pending_review',
        source: source || 'manual'
      })
    } else {
      return Response.json({ error: 'Provide carrier+invoice_ref or invoices batch' }, { status: 400 })
    }

    const { data, error } = await db.from('invoices').insert(rows).select()
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({ success: true, inserted: data?.length || 0, invoices: data })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const { id, status } = await request.json()
    if (!id || !status) return Response.json({ error: 'id and status required' }, { status: 400 })

    const valid = ['pending_review', 'disputed', 'resolved', 'approved']
    if (!valid.includes(status)) return Response.json({ error: `Invalid status. Must be: ${valid.join(', ')}` }, { status: 400 })

    const db = getDB()
    if (!db) return Response.json({ success: false, error: 'DB not configured' })

    const { error } = await db.from('invoices').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({ success: true, id, status })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
