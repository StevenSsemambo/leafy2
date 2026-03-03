import { useEffect, useState, useCallback } from 'react'
import { Toaster } from 'react-hot-toast'
import { supabase, getProfile, setOnlineStatus } from './lib/supabase'
import { useStore } from './lib/store'
import AuthPage from './pages/AuthPage'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import SidePanel from './components/SidePanel'
import SettingsModal from './components/SettingsModal'
import StoriesBar from './components/StoriesBar'
import SearchModal from './components/SearchModal'
import NotificationPanel from './components/NotificationPanel'
import OnboardingWizard from './components/OnboardingWizard'
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal'
import './styles/main.css'

// Splash Screen
function SplashScreen() {
  return (
    <div className="splash">
      <div className="splash-logo">
        <div className="splash-icon">🌿</div>
        LEAFY
      </div>
      <div className="splash-bar"><div className="splash-bar-fill"/></div>
      <div className="splash-sub">BY SEMATECH DEVELOPERS</div>
    </div>
  )
}

export default function App() {
  const {
    user, setUser, profile, setProfile,
    activePanel, setActivePanel,
    sidebarOpen, setSidebarOpen,
    setActiveConversation
  } = useStore()
  const [authChecked, setAuthChecked] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [pinnedItems, setPinnedItems] = useState([])
  const [unreadNotifs, setUnreadNotifs] = useState(0)

  useEffect(() => {
    // Splash timeout
    setTimeout(() => setShowSplash(false), 2000)

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); loadProfile(session.user.id) }
      setAuthChecked(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        await loadProfile(session.user.id)
        setOnlineStatus(session.user.id, 'online')
      } else { setUser(null); setProfile(null) }
    })

    // Keyboard shortcuts
    const handleKey = (e) => {
      if ((e.metaKey||e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowSearch(true) }
      if ((e.metaKey||e.ctrlKey) && e.key === '/') { e.preventDefault(); setShowShortcuts(true) }
      if ((e.metaKey||e.ctrlKey) && e.key === 'b') { e.preventDefault(); setSidebarOpen(v => !v) }
      if (e.key === 'Escape') { setShowSearch(false); setShowSettings(false); setShowNotifs(false); setShowShortcuts(false) }
    }
    window.addEventListener('keydown', handleKey)

    return () => { subscription.unsubscribe(); window.removeEventListener('keydown', handleKey) }
  }, [])

  const loadProfile = async (userId) => {
    const { data } = await getProfile(userId)
    if (data) {
      setProfile(data)
      // Apply saved theme/accent
      document.documentElement.setAttribute('data-theme', data.theme || 'dark')
      document.documentElement.setAttribute('data-density', data.density || 'comfortable')
      if (data.accent_color) {
        document.documentElement.style.setProperty('--accent', data.accent_color)
        document.documentElement.style.setProperty('--accent-dim', data.accent_color + 'cc')
      }
    }
    // Count unread notifications
    const { count } = await supabase.from('notifications').select('*', {count:'exact',head:true}).eq('user_id', userId).eq('is_read', false)
    setUnreadNotifs(count || 0)
  }

  if (showSplash) return <SplashScreen/>
  if (!authChecked) return null
  if (!user) return <AuthPage/>

  // Show onboarding if profile not yet completed
  if (profile && !profile.onboarding_complete) {
    return (
      <>
        <OnboardingWizard onComplete={() => loadProfile(user.id)}/>
        <Toaster position="top-center"/>
      </>
    )
  }

  return (
    <div className="app">
      <Toaster position="top-center" toastOptions={{
        style:{background:'var(--bg-card)',color:'var(--text-primary)',border:'1px solid var(--border-default)',fontFamily:'var(--font-body)',fontSize:'13.5px'}
      }}/>

      <Sidebar
        onOpenSettings={() => setShowSettings(true)}
        onOpenSearch={() => setShowSearch(true)}
        onOpenNotifs={() => setShowNotifs(true)}
        unreadNotifs={unreadNotifs}
      />

      <div className="main-area">
        <StoriesBar/>
        <ChatArea onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}/>
      </div>

      {activePanel && <SidePanel pinnedItems={pinnedItems} onClose={() => setActivePanel(null)}/>}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)}/>}
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} onJumpToConversation={(id) => { setActiveConversation(id); setShowSearch(false)}}/>}
      {showNotifs && <NotificationPanel onClose={() => setShowNotifs(false)} onJumpToConversation={(id) => { setActiveConversation(id); setShowNotifs(false)}} />}
      {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)}/>}
    </div>
  )
}
