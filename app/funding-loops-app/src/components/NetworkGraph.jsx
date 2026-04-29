import React, { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import * as d3 from "d3"
import { fetchNetwork, fetchLoops, searchCharities } from "../api/client.js"
import { fmt$, fmtN, getRiskLevel, getNodeColor } from "../utils/formatters.js"

function SearchPanel({ onSelectCharity }) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  useEffect(()=>{
    if(q.length<2){setResults([]);return}
    setBusy(true)
    const t=setTimeout(()=>{searchCharities(q).then(r=>{setResults(r||[]);setBusy(false)}).catch(()=>setBusy(false))},300)
    return()=>clearTimeout(t)
  },[q])
  return (
    <div style={{maxWidth:600,margin:"80px auto",textAlign:"center"}}>
      <div style={{fontSize:48,marginBottom:16,opacity:0.4}}>◎</div>
      <h2 style={{fontSize:22,fontWeight:800,color:"#e2eaf5",marginBottom:8}}>Network Explorer</h2>
      <p style={{fontSize:13,color:"#5d7fa0",marginBottom:28,lineHeight:1.7}}>
        Search for a charity to explore its circular funding network. See how money flows between organizations and identify suspicious loops.
      </p>
      <input autoFocus placeholder="Search charity by name..." value={q} onChange={e=>setQ(e.target.value)}
        style={{width:"100%",padding:"14px 18px",fontSize:15,background:"#0d1b2e",border:"1px solid #1e3a5f",borderRadius:10,color:"#cdd9e8",outline:"none",boxShadow:"0 0 20px rgba(59,130,246,0.1)"}} />
      {busy&&<div style={{marginTop:12,color:"#4d7aa0",fontSize:13}}>Searching...</div>}
      {results.length>0&&(
        <div style={{marginTop:8,background:"#0d1b2e",border:"1px solid #1a3050",borderRadius:10,overflow:"hidden",textAlign:"left"}}>
          {results.map(r=>{
            const risk=getRiskLevel(r.score)
            return (
              <div key={r.bn} onClick={()=>onSelectCharity(r.bn,r.name)}
                style={{padding:"12px 16px",cursor:"pointer",borderBottom:"1px solid #0d2035",transition:"background 0.12s"}}
                onMouseEnter={e=>e.currentTarget.style.background="#112238"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{fontWeight:600,fontSize:13,color:"#cdd9e8"}}>{r.name}</div>
                <div style={{display:"flex",gap:10,marginTop:4,alignItems:"center"}}>
                  <span style={{fontSize:10,padding:"1px 8px",borderRadius:10,background:risk.bg,color:risk.color,border:`1px solid ${risk.border}`,fontWeight:700}}>{risk.label}</span>
                  <span style={{fontSize:11,color:"#4d7aa0"}}>{r.totalLoops} loops · {fmt$(r.maxBottleneck)} max</span>
                  <span style={{fontSize:10,color:"#2d4d66",marginLeft:"auto"}}>{r.bn}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function NetworkGraph({ selectedBN, onSelectCharity }) {
  const svgRef=useRef(null)
  const tooltipRef=useRef(null)
  const simRef=useRef(null)

  const { data:network, isLoading:netLoading } = useQuery({
    queryKey:["network",selectedBN], queryFn:()=>fetchNetwork(selectedBN), enabled:!!selectedBN,
  })
  const { data:loops=[] } = useQuery({
    queryKey:["loops",selectedBN], queryFn:()=>fetchLoops(selectedBN), enabled:!!selectedBN,
  })

  useEffect(()=>{
    if(!network||!svgRef.current)return
    const container=svgRef.current.parentElement
    const W=container.clientWidth||800,H=560
    d3.select(svgRef.current).selectAll("*").remove()
    const svg=d3.select(svgRef.current).attr("width",W).attr("height",H)
    const defs=svg.append("defs")
    ;["loop","periph"].forEach(t=>{
      defs.append("marker").attr("id",`arr-${t}`).attr("viewBox","0 -5 10 10").attr("refX",22).attr("refY",0).attr("markerWidth",6).attr("markerHeight",6).attr("orient","auto")
        .append("path").attr("d","M0,-5L10,0L0,5").attr("fill",t==="loop"?"#f59e0b":"#1a3050")
    })
    const gf=defs.append("filter").attr("id","glow")
    gf.append("feGaussianBlur").attr("stdDeviation","4").attr("result","coloredBlur")
    const fm=gf.append("feMerge");fm.append("feMergeNode").attr("in","coloredBlur");fm.append("feMergeNode").attr("in","SourceGraphic")
    const g=svg.append("g")
    const zoom=d3.zoom().scaleExtent([0.1,4]).on("zoom",e=>g.attr("transform",e.transform))
    svg.call(zoom)
    const {nodes,edges}=network
    const maxAmt=d3.max(edges,e=>e.amount)||1
    const ew=d=>Math.max(0.8,Math.min(5,Math.log(d.amount/maxAmt*1e3+1)*0.9))
    const ns=d=>d.id===network.targetBN?18:d.inLoop?Math.max(8,Math.min(14,6+(d.score||0)*0.4)):5
    const link=g.append("g").selectAll("line").data(edges).join("line")
      .attr("stroke",d=>d.inLoopPath?"#f59e0b":"#1a3050")
      .attr("stroke-width",ew)
      .attr("stroke-opacity",d=>d.inLoopPath?0.75:0.2)
      .attr("marker-end",d=>d.inLoopPath?"url(#arr-loop)":"url(#arr-periph)")
    const node=g.append("g").selectAll("g").data(nodes).join("g")
      .call(d3.drag()
        .on("start",(e,d)=>{if(!e.active)sim.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y})
        .on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y})
        .on("end",(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null}))
    node.filter(d=>(d.score||0)>=10).append("circle").attr("r",d=>ns(d)+5)
      .attr("fill","none").attr("stroke",d=>getNodeColor(d.score,d.id===network.targetBN)).attr("stroke-width",1).attr("stroke-opacity",0.25)
    node.append("circle").attr("r",ns)
      .attr("fill",d=>getNodeColor(d.score,d.id===network.targetBN))
      .attr("stroke",d=>d.id===network.targetBN?"#60a5fa":"#0a1525")
      .attr("stroke-width",d=>d.id===network.targetBN?3:1)
      .attr("filter",d=>d.id===network.targetBN?"url(#glow)":null)
      .style("cursor","pointer")
      .on("click",(e,d)=>{e.stopPropagation();onSelectCharity(d.id,d.name)})
      .on("mouseover",(e,d)=>{
        const tt=tooltipRef.current; if(!tt)return
        const r=getRiskLevel(d.score||0)
        tt.style.display="block";tt.style.left=`${e.offsetX+15}px`;tt.style.top=`${e.offsetY-10}px`
        tt.innerHTML=`<div style="font-weight:700;font-size:13px;color:#cdd9e8;margin-bottom:4px">${d.name||d.id}</div><div style="font-size:10px;color:#4d7aa0;margin-bottom:6px">${d.id}</div><div style="display:flex;gap:8px;align-items:center"><span style="padding:1px 8px;border-radius:10px;font-size:10px;font-weight:700;background:${r.bg};color:${r.color};border:1px solid ${r.border}">${r.label}</span><span style="font-size:11px;color:#5d7fa0">${d.loops||0} loops</span></div>`
      })
      .on("mousemove",(e)=>{const tt=tooltipRef.current;if(tt){tt.style.left=`${e.offsetX+15}px`;tt.style.top=`${e.offsetY-10}px`}})
      .on("mouseout",()=>{if(tooltipRef.current)tooltipRef.current.style.display="none"})
    node.filter(d=>d.type!=="peripheral"||d.id===network.targetBN).append("text")
      .text(d=>(d.name||d.id).slice(0,24))
      .attr("font-size",d=>d.id===network.targetBN?11:9)
      .attr("font-weight",d=>d.id===network.targetBN?700:400)
      .attr("fill","#cdd9e8").attr("dy",d=>ns(d)+12).attr("text-anchor","middle").style("pointer-events","none")
    const sim=d3.forceSimulation(nodes)
      .force("link",d3.forceLink(edges).id(d=>d.id).distance(d=>d.inLoopPath?110:200))
      .force("charge",d3.forceManyBody().strength(-220))
      .force("center",d3.forceCenter(W/2,H/2))
      .force("collision",d3.forceCollide().radius(d=>ns(d)+10))
    simRef.current=sim
    sim.on("tick",()=>{
      link.attr("x1",d=>d.source.x).attr("y1",d=>d.source.y).attr("x2",d=>d.target.x).attr("y2",d=>d.target.y)
      node.attr("transform",d=>`translate(${d.x},${d.y})`)
    })
    return()=>sim.stop()
  },[network,selectedBN])

  if(!selectedBN)return <SearchPanel onSelectCharity={onSelectCharity} />

  return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:16,maxWidth:1200}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div style={{flex:1}}>
          <h2 style={{fontSize:18,fontWeight:700,color:"#e2eaf5"}}>{network?.targetName||selectedBN}</h2>
          <div style={{fontSize:12,color:"#4d7aa0"}}>
            {network?`${network.nodes.length} connected orgs · ${network.edges.length} gift flows · ${loops.length} loops`:"Loading network..."}
          </div>
        </div>
        <button onClick={()=>onSelectCharity(null,"")} style={{padding:"8px 16px",background:"transparent",border:"1px solid #1a3050",borderRadius:8,color:"#5d7fa0",cursor:"pointer",fontSize:12}}>← Change Charity</button>
      </div>
      <div style={{display:"flex",gap:16,fontSize:11,color:"#4d7aa0",flexWrap:"wrap"}}>
        {[["#3b82f6","Selected"],["#ef4444","Critical risk"],["#f59e0b","High / loop edges"],["#8b5cf6","Medium risk"],["#10b981","Low risk"]].map(([c,l])=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:10,height:10,borderRadius:"50%",background:c}}/><span>{l}</span></div>
        ))}
      </div>
      <div style={{background:"#070f1c",border:"1px solid #1a3050",borderRadius:12,position:"relative",height:560,overflow:"hidden"}}>
        {netLoading?(<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#4d7aa0"}}>Loading network graph...</div>):(
          <><svg ref={svgRef} style={{width:"100%",height:"100%"}}/><div ref={tooltipRef} className="graph-tooltip" style={{display:"none"}}/></>
        )}
      </div>
      {loops.length>0&&(
        <div style={{background:"#0d1b2e",border:"1px solid #1a3050",borderRadius:12,padding:16}}>
          <div style={{fontSize:14,fontWeight:700,color:"#cdd9e8",marginBottom:12}}>Detected Loops ({loops.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {loops.slice(0,12).map(loop=>(
              <div key={loop.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"#071220",borderRadius:8,border:"1px solid #0d2035"}}>
                <div style={{padding:"2px 8px",borderRadius:10,background:loop.hops===2?"rgba(239,68,68,0.15)":"rgba(245,158,11,0.15)",color:loop.hops===2?"#ef4444":"#f59e0b",fontSize:10,fontWeight:700,flexShrink:0,border:`1px solid ${loop.hops===2?"rgba(239,68,68,0.3)":"rgba(245,158,11,0.3)"}`}}>{loop.hops}-hop</div>
                <div style={{flex:1,fontSize:12,color:"#cdd9e8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(loop.pathNames||loop.pathBNs||[]).join(" → ")}</div>
                <div style={{fontSize:11,color:"#fbbf24",flexShrink:0}}>{fmt$(loop.bottleneck)}</div>
                <div style={{fontSize:10,color:"#3d607a",flexShrink:0}}>{loop.minYear}–{loop.maxYear}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
