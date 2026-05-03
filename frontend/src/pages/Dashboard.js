import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const API = 'http://localhost:4000/api';
const ROLE_COLORS = { admin: '#c9a84c', editor: '#4ecdc4', viewer: '#95e1d3' };

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr);
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── News Feed ────────────────────────────────────────────────────────────────
function NewsFeed({ onReadArticle }) {
  const { apiFetch, can } = useAuth();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/articles')
      .then(setArticles)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const published = articles.filter((a) => a.status === 'published');
  const drafts = articles.filter((a) => a.status === 'draft');

  if (loading) return <div className="feed-loading"><div className="feed-spinner" />Loading latest articles…</div>;
  if (error) return <div className="feed-error">⚠ {error}</div>;

  return (
    <div className="newsfeed">
      {published.length === 0 && drafts.length === 0 && (
        <div className="empty-feed">
          <p className="empty-icon">📰</p>
          <p>No articles published yet.</p>
          {can('write') && <p>Be the first to write one!</p>}
        </div>
      )}

      {published.length > 0 && (
        <div className="article-section">
          <div className="section-header">
            <span className="section-dot published" />
            Published — {published.length} article{published.length !== 1 ? 's' : ''}
          </div>
          <div className="article-grid">
            {published.map((a, i) => (
              <ArticleCard key={a.id} article={a} index={i} onClick={() => onReadArticle(a)} />
            ))}
          </div>
        </div>
      )}

      {drafts.length > 0 && can('write') && (
        <div className="article-section">
          <div className="section-header">
            <span className="section-dot draft" />
            Drafts — visible to editors and admins only
          </div>
          <div className="article-grid">
            {drafts.map((a, i) => (
              <ArticleCard key={a.id} article={a} index={i} onClick={() => onReadArticle(a)} isDraft />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ArticleCard({ article, index, onClick, isDraft }) {
  const preview = article.content.slice(0, 120) + (article.content.length > 120 ? '…' : '');
  return (
    <div className="article-card" style={{ animationDelay: `${index * 0.07}s` }} onClick={onClick}>
      <div className="card-top">
        <span className={`status-pill ${isDraft ? 'draft' : 'published'}`}>
          {isDraft ? 'Draft' : 'Published'}
        </span>
        <span className="card-time">{timeAgo(article.createdAt)}</span>
      </div>
      <h3 className="card-title">{article.title}</h3>
      <p className="card-preview">{preview}</p>
      <div className="card-footer">
        <span className="card-author">By {article.authorName}</span>
        <span className="read-more">Read →</span>
      </div>
    </div>
  );
}

// ─── Article View ─────────────────────────────────────────────────────────────
function ArticleView({ article, onBack, onDeleted, onEdited }) {
  const { can, user, apiFetch } = useAuth();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: article.title, content: article.content });

  const isOwner = user.id === article.authorId;
  const canEdit = can('write') && (isOwner || user.role === 'admin');
  const canDelete = can('delete_post') && (isOwner || user.role === 'admin');
  const canPublish = can('publish');

  async function toggleStatus() {
    setLoading(true);
    try {
      const updated = await apiFetch(`/articles/${article.id}/status`, { method: 'PATCH' });
      setMsg(`Article ${updated.status === 'published' ? 'published' : 'unpublished'}!`);
      setTimeout(() => setMsg(''), 3000);
      onEdited({ ...article, status: updated.status });
    } catch (e) { setMsg(e.message); }
    finally { setLoading(false); }
  }

  async function deleteArticle() {
    if (!window.confirm('Delete this article permanently?')) return;
    setLoading(true);
    try {
      await apiFetch(`/articles/${article.id}`, { method: 'DELETE' });
      onDeleted(article.id);
    } catch (e) { setMsg(e.message); }
    finally { setLoading(false); }
  }

  async function saveEdit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await apiFetch(`/articles/${article.id}`, {
        method: 'PATCH', body: JSON.stringify(form),
      });
      setMsg('Saved!');
      setEditing(false);
      onEdited(updated);
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { setMsg(e.message); }
    finally { setLoading(false); }
  }

  if (editing) return (
    <div className="article-view">
      <button className="back-btn" onClick={() => setEditing(false)}>← Cancel</button>
      <h2 className="edit-heading">Edit Article</h2>
      <form onSubmit={saveEdit} className="edit-form">
        <div className="field">
          <label>Title</label>
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
        </div>
        <div className="field">
          <label>Content</label>
          <textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} rows={12} required />
        </div>
        {msg && <div className="toast-inline">{msg}</div>}
        <div className="edit-actions">
          <button type="submit" className="btn-publish" disabled={loading}>
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="article-view">
      <button className="back-btn" onClick={onBack}>← Back to Feed</button>
      <div className="article-meta-top">
        <span className={`status-pill ${article.status}`}>{article.status}</span>
        <span className="card-time">{timeAgo(article.createdAt)}</span>
        {msg && <span className="toast-inline">{msg}</span>}
      </div>
      <h1 className="article-title">{article.title}</h1>
      <p className="article-byline">
        By <strong>{article.authorName}</strong> · {new Date(article.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
      <div className="article-divider" />
      <div className="article-body">{article.content}</div>
      <div className="article-divider" />
      {(canEdit || canDelete || canPublish) && (
        <div className="article-actions">
          {canEdit && <button className="btn-edit" onClick={() => setEditing(true)} disabled={loading}>✎ Edit</button>}
          {canPublish && (
            <button className="btn-publish" onClick={toggleStatus} disabled={loading}>
              {loading ? '…' : article.status === 'published' ? '⊘ Unpublish' : '⊙ Publish'}
            </button>
          )}
          {canDelete && <button className="btn-delete" onClick={deleteArticle} disabled={loading}>✕ Delete</button>}
        </div>
      )}
    </div>
  );
}

// ─── Write Article ────────────────────────────────────────────────────────────
function WriteArticle({ onPublished }) {
  const { apiFetch } = useAuth();
  const [form, setForm] = useState({ title: '', content: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handle = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const article = await apiFetch('/articles', { method: 'POST', body: JSON.stringify(form) });
      setSuccess(`Article "${article.title}" saved as draft!`);
      setForm({ title: '', content: '' });
      setTimeout(() => { setSuccess(''); onPublished && onPublished(article); }, 2000);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="write-page">
      <div className="write-header">
        <h2>New Article</h2>
        <p>Write your article below. It will be saved as a <strong>draft</strong> — publish it from the feed when ready.</p>
      </div>
      <form onSubmit={submit} className="write-form">
        <div className="field">
          <label>Headline</label>
          <input name="title" placeholder="Enter a compelling headline…" value={form.title} onChange={handle} required />
        </div>
        <div className="field">
          <label>Article Body</label>
          <textarea name="content" placeholder="Write your article here…" value={form.content} onChange={handle} rows={14} required />
        </div>
        <div className="char-count">{form.content.length} characters</div>
        {error && <div className="error-msg">⚠ {error}</div>}
        {success && <div className="success-msg">✓ {success}</div>}
        <div className="write-actions">
          <button type="submit" className="btn-publish" disabled={loading}>
            {loading ? <span className="spinner" /> : '💾 Save as Draft'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
function AdminPanel() {
  const { apiFetch, user } = useAuth();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function loadUsers() {
    setLoading(true);
    try { setUsers(await apiFetch('/users')); }
    catch (e) { setMsg(e.message); }
    finally { setLoading(false); }
  }

  async function loadLogs() {
    setLoading(true);
    try { setLogs(await apiFetch('/logs')); }
    catch (e) { setMsg(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (tab === 'users') loadUsers();
    if (tab === 'logs') loadLogs();
  }, [tab]);

  async function changeRole(userId, role) {
    try {
      await apiFetch(`/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
      setMsg('Role updated');
      setTimeout(() => setMsg(''), 3000);
      loadUsers();
    } catch (e) { setMsg(e.message); }
  }

  async function toggleStatus(userId) {
    try { await apiFetch(`/users/${userId}/status`, { method: 'PATCH' }); loadUsers(); }
    catch (e) { setMsg(e.message); }
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
              {users.map((u) => (
                <tr key={u.id} className={!u.isActive ? 'inactive-row' : ''}>
                  <td>
                    <div className="table-user">
                      <div className="tiny-avatar" style={{ background: ROLE_COLORS[u.role] }}>{u.username[0].toUpperCase()}</div>
                      {u.username}
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}
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
            {logs.map((log) => (
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
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, logout, can } = useAuth();
  const [page, setPage] = useState('feed');
  const [readingArticle, setReadingArticle] = useState(null);
  const color = ROLE_COLORS[user.role] || '#888';

  function handleReadArticle(article) {
    setReadingArticle(article);
    setPage('read');
  }

  function handleDeleted() {
    setReadingArticle(null);
    setPage('feed');
  }

  function handleEdited(updated) {
    setReadingArticle(updated);
  }

  const navItems = [
    { id: 'feed',  label: '📰 Feed',  always: true },
    { id: 'write', label: '✏ Write',  show: can('write') },
    { id: 'admin', label: '⚙ Admin',  show: can('manage_users') },
  ].filter((n) => n.always || n.show);

  return (
    <div className="newspaper-layout">
      <header className="newspaper-header">
        <div className="header-inner">
          <div className="header-left">
            <span className="header-date">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <div className="header-center">
            <h1 className="paper-name">The Daily Press</h1>
            <div className="paper-rule" />
            <p className="paper-tagline">Secure · Verified · Trusted</p>
          </div>
          <div className="header-right">
            <div className="user-pill" style={{ '--rc': color }}>
              <div className="user-dot" style={{ background: color }} />
              <span>{user.username}</span>
              <span className="user-role">{user.role}</span>
            </div>
            <button className="logout-link" onClick={logout}>Sign out</button>
          </div>
        </div>
        <nav className="paper-nav">
          {navItems.map((n) => (
            <button key={n.id}
              className={`nav-link ${(page === n.id || (page === 'read' && n.id === 'feed')) ? 'active' : ''}`}
              onClick={() => { setPage(n.id); setReadingArticle(null); }}>
              {n.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="paper-main">
        {page === 'feed' && !readingArticle && <NewsFeed onReadArticle={handleReadArticle} />}
        {page === 'read' && readingArticle && (
          <ArticleView
            article={readingArticle}
            onBack={() => { setPage('feed'); setReadingArticle(null); }}
            onDeleted={handleDeleted}
            onEdited={handleEdited}
          />
        )}
        {page === 'write' && <WriteArticle onPublished={() => setPage('feed')} />}
        {page === 'admin' && <AdminPanel />}
      </main>

      <footer className="paper-footer">
        <span>© {new Date().getFullYear()} The Daily Press</span>
        <span>·</span>
        <span>Secured with HMAC-SHA256 + JWT</span>
        <span>·</span>
        <span>RBAC Enforced</span>
      </footer>
    </div>
  );
}
