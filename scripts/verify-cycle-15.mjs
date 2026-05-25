/**
 * Cycle 15 — axe-core WCAG 2.1 AA 자동 a11y 점검.
 *
 * 기존 tests/e2e/a11y.spec.ts 는 fixme 가 많음 (시드 셀러 차단).
 * 본 cycle 은 mock 모드로 모든 라우트 실제 진입 + axe-core 자동 스캔.
 */
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-15'
await mkdir(OUT, { recursive: true })

const findings = []
function log(line) {
  console.log(line)
  findings.push(line)
}

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

async function runAxe(page, label) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const violations = results.violations
  const total = violations.length
  log(`  axe ${label}: ${total === 0 ? '✅ 0 위반' : `❌ ${total} 위반`}`)
  for (const v of violations.slice(0, 5)) {
    log(`    - ${v.id} [${v.impact}]: ${v.help} (${v.nodes.length} nodes)`)
  }
  return total
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})

let totalViolations = 0
try {
  // 비인증 경로
  log('\n══════════ 비인증 경로 ══════════')
  for (const route of ['login', 'signup', 'forgot-password', 'legal/terms', 'legal/privacy', 'manual']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/${route}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    totalViolations += await runAxe(page, `/${route}`)
    await ctx.close()
  }

  // 인증 경로
  log('\n══════════ 인증 경로 (mock 로그인 후) ══════════')
  for (const route of ['dashboard', 'markets', 'markets/connect', 'markets/connect/11st', 'markets/connect/coupang', 'register/info', 'history', 'orders/list', 'shipping/print', 'shipping/dispatch', 'settings', 'settings/policies']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await ctx.newPage()
    await loginMock(page)
    await page.goto(`${BASE}/${route}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    totalViolations += await runAxe(page, `/${route}`)
    await ctx.close()
  }

  log(`\n══════════ 합계 ${totalViolations} 위반 ══════════`)
} catch (e) {
  log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  await browser.close()
}
