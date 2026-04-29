const API_BASE_URL = import.meta.env.VITE_API_URL || "YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";

// All requests use GET to avoid CORS preflight issues with Apps Script doPost
export const API = {
  get: async (action, params = {}) => {
    const qs = new URLSearchParams({ action, ...params }).toString();
    const res = await fetch(`${API_BASE_URL}?${qs}`, { redirect: "follow" });
    return res.json();
  },
  post: async (action, body = {}) => {
    const qs = new URLSearchParams({ action, data: JSON.stringify(body) }).toString();
    const res = await fetch(`${API_BASE_URL}?${qs}`, { redirect: "follow" });
    return res.json();
  }
};

export const EXPENSE_CATEGORIES = [
  "Base Plot Purchase Price",
  "Brokerage / Commission",
  "Registration & Document Charges",
  "Development / Maintenance Costs",
  "Legal Fees",
  "Survey Charges",
  "Other"
];

export const PLOT_STATUSES = ["Active", "Sold", "Partially Sold", "On Hold"];

export const formatCurrency = (val) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val || 0);

export const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const formatPercent = (v) => `${Number(v || 0).toFixed(2)}%`;
