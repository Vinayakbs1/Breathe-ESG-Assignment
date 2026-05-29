import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ThemeProvider } from './ThemeContext'
import Login      from './Pages/Login'
import Dashboard  from './Pages/Dashboard'
import Upload     from './Pages/Upload'
import AuditLog   from './Pages/AuditLog'
import AdminPanel from './Pages/AdminPanel'
import Landing    from './Pages/Landing'
import Layout     from './components/Layout'
import api        from './api'

function AppRoutes() {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/csrf/').then(() => {
      api.get('/auth/me/')
        .then(res => setUser(res.data))
        .catch(() => setUser(null))
        .finally(() => setLoading(false))
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontSize: 15, color: '#737373', fontFamily: '-apple-system, sans-serif'
    }}>
      Loading…
    </div>
  )

  const isAdmin   = user?.role === 'admin'
  const isAnalyst = user && !isAdmin

  return (
    <Routes>
      <Route path="/landing" element={<Landing />} />
      <Route path="/login" element={
        user ? <Navigate to="/" /> : <Login onLogin={setUser} />
      } />

      <Route path="/" element={
        !user
          ? <Landing />
          : isAdmin
            ? <Navigate to="/admin" />
            : <Layout user={user} onLogout={() => setUser(null)}>
                <Dashboard />
              </Layout>
      } />

      {isAnalyst && (
        <Route element={<Layout user={user} onLogout={() => setUser(null)} />}>
          <Route path="/upload" element={<Upload />} />
          <Route path="/audit"  element={<AuditLog />} />
        </Route>
      )}

      {isAdmin && (
        <Route element={<Layout user={user} onLogout={() => setUser(null)} />}>
          <Route path="/admin" element={<AdminPanel />} />
        </Route>
      )}

      {!user && <Route path="*" element={<Navigate to="/login" />} />}
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppRoutes />
    </ThemeProvider>
  )
}