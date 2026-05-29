import { Link, Outlet, useLocation } from 'react-router-dom'
import { useTheme } from '../ThemeContext'
import api from '../api'

export default function Layout({ user, onLogout, children }) {
  const { t, dark, toggle } = useTheme()
  const location = useLocation()
  const isAdmin  = user.role === 'admin'

  const handleLogout = () => api.post('/auth/logout/').finally(() => onLogout())

  const navLink = (path, label) => {
    const active = location.pathname === path
    return (
      <Link to={path} style={{
        textDecoration: 'none',
        padding: '5px 12px', borderRadius: 6,
        fontSize: 13, fontWeight: active ? 600 : 400,
        background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
        color: active ? t.navActive : t.navText,
        transition: 'all 0.15s', letterSpacing: '0.01em'
      }}>{label}</Link>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: t.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Navbar */}
      <nav style={{
        background: t.navBg, padding: '0 24px',
        display: 'flex', alignItems: 'center', height: 54, gap: 4,
        borderBottom: `1px solid ${dark ? '#1a1a1a' : '#000'}`,
        position: 'sticky', top: 0, zIndex: 100
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 24 }}>
          <span style={{ fontSize: 18 }}>🌿</span>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: '-0.2px' }}>
            Breathe ESG
          </span>
        </div>

        {isAdmin
          ? navLink('/admin', 'Admin Panel')
          : <>
              {navLink('/', 'Dashboard')}
              {navLink('/upload', 'Upload')}
              {navLink('/audit', 'Audit Log')}
            </>
        }

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Dark mode toggle */}
          <button onClick={toggle} title={dark ? 'Switch to light mode' : 'Switch to dark mode'} style={{
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
            color: t.navText, width: 32, height: 32, borderRadius: 6,
            cursor: 'pointer', fontSize: 14, display: 'flex',
            alignItems: 'center', justifyContent: 'center'
          }}>
            {dark ? '☀' : '◐'}
          </button>

          {/* User info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(255,255,255,0.14)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff'
            }}>
              {user.username[0].toUpperCase()}
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>
                {user.username}
              </div>
              <div style={{ color: t.navMuted, fontSize: 10, lineHeight: 1.3 }}>
                {isAdmin ? 'Platform Admin' : `${user.role}${user.tenant?.name ? ' · ' + user.tenant.name : ''}`}
              </div>
            </div>
          </div>

          {/* Logout */}
          <button onClick={handleLogout} style={{
            background: 'transparent', color: t.navText,
            border: '1px solid rgba(255,255,255,0.15)',
            padding: '5px 12px', borderRadius: 6, fontSize: 12,
            fontWeight: 500, cursor: 'pointer'
          }}>
            Logout
          </button>
        </div>
      </nav>

      <main style={{ padding: '28px 32px', maxWidth: 1360, margin: '0 auto' }}>
        {children}
        <Outlet />
      </main>
    </div>
  )
}