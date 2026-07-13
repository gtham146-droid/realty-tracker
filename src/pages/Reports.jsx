import React, { useEffect, useState } from 'react'
import { API } from '../config'
import { Loader, Btn, Field, Input, Select } from '../components/UI.jsx'

export default function Reports() {
  const [config, setConfig]   = useState(null)
  const [saving, setSaving]   = useState(false)
  const [sending, setSending] = useState(false)
  const [msg, setMsg]         = useState(null)
  const [investors, setInvestors] = useState([])

  useEffect(() => {
    API.get('getReportConfig').then(d => setConfig(d.config || {
      enabled: 'true', frequency: 'monthly', dayOfMonth: '1', dayOfWeek: 'Monday',
      senderName: 'RealtyTrack', subject: 'Your Investment Statement — {month} {year}',
      includeWallet: 'true', includePL: 'true', includeTransactions: 'true',
      appUrl: window.location.href.split('#')[0]
    }))
    API.get('getInvestors').then(d => setInvestors(Array.isArray(d) ? d : []))
  }, [])

  const set    = k => e => setConfig(c => ({ ...c, [k]: e.target.value }))
  const toggle = k => e => setConfig(c => ({ ...c, [k]: e.target.checked ? 'true' : 'false' }))

  const save = async () => {
    setSaving(true); setMsg(null)
    const res = await API.post('saveReportConfig', config)
    setSaving(false)
    setMsg(res.success
      ? { type: 'success', text: '✅ Settings saved.' }
      : { type: 'error',   text: res.error || 'Save failed' })
  }

  const sendNow = async () => {
    const eligible = investors.filter(i => i.email?.includes('@'))
    if (!eligible.length) { setMsg({ type: 'error', text: 'No investors have email addresses.' }); return }
    if (!window.confirm(`Send reports to ${eligible.length} investor${eligible.length !== 1 ? 's' : ''} now?`)) return
    setSending(true); setMsg(null)
    const res = await API.post('sendReportsNow', {})
    setSending(false)
    if (res.success) {
      setMsg({ type: 'success', text: `✅ Sent to ${res.sent} investor${res.sent !== 1 ? 's' : ''}${res.failed > 0 ? `. ⚠️ ${res.failed} failed — check Apps Script logs.` : '.'}` })
    } else {
      setMsg({ type: 'error', text: res.error || 'Send failed' })
    }
  }

  if (!config) return <Loader />

  const withEmail    = investors.filter(i => i.email?.includes('@'))
  const withoutEmail = investors.filter(i => !i.email?.includes('@'))

  const scheduleDesc = config.frequency === 'weekly'
    ? `Every ${config.dayOfWeek || 'Monday'}`
    : `${config.dayOfMonth || '1'}${['','st','nd','rd'][config.dayOfMonth] || 'th'} of every month`

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Reports</div>
          <div className="page-sub">Automated investor statements via Gmail</div>
        </div>
        <Btn loading={sending} onClick={sendNow}>📧 Send Now</Btn>
      </div>

      {/* Status message */}
      {msg && (
        <div style={{
          background: msg.type === 'success' ? 'var(--green-soft)' : 'var(--red-soft)',
          border: `1px solid ${msg.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: msg.type === 'success' ? 'var(--green)' : 'var(--red)',
          padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.85rem'
        }}>{msg.text}</div>
      )}

      {/* Recipients */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)' }}>Recipients</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{withEmail.length} will receive · {withoutEmail.length} missing email</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {withEmail.map(inv => (
            <div key={inv.investorId} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 12px', fontSize: '0.8rem' }}>
              <span style={{ fontWeight: 600 }}>{inv.name}</span>
              <span style={{ color: 'var(--text-3)', marginLeft: 6 }}>{inv.email}</span>
            </div>
          ))}
          {withoutEmail.map(inv => (
            <div key={inv.investorId} style={{ background: 'var(--red-soft)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '5px 12px', fontSize: '0.8rem', color: 'var(--red)' }}>
              {inv.name} — no email
            </div>
          ))}
        </div>
      </div>

      {/* Email Settings */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)', marginBottom: 16 }}>Email Settings</div>
        <div className="form-grid" style={{ marginBottom: 14 }}>
          <Field label="Sender Name">
            <Input value={config.senderName || ''} onChange={set('senderName')} placeholder="RealtyTrack" />
          </Field>
          <Field label="Subject Line" hint="Use {name} {month} {year}">
            <Input value={config.subject || ''} onChange={set('subject')} />
          </Field>
          <Field label="Dashboard URL" hint="Shown as button in email footer">
            <Input value={config.appUrl || ''} onChange={set('appUrl')} placeholder="https://..." />
          </Field>
        </div>

        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)', margin: '4px 0 12px' }}>Include in Email</div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
          {[
            ['includeWallet',       '📍 Active investments'],
            ['includePL',           '✅ Completed P&L'],
            ['includeTransactions', '📋 Recent activity'],
          ].map(([k, l]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={config[k] !== 'false'} onChange={toggle(k)}
                style={{ width: 15, height: 15, accentColor: 'var(--gold)', cursor: 'pointer' }} />
              {l}
            </label>
          ))}
        </div>
        <Btn loading={saving} onClick={save}>Save Settings</Btn>
      </div>

      {/* Schedule */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)', marginBottom: 16 }}>⏰ Schedule</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <Field label="Frequency">
            <Select value={config.frequency || 'monthly'} onChange={set('frequency')}>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
            </Select>
          </Field>
          {config.frequency === 'weekly' ? (
            <Field label="Day of Week">
              <Select value={config.dayOfWeek || 'Monday'} onChange={set('dayOfWeek')}>
                {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => <option key={d}>{d}</option>)}
              </Select>
            </Field>
          ) : (
            <Field label="Day of Month" hint="1 – 28">
              <Input type="number" min="1" max="28" value={config.dayOfMonth || '1'} onChange={set('dayOfMonth')} style={{ width: 80 }} />
            </Field>
          )}
        </div>

        {/* Step by step */}
        <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
            Set up automatic sending — one-time setup in Apps Script:
          </div>
          {[
            { n:'1', t: 'Go to script.google.com → open RealtyTrack API project' },
            { n:'2', t: 'Click the ⏰ Triggers icon in the left sidebar' },
            { n:'3', t: '+ Add Trigger (bottom right corner)' },
            { n:'4', t: <span>Function to run: <code style={{ background:'var(--surface3)', padding:'2px 7px', borderRadius:4, color:'var(--gold)', fontSize:'0.8rem' }}>scheduledReport</code></span> },
            { n:'5', t: <span>Event source: <strong>Time-driven</strong></span> },
            { n:'6', t: config.frequency === 'weekly'
                ? <span>Timer type: <strong>Week timer</strong> · Day: <strong>{config.dayOfWeek || 'Monday'}</strong> · Time: <strong>8am–9am</strong></span>
                : <span>Timer type: <strong>Month timer</strong> · Day of month: <strong>{config.dayOfMonth || '1'}</strong> · Time: <strong>8am–9am</strong></span> },
            { n:'7', t: <span>Click <strong>Save</strong> — emails will send automatically {scheduleDesc}</span> },
          ].map(({ n, t }) => (
            <div key={n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ width: 24, height: 24, background: 'var(--gold)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#000', flexShrink: 0, marginTop: 1 }}>{n}</div>
              <div style={{ fontSize: '0.83rem', color: 'var(--text-2)', paddingTop: 3, lineHeight: 1.6 }}>{t}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Email Preview */}
      <div className="card">
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)', marginBottom: 16 }}>Email Preview</div>
        <div style={{ background: '#f0f4f8', borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg,#0c1428,#1a2d50)', padding: '24px 20px', textAlign: 'center' }}>
            <div style={{ background: 'linear-gradient(135deg,#f0a500,#e06c00)', borderRadius: 10, width: 44, height: 44, lineHeight: '44px', fontSize: '22px', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🏠</div>
            <div style={{ color: '#f0a500', fontWeight: 700, fontSize: '1.1rem' }}>{config.senderName || 'RealtyTrack'}</div>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: 3 }}>Investment Statement · Month Year</div>
            <div style={{ color: '#e2e8f0', marginTop: 10, fontWeight: 500, fontSize: '0.9rem' }}>Hi Investor Name 👋</div>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: 3 }}>Here's your portfolio summary</div>
          </div>
          {/* Summary cards */}
          <div style={{ background: '#fff', padding: '16px 16px 8px' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8', marginBottom: 10 }}>Portfolio Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
              {[['Wallet','#f0fdf4','#bbf7d0','#16a34a'],['Cash In','#eff6ff','#bfdbfe','#2563eb'],['Profit','#f5f3ff','#ddd6fe','#7c3aed'],['ROI','#fff7ed','#fed7aa','#d97706']].map(([l,bg,border,c])=>(
                <div key={l} style={{ background:bg, border:`1px solid ${border}`, borderRadius:8, padding:'10px 6px', textAlign:'center' }}>
                  <div style={{ fontWeight:700, color:c, fontSize:'0.9rem' }}>—</div>
                  <div style={{ fontSize:'0.65rem', color:'#64748b', marginTop:2 }}>{l}</div>
                </div>
              ))}
            </div>
            {config.includeWallet !== 'false' && <div style={{ fontSize:'0.75rem', color:'#94a3b8', padding:'8px 0', borderTop:'1px solid #f1f5f9' }}>📍 Active investments table</div>}
            {config.includePL !== 'false' && <div style={{ fontSize:'0.75rem', color:'#94a3b8', padding:'8px 0', borderTop:'1px solid #f1f5f9' }}>✅ Completed investments & P&L</div>}
            {config.includeTransactions !== 'false' && <div style={{ fontSize:'0.75rem', color:'#94a3b8', padding:'8px 0', borderTop:'1px solid #f1f5f9' }}>📋 Recent activity (last 5)</div>}
            <div style={{ textAlign:'center', padding:'14px 0 4px', borderTop:'1px solid #f1f5f9' }}>
              <div style={{ display:'inline-block', background:'linear-gradient(135deg,#f0a500,#e06c00)', color:'#000', fontWeight:700, fontSize:'0.8rem', padding:'9px 22px', borderRadius:8 }}>
                View Full Dashboard →
              </div>
            </div>
          </div>
          {/* Footer */}
          <div style={{ background:'#1a2035', padding:'14px 20px', textAlign:'center' }}>
            <div style={{ color:'#94a3b8', fontSize:'0.72rem', lineHeight:1.8 }}>
              Automated statement from <strong style={{ color:'#f0a500' }}>{config.senderName || 'RealtyTrack'}</strong><br/>
              Reply to this email for queries
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
