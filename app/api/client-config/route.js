import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')
    if (!clientId) return Response.json({ error: 'Missing client_id' }, { status: 400 })

    const supabase = getSupabase()
    if (!supabase) return Response.json({ pilot_started_at: null })

    const { data, error } = await supabase
      .from('clients')
      .select('id, name, slug, contact_name, contact_phone, pilot_started_at, fleet_size, tier')
      .eq('slug', clientId)
      .single()

    if (error) throw error
    return Response.json(data || { pilot_started_at: null })
  } catch (err) {
    return Response.json({ pilot_started_at: null, error: err.message }, { status: 500 })
  }
}
