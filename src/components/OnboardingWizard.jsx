import { useState } from 'react'
import { Camera, Check } from 'lucide-react'
import { updateProfile, uploadFile, searchUsers } from '../lib/supabase'
import { useStore } from '../lib/store'
import Avatar from './Avatar'
import toast from 'react-hot-toast'

const ACCENTS = ['#22c55e','#0ea5e9','#a855f7','#f43f5e','#f97316','#eab308','#06b6d4','#ec4899']
const STATUSES = ["Hey, I'm using Leafy! 🌿","Available","Busy","In a meeting","Do not disturb"]

export default function OnboardingWizard({ onComplete }) {
  const { user, profile, setProfile } = useStore()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    display_name: profile?.display_name || '',
    username: profile?.username || '',
    bio: '',
    status: "Hey, I'm using Leafy! 🌿",
    accent_color: '#22c55e',
  })
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [suggested, setSuggested] = useState([])

  const STEPS = ['Welcome','Your Profile','Personalize','Discover']

  const handleAvatarSelect = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setAvatarFile(f)
    setAvatarPreview(URL.createObjectURL(f))
  }

  const next = async () => {
    if (step === 1) {
      if (!form.display_name.trim()) return toast.error('Enter your name')
      if (!form.username.trim()) return toast.error('Enter a username')
    }
    if (step === 2) {
      // Load suggested users
      const { data } = await searchUsers('')
      setSuggested((data || []).filter(u => u.id !== user.id).slice(0, 6))
    }
    if (step === STEPS.length - 1) {
      await finish()
    } else {
      setStep(s => s + 1)
    }
  }

  const finish = async () => {
    setSaving(true)
    let avatarUrl = profile?.avatar_url
    if (avatarFile) {
      const { url } = await uploadFile('avatars', `avatars/${user.id}/${Date.now()}`, avatarFile)
      if (url) avatarUrl = url
    }
    const { data } = await updateProfile(user.id, {
      ...form,
      avatar_url: avatarUrl,
      onboarding_complete: true
    })
    setSaving(false)
    if (data) { setProfile(data); onComplete() }
  }

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}))

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card pop-in">
        {/* Progress */}
        <div className="onboarding-step">Step {step + 1} of {STEPS.length}</div>
        <div className="onboarding-progress">
          {STEPS.map((_, i) => <div key={i} className={`op-dot ${i <= step ? 'done' : ''}`} />)}
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <>
            <div style={{textAlign:'center',marginBottom:24}}>
              <div style={{fontSize:52,marginBottom:12}}>🌿</div>
              <div className="onboarding-title">Welcome to Leafy!</div>
              <div className="onboarding-sub">Built by Sematech Developers. Let's get you set up in just a few steps.</div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {['💬 Real-time messaging','📸 Stories & status','🔐 Vault chats','🎨 Custom themes','📊 Polls & to-dos'].map(f => (
                <div key={f} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'var(--bg-raised)',borderRadius:'var(--radius-md)',fontSize:13.5,color:'var(--text-secondary)'}}>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Step 1: Profile */}
        {step === 1 && (
          <>
            <div className="onboarding-title">Your Profile</div>
            <div className="onboarding-sub">Tell the world who you are.</div>
            <div style={{display:'flex',justifyContent:'center',marginBottom:20}}>
              <div style={{position:'relative'}}>
                <div className="av av-lg" style={{width:72,height:72,fontSize:28,borderColor:'var(--border-accent)'}}>
                  {avatarPreview
                    ? <img src={avatarPreview} style={{width:'100%',height:'100%',borderRadius:'50%',objectFit:'cover'}} />
                    : (form.display_name[0] || '?').toUpperCase()
                  }
                </div>
                <label style={{position:'absolute',bottom:0,right:0,width:26,height:26,borderRadius:'50%',background:'var(--accent)',border:'2px solid var(--bg-card)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
                  <Camera size={12} color="white"/>
                  <input type="file" accept="image/*" style={{display:'none'}} onChange={handleAvatarSelect}/>
                </label>
              </div>
            </div>
            <div className="form-field">
              <label className="form-label">Display Name *</label>
              <input className="form-input" placeholder="Your full name" value={form.display_name} onChange={set('display_name')}/>
            </div>
            <div className="form-field">
              <label className="form-label">Username *</label>
              <input className="form-input" placeholder="@yourusername" value={form.username} onChange={set('username')}/>
            </div>
            <div className="form-field">
              <label className="form-label">Bio (optional)</label>
              <textarea className="form-input" placeholder="Tell people about yourself..." value={form.bio} onChange={set('bio')} rows={2}/>
            </div>
            <div className="form-field">
              <label className="form-label">Status</label>
              <select className="form-input" value={form.status} onChange={set('status')}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </>
        )}

        {/* Step 2: Personalize */}
        {step === 2 && (
          <>
            <div className="onboarding-title">Personalize Leafy</div>
            <div className="onboarding-sub">Make it feel like yours.</div>
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
              <label className="form-label">Preview</label>
              <div style={{background:'var(--bg-raised)',borderRadius:'var(--radius-lg)',padding:16,display:'flex',flexDirection:'column',gap:8}}>
                <div style={{alignSelf:'flex-start',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'14px 14px 14px 3px',padding:'8px 12px',fontSize:13.5,color:'var(--text-primary)'}}>
                  Hey, welcome to Leafy! 🌿
                </div>
                <div style={{alignSelf:'flex-end',background:form.accent_color,borderRadius:'14px 14px 3px 14px',padding:'8px 12px',fontSize:13.5,color:'#fff'}}>
                  Thanks! Looks amazing 🎉
                </div>
              </div>
            </div>
          </>
        )}

        {/* Step 3: Discover */}
        {step === 3 && (
          <>
            <div className="onboarding-title">Find People</div>
            <div className="onboarding-sub">Here are some users already on Leafy. You can message them anytime.</div>
            {suggested.length === 0 && (
              <div style={{textAlign:'center',color:'var(--text-muted)',padding:'20px 0',fontSize:13}}>
                No other users yet — invite your friends!
              </div>
            )}
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {suggested.map(u => (
                <div key={u.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',background:'var(--bg-raised)',borderRadius:'var(--radius-md)'}}>
                  <div className="av av-sm" style={{width:36,height:36,fontSize:14}}>{(u.display_name||u.username)[0].toUpperCase()}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13.5,fontWeight:600,color:'var(--text-primary)'}}>{u.display_name||u.username}</div>
                    <div style={{fontSize:11.5,color:'var(--text-muted)'}}>@{u.username}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Navigation */}
        <div className="btn-row" style={{marginTop:22}}>
          {step > 0 && <button className="btn btn-ghost" onClick={() => setStep(s=>s-1)}>Back</button>}
          <button className="btn btn-primary" onClick={next} disabled={saving} style={{flex:1,justifyContent:'center'}}>
            {saving ? 'Saving...' : step === STEPS.length-1 ? '🌿 Start Chatting' : 'Continue'}
          </button>
        </div>
        {step === 0 && <div style={{textAlign:'center',marginTop:12,fontSize:12,color:'var(--text-muted)'}}>Takes less than a minute</div>}
      </div>
    </div>
  )
}
