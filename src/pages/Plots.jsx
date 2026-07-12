import React, { useEffect, useState, useCallback } from 'react'
import { API, fc, fd, fp, EXPENSE_CATS, isTruthy } from '../config'
import { Loader, StatCard, DataTable, StatusBadge, Badge, Modal, Btn, Field, Input, Select, Textarea, ActionBtns, Confirm, ProgressBar, BackRow } from '../components/UI.jsx'
import { useAuth } from '../context/AuthContext'

/* ── Small helpers ─────────────────────────────────────────── */
function PL({ v }) {
  const n = Number(v)
  return <span className={n >= 0 ? 'amt-green' : 'amt-red'}>{fc(n)}</span>
}

/* ── Plot Modal (add / edit) ───────────────────────────────── */
function PlotModal({ existing, onClose, onDone }) {
  const isEdit = !!existing
  const [f, setF] = useState(existing || { name: '', location: '', sizeSqft: '', askingPrice: '', status: 'Active', expectedTimeline: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }))

  const submit = async () => {
    if (!f.name || !f.location) return alert('Name and location required')
    setBusy(true)
    const res = await API.post(isEdit ? 'editPlot' : 'addPlot', f)
    setBusy(false)
    if (res.success) { onDone(); onClose() } else alert(res.error)
  }

  return (
    <Modal title={isEdit ? 'Edit Plot' : 'New Plot'} onClose={onClose}>
      <div className="form-stack">
        <Field label="Plot Name *"><Input value={f.name} onChange={set('name')} /></Field>
        <Field label="Location *"><Input value={f.location} onChange={set('location')} /></Field>
        <div className="form-grid">
          <Field label="Size (sq.ft)"><Input type="number" value={f.sizeSqft} onChange={set('sizeSqft')} /></Field>
          <Field label="Asking Price (₹)"><Input type="number" value={f.askingPrice} onChange={set('askingPrice')} /></Field>
        </div>
        <Field label="Status">
          <Select value={f.status || 'Active'} onChange={set('status')}>
            {['Active', 'Sold', 'Partially Sold', 'On Hold'].map(s => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Expected Timeline"><Input value={f.expectedTimeline || ''} onChange={set('expectedTimeline')} placeholder="e.g. Q3 2026" /></Field>
        <Field label="Notes"><Textarea value={f.notes || ''} onChange={set('notes')} /></Field>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn loading={busy} onClick={submit}>{isEdit ? 'Save' : 'Create Plot'}</Btn>
        </div>
      </div>
    </Modal>
  )
}

/* ── Expense Modal ─────────────────────────────────────────── */
function ExpenseModal({ plotId, existing, onClose, onDone }) {
  const isEdit = !!existing
  const [f, setF] = useState(existing || { category: EXPENSE_CATS[0], description: '', amount: '', receiptUrl: '' })
  const [busy, setBusy] = useState(false)
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }))

  const submit = async () => {
    setBusy(true)
    const res = await API.post(isEdit ? 'editExpense' : 'addExpense', { ...f, plotId })
    setBusy(false)
    if (res.success) { onDone(); onClose() } else alert(res.error)
  }

  return (
    <Modal title={isEdit ? 'Edit Expense' : 'Add Expense'} onClose={onClose}>
      <div className="form-stack">
        <Field label="Category">
          <Select value={f.category} onChange={set('category')}>
            {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Description"><Input value={f.description || ''} onChange={set('description')} /></Field>
        <Field label="Amount (₹) *"><Input type="number" value={f.amount} onChange={set('amount')} /></Field>
        <Field label="Receipt URL" hint="Google Drive share link">
          <Input value={f.receiptUrl || ''} onChange={set('receiptUrl')} placeholder="https://drive.google.com/..." />
        </Field>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn loading={busy} onClick={submit}>{isEdit ? 'Save' : 'Add'}</Btn>
        </div>
      </div>
    </Modal>
  )
}

/* ── Commitment Modal ──────────────────────────────────────── */
function CommitmentModal({ plotId, existing, onClose, onDone }) {
  const isEdit = !!existing
  const [investors, setInvestors] = useState([])
  const [f, setF] = useState(existing || { investorId: '', amount: '' })
  const [busy, setBusy] = useState(false)
  useEffect(() => { API.get('getInvestors').then(d => setInvestors(Array.isArray(d) ? d : [])) }, [])
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }))

  const submit = async () => {
    setBusy(true)
    const res = await API.post(isEdit ? 'editCommitment' : 'addCommitment', { ...f, plotId })
    setBusy(false)
    if (res.success) { onDone(); onClose() } else alert(res.error)
  }

  return (
    <Modal title={isEdit ? 'Edit Commitment' : 'Add Commitment'} onClose={onClose}>
      <div className="form-stack">
        <Field label="Investor *">
          <Select value={f.investorId} onChange={set('investorId')} disabled={isEdit}>
            <option value="">Select investor...</option>
            {investors.map(i => <option key={i.investorId} value={i.investorId}>{i.name}</option>)}
          </Select>
        </Field>
        <Field label="Amount (₹) *"><Input type="number" value={f.amount} onChange={set('amount')} /></Field>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn loading={busy} onClick={submit}>{isEdit ? 'Save' : 'Add'}</Btn>
        </div>
      </div>
    </Modal>
  )
}

/* ── Sale Modal ────────────────────────────────────────────── */
function SaleModal({ plot, existing, onClose, onDone }) {
  const isEdit = !!existing
  const [f, setF] = useState(existing || { saleDate: new Date().toISOString().slice(0, 10), sizePortionSqft: plot.sizeSqft, salePrice: '', brokerFee: '0', notes: '' })
  const [busy, setBusy] = useState(false)
  const [showPrincipal, setShowPrincipal] = useState(false)
  const [principalReturns, setPrincipalReturns] = useState({}) // investorId -> amount
  const [commitments, setCommitments] = useState([])
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }))
  const net = (Number(f.salePrice) - Number(f.brokerFee || 0))

  // Load commitments when principal section is opened
  const loadCommitments = async () => {
    if (commitments.length) return
    const detail = await API.get('getPlotDetail', { plotId: plot.plotId })
    setCommitments(detail.commitments || [])
    // If editing, load existing principal returns
    if (existing?.saleId) {
      const pr = await API.get('getPrincipalReturns', { saleId: existing.saleId })
      const map = {}
      if (Array.isArray(pr)) pr.forEach(r => { map[r.investorId] = r.amount })
      setPrincipalReturns(map)
    }
  }

  const togglePrincipal = () => {
    if (!showPrincipal) loadCommitments()
    setShowPrincipal(p => !p)
  }

  const totalPrincipalEntered = Object.values(principalReturns).reduce((s, v) => s + (Number(v) || 0), 0)

  const submit = async () => {
    setBusy(true)
    const res = await API.post(isEdit ? 'editSale' : 'recordSale', { ...f, plotId: plot.plotId })
    if (res.success || res.saleId) {
      const saleId = res.saleId || existing?.saleId
      // Save principal returns if any were entered
      const returns = Object.entries(principalReturns)
        .filter(([, v]) => Number(v) > 0)
        .map(([investorId, amount]) => ({ investorId, amount: Number(amount) }))
      if (returns.length > 0) {
        await API.post('savePrincipalReturns', { saleId, plotId: plot.plotId, returns })
      }
      onDone(); onClose()
    } else {
      alert(res.error)
    }
    setBusy(false)
  }

  return (
    <Modal title={isEdit ? 'Edit Sale' : 'Record Sale'} onClose={onClose} wide>
      <div className="form-stack">
        <div className="form-grid">
          <Field label="Sale Date *"><Input type="date" value={f.saleDate} onChange={set('saleDate')} /></Field>
          <Field label={`Portion Size (sq.ft) — Total: ${plot.sizeSqft}`}>
            <Input type="number" value={f.sizePortionSqft} onChange={set('sizePortionSqft')} max={plot.sizeSqft} />
          </Field>
          <Field label="Sale Price (₹) *"><Input type="number" value={f.salePrice} onChange={set('salePrice')} /></Field>
          <Field label="Broker Fee (₹)"><Input type="number" value={f.brokerFee} onChange={set('brokerFee')} /></Field>
        </div>

        {f.salePrice && (
          <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem' }}>
            Net Revenue: <strong className="amt-gold">{fc(net)}</strong>
          </div>
        )}

        <Field label="Notes"><Textarea value={f.notes || ''} onChange={set('notes')} /></Field>

        {/* Principal Return Section */}
        <div style={{ border: '1px solid var(--border2)', borderRadius: 10, overflow: 'hidden' }}>
          <button
            type="button"
            onClick={togglePrincipal}
            style={{ width: '100%', background: 'var(--surface2)', border: 'none', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', color: 'var(--text)', fontSize: '0.83rem', fontWeight: 600 }}
          >
            <span>💰 Principal returned to investors? <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(optional — for partial sales)</span></span>
            <span style={{ color: 'var(--text-3)' }}>{showPrincipal ? '▲' : '▼'}</span>
          </button>

          {showPrincipal && (
            <div style={{ padding: 14 }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', marginBottom: 12 }}>
                Enter how much of each investor's original investment was returned from this sale. This removes that amount from their "locked in plots" figure.
              </p>
              {commitments.length === 0 ? (
                <div style={{ color: 'var(--text-3)', fontSize: '0.82rem' }}>Loading investors...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {commitments.map(c => (
                    <div key={c.investorId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, fontSize: '0.83rem' }}>
                        <span style={{ fontWeight: 600 }}>{c.investorName}</span>
                        <span style={{ color: 'var(--text-3)', marginLeft: 6 }}>committed {fc(c.amount)}</span>
                      </div>
                      <div style={{ width: 160 }}>
                        <Input
                          type="number"
                          placeholder="₹ returned"
                          value={principalReturns[c.investorId] || ''}
                          max={c.amount}
                          onChange={e => setPrincipalReturns(p => ({ ...p, [c.investorId]: e.target.value }))}
                        />
                      </div>
                    </div>
                  ))}
                  {totalPrincipalEntered > 0 && (
                    <div style={{ background: 'var(--surface2)', borderRadius: 6, padding: '8px 12px', fontSize: '0.82rem', marginTop: 4 }}>
                      Total principal being returned: <strong className="amt-gold">{fc(totalPrincipalEntered)}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn loading={busy} onClick={submit}>{isEdit ? 'Save' : 'Record & Distribute'}</Btn>
        </div>
      </div>
    </Modal>
  )
}

/* ── Profit Share Panel ────────────────────────────────────── */
function ProfitSharePanel({ plotId }) {
  const [data, setData] = useState(null)
  useEffect(() => { API.get('getPlotProfitShare', { plotId }).then(setData) }, [plotId])
  if (!data) return <Loader />
  if (!data.saleBreakdowns?.length) return <div className="empty-state"><div className="empty-icon">📊</div>No sales yet — profit share will appear once a sale is recorded.</div>

  return (
    <div>
      {data.saleBreakdowns.map(sale => (
        <div key={sale.saleId} className="profit-sale-block">
          <div className="profit-sale-header">
            <div>
              <div style={{ fontWeight: 600 }}>Sale — {fd(sale.saleDate)}</div>
              <div className="profit-sale-meta">{sale.sizePortionSqft} sq.ft · Sale: {fc(sale.salePrice)} · Broker: {fc(sale.brokerFee)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>Net P&L</div>
              <div className={`profit-pl ${Number(sale.netProfitLoss) >= 0 ? 'amt-green' : 'amt-red'}`}>{fc(sale.netProfitLoss)}</div>
            </div>
          </div>
          <div className="table-wrap" style={{ borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
            <table>
              <thead>
                <tr>
                  <th>Investor</th><th>Committed</th><th>Share %</th>
                  <th>Principal Back</th><th>Profit / Loss</th><th>Total Received</th>
                </tr>
              </thead>
              <tbody>
                {sale.shares.map((s, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, color: s.investorId === 'COMPANY' ? 'var(--purple)' : 'var(--text)' }}>{s.investorName}</td>
                    <td>{fc(s.commitment)}</td>
                    <td className="amt-muted">{fp(s.sharePercent)}</td>
                    <td className="amt-blue">{fc(s.principalReturn)}</td>
                    <td><PL v={s.profitShare} /></td>
                    <td className="amt-gold">{fc(s.totalReceived)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Plot Detail ───────────────────────────────────────────── */
function PlotDetail({ plotId, onClose, onRefresh }) {
  const [detail, setDetail] = useState(null)
  const [tab, setTab] = useState('overview')
  const [modal, setModal] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const { isAdmin } = useAuth()

  const load = useCallback(() => API.get('getPlotDetail', { plotId }).then(setDetail), [plotId])
  useEffect(() => { load() }, [load])
  if (!detail) return <Loader />

  const handleDelete = (action, body, msg) => {
    setConfirm({ msg, onConfirm: async () => {
      setConfirm(null)
      const res = await API.post(action, body)
      if (res.success) { load(); onRefresh?.() } else alert(res.error)
    }})
  }

  const expCols = [
    { key: 'category', label: 'Category' },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount', render: r => fc(r.amount) },
    { key: 'createdAt', label: 'Date', render: r => fd(r.createdAt) },
    { key: 'receiptUrl', label: 'Receipt', render: r => r.receiptUrl ? <a href={r.receiptUrl} target="_blank" rel="noreferrer" className="amt-gold">View</a> : '—' },
    ...(isAdmin ? [{ key: 'act', label: '', render: r => <ActionBtns onEdit={() => setModal({ t: 'expense', d: r })} onDelete={() => handleDelete('deleteExpense', { expenseId: r.expenseId }, `Delete "${r.category} — ₹${r.amount}"?`)} /> }] : [])
  ]

  const cmmCols = [
    { key: 'investorName', label: 'Investor' },
    { key: 'amount', label: 'Committed', render: r => fc(r.amount) },
    { key: 'sharePercent', label: 'Share %', render: r => fp(r.sharePercent) },
    { key: 'isReinvestment', label: 'Source', render: r => isTruthy(r.isReinvestment) ? <Badge text="Reinvested" type="reinvest" /> : <Badge text="Cash" type="cash" /> },
    ...(isAdmin ? [{ key: 'act', label: '', render: r => <ActionBtns onEdit={() => setModal({ t: 'commitment', d: r })} onDelete={() => handleDelete('deleteCommitment', { commitmentId: r.commitmentId, plotId }, `Remove commitment from ${r.investorName}? This recalculates all shares.`)} /> }] : [])
  ]

  const saleCols = [
    { key: 'saleDate', label: 'Date', render: r => fd(r.saleDate) },
    { key: 'sizePortionSqft', label: 'Size (sq.ft)' },
    { key: 'salePrice', label: 'Sale Price', render: r => fc(r.salePrice) },
    { key: 'netRevenue', label: 'Net Revenue', render: r => fc(r.netRevenue) },
    { key: 'netProfitLoss', label: 'P&L', render: r => <PL v={r.netProfitLoss} /> },
    ...(isAdmin ? [{ key: 'act', label: '', render: r => <ActionBtns onEdit={() => setModal({ t: 'sale', d: r })} onDelete={() => handleDelete('deleteSale', { saleId: r.saleId }, '⚠️ Delete this sale? This reverses all wallet distributions.')} /> }] : [])
  ]

  return (
    <div className="detail-panel">
      <BackRow listLabel="All Plots" itemLabel={detail.name} onBack={onClose} />
      <div className="detail-header">
        <div>
          <div className="detail-title">{detail.name}</div>
          <div className="detail-sub">{detail.location} · {detail.sizeSqft} sq.ft · <StatusBadge status={detail.status} /></div>
        </div>
        <div className="detail-actions">
          {isAdmin && <Btn variant="ghost" sm onClick={() => setModal({ t: 'plot', d: detail })}>Edit</Btn>}
          {isAdmin && <Btn variant="danger" sm onClick={() => handleDelete('deletePlot', { plotId }, `Delete "${detail.name}" and all related data?`)}>Delete</Btn>}
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 16 }}>
        <StatCard label="Acquisition Cost" value={fc(detail.totalCost)} accent="var(--gold)" />
        <StatCard label="Investor Funded" value={fc(detail.totalFunded)} accent="var(--green)" />
        <StatCard label="Company Share" value={fc(detail.companyShare)} accent="var(--purple)" />
      </div>
      <ProgressBar value={detail.totalFunded} max={detail.totalCost} label="Funding progress" />

      <div className="tabs">
        {[['overview', 'Overview'], ['profitshare', 'Profit Share'], ['sales', 'Sales']].map(([k, l]) => (
          <button key={k} className={`tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="section-head">
            <span className="section-title">Expenses</span>
            {isAdmin && <Btn sm onClick={() => setModal({ t: 'expense' })}>+ Add</Btn>}
          </div>
          <DataTable cols={expCols} rows={detail.expenses} emptyMsg="No expenses yet" emptyIcon="🧾" />

          <div className="section-head">
            <span className="section-title">Commitments</span>
            {isAdmin && <Btn sm onClick={() => setModal({ t: 'commitment' })}>+ Add</Btn>}
          </div>
          <DataTable cols={cmmCols} rows={detail.commitments} emptyMsg="No commitments yet" emptyIcon="🤝" />
        </>
      )}

      {tab === 'profitshare' && <ProfitSharePanel plotId={plotId} />}

      {tab === 'sales' && (
        <>
          <div className="section-head">
            <span className="section-title">Sales</span>
            {isAdmin && <Btn sm variant="accent" onClick={() => setModal({ t: 'sale' })}>Record Sale</Btn>}
          </div>
          <DataTable cols={saleCols} rows={detail.sales} emptyMsg="No sales yet" emptyIcon="🏷️" />
        </>
      )}

      {modal?.t === 'plot'       && <PlotModal existing={modal.d} onClose={() => setModal(null)} onDone={() => { load(); onRefresh?.() }} />}
      {modal?.t === 'expense'    && <ExpenseModal plotId={plotId} existing={modal.d} onClose={() => setModal(null)} onDone={load} />}
      {modal?.t === 'commitment' && <CommitmentModal plotId={plotId} existing={modal.d} onClose={() => setModal(null)} onDone={load} />}
      {modal?.t === 'sale'       && <SaleModal plot={detail} existing={modal.d} onClose={() => setModal(null)} onDone={() => { load(); onRefresh?.() }} />}
      {confirm && <Confirm message={confirm.msg} onConfirm={confirm.onConfirm} onClose={() => setConfirm(null)} />}
    </div>
  )
}

/* ── Main Plots Page ───────────────────────────────────────── */
export default function Plots() {
  const [plots, setPlots] = useState([])
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const { isAdmin } = useAuth()

  const load = useCallback(() => {
    setLoading(true)
    API.get('getPlots').then(d => { setPlots(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const cols = [
    { key: 'name', label: 'Plot Name', render: r => <span style={{ fontWeight: 600 }}>{r.name}</span> },
    { key: 'location', label: 'Location', render: r => <span className="amt-muted">{r.location}</span> },
    { key: 'status', label: 'Status', render: r => <StatusBadge status={r.status} /> },
    { key: 'totalCost', label: 'Cost', render: r => fc(r.totalCost) },
    { key: 'totalPL', label: 'P&L', render: r => <PL v={r.totalPL} /> },
    { key: 'createdAt', label: 'Added', render: r => <span className="amt-muted">{fd(r.createdAt)}</span> }
  ]

  if (loading) return <Loader />

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Plots</div>
          <div className="page-sub">{plots.length} projects</div>
        </div>
        {isAdmin && <Btn onClick={() => setShowAdd(true)}>+ New Plot</Btn>}
      </div>

      {selected ? (
        <PlotDetail plotId={selected} onClose={() => setSelected(null)} onRefresh={load} />
      ) : (
        <DataTable cols={cols} rows={plots} onRowClick={r => setSelected(r.plotId)} emptyMsg="No plots yet" emptyIcon="🏘️" />
      )}

      {showAdd && <PlotModal onClose={() => setShowAdd(false)} onDone={() => { load(); setShowAdd(false) }} />}
    </div>
  )
}
