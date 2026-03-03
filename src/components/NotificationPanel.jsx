import { useState, useEffect } from 'react'
import { X, Bell, Check, MessageSquare, AtSign, Heart, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { formatDistanceToNowStrict } from 'date-fns'

const TYPE_ICONS = {
  mention: <AtSign size={14}/>,
  reaction: <Heart size={14}/>,
  message: <MessageSquare size={14}/>,
  friend_request: <UserPlus size={14}/>,
  friend_accepted: <UserPlus size={14}/>,
  system: <Bell size={14}/>,
}

export default function NotificationPanel({ onClose, onJumpToConversation }) {
  const { user } = useStore()
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNotifs()
    const ch = supabase.channel('notifs:'+user.id)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:`user_id=eq.${user.id}`},
        payload => setNotifs(n => [payload.new, ...n]))
      .subscribe()
    return () => ch.unsubscribe()
  }, [])

  const loadNotifs = async () => {
    setLoading(true)
    const { data } = await supabase.from('notifications')
      .select('*').eq('user_id', user.id)
      .order('created_at', {ascending:false}).limit(40)
    setNotifs(data || [])
    setLoading(false)
  }

  const markAllRead = async () => {
    await supabase.from('notifications').update({is_read:true}).eq('user_id', user.id).eq('is_read',false)
    setNotifs(n => n.map(x => ({...x, is_read:true})))
  }

  const markRead = async (id) => {
    await supabase.from('notifications').update({is_read:true}).eq('id', id)
    setNotifs(n => n.map(x => x.id===id ? {...x,is_read:true} : x))
  }

  const handleClick = (n) => {
    markRead(n.id)
    if (n.conversation_id) { onJumpToConversation(n.conversation_id); onClose() }
  }

  const unread = notifs.filter(n => !n.is_read).length

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal pop-in" style={{maxWidth:420,maxHeight:'80vh',display:'flex',flexDirection:'column',padding:0,overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'14px 18px',borderBottom:'1px solid var(--border-subtle)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <Bell size={17} style={{color:'var(--accent)'}}/>
            <span style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:15,color:'var(--text-primary)'}}>Notifications</span>
            {unread > 0 && <span className="unread-badge">{unread}</span>}
          </div>
          <div style={{display:'flex',gap:4}}>
            {unread > 0 && <button className="btn btn-ghost" style={{padding:'4px 10px',fontSize:12,gap:4}} onClick={markAllRead}><Check size={12}/>Mark all read</button>}
            <button className="icon-btn" onClick={onClose}><X size={15}/></button>
          </div>
        </div>

        <div style={{flex:1,overflowY:'auto'}}>
          {loading && (
            <div style={{padding:24,textAlign:'center',color:'var(--text-muted)',fontSize:13}}>Loading...</div>
          )}
          {!loading && notifs.length === 0 && (
            <div className="empty-state" style={{padding:40}}>
              <div className="es-art">🔔</div>
              <h3>All caught up!</h3>
              <p>No notifications yet</p>
            </div>
          )}
          {notifs.map(n => (
            <div key={n.id} className={`notif-item ${!n.is_read?'unread':''}`}
              style={{padding:'12px 18px',cursor:n.conversation_id?'pointer':'default'}}
              onClick={() => handleClick(n)}>
              <div style={{width:32,height:32,borderRadius:'50%',background:'var(--accent-glow)',color:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                {TYPE_ICONS[n.type] || <Bell size={14}/>}
              </div>
              <div style={{flex:1}}>
                <div className="notif-body">{n.body || n.title}</div>
                <div className="notif-time">{formatDistanceToNowStrict(new Date(n.created_at), {addSuffix:true})}</div>
              </div>
              {!n.is_read && <div className="notif-dot"/>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
