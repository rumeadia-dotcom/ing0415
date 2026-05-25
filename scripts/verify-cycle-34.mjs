/**
 * Cycle 34 — disabled 버튼 tooltip 일관성 + console 에러/경고 모니터링.
 *
 * 점검 항목:
 *  34.1 OrdersListPage 의 "필터 초기화" 버튼이 disabled 일 때 tooltip "현재 적용된 필터가 없습니다" 노출
 *  34.2 4개 라우트 진입 시 console.error / console.warn 발생 여부
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-34'
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

const ROUTES = ['dashboard', 'orders/list', 'history', 'markets', 'settings']

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()

  // 콘솔 메시지 수집
  const consoleLog = []
  page.on('console', (msg) => {
    const type = msg.type()
    if (type === 'error' || type === 'warning') {
      consoleLog.push({ type, text: msg.text(), location: page.url() })
    }
  })
  page.on('pageerror', (err) => {
    consoleLog.push({ type: 'pageerror', text: String(err), location: page.url() })
  })

  await loginMock(page)

  console.log('\n══════════ 34.1 OrdersListPage filterReset tooltip ══════════')
  await page.goto(`${BASE}/orders/list`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  // 필터가 default 상태에서 reset 버튼이 disabled + tooltip 노출 확인
  const resetWrapper = page.locator('button:has-text("필터 초기화")').first()
  const isDisabled = await resetWrapper.isDisabled().catch(() => false)
  console.log(`  필터 초기화 버튼 disabled: ${isDisabled ? '✓' : '⚠ 비활성 아님'}`)
  // title attribute (native HTML tooltip) — Playwright 로 직접 확인
  const titleAttr = await resetWrapper.getAttribute('title')
  console.log(`  title attribute: "${titleAttr ?? '∅'}"`)
  console.log(`  비활성 사유 hint 노출: ${titleAttr === '현재 적용된 필터가 없습니다' ? '✓' : '⚠ 누락'}`)

  console.log('\n══════════ 34.2 console error/warning 모니터링 ══════════')
  for (const r of ROUTES) {
    consoleLog.length = 0
    await page.goto(`${BASE}/${r}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    // 자체 운영 코드 외 RSS 경고 (React Router v7 future flag warning, jsdom 등) 는 제외 가능
    const ourErrors = consoleLog.filter((c) => {
      const t = c.text
      return !/React Router Future Flag|Lit is in dev mode|Download the React DevTools|Tanstack/i.test(t)
    })
    console.log(`  /${r} — 외부 lib 제외 console 메시지: ${ourErrors.length}건`)
    for (const c of ourErrors.slice(0, 5)) {
      console.log(`    [${c.type}] ${c.text.slice(0, 120)}`)
    }
  }
  await ctx.close()
} catch (e) {
  console.log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  await browser.close()
}
