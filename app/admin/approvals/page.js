'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

const ACTION_COLORS = {
  send_sms:    { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', text: '#f59e0b', icon: '💬' },
  send_email:  { bg: 'rgba(0,229,176,0.05)',  border: 'rgba(0,229,176,0.2)',  text: '#00e5b0', icon: '✉' },
  make_call:   { bg: 'rgba(59,130,246,0.07)', border: 'rgba(59,130,246,0.2)', text: '#3b82f6', icon: '📞' },
  raise_po:    { bg: 'rgba(168,85,247,0.06)', border: 'rgba(168,85,247,0.2)', text: '#a855f7', icon: '🛒' },
  cancel_po:   { bg: 'rgba(239,68,68,0.07)',  border: 'rgba(239,68,68,0.2)',  text: '#ef4444', icon: '✕' },
  submit_tender:{ bg:'rgba(168,85,247,0.06)', border: 'rgba(168,85,247,0.2)', text: '#a855f7', icon: '🏆' },
  block_dispatch:{bg:'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', text: '#ef4444', icon: '🚫' },
  internal_flag:{ bg:'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.18)', text:'#3b82f6', icon: '🚩' },
  book_service:{ bg: 'rgba(0,229,176,0.05)',  border: 'rgba(0,229,176,0.18)', text: '#00e5b0', icon: '🔧' },
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState({})
  const [filter, setFilter] = useState('pending')
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 })

  const clientId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('client_id') || ''
    : ''

  useEffect(() => {
    loadApprovals()
    const interval = setInterval(loadApprovals, 30000) // refresh every 30s
    return () => clearInterval(interval)
  }, [filter])

  async function loadApprovals() {
    try {
      const params = new URLSearchParams({ status: filter })
      if (clientId) params.set('client_id', clientId)
      const res = await fetch(`/api/approvals?${params}`)
      const data = await res.json()
      setApprovals(data.approvals || [])
      setStats({
        pending: data.approvals?.filter(a => a.status === 'pending').length || 0,
        approved: data.approvals?.filter(a => a.status === 'approved').length || 0,
        rejected: data.approvals?.filter(a => a.status === 'rejected').length || 0,
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function act(approvalId, action, reason = '') {
    setProcessing(p => ({ ...p, [approvalId]: action }))
    try {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_id: approvalId, action, approved_by: 'ops_manager', reason })
      })
      await res.json()
      await loadApprovals()
    } catch (e) {
      console.error(e)
    } finally {
      setProcessing(p => { const n = { ...p }; delete n[approvalId]; return n })
    }
  }

  const formatCurrency = n => n ? `£${Number(n).toLocaleString()}` : '—'
  const formatTime = t => t ? new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'

  const colors = (type) => ACTION_COLORS[type] || ACTION_COLORS.send_email

  return (
    <div style={{ minHeight: '100vh', background: '#0a0c0e', color: '#e8eaed', fontFamily: 'IBM Plex Sans, sans-serif' }}>

      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,12,14,0.98)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/unlock" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <div style={{ width: 24, height: 24, background: '#00e5b0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#000', fontFamily: 'monospace' }}>DH</div>
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#8a9099' }}>DisruptionHub</span>
          </Link>
          <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Approval Queue</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {stats.pending > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 12, color: '#ef4444', fontFamily: 'monospace' }}>{stats.pending} AWAITING APPROVAL</span>
            </div>
          )}
          <button onClick={loadApprovals} style={{ fontSize: 11, color: '#4a5260', background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, padding: '5px 10px', cursor: 'pointer', fontFamily: 'monospace' }}>↺ REFRESH</button>
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 24px' }}>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {['pending', 'approved', 'rejected', 'executed', 'all'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
              fontFamily: 'monospace', letterSpacing: '0.04em', textTransform: 'uppercase',
              border: filter === f ? '1px solid #00e5b0' : '1px solid rgba(255,255,255,0.1)',
              background: filter === f ? 'rgba(0,229,176,0.1)' : 'transparent',
              color: filter === f ? '#00e5b0' : '#8a9099',
            }}>{f}</button>
          ))}
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#4a5260', fontFamily: 'monospace' }}>Loading approvals...</div>}

        {!loading && approvals.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: '#4a5260' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 32, marginBottom: 16 }}>◈</div>
            <div style={{ fontSize: 14 }}>No {filter} approvals</div>
          </div>
        )}

        {approvals.map(a => {
          const c = colors(a.action_type)
          const isPending = a.status === 'pending'
          const isProcessing = processing[a.id]

          return (
            <div key={a.id} style={{
              border: `1px solid ${c.border}`,
              borderRadius: 10,
              background: c.bg,
              marginBottom: 12,
              overflow: 'hidden',
              opacity: isPending ? 1 : 0.6
            }}>
              {/* Header */}
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>{c.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{a.action_label}</div>
                  <div style={{ fontSize: 11, color: '#8a9099', fontFamily: 'monospace' }}>
                    {a.action_type.replace(/_/g,' ').toUpperCase()}
                    {a.financial_value > 0 && <span style={{ marginLeft: 12, color: '#00e5b0' }}>£{Number(a.financial_value).toLocaleString()} value</span>}
                    <span style={{ marginLeft: 12 }}>{formatTime(a.created_at)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {a.status !== 'pending' && (
                    <span style={{
                      fontFamily: 'monospace', fontSize: 9, padding: '3px 8px', borderRadius: 10,
                      background: a.status === 'executed' ? 'rgba(0,229,176,0.15)' : a.status === 'rejected' ? 'rgba(239,68,68,0.15)' : 'rgba(0,229,176,0.1)',
                      color: a.status === 'rejected' ? '#ef4444' : '#00e5b0',
                    }}>{a.status.toUpperCase()}</span>
                  )}
                  {isPending && (
                    <>
                      <button onClick={() => act(a.id, 'approve')} disabled={!!isProcessing} style={{
                        padding: '7px 16px', borderRadius: 6, border: 'none', cursor: isProcessing ? 'default' : 'pointer',
                        background: '#00e5b0', color: '#000', fontWeight: 600, fontSize: 12, fontFamily: 'monospace',
                        opacity: isProcessing ? 0.5 : 1
                      }}>
                        {isProcessing === 'approve' ? '...' : '✓ APPROVE'}
                      </button>
                      <button onClick={() => act(a.id, 'reject')} disabled={!!isProcessing} style={{
                        padding: '7px 16px', borderRadius: 6, fontSize: 12, cursor: isProcessing ? 'default' : 'pointer',
                        border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#ef4444', fontFamily: 'monospace',
                        opacity: isProcessing ? 0.5 : 1
                      }}>
                        {isProcessing === 'reject' ? '...' : '✕ REJECT'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Details */}
              {a.action_details?.content && (
                <div style={{
                  padding: '10px 16px',
                  borderTop: '1px solid rgba(255,255,255,0.04)',
                  fontFamily: 'monospace', fontSize: 10, color: '#8a9099',
                  lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 120,
                  overflow: 'hidden'
                }}>
                  {a.action_details.content}
                </div>
              )}

              {/* Execution result */}
              {a.execution_result && (
                <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.04)', fontFamily: 'monospace', fontSize: 10, color: '#00e5b0' }}>
                  ✓ {JSON.stringify(a.execution_result).substring(0, 100)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
