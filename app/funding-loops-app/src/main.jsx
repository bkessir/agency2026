import React, { Component } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'

class RootErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, fontFamily: 'monospace', background: '#fff1f2', minHeight: '100vh' }}>
        <h2 style={{ color: '#be123c' }}>App crashed — error details:</h2>
        <pre style={{ color: '#9f1239', whiteSpace: 'pre-wrap', fontSize: 13 }}>{this.state.error.message}</pre>
        <pre style={{ color: '#64748b', fontSize: 11, marginTop: 12 }}>{this.state.error.stack}</pre>
      </div>
    )
    return this.props.children
  }
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 60000 } },
})

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </QueryClientProvider>
  </BrowserRouter>
)

