import React, { useState, useMemo, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { fetchCharity, fetchLoops, fetchFinancials } from '../api/client.js'
import { downloadSTRPDF } from '../utils/generateSTRPDF.js'
import { fmt$, fmtN, fmtPct, getRiskLevel } from '../utils/formatters.js'
import { categoryLabel } from '../utils/categoryLookup.js'
import 'boxicons/css/boxicons.min.css'

const LoopCloud3D = React.lazy(() => import('./LoopCloud3D.jsx'))

class GraphErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div style={{ padding: '20px', color: '#64748b', fontSize: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
        3D graph error: {this.state.error.message}
      </div>
    )
    return this.props.children
  }
}

function Skeleton({ height = 20, style = {} }) {
  return (
    <div style={{
      height,
      background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      borderRadius: 6,
      ...style,
    }} />
  )
}

function InfoTip({ tip }) {
  const [show, setShow] = useState(false)
  return (
    <span
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 4, cursor: 'help', verticalAlign: 'middle' }}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ display: 'block' }}>
        <circle cx="8" cy="8" r="7.5" stroke="#94a3b8" strokeWidth="1"/>
        <text x="8" y="12" textAnchor="middle" fontSize="10" fill="#94a3b8" fontFamily="sans-serif" fontWeight="700">i</text>
      </svg>
      {show && (
        <div style={{
          position: 'absolute', bottom: '120%', left: '50%', transform: 'translateX(-50%)',
          background: '#1e293b', color: '#f1f5f9', fontSize: 11, lineHeight: 1.5,
          padding: '6px 10px', borderRadius: 6, zIndex: 100,
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)', width: 220, whiteSpace: 'normal',
          pointerEvents: 'none',
        }}>
          {tip}
          <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #1e293b' }} />
        </div>
      )}
    </span>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 700,
      color: '#64748b',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      marginBottom: 12,
      paddingBottom: 8,
      borderBottom: '1px solid #e2e8f0',
    }}>{children}</div>
  )
}

function RiskGauge({ score, appScore }) {
  const displayScore = appScore ?? score ?? 0
  const risk = getRiskLevel(displayScore)
  const pct = Math.min(100, (displayScore / 30) * 100)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '12px 0' }}>
      <div style={{ position: 'relative', width: 120, height: 80, flexShrink: 0 }}>
        <svg viewBox="0 0 120 80" style={{ overflow: 'visible' }}>
          <path d="M 15 70 A 45 45 0 1 1 105 70" fill="none" stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round" />
          <path d="M 15 70 A 45 45 0 1 1 105 70" fill="none" stroke={risk.color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 141.3} 141.3`}
            style={{ transition: 'stroke-dasharray 1s ease' }} />
          <text x="60" y="68" textAnchor="middle" fontSize="22" fontWeight="800" fill={risk.color}>{displayScore}</text>
          <text x="60" y="80" textAnchor="middle" fontSize="8" fill="#94a3b8">/ 30</text>
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { label: 'Low', min: 0, max: 4, color: '#10b981' },
            { label: 'Medium', min: 5, max: 9, color: '#8b5cf6' },
            { label: 'High', min: 10, max: 19, color: '#f59e0b' },
            { label: 'Critical', min: 20, max: 30, color: '#ef4444' },
          ].map(band => (
            <div key={band.label} style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 4,
              background: displayScore >= band.min && displayScore <= band.max ? `${band.color}18` : '#f1f5f9',
              color: displayScore >= band.min && displayScore <= band.max ? band.color : '#94a3b8',
              border: `1px solid ${displayScore >= band.min && displayScore <= band.max ? band.color + '50' : '#e2e8f0'}`,
              fontWeight: 700,
            }}>{band.label}</div>
          ))}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: risk.color, marginTop: 8 }}>{risk.label} Risk</div>
        <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            TNA Score: <strong style={{ color: risk.color }}>{displayScore}/30</strong>
          </div>
          {appScore != null && score != null && appScore !== score && (
            <div style={{ fontSize: 11, color: '#94a3b8' }} title="Original pre-computed DB score">
              DB Score: {score}/30
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const CustomAreaTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
    }}>
      <div style={{ color: '#1e293b', fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{fmt$(p.value)}</strong>
        </div>
      ))}
    </div>
  )
}

function FinancialChart({ data, loading }) {
  if (loading) return <Skeleton height={180} />
  if (!data?.length) return <div style={{ color: '#64748b', fontSize: 12, padding: '20px 0' }}>No financial data available</div>

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          {[
            { id: 'rev',  color: '#3b82f6' },
            { id: 'exp',  color: '#94a3b8' },
            { id: 'gin',  color: '#93c5fd' },
            { id: 'gout', color: '#cbd5e1' },
          ].map(g => (
            <linearGradient key={g.id} id={`grad-${g.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={g.color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={g.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false}
          tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v} />
        <Tooltip content={<CustomAreaTooltip />} />
        <Area type="monotone" dataKey="revenue"       name="Revenue"       stroke="#3b82f6" fill="url(#grad-rev)"  strokeWidth={2}   dot={false} />
        <Area type="monotone" dataKey="expenditures"  name="Expenditures"  stroke="#94a3b8" fill="url(#grad-exp)"  strokeWidth={2}   dot={false} />
        <Area type="monotone" dataKey="giftsIn"       name="Gifts In"      stroke="#93c5fd" fill="url(#grad-gin)"  strokeWidth={1.5} dot={false} />
        <Area type="monotone" dataKey="giftsOut"      name="Gifts Out"     stroke="#cbd5e1" fill="url(#grad-gout)" strokeWidth={1.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function SpendingDonut({ charity }) {
  if (!charity) return null
  const total = (charity.programSpending || 0) + (charity.admin || 0) + (charity.fundraising || 0)
  if (!total) return <div style={{ color: '#64748b', fontSize: 12 }}>No spending data</div>

  const slices = [
    { name: 'Program', value: charity.programSpending || 0, color: '#3b82f6' },
    { name: 'Admin', value: charity.admin || 0, color: '#93c5fd' },
    { name: 'Fundraising', value: charity.fundraising || 0, color: '#cbd5e1' },
  ].filter(s => s.value > 0)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <PieChart width={160} height={160}>
        <Pie
          data={slices}
          cx={75}
          cy={75}
          innerRadius={42}
          outerRadius={68}
          paddingAngle={2}
          dataKey="value"
          strokeWidth={0}
        >
          {slices.map((s, i) => <Cell key={i} fill={s.color} />)}
        </Pie>
      </PieChart>
      <div style={{ flex: 1 }}>
        {slices.map(s => (
          <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
              <span style={{ fontSize: 12, color: '#475569' }}>{s.name}</span>
            </div>
            <span style={{ fontSize: 12, color: '#1e293b', fontWeight: 600 }}>
              {fmtPct((s.value / total) * 100)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function NewspaperFinding({ charity, loops, displayScore }) {
  const data = useMemo(() => {
    if (!charity) return null
    const name      = charity.name || 'This charity'
    const score     = displayScore || 0
    const risk      = getRiskLevel(score)
    const h2        = charity.loops?.h2 || 0
    const h3        = charity.loops?.h3 || 0
    const total     = charity.totalLoops || 0
    const circular  = charity.totalCircular || 0
    const revenue   = charity.revenue || 0
    const program   = charity.programPct || 0
    const giftsOut  = charity.giftsOut || 0
    const circRatio = revenue > 0 ? circular / revenue : 0
    const isPassThrough = program < 5 && revenue > 0 && giftsOut > revenue * 0.3
    const topLoop   = loops?.length > 0 ? [...loops].sort((a, b) => (b.bottleneck || 0) - (a.bottleneck || 0))[0] : null

    // Build a punchy headline
    let headline = ''
    if (h2 > 0 && circular > 0) {
      headline = `${fmt$(circular)} in Suspected Circular Gifting — ${h2} Direct Reciprocal Exchange${h2 > 1 ? 's' : ''} Detected`
    } else if (isPassThrough && circular > 0) {
      headline = `${fmt$(circular)} Cycled Through Pass-Through Charity With ${fmtPct(program)} Program Spending`
    } else if (circular > 0 && h3 > 0) {
      headline = `${fmt$(circular)} in ${h3}-Party Circular Funding Chains Flagged`
    } else if (score >= 20) {
      headline = `Critical Risk: ${total} Circular Funding Loop${total !== 1 ? 's' : ''} Detected in CRA Filings`
    } else if (score >= 10) {
      headline = `${total} Circular Funding Loop${total !== 1 ? 's' : ''} Flagged for Compliance Review`
    } else {
      headline = `${total} Circular Funding Pattern${total !== 1 ? 's' : ''} Identified in CRA T3010 Filings`
    }

    // Build 1-2 sentence finding
    const sentences = []

    // Primary finding
    if (h2 > 0) {
      sentences.push(
        `${name} participated in ${h2 === 1 ? 'a direct reciprocal exchange' : `${h2} direct reciprocal exchanges`} where funds flowed in a complete circle between charities — the pattern most associated with inflated donation receipt schemes under CRA scrutiny.`
      )
    } else if (isPassThrough) {
      sentences.push(
        `${name} directed ${fmtPct(Math.round(giftsOut / revenue * 100))} of its revenue as gifts to other charities while spending only ${fmtPct(program)} on charitable programs, a profile consistent with a pass-through funding vehicle rather than an operating charity.`
      )
    } else if (topLoop) {
      sentences.push(
        `The largest identified loop — a ${topLoop.hops}-party chain with a bottleneck of ${fmt$(topLoop.bottleneck)} — ran from ${(topLoop.minYear || '?')} to ${(topLoop.maxYear || '?')}, suggesting a sustained and structured circular arrangement.`
      )
    }

    // Secondary finding (financial context)
    if (circRatio > 0.3 && sentences.length < 2) {
      sentences.push(
        `In total, ${fmt$(circular)} — representing ${fmtPct(Math.round(circRatio * 100))} of the charity's reported revenue — flowed through detected circular paths across ${total} loops in CRA T3010 filings (2020–2024).`
      )
    } else if (program < 20 && sentences.length < 2) {
      sentences.push(
        `With only ${fmtPct(program)} of revenue allocated to charitable programs, the organization's financial structure raises concerns about whether donated funds are reaching genuine beneficiaries.`
      )
    } else if (sentences.length < 2 && total > 0) {
      sentences.push(
        `A total of ${fmt$(circular)} was identified across ${total} circular loop${total !== 1 ? 's' : ''} in CRA T3010 filings (2020–2024), warranting targeted compliance review.`
      )
    }

    return { headline, sentences, risk, score }
  }, [charity, loops, displayScore])

  if (!data) return null
  const { headline, sentences, risk } = data
  const accent = risk.color
  const evalDate = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })

  return (
    <div style={{
      border: '1.5px solid #e2e8f0',
      borderRadius: 10,
      background: '#fff',
      overflow: 'hidden',
    }}>
      {/* Label bar */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#94a3b8" stroke="none">
            <path d="M12 2 L13.5 9 L20 12 L13.5 15 L12 22 L10.5 15 L4 12 L10.5 9 Z"/>
          </svg>
          AI-Powered Analysis
        </span>
        <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Evaluated on {evalDate}</span>
      </div>

      {/* Headline */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', lineHeight: 1.35, marginBottom: 10 }}>
          {headline}
        </div>

        {/* Body sentences */}
        <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.7, marginBottom: 14 }}>
          {sentences.map((s, i) => (
            <p key={i} style={{ margin: i === 0 ? 0 : '8px 0 0' }}>{s}</p>
          ))}
        </div>
      </div>

    </div>
  )
}

// Keep old banner as alias (no longer used but avoids orphan ref)
function RiskNarrativeBanner({ charity, loops, liveScore }) {
  return <NewspaperFinding charity={charity} loops={loops} displayScore={liveScore} />
}

function LoopTimeline({ activeYears = [], fpeByYear = {} }) {
  const ALL_YEARS = [2020, 2021, 2022, 2023, 2024]
  const active = new Set(activeYears)
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
      {ALL_YEARS.map(yr => {
        const isActive = active.has(yr)
        const quarter = fpeByYear[yr]
        const label = quarter ? `Q${quarter} ${yr}` : `${yr}`
        return (
          <div key={yr} title={isActive ? `Loop active · reported in ${label}` : `No loop activity in ${yr}`} style={{
            padding: '3px 8px',
            borderRadius: 4,
            fontSize: 10,
            fontWeight: isActive ? 700 : 400,
            background: isActive ? '#eff6ff' : '#f8fafc',
            color: isActive ? '#2563eb' : '#cbd5e1',
            border: `1px solid ${isActive ? '#bfdbfe' : '#e2e8f0'}`,
            cursor: 'default',
            transition: 'all 0.1s',
          }}>
            {isActive ? label : yr}
          </div>
        )
      })}
      {activeYears.length === 0 && (
        <span style={{ fontSize: 10, color: '#94a3b8' }}>Year data unavailable</span>
      )}
    </div>
  )
}

function getLoopFlags(loop, charity) {
  const flags = []
  const revenue = charity?.revenue || 0
  const programPct = charity?.programPct || 0
  const bottleneck = loop.bottleneck || 0
  const circularity = revenue > 0 ? (bottleneck / revenue) : 0
  const score = loop.suspicionScore ?? 0

  // Use the server-computed suspicion score to drive visual severity
  if (loop.hops === 2) {
    flags.push({
      label: 'RECIPROCAL', dot: '🔴',
      color: '#ef4444', bg: '#fef2f2', border: '#fecaca',
      tip: '2-hop exchange — direct back-and-forth consistent with donation receipt inflation',
    })
  }
  if (circularity > 0.3) {
    flags.push({
      label: 'HIGH CIRCULARITY', dot: '🟡',
      color: '#b45309', bg: '#fffbeb', border: '#fde68a',
      tip: `Loop bottleneck is ${fmtPct(circularity * 100)} of total charity revenue`,
    })
  }
  if (programPct < 20 && loop.hops <= 3) {
    flags.push({
      label: 'PASS-THROUGH', dot: '🟡',
      color: '#b45309', bg: '#fffbeb', border: '#fde68a',
      tip: 'Charity has low program spending — may be routing funds rather than running programs',
    })
  }
  if ((loop.activeYears || []).length <= 1) {
    flags.push({
      label: 'TEMPORAL BURST', dot: '🟡',
      color: '#b45309', bg: '#fffbeb', border: '#fde68a',
      tip: 'Loop only active in a single year — consistent with hit-and-run receipt generation',
    })
  }
  if (bottleneck < 10000) {
    flags.push({
      label: 'LOW IMPACT', dot: '⚪',
      color: '#64748b', bg: '#f8fafc', border: '#e2e8f0',
      tip: 'Bottleneck under $10K — likely incidental or administrative in nature',
    })
  }
  // Likely valid: no red/amber flags + healthy program spending + multi-hop
  if (!flags.some(f => f.color === '#ef4444' || f.color === '#b45309') && programPct > 65 && loop.hops >= 3) {
    flags.push({
      label: 'LIKELY VALID', dot: '🟢',
      color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0',
      tip: 'Multi-hop loop with healthy program spending — consistent with federated/granting structures',
    })
  }
  // Suspicion score badge
  if (score >= 7) {
    flags.push({
      label: `RISK ${score}/10`, dot: '🔴',
      color: '#dc2626', bg: '#fef2f2', border: '#fecaca',
      tip: `TNA suspicion score: ${score}/10 — high fraud probability`,
    })
  } else if (score >= 4) {
    flags.push({
      label: `RISK ${score}/10`, dot: '🟡',
      color: '#b45309', bg: '#fffbeb', border: '#fde68a',
      tip: `TNA suspicion score: ${score}/10 — moderate concern`,
    })
  } else if (score < 4) {
    flags.push({
      label: `RISK ${score}/10`, dot: '🟢',
      color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0',
      tip: `TNA suspicion score: ${score}/10 — low concern`,
    })
  }
  return flags
}


function AIAnalysis({ charity, loops, financials }) {
  const narrative = useMemo(() => {
    if (!charity) return ''

    const name = charity.name || 'This charity'
    const loopCount = charity.totalLoops || 0
    const h2 = charity.loops?.h2 || 0
    const score = (charity.appScore ?? charity.score) || 0
    const risk = getRiskLevel(score)
    const overhead = charity.overheadPct || 0
    const program = charity.programPct || 0
    const circular = charity.totalCircular || 0
    const revenue = charity.revenue || 0
    const giftsOut = charity.giftsOut || 0
    const govPct = revenue > 0 ? ((charity.giftsIn || 0) / revenue) * 100 : 0
    // Detect pass-through / Donor Advised Fund: near-zero program AND near-zero overhead
    // but significant gifts out — these charities route money rather than run programs
    const isPassThrough = program < 5 && overhead < 5 && revenue > 0 && giftsOut > revenue * 0.3

    const topLoop = loops?.sort((a, b) => (b.totalFlow || 0) - (a.totalFlow || 0))[0]
    const bottleneck = topLoop?.bottleneck || 0

    const parts = []

    // Intro
    parts.push(
      `${name} has been flagged with a ${risk.label} risk score of ${score}/30, ` +
      `participating in ${loopCount} circular funding loop${loopCount !== 1 ? 's' : ''} ` +
      `detected in CRA T3010 filings (2020–2024).`
    )

    // Loop breakdown
    if (h2 > 0) {
      parts.push(
        `Notably, ${h2 === 1 ? 'one direct 2-hop reciprocal exchange was' : `${h2} direct 2-hop reciprocal exchanges were`} detected — ` +
        `where funds flow directly between two charities in both directions, a pattern consistent with ` +
        `inflated donation receipt schemes or coordinated balance-sheet manipulation.`
      )
    }

    // Top loop path
    if (topLoop?.pathDisplay) {
      parts.push(
        `The highest-flow loop (${topLoop.hops}-hop, bottleneck ${fmt$(topLoop.bottleneck)}) ` +
        `traces the path: ${topLoop.pathDisplay}. ` +
        `Total estimated flow through this loop: ${fmt$(topLoop.totalFlow)}.`
      )
    } else if (bottleneck > 0) {
      parts.push(
        `The maximum loop bottleneck — the effective throughput of the largest circular chain — ` +
        `is ${fmt$(bottleneck)}, with total circular flow estimated at ${fmt$(circular)}.`
      )
    }

    // Financial profile
    if (isPassThrough) {
      parts.push(
        `${name} operates as a pass-through funding vehicle (Donor Advised Fund or fiscal sponsor), ` +
        `distributing ${fmt$(giftsOut)} in gifts to recipient charities against ${fmt$(revenue)} in revenue. ` +
        `Direct program spending is near zero (${fmtPct(program)}) — in isolation this is typical for DAFs, ` +
        `but combined with ${loopCount} circular loops, it raises serious questions about whether gifted funds ` +
        `are cycling between related entities rather than reaching end beneficiaries. ` +
        `The CRA expects charitable gifts to flow to arm's-length qualified donees with genuine charitable purpose.`
      )
    } else if (overhead > 40) {
      parts.push(
        `At ${fmtPct(overhead)} overhead and only ${fmtPct(program)} directed to program spending, ` +
        `this charity's financial profile raises significant concerns about mission delivery efficiency. ` +
        `The CRA benchmark expects charities to direct at least 65% of resources to charitable programs.`
      )
    } else if (overhead > 20) {
      parts.push(
        `With ${fmtPct(overhead)} overhead and ${fmtPct(program)} in program spending, ` +
        `the financial ratios are elevated above sector norms, warranting scrutiny in the context of these circular flows.`
      )
    } else if (program < 50) {
      parts.push(
        `Program spending at only ${fmtPct(program)} falls significantly below the CRA's recommended 65% threshold. ` +
        `Combined with the detected circular funding patterns, this profile warrants a detailed review of how charitable resources are being deployed.`
      )
    } else {
      parts.push(
        `Program spending at ${fmtPct(program)} is within CRA guidelines; however, the circular funding patterns ` +
        `suggest the reported ratios may not fully capture the true nature of financial flows.`
      )
    }

    // Government dependency
    if (govPct > 80) {
      parts.push(
        `Government transfers represent approximately ${fmtPct(govPct)} of total revenue, creating significant ` +
        `dependency on public funds — which, in the context of circular loops, may indicate ` +
        `inappropriate re-routing of government grants through intermediary charities.`
      )
    }

    // Conclusion
    parts.push(
      `Recommended action: ${score >= 20 ? 'Priority audit — escalate to CRA Charities Directorate for immediate review of gift flow documentation.' : score >= 10 ? 'Schedule for targeted compliance review within 90 days.' : 'Monitor for changes in loop structure and financial ratios in next filing cycle.'}`
    )

    return parts
  }, [charity, loops, financials])

  if (!narrative) return null

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(59,130,246,0.05), rgba(139,92,246,0.05))',
      border: '1px solid rgba(59,130,246,0.2)',
      borderRadius: 8,
      padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 14 }}>🤖</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb' }}>AI Risk Narrative</span>
        <span style={{ fontSize: 10, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          Template-based · Not LLM
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {narrative.map((para, i) => (
          <p key={i} style={{ fontSize: 12, color: '#334155', lineHeight: 1.7, margin: 0 }}>{para}</p>
        ))}
      </div>
    </div>
  )
}

// ─── Score Explainer Panel ─────────────────────────────────────────────────

function ScoreExplainer({ charity, loops, displayScore }) {
  if (!charity) return null

  const h2 = charity.loops?.h2 || 0
  const h3 = charity.loops?.h3 || 0
  const h4 = (charity.loops?.h4 || 0) + (charity.loops?.h5 || 0) + (charity.loops?.h6 || 0)
  const rev = charity.revenue || 0
  const totalCirc = charity.totalCircular || 0
  const programPct = charity.programPct || 0
  const circRatio = rev > 0 ? totalCirc / rev : 0

  const FEDERATED_DESIGNATIONS = new Set(['Public Foundation', 'Private Foundation'])
  const FEDERATED_KEYWORDS = ['foundation', 'federat', 'united way', 'community chest',
    'church', 'diocese', 'synod', 'presbytery', 'mosque', 'synagogue', 'temple',
    'salvation army', 'ymca', 'ywca']
  const federated = FEDERATED_DESIGNATIONS.has(charity.designation) ||
    FEDERATED_KEYWORDS.some(kw => (charity.category || '').toLowerCase().includes(kw))

  const loopPts = Math.min(12, h2 * 3) + Math.min(6, h3 * 1) + Math.min(3, h4 * 0.3)
  let finPts = 0
  if (programPct < 20)      finPts += 3
  else if (programPct < 50) finPts += 1
  if (programPct > 65)      finPts -= 2
  let circPts = 0
  if (circRatio > 0.50)      circPts = 4
  else if (circRatio > 0.30) circPts = 2
  else if (circRatio < 0.05) circPts = -2
  const fedPts = federated ? -3 : 0
  const computed = Math.max(0, Math.min(30, Math.round(loopPts + finPts + circPts + fedPts)))

  const totalLoops = charity.totalLoops || 0

  const rows = [
    {
      label: `Loop structure — ${h2} reciprocal, ${h3} triangular, ${h4} longer-chain`,
      detail: `2-hop × 3 pts (cap 12) + 3-hop × 1 pt (cap 6) + 4-hop+ × 0.3 pts (cap 3)`,
      pts: Math.round(loopPts * 10) / 10,
      icon: '🔄',
    },
    {
      label: `Program spending ${fmtPct(programPct)}`,
      detail: programPct < 20 ? 'Below 20% — pass-through signal' : programPct < 50 ? 'Below 50% — below CRA benchmark' : programPct > 65 ? 'Above 65% — healthy, deduction applied' : 'Within acceptable range',
      pts: finPts,
      icon: '📊',
    },
    {
      label: `Circular exposure ${fmtPct(circRatio * 100)} of revenue`,
      detail: circRatio > 0.5 ? 'Over 50% — very high circular concentration' : circRatio > 0.3 ? 'Over 30% — elevated circular concentration' : circRatio < 0.05 ? 'Under 5% — trivial, deduction applied' : 'Moderate circular exposure',
      pts: circPts,
      icon: '💸',
    },
    ...(federated ? [{
      label: `Federated / foundation structure`,
      detail: 'Foundations and federated charities receive a deduction — distributed giving is expected',
      pts: -3,
      icon: '🏛️',
    }] : []),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>
        Based on <strong>loop structure</strong> (type + count across all {totalLoops} loops) and <strong>financial signals</strong>.
      </div>
      {rows.map(r => (
        <div key={r.label} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '6px 10px', borderRadius: 6,
          background: r.pts > 0 ? '#fef2f2' : r.pts < 0 ? '#f0fdf4' : '#f8fafc',
        }}>
          <span style={{ fontSize: 14 }}>{r.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{r.label}</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>{r.detail}</div>
          </div>
          <span style={{
            fontSize: 13, fontWeight: 700, minWidth: 36, textAlign: 'right',
            color: r.pts > 0 ? '#dc2626' : r.pts < 0 ? '#16a34a' : '#94a3b8',
          }}>
            {r.pts > 0 ? `+${r.pts}` : r.pts === 0 ? '0' : r.pts}
          </span>
        </div>
      ))}
      <div style={{
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8,
        marginTop: 6, paddingTop: 8, borderTop: '1px solid #e2e8f0',
        fontSize: 12, color: '#475569',
      }}>
        <span>Computed total</span>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>{computed}/30</span>
        {computed !== displayScore && (
          <span style={{ fontSize: 10, color: '#94a3b8' }}>(stored: {displayScore}/30)</span>
        )}
      </div>
    </div>
  )
}

// ─── Score Derivation Panel ─────────────────────────────────────────────────

function ScoreDerivation({ derivation, appScore }) {
  const [open, setOpen] = useState(false)
  if (!derivation) return null
  const { weightedAvg, multiplier, charityAppScore, loops: dLoops } = derivation
  const riskColor = appScore >= 20 ? '#dc2626' : appScore >= 10 ? '#ea580c' : appScore >= 5 ? '#d97706' : '#16a34a'

  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 4 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '11px 14px', background: 'transparent', border: 'none', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13 }}>📐</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>How this score was calculated</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: riskColor, background: `${riskColor}15`, border: `1px solid ${riskColor}30`, borderRadius: 6, padding: '2px 10px' }}>
            {appScore}/30
          </span>
        </div>
        <span style={{ color: '#94a3b8', fontSize: 12 }}>{open ? '▲ collapse' : '▼ expand'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid #e2e8f0' }}>
          {/* Formula explanation */}
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 12, marginBottom: 14, lineHeight: 1.6 }}>
            Each loop gets a <strong>suspicion score 0–10</strong> from matching evaluation layer rules.
            Loop scores are averaged weighted by <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>log(bottleneck + 1)</code>,
            then multiplied by {multiplier} to produce the charity score (0–30).
          </div>

          {/* Per-loop contribution table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  {['Loop', 'Hops', 'Score', 'Weight', 'Weight %'].map(h => (
                    <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(dLoops || []).map((l, i) => {
                  const scoreColor = l.suspicionScore >= 7 ? '#dc2626' : l.suspicionScore >= 4 ? '#d97706' : '#16a34a'
                  return (
                    <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '5px 8px', color: '#475569' }}>Loop #{i + 1}</td>
                      <td style={{ padding: '5px 8px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: 4, padding: '1px 6px' }}>{l.hops}-hop</span>
                      </td>
                      <td style={{ padding: '5px 8px' }}>
                        <span style={{ fontWeight: 700, color: scoreColor }}>{l.suspicionScore}/10</span>
                      </td>
                      <td style={{ padding: '5px 8px', color: '#475569' }}>{l.weight}</td>
                      <td style={{ padding: '5px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 50, height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${l.weightContrib}%`, height: '100%', background: '#3b82f6', borderRadius: 3 }} />
                          </div>
                          <span style={{ color: '#475569' }}>{l.weightContrib}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Final formula row */}
          <div style={{ marginTop: 14, padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: '#1e40af' }}>Weighted avg loop score:</span>
            <strong style={{ color: '#1e40af' }}>{weightedAvg}/10</strong>
            <span style={{ color: '#64748b' }}>×</span>
            <strong style={{ color: '#1e40af' }}>{multiplier}</strong>
            <span style={{ color: '#64748b' }}>=</span>
            <strong style={{ color: riskColor, fontSize: 14 }}>{charityAppScore}/30</strong>
            <span style={{ fontSize: 11, color: '#64748b' }}>(charity TNA score)</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Rule Breakdown Popup ────────────────────────────────────────────────────

function RuleBreakdown({ loop }) {
  const [open, setOpen] = useState(false)
  const breakdown = loop.ruleBreakdown || []
  const matched   = breakdown.filter(r => r.matched)
  const missed    = breakdown.filter(r => !r.matched && r.enabled)

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          fontSize: 11, padding: '3px 10px', borderRadius: 6,
          border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer',
          color: '#475569', display: 'flex', alignItems: 'center', gap: 5,
        }}
      >
        <span style={{ fontWeight: 700, color: loop.suspicionScore >= 7 ? '#dc2626' : loop.suspicionScore >= 4 ? '#d97706' : '#16a34a' }}>
          {loop.suspicionScore}/10
        </span>
        {open ? '▲' : '▼'} rule breakdown
        <span style={{ color: '#dc2626' }}>+{matched.filter(r => r.score_delta > 0).reduce((s, r) => s + r.score_delta, 0)}</span>
        {matched.filter(r => r.score_delta < 0).length > 0 && (
          <span style={{ color: '#16a34a' }}>{matched.filter(r => r.score_delta < 0).reduce((s, r) => s + r.score_delta, 0)}</span>
        )}
      </button>

      {open && (
        <div style={{ marginTop: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          {matched.length > 0 && (
            <div>
              <div style={{ padding: '6px 12px', background: '#fff5f5', borderBottom: '1px solid #fecaca', fontSize: 10, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Matched rules
              </div>
              {matched.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: r.score_delta > 0 ? '#dc2626' : '#16a34a', minWidth: 28, textAlign: 'right' }}>
                    {r.score_delta > 0 ? '+' : ''}{r.score_delta}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', flex: 1 }}>{r.name}</span>
                  <span style={{ fontSize: 10, color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>{r.condition}</span>
                  {r.actualValue !== null && (
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>actual: {r.actualValue}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {missed.length > 0 && (
            <div>
              <div style={{ padding: '6px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Not matched
              </div>
              {missed.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderBottom: '1px solid #f1f5f9', opacity: 0.6 }}>
                  <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 28, textAlign: 'right' }}>
                    {r.score_delta > 0 ? '+' : ''}{r.score_delta}
                  </span>
                  <span style={{ fontSize: 11, color: '#64748b', flex: 1 }}>{r.name}</span>
                  <span style={{ fontSize: 10, color: '#94a3b8', background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>{r.condition}</span>
                  {r.actualValue !== null && (
                    <span style={{ fontSize: 10, color: '#cbd5e1' }}>actual: {r.actualValue}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LoopClose({ firstBn, firstName, bn, onSelectCharity }) {
  const truncated = (firstName || firstBn).length > 28 ? (firstName || firstBn).slice(0, 27) + '…' : (firstName || firstBn)
  const isSelf = firstBn === bn
  return (
    <React.Fragment>
      <span style={{ color: '#94a3b8', fontSize: 11, flexShrink: 0 }}>→</span>
      <button
        title={`${firstName} (loop closes here)`}
        onClick={() => !isSelf && onSelectCharity && onSelectCharity(firstBn)}
        style={{
          fontSize: 11, fontWeight: isSelf ? 700 : 500,
          color: isSelf ? '#94a3b8' : '#2563eb',
          background: isSelf ? '#f8fafc' : 'transparent',
          border: isSelf ? '1px dashed #cbd5e1' : 'none',
          borderRadius: 4, padding: '2px 6px',
          cursor: isSelf ? 'default' : 'pointer',
          textDecoration: (!isSelf && onSelectCharity) ? 'underline' : 'none',
          textDecorationColor: '#bfdbfe', textUnderlineOffset: 2, opacity: 0.75,
        }}
      >{truncated} ↺</button>
    </React.Fragment>
  )
}

// ─── Circular Loop Diagram ───────────────────────────────────────────────────

const LOOP_PALETTE = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6']

function normVec(dx, dy) {
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  return { x: dx / len, y: dy / len }
}

function splitLabel(name, max = 12) {
  const words = (name || '').split(/\s+/)
  const lines = []
  let cur = ''
  for (const w of words) {
    if (!cur) { cur = w; continue }
    if ((cur + ' ' + w).length <= max) cur += ' ' + w
    else { lines.push(cur); cur = w }
  }
  if (cur) lines.push(cur)
  return lines.slice(0, 3)
}

function fmtBadge(v) {
  if (!v) return '$0'
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${Math.round(v / 1000)}K`
  return `$${v}`
}

function LoopCircleDiagram({ loop, bn, onSelectCharity }) {
  const pathBNs   = loop.pathBNs   || []
  const pathNames = loop.pathNames || []
  const n = pathBNs.length
  if (n < 2 || n > 7) return null

  const W = 300, H = 270
  const cx = W / 2, cy = H / 2 + (n === 2 ? 0 : 5)
  const R      = n === 2 ? 72 : n === 3 ? 88 : n <= 5 ? 84 : 78
  const nodeR  = n <= 3 ? 32 : n <= 5 ? 27 : 22
  const CURVE  = n === 2 ? 70 : n === 3 ? 44 : n <= 5 ? 36 : 30
  const bottleneck = loop.bottleneck || 0

  const nodes = pathBNs.map((nodeBn, i) => {
    const angle = (2 * Math.PI * i / n) - Math.PI / 2
    return {
      bn: nodeBn,
      name: pathNames[i] || nodeBn,
      x: cx + R * Math.cos(angle),
      y: cy + R * Math.sin(angle),
      isSelf: nodeBn === bn,
      color: LOOP_PALETTE[i % LOOP_PALETTE.length],
    }
  })

  const edges = nodes.map((node, i) => {
    const next  = nodes[(i + 1) % n]
    const color = LOOP_PALETTE[i % LOOP_PALETTE.length]

    let ctrlX, ctrlY
    if (n === 2) {
      // Always use the same perpendicular from node[0]→node[1]; flip sign per edge
      const basePerpX = -(nodes[1].y - nodes[0].y), basePerpY = nodes[1].x - nodes[0].x
      const p = normVec(basePerpX, basePerpY)
      const sign = i === 0 ? 1 : -1
      ctrlX = (node.x + next.x) / 2 + p.x * CURVE * sign
      ctrlY = (node.y + next.y) / 2 + p.y * CURVE * sign
    } else {
      const midX = (node.x + next.x) / 2
      const midY = (node.y + next.y) / 2
      const d = normVec(midX - cx, midY - cy)
      ctrlX = midX + d.x * CURVE
      ctrlY = midY + d.y * CURVE
    }

    const sd = normVec(ctrlX - node.x, ctrlY - node.y)
    const sx = node.x + sd.x * (nodeR + 2)
    const sy = node.y + sd.y * (nodeR + 2)

    const ed = normVec(ctrlX - next.x, ctrlY - next.y)
    const ex = next.x + ed.x * (nodeR + 10)
    const ey = next.y + ed.y * (nodeR + 10)

    // Place badge outside the arc: control point + extra outward push for n≥3
    const badgeExtra = n === 2 ? 0 : 8
    const bd = normVec(ctrlX - cx, ctrlY - cy)
    const mx = ctrlX + bd.x * badgeExtra
    const my = ctrlY + bd.y * badgeExtra

    return { sx, sy, ctrlX, ctrlY, ex, ey, color, mx, my }
  })

  const markerId = (c) => `lp-arr-${c.replace('#', '')}`

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}
      style={{ display: 'block', margin: '8px auto 4px', maxWidth: 300 }}>
      <defs>
        {LOOP_PALETTE.slice(0, Math.max(n, 2)).map(c => (
          <marker key={c} id={markerId(c)}
            markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
            <path d="M0,0.5 L5,2.5 L0,4.5 Z" fill={c} />
          </marker>
        ))}
      </defs>

      {/* Arrows */}
      {edges.map((e, i) => (
        <g key={i}>
          <path
            d={`M${e.sx.toFixed(1)},${e.sy.toFixed(1)} Q${e.ctrlX.toFixed(1)},${e.ctrlY.toFixed(1)} ${e.ex.toFixed(1)},${e.ey.toFixed(1)}`}
            fill="none" stroke={e.color} strokeWidth="2.5" strokeLinecap="round"
            markerEnd={`url(#${markerId(e.color)})`}
          />
          {/* Amount badge */}
          <rect x={(e.mx - 20).toFixed(1)} y={(e.my - 9).toFixed(1)} width="40" height="17"
            rx="8" fill={e.color} opacity="0.82" />
          <text x={e.mx.toFixed(1)} y={e.my.toFixed(1)}
            textAnchor="middle" dominantBaseline="middle"
            fontSize="8" fill="white" fontWeight="700" fontFamily="system-ui,sans-serif">
            {fmtBadge(bottleneck)}
          </text>
        </g>
      ))}

      {/* Nodes */}
      {nodes.map((nd) => {
        const lines = splitLabel(nd.name, 11)
        const lineH = 9
        const totalH = lines.length * lineH
        const startY = nd.y - totalH / 2 + lineH / 2
        return (
          <g key={nd.bn}
            onClick={() => !nd.isSelf && onSelectCharity?.(nd.bn)}
            style={{ cursor: nd.isSelf ? 'default' : 'pointer' }}>
            {/* Drop shadow */}
            <circle cx={nd.x + 1} cy={nd.y + 2} r={nodeR + 1} fill="rgba(0,0,0,0.12)" />
            <circle cx={nd.x} cy={nd.y} r={nodeR} fill={nd.color} stroke="white" strokeWidth="2.5" />
            {/* Inner ring (decorative) */}
            <circle cx={nd.x} cy={nd.y} r={nodeR - 7} fill="none"
              stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
            {/* Heart symbol */}
            <text x={nd.x} y={startY - lineH * 0.9}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="9" fill="rgba(255,255,255,0.7)" fontFamily="system-ui,sans-serif">♥</text>
            {/* Charity name */}
            {lines.map((line, li) => (
              <text key={li}
                x={nd.x} y={(startY + li * lineH).toFixed(1)}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={lines.length > 2 ? '7' : '7.5'}
                fill="white" fontWeight="700" fontFamily="system-ui,sans-serif">
                {line}
              </text>
            ))}
            {/* "Charity" subtext */}
            <text x={nd.x} y={(nd.y + nodeR - 8).toFixed(1)}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="6" fill="rgba(255,255,255,0.65)" fontFamily="system-ui,sans-serif">
              Charity
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Hop Group (collapsible) ─────────────────────────────────────────────────

function HopGroup({ hops, loops, bn, onSelectCharity, charity, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const avgScore = loops.length > 0 ? Math.round(loops.reduce((s, l) => s + (l.suspicionScore || 0), 0) / loops.length * 10) / 10 : 0
  const maxScore = Math.max(...loops.map(l => l.suspicionScore || 0))
  const groupColor = maxScore >= 7 ? '#dc2626' : maxScore >= 4 ? '#d97706' : '#16a34a'
  const hopLabel   = hops === 2 ? '2-HOP  · Reciprocal' : hops === 3 ? '3-HOP  · Triangular' : hops === 4 ? '4-HOP  · Chain' : hops === 5 ? '5-HOP  · Extended' : `${hops}-HOP`

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', background: open ? '#fff' : '#f8fafc',
          border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', flexShrink: 0 }}>{hopLabel}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#475569' }}>{loops.length} loop{loops.length !== 1 ? 's' : ''}</span>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 12px 8px', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 6 }}>
          {[...loops].sort((a, b) => (b.suspicionScore ?? 0) - (a.suspicionScore ?? 0)).map((loop) => {
            const flags = getLoopFlags(loop, charity)
            const isSuspicious = flags.some(f => f.color === '#ef4444')
            const isCaution    = !isSuspicious && flags.some(f => f.color === '#b45309')
            const borderColor  = isSuspicious ? '#fecaca' : isCaution ? '#fde68a' : '#e2e8f0'
            return (
              <div key={loop.id} style={{ background: '#f8fafc', border: `1px solid ${borderColor}`, borderRadius: 6, padding: '7px 10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {flags.map(f => (
                      <span key={f.label} title={f.tip} style={{
                        fontSize: 9, fontWeight: 700,
                        background: f.bg, color: f.color, border: `1px solid ${f.border}`,
                        borderRadius: 4, padding: '2px 7px', cursor: 'help', letterSpacing: '0.4px',
                      }}>{f.dot} {f.label}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#64748b', flexShrink: 0 }}>
                    <span>⟳ {fmt$(loop.bottleneck)}</span>
                    {loop.minYear && <span>{loop.minYear}–{loop.maxYear}</span>}
                  </div>
                </div>

                {/* Circular flow diagram */}
                {(loop.pathBNs || []).length >= 2 && (loop.pathBNs || []).length <= 7 && (
                  <LoopCircleDiagram loop={loop} bn={bn} onSelectCharity={onSelectCharity} />
                )}

                {/* Timeline + Rule breakdown on same line */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  <LoopTimeline activeYears={loop.activeYears || []} fpeByYear={loop.fpeByYear || {}} />
                  <RuleBreakdown loop={loop} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
export default function CharityDetail({ bn, name, onClose, fullPage = false, onSelectCharity }) {
  const [showAllLoops, setShowAllLoops] = useState(false)
  const [showScorePopup, setShowScorePopup] = useState(false)

  const { data: charity, isLoading: charityLoading } = useQuery({
    queryKey: ['charity', bn],
    queryFn: () => fetchCharity(bn),
    enabled: !!bn,
  })

  const { data: loopsData, isLoading: loopsLoading } = useQuery({
    queryKey: ['loops', bn],
    queryFn: () => fetchLoops(bn),
    enabled: !!bn,
  })
  const loops      = loopsData?.loops || (Array.isArray(loopsData) ? loopsData : [])
  const derivation = loopsData?.derivation || null

  const { data: financials, isLoading: finLoading } = useQuery({
    queryKey: ['financials', bn],
    queryFn: () => fetchFinancials(bn),
    enabled: !!bn,
  })

  const riskyLoops = (loops || []).filter(l => (l.suspicionScore ?? 0) > 0)
  const hiddenLoopCount = (loops || []).length - riskyLoops.length

  const displayScore = (charity?.appScore ?? charity?.score) || 0
  const risk = getRiskLevel(displayScore)

  const HOP_COLORS = ['#3b82f6','#3b82f6','#3b82f6','#3b82f6','#3b82f6']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: fullPage ? 'auto' : '100%' }}>
      {/* Header — only show sticky close-button header in panel mode */}
      {!fullPage && (
      <div style={{
        padding: '16px 20px',
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        position: 'sticky',
        top: 0,
        zIndex: 5,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            {charityLoading ? <Skeleton height={18} style={{ marginBottom: 8 }} /> : (
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', lineHeight: 1.3, marginBottom: 4 }}>
                {charity?.name || name}
              </div>
            )}
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>{bn}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {charity?.designation && (
                <span style={{ fontSize: 10, background: '#f1f5f9', color: '#475569', borderRadius: 4, padding: '2px 8px', fontWeight: 600, border: '1px solid #e2e8f0' }}>
                  {charity.designation}
                </span>
              )}
              {charity?.category && (
                <span style={{ fontSize: 10, background: '#f0f9ff', color: '#0369a1', borderRadius: 4, padding: '2px 8px', fontWeight: 500, border: '1px solid #bae6fd' }}>
                  {categoryLabel(charity.category)}
                </span>
              )}
              {charity && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  background: `${risk.color}20`,
                  color: risk.color,
                  border: `1px solid ${risk.color}40`,
                  borderRadius: 4, padding: '2px 8px',
                }}>{risk.label} Risk · {displayScore}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              padding: '6px 12px',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: 12,
              flexShrink: 0,
            }}
          >✕ Close</button>
        </div>
      </div>
      )}

      {/* Full-page title block */}
      {fullPage && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {charityLoading ? <Skeleton height={28} style={{ marginBottom: 8 }} /> : (
              <h1 style={{ fontSize: 24, fontWeight: 600, color: '#1e3a8a', margin: '0 0 6px' }}>
                {charity?.name || bn}
              </h1>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>{bn}</span>
              {charity?.designation && (
                <span style={{ fontSize: 11, background: '#f1f5f9', color: '#475569', borderRadius: 4, padding: '2px 10px', fontWeight: 600, border: '1px solid #e2e8f0' }}>
                  {charity.designation}
                </span>
              )}
              {charity?.category && (
                <span style={{ fontSize: 11, background: '#f0f9ff', color: '#0369a1', borderRadius: 4, padding: '2px 10px', fontWeight: 500, border: '1px solid #bae6fd' }}>
                  {categoryLabel(charity.category)}
                </span>
              )}
              {charity && (
                <button
                  onClick={() => setShowScorePopup(true)}
                  style={{
                    fontSize: 11, fontWeight: 700,
                    background: `${risk.color}15`,
                    color: risk.color,
                    border: `1px solid ${risk.color}40`,
                    borderRadius: 4, padding: '3px 10px',
                    cursor: 'pointer',
                  }}
                >{risk.label} Risk · Score {displayScore}/30</button>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {charity && (
              <button title="Download STR Report (PDF)"
                onClick={() => downloadSTRPDF(charity, loops, displayScore, bn)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                  <svg width="32" height="37" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 3C0 1.34 1.34 0 3 0H15L24 9V25C24 26.66 22.66 28 21 28H3C1.34 28 0 26.66 0 25V3Z" fill="#E02020"/>
                    <path d="M15 0L24 9H17C15.9 9 15 8.1 15 7V0Z" fill="#FF6B6B"/>
                    <text x="3.5" y="22" fontSize="7.5" fontWeight="bold" fill="white" fontFamily="Arial,sans-serif" letterSpacing="0.3">PDF</text>
                    <line x1="4" y1="14" x2="20" y2="14" stroke="white" strokeOpacity="0.5" strokeWidth="1"/>
                    <line x1="4" y1="11" x2="13" y2="11" stroke="white" strokeOpacity="0.5" strokeWidth="1"/>
                  </svg>
              </button>
            )}
            {onClose && (
              <button onClick={onClose} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8,
                background: '#f8fafc', border: '1px solid #e2e8f0',
                color: '#475569', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Back
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: fullPage ? 'visible' : 'auto', padding: fullPage ? '0' : '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Risk narrative banner — prominent callout at the top */}
        {!charityLoading && <RiskNarrativeBanner charity={charity} loops={loops} liveScore={displayScore} />}

        {/* Score popup modal — rendered via portal to cover full viewport */}
        {showScorePopup && charity && createPortal(
          <div
            onClick={() => setShowScorePopup(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(0,0,0,0.75)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: '#fff', borderRadius: 12, width: 480, maxWidth: '95vw',
                maxHeight: '90vh', overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13 }}>⚠️</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>How is the score {displayScore}/30 calculated?</span>
                </div>
                <button onClick={() => setShowScorePopup(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18, lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ padding: '14px 16px' }}>
                <ScoreExplainer charity={charity} loops={loops} displayScore={displayScore} />
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Key Metrics */}
        <div>
          <SectionTitle>Financial Snapshot</SectionTitle>
          {charityLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[...Array(6)].map((_, i) => <Skeleton key={i} height={52} />)}
            </div>
          ) : charity ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'Revenue',       value: fmt$(charity.revenue),         tip: 'Total receipts from all sources reported in T3010 (Field 4700)',                                                                         icon: 'bx-trending-up',    iconColor: '#2563eb' },
                { label: 'Expenditures',  value: fmt$(charity.expenditures),    tip: 'Total spending including programs, admin, and fundraising (Field 5100)',                                                                  icon: 'bx-trending-down',  iconColor: '#64748b' },
                { label: 'Gifts In',      value: fmt$(charity.giftsIn),         tip: 'Donations received from other registered charities (Field 4510)',                                                                         icon: 'bx-donate-heart',   iconColor: '#10b981' },
                { label: 'Gifts Out',     value: fmt$(charity.giftsOut),        tip: 'Funds transferred out to other registered charities (Field 5050) — key circular flow indicator',                                         icon: 'bx-send',           iconColor: '#f59e0b' },
                { label: 'Overhead %',    value: fmtPct(charity.overheadPct),   tip: 'Admin + fundraising as % of total expenditures. CRA benchmark: keep under 35%', warn: (charity.overheadPct || 0) > 40,                  icon: 'bx-building',       iconColor: (charity.overheadPct || 0) > 40 ? '#ef4444' : '#64748b' },
                { label: 'Program %',     value: fmtPct(charity.programPct),    tip: 'Revenue directed to charitable programs. CRA expects at least 65% for most charities', warn: (charity.programPct  || 0) < 50,           icon: 'bx-bar-chart-alt-2',iconColor: (charity.programPct  || 0) < 50 ? '#ef4444' : '#10b981' },
              ].map(m => (
                <div key={m.label} style={{
                  background: '#f8fafc',
                  borderRadius: 6,
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  position: 'relative',
                }}>
                  <div style={{ position: 'absolute', top: 10, right: 12 }}>
                    <InfoTip tip={m.tip} />
                  </div>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                    background: m.warn ? '#fee2e2' : '#eff6ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <i className={`bx ${m.icon}`} style={{ fontSize: 18, color: m.iconColor }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>
                      {m.label}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: m.warn ? '#ef4444' : '#1e293b', lineHeight: 1.2 }}>{m.value}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* 3D Loop Network — risky/notable loops only */}
        {!loopsLoading && loops?.length > 0 && (() => {
          // Priority: scored loops first, then 2-hop (always notable), then 3-hop
          const scored = loops.filter(l => (l.suspicionScore || 0) > 0)
          const hop2   = loops.filter(l => l.hops === 2)
          const hop3   = loops.filter(l => l.hops === 3)
          // Merge unique: scored + 2-hop + 3-hop, deduplicated, sorted by score desc
          const seen = new Set()
          const candidates = [...scored, ...hop2, ...hop3].filter(l => {
            if (seen.has(l.id)) return false
            seen.add(l.id)
            return true
          }).sort((a, b) => (b.suspicionScore || 0) - (a.suspicionScore || 0)).slice(0, 50)
          if (!candidates.length) return null
          const label = candidates.length < loops.length
            ? `${candidates.length} notable loop${candidates.length !== 1 ? 's' : ''} of ${loops.length}`
            : `${candidates.length} loop${candidates.length !== 1 ? 's' : ''}`
          return (
            <div>
              <SectionTitle>
                Loop Network — 3D View
                <span style={{ fontSize: 10, fontWeight: 500, color: '#94a3b8', marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                  ({label})
                </span>
              </SectionTitle>
              <GraphErrorBoundary>
                <Suspense fallback={<div style={{ height: 200, background: '#0f172a', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 12 }}>Loading 3D graph…</div>}>
                  <LoopCloud3D
                    bn={bn}
                    charityName={charity?.name}
                    loops={candidates}
                    onSelectCharity={onSelectCharity}
                  />
                </Suspense>
              </GraphErrorBoundary>
            </div>
          )
        })()}

        {/* Score Derivation + Loop Paths (grouped) */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Loop Analysis</span>
          </div>
          {loopsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...Array(3)].map((_, i) => <Skeleton key={i} height={52} />)}
            </div>
          ) : !loops?.length ? (
            <div style={{ color: '#64748b', fontSize: 12 }}>No loop details available</div>
          ) : (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(() => {
                  let first = true
                  return [2, 3, 4, 5, 6, 7].map(h => {
                    const group = riskyLoops.filter(l => l.hops === h)
                    if (!group.length) return null
                    const isFirst = first; first = false
                    return <HopGroup key={h} hops={h} loops={group} bn={bn} onSelectCharity={onSelectCharity} charity={charity} defaultOpen={isFirst} />
                  })
                })()}
                {riskyLoops.filter(l => l.hops < 2 || l.hops > 7).length > 0 && (
                  <HopGroup
                    hops={riskyLoops.filter(l => l.hops < 2 || l.hops > 7)[0]?.hops || 0}
                    loops={riskyLoops.filter(l => l.hops < 2 || l.hops > 7)}
                    bn={bn} onSelectCharity={onSelectCharity} charity={charity}
                  />
                )}
                {riskyLoops.length === 0 && (
                  <div style={{ color: '#64748b', fontSize: 12 }}>No scored loops found.</div>
                )}
              </div>
              {hiddenLoopCount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                  <button
                    onClick={() => setShowAllLoops(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'none', border: 'none',
                      cursor: 'pointer', color: '#2563eb',
                      fontSize: 12, fontWeight: 500, padding: 0,
                    }}
                  >
                    View all {loops.length} loops →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Financial Trends + Spending Breakdown — side by side */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <SectionTitle>Financial Trends (2020–2024)</SectionTitle>
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                {[
                  { color: '#3b82f6', label: 'Revenue' },
                  { color: '#94a3b8', label: 'Expenditures' },
                  { color: '#93c5fd', label: 'Gifts In' },
                  { color: '#cbd5e1', label: 'Gifts Out' },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748b' }}>
                    <div style={{ width: 8, height: 2, background: l.color, borderRadius: 1 }} />
                    {l.label}
                  </div>
                ))}
              </div>
            </div>
            <FinancialChart data={financials} loading={finLoading} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <SectionTitle>Spending Breakdown</SectionTitle>
            {charityLoading ? <Skeleton height={120} /> : <SpendingDonut charity={charity} />}
          </div>
        </div>

      </div>

      {/* All Loops overlay page */}
      {showAllLoops && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: '#f8fafc', overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Overlay header */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 10,
            background: '#fff', borderBottom: '1px solid #e2e8f0',
            padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <button
              onClick={() => setShowAllLoops(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'none', border: '1px solid #e2e8f0', borderRadius: 6,
                padding: '6px 12px', cursor: 'pointer', color: '#475569', fontSize: 12,
              }}
            >
              ← Back to {charity?.name || 'Charity'}
            </button>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>All Loops</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{loops.length} total loops including low-risk</div>
            </div>
          </div>

          {/* All loops content */}
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 900, width: '100%', margin: '0 auto' }}>
            {(() => {
              let first = true
              return [2, 3, 4, 5, 6, 7].map(h => {
                const group = loops.filter(l => l.hops === h)
                if (!group.length) return null
                const isFirst = first; first = false
                return <HopGroup key={h} hops={h} loops={group} bn={bn} onSelectCharity={onSelectCharity} charity={charity} defaultOpen={isFirst} />
              })
            })()}
            {loops.filter(l => l.hops < 2 || l.hops > 7).length > 0 && (
              <HopGroup
                hops={loops.filter(l => l.hops < 2 || l.hops > 7)[0]?.hops || 0}
                loops={loops.filter(l => l.hops < 2 || l.hops > 7)}
                bn={bn} onSelectCharity={onSelectCharity} charity={charity}
              />
            )}
            {/* Score derivation at the bottom of all loops */}
            {!loopsLoading && loops?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <ScoreDerivation derivation={derivation} appScore={derivation?.charityAppScore ?? displayScore} />
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  )
}
