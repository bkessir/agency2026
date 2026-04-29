import React, { useRef, useMemo, useEffect, useState } from 'react'
import ForceGraph3D from '3d-force-graph'
import SpriteText from 'three-spritetext'

// Warm, high-contrast palette — each hop gets a distinct hue
const HOP_COLORS = {
  2: '#e11d48', // rose-600  — direct reciprocal (most suspicious)
  3: '#d97706', // amber-600 — triangular
  4: '#7c3aed', // violet-600 — chain
  5: '#0284c7', // sky-600
  6: '#059669', // emerald-600
}

const HOP_LABELS = {
  2: '2-hop (reciprocal)',
  3: '3-hop (triangular)',
  4: '4-hop (chain)',
  5: '5-hop',
  6: '6-hop',
}

// Truncate long names for node sprites
function shortName(name, max = 18) {
  if (!name) return ''
  return name.length > max ? name.slice(0, max - 1) + '…' : name
}

export default function LoopCloud3D({ bn, charityName, loops = [], onSelectCharity }) {
  const mountRef = useRef()
  const graphRef = useRef(null)
  const containerRef = useRef()
  const [width, setWidth] = useState(700)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      setWidth(Math.max(entries[0].contentRect.width, 300))
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const graphData = useMemo(() => {
    if (!loops?.length) return { nodes: [], links: [] }
    const nodeMap = new Map()
    const linkSet = new Map()
    nodeMap.set(bn, { id: bn, name: charityName || bn, isSelf: true, minHops: 99 })
    loops.slice(0, 50).forEach(loop => {
      const pathBNs = loop.pathBNs || []
      const pathNames = loop.pathNames || []
      pathBNs.forEach((pBn, idx) => {
        if (!nodeMap.has(pBn)) {
          nodeMap.set(pBn, { id: pBn, name: pathNames[idx] || pBn, isSelf: pBn === bn, minHops: loop.hops })
        } else if (loop.hops < nodeMap.get(pBn).minHops) {
          nodeMap.get(pBn).minHops = loop.hops
        }
      })
      const ring = [...pathBNs, pathBNs[0]]
      for (let i = 0; i < ring.length - 1; i++) {
        const key = `${ring[i]}|${ring[i + 1]}`
        if (!linkSet.has(key)) linkSet.set(key, { source: ring[i], target: ring[i + 1], hopCount: loop.hops })
      }
    })
    return {
      nodes: [...nodeMap.values()],
      links: [...linkSet.values()],
    }
  }, [loops, bn, charityName])

  // Shorter height — compact look
  const height = Math.min(Math.max(width * 0.42, 280), 400)

  useEffect(() => {
    if (!mountRef.current) return

    const graph = ForceGraph3D({ antialias: true, alpha: true })(mountRef.current)
      .width(width)
      .height(height)
      .backgroundColor('#f8fafc')
      .graphData({
        nodes: graphData.nodes.map(n => ({ ...n })),
        links: graphData.links.map(l => ({ ...l })),
      })
      // Sphere node + floating text sprite
      .nodeThreeObjectExtend(true)
      .nodeThreeObject(n => {
        const sprite = new SpriteText(shortName(n.name))
        sprite.color = n.isSelf ? '#92400e' : '#1e293b'
        sprite.textHeight = n.isSelf ? 4.5 : 3.5
        sprite.fontFace = 'Inter, system-ui, sans-serif'
        sprite.fontWeight = n.isSelf ? 'bold' : 'normal'
        sprite.backgroundColor = n.isSelf ? 'rgba(253,230,138,0.85)' : 'rgba(255,255,255,0.82)'
        sprite.borderRadius = 3
        sprite.padding = 2
        sprite.position.y = n.isSelf ? 10 : 7
        return sprite
      })
      .nodeColor(n => n.isSelf ? '#f59e0b' : (HOP_COLORS[n.minHops] || '#64748b'))
      .nodeVal(n => n.isSelf ? 4 : 1.5)
      .nodeLabel(n => `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px;font-size:12px;color:#0f172a;box-shadow:0 4px 12px rgba(0,0,0,0.12)"><strong>${n.name || n.id}</strong><br/><span style="color:#64748b;font-size:10px">${n.id}</span>${!n.isSelf ? '<br/><span style="color:#2563eb;font-size:10px;margin-top:2px;display:block">↗ Click to open</span>' : ''}</div>`)
      .linkColor(l => HOP_COLORS[l.hopCount] || '#94a3b8')
      .linkWidth(l => l.hopCount === 2 ? 2.5 : 1.2)
      .linkOpacity(0.65)
      .linkDirectionalArrowLength(5)
      .linkDirectionalArrowRelPos(1)
      .linkDirectionalParticles(l => l.hopCount === 2 ? 4 : 1)
      .linkDirectionalParticleSpeed(0.006)
      .linkDirectionalParticleWidth(l => l.hopCount === 2 ? 2 : 1)
      .linkDirectionalParticleColor(l => HOP_COLORS[l.hopCount] || '#94a3b8')
      .onNodeClick(n => { if (!n.isSelf && onSelectCharity) onSelectCharity(n.id) })
      .showNavInfo(false)
      .d3AlphaDecay(0.03)
      .d3VelocityDecay(0.25)

    // Zoom in after graph settles
    setTimeout(() => {
      const cam = graph.camera()
      if (cam) {
        const dist = Math.max(60, 250 - graphData.nodes.length * 3)
        graph.cameraPosition({ x: 0, y: 0, z: dist }, { x: 0, y: 0, z: 0 }, 1200)
      }
    }, 800)

    graphRef.current = graph
    return () => {
      graph._destructor?.()
      if (mountRef.current) mountRef.current.innerHTML = ''
    }
  }, [graphData, width, height, onSelectCharity])

  const hopCounts = [...new Set((loops || []).map(l => l.hops))].sort()
  if (!loops?.length) return null

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748b' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', flexShrink: 0, border: '2px solid #92400e' }} />
          <span style={{ fontWeight: 600 }}>{charityName?.length > 24 ? charityName.slice(0, 23) + '…' : charityName}</span>
        </div>
        {hopCounts.map(h => (
          <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748b' }}>
            <div style={{ width: 18, height: 3, background: HOP_COLORS[h] || '#94a3b8', borderRadius: 2, flexShrink: 0 }} />
            {HOP_LABELS[h] || `${h}-hop`}
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 10, color: '#94a3b8' }}>
          {graphData.nodes.length} charities · {graphData.links.length} flows
        </div>
      </div>

      {/* Graph canvas */}
      <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <div ref={mountRef} />
      </div>

      {/* Controls hint */}
      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 5, textAlign: 'center' }}>
        Scroll to zoom · Left-drag to rotate · Right-drag to pan · Click node to open
      </div>
    </div>
  )
}

