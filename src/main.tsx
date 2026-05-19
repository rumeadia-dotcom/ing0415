import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { initSentry } from './lib/sentry'
import './styles/globals.css'

// security.md §6.3: createRoot 진입 전 1회 호출. DSN 없으면 no-op.
initSentry()

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found in index.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
