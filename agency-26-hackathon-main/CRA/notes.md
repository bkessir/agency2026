# Charity Risk Intelligence — Key Concepts

Reference notes for the CRA circular funding loop detection app built for the AI for Accountability Hackathon (April 29, 2026).

---

## 1. Data Source: CRA T3010

**T3010** is the annual information return that every registered Canadian charity must file with the **Canada Revenue Agency (CRA)**. It is the primary data source for this application.

- ~85,000 registered charities file annually
- Years covered: **2020–2024** (~8.76M rows total)
- Key fields used: `gifts_to_qualified_donees`, `total_revenue`, `total_expenditures`, `program_spending`, `admin_expenses`, `fundraising_expenses`, `bn` (Business Number)

**Business Number (BN):** The 9-digit CRA-issued identifier for every Canadian organization. The charity account suffix is `RR` (e.g., `123456789RR0001`). BN is the primary key throughout this application.

**Qualified Donees:** Charities that are legally permitted to receive tax-receipted gifts. Gift flows between qualified donees are recorded in T3010 and form the edges of the funding graph.

---

## 2. Circular Funding Loops

A **circular funding loop** exists when charity A gifts to charity B, which directly or indirectly gifts back to A, forming a cycle in the funding graph.

```
Simple 2-hop:    A → B → A
3-hop:           A → B → C → A
6-hop:           A → B → C → D → E → F → A
```

**Why it matters:** Legitimate charities should transfer funds to arm's-length donees for charitable purposes. Circular flows may indicate:
- **Donation receipt inflation** — charities issue receipts for the same money cycling repeatedly
- **Balance-sheet manipulation** — inflating reported revenues and gifts without real economic activity
- **Coordinated pass-through schemes** — money routed through a chain to obscure its origin or use

---

## 3. Graph Construction

The funding data is modelled as a **directed weighted graph**:

- **Nodes:** Individual charities (identified by BN)
- **Edges:** Gift flows from one charity to another, weighted by dollar amount, aggregated across 2020–2024
- **Algorithm:** Johnson's algorithm + Strongly Connected Component (SCC) decomposition to enumerate all simple cycles of length 2–6

**Strongly Connected Component (SCC):** A maximal subgraph where every node can reach every other node. SCCs are computed first to prune the search space before running full cycle detection.

---

## 4. Hop Count

The **hop count** is the number of distinct edges (gift flows) in a loop.

| Hops | Description | Suspicion Level |
|------|-------------|-----------------|
| 2 | Direct reciprocal exchange between 2 charities | Highest — classic receipt inflation |
| 3 | Triangle between 3 charities | High |
| 4–6 | Longer chains | Moderate — harder to coordinate, may be coincidental |

Loops are detected up to **6 hops**. Beyond 6, the combinatorial search space becomes computationally prohibitive and long chains are less likely to be coordinated.

---

## 5. Risk Score (0–30)

Each charity is assigned a composite **risk score** from 0 to 30 based on:

| Component | Weight | Rationale |
|---|---|---|
| Loop count | High | More loops = more systemic involvement |
| Loop magnitude (bottleneck) | High | Large dollar amounts = greater harm potential |
| Overhead % | Moderate | High overhead with circular flows = suspect |
| Program spending % | Moderate | Low program % = money not reaching beneficiaries |
| 2-hop reciprocal count | High | Direct back-and-forth is hardest to explain legitimately |

**Risk Bands:**
- **Low (0–4):** Likely incidental or low-significance loops
- **Medium (5–9):** Warrants monitoring
- **High (10–19):** Schedule for compliance review within 90 days
- **Critical (20–30):** Priority audit — escalate to CRA Charities Directorate

---

## 6. Bottleneck

The **bottleneck** of a loop is the **minimum edge weight** (smallest gift flow) along the loop path. It represents the effective throughput of the circular chain — the maximum amount that could realistically cycle through the entire loop.

```
A →($500K)→ B →($200K)→ C →($800K)→ A
Bottleneck = $200K  (the weakest link limits total circular flow)
```

**Max Bottleneck:** The bottleneck of the single largest loop a charity participates in.
**Total Circular:** Sum of bottlenecks across all loops the charity is in (proxy for total circular exposure).

---

## 7. Financial Ratios

Sourced directly from T3010 filings:

**Overhead %** = `admin_expenses / total_revenue × 100`
- CRA benchmark: should be below ~35%
- Flag: >40% is considered elevated

**Program % (Program Spending Ratio)** = `program_spending / total_expenditures × 100`
- CRA benchmark: at least 65% of resources should go to charitable programs
- Flag: <50% is a concern; <10% with circular loops is a serious red flag

**Circularity Ratio** = `max_bottleneck / total_revenue × 100`
- Measures what fraction of a charity's revenue is tied up in circular flows
- Flag: >30% suggests the loops are not incidental

---

## 8. Pass-Through Charities / Donor Advised Funds (DAFs)

A **pass-through vehicle** is a charity whose primary activity is receiving donations and re-granting them to other charities, with near-zero direct program spending. Common structures:
- **Donor Advised Funds (DAFs)** — donors contribute to the fund, which holds assets and makes grants over time
- **Fiscal Sponsors** — hold charitable status on behalf of projects that lack their own registration
- **Umbrella/federated bodies** — national organizations that pool and redistribute to chapters

**In isolation, pass-through structures are legal.** The concern arises when a DAF or fiscal sponsor appears in multiple circular loops, suggesting it may be routing funds back to original donors or between related entities rather than to genuine arm's-length beneficiaries.

**Detection heuristic:** `program_spending < 5%` AND `overhead < 5%` AND `gifts_out > 30% of revenue`

---

## 9. Valid vs Suspicious Loops — Suspicion Flags

Not every detected loop represents wrongdoing. The app applies rule-based **suspicion flags** to each loop:

| Flag | Condition | Interpretation |
|---|---|---|
| 🔴 RECIPROCAL | hops = 2 | Direct A→B→A exchange — hardest to justify legitimately |
| 🟡 HIGH CIRCULARITY | bottleneck > 30% of revenue | Loop is a major fraction of the charity's financial activity |
| 🟡 PASS-THROUGH | program% < 10% + hops ≤ 3 | Routing funds with no program delivery |
| 🟢 LIKELY VALID | hops ≥ 3 + program% > 60% + no red flags | Consistent with federated/granting structures |
| ⚪ LOW IMPACT | bottleneck < $10,000 | Small amount — likely administrative or incidental |

**Examples of legitimate multi-hop loops:**
- United Way → Member Agency → United Way (membership dues/operating fees)
- Community Foundation → Operating Charity → Foundation (endowment contributions)
- Diocese → Parish → Diocese (denominational assessments)
- National federation → Provincial chapter → National (quota payments)

---

## 10. Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, React Query, Recharts, react-simple-maps |
| **Backend** | Node.js, Express (served as static + API from same process) |
| **Database** | PostgreSQL 14+ (schema: `cra`) |
| **Mapping** | react-simple-maps + d3-scale + local Canada GeoJSON |
| **Styling** | Inline styles (no CSS framework) |

**Key DB tables used:**
- `cra.loop_universe` — one row per charity, pre-aggregated loop stats + risk score
- `cra.loops` — individual detected loops with path data
- `cra.charity_financials_by_year` — annual T3010 financial data per charity
- `cra.qualified_donee_gifts` — raw gift flow edges

---

## 11. Key UI Components

| Component | Purpose |
|---|---|
| `Dashboard.jsx` | Overview stats, Canada map, hop distribution chart |
| `Leaderboard.jsx` | Sortable/filterable table of all charities by risk score |
| `CharityDetail.jsx` | Full per-charity drill-down: risk gauge, financials, loop paths, narrative |
| `CharityMap.jsx` | Canada province choropleth + bubble markers by charity count/risk |
| `NetworkGraph.jsx` | Interactive force-directed graph of funding relationships |
| `App.jsx` | Shell: sidebar navigation, header, footer, tab routing |

---

## 12. Narrative Engine

Each charity's detail page includes a **template-based risk narrative** — a plain-English summary auto-generated from the charity's data fields. It covers:
1. Risk score and loop count (intro sentence)
2. Most significant finding (2-hop detection, pass-through pattern, top loop path, or overhead concern)
3. Financial profile analysis
4. Government funding dependency (if >80% of revenue from government transfers)
5. Recommended action (audit / compliance review / monitor)

This is **not an LLM** — it uses deterministic `if/else` logic on the T3010 fields. A future enhancement would swap in a real LLM call with configurable provider (OpenAI, Anthropic, etc.).

---

## 13. Canada Map

Province-level aggregation of charity risk data visualized as:
- **Choropleth fill** — province shaded by average risk score
- **Bubble markers** — sized by charity count, colored by % of critical/high risk charities
- **Tooltip** — shows province name, total charities, critical count, average score on hover

GeoJSON source: `public/canada-provinces.json` (local file, served from port 3000). Province property: `geo.properties.name` (full English name, e.g. "Quebec").

---

## 14. CRA Compliance Context

The **CRA Charities Directorate** is responsible for registering and auditing Canadian charities under the Income Tax Act. Key regulatory expectations:
- Charities must operate for exclusively charitable purposes
- Gifts to qualified donees must flow to arm's-length organizations
- At least 65% of disbursements should be for charitable programs (the "disbursement quota")
- Circular gifting to inflate donation receipts is considered a serious compliance violation and can result in revocation of charitable status

**This application does not constitute legal findings.** Risk scores and flags are analytical tools to prioritize human review, not proof of wrongdoing.
