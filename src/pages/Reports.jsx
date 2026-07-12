import React, { useEffect, useState } from 'react'
import { API, fc } from '../config'
import { Loader, Btn, Field, Input, Select, Modal } from '../components/UI'

export default function Reports() {
  const [config, setConfig] = useState(null)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    API.get('getReportConfig').then(d => setConfig(d.config || {
      enabled: 'true', frequency: 'monthly', dayOfMonth: '1', dayOfWeek: 'Monday',
      senderName: 'RealtyTrack', subject: 'Your Investment Statement — {month} {year}',
      includeWallet: 'true', includePL: 'true', includeTransactions: 'true'
    }))
  }, [])

  const set = k => e => setConfig(c => ({ ...c, [k]: e.target.value }))

  const save = async () => {
    setSaving(true); setMsg('')
    const res = await API.post('saveReportConfig', config)
    setSaving(false)
    setMsg(res.success ? '✅ Settings saved.' : `❌ ${res.error}`)
  }

  const sendNow = async () => {
    if (!window.confirm('Send reports to all investors now?')) return
    setSending(true); setMsg('')
    const res = await API.post('sendReportsNow', {})
    setSending(false)
    setMsg(res.success ? `✅ Sent to ${res.sent} investors.` : `❌ ${res.error}`)
  }

  if (!config) return <Loader />

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Reports</div>
          <div className="page-sub">Automated investor statements via Gmail</div>
        </div>
      </div>

      {msg && (
        <div style={{ background: msg.startsWith('✅') ? 'var(--green-soft)' : 'var(--red-soft)', border: `1px solid ${msg.startsWith('✅') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: msg.startsWith('✅') ? 'var(--green)' : 'var(--red)', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.85rem' }}>
          {msg}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)', marginBottom: 16 }}>Schedule Settings</div>
        <div className="form-grid" style={{ marginBottom: 12 }}>
          <Field label="Reports Enabled">
            <Select value={config.enabled} onChange={set('enabled')}>
              <option value="true">Yes — send automatically</option>
              <option value="false">No — disabled</option>
            </Select>
          </Field>
          <Field label="Frequency">
            <Select value={config.frequency} onChange={set('frequency')}>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
            </Select>
          </Field>
          {config.frequency === 'monthly' && (
            <Field label="Day of Month (1–28)">
              <Input type="number" min="1" max="28" value={config.dayOfMonth} onChange={set('dayOfMonth')} />
            </Field>
          )}
          {config.frequency === 'weekly' && (
            <Field label="Day of Week">
              <Select value={config.dayOfWeek} onChange={set('dayOfWeek')}>
                {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => <option key={d}>{d}</option>)}
              </Select>
            </Field>
          )}
        </div>

        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)', margin: '16px 0 12px' }}>Email Content</div>
        <div className="form-grid" style={{ marginBottom: 12 }}>
          <Field label="Sender Name"><Input value={config.senderName} onChange={set('senderName')} /></Field>
          <Field label="Subject Line" hint="Use {month}, {year}, {name}">
            <Input value={config.subject} onChange={set('subject')} />
          </Field>
        </div>

        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)', margin: '16px 0 12px' }}>Include in Report</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          {[['includeWallet', 'Wallet Balance'], ['includePL', 'P&L Summary'], ['includeTransactions', 'Recent Transactions']].map(([k, l]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={config[k] === 'true'} onChange={e => setConfig(c => ({ ...c, [k]: e.target.checked ? 'true' : 'false' }))} style={{ width: 16, height: 16, accentColor: 'var(--gold)' }} />
              {l}
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Btn loading={saving} onClick={save}>Save Settings</Btn>
          <Btn variant="ghost" loading={sending} onClick={sendNow}>📧 Send Now to All Investors</Btn>
        </div>
      </div>

      <div className="card">
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)', marginBottom: 12 }}>How It Works</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-2)', lineHeight: 1.8 }}>
          <p>1. The Apps Script runs a <strong style={{ color: 'var(--text)' }}>time-based trigger</strong> (set it up once in Apps Script → Triggers).</p>
          <p>2. On schedule, it fetches each investor's data and sends a personalized email via Gmail.</p>
          <p>3. Each investor receives their own private email — no group messages.</p>
          <p style={{ marginTop: 12, color: 'var(--text-3)' }}>To set the trigger: In Apps Script editor → click ⏰ Triggers (left sidebar) → Add Trigger → function: <code style={{ background: 'var(--surface2)', padding: '1px 6px', borderRadius: 4, color: 'var(--gold)' }}>scheduledReport</code> → Time-driven → Day/Week timer.</p>
        </div>
      </div>
    </div>
  )
}
