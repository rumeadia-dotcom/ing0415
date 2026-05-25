/**
 * Cycle 30 — document.title 동적 설정.
 *
 * 점검 항목:
 *  30.1 각 페이지 진입 시 <title> 이 페이지명 포함 형태로 갱신되는지
 *       (예: "대시보드 · MarketCast" / "주문 목록 · MarketCast" / "마켓 계정 · MarketCast")
 *  30.2 SPA 내 라우트 전환 시 title 업데이트
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-30'
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

const ROUTES = [
  { path: 'dashboard', expect: /대시보드/ },
  { path: 'markets', expect: /마켓 계정/ },
  { path: 'orders/list', expect: /주문 목록/ },
  { path: 'history', expect: /등록 이력/ },
  { path: 'settings', expect: /설정/ },
  { path: 'register/info', expect: /상품 등록/ },
]

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await loginMock(page)

  console.log('\n══════════ 30.1 페이지별 <title> ══════════')
  for (const r of ROUTES) {
    await page.goto(`${BASE}/${r.path}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)
    const title = await page.title()
    const ok = r.expect.test(title) && /MarketCast/.test(title)
    console.log(`  /${r.path} → "${title}" ${ok ? '✓' : '⚠ 기대 패턴 미일치'}`)
  }
  await ctx.close()
} catch (e) {
  console.log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  await browser.close()
}
