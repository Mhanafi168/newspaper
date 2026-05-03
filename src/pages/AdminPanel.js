import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.js'

const ROLE_COLORS = { admin: '#c9a84c', editor: '#4ecdc4', viewer: '#95e1d3' }

export default function AdminPanel() {
  const { apiFetch, user } = useAuth()
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  async function loadUsers() {
    setLoading(true)
    try { setUsers(await apiFetch('/users')) }
    catch (e) { setMsg(e.message) }
    finally { setLoading(false) }
  }

  async function loadLogs() {
    setLoading(true)
    try { setLogs(await apiFetch('/logs')) }
    catch (e) { setMsg(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (tab === 'users') loadUsers()
    if (tab === 'logs') loadLogs()
  }, [tab])

  async function changeRole(userId, role) {
    try {
      await apiFetch(`/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) })
      setMsg('Role updated')
      setTimeout(() => setMsg(''), 3000)
      loadUsers()
    } catch (e) { setMsg(e.message) }
  }

  async function toggleStatus(userId) {
    try { await apiFetch(`/users/${userId}/status`, { method: 'PATCH' }); loadUsers() }
    catch (e) { setMsg(e.message) }
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h2>Admin Control Panel</h2>
        {msg && <span className="toast-inline">{msg}</span>}
      </div>

      <div className="admin-tabs">
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>👥 Users</button>
        <button className={tab === 'logs' ? 'active' : ''} onClick={() => setTab('logs')}>📋 Audit Logs</button>
      </div>

      {tab === 'users' && (
        loading ? <p className="loading">Loading…</p> : (
          <table className="user-table">
            <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className={!u.isActive ? 'inactive-row' : ''}>
                  <td>
                    <div className="table-user">
                      <div className="tiny-avatar" style={{ background: ROLE_COLORS[u.role] }}>{u.username[0].toUpperCase()}</div>
                      {u.username}
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <select value={u.role} onChange={e => changeRole(u.id, e.target.value)}
                      disabled={u.id === user.id} className="role-select"
                      style={{ '--c': ROLE_COLORS[u.role] }}>
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td><span className={`status-dot ${u.isActive ? 'active' : 'inactive'}`}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td>{u.id !== user.id && (
                    <button className="toggle-btn" onClick={() => toggleStatus(u.id)}>
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {tab === 'logs' && (
        loading ? <p className="loading">Loading…</p> : (
          <div className="log-list">
            {logs.map(log => (
              <div key={log.id} className={`log-item ${log.action.includes('FAIL') || log.action.includes('DENIED') || log.action.includes('DELETE') ? 'log-warn' : 'log-ok'}`}>
                <div className="log-action">{log.action}</div>
                <div className="log-meta">
                  <span>User: {log.userId?.slice(0, 8)}…</span>
                  <span>{new Date(log.timestamp).toLocaleString()}</span>
                </div>
                {Object.keys(log.details).length > 0 && (
                  <div className="log-details">{JSON.stringify(log.details)}</div>
                )}
              </div>
            ))}
            {logs.length === 0 && <p className="empty">No audit logs yet.</p>}
          </div>
        )
      )}
    </div>
  )
}
