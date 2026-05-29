import { useState, useEffect } from 'react'
import { useTheme } from '../ThemeContext'
import api from '../api'

const EVENT = {
  upload:  { icon: '⬆', label: 'upload'  },
  approve: { icon: '✓', label: 'approve' },
  reject:  { icon: '✗', label: 'reject'  },
  edit:    { icon: '✏', label: 'edit'    },
}

export default function AuditLog() {
  const { t } = useTheme()
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/audit/').then(r => setLogs(r.data)).finally(() => setLoading(false))
  }, [])

  const badgeStyle = (event) => {
    const base = {
      padding: '3px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      minWidth: 80, textAlign: 'center', display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center', gap: 5,
      border: `1px solid ${t.border}`
    }
    if (event === 'approve') return { ...base, background: t.successBg, color: t.success, borderColor: `${t.success}33` }
    if (event === 'reject')  return { ...base, background: t.dangerBg, color: t.danger, borderColor: `${t.danger}33` }
    return { ...base, background: t.bg, color: t.textMuted }
  }

  if (loading) return <div style={{ padding: 40, color: t.textMuted }}>Loading audit log…</div>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 4 }}>Audit Log</h2>
        <p style={{ color: t.textMuted, fontSize: 13, margin: 0 }}>
          Immutable record of every action — never edited or deleted. Full chain of custody for auditors.
        </p>
      </div>

      <div style={{
        background: t.surface, borderRadius: 10,
        border: `1px solid ${t.border}`, overflow: 'hidden'
      }}>
        {logs.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: t.textFaint }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
            <div style={{ fontSize: 14 }}>No audit events yet.</div>
          </div>
        ) : logs.map((log, i) => {
          const ev = EVENT[log.event] || EVENT.edit
          const details = log.details || {}
          let detail = ''
          if (details.previous_status && details.new_status) {
            detail = `${details.previous_status} → ${details.new_status}`
          } else if (details.source_type) {
            detail = `${details.source_type}${details.total_rows != null ? ' · ' + details.total_rows + ' rows' : ''}`
          } else {
            detail = Object.entries(details).map(([k, v]) => `${k}: ${v}`).join(' · ')
          }

          return (
            <div key={log.id} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '13px 20px',
              borderBottom: i < logs.length - 1 ? `1px solid ${t.border}` : 'none',
            }}>
              <span style={badgeStyle(log.event)}>{ev.icon} {ev.label}</span>
              <span style={{ fontSize: 13, color: t.text, fontWeight: 600, minWidth: 110 }}>
                {log.username}
              </span>
              <span style={{ fontSize: 13, color: t.textMuted, flex: 1 }}>{detail}</span>
              <span style={{ fontSize: 11, color: t.textFaint, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {new Date(log.timestamp).toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}