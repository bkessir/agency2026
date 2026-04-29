import React, { useState, useMemo, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps"
import { scaleLinear } from "d3-scale"

const TOPO_URL = "/canada-provinces.json"

// Accurate province centroids [longitude, latitude]
const PROVINCE_COORDS = {
  AB:  [-115.0, 54.5],  BC:  [-124.5, 53.5],  MB:  [ -97.0, 55.0],
  NB:  [ -66.5, 46.5],  NL:  [ -61.0, 53.5],  NS:  [ -63.0, 44.9],
  NT:  [-112.0, 64.0],  NU:  [ -85.0, 66.5],  ON:  [ -84.5, 49.5],
  PE:  [ -63.1, 46.3],  QC:  [ -73.0, 52.0],  SK:  [-105.0, 54.5],
  YT:  [-135.0, 63.0],
}

const NAME_TO_CODE = {
  "Alberta": "AB", "British Columbia": "BC", "Manitoba": "MB",
  "New Brunswick": "NB", "Newfoundland and Labrador": "NL", "Newfoundland": "NL",
  "Nova Scotia": "NS", "Northwest Territories": "NT", "Nunavut": "NU",
  "Ontario": "ON", "Prince Edward Island": "PE", "Quebec": "QC",
  "Saskatchewan": "SK", "Yukon": "YT", "Yukon Territory": "YT",
}

function normalize(p) {
  if (!p) return null
  const t = p.trim()
  if (PROVINCE_COORDS[t.toUpperCase()]) return t.toUpperCase()
  return NAME_TO_CODE[t] || null
}

async function fetchMap() {
  const r = await fetch("/api/map")
  if (!r.ok) throw new Error("map fetch failed")
  return r.json()
}

const RISK_COLOR = (s) => s >= 20 ? "#dc2626" : s >= 10 ? "#f97316" : s >= 5 ? "#eab308" : "#22c55e"

export default function CharityMap() {
  const { data: rawData = [], isLoading } = useQuery({ queryKey: ["map"], queryFn: fetchMap })
  const [tooltip, setTooltip] = useState(null)
  const [zoom, setZoom] = useState(1)
  const mapRef = useRef(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  const byProv = useMemo(() => {
    const m = {}
    rawData.forEach(row => { const c = normalize(row.province); if (c) m[c] = row })
    return m
  }, [rawData])

  const maxCount = useMemo(() => Math.max(...Object.values(byProv).map(d => d.count), 1), [byProv])
  const dotScale  = scaleLinear().domain([0, maxCount]).range([8, 38])
  const fillScale = scaleLinear().domain([0, maxCount]).range(["#bfdbfe", "#1e3a8a"])

  const markers = useMemo(() =>
    Object.entries(PROVINCE_COORDS)
      .filter(([c]) => byProv[c])
      .map(([c, coords]) => ({ code: c, coords, data: byProv[c] }))
  , [byProv])

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#475569", marginBottom: 3 }}>Charity Risk — Geographic Distribution</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Provinces shaded by charity count · bubbles colored by avg risk score</div>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexShrink: 0 }}>
          {[["Low","#22c55e"],["Medium","#eab308"],["High","#f97316"],["Critical","#dc2626"]].map(([l,c]) => (
            <span key={l} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:"#64748b" }}>
              <span style={{ width:9,height:9,borderRadius:"50%",background:c,display:"inline-block" }}/>{l}
            </span>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={{ height: 430, display:"flex", alignItems:"center", justifyContent:"center", color:"#94a3b8", fontSize:14 }}>
          Loading map data…
        </div>
      ) : (
        <div ref={mapRef} style={{ position:"relative", background:"#e8f4fd", borderRadius:8, overflow:"hidden" }}
          onMouseMove={e => {
            const rect = mapRef.current?.getBoundingClientRect()
            if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
          }}
        >
          <ComposableMap
            projection="geoConicConformal"
            projectionConfig={{ rotate:[96,0,0], center:[0,52], parallels:[49,77], scale:1150 }}
            style={{ width:"100%", height:430 }}
          >
            <ZoomableGroup zoom={zoom} center={[-96,60]} onMoveEnd={({ zoom: z }) => setZoom(z)}>
              <Geographies geography={TOPO_URL}>
                {({ geographies }) => geographies.map(geo => {
                  const code = NAME_TO_CODE[geo.properties.name] || null
                  const d = code ? byProv[code] : null
                  return (
                    <Geography key={geo.rsmKey} geography={geo}
                      fill={d ? fillScale(d.count) : "#dde8f0"}
                      stroke="#ffffff" strokeWidth={0.7}
                      style={{
                        default:{ outline:"none" },
                        hover:{ fill: d ? "#3b82f6" : "#c8d8e4", outline:"none", cursor:"pointer" },
                        pressed:{ outline:"none" },
                      }}
                      onMouseEnter={e => { if (d && code) setTooltip({ code, data:d }) }}
                      onMouseMove={e  => {}}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  )
                })}
              </Geographies>

              {markers.map(({ code, coords, data }) => {
                const r = dotScale(data.count) / zoom
                const showLabel = r * zoom >= 12
                return (
                  <Marker key={code} coordinates={coords}>
                    <circle r={r} fill={RISK_COLOR(data.avgScore)} fillOpacity={0.85}
                      stroke="#fff" strokeWidth={1.5/zoom} style={{ cursor:"pointer" }}
                      onMouseEnter={e => setTooltip({ code, data })}
                      onMouseMove={e  => {}}
                      onMouseLeave={() => setTooltip(null)}
                    />
                    {showLabel && (
                      <text textAnchor="middle" dy={4/zoom}
                        style={{ fontSize: Math.max(8, 11/zoom), fill:"#fff", fontWeight:700, pointerEvents:"none" }}>
                        {code}
                      </text>
                    )}
                  </Marker>
                )
              })}
            </ZoomableGroup>
          </ComposableMap>

          {tooltip && (
            <div style={{ position:"absolute", left: Math.min(mousePos.x + 14, 620), top: Math.max(mousePos.y - 10, 4),
              background:"#1e293b", color:"#fff", borderRadius:8, padding:"10px 14px",
              fontSize:12, pointerEvents:"none", zIndex:9999,
              boxShadow:"0 4px 16px rgba(0,0,0,0.25)", minWidth:160 }}>
              <div style={{ fontWeight:700, marginBottom:4, fontSize:13 }}>{tooltip.code}</div>
              <div>Charities: <b>{tooltip.data.count.toLocaleString()}</b></div>
              <div>Critical: <b style={{ color:"#f87171" }}>{tooltip.data.critical}</b></div>
              <div>High Risk: <b style={{ color:"#fb923c" }}>{tooltip.data.high}</b></div>
              <div>Avg Score: <b>{tooltip.data.avgScore}</b></div>
            </div>
          )}

          <div style={{ position:"absolute", bottom:12, right:12, display:"flex", flexDirection:"column", gap:4 }}>
            {[["＋",1],["－",-1]].map(([label,dir]) => (
              <button key={label}
                onClick={() => setZoom(z => Math.max(1, Math.min(8, z+dir)))}
                style={{ width:28, height:28, borderRadius:6, border:"1px solid #e2e8f0",
                  background:"#fff", cursor:"pointer", fontSize:15, display:"flex",
                  alignItems:"center", justifyContent:"center", color:"#475569" }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!isLoading && (
        <div style={{ marginTop:14, display:"flex", flexWrap:"wrap", gap:7 }}>
          {Object.entries(byProv).sort((a,b)=>b[1].count-a[1].count).map(([code,data]) => (
            <div key={code} style={{ display:"flex", alignItems:"center", gap:5,
              background:"#f8fafc", borderRadius:6, padding:"4px 10px",
              fontSize:11, color:"#334155", border:"1px solid #e2e8f0" }}>
              <span style={{ width:7,height:7,borderRadius:"50%",background:RISK_COLOR(data.avgScore),flexShrink:0 }}/>
              <span style={{ fontWeight:600 }}>{code}</span>
              <span style={{ color:"#64748b" }}>{data.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
