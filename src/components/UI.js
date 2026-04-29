import React, { useState } from "react";
import { formatCurrency } from "../config";

// ── Card ─────────────────────────────────────────────────────
export function Card({ children, className = "", onClick }) {
  return (
    <div
      className={`card ${className}`}
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : {}}
    >
      {children}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────
export function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div className="stat-card" style={{ borderTop: `3px solid ${accent || "var(--gold)"}` }}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────
export function Badge({ text, type = "default" }) {
  const colors = {
    active:   { bg: "#0d2b1a", color: "#4ade80" },
    sold:     { bg: "#1a1a2e", color: "#a78bfa" },
    partial:  { bg: "#2b1a0d", color: "#fb923c" },
    hold:     { bg: "#1a2020", color: "#94a3b8" },
    profit:   { bg: "#0d2b1a", color: "#4ade80" },
    loss:     { bg: "#2b0d0d", color: "#f87171" },
    default:  { bg: "#1e293b", color: "#94a3b8" }
  };
  const s = colors[type] || colors.default;
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.color}44`,
      padding: "2px 10px", borderRadius: "999px", fontSize: "0.72rem",
      fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase"
    }}>
      {text}
    </span>
  );
}

// ── Modal ─────────────────────────────────────────────────────
export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: wide ? 700 : 480 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ── Form Field ────────────────────────────────────────────────
export function Field({ label, required, children, hint }) {
  return (
    <div className="field">
      <label>{label}{required && <span style={{ color: "var(--gold)" }}> *</span>}</label>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────
export function Input(props) {
  return <input className="input" {...props} />;
}

// ── Select ────────────────────────────────────────────────────
export function Select({ children, ...props }) {
  return <select className="input" {...props}>{children}</select>;
}

// ── Textarea ──────────────────────────────────────────────────
export function Textarea(props) {
  return <textarea className="input" rows={3} {...props} />;
}

// ── Button ────────────────────────────────────────────────────
export function Button({ children, variant = "primary", loading, ...props }) {
  return (
    <button className={`btn btn-${variant}`} disabled={loading || props.disabled} {...props}>
      {loading ? <span className="spinner" /> : children}
    </button>
  );
}

// ── Table ─────────────────────────────────────────────────────
export function Table({ cols, rows, onRowClick, emptyMsg = "No data" }) {
  if (!rows || rows.length === 0) return <div className="empty">{emptyMsg}</div>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>{cols.map(c => <th key={c.key || c.label}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} onClick={() => onRowClick && onRowClick(row)} style={onRowClick ? { cursor: "pointer" } : {}}>
              {cols.map(c => (
                <td key={c.key || c.label}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Loader ────────────────────────────────────────────────────
export function Loader() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
      <div className="spinner large" />
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────
export function ProgressBar({ value, max, label }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      {label && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
        <span>{label}</span><span>{pct.toFixed(1)}%</span>
      </div>}
      <div style={{ background: "#1e293b", borderRadius: 4, height: 8, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--gold)", borderRadius: 4, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

// ── Confirm Dialog ────────────────────────────────────────────
export function useConfirm() {
  const [state, setState] = useState(null);
  const confirm = (msg) => new Promise(resolve => setState({ msg, resolve }));
  const ConfirmDialog = () => !state ? null : (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 360 }}>
        <div className="modal-body" style={{ textAlign: "center" }}>
          <p style={{ marginBottom: 20 }}>{state.msg}</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <Button variant="ghost" onClick={() => { state.resolve(false); setState(null); }}>Cancel</Button>
            <Button onClick={() => { state.resolve(true); setState(null); }}>Confirm</Button>
          </div>
        </div>
      </div>
    </div>
  );
  return { confirm, ConfirmDialog };
}
