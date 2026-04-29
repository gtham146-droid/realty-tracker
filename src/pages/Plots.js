import React, { useEffect, useState, useCallback } from "react";
import { API, formatCurrency, formatDate, EXPENSE_CATEGORIES, formatPercent } from "../config";
import { Card, Table, Badge, Modal, Button, Field, Input, Select, Textarea, StatCard, ProgressBar, Loader } from "../components/UI";
import { useAuth } from "../context/AuthContext";

function statusBadge(s) {
  const map = { Active:"active", Sold:"sold", "Partially Sold":"partial", "On Hold":"hold" };
  return <Badge text={s} type={map[s]||"default"} />;
}

// ── Confirm Delete ────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onClose }) {
  return (
    <Modal title="Confirm Delete" onClose={onClose}>
      <p style={{ marginBottom: 20, color: "#cbd5e1" }}>{message}</p>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button style={{ background:"#dc2626" }} onClick={onConfirm}>Yes, Delete</Button>
      </div>
    </Modal>
  );
}

// ── Add/Edit Plot Modal ───────────────────────────────────────
function PlotModal({ existing, onClose, onDone }) {
  const isEdit = !!existing;
  const [f, setF] = useState(existing || { name:"", location:"", sizeSqft:"", askingPrice:"", expectedTimeline:"", notes:"" });
  const [loading, setLoading] = useState(false);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    setLoading(true);
    const res = await API.post(isEdit ? "editPlot" : "addPlot", f);
    setLoading(false);
    if (res.success) { onDone(); onClose(); } else alert(res.error);
  };

  return (
    <Modal title={isEdit ? "Edit Plot" : "Add New Plot Project"} onClose={onClose}>
      <Field label="Plot Name / Title" required><Input value={f.name} onChange={set("name")} /></Field>
      <Field label="Location" required><Input value={f.location} onChange={set("location")} /></Field>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Field label="Size (Sq.Ft)" required><Input type="number" value={f.sizeSqft} onChange={set("sizeSqft")} /></Field>
        <Field label="Asking Price (₹)" required><Input type="number" value={f.askingPrice} onChange={set("askingPrice")} /></Field>
      </div>
      <Field label="Status">
        <Select value={f.status||"Active"} onChange={set("status")}>
          {["Active","Sold","Partially Sold","On Hold"].map(s => <option key={s}>{s}</option>)}
        </Select>
      </Field>
      <Field label="Expected Timeline"><Input value={f.expectedTimeline||""} onChange={set("expectedTimeline")} /></Field>
      <Field label="Notes"><Textarea value={f.notes||""} onChange={set("notes")} /></Field>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:16 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={submit}>{isEdit ? "Save Changes" : "Create Plot"}</Button>
      </div>
    </Modal>
  );
}

// ── Add/Edit Expense Modal ────────────────────────────────────
function ExpenseModal({ plotId, existing, onClose, onDone }) {
  const isEdit = !!existing;
  const [f, setF] = useState(existing || { category: EXPENSE_CATEGORIES[0], description:"", amount:"", receiptUrl:"" });
  const [loading, setLoading] = useState(false);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    setLoading(true);
    const res = await API.post(isEdit ? "editExpense" : "addExpense", { ...f, plotId });
    setLoading(false);
    if (res.success) { onDone(); onClose(); } else alert(res.error);
  };

  return (
    <Modal title={isEdit ? "Edit Expense" : "Add Expense"} onClose={onClose}>
      <Field label="Category" required>
        <Select value={f.category} onChange={set("category")}>
          {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </Select>
      </Field>
      <Field label="Description"><Input value={f.description||""} onChange={set("description")} /></Field>
      <Field label="Amount (₹)" required><Input type="number" value={f.amount} onChange={set("amount")} /></Field>
      <Field label="Receipt URL"><Input value={f.receiptUrl||""} onChange={set("receiptUrl")} placeholder="https://drive.google.com/..." /></Field>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:16 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={submit}>{isEdit ? "Save Changes" : "Add Expense"}</Button>
      </div>
    </Modal>
  );
}

// ── Add/Edit Commitment Modal ─────────────────────────────────
function CommitmentModal({ plotId, existing, onClose, onDone }) {
  const isEdit = !!existing;
  const [investors, setInvestors] = useState([]);
  const [f, setF] = useState(existing || { investorId:"", amount:"" });
  const [loading, setLoading] = useState(false);
  useEffect(() => { API.get("getInvestors").then(d => setInvestors(Array.isArray(d) ? d : [])); }, []);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    setLoading(true);
    const res = await API.post(isEdit ? "editCommitment" : "addCommitment", { ...f, plotId });
    setLoading(false);
    if (res.success) { onDone(); onClose(); } else alert(res.error);
  };

  return (
    <Modal title={isEdit ? "Edit Commitment" : "Add Commitment"} onClose={onClose}>
      <Field label="Investor" required>
        <Select value={f.investorId} onChange={set("investorId")} disabled={isEdit}>
          <option value="">Select investor...</option>
          {investors.map(i => <option key={i.investorId} value={i.investorId}>{i.name}</option>)}
        </Select>
      </Field>
      <Field label="Amount (₹)" required><Input type="number" value={f.amount} onChange={set("amount")} /></Field>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:16 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={submit}>{isEdit ? "Save Changes" : "Add Commitment"}</Button>
      </div>
    </Modal>
  );
}

// ── Add/Edit Sale Modal ───────────────────────────────────────
function SaleModal({ plot, existing, onClose, onDone }) {
  const isEdit = !!existing;
  const [f, setF] = useState(existing || { saleDate: new Date().toISOString().slice(0,10), sizePortionSqft: plot.sizeSqft, salePrice:"", brokerFee:"0", notes:"" });
  const [loading, setLoading] = useState(false);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const netRevenue = (Number(f.salePrice) - Number(f.brokerFee||0)).toFixed(0);

  const submit = async () => {
    setLoading(true);
    const res = await API.post(isEdit ? "editSale" : "recordSale", { ...f, plotId: plot.plotId });
    setLoading(false);
    if (res.success) { onDone(); onClose(); } else alert(res.error);
  };

  return (
    <Modal title={isEdit ? "Edit Sale" : "Record Sale"} onClose={onClose} wide>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Field label="Sale Date" required><Input type="date" value={f.saleDate} onChange={set("saleDate")} /></Field>
        <Field label="Portion Size (Sq.Ft)" required><Input type="number" value={f.sizePortionSqft} onChange={set("sizePortionSqft")} /></Field>
        <Field label="Sale Price (₹)" required><Input type="number" value={f.salePrice} onChange={set("salePrice")} /></Field>
        <Field label="Broker Fee (₹)"><Input type="number" value={f.brokerFee} onChange={set("brokerFee")} /></Field>
      </div>
      {f.salePrice && (
        <div style={{ background:"#0f172a", borderRadius:8, padding:12, marginTop:8, fontSize:"0.85rem" }}>
          Net Revenue: <strong style={{ color:"#f59e0b" }}>₹{Number(netRevenue).toLocaleString("en-IN")}</strong>
        </div>
      )}
      <Field label="Notes" style={{ marginTop:12 }}><Textarea value={f.notes||""} onChange={set("notes")} /></Field>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:16 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={submit}>{isEdit ? "Save Changes" : "Record Sale & Distribute"}</Button>
      </div>
    </Modal>
  );
}

// ── Action Buttons ────────────────────────────────────────────
function ActionBtns({ onEdit, onDelete }) {
  return (
    <div style={{ display:"flex", gap:6 }} onClick={e => e.stopPropagation()}>
      <button onClick={onEdit} style={{ background:"#1e3a5f", border:"1px solid #2a4a7f", color:"#60a5fa", borderRadius:4, padding:"3px 10px", cursor:"pointer", fontSize:"0.78rem" }}>Edit</button>
      <button onClick={onDelete} style={{ background:"#3b1111", border:"1px solid #7f2a2a", color:"#f87171", borderRadius:4, padding:"3px 10px", cursor:"pointer", fontSize:"0.78rem" }}>Delete</button>
    </div>
  );
}

// ── Plot Detail Panel ─────────────────────────────────────────
function PlotDetail({ plotId, onClose, onRefresh }) {
  const [detail, setDetail] = useState(null);
  const [modal, setModal] = useState(null); // { type, data? }
  const [confirm, setConfirm] = useState(null);
  const { isAdmin } = useAuth();

  const load = useCallback(() => { API.get("getPlotDetail", { plotId }).then(setDetail); }, [plotId]);
  useEffect(() => { load(); }, [load]);
  if (!detail) return <Loader />;

  const handleDelete = async (action, body, msg) => {
    setConfirm({
      message: msg,
      onConfirm: async () => {
        setConfirm(null);
        const res = await API.post(action, body);
        if (res.success) { load(); onRefresh(); } else alert(res.error);
      }
    });
  };

  const expCols = [
    { key:"category", label:"Category" },
    { key:"description", label:"Description" },
    { key:"amount", label:"Amount", render: r => formatCurrency(r.amount) },
    { key:"createdAt", label:"Date", render: r => formatDate(r.createdAt) },
    { key:"receiptUrl", label:"Receipt", render: r => r.receiptUrl ? <a href={r.receiptUrl} target="_blank" rel="noreferrer" style={{ color:"var(--gold)" }}>View</a> : "—" },
    ...(isAdmin ? [{ key:"actions", label:"", render: r => (
      <ActionBtns
        onEdit={() => setModal({ type:"expense", data: r })}
        onDelete={() => handleDelete("deleteExpense", { expenseId: r.expenseId }, `Delete expense "${r.category} - ₹${r.amount}"?`)}
      />
    )}] : [])
  ];

  const cmmCols = [
    { key:"investorName", label:"Investor" },
    { key:"amount", label:"Committed", render: r => formatCurrency(r.amount) },
    { key:"sharePercent", label:"Share %", render: r => formatPercent(r.sharePercent) },
    ...(isAdmin ? [{ key:"actions", label:"", render: r => (
      <ActionBtns
        onEdit={() => setModal({ type:"commitment", data: r })}
        onDelete={() => handleDelete("deleteCommitment", { commitmentId: r.commitmentId, plotId }, `Delete commitment from "${r.investorName}"? This will recalculate all share percentages.`)}
      />
    )}] : [])
  ];

  const saleCols = [
    { key:"saleDate", label:"Date", render: r => formatDate(r.saleDate) },
    { key:"sizePortionSqft", label:"Size (sq.ft)" },
    { key:"salePrice", label:"Sale Price", render: r => formatCurrency(r.salePrice) },
    { key:"netRevenue", label:"Net Revenue", render: r => formatCurrency(r.netRevenue) },
    { key:"netProfitLoss", label:"P&L", render: r => (
      <span style={{ color: Number(r.netProfitLoss)>=0 ? "#4ade80" : "#f87171", fontWeight:700 }}>{formatCurrency(r.netProfitLoss)}</span>
    )},
    ...(isAdmin ? [{ key:"actions", label:"", render: r => (
      <ActionBtns
        onEdit={() => setModal({ type:"sale", data: r })}
        onDelete={() => handleDelete("deleteSale", { saleId: r.saleId }, `Delete this sale record? ⚠️ This will reverse all wallet distributions for this sale.`)}
      />
    )}] : [])
  ];

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div>
          <h2>{detail.name}</h2>
          <span style={{ color:"#64748b", fontSize:"0.9rem" }}>{detail.location}</span>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          {isAdmin && <Button onClick={() => setModal({ type:"plot", data: detail })}>Edit Plot</Button>}
          {isAdmin && <Button style={{ background:"#3b1111", border:"1px solid #7f2a2a", color:"#f87171" }}
            onClick={() => handleDelete("deletePlot", { plotId }, `Delete plot "${detail.name}" and ALL related expenses, commitments and sales?`)}>
            Delete Plot
          </Button>}
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns:"repeat(3,1fr)", marginBottom:24 }}>
        <StatCard label="Total Acquisition Cost" value={formatCurrency(detail.totalCost)} accent="#f59e0b" />
        <StatCard label="Total Funded" value={formatCurrency(detail.totalFunded)} accent="#4ade80" />
        <StatCard label="Company Share" value={formatCurrency(detail.companyShare)} accent="#a78bfa" />
      </div>
      <ProgressBar value={detail.totalFunded} max={detail.totalCost} label="Funding Progress" />

      <div className="section-head">
        <h3>Expenses Ledger</h3>
        {isAdmin && <Button onClick={() => setModal({ type:"expense" })}>+ Add Expense</Button>}
      </div>
      <Table cols={expCols} rows={detail.expenses} emptyMsg="No expenses added yet" />

      <div className="section-head">
        <h3>Investor Commitments</h3>
        {isAdmin && <Button onClick={() => setModal({ type:"commitment" })}>+ Add Commitment</Button>}
      </div>
      <Table cols={cmmCols} rows={detail.commitments} emptyMsg="No commitments yet" />

      <div className="section-head">
        <h3>Sales</h3>
        {isAdmin && <Button variant="accent" onClick={() => setModal({ type:"sale" })}>Record Sale</Button>}
      </div>
      <Table cols={saleCols} rows={detail.sales} emptyMsg="No sales recorded" />

      {/* Modals */}
      {modal?.type === "plot"       && <PlotModal       existing={modal.data} onClose={() => setModal(null)} onDone={() => { load(); onRefresh(); }} />}
      {modal?.type === "expense"    && <ExpenseModal    plotId={plotId} existing={modal.data} onClose={() => setModal(null)} onDone={load} />}
      {modal?.type === "commitment" && <CommitmentModal plotId={plotId} existing={modal.data} onClose={() => setModal(null)} onDone={load} />}
      {modal?.type === "sale"       && <SaleModal       plot={detail} existing={modal.data} onClose={() => setModal(null)} onDone={() => { load(); onRefresh(); }} />}
      {confirm && <ConfirmModal message={confirm.message} onConfirm={confirm.onConfirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

// ── Main Plots Page ───────────────────────────────────────────
export default function Plots() {
  const [plots, setPlots] = useState([]);
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();

  const load = useCallback(() => {
    setLoading(true);
    API.get("getPlots").then(d => { setPlots(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const cols = [
    { key:"name", label:"Plot Name" },
    { key:"location", label:"Location" },
    { key:"sizeSqft", label:"Size (sq.ft)" },
    { key:"status", label:"Status", render: r => statusBadge(r.status) },
    { key:"totalCost", label:"Acquisition Cost", render: r => formatCurrency(r.totalCost) },
    { key:"totalFunded", label:"Funded", render: r => formatCurrency(r.totalFunded) },
    { key:"createdAt", label:"Added", render: r => formatDate(r.createdAt) }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Plots</h2>
          <span className="page-sub">{plots.length} project{plots.length !== 1 ? "s" : ""}</span>
        </div>
        {isAdmin && <Button onClick={() => setModal({ type:"plot" })}>+ New Plot</Button>}
      </div>

      {loading ? <Loader /> : (
        selected ? (
          <PlotDetail plotId={selected} onClose={() => setSelected(null)} onRefresh={load} />
        ) : (
          <Card>
            <Table cols={cols} rows={plots} onRowClick={r => setSelected(r.plotId)} emptyMsg="No plots yet." />
          </Card>
        )
      )}

      {modal?.type === "plot" && <PlotModal onClose={() => setModal(null)} onDone={load} />}
    </div>
  );
}
