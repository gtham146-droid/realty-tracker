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
    { key: "createdAt", label: "Date", render: r => formatDate(r.createdAt) },
    { key: "investorId", label: "Investor" },
    { key: "type", label: "Type", render: r => (
      <Badge
        text={r.type.replace(/_/g, " ")}
        type={r.type.includes("PROFIT") ? "profit" : r.type.includes("LOSS") ? "loss" : "default"}
      />
    )},
    { key: "amount", label: "Amount", render: r => (
      <span style={{ color: Number(r.amount) >= 0 ? "#4ade80" : "#f87171", fontWeight: 600 }}>
        {formatCurrency(r.amount)}
      </span>
    )},
    { key: "description", label: "Note" }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <h2>Overview</h2>
        <span className="page-sub">Real-time portfolio snapshot</span>
      </div>

      <div className="stats-grid">
        <StatCard
          label="Total Capital Deployed"
          value={formatCurrency(data.totalDeployed)}
          accent="#f59e0b"
          icon="🏗"
        />
        <StatCard
          label="Total Net Revenue"
          value={formatCurrency(data.totalRevenue)}
          accent="#a78bfa"
          icon="💰"
        />
        <StatCard
          label="Net P&L (All Sales)"
          value={formatCurrency(data.totalPL)}
          accent={data.totalPL >= 0 ? "#4ade80" : "#f87171"}
          sub={data.totalPL >= 0 ? "Profitable" : "Loss"}
          icon={data.totalPL >= 0 ? "📈" : "📉"}
        />
        <StatCard
          label="Funds in Investor Wallets"
          value={formatCurrency(data.totalInWallets)}
          accent="#38bdf8"
          icon="👛"
        />
        <StatCard
          label="Active Plots"
          value={data.activePlots}
          sub={`${data.soldPlots} sold · ${data.totalPlots} total`}
          accent="#fb923c"
          icon="📍"
        />
      </div>

      <div style={{ marginTop: 32 }}>
        <h3 style={{ marginBottom: 16 }}>Recent Transactions</h3>
        <Card>
          <Table
            cols={txnCols}
            rows={data.recentTransactions}
            emptyMsg="No transactions yet"
          />
        </Card>
      </div>
    </div>
  );
}
