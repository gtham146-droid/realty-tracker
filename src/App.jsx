import React, { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Plots from './pages/Plots.jsx'
import Investors from './pages/Investors.jsx'
import MyPortfolio from './pages/MyPortfolio.jsx'
import Reports from './pages/Reports.jsx'

/* ── Nav config ────────────────────────────────────────────── */
const ADMIN_NAV = [
  { path: '/dashboard', label: 'Dashboard', icon: '◈' },
  { path: '/plots',     label: 'Plots',     icon: '⬡' },
  { path: '/investors', label: 'Investors', icon: '◎' },
  { path: '/reports',   label: 'Reports',   icon: '📊' },
]
const INVESTOR_NAV = [
  { path: '/portfolio', label: 'Portfolio', icon: '◈' },
]

/* ── Layout ────────────────────────────────────────────────── */
function Layout() {
  const { user, logout, isAdmin } = useAuth()
  const nav = isAdmin ? ADMIN_NAV : INVESTOR_NAV
  const navigate = useNavigate()
  const location = useLocation()

  // Load Google SSO script
  useEffect(() => {
    if (!document.getElementById('gsi-script')) {
      const s = document.createElement('script')
      s.id = 'gsi-script'
      s.src = 'https://accounts.google.com/gsi/client'
      s.async = true
      document.head.appendChild(s)
    }
  }, [])

  const initials = user?.username?.[0]?.toUpperCase() || user?.displayName?.[0]?.toUpperCase() || '?'

  return (
    <div className="app-shell">
      {/* ── Desktop Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-name">🏠 RealtyTrack</div>
          <div className="brand-tag">Investment Platform</div>
        </div>
        <nav className="sidebar-nav">
          {nav.map(n => (
            <button key={n.path} className={`nav-link ${location.pathname === n.path ? 'active' : ''}`} onClick={() => navigate(n.path)}>
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-row">
            <div className="avatar">
              {user?.picture ? <img src={user.picture} alt="" /> : initials}
            </div>
            <div className="user-info">
              <div className="user-name">{user?.displayName || user?.username}</div>
              <div className="user-role">{user?.role}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={logout} title="Sign out">⏏</button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="main">
        {/* Mobile header */}
        <header className="mobile-header">
          <div className="mobile-brand">🏠 RealtyTrack</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="avatar mobile-avatar" style={{ cursor: 'pointer' }} onClick={logout} title="Tap to sign out">
              {user?.picture ? <img src={user.picture} alt="" /> : initials}
            </div>
          </div>
        </header>

        {/* Routes */}
        <Routes>
          {isAdmin ? (
            <>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/plots"     element={<Plots />} />
              <Route path="/investors" element={<Investors />} />
              <Route path="/reports"   element={<Reports />} />
              <Route path="*"          element={<Navigate to="/dashboard" />} />
            </>
          ) : (
            <>
              <Route path="/portfolio" element={<MyPortfolio />} />
              <Route path="*"          element={<Navigate to="/portfolio" />} />
            </>
          )}
        </Routes>

        {/* Mobile Bottom Nav */}
        <nav className="bottom-nav">
          <div className="bottom-nav-inner">
            {nav.map(n => (
              <button key={n.path} className={`bnav-item ${location.pathname === n.path ? 'active' : ''}`} onClick={() => navigate(n.path)}>
                <span className="bnav-icon">{n.icon}</span>
                <span className="bnav-label">{n.label}</span>
              </button>
            ))}
            <button className="bnav-item" onClick={logout}>
              <span className="bnav-icon">⏏</span>
              <span className="bnav-label">Sign Out</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  )
}

/* ── Router wrapper ────────────────────────────────────────── */
function AppRouter() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/*"     element={user ? <Layout /> : <Navigate to="/login" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRouter />
      </HashRouter>
    </AuthProvider>
  )
}
