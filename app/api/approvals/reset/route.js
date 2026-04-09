import { createClient } from '@supabase/supabase-js'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

// POST /api/approvals/reset?client_id=pearson-haulage
// Clears all approvals for a client — used by the SETUP tab Reset button
// Allows clean test runs without logging out of driver app or running SQL

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url)
    const client_id = searchParams.get('client_id')

    if (!client_id) {
      return Response.json({ error: 'client_id required' }, { status: 400 })
    }

    const db = getDB()
    if (!db) return Response.json({ error: 'DB not configured' }, { status: 500 })

    // Delete all approvals for this client
    const { error, count } = await db
      .from('approvals')
      .delete({ count: 'exact' })
      .eq('client_id', client_id)

    if (error) {
      console.error('[approvals/reset] error:', error.message)
      return Response.json({ error: error.message }, { status: 500 })
    }

    console.log(`[approvals/reset] Cleared ${count} approvals for ${client_id}`)
    return Response.json({ success: true, cleared: count, client_id })

  } catch (err) {
    console.error('[approvals/reset] error:', err.message)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
