// ============================================================
// REAL ESTATE INVESTMENT TRACKER - Google Apps Script Backend
// v4 - Profit share + wallet adjustment + correct invested totals
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
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    const body   = e.parameter.data ? JSON.parse(e.parameter.data) : {};
    const params = e.parameter;
    switch (action) {
      case "login":               return response(login(params));
      case "getPlots":            return response(getPlots());
      case "getPlotDetail":       return response(getPlotDetail(params.plotId));
      case "getPlotProfitShare":  return response(getPlotProfitShare(params.plotId));
      case "getInvestors":        return response(getInvestors());
      case "getInvestorDetail":   return response(getInvestorDetail(params.investorId));
      case "getInvestorReturns":  return response(getInvestorReturns(params.investorId));
      case "getDashboard":        return response(getDashboard());
      case "getWallet":           return response(getWallet(params.investorId));
      case "getTransactions":     return response(getTransactions(params.investorId));
      case "addPlot":             return response(addPlot(body));
      case "addExpense":          return response(addExpense(body));
      case "addInvestor":         return response(addInvestor(body));
      case "addCommitment":       return response(addCommitment(body));
      case "recordSale":          return response(recordSale(body));
      case "processWithdrawal":   return response(processWithdrawal(body));
      case "reinvest":            return response(reinvest(body));
      case "adjustWallet":        return response(adjustWallet(body));
      case "updatePlotStatus":    return response(updatePlotStatus(body));
      case "editPlot":            return response(editRow(SHEETS.PLOTS, "plotId", body));
      case "editExpense":         return response(editRow(SHEETS.EXPENSES, "expenseId", body));
      case "editInvestor":        return response(editInvestor(body));
      case "editCommitment":      return response(editCommitment(body));
      case "editSale":            return response(editSale(body));
      case "deletePlot":          return response(deletePlot(body));
      case "deleteExpense":       return response(deleteRow(SHEETS.EXPENSES, "expenseId", body.expenseId));
      case "deleteCommitment":    return response(deleteCommitment(body));
      case "deleteSale":          return response(deleteSale(body));
      case "deleteInvestor":      return response(deleteInvestor(body));
      default:                    return response({ error: "Unknown action: " + action });
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
    [SHEETS.COMMITMENTS]:  ["commitmentId","plotId","investorId","amount","sharePercent","isReinvestment","createdAt"],
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
  const user = rows.find(r => r.username===params.username && r.passwordHash===hashPassword(params.password));
  if (!user) return { success: false, message: "Invalid credentials" };
  return { success: true, role: user.role, investorId: user.investorId, username: user.username };
}

function hashPassword(pwd) {
  let hash = 0;
  for (let i = 0; i < pwd.length; i++) { hash = ((hash<<5)-hash)+pwd.charCodeAt(i); hash|=0; }
  return "H" + Math.abs(hash).toString(36);
}

// Google Sheets stores booleans as TRUE/FALSE strings — normalise here
function isReinvest(val) {
  return val === true || val === "TRUE" || val === 1 || val === "true";
}

// ── GENERIC HELPERS ────────────────────────────────────────────
function editRow(sheetName, idField, body) {
  const sheet   = getSheet(sheetName);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol   = headers.indexOf(idField);
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === body[idField]) {
      headers.forEach((h, col) => {
        if (h !== idField && h !== "createdAt" && body[h] !== undefined)
          sheet.getRange(i+1, col+1).setValue(body[h]);
      });
      return { success: true };
    }
  }
  return { error: "Record not found" };
}

function deleteRow(sheetName, idField, idValue) {
  const sheet = getSheet(sheetName);
  const data  = sheet.getDataRange().getValues();
  const idCol = data[0].indexOf(idField);
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === idValue) { sheet.deleteRow(i+1); return { success: true }; }
  }
  return { error: "Record not found" };
}

// ── PLOTS ──────────────────────────────────────────────────────
function getPlots() {
  const plots    = getRows(getSheet(SHEETS.PLOTS));
  const expenses = getRows(getSheet(SHEETS.EXPENSES));
  const commits  = getRows(getSheet(SHEETS.COMMITMENTS));
  const sales    = getRows(getSheet(SHEETS.SALES));
  return plots.map(plot => {
    const totalCost    = expenses.filter(e=>e.plotId===plot.plotId).reduce((s,e)=>s+Number(e.amount),0);
    const totalFunded  = commits.filter(c=>c.plotId===plot.plotId).reduce((s,c)=>s+Number(c.amount),0);
    const totalRevenue = sales.filter(s=>s.plotId===plot.plotId).reduce((s,x)=>s+Number(x.netRevenue||0),0);
    const totalPL      = sales.filter(s=>s.plotId===plot.plotId).reduce((s,x)=>s+Number(x.netProfitLoss||0),0);
    return { ...plot, totalCost, totalFunded, companyShare: Math.max(0,totalCost-totalFunded), totalRevenue, totalPL };
  });
}

function getPlotDetail(plotId) {
  const plot = getRows(getSheet(SHEETS.PLOTS)).find(p=>p.plotId===plotId);
  if (!plot) return { error: "Plot not found" };
  const expenses    = getRows(getSheet(SHEETS.EXPENSES)).filter(e=>e.plotId===plotId);
  const commitments = getRows(getSheet(SHEETS.COMMITMENTS)).filter(c=>c.plotId===plotId);
  const investors   = getRows(getSheet(SHEETS.INVESTORS));
  const sales       = getRows(getSheet(SHEETS.SALES)).filter(s=>s.plotId===plotId);
  const totalCost   = expenses.reduce((s,e)=>s+Number(e.amount),0);
  const totalFunded = commitments.reduce((s,c)=>s+Number(c.amount),0);
  const commitmentDetails = commitments.map(c => {
    const inv   = investors.find(i=>i.investorId===c.investorId);
    const share = totalCost>0 ? (Number(c.amount)/totalCost*100).toFixed(2) : 0;
    return { ...c, investorName: inv?inv.name:"Unknown", sharePercent: share };
  });
  return { ...plot, totalCost, totalFunded, companyShare: Math.max(0,totalCost-totalFunded), expenses, commitments: commitmentDetails, sales };
}

function addPlot(body) {
  const plotId = "PLT-"+Date.now();
  getSheet(SHEETS.PLOTS).appendRow([plotId,body.name,body.location,body.sizeSqft,body.askingPrice,"Active",body.expectedTimeline||"",body.notes||"",new Date().toISOString()]);
  return { success: true, plotId };
}

function updatePlotStatus(body) { return editRow(SHEETS.PLOTS,"plotId",{plotId:body.plotId,status:body.status}); }

function deletePlot(body) {
  [SHEETS.EXPENSES,SHEETS.COMMITMENTS,SHEETS.SALES].forEach(sn=>{
    const sheet=getSheet(sn), data=sheet.getDataRange().getValues(), col=data[0].indexOf("plotId");
    for(let i=data.length-1;i>=1;i--) if(data[i][col]===body.plotId) sheet.deleteRow(i+1);
  });
  return deleteRow(SHEETS.PLOTS,"plotId",body.plotId);
}

// ── PROFIT SHARE BREAKDOWN ─────────────────────────────────────
function getPlotProfitShare(plotId) {
  const plot      = getRows(getSheet(SHEETS.PLOTS)).find(p=>p.plotId===plotId);
  const expenses  = getRows(getSheet(SHEETS.EXPENSES)).filter(e=>e.plotId===plotId);
  const commits   = getRows(getSheet(SHEETS.COMMITMENTS)).filter(c=>c.plotId===plotId);
  const investors = getRows(getSheet(SHEETS.INVESTORS));
  const sales     = getRows(getSheet(SHEETS.SALES)).filter(s=>s.plotId===plotId);
  const totalCost = expenses.reduce((s,e)=>s+Number(e.amount),0);
  const plotSize  = Number(plot?.sizeSqft)||1;
  const totalCommitted = commits.reduce((s,c)=>s+Number(c.amount),0);
  const companyContrib = Math.max(0, totalCost-totalCommitted);

  const saleBreakdowns = sales.map(sale => {
    const soldSize    = Number(sale.sizePortionSqft)||plotSize;
    const costPortion = totalCost*(soldSize/plotSize);
    const netRevenue  = Number(sale.netRevenue);
    const netPL       = Number(sale.netProfitLoss);

    const investorShares = commits.map(c => {
      const inv             = investors.find(i=>i.investorId===c.investorId);
      const shareDecimal    = Number(c.sharePercent)/100;
      const principalReturn = totalCommitted>0 ? Number(c.amount)*(costPortion/totalCommitted) : 0;
      const profitShare     = netPL*shareDecimal;
      return {
        investorId: c.investorId, investorName: inv?inv.name:"Unknown",
        commitment: Number(c.amount), sharePercent: Number(c.sharePercent),
        principalReturn, profitShare, totalReceived: principalReturn+profitShare
      };
    });

    // Company share row
    if (companyContrib > 0) {
      const companySharePct  = totalCost>0 ? (companyContrib/totalCost*100) : 0;
      const companyPrincipal = companyContrib*(costPortion/totalCost);
      const companyProfit    = netPL*(companySharePct/100);
      investorShares.push({
        investorId:"COMPANY", investorName:"Company (Own Funds)",
        commitment: companyContrib, sharePercent: companySharePct,
        principalReturn: companyPrincipal, profitShare: companyProfit,
        totalReceived: companyPrincipal+companyProfit
      });
    }

    return {
      saleId: sale.saleId, saleDate: sale.saleDate,
      salePrice: Number(sale.salePrice), brokerFee: Number(sale.brokerFee||0),
      netRevenue, netProfitLoss: netPL, sizePortionSqft: soldSize,
      shares: investorShares
    };
  });

  return { plotId, plotName: plot?.name, totalCost, totalCommitted, companyContrib, saleBreakdowns };
}

// ── INVESTOR RETURNS BREAKDOWN ─────────────────────────────────
function getInvestorReturns(investorId) {
  const commits  = getRows(getSheet(SHEETS.COMMITMENTS)).filter(c=>c.investorId===investorId);
  const plots    = getRows(getSheet(SHEETS.PLOTS));
  const sales    = getRows(getSheet(SHEETS.SALES));
  const expenses = getRows(getSheet(SHEETS.EXPENSES));
  const txns     = getRows(getSheet(SHEETS.TRANSACTIONS)).filter(t=>t.investorId===investorId);

  const plotBreakdowns = commits.map(c => {
    const plot       = plots.find(p=>p.plotId===c.plotId);
    const plotSales  = sales.filter(s=>s.plotId===c.plotId);
    const plotExp    = expenses.filter(e=>e.plotId===c.plotId);
    const totalCost  = plotExp.reduce((s,e)=>s+Number(e.amount),0);
    const plotSize   = Number(plot?.sizeSqft)||1;
    const shareDecimal = Number(c.sharePercent)/100;
    const isReinvestment = isReinvest(c.isReinvestment);

    const distributions = txns.filter(t=>t.plotId===c.plotId&&(t.type==="PROFIT_DISTRIBUTION"||t.type==="LOSS_DISTRIBUTION"));
    const totalReceived = distributions.reduce((s,t)=>s+Number(t.amount),0);
    const profitLossShare = plotSales.reduce((s,sale)=>{
      const soldSize    = Number(sale.sizePortionSqft)||plotSize;
      const costPortion = totalCost*(soldSize/plotSize);
      return s+(Number(sale.netProfitLoss)*shareDecimal);
    },0);

    return {
      plotId: c.plotId, plotName: plot?plot.name:"Unknown", plotStatus: plot?plot.status:"—",
      commitment: Number(c.amount), sharePercent: Number(c.sharePercent),
      isReinvestment, totalReceived, profitLossShare, salesCount: plotSales.length
    };
  });

  const cashInvested   = plotBreakdowns.filter(p=>!p.isReinvestment).reduce((s,p)=>s+p.commitment,0);
  const reinvested     = plotBreakdowns.filter(p=>p.isReinvestment).reduce((s,p)=>s+p.commitment,0);
  const totalCommitted = plotBreakdowns.reduce((s,p)=>s+p.commitment,0);
  const totalReturns   = plotBreakdowns.reduce((s,p)=>s+p.totalReceived,0);
  const totalPLShare   = plotBreakdowns.reduce((s,p)=>s+p.profitLossShare,0);
  const withdrawals    = txns.filter(t=>t.type==="WITHDRAWAL").reduce((s,t)=>s+Math.abs(Number(t.amount)),0);
  const adjustments    = txns.filter(t=>t.type==="ADJUSTMENT").reduce((s,t)=>s+Number(t.amount),0);

  return { investorId, plotBreakdowns, cashInvested, reinvested, totalCommitted, totalReturns, totalPLShare, withdrawals, adjustments };
}

// ── EXPENSES ───────────────────────────────────────────────────
function addExpense(body) {
  const expenseId = "EXP-"+Date.now();
  getSheet(SHEETS.EXPENSES).appendRow([expenseId,body.plotId,body.category,body.description,body.amount,body.receiptUrl||"",new Date().toISOString()]);
  return { success: true, expenseId };
}

// ── INVESTORS ──────────────────────────────────────────────────
function getInvestors() {
  const investors = getRows(getSheet(SHEETS.INVESTORS));
  const wallets   = getRows(getSheet(SHEETS.WALLET));
  const commits   = getRows(getSheet(SHEETS.COMMITMENTS));
  const txns      = getRows(getSheet(SHEETS.TRANSACTIONS));
  return investors.map(inv => {
    const wallet     = wallets.find(w=>w.investorId===inv.investorId);
    const invCommits = commits.filter(c=>c.investorId===inv.investorId);
    const cashInvested   = invCommits.filter(c=>!(isReinvest(c.isReinvestment))).reduce((s,c)=>s+Number(c.amount),0);
    const reinvested     = invCommits.filter(c=>isReinvest(c.isReinvestment)).reduce((s,c)=>s+Number(c.amount),0);
    const totalReturns   = txns.filter(t=>t.investorId===inv.investorId&&(t.type==="PROFIT_DISTRIBUTION"||t.type==="LOSS_DISTRIBUTION")).reduce((s,t)=>s+Number(t.amount),0);
    return { ...inv, walletBalance: wallet?Number(wallet.balance):0, cashInvested, reinvested, totalCommitted: cashInvested+reinvested, totalReturns };
  });
}

function getInvestorDetail(investorId) {
  const inv = getRows(getSheet(SHEETS.INVESTORS)).find(i=>i.investorId===investorId);
  if (!inv) return { error: "Investor not found" };
  const commits = getRows(getSheet(SHEETS.COMMITMENTS)).filter(c=>c.investorId===investorId);
  const wallet  = getRows(getSheet(SHEETS.WALLET)).find(w=>w.investorId===investorId);
  const txns    = getRows(getSheet(SHEETS.TRANSACTIONS)).filter(t=>t.investorId===investorId);
  const cashInvested = commits.filter(c=>!(isReinvest(c.isReinvestment))).reduce((s,c)=>s+Number(c.amount),0);
  const reinvested   = commits.filter(c=>isReinvest(c.isReinvestment)).reduce((s,c)=>s+Number(c.amount),0);
  return { ...inv, commitments: commits, wallet: wallet||{balance:0}, transactions: txns, cashInvested, reinvested, totalCommitted: cashInvested+reinvested };
}

function addInvestor(body) {
  const investorId = "INV-"+Date.now();
  getSheet(SHEETS.INVESTORS).appendRow([investorId,body.name,body.email,body.phone,body.panNumber||"",body.bankName||"",body.accountNumber||"",body.ifscCode||"",new Date().toISOString()]);
  getSheet(SHEETS.WALLET).appendRow(["WLT-"+Date.now(),investorId,0,new Date().toISOString()]);
  if (body.password) getSheet(SHEETS.USERS).appendRow(["USR-"+Date.now(),body.email,hashPassword(body.password),"investor",investorId,new Date().toISOString()]);
  return { success: true, investorId };
}

function editInvestor(body) { return editRow(SHEETS.INVESTORS,"investorId",body); }

function deleteInvestor(body) {
  const id = body.investorId;
  [SHEETS.WALLET,SHEETS.COMMITMENTS,SHEETS.TRANSACTIONS].forEach(sn=>{
    const sheet=getSheet(sn),data=sheet.getDataRange().getValues(),col=data[0].indexOf("investorId");
    for(let i=data.length-1;i>=1;i--) if(data[i][col]===id) sheet.deleteRow(i+1);
  });
  const us=getSheet(SHEETS.USERS),ud=us.getDataRange().getValues(),uc=ud[0].indexOf("investorId");
  for(let i=ud.length-1;i>=1;i--) if(ud[i][uc]===id) us.deleteRow(i+1);
  return deleteRow(SHEETS.INVESTORS,"investorId",id);
}

// ── WALLET ADJUSTMENT (admin manual) ──────────────────────────
function adjustWallet(body) {
  const walletSheet = getSheet(SHEETS.WALLET);
  const data = walletSheet.getDataRange().getValues();
  const h    = data[0];
  for (let i = 1; i < data.length; i++) {
    if (data[i][h.indexOf("investorId")] === body.investorId) {
      const currentBal = Number(data[i][h.indexOf("balance")]);
      const newBal     = currentBal + Number(body.adjustmentAmount);
      walletSheet.getRange(i+1,h.indexOf("balance")+1).setValue(newBal.toFixed(2));
      walletSheet.getRange(i+1,h.indexOf("lastUpdated")+1).setValue(new Date().toISOString());
      // Log the adjustment in transactions
      getSheet(SHEETS.TRANSACTIONS).appendRow([
        "TX-"+Date.now(), body.investorId, "", "", "ADJUSTMENT",
        Number(body.adjustmentAmount).toFixed(2),
        "Manual adjustment: " + (body.reason||"No reason given"),
        new Date().toISOString()
      ]);
      return { success: true, previousBalance: currentBal, newBalance: newBal };
    }
  }
  return { error: "Wallet not found" };
}

// ── COMMITMENTS ────────────────────────────────────────────────
function addCommitment(body) {
  const id = "CMT-"+Date.now();
  const isReinvestment = body.isReinvestment ? true : false;
  getSheet(SHEETS.COMMITMENTS).appendRow([id,body.plotId,body.investorId,body.amount,0,isReinvestment,new Date().toISOString()]);
  recalculateShares(body.plotId);
  return { success: true, commitmentId: id };
}

function editCommitment(body) {
  const result = editRow(SHEETS.COMMITMENTS,"commitmentId",body);
  if (result.success) recalculateShares(body.plotId);
  return result;
}

function deleteCommitment(body) {
  const result = deleteRow(SHEETS.COMMITMENTS,"commitmentId",body.commitmentId);
  if (result.success) recalculateShares(body.plotId);
  return result;
}

function recalculateShares(plotId) {
  const totalCost = getRows(getSheet(SHEETS.EXPENSES)).filter(e=>e.plotId===plotId).reduce((s,e)=>s+Number(e.amount),0);
  if (totalCost===0) return;
  const sheet=getSheet(SHEETS.COMMITMENTS), data=sheet.getDataRange().getValues(), h=data[0];
  for(let i=1;i<data.length;i++) {
    if(data[i][h.indexOf("plotId")]===plotId)
      sheet.getRange(i+1,h.indexOf("sharePercent")+1).setValue((Number(data[i][h.indexOf("amount")])/totalCost*100).toFixed(4));
  }
}

// ── SALES ──────────────────────────────────────────────────────
function recordSale(body) {
  const saleId     = "SAL-"+Date.now();
  const netRevenue = Number(body.salePrice)-Number(body.brokerFee||0);
  const expenses   = getRows(getSheet(SHEETS.EXPENSES)).filter(e=>e.plotId===body.plotId);
  const totalCost  = expenses.reduce((s,e)=>s+Number(e.amount),0);
  const plot       = getRows(getSheet(SHEETS.PLOTS)).find(p=>p.plotId===body.plotId);
  const plotSize   = Number(plot?.sizeSqft)||1;
  const soldSize   = Number(body.sizePortionSqft)||plotSize;
  const costPortion= totalCost*(soldSize/plotSize);
  const netPL      = netRevenue-costPortion;
  getSheet(SHEETS.SALES).appendRow([saleId,body.plotId,body.saleDate,soldSize,body.salePrice,body.brokerFee||0,netRevenue,netPL,body.notes||"",new Date().toISOString()]);
  distributeProceeds(body.plotId,saleId,netRevenue,netPL,costPortion);
  return { success: true, saleId, netRevenue, netProfitLoss: netPL };
}

function editSale(body) {
  const netRevenue = Number(body.salePrice)-Number(body.brokerFee||0);
  const expenses   = getRows(getSheet(SHEETS.EXPENSES)).filter(e=>e.plotId===body.plotId);
  const totalCost  = expenses.reduce((s,e)=>s+Number(e.amount),0);
  const plot       = getRows(getSheet(SHEETS.PLOTS)).find(p=>p.plotId===body.plotId);
  const plotSize   = Number(plot?.sizeSqft)||1;
  const soldSize   = Number(body.sizePortionSqft)||plotSize;
  const netPL      = netRevenue-(totalCost*(soldSize/plotSize));
  return editRow(SHEETS.SALES,"saleId",{...body,netRevenue,netProfitLoss:netPL});
}

function deleteSale(body) {
  const txSheet=getSheet(SHEETS.TRANSACTIONS), txData=txSheet.getDataRange().getValues(), h=txData[0];
  const walletSheet=getSheet(SHEETS.WALLET);
  for(let i=txData.length-1;i>=1;i--) {
    if(txData[i][h.indexOf("saleId")]===body.saleId) {
      updateWallet(txData[i][h.indexOf("investorId")],-Number(txData[i][h.indexOf("amount")]),walletSheet);
      txSheet.deleteRow(i+1);
    }
  }
  return deleteRow(SHEETS.SALES,"saleId",body.saleId);
}

function distributeProceeds(plotId,saleId,netRevenue,netPL,costPortion) {
  const commitments    = getRows(getSheet(SHEETS.COMMITMENTS)).filter(c=>c.plotId===plotId);
  const walletSheet    = getSheet(SHEETS.WALLET);
  const txSheet        = getSheet(SHEETS.TRANSACTIONS);
  const totalCommitted = commitments.reduce((s,c)=>s+Number(c.amount),0);
  commitments.forEach(c => {
    const shareDecimal    = Number(c.sharePercent)/100;
    const principalReturn = totalCommitted>0 ? Number(c.amount)*(costPortion/totalCommitted) : 0;
    const totalCredit     = principalReturn+(netPL*shareDecimal);
    updateWallet(c.investorId,totalCredit,walletSheet);
    txSheet.appendRow(["TX-"+Date.now()+"-"+c.investorId,c.investorId,plotId,saleId,
      netPL>=0?"PROFIT_DISTRIBUTION":"LOSS_DISTRIBUTION",
      totalCredit.toFixed(2),`Plot ${plotId} sale - principal + ${netPL>=0?"profit":"loss"} share`,
      new Date().toISOString()]);
  });
}

function updateWallet(investorId,amount,walletSheet) {
  const data=walletSheet.getDataRange().getValues(), h=data[0];
  for(let i=1;i<data.length;i++) {
    if(data[i][h.indexOf("investorId")]===investorId) {
      walletSheet.getRange(i+1,h.indexOf("balance")+1).setValue((Number(data[i][h.indexOf("balance")])+amount).toFixed(2));
      walletSheet.getRange(i+1,h.indexOf("lastUpdated")+1).setValue(new Date().toISOString());
      return;
    }
  }
}

// ── WALLET OPS ─────────────────────────────────────────────────
function processWithdrawal(body) {
  const walletSheet=getSheet(SHEETS.WALLET), data=walletSheet.getDataRange().getValues(), h=data[0];
  for(let i=1;i<data.length;i++) {
    if(data[i][h.indexOf("investorId")]===body.investorId) {
      const bal=Number(data[i][h.indexOf("balance")]);
      if(bal<Number(body.amount)) return { error:"Insufficient balance" };
      walletSheet.getRange(i+1,h.indexOf("balance")+1).setValue((bal-Number(body.amount)).toFixed(2));
      getSheet(SHEETS.TRANSACTIONS).appendRow(["TX-"+Date.now(),body.investorId,"","","WITHDRAWAL",-body.amount,body.notes||"Withdrawal",new Date().toISOString()]);
      return { success: true };
    }
  }
  return { error:"Wallet not found" };
}

function reinvest(body) {
  const result = processWithdrawal({investorId:body.investorId,amount:body.amount,notes:"Reinvestment to "+body.plotId});
  if(result.error) return result;
  return addCommitment({...body, isReinvestment: true});
}

// ── DASHBOARD ──────────────────────────────────────────────────
function getDashboard() {
  const plots    = getPlots();
  const wallets  = getRows(getSheet(SHEETS.WALLET));
  const sales    = getRows(getSheet(SHEETS.SALES));
  const txns     = getRows(getSheet(SHEETS.TRANSACTIONS));
  const investors= getInvestors();
  const commits  = getRows(getSheet(SHEETS.COMMITMENTS));

  // Total active funds = sum of all commitments in Active plots only
  const activePlotIds  = plots.filter(p=>p.status==="Active").map(p=>p.plotId);
  const totalActiveFunds = commits
    .filter(c=>activePlotIds.indexOf(c.plotId)>-1)
    .reduce((s,c)=>s+Number(c.amount),0);

  // Profit share summary per plot (any plot with sales)
  const plotSummaries = plots.filter(p=>p.totalPL!==0||p.totalRevenue>0).map(p=>({
    plotId: p.plotId, plotName: p.name, status: p.status,
    totalCost: p.totalCost, totalRevenue: p.totalRevenue, totalPL: p.totalPL
  }));

  return {
    totalPlots:      plots.length,
    activePlots:     plots.filter(p=>p.status==="Active").length,
    soldPlots:       plots.filter(p=>p.status==="Sold").length,
    totalDeployed:   plots.reduce((s,p)=>s+(p.totalCost||0),0),
    totalActiveFunds,
    totalInWallets:  wallets.reduce((s,w)=>s+Number(w.balance),0),
    totalRevenue:    sales.reduce((s,s2)=>s+Number(s2.netRevenue||0),0),
    totalPL:         sales.reduce((s,s2)=>s+Number(s2.netProfitLoss||0),0),
    totalInvestors:  investors.length,
    plotSummaries,
    recentTransactions: txns.slice(-10).reverse()
  };
}

// ── HELPERS ────────────────────────────────────────────────────
function getSheet(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }
function getRows(sheet) {
  const data=sheet.getDataRange().getValues();
  if(data.length<=1) return [];
  const h=data[0];
  return data.slice(1).map(row=>{ const o={}; h.forEach((k,i)=>o[k]=row[i]); return o; });
}
function getTransactions(investorId) {
  const txns=getRows(getSheet(SHEETS.TRANSACTIONS));
  return investorId?txns.filter(t=>t.investorId===investorId):txns;
}
function getWallet(investorId) {
  return getRows(getSheet(SHEETS.WALLET)).find(w=>w.investorId===investorId)||{balance:0};
}
