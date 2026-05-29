import { useState, useEffect } from 'react'
import { useTheme } from '../ThemeContext'
import api from '../api'

function StatCard({ label, value }) {
  const { t } = useTheme()
  return (
    <div style={{
      background: t.surface, borderRadius: 10, padding: '18px 22px',
      boxShadow: t.shadow, border: `1px solid ${t.border}`
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: t.text, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: t.textMuted, marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  )
}

export default function Dashboard() {
  const { t } = useTheme()
  const [stats, setStats]       = useState(null)
  const [records, setRecords]   = useState([])
  const [filter, setFilter]     = useState('all')
  const [source, setSource]     = useState('all')
  const [loading, setLoading]   = useState(true)
  const [updating, setUpdating] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [bulking, setBulking]   = useState(false)

  const fetchStats   = () => api.get('/dashboard/').then(r => setStats(r.data))
  const fetchRecords = () => {
    let url = '/records/?'
    if (filter !== 'all') url += `status=${filter}&`
    if (source !== 'all') url += `source_type=${source}&`
    return api.get(url).then(r => { setRecords(r.data); setSelected(new Set()) })
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchStats(), fetchRecords()]).finally(() => setLoading(false))
  }, [filter, source])

  const handleStatus = async (id, newStatus) => {
    setUpdating(id)
    try {
      await api.patch(`/records/${id}/`, { status: newStatus })
      await Promise.all([fetchStats(), fetchRecords()])
    } catch { alert('Failed to update record') }
    finally { setUpdating(null) }
  }

  const actionable = records.filter(r => r.status === 'pending' || r.status === 'suspicious')
  const selectedActionable = [...selected].filter(id => actionable.some(r => r.id === id))
  const allActionableSelected = actionable.length > 0 && actionable.every(r => selected.has(r.id))

  const toggleAll = () => {
    setSelected(allActionableSelected ? new Set() : new Set(actionable.map(r => r.id)))
  }
  const toggleOne = (id) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const bulkAction = async (newStatus) => {
    if (!selectedActionable.length) return
    setBulking(true)
    try {
      await Promise.all(selectedActionable.map(id => api.patch(`/records/${id}/`, { status: newStatus })))
      await Promise.all([fetchStats(), fetchRecords()])
    } catch { alert('Bulk action failed') }
    finally { setBulking(false) }
  }

  const selectStyle = {
    padding: '6px 10px', borderRadius: 6, fontSize: 13,
    border: `1px solid ${t.border}`, background: t.surface,
    color: t.text, outline: 'none'
  }

  const statusLabel = { pending: 'Pending', suspicious: 'Suspicious', approved: 'Approved', rejected: 'Rejected' }
  const statusStyle = (s) => {
    const base = { padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600, letterSpacing: '0.02em' }
    if (s === 'approved')   return { ...base, background: t.successBg, color: t.success }
    if (s === 'rejected')   return { ...base, background: t.bg, color: t.textMuted, border: `1px solid ${t.border}` }
    if (s === 'suspicious') return { ...base, background: t.dangerBg, color: t.danger }
    return { ...base, background: t.warnBg, color: t.warn }
  }

  const scopeStyle = (s) => ({
    padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
    background: t.bg, color: t.textMuted, border: `1px solid ${t.border}`
  })

  if (loading) return <div style={{ padding: 40, color: t.textMuted }}>Loading…</div>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 4 }}>Dashboard</h2>
        <p style={{ color: t.textMuted, fontSize: 13, margin: 0 }}>
          Review incoming emissions records and approve or reject before they're locked for audit.
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
          <StatCard label="Total"     value={stats.total} />
          <StatCard label="Pending"   value={stats.pending} />
          <StatCard label="Suspicious" value={stats.suspicious} />
          <StatCard label="Approved"  value={stats.approved} />
          <StatCard label="Rejected"  value={stats.rejected} />
        </div>
      )}

      {/* Filters + bulk bar */}
      <div style={{
        background: t.surface, borderRadius: 8, padding: '10px 16px',
        marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center',
        border: `1px solid ${t.border}`, flexWrap: 'wrap'
      }}>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="suspicious">Suspicious</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={source} onChange={e => setSource(e.target.value)} style={selectStyle}>
          <option value="all">All Sources</option>
          <option value="sap">SAP</option>
          <option value="utility">Utility</option>
          <option value="travel">Travel</option>
        </select>
        <span style={{ fontSize: 12, color: t.textFaint }}>{records.length} records</span>

        {selectedActionable.length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: t.textMuted }}>{selectedActionable.length} selected</span>
            <button onClick={() => bulkAction('approved')} disabled={bulking} style={{
              background: t.accent, color: t.accentText, border: 'none',
              padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', opacity: bulking ? 0.5 : 1
            }}>✓ Approve all</button>
            <button onClick={() => bulkAction('rejected')} disabled={bulking} style={{
              background: t.surface, color: t.danger,
              border: `1px solid ${t.danger}55`,
              padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', opacity: bulking ? 0.5 : 1
            }}>✗ Reject all</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{
        background: t.surface, borderRadius: 10,
        border: `1px solid ${t.border}`, overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: t.bg, borderBottom: `1px solid ${t.border}` }}>
              <th style={{ padding: '11px 14px', width: 36 }}>
                <input type="checkbox" checked={allActionableSelected} onChange={toggleAll}
                  disabled={!actionable.length} style={{ cursor: 'pointer', accentColor: t.text }} />
              </th>
              {['Source','Category','Raw','Normalized','Scope','Flag','Status','Action'].map(h => (
                <th key={h} style={{
                  padding: '11px 14px', textAlign: 'left', fontSize: 11,
                  fontWeight: 700, color: t.textMuted,
                  textTransform: 'uppercase', letterSpacing: '0.06em'
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 60, textAlign: 'center', color: t.textFaint, fontSize: 14 }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
                  No records found.
                </td>
              </tr>
            ) : records.map(r => {
              const isActionable = r.status === 'pending' || r.status === 'suspicious'
              const isChecked    = selected.has(r.id)
              return (
                <tr key={r.id} style={{
                  borderBottom: `1px solid ${t.border}`,
                  background: isChecked ? (t.bg) : t.surface,
                  transition: 'background 0.1s'
                }}>
                  <td style={{ padding: '10px 14px' }}>
                    {isActionable && (
                      <input type="checkbox" checked={isChecked} onChange={() => toggleOne(r.id)}
                        style={{ cursor: 'pointer', accentColor: t.text }} />
                    )}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                      background: t.bg, color: t.textMuted,
                      padding: '2px 8px', borderRadius: 4,
                      border: `1px solid ${t.border}`
                    }}>{r.batch_info.source_type.toUpperCase()}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: t.text }}>
                    {r.category.replace(/_/g,' ')}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'monospace', color: t.text }}>
                    {r.raw_value} <span style={{ color: t.textFaint }}>{r.raw_unit}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'monospace', color: t.text }}>
                    {r.normalized_value} <span style={{ color: t.textFaint }}>{r.normalized_unit}</span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={scopeStyle(r.scope)}>{r.scope}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: t.danger, maxWidth: 160 }}>
                    {r.flag_reason
                      ? <span title={r.flag_reason}>⚠ {r.flag_reason.length > 26 ? r.flag_reason.slice(0,26)+'…' : r.flag_reason}</span>
                      : <span style={{ color: t.textFaint }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={statusStyle(r.status)}>{statusLabel[r.status] || r.status}</span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {isActionable ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => handleStatus(r.id, 'approved')} disabled={updating === r.id}
                          style={{
                            background: t.accent, color: t.accentText, border: 'none',
                            padding: '4px 10px', borderRadius: 5, fontSize: 12,
                            fontWeight: 600, cursor: 'pointer', opacity: updating === r.id ? 0.4 : 1
                          }}>✓</button>
                        <button onClick={() => handleStatus(r.id, 'rejected')} disabled={updating === r.id}
                          style={{
                            background: t.surface, color: t.danger,
                            border: `1px solid ${t.border}`,
                            padding: '4px 10px', borderRadius: 5, fontSize: 12,
                            fontWeight: 600, cursor: 'pointer', opacity: updating === r.id ? 0.4 : 1
                          }}>✗</button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: t.textFaint }}>
                        {r.reviewed_by_name ? `by ${r.reviewed_by_name}` : 'Locked'}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}