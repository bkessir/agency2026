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

const STAT_CONFIG = [
  {
    key: "charities",
    label: "Charities Involved",
    image: "kpi1.webp",
    filter: "all",
    getSub: () => "Unique organizations",
    getValue: (stats) => fmtN(stats?.universeSize),
  },
  {
    key: "critical",
    label: "Critical Risk Entities",
    image: "kpi2.webp",
    filter: "critical",
    getSub: (derived) => `${derived.high || 0} high-risk`,
    getValue: (_, derived) => fmtN(derived.critical),
  },
  {
    key: "loops",
    label: "Total Detected Loops",
    image: "kpi3.webp",
    filter: "all",
    getSub: () => "Circular funding cycles",
    getValue: (stats) => fmtN(stats?.totalLoops),
  },
  {
    key: "circular",
    label: "Total Circular $",
    image: "kpi4.webp",
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

      {/* 4 stylized clickable KPI tiles on a misty mountain background */}
      <div style={{
        backgroundImage: "url('/brand/kpis/background.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        borderRadius: 18,
        padding: 22,
        marginBottom: 24,
        boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
      }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16 }}>
          {loading
            ? [1,2,3,4].map(i => (
                <div key={i} style={{ aspectRatio: "5 / 4", borderRadius: 14, background: "rgba(255,255,255,0.85)", boxShadow: "0 2px 10px rgba(0,0,0,0.10)" }}>
                  <div style={{ padding: 18 }}><Skeleton h={20} /></div>
                </div>
              ))
            : STAT_CONFIG.map(cfg => (
              <button key={cfg.key}
                onClick={() => onOpenLeaderboard(cfg.filter)}
                style={{
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  borderRadius: 14,
                  overflow: "hidden",
                  backgroundImage: `url('/brand/kpis/${cfg.image}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  aspectRatio: "5 / 4",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  textAlign: "right",
                  transition: "transform 0.18s, box-shadow 0.18s",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.18)" }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.12)" }}
              >
                <div style={{ padding: "16px 18px", maxWidth: "75%" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#3B1F0F", textTransform: "uppercase", letterSpacing: "0.6px", opacity: 0.75 }}>
                    {cfg.label}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#3B1F0F", lineHeight: 1.05, marginTop: 4, letterSpacing: "-0.4px" }}>
                    {cfg.getValue(stats, derived)}
                  </div>
                  <div style={{ fontSize: 10, color: "#3B1F0F", marginTop: 3, opacity: 0.6 }}>
                    {cfg.getSub(derived)}
                  </div>
                </div>
              </button>
            ))
          }
        </div>
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
