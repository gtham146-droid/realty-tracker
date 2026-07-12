import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { GOOGLE_CLIENT_ID } from '../config'
import { Btn, Field, Input } from '../components/UI'

export default function Login() {
  const { loginWithGoogle, loginFallback, loading, error, setError } = useAuth()
  const [showFallback, setShowFallback] = useState(false)
  const [form, setForm] = useState({ username: '', password: '' })
  const googleBtnRef = useRef(null)

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !window.google) return
    try {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          // Decode JWT payload
          const payload = JSON.parse(atob(response.credential.split('.')[1]))
          loginWithGoogle({ email: payload.email, name: payload.name, picture: payload.picture })
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      })
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'filled_black',
        size: 'large',
        width: 340,
        text: 'signin_with',
        shape: 'rectangular',
      })
    } catch (e) {
      console.warn('Google SSO init failed:', e)
    }
  }, [])

  const handleFallback = async (e) => {
    e.preventDefault()
    await loginFallback(form.username, form.password)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-mark">🏠</div>
          <div className="login-brand">RealtyTrack</div>
          <div className="login-tagline">Investment Syndication Platform</div>
        </div>

        {error && <div className="error-box">{error}</div>}

        {/* Google Sign-In button rendered by Google SDK */}
        {GOOGLE_CLIENT_ID ? (
          <>
            <div ref={googleBtnRef} style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }} />
            <div className="divider">or</div>
          </>
        ) : (
          <div className="error-box" style={{ marginBottom: 16 }}>
            ⚠️ Google Client ID not configured. Using fallback login.
          </div>
        )}

        {(!GOOGLE_CLIENT_ID || showFallback) ? (
          <form onSubmit={handleFallback} className="form-stack">
            <Field label="Username">
              <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="admin" autoComplete="username" />
            </Field>
            <Field label="Password">
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" autoComplete="current-password" />
            </Field>
            <Btn type="submit" loading={loading} style={{ width: '100%' }}>Sign In</Btn>
          </form>
        ) : (
          <button onClick={() => { setShowFallback(true); setError('') }} style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: '0.78rem', cursor: 'pointer', display: 'block', margin: '0 auto', textAlign: 'center' }}>
            Admin fallback login →
          </button>
        )}

        <div className="login-hint">
          Investors sign in with their registered Gmail.<br />
          Admin fallback: <code>admin / admin123</code>
        </div>
      </div>

      {/* Load Google SDK */}
      {GOOGLE_CLIENT_ID && (
        <script
          src="https://accounts.google.com/gsi/client"
          async
          defer
          onLoad={() => window.dispatchEvent(new Event('google-sdk-loaded'))}
        />
      )}
    </div>
  )
}
