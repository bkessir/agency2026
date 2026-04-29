/**
 * mock.js — Demo data for testing without a live database.
 *
 * Mirrors the exact response shapes of server.js API functions.
 * Activated automatically when DB_CONNECTION_STRING is not set.
 *
 * Replace with real data on event day by placing .env.public in CRA/
 */

'use strict';

// ─── Charity master list ────────────────────────────────────────────────────

const CHARITIES = [
  { bn: '123456789RR0001', name: 'Canadian Health Research Foundation',       city: 'Toronto',    province: 'ON', designation: 'T', category: '2110', score: 28, totalLoops: 14 },
  { bn: '234567890RR0001', name: 'Northern Community Development Trust',      city: 'Calgary',    province: 'AB', designation: 'T', category: '2110', score: 25, totalLoops: 11 },
  { bn: '345678901RR0001', name: 'Alberta Social Programs Initiative',         city: 'Edmonton',   province: 'AB', designation: 'T', category: '2110', score: 22, totalLoops: 9  },
  { bn: '456789012RR0001', name: 'Prairie Youth Development Society',          city: 'Regina',     province: 'SK', designation: 'T', category: '2220', score: 19, totalLoops: 8  },
  { bn: '567890123RR0001', name: 'National Wellness Coalition',                city: 'Vancouver',  province: 'BC', designation: 'T', category: '2110', score: 17, totalLoops: 7  },
  { bn: '678901234RR0001', name: 'Pacific Rim Community Fund',                 city: 'Burnaby',    province: 'BC', designation: 'T', category: '2110', score: 15, totalLoops: 6  },
  { bn: '789012345RR0001', name: 'Heritage Arts & Culture Foundation',         city: 'Winnipeg',   province: 'MB', designation: 'T', category: '2350', score: 13, totalLoops: 5  },
  { bn: '890123456RR0001', name: 'Great Plains Education Trust',               city: 'Saskatoon',  province: 'SK', designation: 'T', category: '2220', score: 11, totalLoops: 5  },
  { bn: '901234567RR0001', name: 'Metropolitan Relief & Support Society',      city: 'Ottawa',     province: 'ON', designation: 'T', category: '2110', score: 9,  totalLoops: 4  },
  { bn: '012345678RR0001', name: 'Urban Housing Renewal Collective',           city: 'Montreal',   province: 'QC', designation: 'T', category: '2110', score: 7,  totalLoops: 3  },
  { bn: '111222333RR0001', name: 'Rural Development & Outreach Fund',          city: 'Lethbridge', province: 'AB', designation: 'T', category: '2440', score: 5,  totalLoops: 3  },
  { bn: '222333444RR0001', name: 'Indigenous Wellness & Healing Network',      city: 'Prince George', province: 'BC', designation: 'T', category: '2110', score: 5, totalLoops: 2 },
  { bn: '333444555RR0001', name: 'Youth Sports & Recreation Society',          city: 'Hamilton',   province: 'ON', designation: 'T', category: '2220', score: 3,  totalLoops: 2  },
  { bn: '444555666RR0001', name: 'Environmental Conservation Trust',           city: 'Victoria',   province: 'BC', designation: 'T', category: '2480', score: 3,  totalLoops: 2  },
  { bn: '555666777RR0001', name: 'Cultural Heritage Preservation Society',     city: 'Halifax',    province: 'NS', designation: 'T', category: '2350', score: 2,  totalLoops: 1  },
];

const BN_MAP = Object.fromEntries(CHARITIES.map(c => [c.bn, c]));

// ─── Financial data (5 years, per charity) ──────────────────────────────────

function makeFinancials(bn) {
  const c = BN_MAP[bn];
  if (!c) return [];
  // Scale financial figures by score for realism
  const base = c.score * 120000;
  const years = [2020, 2021, 2022, 2023, 2024];
  return years.map((year, i) => {
    const rev = Math.round(base * (1 + i * 0.07) * (0.9 + Math.random() * 0.2));
    const exp = Math.round(rev * 0.92);
    const prog = Math.round(exp * 0.61);
    const admin = Math.round(exp * 0.22);
    const fund = Math.round(exp * 0.10);
    const comp = Math.round(exp * 0.42);
    const giftsOut = Math.round(rev * (c.score > 15 ? 0.38 : 0.18));
    const giftsIn = Math.round(rev * (c.score > 15 ? 0.35 : 0.15));
    return {
      year,
      designation: c.designation,
      revenue: rev,
      expenditures: exp,
      programSpending: prog,
      admin,
      fundraising: fund,
      giftsOut,
      giftsIn,
      govRevenue: Math.round(rev * 0.12),
      govGrants: Math.round(rev * 0.08),
      compensation: comp,
      employees: Math.max(1, Math.round(c.score / 3)),
    };
  });
}

// ─── Loop definitions ────────────────────────────────────────────────────────

const LOOPS = [
  {
    id: 1, hops: 2,
    path_bns: ['123456789RR0001', '234567890RR0001'],
    path_display: 'Canadian Health Research Foundation → Northern Community Development Trust → [back]',
    bottleneck_amt: 1850000, total_flow: 4200000, min_year: 2020, max_year: 2024,
  },
  {
    id: 2, hops: 3,
    path_bns: ['123456789RR0001', '234567890RR0001', '345678901RR0001'],
    path_display: 'Canadian Health Research Foundation → Northern Community Development Trust → Alberta Social Programs Initiative → [back]',
    bottleneck_amt: 1200000, total_flow: 3100000, min_year: 2021, max_year: 2024,
  },
  {
    id: 3, hops: 2,
    path_bns: ['123456789RR0001', '456789012RR0001'],
    path_display: 'Canadian Health Research Foundation → Prairie Youth Development Society → [back]',
    bottleneck_amt: 980000, total_flow: 2400000, min_year: 2020, max_year: 2023,
  },
  {
    id: 4, hops: 4,
    path_bns: ['234567890RR0001', '567890123RR0001', '678901234RR0001', '789012345RR0001'],
    path_display: 'Northern Community Development Trust → National Wellness Coalition → Pacific Rim Community Fund → Heritage Arts & Culture Foundation → [back]',
    bottleneck_amt: 760000, total_flow: 1900000, min_year: 2021, max_year: 2024,
  },
  {
    id: 5, hops: 2,
    path_bns: ['345678901RR0001', '567890123RR0001'],
    path_display: 'Alberta Social Programs Initiative → National Wellness Coalition → [back]',
    bottleneck_amt: 620000, total_flow: 1450000, min_year: 2022, max_year: 2024,
  },
  {
    id: 6, hops: 3,
    path_bns: ['456789012RR0001', '678901234RR0001', '890123456RR0001'],
    path_display: 'Prairie Youth Development Society → Pacific Rim Community Fund → Great Plains Education Trust → [back]',
    bottleneck_amt: 540000, total_flow: 1320000, min_year: 2020, max_year: 2023,
  },
  {
    id: 7, hops: 2,
    path_bns: ['567890123RR0001', '789012345RR0001'],
    path_display: 'National Wellness Coalition → Heritage Arts & Culture Foundation → [back]',
    bottleneck_amt: 430000, total_flow: 1100000, min_year: 2021, max_year: 2024,
  },
  {
    id: 8, hops: 3,
    path_bns: ['678901234RR0001', '901234567RR0001', '012345678RR0001'],
    path_display: 'Pacific Rim Community Fund → Metropolitan Relief & Support Society → Urban Housing Renewal Collective → [back]',
    bottleneck_amt: 380000, total_flow: 940000, min_year: 2022, max_year: 2024,
  },
  {
    id: 9, hops: 2,
    path_bns: ['111222333RR0001', '222333444RR0001'],
    path_display: 'Rural Development & Outreach Fund → Indigenous Wellness & Healing Network → [back]',
    bottleneck_amt: 210000, total_flow: 520000, min_year: 2020, max_year: 2022,
  },
  {
    id: 10, hops: 2,
    path_bns: ['333444555RR0001', '444555666RR0001'],
    path_display: 'Youth Sports & Recreation Society → Environmental Conservation Trust → [back]',
    bottleneck_amt: 95000, total_flow: 240000, min_year: 2021, max_year: 2023,
  },
];

// loop_id → which BNs participate
const LOOP_PARTICIPANTS = {};
for (const loop of LOOPS) {
  for (let i = 0; i < loop.path_bns.length; i++) {
    const bn = loop.path_bns[i];
    if (!LOOP_PARTICIPANTS[bn]) LOOP_PARTICIPANTS[bn] = [];
    LOOP_PARTICIPANTS[bn].push({
      loop_id: loop.id,
      sends_to: loop.path_bns[(i + 1) % loop.path_bns.length],
      receives_from: loop.path_bns[(i - 1 + loop.path_bns.length) % loop.path_bns.length],
    });
  }
}

// ─── Edges (directed gift flows) ─────────────────────────────────────────────

const EDGES = [
  { src: '123456789RR0001', dst: '234567890RR0001', total_amt: 2200000, edge_count: 12, min_year: 2020, max_year: 2024, years: [2020,2021,2022,2023,2024] },
  { src: '234567890RR0001', dst: '123456789RR0001', total_amt: 1850000, edge_count: 10, min_year: 2020, max_year: 2024, years: [2020,2021,2022,2023,2024] },
  { src: '234567890RR0001', dst: '345678901RR0001', total_amt: 1600000, edge_count: 9,  min_year: 2021, max_year: 2024, years: [2021,2022,2023,2024] },
  { src: '345678901RR0001', dst: '123456789RR0001', total_amt: 1200000, edge_count: 7,  min_year: 2021, max_year: 2024, years: [2021,2022,2023,2024] },
  { src: '123456789RR0001', dst: '456789012RR0001', total_amt: 1100000, edge_count: 8,  min_year: 2020, max_year: 2023, years: [2020,2021,2022,2023] },
  { src: '456789012RR0001', dst: '123456789RR0001', total_amt: 980000,  edge_count: 6,  min_year: 2020, max_year: 2023, years: [2020,2021,2022,2023] },
  { src: '234567890RR0001', dst: '567890123RR0001', total_amt: 890000,  edge_count: 5,  min_year: 2021, max_year: 2024, years: [2021,2022,2023,2024] },
  { src: '567890123RR0001', dst: '678901234RR0001', total_amt: 820000,  edge_count: 5,  min_year: 2021, max_year: 2024, years: [2021,2022,2023,2024] },
  { src: '678901234RR0001', dst: '789012345RR0001', total_amt: 760000,  edge_count: 4,  min_year: 2021, max_year: 2024, years: [2021,2022,2023,2024] },
  { src: '789012345RR0001', dst: '234567890RR0001', total_amt: 700000,  edge_count: 4,  min_year: 2021, max_year: 2024, years: [2021,2022,2023,2024] },
  { src: '345678901RR0001', dst: '567890123RR0001', total_amt: 680000,  edge_count: 4,  min_year: 2022, max_year: 2024, years: [2022,2023,2024] },
  { src: '567890123RR0001', dst: '345678901RR0001', total_amt: 620000,  edge_count: 4,  min_year: 2022, max_year: 2024, years: [2022,2023,2024] },
  { src: '456789012RR0001', dst: '678901234RR0001', total_amt: 580000,  edge_count: 5,  min_year: 2020, max_year: 2023, years: [2020,2021,2022,2023] },
  { src: '678901234RR0001', dst: '890123456RR0001', total_amt: 540000,  edge_count: 4,  min_year: 2020, max_year: 2023, years: [2020,2021,2022,2023] },
  { src: '890123456RR0001', dst: '456789012RR0001', total_amt: 490000,  edge_count: 3,  min_year: 2020, max_year: 2023, years: [2020,2021,2022,2023] },
  { src: '567890123RR0001', dst: '789012345RR0001', total_amt: 460000,  edge_count: 3,  min_year: 2021, max_year: 2024, years: [2021,2022,2023,2024] },
  { src: '789012345RR0001', dst: '567890123RR0001', total_amt: 430000,  edge_count: 3,  min_year: 2021, max_year: 2024, years: [2021,2022,2023,2024] },
  { src: '678901234RR0001', dst: '901234567RR0001', total_amt: 410000,  edge_count: 3,  min_year: 2022, max_year: 2024, years: [2022,2023,2024] },
  { src: '901234567RR0001', dst: '012345678RR0001', total_amt: 390000,  edge_count: 3,  min_year: 2022, max_year: 2024, years: [2022,2023,2024] },
  { src: '012345678RR0001', dst: '678901234RR0001', total_amt: 380000,  edge_count: 3,  min_year: 2022, max_year: 2024, years: [2022,2023,2024] },
  { src: '111222333RR0001', dst: '222333444RR0001', total_amt: 260000,  edge_count: 2,  min_year: 2020, max_year: 2022, years: [2020,2021,2022] },
  { src: '222333444RR0001', dst: '111222333RR0001', total_amt: 210000,  edge_count: 2,  min_year: 2020, max_year: 2022, years: [2020,2021,2022] },
  { src: '333444555RR0001', dst: '444555666RR0001', total_amt: 120000,  edge_count: 2,  min_year: 2021, max_year: 2023, years: [2021,2022,2023] },
  { src: '444555666RR0001', dst: '333444555RR0001', total_amt: 95000,   edge_count: 2,  min_year: 2021, max_year: 2023, years: [2021,2022,2023] },
];

// Pre-build edge index for fast lookup
const EDGE_BY_SRC = {};
for (const e of EDGES) {
  if (!EDGE_BY_SRC[e.src]) EDGE_BY_SRC[e.src] = [];
  EDGE_BY_SRC[e.src].push(e);
}
const EDGE_BY_DST = {};
for (const e of EDGES) {
  if (!EDGE_BY_DST[e.dst]) EDGE_BY_DST[e.dst] = [];
  EDGE_BY_DST[e.dst].push(e);
}

// ─── Identified hubs ─────────────────────────────────────────────────────────

const HUBS = [
  { bn: '123456789RR0001', in_degree: 2,  out_degree: 2,  total_degree: 4,  total_inflow: 3050000, total_outflow: 3300000, hub_type: 'Distributor' },
  { bn: '234567890RR0001', in_degree: 3,  out_degree: 2,  total_degree: 5,  total_inflow: 2550000, total_outflow: 2490000, hub_type: 'Central Hub' },
  { bn: '345678901RR0001', in_degree: 1,  out_degree: 2,  total_degree: 3,  total_inflow: 1200000, total_outflow: 2280000, hub_type: 'Distributor' },
  { bn: '456789012RR0001', in_degree: 2,  out_degree: 2,  total_degree: 4,  total_inflow: 1470000, total_outflow: 1680000, hub_type: 'Bridge' },
  { bn: '567890123RR0001', in_degree: 2,  out_degree: 2,  total_degree: 4,  total_inflow: 1440000, total_outflow: 1500000, hub_type: 'Bridge' },
  { bn: '678901234RR0001', in_degree: 2,  out_degree: 3,  total_degree: 5,  total_inflow: 1120000, total_outflow: 1730000, hub_type: 'Central Hub' },
  { bn: '789012345RR0001', in_degree: 2,  out_degree: 1,  total_degree: 3,  total_inflow: 1190000, total_outflow:  700000, hub_type: 'Collector' },
  { bn: '890123456RR0001', in_degree: 1,  out_degree: 1,  total_degree: 2,  total_inflow:  540000, total_outflow:  490000, hub_type: 'Bridge' },
  { bn: '901234567RR0001', in_degree: 1,  out_degree: 1,  total_degree: 2,  total_inflow:  410000, total_outflow:  390000, hub_type: 'Bridge' },
  { bn: '012345678RR0001', in_degree: 1,  out_degree: 1,  total_degree: 2,  total_inflow:  390000, total_outflow:  380000, hub_type: 'Bridge' },
];

// ─── universe scores (per charity) ───────────────────────────────────────────

function makeUniverseRow(c) {
  const h2 = c.score > 20 ? 4 : c.score > 10 ? 2 : c.score > 5 ? 1 : 0;
  const h3 = c.score > 15 ? 3 : c.score > 8  ? 2 : c.score > 4 ? 1 : 0;
  const h4 = c.score > 12 ? 2 : c.score > 7  ? 1 : 0;
  const h5 = c.score > 18 ? 1 : 0;
  const fin = makeFinancials(c.bn);
  const latest = fin[fin.length - 1] || {};
  const maxBottleneck = c.score * 66000;
  const totalCircular = c.score * 145000;
  return {
    bn: c.bn,
    name: c.name,
    score: c.score,
    designation: c.designation,
    category: c.category,
    totalLoops: c.totalLoops,
    loops: { h2, h3, h4, h5, h6: 0 },
    revenue: latest.revenue || 0,
    expenditures: latest.expenditures || 0,
    programSpending: latest.programSpending || 0,
    admin: latest.admin || 0,
    fundraising: latest.fundraising || 0,
    overheadPct: latest.expenditures > 0
      ? Math.round(((latest.admin || 0) + (latest.fundraising || 0)) / latest.expenditures * 1000) / 10
      : 0,
    programPct: latest.revenue > 0
      ? Math.round((latest.programSpending || 0) / latest.revenue * 1000) / 10
      : 0,
    giftsIn: latest.giftsIn || 0,
    giftsOut: latest.giftsOut || 0,
    compensation: latest.compensation || 0,
    maxBottleneck,
    totalCircular,
  };
}

// ─── Exported API mock functions ─────────────────────────────────────────────

async function getStats() {
  const counts = {};
  for (const l of LOOPS) {
    const key = l.hops + '-hop';
    counts[key] = (counts[key] || 0) + 1;
  }
  return {
    loopCounts: counts,
    totalLoops: LOOPS.length,
    universeSize: CHARITIES.length,
    edgeCount: EDGES.length,
  };
}

async function getUniverse() {
  return CHARITIES.sort((a, b) => b.score - a.score).map(makeUniverseRow);
}

async function getCharity(bn) {
  const c = BN_MAP[bn];
  if (!c) return { error: 'Not found' };

  const participation = (LOOP_PARTICIPANTS[bn] || []).map(p => {
    const loop = LOOPS.find(l => l.id === p.loop_id);
    return {
      sends_to: p.sends_to,
      receives_from: p.receives_from,
      hops: loop.hops,
      bottleneck_amt: loop.bottleneck_amt,
      path_display: loop.path_display,
      min_year: loop.min_year,
      max_year: loop.max_year,
    };
  });

  const fin = makeFinancials(bn)[4] || {}; // latest year

  return {
    bn: c.bn,
    name: c.name,
    designation: c.designation,
    category: c.category,
    city: c.city,
    province: c.province,
    score: c.score,
    totalLoops: c.totalLoops,
    loops: { h2: 1, h3: Math.floor(c.totalLoops / 3), h4: Math.floor(c.totalLoops / 4), h5: 0, h6: 0 },
    maxBottleneck: c.score * 66000,
    totalCircular: c.score * 145000,
    revenue: fin.revenue || 0,
    expenditures: fin.expenditures || 0,
    programSpending: fin.programSpending || 0,
    admin: fin.admin || 0,
    fundraising: fin.fundraising || 0,
    giftsIn: fin.giftsIn || 0,
    giftsOut: fin.giftsOut || 0,
    compensation: fin.compensation || 0,
    overheadPct: fin.expenditures > 0 ? Math.round((fin.admin + fin.fundraising) / fin.expenditures * 1000) / 10 : 0,
    programPct: fin.revenue > 0 ? Math.round(fin.programSpending / fin.revenue * 1000) / 10 : 0,
    loopParticipation: participation,
  };
}

async function getNetwork(bn) {
  if (!BN_MAP[bn]) return { nodes: [], edges: [], loops: [], targetBN: bn, targetName: bn, loopMemberBNs: [] };

  // Find all loop member BNs for this charity
  const myLoops = LOOPS.filter(l => l.path_bns.includes(bn));
  const loopBNs = [...new Set(myLoops.flatMap(l => l.path_bns))];
  if (!loopBNs.includes(bn)) loopBNs.push(bn);

  // Find relevant edges
  const relevantEdges = EDGES.filter(e =>
    (loopBNs.includes(e.src) && loopBNs.includes(e.dst)) ||
    e.src === bn || e.dst === bn
  );

  const nodeSet = new Set([...loopBNs, ...relevantEdges.flatMap(e => [e.src, e.dst])]);
  const allBNs = [...nodeSet];

  const loopLookup = Object.fromEntries(CHARITIES.map(c => [c.bn, { loops: c.totalLoops, score: c.score }]));

  const nodes = allBNs.map(id => ({
    id,
    name: BN_MAP[id]?.name || id,
    type: id === bn ? 'target' : loopBNs.includes(id) ? 'loop_member' : 'peripheral',
    inLoop: !!BN_MAP[id],
    loops: loopLookup[id]?.loops || 0,
    score: loopLookup[id]?.score || 0,
  }));

  const edges = relevantEdges.map(e => ({
    source: e.src,
    target: e.dst,
    year: e.max_year,
    amount: e.total_amt,
    direction: e.src === bn ? 'out' : e.dst === bn ? 'in' : 'between',
    associated: false,
    inLoopPath: loopBNs.includes(e.src) && loopBNs.includes(e.dst),
  }));

  const loops = myLoops.map(l => ({ id: l.id, hops: l.hops, pathBNs: l.path_bns }));

  return {
    nodes, edges, loops,
    targetBN: bn,
    targetName: BN_MAP[bn]?.name || bn,
    loopMemberBNs: loopBNs,
  };
}

async function getLoops(bn) {
  if (!BN_MAP[bn]) return [];
  const myLoops = LOOPS.filter(l => l.path_bns.includes(bn));
  return myLoops.map(l => ({
    id: l.id,
    hops: l.hops,
    pathBNs: l.path_bns,
    pathNames: l.path_bns.map(b => BN_MAP[b]?.name || b),
    pathDisplay: l.path_display,
    bottleneck: l.bottleneck_amt,
    totalFlow: l.total_flow,
    minYear: l.min_year,
    maxYear: l.max_year,
  }));
}

async function getFinancials(bn) {
  return makeFinancials(bn);
}

async function getLoopFlow(loopId) {
  const loop = LOOPS.find(l => l.id === parseInt(loopId));
  if (!loop) return { error: 'Loop not found' };

  const edges = [];
  for (let i = 0; i < loop.path_bns.length; i++) {
    const from = loop.path_bns[i];
    const to = loop.path_bns[(i + 1) % loop.path_bns.length];
    const edge = EDGES.find(e => e.src === from && e.dst === to);
    const txns = (edge?.years || [loop.min_year]).map(yr => ({
      year: yr,
      amount: Math.round((edge?.total_amt || 100000) / (edge?.years?.length || 1)),
      date: `${yr}-03-31`,
      associated: false,
    }));
    edges.push({
      from, to, hopIndex: i,
      transactions: txns,
      totalAmount: txns.reduce((s, t) => s + t.amount, 0),
    });
  }

  const allYears = [...new Set(edges.flatMap(e => e.transactions.map(t => t.year)))].sort();

  return {
    loopId: parseInt(loopId),
    hops: loop.hops,
    pathBNs: loop.path_bns,
    pathNames: loop.path_bns.map(b => BN_MAP[b]?.name || b),
    edges,
    allYears,
    bottleneck: loop.bottleneck_amt,
    totalFlow: loop.total_flow,
  };
}

async function searchCharities(q) {
  if (!q || q.trim().length < 2) return [];
  const term = q.trim().toLowerCase();
  return CHARITIES
    .filter(c => c.name.toLowerCase().includes(term))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map(c => ({
      bn: c.bn,
      name: c.name,
      score: c.score,
      totalLoops: c.totalLoops,
      maxBottleneck: c.score * 66000,
    }));
}

async function getTopHubs() {
  return HUBS.sort((a, b) => b.total_degree - a.total_degree).map(h => {
    const c = BN_MAP[h.bn];
    return {
      bn: h.bn,
      name: c?.name || h.bn,
      inDegree: h.in_degree,
      outDegree: h.out_degree,
      totalDegree: h.total_degree,
      totalInflow: h.total_inflow,
      totalOutflow: h.total_outflow,
      hubType: h.hub_type,
      score: c?.score || 0,
      totalLoops: c?.totalLoops || 0,
      maxBottleneck: (c?.score || 0) * 66000,
    };
  });
}

module.exports = {
  getStats, getUniverse, getCharity, getNetwork,
  getLoops, getFinancials, getLoopFlow,
  searchCharities, getTopHubs,
  IS_MOCK: true,
};
