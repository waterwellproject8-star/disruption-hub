'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'

const DASHBOARD_PIN = 'DH2026'

// Generate demo shipments with ETAs relative to current time
// Prevents stale times showing (e.g. 08:45 when it's 16:32)
function buildDemoShipments() {
  const now = new Date()
  const fmt = mins => {
    const d = new Date(now.getTime() + mins * 60000)
    return d.toTimeString().slice(0,5)
  }
  return [
    { ref: 'PH-4421', route: 'Leeds → Bradford (Tesco DC)', status: 'on-track', eta: fmt(25), carrier: 'Pearson Haulage', alert: null },
    { ref: 'PH-8832', route: 'Leeds → London (M1)', status: 'disrupted', eta: '???', carrier: 'Pearson Haulage', alert: 'M1 breakdown — recovery dispatched' },
    { ref: 'PH-5517', route: 'Leeds → Sheffield (NHS Supply Chain)', status: 'delayed', eta: fmt(105), carrier: 'Pearson Haulage', alert: 'Delayed — cascade from London disruption' },
    { ref: 'PH-9103', route: 'Leeds → Edinburgh (A1)', status: 'delayed', eta: fmt(210), carrier: 'Pearson Haulage', alert: 'Cold chain at risk — slot closing soon' },
  ]
}
const ACTIVE_SHIPMENTS = buildDemoShipments()

const INCIDENT_LOG = [
  { date: 'Today 22:03', ref: 'PH-8832', type: 'Breakdown', severity: 'CRITICAL', saved: '£2,400' },
  { date: 'Yesterday', ref: 'PH-7741', type: 'Invoice Recovery', severity: 'HIGH', saved: '£4,280' },
  { date: '3 days ago', ref: 'PH-6602', type: 'Driver Hours', severity: 'MEDIUM', saved: '£900' },
]

const STATUS_COLORS = { 'on-track': '#f5a623', 'disrupted': '#ef4444', 'delayed': '#f59e0b' }
const SEV_COLORS = { 'CRITICAL': '#ef4444', 'HIGH': '#f59e0b', 'MEDIUM': '#3b82f6', 'LOW': '#8a9099' }
const SEV_BG = { 'CRITICAL': 'rgba(239,68,68,0.1)', 'HIGH': 'rgba(245,158,11,0.1)', 'MEDIUM': 'rgba(59,130,246,0.1)', 'LOW': 'rgba(138,144,153,0.1)' }

const MODULES = [
  { id: 'disruption',         label: 'Disruption Analysis',       icon: '⚡', cat: 'ops' },
  { id: 'sla_prediction',     label: 'SLA Breach Prediction',     icon: '🔮', cat: 'ops' },
  { id: 'invoice',            label: 'Invoice Recovery',          icon: '🧾', cat: 'save' },
  { id: 'driver_hours',       label: 'Driver Hours Monitor',      icon: '⏱', cat: 'compliance' },
  { id: 'hazmat',             label: 'Hazmat Checker',            icon: '⚠️', cat: 'compliance' },
  { id: 'carrier',            label: 'Carrier Scorecard',         icon: '📊', cat: 'ops' },
  { id: 'fuel',               label: 'Fuel Optimisation',         icon: '⛽', cat: 'save' },
  { id: 'vehicle_health',     label: 'Vehicle Health',            icon: '🔧', cat: 'ops' },
  { id: 'driver_retention',   label: 'Driver Retention',          icon: '👤', cat: 'ops' },
  { id: 'carbon',             label: 'Carbon & ESG',              icon: '🌱', cat: 'growth' },
  { id: 'tender',             label: 'Tender Intelligence',       icon: '🏆', cat: 'growth' },
  { id: 'regulation',         label: 'Regulation Monitor',        icon: '📜', cat: 'compliance' },
  { id: 'consolidation',      label: 'Load Consolidation',        icon: '📦', cat: 'save' },
  { id: 'forecast',           label: 'Demand Forecast',           icon: '📈', cat: 'ops' },
  { id: 'benchmarking',       label: 'Rate Benchmarking',         icon: '💹', cat: 'growth' },
  { id: 'insurance',          label: 'Claims Intelligence',       icon: '🛡', cat: 'compliance' },
  { id: 'cargo_theft',        label: 'Cargo Theft Prevention',    icon: '🔒', cat: 'compliance' },
  { id: 'ghost_freight',      label: 'Ghost Freight Detection',   icon: '👻', cat: 'compliance' },
  { id: 'subcontractor',      label: 'Subcontractor Trust',       icon: '🤝', cat: 'ops' },
  { id: 'cash_flow',          label: 'Cash Flow Forecast',        icon: '💰', cat: 'growth' },
  { id: 'churn_prediction',   label: 'Client Churn Prediction',   icon: '📉', cat: 'growth' },
  { id: 'workforce_pipeline', label: 'Workforce Pipeline',        icon: '👥', cat: 'ops' },
]

const CAT_COLORS = {
  ops:        { bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.2)',  text: '#3b82f6' },
  save:       { bg: 'rgba(245,166,35,0.08)',   border: 'rgba(245,166,35,0.2)',   text: '#f5a623' },
  compliance: { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)', text: '#f59e0b' },
  growth:     { bg: 'rgba(168,85,247,0.08)',  border: 'rgba(168,85,247,0.2)', text: '#a855f7' },
}

const WEBHOOK_SYSTEMS = {

  // ── TMS — JOB & DESPATCH ──────────────────────────────────────────────────
  mandata: {
    label: 'Mandata TMS', icon: '🚛', color: '#3b82f6',
    events: {
      job_delayed:          { label: 'Job Delayed',                    fields: { vehicle_reg:'LK72 ABX', delay_minutes:45, reason:'M62 congestion J26', sla_deadline:'15:30', consignee:'Tesco DC Donington', job_id:'MAN-44821', penalty_gbp:1200, consignee_phone:'' } },
      job_cancelled:        { label: 'Job Cancelled by Customer',      fields: { vehicle_reg:'LK72 ABX', job_id:'MAN-44822', reason:'Customer cancelled 2h before collection', value_gbp:2400, collection:'Leeds DC', consignee:'Asda Lutterworth', driver_dispatched:true, consignee_phone:'' } },
      collection_no_show:   { label: 'Collection No-Show',             fields: { vehicle_reg:'LK72 ABX', job_id:'MAN-44823', collection_point:'Sheffield DC', booked_time:'09:00', wait_minutes:55, driver_name:'Dave P', consignee_phone:'' } },
      failed_delivery:      { label: 'Failed Delivery',                fields: { vehicle_reg:'LK72 ABX', job_id:'MAN-44824', consignee:'NHS Supply Chain Redditch', reason:'Site closed — no staff on loading bay', attempted_time:'14:22', value_gbp:6800, consignee_phone:'' } },
      pod_overdue:          { label: 'POD Not Received',               fields: { vehicle_reg:'LK72 ABX', job_id:'MAN-44825', consignee:'NHS Supply Chain Redditch', hours_overdue:3, value_gbp:6800, consignee_phone:'' } },
      route_deviation:      { label: 'Route Deviation',                fields: { vehicle_reg:'LK72 ABX', planned_route:'M62 → M1 south', current_location:'A1(M) northbound J8', deviation_miles:11, job_id:'MAN-44826', driver_name:'Dave P' } },
      multi_drop_change:    { label: 'Multi-Drop Sequence Change',     fields: { vehicle_reg:'LK72 ABX', job_id:'MAN-44827', original_sequence:'Leeds→Bradford→Wakefield', new_sequence:'Leeds→Wakefield→Bradford', reason:'Bradford customer requested later slot', driver_name:'Dave P' } },
      driver_change:        { label: 'Driver Change Required',         fields: { vehicle_reg:'LK72 ABX', job_id:'MAN-44828', original_driver:'Dave P', reason:'Driver reported unwell at depot', collection_in_mins:45, consignee:'Tesco DC Donington' } },
      night_out_required:   { label: 'Night Out Required',             fields: { vehicle_reg:'LK72 ABX', driver_name:'Dave P', location:'Corley Services M6', reason:'Hours exhausted — cannot complete return leg', cargo:'perishable — chilled 0-5C', job_id:'MAN-44829' } },
      detention_charge:     { label: 'Detention Charge Triggered',     fields: { vehicle_reg:'LK72 ABX', job_id:'MAN-44830', consignee:'Asda Lutterworth', wait_hours:3.5, hourly_rate_gbp:45, total_charge_gbp:157, driver_name:'Dave P' } },
    }
  },

  // ── TELEMATICS — VEHICLE & DRIVER ─────────────────────────────────────────
  webfleet: {
    label: 'Webfleet Telematics', icon: '📡', color: '#ef4444',
    events: {
      temp_alarm:           { label: 'Temperature Alarm',              fields: { vehicle_reg:'LK72 ABX', temp_reading:7.2, threshold:5.0, cargo_type:'chilled 0-5C', location:'M1 southbound J18', driver_name:'Dave P', reefer_unit:'Carrier Transicold', consignee_phone:'' } },
      temp_probe_failure:   { label: 'Temperature Probe Failure',      fields: { vehicle_reg:'LK72 ABX', probe_id:'probe_1', location:'A1 northbound J41', cargo:'pharmaceutical chilled', consignee:'NHS Supply Chain', driver_name:'Dave P' } },
      reefer_fault:         { label: 'Reefer Unit Fault',              fields: { vehicle_reg:'LK72 ABX', fault_code:'E-014', fault_desc:'Compressor overload', location:'M62 westbound J27', cargo_type:'frozen -18C', cargo_value_gbp:14000, driver_name:'Dave P' } },
      door_open_transit:    { label: 'Cargo Door Open in Transit',     fields: { vehicle_reg:'LK72 ABX', location:'B1234 industrial estate Sheffield', speed_mph:0, time_stopped_mins:18, cargo:'mixed retail', driver_name:'Dave P' } },
      off_route:            { label: 'Vehicle Off Route',              fields: { vehicle_reg:'LK72 ABX', deviation_miles:8, planned_route:'M62 westbound', current_location:'A1(M) northbound J8', driver_name:'Dave P' } },
      geofence_breach:      { label: 'Geofence Breach',               fields: { vehicle_reg:'LK72 ABX', zone:'Restricted residential area', location:'Selby town centre', reason:'unknown', driver_name:'Dave P', time:'22:47' } },
      panic_button:         { label: 'Panic Button Pressed',          fields: { vehicle_reg:'LK72 ABX', driver_name:'Dave P', location:'A638 nr Wakefield', cargo_value_gbp:18000, time:'23:12' } },
      impact_detected:      { label: 'Impact / Collision Detected',   fields: { vehicle_reg:'LK72 ABX', g_force:1.8, location:'A1 southbound J34', driver_name:'Dave P', speed_at_impact_mph:12, cargo:'fragile electronics', time:'09:34' } },
      engine_fault:         { label: 'Engine Fault Code',             fields: { vehicle_reg:'LK72 ABX', fault_code:'P0236', fault_desc:'Turbo boost sensor fault', location:'M1 northbound J28', driver_name:'Dave P', mileage:187432 } },
      fuel_critical:        { label: 'Fuel Level Critical',           fields: { vehicle_reg:'LK72 ABX', fuel_percent:8, estimated_range_miles:28, location:'M62 eastbound J33', driver_name:'Dave P', nearest_forecourt:'Ferrybridge Services 4 miles' } },
      tyre_pressure:        { label: 'Tyre Pressure Alert',           fields: { vehicle_reg:'LK72 ABX', tyre_position:'nearside front', pressure_bar:5.2, threshold_bar:6.8, location:'M18 J2', driver_name:'Dave P', cargo_weight_kg:18000 } },
      overspeed:            { label: 'Speed Violation',               fields: { vehicle_reg:'LK72 ABX', speed_mph:68, limit_mph:56, location:'M62 westbound J26', driver_name:'Dave P', duration_secs:34 } },
      ulez_entry:           { label: 'ULEZ / Clean Air Zone Entry',   fields: { vehicle_reg:'LK72 ABX', zone:'London ULEZ', entry_time:'07:34', vehicle_compliant:false, daily_charge_gbp:100, driver_name:'Dave P' } },
    }
  },

  // ── TELEMATICS — DRIVER BEHAVIOUR & HOURS ────────────────────────────────
  microlise: {
    label: 'Microlise Fleet', icon: '📍', color: '#a855f7',
    events: {
      harsh_braking:        { label: 'Harsh Braking Event',           fields: { vehicle_reg:'LK72 ABX', g_force:0.45, location:'A1 southbound J34', cargo_type:'fragile electronics', driver_name:'Dave P', speed_before_mph:52 } },
      harsh_acceleration:   { label: 'Harsh Acceleration',            fields: { vehicle_reg:'LK72 ABX', g_force:0.38, location:'M1 northbound J29', driver_name:'Dave P', cargo:'chilled foodstuffs', time:'08:17' } },
      harsh_cornering:      { label: 'Harsh Cornering',               fields: { vehicle_reg:'LK72 ABX', g_force:0.31, location:'A638 roundabout Wakefield', driver_name:'Dave P', cargo:'fragile — stacked pallets' } },
      wtd_hours_warning:    { label: 'WTD Hours Approaching Limit',   fields: { vehicle_reg:'LK72 ABX', driver_name:'Dave P', hours_driven_this_week:42, weekly_limit:48, hours_remaining:6, remaining_jobs:2 } },
      wtd_hours_breach:     { label: 'WTD Hours Breached',            fields: { vehicle_reg:'LK72 ABX', driver_name:'Dave P', hours_driven:48.5, location:'M1 J30', remaining_jobs:1, consignee:'NHS Supply Chain', job_id:'MAN-44820' } },
      tacho_fault:          { label: 'Tachograph Fault',              fields: { vehicle_reg:'LK72 ABX', fault_type:'card read error', driver_name:'Dave P', location:'Leeds DC', kilometres_driven_without_record:14 } },
      no_driver_card:       { label: 'Driving Without Tacho Card',    fields: { vehicle_reg:'LK72 ABX', driver_name:'Dave P', location:'M62 westbound J28', duration_mins:22, distance_km:18 } },
      long_stop:            { label: 'Unexpected Long Stop',          fields: { vehicle_reg:'LK72 ABX', stop_duration_mins:92, location:'Toddington Services M1', driver_name:'Dave P', cargo:'temperature sensitive', next_delivery_sla:'16:00' } },
      excessive_idling:     { label: 'Excessive Idling',              fields: { vehicle_reg:'LK72 ABX', idle_minutes:45, fuel_wasted_litres:6.2, location:'Leeds Distribution Centre', driver_name:'Dave P' } },
      licence_expiry:       { label: 'Driver Licence Expiry Warning', fields: { driver_name:'Dave P', vehicle_reg:'LK72 ABX', licence_expiry:'2026-05-14', days_remaining:38, licence_category:'C+E' } },
      cpc_expiry:           { label: 'CPC / DQC Expiry Warning',     fields: { driver_name:'Dave P', dqc_expiry:'2026-06-01', days_remaining:56, vehicle_reg:'LK72 ABX', action_required:'Book CPC periodic training' } },
      vehicle_service_due:  { label: 'Vehicle Service Overdue',       fields: { vehicle_reg:'LK72 ABX', service_type:'6-week safety inspection', overdue_days:4, mileage:187432, last_service:'2026-02-18', location:'Leeds depot' } },
      mot_due:              { label: 'MOT / Annual Test Due',         fields: { vehicle_reg:'LK72 ABX', mot_expiry:'2026-04-28', days_remaining:22, vehicle_type:'HGV 44t', test_centre:'Pearson Haulage Leeds' } },
    }
  },

  // ── TELEMATICS — SAMSARA / IOT SENSORS ───────────────────────────────────
  samsara: {
    label: 'Samsara IoT', icon: '🔬', color: '#f5a623',
    events: {
      cargo_tamper:         { label: 'Cargo Tamper / Theft Alert',    fields: { vehicle_reg:'LK72 ABX', sensor:'cargo_seal_broken', location:'A1 southbound J41 layby', time:'02:34', cargo:'mixed retail', cargo_value_gbp:24000, driver_name:'Dave P' } },
      trailer_detached:     { label: 'Trailer Detached Unexpectedly', fields: { vehicle_reg:'LK72 ABX', trailer_id:'TRL-0087', location:'M1 J32 slip road', driver_name:'Dave P', cargo_loaded:true, cargo_value_gbp:18000 } },
      rollover_detected:    { label: 'Rollover / Tip Detected',       fields: { vehicle_reg:'LK72 ABX', g_force:3.4, location:'A638 Wakefield ring road', driver_name:'Dave P', cargo:'fragile', emergency_services_notified:false } },
      load_movement:        { label: 'Load Movement Detected',        fields: { vehicle_reg:'LK72 ABX', sensor:'load_shift', location:'M62 J27 roundabout', driver_name:'Dave P', cargo:'unstable pallets — mixed weight', action:'driver alerted to pull over' } },
      fuel_card_anomaly:    { label: 'Fuel Card Anomaly',             fields: { vehicle_reg:'LK72 ABX', driver_name:'Dave P', expected_location:'Leeds to Sheffield route', transaction_location:'Peterborough A1', volume_litres:320, vehicle_tank_capacity_litres:280 } },
      wrong_fuel:           { label: 'Wrong Fuel Type',               fields: { vehicle_reg:'LK72 ABX', driver_name:'Dave P', fuel_put_in:'AdBlue tank — wrong cap', location:'Ferrybridge Services M62', litres_added:40 } },
      tail_lift_fault:      { label: 'Tail-Lift Fault',               fields: { vehicle_reg:'LK72 ABX', fault:'hydraulic failure', location:'NHS Supply Chain Redditch', driver_name:'Dave P', delivery_at_risk:true, pallets_to_unload:8 } },
      fatigue_alert:        { label: 'Driver Fatigue Alert',          fields: { vehicle_reg:'LK72 ABX', driver_name:'Dave P', hours_driven_today:7.5, break_overdue_mins:22, location:'M1 northbound J29', next_delivery:'Sheffield NHS 16:00' } },
      mileage_discrepancy:  { label: 'Mileage Discrepancy',           fields: { vehicle_reg:'LK72 ABX', recorded_miles:287, gps_actual_miles:341, date:'today', driver_name:'Dave P', note:'54 miles unaccounted' } },
    }
  },

  // ── WMS — INBOUND / RECEIVING ─────────────────────────────────────────────
  wms_inbound: {
    label: 'WMS — Inbound', icon: '📥', color: '#f59e0b',
    events: {
      inbound_late:         { label: 'Inbound Delivery Late',          fields: { warehouse:'Leeds DC', supplier:'Greenfield Foods Ltd', expected_time:'10:00', delay_mins:95, pallets_booked:24, knock_on_orders:3, consignee:'Tesco DC Donington' } },
      short_delivery:       { label: 'Short Delivery Received',        fields: { warehouse:'Leeds DC', supplier:'Greenfield Foods Ltd', po_number:'PO-88321', ordered_pallets:24, received_pallets:18, missing_product:'FRZN-MIX-001 x 6 pallets', supplier_phone:'01234 567890' } },
      over_delivery:        { label: 'Over-Delivery Received',         fields: { warehouse:'Leeds DC', supplier:'ambient-foods', po_number:'PO-88322', ordered_pallets:20, received_pallets:27, extra_product:'AMBT-DRY-004', available_bay_space_pallets:4 } },
      damaged_inbound:      { label: 'Damaged Goods Inbound',          fields: { warehouse:'Leeds DC', supplier:'Greenfield Foods', po_number:'PO-88323', damaged_pallets:3, product:'chilled ready meals', damage_type:'water damage — roof leak in trailer', rejection_required:true } },
      wrong_product:        { label: 'Wrong Product Received',         fields: { warehouse:'Leeds DC', supplier:'UK Pharma Wholesale', po_number:'PO-88324', ordered_product:'Paracetamol 500mg 100s', received_product:'Paracetamol 500mg 32s', quantity:2400, value_gbp:4800 } },
      asn_mismatch:         { label: 'ASN / Paperwork Mismatch',       fields: { warehouse:'Birmingham DC', supplier:'FMCG Supplies Ltd', asn_pallets:16, physical_pallets:19, temperature_variance:'ASN says ambient — goods are chilled', action_required:'quarantine and query supplier' } },
      goods_on_hold:        { label: 'Goods On Hold — QC Inspection',  fields: { warehouse:'Leeds DC', product:'pharmaceutical — eye drops', quantity_units:12000, value_gbp:28000, hold_reason:'batch recall investigation', supplier:'UK Pharma Wholesale', clearance_required_by:'14:00' } },
      customs_hold:         { label: 'Customs Hold — Inbound',         fields: { warehouse:'Tilbury DC', shipment_ref:'CUST-88325', origin:'Netherlands', product:'food supplement', hold_reason:'TRACES notification pending', value_gbp:18000, clearance_agent:'Customs Direct Ltd' } },
      cross_dock_triggered: { label: 'Cross-Dock Event Triggered',     fields: { warehouse:'Leeds DC', inbound_ref:'IN-88326', outbound_job:'MAN-44831', pallets:12, dock_window:'13:00-14:30', consignee:'Tesco DC Donington', driver_arriving:'LK72 ABX at 12:45' } },
    }
  },

  // ── WMS — OUTBOUND / DESPATCH ─────────────────────────────────────────────
  wms_outbound: {
    label: 'WMS — Outbound', icon: '📤', color: '#f5a623',
    events: {
      short_pick:           { label: 'Short Pick',                     fields: { order_id:'ORD-88321', warehouse:'Leeds DC', ordered_qty:24, available_qty:18, product_code:'FRZN-MIX-001', consignee:'Asda DC Lutterworth', despatch_deadline:'13:00', sla_penalty_gbp:1800, consignee_phone:'' } },
      pick_error:           { label: 'Pick Error Detected',            fields: { order_id:'ORD-88322', warehouse:'Leeds DC', picker:'Staff ID 047', wrong_product:'AMBT-DRY-003 picked instead of AMBT-DRY-004', consignee:'Tesco DC Donington', packing_already_complete:false } },
      substitution_needed:  { label: 'Substitution Required',          fields: { order_id:'ORD-88323', warehouse:'Birmingham DC', out_of_stock:'Whole milk 6-pint x 48', suggested_sub:'Semi-skimmed 6-pint x 48', consignee:'NHS canteen Birmingham', customer_approval_needed:true } },
      overweight_load:      { label: 'Overweight Load Detected',       fields: { vehicle_reg:'LK72 ABX', loaded_weight_kg:44800, legal_max_kg:44000, depot:'Manchester DC', consignee:'B&Q Swindon', overweight_kg:800, consignee_phone:'' } },
      hazmat_label_missing: { label: 'Hazmat Label Missing',           fields: { order_id:'ORD-88324', product:'isopropyl alcohol 5L x 20', un_number:'UN1219', consignee:'NHS Supply Chain', driver:'BN21 XKT', despatch_window:'closes in 25 mins' } },
      manifest_mismatch:    { label: 'Manifest Mismatch',              fields: { vehicle_reg:'LK72 ABX', job_id:'MAN-44832', manifest_pallets:18, loaded_pallets:21, extra_product_code:'FRZN-MIX-002', consignee:'Tesco DC Donington', departure_time:'08:30' } },
      cutoff_approaching:   { label: 'Despatch Cut-Off Approaching',   fields: { warehouse:'Leeds DC', orders_not_picked:7, orders_total:32, cutoff_time:'17:00', mins_remaining:22, consignee:'Tesco Express stores', sla_penalty_per_order_gbp:500 } },
      vehicle_not_arrived:  { label: 'Vehicle Not Arrived for Loading', fields: { warehouse:'Leeds DC', vehicle_reg:'LK72 ABX', booked_arrival:'14:00', current_time:'14:38', orders_loaded_waiting:14, consignee:'NHS Supply Chain Redditch', bay:'Bay 3' } },
      bay_blocked:          { label: 'Loading Bay Unavailable',        fields: { warehouse:'Leeds DC', bay:'Bay 2', blocked_reason:'previous vehicle breakdown on apron', vehicles_queuing:3, earliest_clear_time:'15:30', despatch_impact_pallets:42 } },
      returns_received:     { label: 'Failed Delivery Returned',       fields: { vehicle_reg:'LK72 ABX', job_id:'MAN-44833', consignee:'Asda Lutterworth', returned_pallets:6, return_reason:'site closed', product:'ambient grocery', rebook_required:true, value_gbp:2400 } },
    }
  },

  // ── WMS — INVENTORY & STOCK ───────────────────────────────────────────────
  wms_inventory: {
    label: 'WMS — Inventory', icon: '📦', color: '#8b5cf6',
    events: {
      reorder_point:        { label: 'Stock Below Reorder Point',      fields: { warehouse:'Leeds DC', product_code:'FRZN-MIX-001', product_desc:'Frozen mixed veg 1kg', current_stock_units:480, reorder_point_units:500, lead_time_days:3, avg_daily_movement:180, supplier:'Greenfield Foods' } },
      zero_stock:           { label: 'Zero Stock / Stockout',          fields: { warehouse:'Leeds DC', product_code:'AMBT-DRY-004', product_desc:'Baked beans 400g case', current_stock:0, outstanding_orders:3, value_at_risk_gbp:8400, consignees_affected:'Tesco DC x2, Asda x1', supplier:'FMCG Supplies Ltd' } },
      near_expiry:          { label: 'Near-Expiry Alert',              fields: { warehouse:'Leeds DC', product_code:'CHLL-MEAT-002', product_desc:'Cooked chicken slices 200g', quantity_units:2400, expiry_date:'in 3 days', value_gbp:3600, consignees_available:'Tesco x3 stores within 30mi' } },
      batch_recall:         { label: 'Product Batch Recall',           fields: { product_code:'PHMA-PARA-500', product_desc:'Paracetamol 500mg 100s', batch_number:'BTH-229341', recall_reason:'tablet dissolution failure', units_in_warehouse:12000, units_dispatched:4800, consignees_notified:false } },
      stock_discrepancy:    { label: 'Cycle Count Discrepancy',        fields: { warehouse:'Birmingham DC', product_code:'FRZN-PIZZA-003', system_quantity:1440, physical_count:1308, variance:132, variance_value_gbp:792, investigation_triggered:true } },
      cold_store_breach:    { label: 'Cold Store Temperature Breach',  fields: { warehouse:'Leeds DC', zone:'cold_store_A', temp_reading:7.8, threshold:5.0, products_affected:'chilled ready meals, dairy, cooked meats', total_value_at_risk_gbp:48000, duration_mins:35, engineer_called:false } },
      quarantine_flagged:   { label: 'Quarantine Stock Alert',         fields: { warehouse:'Leeds DC', product_code:'CHLL-DAIRY-001', reason:'supplier allergen declaration missing', quantity_units:3600, value_gbp:5400, consignee_orders_affected:2 } },
    }
  },

  // ── CUSTOMER / CONSIGNEE PORTAL ───────────────────────────────────────────
  customer: {
    label: 'Customer Portal', icon: '👤', color: '#ec4899',
    events: {
      booking_cancellation: { label: 'Booking Cancellation',           fields: { booking_ref:'BKG-55221', collection:'Birmingham DC', delivery:'NHS Supply Chain Redditch', pallets:12, value_gbp:3400, reason:'production delay', driver_dispatched:true, cancellation_fee_applies:true, consignee_phone:'' } },
      sla_dispute:          { label: 'SLA Dispute Raised',             fields: { booking_ref:'BKG-55222', consignee:'Tesco DC Donington', claimed_late_mins:47, penalty_claimed_gbp:1200, disputed_ref:'PH-8832', evidence:'driver timestamped arrival 14:47, slot was 14:00-15:00', consignee_phone:'' } },
      delivery_window_change:{ label: 'Delivery Window Change Request', fields: { booking_ref:'BKG-55223', consignee:'NHS Supply Chain', original_window:'08:00-10:00', requested_window:'13:00-15:00', reason:'emergency ward busy until midday', vehicle_already_dispatched:true, driver_name:'Dave P' } },
      pod_dispute:          { label: 'POD Disputed by Customer',       fields: { booking_ref:'BKG-55224', consignee:'Asda Lutterworth', claim:'12 cases of damaged ambient goods', delivery_date:'yesterday', driver_name:'Dave P', vehicle_reg:'LK72 ABX', claimed_value_gbp:1440, cctv_available:true } },
      complaint_logged:     { label: 'Customer Complaint',             fields: { booking_ref:'BKG-55225', consignee:'Tesco DC Donington', complaint:'driver rude to goods-in team, refused to stack in correct area', severity:'high', contract_value_monthly_gbp:28000, account_manager_notified:false } },
      sla_breach_imminent:  { label: 'SLA Breach Imminent',            fields: { booking_ref:'BKG-55226', consignee:'NHS Supply Chain Birmingham', sla_deadline:'15:30', current_eta:'15:22', buffer_mins:8, penalty_if_late_gbp:2400, vehicle_reg:'LK72 ABX', driver_name:'Dave P' } },
      change_of_address:    { label: 'Delivery Address Changed',       fields: { booking_ref:'BKG-55227', original_delivery:'NHS Supply Chain Redditch B98 0TH', new_delivery:'NHS Trust Birmingham B15 2TH', distance_change_miles:+28, vehicle_already_en_route:true, driver_name:'Dave P' } },
    }
  },

  // ── COMPLIANCE & REGULATORY ───────────────────────────────────────────────
  compliance: {
    label: 'Compliance System', icon: '⚖️', color: '#ef4444',
    events: {
      dvsa_alert:           { label: 'DVSA Roadside Stop',             fields: { vehicle_reg:'LK72 ABX', driver_name:'Dave P', location:'A1 southbound check point Newark', prohibition_issued:false, advisory_issued:true, advisory_detail:'nearside front tyre wear approaching limit', tacho_checked:true } },
      adr_documentation:    { label: 'ADR Documentation Incomplete',   fields: { vehicle_reg:'LK72 ABX', driver_name:'Dave P', dangerous_goods:'isopropyl alcohol UN1219 class 3', missing_document:'consignor declaration', location:'Leeds DC — pre-departure', collection_in_mins:30 } },
      overweight_enforcement:{ label: 'Overweight — Enforcement Risk', fields: { vehicle_reg:'LK72 ABX', gross_weight_kg:44900, legal_max_kg:44000, location:'approaching Ferrybridge weigh-in', driver_name:'Dave P', cargo_offload_options:'none — sealed customer delivery' } },
      low_bridge_risk:      { label: 'Low Bridge / Restriction Ahead', fields: { vehicle_reg:'LK72 ABX', vehicle_height_m:4.2, restriction_height_m:4.1, restriction_location:'Selby A1041 railway bridge', driver_name:'Dave P', current_route:'programmed route', alternative_required:true } },
      operator_licence:     { label: 'Operator Licence Action Needed', fields: { licence_number:'OK1234567', issue:'annual fee overdue 14 days', revocation_risk:true, action_deadline:'2026-04-20', tc_area:'North East of England' } },
    }
  },

  // ── CARRIER / SUBCONTRACTOR ───────────────────────────────────────────────
  carrier: {
    label: 'Carrier / Subcontractor', icon: '🤝', color: '#64748b',
    events: {
      carrier_no_collect:   { label: 'Carrier Failed to Collect',      fields: { carrier_name:'FastFreight UK', job_ref:'FF-88321', collection:'Leeds DC', booked_time:'07:00', current_time:'08:45', pallets:18, consignee:'Tesco DC Donington', sla_deadline:'14:00', carrier_phone:'0800 123 4567' } },
      carrier_overcharge:   { label: 'Carrier Invoice Overcharge',     fields: { carrier_name:'XPO Logistics', invoice_ref:'XPO-INV-44821', agreed_rate_gbp:380, invoiced_amount_gbp:492, discrepancy_gbp:112, job_ref:'PH-8832', original_quote_ref:'QT-2234' } },
      carrier_incident:     { label: 'Carrier Vehicle Incident',       fields: { carrier_name:'FastFreight UK', vehicle_reg:'FF44 XKT', location:'M62 westbound J30', incident_type:'tyre blowout', cargo:'your goods — mixed retail 14 pallets', our_ref:'MAN-44821', value_gbp:18000, recovery_eta_mins:90 } },
      subcontractor_quality:{ label: 'Subcontractor Quality Failure',  fields: { subcontractor:'JD Transport Leeds', job_ref:'MAN-44825', failure_type:'goods delivered to wrong address — 8 pallets', consignee:'NHS Supply Chain Redditch', actual_delivery:'NHS Birmingham B15', recovery_arranged:false } },
    }
  },
}


const TAB_STYLE = (active) => ({
  padding: '6px 16px', borderRadius: 3, fontSize: 11, cursor: 'pointer',
  fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em',
  fontWeight: active ? 700 : 500, textTransform: 'uppercase',
  border: active ? '1px solid #f5a623' : '1px solid rgba(255,255,255,0.08)',
  background: active ? 'rgba(245,166,35,0.1)' : 'transparent',
  color: active ? '#f5a623' : '#8a9099', transition: 'all 0.15s'
})

// ── PIN GATE ─────────────────────────────────────────────────────────────────
function PinGate({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const handleSubmit = () => {
    if (pin.toUpperCase() === DASHBOARD_PIN) {
      if (typeof window !== 'undefined') localStorage.setItem('dh_unlocked','true')
      onUnlock()
    }
    else { setError(true); setPin(''); setTimeout(() => setError(false), 2000) }
  }
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#080c14', fontFamily:'Barlow, sans-serif' }}>
      <div style={{ width:360, padding:'40px 36px', background:'#0f1826', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, textAlign:'center' }}>
        <div style={{ width:48, height:48, background:'#f5a623', clipPath:'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', margin:'0 auto 20px' }} />
        <div style={{ fontFamily:'monospace', fontSize:11, color:'#f5a623', letterSpacing:'0.1em', marginBottom:8 }}>DISRUPTIONHUB</div>
        <div style={{ fontSize:15, color:'#e8eaed', marginBottom:6 }}>Operations Dashboard</div>
        <div style={{ fontSize:12, color:'#4a5260', marginBottom:28 }}>Authorised access only</div>
        <input type="password" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} placeholder="Enter access code" autoFocus
          style={{ width:'100%', padding:'12px 14px', background:'#080c14', border: error ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.12)', borderRadius:6, color:'#e8eaed', fontSize:14, outline:'none', fontFamily:'IBM Plex Mono, monospace', letterSpacing:'0.2em', textAlign:'center', marginBottom:12, boxSizing:'border-box', transition:'border 0.2s' }} />
        {error && <div style={{ fontSize:11, color:'#ef4444', fontFamily:'monospace', marginBottom:10 }}>Invalid access code</div>}
        <button onClick={handleSubmit} style={{ width:'100%', padding:'11px', background:'#f5a623', border:'none', borderRadius:6, color:'#000', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'Barlow, sans-serif' }}>Access Dashboard →</button>
        <div style={{ marginTop:20, fontSize:11, color:'#4a5260' }}>Not a client? <a href="/" style={{ color:'#f5a623', textDecoration:'none' }}>View live demo →</a></div>
      </div>
    </div>
  )
}

// ── AGENT RESPONSE RENDERER — Option B (colour-coded cards) ──────────────────
function money(text) {
  return text.replace(/(£[\d,]+(?:[–-]£[\d,]+)?(?:K)?)/g,
    '<span style="color:#f5a623;font-weight:600;font-family:monospace">$1</span>')
}
function bold(text) {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#e8eaed;font-weight:500">$1</strong>')
}
function fmt(text) { return money(bold(text)) }
function clean(line) {
  return line.replace(/<strong[^>]*>(.*?)<\/strong>/g,'$1')
             .replace(/<span[^>]*>(.*?)<\/span>/g,'$1')
             .replace(/<[^>]+>/g,'')
}

const SECTION_STYLES = {
  'DISRUPTION ASSESSMENT':   { bg:'rgba(59,130,246,0.05)',  border:'rgba(59,130,246,0.18)',  label:'#3b82f6' },
  'ASSESSMENT':              { bg:'rgba(59,130,246,0.05)',  border:'rgba(59,130,246,0.18)',  label:'#3b82f6' },
  'SITUATION':               { bg:'rgba(59,130,246,0.05)',  border:'rgba(59,130,246,0.18)',  label:'#3b82f6' },
  'IMMEDIATE ACTIONS':       { bg:'rgba(239,68,68,0.05)',   border:'rgba(239,68,68,0.18)',   label:'#ef4444' },
  'IMMEDIATE ACTIONS (DO THESE NOW)': { bg:'rgba(239,68,68,0.05)', border:'rgba(239,68,68,0.18)', label:'#ef4444' },
  'ACTION PLAN':             { bg:'rgba(239,68,68,0.05)',   border:'rgba(239,68,68,0.18)',   label:'#ef4444' },
  'WHO TO CONTACT':          { bg:'rgba(245,166,35,0.04)',   border:'rgba(245,166,35,0.15)',   label:'#f5a623' },
  'CONTACTS':                { bg:'rgba(245,166,35,0.04)',   border:'rgba(245,166,35,0.15)',   label:'#f5a623' },
  'REROUTING':               { bg:'rgba(168,85,247,0.05)', border:'rgba(168,85,247,0.15)', label:'#a855f7' },
  'REROUTING / REORDER RECOMMENDATIONS': { bg:'rgba(168,85,247,0.05)', border:'rgba(168,85,247,0.15)', label:'#a855f7' },
  'REROUTE OPTIONS':         { bg:'rgba(168,85,247,0.05)', border:'rgba(168,85,247,0.15)', label:'#a855f7' },
  'STOCK / INVENTORY IMPACT':{ bg:'rgba(245,158,11,0.05)', border:'rgba(245,158,11,0.15)', label:'#f59e0b' },
  'DOWNSTREAM RISKS':        { bg:'rgba(245,158,11,0.05)', border:'rgba(245,158,11,0.15)', label:'#f59e0b' },
  'RISKS':                   { bg:'rgba(245,158,11,0.05)', border:'rgba(245,158,11,0.15)', label:'#f59e0b' },
  'PREVENTION':              { bg:'rgba(255,255,255,0.02)', border:'rgba(255,255,255,0.08)', label:'#4a5260' },
  'PREVENTION FOR NEXT TIME':{ bg:'rgba(255,255,255,0.02)', border:'rgba(255,255,255,0.08)', label:'#4a5260' },
}

function getSectionStyle(title) {
  const upper = title.toUpperCase().trim()
  return SECTION_STYLES[upper] || { bg:'rgba(255,255,255,0.02)', border:'rgba(255,255,255,0.08)', label:'#8a9099' }
}

function AgentResponse({ text }) {
  const lines = text.split('\n')
  const sections = []
  let currentSection = null
  let currentLines = []
  let preamble = []
  let inPreamble = true

  // Parse into sections
  for (const rawLine of lines) {
    const line = clean(rawLine)
    const isHeader = line.startsWith('## ')
    if (isHeader) {
      inPreamble = false
      if (currentSection !== null) sections.push({ title: currentSection, lines: currentLines })
      currentSection = line.replace('## ', '')
      currentLines = []
    } else if (inPreamble) {
      preamble.push(line)
    } else {
      currentLines.push(line)
    }
  }
  if (currentSection !== null) sections.push({ title: currentSection, lines: currentLines })

  // Extract severity and financials from preamble
  let severity = null, financialLine = null
  for (const l of preamble) {
    const sevMatch = l.match(/\b(CRITICAL|HIGH|MEDIUM|LOW)\b/)
    if (sevMatch && !severity) severity = sevMatch[1]
    if (l.match(/£[\d,]+/) && (l.toLowerCase().includes('impact') || l.toLowerCase().includes('exposure') || l.toLowerCase().includes('financial'))) {
      financialLine = l
    }
  }

  const SEV_COLOR = { CRITICAL:'#ef4444', HIGH:'#f59e0b', MEDIUM:'#3b82f6', LOW:'#8a9099' }
  const SEV_BG = { CRITICAL:'rgba(239,68,68,0.1)', HIGH:'rgba(245,158,11,0.1)', MEDIUM:'rgba(59,130,246,0.1)', LOW:'rgba(138,144,153,0.1)' }

  function renderLines(lines, sectionTitle) {
    const items = []
    let k = 0
    for (const line of lines) {
      if (!line.trim()) { items.push(<div key={k++} style={{height:4}}/>); continue }
      if (line.match(/^---+$/)) { items.push(<div key={k++} style={{height:1,background:'rgba(255,255,255,0.06)',margin:'8px 0'}}/>); continue }

      // Blockquote callout
      if (line.startsWith('> ')) {
        items.push(
          <div key={k++} style={{margin:'8px 0',padding:'10px 14px',background:'rgba(239,68,68,0.06)',borderLeft:'3px solid #ef4444',borderRadius:'0 6px 6px 0'}}>
            <span style={{fontSize:12,color:'#e8eaed',lineHeight:1.6}} dangerouslySetInnerHTML={{__html:fmt(line.replace(/^> /,''))}}/>
          </div>
        )
        continue
      }

      // Numbered action
      const numMatch = line.match(/^(\d+)\.?\s+(.+)/)
      if (numMatch) {
        const [,num,content] = numMatch
        const urgent = content.includes('NOW') || content.includes('IMMEDIATELY') || content.includes('999')
        const titleUp = (sectionTitle || '').toUpperCase()
        const isContact = titleUp.includes('CONTACT') || titleUp.includes('WHO TO')
        const isReroute = titleUp.includes('REROUTE') || titleUp.includes('REROUTING') || titleUp.includes('OPTION')
        const isPrevention = titleUp.includes('PREVENTION')
        const dotBg = isContact ? '#f5a623' : isReroute ? '#a855f7' : isPrevention ? '#4a5260' : urgent ? '#ef4444' : '#ef4444'
        const dotText = isContact ? '#000' : '#fff'
        // Contact items get a different card style — teal left border, no dark bg
        if (isContact) {
          items.push(
            <div key={k++} style={{margin:'6px 0',padding:'10px 14px',background:'rgba(245,166,35,0.04)',borderRadius:6,borderLeft:'3px solid rgba(245,166,35,0.3)'}}>
              <div style={{fontSize:11,fontWeight:600,color:'#f5a623',marginBottom:4}}>Contact {num}</div>
              <div style={{fontSize:12,color:'#e8eaed',lineHeight:1.7}} dangerouslySetInnerHTML={{__html:fmt(content)}}/>
            </div>
          )
          continue
        }
        items.push(
          <div key={k++} style={{display:'flex',gap:10,margin:'5px 0',padding:'10px 12px',background:'rgba(0,0,0,0.2)',borderRadius:6,border:'1px solid rgba(255,255,255,0.06)'}}>
            <div style={{width:22,height:22,borderRadius:'50%',background:dotBg,color:dotText,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0,marginTop:1}}>{num}</div>
            <div style={{fontSize:12,color:'#e8eaed',lineHeight:1.7,flex:1}} dangerouslySetInnerHTML={{__html:fmt(content)}}/>
          </div>
        )
        continue
      }

      // Bullet
      if (line.startsWith('- ') || line.startsWith('— ')) {
        const content = line.replace(/^[-—]\s+/,'')
        items.push(
          <div key={k++} style={{display:'flex',gap:8,margin:'3px 0',paddingLeft:4}}>
            <span style={{color:'#f5a623',fontSize:11,marginTop:2,flexShrink:0}}>—</span>
            <span style={{fontSize:12,color:'#8a9099',lineHeight:1.7}} dangerouslySetInnerHTML={{__html:fmt(content)}}/>
          </div>
        )
        continue
      }

      // Bold-only line (e.g. "**Call the driver back NOW**")
      if (line.match(/^\*\*.+\*\*$/)) {
        items.push(<div key={k++} style={{fontSize:13,color:'#e8eaed',fontWeight:500,margin:'6px 0'}} dangerouslySetInnerHTML={{__html:fmt(line)}}/>)
        continue
      }

      // Default body text
      items.push(<div key={k++} style={{fontSize:12,color:'#8a9099',lineHeight:1.8,margin:'2px 0'}} dangerouslySetInnerHTML={{__html:fmt(line)}}/>)
    }
    return items
  }

  return (
    <div style={{padding:'4px 0'}}>
      {/* Severity + financial header strip */}
      {(severity || financialLine) && (
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'#0f1826',borderRadius:8,marginBottom:14,flexWrap:'wrap',border:'1px solid rgba(255,255,255,0.06)'}}>
          {severity && (
            <span style={{background:SEV_BG[severity],color:SEV_COLOR[severity],fontSize:11,fontFamily:'monospace',fontWeight:700,padding:'3px 10px',borderRadius:4,border:`1px solid ${SEV_COLOR[severity]}30`,letterSpacing:'0.05em'}}>{severity}</span>
          )}
          {financialLine && (
            <span style={{fontSize:12,color:'#8a9099'}} dangerouslySetInnerHTML={{__html:fmt(financialLine)}}/>
          )}
        </div>
      )}

      {/* Preamble lines that aren't severity/financial */}
      {preamble.filter(l => l.trim() && !l.match(/\b(CRITICAL|HIGH|MEDIUM|LOW)\b/) && !l.match(/£[\d,]+/)).map((l,i) => (
        <div key={i} style={{fontSize:12,color:'#8a9099',lineHeight:1.8,marginBottom:4}} dangerouslySetInnerHTML={{__html:fmt(l)}}/>
      ))}

      {/* Colour-coded section cards */}
      {sections.map((section, i) => {
        const style = getSectionStyle(section.title)
        const hasContent = section.lines.some(l => l.trim())
        if (!hasContent) return null
        return (
          <div key={i} style={{background:style.bg,border:`1px solid ${style.border}`,borderRadius:8,padding:'12px 14px',marginBottom:10}}>
            <div style={{fontSize:11,fontFamily:'monospace',color:style.label,letterSpacing:'0.08em',fontWeight:600,marginBottom:8}}>{section.title.toUpperCase()}</div>
            {renderLines(section.lines, section.title)}
          </div>
        )
      })}
    </div>
  )
}

// ── MODULE RESULT RENDERER ─────────────────────────────────────────────────
function MetricBadge({ label, value, color = '#f5a623', prefix = '' }) {
  return (
    <div style={{ padding:'6px 14px', borderRadius:6, background:`${color}10`, border:`1px solid ${color}25` }}>
      <div style={{ fontSize:9, color:'#4a5260', fontFamily:'monospace', marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:700, color, fontFamily:'monospace' }}>{prefix}{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
  )
}

function SectionBlock({ label, children, labelColor = '#4a5260' }) {
  return (
    <div style={{ padding:'12px 14px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ fontSize:9, fontFamily:'monospace', color:labelColor, letterSpacing:'0.08em', marginBottom:8 }}>{label}</div>
      {children}
    </div>
  )
}

function ActionCard({ text, index, urgent }) {
  return (
    <div style={{ display:'flex', gap:10, marginBottom:6, padding:'8px 10px', background:'#0f1826', borderRadius:5, border: urgent ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ width:18, height:18, borderRadius:'50%', background: urgent ? '#ef4444' : '#f5a623', color:'#000', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, flexShrink:0, marginTop:1 }}>{index + 1}</div>
      <div style={{ fontSize:11, color:'#e8eaed', lineHeight:1.6 }}>{text}</div>
    </div>
  )
}

function ItemCard({ children, bg = 'rgba(255,255,255,0.03)', border = 'rgba(255,255,255,0.08)' }) {
  return (
    <div style={{ padding:'10px 12px', background:bg, border:`1px solid ${border}`, borderRadius:6, marginBottom:6 }}>
      {children}
    </div>
  )
}

function KV({ k, v, valueColor = '#e8eaed' }) {
  if (v === null || v === undefined || v === '') return null
  return (
    <div style={{ display:'flex', gap:6, marginBottom:3, flexWrap:'wrap' }}>
      <span style={{ fontSize:10, color:'#4a5260', fontFamily:'monospace', flexShrink:0 }}>{k.replace(/_/g,' ').toUpperCase()}:</span>
      <span style={{ fontSize:11, color:valueColor }}>{String(v)}</span>
    </div>
  )
}

function ModuleResult({ result, moduleName }) {
  if (!result) return null
  const r = result.result || result
  const SEV = { CRITICAL:'#ef4444', HIGH:'#f59e0b', MEDIUM:'#3b82f6', LOW:'#8a9099' }

  // Collect all top-level numeric financial fields for the metrics bar
  const financialKeys = ['financial_impact','total_overcharge','annual_projection','total_breach_cost',
    'renegotiation_saving','total_daily_saving','total_planning_saving','total_annual_opportunity',
    'total_breakdown_risk','total_preventive_cost','total_replacement_cost_at_risk',
    'total_penalty_risk','total_compliance_cost','dvsa_penalty_risk','total_saving',
    'saving','claim_value']
  const financialMetrics = financialKeys.filter(k => r[k] > 0)

  return (
    <div style={{ marginTop:16 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'rgba(245,166,35,0.06)', border:'1px solid rgba(245,166,35,0.15)', borderRadius:'8px 8px 0 0', fontFamily:'monospace', fontSize:11, color:'#f5a623' }}>
        <span>MODULE RESULT — {moduleName?.toUpperCase()}</span>
        {result.demo_mode && <span style={{ color:'#4a5260' }}>DEMO DATA</span>}
        {result.actions_queued > 0 && <span style={{ color:'#f59e0b' }}>● {result.actions_queued} actions queued</span>}
      </div>

      <div style={{ border:'1px solid rgba(245,166,35,0.15)', borderTop:'none', borderRadius:'0 0 8px 8px', overflow:'hidden' }}>

        {/* Metrics bar */}
        {(r.severity || financialMetrics.length > 0 || r.all_clear === false) && (
          <div style={{ display:'flex', gap:8, padding:'12px 14px', background:'#0d1420', borderBottom:'1px solid rgba(255,255,255,0.06)', flexWrap:'wrap' }}>
            {r.severity && <MetricBadge label="SEVERITY" value={r.severity} color={SEV[r.severity] || '#8a9099'} />}
            {r.all_clear === false && <MetricBadge label="STATUS" value="ACTION REQUIRED" color="#ef4444" />}
            {r.all_clear === true && <MetricBadge label="STATUS" value="ALL CLEAR" color="#f5a623" />}
            {financialMetrics.slice(0,3).map(k => (
              <MetricBadge key={k} label={k.replace(/_/g,' ').toUpperCase()} value={r[k]} color="#f5a623" prefix="£" />
            ))}
            {(r.drivers_at_risk?.length > 0) && <MetricBadge label="DRIVERS AT RISK" value={r.drivers_at_risk.length} color="#f59e0b" />}
            {(r.vehicles_at_risk?.length > 0) && <MetricBadge label="VEHICLES AT RISK" value={r.vehicles_at_risk.length} color="#ef4444" />}
            {(r.at_risk_deliveries?.length > 0) && <MetricBadge label="DELIVERIES AT RISK" value={r.at_risk_deliveries.length} color="#f59e0b" />}
            {(r.at_risk_drivers?.length > 0) && <MetricBadge label="DRIVERS AT RISK" value={r.at_risk_drivers.length} color="#f59e0b" />}
            {(r.flags_found > 0) && <MetricBadge label="FLAGS FOUND" value={r.flags_found} color="#ef4444" />}
            {(r.compliance_failures?.length > 0) && <MetricBadge label="COMPLIANCE FAILURES" value={r.compliance_failures.length} color="#ef4444" />}
            {(r.discrepancies?.length > 0) && <MetricBadge label="OVERCHARGES FOUND" value={r.discrepancies.length} color="#ef4444" />}
            {(r.matching_tenders?.length > 0) && <MetricBadge label="MATCHING TENDERS" value={r.matching_tenders.length} color="#a855f7" />}
            {(r.opportunities?.length > 0) && <MetricBadge label="OPPORTUNITIES" value={r.opportunities.length} color="#f5a623" />}
          </div>
        )}

        {/* ── DISRUPTION / SLA sections format ── */}
        {r.sections?.assessment && (
          <SectionBlock label="ASSESSMENT">
            <div style={{ fontSize:12, color:'#8a9099', lineHeight:1.7 }}>{r.sections.assessment}</div>
          </SectionBlock>
        )}
        {r.sections?.immediate_actions?.length > 0 && (
          <SectionBlock label="IMMEDIATE ACTIONS">
            {r.sections.immediate_actions.map((a,i) => <ActionCard key={i} text={a} index={i} urgent={a.includes('NOW')||a.includes('999')} />)}
          </SectionBlock>
        )}
        {r.sections?.who_to_contact && (
          <SectionBlock label="WHO TO CONTACT">
            <div style={{ fontSize:12, color:'#8a9099', lineHeight:1.7 }}>{r.sections.who_to_contact}</div>
          </SectionBlock>
        )}
        {r.sections?.downstream_risks && (
          <SectionBlock label="DOWNSTREAM RISKS" labelColor="#f59e0b">
            <div style={{ fontSize:12, color:'#8a9099', lineHeight:1.7 }}>{r.sections.downstream_risks}</div>
          </SectionBlock>
        )}
        {r.sections?.prevention && (
          <SectionBlock label="PREVENTION">
            <div style={{ fontSize:12, color:'#8a9099', lineHeight:1.7 }}>{r.sections.prevention}</div>
          </SectionBlock>
        )}

        {/* ── INVOICE discrepancies ── */}
        {r.discrepancies?.length > 0 && (
          <SectionBlock label="OVERCHARGES FOUND">
            {r.discrepancies.map((d,i) => (
              <ItemCard key={i} bg="rgba(239,68,68,0.06)" border="rgba(239,68,68,0.15)">
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:'#e8eaed', fontFamily:'monospace' }}>{d.invoice_ref} — {d.carrier}</span>
                  <span style={{ fontSize:12, color:'#f5a623', fontFamily:'monospace', fontWeight:700 }}>+£{(d.delta||0).toLocaleString()}</span>
                </div>
                <div style={{ fontSize:10, color:'#8a9099' }}>{d.issue_type?.replace(/_/g,' ').toUpperCase()}</div>
                <div style={{ fontSize:11, color:'#8a9099', marginTop:3 }}>{d.evidence}</div>
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── CARRIERS ── */}
        {r.carriers?.length > 0 && (
          <SectionBlock label="CARRIER PERFORMANCE">
            {r.carriers.map((c,i) => (
              <ItemCard key={i} bg={c.below_threshold ? 'rgba(239,68,68,0.05)' : 'rgba(245,166,35,0.03)'} border={c.below_threshold ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.08)'}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, color:'#e8eaed', fontWeight:500 }}>{c.name}</span>
                  <span style={{ fontSize:11, color: c.recommendation==='terminate'?'#ef4444':c.recommendation==='renegotiate'?'#f59e0b':'#f5a623', fontFamily:'monospace', fontWeight:700 }}>{c.recommendation?.toUpperCase()}</span>
                </div>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  <span style={{ fontSize:10, color: c.on_time_rate < c.contract_threshold_otr ? '#ef4444' : '#8a9099' }}>OTR: {c.on_time_rate}% (min {c.contract_threshold_otr}%)</span>
                  <span style={{ fontSize:10, color:'#8a9099' }}>Damage: {c.damage_rate}%</span>
                  {c.sla_breach_cost > 0 && <span style={{ fontSize:10, color:'#f59e0b' }}>Breach cost: £{c.sla_breach_cost?.toLocaleString()}</span>}
                </div>
                <div style={{ fontSize:10, color:'#4a5260', marginTop:4 }}>{c.evidence_summary}</div>
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── DRIVERS AT RISK (hours/retention) ── */}
        {(r.drivers_at_risk?.length > 0 || r.at_risk_drivers?.length > 0) && (
          <SectionBlock label="DRIVERS FLAGGED">
            {[...(r.drivers_at_risk||[]), ...(r.at_risk_drivers||[])].map((d,i) => (
              <ItemCard key={i} bg={d.breach_risk||d.risk_level==='HIGH' ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.04)'} border={d.breach_risk||d.risk_level==='HIGH' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, color:'#e8eaed', fontWeight:500 }}>{d.name} — {d.vehicle_reg || d.vehicle}</span>
                  {d.risk_level && <span style={{ fontSize:10, color: d.risk_level==='HIGH'?'#ef4444':'#f59e0b', fontFamily:'monospace', fontWeight:700 }}>{d.risk_level}</span>}
                </div>
                <div style={{ fontSize:11, color:'#f59e0b' }}>{d.specific_instruction || d.recommended_interventions?.[0]}</div>
                {d.signals?.map((s,si) => <div key={si} style={{ fontSize:10, color:'#4a5260', marginTop:2 }}>— {s}</div>)}
                {d.breach_risk && <div style={{ fontSize:10, color:'#ef4444', marginTop:3 }}>Hours worked: {d.hours_worked} / {d.wtd_limit} limit · {d.remaining_hours}h remaining</div>}
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── VEHICLES AT RISK ── */}
        {r.vehicles_at_risk?.length > 0 && (
          <SectionBlock label="VEHICLES FLAGGED">
            {r.vehicles_at_risk.map((v,i) => (
              <ItemCard key={i} bg="rgba(239,68,68,0.05)" border="rgba(239,68,68,0.15)">
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, color:'#e8eaed', fontWeight:500 }}>{v.reg}</span>
                  <span style={{ fontSize:11, color:'#ef4444', fontFamily:'monospace' }}>{v.failure_probability}% failure risk</span>
                </div>
                <div style={{ fontSize:11, color:'#f59e0b', marginBottom:3 }}>{v.preventive_fix}</div>
                <div style={{ fontSize:10, color:'#4a5260' }}>Breakdown cost if ignored: £{v.breakdown_cost?.toLocaleString()} · Preventive fix: £{v.preventive_cost?.toLocaleString()}</div>
                <div style={{ fontSize:10, color:'#8a9099', marginTop:2 }}>Optimal slot: {v.optimal_service_slot}</div>
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── SLA at-risk deliveries ── */}
        {r.at_risk_deliveries?.length > 0 && (
          <SectionBlock label="DELIVERIES AT RISK">
            {r.at_risk_deliveries.map((d,i) => (
              <ItemCard key={i} bg={d.breach_probability > 80 ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.04)'} border={d.breach_probability > 80 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, color:'#e8eaed', fontWeight:500 }}>{d.ref} — {d.client}</span>
                  <span style={{ fontSize:11, color: d.breach_probability > 80 ? '#ef4444' : '#f59e0b', fontFamily:'monospace' }}>{d.breach_probability}% breach risk</span>
                </div>
                <div style={{ fontSize:10, color:'#8a9099' }}>SLA closes: {d.sla_window_closes} · Current ETA: {d.current_eta} · Penalty: £{d.penalty_if_breached?.toLocaleString()}</div>
                {d.reroute_saves_sla && <div style={{ fontSize:11, color:'#f5a623', marginTop:4 }}>✓ REROUTE AVAILABLE: {d.reroute_instruction}</div>}
                {!d.reroute_saves_sla && <div style={{ fontSize:11, color:'#ef4444', marginTop:4 }}>{d.reroute_instruction}</div>}
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── FUEL vehicles ── */}
        {r.vehicles_to_fill?.length > 0 && (
          <SectionBlock label={`FILL NOW — ${r.recommendation?.toUpperCase().replace(/_/g,' ')}`} labelColor={r.recommendation==='fill_now'?'#f5a623':'#f59e0b'}>
            <div style={{ fontSize:12, color:'#8a9099', marginBottom:8, lineHeight:1.6 }}>{r.reasoning}</div>
            {r.vehicles_to_fill.map((v,i) => (
              <ItemCard key={i}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:11, color:'#e8eaed' }}>{v.reg} — {v.driver}</span>
                  <span style={{ fontSize:11, color:'#f5a623', fontFamily:'monospace' }}>Save £{v.saving?.toFixed(2)}</span>
                </div>
                <div style={{ fontSize:10, color:'#8a9099', marginTop:2 }}>{v.current_level_pct}% fuel · {v.nearest_fuel_stop}</div>
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── COMPLIANCE failures / flags ── */}
        {r.compliance_failures?.length > 0 && (
          <SectionBlock label="COMPLIANCE FAILURES — DISPATCH BLOCKED" labelColor="#ef4444">
            {r.compliance_failures.map((f,i) => (
              <ItemCard key={i} bg="rgba(239,68,68,0.07)" border="rgba(239,68,68,0.2)">
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:'#e8eaed', fontFamily:'monospace' }}>{f.job_ref} — {f.assigned_driver}</span>
                  <span style={{ fontSize:10, color:'#ef4444', fontFamily:'monospace' }}>BLOCKED</span>
                </div>
                <div style={{ fontSize:11, color:'#f59e0b' }}>{f.failure_reason?.replace(/_/g,' ').toUpperCase()}</div>
                <div style={{ fontSize:11, color:'#8a9099', marginTop:3 }}>{f.resolution}</div>
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── LICENCE flags ── */}
        {r.flags?.length > 0 && (
          <SectionBlock label="LICENCE FLAGS">
            {r.flags.map((f,i) => (
              <ItemCard key={i} bg="rgba(239,68,68,0.05)" border="rgba(239,68,68,0.15)">
                <div style={{ fontSize:12, color:'#e8eaed', fontWeight:500, marginBottom:4 }}>{f.driver} — {f.vehicle}</div>
                <div style={{ fontSize:10, color:'#ef4444', fontFamily:'monospace', marginBottom:6 }}>{f.action_required}</div>
                {f.issues?.map((iss,ii) => (
                  <div key={ii} style={{ fontSize:11, color: iss.severity==='CRITICAL'?'#ef4444':'#f59e0b', marginBottom:2 }}>— {iss.detail}</div>
                ))}
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── REGULATION changes ── */}
        {r.relevant_changes?.length > 0 && (
          <SectionBlock label="REGULATORY CHANGES AFFECTING YOUR FLEET">
            {r.relevant_changes.map((c,i) => (
              <ItemCard key={i} bg={c.urgency==='IMMEDIATE'?'rgba(239,68,68,0.05)':'rgba(245,158,11,0.04)'} border={c.urgency==='IMMEDIATE'?'rgba(239,68,68,0.15)':'rgba(245,158,11,0.15)'}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:'#e8eaed', fontWeight:500 }}>{c.title}</span>
                  <span style={{ fontSize:10, color: c.urgency==='IMMEDIATE'?'#ef4444':'#f59e0b', fontFamily:'monospace' }}>{c.urgency?.replace(/_/g,' ')}</span>
                </div>
                <div style={{ fontSize:11, color:'#8a9099', marginBottom:4 }}>{c.impact_description}</div>
                <div style={{ fontSize:11, color:'#f5a623' }}>Action: {c.compliance_action}</div>
                {c.penalty_if_ignored > 0 && <div style={{ fontSize:10, color:'#ef4444', marginTop:3 }}>Penalty if ignored: £{c.penalty_if_ignored?.toLocaleString()}</div>}
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── TENDERS ── */}
        {r.matching_tenders?.length > 0 && (
          <SectionBlock label="MATCHING TENDERS">
            {r.matching_tenders.map((t,i) => (
              <ItemCard key={i} bg="rgba(168,85,247,0.05)" border="rgba(168,85,247,0.15)">
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:'#e8eaed', fontWeight:500, flex:1, marginRight:8 }}>{t.title}</span>
                  <span style={{ fontSize:11, color:'#a855f7', fontFamily:'monospace', flexShrink:0 }}>{t.win_probability}% win</span>
                </div>
                <div style={{ fontSize:10, color:'#8a9099', marginBottom:3 }}>{t.buyer} · Value: £{t.value?.toLocaleString()} · Deadline: {t.deadline_days} days</div>
                <div style={{ fontSize:11, color:'#8a9099' }}>{t.briefing}</div>
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── CONSOLIDATION opportunities ── */}
        {r.opportunities?.length > 0 && (
          <SectionBlock label="CONSOLIDATION OPPORTUNITIES">
            {r.opportunities.map((o,i) => (
              <ItemCard key={i} bg={o.feasibility==='YES'?'rgba(245,166,35,0.04)':'rgba(245,158,11,0.04)'} border={o.feasibility==='YES'?'rgba(245,166,35,0.15)':'rgba(245,158,11,0.15)'}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:'#e8eaed', fontWeight:500 }}>{o.route_a} + {o.route_b}</span>
                  <span style={{ fontSize:11, color:'#f5a623', fontFamily:'monospace' }}>Save £{o.total_saving?.toLocaleString()}</span>
                </div>
                <div style={{ fontSize:10, color:'#8a9099', marginBottom:3 }}>{o.feasibility} · {o.vehicles_saved} vehicle saved · {o.combined_utilisation_pct}% utilisation</div>
                <div style={{ fontSize:11, color:'#8a9099' }}>{o.new_schedule}</div>
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── LANE benchmarking ── */}
        {r.lane_analysis?.length > 0 && (
          <SectionBlock label="LANE RATE ANALYSIS">
            <div style={{ fontSize:12, color:'#8a9099', marginBottom:8 }}>{r.net_recommendation}</div>
            {r.lane_analysis.map((l,i) => (
              <ItemCard key={i} bg={l.status==='underpriced'?'rgba(239,68,68,0.04)':'rgba(245,166,35,0.03)'}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontSize:11, color:'#e8eaed', fontWeight:500 }}>{l.lane}</span>
                  <span style={{ fontSize:10, color: l.status==='underpriced'?'#ef4444':'#f5a623', fontFamily:'monospace' }}>{l.status?.toUpperCase()}</span>
                </div>
                <div style={{ fontSize:10, color:'#8a9099' }}>Current: £{l.current_rate_per_mile}/mi · Market: £{l.market_rate_per_mile}/mi · Gap: £{l.annual_revenue_gap?.toLocaleString()}/yr</div>
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── FORECAST periods ── */}
        {r.forecast_periods?.length > 0 && (
          <SectionBlock label="DEMAND FORECAST">
            {r.forecast_periods.map((f,i) => (
              <ItemCard key={i} bg={f.capacity_gap > 0 ? 'rgba(239,68,68,0.05)' : 'rgba(245,166,35,0.03)'}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:'#e8eaed', fontWeight:500 }}>{f.week}</span>
                  <span style={{ fontSize:11, color: f.capacity_gap > 0 ? '#ef4444' : '#f5a623', fontFamily:'monospace' }}>{f.capacity_gap > 0 ? `${f.capacity_gap} jobs over capacity` : 'Within capacity'}</span>
                </div>
                {f.preparation_actions?.map((a,ai) => <div key={ai} style={{ fontSize:10, color:'#8a9099', marginBottom:1 }}>— {a}</div>)}
                {f.saving_by_planning > 0 && <div style={{ fontSize:10, color:'#f5a623', marginTop:3 }}>Plan now and save: £{f.saving_by_planning?.toLocaleString()}</div>}
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── CARBON report ── */}
        {r.annual_report?.narrative && (
          <SectionBlock label="ESG SUMMARY">
            <div style={{ fontSize:12, color:'#8a9099', lineHeight:1.7, marginBottom:8 }}>{r.annual_report.narrative}</div>
            <div style={{ fontSize:10, color:'#4a5260' }}>Methodology: {r.annual_report.methodology}</div>
          </SectionBlock>
        )}
        {r.optimisation_opportunities?.length > 0 && (
          <SectionBlock label="EMISSION REDUCTION OPPORTUNITIES">
            {r.optimisation_opportunities.map((o,i) => (
              <ItemCard key={i}>
                <div style={{ fontSize:11, color:'#e8eaed', marginBottom:3 }}>{o.description}</div>
                <div style={{ fontSize:10, color:'#f5a623' }}>-{o.emission_reduction_pct}% emissions · Save £{o.cost_saving?.toLocaleString()}/yr</div>
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── INSURANCE claim ── */}
        {r.verdict && (
          <SectionBlock label={`VERDICT — ${r.liability_assessment?.replace(/_/g,' ')}`} labelColor={r.liability_assessment==='NO_LIABILITY'?'#f5a623':'#ef4444'}>
            <div style={{ fontSize:12, color:'#e8eaed', lineHeight:1.7, marginBottom:8 }}>{r.verdict}</div>
            {r.response_letter && <div style={{ fontSize:11, color:'#8a9099', lineHeight:1.6, padding:'8px 10px', background:'#0f1826', borderRadius:5, border:'1px solid rgba(255,255,255,0.06)' }}>{r.response_letter}</div>}
          </SectionBlock>
        )}

        {/* ── CARGO THEFT ── */}
        {r.risk_flags?.length > 0 && (
          <SectionBlock label={`THEFT RISK FLAGS — ${r.overall_risk}`} labelColor={r.overall_risk==='CRITICAL'?'#ef4444':'#f59e0b'}>
            {r.total_cargo_at_risk > 0 && (
              <div style={{ fontSize:11, color:'#ef4444', marginBottom:8, fontFamily:'monospace' }}>
                Total cargo at risk: £{r.total_cargo_at_risk.toLocaleString()}
              </div>
            )}
            {r.risk_flags.map((f,i) => (
              <ItemCard key={i} bg={f.urgency==='IMMEDIATE'?'rgba(239,68,68,0.07)':'rgba(245,158,11,0.05)'} border={f.urgency==='IMMEDIATE'?'rgba(239,68,68,0.2)':'rgba(245,158,11,0.2)'}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, color:'#e8eaed', fontWeight:500 }}>{f.vehicle_reg} — {f.driver}</span>
                  <span style={{ fontSize:10, color:f.urgency==='IMMEDIATE'?'#ef4444':'#f59e0b', fontFamily:'monospace', fontWeight:700 }}>{f.urgency?.replace(/_/g,' ')}</span>
                </div>
                <div style={{ fontSize:11, color:'#f59e0b', marginBottom:4 }}>{f.flag_type?.replace(/_/g,' ').toUpperCase()} · {f.location}</div>
                <div style={{ fontSize:11, color:'#8a9099', marginBottom:f.secure_parking_options?.length>0?8:0 }}>{f.action_required}</div>
                {f.cargo_value > 0 && (
                  <div style={{ fontSize:10, color:'#ef4444', marginBottom:f.secure_parking_options?.length>0?8:0 }}>
                    Cargo at risk: £{f.cargo_value.toLocaleString()}
                  </div>
                )}
                {f.secure_parking_options?.length > 0 && (
                  <div>
                    <div style={{ fontSize:9, color:'#f5a623', fontFamily:'monospace', letterSpacing:'0.06em', marginBottom:5 }}>SECURE PARKING OPTIONS — DIVERT NOW</div>
                    {f.secure_parking_options.map((p,pi) => (
                      <div key={pi} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'7px 9px', background:'rgba(245,166,35,0.05)', border:'1px solid rgba(245,166,35,0.15)', borderRadius:5, marginBottom:4 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:11, color:'#e8eaed', fontWeight:500, marginBottom:2 }}>{p.name}</div>
                          <div style={{ fontSize:10, color:'#8a9099' }}>{p.direction} · {p.distance_miles} miles</div>
                          {p.note && <div style={{ fontSize:10, color:'#f59e0b', marginTop:2 }}>{p.note}</div>}
                          <div style={{ display:'flex', gap:8, marginTop:3 }}>
                            {p.accredited && <span style={{ fontSize:9, color:'#f5a623', fontFamily:'monospace' }}>✓ ACCREDITED</span>}
                            {p.cctv && <span style={{ fontSize:9, color:'#8a9099', fontFamily:'monospace' }}>CCTV</span>}
                            {p.security_patrol && <span style={{ fontSize:9, color:'#8a9099', fontFamily:'monospace' }}>SECURITY PATROL</span>}
                          </div>
                        </div>
                        <div style={{ fontSize:16, fontWeight:700, color:'#f5a623', fontFamily:'monospace', marginLeft:12, flexShrink:0 }}>
                          {p.cost_gbp===0 ? 'FREE' : `£${p.cost_gbp}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ItemCard>
            ))}
          </SectionBlock>
        )}
        {r.secure_parking_policy && (
          <SectionBlock label="SECURE PARKING POLICY" labelColor="#f5a623">
            <ItemCard bg="rgba(245,166,35,0.04)" border="rgba(245,166,35,0.15)">
              <div style={{ fontSize:11, color:'#e8eaed', marginBottom:6 }}>{r.secure_parking_policy.policy}</div>
              <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                <div><span style={{ fontSize:10, color:'#4a5260' }}>Annual cost: </span><span style={{ fontSize:11, color:'#f59e0b', fontWeight:600 }}>£{r.secure_parking_policy.annual_cost_estimate?.toLocaleString()}</span></div>
                <div><span style={{ fontSize:10, color:'#4a5260' }}>Risk mitigated: </span><span style={{ fontSize:11, color:'#f5a623', fontWeight:600 }}>£{r.secure_parking_policy.annual_theft_risk_mitigated?.toLocaleString()}</span></div>
                <div><span style={{ fontSize:10, color:'#4a5260' }}>ROI: </span><span style={{ fontSize:11, color:'#f5a623', fontWeight:600 }}>{r.secure_parking_policy.roi}</span></div>
              </div>
            </ItemCard>
          </SectionBlock>
        )}
        {r.high_risk_routes?.length > 0 && (
          <SectionBlock label="HIGH RISK ROUTES" labelColor="#f59e0b">
            {r.high_risk_routes.map((rt,i) => (
              <ItemCard key={i}>
                <div style={{ fontSize:11, color:'#e8eaed', fontWeight:500, marginBottom:3 }}>{rt.route}</div>
                <div style={{ fontSize:11, color:'#f59e0b', marginBottom:3 }}>{rt.known_risk}</div>
                <div style={{ fontSize:11, color:'#8a9099' }}>{rt.recommendation}</div>
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── GHOST FREIGHT ── */}
        {r.suspicious_entries?.length > 0 && (
          <SectionBlock label="SUSPICIOUS ENTRIES" labelColor="#ef4444">
            {r.suspicious_entries.map((s,i) => (
              <ItemCard key={i} bg="rgba(239,68,68,0.05)" border="rgba(239,68,68,0.18)">
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:'#e8eaed', fontWeight:500 }}>{s.entity}</span>
                  <span style={{ fontSize:10, color:'#ef4444', fontFamily:'monospace' }}>{s.type?.replace(/_/g,' ').toUpperCase()}</span>
                </div>
                <div style={{ fontSize:11, color:'#8a9099', marginBottom:4 }}>{s.evidence}</div>
                <div style={{ fontSize:11, color:'#f5a623' }}>Action: {s.action}</div>
                {s.financial_exposure > 0 && <div style={{ fontSize:10, color:'#ef4444', marginTop:3 }}>Exposure: £{s.financial_exposure.toLocaleString()} · Confidence: {s.confidence}</div>}
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── SUBCONTRACTOR TRUST ── */}
        {r.trust_scores?.length > 0 && (
          <SectionBlock label="SUBCONTRACTOR TRUST SCORES">
            {r.trust_scores.map((s,i) => {
              const scoreColor = s.overall_score >= 80 ? '#f5a623' : s.overall_score >= 60 ? '#f59e0b' : '#ef4444'
              return (
                <ItemCard key={i} bg={s.recommendation==='terminate'?'rgba(239,68,68,0.06)':s.recommendation==='use_with_caution'?'rgba(245,158,11,0.04)':'rgba(245,166,35,0.03)'} border={s.recommendation==='terminate'?'rgba(239,68,68,0.2)':s.recommendation==='use_with_caution'?'rgba(245,158,11,0.15)':'rgba(245,166,35,0.12)'}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:12, color:'#e8eaed', fontWeight:500 }}>{s.name}</span>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:16, fontWeight:700, color:scoreColor, fontFamily:'monospace' }}>{s.overall_score}</span>
                      <span style={{ fontSize:10, color:s.recommendation==='terminate'?'#ef4444':s.recommendation==='use_with_caution'?'#f59e0b':'#f5a623', fontFamily:'monospace', fontWeight:700 }}>{s.recommendation?.replace(/_/g,' ').toUpperCase()}</span>
                    </div>
                  </div>
                  {s.flags?.map((f,fi) => <div key={fi} style={{ fontSize:10, color:'#f59e0b', marginBottom:2 }}>— {f}</div>)}
                </ItemCard>
              )
            })}
          </SectionBlock>
        )}

        {/* ── CASH FLOW ── */}
        {r.forecast_weeks?.length > 0 && !r.preparation_actions && (
          <SectionBlock label={`CASH FLOW FORECAST — ${r.overall_health?.replace(/_/g,' ')}`} labelColor={r.overall_health==='CRITICAL'||r.overall_health==='STRAINED'?'#ef4444':'#f5a623'}>
            {r.total_penalty_exposure > 0 && <div style={{ fontSize:11, color:'#ef4444', marginBottom:8 }}>Total penalty exposure: £{r.total_penalty_exposure.toLocaleString()} · Outstanding receivables: £{r.outstanding_receivables?.toLocaleString()}</div>}
            {r.forecast_weeks.map((w,i) => (
              <ItemCard key={i} bg={w.net<0?'rgba(239,68,68,0.05)':'rgba(245,166,35,0.03)'} border={w.net<0?'rgba(239,68,68,0.15)':'rgba(245,166,35,0.12)'}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:'#e8eaed', fontWeight:500 }}>{w.week}</span>
                  <span style={{ fontSize:12, color:w.net<0?'#ef4444':'#f5a623', fontFamily:'monospace', fontWeight:700 }}>{w.net<0?'-':'+'}£{Math.abs(w.net).toLocaleString()}</span>
                </div>
                {w.alert && <div style={{ fontSize:10, color:'#f59e0b', marginBottom:4 }}>{w.alert}</div>}
                {w.risk_items?.map((ri,ri_i) => <div key={ri_i} style={{ fontSize:10, color:'#4a5260', marginBottom:1 }}>— {ri.description}: £{ri.amount.toLocaleString()} due {ri.due_date}</div>)}
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── CHURN PREDICTION ── */}
        {r.clients_at_risk?.length > 0 && (
          <SectionBlock label="CLIENT CHURN PREDICTION" labelColor={r.high_risk_count>0?'#ef4444':'#f5a623'}>
            {r.total_revenue_at_risk > 0 && <div style={{ fontSize:11, color:'#ef4444', marginBottom:8 }}>Total revenue at risk: £{r.total_revenue_at_risk.toLocaleString()}/year</div>}
            {r.clients_at_risk.map((c,i) => (
              <ItemCard key={i} bg={c.churn_risk==='HIGH'||c.churn_risk==='CRITICAL'?'rgba(239,68,68,0.05)':'rgba(245,166,35,0.03)'} border={c.churn_risk==='HIGH'||c.churn_risk==='CRITICAL'?'rgba(239,68,68,0.18)':'rgba(245,166,35,0.12)'}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, color:'#e8eaed', fontWeight:500 }}>{c.client}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:12, color:c.churn_risk==='HIGH'||c.churn_risk==='CRITICAL'?'#ef4444':'#f5a623', fontFamily:'monospace', fontWeight:700 }}>{c.churn_probability_pct}%</span>
                    <span style={{ fontSize:10, color:c.churn_risk==='HIGH'||c.churn_risk==='CRITICAL'?'#ef4444':'#f5a623', fontFamily:'monospace' }}>{c.churn_risk}</span>
                  </div>
                </div>
                <div style={{ fontSize:10, color:'#4a5260', marginBottom:4 }}>Contract renewal: {c.days_to_contract_renewal} days · Revenue at risk: £{c.revenue_at_risk?.toLocaleString()}/yr</div>
                {c.risk_signals?.slice(0,2).map((s,si) => <div key={si} style={{ fontSize:10, color:'#f59e0b', marginBottom:1 }}>— {s}</div>)}
                <div style={{ fontSize:11, color:'#f5a623', marginTop:5 }}>{c.recommended_action}</div>
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── WORKFORCE PIPELINE ── */}
        {r.upcoming_issues?.length > 0 && (
          <SectionBlock label={`WORKFORCE PIPELINE — ${r.workforce_health?.replace(/_/g,' ')}`} labelColor={r.workforce_health==='AT_RISK'||r.workforce_health==='CRITICAL'?'#ef4444':'#f5a623'}>
            {r.headcount_risk?.shortfall > 0 && (
              <div style={{ padding:'8px 10px', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:6, marginBottom:8 }}>
                <span style={{ fontSize:11, color:'#ef4444' }}>Driver shortfall: {r.headcount_risk.shortfall} · Agency dependency: {r.headcount_risk.agency_dependency_pct}%</span>
              </div>
            )}
            {r.upcoming_issues.map((u,i) => (
              <ItemCard key={i} bg={u.days_remaining<60?'rgba(239,68,68,0.05)':'rgba(245,158,11,0.04)'} border={u.days_remaining<60?'rgba(239,68,68,0.18)':'rgba(245,158,11,0.15)'}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, color:'#e8eaed', fontWeight:500 }}>{u.driver}</span>
                  <span style={{ fontSize:10, color:u.days_remaining<60?'#ef4444':'#f59e0b', fontFamily:'monospace' }}>{u.days_remaining} days · {u.issue_type?.replace(/_/g,' ').toUpperCase()}</span>
                </div>
                <div style={{ fontSize:11, color:'#f5a623' }}>{u.action}</div>
              </ItemCard>
            ))}
          </SectionBlock>
        )}

        {/* ── Generic all-clear ── */}
        {!r.sections && !r.discrepancies && !r.carriers && !r.drivers_at_risk && !r.vehicles_at_risk
          && !r.at_risk_deliveries && !r.vehicles_to_fill && !r.compliance_failures && !r.flags
          && !r.relevant_changes && !r.matching_tenders && !r.opportunities && !r.lane_analysis
          && !r.forecast_periods && !r.verdict && !r.at_risk_drivers
          && !r.risk_flags && !r.suspicious_entries && !r.trust_scores
          && !r.forecast_weeks && !r.clients_at_risk && !r.upcoming_issues && (
          <div style={{ padding:'20px 14px', textAlign:'center' }}>
            <div style={{ fontFamily:'monospace', fontSize:11, color:'#f5a623', marginBottom:6 }}>✓ ALL CLEAR</div>
            <div style={{ fontSize:12, color:'#4a5260' }}>No issues detected. Module continues monitoring.</div>
          </div>
        )}

      </div>
    </div>
  )
}

// ── SCENARIO RESULT RENDERER ──────────────────────────────────────────────────
function ScenarioResult({ result }) {
  if (!result) return null
  const skip = ['scenario','actions','cascade']
  const entries = Object.entries(result).filter(([k]) => !skip.includes(k))

  return (
    <div>
      {entries.map(([k, v]) => (
        <div key={k} style={{ marginBottom: 16 }}>
          <div style={{ fontFamily:'monospace', fontSize:10, color:'#f5a623', letterSpacing:'0.08em', marginBottom:6, display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ height:1, width:12, background:'#f5a623' }} />
            {k.replace(/_/g,' ').toUpperCase()}
          </div>
          {Array.isArray(v) ? (
            v.length === 0
              ? <div style={{ fontSize:12, color:'#4a5260' }}>None</div>
              : v.map((item, i) => (
                <div key={i} style={{ padding:'8px 10px', background:'#0f1826', borderRadius:5, border:'1px solid rgba(255,255,255,0.06)', marginBottom:6 }}>
                  {typeof item === 'object'
                    ? Object.entries(item).map(([ik,iv]) => (
                        <div key={ik} style={{ fontSize:11, color:'#8a9099', marginBottom:2 }}>
                          <span style={{ color:'#e8eaed', fontWeight:500 }}>{ik.replace(/_/g,' ')}: </span>
                          {typeof iv === 'boolean' ? (iv ? 'Yes' : 'No') : String(iv)}
                        </div>
                      ))
                    : <div style={{ fontSize:12, color:'#8a9099' }}>{String(item)}</div>
                  }
                </div>
              ))
          ) : typeof v === 'object' && v !== null ? (
            <div style={{ padding:'8px 10px', background:'#0f1826', borderRadius:5, border:'1px solid rgba(255,255,255,0.06)' }}>
              {Object.entries(v).map(([ik,iv]) => (
                <div key={ik} style={{ fontSize:11, color:'#8a9099', marginBottom:2 }}>
                  <span style={{ color:'#e8eaed', fontWeight:500 }}>{ik.replace(/_/g,' ')}: </span>
                  {String(iv)}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize:12, color:'#8a9099', lineHeight:1.7 }}>{String(v)}</div>
          )}
        </div>
      ))}
      {result.cascade && result.cascade.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontFamily:'monospace', fontSize:10, color:'#ef4444', letterSpacing:'0.08em', marginBottom:6 }}>CASCADE CHAIN</div>
          {result.cascade.map((c,i) => (
            <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom:4 }}>
              <div style={{ width:20, height:20, borderRadius:'50%', background: c.sla_breached?'#ef4444':'#f5a623', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, flexShrink:0 }}>{i}</div>
              <div style={{ fontSize:11, color:'#8a9099', flex:1 }}>
                <span style={{ color:'#e8eaed' }}>{c.ref}</span> — {c.description}
                {c.penalty > 0 && <span style={{ color:'#f5a623', marginLeft:8 }}>£{c.penalty.toLocaleString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── MAIN DASHBOARD ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [unlocked, setUnlocked] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dh_unlocked') === 'true'
    }
    return false
  })
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState('')
  const [activeShipment, setActiveShipment] = useState(null)
  const [activeTab, setActiveTab] = useState('approvals') // 'approvals' = COMMAND tab — default landing
  const [commandRightTab, setCommandRightTab] = useState('incidents') // 'incidents' | 'value'
  const [pendingApprovals, setPendingApprovals] = useState([])
  const [dashToast, setDashToast] = useState(null)
  const [emailPickerMailto, setEmailPickerMailto] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [csvRows, setCsvRows] = useState(null)
  const [csvDragActive, setCsvDragActive] = useState(false)
  const [manualInv, setManualInv] = useState({ carrier:'', invoice_ref:'', invoice_date:'', line_items:[{job_ref:'',description:'',charged:'',agreed_rate:''}] })
  const [moduleRunning, setModuleRunning] = useState(null)
  const [moduleResult, setModuleResult] = useState(null)
  const [activeModuleName, setActiveModuleName] = useState(null)
  const [approvingId, setApprovingId] = useState(null)
  const [localApprovals, setLocalApprovals] = useState([])
  const [cancelAssessment, setCancelAssessment] = useState(null)
  const [scenarioResult, setScenarioResult] = useState(null)
  const [scenarioRunning, setScenarioRunning] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)
  const [agentActions, setAgentActions] = useState([])
  const [moduleActions, setModuleActions] = useState([])
  const [actionStates, setActionStates] = useState({})
  const [latestRuns, setLatestRuns] = useState({})
  const [sessionIncidents, setSessionIncidents] = useState([])
  const [liveShipments, setLiveShipments] = useState([])
  const [whSystem, setWhSystem] = useState('webfleet')
  const [activeDrivers, setActiveDrivers]           = useState([])
  const [activeDriversLoading, setActiveDriversLoading] = useState(false)
  const [selectedTestVehicle, setSelectedTestVehicle]   = useState(null)
  const [relevantEvents, setRelevantEvents]             = useState(null) // null = show all, array = filtered
  const [whEvent, setWhEvent] = useState('temp_alarm')
  const [whPayload, setWhPayload] = useState(null)
  const [whFiring, setWhFiring] = useState(false)
  const [whLog, setWhLog] = useState([])
  const [whResult, setWhResult] = useState(null)
  const [whLogLoading, setWhLogLoading] = useState(false)
  const [fleet, setFleet] = useState([])
  const [unassigned, setUnassigned] = useState([])
  const [cancellingJob, setCancellingJob] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelConfirm, setCancelConfirm] = useState(null)
  const [reassignTo, setReassignTo] = useState('')
  const [reassignJobRef, setReassignJobRef] = useState(null) // ref being reassigned from unassigned queue

  async function assessCancelAction(approvalId, sentAt) {
    const now = Date.now()
    const sentTime = sentAt ? new Date(sentAt).getTime() : null
    const minutesSinceSent = sentTime ? Math.round((now - sentTime) / 60000) : 0

    let assessment
    if (!sentAt) {
      assessment = { type: 'clean_cancel', risk: 'NONE', message: 'Action not yet sent. Cancel removes it completely — no impact on driver.', approvalId }
    } else if (minutesSinceSent < 8) {
      assessment = { type: 'disregard_cancel', risk: 'LOW', message: `SMS sent ${minutesSinceSent} min ago. Driver may not have seen it. Cancel sends "DISREGARD — continue original route" immediately.`, approvalId, minutesSinceSent }
    } else {
      const estimatedMiles = Math.round(minutesSinceSent * 0.5)
      assessment = {
        type: 'partial_revert', risk: 'HIGH',
        message: `SMS sent ${minutesSinceSent} minutes ago. Driver is likely ~${estimatedMiles} miles into the diversion.`,
        approvalId, minutesSinceSent, estimatedMiles,
        options: [
          { id: 'continue_new_route', label: 'Continue on new route', description: `Driver is already ${estimatedMiles} miles in. Recalculate ETA and update customer. Recommended.`, recommended: estimatedMiles > 3 },
          { id: 'ask_driver_position', label: 'Ask driver for position first', description: 'Send SMS asking driver to confirm their current position before deciding.', recommended: estimatedMiles <= 3 }
        ]
      }
    }
    setCancelAssessment(assessment)
  }

  async function executeCancelAction(approvalId, cancelType) {
    setCancellingId(approvalId)
    try {
      await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_id: approvalId, action: 'reject', cancel_type: cancelType })
      })
      setCancelAssessment(null)
      await loadApprovals()
    } catch {}
    finally { setCancellingId(null) }
  }
  const responseRef = useRef(null)

  useEffect(() => {
    if (responseRef.current) responseRef.current.scrollTop = responseRef.current.scrollHeight
  }, [response])

  useEffect(() => {
    if (!unlocked) return
    loadApprovals()
    loadActiveDrivers()
    loadFleet()
    const i = setInterval(() => { loadApprovals(); loadActiveDrivers(); loadFleet() }, 30000)
    return () => clearInterval(i)
  }, [unlocked])

  useEffect(() => {
    fetch('/api/shipments?client_id=pearson-haulage')
      .then(r => r.json())
      .then(data => { if (data.shipments?.length > 0) setLiveShipments(data.shipments) })
      .catch(() => {})
    fetch('/api/modules/latest?client_id=pearson-haulage', { headers: { 'x-dh-key': process.env.NEXT_PUBLIC_DH_KEY } })
      .then(r => r.json())
      .then(data => { if (data.latest) setLatestRuns(data.latest) })
      .catch(() => {})
    // Pre-load COMMAND tab data on mount
    loadWebhookLog()
    loadActiveDrivers()
    loadFleet()
  }, [])

  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />

  async function loadApprovals() {
    try {
      const res = await fetch('/api/approvals?client_id=pearson-haulage')
      if (!res.ok) return
      const data = await res.json()
      setPendingApprovals(data.approvals || [])
    } catch {}
  }

  async function loadShipments() {
    try {
      const res = await fetch('/api/shipments?client_id=pearson-haulage')
      if (!res.ok) return
      const data = await res.json()
      if (data.shipments?.length > 0) setLiveShipments(data.shipments)
    } catch {}
  }

  const runAnalysis = async (text) => {
    if (!text.trim() || loading) return
    const userMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setResponse('')
    setActiveTab('agent')
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dh-key': process.env.NEXT_PUBLIC_DH_KEY },
        body: JSON.stringify({ messages: newMessages })
      })
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.text) { full += data.text; setResponse(full) }
            } catch {}
          }
        }
      }
      setMessages([...newMessages, { role: 'assistant', content: full }])
      // Extract suggested actions from the response
      const extracted = extractActionsFromResponse(full)
      setAgentActions(extracted)
      setModuleActions([]) // clear module actions when agent runs
      setActionStates({})
      // Log to session incident history in sidebar
      const sevMatch = full.match(/\b(CRITICAL|HIGH|MEDIUM|LOW)\b/)
      const moneyMatch = full.match(/£([\d,]+)/)
      const sev = sevMatch ? sevMatch[1] : 'MEDIUM'
      const saved = moneyMatch ? '£' + moneyMatch[1] : null
      const ref = newMessages[newMessages.length-1]?.content?.match(/(?:REF|PH)-[\w]+/)?.[0] ||
                  newMessages[0]?.content?.match(/(?:REF|PH)-[\w]+/)?.[0] || 'MANUAL'
      const incidentType = newMessages[0]?.content?.split('\n')[0]?.slice(0,35) || 'Analysis'
      setSessionIncidents(prev => [{
        ref, type: incidentType, severity: sev,
        saved, date: 'Just now'
      }, ...prev].slice(0, 8))
      // Save to Supabase incidents table
      try {
        await fetch('/api/incidents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: 'pearson-haulage',
            user_input: newMessages[newMessages.length-1]?.content || '',
            ai_response: full,
            severity: sev,
            financial_impact: moneyMatch ? parseInt(moneyMatch[1].replace(/,/g,'')) : 0,
            ref
          })
        })
      } catch {}
    } catch { setResponse('Connection error. Check your API key.') }
    finally { setLoading(false) }
  }

  async function loadInvoices() {
    try {
      const res = await fetch('/api/invoices?client_id=pearson-haulage')
      if (!res.ok) return
      const data = await res.json()
      setInvoices(data.invoices || [])
    } catch {}
  }

  function parseCsv(text) {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim())
      const obj = {}
      headers.forEach((h, i) => { obj[h] = vals[i] || '' })
      return obj
    }).filter(r => r.carrier || r.invoice_ref)
  }

  function groupCsvToInvoices(rows) {
    const groups = {}
    for (const r of rows) {
      const key = `${r.carrier}|${r.invoice_ref}`
      if (!groups[key]) groups[key] = { carrier: r.carrier, invoice_ref: r.invoice_ref, invoice_date: r.invoice_date || null, line_items: [], source: 'csv_upload' }
      groups[key].line_items.push({ job_ref: r.job_ref || '', description: r.description || '', charged: Number(r.charged) || 0, agreed_rate: Number(r.agreed_rate) || 0, delta: Math.max(0, (Number(r.charged) || 0) - (Number(r.agreed_rate) || 0)) })
    }
    return Object.values(groups)
  }

  const analyseShipment = (s) => {
    setActiveShipment(s.ref)
    runAnalysis(`DISRUPTION ALERT — ${s.ref}\nRoute: ${s.route}\nCarrier: ${s.carrier}\nStatus: ${s.status.toUpperCase()}\nAlert: ${s.alert || 'Manual analysis requested'}\nETA: ${s.eta}\n\nProvide immediate disruption analysis and action plan.`)
  }

  async function runModule(moduleId) {
    setModuleRunning(moduleId)
    setModuleResult(null)
    setActiveModuleName(MODULES.find(m => m.id === moduleId)?.label || moduleId)
    setActiveTab('modules')
    try {
      const res = await fetch('/api/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dh-key': process.env.NEXT_PUBLIC_DH_KEY },
        body: JSON.stringify({ module: moduleId, data: { trigger: 'manual', timestamp: new Date().toISOString() } })
      })
      const data = await res.json()
      setModuleResult(data)
      if (data.actions_queued > 0) loadApprovals()
      // Generate action buttons from module findings
      const extracted = extractActionsFromModuleResult(data.result, moduleId)
      setModuleActions(extracted)
      setAgentActions([]) // clear agent actions when running a module
      setActiveTab('modules')
    } catch (e) {
      setModuleResult({ error: e.message })
    } finally {
      setModuleRunning(null)
    }
  }

  function showDashToast(msg, type='ok') { setDashToast({msg,type}); setTimeout(()=>setDashToast(null),4000) }

  async function handleApproval(approvalId, action) {
    setApprovingId(approvalId)
    try {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_id: approvalId, action, approved_by: 'ops_manager' })
      })
      if (res.status === 409) showDashToast('Action expired — too old to execute', 'error')
      else if (!res.ok) showDashToast('Action failed — check logs', 'error')
      else showDashToast(action === 'approve' ? '✓ Action executed' : '✕ Action rejected')
      await loadApprovals()
    } catch { showDashToast('Network error', 'error') }
    finally { setApprovingId(null) }
  }

  function extractActionsFromResponse(text) {
    const actions = []
    const lines = text.split('\n')

    // Match any numbered action line (1., 2., etc.)
    const actionPatterns = [
      { pattern: /999|emergency.service|ambulance|police/i, type: 'emergency', icon: '🚨', label: 'Call 999 — emergency services' },
      { pattern: /call.{0,60}(driver|carl|james|mark|paul|depot|carrier|ops|manager|controller|haulage|express|freight|yodel|dhl|xpo)/i, type: 'call', icon: '📞' },
      { pattern: /telematics|webfleet|samsara|gps.{0,20}(pull|check|confirm)/i, type: 'call', icon: '📍', label: 'Pull telematics — confirm vehicle position' },
      { pattern: /send.{0,40}(sms|text|message|whatsapp|instruction|alert)/i, type: 'sms', icon: '💬' },
      { pattern: /send|email|notify|notification/i, type: 'email', icon: '✉' },
      { pattern: /dispatch.{0,40}(relief|vehicle|driver|replace)/i, type: 'dispatch', icon: '🚛' },
      { pattern: /relief.{0,20}vehicle|relief.{0,20}driver|dispatch.{0,20}vehicle/i, type: 'dispatch', icon: '🚛' },
      { pattern: /reroute|re-route|divert|alternative.{0,20}route/i, type: 'reroute', icon: '🗺' },
      { pattern: /highways.england|0300|motorway/i, type: 'call', icon: '🛣' },
      { pattern: /contact|speak|inform|update|alert.{0,20}(tesco|nhs|dc|customer|client|consignee)/i, type: 'notify', icon: '📣' },
    ]

    for (const line of lines) {
      // Only process numbered action lines
      const numMatch = line.match(/^(\d+)\.?\s+(.{15,180})/)
      if (!numMatch) continue
      const clean = numMatch[2].replace(/\*\*/g,'').trim()

      for (const { pattern, type, icon, label: forcedLabel } of actionPatterns) {
        if (pattern.test(clean)) {
          const label = forcedLabel || clean.split('—')[0].split('·')[0].split('.')[0].trim().substring(0, 65)
          if (!actions.find(a => a.label === label)) {
            actions.push({ label, type, icon, full: clean })
          }
          break
        }
      }
    }

    // If no numbered matches found, try key phrase scan across all lines
    if (actions.length === 0) {
      for (const line of lines) {
        const clean = line.replace(/^[-—*\d.]+\s*/,'').replace(/\*\*/g,'').trim()
        if (clean.length < 15 || clean.length > 180) continue
        if (/call 999|call.{0,30}(driver|ops|carrier)|dispatch.{0,20}(vehicle|relief)|send.{0,20}(sms|message)/i.test(clean)) {
          const label = clean.split('—')[0].trim().substring(0,65)
          if (!actions.find(a => a.label === label)) {
            const type = /999/.test(clean) ? 'emergency' : /call/.test(clean) ? 'call' : /dispatch/.test(clean) ? 'dispatch' : 'sms'
            const icon = /999/.test(clean) ? '🚨' : /call/.test(clean) ? '📞' : /dispatch/.test(clean) ? '🚛' : '💬'
            actions.push({ label, type, icon, full: clean })
          }
        }
        if (actions.length >= 4) break
      }
    }

    return actions.slice(0, 4).map(a => ({
      ...a,
      id: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
      })
    }))
  }

  function extractActionsFromModuleResult(result, moduleId) {
    if (!result) return []
    const actions = []

    // Invoice — dispute actions with pre-composed email
    if (result.discrepancies?.length > 0) {
      const carrierGroups = {}
      result.discrepancies.forEach(d => {
        if (!carrierGroups[d.carrier]) carrierGroups[d.carrier] = []
        carrierGroups[d.carrier].push(d)
      })
      for (const [carrier, items] of Object.entries(carrierGroups)) {
        const totalDelta = items.reduce((sum, d) => sum + (d.delta || 0), 0)
        const subject = `Invoice Dispute — ${carrier} — £${totalDelta.toLocaleString()} overcharge identified`
        const body = [
          `Dear ${carrier} Accounts Team,`,
          '',
          `We are writing to formally dispute the following invoice${items.length > 1 ? 's' : ''} where charges exceed our contracted rates:`,
          '',
          ...items.flatMap(d => [
            `Invoice: ${d.invoice_ref}`,
            `Issue: ${(d.issue_type || 'overcharge').replace(/_/g, ' ')}`,
            `Amount invoiced: £${(d.charged || 0).toLocaleString()}`,
            `Agreed/expected rate: £${(d.expected || 0).toLocaleString()}`,
            `Overcharge: £${(d.delta || 0).toLocaleString()}`,
            `Evidence: ${d.evidence || 'See attached'}`,
            ''
          ]),
          `Total disputed: £${totalDelta.toLocaleString()}`,
          '',
          'We request a credit note for the full disputed amount within 14 days. If you believe these charges are correct, please provide supporting documentation including the applicable rate card and any agreed surcharge variations.',
          '',
          'Please treat this as a formal dispute under our contract terms.',
          '',
          'Kind regards,',
          'Pearson Haulage Operations',
          'via DisruptionHub'
        ].join('\n')
        const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
        actions.push({ id:`inv-dispute-${carrier.replace(/\s/g,'-')}`, label:`Dispute ${carrier} — recover £${totalDelta.toLocaleString()}`, type:'email', icon:'✉', mailto })
      }
    }
    // SLA — reroute instructions
    if (result.at_risk_deliveries?.length > 0) {
      result.at_risk_deliveries.filter(d=>d.reroute_saves_sla).forEach(d => {
        actions.push({ id:`reroute-${d.ref}`, label:`Reroute ${d.ref} — saves £${(d.penalty_if_breached||0).toLocaleString()} penalty`, type:'sms', icon:'💬' })
      })
    }
    // Driver hours — notify affected drivers
    if (result.drivers_at_risk?.length > 0) {
      result.drivers_at_risk.filter(d=>d.breach_risk).slice(0,2).forEach(d => {
        actions.push({ id:`hours-${d.name}`, label:`Alert ${d.name} — ${d.remaining_hours}h remaining this week`, type:'sms', icon:'💬' })
      })
    }
    // Vehicle health — book service
    if (result.vehicles_at_risk?.length > 0) {
      result.vehicles_at_risk.slice(0,2).forEach(v => {
        actions.push({ id:`vehicle-${v.reg}`, label:`Book service for ${v.reg} — ${v.failure_probability}% breakdown risk`, type:'book', icon:'🔧' })
      })
    }
    // Compliance failures — block dispatch
    if (result.compliance_failures?.length > 0) {
      actions.push({ id:'compliance-block', label:`Block dispatch — ${result.compliance_failures.length} compliance failure${result.compliance_failures.length>1?'s':''}`, type:'block', icon:'🚨' })
    }
    // Licence flags
    if (result.flags?.length > 0) {
      actions.push({ id:'licence-flag', label:`Flag ${result.flags.length} driver${result.flags.length>1?'s':''} — licence issues found`, type:'notify', icon:'📣' })
    }
    // Fuel — send fill instruction
    if (result.vehicles_to_fill?.length > 0) {
      actions.push({ id:'fuel-fill', label:`Send fuel instruction to ${result.vehicles_to_fill.length} driver${result.vehicles_to_fill.length>1?'s':''} — save £${(result.total_saving||0).toFixed(0)}`, type:'sms', icon:'⛽' })
    }
    // Tenders found
    if (result.matching_tenders?.length > 0) {
      actions.push({ id:'tender-brief', label:`Send tender briefing — ${result.matching_tenders.length} match${result.matching_tenders.length>1?'es':''}`, type:'email', icon:'🏆' })
    }

    return actions.slice(0, 4).map(a => ({
      ...a,
      id: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
      })
    }))
  }

  async function fireAction(actionId, actionLabel, actionType, mailto) {
    setActionStates(prev => ({ ...prev, [actionId]: 'firing' }))
    if (mailto) setEmailPickerMailto(mailto)
    await new Promise(r => setTimeout(r, 1200))
    setActionStates(prev => ({ ...prev, [actionId]: 'done' }))

    // Add to local approvals list for demo — shows in APPROVALS tab immediately
    const typeConfig = {
      call:     { ico: '📞', bg: 'rgba(59,130,246,0.07)',   border: 'rgba(59,130,246,0.2)' },
      sms:      { ico: '💬', bg: 'rgba(245,158,11,0.07)',   border: 'rgba(245,158,11,0.22)' },
      email:    { ico: '✉',  bg: 'rgba(245,166,35,0.05)',    border: 'rgba(245,166,35,0.18)' },
      dispatch: { ico: '🚛', bg: 'rgba(168,85,247,0.06)',   border: 'rgba(168,85,247,0.2)' },
      notify:   { ico: '📣', bg: 'rgba(245,166,35,0.05)',    border: 'rgba(245,166,35,0.18)' },
      reroute:  { ico: '🗺', bg: 'rgba(168,85,247,0.06)',   border: 'rgba(168,85,247,0.2)' },
      book:     { ico: '🔧', bg: 'rgba(59,130,246,0.07)',   border: 'rgba(59,130,246,0.2)' },
      block:    { ico: '🚨', bg: 'rgba(239,68,68,0.07)',    border: 'rgba(239,68,68,0.2)' },
      emergency:{ ico: '🚨', bg: 'rgba(239,68,68,0.07)',    border: 'rgba(239,68,68,0.2)' },
    }
    const cfg = typeConfig[actionType] || typeConfig.email
    setLocalApprovals(prev => [{
      id: actionId,
      action_label: actionLabel,
      action_type: actionType,
      status: 'executed',
      ico: cfg.ico,
      bg: cfg.bg,
      border: cfg.border,
      executed_at: new Date().toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'}),
      financial_value: 0
    }, ...prev])

    // Write to Supabase approvals via dedicated endpoint
    try {
      await fetch('/api/approvals/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: actionId,
          client_id: 'pearson-haulage',
          action_type: actionType,
          action_label: actionLabel,
          status: 'executed',
          approved_by: 'ops_manager',
          executed_at: new Date().toISOString()
        })
      })
    } catch {}
  }

  async function runScenario(scenarioId) {
    setScenarioRunning(scenarioId)
    setScenarioResult(null)
    setActiveTab('scenarios')
    try {
      const res = await fetch('/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenarioId, use_demo: true })
      })
      const data = await res.json()
      setScenarioResult(data)
    } catch (e) {
      setScenarioResult({ error: e.message })
    } finally {
      setScenarioRunning(null)
    }
  }

  async function loadWebhookLog() {
    setWhLogLoading(true)
    try {
      const res = await fetch('/api/webhooks/inbound?client_id=pearson-haulage&limit=30', { headers: { 'x-dh-key': process.env.NEXT_PUBLIC_DH_KEY } })
      if (!res.ok) return
      const data = await res.json()
      setWhLog(data.logs || [])
    } catch {}
    finally { setWhLogLoading(false) }
  }

  function getWhPayload() {
    if (whPayload) return whPayload
    return WEBHOOK_SYSTEMS[whSystem]?.events[whEvent]?.fields || {}
  }

  async function loadActiveDrivers() {
    setActiveDriversLoading(true)
    try {
      const res = await fetch('/api/driver/active?client_id=pearson-haulage')
      if (!res.ok) return
      const data = await res.json()
      setActiveDrivers(data.drivers || [])
    } catch {}
    finally { setActiveDriversLoading(false) }
  }

  async function loadFleet() {
    try {
      const res = await fetch('/api/driver/cancel-job?client_id=pearson-haulage')
      if (!res.ok) return
      const data = await res.json()
      setFleet(data.fleet || [])
      setUnassigned(data.unassigned || [])
    } catch {}
  }

  async function reassignUnassigned(ref, toVehicle, reason) {
    setCancellingJob(ref)
    try {
      await fetch('/api/driver/cancel-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: 'pearson-haulage',
          ref,
          reassign_to: toVehicle,
          reassign_only: true,
          reason: reason || 'Assigned by ops',
          approved_by: 'ops_manager'
        })
      })
      setReassignJobRef(null)
      setReassignTo('')
      await loadFleet()
    } catch {}
    finally { setCancellingJob(null) }
  }

  async function cancelJob({ vehicle_reg, ref, cancel_all, hasGoods }) {
    setCancellingJob(ref || vehicle_reg)
    try {
      await fetch('/api/driver/cancel-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: 'pearson-haulage',
          vehicle_reg,
          ref: ref || undefined,
          cancel_all: cancel_all || false,
          reason: cancelReason || (hasGoods ? 'Return goods to depot' : 'Cancelled by ops'),
          has_goods: hasGoods || false,
          reassign_to: reassignTo || undefined,
          approved_by: 'ops_manager'
        })
      })
      setCancelConfirm(null)
      setCancelReason('')
      setReassignTo('')
      await loadFleet()
      await loadApprovals()
    } catch {}
    finally { setCancellingJob(null) }
  }

  function selectTestVehicle(driver) {
    setSelectedTestVehicle(driver)
    setWhResult(null)

    const cargo = (driver.cargo_type || '').toLowerCase()
    const isColdChain  = cargo.includes('chilled') || cargo.includes('frozen') || cargo.includes('reefer')
    const isPharma     = cargo.includes('pharma') || cargo.includes('nhs') || cargo.includes('medical')
    const isStandard   = !isColdChain && !isPharma

    // ── Auto-select best system based on cargo ────────────────────────────────
    // Cold chain / pharma → Webfleet (temp monitoring events are critical)
    // Standard retail     → Mandata TMS (delay and delivery events more relevant)
    let bestSystem = 'mandata'
    let bestEvent  = 'job_delayed'

    if (isColdChain || isPharma) {
      bestSystem = 'webfleet'
      bestEvent  = isColdChain ? 'temp_alarm' : 'reefer_fault'
    }

    setWhSystem(bestSystem)
    setWhEvent(bestEvent)

    // ── Build relevant event list for this cargo type ─────────────────────────
    // Always relevant — any vehicle
    const alwaysRelevant = [
      'panic_button', 'impact_detected', 'engine_fault', 'fuel_critical',
      'job_delayed', 'failed_delivery', 'collection_no_show', 'driver_change',
      'wtd_hours_warning', 'wtd_hours_breach', 'tacho_fault',
      'harsh_braking', 'long_stop'
    ]
    // Cold chain specific
    const coldChainRelevant = [
      'temp_alarm', 'temp_probe_failure', 'reefer_fault',
      'door_open_transit', 'off_route'
    ]
    // Standard only (no cold chain)
    const standardRelevant = [
      'route_deviation', 'multi_drop_change', 'detention_charge',
      'pod_overdue', 'cargo_tamper', 'overweight_load'
    ]

    const relevant = new Set(alwaysRelevant)
    if (isColdChain || isPharma) coldChainRelevant.forEach(e => relevant.add(e))
    if (isStandard) standardRelevant.forEach(e => relevant.add(e))

    setRelevantEvents(relevant)

    // ── Inject vehicle data into the new event's payload ─────────────────────
    // All times calculated from actual current time — no more hardcoded 15:30 SLAs
    const newBase = WEBHOOK_SYSTEMS[bestSystem]?.events[bestEvent]?.fields || {}
    const now = new Date()
    const fmtTime = mins => {
      const d = new Date(now.getTime() + mins * 60000)
      return d.toTimeString().slice(0,5)
    }
    // SLA deadline: 90 min from now (realistic delivery window)
    // Current ETA: 45 min from now (before delay applied)
    // Delay makes ETA slip past SLA
    const slaDeadline  = fmtTime(90)
    const currentEta   = fmtTime(45)
    const delayMinutes = newBase.delay_minutes || 45

    setWhPayload({
      ...newBase,
      vehicle_reg:      driver.vehicle_reg,
      driver_name:      driver.driver_name || newBase.driver_name || '',
      location:         driver.last_known_location || newBase.location || '',
      current_location: driver.last_known_location || newBase.current_location || '',
      consignee:        driver.current_route?.split('→')[1]?.trim() || newBase.consignee || '',
      cargo_type:       driver.cargo_type || newBase.cargo_type || '',
      sla_deadline:     slaDeadline,
      current_eta:      currentEta,
      delay_minutes:    delayMinutes,
      fired_at:         now.toISOString(),
    })
  }

  async function fireWebhook() {
    setWhFiring(true)
    setWhResult(null)
    try {
      const res = await fetch('/api/webhooks/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dh-key': process.env.NEXT_PUBLIC_DH_KEY },
        body: JSON.stringify({
          system: whSystem,
          event_type: whEvent,
          payload: getWhPayload(),
          client_id: 'pearson-haulage'
        })
      })
      const data = await res.json()
      setWhResult(data)
      // Reload log to show new entry
      await loadWebhookLog()
      // If approval created, refresh approvals tab badge
      if (data.severity === 'CRITICAL' || data.severity === 'HIGH') loadApprovals()
    } catch (e) {
      setWhResult({ error: e.message })
    } finally {
      setWhFiring(false)
    }
  }

  async function resetTestRun() {
    // Clears all approvals + resets driver_progress for active test vehicle
    // so a fresh webhook fire works cleanly without logging out of driver app
    try {
      // Clear all approvals for this client
      await fetch('/api/approvals/reset?client_id=pearson-haulage', { method: 'POST' })
      // Reload dashboard state
      await Promise.all([loadApprovals(), loadWebhookLog(), loadActiveDrivers()])
      setWhResult(null)
      setLocalApprovals([])
    } catch (e) {
      console.error('Reset failed:', e.message)
    }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', fontFamily:'Barlow, sans-serif', background:'#080c14', color:'#e8eaed' }}>
      {dashToast && <div style={{position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',padding:'10px 20px',borderRadius:8,background:dashToast.type==='error'?'rgba(239,68,68,0.95)':'rgba(245,166,35,0.95)',color:'#fff',fontSize:13,fontWeight:600,zIndex:9999,boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>{dashToast.msg}</div>}
      {emailPickerMailto && (() => {
        const subjectMatch = emailPickerMailto.match(/subject=([^&]*)/)
        const bodyMatch = emailPickerMailto.match(/body=(.*)$/)
        const subject = subjectMatch ? decodeURIComponent(subjectMatch[1]) : ''
        const body = bodyMatch ? decodeURIComponent(bodyMatch[1]) : ''
        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',padding:24}} onClick={()=>setEmailPickerMailto(null)}>
            <div style={{width:'100%',maxWidth:380,background:'#0f1826',borderRadius:14,padding:24,border:'1px solid rgba(245,166,35,0.2)',boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:16,fontWeight:700,color:'#e8eaed',marginBottom:4}}>Send dispute email</div>
              <div style={{fontSize:12,color:'#4a5260',marginBottom:18}}>{subject}</div>
              <button onClick={()=>{window.open(`https://mail.google.com/mail/?view=cm&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,'_blank');setEmailPickerMailto(null)}}
                style={{width:'100%',padding:13,background:'rgba(245,166,35,0.08)',border:'1px solid rgba(245,166,35,0.25)',borderRadius:10,color:'#f5a623',fontSize:14,fontWeight:600,cursor:'pointer',marginBottom:8,textAlign:'left'}}>
                📧 Open in Gmail
              </button>
              <button onClick={()=>{window.location.href=emailPickerMailto;setEmailPickerMailto(null)}}
                style={{width:'100%',padding:13,background:'rgba(245,166,35,0.08)',border:'1px solid rgba(245,166,35,0.25)',borderRadius:10,color:'#f5a623',fontSize:14,fontWeight:600,cursor:'pointer',marginBottom:8,textAlign:'left'}}>
                ✉ Open in Apple Mail
              </button>
              <button onClick={async()=>{try{await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);showDashToast('Copied to clipboard')}catch{showDashToast('Copy failed','error')};setEmailPickerMailto(null)}}
                style={{width:'100%',padding:13,background:'rgba(245,166,35,0.08)',border:'1px solid rgba(245,166,35,0.25)',borderRadius:10,color:'#f5a623',fontSize:14,fontWeight:600,cursor:'pointer',marginBottom:8,textAlign:'left'}}>
                📋 Copy to clipboard
              </button>
              <button onClick={()=>setEmailPickerMailto(null)} style={{width:'100%',padding:10,background:'transparent',border:'none',color:'#4a5260',fontSize:12,cursor:'pointer',marginTop:4}}>Cancel</button>
            </div>
          </div>
        )
      })()}
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes spin{to{transform:rotate(360deg)}}
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { overscroll-behavior: none; }
        .dh-layout { display: grid; grid-template-columns: 290px 1fr; flex: 1; min-height: 0; }
        .dh-sidebar { border-right: 1px solid rgba(255,255,255,0.06); background: #0d1420; overflow-y: auto; display: flex; flex-direction: column; }
        .dh-main { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
        .dh-tabs { display: flex; gap: 6px; padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); background: #080c14; flex-shrink: 0; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .dh-tabs::-webkit-scrollbar { display: none; }
        .dh-nav { display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(10,12,14,0.98); position: sticky; top: 0; z-index: 100; }
        .dh-nav-right { display: flex; align-items: center; gap: 16px; }
        .dh-client-name { font-size: 11px; color: #4a5260; }
        @media (max-width: 768px) {
          .dh-layout { grid-template-columns: 1fr; overflow-y: auto; -webkit-overflow-scrolling: touch; }
          .dh-sidebar { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06); overflow-y: visible; max-height: none; }
          .dh-main { min-height: 80vh; overflow: visible; }
          .dh-nav { padding: 10px 14px; }
          .dh-nav-right { gap: 8px; }
          .dh-client-name { display: none; }
          .dh-tabs { padding: 8px 10px; gap: 4px; }
          /* COMMAND tab — stack panels vertically on mobile */
          .dh-command { flex-direction: column !important; overflow-y: auto !important; overflow-x: hidden !important; }
          .dh-cmd-left { width: 100% !important; max-width: 100% !important; border-right: none !important; border-bottom: 2px solid rgba(255,255,255,0.06) !important; overflow: visible !important; flex-shrink: 0 !important; }
          .dh-cmd-left .dh-fleet-inner { max-height: 280px; overflow-y: auto; }
          .dh-cmd-centre { flex: none !important; width: 100% !important; border-right: none !important; border-bottom: 2px solid rgba(255,255,255,0.06) !important; overflow: visible !important; min-height: 300px; }
          .dh-cmd-right { width: 100% !important; max-height: none !important; overflow: visible !important; }
        }
      `}</style>

      {/* NAV */}
      <nav className="dh-nav">
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <Link href="/" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none' }}>
            <div style={{ width:24, height:24, background:'#f5a623', clipPath:'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', flexShrink:0 }} />
            <span style={{ fontFamily:'monospace', fontSize:12, color:'#8a9099' }}>DisruptionHub</span>
          </Link>
          <span style={{ color:'rgba(255,255,255,0.1)' }}>|</span>
          <span style={{ fontSize:12, color:'#e8eaed', fontWeight:500 }}>Operations Dashboard</span>
        </div>
        <div className="dh-nav-right">
          {(pendingApprovals.length > 0 || localApprovals.length > 0) && (() => {
            const pendingCount = pendingApprovals.filter(a => a.status === 'pending').length
            const totalCount = pendingApprovals.length + localApprovals.length
            const hasPending = pendingCount > 0
            return (
              <button onClick={() => setActiveTab('approvals')} style={{ display:'flex', alignItems:'center', gap:6, background: hasPending ? 'rgba(239,68,68,0.1)' : 'rgba(245,166,35,0.08)', border: hasPending ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(245,166,35,0.2)', borderRadius:6, padding:'5px 10px', cursor:'pointer' }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background: hasPending ? '#ef4444' : '#f5a623', animation: hasPending ? 'pulse 2s infinite' : 'none' }} />
                <span style={{ fontSize:11, color: hasPending ? '#ef4444' : '#f5a623', fontFamily:'monospace' }}>
                  {hasPending ? `${pendingCount} AWAITING APPROVAL` : `${totalCount} ACTIONS LOGGED`}
                </span>
              </button>
            )
          })()}
          <span className="dh-client-name">Pearson Haulage</span>
        </div>
      </nav>

      <div className="dh-layout">

        {/* ── LEFT SIDEBAR ──────────────────────────────────────────────────── */}
        <div className="dh-sidebar">

          {/* Metrics */}
          <div style={{ padding:'14px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize:9, fontFamily:'monospace', color:'#4a5260', letterSpacing:'0.08em', marginBottom:8 }}>TODAY — {new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}).toUpperCase()}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {[{l:'Active shipments',v:'4'},{l:'Alerts',v:'1',vc:'#ef4444'},{l:'On time',v:'75%'},{l:'Saved today',v:'£7.4K',vc:'#f5a623'}].map(m=>(
                <div key={m.l} style={{ background:'#0f1826', borderRadius:6, padding:'10px 10px' }}>
                  <div style={{ fontSize:9, color:'#4a5260', marginBottom:3 }}>{m.l}</div>
                  <div style={{ fontSize:18, fontWeight:500, fontFamily:'monospace', color:m.vc||'#e8eaed' }}>{m.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Shipments */}
          <div style={{ padding:'14px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize:9, fontFamily:'monospace', color:'#4a5260', letterSpacing:'0.08em', marginBottom:8 }}>ACTIVE SHIPMENTS</div>
            {(liveShipments.length > 0 ? liveShipments : ACTIVE_SHIPMENTS).map(s => (
              <div key={s.ref} onClick={() => analyseShipment(s)} style={{ padding:'9px 10px', borderRadius:6, marginBottom:5, cursor:'pointer', border:activeShipment===s.ref?'1px solid #f5a623':'1px solid rgba(255,255,255,0.05)', background:s.status==='disrupted'?'rgba(239,68,68,0.07)':s.status==='delayed'?'rgba(245,158,11,0.05)':'#0f1826', transition:'all 0.15s' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                  <span style={{ fontFamily:'monospace', fontSize:11, color:'#e8eaed', fontWeight:500 }}>{s.ref}</span>
                  <span style={{ fontFamily:'monospace', fontSize:9, color:STATUS_COLORS[s.status], textTransform:'uppercase' }}>{s.status}</span>
                </div>
                <div style={{ fontSize:10, color:'#8a9099', marginBottom:2 }}>{s.route}</div>
                <div style={{ fontSize:9, color:'#4a5260' }}>{s.carrier} · ETA {s.eta}</div>
                {s.alert && <div style={{ marginTop:5, fontSize:9, color:'#f59e0b', background:'rgba(245,158,11,0.08)', padding:'3px 6px', borderRadius:3 }}>⚠ {s.alert}</div>}
              </div>
            ))}
          </div>

          {/* Recent Incidents */}
          <div style={{ padding:'14px' }}>
            <div style={{ fontSize:9, fontFamily:'monospace', color:'#4a5260', letterSpacing:'0.08em', marginBottom:8 }}>RECENT INCIDENTS</div>
            {[...sessionIncidents, ...INCIDENT_LOG].slice(0,8).map((inc,i) => (
              <div key={i} style={{ padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.03)', display:'grid', gridTemplateColumns:'1fr auto' }}>
                <div>
                  <div style={{ fontSize:10, color: i===0&&sessionIncidents.length>0?'#f5a623':'#e8eaed', fontFamily:'monospace' }}>{inc.ref} — {inc.type.substring(0,22)}</div>
                  <div style={{ fontSize:9, color:'#4a5260', marginTop:1 }}>{inc.date}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:9, color:SEV_COLORS[inc.severity], fontFamily:'monospace', padding:'1px 5px', borderRadius:2, background:SEV_BG[inc.severity], display:'inline-block' }}>{inc.severity}</div>
                  {inc.saved && <div style={{ fontSize:9, color:'#f5a623', marginTop:3 }}>{inc.saved}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT PANEL ───────────────────────────────────────────────────── */}
        <div style={{ display:'flex', flexDirection:'column', background:'#080c14', overflow:'hidden' }}>

          {/* Tab bar */}
          <div style={{ padding:'10px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:8 }}>
            <button style={{ ...TAB_STYLE(activeTab==='approvals'), ...((pendingApprovals.length>0||fleet.length>0)?{borderColor:'rgba(239,68,68,0.4)',color:'#ef4444',background:'rgba(239,68,68,0.08)'}:{}) }} onClick={() => { setActiveTab('approvals'); loadApprovals(); loadFleet(); loadActiveDrivers(); loadWebhookLog() }}>
              COMMAND {pendingApprovals.length > 0 ? `(${pendingApprovals.length})` : ''}
            </button>
            <button style={TAB_STYLE(activeTab==='agent')} onClick={() => setActiveTab('agent')}>AGENT</button>
            <button style={TAB_STYLE(activeTab==='modules')} onClick={() => setActiveTab('modules')}>INTELLIGENCE</button>
            <button style={TAB_STYLE(activeTab==='invoices')} onClick={() => { setActiveTab('invoices'); loadInvoices() }}>INVOICES</button>
            <button style={TAB_STYLE(activeTab==='scenarios')} onClick={() => setActiveTab('scenarios')}>SCENARIOS</button>
            <button style={TAB_STYLE(activeTab==='integrations')} onClick={() => { setActiveTab('integrations'); loadWebhookLog(); loadActiveDrivers() }}>SETUP</button>
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background: loading ? '#f59e0b' : '#f5a623', animation: loading ? 'pulse 1s infinite' : 'none' }} />
              <span style={{ fontFamily:'monospace', fontSize:10, color:'#4a5260' }}>{loading ? 'ANALYSING...' : 'AGENT READY'}</span>
              {messages.length > 0 && (
                <button onClick={() => { setMessages([]); setResponse(''); setActiveShipment(null); setAgentActions([]); setModuleActions([]); setActionStates({}) }} style={{ fontSize:10, color:'#4a5260', background:'none', border:'1px solid rgba(255,255,255,0.06)', borderRadius:4, padding:'3px 8px', cursor:'pointer', fontFamily:'monospace', marginLeft:4 }}>CLEAR ×</button>
              )}
            </div>
          </div>

          {/* ── AGENT TAB ──────────────────────────────────────────────────── */}
          {activeTab === 'agent' && (
            <>
              <div style={{ flex:1, overflowY:'auto', padding:'20px' }} ref={responseRef}>
                {!response && !loading && (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:14, opacity:0.3 }}>
                    <div style={{ fontFamily:'monospace', fontSize:32, color:'#4a5260' }}>◈</div>
                    <div style={{ fontSize:12, color:'#4a5260', textAlign:'center', maxWidth:280, lineHeight:1.7 }}>Click a shipment alert to trigger analysis, or type a disruption below</div>
                  </div>
                )}
                {loading && !response && (
                  <div style={{ display:'flex', gap:5, padding:'4px 0' }}>
                    {[0,1,2].map(i => <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:'#f5a623', animation:`pulse 1.2s ${i*0.2}s infinite` }} />)}
                  </div>
                )}
                {response && <AgentResponse text={response} />}
                {messages.length >= 2 && (
                  <div style={{ marginTop:12, fontSize:10, color:'#4a5260', fontFamily:'monospace' }}>
                    // Ask a follow-up — "draft the client email", "cheapest option that hits SLA", "what's our liability here"
                  </div>
                )}

                {/* ── SUGGESTED ACTIONS ── */}
                {agentActions.length > 0 && !loading && (
                  <div style={{ marginTop:16, padding:'12px 14px', background:'#0d1420', borderRadius:8, border:'1px solid rgba(245,166,35,0.12)' }}>
                    <div style={{ fontSize:10, fontFamily:'monospace', color:'#f5a623', letterSpacing:'0.08em', marginBottom:10 }}>SUGGESTED ACTIONS — click to execute</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {agentActions.map(action => {
                        const state = actionStates[action.id]
                        const isDone = state === 'done'
                        const isFiring = state === 'firing'
                        return (
                          <div key={action.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background: isDone ? 'rgba(245,166,35,0.06)' : '#0f1826', borderRadius:6, border: isDone ? '1px solid rgba(245,166,35,0.2)' : '1px solid rgba(255,255,255,0.06)', transition:'all 0.3s' }}>
                            <span style={{ fontSize:14, flexShrink:0 }}>{action.icon}</span>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:11, color: isDone ? '#f5a623' : '#e8eaed', lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                {action.label}
                              </div>
                              <div style={{ fontSize:9, color:'#4a5260', fontFamily:'monospace', marginTop:1 }}>{action.type.toUpperCase()}</div>
                            </div>
                            {isDone ? (
                              <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                                <div style={{ width:6, height:6, borderRadius:'50%', background:'#f5a623' }} />
                                <span style={{ fontSize:10, color:'#f5a623', fontFamily:'monospace' }}>SENT</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => fireAction(action.id, action.label, action.type, action.mailto)}
                                disabled={isFiring}
                                style={{ padding:'5px 12px', background: isFiring ? 'transparent' : '#f5a623', color: isFiring ? '#f5a623' : '#000', border: isFiring ? '1px solid rgba(245,166,35,0.3)' : 'none', borderRadius:5, fontSize:10, fontWeight:600, cursor: isFiring ? 'default' : 'pointer', fontFamily:'monospace', flexShrink:0, minWidth:60, transition:'all 0.2s' }}>
                                {isFiring ? '...' : 'FIRE →'}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {Object.values(actionStates).some(s => s === 'done') && (
                      <div style={{ marginTop:8, fontSize:10, color:'#4a5260', fontFamily:'monospace' }}>
                        Executed actions logged · <span style={{ color:'#f5a623', cursor:'pointer' }} onClick={() => setActiveTab('approvals')}>View in approvals →</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'12px 20px', background:'#0d1420' }}>
                <div style={{ display:'flex', gap:8 }}>
                  <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if(e.key==='Enter') runAnalysis(input) }} placeholder="Type a disruption or follow-up question..."
                    style={{ flex:1, background:'#0f1826', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, padding:'10px 13px', color:'#e8eaed', fontFamily:'Barlow', fontSize:12, outline:'none' }} />
                  <button onClick={() => runAnalysis(input)} disabled={!input.trim()||loading}
                    style={{ background:loading?'#0f1826':'#f5a623', color:'#000', border:'none', padding:'10px 18px', borderRadius:6, fontWeight:600, fontSize:12, cursor:loading?'default':'pointer', whiteSpace:'nowrap' }}>
                    {loading ? '...' : 'Analyse →'}
                  </button>
                </div>
                <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
                  {['Draft client email','Cheapest reroute','What\'s our liability?','Reorder recommendations'].map(q => (
                    <button key={q} onClick={() => { setInput(q); runAnalysis(q) }}
                      style={{ fontSize:10, color:'#4a5260', background:'none', border:'1px solid rgba(255,255,255,0.06)', borderRadius:4, padding:'3px 8px', cursor:'pointer', fontFamily:'Barlow' }}>{q}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── MODULES TAB ────────────────────────────────────────────────── */}
          {activeTab === 'modules' && (
            <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>
              <div style={{ fontSize:10, color:'#4a5260', fontFamily:'monospace', marginBottom:6 }}>// INTELLIGENCE MODULES — auto-scan runs at 05:00 daily · click any to run now</div>
              <div style={{ display:'flex', gap:12, marginBottom:14, flexWrap:'wrap' }}>
                {Object.values(latestRuns).some(r=>r.has_issues) && (
                  <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'#ef4444', fontFamily:'monospace' }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:'#ef4444' }}/> {Object.values(latestRuns).filter(r=>r.has_issues).length} module{Object.values(latestRuns).filter(r=>r.has_issues).length!==1?'s require':' requires'} attention
                  </div>
                )}
                {Object.values(latestRuns).length > 0 && (
                  <div style={{ fontSize:10, color:'#4a5260', fontFamily:'monospace' }}>
                    Last scan: {(() => { const latest = Object.values(latestRuns).sort((a,b)=>new Date(b.ran_at)-new Date(a.ran_at))[0]; if(!latest?.ran_at) return 'never'; const mins = Math.floor((Date.now()-new Date(latest.ran_at))/60000); return mins<60?`${mins}m ago`:mins<1440?`${Math.floor(mins/60)}h ago`:`${Math.floor(mins/1440)}d ago` })()}
                  </div>
                )}
                {Object.values(latestRuns).length === 0 && (
                  <div style={{ fontSize:10, color:'#4a5260', fontFamily:'monospace' }}>No auto-scans run yet — enable cron or click a module to run manually</div>
                )}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:8, marginBottom:20 }}>
                {MODULES.map(m => {
                  const c = CAT_COLORS[m.cat]
                  const isRunning = moduleRunning === m.id
                  const lastRun = latestRuns[m.id]
                  const hasIssue = lastRun?.has_issues
                  const isClear = lastRun && !hasIssue
                  const ranAt = lastRun?.ran_at ? new Date(lastRun.ran_at) : null
                  const ranAgo = ranAt ? (() => {
                    const mins = Math.floor((Date.now() - ranAt) / 60000)
                    if (mins < 60) return `${mins}m ago`
                    const hrs = Math.floor(mins / 60)
                    if (hrs < 24) return `${hrs}h ago`
                    return `${Math.floor(hrs/24)}d ago`
                  })() : null
                  // Border and bg override if issues found
                  const borderColor = hasIssue ? 'rgba(239,68,68,0.4)' : isClear ? 'rgba(245,166,35,0.25)' : c.border
                  const bgColor = hasIssue ? 'rgba(239,68,68,0.06)' : isClear ? 'rgba(245,166,35,0.04)' : c.bg
                  return (
                    <button key={m.id} onClick={() => runModule(m.id)} disabled={!!moduleRunning}
                      style={{ textAlign:'left', padding:'12px 13px', borderRadius:7, border:`1px solid ${borderColor}`, background:bgColor, cursor:moduleRunning?'default':'pointer', transition:'all 0.15s', opacity:moduleRunning&&moduleRunning!==m.id?0.4:1, position:'relative' }}>
                      {hasIssue && <div style={{ position:'absolute', top:7, right:9, width:7, height:7, borderRadius:'50%', background:'#ef4444' }} />}
                      {isClear && <div style={{ position:'absolute', top:7, right:9, width:7, height:7, borderRadius:'50%', background:'#f5a623' }} />}
                      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
                        <span style={{ fontSize:15 }}>{m.icon}</span>
                        <span style={{ fontSize:11, fontWeight:500, color:'#e8eaed', lineHeight:1.3 }}>{m.label}</span>
                      </div>
                      <div style={{ fontSize:9, fontFamily:'monospace', letterSpacing:'0.04em', color: isRunning?'#f5a623':hasIssue?'#ef4444':isClear?'#f5a623':c.text }}>
                        {isRunning ? '● RUNNING...' : hasIssue ? '● ACTION REQUIRED' : isClear ? `✓ CLEAR · ${ranAgo}` : m.cat.toUpperCase()}
                      </div>
                      {hasIssue && lastRun.financial_impact > 0 && (
                        <div style={{ fontSize:9, color:'#ef4444', fontFamily:'monospace', marginTop:3 }}>£{Number(lastRun.financial_impact).toLocaleString()}</div>
                      )}
                    </button>
                  )
                })}
              </div>

              {moduleRunning && (
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px', background:'#0f1826', borderRadius:8, border:'1px solid rgba(245,166,35,0.15)' }}>
                  <div style={{ width:16, height:16, border:'2px solid #f5a623', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', flexShrink:0 }} />
                  <span style={{ fontFamily:'monospace', fontSize:11, color:'#f5a623' }}>Running {MODULES.find(m=>m.id===moduleRunning)?.label}...</span>
                </div>
              )}

              {/* Module action buttons */}
              {moduleActions.length > 0 && !moduleRunning && (
                <div style={{ marginTop:16, padding:'12px 14px', background:'#0d1420', borderRadius:8, border:'1px solid rgba(245,166,35,0.12)' }}>
                  <div style={{ fontSize:10, fontFamily:'monospace', color:'#f5a623', letterSpacing:'0.08em', marginBottom:10 }}>SUGGESTED ACTIONS — click to execute</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {moduleActions.map(action => {
                      const state = actionStates[action.id]
                      const isDone = state === 'done'
                      const isFiring = state === 'firing'
                      return (
                        <div key={action.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background: isDone ? 'rgba(245,166,35,0.06)' : '#0f1826', borderRadius:6, border: isDone ? '1px solid rgba(245,166,35,0.2)' : '1px solid rgba(255,255,255,0.06)', transition:'all 0.3s' }}>
                          <span style={{ fontSize:14, flexShrink:0 }}>{action.icon}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:11, color: isDone ? '#f5a623' : '#e8eaed', lineHeight:1.4 }}>{action.label}</div>
                            <div style={{ fontSize:9, color:'#4a5260', fontFamily:'monospace', marginTop:1 }}>{action.type.toUpperCase()}</div>
                          </div>
                          {isDone ? (
                            <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                              <div style={{ width:6, height:6, borderRadius:'50%', background:'#f5a623' }} />
                              <span style={{ fontSize:10, color:'#f5a623', fontFamily:'monospace' }}>SENT</span>
                            </div>
                          ) : (
                            <button onClick={() => fireAction(action.id, action.label, action.type, action.mailto)} disabled={isFiring}
                              style={{ padding:'5px 12px', background: isFiring ? 'transparent' : '#f5a623', color: isFiring ? '#f5a623' : '#000', border: isFiring ? '1px solid rgba(245,166,35,0.3)' : 'none', borderRadius:5, fontSize:10, fontWeight:600, cursor: isFiring ? 'default' : 'pointer', fontFamily:'monospace', flexShrink:0, minWidth:60, transition:'all 0.2s' }}>
                              {isFiring ? '...' : 'FIRE →'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {moduleResult && !moduleRunning && (
                moduleResult.error
                  ? <div style={{ padding:'12px 14px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, fontFamily:'monospace', fontSize:11, color:'#ef4444' }}>Error: {moduleResult.error}</div>
                  : <ModuleResult result={moduleResult} moduleName={activeModuleName} />
              )}
            </div>
          )}

          {/* ── INVOICES TAB ──────────────────────────────────────────────── */}
          {activeTab === 'invoices' && (
            <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>
              {/* Section A — CSV Upload */}
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:10, color:'#4a5260', fontFamily:'monospace', letterSpacing:'0.08em', marginBottom:10 }}>UPLOAD CSV</div>
                <div style={{ padding:20, border:csvDragActive?'2px solid #f5a623':'2px dashed rgba(245,166,35,0.2)', borderRadius:12, textAlign:'center', cursor:'pointer', background:csvDragActive?'rgba(245,166,35,0.08)':'rgba(245,166,35,0.02)', transition:'all 0.15s' }}
                  onClick={() => document.getElementById('csv-upload')?.click()}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                  onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setCsvDragActive(true) }}
                  onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setCsvDragActive(false) }}
                  onDrop={e => { e.preventDefault(); e.stopPropagation(); setCsvDragActive(false); const f=e.dataTransfer?.files?.[0]; console.log('CSV DROP:', f?.name, f?.size, f?.type); if(f) { const r=new FileReader(); r.onload=ev=>{const parsed=parseCsv(ev.target.result);console.log('CSV PARSED:',parsed.length,'rows',parsed.slice(0,2));setCsvRows(parsed)}; r.readAsText(f) } }}>
                  <input id="csv-upload" type="file" accept=".csv,.txt,text/csv,text/plain" style={{ display:'none' }} onChange={e => { const f=e.target.files?.[0]; console.log('CSV SELECT:', f?.name, f?.size, f?.type); if(f) { const r=new FileReader(); r.onload=ev=>{const parsed=parseCsv(ev.target.result);console.log('CSV PARSED:',parsed.length,'rows',parsed.slice(0,2));setCsvRows(parsed)}; r.readAsText(f) } }} />
                  <div style={{ fontSize:13, color:'#8a9099' }}>Drop a CSV here or click to browse</div>
                  <div style={{ fontSize:10, color:'#4a5260', marginTop:4 }}>Columns: carrier, invoice_ref, invoice_date, job_ref, description, charged, agreed_rate</div>
                </div>
                {csvRows && csvRows.length > 0 && (
                  <div style={{ marginTop:12 }}>
                    <div style={{ fontSize:11, color:'#f5a623', marginBottom:6 }}>{csvRows.length} rows parsed — {groupCsvToInvoices(csvRows).length} invoices</div>
                    <div style={{ maxHeight:200, overflowY:'auto', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8 }}>
                      <table style={{ width:'100%', fontSize:10, color:'#8a9099', borderCollapse:'collapse' }}>
                        <thead><tr style={{ background:'rgba(245,166,35,0.05)' }}>
                          {['Carrier','Ref','Job','Charged','Agreed','Delta'].map(h => <th key={h} style={{ padding:'6px 8px', textAlign:'left', color:'#4a5260', fontWeight:600 }}>{h}</th>)}
                        </tr></thead>
                        <tbody>{csvRows.slice(0,20).map((r,i) => (
                          <tr key={i} style={{ borderTop:'1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding:'5px 8px' }}>{r.carrier}</td>
                            <td style={{ padding:'5px 8px', fontFamily:'monospace' }}>{r.invoice_ref}</td>
                            <td style={{ padding:'5px 8px' }}>{r.job_ref}</td>
                            <td style={{ padding:'5px 8px' }}>£{r.charged}</td>
                            <td style={{ padding:'5px 8px' }}>£{r.agreed_rate}</td>
                            <td style={{ padding:'5px 8px', color: Number(r.charged)>Number(r.agreed_rate)?'#ef4444':'#8a9099' }}>£{Math.max(0,Number(r.charged)-Number(r.agreed_rate)).toFixed(2)}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                      {csvRows.length > 20 && <div style={{ padding:6, fontSize:10, color:'#4a5260', textAlign:'center' }}>+ {csvRows.length - 20} more rows</div>}
                    </div>
                    <div style={{ display:'flex', gap:8, marginTop:10 }}>
                      <button onClick={async () => {
                        const grouped = groupCsvToInvoices(csvRows)
                        try {
                          const res = await fetch('/api/invoices', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ client_id:'pearson-haulage', invoices:grouped }) })
                          const data = await res.json()
                          if (data.success) { showDashToast(`${data.inserted} invoices uploaded`); setCsvRows(null); loadInvoices() }
                          else showDashToast(data.error || 'Upload failed', 'error')
                        } catch { showDashToast('Upload failed', 'error') }
                      }} style={{ padding:'8px 16px', background:'#f5a623', border:'none', borderRadius:7, color:'#000', fontWeight:600, fontSize:12, cursor:'pointer' }}>Submit {groupCsvToInvoices(csvRows).length} invoices</button>
                      <button onClick={() => setCsvRows(null)} style={{ padding:'8px 16px', background:'transparent', border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, color:'#4a5260', fontSize:12, cursor:'pointer' }}>Clear</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Section B — Manual Entry */}
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:10, color:'#4a5260', fontFamily:'monospace', letterSpacing:'0.08em', marginBottom:10 }}>MANUAL ENTRY</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
                  <input value={manualInv.carrier} onChange={e=>setManualInv(p=>({...p,carrier:e.target.value}))} placeholder="Carrier name" style={{ padding:10, background:'#0f1826', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'#e8eaed', fontSize:13, outline:'none' }} />
                  <input value={manualInv.invoice_ref} onChange={e=>setManualInv(p=>({...p,invoice_ref:e.target.value}))} placeholder="Invoice ref" style={{ padding:10, background:'#0f1826', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'#e8eaed', fontSize:13, outline:'none', fontFamily:'monospace' }} />
                  <input type="date" value={manualInv.invoice_date} onChange={e=>setManualInv(p=>({...p,invoice_date:e.target.value}))} style={{ padding:10, background:'#0f1826', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'#e8eaed', fontSize:13, outline:'none' }} />
                </div>
                <div style={{ fontSize:10, color:'#4a5260', marginBottom:6 }}>LINE ITEMS</div>
                {manualInv.line_items.map((li, i) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 2fr 1fr 1fr auto', gap:6, marginBottom:6 }}>
                    <input value={li.job_ref} onChange={e=>{const u=[...manualInv.line_items];u[i]={...u[i],job_ref:e.target.value};setManualInv(p=>({...p,line_items:u}))}} placeholder="Job ref" style={{ padding:8, background:'#0f1826', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, color:'#e8eaed', fontSize:11, outline:'none', fontFamily:'monospace' }} />
                    <input value={li.description} onChange={e=>{const u=[...manualInv.line_items];u[i]={...u[i],description:e.target.value};setManualInv(p=>({...p,line_items:u}))}} placeholder="Description" style={{ padding:8, background:'#0f1826', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, color:'#e8eaed', fontSize:11, outline:'none' }} />
                    <input value={li.charged} onChange={e=>{const u=[...manualInv.line_items];u[i]={...u[i],charged:e.target.value};setManualInv(p=>({...p,line_items:u}))}} placeholder="£ charged" inputMode="decimal" style={{ padding:8, background:'#0f1826', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, color:'#e8eaed', fontSize:11, outline:'none', fontFamily:'monospace' }} />
                    <input value={li.agreed_rate} onChange={e=>{const u=[...manualInv.line_items];u[i]={...u[i],agreed_rate:e.target.value};setManualInv(p=>({...p,line_items:u}))}} placeholder="£ agreed" inputMode="decimal" style={{ padding:8, background:'#0f1826', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, color:'#e8eaed', fontSize:11, outline:'none', fontFamily:'monospace' }} />
                    <button onClick={()=>{const u=manualInv.line_items.filter((_,j)=>j!==i);setManualInv(p=>({...p,line_items:u.length?u:[{job_ref:'',description:'',charged:'',agreed_rate:''}]}))}} style={{ padding:'4px 8px', background:'transparent', border:'1px solid rgba(239,68,68,0.2)', borderRadius:4, color:'#ef4444', fontSize:10, cursor:'pointer' }}>✕</button>
                  </div>
                ))}
                <div style={{ display:'flex', gap:8, marginTop:8 }}>
                  <button onClick={()=>setManualInv(p=>({...p,line_items:[...p.line_items,{job_ref:'',description:'',charged:'',agreed_rate:''}]}))} style={{ padding:'6px 12px', background:'transparent', border:'1px solid rgba(245,166,35,0.2)', borderRadius:6, color:'#f5a623', fontSize:11, cursor:'pointer' }}>+ Add line</button>
                  <button onClick={async () => {
                    if (!manualInv.carrier || !manualInv.invoice_ref) { showDashToast('Carrier and invoice ref required', 'error'); return }
                    const items = manualInv.line_items.map(li => ({ ...li, charged: Number(li.charged) || 0, agreed_rate: Number(li.agreed_rate) || 0, delta: Math.max(0, (Number(li.charged)||0) - (Number(li.agreed_rate)||0)) }))
                    try {
                      const res = await fetch('/api/invoices', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ client_id:'pearson-haulage', carrier:manualInv.carrier, invoice_ref:manualInv.invoice_ref, invoice_date:manualInv.invoice_date||null, line_items:items, source:'manual' }) })
                      const data = await res.json()
                      if (data.success) { showDashToast('Invoice added'); setManualInv({ carrier:'', invoice_ref:'', invoice_date:'', line_items:[{job_ref:'',description:'',charged:'',agreed_rate:''}] }); loadInvoices() }
                      else showDashToast(data.error || 'Failed', 'error')
                    } catch { showDashToast('Failed', 'error') }
                  }} style={{ padding:'6px 16px', background:'#f5a623', border:'none', borderRadius:6, color:'#000', fontWeight:600, fontSize:11, cursor:'pointer' }}>Submit invoice</button>
                </div>
                {manualInv.line_items.some(li => Number(li.charged) > Number(li.agreed_rate)) && (
                  <div style={{ marginTop:8, fontSize:11, color:'#ef4444' }}>
                    Total overcharge: £{manualInv.line_items.reduce((s,li) => s + Math.max(0, (Number(li.charged)||0) - (Number(li.agreed_rate)||0)), 0).toFixed(2)}
                  </div>
                )}
              </div>

              {/* Section C — Invoice List */}
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <div style={{ fontSize:10, color:'#4a5260', fontFamily:'monospace', letterSpacing:'0.08em' }}>ALL INVOICES ({invoices.length})</div>
                  <button onClick={loadInvoices} style={{ background:'none', border:'none', color:'#4a5260', fontSize:11, cursor:'pointer' }}>↻ Refresh</button>
                </div>
                {invoices.length === 0 ? (
                  <div style={{ padding:20, textAlign:'center', color:'#4a5260', fontSize:12 }}>No invoices yet. Upload a CSV or add one manually.</div>
                ) : invoices.map(inv => {
                  const statusColors = { pending_review:'#f59e0b', disputed:'#ef4444', resolved:'#22c55e', approved:'#f5a623' }
                  const hasOvercharge = (inv.total_overcharge || 0) > 0
                  return (
                    <div key={inv.id} style={{ padding:'12px 14px', border:`1px solid ${hasOvercharge ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`, borderLeft:`3px solid ${statusColors[inv.status] || '#4a5260'}`, borderRadius:8, background: hasOvercharge ? 'rgba(239,68,68,0.03)' : '#0f1826', marginBottom:8 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
                        <div>
                          <span style={{ fontSize:12, color:'#e8eaed', fontWeight:600 }}>{inv.carrier}</span>
                          <span style={{ fontSize:11, color:'#4a5260', fontFamily:'monospace', marginLeft:8 }}>{inv.invoice_ref}</span>
                        </div>
                        <span style={{ fontSize:9, padding:'2px 7px', background:`${statusColors[inv.status]}22`, color:statusColors[inv.status], fontFamily:'monospace', fontWeight:700, borderRadius:3 }}>{inv.status?.replace(/_/g,' ').toUpperCase()}</span>
                      </div>
                      <div style={{ display:'flex', gap:14, fontSize:10, color:'#8a9099', marginBottom:6 }}>
                        <span>Charged: £{(inv.total_charged||0).toLocaleString()}</span>
                        <span>Agreed: £{(inv.total_agreed||0).toLocaleString()}</span>
                        {hasOvercharge && <span style={{ color:'#ef4444', fontWeight:600 }}>Overcharge: £{(inv.total_overcharge||0).toLocaleString()}</span>}
                        <span>{inv.source?.replace(/_/g,' ')}</span>
                        {inv.invoice_date && <span>{inv.invoice_date}</span>}
                      </div>
                      <div style={{ display:'flex', gap:6 }}>
                        {inv.status === 'pending_review' && hasOvercharge && (
                          <button onClick={() => {
                            const items = inv.line_items || []
                            const subject = `Invoice Dispute — ${inv.carrier} — £${(inv.total_overcharge||0).toLocaleString()} overcharge identified`
                            const body = [`Dear ${inv.carrier} Accounts Team,`,'',`We are writing to formally dispute invoice ${inv.invoice_ref}${inv.invoice_date ? ` dated ${inv.invoice_date}` : ''} where charges exceed our contracted rates:`,'',
                              ...items.filter(li=>(Number(li.charged)||0)>(Number(li.agreed_rate)||0)).flatMap(li=>[`Job: ${li.job_ref||'N/A'}`,`Description: ${li.description||'N/A'}`,`Charged: £${li.charged}`,`Agreed: £${li.agreed_rate}`,`Overcharge: £${li.delta || ((Number(li.charged)||0)-(Number(li.agreed_rate)||0)).toFixed(2)}`,''])
                              ,`Total disputed: £${(inv.total_overcharge||0).toLocaleString()}`,'','We request a credit note for the full disputed amount within 14 days.','','Kind regards,','Pearson Haulage Operations','via DisruptionHub'].join('\n')
                            setEmailPickerMailto(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
                            fetch('/api/invoices', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id:inv.id, status:'disputed' }) }).then(()=>loadInvoices()).catch(()=>{})
                          }} style={{ padding:'4px 10px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:5, color:'#ef4444', fontSize:10, fontWeight:600, cursor:'pointer' }}>✉ Dispute</button>
                        )}
                        {inv.status === 'pending_review' && !hasOvercharge && (
                          <button onClick={() => { fetch('/api/invoices', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id:inv.id, status:'approved' }) }).then(()=>{showDashToast('Invoice approved');loadInvoices()}).catch(()=>{}) }}
                            style={{ padding:'4px 10px', background:'rgba(245,166,35,0.08)', border:'1px solid rgba(245,166,35,0.2)', borderRadius:5, color:'#f5a623', fontSize:10, fontWeight:600, cursor:'pointer' }}>✓ Approve</button>
                        )}
                        {inv.status === 'disputed' && (
                          <button onClick={() => { fetch('/api/invoices', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id:inv.id, status:'resolved' }) }).then(()=>{showDashToast('Marked resolved');loadInvoices()}).catch(()=>{}) }}
                            style={{ padding:'4px 10px', background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:5, color:'#22c55e', fontSize:10, fontWeight:600, cursor:'pointer' }}>✓ Resolved</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── SCENARIOS TAB ─────────────────────────────────────────────── */}
          {activeTab === 'scenarios' && (
            <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>
              <div style={{ fontSize:10, color:'#4a5260', fontFamily:'monospace', marginBottom:14 }}>// 10 OPERATIONAL SCENARIOS — click any to run with demo data</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:8, marginBottom:20 }}>
                {[
                  { id:'driver_silent', label:'Driver Goes Silent', icon:'📵', color:'#ef4444' },
                  { id:'delivery_rejection', label:'Delivery Rejection', icon:'🚫', color:'#f59e0b' },
                  { id:'churn_prediction', label:'Client Churn Risk', icon:'📉', color:'#f59e0b' },
                  { id:'subcontractor_noshow', label:'Subcontractor No-Show', icon:'👻', color:'#ef4444' },
                  { id:'fuel_card_declined', label:'Fuel Card Declined', icon:'⛽', color:'#f59e0b' },
                  { id:'planned_closures', label:'Planned Road Closures', icon:'🚧', color:'#3b82f6' },
                  { id:'licence_check', label:'Driver Licence Check', icon:'🪪', color:'#f59e0b' },
                  { id:'claim_pre_emption', label:'Insurance Claim Pack', icon:'🛡', color:'#3b82f6' },
                  { id:'border_doc_failure', label:'Border Doc Failure', icon:'🛃', color:'#ef4444' },
                  { id:'cascade_calculator', label:'Cascade Calculator', icon:'🌊', color:'#ef4444' },
                ].map(s => (
                  <button key={s.id} onClick={() => runScenario(s.id)} disabled={!!scenarioRunning}
                    style={{ textAlign:'left', padding:'12px 13px', borderRadius:7, border:`1px solid ${s.color}30`, background:`${s.color}08`, cursor:scenarioRunning?'default':'pointer', opacity:scenarioRunning&&scenarioRunning!==s.id?0.4:1, transition:'all 0.15s' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
                      <span style={{ fontSize:15 }}>{s.icon}</span>
                      <span style={{ fontSize:11, fontWeight:500, color:'#e8eaed', lineHeight:1.3 }}>{s.label}</span>
                    </div>
                    <div style={{ fontSize:9, color:s.color, fontFamily:'monospace' }}>
                      {scenarioRunning===s.id ? '● RUNNING...' : 'CLICK TO RUN DEMO'}
                    </div>
                  </button>
                ))}
              </div>
              {scenarioRunning && (
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px', background:'#0f1826', borderRadius:8, border:'1px solid rgba(245,166,35,0.15)' }}>
                  <div style={{ width:16, height:16, border:'2px solid #f5a623', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', flexShrink:0 }} />
                  <span style={{ fontFamily:'monospace', fontSize:11, color:'#f5a623' }}>Analysing scenario...</span>
                </div>
              )}
              {scenarioResult && !scenarioRunning && (
                <div style={{ border:'1px solid rgba(245,166,35,0.15)', borderRadius:8, overflow:'hidden' }}>
                  <div style={{ padding:'10px 14px', background:'rgba(245,166,35,0.06)', borderBottom:'1px solid rgba(245,166,35,0.1)', fontFamily:'monospace', fontSize:11, color:'#f5a623' }}>
                    SCENARIO RESULT — {scenarioResult.scenario?.toUpperCase().replace(/_/g,' ')}
                  </div>
                  {scenarioResult.error
                    ? <div style={{ padding:'14px', color:'#ef4444', fontSize:12, fontFamily:'monospace' }}>Error: {scenarioResult.error}</div>
                    : <div style={{ padding:'14px', maxHeight:400, overflowY:'auto' }}>
                        <ScenarioResult result={scenarioResult.result} />
                      </div>
                  }
                </div>
              )}
            </div>
          )}

          {/* ── APPROVALS TAB ──────────────────────────────────────────────── */}
          {activeTab === 'approvals' && (
            <div className="dh-command" style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>

              {/* ══ LEFT — LIVE FLEET ══ */}
              <div className="dh-cmd-left" style={{ width:280, flexShrink:0, display:'flex', flexDirection:'column', borderRight:'2px solid rgba(255,255,255,0.06)', overflow:'hidden' }}>
                <div style={{ background:'#0d1420', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', color:'#e8eaed', fontFamily:'monospace' }}>LIVE FLEET</div>
                    <div style={{ fontSize:9, color:'#4a5260', marginTop:2 }}>{activeDrivers.length} on shift</div>
                  </div>
                  <button onClick={() => { loadActiveDrivers(); loadFleet() }} style={{ background:'none', border:'none', color:'#4a5260', fontSize:11, cursor:'pointer' }}>↻</button>
                </div>

                <div style={{ flex:1, overflowY:'auto' }}>
                  {activeDrivers.length === 0 && fleet.length === 0 ? (
                    <div style={{ padding:16, textAlign:'center' }}>
                      <div style={{ fontSize:11, color:'#4a5260', marginBottom:4 }}>No drivers on shift</div>
                      <div style={{ fontSize:10, color:'#4a5260', fontFamily:'monospace' }}>Start a shift in the driver app</div>
                    </div>
                  ) : (
                    (activeDrivers.length > 0 ? activeDrivers : fleet).map((v, i) => {
                      const reg = v.vehicle_reg
                      const name = v.driver_name || v.driver_name || 'Unknown'
                      const loc = v.last_known_location || null
                      const cargo = v.cargo_type || null
                      const route = v.current_route || null
                      const status = v.status || 'active'
                      const statusColor = status === 'disrupted' || status === 'at_risk' ? '#ef4444' : status === 'delayed' ? '#f59e0b' : '#f5a623'
                      const cargoColor = cargo?.includes('pharma') ? '#a855f7' : cargo?.includes('chilled') || cargo?.includes('frozen') ? '#3b82f6' : '#4a5260'
                      const fleetVehicle = fleet.find(fv => fv.vehicle_reg === reg)
                      return (
                        <div key={i} style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.04)', borderLeft:`3px solid ${statusColor}` }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                            <span style={{ fontFamily:'monospace', fontSize:12, fontWeight:700, color:'#e8eaed', letterSpacing:1 }}>{reg}</span>
                            <span style={{ fontSize:8, padding:'2px 6px', background:`${statusColor}18`, color:statusColor, fontFamily:'monospace', fontWeight:700 }}>{status.replace(/_/g,' ').toUpperCase()}</span>
                          </div>
                          <div style={{ fontSize:11, color:'#8a9099', marginBottom:3 }}>{name}</div>
                          {loc && <div style={{ fontSize:9, color:'#4a5260', marginBottom:2 }}>📍 {loc}</div>}
                          {cargo && <div style={{ fontSize:9, color:cargoColor }}>{cargo.includes('pharma') ? '💊' : cargo.includes('chilled') ? '❄' : '📦'} {cargo}</div>}
                          {route && <div style={{ fontSize:9, color:'#374151', marginTop:2 }}>→ {route}</div>}
                          {fleetVehicle && fleetVehicle.jobs?.length > 0 && (
                            <div style={{ marginTop:6, display:'flex', gap:6 }}>
                              <button onClick={() => setCancelConfirm({ vehicle_reg: reg, cancel_all: true })}
                                style={{ padding:'3px 8px', borderRadius:4, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.06)', color:'#ef4444', fontSize:9, cursor:'pointer', fontFamily:'monospace' }}>
                                Cancel all
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}

                  {/* Unassigned queue */}
                  {unassigned.length > 0 && (
                    <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'10px 16px' }}>
                      <div style={{ fontSize:9, color:'#f59e0b', fontFamily:'monospace', fontWeight:700, marginBottom:8 }}>UNASSIGNED — {unassigned.length}</div>
                      {unassigned.map(job => (
                        <div key={job.ref} style={{ background:'rgba(245,158,11,0.05)', border:'1px solid rgba(245,158,11,0.15)', borderRadius:6, padding:'8px 10px', marginBottom:6 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                            <span style={{ fontFamily:'monospace', fontSize:11, color:'#e8eaed' }}>{job.ref}</span>
                            <button onClick={() => { setReassignJobRef(job.ref); setReassignTo('') }}
                              style={{ padding:'3px 8px', borderRadius:4, border:'1px solid rgba(245,166,35,0.3)', background:'rgba(245,166,35,0.06)', color:'#f5a623', fontSize:9, cursor:'pointer', fontFamily:'monospace' }}>
                              Assign →
                            </button>
                          </div>
                          <div style={{ fontSize:9, color:'#4a5260' }}>was {job.original_vehicle}</div>
                          {reassignJobRef === job.ref && (
                            <div style={{ display:'flex', gap:6, marginTop:6 }}>
                              <select value={reassignTo} onChange={e => setReassignTo(e.target.value)}
                                style={{ flex:1, padding:'4px 6px', background:'#080c14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4, color: reassignTo ? '#e8eaed' : '#4a5260', fontSize:10, outline:'none', fontFamily:'Barlow' }}>
                                <option value=''>Pick driver...</option>
                                {fleet.map(v => <option key={v.vehicle_reg} value={v.vehicle_reg}>{v.vehicle_reg}{v.driver_name ? ` — ${v.driver_name}` : ''}</option>)}
                              </select>
                              <button onClick={() => reassignTo && reassignUnassigned(job.ref, reassignTo, job.reason)} disabled={!reassignTo}
                                style={{ padding:'4px 8px', borderRadius:4, border:'none', background: reassignTo ? '#f5a623' : 'rgba(245,166,35,0.2)', color: reassignTo ? '#000' : '#4a5260', fontSize:10, fontWeight:700, cursor: reassignTo ? 'pointer' : 'default', fontFamily:'monospace' }}>
                                ✓
                              </button>
                              <button onClick={() => { setReassignJobRef(null); setReassignTo('') }}
                                style={{ padding:'4px 7px', borderRadius:4, border:'1px solid rgba(255,255,255,0.08)', background:'transparent', color:'#4a5260', fontSize:10, cursor:'pointer' }}>✕</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fleet footer stats */}
                <div style={{ background:'#0d1420', borderTop:'1px solid rgba(255,255,255,0.06)', padding:'10px 16px', flexShrink:0, display:'flex', gap:16 }}>
                  {[
                    { n: fleet.filter(v=>v.jobs?.some(j=>j.status==='at_risk'||j.status==='disrupted')).length, l:'CRITICAL', c:'#ef4444' },
                    { n: fleet.filter(v=>v.jobs?.some(j=>j.status==='delayed')).length, l:'DELAYED', c:'#f59e0b' },
                    { n: activeDrivers.length, l:'ACTIVE', c:'#f5a623' }
                  ].map(s => (
                    <div key={s.l} style={{ textAlign:'center' }}>
                      <div style={{ fontSize:16, fontWeight:700, color:s.c, fontFamily:'monospace' }}>{s.n}</div>
                      <div style={{ fontSize:8, color:'#4a5260', letterSpacing:1 }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ══ CENTRE — ACTION QUEUE ══ */}
              <div className="dh-cmd-centre" style={{ flex:1, display:'flex', flexDirection:'column', borderRight:'2px solid rgba(255,255,255,0.06)', overflow:'hidden' }}>
                <div style={{ background:'#0d1420', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'12px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', color:'#e8eaed', fontFamily:'monospace' }}>ACTION QUEUE</div>
                    <div style={{ fontSize:9, color:'#4a5260', marginTop:2 }}>Decisions waiting · Auto-handled · Resolved</div>
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    {[
                      { n: pendingApprovals.filter(a=>a.status==='pending').length, l:'PENDING', c:'#f59e0b' },
                      { n: pendingApprovals.filter(a=>a.status==='executed'||a.status==='resolved').length, l:'DONE', c:'#f5a623' },
                    ].map(s => (
                      <div key={s.l} style={{ textAlign:'center', padding:'4px 10px', background:`${s.c}11`, border:`1px solid ${s.c}33` }}>
                        <div style={{ fontSize:15, fontWeight:700, color:s.c, fontFamily:'monospace' }}>{s.n}</div>
                        <div style={{ fontSize:8, color:`${s.c}88`, letterSpacing:1 }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }}>

                  {/* Session executed */}
                  {localApprovals.length > 0 && (
                    <div style={{ marginBottom:12 }}>
                      {localApprovals.map(a => (
                        <div key={a.id} style={{ border:`1px solid ${a.border}`, borderRadius:8, background:a.bg, marginBottom:7, borderLeft:`3px solid #f5a623` }}>
                          <div style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
                            <span style={{ fontSize:15 }}>{a.ico}</span>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:12, color:'#e8eaed', fontWeight:500 }}>{a.action_label}</div>
                              <div style={{ fontSize:9, color:'#4a5260', fontFamily:'monospace', marginTop:2 }}>{(a.action_type||'').toUpperCase()} · {a.executed_at}</div>
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                              <div style={{ width:6, height:6, borderRadius:'50%', background:'#f5a623' }} />
                              <span style={{ fontSize:9, color:'#f5a623', fontFamily:'monospace' }}>DONE</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      {pendingApprovals.length > 0 && <div style={{ height:1, background:'rgba(255,255,255,0.05)', margin:'10px 0' }} />}
                    </div>
                  )}

                  {/* Pending + logged approvals */}
                  {pendingApprovals.length > 0 ? (
                    pendingApprovals.map(a => {
                      const isPending = a.status === 'pending'
                      const isExecuted = a.status === 'executed' || a.status === 'resolved'
                      const isRejected = a.status === 'rejected' || a.status === 'expired'
                      const isProcessing = approvingId === a.id
                      const borderCol = isPending ? '#f59e0b' : isExecuted ? '#f5a623' : '#374151'
                      const bgCol = isPending ? 'rgba(245,158,11,0.04)' : isExecuted ? 'rgba(245,166,35,0.03)' : 'rgba(55,65,81,0.03)'
                      const typeMap = { call:'📞', make_call:'📞', send_sms:'💬', sms:'💬', send_email:'✉', email:'✉', dispatch:'🚛', reroute:'🗺', notify:'📣', emergency:'🚨', driver_resolved:'✅' }
                      const ico = typeMap[a.action_type] || '⚡'
                      const timeStr = a.executed_at ? new Date(a.executed_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : a.created_at ? new Date(a.created_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : ''
                      return (
                        <div key={a.id} style={{ border:`1px solid ${borderCol}33`, borderLeft:`3px solid ${borderCol}`, borderRadius:8, background:bgCol, marginBottom:8 }}>
                          <div style={{ padding:'12px 14px' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                                <span style={{ fontSize:9, padding:'2px 7px', background:`${borderCol}22`, color:borderCol, fontFamily:'monospace', fontWeight:700 }}>
                                  {isPending ? '⚠ PENDING' : isExecuted ? '✓ DONE' : isRejected ? '✕ REJECTED' : a.status?.toUpperCase()}
                                </span>
                                <span style={{ fontSize:9, color:'#4a5260' }}>{a.action_details?.vehicle_reg || ''}</span>
                              </div>
                              <span style={{ fontSize:9, color:'#374151' }}>{timeStr}</span>
                            </div>
                            <div style={{ fontSize:13, fontWeight:600, color:'#e8eaed', marginBottom:6 }}>{ico} {a.action_label}</div>
                            {a.financial_value > 0 && <div style={{ fontSize:10, color:borderCol, fontWeight:600, marginBottom:8 }}>£{Number(a.financial_value).toLocaleString()}</div>}
                            {isPending && (
                              <div style={{ display:'flex', gap:6 }}>
                                <button onClick={() => handleApproval(a.id,'approve')} disabled={isProcessing}
                                  style={{ padding:'6px 16px', borderRadius:5, border:'none', background:'#f5a623', color:'#000', fontWeight:700, fontSize:11, cursor:isProcessing?'default':'pointer', fontFamily:'monospace' }}>
                                  {isProcessing ? '...' : 'YES'}
                                </button>
                                <button onClick={() => assessCancelAction(a.id, a.sent_at)} disabled={isProcessing}
                                  style={{ padding:'6px 12px', borderRadius:5, fontSize:11, cursor:'pointer', border:'1px solid rgba(245,158,11,0.4)', background:'rgba(245,158,11,0.06)', color:'#f59e0b', fontFamily:'monospace' }}>
                                  NO
                                </button>

                              </div>
                            )}
                            {isExecuted && <div style={{ fontSize:9, color:'#f5a623', fontFamily:'monospace' }}>✓ Actioned {timeStr} — no further action needed</div>}
                            {isRejected && <div style={{ fontSize:9, color:'#4a5260', fontFamily:'monospace' }}>Dismissed</div>}
                          </div>
                        </div>
                      )
                    })
                  ) : localApprovals.length === 0 ? (
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'50%', opacity:0.3 }}>
                      <div style={{ fontFamily:'monospace', fontSize:32, color:'#4a5260' }}>✓</div>
                      <div style={{ fontSize:12, color:'#4a5260', marginTop:8 }}>All clear</div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* ══ RIGHT — INCIDENT FEED + VALUE ══ */}
              <div className="dh-cmd-right" style={{ width:280, flexShrink:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>

                {/* Toggle header */}
                <div style={{ background:'#0d1420', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0, display:'flex' }}>
                  <button onClick={() => setCommandRightTab('incidents')}
                    style={{ flex:1, padding:'12px 0', background:'transparent', border:'none', borderBottom: commandRightTab==='incidents' ? '2px solid #f5a623' : '2px solid transparent', color: commandRightTab==='incidents' ? '#e8eaed' : '#4a5260', fontSize:10, fontWeight:700, letterSpacing:'0.08em', cursor:'pointer', fontFamily:'monospace' }}>
                    INCIDENTS
                  </button>
                  <button onClick={() => setCommandRightTab('value')}
                    style={{ flex:1, padding:'12px 0', background:'transparent', border:'none', borderBottom: commandRightTab==='value' ? '2px solid #f5a623' : '2px solid transparent', color: commandRightTab==='value' ? '#f5a623' : '#4a5260', fontSize:10, fontWeight:700, letterSpacing:'0.08em', cursor:'pointer', fontFamily:'monospace' }}>
                    VALUE ▲
                  </button>
                </div>

                {/* Mini value banner — always visible */}
                {(() => {
                  const hiCrit = whLog.filter(l => l.severity === 'HIGH' || l.severity === 'CRITICAL')
                  const totalProtected = hiCrit.reduce((s, l) => s + (l.financial_impact || 0), 0)
                  const timeSavedMins = whLog.filter(l=>l.sms_fired).length * 12
                  return (
                    <div onClick={() => setCommandRightTab('value')} style={{ background:'rgba(245,166,35,0.04)', borderBottom:'1px solid rgba(245,166,35,0.12)', padding:'10px 16px', cursor:'pointer', flexShrink:0, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <div style={{ fontSize:8, color:'#4a5260', letterSpacing:2, marginBottom:2 }}>SLA PROTECTED</div>
                        <div style={{ fontSize:20, fontWeight:700, color:'#f5a623', fontFamily:'monospace', lineHeight:1 }}>£{totalProtected.toLocaleString()}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:8, color:'#4a5260', letterSpacing:2, marginBottom:2 }}>TIME SAVED</div>
                        <div style={{ fontSize:20, fontWeight:700, color:'#f5a623', fontFamily:'monospace', lineHeight:1 }}>{timeSavedMins >= 60 ? `${(timeSavedMins/60).toFixed(1)}h` : `${timeSavedMins}m`}</div>
                      </div>
                    </div>
                  )
                })()}

                {/* INCIDENTS tab */}
                {commandRightTab === 'incidents' && (
                  <div style={{ flex:1, overflowY:'auto' }}>
                    {whLog.length === 0 ? (
                      <div style={{ padding:16, textAlign:'center', opacity:0.4 }}>
                        <div style={{ fontSize:11, color:'#4a5260' }}>No events logged yet</div>
                      </div>
                    ) : whLog.map((log, i) => {
                      const sc = log.severity==='CRITICAL'?'#ef4444':log.severity==='HIGH'?'#f59e0b':log.severity==='MEDIUM'?'#3b82f6':'#374151'
                      const timeStr = log.created_at ? new Date(log.created_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : ''
                      return (
                        <div key={i} style={{ padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,0.04)', borderLeft:`3px solid ${sc}`, background: i===0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                          <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                            <span style={{ fontSize:8, padding:'2px 5px', background:`${sc}22`, color:sc, fontFamily:'monospace', fontWeight:700, flexShrink:0, marginTop:1 }}>{log.severity}</span>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:11, fontWeight:600, color: i===0 ? '#e8eaed' : '#8a9099', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                {log.event_type?.replace(/_/g,' ')} · {log.payload?.vehicle_reg || ''}
                              </div>
                              <div style={{ fontSize:9, color:'#4a5260' }}>{log.system_name} · {timeStr}</div>
                              {log.financial_impact > 0 && <div style={{ fontSize:9, color: i===0 ? '#f59e0b' : '#f5a623', marginTop:2, fontWeight:600 }}>£{Number(log.financial_impact).toLocaleString()}</div>}
                              {log.sms_fired && <div style={{ fontSize:8, color:'#f5a623', marginTop:1 }}>✓ SMS sent</div>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* VALUE tab */}
                {commandRightTab === 'value' && (() => {
                  const hiCrit = whLog.filter(l => l.severity==='HIGH'||l.severity==='CRITICAL')
                  const smsFired = whLog.filter(l => l.sms_fired)
                  const totalProtected = hiCrit.reduce((s,l) => s + (l.financial_impact||0), 0)
                  const payloadVerified = hiCrit.filter(l => l.financial_source === 'payload').length
                  const aiEstimated = hiCrit.filter(l => l.financial_source === 'ai_estimate').length
                  const timeSavedMins = smsFired.length * 12
                  const opsValueGbp = Math.round(smsFired.length * (14.42 / 60) * 12)
                  const driverValueGbp = Math.round(smsFired.length * (15.38 / 60) * 12)
                  const canProject = whLog.length >= 20 // 3+ days of data
                  const stats = [
                    { label:'TOTAL SLA EXPOSURE PROTECTED', value:`£${totalProtected.toLocaleString()}`, sub:`${hiCrit.length} qualifying events · ${payloadVerified} payload-verified · ${aiEstimated} AI-estimated`, color:'#f5a623' },
                    { label:'RESPONSE TIME SAVED', value: timeSavedMins >= 60 ? `${(timeSavedMins/60).toFixed(1)}h` : `${timeSavedMins}m`, sub:`${timeSavedMins} min · 12 min/SMS-handled event`, color:'#f5a623' },
                    { label:'INCIDENTS LOGGED', value:String(whLog.length), sub:`${smsFired.length} ops SMS sent · ${hiCrit.length} HIGH/CRIT`, color:'#f59e0b' },
                    { label:'OPS TIME RECOVERED', value:`£${opsValueGbp}`, sub:`£14.42/hr · 12 min per SMS event`, color:'#6366f1' },
                    { label:'DRIVER TIME RECOVERED', value:`£${driverValueGbp}`, sub:`£15.38/hr · 12 min faster per instruction`, color:'#6366f1' },
                  ]
                  return (
                    <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
                      {stats.map((s, i) => (
                        <div key={i} style={{ background:'rgba(255,255,255,0.02)', border:`1px solid ${s.color}22`, borderLeft:`3px solid ${s.color}`, borderRadius:6, padding:'12px', marginBottom:8 }}>
                          <div style={{ fontSize:8, color:'#4a5260', letterSpacing:'0.1em', marginBottom:6 }}>{s.label}</div>
                          <div style={{ fontSize:24, fontWeight:700, color:s.color, fontFamily:'monospace', lineHeight:1, marginBottom:4 }}>{s.value}</div>
                          <div style={{ fontSize:9, color:'#374151', lineHeight:1.5 }}>{s.sub}</div>
                        </div>
                      ))}
                      <div style={{ padding:'10px 0', fontSize:9, color:'#374151', lineHeight:1.6, borderTop:'1px solid rgba(255,255,255,0.05)', marginTop:4 }}>
                        {canProject
                          ? `Annual projection: £${Math.round((totalProtected/whLog.length)*365/7*5).toLocaleString()} estimated`
                          : 'Annual projection available after 3 days of data'
                        }<br/>HIGH/CRITICAL only · Payload-verified figures preferred over AI estimates
                      </div>
                    </div>
                  )
                })()}

                {/* Stats footer */}
                <div style={{ background:'#0d1420', borderTop:'1px solid rgba(255,255,255,0.06)', padding:'10px 16px', flexShrink:0 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px 0' }}>
                    {[
                      ['WEBHOOKS', String(whLog.length)],
                      ['SMS SENT', String(whLog.filter(l=>l.sms_fired).length)],
                      ['PENDING', String(pendingApprovals.filter(a=>a.status==='pending').length)],
                      ['EXECUTED', String(pendingApprovals.filter(a=>a.status==='executed').length)],
                    ].map(([k,v]) => (
                      <div key={k} style={{ display:'flex', justifyContent:'space-between', paddingRight:8 }}>
                        <span style={{ fontSize:8, color:'#374151' }}>{k}</span>
                        <span style={{ fontSize:8, color:'#9ca3af', fontWeight:700, fontFamily:'monospace' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── CANCEL JOB CONFIRM MODAL ── */}
              {cancelConfirm && (
                <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1001 }}>
                  <div style={{ background:'#0f1826', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, padding:'24px', maxWidth:420, width:'90%' }}>
                    <div style={{ fontFamily:'monospace', fontSize:11, color:'#ef4444', letterSpacing:'0.08em', marginBottom:12 }}>
                      {cancelConfirm.cancel_all ? 'CANCEL ALL JOBS' : `CANCEL JOB — ${cancelConfirm.ref}`}
                    </div>
                    <div style={{ fontSize:13, color:'#e8eaed', marginBottom:6 }}>
                      {cancelConfirm.cancel_all ? `Remove all active jobs from ${cancelConfirm.vehicle_reg}.` : cancelConfirm.hasGoods ? `⚠ ${cancelConfirm.ref} — driver has goods on vehicle. They will be instructed to return to depot.` : `Remove ${cancelConfirm.ref} from ${cancelConfirm.vehicle_reg}.`}
                    </div>
                    {cancelConfirm.hasGoods && (<div style={{ padding:'10px 12px', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:7, marginBottom:10, fontSize:12, color:'#f59e0b' }}>Driver is mid-job with cargo on board. Cancelling will SMS them to return goods to depot.</div>)}
                    <div style={{ fontSize:12, color:'#8a9099', marginBottom:14 }}>Driver app updates within 60 seconds automatically.</div>
                    {fleet.filter(v => v.vehicle_reg !== cancelConfirm.vehicle_reg).length > 0 && (
                      <div style={{ marginBottom:12 }}>
                        <div style={{ fontSize:11, color:'#4a5260', fontFamily:'monospace', marginBottom:6 }}>REASSIGN TO ANOTHER DRIVER — optional</div>
                        <select value={reassignTo} onChange={e => setReassignTo(e.target.value)} style={{ width:'100%', padding:'9px 12px', background:'#080c14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, color: reassignTo ? '#e8eaed' : '#4a5260', fontSize:12, outline:'none', fontFamily:'Barlow', cursor:'pointer' }}>
                          <option value=''>No reassignment — just cancel</option>
                          {fleet.filter(v => v.vehicle_reg !== cancelConfirm.vehicle_reg).map(v => (<option key={v.vehicle_reg} value={v.vehicle_reg}>{v.vehicle_reg}{v.driver_name ? ` — ${v.driver_name}` : ''} ({v.jobs.length} job{v.jobs.length !== 1 ? 's' : ''})</option>))}
                        </select>
                        {reassignTo && <div style={{ fontSize:11, color:'#f5a623', marginTop:5 }}>✓ Job will be pushed to {reassignTo}</div>}
                      </div>
                    )}
                    <input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder='Reason — optional' style={{ width:'100%', padding:'10px 12px', background:'#080c14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, color:'#e8eaed', fontSize:12, outline:'none', marginBottom:14, boxSizing:'border-box', fontFamily:'Barlow' }} />
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={() => cancelJob(cancelConfirm)} disabled={!!cancellingJob} style={{ flex:1, padding:'10px', background: reassignTo ? '#f5a623' : '#ef4444', border:'none', borderRadius:6, color: reassignTo ? '#000' : '#fff', fontWeight:600, fontSize:12, cursor:'pointer', fontFamily:'monospace' }}>
                        {cancellingJob ? '...' : reassignTo ? `Reassign to ${reassignTo}` : 'Confirm cancel'}
                      </button>
                      <button onClick={() => { setCancelConfirm(null); setCancelReason(''); setReassignTo('') }} style={{ padding:'10px 16px', background:'transparent', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, color:'#8a9099', fontSize:12, cursor:'pointer', fontFamily:'monospace' }}>Keep job</button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── CANCEL ASSESSMENT MODAL ── */}
              {cancelAssessment && (
                <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
                  <div style={{ background:'#0f1826', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, padding:'24px', maxWidth:480, width:'90%' }}>
                    <div style={{ fontFamily:'monospace', fontSize:11, color: cancelAssessment.risk==='NONE'?'#f5a623':cancelAssessment.risk==='LOW'?'#f59e0b':'#ef4444', letterSpacing:'0.08em', marginBottom:12 }}>CANCEL ASSESSMENT — {cancelAssessment.risk} RISK</div>
                    <div style={{ fontSize:13, color:'#e8eaed', lineHeight:1.7, marginBottom:20 }}>{cancelAssessment.message}</div>
                    {cancelAssessment.type === 'clean_cancel' && (<div style={{ display:'flex', gap:8 }}><button onClick={() => executeCancelAction(cancelAssessment.approvalId,'clean_cancel')} style={{ flex:1, padding:'10px', background:'#ef4444', border:'none', borderRadius:6, color:'#fff', fontWeight:600, fontSize:12, cursor:'pointer', fontFamily:'monospace' }}>CONFIRM CANCEL</button><button onClick={() => setCancelAssessment(null)} style={{ padding:'10px 16px', background:'transparent', border:'1px solid rgba(255,255,255,0.12)', borderRadius:6, color:'#8a9099', fontSize:12, cursor:'pointer', fontFamily:'monospace' }}>KEEP ACTION</button></div>)}
                    {cancelAssessment.type === 'disregard_cancel' && (<div><div style={{ padding:'10px 12px', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:6, fontSize:12, color:'#f59e0b', fontFamily:'monospace', marginBottom:14 }}>Will send to driver: "DISREGARD previous route instruction."</div><div style={{ display:'flex', gap:8 }}><button onClick={() => executeCancelAction(cancelAssessment.approvalId,'disregard')} style={{ flex:1, padding:'10px', background:'#f59e0b', border:'none', borderRadius:6, color:'#000', fontWeight:600, fontSize:12, cursor:'pointer', fontFamily:'monospace' }}>SEND DISREGARD + CANCEL</button><button onClick={() => setCancelAssessment(null)} style={{ padding:'10px 16px', background:'transparent', border:'1px solid rgba(255,255,255,0.12)', borderRadius:6, color:'#8a9099', fontSize:12, cursor:'pointer', fontFamily:'monospace' }}>KEEP ACTION</button></div></div>)}
                  </div>
                </div>
              )}

            </div>
          )}



          {activeTab === 'integrations' && (() => {
            const sys = WEBHOOK_SYSTEMS[whSystem]
            const evtConfig = sys?.events[whEvent]
            const currentPayload = getWhPayload()
            const SEV_C = { CRITICAL:'#ef4444', HIGH:'#f59e0b', MEDIUM:'#3b82f6', LOW:'#8a9099' }
            const SEV_BG2 = { CRITICAL:'rgba(239,68,68,0.12)', HIGH:'rgba(245,158,11,0.12)', MEDIUM:'rgba(59,130,246,0.12)', LOW:'rgba(138,144,153,0.12)' }

            return (
              <div style={{ flex:1, overflowY:'auto', padding:'20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, alignItems:'start' }}>

                {/* ── ACTIVE FLEET PANEL — full width above test console ── */}
                <div style={{ gridColumn:'1 / -1', marginBottom:4 }}>
                  <div style={{ fontSize:9, color:'#4a5260', fontFamily:'monospace', letterSpacing:'0.08em', marginBottom:10 }}>// ACTIVE FLEET — DRIVERS CURRENTLY ON SHIFT</div>
                  {activeDriversLoading && (
                    <div style={{ fontSize:11, color:'#4a5260', padding:'12px 14px', background:'#0f1826', borderRadius:8 }}>Loading active drivers...</div>
                  )}
                  {!activeDriversLoading && activeDrivers.length === 0 && (
                    <div style={{ fontSize:11, color:'#4a5260', padding:'12px 14px', background:'#0f1826', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8 }}>
                      No drivers currently on shift. Have a driver start their shift in the driver app first.
                    </div>
                  )}
                  {!activeDriversLoading && activeDrivers.length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
                      {activeDrivers.map((driver, i) => {
                        const isSelected = selectedTestVehicle?.vehicle_reg === driver.vehicle_reg
                        const cargoColor = driver.cargo_type?.includes('pharma') ? '#a855f7' : driver.cargo_type?.includes('chilled') || driver.cargo_type?.includes('frozen') ? '#3b82f6' : '#4a5260'
                        return (
                          <div key={i} onClick={() => selectTestVehicle(driver)} style={{ padding:'12px 16px', background: isSelected ? 'rgba(245,166,35,0.06)' : '#0f1826', border: isSelected ? '1px solid rgba(245,166,35,0.35)' : '1px solid rgba(255,255,255,0.08)', borderRadius:9, cursor:'pointer', minWidth:220, flex:'1 1 220px', transition:'all 0.15s' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                              <span style={{ fontSize:13, fontWeight:700, color: isSelected ? '#f5a623' : '#e8eaed', fontFamily:'monospace', letterSpacing:1 }}>{driver.vehicle_reg}</span>
                              {isSelected && <span style={{ fontSize:9, color:'#f5a623', fontFamily:'monospace', letterSpacing:1 }}>✓ SELECTED</span>}
                            </div>
                            <div style={{ fontSize:11, color:'#8a9099', marginBottom:4 }}>{driver.driver_name}</div>
                            {driver.last_known_location && (
                              <div style={{ fontSize:10, color:'#4a5260', marginBottom:4 }}>📍 {driver.last_known_location}</div>
                            )}
                            {driver.cargo_type && (
                              <div style={{ fontSize:10, color:cargoColor }}>
                                {driver.cargo_type.includes('pharma') ? '💊' : driver.cargo_type.includes('chilled') ? '❄' : driver.cargo_type.includes('frozen') ? '🧊' : '📦'} {driver.cargo_type}
                              </div>
                            )}
                            {driver.current_route && (
                              <div style={{ fontSize:10, color:'#4a5260', marginTop:4 }}>→ {driver.current_route}</div>
                            )}
                            <div style={{ fontSize:9, color: isSelected ? '#f5a623' : '#4a5260', marginTop:6, fontFamily:'monospace' }}>
                              {isSelected ? '✓ Events filtered for this vehicle · payload injected' : 'Select → auto-filters relevant events'}
                            </div>
                          </div>
                        )
                      })}
                      <button onClick={loadActiveDrivers} style={{ padding:'12px 16px', background:'transparent', border:'1px solid rgba(255,255,255,0.06)', borderRadius:9, color:'#4a5260', fontSize:11, cursor:'pointer', fontFamily:'monospace', alignSelf:'stretch', minWidth:80 }}>
                        ↻ refresh
                      </button>
                    </div>
                  )}
                </div>

                {/* ── LEFT: TEST CONSOLE ── */}
                <div>
                  <div style={{ marginBottom:16, padding:'12px 14px', background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.18)', borderRadius:9 }}>
                    <div style={{ fontSize:12, color:'#3b82f6', fontWeight:600, marginBottom:4 }}>What is this?</div>
                    <div style={{ fontSize:12, color:'#8a9099', lineHeight:1.6 }}>
                      This is a <strong style={{color:'#e8eaed'}}>setup and testing tool</strong> for connecting DisruptionHub to your existing systems — things like your TMS (e.g. Mandata), vehicle tracking (e.g. Webfleet, Samsara), or warehouse systems. When those systems send an alert, DisruptionHub picks it up, analyses it with AI, and notifies ops automatically. Use the console below to test that each connection is working correctly. Your drivers don't see this.
                    </div>
                  </div>
                  <div style={{ fontSize:10, color:'#4a5260', fontFamily:'monospace', marginBottom:14 }}>// TEST CONSOLE — simulate a system event and trigger the full AI + SMS chain</div>

                  {/* System selector */}
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:9, fontFamily:'monospace', color:'#4a5260', letterSpacing:'0.08em', marginBottom:8 }}>SELECT SYSTEM</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {Object.entries(WEBHOOK_SYSTEMS).map(([key, s]) => (
                        <button key={key} onClick={() => {
                          setWhSystem(key)
                          const firstEvt = Object.keys(s.events)[0]
                          setWhEvent(firstEvt)
                          setWhPayload(null)
                          setWhResult(null)
                        }}
                          style={{ padding:'6px 12px', borderRadius:6, border: whSystem===key ? `1px solid ${s.color}` : '1px solid rgba(255,255,255,0.08)', background: whSystem===key ? `${s.color}15` : 'transparent', color: whSystem===key ? s.color : '#4a5260', fontSize:11, cursor:'pointer', fontFamily:'monospace', transition:'all 0.15s' }}>
                          {s.icon} {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Event selector — relevance-filtered when vehicle selected */}
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:9, fontFamily:'monospace', color:'#4a5260', letterSpacing:'0.08em', marginBottom:8 }}>
                      SELECT EVENT TYPE
                      {relevantEvents && selectedTestVehicle && (
                        <span style={{ marginLeft:8, color:'#f5a623' }}>· filtered for {selectedTestVehicle.cargo_type || selectedTestVehicle.vehicle_reg}</span>
                      )}
                      {relevantEvents && <button onClick={() => setRelevantEvents(null)} style={{ marginLeft:8, background:'none', border:'none', color:'#4a5260', fontSize:9, cursor:'pointer', fontFamily:'monospace' }}>show all ×</button>}
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {sys && Object.entries(sys.events).map(([key, evt]) => {
                        const isRelevant  = !relevantEvents || relevantEvents.has(key)
                        const isSelected  = whEvent === key
                        const isTopPick   = relevantEvents && relevantEvents.has(key) && (key === 'temp_alarm' || key === 'reefer_fault' || key === 'job_delayed' || key === 'panic_button')
                        return (
                          <button key={key}
                            onClick={() => {
                              setWhEvent(key)
                              // Re-inject vehicle data into new event's payload
                              if (selectedTestVehicle) {
                                const newBase = WEBHOOK_SYSTEMS[whSystem]?.events[key]?.fields || {}
                                const nowEvt = new Date()
                                const fmtEvt = m => new Date(nowEvt.getTime()+m*60000).toTimeString().slice(0,5)
                                setWhPayload({
                                  ...newBase,
                                  vehicle_reg:      selectedTestVehicle.vehicle_reg,
                                  driver_name:      selectedTestVehicle.driver_name || newBase.driver_name || '',
                                  location:         selectedTestVehicle.last_known_location || newBase.location || '',
                                  current_location: selectedTestVehicle.last_known_location || newBase.current_location || '',
                                  cargo_type:       selectedTestVehicle.cargo_type || newBase.cargo_type || '',
                                  sla_deadline:     fmtEvt(90),
                                  current_eta:      fmtEvt(45),
                                  fired_at:         nowEvt.toISOString(),
                                })
                              } else {
                                setWhPayload(null)
                              }
                              setWhResult(null)
                            }}
                            style={{
                              padding:'5px 11px', borderRadius:5, fontFamily:'monospace', transition:'all 0.15s', fontSize:11, cursor: isRelevant ? 'pointer' : 'not-allowed',
                              border: isSelected ? `1px solid ${sys.color}80` : isTopPick ? `1px solid ${sys.color}50` : '1px solid rgba(255,255,255,0.07)',
                              background: isSelected ? `${sys.color}12` : isTopPick ? `${sys.color}08` : '#0f1826',
                              color: isSelected ? sys.color : isRelevant ? '#8a9099' : '#2a3040',
                              opacity: isRelevant ? 1 : 0.35,
                              position:'relative'
                            }}>
                            {isTopPick && !isSelected && <span style={{ position:'absolute', top:-4, right:-4, width:6, height:6, borderRadius:'50%', background:'#f5a623' }} />}
                            {evt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Payload fields */}
                  {evtConfig && (
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:9, fontFamily:'monospace', color:'#4a5260', letterSpacing:'0.08em', marginBottom:8 }}>PAYLOAD — edit fields then fire</div>
                      <div style={{ background:'#0f1826', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, overflow:'hidden' }}>
                        {Object.entries(currentPayload).map(([key, val], i, arr) => (
                          <div key={key} style={{ display:'flex', alignItems:'center', padding:'8px 12px', borderBottom: i < arr.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                            <span style={{ fontSize:10, fontFamily:'monospace', color:'#4a5260', width:160, flexShrink:0 }}>{key.replace(/_/g,' ')}</span>
                            <input
                              defaultValue={String(val)}
                              onChange={e => {
                                const updated = { ...getWhPayload(), [key]: isNaN(e.target.value) ? e.target.value : (e.target.value === '' ? '' : Number(e.target.value)) }
                                setWhPayload(updated)
                              }}
                              style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'#e8eaed', fontSize:11, fontFamily:'IBM Plex Mono, monospace' }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fire button */}
                  <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                    <button onClick={fireWebhook} disabled={whFiring}
                      style={{ flex:1, padding:'12px', background: whFiring ? '#0f1826' : sys?.color || '#f5a623', border: whFiring ? `1px solid ${sys?.color||'#f5a623'}40` : 'none', borderRadius:7, color: whFiring ? (sys?.color||'#f5a623') : '#000', fontWeight:700, fontSize:13, cursor: whFiring ? 'default' : 'pointer', fontFamily:'monospace', letterSpacing:'0.04em', transition:'all 0.2s' }}>
                      {whFiring ? (
                        <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                          <span style={{ width:12, height:12, border:'2px solid currentColor', borderTopColor:'transparent', borderRadius:'50%', display:'inline-block', animation:'spin 0.8s linear infinite' }} />
                          FIRING...
                        </span>
                      ) : `${sys?.icon || '⚡'} FIRE → ${evtConfig?.label?.toUpperCase() || ''}`}
                    </button>
                    <button onClick={resetTestRun} title="Clear approvals and reset for next test"
                      style={{ padding:'12px 16px', background:'transparent', border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, color:'#4a5260', fontSize:12, cursor:'pointer', fontFamily:'monospace', whiteSpace:'nowrap' }}>
                      ↺ Reset
                    </button>
                  </div>

                  {/* Result */}
                  {whResult && !whFiring && (
                    <div style={{ border: whResult.error ? '1px solid rgba(239,68,68,0.25)' : `1px solid ${SEV_C[whResult.severity]||'#f5a623'}30`, borderRadius:8, overflow:'hidden' }}>
                      {/* Result header */}
                      <div style={{ padding:'10px 14px', background: whResult.error ? 'rgba(239,68,68,0.08)' : `${SEV_BG2[whResult.severity]||'rgba(245,166,35,0.06)'}`, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                        {whResult.error ? (
                          <span style={{ fontSize:11, fontFamily:'monospace', color:'#ef4444' }}>✗ ERROR — {whResult.error}</span>
                        ) : (
                          <>
                            <span style={{ fontSize:11, fontFamily:'monospace', color: SEV_C[whResult.severity]||'#f5a623', fontWeight:700, padding:'2px 8px', borderRadius:4, background:`${SEV_C[whResult.severity]||'#f5a623'}15`, border:`1px solid ${SEV_C[whResult.severity]||'#f5a623'}30` }}>{whResult.severity}</span>
                            {whResult.financial_impact > 0 && <span style={{ fontSize:11, fontFamily:'monospace', color:'#f5a623' }}>£{whResult.financial_impact.toLocaleString()}</span>}
                            <span style={{ fontSize:10, fontFamily:'monospace', color: whResult.sms_sent ? '#f5a623' : '#f59e0b' }}>
                              {whResult.sms_sent ? '✓ SMS FIRED TO OPS' : whResult.simulated ? '◎ SIMULATED — no ops phone' : '✗ SMS FAILED'}
                            </span>
                          </>
                        )}
                      </div>
                      {/* AI analysis preview */}
                      {whResult.analysis && (
                        <div style={{ padding:'12px 14px', maxHeight:280, overflowY:'auto' }}>
                          <AgentResponse text={whResult.analysis} />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── RIGHT: WEBHOOK AUDIT LOG ── */}
                <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                    <div style={{ fontSize:10, color:'#4a5260', fontFamily:'monospace' }}>// WEBHOOK AUDIT LOG</div>
                    <button onClick={loadWebhookLog} disabled={whLogLoading}
                      style={{ fontSize:10, color:'#4a5260', background:'none', border:'1px solid rgba(255,255,255,0.06)', borderRadius:4, padding:'3px 8px', cursor:'pointer', fontFamily:'monospace' }}>
                      {whLogLoading ? '...' : 'REFRESH ↺'}
                    </button>
                  </div>

                  {whLog.length === 0 && !whLogLoading && (
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 20px', gap:10, opacity:0.3 }}>
                      <div style={{ fontSize:28, color:'#4a5260' }}>⚡</div>
                      <div style={{ fontSize:12, color:'#4a5260', textAlign:'center' }}>No webhook events yet</div>
                      <div style={{ fontSize:11, color:'#4a5260', textAlign:'center', maxWidth:200 }}>Fire a webhook from the console to see the full audit trail here</div>
                    </div>
                  )}

                  {whLogLoading && whLog.length === 0 && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'16px 0' }}>
                      <div style={{ width:14, height:14, border:'2px solid #f5a623', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
                      <span style={{ fontSize:11, color:'#4a5260', fontFamily:'monospace' }}>Loading log...</span>
                    </div>
                  )}

                  {whLog.map(entry => {
                    const sysConfig = WEBHOOK_SYSTEMS[entry.system_name]
                    const sysColor = sysConfig?.color || '#8a9099'
                    const sevColor = SEV_C[entry.severity] || '#8a9099'
                    const timeStr = entry.created_at ? new Date(entry.created_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : ''
                    const dateStr = entry.created_at ? new Date(entry.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : ''
                    return (
                      <div key={entry.id} style={{ padding:'10px 12px', background:'#0f1826', borderRadius:7, border:'1px solid rgba(255,255,255,0.06)', marginBottom:6 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, flexWrap:'wrap' }}>
                          {/* System badge */}
                          <span style={{ fontSize:10, fontFamily:'monospace', color:sysColor, background:`${sysColor}12`, border:`1px solid ${sysColor}25`, padding:'2px 7px', borderRadius:4 }}>
                            {sysConfig?.icon || '⚡'} {entry.system_name?.toUpperCase()}
                          </span>
                          {/* Severity badge */}
                          {entry.severity && (
                            <span style={{ fontSize:10, fontFamily:'monospace', color:sevColor, background:`${sevColor}12`, border:`1px solid ${sevColor}25`, padding:'2px 7px', borderRadius:4 }}>
                              {entry.severity}
                            </span>
                          )}
                          {/* Financial impact */}
                          {entry.financial_impact > 0 && (
                            <span style={{ fontSize:10, fontFamily:'monospace', color:'#f5a623' }}>£{Number(entry.financial_impact).toLocaleString()}</span>
                          )}
                          {/* SMS status */}
                          <span style={{ fontSize:9, fontFamily:'monospace', color: entry.sms_fired ? '#f5a623' : entry.simulated ? '#4a5260' : '#f59e0b', marginLeft:'auto' }}>
                            {entry.sms_fired ? '✓ SMS SENT' : entry.simulated ? '◎ SIM' : '— SMS NOT SENT'}
                          </span>
                        </div>
                        <div style={{ fontSize:11, color:'#e8eaed', marginBottom:3 }}>
                          {entry.event_type?.replace(/_/g,' ')}
                        </div>
                        {entry.payload && (
                          <div style={{ fontSize:10, color:'#4a5260', fontFamily:'monospace', marginBottom:3 }}>
                            {entry.payload.vehicle_reg && `${entry.payload.vehicle_reg} · `}
                            {entry.payload.location && `${entry.payload.location} · `}
                            {entry.payload.consignee && entry.payload.consignee}
                          </div>
                        )}
                        <div style={{ fontSize:9, color:'#4a5260', fontFamily:'monospace' }}>{dateStr} {timeStr}</div>
                      </div>
                    )
                  })}
                </div>

              </div>
            )
          })()}

        </div>
      </div>
    </div>
  )
}
