import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { initSentry } from './lib/sentry'
import './styles/globals.css'

// security.md §6.3: createRoot 진입 전 1회 호출. DSN 없으면 no-op.
initSentry()

// 배포 후 스테일 청크 로딩 실패 시 강제 리로드.
// 브라우저가 새 배포 이전의 chunk hash 를 참조하는 경우 발생.
window.addEventListener('vite:preloadError', () => {
  window.location.reload()
})

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found in index.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
