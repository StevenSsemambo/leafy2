import { useState, useEffect, useRef } from 'react'
import { X, Plus, ChevronLeft, ChevronRight, Eye, Trash2, Image } from 'lucide-react'
import { getStories, createStory, viewStory, deleteStory, uploadFile } from '../lib/supabase'
import { useStore } from '../lib/store'
import Avatar from './Avatar'
import { formatDistanceToNowStrict } from 'date-fns'
import toast from 'react-hot-toast'

const BG_COLORS = [
  '#1a7a4a', '#0c4a6e', '#7c2d12', '#3b0764',
  '#881337', '#1e3a5f', '#14532d', '#78350f',
  '#1a1a2e', '#0f3460', '#533483', '#2d6a4f'
]

const TEXT_COLORS = ['#ffffff', '#f0fdf4', '#fef9c3', '#fce7f3', '#e0f2fe']

export default function StoriesBar() {
  const { user, profile } = useStore()
  const [stories, setStories] = useState([])
  const [viewing, setViewing] = useState(null) // { userStories, index }
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const progressRef = useRef(null)
  const timerRef = useRef(null)

  // Create story state
  const [storyText, setStoryText] = useState('')
  const [storyCaption, setStoryCaption] = useState('')
  const [storyBg, setStoryBg] = useState('#1a7a4a')
  const [storyTextColor, setStoryTextColor] = useState('#ffffff')
  const [storyImage, setStoryImage] = useState(null)
  const [storyImagePreview, setStoryImagePreview] = useState(null)
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    loadStories()
  }, [])

  useEffect(() => {
    if (viewing) startProgressTimer()
    else clearTimer()
    return () => clearTimer()
  }, [viewing])

  const loadStories = async () => {
    setLoading(true)
    const { data } = await getStories()
    if (data) {
      // Group by user
      const grouped = {}
      data.forEach(s => {
        const uid = s.user_id
        if (!grouped[uid]) grouped[uid] = { profile: s.profiles, stories: [] }
        grouped[uid].stories.push(s)
      })
      setStories(Object.values(grouped))
    }
    setLoading(false)
  }

  const startProgressTimer = () => {
    clearTimer()
    setProgress(0)
    let p = 0
    timerRef.current = setInterval(() => {
      p += 2
      setProgress(p)
      if (p >= 100) {
        clearTimer()
        goNext()
      }
    }, 100) // 5 second stories
  }

  const clearTimer = () => {
    clearInterval(timerRef.current)
    timerRef.current = null
  }

  const openStories = async (userGroup) => {
    setViewing({ userGroup, storyIndex: 0 })
    const first = userGroup.stories[0]
    await viewStory(first.id, user.id)
  }

  const goNext = async () => {
    if (!viewing) return
    const { userGroup, storyIndex } = viewing
    if (storyIndex < userGroup.stories.length - 1) {
      const next = storyIndex + 1
      setViewing({ userGroup, storyIndex: next })
      await viewStory(userGroup.stories[next].id, user.id)
    } else {
      // Find next user's stories
      const currentUserIdx = stories.findIndex(g => g.profile.id === userGroup.profile.id)
      if (currentUserIdx < stories.length - 1) {
        const nextGroup = stories[currentUserIdx + 1]
        setViewing({ userGroup: nextGroup, storyIndex: 0 })
        await viewStory(nextGroup.stories[0].id, user.id)
      } else {
        setViewing(null)
      }
    }
  }

  const goPrev = () => {
    if (!viewing) return
    const { userGroup, storyIndex } = viewing
    if (storyIndex > 0) {
      setViewing({ userGroup, storyIndex: storyIndex - 1 })
    }
  }

  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setStoryImage(file)
    setStoryImagePreview(URL.createObjectURL(file))
  }

  const handlePostStory = async () => {
    if (!storyText.trim() && !storyImage) return toast.error('Add text or an image')
    setPosting(true)
    let mediaUrl = null
    let mediaType = 'text'

    if (storyImage) {
      const path = `stories/${user.id}/${Date.now()}`
      const { url, error } = await uploadFile('media', path, storyImage)
      if (error) { toast.error('Failed to upload image'); setPosting(false); return }
      mediaUrl = url
      mediaType = storyImage.type.startsWith('video/') ? 'video' : 'image'
    }

    const { data, error } = await createStory(
      user.id, storyText, mediaUrl, mediaType, storyBg, storyCaption
    )
    setPosting(false)
    if (error) return toast.error('Failed to post story')
    toast.success('Story posted! 🌿', { className: 'toast-leaf' })
    setCreating(false)
    setStoryText('')
    setStoryCaption('')
    setStoryBg('#1a7a4a')
    setStoryImage(null)
    setStoryImagePreview(null)
    loadStories()
  }

  const handleDeleteStory = async (storyId) => {
    await deleteStory(storyId)
    toast.success('Story deleted')
    setViewing(null)
    loadStories()
  }

  const myStories = stories.find(g => g.profile.id === user.id)
  const currentStory = viewing ? viewing.userGroup.stories[viewing.storyIndex] : null
  const isMyStory = currentStory?.user_id === user.id

  return (
    <>
      {/* Stories Bar */}
      <div style={{
        display: 'flex',
        gap: 12,
        padding: '10px 16px',
        overflowX: 'auto',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
        scrollbarWidth: 'none',
      }}>
        {/* Add my story */}
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', flexShrink: 0 }}
          onClick={() => myStories ? openStories(myStories) : setCreating(true)}
        >
          <div style={{ position: 'relative' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: myStories ? 'linear-gradient(135deg, var(--accent), #0ea5e9)' : 'var(--bg-card)',
              padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Avatar profile={profile} size="md" />
            </div>
            {!myStories && (
              <div style={{
                position: 'absolute', bottom: -1, right: -1,
                width: 20, height: 20, borderRadius: '50%',
                background: 'var(--accent)', border: '2px solid var(--bg-deep)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Plus size={11} color="white" />
              </div>
            )}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {myStories ? 'My Story' : 'Add Story'}
          </span>
        </div>

        {/* Other users' stories */}
        {stories.filter(g => g.profile.id !== user.id).map(group => {
          const hasViewed = group.stories.every(s => (s.views || []).includes(user.id))
          return (
            <div
              key={group.profile.id}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', flexShrink: 0 }}
              onClick={() => openStories(group)}
            >
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: hasViewed
                  ? 'var(--border-default)'
                  : 'linear-gradient(135deg, var(--accent), #0ea5e9)',
                padding: 2
              }}>
                <Avatar profile={group.profile} size="md" />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {group.profile.display_name || group.profile.username}
              </span>
            </div>
          )
        })}

        {!loading && stories.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: 12.5, padding: '0 8px' }}>
            No stories yet — be the first!
          </div>
        )}
      </div>

      {/* Story Viewer */}
      {viewing && currentStory && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)',
          zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {/* Story Card */}
          <div style={{
            width: '100%', maxWidth: 400, height: '100%', maxHeight: 700,
            position: 'relative', borderRadius: 20, overflow: 'hidden',
            background: currentStory.background_color || '#1a7a4a',
            display: 'flex', flexDirection: 'column'
          }}>
            {/* Progress bars */}
            <div style={{ display: 'flex', gap: 3, padding: '12px 12px 0', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
              {viewing.userGroup.stories.map((_, i) => (
                <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.3)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2, background: 'white',
                    width: i < viewing.storyIndex ? '100%' : i === viewing.storyIndex ? `${progress}%` : '0%',
                    transition: i === viewing.storyIndex ? 'none' : undefined
                  }} />
                </div>
              ))}
            </div>

            {/* Header */}
            <div style={{ position: 'absolute', top: 24, left: 12, right: 12, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar profile={viewing.userGroup.profile} size="sm" />
                <div>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>
                    {viewing.userGroup.profile.display_name || viewing.userGroup.profile.username}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
                    {formatDistanceToNowStrict(new Date(currentStory.created_at), { addSuffix: true })}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {isMyStory && (
                  <button onClick={() => handleDeleteStory(currentStory.id)}
                    style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: 'white' }}>
                    <Trash2 size={14} />
                  </button>
                )}
                <button onClick={() => setViewing(null)}
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: 'white' }}>
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Story Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative' }}>
              {currentStory.media_url && currentStory.media_type === 'image' && (
                <img src={currentStory.media_url} alt="" style={{ maxWidth: '100%', maxHeight: '60%', borderRadius: 12, objectFit: 'contain', marginBottom: 16 }} />
              )}
              {currentStory.content && (
                <p style={{
                  color: 'white', fontSize: 22, fontWeight: 700,
                  textAlign: 'center', lineHeight: 1.4,
                  textShadow: '0 2px 8px rgba(0,0,0,0.4)',
                  fontFamily: 'var(--font-display)',
                  padding: '0 16px'
                }}>
                  {currentStory.content}
                </p>
              )}
              {currentStory.caption && (
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center', marginTop: 10 }}>
                  {currentStory.caption}
                </p>
              )}
            </div>

            {/* Views */}
            {isMyStory && (
              <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.4)', borderRadius: 20, padding: '6px 14px', color: 'white', fontSize: 12 }}>
                  <Eye size={13} />
                  {(currentStory.views || []).length} views
                </div>
              </div>
            )}

            {/* Tap zones */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={goPrev} />
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={goNext} />
            </div>
          </div>

          {/* Nav arrows */}
          <button onClick={goPrev} style={{ position: 'absolute', left: 20, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 44, height: 44, cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={20} />
          </button>
          <button onClick={goNext} style={{ position: 'absolute', right: 20, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 44, height: 44, cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {/* Create Story Modal */}
      {creating && (
        <div className="modal-overlay" onClick={() => setCreating(false)}>
          <div className="modal pop-in" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>📸 New Story</h3>
              <button className="icon-btn" onClick={() => setCreating(false)}><X size={16} /></button>
            </div>

            {/* Preview */}
            <div style={{
              height: 180, borderRadius: 16, background: storyBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 16, overflow: 'hidden', position: 'relative'
            }}>
              {storyImagePreview ? (
                <img src={storyImagePreview} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <p style={{ color: storyTextColor, fontSize: 18, fontWeight: 700, textAlign: 'center', padding: 16, fontFamily: 'var(--font-display)' }}>
                  {storyText || 'Your story preview...'}
                </p>
              )}
            </div>

            {/* Image upload */}
            <div style={{ marginBottom: 12 }}>
              <label className="btn btn-ghost" style={{ cursor: 'pointer', width: '100%', justifyContent: 'center', gap: 6 }}>
                <Image size={14} /> Add Image
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageSelect} />
              </label>
            </div>

            <div className="form-field">
              <label className="form-label">Story Text</label>
              <textarea className="form-input" placeholder="What's on your mind?" value={storyText} onChange={e => setStoryText(e.target.value)} rows={2} maxLength={200} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', marginTop: 4 }}>{storyText.length}/200</div>
            </div>

            <div className="form-field">
              <label className="form-label">Caption (optional)</label>
              <input className="form-input" placeholder="Add a caption..." value={storyCaption} onChange={e => setStoryCaption(e.target.value)} />
            </div>

            {/* Background color */}
            {!storyImagePreview && (
              <div className="form-field">
                <label className="form-label">Background</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {BG_COLORS.map(c => (
                    <div key={c}
                      onClick={() => setStoryBg(c)}
                      style={{
                        width: 32, height: 32, borderRadius: 8, background: c, cursor: 'pointer',
                        border: storyBg === c ? '3px solid white' : '2px solid transparent',
                        transform: storyBg === c ? 'scale(1.15)' : 'none',
                        transition: 'all 0.15s'
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="btn-row">
              <button className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handlePostStory} disabled={posting}>
                {posting ? 'Posting...' : '🌿 Share Story'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
