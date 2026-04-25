import { createClient } from '@supabase/supabase-js'
import { fireCallbackIfPartnerEvent } from '../../../../lib/fireCallback.js'

function getDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { ref, client_id, resolution_method } = body

    if (!ref || !client_id) {
      return Response.json({ error: 'ref and client_id are required' }, { status: 400 })
    }

    const db = getDB()
    if (!db) return Response.json({ error: 'service unavailable' }, { status: 500 })

    const result = await fireCallbackIfPartnerEvent({
      ref,
      client_id: client_id.toLowerCase().trim(),
      resolution_method: resolution_method || 'ops',
      db
    })

    return Response.json(result)

  } catch (err) {
    console.error('[incidents/resolve] error:', err)
    return Response.json({ error: 'internal error' }, { status: 500 })
  }
}
