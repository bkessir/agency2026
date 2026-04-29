import { jsPDF } from 'jspdf'

const fmt$ = v => v >= 1e6 ? `CAD $${(v/1e6).toFixed(2)}M` : v >= 1e3 ? `CAD $${(v/1e3).toFixed(0)}K` : `CAD $${(v||0).toFixed(0)}`

export function downloadSTRPDF(charity, loops, displayScore, bn) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10)
  const refId = `STR-DRAFT-${(bn || '').replace(/\s/g, '')}-${dateStr.replace(/-/g, '')}`
  const charityName = charity?.name || bn || 'Unknown'
  const totalLoops = charity?.totalLoops || 0
  const circular = charity?.totalCircular || 0
  const maxBottle = charity?.maxBottleneck || 0
  const progPct = charity?.programPct || 0
  const revenue = charity?.revenue || 0
  const circRatio = revenue > 0 ? circular / revenue : 0
  const h2 = charity?.loops?.h2 || 0
  const h3 = charity?.loops?.h3 || 0
  const riskLabel = displayScore >= 20 ? 'CRITICAL' : displayScore >= 10 ? 'HIGH' : displayScore >= 5 ? 'MEDIUM' : 'LOW'
  const riskColor = displayScore >= 20 ? [220,38,38] : displayScore >= 10 ? [217,119,6] : displayScore >= 5 ? [234,179,8] : [22,163,74]

  const redFlags = []
  const yellowFlags = []
  if (h2 > 0) redFlags.push({
    title: `${charityName} — ${h2} Direct Reciprocal Exchange${h2>1?'s':''} Detected`,
    source: 'CRA Registered Charities Database | Pattern: CIRCULAR_TRANSACTION',
    note: `Direct 2-hop reciprocal gifting loops identified where funds complete a full circle between charities — the pattern most associated with inflated donation receipt schemes under ITA s.188. Total circular value: ${fmt$(circular)}.`
  })
  if (progPct < 20 && revenue > 0) redFlags.push({
    title: `${progPct.toFixed(1)}% Program Spending Ratio — Pass-Through Risk`,
    source: 'CRA T3010 Financial Returns | Pattern: PASS_THROUGH_VEHICLE',
    note: `Only ${progPct.toFixed(1)}% of revenue directed to charitable programs. Organizations below 20% are flagged for potential use as pass-through vehicles under CRA compliance guidelines.`
  })
  if (h3 > 0 || totalLoops > 5) {
    const target = redFlags.length < 2 ? redFlags : yellowFlags
    target.push({
      title: `${totalLoops} Circular Funding Loop${totalLoops>1?'s':''} Across Multiple Hop Depths`,
      source: 'Network Analysis — CRA T3010 Cross-Reference',
      note: `${h3} triangular (3-hop) loop${h3>1?'s':''} and ${totalLoops - h2 - h3} longer-chain loops detected. Multi-hop structures may indicate deliberate obfuscation of fund origin.`
    })
  }
  if (circRatio > 0.3) yellowFlags.push({
    title: `${(circRatio*100).toFixed(0)}% of Revenue Flows Through Circular Paths`,
    source: 'CRA T3010 Financial Returns',
    note: `${fmt$(circular)} — ${(circRatio*100).toFixed(1)}% of reported revenue — passed through circular loops. A ratio above 30% is flagged for compliance review.`
  })

  const topLoops = [...(loops||[])].sort((a,b)=>(b.bottleneck||0)-(a.bottleneck||0)).slice(0,3)
  const PW = 612, margin = 48, cw = PW - margin*2
  let y = margin

  const checkPage = (needed = 20) => { if (y + needed > 760) { doc.addPage(); y = margin } }
  const drawSep = () => { doc.setDrawColor(30,58,138).setLineWidth(0.8).line(margin,y,PW-margin,y); y += 10 }
  const text = (str, opts = {}) => {
    const { size=9, bold=false, color=[30,30,30], indent=0, lineH=14 } = opts
    doc.setFontSize(size).setFont('helvetica', bold?'bold':'normal').setTextColor(...color)
    const lines = doc.splitTextToSize(str, cw - indent)
    checkPage(lines.length * lineH + 4)
    lines.forEach(l => { doc.text(l, margin+indent, y); y += lineH })
  }
  const sectionHeader = (title) => {
    checkPage(32); y += 6; drawSep()
    doc.setFillColor(30,58,138).rect(margin, y, cw, 20, 'F')
    doc.setFontSize(9).setFont('helvetica','bold').setTextColor(255,255,255)
    doc.text(title, margin+6, y+13); y += 26; drawSep()
  }

  // Header
  doc.setFillColor(15,23,42).rect(0,0,PW,56,'F')
  doc.setFontSize(10).setFont('helvetica','bold').setTextColor(255,255,255)
  doc.text('GOVERNMENT OF ALBERTA — ENTERPRISE PLATFORM FOR ACCOUNTABILITY (EPA)', margin, 22)
  doc.setFontSize(8).setFont('helvetica','normal').setTextColor(148,163,184)
  doc.text('FINTRAC SUSPICIOUS TRANSACTION REPORT — AI-ASSISTED DRAFT', margin, 36)
  doc.setFontSize(7).setTextColor(100,116,139)
  doc.text('CONFIDENTIAL — PROTECTED B — NOT FOR DISTRIBUTION', margin, 50)
  y = 72

  // Meta
  const meta = [
    ['REPORT REFERENCE', refId], ['REPORT DATE', dateStr],
    ['PREPARED BY', 'GOA Forensic Intelligence Platform for Accountability (FIPA)'],
    ['STATUS', 'DRAFT — REQUIRES HUMAN REVIEW BEFORE SUBMISSION'], ['CHALLENGE', 'C3 + C6 + C10'],
  ]
  meta.forEach(([k,v]) => {
    doc.setFontSize(8).setFont('helvetica','bold').setTextColor(100,116,139).text(k+':', margin, y)
    doc.setFont('helvetica','normal').setTextColor(15,23,42).text(v, margin+120, y); y += 14
  })
  y += 4

  // Part A
  sectionHeader('PART A — SUBJECT ENTITY IDENTIFICATION'); y += 2
  const partA = [
    ['Entity Name', charityName], ['Business Number', bn||'N/A'],
    ['Risk Score', `${displayScore} / 30  (${riskLabel} — AI-generated)`],
    ['Amount at Risk', fmt$(circular)], ['Circular Cycles', `${totalLoops} detected`],
    ['Max Bottleneck', `${fmt$(maxBottle)} (single largest loop transfer)`],
    ['Program Spending', `${progPct.toFixed(1)}% of revenue`],
    ['Designation', charity?.designation||'N/A'], ['Category', charity?.category||'N/A'],
  ]
  partA.forEach(([k,v]) => {
    checkPage(16)
    doc.setFontSize(8.5).setFont('helvetica','bold').setTextColor(71,85,105).text(k+':', margin, y)
    const isScore = k === 'Risk Score'
    doc.setFont('helvetica', isScore?'bold':'normal').setTextColor(...(isScore?riskColor:[15,23,42]))
    const lines = doc.splitTextToSize(v, cw-115)
    lines.forEach((l,i) => doc.text(l, margin+115, y+i*13)); y += Math.max(14, lines.length*13)
  })

  // Part B
  sectionHeader('PART B — GROUNDS FOR SUSPICION'); y += 2
  text('The following findings were identified through automated analysis of CRA T3010 registered charity filings (2020–2024) and network graph analysis of inter-charity fund flows, classified by the GOA FIPA Transaction Network Analysis (TNA) engine.', { size:8.5 })
  y += 6
  doc.setFontSize(9).setFont('helvetica','bold')
  doc.setTextColor(...(redFlags.length>0?[220,38,38]:[22,163,74])).text(`${redFlags.length} RED FLAG${redFlags.length!==1?'S':''}`, margin, y)
  doc.setTextColor(...(yellowFlags.length>0?[217,119,6]:[22,163,74])).text(`  |  ${yellowFlags.length} YELLOW FLAG${yellowFlags.length!==1?'S':''}`, margin+70, y)
  doc.setTextColor(22,163,74).text('  |  0 NOISE', margin+160, y); y += 16

  // Part C
  sectionHeader(`PART C — PRIMARY FINDINGS (RED FLAG${redFlags.length!==1?'S':''})`); y += 2
  if (!redFlags.length) { text('No critical red-flag patterns identified at this threshold.', {size:8.5,color:[100,116,139],indent:12}) }
  else redFlags.forEach((f,i) => {
    checkPage(60); y += 6
    text(`${i+1}. ${f.title}`, {size:8.5,bold:true,color:[220,38,38],indent:12})
    text(`Source: ${f.source}`, {size:7.5,color:[100,116,139],indent:20})
    text(`Analyst Note: ${f.note}`, {size:8,color:[30,30,30],indent:20}); y += 8
  })

  // Part D
  sectionHeader(`PART D — SUPPORTING EVIDENCE (YELLOW FLAG${yellowFlags.length!==1?'S':''})`); y += 2
  if (!yellowFlags.length) { text('No additional yellow-flag patterns identified.', {size:8.5,color:[100,116,139],indent:12}) }
  else yellowFlags.forEach((f,i) => {
    checkPage(60); y += 4
    text(`${i+1}. ${f.title}`, {size:8.5,bold:true,color:[180,90,0],indent:12})
    text(`Source: ${f.source}`, {size:7.5,color:[100,116,139],indent:20})
    text(`Analyst Note: ${f.note}`, {size:8,color:[30,30,30],indent:20}); y += 8
  })

  // Part E
  sectionHeader('PART E — TRANSACTION DETAILS'); y += 2
  const partE = [
    ['Transaction Type','Charitable grant / inter-organizational transfer'],
    ['Detection Method','CRA registered charity database cross-reference + Network graph loop detection + TNA scoring engine'],
    ['Data Sources','CRA Registered Charities Database (8.8M T3010 records)\nGOA FIPA Transaction Network Analysis (TNA) Engine\nOpenSanctions Consolidated Watchlist (250+ lists)\nOffice of the Auditor General of Canada reports'],
  ]
  partE.forEach(([k,v]) => {
    checkPage(30)
    doc.setFontSize(8.5).setFont('helvetica','bold').setTextColor(71,85,105).text(k+':', margin, y)
    doc.setFont('helvetica','normal').setTextColor(15,23,42)
    const lines = doc.splitTextToSize(v, cw-115)
    lines.forEach((l,i) => doc.text(l, margin+115, y+i*13)); y += Math.max(14, lines.length*13)
  })
  if (topLoops.length > 0) {
    y += 4; text('Top Circular Loops Detected:', {size:8.5,bold:true,color:[71,85,105]})
    topLoops.forEach((l,i) => text(`${i+1}.  ${l.hops}-hop loop  |  Bottleneck: ${fmt$(l.bottleneck||0)}  |  Years: ${l.minYear||'?'}–${l.maxYear||'?'}`, {size:8,indent:12}))
  }

  // Part F
  sectionHeader('PART F — RECOMMENDED ACTIONS'); y += 2
  const actions = [
    'REFER to CRA Charities Directorate for audit of financial records',
    'CROSS-REFERENCE all directors against OpenSanctions PEP database',
    'REQUEST FINTRAC financial intelligence on identified accounts',
    'CONSIDER referral to RCMP Financial Crime Unit if evidence confirmed',
    'PLACE HOLD on any pending grant disbursements pending investigation',
  ]
  actions.forEach((a,i) => {
    checkPage(18)
    doc.setFontSize(8.5).setFont('helvetica','bold').setTextColor(30,58,138).text(`${i+1}.`, margin+8, y)
    doc.setFont('helvetica','normal').setTextColor(15,23,42)
    const lines = doc.splitTextToSize(a, cw-28)
    lines.forEach((l,li) => doc.text(l, margin+24, y+li*13)); y += Math.max(16, lines.length*13)
  })

  // Part G
  sectionHeader('PART G — ANALYST CERTIFICATION'); y += 2
  text('This report was AI-generated by the GOA Forensic Intelligence Platform for Accountability (FIPA) TNA module using CRA T3010 data. It constitutes a DRAFT only and must be reviewed and certified by a qualified compliance analyst before submission to FINTRAC under the Proceeds of Crime (Money Laundering) and Terrorist Financing Act.', {size:8.5})
  y += 14
  ;['Analyst Name','Analyst Title','Date Reviewed','Signature'].forEach(s => {
    checkPage(22)
    doc.setFontSize(8.5).setFont('helvetica','bold').setTextColor(71,85,105).text(s+':', margin, y)
    doc.setDrawColor(180,180,180).setLineWidth(0.5).line(margin+110, y+1, margin+320, y+1); y += 20
  })

  // Footer on every page
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFillColor(15,23,42).rect(0,770,PW,42,'F')
    doc.setFontSize(7).setFont('helvetica','normal').setTextColor(100,116,139)
    doc.text('CONFIDENTIAL — PROTECTED B — NOT FOR DISTRIBUTION', margin, 784)
    doc.text('Government of Alberta · Forensic Intelligence Platform for Accountability · GOA AI For Accountability Hackathon 2026', margin, 796)
    doc.setTextColor(71,85,105).text(`Page ${p} of ${totalPages}`, PW-margin-40, 784)
  }

  doc.save(`STR-DRAFT-${bn}-${dateStr}.pdf`)
}
