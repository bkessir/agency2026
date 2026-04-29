import React from "react"
import { useParams, useNavigate } from "react-router-dom"
import CharityDetail from "./CharityDetail.jsx"

export default function CharityPage() {
  const { bn } = useParams()
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f0f4f8" }}>
      {/* Header */}
      <header style={{
        background: "#ffffff",
        borderBottom: "1px solid #e2e8f0",
        padding: "0 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 60, position: "sticky", top: 0, zIndex: 50,
      }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#2563eb", letterSpacing: "-0.3px" }}>Charity Risk Intelligence</div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>CRA Funding Loop Intelligence</div>
        </div>

        <div style={{ fontSize: 10, color: "#cbd5e1", textAlign: "right" }}>
          CRA T3010 · 2020–2024
        </div>
      </header>

      {/* Full-page charity detail */}
      <main style={{ flex: 1, overflow: "auto", maxWidth: 900, width: "100%", margin: "0 auto", padding: "24px 24px" }}>
        <CharityDetail bn={bn} fullPage onClose={() => navigate(-1)} />
      </main>
    </div>
  )
}
