import { useState, useEffect } from 'react'
import { useTheme } from '../ThemeContext'
import api from '../api'

function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        background: 'white', borderRadius: 12, padding: 32,
        width: 480, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>{title}</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 20,
            cursor: 'pointer', color: '#94a3b8'
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      <input style={{
        width: '100%', padding: '10px 12px',
        border: '1px solid #e2e8f0', borderRadius: 8,
        fontSize: 14, boxSizing: 'border-box'
      }} {...props} />
    </div>
  )
}

function Select({ label, options, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      <select style={{
        width: '100%', padding: '10px 12px',
        border: '1px solid #e2e8f0', borderRadius: 8,
        fontSize: 14, background: 'white', boxSizing: 'border-box'
      }} {...props}>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

export default function AdminPanel() {
  const [tab, setTab]           = useState('tenants')
  const [tenants, setTenants]   = useState([])
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  // Create modals
  const [showTenantModal, setShowTenantModal] = useState(false)
  const [showUserModal, setShowUserModal]     = useState(false)

  // Edit modals
  const [editTenant, setEditTenant] = useState(null)  // tenant object being edited
  const [editUser, setEditUser]     = useState(null)   // user object being edited

  // Create forms
  const [tenantName, setTenantName] = useState('')
  const [newUser, setNewUser] = useState({
    username: '', password: '', email: '', role: 'analyst', tenant_id: ''
  })

  // Edit forms
  const [editTenantName, setEditTenantName] = useState('')
  const [editUserEmail, setEditUserEmail]   = useState('')
  const [editUserTenant, setEditUserTenant] = useState('')

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [t, u] = await Promise.all([
        api.get('/admin/tenants/'),
        api.get('/admin/users/'),
      ])
      setTenants(t.data)
      setUsers(u.data)
    } catch (e) {
      console.error('Admin panel fetch error:', e)
      setError('Failed to load data. Make sure you are logged in as admin.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const flash = (msg, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(''), 4000) }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 4000) }
  }

  // ── Tenant CRUD ──
  const createTenant = async () => {
    if (!tenantName.trim()) return
    try {
      await api.post('/admin/tenants/', { name: tenantName })
      flash('Tenant "' + tenantName + '" created!')
      setTenantName('')
      setShowTenantModal(false)
      fetchAll()
    } catch (e) {
      flash(e.response?.data?.error || 'Failed to create tenant', true)
    }
  }

  const openEditTenant = (t) => {
    setEditTenant(t)
    setEditTenantName(t.name)
  }

  const saveEditTenant = async () => {
    if (!editTenantName.trim()) return
    try {
      await api.patch('/admin/tenants/' + editTenant.id + '/', { name: editTenantName })
      flash('Tenant updated!')
      setEditTenant(null)
      fetchAll()
    } catch (e) {
      flash(e.response?.data?.error || 'Failed to update tenant', true)
    }
  }

  const deleteTenant = async (id, name) => {
    if (!window.confirm('Delete tenant "' + name + '" and ALL their data? This cannot be undone.')) return
    try {
      await api.delete('/admin/tenants/' + id + '/')
      flash('Tenant "' + name + '" deleted')
      fetchAll()
    } catch (e) {
      flash('Failed to delete tenant', true)
    }
  }

  // ── User CRUD ──
  const createUser = async () => {
    if (!newUser.username || !newUser.password) {
      flash('Username and password are required', true)
      return
    }
    if (newUser.role === 'analyst' && !newUser.tenant_id) {
      flash('Analysts must be assigned to a tenant', true)
      return
    }
    try {
      await api.post('/admin/users/', newUser)
      flash('User "' + newUser.username + '" created!')
      setNewUser({ username: '', password: '', email: '', role: 'analyst', tenant_id: '' })
      setShowUserModal(false)
      fetchAll()
    } catch (e) {
      flash(e.response?.data?.error || 'Failed to create user', true)
    }
  }

  const openEditUser = (u) => {
    setEditUser(u)
    setEditUserEmail(u.email || '')
    setEditUserTenant(u.tenant_id || '')
  }

  const saveEditUser = async () => {
    try {
      await api.patch('/admin/users/' + editUser.id + '/', {
        email: editUserEmail,
        tenant_id: editUserTenant || null,
      })
      flash('User "' + editUser.username + '" updated!')
      setEditUser(null)
      fetchAll()
    } catch (e) {
      flash(e.response?.data?.error || 'Failed to update user', true)
    }
  }

  const deleteUser = async (id, username) => {
    if (!window.confirm('Delete user "' + username + '"?')) return
    try {
      await api.delete('/admin/users/' + id + '/')
      flash('User "' + username + '" deleted')
      fetchAll()
    } catch (e) {
      flash(e.response?.data?.error || 'Failed to delete user', true)
    }
  }

  // ── Styles ──
  const tabStyle = (t) => ({
    padding: '10px 24px', border: 'none', cursor: 'pointer',
    fontWeight: 500, fontSize: 14, borderBottom: '2px solid',
    borderColor: tab === t ? '#4f46e5' : 'transparent',
    color: tab === t ? '#4f46e5' : '#64748b',
    background: 'transparent'
  })

  const btnPrimary = {
    background: '#4f46e5', color: 'white', border: 'none',
    padding: '8px 18px', borderRadius: 8,
    fontSize: 13, fontWeight: 500, cursor: 'pointer'
  }

  const editBtnStyle = {
    background: '#eef2ff', color: '#4f46e5',
    border: '1px solid #c7d2fe',
    padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer'
  }

  const deleteBtnStyle = {
    background: '#fef2f2', color: '#ef4444',
    border: '1px solid #fecaca',
    padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer'
  }

  if (loading) return <div style={{ padding: 40, color: '#64748b' }}>Loading admin panel...</div>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Admin Panel</h2>
        <p style={{ color: '#64748b', fontSize: 14 }}>
          Manage tenants (client companies) and their users
        </p>
      </div>

      {error && (
        <div style={{
          background: '#fef2f2', color: '#ef4444', padding: '12px 16px',
          borderRadius: 8, marginBottom: 16, fontSize: 14
        }}>{error}</div>
      )}
      {success && (
        <div style={{
          background: '#f0fdf4', color: '#16a34a', padding: '12px 16px',
          borderRadius: 8, marginBottom: 16, fontSize: 14
        }}>{success}</div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Tenants', value: tenants.length, color: '#4f46e5' },
          { label: 'Total Users', value: users.length, color: '#0ea5e9' },
          { label: 'Total Records', value: tenants.reduce((s, t) => s + t.record_count, 0), color: '#10b981' },
        ].map(c => (
          <div key={c.label} style={{
            background: 'white', borderRadius: 10, padding: '20px 24px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: '4px solid ' + c.color
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{
        background: 'white', borderRadius: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex', borderBottom: '1px solid #f1f5f9',
          padding: '0 16px', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <button style={tabStyle('tenants')} onClick={() => setTab('tenants')}>
              Tenants ({tenants.length})
            </button>
            <button style={tabStyle('users')} onClick={() => setTab('users')}>
              Users ({users.length})
            </button>
          </div>
          <div style={{ padding: '8px 0' }}>
            {tab === 'tenants' && (
              <button style={btnPrimary} onClick={() => setShowTenantModal(true)}>
                + New Tenant
              </button>
            )}
            {tab === 'users' && (
              <button style={btnPrimary} onClick={() => setShowUserModal(true)}>
                + New User
              </button>
            )}
          </div>
        </div>

        {/* ── Tenants Table ── */}
        {tab === 'tenants' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Company Name', 'Slug', 'Users', 'Records', 'Created', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left',
                    fontSize: 12, fontWeight: 600, color: '#64748b',
                    textTransform: 'uppercase', letterSpacing: '0.05em'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                  No tenants yet. Create one to start onboarding a client.
                </td></tr>
              ) : tenants.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 500 }}>{t.name}</td>
                  <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>
                    {t.slug}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      background: '#ede9fe', color: '#5b21b6',
                      padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500
                    }}>{t.user_count} users</span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      background: '#dbeafe', color: '#1e40af',
                      padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500
                    }}>{t.record_count} records</span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: '#64748b' }}>
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openEditTenant(t)} style={editBtnStyle}>Edit</button>
                      <button onClick={() => deleteTenant(t.id, t.name)} style={deleteBtnStyle}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ── Users Table ── */}
        {tab === 'users' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Username', 'Email', 'Role', 'Tenant', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left',
                    fontSize: 12, fontWeight: 600, color: '#64748b',
                    textTransform: 'uppercase', letterSpacing: '0.05em'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                  No users yet.
                </td></tr>
              ) : users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 500 }}>{u.username}</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: '#64748b' }}>
                    {u.email || '—'}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      background: u.role === 'admin' ? '#fef3c7' : '#dcfce7',
                      color: u.role === 'admin' ? '#92400e' : '#166534',
                      padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500
                    }}>{u.role === 'admin' ? 'platform admin' : u.role}</span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13 }}>
                    {u.tenant_name === 'Platform'
                      ? <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>—</span>
                      : u.tenant_name}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: '#64748b' }}>
                    {new Date(u.date_joined).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {u.role !== 'admin' && (
                        <button onClick={() => openEditUser(u)} style={editBtnStyle}>Edit</button>
                      )}
                      <button onClick={() => deleteUser(u.id, u.username)} style={deleteBtnStyle}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Create Tenant Modal ── */}
      {showTenantModal && (
        <Modal title="Create New Tenant" onClose={() => setShowTenantModal(false)}>
          <Input
            label="Company Name"
            placeholder="e.g. Green Energy Ltd"
            value={tenantName}
            onChange={e => setTenantName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createTenant()}
            autoFocus
          />
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 20 }}>
            Slug will be auto-generated from the name
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowTenantModal(false)} style={{
              background: '#f1f5f9', color: '#374151', border: 'none',
              padding: '10px 20px', borderRadius: 8, fontSize: 14, cursor: 'pointer'
            }}>Cancel</button>
            <button onClick={createTenant} style={btnPrimary}>Create Tenant</button>
          </div>
        </Modal>
      )}

      {/* ── Edit Tenant Modal ── */}
      {editTenant && (
        <Modal title="Edit Tenant" onClose={() => setEditTenant(null)}>
          <Input
            label="Company Name"
            value={editTenantName}
            onChange={e => setEditTenantName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveEditTenant()}
            autoFocus
          />
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 20 }}>
            Slug will be re-generated from the updated name
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditTenant(null)} style={{
              background: '#f1f5f9', color: '#374151', border: 'none',
              padding: '10px 20px', borderRadius: 8, fontSize: 14, cursor: 'pointer'
            }}>Cancel</button>
            <button onClick={saveEditTenant} style={btnPrimary}>Save Changes</button>
          </div>
        </Modal>
      )}

      {/* ── Create User Modal ── */}
      {showUserModal && (
        <Modal title="Create New User" onClose={() => setShowUserModal(false)}>
          <Input
            label="Username"
            placeholder="e.g. john_analyst"
            value={newUser.username}
            onChange={e => setNewUser({ ...newUser, username: e.target.value })}
            autoFocus
          />
          <Input
            label="Password"
            type="password"
            placeholder="Min 8 characters recommended"
            value={newUser.password}
            onChange={e => setNewUser({ ...newUser, password: e.target.value })}
          />
          <Input
            label="Email (optional)"
            type="email"
            placeholder="john@company.com"
            value={newUser.email}
            onChange={e => setNewUser({ ...newUser, email: e.target.value })}
          />
          <Select
            label="Role"
            value={newUser.role}
            onChange={e => setNewUser({ ...newUser, role: e.target.value })}
            options={[
              { value: 'analyst', label: 'Analyst — Can review and approve records' },
            ]}
          />
          <Select
            label="Tenant (Company)"
            value={newUser.tenant_id}
            onChange={e => setNewUser({ ...newUser, tenant_id: e.target.value })}
            options={[
              { value: '', label: '-- Select a company --' },
              ...tenants.map(t => ({ value: t.id, label: t.name }))
            ]}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowUserModal(false)} style={{
              background: '#f1f5f9', color: '#374151', border: 'none',
              padding: '10px 20px', borderRadius: 8, fontSize: 14, cursor: 'pointer'
            }}>Cancel</button>
            <button onClick={createUser} style={btnPrimary}>Create User</button>
          </div>
        </Modal>
      )}

      {/* ── Edit User Modal ── */}
      {editUser && (
        <Modal title={'Edit User: ' + editUser.username} onClose={() => setEditUser(null)}>
          <div style={{
            background: '#f8fafc', padding: '10px 14px', borderRadius: 8,
            marginBottom: 16, fontSize: 13, color: '#64748b'
          }}>
            Username: <strong>{editUser.username}</strong> · Role: <strong>{editUser.role}</strong>
          </div>
          <Input
            label="Email"
            type="email"
            placeholder="john@company.com"
            value={editUserEmail}
            onChange={e => setEditUserEmail(e.target.value)}
          />
          <Select
            label="Tenant (Company)"
            value={editUserTenant}
            onChange={e => setEditUserTenant(e.target.value)}
            options={[
              { value: '', label: '-- No tenant --' },
              ...tenants.map(t => ({ value: t.id, label: t.name }))
            ]}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditUser(null)} style={{
              background: '#f1f5f9', color: '#374151', border: 'none',
              padding: '10px 20px', borderRadius: 8, fontSize: 14, cursor: 'pointer'
            }}>Cancel</button>
            <button onClick={saveEditUser} style={btnPrimary}>Save Changes</button>
          </div>
        </Modal>
      )}
    </div>
  )
}