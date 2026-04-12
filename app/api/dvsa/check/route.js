// DVSA MOT History API Integration — Placeholder
//
// DVSA Developer Portal: https://developer-portal.driver-vehicle-licensing.agency.gov.uk/
// Requires DVLA API key registration (free for trade use)
//
// Live endpoint: GET https://beta.check-mot.service.gov.uk/trade/vehicles/mot-tests?registration={reg}
// Headers: x-api-key: {DVSA_API_KEY}
//
// When connected, this route will:
// 1. Accept a vehicle_reg in the query string
// 2. Fetch live MOT test history from the DVSA API
// 3. Extract: MOT expiry, last test date, last test result, advisory/failure items
// 4. Upsert the data into dvsa_records for that vehicle
// 5. Return the fresh record
//
// To enable: add DVSA_API_KEY to Vercel environment variables

export async function GET(request) {
  const apiKey = process.env.DVSA_API_KEY
  if (!apiKey) {
    return Response.json({
      status: 'not_connected',
      message: 'DVSA API key not configured. Add DVSA_API_KEY to Vercel environment variables to enable live MOT checks.'
    })
  }

  const { searchParams } = new URL(request.url)
  const reg = searchParams.get('registration')
  if (!reg) return Response.json({ error: 'registration query parameter required' }, { status: 400 })

  try {
    const res = await fetch(`https://beta.check-mot.service.gov.uk/trade/vehicles/mot-tests?registration=${encodeURIComponent(reg)}`, {
      headers: { 'x-api-key': apiKey, 'Accept': 'application/json' }
    })
    if (!res.ok) return Response.json({ error: `DVSA API returned ${res.status}` }, { status: res.status })
    const data = await res.json()
    return Response.json({ status: 'connected', data })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
