/**
 * Cycle 14 — form validation edge cases.
 * 긴 입력 / 특수문자 / XSS 시도 / 빈 submit / 경계값.
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-14'
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

  log('\n14.1 /signup — 잘못된 이메일 형식 + 약관 미동의')
  await page.goto(`${BASE}/signup`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('textbox', { name: '이메일' }).fill('not-an-email-at-all')
  await page.locator('input[type="password"]').first().fill('short')
  await page.locator('input[type="password"]').nth(1).fill('short')
  await page.getByRole('button', { name: /^(가입|회원가입|계정 만들기|시작)/ }).first().click().catch(() => { /* ignore */ })
  await page.waitForTimeout(1000)
  const body1 = (await page.locator('body').textContent()) ?? ''
  log(`  invalid email + weak pwd: 에러 키워드 ["이메일|email|형식"]: ${/이메일|email|형식/i.test(body1) ? 'Yes' : 'No'} / "약관|동의": ${/약관|동의/i.test(body1) ? 'Yes' : 'No'} / "비밀번호|password": ${/비밀번호|password/i.test(body1) ? 'Yes' : 'No'}`)
  await shot(page, 'c14-01-signup-invalid-email')

  log('\n14.2 /login — 빈 submit')
  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('networkidle')
  await page.locator('button[type="submit"]').filter({ hasText: /^로그인$/ }).first().click()
  await page.waitForTimeout(500)
  const body2 = (await page.locator('body').textContent()) ?? ''
  log(`  empty submit alert: ${/필수|입력|required|이메일/i.test(body2) ? 'Yes' : 'No'}`)
  await shot(page, 'c14-02-login-empty')

  log('\n14.3 /forgot-password — 잘못된 이메일')
  await page.goto(`${BASE}/forgot-password`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('textbox').first().fill('!@#$%^&*')
  await page.getByRole('button', { name: /발송|보내|재설정|전송/ }).first().click().catch(() => { /* ignore */ })
  await page.waitForTimeout(500)
  await shot(page, 'c14-03-forgot-invalid')

  log('\n14.4 /markets/connect/coupang — XSS 시도 (script tag)')
  await loginMock(page)
  await page.goto(`${BASE}/markets/connect/coupang`)
  await page.waitForLoadState('networkidle')
  const xssTag = '<script>alert("XSS")</script>'
  // 라벨 필드에 XSS 시도
  await page.locator('input').filter({ hasNot: page.locator('input[type="password"]') }).first().fill(xssTag).catch(() => { /* ignore */ })
  await shot(page, 'c14-04-coupang-xss-label')
  // alert 가 떴으면 dialog handler — capture
  let alertFired = false
  page.on('dialog', async (d) => { alertFired = true; await d.dismiss() })
  await page.waitForTimeout(1000)
  log(`  alert dialog fired: ${alertFired ? '⚠ Yes — sanitize 누락' : 'No (정상)'}`)

  log('\n14.5 /register/info — 매우 긴 상품명 (150 chars, 100자 제한 초과)')
  await page.goto(`${BASE}/register/info`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  const longName = '가'.repeat(150)
  await page.getByLabel(/상품명/).first().fill(longName).catch(() => { /* ignore */ })
  await page.waitForTimeout(500)
  const body5 = (await page.locator('body').textContent()) ?? ''
  log(`  100자 초과 에러 메시지: ${/100자|초과|이내/i.test(body5) ? 'Yes' : 'No'}`)
  await shot(page, 'c14-05-register-long-name')

  log('\n14.6 /register/info — 가격 0원 (validation 거부 예상)')
  await page.goto(`${BASE}/register/info`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  await page.getByLabel(/상품명/).first().fill('정상 상품명').catch(() => { /* ignore */ })
  await page.locator('input[type="number"]').first().fill('0')
  await page.waitForTimeout(500)
  const body6 = (await page.locator('body').textContent()) ?? ''
  log(`  가격 100원 이상 에러: ${/100원|최소|이상/i.test(body6) ? 'Yes' : 'No'}`)
  await shot(page, 'c14-06-register-price-zero')

  await context.close()
  log('\n══════════ ✅ cycle 14 완료 ══════════')
} catch (e) {
  log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  if (pageErrors.length > 0) {
    log(`\n──── pageerror / console.error ${pageErrors.length}건 ────`)
    for (const e of pageErrors.slice(0, 20)) log(`  ${e}`)
  }
  await browser.close()
}
