/**
 * server.js - API server for CRA circular gifting visualization.
 *
 * Serves the index.html frontend and provides JSON API endpoints
 * for the D3 network visualization.
 *
 * Usage:
 *   node visualizations/server.js
 *   node visualizations/server.js --port 3000
 *
 * API Endpoints:
 *   GET /api/universe          - All charities in loops with scores
 *   GET /api/charity/:bn       - Full profile for one charity
 *   GET /api/network/:bn       - Gift network (in/out edges) for visualization
 *   GET /api/loops/:bn         - All loops this charity participates in
 *   GET /api/financials/:bn    - Multi-year financial history
 *   GET /api/stats             - Overall statistics
 *   GET /api/search?q=term     - Search charities by name
 *   GET /api/tophubs           - Top hub charities with most loop connections
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Database connection — falls back to mock data when no credentials found
const dbPath = path.join(__dirname, '..', 'lib', 'db');
const db = require(dbPath);

const mockPath = path.join(__dirname, '..', 'lib', 'mock');
const mock = db.MISSING ? require(mockPath) : null;

if (mock) {
  console.warn('\n⚠️  No DB_CONNECTION_STRING found — running in DEMO MODE with sample data.');
  console.warn('   Place CRA/.env.public (from event organisers) to connect to the live database.\n');
}

// Use mock or real implementations
const api = mock || {
  getStats, getUniverse, getCharity, getNetwork,
  getLoops, getFinancials, getLoopFlow,
  searchCharities, getTopHubs, getMapData,
};

const PORT = parseInt(process.argv.find((a, i) => process.argv[i - 1] === '--port') || '3000');

// ─── CORS Helper ─────────────────────────────────────────────────────────────

function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ─── API Routes ──────────────────────────────────────────────────────────────

async function handleAPI(pathname, query, res) {
  const parts = pathname.replace('/api/', '').split('/');
  const route = parts[0];
  const param = decodeURIComponent(parts[1] || '');

  try {
    let data;
    switch (route) {
      case 'universe': data = await api.getUniverse(); break;
      case 'charity': data = await api.getCharity(param); break;
      case 'network': data = await api.getNetwork(param); break;
      case 'loops': {
        const loops = await api.getLoops(param);
        const derivation = loops._derivation;
        delete loops._derivation;
        data = { loops, derivation };
        break;
      }
      case 'financials': data = await api.getFinancials(param); break;
      case 'loopflow': data = await api.getLoopFlow(param); break;
      case 'stats': data = await api.getStats(); break;
      case 'search': data = await api.searchCharities(query.q || ''); break;
      case 'tophubs': data = await api.getTopHubs(); break;
      case 'map': data = await api.getMapData(); break;
      default:
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unknown endpoint' }));
        return;
    }
    setCORSHeaders(res);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } catch (err) {
    console.error('API error:', err.message);
    setCORSHeaders(res);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

// ─── Scoring Algorithm (Transaction Network Analysis) ────────────────────────
//
// Per-loop suspicion score (0–10), then weighted into charity score (0–30).
// Signals from: ACFE/AICPA/GAO forensic accounting typology profiling.

const FEDERATED_DESIGNATIONS = new Set(['Public Foundation', 'Private Foundation'])
const FEDERATED_KEYWORDS = ['foundation', 'federat', 'united way', 'community chest',
  'church', 'diocese', 'synod', 'presbytery', 'mosque', 'synagogue', 'temple',
  'salvation army', 'ymca', 'ywca']

function isFederated(designation, category) {
  if (FEDERATED_DESIGNATIONS.has(designation)) return true
  const c = (category || '').toLowerCase()
  return FEDERATED_KEYWORDS.some(kw => c.includes(kw))
}

/**
 * Score one loop for a given charity context using DB-backed rules.
 * Returns integer 0–10 (10 = most suspicious).
 */
function scoreLoop(loop, ctx) {
  const { revenue = 0, programPct = 0, designation = '', category = '' } = ctx
  const bottleneck   = loop.bottleneck || 0
  const hops         = loop.hops || 2
  const activeYears  = Array.isArray(loop.activeYears) ? loop.activeYears : []
  const spanYears    = activeYears.length || 1
  const circularity  = revenue > 0 ? bottleneck / revenue * 100 : 0  // as percentage
  const federated    = isFederated(designation, category)

  const loopCtx = {
    hops,
    circularity_pct: circularity,
    program_pct: programPct,
    active_years: spanYears,
    is_federated: federated ? 1 : 0,
    bottleneck_amt: bottleneck,
  }

  const rules = rulesCache || []
  let s = 0

  if (rules.length === 0) {
    // Fallback to hardcoded if rules not yet loaded
    if      (hops === 2) s += 4
    else if (hops === 3) s += 3
    else if (hops === 4) s += 2
    else if (hops === 5) s += 1
    if (circularity > 50)    s += 3
    else if (circularity > 30) s += 2
    if (programPct < 20)   s += 2
    if (spanYears <= 1)    s += 2
    if (federated)         s -= 3
    if (programPct > 65)   s -= 2
    if (spanYears >= 4)    s -= 2
    if (circularity < 5)   s -= 2
    if (bottleneck < 10000) s -= 1
  } else {
    for (const rule of rules) {
      if (!rule.enabled) continue
      if (evalCondition(rule.condition_field, rule.condition_operator, rule.condition_value, loopCtx)) {
        s += parseInt(rule.score_delta)
      }
    }
  }

  return Math.max(0, Math.min(10, Math.round(s)))
}

/**
 * Roll up per-loop scores into a charity-level score (0–30).
 * Larger bottleneck loops have more weight (log scale).
 */
function computeCharityAppScore(loops, ctx) {
  if (!loops || loops.length === 0) return 0
  let wSum = 0, wTotal = 0
  for (const loop of loops) {
    const loopScore = typeof loop.suspicionScore === 'number'
      ? loop.suspicionScore
      : scoreLoop(loop, ctx)
    const weight = Math.log(Math.max(loop.bottleneck || 0, 1) + 1)
    wSum   += loopScore * weight
    wTotal += weight
  }
  const avg = wTotal > 0 ? wSum / wTotal : 0
  return Math.max(0, Math.min(30, Math.round(avg * 3)))
}

/**
 * Quick charity score from aggregate data (no per-loop query needed).
 * Used in leaderboard/universe listing.
 */
function quickCharityScore(row) {
  const rev          = row.revenue || 0
  const programPct   = row.programPct || 0
  const loops        = row.loops || {}
  const totalCirc    = row.totalCircular || 0
  const circRatio    = rev > 0 ? totalCirc / rev : 0
  const federated    = isFederated(row.designation, row.category)

  let s = 0

  // Contribution from loop typology
  s += Math.min(12, (loops.h2 || 0) * 3)    // 2-hop: up to 12 pts
  s += Math.min(6,  (loops.h3 || 0) * 1)    // 3-hop: up to 6 pts
  s += Math.min(3,  ((loops.h4 || 0) + (loops.h5 || 0) + (loops.h6 || 0)) * 0.3)

  // Financial signals
  if (programPct < 20)       s += 3
  else if (programPct < 50)  s += 1
  if (programPct > 65)       s -= 2

  if (circRatio > 0.50)      s += 4
  else if (circRatio > 0.30) s += 2
  else if (circRatio < 0.05) s -= 2

  if (federated) s -= 3

  return Math.max(0, Math.min(30, Math.round(s)))
}

// ─── Evaluation Rules Engine ─────────────────────────────────────────────────

const DEFAULT_RULES = [
  // Risk factors
  { name: '2-hop Reciprocal Loop',       description: 'Direct A→B→A pattern — strongest fraud signal', rule_type: 'risk',       condition_field: 'hops',            condition_operator: 'eq',  condition_value: 2,     score_delta:  4, sort_order: 1 },
  { name: '3-hop Triangular Loop',       description: 'Three-party circular gifting',                  rule_type: 'risk',       condition_field: 'hops',            condition_operator: 'eq',  condition_value: 3,     score_delta:  3, sort_order: 2 },
  { name: '4-hop Chain Loop',            description: 'Four-party circular chain',                     rule_type: 'risk',       condition_field: 'hops',            condition_operator: 'eq',  condition_value: 4,     score_delta:  2, sort_order: 3 },
  { name: '5-hop Extended Loop',         description: 'Longer chains harder to engineer intentionally',rule_type: 'risk',       condition_field: 'hops',            condition_operator: 'eq',  condition_value: 5,     score_delta:  1, sort_order: 4 },
  { name: 'High Circularity (>50%)',     description: 'Loop amount exceeds 50% of charity revenue',   rule_type: 'risk',       condition_field: 'circularity_pct', condition_operator: 'gt',  condition_value: 50,    score_delta:  3, sort_order: 5 },
  { name: 'Moderate Circularity (>30%)', description: 'Loop amount exceeds 30% of charity revenue',   rule_type: 'risk',       condition_field: 'circularity_pct', condition_operator: 'gt',  condition_value: 30,    score_delta:  2, sort_order: 6 },
  { name: 'Low Program Spending',        description: 'Less than 20% revenue spent on programs (pass-through risk)', rule_type: 'risk', condition_field: 'program_pct', condition_operator: 'lt', condition_value: 20, score_delta: 2, sort_order: 7 },
  { name: 'Temporal Burst',             description: 'Loop only active for 1 year — sudden spike pattern', rule_type: 'risk',  condition_field: 'active_years',    condition_operator: 'lte', condition_value: 1,     score_delta:  2, sort_order: 8 },
  // Mitigating factors
  { name: 'Federated Organization',     description: 'Known legitimate federated/foundation structure',rule_type: 'mitigation', condition_field: 'is_federated',    condition_operator: 'eq',  condition_value: 1,     score_delta: -3, sort_order: 9  },
  { name: 'High Program Spending',      description: 'Over 65% revenue spent on programs — mission-driven', rule_type: 'mitigation', condition_field: 'program_pct', condition_operator: 'gt', condition_value: 65, score_delta: -2, sort_order: 10 },
  { name: 'Established Charity (≥4 yrs)', description: 'Loop sustained over 4+ years — stable relationship', rule_type: 'mitigation', condition_field: 'active_years', condition_operator: 'gte', condition_value: 4, score_delta: -2, sort_order: 11 },
  { name: 'Trivial Circularity (<5%)',  description: 'Loop is negligible relative to total revenue',   rule_type: 'mitigation', condition_field: 'circularity_pct', condition_operator: 'lt',  condition_value: 5,     score_delta: -2, sort_order: 12 },
  { name: 'Small Transaction (<$10K)',  description: 'Low dollar impact reduces material risk',         rule_type: 'mitigation', condition_field: 'bottleneck_amt',  condition_operator: 'lt',  condition_value: 10000, score_delta: -1, sort_order: 13 },
];

// In-memory rules cache — refreshed from DB on startup and after any write
let rulesCache = null;

async function ensureRulesTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS cra.scoring_rules (
      id                  SERIAL PRIMARY KEY,
      name                TEXT    NOT NULL,
      description         TEXT,
      rule_type           TEXT    NOT NULL CHECK(rule_type IN ('risk','mitigation')),
      condition_field     TEXT    NOT NULL,
      condition_operator  TEXT    NOT NULL CHECK(condition_operator IN ('eq','gt','gte','lt','lte')),
      condition_value     NUMERIC,
      score_delta         INTEGER NOT NULL,
      enabled             BOOLEAN NOT NULL DEFAULT TRUE,
      is_default          BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order          INTEGER NOT NULL DEFAULT 0,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Seed defaults only if table is empty
  const { rows } = await db.query('SELECT COUNT(*) AS c FROM cra.scoring_rules');
  if (parseInt(rows[0].c) === 0) {
    for (const r of DEFAULT_RULES) {
      await db.query(
        `INSERT INTO cra.scoring_rules
           (name, description, rule_type, condition_field, condition_operator, condition_value, score_delta, is_default, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8)`,
        [r.name, r.description, r.rule_type, r.condition_field, r.condition_operator, r.condition_value, r.score_delta, r.sort_order]
      );
    }
    console.log('[Rules] Seeded', DEFAULT_RULES.length, 'default rules');
  }
}

async function loadRules() {
  try {
    const { rows } = await db.query('SELECT * FROM cra.scoring_rules ORDER BY sort_order ASC, id ASC');
    rulesCache = rows;
    return rows;
  } catch (err) {
    // Table might not exist yet — try to create it and seed defaults
    if (err.message && err.message.includes('scoring_rules')) {
      await ensureRulesTable();
      const { rows } = await db.query('SELECT * FROM cra.scoring_rules ORDER BY sort_order ASC, id ASC');
      rulesCache = rows;
      return rows;
    }
    throw err;
  }
}

function getRuleBreakdown(loop, ctx) {
  const { revenue = 0, programPct = 0, designation = '', category = '' } = ctx
  const bottleneck  = loop.bottleneck || 0
  const hops        = loop.hops || 2
  const activeYears = Array.isArray(loop.activeYears) ? loop.activeYears : []
  const spanYears   = activeYears.length || 1
  const circPct     = revenue > 0 ? bottleneck / revenue * 100 : 0
  const federated   = isFederated(designation, category)

  const loopCtx = {
    hops,
    circularity_pct: circPct,
    program_pct:     programPct,
    active_years:    spanYears,
    is_federated:    federated ? 1 : 0,
    bottleneck_amt:  bottleneck,
  }

  const FIELD_LABELS = {
    hops:            'Loop hops',
    circularity_pct: 'Circularity %',
    program_pct:     'Program spending %',
    active_years:    'Active years',
    is_federated:    'Is federated',
    bottleneck_amt:  'Bottleneck ($)',
  }
  const OP_LABELS = { eq: '=', gt: '>', gte: '≥', lt: '<', lte: '≤' }

  const rules = rulesCache || []
  return rules.map(rule => {
    const matched = rule.enabled && evalCondition(rule.condition_field, rule.condition_operator, rule.condition_value, loopCtx)
    const actualVal = loopCtx[rule.condition_field]
    return {
      id:          rule.id,
      name:        rule.name,
      rule_type:   rule.rule_type,
      score_delta: rule.score_delta,
      enabled:     rule.enabled,
      matched,
      condition:   `${FIELD_LABELS[rule.condition_field] || rule.condition_field} ${OP_LABELS[rule.condition_operator] || rule.condition_operator} ${rule.condition_value}`,
      actualValue: actualVal !== undefined ? Math.round(actualVal * 100) / 100 : null,
    }
  })
}

function evalCondition(field, operator, threshold, loopCtx) {
  const val = loopCtx[field];
  if (val === undefined || val === null) return false;
  const t = parseFloat(threshold);
  switch (operator) {
    case 'eq':  return val === t;
    case 'gt':  return val > t;
    case 'gte': return val >= t;
    case 'lt':  return val < t;
    case 'lte': return val <= t;
    default:    return false;
  }
}

// ─── TNA Score Persistence ────────────────────────────────────────────────────

async function ensureScoringTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS cra.tna_scores (
      bn            VARCHAR(20) PRIMARY KEY,
      tna_score     INTEGER     NOT NULL DEFAULT 0,
      scored_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      loops_scored  INTEGER     NOT NULL DEFAULT 0,
      method        TEXT        NOT NULL DEFAULT 'quick'
    )
  `);
}

let scoringRunning = false;
let lastScoringResult = null;

async function runScoringJob() {
  if (scoringRunning) return { status: 'already_running' };
  scoringRunning = true;
  const startedAt = new Date();
  console.log('[TNA Scoring] Starting batch scoring run…');

  try {
    // Fetch all universe rows with financial context in one query
    const r = await db.query(`
      SELECT u.bn, u.legal_name, u.total_loops, u.loops_2hop, u.loops_3hop,
             u.loops_4hop, u.loops_5hop, u.loops_6hop, u.loops_7plus,
             u.max_bottleneck, u.total_circular_amt,
             fd.field_4700 AS revenue, fd.field_5000 AS prog_spending,
             fd.field_5100 AS expenditures, fd.field_5010 AS admin,
             fd.field_5020 AS fundraising,
             ci.designation, ci.category
      FROM cra.loop_universe u
      LEFT JOIN LATERAL (
        SELECT field_4700, field_5000, field_5100, field_5010, field_5020
        FROM cra.cra_financial_details WHERE bn = u.bn ORDER BY fpe DESC LIMIT 1
      ) fd ON true
      LEFT JOIN LATERAL (
        SELECT designation, category FROM cra_identification WHERE bn = u.bn ORDER BY fiscal_year DESC LIMIT 1
      ) ci ON true
    `);

    const rows = r.rows;
    console.log(`[TNA Scoring] Scoring ${rows.length} charities…`);

    // Compute score for each charity
    const scored = rows.map(row => {
      const rev  = parseFloat(row.revenue) || 0;
      const prog = parseFloat(row.prog_spending) || 0;
      const exp  = parseFloat(row.expenditures) || 0;
      const adm  = parseFloat(row.admin) || 0;
      const fun  = parseFloat(row.fundraising) || 0;
      const charityRow = {
        revenue: rev,
        programPct: rev > 0 ? Math.round(prog / rev * 1000) / 10 : 0,
        totalCircular: parseFloat(row.total_circular_amt) || 0,
        designation: row.designation || '',
        category: row.category || '',
        loops: {
          h2: parseInt(row.loops_2hop) || 0,
          h3: parseInt(row.loops_3hop) || 0,
          h4: parseInt(row.loops_4hop) || 0,
          h5: parseInt(row.loops_5hop) || 0,
          h6: parseInt(row.loops_6hop) || 0,
        },
      };
      return {
        bn: row.bn,
        tnaScore: quickCharityScore(charityRow),
        totalLoops: parseInt(row.total_loops) || 0,
      };
    });

    // Bulk upsert using unnest for performance
    const bns        = scored.map(s => s.bn);
    const tnaScores  = scored.map(s => s.tnaScore);
    const loopCounts = scored.map(s => s.totalLoops);

    await db.query(`
      INSERT INTO cra.tna_scores (bn, tna_score, scored_at, loops_scored, method)
      SELECT unnest($1::text[]), unnest($2::int[]), NOW(), unnest($3::int[]), 'quick'
      ON CONFLICT (bn) DO UPDATE
        SET tna_score    = EXCLUDED.tna_score,
            scored_at    = EXCLUDED.scored_at,
            loops_scored = EXCLUDED.loops_scored,
            method       = EXCLUDED.method
    `, [bns, tnaScores, loopCounts]);

    const elapsed = ((new Date() - startedAt) / 1000).toFixed(1);
    lastScoringResult = {
      status: 'success',
      totalScored: scored.length,
      scoredAt: new Date().toISOString(),
      elapsedSec: parseFloat(elapsed),
      distribution: {
        critical: scored.filter(s => s.tnaScore >= 20).length,
        high:     scored.filter(s => s.tnaScore >= 10 && s.tnaScore < 20).length,
        medium:   scored.filter(s => s.tnaScore >= 5  && s.tnaScore < 10).length,
        low:      scored.filter(s => s.tnaScore < 5).length,
      },
    };
    console.log(`[TNA Scoring] Done — ${scored.length} charities scored in ${elapsed}s`);
    return lastScoringResult;
  } catch (err) {
    lastScoringResult = { status: 'error', message: err.message, scoredAt: new Date().toISOString() };
    console.error('[TNA Scoring] Error:', err.message);
    return lastScoringResult;
  } finally {
    scoringRunning = false;
  }
}

async function getScoringStatus() {
  const countRes = await db.query('SELECT COUNT(*) AS c, MAX(scored_at) AS last FROM cra.tna_scores').catch(() => ({ rows: [{}] }));
  return {
    running: scoringRunning,
    lastResult: lastScoringResult,
    storedCount: parseInt(countRes.rows[0]?.c) || 0,
    lastScoredAt: countRes.rows[0]?.last || null,
  };
}

// ─── API Implementations ─────────────────────────────────────────────────────

async function getStats() {
  const loops = await db.query('SELECT hops, COUNT(*) AS cnt FROM cra.loops GROUP BY hops ORDER BY hops');
  const universe = await db.query('SELECT COUNT(*) AS c FROM cra.loop_universe');
  const edges = await db.query('SELECT COUNT(*) AS c FROM cra.loop_edges');
  return {
    loopCounts: loops.rows.reduce((o, r) => { o[r.hops + '-hop'] = parseInt(r.cnt); return o; }, {}),
    totalLoops: loops.rows.reduce((s, r) => s + parseInt(r.cnt), 0),
    universeSize: parseInt(universe.rows[0].c),
    edgeCount: parseInt(edges.rows[0].c),
  };
}

async function getMapData() {
  const r = await db.query(`
    SELECT
      ci.province,
      COUNT(DISTINCT u.bn) AS count,
      COUNT(DISTINCT CASE WHEN u.score >= 20 THEN u.bn END) AS critical,
      COUNT(DISTINCT CASE WHEN u.score >= 10 AND u.score < 20 THEN u.bn END) AS high,
      ROUND(AVG(u.score)::numeric, 1) AS avg_score
    FROM cra.loop_universe u
    LEFT JOIN LATERAL (
      SELECT province FROM cra_identification WHERE bn = u.bn ORDER BY fiscal_year DESC LIMIT 1
    ) ci ON true
    WHERE ci.province IS NOT NULL AND ci.province != ''
    GROUP BY ci.province
    ORDER BY count DESC
  `);
  return r.rows.map(row => ({
    province: (row.province || '').trim().toUpperCase(),
    count: parseInt(row.count) || 0,
    critical: parseInt(row.critical) || 0,
    high: parseInt(row.high) || 0,
    avgScore: parseFloat(row.avg_score) || 0,
  }));
}

async function getUniverse() {
  const r = await db.query(`
    SELECT u.bn, u.legal_name, u.total_loops, u.loops_2hop, u.loops_3hop,
           u.loops_4hop, u.loops_5hop, u.loops_6hop, u.loops_7plus,
           u.max_bottleneck, u.total_circular_amt, u.score,
           ci.designation, ci.category,
           fd.field_4700 AS revenue, fd.field_5100 AS expenditures,
           fd.field_5000 AS prog_spending, fd.field_5010 AS admin,
           fd.field_5020 AS fundraising, fd.field_5050 AS gifts_out,
           fd.field_4510 AS gifts_in, c.field_390 AS compensation,
           ts.tna_score, ts.scored_at AS tna_scored_at
    FROM cra.loop_universe u
    LEFT JOIN LATERAL (
      SELECT designation, category FROM cra_identification WHERE bn = u.bn ORDER BY fiscal_year DESC LIMIT 1
    ) ci ON true
    LEFT JOIN LATERAL (
      SELECT field_4700, field_5100, field_5000, field_5010, field_5020, field_5050, field_4510
      FROM cra_financial_details WHERE bn = u.bn ORDER BY fpe DESC LIMIT 1
    ) fd ON true
    LEFT JOIN LATERAL (
      SELECT field_390 FROM cra_compensation WHERE bn = u.bn ORDER BY fpe DESC LIMIT 1
    ) c ON true
    LEFT JOIN cra.tna_scores ts ON ts.bn = u.bn
    ORDER BY COALESCE(ts.tna_score, u.score) DESC NULLS LAST, u.total_loops DESC
  `);
  return r.rows.map(row => {
    const mapped = {
      bn: row.bn,
      name: row.legal_name,
      score: parseInt(row.score) || 0,
      designation: row.designation,
      category: row.category,
      totalLoops: parseInt(row.total_loops),
      loops: { h2: parseInt(row.loops_2hop), h3: parseInt(row.loops_3hop), h4: parseInt(row.loops_4hop), h5: parseInt(row.loops_5hop), h6: parseInt(row.loops_6hop) },
      revenue: parseFloat(row.revenue) || 0,
      expenditures: parseFloat(row.expenditures) || 0,
      programSpending: parseFloat(row.prog_spending) || 0,
      admin: parseFloat(row.admin) || 0,
      fundraising: parseFloat(row.fundraising) || 0,
      overheadPct: parseFloat(row.expenditures) > 0 ? Math.round((parseFloat(row.admin || 0) + parseFloat(row.fundraising || 0)) / parseFloat(row.expenditures) * 1000) / 10 : 0,
      programPct: parseFloat(row.revenue) > 0 ? Math.round(parseFloat(row.prog_spending || 0) / parseFloat(row.revenue) * 1000) / 10 : 0,
      giftsIn: parseFloat(row.gifts_in) || 0,
      giftsOut: parseFloat(row.gifts_out) || 0,
      compensation: parseFloat(row.compensation) || 0,
      maxBottleneck: parseFloat(row.max_bottleneck) || 0,
      totalCircular: parseFloat(row.total_circular_amt) || 0,
    }
    // Use persisted TNA score if available, otherwise compute on the fly
    mapped.appScore = row.tna_score != null ? parseInt(row.tna_score) : quickCharityScore(mapped)
    mapped.tnaScoredAt = row.tna_scored_at || null
    return mapped
  });
}

async function getCharity(bn) {
  const ci = await db.query(`
    SELECT bn, legal_name, designation, category, city, province
    FROM cra_identification WHERE bn = $1 ORDER BY fiscal_year DESC LIMIT 1
  `, [bn]);
  if (ci.rows.length === 0) return { error: 'Not found' };

  const uni = await db.query(`
    SELECT u.bn, u.legal_name, u.total_loops, u.loops_2hop, u.loops_3hop,
           u.loops_4hop, u.loops_5hop, u.loops_6hop, u.loops_7plus,
           u.max_bottleneck, u.total_circular_amt, u.score,
           fd.field_4700 AS revenue, fd.field_5100 AS expenditures,
           fd.field_5000 AS prog_spending, fd.field_5010 AS admin,
           fd.field_5020 AS fundraising, fd.field_5050 AS gifts_out,
           fd.field_4510 AS gifts_in, c.field_390 AS compensation,
           ts.tna_score, ts.scored_at AS tna_scored_at
    FROM cra.loop_universe u
    LEFT JOIN LATERAL (
      SELECT field_4700, field_5100, field_5000, field_5010, field_5020, field_5050, field_4510
      FROM cra_financial_details WHERE bn = u.bn ORDER BY fpe DESC LIMIT 1
    ) fd ON true
    LEFT JOIN LATERAL (
      SELECT field_390 FROM cra_compensation WHERE bn = u.bn ORDER BY fpe DESC LIMIT 1
    ) c ON true
    LEFT JOIN cra.tna_scores ts ON ts.bn = u.bn
    WHERE u.bn = $1
  `, [bn]);

  const parts = await db.query(`
    SELECT lp.sends_to, lp.receives_from, l.hops, l.bottleneck_amt, l.path_display, l.min_year, l.max_year
    FROM cra.loop_participants lp JOIN cra.loops l ON lp.loop_id = l.id
    WHERE lp.bn = $1
  `, [bn]);

  const row = uni.rows[0] || {};
  const exp = parseFloat(row.expenditures) || 0;
  const rev = parseFloat(row.revenue) || 0;
  const admin = parseFloat(row.admin) || 0;
  const fundraising = parseFloat(row.fundraising) || 0;
  const progSpending = parseFloat(row.prog_spending) || 0;
  const programPct = rev > 0 ? Math.round(progSpending / rev * 1000) / 10 : 0;

  const charityCtx = {
    revenue: rev,
    programPct,
    designation: ci.rows[0].designation,
    category: ci.rows[0].category,
  };

  // Use persisted TNA score if available; otherwise compute from loops
  const persistedScore = row.tna_score != null ? parseInt(row.tna_score) : null;
  const loopsForScore = await getLoops(bn);
  const liveAppScore = computeCharityAppScore(loopsForScore, charityCtx);
  const appScore = persistedScore ?? liveAppScore;

  return {
    bn: ci.rows[0].bn,
    name: ci.rows[0].legal_name,
    designation: ci.rows[0].designation,
    category: ci.rows[0].category,
    city: ci.rows[0].city,
    province: ci.rows[0].province,
    score: parseInt(row.score) || 0,
    appScore,
    tnaScoredAt: row.tna_scored_at || null,
    totalLoops: parseInt(row.total_loops) || 0,
    loops: {
      h2: parseInt(row.loops_2hop) || 0,
      h3: parseInt(row.loops_3hop) || 0,
      h4: parseInt(row.loops_4hop) || 0,
      h5: parseInt(row.loops_5hop) || 0,
      h6: parseInt(row.loops_6hop) || 0,
    },
    maxBottleneck: parseFloat(row.max_bottleneck) || 0,
    totalCircular: parseFloat(row.total_circular_amt) || 0,
    revenue: rev,
    expenditures: exp,
    programSpending: progSpending,
    admin,
    fundraising,
    giftsIn: parseFloat(row.gifts_in) || 0,
    giftsOut: parseFloat(row.gifts_out) || 0,
    compensation: parseFloat(row.compensation) || 0,
    overheadPct: exp > 0 ? Math.round((admin + fundraising) / exp * 1000) / 10 : 0,
    programPct,
    loopParticipation: parts.rows,
  };
}

async function getNetwork(bn) {
  // Parse optional hop filter from query string (passed as second path segment)
  // e.g., /api/network/BN/3 to show only 3-hop loop subgraph

  // Step 1: Find ALL BNs in the target's loops (full participant set)
  const loopBNsRes = await db.query(`
    SELECT DISTINCT unnest(l.path_bns) AS bn
    FROM cra.loop_participants lp
    JOIN cra.loops l ON lp.loop_id = l.id
    WHERE lp.bn = $1
  `, [bn]);
  const loopBNs = loopBNsRes.rows.map(r => r.bn);
  // Always include the target
  if (!loopBNs.includes(bn)) loopBNs.push(bn);

  // Step 2: Get edges where BOTH endpoints are loop members (induced subgraph)
  // This shows money flowing between loop participants only.
  // Also get direct edges to/from the target for context.
  const allEdges = await db.query(`
    SELECT bn AS source, donee_bn AS target,
           EXTRACT(YEAR FROM fpe)::int AS year, SUM(total_gifts) AS amount,
           bool_or(associated) AS associated
    FROM cra_qualified_donees
    WHERE donee_bn IS NOT NULL AND LENGTH(donee_bn) = 15
      AND total_gifts > 0
      AND (
        (bn = ANY($1) AND donee_bn = ANY($1))
        OR bn = $2
        OR donee_bn = $2
      )
    GROUP BY bn, donee_bn, EXTRACT(YEAR FROM fpe)
    ORDER BY amount DESC
  `, [loopBNs, bn]);

  // Step 3: Collect all node BNs
  const nodeSet = new Set(loopBNs);
  for (const e of allEdges.rows) {
    nodeSet.add(e.source);
    nodeSet.add(e.target);
  }
  const allBNs = [...nodeSet];

  // Step 4: Get names for all nodes
  let nameMap = new Map();
  if (allBNs.length > 0) {
    const names = await db.query(`
      SELECT DISTINCT ON (bn) bn, legal_name FROM cra_identification
      WHERE bn = ANY($1) ORDER BY bn, fiscal_year DESC
    `, [allBNs]);
    nameMap = new Map(names.rows.map(r => [r.bn, r.legal_name]));
  }

  // Step 5: Get loop info for all nodes
  const loopInfo = await db.query(`
    SELECT bn, total_loops, score FROM cra.loop_universe WHERE bn = ANY($1)
  `, [allBNs]);
  const loopMap = new Map(loopInfo.rows.map(r => [r.bn, { loops: parseInt(r.total_loops), score: parseInt(r.score) || 0 }]));

  // Step 6: Get the actual loop paths for this charity (for hop filtering in frontend)
  const loopsRes = await db.query(`
    SELECT l.id, l.hops, l.path_bns
    FROM cra.loop_participants lp JOIN cra.loops l ON lp.loop_id = l.id
    WHERE lp.bn = $1
  `, [bn]);
  const loops = loopsRes.rows.map(r => ({ id: r.id, hops: r.hops, pathBNs: r.path_bns }));

  // Build response
  const nodes = allBNs.map(id => ({
    id,
    name: nameMap.get(id) || id,
    type: id === bn ? 'target' : loopBNs.includes(id) ? 'loop_member' : 'peripheral',
    inLoop: loopMap.has(id),
    loops: loopMap.get(id)?.loops || 0,
    score: loopMap.get(id)?.score || 0,
  }));

  const edges = allEdges.rows.map(r => ({
    source: r.source,
    target: r.target,
    year: r.year,
    amount: parseFloat(r.amount),
    direction: r.source === bn ? 'out' : r.target === bn ? 'in' : 'between',
    associated: r.associated,
    // Mark edges that are part of a loop path
    inLoopPath: loopBNs.includes(r.source) && loopBNs.includes(r.target),
  }));

  return {
    nodes, edges, loops,
    targetBN: bn,
    targetName: nameMap.get(bn) || bn,
    loopMemberBNs: loopBNs,
  };
}

async function getLoops(bn) {
  const r = await db.query(`
    SELECT l.id, l.hops, l.path_bns, l.path_display, l.bottleneck_amt, l.total_flow, l.min_year, l.max_year,
      ARRAY(
        SELECT DISTINCT y::int
        FROM cra.loop_edges e
        CROSS JOIN UNNEST(e.years) AS y
        WHERE e.src = ANY(l.path_bns) AND e.dst = ANY(l.path_bns)
        ORDER BY y
      ) AS active_years
    FROM cra.loop_participants lp
    JOIN cra.loops l ON lp.loop_id = l.id
    WHERE lp.bn = $1
    ORDER BY l.hops, l.bottleneck_amt DESC
  `, [bn]);

  // Get names for all BNs in loops
  const allBNs = [...new Set(r.rows.flatMap(row => row.path_bns))];
  let nameMap = new Map();
  if (allBNs.length > 0) {
    const names = await db.query(`
      SELECT DISTINCT ON (bn) bn, legal_name FROM cra_identification
      WHERE bn = ANY($1) ORDER BY bn, fiscal_year DESC
    `, [allBNs]);
    nameMap = new Map(names.rows.map(r => [r.bn, r.legal_name]));
  }

  // Get FPE (fiscal period end) per year for this charity to derive quarters
  const fpeRes = await db.query(`
    SELECT EXTRACT(YEAR FROM fpe)::int AS yr, EXTRACT(MONTH FROM fpe)::int AS mo
    FROM cra.cra_financial_details
    WHERE bn = $1 AND fpe IS NOT NULL
    ORDER BY fpe
  `, [bn]);
  const fpeByYear = {};
  fpeRes.rows.forEach(row => {
    fpeByYear[row.yr] = Math.ceil(row.mo / 3);
  });

  // Get charity financial context for scoring
  const ctxRes = await db.query(`
    SELECT u.total_circular_amt, fd.field_4700 AS revenue, fd.field_5000 AS prog_spending,
           fd.field_5100 AS expenditures, ci.designation, ci.category
    FROM cra.loop_universe u
    LEFT JOIN LATERAL (
      SELECT field_4700, field_5000, field_5100
      FROM cra.cra_financial_details WHERE bn = u.bn ORDER BY fpe DESC LIMIT 1
    ) fd ON true
    LEFT JOIN LATERAL (
      SELECT designation, category FROM cra_identification WHERE bn = u.bn ORDER BY fiscal_year DESC LIMIT 1
    ) ci ON true
    WHERE u.bn = $1
  `, [bn]);
  const ctxRow = ctxRes.rows[0] || {};
  const ctxRev = parseFloat(ctxRow.revenue) || 0;
  const ctxProg = parseFloat(ctxRow.prog_spending) || 0;
  const charityCtx = {
    revenue: ctxRev,
    programPct: ctxRev > 0 ? Math.round(ctxProg / ctxRev * 1000) / 10 : 0,
    designation: ctxRow.designation || '',
    category: ctxRow.category || '',
  };

  const loops = r.rows.map(row => {
    const loop = {
      id: row.id,
      hops: row.hops,
      pathBNs: row.path_bns,
      pathNames: row.path_bns.map(b => nameMap.get(b) || b),
      pathDisplay: row.path_display,
      bottleneck: parseFloat(row.bottleneck_amt),
      totalFlow: parseFloat(row.total_flow),
      minYear: row.min_year,
      maxYear: row.max_year,
      activeYears: (row.active_years || []).map(Number),
      fpeByYear,
    };
    loop.suspicionScore = scoreLoop(loop, charityCtx);
    loop.ruleBreakdown  = getRuleBreakdown(loop, charityCtx);
    const weight = Math.log(Math.max(loop.bottleneck || 0, 1) + 1);
    loop.weight = Math.round(weight * 100) / 100;
    return loop;
  });

  // Charity-level score derivation: show each loop's contribution
  let wSum = 0, wTotal = 0;
  for (const l of loops) {
    wSum   += l.suspicionScore * l.weight;
    wTotal += l.weight;
  }
  const weightedAvg = wTotal > 0 ? wSum / wTotal : 0;
  const charityAppScore = Math.max(0, Math.min(30, Math.round(weightedAvg * 3)));

  // Attach derivation summary to each loop (contribution %)
  for (const l of loops) {
    l.weightContrib = wTotal > 0 ? Math.round(l.weight / wTotal * 1000) / 10 : 0;
    l.scoreContrib  = wTotal > 0 ? Math.round(l.suspicionScore * l.weight / wSum * 100) / 100 : 0;
  }

  // Add scoreDerivation metadata as first element's parent (returned as separate field below)
  loops._derivation = {
    loops: loops.map(l => ({ id: l.id, hops: l.hops, suspicionScore: l.suspicionScore, weight: l.weight, weightContrib: l.weightContrib })),
    weightedAvg: Math.round(weightedAvg * 100) / 100,
    multiplier: 3,
    charityAppScore,
  };

  return loops;
}

async function getFinancials(bn) {
  const r = await db.query(`
    SELECT ci.fiscal_year, ci.designation,
           fd.field_4700 AS revenue, fd.field_5100 AS expenditures,
           fd.field_5000 AS prog_spending, fd.field_5010 AS admin,
           fd.field_5020 AS fundraising, fd.field_5050 AS gifts_out,
           fd.field_4510 AS gifts_in, fd.field_4540 AS gov_revenue,
           fd.field_4550 AS gov_grants,
           c.field_390 AS compensation, c.field_300 AS employees
    FROM cra_identification ci
    LEFT JOIN cra_financial_details fd ON ci.bn = fd.bn
      AND fd.fpe = (SELECT MAX(fpe) FROM cra_financial_details WHERE bn = ci.bn AND EXTRACT(YEAR FROM fpe) = ci.fiscal_year)
    LEFT JOIN cra_compensation c ON ci.bn = c.bn AND c.fpe = fd.fpe
    WHERE ci.bn = $1
    ORDER BY ci.fiscal_year
  `, [bn]);

  return r.rows.map(row => ({
    year: row.fiscal_year,
    designation: row.designation,
    revenue: parseFloat(row.revenue) || 0,
    expenditures: parseFloat(row.expenditures) || 0,
    programSpending: parseFloat(row.prog_spending) || 0,
    admin: parseFloat(row.admin) || 0,
    fundraising: parseFloat(row.fundraising) || 0,
    giftsOut: parseFloat(row.gifts_out) || 0,
    giftsIn: parseFloat(row.gifts_in) || 0,
    govRevenue: parseFloat(row.gov_revenue) || 0,
    govGrants: parseFloat(row.gov_grants) || 0,
    compensation: parseFloat(row.compensation) || 0,
    employees: parseInt(row.employees) || 0,
  }));
}

async function getLoopFlow(loopId) {
  // Get the loop path
  const loopRes = await db.query('SELECT path_bns, hops, bottleneck_amt, total_flow FROM cra.loops WHERE id = $1', [loopId]);
  if (loopRes.rows.length === 0) return { error: 'Loop not found' };

  const pathBNs = loopRes.rows[0].path_bns;
  const hops = loopRes.rows[0].hops;

  // For each edge in the loop, get the actual per-year gift transactions
  const edges = [];
  for (let i = 0; i < pathBNs.length; i++) {
    const from = pathBNs[i];
    const to = pathBNs[(i + 1) % pathBNs.length];

    const gifts = await db.query(`
      SELECT EXTRACT(YEAR FROM fpe)::int AS year,
             total_gifts AS amount, fpe,
             associated
      FROM cra_qualified_donees
      WHERE bn = $1 AND donee_bn = $2 AND total_gifts > 0
      ORDER BY fpe
    `, [from, to]);

    edges.push({
      from, to, hopIndex: i,
      transactions: gifts.rows.map(g => ({
        year: g.year,
        amount: parseFloat(g.amount),
        date: g.fpe,
        associated: g.associated,
      })),
      totalAmount: gifts.rows.reduce((s, g) => s + parseFloat(g.amount), 0),
    });
  }

  // Get names
  const names = await db.query(`
    SELECT DISTINCT ON (bn) bn, legal_name FROM cra_identification
    WHERE bn = ANY($1) ORDER BY bn, fiscal_year DESC
  `, [pathBNs]);
  const nameMap = Object.fromEntries(names.rows.map(r => [r.bn, r.legal_name]));

  // Collect all years across all edges
  const allYears = [...new Set(edges.flatMap(e => e.transactions.map(t => t.year)))].sort();

  return {
    loopId: parseInt(loopId),
    hops,
    pathBNs,
    pathNames: pathBNs.map(bn => nameMap[bn] || bn),
    edges,
    allYears,
    bottleneck: parseFloat(loopRes.rows[0].bottleneck_amt),
    totalFlow: parseFloat(loopRes.rows[0].total_flow),
  };
}

// ─── New API functions ────────────────────────────────────────────────────────

async function searchCharities(q) {
  if (!q || q.trim().length < 2) return [];
  const r = await db.query(`
    SELECT u.bn, u.legal_name, u.total_loops, u.score, u.max_bottleneck
    FROM cra.loop_universe u
    WHERE u.legal_name ILIKE $1
    ORDER BY u.score DESC NULLS LAST
    LIMIT 20
  `, [`%${q.trim()}%`]);
  return r.rows.map(row => ({
    bn: row.bn,
    name: row.legal_name,
    score: parseInt(row.score) || 0,
    totalLoops: parseInt(row.total_loops),
    maxBottleneck: parseFloat(row.max_bottleneck) || 0,
  }));
}

async function getTopHubs() {
  const r = await db.query(`
    SELECT h.bn, h.legal_name, h.in_degree, h.out_degree, h.total_degree,
           h.total_inflow, h.total_outflow, h.hub_type,
           u.score, u.total_loops, u.max_bottleneck
    FROM cra.identified_hubs h
    LEFT JOIN cra.loop_universe u ON h.bn = u.bn
    ORDER BY h.total_degree DESC
    LIMIT 50
  `);
  return r.rows.map(row => ({
    bn: row.bn, name: row.legal_name,
    inDegree: parseInt(row.in_degree), outDegree: parseInt(row.out_degree),
    totalDegree: parseInt(row.total_degree),
    totalInflow: parseFloat(row.total_inflow) || 0,
    totalOutflow: parseFloat(row.total_outflow) || 0,
    hubType: row.hub_type,
    score: parseInt(row.score) || 0,
    totalLoops: parseInt(row.total_loops) || 0,
    maxBottleneck: parseFloat(row.max_bottleneck) || 0,
  }));
}

// ─── HTTP Server ─────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // Handle preflight
  if (req.method === 'OPTIONS') {
    setCORSHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // API routes
  if (pathname.startsWith('/api/')) {
    // Handle POST endpoints (score run)
    if (req.method === 'POST' && pathname === '/api/score/run') {
      setCORSHeaders(res);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const resultPromise = runScoringJob();
      resultPromise.then(result => {
        console.log('[TNA Scoring] Batch complete:', result.totalScored, 'charities');
      });
      res.end(JSON.stringify({ status: 'started', message: 'TNA scoring job launched' }));
      return;
    }
    // GET scoring status
    if (req.method === 'GET' && pathname === '/api/score/status') {
      setCORSHeaders(res);
      try {
        const status = await getScoringStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // ── Rules CRUD ─────────────────────────────────────────────────────────
    // GET /api/rules
    if (req.method === 'GET' && pathname === '/api/rules') {
      setCORSHeaders(res);
      if (mock) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([]));
        return;
      }
      try {
        const rules = await loadRules();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(rules));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // Helpers to read POST/PUT body
    const readBody = () => new Promise((resolve) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
    });

    const rulesMatch = pathname.match(/^\/api\/rules\/(\d+)$/);

    // POST /api/rules — create rule
    if (req.method === 'POST' && pathname === '/api/rules') {
      setCORSHeaders(res);
      if (mock) { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'No database in demo mode' })); return; }
      try {
        const b = await readBody();
        const maxOrder = await db.query('SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM cra.scoring_rules');
        const { rows } = await db.query(
          `INSERT INTO cra.scoring_rules
             (name, description, rule_type, condition_field, condition_operator, condition_value, score_delta, enabled, is_default, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE,$9) RETURNING *`,
          [b.name, b.description || '', b.rule_type, b.condition_field, b.condition_operator,
           b.condition_value, b.score_delta, b.enabled !== false, maxOrder.rows[0].n]
        );
        await loadRules();
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(rows[0]));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // PUT /api/rules/:id — update rule
    if (req.method === 'PUT' && rulesMatch) {
      setCORSHeaders(res);
      if (mock) { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'No database in demo mode' })); return; }
      const id = rulesMatch[1];
      try {
        const b = await readBody();
        const { rows } = await db.query(
          `UPDATE cra.scoring_rules SET
             name=$1, description=$2, rule_type=$3, condition_field=$4,
             condition_operator=$5, condition_value=$6, score_delta=$7, enabled=$8,
             updated_at=NOW()
           WHERE id=$9 RETURNING *`,
          [b.name, b.description || '', b.rule_type, b.condition_field, b.condition_operator,
           b.condition_value, b.score_delta, b.enabled !== false, id]
        );
        if (rows.length === 0) { res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return; }
        await loadRules();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(rows[0]));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // DELETE /api/rules/:id
    if (req.method === 'DELETE' && rulesMatch) {
      setCORSHeaders(res);
      if (mock) { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'No database in demo mode' })); return; }
      const id = rulesMatch[1];
      try {
        await db.query('DELETE FROM cra.scoring_rules WHERE id=$1', [id]);
        await loadRules();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ deleted: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // POST /api/rules/reset — restore defaults
    if (req.method === 'POST' && pathname === '/api/rules/reset') {
      setCORSHeaders(res);
      if (mock) { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'No database in demo mode' })); return; }
      try {
        await db.query('DELETE FROM cra.scoring_rules');
        for (const r of DEFAULT_RULES) {
          await db.query(
            `INSERT INTO cra.scoring_rules
               (name, description, rule_type, condition_field, condition_operator, condition_value, score_delta, is_default, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8)`,
            [r.name, r.description, r.rule_type, r.condition_field, r.condition_operator, r.condition_value, r.score_delta, r.sort_order]
          );
        }
        const rules = await loadRules();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reset: true, count: rules.length }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    return handleAPI(pathname, parsed.query, res);
  }

  // Static files — serve the React app's dist if it exists, else fall back to index.html
  const distDir = path.join(__dirname, '..', 'funding-loops-app', 'dist');
  const legacyHtml = path.join(__dirname, 'index.html');

  let filePath;
  if (pathname === '/' || pathname === '/index.html') {
    const distIndex = path.join(distDir, 'index.html');
    filePath = fs.existsSync(distIndex) ? distIndex : legacyHtml;
  } else {
    const distFile = path.join(distDir, pathname);
    filePath = fs.existsSync(distFile) ? distFile : path.join(__dirname, pathname);
  }

  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html', '.js': 'application/javascript',
    '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.svg': 'image/svg+xml',
  };

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    res.end(content);
  } catch (err) {
    // SPA fallback — serve index.html for client-side routes (e.g. /charity/:bn)
    const distIndex = path.join(distDir, 'index.html');
    const fallback = fs.existsSync(distIndex) ? distIndex : legacyHtml;
    try {
      const html = fs.readFileSync(fallback);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  }
});

server.listen(PORT, async () => {
  console.log(`\nCRA Circular Gifting Visualization — Follow the Money`);
  if (mock) console.log(`Mode: DEMO (sample data — no database)`);
  else console.log(`Mode: LIVE (connected to PostgreSQL)`);
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`\nAPI endpoints:`);
  console.log(`  GET  /api/stats              Overall statistics`);
  console.log(`  GET  /api/universe           All charities in loops`);
  console.log(`  GET  /api/charity/:bn        Charity profile`);
  console.log(`  GET  /api/network/:bn        Gift network for D3`);
  console.log(`  GET  /api/loops/:bn          Loops for a charity`);
  console.log(`  GET  /api/financials/:bn     Multi-year financials`);
  console.log(`  GET  /api/search?q=term      Search charities`);
  console.log(`  GET  /api/tophubs            Top hub charities`);
  console.log(`  GET  /api/score/status       TNA scoring status`);
  console.log(`  POST /api/score/run          Run batch TNA scoring`);
  console.log(`\nFrontend:`);
  const distIndex = require('path').join(__dirname, '..', 'funding-loops-app', 'dist', 'index.html');
  if (require('fs').existsSync(distIndex)) {
    console.log(`  React app (dist) served at http://localhost:${PORT}/`);
  } else {
    console.log(`  Legacy HTML at http://localhost:${PORT}/`);
    console.log(`  React dev: cd funding-loops-app && npm run dev`);
  }

  // Ensure scoring table exists (non-blocking)
  if (!mock) {
    ensureScoringTable()
      .then(() => console.log('[TNA] cra.tna_scores table ready'))
      .catch(err => console.warn('[TNA] Could not create scoring table:', err.message));

    ensureRulesTable()
      .then(() => loadRules())
      .then(rules => console.log(`[Rules] Loaded ${rules.length} scoring rules`))
      .catch(err => console.warn('[Rules] Could not initialise rules table:', err.message));
  }
});
