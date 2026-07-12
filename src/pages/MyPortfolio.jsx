import React, { useEffect, useState } from 'react'
import { API, fc, fd, fp, isTruthy } from '../config'
import { Loader, StatCard, DataTable, StatusBadge, Badge, TxTypeBadge, MoneyTrail } from '../components/UI'
import { useAuth } from '../context/AuthContext'

export default function MyPortfolio() {
  const { user } = useAuth()
  const [detail, setDetail] = useState(null)
  const [returns, setReturns] = useState(null)
  const [tab, setTab] = useState('trail')

  useEffect(() => {
    if (!user?.investorId) return
    API.get('getInvestorDetail', { investorId: user.investorId }).then(setDetail)
    API.get('getInvestorReturns', { investorId: user.investorId }).then(setReturns)
  }, [user])

  if (!user?.investorId) return (
    <div className="page">
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-2)' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>👋</div>
        No investor profile linked to your account. Contact admin.
      </div>
    </div>
  )

  if (!detail || !returns) return <Loader />

  const walletBal = detail.wallet?.balance || 0

  // Money Trail — transaction-based (always balanced regardless of plot status)
  const trail = {
    cashInvested:     returns.cashInvested,
    profitEarned:     returns.profitCredits,
    adjustments:      returns.adjustments,
    totalIn:          returns.trailTotalIn,
    activelyInvested: Math.max(0, returns.activeFunds),
    reinvestedAmount: returns.reinvested,
    withdrawn:        returns.withdrawals,
    walletBalance:    walletBal,
    totalOut:         returns.trailTotalOut
  }

  const txCols = [
    { key: 'createdAt', label: 'Date', render: r => <span style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>{fd(r.createdAt)}</span> },
    { key: 'type', label: 'Type', render: r => <TxTypeBadge type={r.type} /> },
    { key: 'amount', label: 'Amount', render: r => <span className={Number(r.amount) >= 0 ? 'amt-green' : 'amt-red'}>{fc(r.amount)}</span> },
    { key: 'description', label: 'Note', render: r => <span style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>{r.description}</span> }
  ]

  const plotCols = [
    { key: 'plotName', label: 'Plot', render: r => <span style={{ fontWeight: 600 }}>{r.plotName}</span> },
    { key: 'plotStatus', label: 'Status', render: r => <StatusBadge status={r.plotStatus} /> },
    { key: 'commitment', label: 'My Commitment', render: r => fc(r.commitment) },
    { key: 'isReinvestment', label: 'Source', render: r => isTruthy(r.isReinvestment) ? <Badge text="Reinvested" type="reinvest" /> : <Badge text="Cash" type="cash" /> },
    { key: 'sharePercent', label: 'Share %', render: r => fp(r.sharePercent) },
    { key: 'profitLossShare', label: 'My P&L', render: r => <span className={r.profitLossShare >= 0 ? 'amt-green' : 'amt-red'}>{fc(r.profitLossShare)}</span> },
    { key: 'totalReceived', label: 'Received', render: r => <span className="amt-gold">{fc(r.totalReceived)}</span> }
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">My Portfolio</div>
          <div className="page-sub">{detail.name}</div>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="Wallet Balance" value={fc(walletBal)} accent="var(--gold)" icon="👛" />
        <StatCard label="Cash Invested" value={fc(returns.cashInvested)} sub="My own money" accent="var(--blue)" icon="💵" />
        <StatCard label="Total Profit" value={fc(returns.totalPLShare)} accent="var(--green)" icon="📈" />
        <StatCard label="Net ROI" value={returns.cashInvested > 0 ? `${((returns.totalPLShare / returns.cashInvested) * 100).toFixed(1)}%` : '—'} sub="On cash invested" accent="var(--purple)" icon="🎯" />
      </div>

      <div className="tabs">
        {[['trail', 'Money Trail'], ['plots', 'My Investments'], ['transactions', 'Transactions']].map(([k, l]) => (
          <button key={k} className={`tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'trail' && <MoneyTrail data={trail} />}
      {tab === 'plots' && <DataTable cols={plotCols} rows={returns.plotBreakdowns} emptyMsg="No investments yet" emptyIcon="📊" />}
      {tab === 'transactions' && <DataTable cols={txCols} rows={detail.transactions} emptyMsg="No transactions" emptyIcon="📋" />}
    </div>
  )
}
