// ============================================================
// REALTYTRACK - Apps Script Backend v5
// All reads via doGet (CORS-safe). Google SSO + Gmail reports.
// ============================================================

const S = {
  PLOTS:'Plots', EXPENSES:'Expenses', INVESTORS:'Investors',
  COMMITMENTS:'Commitments', SALES:'Sales', WALLET:'Wallet',
  TRANSACTIONS:'Transactions', USERS:'Users', CONFIG:'Config',
  PRINCIPAL_RETURNS:'PrincipalReturns'
}

function ok(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON)
}

function doGet(e) {
  try {
    const action = e.parameter.action
    const body   = e.parameter.data ? JSON.parse(e.parameter.data) : {}
    const p      = e.parameter
    switch(action) {
      // Auth
      case 'login':             return ok(login(p))
      case 'loginGoogle':       return ok(loginGoogle(p))
      // Read
      case 'getPlots':          return ok(getPlots())
      case 'getPlotDetail':     return ok(getPlotDetail(p.plotId))
      case 'getPlotProfitShare':return ok(getPlotProfitShare(p.plotId))
      case 'getInvestors':      return ok(getInvestors())
      case 'getInvestorDetail': return ok(getInvestorDetail(p.investorId))
      case 'getInvestorReturns':return ok(getInvestorReturns(p.investorId))
      case 'getDashboard':      return ok(getDashboard())
      case 'getWallet':         return ok(getWallet(p.investorId))
      case 'getTransactions':   return ok(getTransactions(p.investorId))
      case 'getReportConfig':   return ok(getReportConfig())
      // Write (body in ?data=)
      case 'addPlot':           return ok(addPlot(body))
      case 'editPlot':          return ok(editRow(S.PLOTS,'plotId',body))
      case 'deletePlot':        return ok(deletePlot(body))
      case 'addExpense':        return ok(addExpense(body))
      case 'editExpense':       return ok(editRow(S.EXPENSES,'expenseId',body))
      case 'deleteExpense':     return ok(deleteRow(S.EXPENSES,'expenseId',body.expenseId))
      case 'addInvestor':       return ok(addInvestor(body))
      case 'editInvestor':      return ok(editRow(S.INVESTORS,'investorId',body))
      case 'deleteInvestor':    return ok(deleteInvestor(body))
      case 'addCommitment':     return ok(addCommitment(body))
      case 'editCommitment':    return ok(editCommitment(body))
      case 'deleteCommitment':  return ok(deleteCommitment(body))
      case 'recordSale':        return ok(recordSale(body))
      case 'editSale':          return ok(editSale(body))
      case 'deleteSale':        return ok(deleteSale(body))
      case 'processWithdrawal': return ok(processWithdrawal(body))
      case 'reinvest':          return ok(reinvest(body))
      case 'adjustWallet':      return ok(adjustWallet(body))
      case 'updatePlotStatus':  return ok(editRow(S.PLOTS,'plotId',{plotId:body.plotId,status:body.status}))
      case 'saveReportConfig':  return ok(saveReportConfig(body))
      case 'sendReportsNow':    return ok(sendAllReports())
      case 'sendReportToInvestor': return ok(sendReportToInvestor(body.investorId))
      case 'savePrincipalReturns': return ok(savePrincipalReturns(body))
      case 'getPrincipalReturns':  return ok(getPrincipalReturns(p.saleId))
      default:                  return ok({error:'Unknown action: '+action})
    }
  } catch(err) {
    return ok({error:err.toString()})
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents)
    e.parameter = e.parameter||{}
    e.parameter.data = e.postData.contents
    e.parameter.action = body.action
    return doGet(e)
  } catch(err) { return ok({error:err.toString()}) }
}

// ── SETUP ─────────────────────────────────────────────────────
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const schema = {
    [S.USERS]:        ['userId','username','passwordHash','role','investorId','email','createdAt'],
    [S.PLOTS]:        ['plotId','name','location','sizeSqft','askingPrice','status','expectedTimeline','notes','createdAt'],
    [S.EXPENSES]:     ['expenseId','plotId','category','description','amount','receiptUrl','createdAt'],
    [S.INVESTORS]:    ['investorId','name','email','phone','panNumber','bankName','accountNumber','ifscCode','createdAt'],
    [S.COMMITMENTS]:  ['commitmentId','plotId','investorId','amount','sharePercent','isReinvestment','createdAt'],
    [S.SALES]:        ['saleId','plotId','saleDate','sizePortionSqft','salePrice','brokerFee','netRevenue','netProfitLoss','notes','createdAt'],
    [S.WALLET]:       ['walletId','investorId','balance','lastUpdated'],
    [S.TRANSACTIONS]: ['txId','investorId','plotId','saleId','type','amount','description','createdAt'],
    [S.CONFIG]:       ['key','value'],
    [S.PRINCIPAL_RETURNS]: ['returnId','saleId','plotId','investorId','amount','createdAt']
  }
  Object.entries(schema).forEach(([name,headers]) => {
    let sh = ss.getSheetByName(name)
    if (!sh) sh = ss.insertSheet(name)
    if (sh.getLastRow() === 0) {
      sh.appendRow(headers)
      sh.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#0d1628').setFontColor('#ffffff')
    }
  })
  const us = ss.getSheetByName(S.USERS)
  if (us.getLastRow() <= 1) {
    us.appendRow(['USR-001','admin',hashPwd('admin123'),'admin','','admin@realtytrack.com',new Date().toISOString()])
  }
  SpreadsheetApp.getUi().alert('✅ Setup complete!')
}

// ── AUTH ──────────────────────────────────────────────────────
function login(p) {
  const rows = getRows(getSheet(S.USERS))
  const u = rows.find(r => r.username===p.username && r.passwordHash===hashPwd(p.password))
  if (!u) return {success:false, message:'Invalid credentials'}
  return {success:true, role:u.role, investorId:u.investorId, username:u.username}
}

function loginGoogle(p) {
  const email = (p.email||'').toLowerCase().trim()
  if (!email) return {success:false, message:'No email provided'}
  // Check admin email list
  const adminEmails = (getConfigVal('adminEmails')||'').toLowerCase().split(',').map(e=>e.trim())
  if (adminEmails.includes(email)) return {success:true, role:'admin', investorId:'', username:email}
  // Check investor by email
  const investors = getRows(getSheet(S.INVESTORS))
  const inv = investors.find(i => (i.email||'').toLowerCase().trim() === email)
  if (inv) return {success:true, role:'investor', investorId:inv.investorId, username:inv.name}
  return {success:false, message:'Your Google account is not registered. Contact admin.'}
}

function hashPwd(pwd) {
  let h=0; for(let i=0;i<pwd.length;i++){h=((h<<5)-h)+pwd.charCodeAt(i);h|=0} return 'H'+Math.abs(h).toString(36)
}

function isTruthy(v) { return v===true||v==='TRUE'||v===1||v==='true' }

// ── GENERIC HELPERS ────────────────────────────────────────────
function editRow(sheetName,idField,body) {
  const sh=getSheet(sheetName), data=sh.getDataRange().getValues(), h=data[0], col=h.indexOf(idField)
  for(let i=1;i<data.length;i++) {
    if(data[i][col]===body[idField]) {
      h.forEach((k,c)=>{ if(k!==idField&&k!=='createdAt'&&body[k]!==undefined) sh.getRange(i+1,c+1).setValue(body[k]) })
      return {success:true}
    }
  }
  return {error:'Not found'}
}

function deleteRow(sheetName,idField,idVal) {
  const sh=getSheet(sheetName), data=sh.getDataRange().getValues(), col=data[0].indexOf(idField)
  for(let i=1;i<data.length;i++) { if(data[i][col]===idVal){sh.deleteRow(i+1);return{success:true}} }
  return {error:'Not found'}
}

// ── PLOTS ──────────────────────────────────────────────────────
function getPlots() {
  const plots=getRows(getSheet(S.PLOTS)), exp=getRows(getSheet(S.EXPENSES))
  const cmm=getRows(getSheet(S.COMMITMENTS)), sales=getRows(getSheet(S.SALES))
  return plots.map(p=>{
    const tc=exp.filter(e=>e.plotId===p.plotId).reduce((s,e)=>s+num(e.amount),0)
    const tf=cmm.filter(c=>c.plotId===p.plotId).reduce((s,c)=>s+num(c.amount),0)
    const tr=sales.filter(s=>s.plotId===p.plotId).reduce((s,x)=>s+num(x.netRevenue),0)
    const tpl=sales.filter(s=>s.plotId===p.plotId).reduce((s,x)=>s+num(x.netProfitLoss),0)
    return {...p,totalCost:tc,totalFunded:tf,companyShare:Math.max(0,tc-tf),totalRevenue:tr,totalPL:tpl}
  })
}

function getPlotDetail(plotId) {
  const plot=getRows(getSheet(S.PLOTS)).find(p=>p.plotId===plotId)
  if(!plot) return {error:'Plot not found'}
  const exp=getRows(getSheet(S.EXPENSES)).filter(e=>e.plotId===plotId)
  const cmm=getRows(getSheet(S.COMMITMENTS)).filter(c=>c.plotId===plotId)
  const inv=getRows(getSheet(S.INVESTORS))
  const sales=getRows(getSheet(S.SALES)).filter(s=>s.plotId===plotId)
  const tc=exp.reduce((s,e)=>s+num(e.amount),0)
  const tf=cmm.reduce((s,c)=>s+num(c.amount),0)
  const cmmD=cmm.map(c=>{
    const i=inv.find(x=>x.investorId===c.investorId)
    return {...c,investorName:i?i.name:'Unknown',sharePercent:tc>0?(num(c.amount)/tc*100).toFixed(2):0}
  })
  return {...plot,totalCost:tc,totalFunded:tf,companyShare:Math.max(0,tc-tf),expenses:exp,commitments:cmmD,sales}
}

function addPlot(b) {
  const id='PLT-'+Date.now()
  getSheet(S.PLOTS).appendRow([id,b.name,b.location,b.sizeSqft,b.askingPrice,b.status||'Active',b.expectedTimeline||'',b.notes||'',new Date().toISOString()])
  return {success:true,plotId:id}
}

function deletePlot(b) {
  [S.EXPENSES,S.COMMITMENTS,S.SALES].forEach(sn=>{
    const sh=getSheet(sn),d=sh.getDataRange().getValues(),col=d[0].indexOf('plotId')
    for(let i=d.length-1;i>=1;i--) if(d[i][col]===b.plotId) sh.deleteRow(i+1)
  })
  return deleteRow(S.PLOTS,'plotId',b.plotId)
}

// ── PROFIT SHARE ───────────────────────────────────────────────
function getPlotProfitShare(plotId) {
  const plot=getRows(getSheet(S.PLOTS)).find(p=>p.plotId===plotId)
  const exp=getRows(getSheet(S.EXPENSES)).filter(e=>e.plotId===plotId)
  const cmm=getRows(getSheet(S.COMMITMENTS)).filter(c=>c.plotId===plotId)
  const inv=getRows(getSheet(S.INVESTORS))
  const sales=getRows(getSheet(S.SALES)).filter(s=>s.plotId===plotId)
  const tc=exp.reduce((s,e)=>s+num(e.amount),0)
  const plotSize=num(plot&&plot.sizeSqft)||1
  const totalCmm=cmm.reduce((s,c)=>s+num(c.amount),0)
  const companyAmt=Math.max(0,tc-totalCmm)

  const saleBreakdowns=sales.map(sale=>{
    const sold=num(sale.sizePortionSqft)||plotSize
    const cp=tc*(sold/plotSize)
    const nr=num(sale.netRevenue), npl=num(sale.netProfitLoss)
    const shares=cmm.map(c=>{
      const investor=inv.find(i=>i.investorId===c.investorId)
      const sd=num(c.sharePercent)/100
      const pr=totalCmm>0?num(c.amount)*(cp/totalCmm):0
      const ps=npl*sd
      return {investorId:c.investorId,investorName:investor?investor.name:'Unknown',commitment:num(c.amount),sharePercent:num(c.sharePercent),principalReturn:pr,profitShare:ps,totalReceived:pr+ps}
    })
    if(companyAmt>0) {
      const pct=tc>0?(companyAmt/tc*100):0
      const pr=companyAmt*(cp/tc), ps=npl*(pct/100)
      shares.push({investorId:'COMPANY',investorName:'Company (Own Funds)',commitment:companyAmt,sharePercent:pct,principalReturn:pr,profitShare:ps,totalReceived:pr+ps})
    }
    return {saleId:sale.saleId,saleDate:sale.saleDate,salePrice:num(sale.salePrice),brokerFee:num(sale.brokerFee||0),netRevenue:nr,netProfitLoss:npl,sizePortionSqft:sold,shares}
  })
  return {plotId,plotName:plot&&plot.name,totalCost:tc,totalCommitted:totalCmm,companyContrib:companyAmt,saleBreakdowns}
}

// ── EXPENSES ───────────────────────────────────────────────────
function addExpense(b) {
  const id='EXP-'+Date.now()
  getSheet(S.EXPENSES).appendRow([id,b.plotId,b.category,b.description,b.amount,b.receiptUrl||'',new Date().toISOString()])
  return {success:true,expenseId:id}
}

// ── INVESTORS ──────────────────────────────────────────────────
function getInvestors() {
  const investors=getRows(getSheet(S.INVESTORS))
  const wallets=getRows(getSheet(S.WALLET))
  const cmm=getRows(getSheet(S.COMMITMENTS))
  const txns=getRows(getSheet(S.TRANSACTIONS))
  return investors.map(inv=>{
    const w=wallets.find(x=>x.investorId===inv.investorId)
    const ic=cmm.filter(c=>c.investorId===inv.investorId)
    const cashInvested=ic.filter(c=>!isTruthy(c.isReinvestment)).reduce((s,c)=>s+num(c.amount),0)
    const reinvested=ic.filter(c=>isTruthy(c.isReinvestment)).reduce((s,c)=>s+num(c.amount),0)
    const totalReturns=txns.filter(t=>t.investorId===inv.investorId&&(t.type==='PROFIT_DISTRIBUTION'||t.type==='LOSS_DISTRIBUTION')).reduce((s,t)=>s+num(t.amount),0)
    return {...inv,walletBalance:w?num(w.balance):0,cashInvested,reinvested,totalCommitted:cashInvested+reinvested,totalReturns}
  })
}

function getInvestorDetail(investorId) {
  const inv=getRows(getSheet(S.INVESTORS)).find(i=>i.investorId===investorId)
  if(!inv) return {error:'Investor not found'}
  const cmm=getRows(getSheet(S.COMMITMENTS)).filter(c=>c.investorId===investorId)
  const w=getRows(getSheet(S.WALLET)).find(x=>x.investorId===investorId)
  const txns=getRows(getSheet(S.TRANSACTIONS)).filter(t=>t.investorId===investorId)
  // Resolve plot names in transaction descriptions
  const plots=getRows(getSheet(S.PLOTS))
  const txnsNamed=txns.map(t=>{
    let desc=t.description||''
    // Replace PLT-xxx with plot name
    const match=desc.match(/PLT-\d+/)
    if(match) { const pl=plots.find(p=>p.plotId===match[0]); if(pl) desc=desc.replace(match[0],pl.name) }
    return {...t,description:desc}
  })
  const cashInvested=cmm.filter(c=>!isTruthy(c.isReinvestment)).reduce((s,c)=>s+num(c.amount),0)
  const reinvested=cmm.filter(c=>isTruthy(c.isReinvestment)).reduce((s,c)=>s+num(c.amount),0)
  return {...inv,commitments:cmm,wallet:w||{balance:0},transactions:txnsNamed,cashInvested,reinvested,totalCommitted:cashInvested+reinvested}
}

function getInvestorReturns(investorId) {
  const cmm=getRows(getSheet(S.COMMITMENTS)).filter(c=>c.investorId===investorId)
  const plots=getRows(getSheet(S.PLOTS))
  const sales=getRows(getSheet(S.SALES))
  const expenses=getRows(getSheet(S.EXPENSES))
  const txns=getRows(getSheet(S.TRANSACTIONS)).filter(t=>t.investorId===investorId)
  const wallet=getRows(getSheet(S.WALLET)).find(w=>w.investorId===investorId)

  const plotBreakdowns=cmm.map(c=>{
    const plot=plots.find(p=>p.plotId===c.plotId)
    const pSales=sales.filter(s=>s.plotId===c.plotId)
    const pExp=expenses.filter(e=>e.plotId===c.plotId)
    const tc=pExp.reduce((s,e)=>s+num(e.amount),0)
    const plotSize=num(plot&&plot.sizeSqft)||1
    const sd=num(c.sharePercent)/100
    const dists=txns.filter(t=>t.plotId===c.plotId&&(t.type==='PROFIT_DISTRIBUTION'||t.type==='LOSS_DISTRIBUTION'))
    const totalReceived=dists.reduce((s,t)=>s+num(t.amount),0)
    const profitLossShare=pSales.reduce((s,sale)=>{
      const sold=num(sale.sizePortionSqft)||plotSize
      const cp=tc*(sold/plotSize)
      return s+(num(sale.netProfitLoss)*sd)
    },0)
    const principalReturned = getRows(getSheet(S.PRINCIPAL_RETURNS))
      .filter(r => r.investorId === investorId && r.plotId === c.plotId)
      .reduce((s, r) => s + num(r.amount), 0)
    const netLocked = Math.max(0, num(c.amount) - principalReturned)
    return {
      plotId:c.plotId,plotName:plot?plot.name:'Unknown',plotStatus:plot?plot.status:'—',
      commitment:num(c.amount),sharePercent:num(c.sharePercent),isReinvestment:c.isReinvestment,
      totalReceived,profitLossShare,salesCount:pSales.length,
      principalReturned, netLocked
    }
  })

  // Commitment-based (for per-plot breakdown display only)
  const cashInvested=cmm.filter(c=>!isTruthy(c.isReinvestment)).reduce((s,c)=>s+num(c.amount),0)
  const reinvested=cmm.filter(c=>isTruthy(c.isReinvestment)).reduce((s,c)=>s+num(c.amount),0)
  const totalPLShare=plotBreakdowns.reduce((s,p)=>s+p.profitLossShare,0)
  const totalReturns=plotBreakdowns.reduce((s,p)=>s+p.totalReceived,0)
  const walletBalance=wallet?num(wallet.balance):0

  // Separate actual bank withdrawals from reinvestments
  // Reinvestments are internal wallet movements — NOT money leaving the system
  const allWithdrawals=txns.filter(t=>t.type==='WITHDRAWAL').reduce((s,t)=>s+Math.abs(num(t.amount)),0)
  const reinvestmentWithdrawals=plotBreakdowns
    .filter(p=>isTruthy(p.isReinvestment))
    .reduce((s,p)=>s+p.commitment,0)
  // Actual bank withdrawals = total withdrawals minus money reinvested into plots
  const bankWithdrawals=Math.max(0, allWithdrawals - reinvestmentWithdrawals)

  const adjustments=txns.filter(t=>t.type==='ADJUSTMENT').reduce((s,t)=>s+num(t.amount),0)
  // Only actual profit/loss (not principal returns)
  const profitOnly=totalPLShare

  // Active funds = commitments in active plots MINUS any principal already returned
  const principalReturns = getRows(getSheet(S.PRINCIPAL_RETURNS)).filter(r => r.investorId === investorId)
  const activeFunds = plotBreakdowns
    .filter(p => ['Active','Partially Sold','On Hold'].includes(p.plotStatus))
    .reduce((s, p) => {
      const returned = principalReturns
        .filter(r => r.plotId === p.plotId)
        .reduce((sr, r) => sr + num(r.amount), 0)
      return s + Math.max(0, p.commitment - returned)
    }, 0)

  // Money Trail summary (informational — shows where every rupee is)
  // IN:  cashInvested + profitOnly + adjustments
  // OUT: activeFunds + bankWithdrawals + wallet
  const trailIn  = cashInvested + profitOnly + adjustments
  const trailOut = activeFunds + bankWithdrawals + walletBalance

  return {
    investorId, plotBreakdowns,
    cashInvested, reinvested, totalCommitted: cashInvested+reinvested,
    totalPLShare, totalReturns,
    // Money Trail fields
    trailTotalIn:  trailIn,
    trailTotalOut: trailOut,
    activeFunds, bankWithdrawals,
    adjustments, profitCredits: profitOnly,
    withdrawals: bankWithdrawals,
    walletBalance
  }
}

function addInvestor(b) {
  const id='INV-'+Date.now()
  getSheet(S.INVESTORS).appendRow([id,b.name,b.email,b.phone,b.panNumber||'',b.bankName||'',b.accountNumber||'',b.ifscCode||'',new Date().toISOString()])
  getSheet(S.WALLET).appendRow(['WLT-'+Date.now(),id,0,new Date().toISOString()])
  if(b.password) getSheet(S.USERS).appendRow(['USR-'+Date.now(),b.email,hashPwd(b.password),'investor',id,b.email,new Date().toISOString()])
  return {success:true,investorId:id}
}

function deleteInvestor(b) {
  const id=b.investorId
  ;[S.WALLET,S.COMMITMENTS,S.TRANSACTIONS].forEach(sn=>{
    const sh=getSheet(sn),d=sh.getDataRange().getValues(),col=d[0].indexOf('investorId')
    for(let i=d.length-1;i>=1;i--) if(d[i][col]===id) sh.deleteRow(i+1)
  })
  const us=getSheet(S.USERS),ud=us.getDataRange().getValues(),uc=ud[0].indexOf('investorId')
  for(let i=ud.length-1;i>=1;i--) if(ud[i][uc]===id) us.deleteRow(i+1)
  return deleteRow(S.INVESTORS,'investorId',id)
}

// ── COMMITMENTS ────────────────────────────────────────────────
function addCommitment(b) {
  const id='CMT-'+Date.now()
  getSheet(S.COMMITMENTS).appendRow([id,b.plotId,b.investorId,b.amount,0,b.isReinvestment?true:false,new Date().toISOString()])
  recalc(b.plotId)
  return {success:true,commitmentId:id}
}

function editCommitment(b) {
  const r=editRow(S.COMMITMENTS,'commitmentId',b); if(r.success) recalc(b.plotId); return r
}

function deleteCommitment(b) {
  const r=deleteRow(S.COMMITMENTS,'commitmentId',b.commitmentId); if(r.success) recalc(b.plotId); return r
}

function recalc(plotId) {
  const tc=getRows(getSheet(S.EXPENSES)).filter(e=>e.plotId===plotId).reduce((s,e)=>s+num(e.amount),0)
  if(!tc) return
  const sh=getSheet(S.COMMITMENTS),d=sh.getDataRange().getValues(),h=d[0]
  for(let i=1;i<d.length;i++) {
    if(d[i][h.indexOf('plotId')]===plotId)
      sh.getRange(i+1,h.indexOf('sharePercent')+1).setValue((num(d[i][h.indexOf('amount')])/tc*100).toFixed(4))
  }
}

// ── SALES ──────────────────────────────────────────────────────
function recordSale(b) {
  const id='SAL-'+Date.now()
  const nr=num(b.salePrice)-num(b.brokerFee||0)
  const exp=getRows(getSheet(S.EXPENSES)).filter(e=>e.plotId===b.plotId)
  const tc=exp.reduce((s,e)=>s+num(e.amount),0)
  const plot=getRows(getSheet(S.PLOTS)).find(p=>p.plotId===b.plotId)
  const pSize=num(plot&&plot.sizeSqft)||1
  const sold=num(b.sizePortionSqft)||pSize
  const cp=tc*(sold/pSize), npl=nr-cp
  getSheet(S.SALES).appendRow([id,b.plotId,b.saleDate,sold,b.salePrice,b.brokerFee||0,nr,npl,b.notes||'',new Date().toISOString()])
  distribute(b.plotId,id,npl,cp)
  return {success:true,saleId:id,netRevenue:nr,netProfitLoss:npl}
}

function editSale(b) {
  const nr=num(b.salePrice)-num(b.brokerFee||0)
  const exp=getRows(getSheet(S.EXPENSES)).filter(e=>e.plotId===b.plotId)
  const tc=exp.reduce((s,e)=>s+num(e.amount),0)
  const plot=getRows(getSheet(S.PLOTS)).find(p=>p.plotId===b.plotId)
  const pSize=num(plot&&plot.sizeSqft)||1
  const sold=num(b.sizePortionSqft)||pSize
  const npl=nr-(tc*(sold/pSize))
  return editRow(S.SALES,'saleId',{...b,netRevenue:nr,netProfitLoss:npl})
}

function deleteSale(b) {
  const ts=getSheet(S.TRANSACTIONS),td=ts.getDataRange().getValues(),th=td[0]
  const ws=getSheet(S.WALLET)
  for(let i=td.length-1;i>=1;i--) {
    if(td[i][th.indexOf('saleId')]===b.saleId) {
      updateWallet(td[i][th.indexOf('investorId')],-num(td[i][th.indexOf('amount')]),ws)
      ts.deleteRow(i+1)
    }
  }
  return deleteRow(S.SALES,'saleId',b.saleId)
}

function distribute(plotId,saleId,npl,cp) {
  const cmm=getRows(getSheet(S.COMMITMENTS)).filter(c=>c.plotId===plotId)
  const ws=getSheet(S.WALLET), ts=getSheet(S.TRANSACTIONS)
  const total=cmm.reduce((s,c)=>s+num(c.amount),0)
  cmm.forEach(c=>{
    const sd=num(c.sharePercent)/100
    const pr=total>0?num(c.amount)*(cp/total):0
    const credit=pr+(npl*sd)
    updateWallet(c.investorId,credit,ws)
    ts.appendRow(['TX-'+Date.now()+'-'+c.investorId,c.investorId,plotId,saleId,
      npl>=0?'PROFIT_DISTRIBUTION':'LOSS_DISTRIBUTION',
      credit.toFixed(2),'Plot '+plotId+' sale - principal + '+(npl>=0?'profit':'loss')+' share',
      new Date().toISOString()])
  })
}

function updateWallet(investorId,amount,ws) {
  const d=ws.getDataRange().getValues(),h=d[0]
  for(let i=1;i<d.length;i++) {
    if(d[i][h.indexOf('investorId')]===investorId) {
      ws.getRange(i+1,h.indexOf('balance')+1).setValue((num(d[i][h.indexOf('balance')])+amount).toFixed(2))
      ws.getRange(i+1,h.indexOf('lastUpdated')+1).setValue(new Date().toISOString())
      return
    }
  }
}

// ── WALLET OPS ─────────────────────────────────────────────────
function processWithdrawal(b) {
  const ws=getSheet(S.WALLET),d=ws.getDataRange().getValues(),h=d[0]
  for(let i=1;i<d.length;i++) {
    if(d[i][h.indexOf('investorId')]===b.investorId) {
      const bal=num(d[i][h.indexOf('balance')])
      if(bal<num(b.amount)) return {error:'Insufficient balance'}
      ws.getRange(i+1,h.indexOf('balance')+1).setValue((bal-num(b.amount)).toFixed(2))
      ws.getRange(i+1,h.indexOf('lastUpdated')+1).setValue(new Date().toISOString())
      getSheet(S.TRANSACTIONS).appendRow(['TX-'+Date.now(),b.investorId,'','','WITHDRAWAL',-num(b.amount),b.notes||'Withdrawal',new Date().toISOString()])
      return {success:true}
    }
  }
  return {error:'Wallet not found'}
}

function reinvest(b) {
  const r=processWithdrawal({investorId:b.investorId,amount:b.amount,notes:'Reinvestment to '+b.plotId})
  if(r.error) return r
  return addCommitment({...b,isReinvestment:true})
}

function adjustWallet(b) {
  const ws=getSheet(S.WALLET),d=ws.getDataRange().getValues(),h=d[0]
  for(let i=1;i<d.length;i++) {
    if(d[i][h.indexOf('investorId')]===b.investorId) {
      const cur=num(d[i][h.indexOf('balance')]), nb=cur+num(b.adjustmentAmount)
      ws.getRange(i+1,h.indexOf('balance')+1).setValue(nb.toFixed(2))
      ws.getRange(i+1,h.indexOf('lastUpdated')+1).setValue(new Date().toISOString())
      getSheet(S.TRANSACTIONS).appendRow(['TX-'+Date.now(),b.investorId,'','','ADJUSTMENT',num(b.adjustmentAmount).toFixed(2),'Manual adjustment: '+(b.reason||'No reason'),new Date().toISOString()])
      return {success:true,previousBalance:cur,newBalance:nb}
    }
  }
  return {error:'Wallet not found'}
}

// ── DASHBOARD ──────────────────────────────────────────────────
function getDashboard() {
  const plots=getPlots(), wallets=getRows(getSheet(S.WALLET))
  const sales=getRows(getSheet(S.SALES)), txns=getRows(getSheet(S.TRANSACTIONS))
  const investors=getInvestors(), cmm=getRows(getSheet(S.COMMITMENTS))
  const activeIds=plots.filter(p=>p.status==='Active').map(p=>p.plotId)
  const totalActiveFunds=cmm.filter(c=>activeIds.includes(c.plotId)).reduce((s,c)=>s+num(c.amount),0)
  const plotSummaries=plots.filter(p=>p.totalPL!==0||p.totalRevenue>0).map(p=>({plotId:p.plotId,plotName:p.name,status:p.status,totalCost:p.totalCost,totalRevenue:p.totalRevenue,totalPL:p.totalPL}))
  // Enrich recent transactions with investor names
  const invMap={}; investors.forEach(i=>invMap[i.investorId]=i.name)
  const recentTxns=txns.slice(-15).reverse().map(t=>({...t,investorName:invMap[t.investorId]||t.investorId}))
  return {
    totalPlots:plots.length, activePlots:plots.filter(p=>p.status==='Active').length,
    soldPlots:plots.filter(p=>p.status==='Sold').length,
    totalDeployed:plots.reduce((s,p)=>s+(p.totalCost||0),0), totalActiveFunds,
    totalInWallets:wallets.reduce((s,w)=>s+num(w.balance),0),
    totalRevenue:sales.reduce((s,x)=>s+num(x.netRevenue||0),0),
    totalPL:sales.reduce((s,x)=>s+num(x.netProfitLoss||0),0),
    totalInvestors:investors.length, plotSummaries, recentTransactions:recentTxns
  }
}

// ── PRINCIPAL RETURNS ──────────────────────────────────────────
// Tracks how much of each investor's principal was returned from a partial sale
function savePrincipalReturns(b) {
  // b.saleId, b.plotId, b.returns = [{investorId, amount}]
  const sh = getSheet(S.PRINCIPAL_RETURNS)
  // Delete existing entries for this sale first (allow re-saving)
  const data = sh.getDataRange().getValues()
  const saleCol = data[0].indexOf('saleId')
  for(let i = data.length-1; i >= 1; i--) {
    if(data[i][saleCol] === b.saleId) sh.deleteRow(i+1)
  }
  // Save new entries
  const entries = b.returns || []
  entries.forEach(r => {
    if(num(r.amount) > 0) {
      sh.appendRow(['PR-'+Date.now()+'-'+r.investorId, b.saleId, b.plotId, r.investorId, r.amount, new Date().toISOString()])
    }
  })
  return {success:true, saved: entries.length}
}

function getPrincipalReturns(saleId) {
  const rows = getRows(getSheet(S.PRINCIPAL_RETURNS))
  return saleId ? rows.filter(r => r.saleId === saleId) : rows
}

// Get total principal returned per investor per plot
function getPrincipalReturnedByPlot(investorId, plotId) {
  const rows = getRows(getSheet(S.PRINCIPAL_RETURNS))
  return rows
    .filter(r => r.investorId === investorId && r.plotId === plotId)
    .reduce((s, r) => s + num(r.amount), 0)
}

// ── REPORT CONFIG ──────────────────────────────────────────────
function getReportConfig() {
  const rows=getRows(getSheet(S.CONFIG))
  const cfg={}; rows.forEach(r=>{cfg[r.key]=r.value}); return {config:cfg}
}

function saveReportConfig(body) {
  const sh=getSheet(S.CONFIG)
  Object.entries(body).forEach(([k,v])=>{
    const d=sh.getDataRange().getValues()
    const row=d.findIndex(r=>r[0]===k)
    if(row>=1) sh.getRange(row+1,2).setValue(v)
    else sh.appendRow([k,v])
  })
  return {success:true}
}

function getConfigVal(key) {
  const rows=getRows(getSheet(S.CONFIG)); const r=rows.find(x=>x.key===key); return r?r.value:''
}

// ── GMAIL REPORTS ─────────────────────────────────────────────
// Call this via Time-based trigger: scheduledReport()
function scheduledReport() {
  const cfg=getReportConfig().config
  if(cfg.enabled!=='true') return
  sendAllReports()
}

function buildEmailHtml({inv, senderName, appUrl, monthName, year, reportDate, walletBal, returns, roi, activeInvestments, completedInvestments, recentTxns, cfg}) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="background:linear-gradient(135deg,#0c1428 0%,#1a2d50 100%);border-radius:16px 16px 0 0;padding:36px 32px;text-align:center;">
    <div style="display:inline-block;background:linear-gradient(135deg,#f0a500,#e06c00);border-radius:14px;width:52px;height:52px;line-height:52px;font-size:26px;margin-bottom:14px;text-align:center;">🏠</div>
    <div style="color:#f0a500;font-size:22px;font-weight:700;letter-spacing:-0.5px;margin-bottom:4px;">${senderName}</div>
    <div style="color:#94a3b8;font-size:13px;">Investment Statement · ${monthName} ${year}</div>
    <div style="margin-top:16px;color:#e2e8f0;font-size:16px;font-weight:500;">Hi ${inv.name} 👋</div>
    <div style="color:#94a3b8;font-size:13px;margin-top:4px;">Here's your portfolio summary as of ${reportDate}</div>
  </td></tr>
  <tr><td style="background:#ffffff;padding:24px 28px 8px;">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:16px;">Portfolio Summary</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="25%" style="padding:0 6px 12px 0;">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:18px;font-weight:700;color:#16a34a;">₹${fmtNum(walletBal)}</div>
            <div style="font-size:11px;color:#64748b;margin-top:3px;">Wallet Balance</div>
          </div>
        </td>
        <td width="25%" style="padding:0 6px 12px 6px;">
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:18px;font-weight:700;color:#2563eb;">₹${fmtNum(returns.cashInvested)}</div>
            <div style="font-size:11px;color:#64748b;margin-top:3px;">Cash Invested</div>
          </div>
        </td>
        <td width="25%" style="padding:0 6px 12px 6px;">
          <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:18px;font-weight:700;color:#7c3aed;">₹${fmtNum(returns.profitCredits)}</div>
            <div style="font-size:11px;color:#64748b;margin-top:3px;">Profit Earned</div>
          </div>
        </td>
        <td width="25%" style="padding:0 0 12px 6px;">
          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:18px;font-weight:700;color:#d97706;">${roi}</div>
            <div style="font-size:11px;color:#64748b;margin-top:3px;">Net ROI</div>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>
  ${activeInvestments.length > 0 && cfg.includeWallet !== 'false' ? `
  <tr><td style="background:#ffffff;padding:8px 28px 20px;">
    <div style="border-top:1px solid #f1f5f9;padding-top:20px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:12px;">📍 Active Investments</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
        <tr style="background:#f8fafc;">
          <th style="padding:8px 10px;text-align:left;color:#64748b;font-weight:600;">Plot</th>
          <th style="padding:8px 10px;text-align:right;color:#64748b;font-weight:600;">Committed</th>
          <th style="padding:8px 10px;text-align:right;color:#64748b;font-weight:600;">Still Locked</th>
          <th style="padding:8px 10px;text-align:right;color:#64748b;font-weight:600;">Share %</th>
        </tr>
        ${activeInvestments.map(p => {
          const locked = p.netLocked !== undefined ? p.netLocked : p.commitment
          const returned = p.principalReturned || 0
          return `<tr style="border-top:1px solid #f1f5f9;">
            <td style="padding:10px 10px;">${p.plotName}<br><span style="font-size:11px;color:#94a3b8;">${p.plotStatus}</span></td>
            <td style="padding:10px 10px;text-align:right;font-weight:600;">₹${fmtNum(p.commitment)}</td>
            <td style="padding:10px 10px;text-align:right;font-weight:600;color:#d97706;">₹${fmtNum(locked)}${returned > 0 ? '<br><span style="font-size:10px;color:#16a34a;">₹'+fmtNum(returned)+' returned</span>' : ''}</td>
            <td style="padding:10px 10px;text-align:right;color:#64748b;">${num(p.sharePercent).toFixed(2)}%</td>
          </tr>`
        }).join('')}
      </table>
    </div>
  </td></tr>` : ''}
  ${cfg.includePL !== 'false' && completedInvestments.length > 0 ? `
  <tr><td style="background:#ffffff;padding:8px 28px 20px;">
    <div style="border-top:1px solid #f1f5f9;padding-top:20px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:12px;">✅ Completed Investments</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
        <tr style="background:#f8fafc;">
          <th style="padding:8px 10px;text-align:left;color:#64748b;font-weight:600;">Plot</th>
          <th style="padding:8px 10px;text-align:right;color:#64748b;font-weight:600;">My P&L</th>
          <th style="padding:8px 10px;text-align:right;color:#64748b;font-weight:600;">Total Received</th>
        </tr>
        ${completedInvestments.map(p => {
          const plColor = p.profitLossShare >= 0 ? '#16a34a' : '#dc2626'
          const plSign  = p.profitLossShare >= 0 ? '+' : ''
          return `<tr style="border-top:1px solid #f1f5f9;">
            <td style="padding:10px 10px;">${p.plotName}</td>
            <td style="padding:10px 10px;text-align:right;font-weight:700;color:${plColor};">${plSign}₹${fmtNum(p.profitLossShare)}</td>
            <td style="padding:10px 10px;text-align:right;font-weight:600;color:#d97706;">₹${fmtNum(p.totalReceived)}</td>
          </tr>`
        }).join('')}
      </table>
    </div>
  </td></tr>` : ''}
  ${cfg.includeTransactions !== 'false' && recentTxns.length > 0 ? `
  <tr><td style="background:#ffffff;padding:8px 28px 20px;">
    <div style="border-top:1px solid #f1f5f9;padding-top:20px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:12px;">📋 Recent Activity</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
        ${recentTxns.map(t => {
          const isPos = num(t.amount) >= 0
          const color = isPos ? '#16a34a' : '#dc2626'
          const sign  = isPos ? '+' : ''
          const d     = new Date(t.createdAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})
          const typeLabel = {PROFIT_DISTRIBUTION:'Profit',LOSS_DISTRIBUTION:'Loss',WITHDRAWAL:'Withdrawal',ADJUSTMENT:'Adjustment',REINVESTMENT:'Reinvestment'}[t.type] || t.type
          return `<tr style="border-top:1px solid #f1f5f9;">
            <td style="padding:9px 10px;color:#94a3b8;font-size:12px;white-space:nowrap;">${d}</td>
            <td style="padding:9px 10px;">
              <span style="font-size:11px;background:${isPos?'#f0fdf4':'#fef2f2'};color:${color};padding:2px 7px;border-radius:999px;font-weight:600;">${typeLabel}</span>
              <div style="font-size:12px;color:#64748b;margin-top:2px;">${t.description||''}</div>
            </td>
            <td style="padding:9px 10px;text-align:right;font-weight:700;color:${color};white-space:nowrap;">${sign}₹${fmtNum(Math.abs(num(t.amount)))}</td>
          </tr>`
        }).join('')}
      </table>
    </div>
  </td></tr>` : ''}
  <tr><td style="background:#ffffff;padding:8px 28px 28px;text-align:center;">
    <div style="border-top:1px solid #f1f5f9;padding-top:24px;">
      <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#f0a500,#e06c00);color:#000;font-weight:700;font-size:14px;padding:13px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;">View Full Dashboard →</a>
    </div>
  </td></tr>
  <tr><td style="background:#1a2035;border-radius:0 0 16px 16px;padding:20px 28px;text-align:center;">
    <div style="color:#94a3b8;font-size:12px;line-height:1.8;">
      Automated statement from <strong style="color:#f0a500;">${senderName}</strong>.<br>
      For queries, reply to this email or contact your investment manager.<br>
      <span style="font-size:11px;color:#475569;">Sent on ${reportDate}</span>
    </div>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

function sendAllReports() {
  const investors = getRows(getSheet(S.INVESTORS))
  const cfg       = getReportConfig().config
  const appUrl    = getConfigVal('appUrl') || 'https://gtham146-droid.github.io/realty-tracker/'
  const senderName= cfg.senderName || 'RealtyTrack'
  let sent = 0, failed = 0, errors = []

  const now       = new Date()
  const monthName = now.toLocaleString('en-IN', {month:'long'})
  const year      = now.getFullYear()
  const reportDate= now.toLocaleDateString('en-IN', {day:'2-digit', month:'long', year:'numeric'})

  investors.forEach(inv => {
    if (!inv.email || !inv.email.includes('@')) return
    try {
      const returns   = getInvestorReturns(inv.investorId)
      const detail    = getInvestorDetail(inv.investorId)
      const walletBal = returns.walletBalance
      const roi       = returns.cashInvested > 0
        ? ((returns.profitCredits / returns.cashInvested) * 100).toFixed(1) + '%' : '—'

      const activeInvestments    = returns.plotBreakdowns.filter(p => ['Active','Partially Sold','On Hold'].includes(p.plotStatus))
      const completedInvestments = returns.plotBreakdowns.filter(p => p.plotStatus === 'Sold')
      const recentTxns           = (detail.transactions || []).slice(-5).reverse()

      const subject = (cfg.subject || 'Your Investment Statement — {month} {year}')
        .replace('{month}', monthName).replace('{year}', year).replace('{name}', inv.name)

      const html = buildEmailHtml({inv, senderName, appUrl, monthName, year, reportDate,
        walletBal, returns, roi, activeInvestments, completedInvestments, recentTxns, cfg})

      GmailApp.sendEmail(inv.email, subject,
        `Hi ${inv.name},\n\nYour RealtyTrack statement for ${monthName} ${year}.\n\nWallet: Rs.${fmtNum(walletBal)}\nProfit: Rs.${fmtNum(returns.profitCredits)}\n\n${appUrl}`,
        { htmlBody: html, name: senderName }
      )
      sent++
    } catch(e) {
      failed++
      errors.push(inv.email + ': ' + e.toString())
      console.error('Failed to send to ' + inv.email + ': ' + e)
    }
  })
  return { success: true, sent, failed, errors }
}

function fmtNum(v) {
  return new Intl.NumberFormat('en-IN').format(Math.round(num(v)))
}

// ── HELPERS ────────────────────────────────────────────────────
function getSheet(n) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n) }
function getRows(sh) {
  const d=sh.getDataRange().getValues(); if(d.length<=1) return []
  const h=d[0]; return d.slice(1).map(r=>{const o={};h.forEach((k,i)=>o[k]=r[i]);return o})
}
function num(v) { return parseFloat(v)||0 }
function getTransactions(investorId) {
  const t=getRows(getSheet(S.TRANSACTIONS)); return investorId?t.filter(x=>x.investorId===investorId):t
}
function getWallet(investorId) {
  return getRows(getSheet(S.WALLET)).find(w=>w.investorId===investorId)||{balance:0}
}

// ── v2 EMAIL FUNCTIONS (replaces any earlier versions) ────────
// Uses no emojis for better email client compatibility
// Includes proper headers to reduce spam likelihood

function buildEmailHtml(o) {
  var inv=o.inv, senderName=o.senderName, appUrl=o.appUrl
  var monthName=o.monthName, year=o.year, reportDate=o.reportDate
  var walletBal=o.walletBal, returns=o.returns, roi=o.roi
  var activeInvestments=o.activeInvestments
  var completedInvestments=o.completedInvestments
  var recentTxns=o.recentTxns, cfg=o.cfg

  // Active investments section
  var aiHtml = ''
  if (activeInvestments.length > 0 && cfg.includeWallet !== 'false') {
    var aiRows = activeInvestments.map(function(p) {
      var locked   = p.netLocked !== undefined ? p.netLocked : p.commitment
      var returned = p.principalReturned || 0
      var retStr   = returned > 0 ? '<br><span style="font-size:11px;color:#16a34a;">Rs.'+fmtNum(returned)+' returned</span>' : ''
      return '<tr style="border-top:1px solid #f1f5f9;">'
        + '<td style="padding:10px 12px;">'+p.plotName+'<br><span style="font-size:11px;color:#94a3b8;">'+p.plotStatus+'</span></td>'
        + '<td style="padding:10px 12px;text-align:right;font-weight:600;">Rs.'+fmtNum(p.commitment)+'</td>'
        + '<td style="padding:10px 12px;text-align:right;font-weight:600;color:#b45309;">Rs.'+fmtNum(locked)+retStr+'</td>'
        + '<td style="padding:10px 12px;text-align:right;color:#64748b;">'+num(p.sharePercent).toFixed(2)+'%</td>'
        + '</tr>'
    }).join('')
    aiHtml = '<tr><td style="background:#ffffff;padding:4px 28px 20px;">'
      + '<div style="border-top:2px solid #f1f5f9;padding-top:20px;">'
      + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:12px;">ACTIVE INVESTMENTS</div>'
      + '<table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;border-collapse:collapse;">'
      + '<tr style="background:#f8fafc;"><th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600;">Plot</th>'
      + '<th style="padding:8px 12px;text-align:right;color:#64748b;font-weight:600;">Committed</th>'
      + '<th style="padding:8px 12px;text-align:right;color:#64748b;font-weight:600;">Still Locked</th>'
      + '<th style="padding:8px 12px;text-align:right;color:#64748b;font-weight:600;">Share %</th></tr>'
      + aiRows
      + '</table></div></td></tr>'
  }

  // Completed investments section
  var ciHtml = ''
  if (cfg.includePL !== 'false' && completedInvestments.length > 0) {
    var ciRows = completedInvestments.map(function(p) {
      var plColor = p.profitLossShare >= 0 ? '#16a34a' : '#dc2626'
      var plSign  = p.profitLossShare >= 0 ? '+' : ''
      return '<tr style="border-top:1px solid #f1f5f9;">'
        + '<td style="padding:10px 12px;">'+p.plotName+'</td>'
        + '<td style="padding:10px 12px;text-align:right;font-weight:700;color:'+plColor+';">'+plSign+'Rs.'+fmtNum(p.profitLossShare)+'</td>'
        + '<td style="padding:10px 12px;text-align:right;font-weight:600;color:#b45309;">Rs.'+fmtNum(p.totalReceived)+'</td>'
        + '</tr>'
    }).join('')
    ciHtml = '<tr><td style="background:#ffffff;padding:4px 28px 20px;">'
      + '<div style="border-top:2px solid #f1f5f9;padding-top:20px;">'
      + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:12px;">COMPLETED INVESTMENTS</div>'
      + '<table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;border-collapse:collapse;">'
      + '<tr style="background:#f8fafc;"><th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600;">Plot</th>'
      + '<th style="padding:8px 12px;text-align:right;color:#64748b;font-weight:600;">My P&amp;L</th>'
      + '<th style="padding:8px 12px;text-align:right;color:#64748b;font-weight:600;">Total Received</th></tr>'
      + ciRows
      + '</table></div></td></tr>'
  }

  // Recent transactions section
  var rtHtml = ''
  if (cfg.includeTransactions !== 'false' && recentTxns.length > 0) {
    var typeLabels = {
      PROFIT_DISTRIBUTION:'Profit Credit', LOSS_DISTRIBUTION:'Loss Deduction',
      WITHDRAWAL:'Withdrawal', ADJUSTMENT:'Adjustment', REINVESTMENT:'Reinvestment'
    }
    var rtRows = recentTxns.map(function(t) {
      var isPos  = num(t.amount) >= 0
      var color  = isPos ? '#16a34a' : '#dc2626'
      var bgCol  = isPos ? '#f0fdf4' : '#fef2f2'
      var sign   = isPos ? '+' : ''
      var d      = new Date(t.createdAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})
      var label  = typeLabels[t.type] || t.type
      return '<tr style="border-top:1px solid #f1f5f9;">'
        + '<td style="padding:9px 12px;color:#94a3b8;font-size:12px;white-space:nowrap;">'+d+'</td>'
        + '<td style="padding:9px 12px;"><span style="font-size:11px;background:'+bgCol+';color:'+color+';padding:2px 8px;border-radius:4px;font-weight:600;">'+label+'</span>'
        + '<div style="font-size:12px;color:#64748b;margin-top:2px;">'+(t.description||'')+'</div></td>'
        + '<td style="padding:9px 12px;text-align:right;font-weight:700;color:'+color+';white-space:nowrap;">'+sign+'Rs.'+fmtNum(Math.abs(num(t.amount)))+'</td>'
        + '</tr>'
    }).join('')
    rtHtml = '<tr><td style="background:#ffffff;padding:4px 28px 20px;">'
      + '<div style="border-top:2px solid #f1f5f9;padding-top:20px;">'
      + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:12px;">RECENT ACTIVITY</div>'
      + '<table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;border-collapse:collapse;">'
      + rtRows
      + '</table></div></td></tr>'
  }

  return '<!DOCTYPE html><html lang="en">'
    + '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">'
    + '<title>'+senderName+' — Investment Statement</title></head>'
    + '<body style="margin:0;padding:0;background:#eef2f7;font-family:\'Segoe UI\',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#eef2f7;padding:32px 16px;">'
    + '<tr><td align="center">'
    + '<table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">'

    // Header
    + '<tr><td style="background:#0c1a35;padding:40px 32px;text-align:center;">'
    + '<div style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#f0a500;letter-spacing:-0.5px;margin-bottom:4px;">'+senderName+'</div>'
    + '<div style="font-size:13px;color:#94a3b8;letter-spacing:0.5px;">INVESTMENT STATEMENT &middot; '+monthName.toUpperCase()+' '+year+'</div>'
    + '<div style="margin-top:20px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.1);">'
    + '<div style="color:#e2e8f0;font-size:17px;font-weight:600;">Hello, '+inv.name+'</div>'
    + '<div style="color:#94a3b8;font-size:13px;margin-top:4px;">Portfolio summary as of '+reportDate+'</div>'
    + '</div></td></tr>'

    // Summary cards
    + '<tr><td style="background:#ffffff;padding:28px 28px 16px;">'
    + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:16px;">PORTFOLIO SUMMARY</div>'
    + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>'
    + '<td width="25%" style="padding:0 5px 0 0;"><div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 10px;text-align:center;">'
    + '<div style="font-size:17px;font-weight:700;color:#16a34a;font-family:Georgia,serif;">Rs.'+fmtNum(walletBal)+'</div>'
    + '<div style="font-size:11px;color:#64748b;margin-top:4px;font-weight:500;">WALLET</div></div></td>'
    + '<td width="25%" style="padding:0 5px;"><div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 10px;text-align:center;">'
    + '<div style="font-size:17px;font-weight:700;color:#2563eb;font-family:Georgia,serif;">Rs.'+fmtNum(returns.cashInvested)+'</div>'
    + '<div style="font-size:11px;color:#64748b;margin-top:4px;font-weight:500;">CASH IN</div></div></td>'
    + '<td width="25%" style="padding:0 5px;"><div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:16px 10px;text-align:center;">'
    + '<div style="font-size:17px;font-weight:700;color:#7c3aed;font-family:Georgia,serif;">Rs.'+fmtNum(returns.profitCredits)+'</div>'
    + '<div style="font-size:11px;color:#64748b;margin-top:4px;font-weight:500;">PROFIT</div></div></td>'
    + '<td width="25%" style="padding:0 0 0 5px;"><div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px 10px;text-align:center;">'
    + '<div style="font-size:17px;font-weight:700;color:#b45309;font-family:Georgia,serif;">'+roi+'</div>'
    + '<div style="font-size:11px;color:#64748b;margin-top:4px;font-weight:500;">NET ROI</div></div></td>'
    + '</tr></table></td></tr>'

    + aiHtml + ciHtml + rtHtml

    // CTA button
    + '<tr><td style="background:#ffffff;padding:12px 28px 32px;text-align:center;">'
    + '<div style="border-top:2px solid #f1f5f9;padding-top:24px;">'
    + '<a href="'+appUrl+'" style="display:inline-block;background:#f0a500;color:#000000;font-weight:700;font-size:14px;padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;font-family:\'Segoe UI\',Arial,sans-serif;">View Full Dashboard</a>'
    + '</div></td></tr>'

    // Footer
    + '<tr><td style="background:#1a2035;padding:22px 28px;text-align:center;">'
    + '<div style="color:#94a3b8;font-size:12px;line-height:1.9;">'
    + 'This is an automated statement from <span style="color:#f0a500;font-weight:600;">'+senderName+'</span>.<br>'
    + 'For any queries, reply to this email or contact your investment manager.<br>'
    + '<span style="color:#475569;font-size:11px;">Generated on '+reportDate+'</span>'
    + '</div></td></tr>'

    + '</table></td></tr></table></body></html>'
}

function sendReportToInvestor(investorId) {
  var investors = getRows(getSheet(S.INVESTORS))
  var inv = investors.find(function(i) { return i.investorId === investorId })
  if (!inv)                              return {success:false, error:'Investor not found'}
  if (!inv.email||!inv.email.includes('@')) return {success:false, error:'No email address on file'}

  var cfg        = getReportConfig().config
  var appUrl     = getConfigVal('appUrl') || ''
  var senderName = cfg.senderName || 'RealtyTrack'
  var now        = new Date()
  var monthName  = now.toLocaleString('en-IN', {month:'long'})
  var year       = now.getFullYear()
  var reportDate = now.toLocaleDateString('en-IN', {day:'2-digit', month:'long', year:'numeric'})
  var subject    = (cfg.subject || 'Your Investment Statement — {month} {year}')
    .replace('{month}', monthName).replace('{year}', year).replace('{name}', inv.name)

  try {
    var returns  = getInvestorReturns(inv.investorId)
    var detail   = getInvestorDetail(inv.investorId)
    var walletBal = returns.walletBalance
    var roi = returns.cashInvested > 0
      ? ((returns.profitCredits / returns.cashInvested) * 100).toFixed(1) + '%' : '0.0%'

    var activeInvestments    = returns.plotBreakdowns.filter(function(p) {
      return ['Active','Partially Sold','On Hold'].indexOf(p.plotStatus) > -1
    })
    var completedInvestments = returns.plotBreakdowns.filter(function(p) {
      return p.plotStatus === 'Sold'
    })
    var recentTxns = (detail.transactions || []).slice(-5).reverse()

    var html = buildEmailHtml({
      inv:inv, senderName:senderName, appUrl:appUrl,
      monthName:monthName, year:year, reportDate:reportDate,
      walletBal:walletBal, returns:returns, roi:roi,
      activeInvestments:activeInvestments,
      completedInvestments:completedInvestments,
      recentTxns:recentTxns, cfg:cfg
    })

    // Plain text fallback (important for spam score)
    var plainText = 'Dear ' + inv.name + ',\n\n'
      + 'Please find your investment statement for ' + monthName + ' ' + year + ' below.\n\n'
      + 'PORTFOLIO SUMMARY\n'
      + '─────────────────\n'
      + 'Wallet Balance : Rs.' + fmtNum(walletBal) + '\n'
      + 'Cash Invested  : Rs.' + fmtNum(returns.cashInvested) + '\n'
      + 'Profit Earned  : Rs.' + fmtNum(returns.profitCredits) + '\n'
      + 'Net ROI        : ' + roi + '\n\n'
      + 'View your full dashboard: ' + appUrl + '\n\n'
      + 'Regards,\n' + senderName + '\n\n'
      + '---\n'
      + 'This is an automated message. Please do not reply directly to this email.\n'
      + 'For queries, contact your investment manager.'

    GmailApp.sendEmail(
      inv.email,
      subject,
      plainText,
      {
        htmlBody: html,
        name: senderName,
        noReply: false,
        replyTo: Session.getActiveUser().getEmail()
      }
    )
    return {success:true, sent:1, email:inv.email}
  } catch(e) {
    return {success:false, error:e.toString()}
  }
}
