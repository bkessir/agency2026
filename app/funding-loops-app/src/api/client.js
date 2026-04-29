import axios from 'axios'

const api = axios.create({ baseURL: '/api', timeout: 30000 })

export const fetchStats = () => api.get('/stats').then(r => r.data)
export const fetchUniverse = () => api.get('/universe').then(r => r.data)
export const fetchNetwork = (bn) => api.get(`/network/${encodeURIComponent(bn)}`).then(r => r.data)
export const fetchLoops = (bn) => api.get(`/loops/${encodeURIComponent(bn)}`).then(r => r.data)
export const fetchFinancials = (bn) => api.get(`/financials/${encodeURIComponent(bn)}`).then(r => r.data)
export const fetchCharity = (bn) => api.get(`/charity/${encodeURIComponent(bn)}`).then(r => r.data)
export const fetchLoopFlow = (id) => api.get(`/loopflow/${id}`).then(r => r.data)
export const searchCharities = (q) => api.get(`/search?q=${encodeURIComponent(q)}`).then(r => r.data)
export const fetchTopHubs = () => api.get('/tophubs').then(r => r.data)
