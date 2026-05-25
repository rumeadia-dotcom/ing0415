/**
 * Cycle 35 — img/svg alt + aria-hidden + raw <a href> audit (WCAG 1.1.1).
 *
 * 점검 항목:
 *  35.1 SPA 내부 이동에 raw <a href="/..."> 사용처 (router Link 미사용 = full reload 누수)
 *  35.2 인라인 <svg> 의 aria-hidden 또는 aria-label 보유 — 장식 아이콘은 aria-hidden 권장
 *  35.3 <img> alt 텍스트 coverage
 *
 * 본 사이클은 grep + 일부 코드 검수 기반. Playwright DOM 검사는 mock 데이터 한정.
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-35'
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

const ROUTES = ['dashboard', 'orders/list', 'history', 'markets', 'settings', 'signup']

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await loginMock(page)

  console.log('\n══════════ 35.1~35.3 페이지별 svg / img / a 점검 ══════════')
  for (const r of ROUTES) {
    await page.goto(`${BASE}/${r}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1200)
    const stats = await page.evaluate(`
      (() => {
        const svgs = Array.from(document.querySelectorAll('svg'))
        const svgWithoutAriaHidden = svgs.filter((s) => s.getAttribute('aria-hidden') !== 'true' && !s.getAttribute('aria-label') && !s.getAttribute('role')).length
        const imgs = Array.from(document.querySelectorAll('img'))
        const imgWithoutAlt = imgs.filter((i) => i.getAttribute('alt') === null).length
        // SPA 내부 raw a href (router Link 가 아닌 경우)
        const rawAs = Array.from(document.querySelectorAll('a[href^="/"]:not([target])'))
          .filter((a) => !a.hasAttribute('data-react-router'))  // 이건 확정적이지 않음, 어쨌든 카운트
        return {
          totalSvg: svgs.length,
          svgWithoutAriaHidden,
          totalImg: imgs.length,
          imgWithoutAlt,
          spaInternalAnchors: rawAs.length,
        }
      })()
    `)
    console.log(`  /${r} — svg ${stats.totalSvg} (aria-hidden/label 누락 ${stats.svgWithoutAriaHidden}) / img ${stats.totalImg} (alt 누락 ${stats.imgWithoutAlt}) / internal a ${stats.spaInternalAnchors}`)
  }
  await ctx.close()
} catch (e) {
  console.log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  await browser.close()
}
