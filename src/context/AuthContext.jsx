import React, { createContext, useContext, useState, useEffect } from 'react'
import { API } from '../config'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('rt_user')) } catch { return null }
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loginWithGoogle = async (googleUser) => {
    setLoading(true)
    setError('')
    try {
      const res = await API.get('loginGoogle', { email: googleUser.email, name: googleUser.name, picture: googleUser.picture })
      if (res.success) {
        const u = { ...res, picture: googleUser.picture, displayName: googleUser.name }
        sessionStorage.setItem('rt_user', JSON.stringify(u))
        setUser(u)
      } else {
        setError(res.message || 'Access denied. Contact admin to register your Google account.')
      }
    } catch {
      setError('Connection failed. Check your API URL.')
    }
    setLoading(false)
  }

  const loginFallback = async (username, password) => {
    setLoading(true)
    setError('')
    try {
      const res = await API.get('login', { username, password })
      if (res.success) {
        sessionStorage.setItem('rt_user', JSON.stringify(res))
        setUser(res)
      } else {
        setError(res.message || 'Invalid credentials')
      }
    } catch {
      setError('Connection failed.')
    }
    setLoading(false)
  }

  const logout = () => {
    sessionStorage.removeItem('rt_user')
    setUser(null)
    // Sign out from Google if available
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect()
    }
  }

  return (
    <Ctx.Provider value={{ user, loading, error, setError, loginWithGoogle, loginFallback, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
