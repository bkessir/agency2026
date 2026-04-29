import React from "react"

const T = {
  brandDark: "#3B1F0F",
  accent: "#C47A2C",
  body: "#475569",
  muted: "#64748b",
  border: "#e2e8f0",
  red: "#dc2626",
  redBg: "rgba(239, 68, 68, 0.06)",
  green: "#059669",
  greenBg: "rgba(16, 185, 129, 0.06)",
}

function Cite({ n }) {
  return (
    <a href={`#ref-${n}`}
       style={{
         color: T.accent, fontSize: 11, fontWeight: 600,
         verticalAlign: "super", textDecoration: "none",
         marginLeft: 1, padding: "0 2px",
       }}>
      [{n}]
    </a>
  )
}

function Section({ number, title, children }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.6px", color: T.accent, textTransform: "uppercase" }}>
          {number}
        </span>
        <h2 style={{ fontSize: 19, fontWeight: 700, color: T.brandDark, letterSpacing: "-0.2px", margin: 0 }}>
          {title}
        </h2>
      </div>
      <div style={{ fontSize: 14, color: T.body, lineHeight: 1.7 }}>
        {children}
      </div>
    </section>
  )
}

function Subsection({ index, title, children }) {
  return (
    <div style={{ marginTop: 18, marginBottom: 10 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: T.brandDark, marginBottom: 6, letterSpacing: "-0.1px" }}>
        <span style={{ color: T.accent, marginRight: 8 }}>{index}.</span>
        {title}
      </h3>
      <div style={{ paddingLeft: 0 }}>{children}</div>
    </div>
  )
}

function CaseStudy({ title, accent, accentBg, children }) {
  return (
    <div style={{
      marginTop: 16, marginBottom: 16,
      padding: "16px 20px",
      background: accentBg,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 8,
    }}>
      <h4 style={{ fontSize: 14, fontWeight: 700, color: T.brandDark, marginBottom: 10, letterSpacing: "-0.1px" }}>
        {title}
      </h4>
      <div style={{ fontSize: 13.5, color: T.body, lineHeight: 1.65 }}>
        {children}
      </div>
    </div>
  )
}

export default function OurJourney() {
  return (
    <div className="fade-in" style={{ maxWidth: 860, margin: "0 auto" }}>
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 14, background: "var(--accent-soft)", marginBottom: 14 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="19" r="3"/>
            <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>
            <circle cx="18" cy="5" r="3"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: T.brandDark, letterSpacing: "-0.4px", margin: 0 }}>
          Our Journey
        </h1>
        <p style={{ fontSize: 13, color: T.muted, marginTop: 8, lineHeight: 1.5, maxWidth: 600, margin: "8px auto 0" }}>
          Challenge 3: Funding Loops — A Forensic Accounting Methodology at Scale
        </p>
      </div>

      <Section number="01" title="The Core Challenge: A Forensic Accounting Problem">
        <p style={{ marginBottom: 12 }}>
          The central question of Challenge 3 is not a data engineering problem; it is a forensic accounting problem: <em>"Where does money flow in circles between charities, and does it matter?"</em><Cite n={1} />
        </p>
        <p style={{ marginBottom: 12 }}>
          Using CRA T3010 data, we modeled charity-to-charity gifts as a directed graph of arrows, automatically identifying closed funding loops (reciprocal gifts, triangular cycles, and extended chains). However, finding the loops is only the first step. As the prompt correctly notes, most loops are structurally normal — denominational hierarchies, federated charities, or donor-advised funds.<Cite n={1} />
        </p>
        <p style={{ marginBottom: 12 }}>
          The true challenge, and the focus of our solution, is distinguishing benign structural loops from those engineered to inflate revenue, generate tax receipts, or absorb funds into overhead without delivering charitable programs.
        </p>
        <p>We solved this by applying the full arsenal of forensic accounting methodology at scale.</p>
      </Section>

      <Section number="02" title="Transaction Network Analysis (TNA): Methodology Applied at Scale">
        <p style={{ marginBottom: 4 }}>
          Our solution transforms the detection of a simple loop into a defensible, plain-language explanation of <em>why</em> the loop may be benign or suspicious. We achieved this through a multi-layered Transaction Network Analysis (TNA) approach, culminating in our Top 10 Highest Risk Charities Leaderboard.
        </p>

        <Subsection index="1" title="Cycle Detection (Johnson's Algorithm)">
          <p>
            We first modeled the 8.8 million T3010 records as a directed weighted graph. By applying Johnson's Algorithm, we exhaustively enumerated all elementary cycles. This deterministic mathematical layer successfully detected <strong style={{ color: T.brandDark }}>5,808 circular funding loops</strong> across <strong style={{ color: T.brandDark }}>1,501 unique organizations</strong>, exposing <strong style={{ color: T.brandDark }}>$260.2M</strong> in circular funding.<Cite n={2} />
          </p>
        </Subsection>

        <Subsection index="2" title="Financial Integrity Testing (Benford's Law Principles)">
          <p>
            While a loop indicates the path of funds, the amounts flowing through those paths provide critical context. We designed our Evaluation Rules Engine to test whether dollar amounts look engineered rather than natural. By analyzing the "bottleneck" amount (the smallest transfer in a loop that dictates the maximum circular flow) and calculating the "Circularity % of Revenue," we test the financial materiality of the loop against the entity's overall operations. For example, a loop representing 207% of a charity's reported revenue is mathematically anomalous and flags as highly engineered.<Cite n={2} />
          </p>
        </Subsection>

        <Subsection index="3" title="Intent Classification (FATF Typology Profiling)">
          <p>
            To answer <em>why</em> a loop matters, we mapped the detected behaviors against recognized Financial Action Task Force (FATF) and FINTRAC financial-crime typologies. Our rules engine classifies loops based on length (e.g., 2-hop reciprocal vs. 5-hop extended), program spending ratios, and organizational age.<Cite n={2} /> This allows the system to differentiate a "Pass-Through Vehicle" (high circularity, near-zero program spending) from a "Federated Structure" (high circularity, but high program spending and established history).
          </p>
        </Subsection>
      </Section>

      <Section number="03" title="Demonstrating the Methodology: The Top 10 Proof of Concept">
        <p>
          The true power of this methodology is demonstrated in our live Top 10 Risk Leaderboard, which dynamically applies these forensic principles to the CRA dataset.<Cite n={2} />
        </p>

        <CaseStudy title="The Suspicious Anomaly: Toronto Chesed Foundation (Rank #1)" accent={T.red} accentBg={T.redBg}>
          <p style={{ marginBottom: 10 }}>
            Our TNA engine flagged Toronto Chesed Foundation with a <strong style={{ color: T.red }}>Critical Risk Score of 28/30</strong>. The forensic breakdown explains exactly why:
          </p>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li style={{ marginBottom: 6 }}>
              <strong style={{ color: T.brandDark }}>The Shape:</strong> 252 detected loops, including 4 direct 2-hop reciprocal exchanges.
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong style={{ color: T.brandDark }}>The Materiality:</strong> $1.8M in circular flow, representing a staggering 207% of the charity's reported revenue.
            </li>
            <li>
              <strong style={{ color: T.brandDark }}>The Typology:</strong> With only 1.2% of revenue directed to charitable programs, the entity profiles strongly as a "Pass-Through Vehicle" and exhibits patterns associated with "Tax Receipt Inflation."
            </li>
          </ul>
          <p style={{ marginTop: 10, marginBottom: 0 }}>
            The system automatically drafts a PROTECTED B FINTRAC Suspicious Transaction Report (STR) detailing these exact red flags, demonstrating how raw data is converted into actionable intelligence.<Cite n={2} />
          </p>
        </CaseStudy>

        <CaseStudy title="The Structural False Positive: Canada Gives" accent={T.green} accentBg={T.greenBg}>
          <p style={{ marginBottom: 0 }}>
            Equally important is the system's ability to filter noise. Canada Gives participates in 321 loops — more than Toronto Chesed Foundation. A naive loop-counting algorithm would flag it as the highest risk entity in the dataset. However, our TNA methodology recognizes it as a <strong style={{ color: T.brandDark }}>Donor-Advised Fund (DAF)</strong>. By applying mitigating factors in our Evaluation Rules Engine, the system correctly identifies the loops as structurally normal pass-through architecture, downgrading the entity's risk profile and preventing a false positive escalation.<Cite n={2} />
          </p>
        </CaseStudy>
      </Section>

      <Section number="04" title="Conclusion: From “There is a Loop” to Actionable Intelligence">
        <p>
          Our solution does not just draw circles on a map. By combining Transaction Network Analysis, deterministic graph algorithms, financial anomaly testing, and FATF typology profiling, we have built a defensible, regulator-friendly system. We turn the observation that "there is a loop" into a plain-language, CFE-standard explanation of intent, scaling forensic accounting methodology to cover 100% of the CRA registry in minutes.
        </p>
      </Section>

      {/* References */}
      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 20, marginTop: 24 }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
          References
        </h3>
        <ol style={{ paddingLeft: 22, margin: 0, fontSize: 12, color: T.muted, lineHeight: 1.7 }}>
          <li id="ref-1" style={{ marginBottom: 6 }}>
            Challenge 3 Prompt. <em>"Funding Loops: Where does money flow in circles between charities, and does it matter?"</em> Government of Alberta AI For Accountability Hackathon 2026.
          </li>
          <li id="ref-2">
            Live Model Demonstration. <em>"Transaction Network Analysis (TNA) Dashboard and Top 10 Leaderboard."</em> April 29, 2026.
          </li>
        </ol>
      </div>
    </div>
  )
}
