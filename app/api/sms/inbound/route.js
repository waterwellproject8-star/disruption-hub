import { createClient } from '@supabase/supabase-js'

// POST /api/sms/inbound
// Twilio webhook — fires every time an SMS arrives at the Twilio number
// Configure in Twilio console: Phone Number → Messaging → Webhook URL
// URL: https://disruptionhub.ai/api/sms/inbound
//
// What it does:
// 1. Reads From number + Body from Twilio POST
// 2. Looks up driver_progress in Supabase to identify which driver + client
// 3. Creates an approval record so it appears in the APPROVALS tab
// 4. Returns TwiML 200 so Twilio doesn't retry

export async function POST(request) {
  try {
    // Twilio sends as form-encoded
    const body = await request.text()
    const params = new URLSearchParams(body)
    const fromNumber = params.get('From') || ''
    const smsBody    = params.get('Body') || ''
    const toNumber   = params.get('To') || ''

    if (!fromNumber || !smsBody) {
      return new Response(twiml(''), { headers: { 'Content-Type': 'text/xml' } })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
      // Supabase not configured — still return 200 to Twilio
      console.log('[SMS Inbound] Supabase not configured. From:', fromNumber, 'Body:', smsBody)
      return new Response(twiml(''), { headers: { 'Content-Type': 'text/xml' } })
    }

    const db = createClient(supabaseUrl, supabaseKey)

    // Normalise the incoming number — Twilio sends E.164 e.g. +447700900000
    const normFrom = fromNumber.replace(/\s/g, '')

    // Look up which driver this is
    // driver_progress stores driver_phone set when shift starts
    const { data: driverRow } = await db
      .from('driver_progress')
      .select('client_id, vehicle_reg, driver_name, job_ref, status')
      .eq('driver_phone', normFrom)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Determine client — use driver lookup or fall back to pearson-haulage for demo
    const clientId   = driverRow?.client_id || 'pearson-haulage'
    const vehicleReg = driverRow?.vehicle_reg || 'UNKNOWN'
    const driverName = driverRow?.driver_name || normFrom
    const jobRef     = driverRow?.job_ref || null

    // Classify the message — is it a resolution or a new alert?
    const upperBody = smsBody.trim().toUpperCase()
    const isResolved = upperBody === 'DONE' || upperBody.startsWith('RESOLVED') || upperBody.startsWith('DONE -')
    const isPanic    = upperBody.includes('HELP') || upperBody.includes('EMERGENCY') || upperBody.includes('999')

    const severity     = isPanic ? 'CRITICAL' : isResolved ? 'LOW' : 'HIGH'
    const actionLabel  = isResolved
      ? `✅ ${driverName} (${vehicleReg}) confirmed job complete${jobRef ? ` — ${jobRef}` : ''}`
      : isPanic
        ? `🚨 PANIC — ${driverName} (${vehicleReg}) needs immediate help`
        : `📱 Driver alert — ${driverName} (${vehicleReg})${jobRef ? ` · ${jobRef}` : ''}: ${smsBody.substring(0, 80)}`

    // Insert into approvals table so it shows in the APPROVALS tab
    await db.from('approvals').insert({
      client_id:      clientId,
      action_type:    isResolved ? 'driver_resolved' : 'driver_alert',
      action_label:   actionLabel,
      action_details: {
        from_number:  normFrom,
        driver_name:  driverName,
        vehicle_reg:  vehicleReg,
        job_ref:      jobRef,
        message_body: smsBody,
        severity,
        source:       'driver_sms_inbound'
      },
      financial_value:  0,
      requires_approval: !isResolved,  // resolutions don't need ops action
      status:           isResolved ? 'executed' : 'pending',
      severity
    })

    // Also update driver_progress status if resolved
    if (isResolved && driverRow) {
      await db
        .from('driver_progress')
        .update({ status: 'resolved', last_alert: smsBody, updated_at: new Date().toISOString() })
        .eq('driver_phone', normFrom)
    }

    // Return empty TwiML — no auto-reply (ops replies manually via dashboard)
    return new Response(twiml(''), {
      headers: { 'Content-Type': 'text/xml' }
    })

  } catch (err) {
    console.error('[SMS Inbound] Error:', err)
    // Always return 200 to Twilio — don't let it retry
    return new Response(twiml(''), { headers: { 'Content-Type': 'text/xml' } })
  }
}

function twiml(message) {
  if (!message) return `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`
}
