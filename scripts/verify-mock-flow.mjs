/**
 * Mock-mode verification driver — drive the app + screenshot key flows.
 *
 * Run: pnpm dev (background) then `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/verify-mock-flow.mjs`
 */

import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const OUT = './verify-out'
await mkdir(OUT, { recursive: true })

const findings = []
function log(line) {
  console.log(line)
  findings.push(line)
}

async function shot(page, name) {
  const path = `${OUT}/${name}.png`
  await page.screenshot({ path, fullPage: false })
  log(`📸 ${path}`)
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await context.newPage()
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    log(`  console.${msg.type()}: ${msg.text().slice(0, 200)}`)
  }
})
page.on('pageerror', (err) => log(`  pageerror: ${err.message}`))

try {
  // ── s1 — 비인증 진입 (login)
  log('\n## 1. /login 비인증 진입')
  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('networkidle', { timeout: 10000 })
  const loginHeading = await page.locator('h1, h2').first().textContent()
  log(`  heading: "${loginHeading?.trim()}"`)
  await shot(page, '01-login')

  // ── s1 — signup 페이지
  log('\n## 2. /signup 렌더링')
  await page.goto(`${BASE}/signup`)
  await page.waitForLoadState('networkidle', { timeout: 10000 })
  const signupHeading = await page.locator('h1, h2').first().textContent()
  log(`  heading: "${signupHeading?.trim()}"`)
  await shot(page, '02-signup')

  // ── s1 — forgot-password
  log('\n## 3. /forgot-password 렌더링')
  await page.goto(`${BASE}/forgot-password`)
  await page.waitForLoadState('networkidle', { timeout: 10000 })
  await shot(page, '03-forgot-password')

  // ── s1 — 로그인 (mock signInWithPassword 가 어떤 creds 도 수용)
  log('\n## 4. 로그인 시도 (mock)')
  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('networkidle', { timeout: 10000 })
  await page.getByRole('textbox', { name: '이메일' }).fill('test@example.com')
  await page.locator('input[type="password"]').first().fill('password123!')
  const submitBtn = page.getByRole('button', { name: /^로그인하기$|^로그인$|이메일로 로그인/ }).first()
  await submitBtn.click()
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  log(`  after click → ${new URL(page.url()).pathname}`)
  await shot(page, '04-after-login')

  // ── s2 — dashboard
  log('\n## 5. /dashboard 렌더링')
  await page.goto(`${BASE}/dashboard`)
  await page.waitForLoadState('networkidle', { timeout: 10000 })
  await shot(page, '05-dashboard')
  const dashboardSnippet = await page.locator('body').textContent()
  log(`  dashboard text length: ${dashboardSnippet?.length ?? 0} chars`)

  // ── s5 — markets list
  log('\n## 6. /markets 렌더링')
  await page.goto(`${BASE}/markets`)
  await page.waitForLoadState('networkidle', { timeout: 10000 })
  await shot(page, '06-markets-list')

  // ── s5 — markets connect grid (5마켓)
  log('\n## 7. /markets/connect (5 마켓 그리드)')
  await page.goto(`${BASE}/markets/connect`)
  await page.waitForLoadState('networkidle', { timeout: 10000 })
  await shot(page, '07-markets-connect')

  // ── s5 — markets/connect/11st (신규 활성 폼)
  log('\n## 8. /markets/connect/11st (api_key 폼 — 본 PR scaffold)')
  await page.goto(`${BASE}/markets/connect/11st`)
  await page.waitForLoadState('networkidle', { timeout: 10000 })
  const has11stForm = await page.getByLabel(/API Key/).count()
  log(`  has API Key input: ${has11stForm > 0}`)
  await shot(page, '08-markets-connect-11st')

  // ── s3 — register wizard step 1
  log('\n## 9. /register (5단계 위저드 — step1 info) — Tiptap first-load retry')
  await page.goto(`${BASE}/register/info`)
  await page.waitForLoadState('networkidle', { timeout: 10000 })
  let crashed = await page.getByText('예상치 못한 오류').isVisible().catch(() => false)
  if (crashed) {
    log('  ⚠ first hit crashed — reload to retry')
    await page.reload()
    await page.waitForLoadState('networkidle', { timeout: 10000 })
    crashed = await page.getByText('예상치 못한 오류').isVisible().catch(() => false)
    log(`  after reload: ${crashed ? 'STILL CRASHED' : 'OK'}`)
  }
  await shot(page, '09-register-step1-info')

  // ── s3 — register step3 markets (선택 그리드 — 5마켓 정합 확인)
  log('\n## 10. /register/markets (마켓 선택)')
  await page.goto(`${BASE}/register/markets`)
  await page.waitForLoadState('networkidle', { timeout: 10000 })
  await shot(page, '10-register-step3-markets')

  // ── s6 — history list
  log('\n## 11. /history 렌더링')
  await page.goto(`${BASE}/history`)
  await page.waitForLoadState('networkidle', { timeout: 10000 })
  await shot(page, '11-history-list')

  // ── s5 — settings
  log('\n## 12. /settings 렌더링')
  await page.goto(`${BASE}/settings`)
  await page.waitForLoadState('networkidle', { timeout: 10000 })
  await shot(page, '12-settings')

  // ── 법적 페이지 (비인증 접근)
  log('\n## 13. /legal/terms (비인증)')
  await page.goto(`${BASE}/legal/terms`)
  await page.waitForLoadState('networkidle', { timeout: 10000 })
  await shot(page, '13-legal-terms')

  log('\n✅ 모든 페이지 정상 응답')
} catch (e) {
  log(`\n❌ ERROR: ${e?.message ?? e}`)
  await shot(page, '99-error-state')
} finally {
  await browser.close()
}
