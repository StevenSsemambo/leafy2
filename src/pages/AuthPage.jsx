import { useState } from 'react'
import { signIn, signUp } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function AuthPage() {
  const [mode, setMode] = useState('signup')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', username: '', displayName: '' })
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!form.email.trim()) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email'
    if (!form.password) e.password = 'Password is required'
    else if (form.password.length < 6) e.password = 'Password must be at least 6 characters'
    if (mode === 'signup') {
      if (!form.username.trim()) e.username = 'Username is required'
      else if (/\s/.test(form.username)) e.username = 'Username cannot have spaces'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      if (mode === 'login') {
        const { data, error } = await signIn(form.email.trim(), form.password)
        if (error) {
          if (error.message.includes('Invalid login')) {
            toast.error('Wrong email or password. Please check and try again.')
          } else if (error.message.includes('Email not confirmed')) {
            toast.error('Please check your email and click the confirmation link first.')
          } else {
            toast.error(error.message)
          }
        }
      } else {
        const { data, error } = await signUp(
          form.email.trim(),
          form.password,
          form.username.trim().toLowerCase(),
          form.displayName.trim() || form.username.trim()
        )
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('This email is already registered. Try signing in instead.')
          } else {
            toast.error(error.message)
          }
        } else {
          // Check if email confirmation is required
          if (data?.user && !data?.session) {
            setDone(true) // Show "check your email" screen
          }
          // If session exists, App.jsx will auto-redirect
        }
      }
    } catch (err) {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const set = (k) => (e) => {
    setForm(f => ({ ...f, [k]: e.target.value }))
    setErrors(er => ({ ...er, [k]: null }))
  }

  // Show "check your email" screen after signup
  if (done) {
    return (
      <div className="auth-page">
        <div className="auth-card pop-in" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>📧</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>
            Check your email!
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            We sent a confirmation link to <strong style={{ color: 'var(--text-primary)' }}>{form.email}</strong>.
            Click it to activate your account, then come back here to sign in.
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
            Can't find it? Check your <strong>spam/junk</strong> folder.
          </p>
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => { setDone(false); setMode('login') }}
          >
            Go to Sign In
          </button>
          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
            Or ask your Supabase admin to turn off email confirmation
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card pop-in">
        {/* Logo */}
        <div className="auth-logo">
          <div className="logo-icon">🌿</div>
          LEAFY
        </div>
        <p className="auth-tagline">
          Next-gen chat by <strong>Sematech Developers</strong>
        </p>

        {/* Tab toggle */}
        <div className="theme-toggle" style={{ marginBottom: 24 }}>
          <button className={`theme-opt ${mode === 'signup' ? 'active' : ''}`} onClick={() => { setMode('signup'); setErrors({}) }}>
            Create Account
          </button>
          <button className={`theme-opt ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setErrors({}) }}>
            Sign In
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {mode === 'signup' && (
            <>
              <div className="form-field">
                <label className="form-label">Display Name</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Your full name"
                  value={form.displayName}
                  onChange={set('displayName')}
                  style={errors.displayName ? { borderColor: '#ef4444' } : {}}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Username *</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. john_doe (no spaces)"
                  value={form.username}
                  onChange={set('username')}
                  style={errors.username ? { borderColor: '#ef4444' } : {}}
                />
                {errors.username && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.username}</div>}
              </div>
            </>
          )}

          <div className="form-field">
            <label className="form-label">Email *</label>
            <input
              className="form-input"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={set('email')}
              style={errors.email ? { borderColor: '#ef4444' } : {}}
            />
            {errors.email && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.email}</div>}
          </div>

          <div className="form-field">
            <label className="form-label">Password *</label>
            <input
              className="form-input"
              type="password"
              placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
              value={form.password}
              onChange={set('password')}
              style={errors.password ? { borderColor: '#ef4444' } : {}}
            />
            {errors.password && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.password}</div>}
          </div>

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 4 }}
          >
            {loading
              ? 'Please wait...'
              : mode === 'login' ? '🌿 Sign In' : '🌿 Create Account'
            }
          </button>
        </form>

        {/* Helper text */}
        {mode === 'login' && (
          <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg-raised)', borderRadius: 'var(--radius-md)', fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>Having trouble signing in?</strong><br/>
            • Make sure you confirmed your email first<br/>
            • Check your password is correct<br/>
            • Try creating a new account if you haven't yet
          </div>
        )}

        <div className="auth-toggle" style={{ marginTop: 16 }}>
          {mode === 'login' ? (
            <span>No account? <button type="button" onClick={() => { setMode('signup'); setErrors({}) }}>Create one free</button></span>
          ) : (
            <span>Already have an account? <button type="button" onClick={() => { setMode('login'); setErrors({}) }}>Sign in</button></span>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'var(--text-muted)' }}>
          Leafy v2.0 · Sematech Developers
        </div>
      </div>
    </div>
  )
}
