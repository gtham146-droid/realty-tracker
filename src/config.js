export const API_URL = import.meta.env.VITE_API_URL || ''
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export const API = {
  get: async (action, params = {}) => {
    const qs = new URLSearchParams({ action, ...params }).toString()
    const res = await fetch(`${API_URL}?${qs}`, { redirect: 'follow' })
    if (!res.ok) throw new Error('Network error')
    return res.json()
  },
  post: async (action, body = {}) => {
    const qs = new URLSearchParams({ action, data: JSON.stringify(body) }).toString()
    const res = await fetch(`${API_URL}?${qs}`, { redirect: 'follow' })
    if (!res.ok) throw new Error('Network error')
    return res.json()
  }
}

export const EXPENSE_CATS = [
  'Base Plot Purchase Price',
  'Brokerage / Commission',
  'Registration & Document Charges',
  'Development / Maintenance Costs',
  'Legal Fees',
  'Survey Charges',
  'Other'
]

export const PLOT_STATUSES = ['Active', 'Sold', 'Partially Sold', 'On Hold']

// Format Indian currency
export const fc = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0)

// Format date
export const fd = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// Format percent
export const fp = (v) => `${Number(v || 0).toFixed(2)}%`

// Normalise Google Sheets boolean (stored as TRUE/FALSE string)
export const isTruthy = (v) => v === true || v === 'TRUE' || v === 1 || v === 'true'
