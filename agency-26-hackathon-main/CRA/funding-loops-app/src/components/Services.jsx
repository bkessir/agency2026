import React, { useState, useEffect, useCallback } from 'react'

const API = 'http://localhost:3000'
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TIMEZONES = [
  'America/Edmonton (MT)', 'America/Vancouver (PT)', 'America/Winnipeg (CT)',
  'America/Toronto (ET)', 'America/Halifax (AT)', 'America/St_Johns (NT)',
]
const REPORT_TYPES = [
  { id: 'new_loops',    label: 'New circular loops detected',       desc: 'Loops not present in the previous run' },
  { id: 'risk_changes', label: 'Risk score changes',                desc: 'Charities whose score changed by ≥2 points' },
  { id: 'top10',        label: 'Top 10 risk summary',               desc: 'Always include the current top 10 leaderboard' },
  { id: 'high_only',   label: 'High & critical risk only',          desc: 'Filter report to score ≥ 20/30' },
  { id: 'full_export', label: 'Full CSV export attached',           desc: 'Attach all detected loops as a CSV file' },
]

function Card({ children, style }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
      padding: '20px 24px', ...style,
    }}>
      {children}
    </div>
  )
}

function SectionHeading({ icon, title, subtitle }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{title}</span>
      </div>
      {subtitle && <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0 26px' }}>{subtitle}</p>}
    </div>
  )
}

function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 40, height: 22, borderRadius: 11,
          background: checked ? '#2563eb' : '#cbd5e1',
          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: checked ? 21 : 3,
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
      {label && <span style={{ fontSize: 13, color: '#334155' }}>{label}</span>}
    </label>
  )
}

function StatusBadge({ status }) {
  const map = {
    idle:    { color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0', dot: '○', label: 'Idle' },
    running: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', dot: '●', label: 'Running' },
    success: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', dot: '✓', label: 'Last run: success' },
    failed:  { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', dot: '✕', label: 'Last run: failed' },
  }
  const s = map[status] || map.idle
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
      color: s.color, background: s.bg, border: `1px solid ${s.border}`,
    }}>
      {s.dot} {s.label}
    </span>
  )
}

export default function Services() {
  // Schedule state
  const [enabled,      setEnabled]     = useState(true)
  const [hour,         setHour]        = useState('02')
  const [minute,       setMinute]      = useState('00')
  const [timezone,     setTimezone]    = useState(TIMEZONES[0])
  const [activeDays,   setActiveDays]  = useState([1, 2, 3, 4, 5]) // Mon–Fri

  // Email state
  const [emails,       setEmails]      = useState(['analyst@cra-risk.ca'])
  const [newEmail,     setNewEmail]    = useState('')
  const [emailError,   setEmailError]  = useState('')

  // Report settings
  const [reportFlags,  setReportFlags] = useState({ new_loops: true, risk_changes: true, top10: true, high_only: false, full_export: false })

  // Simulated run state
  const [serviceStatus, setServiceStatus] = useState('idle')
  const [lastRun,        setLastRun]       = useState('—')
  const [storedCount,    setStoredCount]   = useState(null)
  const [running,        setRunning]       = useState(false)
  const [saved,          setSaved]         = useState(false)
  const [runError,       setRunError]      = useState(null)
  const [distribution,   setDistribution]  = useState(null)

  const fetchStatus = useCallback(() => {
    fetch(`${API}/api/score/status`)
      .then(r => r.json())
      .then(data => {
        setRunning(data.running || false)
        setStoredCount(data.storedCount)
        if (data.lastScoredAt) {
          setLastRun(new Date(data.lastScoredAt).toLocaleString('en-CA', {
            timeZone: 'America/Edmonton', hour12: false,
          }).slice(0, 16) + ' MT')
          setServiceStatus(data.lastResult?.status === 'error' ? 'failed' : 'success')
        }
        if (data.lastResult?.distribution) setDistribution(data.lastResult.distribution)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Poll while running
  useEffect(() => {
    if (!running) return
    const id = setInterval(fetchStatus, 2000)
    return () => clearInterval(id)
  }, [running, fetchStatus])

  const toggleDay = d => setActiveDays(prev =>
    prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort()
  )

  const addEmail = () => {
    const e = newEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setEmailError('Enter a valid email address'); return }
    if (emails.includes(e)) { setEmailError('Already added'); return }
    setEmails(prev => [...prev, e])
    setNewEmail('')
    setEmailError('')
  }

  const removeEmail = addr => setEmails(prev => prev.filter(e => e !== addr))

  const handleRunNow = async () => {
    setRunning(true)
    setServiceStatus('running')
    setRunError(null)
    try {
      const res = await fetch(`${API}/api/score/run`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // Poll until done
      const poll = setInterval(async () => {
        const st = await fetch(`${API}/api/score/status`).then(r => r.json()).catch(() => ({}))
        if (!st.running) {
          clearInterval(poll)
          setRunning(false)
          setStoredCount(st.storedCount)
          if (st.lastScoredAt) {
            setLastRun(new Date(st.lastScoredAt).toLocaleString('en-CA', {
              timeZone: 'America/Edmonton', hour12: false,
            }).slice(0, 16) + ' MT')
          }
          setServiceStatus(st.lastResult?.status === 'error' ? 'failed' : 'success')
          if (st.lastResult?.distribution) setDistribution(st.lastResult.distribution)
          if (st.lastResult?.status === 'error') setRunError(st.lastResult.message)
        }
      }, 1500)
    } catch (err) {
      setRunning(false)
      setServiceStatus('failed')
      setRunError(err.message)
    }
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const hours   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const minutes = ['00', '15', '30', '45']

  return (
    <div style={{ padding: '28px 32px', maxWidth: 860, margin: '0 auto' }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>Services</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          Configure the nightly evaluation job and report delivery settings.
        </p>
      </div>

      {/* Service Status Bar */}
      <Card style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: '#eff6ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>⚙️</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Nightly Evaluation Engine</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Last run: {lastRun}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StatusBadge status={running ? 'running' : serviceStatus} />
          <Toggle checked={enabled} onChange={setEnabled} label={enabled ? 'Enabled' : 'Disabled'} />
          <button
            onClick={handleRunNow}
            disabled={running}
            style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: running ? '#e2e8f0' : '#2563eb', color: running ? '#94a3b8' : '#fff',
              border: 'none', cursor: running ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {running ? '⏳ Running…' : '▶ Run Now'}
          </button>
        </div>
      </Card>

      {/* Score distribution summary (shown after a run) */}
      {distribution && (
        <Card style={{ marginBottom: 20, padding: '14px 24px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 10 }}>
            Last Run Distribution — {storedCount?.toLocaleString()} charities scored
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Critical (≥20)', val: distribution.critical, color: '#dc2626', bg: '#fef2f2' },
              { label: 'High (10–19)',   val: distribution.high,     color: '#ea580c', bg: '#fff7ed' },
              { label: 'Medium (5–9)',   val: distribution.medium,   color: '#d97706', bg: '#fffbeb' },
              { label: 'Low (<5)',       val: distribution.low,      color: '#16a34a', bg: '#f0fdf4' },
            ].map(({ label, val, color, bg }) => (
              <div key={label} style={{ background: bg, border: `1px solid ${color}22`, borderRadius: 8, padding: '8px 14px', minWidth: 110 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color }}>{val?.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{label}</div>
              </div>
            ))}
          </div>
          {runError && <div style={{ marginTop: 10, fontSize: 12, color: '#dc2626' }}>⚠ {runError}</div>}
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Schedule */}
        <Card>
          <SectionHeading icon="🕐" title="Schedule" subtitle="When should the evaluation run?" />

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Run Time
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={hour} onChange={e => setHour(e.target.value)} style={selectStyle}>
                {hours.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <span style={{ color: '#94a3b8', fontWeight: 700 }}>:</span>
              <select value={minute} onChange={e => setMinute(e.target.value)} style={selectStyle}>
                {minutes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>24-hr</span>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Timezone
            </label>
            <select value={timezone} onChange={e => setTimezone(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Days of Week
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {DAYS.map((d, i) => (
                <button
                  key={d}
                  onClick={() => toggleDay(i)}
                  style={{
                    width: 34, height: 34, borderRadius: 8, fontSize: 11, fontWeight: 600,
                    border: activeDays.includes(i) ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: activeDays.includes(i) ? '#eff6ff' : '#f8fafc',
                    color: activeDays.includes(i) ? '#2563eb' : '#94a3b8',
                    cursor: 'pointer',
                  }}
                >{d}</button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 16, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11, color: '#475569' }}>
            📅 Next run: <strong style={{ color: '#0f172a' }}>
              {DAYS[activeDays.find(d => d > new Date().getDay()) ?? activeDays[0]]} at {hour}:{minute} {timezone.split(' ')[1]}
            </strong>
          </div>
        </Card>

        {/* Email Recipients */}
        <Card>
          <SectionHeading icon="📧" title="Report Recipients" subtitle="Email addresses that will receive the nightly report" />

          <div style={{ display: 'flex', gap: 8, marginBottom: emailError ? 4 : 12 }}>
            <input
              type="email"
              value={newEmail}
              onChange={e => { setNewEmail(e.target.value); setEmailError('') }}
              onKeyDown={e => e.key === 'Enter' && addEmail()}
              placeholder="name@organization.ca"
              style={{
                flex: 1, padding: '8px 10px', border: `1px solid ${emailError ? '#fca5a5' : '#e2e8f0'}`,
                borderRadius: 8, fontSize: 12, outline: 'none', color: '#0f172a',
              }}
            />
            <button
              onClick={addEmail}
              style={{
                padding: '8px 14px', borderRadius: 8, background: '#2563eb', color: '#fff',
                border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}
            >+ Add</button>
          </div>
          {emailError && <div style={{ fontSize: 11, color: '#dc2626', marginBottom: 10 }}>{emailError}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
            {emails.length === 0 && (
              <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>
                No recipients yet
              </div>
            )}
            {emails.map(addr => (
              <div key={addr} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', background: '#f8fafc',
                border: '1px solid #e2e8f0', borderRadius: 8,
              }}>
                <span style={{ fontSize: 14 }}>📨</span>
                <span style={{ flex: 1, fontSize: 12, color: '#1e293b' }}>{addr}</span>
                <button
                  onClick={() => removeEmail(addr)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14, padding: '0 4px', lineHeight: 1 }}
                  title="Remove"
                >×</button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8' }}>
            {emails.length} recipient{emails.length !== 1 ? 's' : ''} · reports sent after each evaluation run
          </div>
        </Card>
      </div>

      {/* Report Contents */}
      <Card style={{ marginBottom: 20 }}>
        <SectionHeading icon="📄" title="Report Contents" subtitle="Choose what to include in each emailed report" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {REPORT_TYPES.map(rt => (
            <label key={rt.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
              background: reportFlags[rt.id] ? '#eff6ff' : '#f8fafc',
              border: `1px solid ${reportFlags[rt.id] ? '#bfdbfe' : '#e2e8f0'}`,
              borderRadius: 10, cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={!!reportFlags[rt.id]}
                onChange={() => setReportFlags(prev => ({ ...prev, [rt.id]: !prev[rt.id] }))}
                style={{ marginTop: 2, accentColor: '#2563eb', flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: reportFlags[rt.id] ? '#1d4ed8' : '#334155' }}>
                  {rt.label}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{rt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </Card>

      {/* Save bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button
          onClick={() => {
            setEnabled(true); setHour('02'); setMinute('00'); setTimezone(TIMEZONES[0])
            setActiveDays([1,2,3,4,5]); setReportFlags({ new_loops: true, risk_changes: true, top10: true, high_only: false, full_export: false })
          }}
          style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
        >Reset to Defaults</button>
        <button
          onClick={handleSave}
          style={{
            padding: '9px 24px', borderRadius: 8, border: 'none',
            background: saved ? '#16a34a' : '#2563eb', color: '#fff',
            fontSize: 13, cursor: 'pointer', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >{saved ? '✓ Saved' : 'Save Settings'}</button>
      </div>
    </div>
  )
}

const selectStyle = {
  padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8,
  fontSize: 12, color: '#0f172a', background: '#fff', outline: 'none',
}
