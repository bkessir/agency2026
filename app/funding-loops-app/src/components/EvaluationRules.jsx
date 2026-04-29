import React, { useState, useEffect, useCallback } from 'react'

const API = import.meta.env.VITE_API_URL || ''

const FIELD_OPTIONS = [
  { value: 'hops',            label: 'Loop Hops',                unit: 'hops',  type: 'number' },
  { value: 'circularity_pct', label: 'Circularity % of Revenue', unit: '%',     type: 'number' },
  { value: 'program_pct',     label: 'Program Spending %',       unit: '%',     type: 'number' },
  { value: 'active_years',    label: 'Active Years',             unit: 'years', type: 'number' },
  { value: 'is_federated',    label: 'Is Federated / Foundation',unit: '',      type: 'boolean' },
  { value: 'bottleneck_amt',  label: 'Bottleneck Amount ($)',    unit: '$',     type: 'number' },
]

const OPERATOR_OPTIONS = {
  number:  [
    { value: 'eq',  label: '= equals' },
    { value: 'gt',  label: '> greater than' },
    { value: 'gte', label: '>= greater than or equal' },
    { value: 'lt',  label: '< less than' },
    { value: 'lte', label: '<= less than or equal' },
  ],
  boolean: [{ value: 'eq', label: '= is true (1)' }],
}

function conditionLabel(rule) {
  const f = FIELD_OPTIONS.find(o => o.value === rule.condition_field)
  const fieldName = f?.label || rule.condition_field
  const opMap = { eq: '=', gt: '>', gte: '>=', lt: '<', lte: '<=' }
  const op = opMap[rule.condition_operator] || rule.condition_operator
  if (rule.condition_field === 'is_federated') return 'Organisation is federated / foundation'
  const unit = f?.unit || ''
  return `${fieldName} ${op} ${rule.condition_value}${unit}`
}

const EMPTY_RULE = {
  name: '', description: '', rule_type: 'risk',
  condition_field: 'hops', condition_operator: 'eq', condition_value: '',
  score_delta: 1, enabled: true,
}

function RuleBadge({ delta }) {
  const pos = delta > 0
  return (
    <span style={{
      fontWeight: 700, fontSize: 13, padding: '2px 10px', borderRadius: 20,
      background: pos ? '#fef2f2' : '#f0fdf4',
      color: pos ? '#dc2626' : '#16a34a',
      border: `1px solid ${pos ? '#fca5a5' : '#86efac'}`,
      minWidth: 52, textAlign: 'center', display: 'inline-block',
    }}>
      {pos ? '+' : ''}{delta}
    </span>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <div onClick={() => onChange(!checked)} title={checked ? 'Enabled' : 'Disabled'} style={{
      width: 36, height: 20, borderRadius: 10, cursor: 'pointer', flexShrink: 0,
      background: checked ? '#2563eb' : '#cbd5e1', position: 'relative', transition: 'background 0.2s',
    }}>
      <div style={{
        position: 'absolute', top: 2, left: checked ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  )
}

function RuleForm({ initial = EMPTY_RULE, onSave, onCancel, saving }) {
  const [form, setForm] = useState({ ...initial })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const fieldDef = FIELD_OPTIONS.find(f => f.value === form.condition_field)
  const fieldType = fieldDef?.type || 'number'
  const operators = OPERATOR_OPTIONS[fieldType] || OPERATOR_OPTIONS.number
  const handleFieldChange = (val) => {
    const def = FIELD_OPTIONS.find(f => f.value === val)
    set('condition_field', val)
    if (def?.type === 'boolean') { set('condition_operator', 'eq'); set('condition_value', 1) }
  }
  const inp = { padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', background: '#fff', width: '100%', boxSizing: 'border-box' }
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>RULE NAME *</label>
          <input style={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. High circularity risk" />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>TYPE</label>
          <select style={inp} value={form.rule_type} onChange={e => set('rule_type', e.target.value)}>
            <option value="risk">Risk Factor (increases score)</option>
            <option value="mitigation">Mitigating Factor (decreases score)</option>
          </select>
        </div>
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>DESCRIPTION</label>
        <input style={inp} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional explanation" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>FIELD</label>
          <select style={inp} value={form.condition_field} onChange={e => handleFieldChange(e.target.value)}>
            {FIELD_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>OPERATOR</label>
          <select style={inp} value={form.condition_operator} onChange={e => set('condition_operator', e.target.value)} disabled={fieldType === 'boolean'}>
            {operators.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>VALUE</label>
          <input style={inp} type="number" value={form.condition_value} onChange={e => set('condition_value', e.target.value)} disabled={fieldType === 'boolean'} placeholder="threshold" />
        </div>
      </div>
      <div style={{ width: 160 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>SCORE DELTA *</label>
        <input style={inp} type="number" min="-10" max="10" value={form.score_delta} onChange={e => set('score_delta', parseInt(e.target.value) || 0)} placeholder="+4 or -3" />
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>Positive = risk increases, negative = risk decreases</div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving || !form.name.trim()} style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13 }}>
          {saving ? 'Saving...' : 'Save Rule'}
        </button>
      </div>
    </div>
  )
}

function RuleCard({ rule, onToggle, onEdit, onDelete }) {
  const isRisk = rule.rule_type === 'risk'
  const accent = isRisk ? '#dc2626' : '#16a34a'
  const bg = isRisk ? '#fff5f5' : '#f0fdf4'
  const border = isRisk ? '#fca5a5' : '#86efac'
  return (
    <div style={{ background: rule.enabled ? bg : '#f8fafc', border: `1px solid ${rule.enabled ? border : '#e2e8f0'}`, borderRadius: 10, padding: '12px 14px', opacity: rule.enabled ? 1 : 0.55, transition: 'opacity 0.2s' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 2 }}>
            {rule.name}
            {rule.is_default && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 600, color: '#94a3b8', background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, border: '1px solid #e2e8f0' }}>DEFAULT</span>}
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginBottom: rule.description ? 4 : 0 }}>
            When: <span style={{ fontWeight: 600, color: accent }}>{conditionLabel(rule)}</span>
          </div>
          {rule.description && <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>{rule.description}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <RuleBadge delta={rule.score_delta} />
          <Toggle checked={rule.enabled} onChange={() => onToggle(rule)} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={() => onEdit(rule)} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer' }}>Edit</button>
        <button onClick={() => onDelete(rule)} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', cursor: 'pointer' }}>Delete</button>
      </div>
    </div>
  )
}

export default function EvaluationRules() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [applyStatus, setApplyStatus] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true)
      const apiUrl = `${API}/api/rules`
      const r = await fetch(apiUrl)
      const text = await r.text()
      let data
      try { data = JSON.parse(text) } catch(e) { throw new Error(`Non-JSON response (${r.status}): ${text.slice(0, 100)}`) }
      if (!r.ok) throw new Error(data?.error || `Server error ${r.status}`)
      if (!Array.isArray(data)) throw new Error(`Expected array, got: ${typeof data} — ${text.slice(0, 100)}`)
      setRules(data)
      setError(null)
    } catch (e) {
      setError(`Could not load rules — ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])

  const handleToggle = async (rule) => {
    setSaving(true)
    await fetch(`${API}/api/rules/${rule.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...rule, enabled: !rule.enabled }) })
    setSaving(false)
    fetchRules()
  }

  const handleSave = async (form) => {
    setSaving(true)
    try {
      if (editingId) {
        await fetch(`${API}/api/rules/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        setEditingId(null)
      } else {
        await fetch(`${API}/api/rules`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        setShowAddForm(false)
      }
      await fetchRules()
    } finally { setSaving(false) }
  }

  const handleDelete = async (rule) => {
    setSaving(true)
    await fetch(`${API}/api/rules/${rule.id}`, { method: 'DELETE' })
    setSaving(false)
    setConfirmDelete(null)
    fetchRules()
  }

  const handleReset = async () => {
    setResetting(true)
    await fetch(`${API}/api/rules/reset`, { method: 'POST' })
    setResetting(false)
    fetchRules()
  }

  const handleApply = async () => {
    setApplyStatus('running')
    await fetch(`${API}/api/score/run`, { method: 'POST' })
    const poll = setInterval(async () => {
      const st = await fetch(`${API}/api/score/status`).then(r => r.json()).catch(() => ({}))
      if (!st.running) {
        clearInterval(poll)
        setApplyStatus({ ok: true, scored: st.storedCount, elapsed: st.lastResult?.elapsedSec })
        setTimeout(() => setApplyStatus(null), 6000)
      }
    }, 1500)
  }

  const riskRules = rules.filter(r => r.rule_type === 'risk')
  const mitigationRules = rules.filter(r => r.rule_type === 'mitigation')

  const btn = (color, bg, border, disabled) => ({
    padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
    color, background: disabled ? '#e2e8f0' : bg, border: `1px solid ${disabled ? '#cbd5e1' : border}`,
    cursor: disabled ? 'not-allowed' : 'pointer',
  })

  return (
    <div style={{ padding: '16px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>Loop Evaluation Layer</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4, maxWidth: 700 }}>
          These rules score individual <strong>circular funding loops</strong> detected in CRA T3010 filings — not the charity overall.
          Each rule tests a loop attribute (hops, bottleneck $, active years, etc.) and adjusts that loop's <strong>suspicion score (0–10)</strong>.
          The charity-level risk badge (0–30) uses a separate formula based on loop counts and financial ratios.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={btn('#fff','#2563eb','#1d4ed8',false)} onClick={() => { setShowAddForm(true); setEditingId(null) }}>+ Add Rule</button>
        <button style={btn('#475569','#fff','#e2e8f0', resetting)} onClick={handleReset} disabled={resetting}>
          {resetting ? 'Resetting...' : '↺ Reset to Defaults'}
        </button>
        <div style={{ flex: 1 }} />
        <button
          style={btn('#fff', applyStatus === 'running' ? '#93c5fd' : applyStatus?.ok ? '#16a34a' : '#2563eb', '#1d4ed8', applyStatus === 'running')}
          onClick={handleApply} disabled={applyStatus === 'running'}
        >
          {applyStatus === 'running' ? 'Re-scoring...' : applyStatus?.ok ? `Scored ${applyStatus.scored?.toLocaleString()} charities in ${applyStatus.elapsed}s` : '▶ Apply & Re-score'}
        </button>
      </div>

      <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 12, color: '#92400e' }}>
        ⚠️ These rules affect <strong>per-loop suspicion scores (0–10)</strong> visible in the Loop Analysis accordion on each charity page. They do <strong>not</strong> affect the charity-level risk badge score (0–30).
        Toggling or editing saves immediately; loop scores recalculate when you click <strong>Apply & Re-score</strong>.
      </div>

      {showAddForm && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>New Rule</div>
          <RuleForm onSave={handleSave} onCancel={() => setShowAddForm(false)} saving={saving} />
        </div>
      )}

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{error}</div>}

      {loading ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>Loading rules...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
              <span style={{ fontWeight: 700, fontSize: 15, color: '#dc2626' }}>Risk Factors</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{riskRules.filter(r => r.enabled).length}/{riskRules.length} active</span>
            </div>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>When condition is met, the loop's suspicion score <strong>increases</strong> by the delta amount.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {riskRules.length === 0 && <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: 20 }}>No risk rules defined.</div>}
              {riskRules.map(rule => editingId === rule.id
                ? <div key={rule.id}><div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Editing: {rule.name}</div><RuleForm initial={rule} onSave={handleSave} onCancel={() => setEditingId(null)} saving={saving} /></div>
                : <RuleCard key={rule.id} rule={rule} onToggle={handleToggle} onEdit={r => { setEditingId(r.id); setShowAddForm(false) }} onDelete={r => setConfirmDelete(r)} />
              )}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
              <span style={{ fontWeight: 700, fontSize: 15, color: '#16a34a' }}>Mitigating Factors</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{mitigationRules.filter(r => r.enabled).length}/{mitigationRules.length} active</span>
            </div>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>When condition is met, the loop's suspicion score <strong>decreases</strong> — indicating lower fraud likelihood for that specific loop.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {mitigationRules.length === 0 && <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: 20 }}>No mitigating rules defined.</div>}
              {mitigationRules.map(rule => editingId === rule.id
                ? <div key={rule.id}><div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Editing: {rule.name}</div><RuleForm initial={rule} onSave={handleSave} onCancel={() => setEditingId(null)} saving={saving} /></div>
                : <RuleCard key={rule.id} rule={rule} onToggle={handleToggle} onEdit={r => { setEditingId(r.id); setShowAddForm(false) }} onDelete={r => setConfirmDelete(r)} />
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 32, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#334155', marginBottom: 10 }}>Loop Scoring Formula</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'Per-loop score (0–10)', desc: 'Sum of all matching enabled rule deltas for that loop, clamped to 0–10. Visible in the Loop Analysis accordion.' },
            { label: 'Loop weight', desc: 'log(bottleneck $ + 1) — loops moving larger amounts have more influence on the weighted average.' },
            { label: 'Not affected: Charity score (0–30)', desc: 'Uses loop type counts + financial ratios. Separate hardcoded formula, not controlled by these rules.' },
          ].map(({ label, desc }) => (
            <div key={label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Charity-level score formula */}
      <div style={{ marginTop: 20, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ background: '#f1f5f9', padding: '12px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14 }}>🏛️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>Charity Risk Score Formula (0–30)</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>Read-only · hardcoded · not affected by the rules above</div>
          </div>
        </div>
        <div style={{ padding: '16px 20px', background: '#fff' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* Loop Structure */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Loop Structure</div>
              {[
                { condition: '2-hop reciprocal loops', formula: '× 3 pts each', cap: 'max 12', color: '#dc2626' },
                { condition: '3-hop triangular loops', formula: '× 1 pt each', cap: 'max 6', color: '#ea580c' },
                { condition: '4-hop+ longer chains', formula: '× 0.3 pts each', cap: 'max 3', color: '#d97706' },
              ].map(r => (
                <div key={r.condition} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#0f172a', fontWeight: 500 }}>{r.condition}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.formula}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: r.color, background: `${r.color}15`, border: `1px solid ${r.color}30`, borderRadius: 4, padding: '1px 7px' }}>{r.cap}</span>
                </div>
              ))}
            </div>

            {/* Financial Signals */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Financial Signals</div>
              {[
                { condition: 'Program spending < 20%', pts: '+3', color: '#dc2626' },
                { condition: 'Program spending < 50%', pts: '+1', color: '#ea580c' },
                { condition: 'Program spending > 65%', pts: '−2', color: '#16a34a' },
                { condition: 'Circular exposure > 50% of revenue', pts: '+4', color: '#dc2626' },
                { condition: 'Circular exposure > 30% of revenue', pts: '+2', color: '#ea580c' },
                { condition: 'Circular exposure < 5% of revenue', pts: '−2', color: '#16a34a' },
                { condition: 'Federated / foundation structure', pts: '−3', color: '#16a34a' },
              ].map(r => (
                <div key={r.condition} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ flex: 1, fontSize: 12, color: '#0f172a' }}>{r.condition}</div>
                  <span style={{ fontSize: 12, fontWeight: 700, minWidth: 28, textAlign: 'right', color: r.color }}>{r.pts}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 11, color: '#64748b', lineHeight: 1.7 }}>
            <strong style={{ color: '#0f172a' }}>Final score</strong> = sum of all applicable factors, clamped to <strong>0–30</strong>.
            Displayed on charity pages as the <strong>Critical / Elevated / Low Risk</strong> badge.
            To change this formula, a code change to <code style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: 3 }}>server.js → quickCharityScore()</code> is required.
          </div>
        </div>
      </div>

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', marginBottom: 8 }}>Delete Rule?</div>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 20 }}>
              <strong>"{confirmDelete.name}"</strong> will be permanently removed. Use Reset to Defaults to restore built-in rules.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
