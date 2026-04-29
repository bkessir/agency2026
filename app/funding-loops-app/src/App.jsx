import React, { useState, Component } from "react"
import { Routes, Route } from "react-router-dom"
import Dashboard from "./components/Dashboard.jsx"
import Leaderboard from "./components/Leaderboard.jsx"
import NetworkGraph from "./components/NetworkGraph.jsx"
import CharityDetail from "./components/CharityDetail.jsx"
import EvaluationRules from "./components/EvaluationRules.jsx"
import Services from "./components/Services.jsx"

class DetailErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 24, background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 10, color: '#be123c', fontSize: 13 }}>
        <strong>Render error:</strong> {this.state.error.message}
        <pre style={{ fontSize: 11, marginTop: 8, whiteSpace: 'pre-wrap', color: '#9f1239' }}>{this.state.error.stack}</pre>
      </div>
    )
    return this.props.children
  }
}

const NAV = [
  {
    id: "dashboard", label: "Dashboard",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#2563eb" : "#94a3b8"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    id: "risk-analysis", label: "Risk Analysis",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#2563eb" : "#94a3b8"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
        <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    ),
    children: [
      { id: "top10", label: "Top 10 Risks" },
      { id: "leaderboard", label: "Risk Leaderboard" },
    ],
  },
  {
    id: "network", label: "Network Explorer",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#2563eb" : "#94a3b8"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
      </svg>
    ),
  },
  {
    id: "eval-rules", label: "Evaluation Rules",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#2563eb" : "#94a3b8"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  {
    id: "services", label: "Services",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#2563eb" : "#94a3b8"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07M8.46 8.46a5 5 0 0 0 0 7.07"/>
      </svg>
    ),
  },
]

function Sidebar({ tab, setTab }) {
  // keep Risk Analysis expanded when any child is active
  const [expanded, setExpanded] = React.useState(() =>
    ["leaderboard", "top10"].includes(tab) ? { "risk-analysis": true } : {}
  )

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: "#ffffff",
      borderRight: "1px solid #e2e8f0",
      display: "flex", flexDirection: "column",
    }}>
      <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map(item => {
          const hasChildren = item.children?.length > 0
          const childActive = hasChildren && item.children.some(c => c.id === tab)
          const active = tab === item.id
          const open = expanded[item.id] || childActive

          return (
            <div key={item.id}>
              <button
                onClick={() => hasChildren ? toggle(item.id) : setTab(item.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: (active || childActive) ? "#eff6ff" : "transparent",
                  color: (active || childActive) ? "#2563eb" : "#1e293b",
                  fontSize: 13, fontWeight: (active || childActive) ? 600 : 500,
                  textAlign: "left", width: "100%",
                  transition: "all 0.12s",
                  justifyContent: "space-between",
                }}
                onMouseEnter={e => { if (!active && !childActive) e.currentTarget.style.background = "#f8fafc" }}
                onMouseLeave={e => { if (!active && !childActive) e.currentTarget.style.background = "transparent" }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {item.icon(active || childActive)}
                  {item.label}
                </span>
                {hasChildren && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke={(active || childActive) ? "#2563eb" : "#94a3b8"} strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                )}
              </button>

              {hasChildren && open && (
                <div style={{ marginLeft: 16, marginTop: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                  {item.children.map(child => {
                    const cActive = tab === child.id
                    return (
                      <button key={child.id} onClick={() => setTab(child.id)} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "7px 12px", borderRadius: 6, border: "none", cursor: "pointer",
                        background: cActive ? "#eff6ff" : "transparent",
                        color: cActive ? "#2563eb" : "#334155",
                        fontSize: 12, fontWeight: cActive ? 600 : 500,
                        textAlign: "left", width: "100%",
                        transition: "all 0.12s",
                      }}
                      onMouseEnter={e => { if (!cActive) e.currentTarget.style.background = "#f8fafc" }}
                      onMouseLeave={e => { if (!cActive) e.currentTarget.style.background = "transparent" }}
                      >
                        <span style={{ width: 4, height: 4, borderRadius: "50%", background: cActive ? "#2563eb" : "#cbd5e1", flexShrink: 0 }} />
                        {child.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

function MainApp() {
  const [tab, setTab] = useState("dashboard")
  const [leaderboardFilter, setLeaderboardFilter] = useState("all")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [charityBN, setCharityBN] = useState(null)
  const [prevTab, setPrevTab] = useState("leaderboard")

  const selectCharity = (bn) => { setPrevTab(tab); setCharityBN(bn); setTab("charity") }
  const openLeaderboard = (filter = "all") => { setLeaderboardFilter(filter); setTab("leaderboard") }

  return (
    <div style={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", background: "#f0f4f8" }}>
      {/* Top header */}
      <header style={{
        height: 48, flexShrink: 0,
        background: "#ffffff",
        borderBottom: "1px solid #e2e8f0",
        padding: "0 16px 0 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setSidebarOpen(o => !o)} style={{
            background: "transparent", border: "none", cursor: "pointer",
            padding: 6, borderRadius: 6, display: "flex", flexDirection: "column",
            gap: 4, alignItems: "center", justifyContent: "center",
            transition: "background 0.12s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "#f1f5f9"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ display:"block", width:18, height:2, background:"#64748b", borderRadius:2 }} />
            <span style={{ display:"block", width:18, height:2, background:"#64748b", borderRadius:2 }} />
            <span style={{ display:"block", width:18, height:2, background:"#64748b", borderRadius:2 }} />
          </button>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#2563eb", letterSpacing: "-0.3px" }}>Charity Risk Intelligence</div>
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>CRA T3010 · 2020–2024 · ~85K Registered Charities</div>
      </header>

      {/* Below header: sidebar + content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {sidebarOpen && <Sidebar tab={tab} setTab={setTab} />}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <main style={{ flex: 1, overflow: "auto", padding: 28 }}>
            {tab === "dashboard"   && <Dashboard onSelectCharity={selectCharity} onOpenLeaderboard={openLeaderboard} />}
            {tab === "leaderboard" && <Leaderboard onSelectCharity={selectCharity} selectedBN={null} initialFilter={leaderboardFilter} />}
            {tab === "top10"       && <Leaderboard onSelectCharity={selectCharity} selectedBN={null} initialFilter="all" limit={10} />}
            {tab === "network"     && <NetworkGraph selectedBN={null} onSelectCharity={selectCharity} />}
            {tab === "eval-rules"  && <EvaluationRules />}
            {tab === "services"    && <Services />}
            {tab === "charity"     && (
              <div className="fade-in" style={{ maxWidth: 900 }}>
                <DetailErrorBoundary>
                  <CharityDetail bn={charityBN} fullPage onSelectCharity={selectCharity} onClose={() => setTab(prevTab)} />
                </DetailErrorBoundary>
              </div>
            )}
            <footer style={{ borderTop: "1px solid #e2e8f0", marginTop: 32, padding: "10px 0", fontSize: 11, color: "#94a3b8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>CRA T3010 · 2020–2024 · ~85K Registered Charities</span>
              <span>Charity Risk Intelligence · Hackathon 2026</span>
            </footer>
          </main>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/*" element={<MainApp />} />
    </Routes>
  )
}
