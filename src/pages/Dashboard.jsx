import React, { useEffect, useState } from 'react'
import { API, fc, fd } from '../config'
import { StatCard, DataTable, StatusBadge, TxTypeBadge, Loader } from '../components/UI'

export default function Dashboard() {
  const [data, setData] = useState(null)

  useEffect(() => { API.get('getDashboard').then(setData).catch(console.error) }, [])

  if (!data) return <Loader />

  const txCols = [
    { key: 'createdAt', label: 'Date', render: r => <span style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>{fd(r.createdAt)}</span> },
    { key: 'investorName', label: 'Investor' },
    { key: 'type', label: 'Type', render: r => <TxTypeBadge type={r.type} /> },
    { key: 'amount', label: 'Amount', render: r => (
      <span className={Number(r.amount) >= 0 ? 'amt-green' : 'amt-red'}>{fc(r.amount)}</span>
    )},
    { key: 'description', label: 'Note', render: r => <span style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>{r.description}</span> }
  ]

  const plotCols = [
    { key: 'plotName', label: 'Plot' },
    { key: 'status', label: 'Status', render: r => <StatusBadge status={r.status} /> },
    { key: 'totalCost', label: 'Cost', render: r => fc(r.totalCost) },
    { key: 'totalRevenue', label: 'Revenue', render: r => fc(r.totalRevenue) },
    { key: 'totalPL', label: 'P&L', render: r => (
      <span className={Number(r.totalPL) >= 0 ? 'amt-green' : 'amt-red'}>{fc(r.totalPL)}</span>
    )}
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Portfolio overview</div>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard icon="🏗" label="Total Deployed" value={fc(data.totalDeployed)} sub="All plots ever" accent="var(--gold)" />
        <StatCard icon="🔒" label="Active Funds" value={fc(data.totalActiveFunds)} sub="Locked in active plots" accent="var(--blue)" />
        <StatCard icon="👛" label="In Wallets" value={fc(data.totalInWallets)} sub="Available to investors" accent="var(--purple)" />
        <StatCard icon="📈" label="Total P&L" value={fc(data.totalPL)}
          sub={data.totalPL >= 0 ? 'Overall profit' : 'Overall loss'}
          accent={data.totalPL >= 0 ? 'var(--green)' : 'var(--red)'} />
        <StatCard icon="📍" label="Active Plots" value={data.activePlots} sub={`${data.soldPlots} sold · ${data.totalPlots} total`} accent="var(--gold)" />
        <StatCard icon="👥" label="Investors" value={data.totalInvestors || 0} accent="var(--purple)" />
      </div>

      {data.plotSummaries?.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-head"><span className="section-title">Profit / Loss by Plot</span></div>
          <DataTable cols={plotCols} rows={data.plotSummaries} emptyIcon="📊" />
        </div>
      )}

      <div className="section-head"><span className="section-title">Recent Activity</span></div>
      <DataTable cols={txCols} rows={data.recentTransactions} emptyMsg="No transactions yet" emptyIcon="📋" />
    </div>
  )
}
