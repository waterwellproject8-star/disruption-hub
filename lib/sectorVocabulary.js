export const SECTOR_VOCAB = {
  haulage: {
    payload: 'cargo',
    delivery_recipient: 'consignee',
    delivery_recipient_short: 'consignee',
    delivery_recipient_polite: 'goods-in team',
    delay_subject: 'delivery',
    breach_consequence_label: 'SLA risk',
    voice_intro_breakdown: 'vehicle has experienced a mechanical issue and will be delayed',
    voice_intro_delay: 'your delivery from vehicle',
    voice_topic: 'delivery',
    cargo_check_phrase: 'Check yourself and cargo',
    cargo_compromise_phrase: 'Treat cargo as potentially compromised',
    load_weight_phrase: 'Do NOT continue on a deflating tyre at this load weight',
    load_movement_phrase: 'load movement detected. Check your load',
    cargo_door_phrase: 'cargo door is open. Please check your load',
    cargo_temp_phrase: 'cargo is temperature sensitive',
    return_to_base_phrase: 'Return goods to depot. Secure the load',
    delivery_refused_phrase: 'Delivery refused at',
    voice_company_role: 'goods-in team at',
    failed_delivery_voice: 'we were unable to complete your delivery today',
    voice_fallback_name: 'your delivery contact',
    scheduled_delay: 'Your scheduled delivery is running late.',
    delivery_ref_label: 'Delivery reference'
  },
  psv: {
    payload: 'passengers',
    delivery_recipient: 'booking contact',
    delivery_recipient_short: 'contact',
    delivery_recipient_polite: 'reception',
    delay_subject: 'service',
    breach_consequence_label: 'Service disruption',
    voice_intro_breakdown: 'vehicle has experienced a mechanical issue. Service will be delayed',
    voice_intro_delay: 'your service on vehicle',
    voice_topic: 'service',
    cargo_check_phrase: 'Check yourself and passengers',
    cargo_compromise_phrase: 'Ensure passenger welfare',
    load_weight_phrase: 'Do NOT continue on a deflating tyre with passengers on board',
    load_movement_phrase: 'unusual movement detected. Check passengers and vehicle',
    cargo_door_phrase: 'door is open. Please check passenger area',
    cargo_temp_phrase: 'climate control issue reported',
    return_to_base_phrase: 'Return to depot. Ensure all passengers safely disembarked',
    delivery_refused_phrase: 'Service refused at',
    voice_company_role: 'reception at',
    failed_delivery_voice: 'we were unable to complete your scheduled service today',
    voice_fallback_name: 'your service contact',
    scheduled_delay: 'Your scheduled service is running late.',
    delivery_ref_label: 'Service reference'
  }
}

SECTOR_VOCAB.coach = { ...SECTOR_VOCAB.psv }
SECTOR_VOCAB.lgv = { ...SECTOR_VOCAB.haulage }

export function vocabFor(sector) {
  return SECTOR_VOCAB[sector] || SECTOR_VOCAB.haulage
}
