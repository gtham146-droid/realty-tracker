# 🏗 RealtyTrack — Real Estate Investment & Syndication Tracker

A full-stack web app for managing real estate syndication: plots, investors, expenses, sales, and wallets.

**Stack:** React (frontend) · Google Sheets + Apps Script (backend) · GitHub Pages (hosting)

---

## 🗺 Architecture Overview

```
GitHub Pages (React SPA)
        │
        │  fetch() API calls
        ▼
Google Apps Script (Web App URL)
        │
        │  SpreadsheetApp
        ▼
Google Sheets (Database)
```

---

## 📋 Step-by-Step Setup

### Step 1 — Set Up Google Sheets Backend

1. Go to [Google Sheets](https://sheets.google.com) → create a **New Blank Spreadsheet**
2. Name it: `RealtyTrack Database`
3. Go to **Extensions → Apps Script**
4. Delete any existing code and **paste the entire contents** of `apps-script/Code.gs`
5. Click **Save** (💾 icon), name the project `RealtyTrack API`
6. In the Apps Script editor, select the function `setupSheets` from the dropdown and click **▶ Run**
   - Grant permissions when asked (this is your own Google account)
   - You'll see an alert: "✅ Setup complete!"
7. Now deploy as Web App:
   - Click **Deploy → New Deployment**
   - Type: **Web App**
   - Description: `v1`
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**
8. **Copy the Web App URL** — you'll need it in Step 3

> ⚠️ **Important:** Every time you edit `Code.gs`, you must create a **New Deployment** (not update existing) to apply changes.

---

### Step 2 — Set Up GitHub Repository

1. Create a new GitHub repository (e.g., `realty-tracker`)
2. Push all project files to the `main` branch:

```bash
cd realty-tracker
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/realty-tracker.git
git push -u origin main
```

3. In your GitHub repo → **Settings → Pages**
   - Source: **GitHub Actions**

4. Add your Apps Script URL as a secret:
   - **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `REACT_APP_API_URL`
   - Value: *(paste your Apps Script Web App URL from Step 1)*

5. Go to **Actions** tab → the workflow will run automatically on push
6. Once complete, your app is live at: `https://YOUR_USERNAME.github.io/realty-tracker/`

---

### Step 3 — (Optional) Local Development

```bash
npm install
# Create a .env file:
echo "REACT_APP_API_URL=YOUR_APPS_SCRIPT_URL" > .env
npm start
```

---

## 🔐 Default Login

| Username | Password | Role  |
|----------|----------|-------|
| admin    | admin123 | Admin |

> **Change this immediately** by editing the `Users` sheet in Google Sheets and updating the password hash, or add a change-password feature.

---

## 📊 Google Sheet Structure (auto-created)

| Sheet | Purpose |
|-------|---------|
| `Users` | Login credentials (hashed passwords) |
| `Plots` | Plot projects |
| `Expenses` | Expense ledger per plot |
| `Investors` | Investor KYC data |
| `Commitments` | Investor → Plot funding commitments |
| `Sales` | Sale records |
| `Wallet` | Investor virtual wallets |
| `Transactions` | Full audit trail |

---

## 🧩 Feature Map (from BRD)

| BRD Requirement | Implemented |
|----------------|-------------|
| FR-1.01 Plot Listing | ✅ Add/view plots with location, size, price |
| FR-1.02 Expense Ledger | ✅ Categorized expenses per plot + receipt URL |
| FR-1.03 Total Cost Calc | ✅ Auto-calculated from expenses |
| FR-2.01 Investor Profiles | ✅ KYC + bank details stored |
| FR-2.02 Commitment Tracking | ✅ Per-plot investor commitments |
| FR-2.03 Share Calculation | ✅ Auto-recalculated on each commitment |
| FR-2.04 Company Share | ✅ Gap auto-assigned to company |
| FR-3.01 Sale Execution | ✅ Mark plot sold via Admin |
| FR-3.02 Partial Sales | ✅ Sell by portion size |
| FR-3.03 Selling Expenses | ✅ Broker fee deducted from net revenue |
| FR-3.04 P&L Calculation | ✅ Net Revenue − Prorated Acquisition Cost |
| FR-4.01 Ledger Distribution | ✅ Auto-distributed on sale by share % |
| FR-4.02 Investor Wallet | ✅ Virtual wallet credited post-sale |
| FR-4.03 Payout / Reinvest | ✅ Admin can withdraw or reinvest from wallet |
| FR-5.01 Admin Dashboard | ✅ Capital deployed, revenue, P&L, wallet totals |
| FR-5.02 Investor Dashboard | ✅ Personal ROI, wallet, investments view |
| Transaction Logs | ✅ Every action timestamped with TX ID |
| Expense Receipts | ✅ Google Drive URL stored per expense |

---

## 🔧 Customization Tips

- **Add users manually:** Open the `Users` sheet → add row with `USR-xxx`, username, hashed password (`H` + hash), `admin` or `investor`, investorId (for investors), date
- **Expense categories:** Edit `EXPENSE_CATEGORIES` in `src/config.js`
- **Currency:** Change `INR` in `formatCurrency()` in `src/config.js`
- **Logo/branding:** Edit `.login-logo` and sidebar in `App.css`

---

## 🚀 Deployment Updates

Any `git push` to `main` triggers an automatic redeploy via GitHub Actions. No manual steps needed after initial setup.

For Apps Script changes:
1. Edit `Code.gs` in the Apps Script editor
2. Deploy → **New Deployment** (important: not "Manage deployments" → update)
3. Copy new URL → update GitHub secret `REACT_APP_API_URL`
4. Push a small change to trigger a new React build

---

## ⚠️ Known Limitations

- **CORS:** Google Apps Script `doGet`/`doPost` responses do not include CORS headers in all cases. If you see CORS errors during local dev, deploy to GitHub Pages or use a CORS proxy for testing.
- **Concurrency:** Google Sheets has ~60 req/min per user limit. Fine for small syndicates (<50 investors).
- **Receipt Upload:** Currently stores a Drive share link. For direct upload, integrate Google Drive API separately.
- **Password Security:** The hash is a simple integer hash. For production use, consider using Google Identity or a proper auth provider.
