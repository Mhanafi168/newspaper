import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext.js'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr)
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function ArticleView({ article, onBack, onDeleted, onEdited }) {
  const { can, user, apiFetch } = useAuth()
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ title: article.title, content: article.content })

  const isOwner = user.id === article.authorId
  const canEdit = can('write') && (isOwner || user.role === 'admin')
  const canDelete = can('delete_post') && (isOwner || user.role === 'admin')
  const canPublish = can('publish')

  async function toggleStatus() {
    setLoading(true)
    try {
      const updated = await apiFetch(`/articles/${article.id}/status`, { method: 'PATCH' })
      setMsg(`Article ${updated.status === 'published' ? 'published' : 'unpublished'}!`)
      setTimeout(() => setMsg(''), 3000)
      onEdited({ ...article, status: updated.status })
    } catch (e) { setMsg(e.message) }
    finally { setLoading(false) }
  }

  async function deleteArticle() {
    if (!confirm('Delete this article permanently?')) return
    setLoading(true)
    try {
      await apiFetch(`/articles/${article.id}`, { method: 'DELETE' })
      onDeleted(article.id)
    } catch (e) { setMsg(e.message) }
    finally { setLoading(false) }
  }

  async function saveEdit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const updated = await apiFetch(`/articles/${article.id}`, {
        method: 'PATCH', body: JSON.stringify(form)
      })
      setMsg('Saved!')
      setEditing(false)
      onEdited(updated)
      setTimeout(() => setMsg(''), 3000)
    } catch (e) { setMsg(e.message) }
    finally { setLoading(false) }
  }

  if (editing) return (
    <div className="article-view">
      <button className="back-btn" onClick={() => setEditing(false)}>← Cancel</button>
      <h2 className="edit-heading">Edit Article</h2>
      <form onSubmit={saveEdit} className="edit-form">
        <div className="field">
          <label>Title</label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
        </div>
        <div className="field">
          <label>Content</label>
          <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={12} required />
        </div>
        {msg && <div className="toast-inline">{msg}</div>}
        <div className="edit-actions">
          <button type="submit" className="btn-publish" disabled={loading}>
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )

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
          {canEdit && (
            <button className="btn-edit" onClick={() => setEditing(true)} disabled={loading}>✎ Edit</button>
          )}
          {canPublish && (
            <button className="btn-publish" onClick={toggleStatus} disabled={loading}>
              {loading ? '…' : article.status === 'published' ? '⊘ Unpublish' : '⊙ Publish'}
            </button>
          )}
          {canDelete && (
            <button className="btn-delete" onClick={deleteArticle} disabled={loading}>✕ Delete</button>
          )}
        </div>
      )}
    </div>
  )
}
