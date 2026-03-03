import { create } from 'zustand'

export const useStore = create((set, get) => ({
  // Auth
  user: null,
  profile: null,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),

  // Conversations
  conversations: [],
  activeConversationId: null,
  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  updateConversation: (id, updates) => set(state => ({
    conversations: state.conversations.map(c => c.id === id ? { ...c, ...updates } : c)
  })),
  addConversation: (conv) => set(state => ({
    conversations: [conv, ...state.conversations]
  })),

  // Messages
  messages: {},
  setMessages: (convId, msgs) => set(state => ({
    messages: { ...state.messages, [convId]: msgs }
  })),
  addMessage: (convId, msg) => set(state => ({
    messages: {
      ...state.messages,
      [convId]: [...(state.messages[convId] || []), msg]
    }
  })),
  updateMessage: (convId, msgId, updates) => set(state => ({
    messages: {
      ...state.messages,
      [convId]: (state.messages[convId] || []).map(m => m.id === msgId ? { ...m, ...updates } : m)
    }
  })),
  removeMessage: (convId, msgId) => set(state => ({
    messages: {
      ...state.messages,
      [convId]: (state.messages[convId] || []).filter(m => m.id !== msgId)
    }
  })),

  // UI State
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  theme: 'dark',
  setTheme: (theme) => set({ theme }),
  activePanel: null, // 'pins', 'members', 'settings'
  setActivePanel: (panel) => set({ activePanel: panel }),

  // Typing indicators
  typingUsers: {},
  setTypingUser: (convId, userId, isTyping) => set(state => {
    const current = state.typingUsers[convId] || []
    return {
      typingUsers: {
        ...state.typingUsers,
        [convId]: isTyping
          ? [...new Set([...current, userId])]
          : current.filter(id => id !== userId)
      }
    }
  }),

  // Unread counts
  unreadCounts: {},
  setUnreadCount: (convId, count) => set(state => ({
    unreadCounts: { ...state.unreadCounts, [convId]: count }
  })),
  incrementUnread: (convId) => set(state => ({
    unreadCounts: { ...state.unreadCounts, [convId]: (state.unreadCounts[convId] || 0) + 1 }
  })),
  clearUnread: (convId) => set(state => ({
    unreadCounts: { ...state.unreadCounts, [convId]: 0 }
  })),
}))
