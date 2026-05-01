import React, { useEffect, useState } from "react";
import { API, formatCurrency, formatDate, formatPercent } from "../config";
import { StatCard, Card, Table, Loader } from "../components/UI";
import { useAuth } from "../context/AuthContext";

export default function MyPortfolio() {
  const { user } = useAuth();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.investorId) {
      API.get("getInvestorDetail", { investorId: user.investorId })
        .then(d => { setDetail(d); setLoading(false); });
    } else {
      setLoading(false);
    }
  }, [user]);

  if (loading) return <Loader />;
  if (!user?.investorId) return <div className="page"><p style={{ color: "#64748b" }}>No investor profile linked to this account.</p></div>;

  const totalROI = detail?.transactions?.filter(t => t.type === "PROFIT_DISTRIBUTION").reduce((s, t) => s + Number(t.amount), 0) || 0;

  const txnCols = [
    { key: "createdAt", label: "Date", render: r => formatDate(r.createdAt) },
    { key: "type", label: "Type" },
    { key: "amount", label: "Amount", render: r => (
      <span style={{ color: Number(r.amount) >= 0 ? "#4ade80" : "#f87171", fontWeight: 600 }}>
        {formatCurrency(r.amount)}
      </span>
    )},
    { key: "description", label: "Description" }
  ];

  const cmmCols = [
    { key: "plotId", label: "Plot ID" },
    { key: "amount", label: "Committed", render: r => formatCurrency(r.amount) },
    { key: "sharePercent", label: "Ownership", render: r => formatPercent(r.sharePercent) },
    { key: "createdAt", label: "Since", render: r => formatDate(r.createdAt) }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>My Portfolio</h2>
          <span className="page-sub">{detail?.name}</span>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="Wallet Balance" value={formatCurrency(detail?.wallet?.balance)} accent="#f59e0b" icon="👛" />
        <StatCard label="Total Invested" value={formatCurrency(detail?.totalInvested)} accent="#a78bfa" icon="💼" />
        <StatCard label="Total Profit Received" value={formatCurrency(totalROI)} accent="#4ade80" icon="📈" />
        <StatCard label="Active Positions" value={detail?.commitments?.length || 0} accent="#38bdf8" icon="📍" />
      </div>

      <div style={{ marginTop: 32 }}>
        <h3 style={{ marginBottom: 16 }}>My Investments</h3>
        <Card><Table cols={cmmCols} rows={detail?.commitments} emptyMsg="No active investments" /></Card>
      </div>

      <div style={{ marginTop: 32 }}>
        <h3 style={{ marginBottom: 16 }}>Transaction History</h3>
        <Card><Table cols={txnCols} rows={detail?.transactions} emptyMsg="No transactions yet" /></Card>
      </div>
    </div>
  );
}
