import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { GOOGLE_CLIENT_ID } from '../config'
import { Btn, Field, Input } from '../components/UI.jsx'

export default function Login() {
  const { loginWithGoogle, loginFallback, loading, error, setError } = useAuth()
  const [showFallback, setShowFallback] = useState(false)
  const [form, setForm] = useState({ username: '', password: '' })
  const [sdkReady, setSdkReady] = useState(false)
  const btnRef = useRef(null)

  // Load Google SDK and init button
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return

    const initGoogle = () => {
      if (!window.google?.accounts?.id) return
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          try {
            const payload = JSON.parse(atob(response.credential.split('.')[1]))
            loginWithGoogle({ email: payload.email, name: payload.name, picture: payload.picture })
          } catch (e) {
            setError('Sign-in failed. Please try again.')
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      })
      if (btnRef.current) {
        window.google.accounts.id.renderButton(btnRef.current, {
          theme: 'filled_black',
          size: 'large',
          width: 320,
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
        })
        setSdkReady(true)
      }
    }

    // If SDK already loaded
    if (window.google?.accounts?.id) {
      initGoogle()
      return
    }

    // Load it
    const existing = document.getElementById('gsi-script')
    if (!existing) {
      const script = document.createElement('script')
      script.id = 'gsi-script'
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = initGoogle
      document.head.appendChild(script)
    } else {
      // Script tag exists but may not have loaded yet
      existing.addEventListener('load', initGoogle)
      return () => existing.removeEventListener('load', initGoogle)
    }
  }, [])

  // Re-render button when ref is available
  useEffect(() => {
    if (btnRef.current && window.google?.accounts?.id && !sdkReady) {
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: 'filled_black', size: 'large', width: 320,
        text: 'signin_with', shape: 'rectangular', logo_alignment: 'left',
      })
      setSdkReady(true)
    }
  }, [btnRef.current, sdkReady])

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

        {GOOGLE_CLIENT_ID && !showFallback ? (
          <>
            <div className="google-btn-wrap">
              <div ref={btnRef} />
              {!sdkReady && (
                <div className="google-loading">
                  <span className="spinner" style={{ borderTopColor: '#4285f4' }} />
                  Loading sign-in...
                </div>
              )}
            </div>

            <button
              className="fallback-link"
              onClick={() => { setShowFallback(true); setError('') }}
            >
              Admin fallback login →
            </button>
          </>
        ) : (
          <>
            {GOOGLE_CLIENT_ID && (
              <button
                className="fallback-link"
                style={{ marginBottom: 16, marginTop: 0 }}
                onClick={() => { setShowFallback(false); setError('') }}
              >
                ← Back to Google Sign-In
              </button>
            )}
            <form onSubmit={handleFallback} className="form-stack">
              <Field label="Username">
                <Input
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="admin"
                  autoComplete="username"
                  autoFocus
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </Field>
              <Btn type="submit" loading={loading} style={{ width: '100%' }}>Sign In</Btn>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
