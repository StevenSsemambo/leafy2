import { X, Pin, Users, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import Avatar from './Avatar'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

export default function SidePanel({ pinnedItems, onClose }) {
  const { user, conversations, activeConversationId, activePanel } = useStore()
  const conv = conversations.find(c => c.id === activeConversationId)

  const deletePinItem = async (id) => {
    await supabase.from('pinned_items').delete().eq('id', id)
    // Parent will need to refresh - just reload
    window.location.reload()
  }

  if (!conv) return null

  return (
    <div className="side-panel fade-in">
      <div className="panel-header">
        <div className="panel-title">
          {activePanel === 'pins' ? '📌 Pinned' : '👥 Members'}
        </div>
        <button className="icon-btn" onClick={onClose}><X size={16} /></button>
      </div>

      <div className="panel-body">
        {activePanel === 'pins' && (
          <>
            {pinnedItems.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>
                No pinned items yet.<br />
                <span style={{ color: 'var(--accent)', cursor: 'pointer' }}>Pin important info</span> using the input bar.
              </div>
            )}
            {pinnedItems.map(item => (
              <div
                key={item.id}
                className="pin-card"
                style={{ borderLeftColor: item.color || 'var(--accent)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="pin-title">{item.title}</div>
                  {item.pinned_by === user.id && (
                    <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => deletePinItem(item.id)}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <div className="pin-content">{item.content}</div>
                <div className="pin-meta">
                  Pinned by {item.profiles?.display_name || 'someone'} · {format(new Date(item.created_at), 'MMM d')}
                </div>
              </div>
            ))}
          </>
        )}

        {activePanel === 'members' && (
          <>
            <div style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: 12.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {conv.conversation_members?.length || 0} Members
            </div>
            {(conv.conversation_members || []).map(member => (
              <div key={member.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <Avatar profile={member.profiles} showStatus />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {member.profiles?.display_name || member.profiles?.username}
                    {member.user_id === user.id && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> (you)</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{member.profiles?.username}</div>
                </div>
                {member.role === 'admin' && (
                  <span className="badge badge-green" style={{ fontSize: 10 }}>Admin</span>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
