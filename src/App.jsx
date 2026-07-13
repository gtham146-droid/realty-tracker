import React, { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Plots from './pages/Plots.jsx'
import Investors from './pages/Investors.jsx'
import MyPortfolio from './pages/MyPortfolio.jsx'
import Reports from './pages/Reports.jsx'

const ADMIN_NAV = [
  { path:'/dashboard', label:'Dashboard', icon:'◈' },
  { path:'/plots',     label:'Plots',     icon:'⬡' },
  { path:'/investors', label:'Investors', icon:'◎' },
  { path:'/reports',   label:'Reports',   icon:'✉' },
]
const INVESTOR_NAV = [
  { path:'/portfolio', label:'My Portfolio', icon:'◈' },
]

function Layout() {
  const { user, logout, isAdmin } = useAuth()
  const nav       = isAdmin ? ADMIN_NAV : INVESTOR_NAV
  const navigate  = useNavigate()
  const location  = useLocation()
  const isActive  = (p) => location.pathname === p
  const initials  = (user?.displayName || user?.username || '?')[0].toUpperCase()

  useEffect(() => {
    if (!document.getElementById('gsi-script')) {
      const s = document.createElement('script')
      s.id='gsi-script'; s.src='https://accounts.google.com/gsi/client'
      s.async=true; s.defer=true; document.head.appendChild(s)
    }
  }, [])

  return (
    <div className="app-shell">

      {/* ── Top Nav — desktop ── */}
      <header className="topnav">
        <div className="topnav-brand">
          <div className="topnav-brand-icon">🏠</div>
          <div>
            <div className="topnav-brand-name">RealtyTrack</div>
            <div className="topnav-brand-tag">Investment Platform</div>
          </div>
        </div>

        <nav className="topnav-links">
          {nav.map(n => (
            <button
              key={n.path}
              className={`topnav-link${isActive(n.path) ? ' active' : ''}`}
              onClick={() => navigate(n.path)}
            >
              <span className="topnav-link-icon">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>

        <div className="topnav-right">
          <div className="topnav-profile">
            <div className="topnav-avatar">
              {user?.picture
                ? <img src={user.picture} alt="" referrerPolicy="no-referrer" />
                : initials}
            </div>
            <div>
              <div className="topnav-username">{user?.displayName || user?.username}</div>
              <div className="topnav-role">{user?.role}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={logout} title="Sign out">⏏</button>
        </div>
      </header>

      {/* ── Mobile Header ── */}
      <header className="mobile-header">
        <div className="mobile-brand">
          <div className="mobile-brand-icon">🏠</div>
          RealtyTrack
        </div>
        <div
          className="topnav-avatar"
          style={{ cursor:'pointer', width:32, height:32 }}
          onClick={logout}
          title="Tap to sign out"
        >
          {user?.picture
            ? <img src={user.picture} alt="" referrerPolicy="no-referrer" />
            : initials}
        </div>
      </header>

      {/* ── Main Content ── */}
      <div className="main">
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
      </div>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {nav.map(n => (
            <button
              key={n.path}
              className={`bnav-item${isActive(n.path) ? ' active' : ''}`}
              onClick={() => navigate(n.path)}
            >
              <div className="bnav-pill">
                <span className="bnav-icon">{n.icon}</span>
              </div>
              <span className="bnav-label">{n.label}</span>
            </button>
          ))}
          <button className="bnav-item" onClick={logout}>
            <div className="bnav-pill">
              <span className="bnav-icon">⏏</span>
            </div>
            <span className="bnav-label">Sign Out</span>
          </button>
        </div>
      </nav>
    </div>
  )
}

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
