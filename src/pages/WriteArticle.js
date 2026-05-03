import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext.js'

export default function WriteArticle({ onPublished }) {
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({ title: '', content: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const article = await apiFetch('/articles', {
        method: 'POST', body: JSON.stringify(form)
      })
      setSuccess(`Article "${article.title}" saved as draft!`)
      setForm({ title: '', content: '' })
      setTimeout(() => { setSuccess(''); onPublished && onPublished(article) }, 2000)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
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
          <input
            name="title"
            placeholder="Enter a compelling headline…"
            value={form.title}
            onChange={handle}
            required
          />
        </div>
        <div className="field">
          <label>Article Body</label>
          <textarea
            name="content"
            placeholder="Write your article here…"
            value={form.content}
            onChange={handle}
            rows={14}
            required
          />
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
  )
}
