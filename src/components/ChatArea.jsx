import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Pin, Users, Send, X, ChevronLeft, BarChart2, Clock,
  Shield, Eye, EyeOff, Palette, Paperclip, Mic, MicOff,
  ChevronDown, AtSign, Hash
} from 'lucide-react'
import { useStore } from '../lib/store'
import {
  getMessages, sendMessage, supabase, getPinnedItems,
  addPinnedItem, createPoll, sendFileMessage, uploadFile
} from '../lib/supabase'
import MessageBubble from './MessageBubble'
import Avatar from './Avatar'
import { format, isToday, isYesterday } from 'date-fns'
import toast from 'react-hot-toast'

const MOODS = [
  {name:'default',color:'#1a7a4a',label:'🌿'},
  {name:'ocean',color:'#0ea5e9',label:'🌊'},
  {name:'sunset',color:'#f97316',label:'🌅'},
  {name:'lavender',color:'#a855f7',label:'💜'},
  {name:'rose',color:'#f43f5e',label:'🌹'},
  {name:'gold',color:'#eab308',label:'✨'},
  {name:'slate',color:'#64748b',label:'🩶'},
]

// Simple markdown parser
function parseMarkdown(text) {
  if (!text) return text
  // Code blocks
  let parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      return <pre key={i} className="code-block">{part.slice(3, -3)}</pre>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="inline-code">{part.slice(1,-1)}</code>
    }
    // Inline formatting
    let segments = part.split(/(\*\*[^*]+\*\*|_[^_]+_|~~[^~]+~~|\[.+?\]\(.+?\))/g)
    return segments.map((seg, j) => {
      if (/^\*\*.*\*\*$/.test(seg)) return <strong key={j} className="md-bold">{seg.slice(2,-2)}</strong>
      if (/^_.*_$/.test(seg)) return <em key={j} className="md-italic">{seg.slice(1,-1)}</em>
      if (/^~~.*~~$/.test(seg)) return <span key={j} className="md-strike">{seg.slice(2,-2)}</span>
      const linkMatch = seg.match(/^\[(.+?)\]\((.+?)\)$/)
      if (linkMatch) return <a key={j} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" style={{color:'var(--mood,var(--accent))',textDecoration:'underline'}}>{linkMatch[1]}</a>
      return seg
    })
  })
}

export default function ChatArea({ onToggleSidebar }) {
  const { user, profile, conversations, activeConversationId, messages, setMessages, addMessage, updateMessage, activePanel, setActivePanel } = useStore()
  const [input, setInput] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [isAnon, setIsAnon] = useState(false)
  const [showPollModal, setShowPollModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showDestructModal, setShowDestructModal] = useState(false)
  const [showMoodModal, setShowMoodModal] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [scheduleDate, setScheduleDate] = useState('')
  const [destructMinutes, setDestructMinutes] = useState(60)
  const [pinnedItems, setPinnedItems] = useState([])
  const [vaultUnlocked, setVaultUnlocked] = useState(false)
  const [vaultPin, setVaultPin] = useState(['', '', '', ''])
  const [typingTimeout, setTypingTimeout] = useState(null)
  const [pinTitle, setPinTitle] = useState('')
  const [pinContent, setPinContent] = useState('')
  // New state
  const [isDragging, setIsDragging] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [showJumpBtn, setShowJumpBtn] = useState(false)
  const [unreadBelow, setUnreadBelow] = useState(0)
  const [mentionQuery, setMentionQuery] = useState(null)
  const [mentionResults, setMentionResults] = useState([])
  const [mentionIndex, setMentionIndex] = useState(0)
  const [members, setMembers] = useState([])

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const channelRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordTimerRef = useRef(null)
  const chunksRef = useRef([])

  const conv = conversations.find(c => c.id === activeConversationId)
  const convMessages = messages[activeConversationId] || []

  const getConvName = () => {
    if (!conv) return ''
    if (conv.type === 'group' || conv.type === 'community') return conv.name
    const other = conv.conversation_members?.find(m => m.user_id !== user.id)
    return other?.profiles?.display_name || other?.profiles?.username || 'Unknown'
  }

  const getOtherMember = () => {
    if (!conv || conv.type !== 'dm') return null
    return conv.conversation_members?.find(m => m.user_id !== user.id)?.profiles
  }

  useEffect(() => {
    if (!activeConversationId) return
    setInput('')
    setReplyTo(null)
    loadMessages()
    setupRealtime()
    if (conv?.is_vault) setVaultUnlocked(false)
    else setVaultUnlocked(true)
    if (conv?.conversation_members) setMembers(conv.conversation_members.map(m => m.profiles).filter(Boolean))
    return () => channelRef.current?.unsubscribe()
  }, [activeConversationId])

  useEffect(() => {
    if (activePanel === 'pins') loadPins()
  }, [activePanel])

  const loadMessages = async () => {
    setLoading(true)
    const { data } = await getMessages(activeConversationId)
    if (data) setMessages(activeConversationId, data)
    setLoading(false)
    setTimeout(() => messagesEndRef.current?.scrollIntoView({behavior:'smooth'}), 100)
  }

  const loadPins = async () => {
    const { data } = await getPinnedItems(activeConversationId)
    if (data) setPinnedItems(data)
  }

  const setupRealtime = () => {
    channelRef.current?.unsubscribe()
    channelRef.current = supabase.channel(`chat:${activeConversationId}`)
      .on('postgres_changes', {event:'INSERT',schema:'public',table:'messages',filter:`conversation_id=eq.${activeConversationId}`},
        async (payload) => {
          if (payload.new.sender_id === user.id) return
          const { data } = await supabase.from('messages')
            .select(`*, profiles:sender_id(id,username,display_name,avatar_url), reactions(id,emoji,user_id), reply:reply_to(id,content,profiles:sender_id(display_name))`)
            .eq('id', payload.new.id).single()
          if (data) {
            addMessage(activeConversationId, data)
            if (showJumpBtn) setUnreadBelow(n => n + 1)
            else messagesEndRef.current?.scrollIntoView({behavior:'smooth'})
          }
        })
      .subscribe()
  }

  const handleSend = async (overrides = {}) => {
    const content = input.trim()
    if (!content && !overrides.type) return
    setSending(true)
    // Extract mentions
    const mentionRegex = /@(\w+)/g
    const mentionedUsernames = [...(content.matchAll(mentionRegex)||[])].map(m => m[1])
    const mentionedUsers = members.filter(m => mentionedUsernames.includes(m.username)).map(m => m.id)

    const { data, error } = await sendMessage(
      activeConversationId, user.id,
      overrides.content || content,
      overrides.type || 'text',
      { ...overrides.metadata, mentioned_users: mentionedUsers },
      replyTo?.id || null, isAnon, overrides.expiresAt || null
    )
    setSending(false)
    if (error) return toast.error('Failed to send')
    addMessage(activeConversationId, { ...data, profiles: profile, reactions: [] })
    setInput('')
    setReplyTo(null)
    setTimeout(() => { messagesEndRef.current?.scrollIntoView({behavior:'smooth'}); setShowJumpBtn(false); setUnreadBelow(0) }, 50)
  }

  const handleKeyDown = (e) => {
    // Handle @mention navigation
    if (mentionQuery !== null) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i+1, mentionResults.length-1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i-1, 0)); return }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (mentionResults[mentionIndex]) insertMention(mentionResults[mentionIndex])
        return
      }
      if (e.key === 'Escape') { setMentionQuery(null); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
    if (e.key === 'Escape') setReplyTo(null)
  }

  const handleInputChange = (e) => {
    const val = e.target.value
    setInput(val)
    // Detect @mention
    const cursor = e.target.selectionStart
    const textBefore = val.slice(0, cursor)
    const mentionMatch = textBefore.match(/@(\w*)$/)
    if (mentionMatch) {
      const q = mentionMatch[1].toLowerCase()
      setMentionQuery(q)
      setMentionIndex(0)
      const filtered = members.filter(m =>
        (m.username||'').toLowerCase().includes(q) ||
        (m.display_name||'').toLowerCase().includes(q)
      ).slice(0, 6)
      setMentionResults(filtered)
    } else {
      setMentionQuery(null)
    }
    // Auto-resize
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const insertMention = (member) => {
    const cursor = inputRef.current?.selectionStart || input.length
    const textBefore = input.slice(0, cursor)
    const replaced = textBefore.replace(/@(\w*)$/, `@${member.username} `)
    setInput(replaced + input.slice(cursor))
    setMentionQuery(null)
    inputRef.current?.focus()
  }

  // Drag & Drop
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = async (e) => {
    e.preventDefault(); setIsDragging(false)
    const files = [...e.dataTransfer.files]
    for (const file of files) await sendFile(file)
  }

  // Paste from clipboard
  const handlePaste = async (e) => {
    const items = [...(e.clipboardData?.items || [])]
    const imageItem = items.find(item => item.type.startsWith('image/'))
    if (imageItem) {
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (file) await sendFile(file)
    }
  }

  const sendFile = async (file) => {
    if (file.size > 50 * 1024 * 1024) return toast.error('File too large (max 50MB)')
    setSending(true)
    const { data, error } = await sendFileMessage(activeConversationId, user.id, file, isAnon)
    setSending(false)
    if (error) return toast.error('Upload failed')
    if (data) { addMessage(activeConversationId, {...data, profiles:profile, reactions:[]}); messagesEndRef.current?.scrollIntoView({behavior:'smooth'}) }
  }

  const handleFileUpload = async (e) => { const f = e.target.files[0]; if (f) { await sendFile(f); e.target.value='' } }

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true})
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, {type:'audio/webm'})
        const file = new File([blob], `voice-${Date.now()}.webm`, {type:'audio/webm'})
        await sendFile(file)
        setRecordingTime(0)
      }
      mr.start()
      setIsRecording(true)
      let t = 0
      recordTimerRef.current = setInterval(() => { t++; setRecordingTime(t); if (t >= 120) stopRecording() }, 1000)
    } catch(err) {
      toast.error('Microphone access denied')
    }
  }

  const stopRecording = () => {
    clearInterval(recordTimerRef.current)
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  // Scroll detection for jump-to-bottom
  const handleScroll = (e) => {
    const el = e.target
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowJumpBtn(distFromBottom > 200)
    if (distFromBottom <= 200) setUnreadBelow(0)
  }

  const handleCreatePoll = async () => {
    const opts = pollOptions.filter(o => o.trim())
    if (!pollQuestion.trim() || opts.length < 2) return toast.error('Need question + 2 options')
    const { data, error } = await createPoll(activeConversationId, user.id, pollQuestion, opts)
    if (error) return toast.error('Failed to create poll')
    const { data: msg } = await supabase.from('messages').select(`*, profiles:sender_id(id,username,display_name,avatar_url), reactions(id,emoji,user_id)`).eq('id', data.message.id).single()
    if (msg) addMessage(activeConversationId, msg)
    setShowPollModal(false); setPollQuestion(''); setPollOptions(['',''])
    setTimeout(() => messagesEndRef.current?.scrollIntoView({behavior:'smooth'}), 50)
  }

  const handleMoodChange = async (mood) => {
    await supabase.from('conversations').update({mood_color:mood.color, mood_name:mood.name}).eq('id', activeConversationId)
    setShowMoodModal(false)
    toast.success(`Mood: ${mood.label}`, {className:'toast-leaf'})
  }

  const handleAddPin = async () => {
    if (!pinTitle.trim() || !pinContent.trim()) return
    const { data } = await addPinnedItem(activeConversationId, user.id, pinTitle, pinContent, conv?.mood_color)
    if (data) setPinnedItems(p => [...p, data])
    setPinTitle(''); setPinContent(''); setShowPinModal(false)
    toast.success('Pinned!', {className:'toast-leaf'})
  }

  const checkVaultPin = () => {
    if (vaultPin.join('') === (profile?.vault_pin || '1234')) setVaultUnlocked(true)
    else { toast.error('Wrong PIN'); setVaultPin(['','','','']) }
  }

  const handleSetDestruct = () => {
    const expiresAt = new Date(Date.now() + destructMinutes * 60000).toISOString()
    handleSend({ expiresAt })
    setShowDestructModal(false)
  }

  const handleSchedule = () => {
    if (!scheduleDate || !input.trim()) return toast.error('Set a message and time')
    handleSend({ scheduledAt: scheduleDate })
    setShowScheduleModal(false); setScheduleDate('')
  }

  // Group messages by date/sender
  const groupedMessages = []
  let lastDate = null; let lastSender = null
  convMessages.forEach((msg) => {
    const msgDate = new Date(msg.created_at)
    const dateStr = format(msgDate, 'yyyy-MM-dd')
    if (dateStr !== lastDate) {
      const label = isToday(msgDate) ? 'Today' : isYesterday(msgDate) ? 'Yesterday' : format(msgDate, 'MMMM d, yyyy')
      groupedMessages.push({type:'date', label})
      lastDate = dateStr; lastSender = null
    }
    const showAvatar = lastSender !== msg.sender_id || msg.is_anonymous
    const showName = showAvatar && msg.sender_id !== user.id
    groupedMessages.push({type:'msg', msg, showAvatar, showName})
    lastSender = msg.is_anonymous ? null : msg.sender_id
  })

  if (!conv) {
    return (
      <div className="chat-area">
        <div className="empty-state">
          <div className="es-art">🌿</div>
          <h3>Welcome to Leafy</h3>
          <p>Select a conversation or start a new one to begin chatting</p>
          <p style={{fontSize:12,marginTop:6}}>by <strong style={{color:'var(--accent)'}}>Sematech Developers</strong></p>
        </div>
      </div>
    )
  }

  const moodName = conv.mood_name || 'default'
  const otherMember = getOtherMember()

  return (
    <div className="chat-area" data-mood={moodName}
      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      
      {/* Background pattern */}
      <div className="chat-bg-pattern"/>

      {/* Vault lock */}
      {conv.is_vault && !vaultUnlocked && (
        <div className="vault-overlay">
          <div className="vault-icon">🔐</div>
          <div className="vault-title">Vault Chat</div>
          <p style={{color:'var(--text-muted)',fontSize:13}}>Enter your PIN to unlock</p>
          <div className="pin-inputs">
            {[0,1,2,3].map(i => (
              <input key={i} id={`pin-${i}`} className="pin-input" type="password" maxLength={1} value={vaultPin[i]}
                onChange={e => { const v=[...vaultPin]; v[i]=e.target.value; setVaultPin(v); if (e.target.value && i < 3) document.getElementById(`pin-${i+1}`)?.focus() }}/>
            ))}
          </div>
          <button className="btn btn-primary" onClick={checkVaultPin}>Unlock</button>
        </div>
      )}

      {/* Drag overlay */}
      {isDragging && (
        <div className="drop-overlay">
          <Paperclip size={40}/>
          <span>Drop files to send</span>
        </div>
      )}

      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <button className="icon-btn" id="back-btn" style={{display:'none'}} onClick={onToggleSidebar}><ChevronLeft size={18}/></button>
          {otherMember
            ? <div className="av-wrap"><div className="av" style={{width:'var(--avatar-size)',height:'var(--avatar-size)'}}>{otherMember.avatar_url ? <img src={otherMember.avatar_url} style={{width:'100%',height:'100%',borderRadius:'50%',objectFit:'cover'}}/> : (otherMember.display_name||otherMember.username||'?')[0].toUpperCase()}</div><div className={`status-dot ${otherMember.online_status||'offline'}`}/></div>
            : <div className="av" style={{background:'var(--accent-glow)',color:'var(--accent)',width:'var(--avatar-size)',height:'var(--avatar-size)'}}>{getConvName()[0]?.toUpperCase()}</div>
          }
          <div className="chat-header-info">
            <h2>{getConvName()}</h2>
            <div className="sub">{conv.type === 'dm' ? (otherMember?.online_status||'offline') : `${conv.member_count||conv.conversation_members?.length||0} members`}</div>
          </div>
        </div>
        <div className="chat-header-actions">
          <button className="icon-btn" title="Chat Mood" onClick={() => setShowMoodModal(true)}><Palette size={16}/></button>
          <button className={`icon-btn ${activePanel==='pins'?'active':''}`} title="Pins" onClick={() => { setActivePanel(activePanel==='pins'?null:'pins'); loadPins() }}><Pin size={16}/></button>
          <button className={`icon-btn ${activePanel==='members'?'active':''}`} title="Members" onClick={() => setActivePanel(activePanel==='members'?null:'members')}><Users size={16}/></button>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container" onScroll={handleScroll}>
        {loading && (
          <div style={{display:'flex',flexDirection:'column',gap:12,padding:'10px 0'}}>
            {[1,2,3,4,5].map(i => (
              <div key={i} className="skeleton-conv">
                <div className="skeleton skeleton-avatar"/>
                <div style={{flex:1,display:'flex',flexDirection:'column',gap:8}}>
                  <div className="skeleton skeleton-line" style={{width:'60%'}}/>
                  <div className="skeleton skeleton-line-sm"/>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && groupedMessages.map((item, i) =>
          item.type === 'date'
            ? <div key={`d${i}`} className="date-divider"><span>{item.label}</span></div>
            : <MessageBubble key={item.msg.id} msg={item.msg} isOwn={item.msg.sender_id===user.id}
                showAvatar={item.showAvatar} showName={item.showName}
                onReply={setReplyTo} parseMarkdown={parseMarkdown}/>
        )}
        <div ref={messagesEndRef}/>
      </div>

      {/* Jump to bottom */}
      {showJumpBtn && (
        <button className="jump-btn" onClick={() => { messagesEndRef.current?.scrollIntoView({behavior:'smooth'}); setShowJumpBtn(false); setUnreadBelow(0) }}>
          <ChevronDown size={18}/>
          {unreadBelow > 0 && <span className="jump-count">{unreadBelow}</span>}
        </button>
      )}

      {/* Typing indicator */}
      <div className="typing-row" style={{opacity:0,pointerEvents:'none'}}>
        <div className="typing-dots"><div className="td"/><div className="td"/><div className="td"/></div>
      </div>

      {/* Input area */}
      <div className="input-area" onPaste={handlePaste}>
        {/* Reply strip */}
        {replyTo && (
          <div className="reply-strip">
            <div className="reply-strip-text"><strong>↩ {replyTo.profiles?.display_name||'Someone'}:</strong> {replyTo.content?.slice(0,60)}{replyTo.content?.length>60?'...':''}</div>
            <button className="icon-btn" style={{width:24,height:24}} onClick={() => setReplyTo(null)}><X size={13}/></button>
          </div>
        )}

        {/* Recording strip */}
        {isRecording && (
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',background:'rgba(239,68,68,0.1)',borderRadius:'var(--radius-md)',marginBottom:8,border:'1px solid rgba(239,68,68,0.2)'}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:'#ef4444',animation:'recordPulse 1s ease infinite'}}/>
            <span style={{fontSize:13,color:'#ef4444',flex:1}}>Recording... {recordingTime}s</span>
            <button className="btn btn-danger" style={{padding:'4px 10px',fontSize:12}} onClick={stopRecording}>Stop & Send</button>
          </div>
        )}

        {/* Feature buttons */}
        <div className="feat-btns">
          <button className={`feat-btn ${isAnon?'on':''}`} onClick={() => setIsAnon(!isAnon)} title="Toggle anonymous mode">
            {isAnon ? <EyeOff size={11}/> : <Eye size={11}/>} {isAnon?'Anon ON':'Anon'}
          </button>
          <button className="feat-btn" onClick={() => setShowPollModal(true)}><BarChart2 size={11}/> Poll</button>
          <button className="feat-btn" onClick={() => setShowDestructModal(true)}><Shield size={11}/> 🔥 Destruct</button>
          <button className="feat-btn" onClick={() => setShowScheduleModal(true)}><Clock size={11}/> Schedule</button>
          {activePanel === 'pins' && <button className="feat-btn" onClick={() => setShowPinModal(true)}><Pin size={11}/> Pin</button>}
          <label className="feat-btn" style={{cursor:'pointer'}}>
            <Paperclip size={11}/> File
            <input ref={fileInputRef} type="file" style={{display:'none'}} onChange={handleFileUpload}
              accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.mp3,.wav"/>
          </label>
        </div>

        {/* @mention dropdown */}
        {mentionQuery !== null && mentionResults.length > 0 && (
          <div className="mention-dropdown" style={{marginBottom:6}}>
            {mentionResults.map((m, i) => (
              <div key={m.id} className={`mention-item ${mentionIndex===i?'selected':''}`} onClick={() => insertMention(m)}>
                <div className="av av-sm" style={{width:28,height:28,fontSize:11}}>{(m.display_name||m.username)[0].toUpperCase()}</div>
                <div><div className="mn">{m.display_name||m.username}</div><div className="mu">@{m.username}</div></div>
              </div>
            ))}
          </div>
        )}

        <div className="input-row">
          <div className="input-wrap">
            <textarea ref={inputRef} className="msg-input"
              placeholder={isAnon ? 'Message anonymously...' : `Message ${getConvName()}... (@mention, **bold**, \`code\`)`}
              value={input} onChange={handleInputChange} onKeyDown={handleKeyDown} rows={1}/>
          </div>
          <button className={`record-btn ${isRecording?'recording':''}`} title="Hold to record voice"
            onClick={isRecording ? stopRecording : startRecording}>
            {isRecording ? <MicOff size={16}/> : <Mic size={16}/>}
          </button>
          <button className="send-btn" onClick={() => handleSend()} disabled={!input.trim() || sending}>
            <Send size={16}/>
          </button>
        </div>
      </div>

      {/* === MODALS === */}

      {showPollModal && (
        <div className="modal-overlay" onClick={() => setShowPollModal(false)}>
          <div className="modal pop-in" onClick={e=>e.stopPropagation()}>
            <h3>📊 Create a Poll</h3>
            <div className="form-field">
              <label className="form-label">Question</label>
              <input className="form-input" placeholder="Ask something..." value={pollQuestion} onChange={e=>setPollQuestion(e.target.value)}/>
            </div>
            <div className="form-field">
              <label className="form-label">Options</label>
              {pollOptions.map((opt,i) => (
                <div key={i} style={{display:'flex',gap:8,marginBottom:8}}>
                  <input className="form-input" placeholder={`Option ${i+1}`} value={opt} onChange={e=>{const o=[...pollOptions];o[i]=e.target.value;setPollOptions(o)}}/>
                  {i>1 && <button className="btn btn-ghost" style={{padding:'8px 10px'}} onClick={()=>setPollOptions(p=>p.filter((_,j)=>j!==i))}>✕</button>}
                </div>
              ))}
              {pollOptions.length < 6 && <button className="btn btn-ghost" style={{fontSize:13}} onClick={()=>setPollOptions(p=>[...p,''])}>+ Add Option</button>}
            </div>
            <div className="btn-row">
              <button className="btn btn-ghost" onClick={()=>setShowPollModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreatePoll}>Create Poll</button>
            </div>
          </div>
        </div>
      )}

      {showDestructModal && (
        <div className="modal-overlay" onClick={() => setShowDestructModal(false)}>
          <div className="modal pop-in" onClick={e=>e.stopPropagation()}>
            <h3>🔥 Self-Destructing Message</h3>
            <p style={{color:'var(--text-muted)',fontSize:13.5,marginBottom:18}}>Your current message disappears after the set time.</p>
            <div className="form-field">
              <label className="form-label">Disappears after</label>
              <select className="form-input" value={destructMinutes} onChange={e=>setDestructMinutes(Number(e.target.value))}>
                <option value={1}>1 minute</option><option value={5}>5 minutes</option>
                <option value={30}>30 minutes</option><option value={60}>1 hour</option>
                <option value={1440}>24 hours</option><option value={10080}>1 week</option>
              </select>
            </div>
            <div className="btn-row">
              <button className="btn btn-ghost" onClick={()=>setShowDestructModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleSetDestruct}>Send & Destruct</button>
            </div>
          </div>
        </div>
      )}

      {showScheduleModal && (
        <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="modal pop-in" onClick={e=>e.stopPropagation()}>
            <h3>⏰ Schedule Message</h3>
            <div className="form-field">
              <label className="form-label">Send at</label>
              <input className="form-input" type="datetime-local" value={scheduleDate} onChange={e=>setScheduleDate(e.target.value)} min={new Date().toISOString().slice(0,16)}/>
            </div>
            <div className="btn-row">
              <button className="btn btn-ghost" onClick={()=>setShowScheduleModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSchedule}>Schedule</button>
            </div>
          </div>
        </div>
      )}

      {showMoodModal && (
        <div className="modal-overlay" onClick={() => setShowMoodModal(false)}>
          <div className="modal pop-in" onClick={e=>e.stopPropagation()}>
            <h3>🎨 Chat Mood</h3>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:10,margin:'16px 0'}}>
              {MOODS.map(m => (
                <div key={m.name} onClick={() => handleMoodChange(m)}
                  style={{aspectRatio:'1',borderRadius:12,background:m.color,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,border:conv.mood_name===m.name?'3px solid white':'2px solid transparent',transform:conv.mood_name===m.name?'scale(1.12)':'none',transition:'all 0.15s',boxShadow:conv.mood_name===m.name?'0 0 14px rgba(255,255,255,0.3)':'none'}}>
                  {m.label}
                </div>
              ))}
            </div>
            <div className="btn-row"><button className="btn btn-ghost" onClick={()=>setShowMoodModal(false)}>Close</button></div>
          </div>
        </div>
      )}

      {showPinModal && (
        <div className="modal-overlay" onClick={() => setShowPinModal(false)}>
          <div className="modal pop-in" onClick={e=>e.stopPropagation()}>
            <h3>📌 Add Context Pin</h3>
            <div className="form-field"><label className="form-label">Title</label><input className="form-input" placeholder="e.g. Meeting Date" value={pinTitle} onChange={e=>setPinTitle(e.target.value)}/></div>
            <div className="form-field"><label className="form-label">Content</label><textarea className="form-input" placeholder="Important info..." value={pinContent} onChange={e=>setPinContent(e.target.value)} rows={3}/></div>
            <div className="btn-row"><button className="btn btn-ghost" onClick={()=>setShowPinModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleAddPin}>Pin It</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
