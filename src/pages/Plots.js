import React, { useEffect, useState, useCallback } from "react";
import { API, formatCurrency, formatDate, EXPENSE_CATEGORIES, PLOT_STATUSES, formatPercent } from "../config";
import {
  Card, Table, Badge, Modal, Button, Field, Input, Select, Textarea,
  StatCard, ProgressBar, Loader, useConfirm
} from "../components/UI";
import { useAuth } from "../context/AuthContext";

// ── Status badge helper ───────────────────────────────────────
function statusBadge(s) {
  const map = { Active: "active", Sold: "sold", "Partially Sold": "partial", "On Hold": "hold" };
  return <Badge text={s} type={map[s] || "default"} />;
}

// ── Add Plot Modal ────────────────────────────────────────────
function AddPlotModal({ onClose, onAdded }) {
  const [f, setF] = useState({ name: "", location: "", sizeSqft: "", askingPrice: "", expectedTimeline: "", notes: "" });
  const [loading, setLoading] = useState(false);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    setLoading(true);
    const res = await API.post("addPlot", f);
    setLoading(false);
    if (res.success) { onAdded(); onClose(); }
    else alert(res.error);
  };

  return (
    <Modal title="Add New Plot Project" onClose={onClose}>
      <Field label="Plot Name / Title" required><Input value={f.name} onChange={set("name")} placeholder="e.g. Tambaram Layout Phase 2" /></Field>
      <Field label="Location" required><Input value={f.location} onChange={set("location")} placeholder="Address or survey number" /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Size (Sq.Ft)" required><Input type="number" value={f.sizeSqft} onChange={set("sizeSqft")} /></Field>
        <Field label="Asking Price (₹)" required><Input type="number" value={f.askingPrice} onChange={set("askingPrice")} /></Field>
      </div>
      <Field label="Expected Timeline"><Input value={f.expectedTimeline} onChange={set("expectedTimeline")} placeholder="e.g. Q2 2025" /></Field>
      <Field label="Notes"><Textarea value={f.notes} onChange={set("notes")} /></Field>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={submit}>Create Plot</Button>
      </div>
    </Modal>
  );
}

// ── Add Expense Modal ─────────────────────────────────────────
function AddExpenseModal({ plotId, onClose, onAdded }) {
  const [f, setF] = useState({ category: EXPENSE_CATEGORIES[0], description: "", amount: "", receiptUrl: "" });
  const [loading, setLoading] = useState(false);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    setLoading(true);
    const res = await API.post("addExpense", { ...f, plotId });
    setLoading(false);
    if (res.success) { onAdded(); onClose(); }
    else alert(res.error);
  };

  return (
    <Modal title="Add Expense" onClose={onClose}>
      <Field label="Category" required>
        <Select value={f.category} onChange={set("category")}>
          {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </Select>
      </Field>
      <Field label="Description"><Input value={f.description} onChange={set("description")} /></Field>
      <Field label="Amount (₹)" required><Input type="number" value={f.amount} onChange={set("amount")} /></Field>
      <Field label="Receipt URL" hint="Google Drive share link to receipt image/PDF">
        <Input value={f.receiptUrl} onChange={set("receiptUrl")} placeholder="https://drive.google.com/..." />
      </Field>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={submit}>Add Expense</Button>
      </div>
    </Modal>
  );
}

// ── Add Commitment Modal ───────────────────────────────────────
function AddCommitmentModal({ plotId, onClose, onAdded }) {
  const [investors, setInvestors] = useState([]);
  const [f, setF] = useState({ investorId: "", amount: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => { API.get("getInvestors").then(d => setInvestors(Array.isArray(d) ? d : [])); }, []);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    setLoading(true);
    const res = await API.post("addCommitment", { ...f, plotId });
    setLoading(false);
    if (res.success) { onAdded(); onClose(); }
    else alert(res.error);
  };

  return (
    <Modal title="Add Investor Commitment" onClose={onClose}>
      <Field label="Investor" required>
        <Select value={f.investorId} onChange={set("investorId")}>
          <option value="">Select investor...</option>
          {investors.map(i => <option key={i.investorId} value={i.investorId}>{i.name}</option>)}
        </Select>
      </Field>
      <Field label="Commitment Amount (₹)" required><Input type="number" value={f.amount} onChange={set("amount")} /></Field>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={submit}>Add Commitment</Button>
      </div>
    </Modal>
  );
}

// ── Record Sale Modal ──────────────────────────────────────────
function RecordSaleModal({ plot, onClose, onAdded }) {
  const [f, setF] = useState({ saleDate: new Date().toISOString().slice(0, 10), sizePortionSqft: plot.sizeSqft, salePrice: "", brokerFee: "0", notes: "" });
  const [loading, setLoading] = useState(false);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    setLoading(true);
    const res = await API.post("recordSale", { ...f, plotId: plot.plotId });
    setLoading(false);
    if (res.success) { onAdded(); onClose(); }
    else alert(res.error);
  };

  const netRevenue = (Number(f.salePrice) - Number(f.brokerFee)).toFixed(0);

  return (
    <Modal title="Record Sale" onClose={onClose} wide>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Sale Date" required><Input type="date" value={f.saleDate} onChange={set("saleDate")} /></Field>
        <Field label="Portion Size Sold (Sq.Ft)" required hint={`Total: ${plot.sizeSqft} sq.ft`}>
          <Input type="number" value={f.sizePortionSqft} onChange={set("sizePortionSqft")} max={plot.sizeSqft} />
        </Field>
        <Field label="Sale Price (₹)" required><Input type="number" value={f.salePrice} onChange={set("salePrice")} /></Field>
        <Field label="Outgoing Broker Fee (₹)"><Input type="number" value={f.brokerFee} onChange={set("brokerFee")} /></Field>
      </div>
      {f.salePrice && (
        <div style={{ background: "#0f172a", borderRadius: 8, padding: 12, marginTop: 8, fontSize: "0.85rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Net Revenue:</span><strong style={{ color: "#f59e0b" }}>₹{Number(netRevenue).toLocaleString("en-IN")}</strong>
          </div>
        </div>
      )}
      <Field label="Notes" style={{ marginTop: 12 }}><Textarea value={f.notes} onChange={set("notes")} /></Field>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={submit}>Record Sale & Distribute</Button>
      </div>
    </Modal>
  );
}

// ── Plot Detail Panel ──────────────────────────────────────────
function PlotDetail({ plotId, onClose, onRefresh }) {
  const [detail, setDetail] = useState(null);
  const [modal, setModal] = useState(null);
  const { isAdmin } = useAuth();

  const load = useCallback(() => {
    API.get("getPlotDetail", { plotId }).then(setDetail);
  }, [plotId]);

  useEffect(() => { load(); }, [load]);

  if (!detail) return <Loader />;

  const expCols = [
    { key: "category", label: "Category" },
    { key: "description", label: "Description" },
    { key: "amount", label: "Amount", render: r => formatCurrency(r.amount) },
    { key: "createdAt", label: "Date", render: r => formatDate(r.createdAt) },
    { key: "receiptUrl", label: "Receipt", render: r => r.receiptUrl ? <a href={r.receiptUrl} target="_blank" rel="noreferrer" style={{ color: "var(--gold)" }}>View</a> : "—" }
  ];

  const cmmCols = [
    { key: "investorName", label: "Investor" },
    { key: "amount", label: "Committed", render: r => formatCurrency(r.amount) },
    { key: "sharePercent", label: "Share %", render: r => formatPercent(r.sharePercent) }
  ];

  const saleCols = [
    { key: "saleDate", label: "Date", render: r => formatDate(r.saleDate) },
    { key: "sizePortionSqft", label: "Size (sq.ft)" },
    { key: "salePrice", label: "Sale Price", render: r => formatCurrency(r.salePrice) },
    { key: "netRevenue", label: "Net Revenue", render: r => formatCurrency(r.netRevenue) },
    { key: "netProfitLoss", label: "P&L", render: r => (
      <span style={{ color: Number(r.netProfitLoss) >= 0 ? "#4ade80" : "#f87171", fontWeight: 700 }}>
        {formatCurrency(r.netProfitLoss)}
      </span>
    )}
  ];

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div>
          <h2>{detail.name}</h2>
          <span style={{ color: "#64748b", fontSize: "0.9rem" }}>{detail.location}</span>
        </div>
        <button className="btn-icon" onClick={onClose}>✕</button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 24 }}>
        <StatCard label="Total Acquisition Cost" value={formatCurrency(detail.totalCost)} accent="#f59e0b" />
        <StatCard label="Total Funded" value={formatCurrency(detail.totalFunded)} accent="#4ade80" />
        <StatCard label="Company Share" value={formatCurrency(detail.companyShare)} accent="#a78bfa" />
      </div>

      <ProgressBar value={detail.totalFunded} max={detail.totalCost} label="Funding Progress" />

      {/* Expenses */}
      <div className="section-head">
        <h3>Expenses Ledger</h3>
        {isAdmin && <Button onClick={() => setModal("expense")}>+ Add Expense</Button>}
      </div>
      <Table cols={expCols} rows={detail.expenses} emptyMsg="No expenses added yet" />

      {/* Commitments */}
      <div className="section-head">
        <h3>Investor Commitments</h3>
        {isAdmin && <Button onClick={() => setModal("commitment")}>+ Add Commitment</Button>}
      </div>
      <Table cols={cmmCols} rows={detail.commitments} emptyMsg="No commitments yet" />

      {/* Sales */}
      <div className="section-head">
        <h3>Sales</h3>
        {isAdmin && <Button variant="accent" onClick={() => setModal("sale")}>Record Sale</Button>}
      </div>
      <Table cols={saleCols} rows={detail.sales} emptyMsg="No sales recorded" />

      {/* Modals */}
      {modal === "expense"    && <AddExpenseModal    plotId={plotId} onClose={() => setModal(null)} onAdded={load} />}
      {modal === "commitment" && <AddCommitmentModal plotId={plotId} onClose={() => setModal(null)} onAdded={load} />}
      {modal === "sale"       && <RecordSaleModal    plot={detail}   onClose={() => setModal(null)} onAdded={() => { load(); onRefresh(); }} />}
    </div>
  );
}

// ── Main Plots Page ────────────────────────────────────────────
export default function Plots() {
  const [plots, setPlots] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();

  const load = useCallback(() => {
    setLoading(true);
    API.get("getPlots").then(d => { setPlots(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const cols = [
    { key: "name", label: "Plot Name" },
    { key: "location", label: "Location" },
    { key: "sizeSqft", label: "Size (sq.ft)" },
    { key: "status", label: "Status", render: r => statusBadge(r.status) },
    { key: "totalCost", label: "Acquisition Cost", render: r => formatCurrency(r.totalCost) },
    { key: "totalFunded", label: "Funded", render: r => formatCurrency(r.totalFunded) },
    { key: "createdAt", label: "Added", render: r => formatDate(r.createdAt) }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Plots</h2>
          <span className="page-sub">{plots.length} project{plots.length !== 1 ? "s" : ""}</span>
        </div>
        {isAdmin && <Button onClick={() => setShowAdd(true)}>+ New Plot</Button>}
      </div>

      {loading ? <Loader /> : (
        selected ? (
          <PlotDetail plotId={selected} onClose={() => setSelected(null)} onRefresh={load} />
        ) : (
          <Card>
            <Table
              cols={cols}
              rows={plots}
              onRowClick={r => setSelected(r.plotId)}
              emptyMsg="No plots yet. Add your first project."
            />
          </Card>
        )
      )}

      {showAdd && <AddPlotModal onClose={() => setShowAdd(false)} onAdded={load} />}
    </div>
  );
}
