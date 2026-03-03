import { useState, useEffect, useRef } from 'react'
import { Search, X, MessageSquare, ArrowRight } from 'lucide-react'
import { searchMessages } from '../lib/supabase'
import { useStore } from '../lib/store'
import { format } from 'date-fns'

export default function SearchModal({ onClose, onJumpToConversation }) {
  const { user, conversations } = useStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [scope, setScope] = useState('all') // 'all' | conversationId
  const debounceRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim()) return setResults([])
    debounceRef.current = setTimeout(() => doSearch(), 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, scope])

  const doSearch = async () => {
    setLoading(true)
    const convId = scope === 'all' ? null : scope
    const { data } = await searchMessages(user.id, query, convId)
    setResults(data || [])
    setLoading(false)
  }

  const getConvName = (convId) => {
    const conv = conversations.find(c => c.id === convId)
    if (!conv) return 'Unknown'
    if (conv.type === 'group') return conv.name
    const other = conv.conversation_members?.find(m => m.user_id !== user.id)
    return other?.profiles?.display_name || other?.profiles?.username || 'DM'
  }

  const highlight = (text, query) => {
    if (!query.trim()) return text
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} style={{ background: 'var(--accent-glow)', color: 'var(--accent)', borderRadius: 3, padding: '0 2px' }}>{part}</mark>
        : part
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal pop-in"
        style={{ maxWidth: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <Search size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 16 }}
            placeholder="Search messages..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => { setQuery(''); setResults([]) }}>
              <X size={14} />
            </button>
          )}
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Scope filter */}
        <div style={{ padding: '10px 20px', display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--border-subtle)' }}>
          <button
            className={`tab-btn ${scope === 'all' ? 'active' : ''}`}
            style={{ flex: 'none', padding: '5px 12px' }}
            onClick={() => setScope('all')}
          >
            All Chats
          </button>
          {conversations.slice(0, 6).map(c => (
            <button
              key={c.id}
              className={`tab-btn ${scope === c.id ? 'active' : ''}`}
              style={{ flex: 'none', padding: '5px 12px', fontSize: 12 }}
              onClick={() => setScope(c.id)}
            >
              {c.type === 'group' ? c.name : c.conversation_members?.find(m => m.user_id !== user.id)?.profiles?.display_name || 'DM'}
            </button>
          ))}
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Searching...
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
              <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>No results found</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>Try different keywords</div>
            </div>
          )}

          {!loading && !query && (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🌿</div>
              <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Search your messages</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>Find any message across all conversations</div>
            </div>
          )}

          {results.map(result => (
            <div
              key={result.id}
              style={{
                padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                transition: 'background 0.15s', display: 'flex', gap: 12, alignItems: 'flex-start'
              }}
              onClick={() => { onJumpToConversation(result.conversation_id); onClose() }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-glow)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, fontWeight: 700 }}>
                {result.display_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {result.display_name || result.username}
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> in </span>
                    <span style={{ color: 'var(--accent)' }}>{getConvName(result.conversation_id)}</span>
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                    {format(new Date(result.created_at), 'MMM d')}
                  </span>
                </div>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {highlight(result.content || '', query)}
                </p>
              </div>
              <ArrowRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 4 }} />
            </div>
          ))}

          {results.length > 0 && (
            <div style={{ padding: '10px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              {results.length} result{results.length !== 1 ? 's' : ''} found
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
