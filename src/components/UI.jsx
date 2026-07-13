import React, { useState } from 'react'
import { fc } from '../config'

export function Loader() {
  return <div className="loader-wrap"><div className="spinner spinner-lg" /></div>
}

export function StatCard({ label, value, sub, icon, accent = 'var(--gold)', accentSoft }) {
  return (
    <div className="stat-card" style={{ '--accent': accent, '--accent-soft': accentSoft || accent + '18' }}>
      {icon && <div className="stat-icon">{icon}</div>}
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function Badge({ text, type = 'default' }) {
  const cls = { active:'badge-active', sold:'badge-sold', partial:'badge-partial', hold:'badge-hold', cash:'badge-cash', reinvest:'badge-reinvest' }
  return <span className={`badge ${cls[type] || 'badge-hold'}`}>{text}</span>
}

export function StatusBadge({ status }) {
  const map = { Active:'active', Sold:'sold', 'Partially Sold':'partial', 'On Hold':'hold' }
  return <Badge text={status} type={map[status] || 'hold'} />
}

export function TxTypeBadge({ type }) {
  const cfg = {
    PROFIT_DISTRIBUTION: { label:'Profit',     color:'var(--green)'  },
    LOSS_DISTRIBUTION:   { label:'Loss',        color:'var(--red)'    },
    WITHDRAWAL:          { label:'Withdrawal',  color:'#fb923c'       },
    ADJUSTMENT:          { label:'Adjustment',  color:'var(--purple)' },
    REINVESTMENT:        { label:'Reinvest',    color:'var(--blue)'   },
  }
  const c = cfg[type] || { label: type?.replace(/_/g,' ') || '—', color:'var(--text-2)' }
  return <span style={{ color:c.color, fontWeight:700, fontSize:'0.75rem' }}>{c.label}</span>
}

// ── Back breadcrumb ──────────────────────────────────────────
export function BackRow({ listLabel, itemLabel, onBack }) {
  return (
    <div className="back-row">
      <button className="back-crumb" onClick={onBack}>
        <span style={{ fontSize:'0.8rem', opacity:0.7 }}>←</span>
        {listLabel}
      </button>
      {itemLabel && (
        <>
          <span className="back-sep">/</span>
          <span className="back-current">{itemLabel}</span>
        </>
      )}
    </div>
  )
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, hint, children, span }) {
  return (
    <div className="field" style={span ? { gridColumn:'span 2' } : {}}>
      {label && <label className="field-label">{label}</label>}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  )
}

export function Input(props) { return <input className="input" {...props} /> }
export function Select({ children, ...props }) { return <select className="input" {...props}>{children}</select> }
export function Textarea(props) { return <textarea className="input" {...props} /> }

export function Btn({ children, variant = 'primary', loading, sm, ...props }) {
  return (
    <button className={`btn btn-${variant}${sm ? ' btn-sm' : ''}`} disabled={loading || props.disabled} {...props}>
      {loading ? <span className="spinner" /> : children}
    </button>
  )
}

export function ActionBtns({ onEdit, onDelete }) {
  return (
    <div style={{ display:'flex', gap:6 }} onClick={e => e.stopPropagation()}>
      <Btn variant="ghost" sm onClick={onEdit}>Edit</Btn>
      <Btn variant="danger" sm onClick={onDelete}>Delete</Btn>
    </div>
  )
}

export function Confirm({ message, onConfirm, onClose }) {
  return (
    <Modal title="Confirm" onClose={onClose}>
      <p style={{ color:'var(--text-2)', marginBottom:20, lineHeight:1.6 }}>{message}</p>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="danger" onClick={onConfirm}>Confirm Delete</Btn>
      </div>
    </Modal>
  )
}

export function DataTable({ cols, rows, onRowClick, emptyMsg = 'No data yet', emptyIcon = '📭' }) {
  if (!rows?.length) return (
    <div className="card">
      <div className="empty-state">
        <div className="empty-icon">{emptyIcon}</div>
        {emptyMsg}
      </div>
    </div>
  )
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{cols.map(c => <th key={c.key || c.label}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={onRowClick ? 'clickable' : ''} onClick={() => onRowClick?.(row)}>
              {cols.map(c => <td key={c.key || c.label}>{c.render ? c.render(row) : row[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ProgressBar({ value, max, label }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="progress-wrap">
      <div className="progress-labels"><span>{label}</span><span>{pct.toFixed(1)}%</span></div>
      <div className="progress-bar"><div className="progress-fill" style={{ width:`${pct}%` }} /></div>
    </div>
  )
}

export function MoneyTrail({ data }) {
  if (!data) return null
  const diff = Math.abs(data.totalIn - data.totalOut)
  const balanced = diff < 100 // allow small rounding differences

  return (
    <div className="recon-box">
      <div className="recon-title">
        <span>💳</span> Money Trail
        <span style={{ marginLeft:'auto', fontSize:'0.78rem', color: balanced ? 'var(--green)' : 'var(--text-2)', fontWeight:700 }}>
          {balanced ? '✓ Balanced' : 'Summary'}
        </span>
      </div>

      <div className="recon-section-label">Where it came from</div>
      <div className="recon-row">
        <span className="recon-label">💵 Own cash invested</span>
        <span className="recon-value amt-blue">{fc(data.cashInvested)}</span>
      </div>
      <div className="recon-row">
        <span className="recon-label">📈 Profit earned from sales</span>
        <span className="recon-value amt-green">{fc(data.profitEarned)}</span>
      </div>
      {data.adjustments !== 0 && (
        <div className="recon-row">
          <span className="recon-label">⚖️ Manual adjustments</span>
          <span className="recon-value amt-purple">{fc(data.adjustments)}</span>
        </div>
      )}

      <hr className="recon-divider" />
      <div className="recon-section-label">Where it is now</div>
      <div className="recon-row">
        <span className="recon-label">📍 Locked in active plots</span>
        <span className="recon-value amt-gold">{fc(data.activelyInvested)}</span>
      </div>
      <div className="recon-row">
        <span className="recon-label">🏦 Paid out to bank</span>
        <span className="recon-value amt-red">{fc(data.withdrawn)}</span>
      </div>
      <div className="recon-row">
        <span className="recon-label">👛 Sitting in wallet</span>
        <span className="recon-value amt-gold">{fc(data.walletBalance)}</span>
      </div>

      {data.reinvestedAmount > 0 && (
        <>
          <hr className="recon-divider" />
          <div className="recon-row" style={{ fontSize:'0.8rem' }}>
            <span style={{ color:'var(--text-3)' }}>🔄 Of which reinvested from returns</span>
            <span style={{ color:'var(--text-3)', fontWeight:600 }}>{fc(data.reinvestedAmount)}</span>
          </div>
        </>
      )}
    </div>
  )
}
