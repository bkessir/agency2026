import React, { useState, useMemo, useRef } from "react"
import { createPortal } from "react-dom"
import { useQuery } from "@tanstack/react-query"
import { fetchUniverse } from "../api/client.js"
import { fmt$, fmtN, fmtPct, getRiskLevel } from "../utils/formatters.js"
import { categoryLabel } from "../utils/categoryLookup.js"
import { downloadSTRPDF } from "../utils/generateSTRPDF.js"

const PAGE_SIZE = 50
const COLS = [
  { key:"rank",   label:"#",             sortKey:"appScore",      width:42,  info:"Rank by TNA Risk Score (highest = most suspicious)" },
  { key:"name",   label:"Organization",  sortKey:"name",          width:"auto", info:"Charity name and CRA Business Number (BN)" },
  { key:"score",  label:"TNA Risk Score",sortKey:"appScore",      width:150, info:"Transaction Network Analysis score (0–30). Measures circular funding risk based on loop structure, bottleneck amounts, and financial health signals." },
  { key:"loops",  label:"Loops",         sortKey:"totalLoops",    width:80,  info:"Total number of circular funding loops detected involving this charity" },
  { key:"bottle", label:"Max Bottleneck",sortKey:"maxBottleneck", width:120, align:"right", info:"Largest single transfer amount flowing through any one loop — a high value indicates concentrated fund flow" },
  { key:"circ",   label:"Circular $",    sortKey:"totalCircular", width:110, align:"right", info:"Total dollar value circulating through all detected loops for this charity" },
  { key:"prog",   label:"Program %",     sortKey:"programPct",    width:90,  align:"right", info:"Percentage of expenditures directed to charitable programs. Below 50% may signal misallocation." },
  { key:"pdf",    label:"Report",        sortKey:null,            width:60,  align:"center" },
]

function ColInfoIcon({ text }) {
  const [pos, setPos] = useState(null)
  const ref = useRef(null)

  const handleEnter = () => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect()
      const x = Math.min(r.left + r.width / 2, window.innerWidth - 120)
      setPos({ x: Math.max(x, 120), y: r.bottom + 6 })
    }
  }

  return (
    <span ref={ref} style={{ position:"relative", display:"inline-flex", alignItems:"center", marginLeft:4, verticalAlign:"middle" }}
      onMouseEnter={handleEnter} onMouseLeave={()=>setPos(null)}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{cursor:"help",flexShrink:0}}>
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
      {pos && createPortal(
        <div style={{
          position:"fixed", top:pos.y, left:pos.x, transform:"translateX(-50%)",
          background:"#1e293b", color:"#f8fafc", fontSize:11, lineHeight:1.5,
          padding:"7px 10px", borderRadius:7, width:220, zIndex:99999,
          boxShadow:"0 4px 12px rgba(0,0,0,0.25)", pointerEvents:"none", fontWeight:400,
          textTransform:"none", letterSpacing:0
        }}>
          <div style={{position:"absolute",bottom:"100%",left:"50%",transform:"translateX(-50%)",borderLeft:"5px solid transparent",borderRight:"5px solid transparent",borderBottom:"5px solid #1e293b"}} />
          {text}
        </div>,
        document.body
      )}
    </span>
  )
}

function Skeleton() { return <div style={{height:44,borderRadius:8,background:"#e2e8f0",marginBottom:6}} /> }

export default function Leaderboard({ onSelectCharity, selectedBN, initialFilter = "all", limit = null }) {
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState("appScore")
  const [sortDir, setSortDir] = useState("desc")
  const [page, setPage] = useState(0)
  const [riskFilter, setRiskFilter] = useState(initialFilter)

  const { data: universe = [], isLoading } = useQuery({ queryKey:["universe"], queryFn:fetchUniverse })

  const summary = useMemo(()=>({
    critical: universe.filter(c=>(c.appScore??c.score)>=20).length,
    high: universe.filter(c=>(c.appScore??c.score)>=10&&(c.appScore??c.score)<20).length,
    medium: universe.filter(c=>(c.appScore??c.score)>=5&&(c.appScore??c.score)<10).length,
    low: universe.filter(c=>(c.appScore??c.score)<5).length,
  }),[universe])

  const filtered = useMemo(()=>{
    let arr=universe
    if(search.trim()){const q=search.toLowerCase();arr=arr.filter(c=>(c.name||"").toLowerCase().includes(q)||(c.bn||"").includes(q))}
    if(riskFilter!=="all")arr=arr.filter(c=>getRiskLevel(c.appScore??c.score).label.toLowerCase()===riskFilter)
    return arr
  },[universe,search,riskFilter])

  const sorted = useMemo(()=>{
    const dir=sortDir==="asc"?1:-1
    return [...filtered].sort((a,b)=>{
      // For score-based sort keys, always use appScore (TNA) with fallback to DB score
      const resolveVal = (row, key) => key === "appScore" ? (row.appScore ?? row.score ?? 0) : (row[key] ?? "")
      const av=resolveVal(a,sortKey), bv=resolveVal(b,sortKey)
      return typeof av==="number"?(av-bv)*dir:String(av).localeCompare(String(bv))*dir
    })
  },[filtered,sortKey,sortDir])

  const paginated = limit ? sorted.slice(0, limit) : sorted.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE)
  const totalPages = limit ? 1 : Math.ceil(sorted.length/PAGE_SIZE)
  const handleSort=(key)=>{if(sortKey===key)setSortDir(d=>d==="asc"?"desc":"asc");else{setSortKey(key);setSortDir("desc")};setPage(0)}

  const cs={ cell:{padding:"12px 12px",fontSize:12,color:"#1e293b",verticalAlign:"middle"} }

  return (
    <div className="fade-in" style={{maxWidth:1300}}>
      {/* Page title */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1e293b" }}>
          {limit ? "Top 10 Highest Risk Charities" : "Risk Leaderboard"}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
          {limit
            ? "The 10 charities with the highest circular funding risk scores based on CRA T3010 data"
            : `${fmtN(universe.length)} charities in circular funding loops · sorted by risk score`}
        </div>
      </div>
      {!limit && (
        <div style={{display:"flex",gap:12,marginBottom:16,alignItems:"center"}}>
          <input placeholder="🔍  Search by name or BN..." value={search}
            onChange={e=>{setSearch(e.target.value);setPage(0)}}
            style={{flex:1,padding:"10px 14px",background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:8,color:"#1e293b",fontSize:13,outline:"none",boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}} />
          <div style={{fontSize:12,color:"#64748b"}}>{fmtN(sorted.length)} results</div>
          {(search||riskFilter!=="all")&&<button onClick={()=>{setSearch("");setRiskFilter("all");setPage(0)}} style={{padding:"8px 14px",background:"transparent",border:"1px solid #e2e8f0",borderRadius:8,color:"#64748b",cursor:"pointer",fontSize:12}}>Clear</button>}
        </div>
      )}
      <div style={{background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{borderBottom:"1px solid #e2e8f0",background:"#f8fafc"}}>
                {COLS.map(col=>(
                  <th key={col.key} onClick={()=>col.sortKey && handleSort(col.sortKey)} style={{padding:"10px 12px",fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"1px",cursor:col.sortKey?"pointer":"default",userSelect:"none",whiteSpace:"nowrap",width:col.width,textAlign:col.align||"left"}}>
                    <span style={{display:"inline-flex",alignItems:"center"}}>
                      {col.label}{col.sortKey && sortKey===col.sortKey?(sortDir==="desc"?" ↓":" ↑"):""}
                      {col.info && <ColInfoIcon text={col.info} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (<tr><td colSpan={8} style={{padding:20}}>{[1,2,3,4,5].map(i=><Skeleton key={i}/>)}</td></tr>)
              : paginated.map((c,i)=>{
                const displayScore = c.appScore ?? c.score
                const r=getRiskLevel(displayScore)
                return (
                  <tr key={c.bn} onClick={()=>onSelectCharity(c.bn,c.name)}
                    className={`table-row${c.bn===selectedBN?" selected":""}`}
                    style={{borderBottom:"1px solid #f1f5f9",transition:"background 0.12s"}}>
                    <td style={{...cs.cell,color:"#94a3b8",fontWeight:700,textAlign:"center"}}>{page*PAGE_SIZE+i+1}</td>
                    <td style={cs.cell}>
                      <div style={{fontWeight:600,fontSize:13,color:"#0f172a"}}>{c.name||c.bn}</div>
                      <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{c.bn}</div>
                    </td>
                    <td style={cs.cell}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{padding:"2px 8px",borderRadius:12,fontSize:10,fontWeight:700,background:r.bg,color:r.color,border:`1px solid ${r.border}`,minWidth:56,textAlign:"center",flexShrink:0}}>{r.label}</div>
                        <div style={{flex:1,minWidth:40}}>
                          <div style={{height:3,background:"#e2e8f0",borderRadius:2}}>
                            <div style={{height:3,width:`${(displayScore/30)*100}%`,background:r.color,borderRadius:2}} />
                          </div>
                          <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>
                            TNA: <strong style={{color:r.color}}>{displayScore}/30</strong>
                            {c.appScore != null && c.score !== c.appScore && <span style={{marginLeft:5,color:"#cbd5e1"}}>DB:{c.score}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{...cs.cell,textAlign:"center"}}>
                      <div style={{fontWeight:600}}>{fmtN(c.totalLoops)}</div>
                      <div style={{fontSize:10,color:"#94a3b8"}}>{c.loops?.h2>0?`2-hop:${c.loops.h2}`:""}</div>
                    </td>
                    <td style={{...cs.cell,fontWeight:600,textAlign:"right"}}>{fmt$(c.maxBottleneck)}</td>
                    <td style={{...cs.cell,fontWeight:600,textAlign:"right"}}>{fmt$(c.totalCircular)}</td>
                    <td style={{...cs.cell,textAlign:"right"}}><span style={{fontWeight:600}}>{fmtPct(c.programPct)}</span></td>
                    <td style={{...cs.cell,textAlign:"center"}} onClick={e=>e.stopPropagation()}>
                      <button title="Download STR Report (PDF)" onClick={()=>downloadSTRPDF(c,[],c.appScore??c.score,c.bn)}
                        style={{background:"none",border:"none",cursor:"pointer",padding:4,lineHeight:0,borderRadius:4,display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <svg width="24" height="28" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M0 3C0 1.34 1.34 0 3 0H15L24 9V25C24 26.66 22.66 28 21 28H3C1.34 28 0 26.66 0 25V3Z" fill="#E02020"/>
                            <path d="M15 0L24 9H17C15.9 9 15 8.1 15 7V0Z" fill="#FF6B6B"/>
                            <text x="3.5" y="22" fontSize="7.5" fontWeight="bold" fill="white" fontFamily="Arial,sans-serif" letterSpacing="0.3">PDF</text>
                            <line x1="4" y1="14" x2="20" y2="14" stroke="white" strokeOpacity="0.5" strokeWidth="1"/>
                            <line x1="4" y1="11" x2="13" y2="11" stroke="white" strokeOpacity="0.5" strokeWidth="1"/>
                          </svg>
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {totalPages>1&&(
          <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:8,padding:"12px 16px",borderTop:"1px solid #e2e8f0"}}>
            <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{padding:"6px 14px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,color:page===0?"#cbd5e1":"#64748b",cursor:page===0?"not-allowed":"pointer",fontSize:12}}>‹ Prev</button>
            <span style={{fontSize:12,color:"#64748b"}}>Page {page+1} of {totalPages}</span>
            <button onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} disabled={page===totalPages-1} style={{padding:"6px 14px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,color:page===totalPages-1?"#cbd5e1":"#64748b",cursor:page===totalPages-1?"not-allowed":"pointer",fontSize:12}}>Next ›</button>
          </div>
        )}
      </div>
    </div>
  )
}
