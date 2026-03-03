import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 10 } }
})

// Auth helpers
export const signUp = async (email, password, username, displayName) => {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { username, display_name: displayName } }
  })
  return { data, error }
}

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export const getProfile = async (userId) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return { data, error }
}

export const updateProfile = async (userId, updates) => {
  const { data, error } = await supabase.from('profiles').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', userId).select().single()
  return { data, error }
}

export const searchUsers = async (query) => {
  const { data, error } = await supabase.from('profiles').select('*').or(`username.ilike.%${query}%,display_name.ilike.%${query}%`).limit(10)
  return { data, error }
}

// Conversations
export const getConversations = async (userId) => {
  const { data, error } = await supabase
    .from('conversation_members')
    .select(`conversation_id, role, is_anonymous, last_read_at, conversations(*, conversation_members(user_id, profiles(id, username, display_name, avatar_url, online_status)))`)
    .eq('user_id', userId)
    .order('conversations(last_message_at)', { ascending: false })
  return { data, error }
}

export const createDM = async (userId1, userId2) => {
  // Check if DM already exists
  const { data: existing } = await supabase.rpc('get_or_create_dm', { user1: userId1, user2: userId2 })
  if (existing) return { data: existing, error: null }

  const { data: conv, error: convError } = await supabase
    .from('conversations').insert({ type: 'dm', created_by: userId1 }).select().single()
  if (convError) return { data: null, error: convError }

  await supabase.from('conversation_members').insert([
    { conversation_id: conv.id, user_id: userId1, role: 'admin' },
    { conversation_id: conv.id, user_id: userId2, role: 'member' }
  ])
  return { data: conv, error: null }
}

export const createGroup = async (name, creatorId, memberIds, description = '') => {
  const { data: conv, error } = await supabase
    .from('conversations').insert({ type: 'group', name, description, created_by: creatorId }).select().single()
  if (error) return { data: null, error }

  const members = [
    { conversation_id: conv.id, user_id: creatorId, role: 'admin' },
    ...memberIds.map(id => ({ conversation_id: conv.id, user_id: id, role: 'member' }))
  ]
  await supabase.from('conversation_members').insert(members)
  return { data: conv, error: null }
}

// Messages
export const getMessages = async (conversationId, limit = 50, offset = 0) => {
  const { data, error } = await supabase
    .from('messages')
    .select(`*, profiles:sender_id(id, username, display_name, avatar_url), reactions(id, emoji, user_id), reply:reply_to(id, content, profiles:sender_id(display_name))`)
    .eq('conversation_id', conversationId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1)
  return { data, error }
}

export const sendMessage = async (conversationId, senderId, content, type = 'text', metadata = {}, replyTo = null, isAnonymous = false, expiresAt = null) => {
  const { data, error } = await supabase.from('messages').insert({
    conversation_id: conversationId, sender_id: senderId, content, type,
    metadata, reply_to: replyTo, is_anonymous: isAnonymous, expires_at: expiresAt
  }).select(`*, profiles:sender_id(id, username, display_name, avatar_url), reactions(id, emoji, user_id)`).single()
  return { data, error }
}

export const deleteMessage = async (messageId) => {
  const { error } = await supabase.from('messages').update({ is_deleted: true }).eq('id', messageId)
  return { error }
}

export const scheduleMessage = async (conversationId, senderId, content, scheduledAt) => {
  const { data, error } = await supabase.from('messages').insert({
    conversation_id: conversationId, sender_id: senderId, content,
    scheduled_at: scheduledAt, type: 'text'
  }).select().single()
  return { data, error }
}

// Reactions
export const addReaction = async (messageId, userId, emoji) => {
  const { data, error } = await supabase.from('reactions').upsert({ message_id: messageId, user_id: userId, emoji }).select().single()
  return { data, error }
}

export const removeReaction = async (messageId, userId, emoji) => {
  const { error } = await supabase.from('reactions').delete().eq('message_id', messageId).eq('user_id', userId).eq('emoji', emoji)
  return { error }
}

// Polls
export const createPoll = async (conversationId, senderId, question, options) => {
  const { data: msg, error: msgError } = await supabase.from('messages').insert({
    conversation_id: conversationId, sender_id: senderId,
    content: question, type: 'poll', metadata: { question, options }
  }).select().single()
  if (msgError) return { data: null, error: msgError }

  const { data, error } = await supabase.from('polls').insert({
    message_id: msg.id, question,
    options: options.map((o, i) => ({ id: i, text: o, count: 0 })),
    votes: {}
  }).select().single()
  return { data: { ...data, message: msg }, error }
}

export const votePoll = async (pollId, userId, optionId) => {
  const { data: poll } = await supabase.from('polls').select('*').eq('id', pollId).single()
  const votes = { ...poll.votes, [userId]: optionId }
  const options = poll.options.map(o => ({
    ...o, count: Object.values(votes).filter(v => v === o.id).length
  }))
  const { data, error } = await supabase.from('polls').update({ votes, options }).eq('id', pollId).select().single()
  return { data, error }
}

// Pinned items
export const getPinnedItems = async (conversationId) => {
  const { data, error } = await supabase.from('pinned_items').select('*, profiles:pinned_by(display_name)').eq('conversation_id', conversationId)
  return { data, error }
}

export const addPinnedItem = async (conversationId, userId, title, content, color) => {
  const { data, error } = await supabase.from('pinned_items').insert({ conversation_id: conversationId, pinned_by: userId, title, content, color }).select().single()
  return { data, error }
}

// Update online status
export const setOnlineStatus = async (userId, status) => {
  await supabase.from('profiles').update({ online_status: status }).eq('id', userId)
}

// Upload file/avatar
export const uploadFile = async (bucket, path, file) => {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
  if (error) return { url: null, error }
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path)
  return { url: publicUrl, error: null }
}

// =============================================
// FILE SHARING
// =============================================
export const sendFileMessage = async (conversationId, senderId, file, isAnonymous = false) => {
  const ext = file.name.split('.').pop()
  const path = `files/${conversationId}/${Date.now()}-${file.name}`
  const { url, error: uploadError } = await uploadFile('media', path, file)
  if (uploadError) return { data: null, error: uploadError }

  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')
  const type = isImage ? 'image' : isVideo ? 'video' : 'file'

  const { data, error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    content: file.name,
    type,
    metadata: {
      url,
      filename: file.name,
      filesize: file.size,
      mimetype: file.type,
      ext: ext.toLowerCase()
    },
    is_anonymous: isAnonymous
  }).select(`*, profiles:sender_id(id, username, display_name, avatar_url), reactions(id, emoji, user_id)`).single()
  return { data, error }
}

// =============================================
// MESSAGE EDITING
// =============================================
export const editMessage = async (messageId, newContent, oldContent, userId) => {
  // Save edit history
  await supabase.from('message_edits').insert({
    message_id: messageId,
    previous_content: oldContent,
    edited_by: userId
  })
  // Update message
  const { data, error } = await supabase.from('messages')
    .update({ content: newContent, edited_at: new Date().toISOString() })
    .eq('id', messageId)
    .select(`*, profiles:sender_id(id, username, display_name, avatar_url), reactions(id, emoji, user_id)`)
    .single()
  return { data, error }
}

export const getEditHistory = async (messageId) => {
  const { data, error } = await supabase.from('message_edits')
    .select('*, profiles:edited_by(display_name)')
    .eq('message_id', messageId)
    .order('edited_at', { ascending: false })
  return { data, error }
}

// =============================================
// STORIES
// =============================================
export const getStories = async () => {
  // Get all non-expired stories, grouped by user
  const { data, error } = await supabase.from('stories')
    .select('*, profiles:user_id(id, username, display_name, avatar_url)')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  return { data, error }
}

export const createStory = async (userId, content, mediaUrl, mediaType, backgroundColor, caption) => {
  const { data, error } = await supabase.from('stories').insert({
    user_id: userId,
    content,
    media_url: mediaUrl,
    media_type: mediaType,
    background_color: backgroundColor,
    caption
  }).select('*, profiles:user_id(id, username, display_name, avatar_url)').single()
  return { data, error }
}

export const viewStory = async (storyId, userId) => {
  const { data: story } = await supabase.from('stories').select('views').eq('id', storyId).single()
  if (!story) return
  const views = story.views || []
  if (!views.includes(userId)) {
    await supabase.from('stories').update({ views: [...views, userId] }).eq('id', storyId)
  }
}

export const deleteStory = async (storyId) => {
  const { error } = await supabase.from('stories').delete().eq('id', storyId)
  return { error }
}

// =============================================
// MESSAGE SEARCH
// =============================================
export const searchMessages = async (userId, query, conversationId = null) => {
  const { data, error } = await supabase.rpc('search_messages', {
    p_user_id: userId,
    p_query: query,
    p_conversation_id: conversationId
  })
  return { data, error }
}
