// ============================================================
// REALTYTRACK - Apps Script Backend v5
// All reads via doGet (CORS-safe). Google SSO + Gmail reports.
// ============================================================

const S = {
  PLOTS:'Plots', EXPENSES:'Expenses', INVESTORS:'Investors',
  COMMITMENTS:'Commitments', SALES:'Sales', WALLET:'Wallet',
  TRANSACTIONS:'Transactions', USERS:'Users', CONFIG:'Config'
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
    [S.CONFIG]:       ['key','value']
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
    return {
      plotId:c.plotId,plotName:plot?plot.name:'Unknown',plotStatus:plot?plot.status:'—',
      commitment:num(c.amount),sharePercent:num(c.sharePercent),isReinvestment:c.isReinvestment,
      totalReceived,profitLossShare,salesCount:pSales.length
    }
  })

  // Commitment-based (for per-plot breakdown display only)
  const cashInvested=cmm.filter(c=>!isTruthy(c.isReinvestment)).reduce((s,c)=>s+num(c.amount),0)
  const reinvested=cmm.filter(c=>isTruthy(c.isReinvestment)).reduce((s,c)=>s+num(c.amount),0)
  const totalPLShare=plotBreakdowns.reduce((s,p)=>s+p.profitLossShare,0)
  const totalReturns=plotBreakdowns.reduce((s,p)=>s+p.totalReceived,0)
  const walletBalance=wallet?num(wallet.balance):0

  // Transaction-based totals — used for Money Trail reconciliation
  // This is always accurate regardless of plot status (active/partial/sold)
  const txCredits=txns.filter(t=>num(t.amount)>0).reduce((s,t)=>s+num(t.amount),0)
  const txDebits =txns.filter(t=>num(t.amount)<0).reduce((s,t)=>s+Math.abs(num(t.amount)),0)
  const adjustments=txns.filter(t=>t.type==='ADJUSTMENT').reduce((s,t)=>s+num(t.amount),0)
  const profitCredits=txns.filter(t=>t.type==='PROFIT_DISTRIBUTION'||t.type==='LOSS_DISTRIBUTION').reduce((s,t)=>s+num(t.amount),0)
  // withdrawals = money that actually LEFT (including reinvestments out of wallet)
  const withdrawals=txns.filter(t=>t.type==='WITHDRAWAL').reduce((s,t)=>s+Math.abs(num(t.amount)),0)

  // For Money Trail:
  // totalIn  = all credits (profits + positive adjustments) = txCredits
  // totalOut = all debits (withdrawals/reinvestments) + current wallet
  // These must balance: totalIn === totalOut (wallet is what's left)
  const trailTotalIn  = txCredits
  const trailTotalOut = txDebits + walletBalance

  // Currently active funds = totalIn - withdrawn - wallet
  // = money from wallet currently locked in plots
  const activeFunds = txCredits - txDebits - walletBalance

  return {
    investorId, plotBreakdowns,
    // Commitment-based (for display in per-plot table)
    cashInvested, reinvested, totalCommitted: cashInvested+reinvested,
    totalPLShare, totalReturns,
    // Transaction-based (for Money Trail — always balanced)
    trailTotalIn, trailTotalOut, activeFunds,
    withdrawals, adjustments, profitCredits, walletBalance
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

function sendAllReports() {
  const investors=getRows(getSheet(S.INVESTORS))
  const cfg=getReportConfig().config
  const plots=getRows(getSheet(S.PLOTS))
  let sent=0
  investors.forEach(inv=>{
    if(!inv.email||!inv.email.includes('@')) return
    try {
      const detail=getInvestorDetail(inv.investorId)
      const returns=getInvestorReturns(inv.investorId)
      const wallet=getRows(getSheet(S.WALLET)).find(w=>w.investorId===inv.investorId)
      const walletBal=wallet?num(wallet.balance):0
      const now=new Date()
      const monthName=now.toLocaleString('en-IN',{month:'long'})
      const year=now.getFullYear()
      const subject=(cfg.subject||'Your Investment Statement — {month} {year}').replace('{month}',monthName).replace('{year}',year).replace('{name}',inv.name)

      const activeInvestments=returns.plotBreakdowns.filter(p=>p.plotStatus==='Active')
      const completedInvestments=returns.plotBreakdowns.filter(p=>p.plotStatus!=='Active')

      let html=`
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:20px;">
  <div style="background:linear-gradient(135deg,#0d1628,#172238);border-radius:12px;padding:28px 24px;margin-bottom:20px;text-align:center;">
    <div style="font-size:28px;margin-bottom:8px;">🏠</div>
    <div style="color:#f0a500;font-size:1.3rem;font-weight:700;margin-bottom:4px;">RealtyTrack</div>
    <div style="color:#94a3b8;font-size:0.85rem;">Investment Statement — ${monthName} ${year}</div>
  </div>
  <div style="background:#fff;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e2e8f0;">
    <div style="font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">👋 Hello, ${inv.name}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div style="background:#f0fdf4;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:1.2rem;font-weight:700;color:#16a34a;">₹${fmtNum(walletBal)}</div>
        <div style="font-size:0.72rem;color:#64748b;margin-top:2px;">Wallet Balance</div>
      </div>
      <div style="background:#eff6ff;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:1.2rem;font-weight:700;color:#2563eb;">₹${fmtNum(returns.cashInvested)}</div>
        <div style="font-size:0.72rem;color:#64748b;margin-top:2px;">Cash Invested</div>
      </div>
      <div style="background:#f5f3ff;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:1.2rem;font-weight:700;color:#7c3aed;">₹${fmtNum(returns.totalPLShare)}</div>
        <div style="font-size:0.72rem;color:#64748b;margin-top:2px;">Total Profit Earned</div>
      </div>
      <div style="background:#fff7ed;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:1.2rem;font-weight:700;color:#d97706;">${returns.cashInvested>0?((returns.totalPLShare/returns.cashInvested)*100).toFixed(1)+'%':'—'}</div>
        <div style="font-size:0.72rem;color:#64748b;margin-top:2px;">Net ROI</div>
      </div>
    </div>
  </div>`

      if(activeInvestments.length && cfg.includeWallet==='true') {
        html+=`
  <div style="background:#fff;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e2e8f0;">
    <div style="font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">📍 Active Investments</div>
    <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
      <thead><tr style="background:#f8fafc;"><th style="padding:8px;text-align:left;color:#64748b;">Plot</th><th style="padding:8px;text-align:right;color:#64748b;">Committed</th><th style="padding:8px;text-align:right;color:#64748b;">Share %</th></tr></thead>
      <tbody>`
        activeInvestments.forEach(p=>{
          html+=`<tr style="border-top:1px solid #f1f5f9;"><td style="padding:8px;">${p.plotName}</td><td style="padding:8px;text-align:right;font-weight:600;">₹${fmtNum(p.commitment)}</td><td style="padding:8px;text-align:right;color:#64748b;">${num(p.sharePercent).toFixed(2)}%</td></tr>`
        })
        html+=`</tbody></table></div>`
      }

      if(cfg.includePL==='true' && completedInvestments.length) {
        html+=`
  <div style="background:#fff;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e2e8f0;">
    <div style="font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">✅ Completed Investments</div>
    <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
      <thead><tr style="background:#f8fafc;"><th style="padding:8px;text-align:left;color:#64748b;">Plot</th><th style="padding:8px;text-align:right;color:#64748b;">My P&L</th><th style="padding:8px;text-align:right;color:#64748b;">Received</th></tr></thead>
      <tbody>`
        completedInvestments.forEach(p=>{
          const plColor=p.profitLossShare>=0?'#16a34a':'#dc2626'
          html+=`<tr style="border-top:1px solid #f1f5f9;"><td style="padding:8px;">${p.plotName}</td><td style="padding:8px;text-align:right;font-weight:600;color:${plColor};">₹${fmtNum(p.profitLossShare)}</td><td style="padding:8px;text-align:right;color:#f59e0b;font-weight:600;">₹${fmtNum(p.totalReceived)}</td></tr>`
        })
        html+=`</tbody></table></div>`
      }

      if(cfg.includeTransactions==='true') {
        const recentTxns=detail.transactions.slice(-5)
        if(recentTxns.length) {
          html+=`
  <div style="background:#fff;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e2e8f0;">
    <div style="font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">📋 Recent Transactions</div>
    <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
      <thead><tr style="background:#f8fafc;"><th style="padding:8px;text-align:left;color:#64748b;">Date</th><th style="padding:8px;text-align:left;color:#64748b;">Note</th><th style="padding:8px;text-align:right;color:#64748b;">Amount</th></tr></thead>
      <tbody>`
          recentTxns.forEach(t=>{
            const c=num(t.amount)>=0?'#16a34a':'#dc2626'
            const d=new Date(t.createdAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})
            html+=`<tr style="border-top:1px solid #f1f5f9;"><td style="padding:8px;color:#64748b;">${d}</td><td style="padding:8px;">${t.description}</td><td style="padding:8px;text-align:right;font-weight:600;color:${c};">₹${fmtNum(t.amount)}</td></tr>`
          })
          html+=`</tbody></table></div>`
        }
      }

      html+=`
  <div style="text-align:center;padding:16px;color:#94a3b8;font-size:0.75rem;">
    This is an automated statement from RealtyTrack. For queries, contact your investment manager.<br>
    <a href="https://realtytrack.app" style="color:#f0a500;">View Full Dashboard →</a>
  </div>
</div>`

      GmailApp.sendEmail(inv.email, subject, '', {htmlBody: html, name: cfg.senderName||'RealtyTrack'})
      sent++
    } catch(e) {
      console.error('Failed to send to '+inv.email+': '+e)
    }
  })
  return {success:true,sent}
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
