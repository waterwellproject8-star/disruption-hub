import { supabase } from '../../../../lib/supabase.js'

// POST /api/driver/acknowledge
// Body: { job_id, driver_id, client_id, response: 'acknowledged'|'issue', note }
export async function POST(request) {
  try {
    const { job_id, driver_id, client_id, response, note, status } = await request.json()

    if (!job_id || !client_id) {
      return Response.json({ error: 'job_id and client_id required' }, { status: 400 })
    }

    const updateData = {
      instruction_acknowledged: true,
      instruction_acknowledged_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    if (response === 'issue') updateData.notes = note || 'Driver reported an issue'
    if (status) updateData.status = status // e.g. 'en_route', 'completed'

    const { data, error } = await supabase
      .from('driver_jobs')
      .update(updateData)
      .eq('id', job_id)
      .eq('client_id', client_id)
      .select()
      .single()

    if (error) throw error

    // If driver marked as completed, update any tracking links
    if (status === 'completed' && data.ref) {
      await supabase
        .from('tracking_links')
        .update({ status: 'delivered', delivered_at: new Date().toISOString() })
        .eq('job_ref', data.ref)
        .eq('client_id', client_id)
    }

    // Log to approvals if driver reported an issue — ops manager needs to see it
    if (response === 'issue') {
      await supabase.from('approvals').insert({
        client_id,
        action_type: 'internal_flag',
        action_label: `DRIVER ISSUE REPORT — ${data.ref}`,
        action_details: {
          job_ref: data.ref,
          driver_id,
          note: note || 'Driver reported an issue',
          content: `Driver reported an issue on job ${data.ref}: ${note || 'No detail provided'}. Please check in with the driver.`
        },
        financial_value: 0,
        auto_approve: true,
        status: 'pending'
      })
    }

    return Response.json({ success: true, job: data })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
