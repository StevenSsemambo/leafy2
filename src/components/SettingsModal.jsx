import { useState } from 'react'
import { X, Camera, Bell, Palette, Lock, User, Keyboard } from 'lucide-react'
import { useStore } from '../lib/store'
import { updateProfile, uploadFile } from '../lib/supabase'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'profile', icon: <User size={14}/>, label: 'Profile' },
  { id: 'appearance', icon: <Palette size={14}/>, label: 'Appearance' },
  { id: 'notifications', icon: <Bell size={14}/>, label: 'Notifications' },
  { id: 'privacy', icon: <Lock size={14}/>, label: 'Privacy' },
]

const ACCENTS = ['#22c55e','#0ea5e9','#a855f7','#f43f5e','#f97316','#eab308','#06b6d4','#ec4899','#8b5cf6','#14b8a6']
const STATUSES = ["Hey, I'm using Leafy! 🌿","Available","Busy","In a meeting","Do not disturb","On vacation 🌴"]

export default function SettingsModal({ onClose }) {
  const { user, profile, setProfile } = useStore()
  const [tab, setTab] = useState('profile')
  const [form, setForm] = useState({
    display_name: profile?.display_name || '',
    username: profile?.username || '',
    bio: profile?.bio || '',
    status: profile?.status || '',
    online_status: profile?.online_status || 'online',
    ghost_read: profile?.ghost_read || false,
    vault_pin: profile?.vault_pin || '',
    theme: profile?.theme || 'dark',
    accent_color: profile?.accent_color || '#22c55e',
    density: profile?.density || 'comfortable',
    notification_sounds: profile?.notification_sounds !== false,
    push_notifications: profile?.push_notifications !== false,
  })
  const [saving, setSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)

  const set = k => e => setForm(f => ({...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value}))

  const handleAvatarSelect = (e) => {
    const f = e.target.files[0]; if (!f) return
    setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f))
  }

  const handleSave = async () => {
    setSaving(true)
    let avatarUrl = profile?.avatar_url
    if (avatarFile) {
      const { url } = await uploadFile('avatars', `avatars/${user.id}/${Date.now()}`, avatarFile)
      if (url) avatarUrl = url
    }
    const { data, error } = await updateProfile(user.id, { ...form, avatar_url: avatarUrl })
    setSaving(false)
    if (error) return toast.error('Failed to save')
    setProfile(data)
    // Apply theme immediately
    document.documentElement.setAttribute('data-theme', form.theme)
    document.documentElement.setAttribute('data-density', form.density)
    document.documentElement.style.setProperty('--accent', form.accent_color)
    document.documentElement.style.setProperty('--accent-dim', form.accent_color + 'cc')
    toast.success('Saved! ✅', { className: 'toast-leaf' })
    onClose()
  }

  const initials = (form.display_name || form.username || '?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal pop-in" style={{maxWidth:520,maxHeight:'88vh',display:'flex',flexDirection:'column',padding:0,overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border-subtle)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <span style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:16,color:'var(--text-primary)'}}>⚙️ Settings</span>
          <button className="icon-btn" onClick={onClose}><X size={15}/></button>
        </div>

        <div style={{display:'flex',flex:1,overflow:'hidden'}}>
          {/* Sidebar tabs */}
          <div style={{width:130,borderRight:'1px solid var(--border-subtle)',padding:8,display:'flex',flexDirection:'column',gap:2,flexShrink:0}}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:'var(--radius-md)',border:'none',background:tab===t.id?'var(--accent-glow)':'transparent',color:tab===t.id?'var(--accent)':'var(--text-muted)',cursor:'pointer',fontFamily:'var(--font-body)',fontSize:13,fontWeight:tab===t.id?600:400,transition:'all var(--t)',textAlign:'left'}}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{flex:1,overflowY:'auto',padding:20}}>
            {tab === 'profile' && (
              <>
                <div style={{display:'flex',justifyContent:'center',marginBottom:20}}>
                  <div style={{position:'relative'}}>
                    <div className="av av-lg" style={{width:70,height:70,fontSize:26}}>
                      {avatarPreview || profile?.avatar_url
                        ? <img src={avatarPreview||profile?.avatar_url} style={{width:'100%',height:'100%',borderRadius:'50%',objectFit:'cover'}}/>
                        : initials}
                    </div>
                    <label style={{position:'absolute',bottom:0,right:0,width:26,height:26,borderRadius:'50%',background:'var(--accent)',border:'2px solid var(--bg-card)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
                      <Camera size={12} color="white"/>
                      <input type="file" accept="image/*" style={{display:'none'}} onChange={handleAvatarSelect}/>
                    </label>
                  </div>
                </div>
                <div className="form-field">
                  <label className="form-label">Display Name</label>
                  <input className="form-input" value={form.display_name} onChange={set('display_name')} placeholder="Your name"/>
                </div>
                <div className="form-field">
                  <label className="form-label">Username</label>
                  <input className="form-input" value={form.username} onChange={set('username')} placeholder="@username"/>
                </div>
                <div className="form-field">
                  <label className="form-label">Bio</label>
                  <textarea className="form-input" value={form.bio} onChange={set('bio')} placeholder="About you..." rows={2}/>
                </div>
                <div className="form-field">
                  <label className="form-label">Status Message</label>
                  <select className="form-input" value={form.status} onChange={set('status')}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Online Status</label>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {['online','away','busy','offline'].map(s => (
                      <button key={s} className={`btn ${form.online_status===s?'btn-primary':'btn-ghost'}`}
                        style={{padding:'5px 12px',fontSize:12,textTransform:'capitalize'}}
                        onClick={() => setForm(f=>({...f,online_status:s}))}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === 'appearance' && (
              <>
                <div className="form-field">
                  <label className="form-label">Theme</label>
                  <div className="theme-toggle">
                    {['dark','light'].map(t => (
                      <button key={t} className={`theme-opt ${form.theme===t?'active':''}`}
                        style={{textTransform:'capitalize'}}
                        onClick={() => setForm(f=>({...f,theme:t}))}>
                        {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-field">
                  <label className="form-label">Accent Color</label>
                  <div className="accent-swatches">
                    {ACCENTS.map(c => (
                      <div key={c} className={`accent-swatch ${form.accent_color===c?'selected':''}`}
                        style={{background:c}} onClick={() => setForm(f=>({...f,accent_color:c}))}/>
                    ))}
                  </div>
                </div>
                <div className="form-field">
                  <label className="form-label">Density</label>
                  <div style={{display:'flex',gap:8}}>
                    {[{id:'comfortable',label:'😌 Comfortable'},{id:'compact',label:'🗜️ Compact'}].map(d => (
                      <button key={d.id} className={`btn ${form.density===d.id?'btn-primary':'btn-ghost'}`}
                        style={{flex:1,justifyContent:'center',fontSize:13}}
                        onClick={() => setForm(f=>({...f,density:d.id}))}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-field">
                  <label className="form-label">Preview</label>
                  <div style={{background:'var(--bg-raised)',borderRadius:'var(--radius-lg)',padding:14}}>
                    <div style={{alignSelf:'flex-start',display:'inline-block',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'14px 14px 14px 3px',padding:'8px 12px',fontSize:13.5,color:'var(--text-primary)',marginBottom:8}}>
                      Hey there! 🌿
                    </div><br/>
                    <div style={{display:'inline-block',background:form.accent_color,borderRadius:'14px 14px 3px 14px',padding:'8px 12px',fontSize:13.5,color:'#fff'}}>
                      Leafy looks amazing!
                    </div>
                  </div>
                </div>
              </>
            )}

            {tab === 'notifications' && (
              <>
                {[
                  {k:'notification_sounds',label:'🔔 Notification Sounds',desc:'Play a sound when you receive a message'},
                  {k:'push_notifications',label:'📱 Push Notifications',desc:'Get notified even when the app is in background'},
                ].map(item => (
                  <div key={item.k} className="form-field" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:600,color:'var(--text-primary)'}}>{item.label}</div>
                      <div style={{fontSize:12.5,color:'var(--text-muted)',marginTop:2}}>{item.desc}</div>
                    </div>
                    <input type="checkbox" checked={form[item.k]} onChange={set(item.k)}
                      style={{width:18,height:18,accentColor:'var(--accent)',flexShrink:0,marginTop:2}}/>
                  </div>
                ))}
              </>
            )}

            {tab === 'privacy' && (
              <>
                <div className="form-field" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:'var(--text-primary)'}}>👻 Ghost Read Mode</div>
                    <div style={{fontSize:12.5,color:'var(--text-muted)',marginTop:2}}>Read messages without triggering read receipts</div>
                  </div>
                  <input type="checkbox" checked={form.ghost_read} onChange={set('ghost_read')}
                    style={{width:18,height:18,accentColor:'var(--accent)',flexShrink:0,marginTop:2}}/>
                </div>
                <div className="form-field">
                  <label className="form-label">🔐 Vault PIN (4 digits)</label>
                  <input className="form-input" type="password" maxLength={4} value={form.vault_pin} onChange={set('vault_pin')} placeholder="Set a 4-digit PIN"/>
                  <p style={{fontSize:12,color:'var(--text-muted)',marginTop:4}}>Used to unlock vault conversations</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{padding:'14px 20px',borderTop:'1px solid var(--border-subtle)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div style={{fontSize:11,color:'var(--text-muted)'}}>Leafy v2.0 · <strong style={{color:'var(--accent)'}}>Sematech Developers</strong></div>
          <div className="btn-row" style={{margin:0}}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'Saving...':'Save Changes'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
