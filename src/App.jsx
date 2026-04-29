import React from "react";
import { HashRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Plots from "./pages/Plots";
import Investors from "./pages/Investors";
import MyPortfolio from "./pages/MyPortfolio";

function Layout() {
  const { user, logout, isAdmin } = useAuth();

  const navItems = isAdmin
    ? [
        { to: "/dashboard", label: "Dashboard", icon: "◈" },
        { to: "/plots",     label: "Plots",     icon: "⬡" },
        { to: "/investors", label: "Investors",  icon: "◎" }
      ]
    : [
        { to: "/portfolio", label: "My Portfolio", icon: "◈" }
      ];

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-mark">⬡</span>
          <div>
            <div className="logo-name">RealtyTrack</div>
            <div className="logo-sub">Investment Platform</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(n => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <span className="nav-icon">{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{user?.username?.[0]?.toUpperCase()}</div>
            <div>
              <div className="user-name">{user?.username}</div>
              <div className="user-role">{user?.role}</div>
            </div>
          </div>
          <button className="btn-logout" onClick={logout} title="Sign out">⏏</button>
        </div>
      </aside>

      <main className="main-content">
        <Routes>
          {isAdmin ? (
            <>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/plots"     element={<Plots />} />
              <Route path="/investors" element={<Investors />} />
              <Route path="*"          element={<Navigate to="/dashboard" />} />
            </>
          ) : (
            <>
              <Route path="/portfolio" element={<MyPortfolio />} />
              <Route path="*"          element={<Navigate to="/portfolio" />} />
            </>
          )}
        </Routes>
      </main>
    </div>
  );
}

function AppRouter() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/*"     element={user ? <Layout /> : <Navigate to="/login" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRouter />
      </HashRouter>
    </AuthProvider>
  );
}
