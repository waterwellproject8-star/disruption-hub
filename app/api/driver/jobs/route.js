import { supabase } from '../../../../lib/supabase.js'

// GET /api/driver/jobs?driver_id=xxx&client_id=xxx
// Returns all active jobs for this driver - used by the PWA on load
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const driverId = searchParams.get('driver_id')
    const clientId = searchParams.get('client_id')
    const vehicleReg = searchParams.get('vehicle_reg')

    if (!clientId) {
      return Response.json({ error: 'client_id required' }, { status: 400 })
    }

    let query = supabase
      .from('driver_jobs')
      .select('*')
      .eq('client_id', clientId)
      .in('status', ['pending', 'en_route'])
      .order('sla_deadline', { ascending: true })

    if (driverId) query = query.eq('driver_id', driverId)
    if (vehicleReg) query = query.eq('vehicle_reg', vehicleReg)

    const { data, error } = await query
    if (error) throw error

    return Response.json({ jobs: data || [], count: data?.length || 0 })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/driver/jobs — create or update a job (called by ops/dashboard)
export async function POST(request) {
  try {
    const body = await request.json()
    const {
      client_id, driver_id, vehicle_reg, ref,
      origin, destination, cargo,
      sla_deadline, instructions, status
    } = body

    if (!client_id || !ref) {
      return Response.json({ error: 'client_id and ref required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('driver_jobs')
      .upsert({
        client_id, driver_id, vehicle_reg, ref,
        origin, destination, cargo,
        sla_deadline, instructions,
        status: status || 'pending',
        updated_at: new Date().toISOString()
      }, { onConflict: 'ref,client_id' })
      .select()
      .single()

    if (error) throw error
    return Response.json({ success: true, job: data })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
