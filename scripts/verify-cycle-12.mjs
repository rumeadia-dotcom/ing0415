/**
 * Cycle 12 — shipping flow (운송장 출력 / 송장 일괄 제출 / 배송 이력 / 자격증명 설정).
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-12'
await mkdir(OUT, { recursive: true })

const findings = []
function log(line) {
  console.log(line)
  findings.push(line)
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
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
  await page.waitForTimeout(2000)
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

  log('\n12.1 /shipping/print — 운송장 출력 페이지')
  await page.goto(`${BASE}/shipping/print`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  const printBody = (await page.locator('body').textContent()) ?? ''
  log(`  body length: ${printBody.length}`)
  log(`  주문 keyword: ${printBody.includes('주문') ? 'Yes' : 'No'} / 출력 버튼: ${(await page.getByRole('button', { name: /출력/ }).count())}개`)
  await shot(page, 'c12-01-shipping-print')

  log('\n12.2 /shipping/dispatch — 송장 일괄 제출')
  await page.goto(`${BASE}/shipping/dispatch`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  const submitBtn = page.getByRole('button', { name: /제출 시작|일괄 제출|제출하기/ }).first()
  log(`  제출 버튼: ${(await submitBtn.count())}개`)
  await shot(page, 'c12-02-shipping-dispatch')

  log('\n12.3 /shipping/history — 배송 이력 + 첫 잡 클릭')
  await page.goto(`${BASE}/shipping/history`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  await shot(page, 'c12-03-shipping-history')
  const histLinks = await page.locator('a[href*="/shipping/dispatch/"]').count()
  log(`  shipping dispatch link: ${histLinks}개`)
  if (histLinks > 0) {
    await page.locator('a[href*="/shipping/dispatch/"]').first().click()
    await page.waitForLoadState('networkidle', { timeout: 10000 })
    await page.waitForTimeout(2000)
    log(`  진입 → ${new URL(page.url()).pathname}`)
    await shot(page, 'c12-04-shipping-dispatch-result')
  }

  log('\n12.4 /settings/shipping/logen — 로젠 자격증명 설정')
  await page.goto(`${BASE}/settings/shipping/logen`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  const logenBody = (await page.locator('body').textContent()) ?? ''
  log(`  body length: ${logenBody.length} / 키워드 [로젠/userId/custCd]: ${logenBody.includes('로젠') ? 'Y' : 'N'}/${logenBody.includes('userId') || logenBody.includes('User ID') ? 'Y' : 'N'}/${logenBody.includes('custCd') || logenBody.includes('Cust') ? 'Y' : 'N'}`)
  await shot(page, 'c12-05-settings-logen')

  log('\n12.5 /settings/shipping/sender — 발송지 설정')
  await page.goto(`${BASE}/settings/shipping/sender`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  const senderBody = (await page.locator('body').textContent()) ?? ''
  log(`  body length: ${senderBody.length} / 키워드 [발송지/주소/연락처]: ${senderBody.includes('발송') ? 'Y' : 'N'}/${senderBody.includes('주소') ? 'Y' : 'N'}/${senderBody.includes('연락처') || senderBody.includes('전화') ? 'Y' : 'N'}`)
  await shot(page, 'c12-06-settings-sender')

  log('\n12.6 /settings/policies — 배송 정책 관리')
  await page.goto(`${BASE}/settings/policies`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  const policiesBody = (await page.locator('body').textContent()) ?? ''
  log(`  body length: ${policiesBody.length} / 정책 row 추정: ${(await page.locator('tr, [role="row"], li').count())}`)
  await shot(page, 'c12-07-settings-policies')

  await context.close()
  log('\n══════════ ✅ cycle 12 완료 ══════════')
} catch (e) {
  log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  if (pageErrors.length > 0) {
    log(`\n──── pageerror / console.error ${pageErrors.length}건 ────`)
    for (const e of pageErrors.slice(0, 20)) log(`  ${e}`)
  }
  await browser.close()
}
