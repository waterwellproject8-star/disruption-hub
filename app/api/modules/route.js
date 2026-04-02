import { runModule } from '../../../lib/anthropic.js'
import { logModuleRun, queueAction, getClientConfig } from '../../../lib/supabase.js'

// Demo data injected when no real client data is connected
const DEMO_DATA = {
  disruption: {
    active_shipments: [
      { ref: 'REF-8832', route: 'Glasgow → London', carrier: 'FastFreight UK', status: 'disrupted', alert: 'M74 closure — driver stationary 40 mins', eta: 'unknown', cargo: 'mixed freight', value: 8500 },
      { ref: 'REF-9103', route: 'Birmingham → Edinburgh', carrier: 'Yodel', status: 'delayed', alert: 'Weather delay — 45min behind schedule', eta: '17:45', cargo: 'electronics', value: 12000 }
    ],
    weather_alerts: ['Yellow weather warning — strong winds M74 corridor until 18:00'],
    timestamp: new Date().toISOString()
  },

  invoice: {
    invoices: [
      { ref: 'INV-2024-8821', carrier: 'FastFreight UK', amount: 1847.50, route: 'Manchester-London', distance_miles: 212, date: '2026-03-28', fuel_surcharge_pct: 18.5, agreed_rate_per_mile: 3.20 },
      { ref: 'INV-2024-8756', carrier: 'XPO Logistics', amount: 890.00, route: 'Leeds-Cardiff', distance_miles: 189, date: '2026-03-22', fuel_surcharge_pct: 22.0, agreed_rate_per_mile: 3.50 }
    ],
    rate_cards: {
      'FastFreight UK': { max_fuel_surcharge_pct: 15.0 },
      'XPO Logistics': { max_fuel_surcharge_pct: 15.0 }
    },
    period: 'March 2026'
  },

  sla_prediction: {
    active_deliveries: [
      { ref: 'REF-4421', client: 'Tesco DC Bradford', driver: 'Carl Hughes', vehicle_reg: 'BK21 XYZ', route: 'Manchester → Bradford', sla_window_closes: '14:30', current_position: 'M62 J26', distance_remaining_miles: 18, current_eta: '14:38', traffic_alert: 'M62 J25-J26 slow — 12 min delay reported', penalty_if_breached: 340 },
      { ref: 'REF-5517', client: 'NHS Sheffield', driver: 'Mark Davies', vehicle_reg: 'LN70 ABC', route: 'Leeds → Sheffield', sla_window_closes: '16:00', current_position: 'A61 Wakefield', distance_remaining_miles: 22, current_eta: '15:55', traffic_alert: 'A61 roadworks — 8 min delay', penalty_if_breached: 500 },
      { ref: 'REF-9103', client: 'Sainsburys RDC Edinburgh', driver: 'James Reid', vehicle_reg: 'SF68 PQR', route: 'Birmingham → Edinburgh', sla_window_closes: '17:30', current_position: 'M6 J38', distance_remaining_miles: 142, current_eta: '18:10', traffic_alert: 'Significant delay — already 40min behind', penalty_if_breached: 750 }
    ],
    timestamp: new Date().toISOString()
  },

  fuel: {
    current_diesel_price_ppl: 141.2,
    price_30_days_ago_ppl: 148.6,
    price_trend: 'falling',
    forecourt_prices: [
      { name: 'Moto Trowell M1 J25', ppl: 138.9, distance_from_depot_miles: 8 },
      { name: 'BP Motorway A1 Wetherby', ppl: 139.4, distance_from_depot_miles: 14 },
      { name: 'Esso Bradford', ppl: 141.8, distance_from_depot_miles: 3 }
    ],
    vehicles: [
      { reg: 'BK21 XYZ', driver: 'Carl Hughes', fuel_level_pct: 28, tank_capacity_litres: 400, next_route: 'Manchester → Bristol', route_distance_miles: 180 },
      { reg: 'LN70 ABC', driver: 'Mark Davies', fuel_level_pct: 62, tank_capacity_litres: 380, next_route: 'Leeds → Cardiff', route_distance_miles: 210 },
      { reg: 'SF68 PQR', driver: 'James Reid', fuel_level_pct: 19, tank_capacity_litres: 420, next_route: 'Birmingham → Edinburgh', route_distance_miles: 295 },
      { reg: 'YX70 MNO', driver: 'Paul Wright', fuel_level_pct: 45, tank_capacity_litres: 360, next_route: 'Leeds → London', route_distance_miles: 195 }
    ],
    fleet_monthly_fuel_spend: 14800
  },

  driver_hours: {
    drivers: [
      { name: 'Carl Hughes', vehicle: 'BK21 XYZ', hours_this_week: 52, hours_today: 9.5, wtd_limit: 60, remaining_deliveries: ['Bradford Tesco 14:30', 'Halifax RDC 16:00', 'Return to depot'] },
      { name: 'Mark Davies', vehicle: 'LN70 ABC', hours_this_week: 44, hours_today: 7.0, wtd_limit: 60, remaining_deliveries: ['NHS Sheffield 16:00', 'Return to depot'] },
      { name: 'James Reid', vehicle: 'SF68 PQR', hours_this_week: 57, hours_today: 10.2, wtd_limit: 60, remaining_deliveries: ['Edinburgh RDC 18:00'] },
      { name: 'Paul Wright', vehicle: 'YX70 MNO', hours_this_week: 39, hours_today: 6.5, wtd_limit: 60, remaining_deliveries: ['London DC 19:00', 'Return to depot'] }
    ]
  },

  carrier: {
    performance_data: [
      { carrier: 'FastFreight UK', deliveries_last_90_days: 142, on_time: 118, damaged: 4, invoice_disputes: 8, contract_otr_threshold: 90, agreed_rate_per_mile: 3.20 },
      { carrier: 'DHL Express', deliveries_last_90_days: 89, on_time: 85, damaged: 1, invoice_disputes: 1, contract_otr_threshold: 95, agreed_rate_per_mile: 4.10 },
      { carrier: 'Yodel', deliveries_last_90_days: 203, on_time: 171, damaged: 9, invoice_disputes: 12, contract_otr_threshold: 92, agreed_rate_per_mile: 2.80 },
      { carrier: 'XPO Logistics', deliveries_last_90_days: 67, on_time: 64, damaged: 0, invoice_disputes: 2, contract_otr_threshold: 93, agreed_rate_per_mile: 3.50 }
    ]
  },

  vehicle_health: {
    vehicles: [
      { reg: 'BK21 XYZ', mileage: 187420, last_service_miles: 175000, service_interval_miles: 15000, fault_codes: ['P0420 catalytic efficiency', 'brake pad wear 2mm left front'], tyre_tread_mm: [4.2, 4.8, 3.1, 3.4], next_mot: '2026-07-15' },
      { reg: 'LN70 ABC', mileage: 94300, last_service_miles: 90000, service_interval_miles: 15000, fault_codes: [], tyre_tread_mm: [6.1, 6.0, 5.9, 6.2], next_mot: '2026-09-22' },
      { reg: 'SF68 PQR', mileage: 231800, last_service_miles: 220000, service_interval_miles: 15000, fault_codes: ['engine oil pressure low intermittent', 'coolant temp sensor fault'], tyre_tread_mm: [2.8, 3.0, 7.1, 7.0], next_mot: '2026-05-08' },
      { reg: 'YX70 MNO', mileage: 156700, last_service_miles: 150000, service_interval_miles: 15000, fault_codes: ['P0171 system lean bank 1'], tyre_tread_mm: [5.5, 5.4, 5.6, 5.3], next_mot: '2026-11-30' }
    ]
  },

  carbon: {
    fleet: [
      { reg: 'BK21 XYZ', type: 'HGV artic 44t', fuel: 'diesel', monthly_miles: 8400, mpg: 8.2, payload_utilisation_pct: 78 },
      { reg: 'LN70 ABC', type: 'HGV rigid 18t', fuel: 'diesel', monthly_miles: 6200, mpg: 11.4, payload_utilisation_pct: 65 },
      { reg: 'SF68 PQR', type: 'HGV artic 44t', fuel: 'diesel', monthly_miles: 9100, mpg: 7.9, payload_utilisation_pct: 82 },
      { reg: 'YX70 MNO', type: 'HGV rigid 18t', fuel: 'diesel', monthly_miles: 5800, mpg: 10.8, payload_utilisation_pct: 71 }
    ],
    reporting_period: 'Q1 2026',
    customers_requiring_report: ['Tesco', 'NHS Sheffield', 'B&Q']
  },

  hazmat: {
    jobs_today: [
      { ref: 'JOB-4421', cargo: 'mixed freight — electronics', driver: 'Carl Hughes', cert_expiry: '2027-03-01', vehicle_has_adr: false },
      { ref: 'JOB-7732', cargo: 'paint and solvents — Class 3 flammable liquid', driver: 'Paul Wright', cert_expiry: '2025-11-30', vehicle_has_adr: true, un_number: 'UN1263', adr_class: '3' },
      { ref: 'JOB-7844', cargo: 'industrial batteries — Class 9', driver: 'Mark Davies', cert_expiry: '2026-08-15', vehicle_has_adr: true, un_number: 'UN3480', adr_class: '9' }
    ]
  },

  driver_retention: {
    drivers: [
      { name: 'Carl Hughes', tenure_years: 7, hours_last_4_weeks: [58, 60, 57, 59], weekend_work_last_month: 4, pay_vs_market_pct: -8, complaints_last_90_days: 0, recent_absence_days: 0 },
      { name: 'James Reid', tenure_years: 2, hours_last_4_weeks: [62, 61, 60, 63], weekend_work_last_month: 5, pay_vs_market_pct: -12, complaints_last_90_days: 1, recent_absence_days: 3 },
      { name: 'Mark Davies', tenure_years: 11, hours_last_4_weeks: [48, 52, 49, 51], weekend_work_last_month: 2, pay_vs_market_pct: -3, complaints_last_90_days: 0, recent_absence_days: 0 },
      { name: 'Paul Wright', tenure_years: 1, hours_last_4_weeks: [55, 54, 58, 60], weekend_work_last_month: 3, pay_vs_market_pct: -15, complaints_last_90_days: 2, recent_absence_days: 5 }
    ],
    local_market_rate_hgv: 38500
  },

  tender: {
    company_capabilities: ['temperature controlled', 'hazardous goods ADR', 'NHS framework', 'retail RDC', 'last mile', 'pallet network', 'UK nationwide'],
    fleet_size: 28,
    regions: ['Yorkshire', 'East Midlands', 'North West', 'Scotland'],
    accreditations: ['FORS Bronze', 'ISO 9001', 'NHS Approved Supplier'],
    search_date: new Date().toISOString()
  },

  regulation: {
    check_date: new Date().toISOString(),
    fleet_type: 'mixed HGV and van',
    international_ops: false,
    london_ops: false
  },

  consolidation: {
    todays_jobs: [
      { ref: 'JOB-A', origin: 'Leeds depot', destination: 'Manchester', weight_kg: 800, volume_m3: 4.2, deadline: '14:00', vehicle_assigned: 'LN70 ABC' },
      { ref: 'JOB-B', origin: 'Leeds depot', destination: 'Manchester area — Salford', weight_kg: 600, volume_m3: 3.1, deadline: '15:30', vehicle_assigned: 'YX70 MNO' },
      { ref: 'JOB-C', origin: 'Leeds depot', destination: 'Sheffield', weight_kg: 1200, volume_m3: 6.0, deadline: '13:00', vehicle_assigned: 'BK21 XYZ' },
      { ref: 'JOB-D', origin: 'Leeds depot', destination: 'Sheffield — Meadowhall', weight_kg: 900, volume_m3: 5.5, deadline: '14:30', vehicle_assigned: 'SF68 PQR' }
    ],
    vehicle_capacities: { max_weight_kg: 3500, max_volume_m3: 18 }
  },

  forecast: {
    historical_volumes: { jan: 420, feb: 398, mar: 445, apr_last_year: 510, may_last_year: 488, jun_last_year: 467 },
    current_month_to_date: 380,
    known_upcoming: ['B&Q spring range launch early May', 'NHS quarter-end April 30', 'School Easter holidays week commencing April 7'],
    current_fleet_capacity_jobs_per_week: 95
  },

  benchmarking: {
    active_lanes: [
      { lane: 'Leeds → London', weekly_runs: 8, current_rate_per_mile: 3.10, contracted_carrier: 'FastFreight UK', contract_renewal: '2026-06-01' },
      { lane: 'Manchester → Bristol', weekly_runs: 5, current_rate_per_mile: 2.95, contracted_carrier: 'XPO Logistics', contract_renewal: '2026-09-01' },
      { lane: 'Glasgow → Birmingham', weekly_runs: 3, current_rate_per_mile: 3.40, contracted_carrier: 'DHL Express', contract_renewal: '2027-01-01' },
      { lane: 'Leeds → Edinburgh', weekly_runs: 4, current_rate_per_mile: 3.20, contracted_carrier: 'Yodel', contract_renewal: '2026-04-30' }
    ],
    market_date: 'April 2026'
  },

  insurance: {
    open_claims: [
      { ref: 'CLM-2026-041', date: '2026-03-15', type: 'cargo_damage', claimed_value: 4200, carrier: 'Yodel', description: 'Customer claims 6 pallets of electronics damaged in transit. Carrier denies responsibility.', driver: 'Paul Wright', vehicle: 'YX70 MNO', delivery_ref: 'REF-7201' },
      { ref: 'CLM-2026-028', date: '2026-02-28', type: 'late_delivery_penalty', claimed_value: 1800, carrier: 'FastFreight UK', description: 'NHS penalty invoice for 3 late deliveries in February', driver: 'Carl Hughes', vehicle: 'BK21 XYZ', delivery_refs: ['REF-6801', 'REF-6823', 'REF-6857'] }
    ]
  }
}

// POST /api/modules
export async function POST(request) {
  try {
    const body = await request.json()
    const { module, data, client_id } = body

    if (!module) {
      return Response.json({ error: 'module is required' }, { status: 400 })
    }

    // Get client config if provided
    let clientSystemPrompt = ''
    if (client_id) {
      try {
        const clientConfig = await getClientConfig(client_id)
        clientSystemPrompt = clientConfig?.system_prompt || ''
      } catch {}
    }

    // Use demo data if no real data provided or data is just a trigger ping
    const isEmptyTrigger = !data || Object.keys(data).filter(k => k !== 'trigger' && k !== 'timestamp').length === 0
    const moduleData = isEmptyTrigger ? (DEMO_DATA[module] || data) : data

    // Run the module
    const result = await runModule(module, moduleData, clientSystemPrompt)

    // Log the run (silently fail if no Supabase)
    let moduleRun = null
    if (client_id) {
      try {
        moduleRun = await logModuleRun(client_id, module, moduleData, result)
      } catch {}
    }

    // Queue any actions (silently fail if no Supabase)
    const queuedActions = []
    if (result.actions && Array.isArray(result.actions) && client_id && moduleRun) {
      for (const action of result.actions) {
        try {
          const approval = await queueAction({
            client_id,
            module_run_id: moduleRun.id,
            action_type: action.type,
            action_label: action.label,
            action_details: { recipient: action.recipient, content: action.content, subject: action.subject, to: action.recipient },
            financial_value: action.financial_value || 0,
            auto_approve: action.auto_approve || false
          })
          queuedActions.push({ ...action, approval_id: approval.id, approval_status: approval.status })
        } catch {}
      }
    }

    return Response.json({
      success: true,
      module,
      result,
      module_run_id: moduleRun?.id,
      actions_queued: queuedActions.length,
      actions: queuedActions
    })

  } catch (error) {
    console.error('Module error:', error)
    return Response.json({ error: 'Module failed', details: error.message }, { status: 500 })
  }
}

// GET /api/modules
export async function GET(request) {
  return Response.json({
    available_modules: Object.keys(DEMO_DATA),
    status: 'operational'
  })
}
