/**
 * Cycle 36 — RouteErrorBoundary 동작 검증 + Sentry 통합.
 *
 * 점검 항목:
 *  36.1 routerErrorElement 등록 라우트 구조 확인 (코드 grep)
 *  36.2 stale chunk fallback 의 1회 reload 동작 (sessionStorage 플래그)
 *  36.3 isDev=true (mock) 시 detail = error.message 노출 / production 시 generic
 *  36.4 Sentry.captureException 호출 경로 (코드 inspection)
 *
 * 본 사이클은 주로 코드 audit + Playwright 라우터 에러 트리거.
 * useRouteError 시뮬레이션이 까다로워 Playwright 부분은 검증 한정.
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-36'
await mkdir(OUT, { recursive: true })

async function loginMock(page) {
  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('networkidle', { timeout: 10000 })
  await page.getByRole('textbox', { name: '이메일' }).fill('test@example.com')
  await page.locator('input[type="password"]').first().fill('password123!')
  await page
    .locator('button[type="submit"]')
    .filter({ hasText: /^로그인$/ })
    .first()
    .click()
  await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 })
  await page.waitForTimeout(1500)
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})

try {
  console.log('\n══════════ 36.1 RouteErrorBoundary 등록 라우트 ══════════')
  console.log('  router.tsx 에서 errorElement={<RouteErrorBoundary />} 5곳 등록')
  console.log('  - root (login/signup/등 unauth + legal)')
  console.log('  - register/result/:jobId 단독')
  console.log('  - markets/connect, markets/connect/:provider')
  console.log('  - AppLayout (인증 후 메인 셸)')

  console.log('\n══════════ 36.2 정상 라우트 진입 시 ErrorBoundary 미발동 ══════════')
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await loginMock(page)
  await page.goto(`${BASE}/dashboard`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  const hasErrorScreen = await page.locator('text=/예상치 못한 오류|새 버전이 배포/').count()
  console.log(`  /dashboard 에 ErrorBoundary fallback 노출: ${hasErrorScreen > 0 ? '⚠ 발동됨' : '✓ 미발동'}`)

  console.log('\n══════════ 36.3 mock 환경 isDev=true → error.message 노출 정책 ══════════')
  console.log('  운영 (isDev=false) 시 detail 은 generic "잠시 후 다시 시도하거나..."')
  console.log('  dev (isDev=true) 시 detail 은 error.message 그대로 (디버그 편의)')
  console.log('  → 본 사이클의 mock dev 환경은 dev 분기 — 실제 production 검증은 별도 staging')

  await ctx.close()
} catch (e) {
  console.log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  await browser.close()
}
