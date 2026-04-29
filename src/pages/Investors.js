import React, { useEffect, useState, useCallback } from "react";
import { API, formatCurrency, formatDate, formatPercent } from "../config";
import { Card, Table, Badge, Modal, Button, Field, Input, Loader, StatCard } from "../components/UI";
import { useAuth } from "../context/AuthContext";

// ── Add Investor Modal ────────────────────────────────────────
function AddInvestorModal({ onClose, onAdded }) {
  const [f, setF] = useState({
    name: "", email: "", phone: "", panNumber: "",
    bankName: "", accountNumber: "", ifscCode: "", password: ""
  });
  const [loading, setLoading] = useState(false);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    setLoading(true);
    const res = await API.post("addInvestor", f);
    setLoading(false);
    if (res.success) { onAdded(); onClose(); }
    else alert(res.error);
  };

  return (
    <Modal title="Add New Investor" onClose={onClose} wide>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Full Name" required><Input value={f.name} onChange={set("name")} /></Field>
        <Field label="Email" required><Input type="email" value={f.email} onChange={set("email")} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={set("phone")} /></Field>
        <Field label="PAN Number"><Input value={f.panNumber} onChange={set("panNumber")} placeholder="ABCDE1234F" /></Field>
      </div>
      <div style={{ margin: "16px 0 8px", fontWeight: 600, color: "#64748b", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bank Details</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Bank Name"><Input value={f.bankName} onChange={set("bankName")} /></Field>
        <Field label="IFSC Code"><Input value={f.ifscCode} onChange={set("ifscCode")} /></Field>
        <Field label="Account Number"><Input value={f.accountNumber} onChange={set("accountNumber")} /></Field>
        <Field label="Login Password" hint="For investor portal access">
          <Input type="password" value={f.password} onChange={set("password")} placeholder="Leave blank to skip" />
        </Field>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={submit}>Add Investor</Button>
      </div>
    </Modal>
  );
}

// ── Wallet Action Modal ───────────────────────────────────────
function WalletModal({ investor, action, onClose, onDone }) {
  const [plots, setPlots] = useState([]);
  const [f, setF] = useState({ amount: "", plotId: "", notes: "" });
  const [loading, setLoading] = useState(false);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    if (action === "reinvest") API.get("getPlots").then(d => setPlots(Array.isArray(d) ? d.filter(p => p.status === "Active") : []));
  }, [action]);

  const submit = async () => {
    setLoading(true);
    const endpoint = action === "withdraw" ? "processWithdrawal" : "reinvest";
    const res = await API.post(endpoint, { ...f, investorId: investor.investorId });
    setLoading(false);
    if (res.success) { onDone(); onClose(); }
    else alert(res.error);
  };

  return (
    <Modal title={action === "withdraw" ? "Process Withdrawal" : "Reinvest Funds"} onClose={onClose}>
      <div style={{ background: "#0f172a", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Current Wallet Balance</div>
        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f59e0b" }}>{formatCurrency(investor.walletBalance)}</div>
      </div>
      <Field label={`Amount to ${action === "withdraw" ? "Withdraw" : "Reinvest"} (₹)`} required>
        <Input type="number" value={f.amount} onChange={set("amount")} max={investor.walletBalance} />
      </Field>
      {action === "reinvest" && (
        <Field label="Target Plot" required>
          <select className="input" value={f.plotId} onChange={set("plotId")}>
            <option value="">Select active plot...</option>
            {plots.map(p => <option key={p.plotId} value={p.plotId}>{p.name} — {p.location}</option>)}
          </select>
        </Field>
      )}
      <Field label="Notes"><Input value={f.notes} onChange={set("notes")} /></Field>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={submit}>{action === "withdraw" ? "Process Withdrawal" : "Reinvest"}</Button>
      </div>
    </Modal>
  );
}

// ── Investor Detail Panel ──────────────────────────────────────
function InvestorDetail({ investorId, onClose, onRefresh }) {
  const [detail, setDetail] = useState(null);
  const [walletModal, setWalletModal] = useState(null);
  const { isAdmin } = useAuth();

  const load = useCallback(() => {
    API.get("getInvestorDetail", { investorId }).then(setDetail);
  }, [investorId]);

  useEffect(() => { load(); }, [load]);

  if (!detail) return <Loader />;

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
    { key: "sharePercent", label: "Share %", render: r => formatPercent(r.sharePercent) },
    { key: "createdAt", label: "Date", render: r => formatDate(r.createdAt) }
  ];

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div>
          <h2>{detail.name}</h2>
          <span style={{ color: "#64748b" }}>{detail.email} · {detail.phone}</span>
        </div>
        <button className="btn-icon" onClick={onClose}>✕</button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 24 }}>
        <StatCard label="Wallet Balance" value={formatCurrency(detail.wallet?.balance)} accent="#f59e0b" />
        <StatCard label="Total Invested" value={formatCurrency(detail.totalInvested)} accent="#a78bfa" />
        <StatCard label="Transactions" value={detail.transactions?.length || 0} accent="#38bdf8" />
      </div>

      {isAdmin && (
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <Button onClick={() => setWalletModal("withdraw")}>💸 Process Withdrawal</Button>
          <Button variant="accent" onClick={() => setWalletModal("reinvest")}>🔄 Reinvest Funds</Button>
        </div>
      )}

      <div className="section-head"><h3>Investment Commitments</h3></div>
      <Table cols={cmmCols} rows={detail.commitments} emptyMsg="No commitments yet" />

      <div className="section-head" style={{ marginTop: 24 }}><h3>Transaction History</h3></div>
      <Table cols={txnCols} rows={detail.transactions} emptyMsg="No transactions yet" />

      {walletModal && (
        <WalletModal
          investor={{ ...detail, walletBalance: detail.wallet?.balance || 0 }}
          action={walletModal}
          onClose={() => setWalletModal(null)}
          onDone={() => { load(); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ── Main Investors Page ────────────────────────────────────────
export default function Investors() {
  const [investors, setInvestors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();

  const load = useCallback(() => {
    setLoading(true);
    API.get("getInvestors").then(d => { setInvestors(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const cols = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "totalInvested", label: "Total Invested", render: r => formatCurrency(r.totalInvested) },
    { key: "walletBalance", label: "Wallet Balance", render: r => (
      <span style={{ color: "#f59e0b", fontWeight: 600 }}>{formatCurrency(r.walletBalance)}</span>
    )},
    { key: "createdAt", label: "Joined", render: r => formatDate(r.createdAt) }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Investors</h2>
          <span className="page-sub">{investors.length} registered</span>
        </div>
        {isAdmin && <Button onClick={() => setShowAdd(true)}>+ Add Investor</Button>}
      </div>

      {loading ? <Loader /> : (
        selected ? (
          <InvestorDetail investorId={selected} onClose={() => setSelected(null)} onRefresh={load} />
        ) : (
          <Card>
            <Table
              cols={cols}
              rows={investors}
              onRowClick={r => setSelected(r.investorId)}
              emptyMsg="No investors yet."
            />
          </Card>
        )
      )}

      {showAdd && <AddInvestorModal onClose={() => setShowAdd(false)} onAdded={load} />}
    </div>
  );
}
