export const fmt$ = (n) => {
  if (n == null || isNaN(n)) return '$0'
  const abs = Math.abs(n)
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}

export const fmtN = (n) => (n ?? 0).toLocaleString()
export const fmtPct = (n) => `${(n || 0).toFixed(1)}%`

export const getRiskLevel = (score) => {
  if (score >= 20) return { label: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)' }
  if (score >= 10) return { label: 'High',     color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' }
  if (score >= 5)  return { label: 'Medium',   color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.3)' }
  return                  { label: 'Low',      color: '#10b981', bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.3)' }
}

export const getRiskBarColor = (score) => {
  if (score >= 20) return '#ef4444'
  if (score >= 10) return '#f59e0b'
  if (score >= 5)  return '#8b5cf6'
  return '#10b981'
}

export const getNodeColor = (score, isTarget) => {
  if (isTarget) return '#3b82f6'
  if (score >= 20) return '#ef4444'
  if (score >= 10) return '#f59e0b'
  if (score >= 5)  return '#8b5cf6'
  return '#10b981'
}
