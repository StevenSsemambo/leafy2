import { useState, useRef } from 'react'
import { Smile, Reply, Trash2, Timer, Pencil, Check, X, Download, Play, Pause, Bookmark, Forward } from 'lucide-react'
import { addReaction, removeReaction, deleteMessage, votePoll, editMessage, supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const QUICK_EMOJIS = ['👍','❤️','😂','😮','😢','🔥','🎉','👀']
const FILE_ICONS = {pdf:'📄',doc:'📝',docx:'📝',xls:'📊',xlsx:'📊',ppt:'📊',pptx:'📊',zip:'🗜️',rar:'🗜️',txt:'📃',mp3:'🎵',wav:'🎵',mp4:'🎬',mov:'🎬',default:'📎'}
const formatBytes = b => !b?'':b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(1)+' MB'
const formatSecs = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`

export default function MessageBubble({ msg, isOwn, showAvatar, showName, onReply, parseMarkdown }) {
  const { user, updateMessage, removeMessage, activeConversationId } = useStore()
  const [showActions, setShowActions] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(msg.content || '')
  const [voicePlaying, setVoicePlaying] = useState(false)
  const [voiceProgress, setVoiceProgress] = useState(0)
  const audioRef = useRef(null)

  const reactions = msg.reactions || []
  const grouped = reactions.reduce((a, r) => { if (!a[r.emoji]) a[r.emoji]=[]; a[r.emoji].push(r.user_id); return a }, {})
  const meta = msg.metadata || {}

  const handleReact = async (emoji) => {
    const existing = reactions.find(r => r.user_id===user.id && r.emoji===emoji)
    if (existing) {
      await removeReaction(msg.id, user.id, emoji)
      updateMessage(activeConversationId, msg.id, { reactions: reactions.filter(r => !(r.user_id===user.id && r.emoji===emoji)) })
    } else {
      const { data } = await addReaction(msg.id, user.id, emoji)
      if (data) updateMessage(activeConversationId, msg.id, { reactions: [...reactions, data] })
    }
    setShowEmoji(false)
  }

  const handleDelete = async () => {
    await deleteMessage(msg.id)
    removeMessage(activeConversationId, msg.id)
  }

  const handleEdit = async () => {
    if (!editContent.trim() || editContent === msg.content) { setEditing(false); return }
    const { data } = await editMessage(msg.id, editContent, msg.content, user.id)
    if (data) updateMessage(activeConversationId, msg.id, { content: editContent, edited_at: new Date().toISOString() })
    setEditing(false)
  }

  const handleSave = async () => {
    await supabase.from('saved_messages').upsert({ user_id: user.id, message_id: msg.id })
    toast.success('Message saved! 🔖', { className: 'toast-leaf' })
  }

  const handlePollVote = async (optionId) => {
    if (!msg.metadata?.poll_id) return
    const { data: poll } = await supabase.from('polls').select('*').eq('id', msg.metadata.poll_id).single()
    if (!poll) return
    const votes = { ...poll.votes, [user.id]: optionId }
    const options = poll.options.map(o => ({ ...o, count: Object.values(votes).filter(v => v === o.id).length }))
    await supabase.from('polls').update({ votes, options }).eq('id', poll.id)
    updateMessage(activeConversationId, msg.id, { metadata: { ...meta, options, votes } })
  }

  const toggleVoice = () => {
    if (!audioRef.current) return
    if (voicePlaying) { audioRef.current.pause(); setVoicePlaying(false) }
    else { audioRef.current.play(); setVoicePlaying(true) }
  }

  if (msg.type === 'system') return <div className="system-msg fade-in">{msg.content}</div>
  if (msg.expires_at && new Date(msg.expires_at) < new Date() && !isOwn) return null

  return (
    <div className={`message-row ${isOwn?'own':''} fade-in`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmoji(false) }}>

      <div className="msg-av">
        {showAvatar && !isOwn && (
          <div className="av av-sm">{msg.is_anonymous?'?':(msg.profiles?.display_name||msg.profiles?.username||'?')[0].toUpperCase()}</div>
        )}
      </div>

      <div className="message-bubble-wrap">
        {showName && !isOwn && !msg.is_anonymous && (
          <div className="sender-name-row">{msg.profiles?.display_name||msg.profiles?.username}</div>
        )}
        {showName && msg.is_anonymous && (
          <div className="sender-name-row" style={{color:'var(--text-muted)'}}>Anonymous</div>
        )}

        {msg.reply && (
          <div className="reply-preview">
            <div className="rp-sender">{msg.reply.profiles?.display_name||'Someone'}</div>
            <div className="rp-text">{msg.reply.content}</div>
          </div>
        )}

        <div className="message-bubble" style={{position:'relative'}}>
          {/* Actions */}
          {showActions && !editing && (
            <div className="msg-actions">
              <button className="msg-act" title="React" onClick={() => setShowEmoji(!showEmoji)}><Smile size={12}/></button>
              <button className="msg-act" title="Reply" onClick={() => onReply(msg)}><Reply size={12}/></button>
              <button className="msg-act" title="Save" onClick={handleSave}><Bookmark size={12}/></button>
              {isOwn && msg.type==='text' && <button className="msg-act" title="Edit" onClick={() => { setEditing(true); setEditContent(msg.content) }}><Pencil size={12}/></button>}
              {isOwn && <button className="msg-act" title="Delete" onClick={handleDelete} style={{color:'#ef4444'}}><Trash2 size={12}/></button>}
            </div>
          )}

          {/* Quick emoji */}
          {showEmoji && (
            <div className="quick-emoji-row">
              {QUICK_EMOJIS.map(e => (
                <button key={e} className="qe-btn" onClick={() => handleReact(e)}>{e}</button>
              ))}
            </div>
          )}

          {/* TEXT */}
          {msg.type === 'text' && (
            editing ? (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <textarea value={editContent} onChange={e=>setEditContent(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleEdit()}if(e.key==='Escape')setEditing(false)}}
                  style={{background:'rgba(0,0,0,0.18)',border:'1px solid rgba(255,255,255,0.18)',borderRadius:8,padding:'6px 8px',color:'inherit',fontFamily:'var(--font-body)',fontSize:'var(--font-msg)',resize:'none',minWidth:180,outline:'none'}}
                  autoFocus rows={Math.max(1,editContent.split('\n').length)}/>
                <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                  <button onClick={()=>setEditing(false)} style={{background:'rgba(255,255,255,0.1)',border:'none',borderRadius:6,padding:'3px 8px',cursor:'pointer',color:'inherit',fontSize:12,display:'flex',alignItems:'center',gap:3}}><X size={10}/>Cancel</button>
                  <button onClick={handleEdit} style={{background:'var(--accent)',border:'none',borderRadius:6,padding:'3px 8px',cursor:'pointer',color:'white',fontSize:12,display:'flex',alignItems:'center',gap:3}}><Check size={10}/>Save</button>
                </div>
              </div>
            ) : (
              <div style={{whiteSpace:'pre-wrap',margin:0,wordBreak:'break-word',lineHeight:1.55}}>
                {parseMarkdown ? parseMarkdown(msg.content) : msg.content}
              </div>
            )
          )}

          {/* IMAGE */}
          {msg.type === 'image' && meta.url && (
            <div>
              <img src={meta.url} alt={meta.filename||'Image'}
                style={{maxWidth:'100%',maxHeight:260,borderRadius:10,display:'block',objectFit:'cover',cursor:'pointer'}}
                onClick={() => window.open(meta.url,'_blank')}/>
              {meta.caption && <p style={{margin:'5px 0 0',fontSize:13,opacity:0.85}}>{meta.caption}</p>}
            </div>
          )}

          {/* VIDEO */}
          {msg.type === 'video' && meta.url && (
            <video src={meta.url} controls style={{maxWidth:'100%',maxHeight:240,borderRadius:10,display:'block'}}/>
          )}

          {/* VOICE / AUDIO */}
          {(msg.type === 'voice' || msg.type === 'audio') && meta.url && (
            <div className="voice-msg">
              <button className="voice-play" onClick={toggleVoice}>
                {voicePlaying ? <Pause size={14}/> : <Play size={14}/>}
              </button>
              <div className="voice-waveform">
                {(meta.waveform||Array(24).fill(0.5)).map((v,i) => (
                  <div key={i} className={`wave-bar ${voiceProgress>i/(meta.waveform?.length||24)?'active':''}`}
                    style={{height:`${Math.max(4, v*28)}px`}}/>
                ))}
              </div>
              <span className="voice-dur">{formatSecs(meta.duration_seconds||0)}</span>
              <audio ref={audioRef} src={meta.url}
                onTimeUpdate={() => { if(audioRef.current) setVoiceProgress(audioRef.current.currentTime/audioRef.current.duration) }}
                onEnded={() => { setVoicePlaying(false); setVoiceProgress(0) }}/>
            </div>
          )}

          {/* FILE */}
          {msg.type === 'file' && (
            <a href={meta.url} download={meta.filename} target="_blank" rel="noopener noreferrer" style={{textDecoration:'none'}}>
              <div className="file-bubble">
                <span className="file-icon">{FILE_ICONS[meta.ext?.toLowerCase()]||FILE_ICONS.default}</span>
                <div className="file-info">
                  <div className="file-name" style={{color:isOwn?'white':'var(--text-primary)'}}>{meta.filename||msg.content}</div>
                  <div className="file-meta">{formatBytes(meta.filesize)} · {meta.ext?.toUpperCase()||'File'}</div>
                </div>
                <Download size={14} style={{color:isOwn?'rgba(255,255,255,0.6)':'var(--text-muted)',flexShrink:0}}/>
              </div>
            </a>
          )}

          {/* POLL */}
          {msg.type === 'poll' && <PollBubble meta={meta} userId={user.id} onVote={handlePollVote}/>}

          {/* Link preview (if metadata contains url info) */}
          {msg.type === 'text' && meta.link_preview && (
            <a href={meta.link_preview.url} target="_blank" rel="noopener noreferrer" style={{textDecoration:'none'}}>
              <div className="link-preview">
                {meta.link_preview.image_url && <img src={meta.link_preview.image_url} className="lp-img" alt=""/>}
                <div className="lp-body">
                  {meta.link_preview.site_name && <div className="lp-site">{meta.link_preview.site_name}</div>}
                  <div className="lp-title">{meta.link_preview.title}</div>
                  {meta.link_preview.description && <div className="lp-desc">{meta.link_preview.description}</div>}
                </div>
              </div>
            </a>
          )}

          {/* Badges */}
          {msg.expires_at && <div className="destruct-badge"><Timer size={10}/> Disappears {format(new Date(msg.expires_at),'MMM d, h:mm a')}</div>}
          {msg.scheduled_at && <div className="sched-badge">⏰ Scheduled {format(new Date(msg.scheduled_at),'MMM d, h:mm a')}</div>}
        </div>

        {/* Reactions */}
        {Object.keys(grouped).length > 0 && (
          <div className="reactions-bar">
            {Object.entries(grouped).map(([emoji,users]) => (
              <button key={emoji} className={`reaction-chip ${users.includes(user.id)?'own':''}`} onClick={()=>handleReact(emoji)}>
                {emoji}<span>{users.length}</span>
              </button>
            ))}
          </div>
        )}

        <div className="msg-time">
          {format(new Date(msg.created_at),'h:mm a')}
          {msg.edited_at && <span className="edited-tag"> · edited</span>}
          {isOwn && <span>✓✓</span>}
        </div>
      </div>
    </div>
  )
}

function PollBubble({ meta, userId, onVote }) {
  const question = meta.question
  const options = meta.options || []
  const votes = meta.votes || {}
  const myVote = votes[userId]
  const total = Object.keys(votes).length
  return (
    <div className="poll-card">
      <div className="poll-question">📊 {question}</div>
      {options.map((opt, i) => {
        const count = Object.values(votes).filter(v=>v===i).length
        const pct = total > 0 ? Math.round((count/total)*100) : 0
        return (
          <div key={i} className={`poll-opt ${myVote===i?'voted':''}`} onClick={() => onVote(i)}>
            <div className="poll-bar" style={{width:`${pct}%`}}/>
            <div className="poll-opt-inner"><span>{opt.text||opt}</span><span className="poll-pct">{pct}%</span></div>
          </div>
        )
      })}
      <div style={{fontSize:11,color:'var(--text-muted)',marginTop:8}}>{total} vote{total!==1?'s':''}</div>
    </div>
  )
}
