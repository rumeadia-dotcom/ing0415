/**
 * Cycle 16 — semantic HTML 정합 (heading hierarchy / meta / lazy load).
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-16'
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

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})

try {
  // 16.1 meta description / title 검증
  log('\n══════════ 16.1 meta title / description ══════════')
  const ctx1 = await browser.newContext()
  const page1 = await ctx1.newPage()
  await page1.goto(`${BASE}/login`)
  await page1.waitForLoadState('networkidle')
  const title = await page1.title()
  const meta = await page1.evaluate(`document.querySelector('meta[name="description"]')?.getAttribute('content') || 'MISSING'`)
  log(`  <title>: "${title}"`)
  log(`  meta description: "${meta}"`)
  await ctx1.close()

  // 16.2 heading hierarchy per page
  log('\n══════════ 16.2 heading hierarchy 점검 ══════════')
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page2 = await ctx2.newPage()
  await loginMock(page2)
  for (const route of ['dashboard', 'markets', 'register/info', 'orders/list', 'history', 'settings']) {
    await page2.goto(`${BASE}/${route}`)
    await page2.waitForLoadState('networkidle')
    await page2.waitForTimeout(1500)
    const headings = await page2.evaluate(`
      Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((h) => h.tagName + ': ' + h.textContent.trim().slice(0, 40))
    `)
    log(`  /${route} — heading 수 ${headings.length}`)
    for (const h of headings.slice(0, 10)) log(`    ${h}`)
    // h1 의 수 점검
    const h1Count = headings.filter((h) => h.startsWith('H1:')).length
    if (h1Count === 0) log(`  ⚠ /${route}: H1 0개 (페이지마다 정확히 1개 권장)`)
    if (h1Count > 1) log(`  ⚠ /${route}: H1 ${h1Count}개 (1개 초과)`)
  }
  await ctx2.close()

  // 16.3 이미지 lazy load 점검
  log('\n══════════ 16.3 <img loading="lazy"> 점검 ══════════')
  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page3 = await ctx3.newPage()
  await loginMock(page3)
  await page3.goto(`${BASE}/dashboard`)
  await page3.waitForLoadState('networkidle')
  await page3.waitForTimeout(1500)
  const imgStats = await page3.evaluate(`
    (() => {
      const imgs = Array.from(document.querySelectorAll('img'))
      const total = imgs.length
      const lazy = imgs.filter((i) => i.getAttribute('loading') === 'lazy').length
      const eager = imgs.filter((i) => i.getAttribute('loading') === 'eager').length
      const noattr = imgs.filter((i) => !i.getAttribute('loading')).length
      const alts = imgs.map((i) => i.getAttribute('alt')).filter((a) => a === null || a === undefined).length
      return { total, lazy, eager, noattr, missingAlt: alts }
    })()
  `)
  log(`  /dashboard: img ${imgStats.total} 개 / lazy ${imgStats.lazy} / eager ${imgStats.eager} / loading 속성 없음 ${imgStats.noattr} / alt 누락 ${imgStats.missingAlt}`)
  await ctx3.close()
} catch (e) {
  log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  await browser.close()
}
