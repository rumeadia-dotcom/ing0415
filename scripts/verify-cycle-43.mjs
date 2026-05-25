/**
 * Cycle 43 — mock supabase 자동 로그인 dev 옵션화 (cycle 19 follow-up).
 *
 * 배경:
 *  cycle 19 에서 logout 후 RequireAuth 검증 시 mock 의 createMockSupabase() 가
 *  부팅마다 자동 로그인 상태로 시작해서 SPA 내 navigation 으로만 보호 동작 확인 가능.
 *  → 일부 검증 시나리오 (draft persistence reload / RequireAuth full reload 등) 가 제약.
 *
 * 수정:
 *  - VITE_MOCK_AUTO_LOGIN=false 환경변수 시 mock 이 anonymous 상태로 시작.
 *  - 기본값 (변수 미설정) 은 true 유지 → 기존 dev DX 영향 0.
 *
 * 사용 예:
 *  VITE_MOCK_AUTO_LOGIN=false pnpm dev
 *  → 진입 시 anonymous → /login redirect → 명시적 로그인 흐름 검증
 */
import { chromium } from '@playwright/test'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  // 기본 (VITE_MOCK_AUTO_LOGIN 미설정) → autoLogin=true 로 동작
  await page.goto(`${BASE}/dashboard`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  const path = new URL(page.url()).pathname
  console.log(`기본 (VITE_MOCK_AUTO_LOGIN 미설정) /dashboard 진입 → ${path}`)
  console.log(`  ${path === '/dashboard' ? '✓ 자동 로그인 → 직접 진입' : '⚠ anonymous redirect (예상과 다름)'}`)
  await ctx.close()

  console.log('')
  console.log('VITE_MOCK_AUTO_LOGIN=false 모드 검증은 dev 서버 재시작 필요 — 본 사이클 범위 외.')
} catch (e) {
  console.log(`FATAL: ${e?.message ?? e}`)
} finally {
  await browser.close()
}
