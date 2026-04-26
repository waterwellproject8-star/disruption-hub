import { createClient } from '@supabase/supabase-js'

// Lazy initialisation — only create client when actually needed
// This prevents crashes when Supabase env vars are placeholders
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

function getSupabasePublic() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

let _cached = null
function getInstance() {
  if (_cached) return _cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  _cached = createClient(url, key)
  return _cached
}

export const supabase = new Proxy({}, {
  get(_, prop) {
    const instance = getInstance()
    if (!instance) return () => { throw new Error('Supabase client unavailable — check env vars') }
    return instance[prop]
  }
})

export async function queueAction(action) {
  const db = getSupabase()
  if (!db) return null

  const autoApproveThreshold = Number(process.env.AUTO_APPROVE_THRESHOLD_GBP) || 150
  const requiresApproval = !action.auto_approve &&
    (action.financial_value > autoApproveThreshold || action.action_type !== 'send_sms')

  const { data, error } = await db
    .from('approvals')
    .insert({
      client_id: action.client_id,
      module_run_id: action.module_run_id,
      action_type: action.action_type,
      action_label: action.action_label,
      action_details: action.action_details,
      financial_value: action.financial_value || 0,
      requires_approval: requiresApproval,
      status: requiresApproval ? 'pending' : 'auto_approved'
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getPendingApprovals(clientId) {
  const db = getSupabase()
  if (!db) return []

  const { data, error } = await db
    .from('approvals')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function approveAction(approvalId, approvedBy = 'ops_manager') {
  const db = getSupabase()
  if (!db) return null

  const { data, error } = await db
    .from('approvals')
    .update({ status: 'approved', approved_by: approvedBy, approved_at: new Date().toISOString() })
    .eq('id', approvalId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function rejectAction(approvalId) {
  const db = getSupabase()
  if (!db) return null

  const { data, error } = await db
    .from('approvals')
    .update({ status: 'rejected', approved_at: new Date().toISOString() })
    .eq('id', approvalId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function logModuleRun(clientId, module, input, output) {
  const db = getSupabase()
  if (!db) return null

  const { data, error } = await db
    .from('module_runs')
    .insert({
      client_id: clientId,
      module,
      input,
      output,
      severity: output?.severity || null,
      financial_impact: output?.financial_impact || output?.total_overcharge || 0,
      status: 'complete'
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function logAction(clientId, approvalId, type, details, result, success) {
  const db = getSupabase()
  if (!db) return

  const { error } = await db
    .from('action_log')
    .insert({
      client_id: clientId,
      approval_id: approvalId,
      action_type: type,
      action_details: details,
      result,
      success,
      error_message: success ? null : result?.error
    })

  if (error) console.error('Failed to log action:', error)
}

export async function getClientConfig(clientId) {
  const db = getSupabase()
  if (!db) return null

  const { data, error } = await db
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  if (error) throw error
  return data
}
