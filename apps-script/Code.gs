// ============================================================
// REAL ESTATE INVESTMENT TRACKER - Google Apps Script Backend
// ============================================================
// SETUP: Run setupSheets() once, then Deploy as Web App
// Execute as: Me | Who has access: Anyone
// ============================================================

const SHEETS = {
  PLOTS:        "Plots",
  EXPENSES:     "Expenses",
  INVESTORS:    "Investors",
  COMMITMENTS:  "Commitments",
  SALES:        "Sales",
  WALLET:       "Wallet",
  TRANSACTIONS: "Transactions",
  USERS:        "Users"
};

function response(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    const body   = e.parameter.data ? JSON.parse(e.parameter.data) : {};
    const params = e.parameter;
    switch (action) {
      case "login":             return response(login(params));
      case "getPlots":          return response(getPlots());
      case "getPlotDetail":     return response(getPlotDetail(params.plotId));
      case "getInvestors":      return response(getInvestors());
      case "getInvestorDetail": return response(getInvestorDetail(params.investorId));
      case "getDashboard":      return response(getDashboard());
      case "getWallet":         return response(getWallet(params.investorId));
      case "getTransactions":   return response(getTransactions(params.investorId));
      case "addPlot":           return response(addPlot(body));
      case "addExpense":        return response(addExpense(body));
      case "addInvestor":       return response(addInvestor(body));
      case "addCommitment":     return response(addCommitment(body));
      case "recordSale":        return response(recordSale(body));
      case "processWithdrawal": return response(processWithdrawal(body));
      case "reinvest":          return response(reinvest(body));
      case "updatePlotStatus":  return response(updatePlotStatus(body));
      // ── EDIT actions ──────────────────────────────────────
      case "editPlot":          return response(editRow(SHEETS.PLOTS, "plotId", body));
      case "editExpense":       return response(editRow(SHEETS.EXPENSES, "expenseId", body));
      case "editInvestor":      return response(editInvestor(body));
      case "editCommitment":    return response(editCommitment(body));
      case "editSale":          return response(editSale(body));
      // ── DELETE actions ────────────────────────────────────
      case "deletePlot":        return response(deletePlot(body));
      case "deleteExpense":     return response(deleteRow(SHEETS.EXPENSES, "expenseId", body.expenseId));
      case "deleteCommitment":  return response(deleteCommitment(body));
      case "deleteSale":        return response(deleteSale(body));
      case "deleteInvestor":    return response(deleteInvestor(body));
      default:                  return response({ error: "Unknown action: " + action });
    }
  } catch (err) {
    return response({ error: err.toString() });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    e.parameter = e.parameter || {};
    e.parameter.data = e.postData.contents;
    e.parameter.action = body.action;
    return doGet(e);
  } catch (err) {
    return response({ error: err.toString() });
  }
}

// ── SETUP ─────────────────────────────────────────────────────
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const schema = {
    [SHEETS.USERS]:        ["userId","username","passwordHash","role","investorId","createdAt"],
    [SHEETS.PLOTS]:        ["plotId","name","location","sizeSqft","askingPrice","status","expectedTimeline","notes","createdAt"],
    [SHEETS.EXPENSES]:     ["expenseId","plotId","category","description","amount","receiptUrl","createdAt"],
    [SHEETS.INVESTORS]:    ["investorId","name","email","phone","panNumber","bankName","accountNumber","ifscCode","createdAt"],
    [SHEETS.COMMITMENTS]:  ["commitmentId","plotId","investorId","amount","sharePercent","createdAt"],
    [SHEETS.SALES]:        ["saleId","plotId","saleDate","sizePortionSqft","salePrice","brokerFee","netRevenue","netProfitLoss","notes","createdAt"],
    [SHEETS.WALLET]:       ["walletId","investorId","balance","lastUpdated"],
    [SHEETS.TRANSACTIONS]: ["txId","investorId","plotId","saleId","type","amount","description","createdAt"]
  };
  Object.entries(schema).forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.getRange(1,1,1,headers.length).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
    }
  });
  const usersSheet = ss.getSheetByName(SHEETS.USERS);
  if (usersSheet.getLastRow() <= 1) {
    usersSheet.appendRow(["USR-001","admin",hashPassword("admin123"),"admin","",new Date().toISOString()]);
  }
  SpreadsheetApp.getUi().alert("✅ Setup complete!");
}

// ── AUTH ──────────────────────────────────────────────────────
function login(params) {
  const rows = getRows(getSheet(SHEETS.USERS));
  const user = rows.find(r => r.username === params.username && r.passwordHash === hashPassword(params.password));
  if (!user) return { success: false, message: "Invalid credentials" };
  return { success: true, role: user.role, investorId: user.investorId, username: user.username };
}

function hashPassword(pwd) {
  let hash = 0;
  for (let i = 0; i < pwd.length; i++) { hash = ((hash << 5) - hash) + pwd.charCodeAt(i); hash |= 0; }
  return "H" + Math.abs(hash).toString(36);
}

// ── GENERIC EDIT/DELETE HELPERS ───────────────────────────────
function editRow(sheetName, idField, body) {
  const sheet   = getSheet(sheetName);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol   = headers.indexOf(idField);
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === body[idField]) {
      headers.forEach((h, col) => {
        if (h !== idField && h !== "createdAt" && body[h] !== undefined) {
          sheet.getRange(i + 1, col + 1).setValue(body[h]);
        }
      });
      return { success: true };
    }
  }
  return { error: "Record not found" };
}

function deleteRow(sheetName, idField, idValue) {
  const sheet   = getSheet(sheetName);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol   = headers.indexOf(idField);
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === idValue) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: "Record not found" };
}

// ── PLOTS ──────────────────────────────────────────────────────
function getPlots() {
  const plots    = getRows(getSheet(SHEETS.PLOTS));
  const expenses = getRows(getSheet(SHEETS.EXPENSES));
  const commits  = getRows(getSheet(SHEETS.COMMITMENTS));
  return plots.map(plot => {
    const totalCost   = expenses.filter(e => e.plotId === plot.plotId).reduce((s,e) => s+Number(e.amount),0);
    const totalFunded = commits.filter(c => c.plotId === plot.plotId).reduce((s,c) => s+Number(c.amount),0);
    return { ...plot, totalCost, totalFunded, companyShare: Math.max(0, totalCost-totalFunded) };
  });
}

function getPlotDetail(plotId) {
  const plot = getRows(getSheet(SHEETS.PLOTS)).find(p => p.plotId === plotId);
  if (!plot) return { error: "Plot not found" };
  const expenses    = getRows(getSheet(SHEETS.EXPENSES)).filter(e => e.plotId === plotId);
  const commitments = getRows(getSheet(SHEETS.COMMITMENTS)).filter(c => c.plotId === plotId);
  const investors   = getRows(getSheet(SHEETS.INVESTORS));
  const sales       = getRows(getSheet(SHEETS.SALES)).filter(s => s.plotId === plotId);
  const totalCost   = expenses.reduce((s,e) => s+Number(e.amount),0);
  const totalFunded = commitments.reduce((s,c) => s+Number(c.amount),0);
  const commitmentDetails = commitments.map(c => {
    const inv   = investors.find(i => i.investorId === c.investorId);
    const share = totalCost > 0 ? (Number(c.amount)/totalCost*100).toFixed(2) : 0;
    return { ...c, investorName: inv ? inv.name : "Unknown", sharePercent: share };
  });
  return { ...plot, totalCost, totalFunded, companyShare: Math.max(0,totalCost-totalFunded), expenses, commitments: commitmentDetails, sales };
}

function addPlot(body) {
  const plotId = "PLT-" + Date.now();
  getSheet(SHEETS.PLOTS).appendRow([plotId, body.name, body.location, body.sizeSqft, body.askingPrice, "Active", body.expectedTimeline||"", body.notes||"", new Date().toISOString()]);
  return { success: true, plotId };
}

function updatePlotStatus(body) {
  return editRow(SHEETS.PLOTS, "plotId", { plotId: body.plotId, status: body.status });
}

function deletePlot(body) {
  // Also delete related expenses, commitments, sales
  const plotId = body.plotId;
  [SHEETS.EXPENSES, SHEETS.COMMITMENTS, SHEETS.SALES].forEach(sheetName => {
    const sheet   = getSheet(sheetName);
    const data    = sheet.getDataRange().getValues();
    const plotCol = data[0].indexOf("plotId");
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][plotCol] === plotId) sheet.deleteRow(i + 1);
    }
  });
  return deleteRow(SHEETS.PLOTS, "plotId", plotId);
}

// ── EXPENSES ───────────────────────────────────────────────────
function addExpense(body) {
  const expenseId = "EXP-" + Date.now();
  getSheet(SHEETS.EXPENSES).appendRow([expenseId, body.plotId, body.category, body.description, body.amount, body.receiptUrl||"", new Date().toISOString()]);
  return { success: true, expenseId };
}

// ── INVESTORS ──────────────────────────────────────────────────
function getInvestors() {
  const investors = getRows(getSheet(SHEETS.INVESTORS));
  const wallets   = getRows(getSheet(SHEETS.WALLET));
  const commits   = getRows(getSheet(SHEETS.COMMITMENTS));
  return investors.map(inv => {
    const wallet = wallets.find(w => w.investorId === inv.investorId);
    const totalInvested = commits.filter(c => c.investorId === inv.investorId).reduce((s,c) => s+Number(c.amount),0);
    return { ...inv, walletBalance: wallet ? Number(wallet.balance) : 0, totalInvested };
  });
}

function getInvestorDetail(investorId) {
  const inv = getRows(getSheet(SHEETS.INVESTORS)).find(i => i.investorId === investorId);
  if (!inv) return { error: "Investor not found" };
  const commits = getRows(getSheet(SHEETS.COMMITMENTS)).filter(c => c.investorId === investorId);
  const wallet  = getRows(getSheet(SHEETS.WALLET)).find(w => w.investorId === investorId);
  const txns    = getRows(getSheet(SHEETS.TRANSACTIONS)).filter(t => t.investorId === investorId);
  return { ...inv, commitments: commits, wallet: wallet||{balance:0}, transactions: txns, totalInvested: commits.reduce((s,c)=>s+Number(c.amount),0) };
}

function addInvestor(body) {
  const investorId = "INV-" + Date.now();
  getSheet(SHEETS.INVESTORS).appendRow([investorId, body.name, body.email, body.phone, body.panNumber||"", body.bankName||"", body.accountNumber||"", body.ifscCode||"", new Date().toISOString()]);
  getSheet(SHEETS.WALLET).appendRow(["WLT-"+Date.now(), investorId, 0, new Date().toISOString()]);
  if (body.password) {
    getSheet(SHEETS.USERS).appendRow(["USR-"+Date.now(), body.email, hashPassword(body.password), "investor", investorId, new Date().toISOString()]);
  }
  return { success: true, investorId };
}

function editInvestor(body) {
  return editRow(SHEETS.INVESTORS, "investorId", body);
}

function deleteInvestor(body) {
  const investorId = body.investorId;
  // Delete wallet, commitments, transactions, user login
  [SHEETS.WALLET, SHEETS.COMMITMENTS, SHEETS.TRANSACTIONS].forEach(sheetName => {
    const sheet  = getSheet(sheetName);
    const data   = sheet.getDataRange().getValues();
    const invCol = data[0].indexOf("investorId");
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][invCol] === investorId) sheet.deleteRow(i + 1);
    }
  });
  // Delete user login entry
  const userSheet = getSheet(SHEETS.USERS);
  const userData  = userSheet.getDataRange().getValues();
  const invCol    = userData[0].indexOf("investorId");
  for (let i = userData.length - 1; i >= 1; i--) {
    if (userData[i][invCol] === investorId) userSheet.deleteRow(i + 1);
  }
  return deleteRow(SHEETS.INVESTORS, "investorId", investorId);
}

// ── COMMITMENTS ────────────────────────────────────────────────
function addCommitment(body) {
  const id = "CMT-" + Date.now();
  getSheet(SHEETS.COMMITMENTS).appendRow([id, body.plotId, body.investorId, body.amount, 0, new Date().toISOString()]);
  recalculateShares(body.plotId);
  return { success: true, commitmentId: id };
}

function editCommitment(body) {
  const result = editRow(SHEETS.COMMITMENTS, "commitmentId", body);
  if (result.success) recalculateShares(body.plotId);
  return result;
}

function deleteCommitment(body) {
  const result = deleteRow(SHEETS.COMMITMENTS, "commitmentId", body.commitmentId);
  if (result.success) recalculateShares(body.plotId);
  return result;
}

function recalculateShares(plotId) {
  const totalCost = getRows(getSheet(SHEETS.EXPENSES)).filter(e => e.plotId === plotId).reduce((s,e) => s+Number(e.amount),0);
  if (totalCost === 0) return;
  const sheet = getSheet(SHEETS.COMMITMENTS);
  const data  = sheet.getDataRange().getValues();
  const h     = data[0];
  for (let i = 1; i < data.length; i++) {
    if (data[i][h.indexOf("plotId")] === plotId) {
      sheet.getRange(i+1, h.indexOf("sharePercent")+1).setValue((Number(data[i][h.indexOf("amount")])/totalCost*100).toFixed(4));
    }
  }
}

// ── SALES ──────────────────────────────────────────────────────
function recordSale(body) {
  const saleId      = "SAL-" + Date.now();
  const netRevenue  = Number(body.salePrice) - Number(body.brokerFee||0);
  const expenses    = getRows(getSheet(SHEETS.EXPENSES)).filter(e => e.plotId === body.plotId);
  const totalCost   = expenses.reduce((s,e) => s+Number(e.amount),0);
  const plot        = getRows(getSheet(SHEETS.PLOTS)).find(p => p.plotId === body.plotId);
  const plotSize    = Number(plot.sizeSqft)||1;
  const soldSize    = Number(body.sizePortionSqft)||plotSize;
  const costPortion = totalCost*(soldSize/plotSize);
  const netPL       = netRevenue - costPortion;
  getSheet(SHEETS.SALES).appendRow([saleId, body.plotId, body.saleDate, soldSize, body.salePrice, body.brokerFee||0, netRevenue, netPL, body.notes||"", new Date().toISOString()]);
  distributeProceeds(body.plotId, saleId, netRevenue, netPL, costPortion);
  return { success: true, saleId, netRevenue, netProfitLoss: netPL };
}

function editSale(body) {
  // Recalculate derived fields
  const netRevenue = Number(body.salePrice) - Number(body.brokerFee||0);
  const expenses   = getRows(getSheet(SHEETS.EXPENSES)).filter(e => e.plotId === body.plotId);
  const totalCost  = expenses.reduce((s,e) => s+Number(e.amount),0);
  const plot       = getRows(getSheet(SHEETS.PLOTS)).find(p => p.plotId === body.plotId);
  const plotSize   = Number(plot.sizeSqft)||1;
  const soldSize   = Number(body.sizePortionSqft)||plotSize;
  const costPortion= totalCost*(soldSize/plotSize);
  const netPL      = netRevenue - costPortion;
  return editRow(SHEETS.SALES, "saleId", { ...body, netRevenue, netProfitLoss: netPL });
}

function deleteSale(body) {
  // Reverse wallet distributions for this sale
  const txSheet = getSheet(SHEETS.TRANSACTIONS);
  const txData  = txSheet.getDataRange().getValues();
  const txH     = txData[0];
  const saleCol = txH.indexOf("saleId");
  const invCol  = txH.indexOf("investorId");
  const amtCol  = txH.indexOf("amount");
  const walletSheet = getSheet(SHEETS.WALLET);

  for (let i = txData.length - 1; i >= 1; i--) {
    if (txData[i][saleCol] === body.saleId) {
      // Reverse the wallet credit
      updateWallet(txData[i][invCol], -Number(txData[i][amtCol]), walletSheet);
      txSheet.deleteRow(i + 1);
    }
  }
  return deleteRow(SHEETS.SALES, "saleId", body.saleId);
}

function distributeProceeds(plotId, saleId, netRevenue, netPL, costPortion) {
  const commitments    = getRows(getSheet(SHEETS.COMMITMENTS)).filter(c => c.plotId === plotId);
  const walletSheet    = getSheet(SHEETS.WALLET);
  const txSheet        = getSheet(SHEETS.TRANSACTIONS);
  const totalCommitted = commitments.reduce((s,c) => s+Number(c.amount),0);
  commitments.forEach(c => {
    const shareDecimal    = Number(c.sharePercent)/100;
    const principalReturn = totalCommitted > 0 ? Number(c.amount)*(costPortion/totalCommitted) : 0;
    const totalCredit     = principalReturn + (netPL*shareDecimal);
    updateWallet(c.investorId, totalCredit, walletSheet);
    txSheet.appendRow(["TX-"+Date.now()+"-"+c.investorId, c.investorId, plotId, saleId, netPL>=0?"PROFIT_DISTRIBUTION":"LOSS_DISTRIBUTION", totalCredit.toFixed(2), `Plot ${plotId} sale`, new Date().toISOString()]);
  });
}

function updateWallet(investorId, amount, walletSheet) {
  const data = walletSheet.getDataRange().getValues();
  const h    = data[0];
  for (let i = 1; i < data.length; i++) {
    if (data[i][h.indexOf("investorId")] === investorId) {
      walletSheet.getRange(i+1, h.indexOf("balance")+1).setValue((Number(data[i][h.indexOf("balance")])+amount).toFixed(2));
      walletSheet.getRange(i+1, h.indexOf("lastUpdated")+1).setValue(new Date().toISOString());
      return;
    }
  }
}

// ── WALLET OPS ─────────────────────────────────────────────────
function processWithdrawal(body) {
  const walletSheet = getSheet(SHEETS.WALLET);
  const data = walletSheet.getDataRange().getValues();
  const h    = data[0];
  for (let i = 1; i < data.length; i++) {
    if (data[i][h.indexOf("investorId")] === body.investorId) {
      const bal = Number(data[i][h.indexOf("balance")]);
      if (bal < Number(body.amount)) return { error: "Insufficient balance" };
      walletSheet.getRange(i+1, h.indexOf("balance")+1).setValue((bal-Number(body.amount)).toFixed(2));
      getSheet(SHEETS.TRANSACTIONS).appendRow(["TX-"+Date.now(), body.investorId,"","","WITHDRAWAL",-body.amount, body.notes||"Withdrawal", new Date().toISOString()]);
      return { success: true };
    }
  }
  return { error: "Wallet not found" };
}

function reinvest(body) {
  const result = processWithdrawal({ investorId: body.investorId, amount: body.amount, notes: "Reinvestment to "+body.plotId });
  if (result.error) return result;
  return addCommitment(body);
}

// ── DASHBOARD ──────────────────────────────────────────────────
function getDashboard() {
  const plots   = getPlots();
  const wallets = getRows(getSheet(SHEETS.WALLET));
  const sales   = getRows(getSheet(SHEETS.SALES));
  const txns    = getRows(getSheet(SHEETS.TRANSACTIONS));
  return {
    totalPlots:    plots.length,
    activePlots:   plots.filter(p => p.status==="Active").length,
    soldPlots:     plots.filter(p => p.status==="Sold").length,
    totalDeployed: plots.reduce((s,p) => s+(p.totalCost||0),0),
    totalInWallets:wallets.reduce((s,w) => s+Number(w.balance),0),
    totalRevenue:  sales.reduce((s,s2) => s+Number(s2.netRevenue||0),0),
    totalPL:       sales.reduce((s,s2) => s+Number(s2.netProfitLoss||0),0),
    recentTransactions: txns.slice(-10).reverse()
  };
}

// ── HELPERS ────────────────────────────────────────────────────
function getSheet(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }
function getRows(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(row => { const o={}; headers.forEach((h,i)=>o[h]=row[i]); return o; });
}
function getTransactions(investorId) {
  const txns = getRows(getSheet(SHEETS.TRANSACTIONS));
  return investorId ? txns.filter(t => t.investorId===investorId) : txns;
}
function getWallet(investorId) {
  return getRows(getSheet(SHEETS.WALLET)).find(w => w.investorId===investorId) || { balance: 0 };
}
