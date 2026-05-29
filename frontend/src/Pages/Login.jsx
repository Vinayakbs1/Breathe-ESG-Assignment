import { useState } from 'react'
import { useTheme } from '../ThemeContext'
import api from '../api'

export default function Login({ onLogin }) {
  const { t } = useTheme()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async () => {
    if (!username || !password) { setError('Please enter username and password'); return }
    setLoading(true); setError('')
    try {
      const res = await api.post('/auth/login/', { username, password })
      onLogin(res.data.user)
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid username or password')
    } finally { setLoading(false) }
  }

  const inputStyle = {
    width: '100%', padding: '11px 13px',
    border: `1.5px solid ${t.border}`, borderRadius: 8,
    fontSize: 14, boxSizing: 'border-box', outline: 'none',
    background: t.surface, color: t.text, transition: 'border-color 0.2s'
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      {/* Left — brand panel */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px 72px', background: '#0a0a0a', color: '#fff'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 64 }}>
          <span style={{ fontSize: 28 }}>🌿</span>
          <span style={{ fontSize: 20, fontWeight: 800 }}>Breathe ESG</span>
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.2, margin: '0 0 18px', letterSpacing: '-0.5px' }}>
          Emissions data,<br />audit-ready.
        </h1>
        <p style={{ fontSize: 15, color: '#737373', lineHeight: 1.7, maxWidth: 360, margin: 0 }}>
          Ingest from SAP, utility portals, and corporate travel platforms.
          Normalize, review, and sign off — every action is permanently logged.
        </p>
        <div style={{ marginTop: 52, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {[
            { icon: '🏭', label: 'SAP fuel & procurement exports' },
            { icon: '⚡', label: 'Utility portal electricity data' },
            { icon: '✈️', label: 'Corporate travel — Concur / Navan' },
          ].map(f => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                background: '#1a1a1a', border: '1px solid #2a2a2a',
                borderRadius: 8, width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0
              }}>{f.icon}</span>
              <span style={{ fontSize: 14, color: '#a3a3a3' }}>{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right — form */}
      <div style={{
        width: 460, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: t.surface, padding: '60px 52px',
        borderLeft: `1px solid ${t.border}`
      }}>
        <div style={{ width: '100%', maxWidth: 340 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: t.text, marginBottom: 6 }}>Sign in</h2>
          <p style={{ fontSize: 14, color: t.textMuted, marginBottom: 32 }}>
            Access the Breathe ESG platform
          </p>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Username
            </label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="your_username"
              autoFocus
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = t.text}
              onBlur={e => e.target.style.borderColor = t.border}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="••••••••"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = t.text}
              onBlur={e => e.target.style.borderColor = t.border}
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 13px', background: t.dangerBg,
              color: t.danger, borderRadius: 7, fontSize: 13,
              border: `1px solid ${t.danger}22`, marginBottom: 18
            }}>⚠ {error}</div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%', padding: '12px',
              background: loading ? t.textFaint : t.accent,
              color: t.accentText, border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.02em'
            }}
          >
            {loading ? 'Signing in…' : 'Sign in →'}
          </button>

          <div style={{
            marginTop: 28, padding: '12px 14px',
            background: t.bg, borderRadius: 8, fontSize: 12,
            color: t.textMuted, border: `1px solid ${t.border}`
          }}>
            <strong style={{ color: t.text }}>Demo credentials</strong><br />
            <span style={{ fontFamily: 'monospace', color: t.text }}>admin</span> / <span style={{ fontFamily: 'monospace', color: t.text }}>Admin@123</span>
            <br />
            <span style={{ fontFamily: 'monospace', color: t.text }}>analyst</span> / <span style={{ fontFamily: 'monospace', color: t.text }}>analyst123</span>
          </div>
        </div>
      </div>
    </div>
  )
}