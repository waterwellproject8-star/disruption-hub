import { createClient } from '@supabase/supabase-js'

// Server-side client (full access)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Client-side client (anon access)
export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// ── APPROVAL QUEUE ────────────────────────────────────────────────────────────
export async function queueAction(action) {
  const autoApproveThreshold = Number(process.env.AUTO_APPROVE_THRESHOLD_GBP) || 150
  const timeoutMinutes = Number(process.env.APPROVAL_TIMEOUT_MINUTES) || 30

  const requiresApproval = !action.auto_approve &&
    (action.financial_value > autoApproveThreshold || action.action_type !== 'send_sms')

  const autoApproveAt = action.auto_approve
    ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
    : null

  const { data, error } = await supabase
    .from('approvals')
    .insert({
      client_id: action.client_id,
      module_run_id: action.module_run_id,
      action_type: action.action_type,
      action_label: action.action_label,
      action_details: action.action_details,
      financial_value: action.financial_value || 0,
      requires_approval: requiresApproval,
      auto_approve_at: autoApproveAt,
      status: requiresApproval ? 'pending' : 'auto_approved'
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getPendingApprovals(clientId) {
  const { data, error } = await supabase
    .from('approvals')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function approveAction(approvalId, approvedBy = 'ops_manager') {
  const { data, error } = await supabase
    .from('approvals')
    .update({ status: 'approved', approved_by: approvedBy, approved_at: new Date().toISOString() })
    .eq('id', approvalId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function rejectAction(approvalId, reason = '') {
  const { data, error } = await supabase
    .from('approvals')
    .update({ status: 'rejected', approved_at: new Date().toISOString(), execution_result: { reason } })
    .eq('id', approvalId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function logModuleRun(clientId, module, input, output) {
  const { data, error } = await supabase
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
  const { error } = await supabase
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
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  if (error) throw error
  return data
}
