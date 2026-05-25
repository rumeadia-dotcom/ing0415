/**
 * Cycle 11 — orders flow (목록 / 상세 / 필터 / 일괄선택).
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-11'
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

  log('\n11.1 /orders/list — 페이지 로드 + 행 개수')
  await page.goto(`${BASE}/orders/list`)
  await page.waitForLoadState('networkidle')
  const rowCount = await page.locator('table tbody tr, [role="row"]:not([role="row"]:has(th))').count()
  log(`  table row 추정: ${rowCount}`)
  const orderLinks = await page.locator('a[href^="/orders/"]').count()
  log(`  /orders/* link: ${orderLinks}개`)
  await shot(page, 'c11-01-orders-list')

  log('\n11.2 첫 주문 클릭 → /orders/:orderId 상세 진입')
  const firstOrderLink = page.locator('a[href^="/orders/"]').first()
  if ((await firstOrderLink.count()) > 0) {
    const href = await firstOrderLink.getAttribute('href')
    log(`  click target: ${href}`)
    await firstOrderLink.click()
    await page.waitForLoadState('networkidle', { timeout: 10000 })
    await page.waitForTimeout(3000) // wait for query to settle
    log(`  진입 → ${new URL(page.url()).pathname}`)
    // 상세 내용 키워드 검출
    const detailBody = (await page.locator('body').textContent()) ?? ''
    const hasBuyer = detailBody.includes('수취인') || detailBody.includes('구매자') || detailBody.includes('***')
    const hasProduct = detailBody.includes('상품') && detailBody.length > 500
    log(`  buyer 표시: ${hasBuyer} / product 표시: ${hasProduct} / body len: ${detailBody.length}`)
    await shot(page, 'c11-02-order-detail')
  } else {
    log(`  ⚠ /orders/* link 없음 — 직접 mock orderId 진입`)
    await page.goto(`${BASE}/orders/00000000-0000-4000-8000-000000005001`)
    await page.waitForLoadState('networkidle')
    await shot(page, 'c11-02-order-detail-direct')
  }

  log('\n11.3 /orders/list 필터 조합 (마켓 = 쿠팡, 상태 = 로젠 등록)')
  await page.goto(`${BASE}/orders/list`)
  await page.waitForLoadState('networkidle')
  const coupangBtn = page.getByRole('button', { name: /^쿠팡$/ }).first()
  if ((await coupangBtn.count()) > 0) {
    await coupangBtn.click()
    await page.waitForTimeout(300)
  }
  const logenBtn = page.getByRole('button', { name: /^로젠 등록$/ }).first()
  if ((await logenBtn.count()) > 0) {
    await logenBtn.click()
    await page.waitForTimeout(300)
  }
  const rowsAfterFilter = await page.locator('table tbody tr').count()
  log(`  쿠팡+로젠등록 필터 후 table row: ${rowsAfterFilter}`)
  await shot(page, 'c11-03-orders-filter')

  log('\n11.4 검색 입력 — 텀블러')
  await page.goto(`${BASE}/orders/list`)
  await page.waitForLoadState('networkidle')
  const searchInput = page.getByRole('textbox').first()
  await searchInput.fill('텀블러')
  await page.waitForTimeout(500)
  const searchBtn = page.getByRole('button', { name: /^검색$/ }).first()
  if ((await searchBtn.count()) > 0) {
    await searchBtn.click()
    await page.waitForTimeout(500)
  }
  await shot(page, 'c11-04-orders-search-tumbler')

  log('\n11.5 필터 초기화 버튼')
  const resetBtn = page.getByRole('button', { name: /필터 초기화/ }).first()
  if ((await resetBtn.count()) > 0) {
    await resetBtn.click()
    await page.waitForTimeout(300)
    log(`  reset 버튼 동작`)
  }
  await shot(page, 'c11-05-orders-after-reset')

  await context.close()
  log('\n══════════ ✅ cycle 11 완료 ══════════')
} catch (e) {
  log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  if (pageErrors.length > 0) {
    log(`\n──── pageerror / console.error ${pageErrors.length}건 ────`)
    for (const e of pageErrors.slice(0, 20)) log(`  ${e}`)
  }
  await browser.close()
}
