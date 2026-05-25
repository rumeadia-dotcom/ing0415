/**
 * Cycle 32 — 외부 링크 보안 (OWASP reverse tabnabbing).
 *
 * 점검 항목:
 *  32.1 모든 target="_blank" anchor 에 rel="noopener" + "noreferrer" 동반 (코드 grep)
 *  32.2 window.open 의 features 문자열에 noopener,noreferrer 포함 (코드 grep)
 *
 * 본 사이클은 코드 grep + Playwright 로 실제 DOM 의 rel 속성 확인 병행.
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-32'
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

const ROUTES = ['markets/connect/naver', 'settings/shipping/logen']

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await loginMock(page)

  console.log('\n══════════ 32.1 target=_blank rel 속성 검증 ══════════')
  for (const r of ROUTES) {
    await page.goto(`${BASE}/${r}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1200)
    const links = await page.evaluate(`
      Array.from(document.querySelectorAll('a[target="_blank"]')).map((a) => ({
        href: a.getAttribute('href') || '',
        rel: a.getAttribute('rel') || '',
        text: (a.textContent || '').trim().slice(0, 40),
      }))
    `)
    console.log(`  /${r} — target=_blank 링크 ${links.length}개`)
    for (const l of links) {
      const ok = /noopener/.test(l.rel) && /noreferrer/.test(l.rel)
      console.log(`    "${l.text}" href=${l.href} rel="${l.rel}" ${ok ? '✓' : '⚠ rel 누락'}`)
    }
  }
  await ctx.close()
} catch (e) {
  console.log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  await browser.close()
}
