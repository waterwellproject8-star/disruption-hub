import { supabase } from '../../../../lib/supabase.js'

// POST /api/driver/photo
// Multipart: job_id, client_id, driver_id, photo (base64 or file)
// Stores photo in Supabase Storage and updates the job record
export async function POST(request) {
  try {
    const formData = await request.formData()
    const jobId = formData.get('job_id')
    const clientId = formData.get('client_id')
    const driverId = formData.get('driver_id')
    const notes = formData.get('notes') || ''
    const file = formData.get('photo')

    if (!jobId || !clientId || !file) {
      return Response.json({ error: 'job_id, client_id and photo required' }, { status: 400 })
    }

    // Upload to Supabase Storage
    const fileName = `pod/${clientId}/${jobId}/${Date.now()}.jpg`
    const fileBuffer = await file.arrayBuffer()

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('pod-photos')
      .upload(fileName, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: false
      })

    if (uploadError) {
      // If storage bucket doesn't exist yet, log locally and continue
      console.error('Storage upload error:', uploadError)
      // Still record the POD was submitted
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('pod-photos').getPublicUrl(fileName)
    const publicUrl = urlData?.publicUrl || null

    // Record in pod_photos table
    const { data: photoRecord, error: photoError } = await supabase
      .from('pod_photos')
      .insert({
        client_id: clientId,
        job_id: jobId,
        driver_id: driverId || null,
        storage_path: fileName,
        public_url: publicUrl,
        notes,
        taken_at: new Date().toISOString()
      })
      .select()
      .single()

    if (photoError) throw photoError

    // Update job as completed with POD URL
    await supabase
      .from('driver_jobs')
      .update({
        pod_photo_url: publicUrl,
        pod_signed_at: new Date().toISOString(),
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .eq('client_id', clientId)

    // Get job ref to update tracking link
    const { data: job } = await supabase
      .from('driver_jobs')
      .select('ref')
      .eq('id', jobId)
      .single()

    if (job?.ref) {
      await supabase
        .from('tracking_links')
        .update({ status: 'delivered', delivered_at: new Date().toISOString() })
        .eq('job_ref', job.ref)
        .eq('client_id', clientId)
    }

    return Response.json({
      success: true,
      photo_url: publicUrl,
      photo_id: photoRecord.id,
      message: 'Proof of delivery recorded'
    })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
