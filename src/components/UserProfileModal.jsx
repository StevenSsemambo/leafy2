import { useState, useEffect } from 'react'
import { X, MessageSquare, UserPlus, UserMinus, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { createDM } from '../lib/supabase'
import { formatDistanceToNowStrict } from 'date-fns'
import toast from 'react-hot-toast'

export default function UserProfileModal({ userId, onClose, onStartChat }) {
  const { user } = useStore()
  const [profile, setProfile] = useState(null)
  const [stories, setStories] = useState([])
  const [contactStatus, setContactStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    loadProfile()
  }, [userId])

  const loadProfile = async () => {
    setLoading(true)
    const [{ data: p }, { data: s }, { data: c }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('stories').select('*').eq('user_id', userId).gt('expires_at', new Date().toISOString()).order('created_at',{ascending:false}).limit(6),
      supabase.from('contacts').select('status').eq('user_id', user.id).eq('contact_id', userId).maybeSingle()
    ])
    setProfile(p)
    setStories(s || [])
    setContactStatus(c?.status || null)
    setLoading(false)
  }

  const handleAddContact = async () => {
    if (contactStatus === 'accepted') {
      await supabase.from('contacts').delete().eq('user_id', user.id).eq('contact_id', userId)
      setContactStatus(null)
      toast.success('Contact removed')
    } else {
      await supabase.from('contacts').upsert({user_id:user.id, contact_id:userId, status:'accepted'})
      setContactStatus('accepted')
      toast.success('Contact added! 🌿', {className:'toast-leaf'})
    }
  }

  const handleMessage = async () => {
    const { data } = await createDM(user.id, userId)
    onStartChat(data.id)
    onClose()
  }

  const statusColor = {'online':'#22c55e','away':'#eab308','busy':'#ef4444','offline':'var(--text-muted)'}

  if (loading || !profile) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal pop-in" style={{maxWidth:380}}>
          <div style={{textAlign:'center',color:'var(--text-muted)',padding:40}}>Loading profile...</div>
        </div>
      </div>
    )
  }

  const initials = (profile.display_name||profile.username||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal pop-in" style={{maxWidth:380,padding:0,overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
        {/* Banner */}
        <div className="profile-banner" style={{background:`linear-gradient(135deg, var(--bg-raised), ${profile.accent_color||'var(--accent-glow)'}33)`}}>
          <button className="icon-btn" style={{position:'absolute',top:10,right:10}} onClick={onClose}><X size={15}/></button>
        </div>

        {/* Avatar */}
        <div style={{position:'relative',height:28}}>
          <div style={{position:'absolute',top:-30,left:18}}>
            <div style={{position:'relative'}}>
              <div className="av av-lg" style={{width:64,height:64,fontSize:22,borderColor:profile.accent_color||'var(--border-accent)',background:'var(--bg-card)'}}>
                {profile.avatar_url
                  ? <img src={profile.avatar_url} style={{width:'100%',height:'100%',borderRadius:'50%',objectFit:'cover'}}/>
                  : initials
                }
              </div>
              <div className="status-dot" style={{background:statusColor[profile.online_status]||statusColor.offline,width:14,height:14,border:'2.5px solid var(--bg-card)'}}/>
            </div>
          </div>
        </div>

        {/* Info */}
        <div style={{padding:'10px 18px 18px'}}>
          <div className="profile-display-name">{profile.display_name || profile.username}</div>
          <div className="profile-username">@{profile.username} · <span style={{color:statusColor[profile.online_status]}}>{profile.online_status}</span></div>
          {profile.bio && <div className="profile-bio">{profile.bio}</div>}
          {profile.status && <div style={{marginTop:8,fontSize:13,color:'var(--text-muted)',fontStyle:'italic'}}>"{profile.status}"</div>}
          {profile.last_seen && profile.online_status !== 'online' && (
            <div style={{fontSize:12,color:'var(--text-muted)',marginTop:4}}>
              Last seen {formatDistanceToNowStrict(new Date(profile.last_seen), {addSuffix:true})}
            </div>
          )}

          {/* Active stories */}
          {stories.length > 0 && (
            <div style={{marginTop:14}}>
              <div style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>Stories</div>
              <div style={{display:'flex',gap:8,overflowX:'auto'}}>
                {stories.map(s => (
                  <div key={s.id} style={{width:52,height:72,borderRadius:10,background:s.background_color||'var(--bg-raised)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'white',fontWeight:700,textAlign:'center',padding:4,overflow:'hidden',position:'relative'}}>
                    {s.media_url ? <img src={s.media_url} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:8}}/> : s.content?.slice(0,20)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {userId !== user.id && (
            <div style={{display:'flex',gap:8,marginTop:16}}>
              <button className="btn btn-primary" style={{flex:1,justifyContent:'center',gap:6}} onClick={handleMessage}>
                <MessageSquare size={14}/> Message
              </button>
              <button className={`btn ${contactStatus==='accepted'?'btn-danger':'btn-ghost'}`} style={{gap:6}} onClick={handleAddContact}>
                {contactStatus==='accepted' ? <><UserMinus size={14}/> Remove</> : <><UserPlus size={14}/> Add</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
