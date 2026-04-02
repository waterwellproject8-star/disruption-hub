import { getCurrentDieselPrice } from '../../../../lib/intelligence.js'
import { runIntelligenceModule } from '../../../../lib/intelligence-modules.js'
import { supabase } from '../../../../lib/supabase.js'

// POST /api/intelligence/cashflow
export async function POST(request) {
  try {
    const { client_id, invoices, client_payment_patterns, payroll, upcoming_costs } = await request.json()

    if (!invoices && !client_payment_patterns) {
      return Response.json({ error: 'invoices or client_payment_patterns required' }, { status: 400 })
    }

    // Get live diesel price
    const fuelData = await getCurrentDieselPrice()

    let clientContext = ''
    if (client_id) {
      const { data } = await supabase.from('clients').select('system_prompt').eq('id', client_id).single()
      clientContext = data?.system_prompt || ''
    }

    const result = await runIntelligenceModule('cashflow', {
      outstanding_invoices: invoices || [],
      client_payment_patterns: client_payment_patterns || [],
      payroll_schedule: payroll || {},
      upcoming_costs: upcoming_costs || [],
      current_fuel_price: fuelData,
      industry_context: {
        average_days_to_pay_logistics: 47,
        typical_overdraft_rate: 0.085,
        invoice_financing_cost: 0.03,
      }
    }, clientContext)

    // Persist forecast
    if (client_id && result.weekly_forecast) {
      await supabase.from('cashflow_forecasts').insert({
        client_id,
        forecast_date: new Date().toISOString().split('T')[0],
        period_start: new Date().toISOString().split('T')[0],
        period_end: new Date(Date.now() + 84 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        weekly_forecasts: result.weekly_forecast,
        total_expected_inflows: result.weekly_forecast.reduce((a, w) => a + (w.expected_inflows || 0), 0),
        total_expected_outflows: result.weekly_forecast.reduce((a, w) => a + (w.expected_outflows || 0), 0),
        trough_detected: result.summary?.trough_detected || false,
        trough_week: result.summary?.trough_week || null,
        trough_amount: result.summary?.trough_amount || 0,
        trough_actions: result.actions || [],
      })
    }

    return Response.json({ success: true, fuel_data: fuelData, ...result })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

// GET — latest cash flow forecast
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')
  if (!clientId) return Response.json({ error: 'client_id required' }, { status: 400 })

  const { data } = await supabase
    .from('cashflow_forecasts')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return Response.json({ forecast: data || null })
}
