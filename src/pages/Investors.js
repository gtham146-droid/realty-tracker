import React, { useEffect, useState, useCallback } from "react";
import { API, formatCurrency, formatDate, formatPercent } from "../config";
import { Card, Table, Modal, Button, Field, Input, Loader, StatCard, Badge } from "../components/UI";
import { useAuth } from "../context/AuthContext";

function ConfirmModal({ message, onConfirm, onClose }) {
  return (
    <Modal title="Confirm Delete" onClose={onClose}>
      <p style={{ marginBottom:20, color:"#cbd5e1" }}>{message}</p>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button style={{ background:"#dc2626" }} onClick={onConfirm}>Yes, Delete</Button>
      </div>
    </Modal>
  );
}

function ActionBtns({ onEdit, onDelete }) {
  return (
    <div style={{ display:"flex", gap:6 }} onClick={e => e.stopPropagation()}>
      <button onClick={onEdit}   style={{ background:"#1e3a5f", border:"1px solid #2a4a7f", color:"#60a5fa", borderRadius:4, padding:"3px 10px", cursor:"pointer", fontSize:"0.78rem" }}>Edit</button>
      <button onClick={onDelete} style={{ background:"#3b1111", border:"1px solid #7f2a2a", color:"#f87171", borderRadius:4, padding:"3px 10px", cursor:"pointer", fontSize:"0.78rem" }}>Delete</button>
    </div>
  );
}

// ── Add/Edit Investor Modal ───────────────────────────────────
function InvestorModal({ existing, onClose, onDone }) {
  const isEdit = !!existing;
  const [f, setF] = useState(existing || { name:"", email:"", phone:"", panNumber:"", bankName:"", accountNumber:"", ifscCode:"", password:"" });
  const [loading, setLoading] = useState(false);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    setLoading(true);
    const res = await API.post(isEdit ? "editInvestor" : "addInvestor", f);
    setLoading(false);
    if (res.success) { onDone(); onClose(); } else alert(res.error);
  };

  return (
    <Modal title={isEdit ? "Edit Investor" : "Add New Investor"} onClose={onClose} wide>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Field label="Full Name" required><Input value={f.name} onChange={set("name")} /></Field>
        <Field label="Email" required><Input type="email" value={f.email} onChange={set("email")} /></Field>
        <Field label="Phone"><Input value={f.phone||""} onChange={set("phone")} /></Field>
        <Field label="PAN Number"><Input value={f.panNumber||""} onChange={set("panNumber")} /></Field>
      </div>
      <div style={{ margin:"16px 0 8px", fontWeight:600, color:"#64748b", fontSize:"0.8rem", textTransform:"uppercase", letterSpacing:"0.05em" }}>Bank Details</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Field label="Bank Name"><Input value={f.bankName||""} onChange={set("bankName")} /></Field>
        <Field label="IFSC Code"><Input value={f.ifscCode||""} onChange={set("ifscCode")} /></Field>
        <Field label="Account Number"><Input value={f.accountNumber||""} onChange={set("accountNumber")} /></Field>
        {!isEdit && <Field label="Login Password" hint="For investor portal"><Input type="password" value={f.password||""} onChange={set("password")} placeholder="Leave blank to skip" /></Field>}
      </div>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:16 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={submit}>{isEdit ? "Save Changes" : "Add Investor"}</Button>
      </div>
    </Modal>
  );
}

// ── Wallet Adjustment Modal ───────────────────────────────────
function WalletAdjustModal({ investor, onClose, onDone }) {
  const [f, setF] = useState({ adjustmentAmount:"", reason:"" });
  const [loading, setLoading] = useState(false);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    if (!f.adjustmentAmount || !f.reason.trim()) { alert("Amount and reason are required"); return; }
    setLoading(true);
    const res = await API.post("adjustWallet", { investorId: investor.investorId, adjustmentAmount: f.adjustmentAmount, reason: f.reason });
    setLoading(false);
    if (res.success) { onDone(); onClose(); } else alert(res.error);
  };

  const newBal = (Number(investor.walletBalance) + Number(f.adjustmentAmount||0));

  return (
    <Modal title="Manual Wallet Adjustment" onClose={onClose}>
      <div style={{ background:"#0f172a", borderRadius:8, padding:12, marginBottom:16 }}>
        <div style={{ fontSize:"0.8rem", color:"#64748b" }}>Current Balance</div>
        <div style={{ fontSize:"1.4rem", fontWeight:700, color:"#f59e0b" }}>{formatCurrency(investor.walletBalance)}</div>
      </div>
      <Field label="Adjustment Amount (₹)" hint="Use negative to deduct, positive to add" required>
        <Input type="number" value={f.adjustmentAmount} onChange={set("adjustmentAmount")} placeholder="e.g. 5000 or -2000" />
      </Field>
      {f.adjustmentAmount && (
        <div style={{ background:"#0f172a", borderRadius:8, padding:10, marginBottom:12, fontSize:"0.85rem" }}>
          New balance: <strong style={{ color: newBal>=0?"#4ade80":"#f87171" }}>{formatCurrency(newBal)}</strong>
        </div>
      )}
      <Field label="Reason / Note" required>
        <Input value={f.reason} onChange={set("reason")} placeholder="e.g. Correction for double entry on plot X" />
      </Field>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:16 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={submit}>Apply Adjustment</Button>
      </div>
    </Modal>
  );
}

// ── Wallet Action Modal (withdraw / reinvest) ─────────────────
function WalletModal({ investor, action, onClose, onDone }) {
  const [plots, setPlots] = useState([]);
  const [f, setF] = useState({ amount:"", plotId:"", notes:"" });
  const [loading, setLoading] = useState(false);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  useEffect(() => { if (action==="reinvest") API.get("getPlots").then(d => setPlots(Array.isArray(d)?d.filter(p=>p.status==="Active"):[])); }, [action]);

  const submit = async () => {
    setLoading(true);
    const res = await API.post(action==="withdraw"?"processWithdrawal":"reinvest", { ...f, investorId: investor.investorId });
    setLoading(false);
    if (res.success) { onDone(); onClose(); } else alert(res.error);
  };

  return (
    <Modal title={action==="withdraw"?"Process Withdrawal":"Reinvest Funds"} onClose={onClose}>
      <div style={{ background:"#0f172a", borderRadius:8, padding:12, marginBottom:16 }}>
        <div style={{ fontSize:"0.8rem", color:"#64748b" }}>Wallet Balance</div>
        <div style={{ fontSize:"1.4rem", fontWeight:700, color:"#f59e0b" }}>{formatCurrency(investor.walletBalance)}</div>
      </div>
      <Field label="Amount (₹)" required><Input type="number" value={f.amount} onChange={set("amount")} max={investor.walletBalance} /></Field>
      {action==="reinvest" && (
        <Field label="Target Plot" required>
          <select className="input" value={f.plotId} onChange={set("plotId")}>
            <option value="">Select active plot...</option>
            {plots.map(p=><option key={p.plotId} value={p.plotId}>{p.name} — {p.location}</option>)}
          </select>
        </Field>
      )}
      <Field label="Notes"><Input value={f.notes} onChange={set("notes")} /></Field>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:16 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={submit}>{action==="withdraw"?"Process Withdrawal":"Reinvest"}</Button>
      </div>
    </Modal>
  );
}

// ── Returns Breakdown Panel ───────────────────────────────────
function ReturnsPanel({ investorId }) {
  const [data, setData] = useState(null);
  useEffect(() => { API.get("getInvestorReturns", { investorId }).then(setData); }, [investorId]);
  if (!data) return <div style={{ padding:"20px 0", color:"#64748b" }}>Loading returns...</div>;

  const cols = [
    { key:"plotName", label:"Plot" },
    { key:"plotStatus", label:"Status", render: r => {
      const map={Active:"active",Sold:"sold","Partially Sold":"partial","On Hold":"hold"};
      return <Badge text={r.plotStatus} type={map[r.plotStatus]||"default"} />;
    }},
    { key:"commitment", label:"Committed", render: r => formatCurrency(r.commitment) },
    { key:"isReinvestment", label:"Source", render: r => (
      <span style={{ fontSize:"0.75rem", color: r.isReinvestment?"#a78bfa":"#38bdf8", fontWeight:600 }}>
        {r.isReinvestment ? "Reinvested" : "Cash"}
      </span>
    )},
    { key:"sharePercent", label:"Share %", render: r => formatPercent(r.sharePercent) },
    { key:"profitLossShare", label:"P&L Share", render: r => (
      <span style={{ color: r.profitLossShare>=0?"#4ade80":"#f87171", fontWeight:700 }}>{formatCurrency(r.profitLossShare)}</span>
    )},
    { key:"totalReceived", label:"Total Received", render: r => (
      <span style={{ color:"#f59e0b", fontWeight:700 }}>{formatCurrency(r.totalReceived)}</span>
    )},
    { key:"salesCount", label:"Sales" }
  ];

  return (
    <div>
      {/* Summary cards */}
      <div className="stats-grid" style={{ gridTemplateColumns:"repeat(3,1fr)", marginBottom:16 }}>
        <StatCard label="Cash from Pocket" value={formatCurrency(data.cashInvested)} accent="#38bdf8"
          sub="Actual money invested" />
        <StatCard label="Reinvested from Returns" value={formatCurrency(data.reinvested)} accent="#a78bfa"
          sub="Profits put back in" />
        <StatCard label="Total P&L Share" value={formatCurrency(data.totalPLShare)}
          accent={data.totalPLShare>=0?"#4ade80":"#f87171"}
          sub={data.totalPLShare>=0?"Overall profit":"Overall loss"} />
      </div>
      <div className="stats-grid" style={{ gridTemplateColumns:"repeat(3,1fr)", marginBottom:20 }}>
        <StatCard label="Total Received (incl. principal)" value={formatCurrency(data.totalReturns)} accent="#f59e0b" />
        <StatCard label="Total Withdrawn" value={formatCurrency(data.withdrawals)} accent="#fb923c" />
        <StatCard label="Net ROI" value={data.cashInvested>0 ? `${((data.totalPLShare/data.cashInvested)*100).toFixed(1)}%` : "—"}
          accent="#e879f9" sub="On cash invested" />
      </div>
      <Table cols={cols} rows={data.plotBreakdowns} emptyMsg="No investments yet" />
    </div>
  );
}

// ── Investor Detail ───────────────────────────────────────────
function InvestorDetail({ investorId, onClose, onRefresh }) {
  const [detail, setDetail]     = useState(null);
  const [modal, setModal]       = useState(null);
  const [confirm, setConfirm]   = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const { isAdmin } = useAuth();

  const load = useCallback(() => { API.get("getInvestorDetail", { investorId }).then(setDetail); }, [investorId]);
  useEffect(() => { load(); }, [load]);
  if (!detail) return <Loader />;

  const txnCols = [
    { key:"createdAt", label:"Date", render: r => formatDate(r.createdAt) },
    { key:"type", label:"Type", render: r => {
      const colors={PROFIT_DISTRIBUTION:"#4ade80",LOSS_DISTRIBUTION:"#f87171",WITHDRAWAL:"#fb923c",ADJUSTMENT:"#a78bfa",REINVESTMENT:"#38bdf8"};
      return <span style={{ color:colors[r.type]||"#94a3b8", fontWeight:600, fontSize:"0.78rem" }}>{r.type.replace(/_/g," ")}</span>;
    }},
    { key:"amount", label:"Amount", render: r => (
      <span style={{ color:Number(r.amount)>=0?"#4ade80":"#f87171", fontWeight:600 }}>{formatCurrency(r.amount)}</span>
    )},
    { key:"description", label:"Description" }
  ];

  const tabs = ["overview","returns","transactions"];

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div>
          <h2>{detail.name}</h2>
          <span style={{ color:"#64748b" }}>{detail.email} · {detail.phone}</span>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          {isAdmin && <Button onClick={() => setModal("edit")}>Edit</Button>}
          {isAdmin && (
            <Button style={{ background:"#3b1111", border:"1px solid #7f2a2a", color:"#f87171" }}
              onClick={() => setConfirm({
                message: `Delete investor "${detail.name}"? This removes their wallet, commitments and transaction history.`,
                onConfirm: async () => { setConfirm(null); const res = await API.post("deleteInvestor",{investorId}); if(res.success){onClose();onRefresh();}else alert(res.error); }
              })}>Delete</Button>
          )}
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
      </div>

      {/* Top stat row */}
      <div className="stats-grid" style={{ gridTemplateColumns:"repeat(4,1fr)", marginBottom:20 }}>
        <StatCard label="Wallet Balance"         value={formatCurrency(detail.wallet?.balance)}  accent="#f59e0b" />
        <StatCard label="Cash from Pocket"       value={formatCurrency(detail.cashInvested)}     accent="#38bdf8" sub="Own money invested" />
        <StatCard label="Reinvested from Returns"value={formatCurrency(detail.reinvested)}       accent="#a78bfa" sub="Profits put back in" />
        <StatCard label="Total Committed"        value={formatCurrency(detail.totalCommitted)}   accent="#fb923c" sub="Cash + reinvested" />
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:20, borderBottom:"1px solid var(--border)", paddingBottom:0 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            background:"none", border:"none", cursor:"pointer", padding:"8px 16px",
            color: activeTab===t ? "var(--gold)" : "#64748b",
            borderBottom: activeTab===t ? "2px solid var(--gold)" : "2px solid transparent",
            fontWeight:600, fontSize:"0.85rem", textTransform:"capitalize", transition:"all 0.15s"
          }}>{t}</button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div>
          {isAdmin && (
            <div style={{ display:"flex", gap:10, marginBottom:20 }}>
              <Button onClick={() => setModal("withdraw")}>💸 Withdraw</Button>
              <Button variant="accent" onClick={() => setModal("reinvest")}>🔄 Reinvest</Button>
              <Button variant="ghost" onClick={() => setModal("adjust")}>⚖️ Adjust Wallet</Button>
            </div>
          )}
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, padding:16 }}>
            <div style={{ fontSize:"0.8rem", color:"#64748b", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>KYC & Bank Details</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px 24px", fontSize:"0.85rem" }}>
              {[["PAN",detail.panNumber],["Bank",detail.bankName],["Account",detail.accountNumber],["IFSC",detail.ifscCode]].map(([l,v])=>(
                <div key={l}><span style={{ color:"#64748b" }}>{l}: </span><span style={{ color:"#e2e8f0" }}>{v||"—"}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "returns" && <ReturnsPanel investorId={investorId} />}

      {activeTab === "transactions" && (
        <Table cols={txnCols} rows={detail.transactions} emptyMsg="No transactions yet" />
      )}

      {modal==="edit"     && <InvestorModal existing={detail} onClose={()=>setModal(null)} onDone={()=>{load();onRefresh();}} />}
      {modal==="withdraw" && <WalletModal investor={{...detail,walletBalance:detail.wallet?.balance||0}} action="withdraw" onClose={()=>setModal(null)} onDone={load} />}
      {modal==="reinvest" && <WalletModal investor={{...detail,walletBalance:detail.wallet?.balance||0}} action="reinvest" onClose={()=>setModal(null)} onDone={load} />}
      {modal==="adjust"   && <WalletAdjustModal investor={{...detail,walletBalance:detail.wallet?.balance||0}} onClose={()=>setModal(null)} onDone={load} />}
      {confirm && <ConfirmModal message={confirm.message} onConfirm={confirm.onConfirm} onClose={()=>setConfirm(null)} />}
    </div>
  );
}

// ── Main Investors Page ───────────────────────────────────────
export default function Investors() {
  const [investors, setInvestors] = useState([]);
  const [selected, setSelected]   = useState(null);
  const [showAdd, setShowAdd]     = useState(false);
  const [loading, setLoading]     = useState(true);
  const { isAdmin } = useAuth();

  const load = useCallback(() => {
    setLoading(true);
    API.get("getInvestors").then(d => { setInvestors(Array.isArray(d)?d:[]); setLoading(false); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const cols = [
    { key:"name", label:"Name" },
    { key:"email", label:"Email" },
    { key:"cashInvested", label:"Cash Invested", render: r => (
      <span title="Actual money from investor's own pocket">{formatCurrency(r.cashInvested)}</span>
    )},
    { key:"reinvested", label:"Reinvested", render: r => (
      <span style={{ color:"#a78bfa" }} title="Profits reinvested back">{formatCurrency(r.reinvested)}</span>
    )},
    { key:"totalReturns", label:"Returns Received", render: r => (
      <span style={{ color:"#4ade80" }}>{formatCurrency(r.totalReturns)}</span>
    )},
    { key:"walletBalance", label:"Wallet", render: r => (
      <span style={{ color:"#f59e0b", fontWeight:600 }}>{formatCurrency(r.walletBalance)}</span>
    )},
    { key:"createdAt", label:"Joined", render: r => formatDate(r.createdAt) }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div><h2>Investors</h2><span className="page-sub">{investors.length} registered</span></div>
        {isAdmin && <Button onClick={() => setShowAdd(true)}>+ Add Investor</Button>}
      </div>

      {loading ? <Loader /> : (
        selected ? (
          <InvestorDetail investorId={selected} onClose={() => setSelected(null)} onRefresh={load} />
        ) : (
          <Card>
            <Table cols={cols} rows={investors} onRowClick={r=>setSelected(r.investorId)} emptyMsg="No investors yet." />
          </Card>
        )
      )}

      {showAdd && <InvestorModal onClose={() => setShowAdd(false)} onDone={load} />}
    </div>
  );
}
