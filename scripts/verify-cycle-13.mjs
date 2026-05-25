/**
 * Cycle 13 — 잘못된 라우트 / 404 / 잘못된 UUID / 비정상 진입.
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-13'
await mkdir(OUT, { recursive: true })

const findings = []
function log(line) {
  console.log(line)
  findings.push(line)
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
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

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})

const pageErrors = []
async function newCtx() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  page.on('pageerror', (err) =>
    pageErrors.push(`[${new URL(page.url()).pathname}] ${err.message.slice(0, 200)}`),
  )
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('CERT_AUTHORITY')) {
      pageErrors.push(
        `[${new URL(page.url()).pathname}] console.error: ${msg.text().slice(0, 200)}`,
      )
    }
  })
  return { context, page }
}

try {
  const { context, page } = await newCtx()
  await loginMock(page)

  log('\n13.1 /xxx-nonexistent-route — 존재하지 않는 라우트')
  await page.goto(`${BASE}/xxx-nonexistent-route`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  const body1 = (await page.locator('body').textContent()) ?? ''
  log(`  body length: ${body1.length} / "찾을 수 없|404|not found" keyword: ${/찾을 수 없|404|not found/i.test(body1) ? 'Yes' : 'No'}`)
  await shot(page, 'c13-01-not-found')

  log('\n13.2 /orders/INVALID-UUID — 잘못된 UUID 형식')
  await page.goto(`${BASE}/orders/invalid-uuid-12345`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  const body2 = (await page.locator('body').textContent()) ?? ''
  log(`  body length: ${body2.length}`)
  await shot(page, 'c13-02-orders-invalid-uuid')

  log('\n13.3 /history/00000000-0000-0000-0000-000000000000 — 존재하지 않는 jobId')
  await page.goto(`${BASE}/history/00000000-0000-0000-0000-000000000000`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  const body3 = (await page.locator('body').textContent()) ?? ''
  log(`  body length: ${body3.length}`)
  await shot(page, 'c13-03-history-nonexistent')

  log('\n13.4 /orders/00000000-0000-0000-0000-000000000000 — 존재하지 않는 orderId')
  await page.goto(`${BASE}/orders/00000000-0000-0000-0000-000000000000`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  const body4 = (await page.locator('body').textContent()) ?? ''
  log(`  body length: ${body4.length}`)
  await shot(page, 'c13-04-order-nonexistent')

  log('\n13.5 /markets/connect/wrong-market — 잘못된 provider')
  await page.goto(`${BASE}/markets/connect/wrong-market`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  const body5 = (await page.locator('body').textContent()) ?? ''
  log(`  body length: ${body5.length} / "알 수 없" keyword: ${body5.includes('알 수 없') ? 'Yes' : 'No'}`)
  await shot(page, 'c13-05-wrong-market')

  log('\n13.6 /register/result/invalid-uuid')
  await page.goto(`${BASE}/register/result/invalid-uuid-format`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  const body6 = (await page.locator('body').textContent()) ?? ''
  log(`  body length: ${body6.length}`)
  await shot(page, 'c13-06-result-invalid-uuid')

  log('\n13.7 /shipping/dispatch/nonexistent/result')
  await page.goto(`${BASE}/shipping/dispatch/00000000-0000-0000-0000-000000000000/result`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  const body7 = (await page.locator('body').textContent()) ?? ''
  log(`  body length: ${body7.length}`)
  await shot(page, 'c13-07-shipping-result-nonexistent')

  await context.close()
  log('\n══════════ ✅ cycle 13 완료 ══════════')
} catch (e) {
  log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  if (pageErrors.length > 0) {
    log(`\n──── pageerror / console.error ${pageErrors.length}건 ────`)
    for (const e of pageErrors.slice(0, 20)) log(`  ${e}`)
  }
  await browser.close()
}
