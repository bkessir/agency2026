import React from "react"

const SECTIONS = [
  {
    id: "executive-summary",
    title: "Executive Summary",
    image: "executive_summary.webp",
    alt: "Single-page hero dashboard summarising the analysis",
    story:
      "Here's the headline: 1,501 charities reviewed, 251 flagged, 101 critical, $4.4 B cycled — with risk distribution, pattern breakdown, and top 5 in one view.",
  },
  {
    id: "scope-overview",
    title: "Scope of the Analysis",
    image: "scope_overview.webp",
    alt: "Six stat cards summarising the analyzed dataset",
    story:
      "What was analyzed: every charity participating in any closed funding loop, with counts of loops, transactions, total money, distinct funding networks, and how many got flagged.",
  },
  {
    id: "risk-distribution",
    title: "Risk Distribution",
    image: "risk_distribution.webp",
    alt: "Bar chart of risk tiers from Low to Critical",
    story:
      "Of the 1,501 charities, 251 fell into the High or Critical tier (16.7% of the population, 6.7% Critical).",
  },
  {
    id: "pattern-breakdown",
    title: "Pattern Breakdown",
    image: "pattern_breakdown.webp",
    alt: "Categorized findings, color-coded by pattern type",
    story:
      "What kinds of suspicious patterns came out: Same-name multi-registration (10), Foundation–operating pairs (9), Multi-chapter organizations (6), Cross-entity cycles (25).",
  },
  {
    id: "top-charities",
    title: "Top 10 Charities to Review",
    image: "top10_charities_to_review.webp",
    alt: "Top 10 charity table with type, risk tier, pattern and score",
    story:
      "These are the top 10 charities to investigate first. Each row tells you the type, risk tier, the kind of suspicious pattern observed, and the anomaly score.",
  },
  {
    id: "top-loops",
    title: "Top 10 Loops to Review",
    image: "top10_loops_to_review.webp",
    alt: "Top 10 loop table with hop count, year-pattern and money amounts",
    story:
      "These are the most anomalous specific transaction cycles — with hop count, year-pattern, money amounts, and shared-address flag.",
  },
  {
    id: "flagged-examples",
    title: "Flagged Examples",
    image: "flagged_examples.webp",
    alt: "Six small network diagrams of flagged 2-charity cycles",
    story:
      "Here's what the top 6 flagged patterns actually look like — bidirectional 2-charity cycles between paired entities, with the actual money amounts on each arrow.",
  },
]

export default function AIAnalysis() {
  return (
    <div className="fade-in" style={{ maxWidth: 1080, margin: "0 auto" }}>
      {/* Page header */}
      <div style={{ marginBottom: 36, textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 14, background: "var(--accent-soft)", marginBottom: 14 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C47A2C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4 L14 10 L20 12 L14 14 L12 20 L10 14 L4 12 L10 10 Z" />
          </svg>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#3B1F0F", letterSpacing: "-0.4px", margin: 0 }}>Machine Learning Analysis</h1>
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 8, lineHeight: 1.5, maxWidth: 560, margin: "8px auto 0" }}>
          A narrative walkthrough of the AI panel's findings — from headline numbers down to the specific charities, loops and patterns flagged for human review.
        </p>
      </div>

      {/* Sections */}
      {SECTIONS.map((s, i) => (
        <section key={s.id} style={{ marginBottom: 44 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
            <span style={{
              flexShrink: 0,
              fontSize: 11, fontWeight: 700, letterSpacing: "0.6px",
              color: "#C47A2C", textTransform: "uppercase",
            }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <h2 style={{ fontSize: 19, fontWeight: 700, color: "#3B1F0F", letterSpacing: "-0.2px", margin: 0 }}>
              {s.title}
            </h2>
          </div>
          <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, marginBottom: 16, maxWidth: 880 }}>
            {s.story}
          </p>
          <figure style={{
            margin: 0,
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}>
            <img
              src={`/brand/ai-analysis/${s.image}`}
              alt={s.alt}
              loading="lazy"
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </figure>
        </section>
      ))}

      <div style={{ borderTop: "1px solid #e2e8f0", marginTop: 16, paddingTop: 16, fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
        Findings produced by the AIM Pronghorn 404 evaluation pipeline · for human review
      </div>
    </div>
  )
}
