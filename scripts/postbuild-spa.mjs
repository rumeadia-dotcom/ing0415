/**
 * GitHub Pages SPA fallback 생성.
 * frontend.md §2.2 — dist/index.html → dist/404.html 복제.
 * 사용자가 /dashboard 새로고침 시 GitHub Pages 가 404.html 을 서빙하면
 * React Router 가 location.pathname 을 보고 알맞은 라우트 렌더.
 */
import { copyFile, access } from 'node:fs/promises'
import { resolve } from 'node:path'

const src = resolve(process.cwd(), 'dist/index.html')
const dest = resolve(process.cwd(), 'dist/404.html')

try {
  await access(src)
} catch {
  console.error(`✗ postbuild-spa: ${src} 가 존재하지 않습니다. vite build 가 먼저 실행되어야 합니다.`)
  process.exit(1)
}

await copyFile(src, dest)
console.log(`✓ SPA fallback: dist/404.html 생성 완료`)
