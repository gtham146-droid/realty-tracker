import React, { useEffect, useState, useCallback } from 'react'
import { API, fc, fd, fp, isTruthy } from '../config'
import { Loader, StatCard, DataTable, StatusBadge, Badge, Modal, Btn, Field, Input, Textarea, Confirm, ActionBtns, MoneyTrail, TxTypeBadge } from '../components/UI'
import { useAuth } from '../context/AuthContext'

/* ── Investor Modal ────────────────────────────────────────── */
function InvestorModal({ existing, onClose, onDone }) {
  const isEdit = !!existing
  const [f, setF] = useState(existing || { name: '', email: '', phone: '', panNumber: '', bankName: '', accountNumber: '', ifscCode: '', password: '' })
  const [busy, setBusy] = useState(false)
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }))

  const submit = async () => {
    setBusy(true)
    const res = await API.post(isEdit ? 'editInvestor' : 'addInvestor', f)
    setBusy(false)
    if (res.success) { onDone(); onClose() } else alert(res.error)
  }

  return (
    <Modal title={isEdit ? 'Edit Investor' : 'Add Investor'} onClose={onClose} wide>
      <div className="form-stack">
        <div className="form-grid">
          <Field label="Full Name *"><Input value={f.name} onChange={set('name')} /></Field>
          <Field label="Email *"><Input type="email" value={f.email} onChange={set('email')} placeholder="Gmail for SSO login" /></Field>
          <Field label="Phone"><Input value={f.phone || ''} onChange={set('phone')} /></Field>
          <Field label="PAN Number"><Input value={f.panNumber || ''} onChange={set('panNumber')} /></Field>
        </div>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)', marginTop: 4 }}>Bank Details</div>
        <div className="form-grid">
          <Field label="Bank Name"><Input value={f.bankName || ''} onChange={set('bankName')} /></Field>
          <Field label="IFSC Code"><Input value={f.ifscCode || ''} onChange={set('ifscCode')} /></Field>
          <Field label="Account Number"><Input value={f.accountNumber || ''} onChange={set('accountNumber')} /></Field>
          {!isEdit && <Field label="Fallback Password" hint="Optional — for non-Google login"><Input type="password" value={f.password || ''} onChange={set('password')} /></Field>}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn loading={busy} onClick={submit}>{isEdit ? 'Save' : 'Add Investor'}</Btn>
        </div>
      </div>
    </Modal>
  )
}

/* ── Wallet Adjust Modal ───────────────────────────────────── */
function AdjustModal({ investor, onClose, onDone }) {
  const [f, setF] = useState({ adjustmentAmount: '', reason: '' })
  const [busy, setBusy] = useState(false)
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }))
  const newBal = Number(investor.walletBalance) + Number(f.adjustmentAmount || 0)

  const submit = async () => {
    if (!f.adjustmentAmount || !f.reason.trim()) return alert('Amount and reason required')
    setBusy(true)
    const res = await API.post('adjustWallet', { investorId: investor.investorId, adjustmentAmount: f.adjustmentAmount, reason: f.reason })
    setBusy(false)
    if (res.success) { onDone(); onClose() } else alert(res.error)
  }

  return (
    <Modal title="Adjust Wallet Balance" onClose={onClose}>
      <div className="form-stack">
        <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>Current Balance</div>
          <div className="amt-gold" style={{ fontSize: '1.3rem', fontWeight: 700 }}>{fc(investor.walletBalance)}</div>
        </div>
        <Field label="Adjustment (₹)" hint="Positive to add, negative to deduct">
          <Input type="number" value={f.adjustmentAmount} onChange={set('adjustmentAmount')} placeholder="e.g. 5000 or -2000" />
        </Field>
        {f.adjustmentAmount && (
          <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem' }}>
            New balance: <strong className={newBal >= 0 ? 'amt-green' : 'amt-red'}>{fc(newBal)}</strong>
          </div>
        )}
        <Field label="Reason *">
          <Input value={f.reason} onChange={set('reason')} placeholder="e.g. Correction for double entry" />
        </Field>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn loading={busy} onClick={submit}>Apply</Btn>
        </div>
      </div>
    </Modal>
  )
}

/* ── Wallet Action Modal (withdraw / reinvest) ─────────────── */
function WalletModal({ investor, action, onClose, onDone }) {
  const [plots, setPlots] = useState([])
  const [f, setF] = useState({ amount: '', plotId: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }))
  useEffect(() => { if (action === 'reinvest') API.get('getPlots').then(d => setPlots(Array.isArray(d) ? d.filter(p => p.status === 'Active') : [])) }, [action])

  const submit = async () => {
    setBusy(true)
    const res = await API.post(action === 'withdraw' ? 'processWithdrawal' : 'reinvest', { ...f, investorId: investor.investorId })
    setBusy(false)
    if (res.success) { onDone(); onClose() } else alert(res.error)
  }

  return (
    <Modal title={action === 'withdraw' ? 'Process Withdrawal' : 'Reinvest Funds'} onClose={onClose}>
      <div className="form-stack">
        <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>Available Balance</div>
          <div className="amt-gold" style={{ fontSize: '1.3rem', fontWeight: 700 }}>{fc(investor.walletBalance)}</div>
        </div>
        <Field label="Amount (₹) *"><Input type="number" value={f.amount} onChange={set('amount')} max={investor.walletBalance} /></Field>
        {action === 'reinvest' && (
          <Field label="Target Plot *">
            <select className="input" value={f.plotId} onChange={set('plotId')}>
              <option value="">Select active plot...</option>
              {plots.map(p => <option key={p.plotId} value={p.plotId}>{p.name} — {p.location}</option>)}
            </select>
          </Field>
        )}
        <Field label="Notes"><Input value={f.notes} onChange={set('notes')} placeholder="Optional note" /></Field>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn loading={busy} onClick={submit}>{action === 'withdraw' ? '💸 Withdraw' : '🔄 Reinvest'}</Btn>
        </div>
      </div>
    </Modal>
  )
}

/* ── Returns Tab with Money Trail ──────────────────────────── */
function ReturnsTab({ investorId }) {
  const [data, setData] = useState(null)
  useEffect(() => { API.get('getInvestorReturns', { investorId }).then(setData) }, [investorId])
  if (!data) return <Loader />

  // Build money trail data
  const trail = {
    cashInvested:     data.cashInvested,
    profitEarned:     data.totalPLShare,
    adjustments:      data.adjustments,
    totalIn:          data.cashInvested + Math.max(0, data.totalPLShare) + data.adjustments,
    activelyInvested: data.plotBreakdowns.filter(p => p.plotStatus === 'Active' && !isTruthy(p.isReinvestment)).reduce((s, p) => s + p.commitment, 0),
    reinvestedAmount: data.reinvested,
    withdrawn:        data.withdrawals,
    walletBalance:    data.walletBalance,
    totalOut:         0
  }
  // Active + reinvested_active + withdrawn + wallet = total out
  const activeReinvest = data.plotBreakdowns.filter(p => p.plotStatus === 'Active' && isTruthy(p.isReinvestment)).reduce((s, p) => s + p.commitment, 0)
  trail.activelyInvested += activeReinvest
  trail.totalOut = trail.activelyInvested + trail.withdrawn + trail.walletBalance

  const plotCols = [
    { key: 'plotName', label: 'Plot', render: r => <span style={{ fontWeight: 600 }}>{r.plotName}</span> },
    { key: 'plotStatus', label: 'Status', render: r => <StatusBadge status={r.plotStatus} /> },
    { key: 'commitment', label: 'Committed', render: r => fc(r.commitment) },
    { key: 'isReinvestment', label: 'Source', render: r => isTruthy(r.isReinvestment) ? <Badge text="Reinvested" type="reinvest" /> : <Badge text="Cash" type="cash" /> },
    { key: 'sharePercent', label: 'Share %', render: r => fp(r.sharePercent) },
    { key: 'profitLossShare', label: 'P&L Share', render: r => <span className={r.profitLossShare >= 0 ? 'amt-green' : 'amt-red'}>{fc(r.profitLossShare)}</span> },
    { key: 'totalReceived', label: 'Received', render: r => <span className="amt-gold">{fc(r.totalReceived)}</span> },
  ]

  return (
    <div>
      <MoneyTrail data={trail} />

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
        <StatCard label="Cash from Pocket" value={fc(data.cashInvested)} sub="Own money invested" accent="var(--blue)" />
        <StatCard label="Reinvested (from returns)" value={fc(data.reinvested)} sub="Not own money" accent="var(--purple)" />
        <StatCard label="Net ROI on Cash" value={data.cashInvested > 0 ? `${((data.totalPLShare / data.cashInvested) * 100).toFixed(1)}%` : '—'} sub="Profit ÷ cash invested" accent="var(--green)" />
      </div>

      <div className="section-head"><span className="section-title">Per Plot Breakdown</span></div>
      <DataTable cols={plotCols} rows={data.plotBreakdowns} emptyMsg="No investments yet" emptyIcon="📊" />
    </div>
  )
}

/* ── Investor Detail ───────────────────────────────────────── */
function InvestorDetail({ investorId, onClose, onRefresh }) {
  const [detail, setDetail] = useState(null)
  const [tab, setTab] = useState('overview')
  const [modal, setModal] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const { isAdmin } = useAuth()

  const load = useCallback(() => API.get('getInvestorDetail', { investorId }).then(setDetail), [investorId])
  useEffect(() => { load() }, [load])
  if (!detail) return <Loader />

  const walletBal = detail.wallet?.balance || 0

  const txCols = [
    { key: 'createdAt', label: 'Date', render: r => <span style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>{fd(r.createdAt)}</span> },
    { key: 'type', label: 'Type', render: r => <TxTypeBadge type={r.type} /> },
    { key: 'amount', label: 'Amount', render: r => <span className={Number(r.amount) >= 0 ? 'amt-green' : 'amt-red'}>{fc(r.amount)}</span> },
    { key: 'description', label: 'Description', render: r => <span style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>{r.description}</span> }
  ]

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div>
          <div className="detail-title">{detail.name}</div>
          <div className="detail-sub">{detail.email} {detail.phone ? `· ${detail.phone}` : ''}</div>
        </div>
        <div className="detail-actions">
          {isAdmin && <Btn variant="ghost" sm onClick={() => setModal('edit')}>Edit</Btn>}
          {isAdmin && <Btn variant="danger" sm onClick={() => setConfirm({
            msg: `Delete "${detail.name}"? Removes wallet, commitments, and all transaction history.`,
            onConfirm: async () => { setConfirm(null); const res = await API.post('deleteInvestor', { investorId }); if (res.success) { onClose(); onRefresh?.() } else alert(res.error) }
          })}>Delete</Btn>}
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
      </div>

      {/* Top summary row */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 16 }}>
        <StatCard label="Wallet Balance" value={fc(walletBal)} accent="var(--gold)" />
        <StatCard label="Cash Invested" value={fc(detail.cashInvested)} sub="Own pocket" accent="var(--blue)" />
        <StatCard label="Reinvested" value={fc(detail.reinvested)} sub="From returns" accent="var(--purple)" />
        <StatCard label="Total Committed" value={fc(detail.totalCommitted)} sub="Cash + reinvested" accent="var(--text-2)" />
      </div>

      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <Btn sm onClick={() => setModal('withdraw')}>💸 Withdraw</Btn>
          <Btn sm variant="accent" onClick={() => setModal('reinvest')}>🔄 Reinvest</Btn>
          <Btn sm variant="ghost" onClick={() => setModal('adjust')}>⚖️ Adjust Wallet</Btn>
        </div>
      )}

      <div className="tabs">
        {[['overview', 'Overview'], ['returns', 'Money Trail'], ['transactions', 'Transactions']].map(([k, l]) => (
          <button key={k} className={`tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)', marginBottom: 12 }}>KYC & Bank Details</div>
          <div className="form-grid" style={{ fontSize: '0.85rem', gap: '8px 24px' }}>
            {[['PAN', detail.panNumber], ['Bank', detail.bankName], ['Account', detail.accountNumber], ['IFSC', detail.ifscCode]].map(([l, v]) => (
              <div key={l}><span style={{ color: 'var(--text-2)' }}>{l}: </span><span>{v || '—'}</span></div>
            ))}
          </div>
        </div>
      )}

      {tab === 'returns' && <ReturnsTab investorId={investorId} />}

      {tab === 'transactions' && (
        <DataTable cols={txCols} rows={detail.transactions} emptyMsg="No transactions" emptyIcon="📋" />
      )}

      {modal === 'edit'     && <InvestorModal existing={detail} onClose={() => setModal(null)} onDone={() => { load(); onRefresh?.() }} />}
      {modal === 'withdraw' && <WalletModal investor={{ ...detail, walletBalance: walletBal }} action="withdraw" onClose={() => setModal(null)} onDone={load} />}
      {modal === 'reinvest' && <WalletModal investor={{ ...detail, walletBalance: walletBal }} action="reinvest" onClose={() => setModal(null)} onDone={load} />}
      {modal === 'adjust'   && <AdjustModal investor={{ ...detail, walletBalance: walletBal }} onClose={() => setModal(null)} onDone={load} />}
      {confirm && <Confirm message={confirm.msg} onConfirm={confirm.onConfirm} onClose={() => setConfirm(null)} />}
    </div>
  )
}

/* ── Main Investors Page ───────────────────────────────────── */
export default function Investors() {
  const [investors, setInvestors] = useState([])
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const { isAdmin } = useAuth()

  const load = useCallback(() => {
    setLoading(true)
    API.get('getInvestors').then(d => { setInvestors(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const cols = [
    { key: 'name', label: 'Name', render: r => <span style={{ fontWeight: 600 }}>{r.name}</span> },
    { key: 'cashInvested', label: 'Cash Invested', render: r => <span className="amt-blue" title="Money from own pocket">{fc(r.cashInvested)}</span> },
    { key: 'reinvested', label: 'Reinvested', render: r => <span className="amt-purple" title="From returns, not own money">{fc(r.reinvested)}</span> },
    { key: 'totalReturns', label: 'Returns Received', render: r => <span className="amt-green">{fc(r.totalReturns)}</span> },
    { key: 'walletBalance', label: 'Wallet', render: r => <span className="amt-gold">{fc(r.walletBalance)}</span> },
    { key: 'createdAt', label: 'Joined', render: r => <span className="amt-muted">{fd(r.createdAt)}</span> }
  ]

  if (loading) return <Loader />

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Investors</div>
          <div className="page-sub">{investors.length} registered</div>
        </div>
        {isAdmin && <Btn onClick={() => setShowAdd(true)}>+ Add</Btn>}
      </div>

      {selected ? (
        <InvestorDetail investorId={selected} onClose={() => setSelected(null)} onRefresh={load} />
      ) : (
        <DataTable cols={cols} rows={investors} onRowClick={r => setSelected(r.investorId)} emptyMsg="No investors yet" emptyIcon="👥" />
      )}

      {showAdd && <InvestorModal onClose={() => setShowAdd(false)} onDone={load} />}
    </div>
  )
}
