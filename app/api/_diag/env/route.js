export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  const key = request.headers.get('x-dh-key')
  if (!key || key !== process.env.NEXT_PUBLIC_DH_KEY) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const w3w = process.env.W3W_API_KEY || ''
  const internal = process.env.DH_INTERNAL_KEY || ''
  const twilio = process.env.TWILIO_PHONE_NUMBER || ''

  return Response.json({
    W3W_API_KEY: { present: w3w.length > 0, length: w3w.length, prefix: w3w.length >= 4 ? w3w.slice(0, 4) : null },
    DH_INTERNAL_KEY: { present: internal.length > 0, length: internal.length },
    TWILIO_PHONE_NUMBER: { present: twilio.length > 0, value: twilio.length >= 4 ? twilio.slice(-4) : null }
  }, { headers: { 'Cache-Control': 'no-store' } })
}
