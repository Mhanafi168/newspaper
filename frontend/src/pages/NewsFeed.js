import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.js'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr)
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function NewsFeed({ onReadArticle }) {
  const { apiFetch, can } = useAuth()
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch('/articles')
      .then(setArticles)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const published = articles.filter(a => a.status === 'published')
  const drafts = articles.filter(a => a.status === 'draft')

  if (loading) return <div className="feed-loading"><div className="feed-spinner" />Loading latest articles…</div>
  if (error) return <div className="feed-error">⚠ {error}</div>

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
            Drafts — visible to editors & admins only
          </div>
          <div className="article-grid">
            {drafts.map((a, i) => (
              <ArticleCard key={a.id} article={a} index={i} onClick={() => onReadArticle(a)} isDraft />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ArticleCard({ article, index, onClick, isDraft }) {
  const preview = article.content.slice(0, 120) + (article.content.length > 120 ? '…' : '')
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
  )
}
