import { useState, useEffect } from 'react'
import { Search, Plus, Settings, MessageSquare, Users, Lock, LogOut, Bell, Keyboard } from 'lucide-react'
import { useStore } from '../lib/store'
import { getConversations, searchUsers, createDM, createGroup, signOut, setOnlineStatus } from '../lib/supabase'
import Avatar from './Avatar'
import { formatDistanceToNowStrict } from 'date-fns'
import toast from 'react-hot-toast'

const MOODS = {
  default: '#1a7a4a', ocean: '#0ea5e9', sunset: '#f97316',
  lavender: '#a855f7', rose: '#f43f5e', gold: '#eab308', slate: '#64748b'
}

export default function Sidebar({ onOpenSettings, onOpenSearch, onOpenNotifs, unreadNotifs }) {
  const { user, profile, conversations, setConversations, activeConversationId, setActiveConversation, unreadCounts, sidebarOpen } = useStore()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('chats')
  const [showNewChat, setShowNewChat] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [selectedUsers, setSelectedUsers] = useState([])
  const [groupSearch, setGroupSearch] = useState('')
  const [groupSearchResults, setGroupSearchResults] = useState([])

  useEffect(() => {
    if (!user) return
    loadConversations()
    setOnlineStatus(user.id, 'online')
    return () => { setOnlineStatus(user.id, 'offline') }
  }, [user])

  const loadConversations = async () => {
    const { data } = await getConversations(user.id)
    if (data) {
      const convs = data.map(d => ({
        ...d.conversations,
        myRole: d.role,
        isAnonymous: d.is_anonymous,
        lastReadAt: d.last_read_at,
      }))
      setConversations(convs)
    }
  }

  const handleSearch = async (q) => {
    setSearch(q)
    if (!q.trim()) return setSearchResults([])
    setSearching(true)
    const { data } = await searchUsers(q)
    setSearchResults((data || []).filter(u => u.id !== user.id))
    setSearching(false)
  }

  const startDM = async (targetUser) => {
    const { data, error } = await createDM(user.id, targetUser.id)
    if (error) return toast.error('Failed to start chat')
    setShowNewChat(false)
    setSearch('')
    setSearchResults([])
    await loadConversations()
    if (data) setActiveConversation(data.id)
  }

  const handleGroupSearch = async (q) => {
    setGroupSearch(q)
    if (!q.trim()) return setGroupSearchResults([])
    const { data } = await searchUsers(q)
    setGroupSearchResults((data || []).filter(u => u.id !== user.id && !selectedUsers.find(s => s.id === u.id)))
  }

  const createGroupChat = async () => {
    if (!groupName.trim() || selectedUsers.length < 1) return toast.error('Add a group name and at least 1 member')
    const { data, error } = await createGroup(groupName, user.id, selectedUsers.map(u => u.id))
    if (error) return toast.error('Failed to create group')
    setShowNewGroup(false)
    setGroupName('')
    setSelectedUsers([])
    await loadConversations()
    if (data) setActiveConversation(data.id)
    toast.success(`Group "${groupName}" created!`, { className: 'toast-leaf' })
  }

  const handleSignOut = async () => {
    await setOnlineStatus(user.id, 'offline')
    await signOut()
  }

  const getConvName = (conv) => {
    if (conv.type === 'group') return conv.name
    const other = conv.conversation_members?.find(m => m.user_id !== user.id)
    return other?.profiles?.display_name || other?.profiles?.username || 'Unknown'
  }

  const getConvMember = (conv) => {
    if (conv.type === 'dm') return conv.conversation_members?.find(m => m.user_id !== user.id)?.profiles
    return null
  }

  const filtered = conversations.filter(c => {
    const name = getConvName(c).toLowerCase()
    const q = search.toLowerCase()
    if (tab === 'groups') return c.type === 'group' && name.includes(q)
    if (tab === 'dms') return c.type === 'dm' && name.includes(q)
    return name.includes(q)
  })

  return (
    <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">🌿</div>
          LEAFY
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="icon-btn" title="New Chat" onClick={() => setShowNewChat(!showNewChat)}>
            <Plus size={18} />
          </button>
          <button className="icon-btn" title="Search (Ctrl+K)" onClick={onOpenSearch}>
            <Search size={18} />
          </button>
          <button className="icon-btn" title="Notifications" onClick={onOpenNotifs} style={{position:'relative'}}>
            <Bell size={18} />
            {unreadNotifs > 0 && <span className="badge" style={{position:'absolute',top:4,right:4,width:8,height:8,borderRadius:'50%',background:'#ef4444',border:'1.5px solid var(--bg-deep)',padding:0}}/>}
          </button>
          <button className="icon-btn" title="Settings" onClick={onOpenSettings}>
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="sidebar-search">
        <div className="search-wrapper">
          <Search size={14} className="search-icon" />
          <input
            className="search-input"
            placeholder={showNewChat ? 'Search users...' : 'Search chats...'}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        {/* New DM search results */}
        {showNewChat && (
          <div style={{ marginTop: 8, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', overflow: 'hidden' }}>
            {searching && <div style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 13 }}>Searching...</div>}
            {!searching && searchResults.length === 0 && search && (
              <div style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 13 }}>No users found</div>
            )}
            {searchResults.map(u => (
              <div key={u.id} className="conv-item" onClick={() => startDM(u)} style={{ borderRadius: 0 }}>
                <Avatar profile={u} showStatus />
                <div className="conv-info">
                  <div className="conv-name">{u.display_name || u.username}</div>
                  <div className="conv-preview">@{u.username}</div>
                </div>
              </div>
            ))}
            <div
              className="conv-item"
              style={{ borderRadius: 0, borderTop: '1px solid var(--border-subtle)' }}
              onClick={() => { setShowNewGroup(true); setShowNewChat(false); setSearch('') }}
            >
              <div className="avatar" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}>
                <Users size={18} />
              </div>
              <div className="conv-info">
                <div className="conv-name">Create Group Chat</div>
                <div className="conv-preview">Add multiple people</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="sidebar-tabs">
        {['chats', 'dms', 'groups'].map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'chats' ? 'All' : t === 'dms' ? 'Direct' : 'Groups'}
          </button>
        ))}
      </div>

      {/* Conversations */}
      <div className="conversations-list">
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
            {search ? 'No chats found' : 'No conversations yet'}
          </div>
        )}
        {filtered.map(conv => {
          const name = getConvName(conv)
          const member = getConvMember(conv)
          const unread = unreadCounts[conv.id] || 0
          const moodColor = MOODS[conv.mood_name] || conv.mood_color || MOODS.default
          const isVault = conv.is_vault

          return (
            <div
              key={conv.id}
              className={`conv-item ${activeConversationId === conv.id ? 'active' : ''}`}
              onClick={() => setActiveConversation(conv.id)}
            >
              {conv.type === 'dm' && member ? (
                <Avatar profile={member} showStatus />
              ) : (
                <div className="conv-avatar">
                  <div className="avatar" style={{ background: `${moodColor}22`, color: moodColor, borderColor: `${moodColor}44` }}>
                    {isVault ? <Lock size={16} /> : name[0]?.toUpperCase()}
                  </div>
                </div>
              )}

              <div className="conv-info">
                <div className="conv-name" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {name}
                  {isVault && <Lock size={10} style={{ color: '#eab308', flexShrink: 0 }} />}
                </div>
                <div className="conv-preview" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span className="mood-dot" style={{ background: moodColor }} />
                  {conv.last_message_preview || 'Start a conversation'}
                </div>
              </div>

              <div className="conv-meta">
                {conv.last_message_at && (
                  <span className="conv-time">
                    {formatDistanceToNowStrict(new Date(conv.last_message_at), { addSuffix: false })}
                  </span>
                )}
                {unread > 0 && <span className="unread-badge">{unread > 99 ? '99+' : unread}</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="own-avatar-area" onClick={onOpenSettings}>
          <Avatar profile={profile} showStatus size="sm" />
          <div>
            <div className="own-name">{profile?.display_name || profile?.username}</div>
            <div className="own-status">{profile?.status?.slice(0, 24) || 'Online'}</div>
          </div>
        </div>
        <button className="icon-btn" title="Sign Out" onClick={handleSignOut}>
          <LogOut size={16} />
        </button>
      </div>

      {/* Create Group Modal */}
      {showNewGroup && (
        <div className="modal-overlay" onClick={() => setShowNewGroup(false)}>
          <div className="modal pop-in" onClick={e => e.stopPropagation()}>
            <h3>🌿 Create Group</h3>
            <div className="form-field">
              <label className="form-label">Group Name</label>
              <input className="form-input" placeholder="e.g. The Squad" value={groupName} onChange={e => setGroupName(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Add Members</label>
              <input className="form-input" placeholder="Search by username..." value={groupSearch} onChange={e => handleGroupSearch(e.target.value)} />
              {groupSearchResults.map(u => (
                <div key={u.id} className="conv-item" style={{ padding: '8px 4px' }} onClick={() => { setSelectedUsers(s => [...s, u]); setGroupSearchResults([]); setGroupSearch('') }}>
                  <Avatar profile={u} size="sm" />
                  <div className="conv-info">
                    <div className="conv-name">{u.display_name || u.username}</div>
                  </div>
                  <Plus size={14} style={{ color: 'var(--accent)' }} />
                </div>
              ))}
            </div>
            {selectedUsers.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {selectedUsers.map(u => (
                  <span key={u.id} className="badge badge-green" style={{ cursor: 'pointer' }} onClick={() => setSelectedUsers(s => s.filter(x => x.id !== u.id))}>
                    {u.display_name || u.username} ✕
                  </span>
                ))}
              </div>
            )}
            <div className="btn-row">
              <button className="btn btn-ghost" onClick={() => setShowNewGroup(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createGroupChat}>Create Group</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
