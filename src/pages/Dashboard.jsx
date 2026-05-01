import React, { useEffect, useState } from "react";
import { API, formatCurrency, formatDate } from "../config";
import { StatCard, Card, Table, Badge, Loader } from "../components/UI";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get("getDashboard").then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <Loader />;

  const txnCols = [
    { key:"createdAt", label:"Date", render: r => formatDate(r.createdAt) },
    { key:"investorId", label:"Investor" },
    { key:"type", label:"Type", render: r => {
      const colors = {
        PROFIT_DISTRIBUTION: "#4ade80", LOSS_DISTRIBUTION: "#f87171",
        WITHDRAWAL: "#fb923c", ADJUSTMENT: "#a78bfa", REINVESTMENT: "#38bdf8"
      };
      return <span style={{ color: colors[r.type]||"#94a3b8", fontWeight:600, fontSize:"0.78rem" }}>{r.type.replace(/_/g," ")}</span>;
    }},
    { key:"amount", label:"Amount", render: r => (
      <span style={{ color: Number(r.amount)>=0?"#4ade80":"#f87171", fontWeight:600 }}>{formatCurrency(r.amount)}</span>
    )},
    { key:"description", label:"Note" }
  ];

  const plotCols = [
    { key:"plotName", label:"Plot" },
    { key:"status", label:"Status", render: r => {
      const map={Active:"active",Sold:"sold","Partially Sold":"partial","On Hold":"hold"};
      return <Badge text={r.status} type={map[r.status]||"default"} />;
    }},
    { key:"totalCost", label:"Cost", render: r => formatCurrency(r.totalCost) },
    { key:"totalRevenue", label:"Revenue", render: r => formatCurrency(r.totalRevenue) },
    { key:"totalPL", label:"P&L", render: r => (
      <span style={{ color: Number(r.totalPL)>=0?"#4ade80":"#f87171", fontWeight:700 }}>{formatCurrency(r.totalPL)}</span>
    )}
  ];

  return (
    <div className="page">
      <div className="page-header">
        <h2>Overview</h2>
        <span className="page-sub">Real-time portfolio snapshot</span>
      </div>

      <div className="stats-grid">
        <StatCard label="Total Capital Deployed"    value={formatCurrency(data.totalDeployed)}    accent="#f59e0b" icon="🏗" sub="Across all plots" />
        <StatCard label="Total Active Funds"        value={formatCurrency(data.totalActiveFunds)} accent="#38bdf8" icon="🔒" sub="Locked in active plots" />
        <StatCard label="Funds in Investor Wallets" value={formatCurrency(data.totalInWallets)}   accent="#a78bfa" icon="👛" sub="Available to withdraw" />
        <StatCard label="Total Net Revenue"         value={formatCurrency(data.totalRevenue)}     accent="#4ade80" icon="💰" />
        <StatCard label="Net P&L (All Sales)"       value={formatCurrency(data.totalPL)}
          accent={data.totalPL>=0?"#4ade80":"#f87171"} sub={data.totalPL>=0?"Profitable":"Loss"} icon={data.totalPL>=0?"📈":"📉"} />
        <StatCard label="Active Plots"              value={data.activePlots}
          sub={`${data.soldPlots} sold · ${data.totalPlots} total`} accent="#fb923c" icon="📍" />
        <StatCard label="Total Investors"           value={data.totalInvestors||0}               accent="#e879f9" icon="👥" />
      </div>

      {/* Profit Share Summary per Plot */}
      {data.plotSummaries?.length > 0 && (
        <div style={{ marginTop:32 }}>
          <h3 style={{ marginBottom:16 }}>Profit / Loss by Plot</h3>
          <Card>
            <Table cols={plotCols} rows={data.plotSummaries} emptyMsg="No completed sales yet" />
          </Card>
        </div>
      )}

      <div style={{ marginTop:32 }}>
        <h3 style={{ marginBottom:16 }}>Recent Transactions</h3>
        <Card>
          <Table cols={txnCols} rows={data.recentTransactions} emptyMsg="No transactions yet" />
        </Card>
      </div>
    </div>
  );
}
