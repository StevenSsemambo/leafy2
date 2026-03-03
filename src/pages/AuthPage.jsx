import { useState } from 'react'
import { signIn, signUp } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', username: '', displayName: '' })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await signIn(form.email, form.password)
        if (error) toast.error(error.message, { className: 'toast-leaf' })
        else toast.success('Welcome back!', { className: 'toast-leaf' })
      } else {
        if (!form.username.trim()) return toast.error('Username required')
        const { error } = await signUp(form.email, form.password, form.username, form.displayName || form.username)
        if (error) toast.error(error.message, { className: 'toast-leaf' })
        else toast.success('Account created! Check your email to confirm.', { className: 'toast-leaf' })
      }
    } finally {
      setLoading(false)
    }
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="auth-container">
      <div className="auth-card pop-in">
        <div className="auth-logo">
          <div className="logo-icon">🌿</div>
          LEAFY
        </div>
        <p className="auth-tagline">
          Next-gen chat by <strong>Sematech Developers</strong>
        </p>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <div className="form-field">
                <label className="form-label">Display Name</label>
                <input className="form-input" type="text" placeholder="Your name" value={form.displayName} onChange={set('displayName')} />
              </div>
              <div className="form-field">
                <label className="form-label">Username</label>
                <input className="form-input" type="text" placeholder="@username" value={form.username} onChange={set('username')} required />
              </div>
            </>
          )}
          <div className="form-field">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
          </div>
          <div className="form-field">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'} value={form.password} onChange={set('password')} required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-toggle">
          {mode === 'login' ? (
            <span>No account? <button onClick={() => setMode('signup')}>Create one</button></span>
          ) : (
            <span>Have an account? <button onClick={() => setMode('login')}>Sign in</button></span>
          )}
        </div>
      </div>
    </div>
  )
}
