import React, { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { fetchStats, fetchUniverse } from "../api/client.js"
import { fmt$, fmtN } from "../utils/formatters.js"
import CharityMap from "./CharityMap.jsx"

const S = {
  card: { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
  label: { fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 6 },
}
const HOP_COLORS = { "2-hop":"#ef4444","3-hop":"#f59e0b","4-hop":"#8b5cf6","5-hop":"#3b82f6","6-hop":"#10b981" }

function Skeleton({ h=24 }) {
  return <div style={{ height: h, borderRadius: 6, background: "#e2e8f0", opacity: 0.7 }} />
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 14px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
      <div style={{ color: "#1e293b", fontWeight: 600 }}>{label}</div>
      <div style={{ color: "#3b82f6", fontSize: 13 }}>{fmtN(payload[0]?.value)} loops</div>
    </div>
  )
}

const ICONS = {
  loops: (color) => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  ),
  charities: (color) => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/>
      <line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/>
      <line x1="18" y1="18" x2="18" y2="11"/>
      <polygon points="12 2 20 7 4 7"/>
    </svg>
  ),
  critical: (color) => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  circular: (color) => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
}

const ICON_COLORS = {
  loops:     { bg: "#e0e7ff", stroke: "#4f46e5" },
  charities: { bg: "#dcfce7", stroke: "#16a34a" },
  critical:  { bg: "#fee2e2", stroke: "#dc2626" },
  circular:  { bg: "#fef3c7", stroke: "#d97706" },
}

const STAT_CONFIG = [
  {
    key: "charities",
    label: "Charities Involved",
    iconKey: "charities",
    filter: "all",
    getSub: () => "Unique organizations",
    getValue: (stats) => fmtN(stats?.universeSize),
  },
  {
    key: "critical",
    label: "Critical Risk Entities",
    iconKey: "critical",
    filter: "critical",
    getSub: (derived) => `${derived.high || 0} high-risk`,
    getValue: (_, derived) => fmtN(derived.critical),
  },
  {
    key: "loops",
    label: "Total Detected Loops",
    iconKey: "loops",
    filter: "all",
    getSub: () => "Circular funding cycles",
    getValue: (stats) => fmtN(stats?.totalLoops),
  },
  {
    key: "circular",
    label: "Total Circular $",
    iconKey: "circular",
    filter: "all",
    getSub: () => "In detected loops",
    getValue: (_, derived) => fmt$(derived.totalCircular),
  },
]

export default function Dashboard({ onSelectCharity, onOpenLeaderboard }) {
  const { data: stats, isLoading: sL } = useQuery({ queryKey: ["stats"], queryFn: fetchStats })
  const { data: universe, isLoading: uL } = useQuery({ queryKey: ["universe"], queryFn: fetchUniverse })
  const loading = sL || uL

  const derived = useMemo(() => {
    if (!universe) return {}
    const totalCircular = universe.reduce((s, c) => s + (c.totalCircular || 0), 0)
    const critical = universe.filter(c => c.score >= 20).length
    const high = universe.filter(c => c.score >= 10 && c.score < 20).length
    return { totalCircular, critical, high }
  }, [universe])

  const hopData = useMemo(() => {
    if (!stats?.loopCounts) return []
    return Object.entries(stats.loopCounts).map(([hop, count]) => ({ hop, count }))
  }, [stats])

  return (
    <div className="fade-in" style={{ maxWidth: 1200 }}>
      {/* Hero text */}
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:22, fontWeight:600, color:"#334155", letterSpacing:"-0.3px", lineHeight:1.1 }}>Circular Funding Intelligence</div>
        <div style={{ fontSize:11, color:"#64748b", marginTop:3, lineHeight:1 }}>Detecting suspicious money loops between Canadian registered charities</div>
      </div>

      {/* 4 clickable stat boxes */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
        {loading
          ? [1,2,3,4].map(i => <div key={i} style={S.card}><Skeleton h={80} /></div>)
          : STAT_CONFIG.map(cfg => (
            <button key={cfg.key}
              onClick={() => onOpenLeaderboard(cfg.filter)}
              style={{
                ...S.card,
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                transition: "transform 0.12s, box-shadow 0.12s",
                width: "100%",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)" }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)" }}
            >
              {/* Title */}
              <div style={{ fontSize:12, fontWeight:700, color:"#1e293b" }}>{cfg.label}</div>
              {/* Icon + stacked number/subtitle */}
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{
                  width:38, height:38, borderRadius:"50%",
                  background: ICON_COLORS[cfg.iconKey].bg,
                  display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                }}>
                  {ICONS[cfg.iconKey](ICON_COLORS[cfg.iconKey].stroke)}
                </div>
                <div>
                  <div style={{ fontSize:26, fontWeight:500, color:"#475569", letterSpacing:"-0.5px", lineHeight:1.1 }}>
                    {cfg.getValue(stats, derived)}
                  </div>
                  <div style={{ fontSize:11, color:"#94a3b8", marginTop:1 }}>{cfg.getSub(derived)}</div>
                </div>
              </div>
            </button>
          ))
        }
      </div>

      {/* Geographic map */}
      <div style={{ marginBottom: 24 }}>
        <CharityMap />
      </div>

      {/* Loop distribution area chart — full width */}
      <div style={S.card}>
        <div style={{ fontSize:15, fontWeight:700, color:"#475569", marginBottom:4 }}>How Complex Are the Funding Loops?</div>
        <div style={{ fontSize:12, color:"#64748b", marginBottom:16 }}>Short loops (2 charities) are direct money swaps · longer chains involve more organizations hiding the circular flow</div>
        {loading ? <Skeleton h={220} /> : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={hopData} margin={{top:4,right:16,bottom:0,left:0}}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="hop" tick={{fill:"#64748b",fontSize:13}} axisLine={false} tickLine={false} />
              <YAxis tick={{fill:"#64748b",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={fmtN} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2.5} fill="url(#areaGrad)" dot={{ fill:"#4f46e5", r:4 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
