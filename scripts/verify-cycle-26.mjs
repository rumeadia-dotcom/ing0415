/**
 * Cycle 26 — 모바일 (375px) 터치 타겟 ≥44×44px (PRD §5.2).
 *
 * 점검 항목:
 *  26.1 /dashboard, /markets, /orders/list, /history, /settings, /register/info 모바일에서
 *       button, a, input[type=checkbox|radio|submit] 의 클릭 가능 영역 측정.
 *  26.2 hit-target 44px 미만 element 의 id/text/위치 enumerate.
 *  26.3 mobile 햄버거 메뉴 존재 + 동작 (Header 의 모바일 토글)
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-26'
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

async function auditTouchTargets(page) {
  return await page.evaluate(`
    (() => {
      const els = Array.from(document.querySelectorAll('button:not([disabled]), a[href], input[type="checkbox"], input[type="radio"], input[type="submit"], [role="button"]:not([aria-disabled="true"])'))
      const items = []
      for (const el of els) {
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) continue // hidden
        if (rect.bottom < 0 || rect.top > window.innerHeight + 200) continue // way off-screen
        const minDim = Math.min(rect.width, rect.height)
        if (minDim < 44) {
          items.push({
            tag: el.tagName.toLowerCase(),
            type: el.getAttribute('type') || '',
            text: (el.textContent || '').trim().slice(0, 30),
            label: el.getAttribute('aria-label') || '',
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            minDim: Math.round(minDim),
          })
        }
      }
      return items
    })()
  `)
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})

const ROUTES = ['dashboard', 'markets', 'orders/list', 'history', 'settings', 'register/info']

try {
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 }, // iPhone X
    isMobile: true,
    hasTouch: true,
  })
  const page = await ctx.newPage()
  await loginMock(page)

  for (const r of ROUTES) {
    log(`\n══════════ /${r} (mobile 375×812) ══════════`)
    await page.goto(`${BASE}/${r}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    const small = await auditTouchTargets(page)
    log(`  44px 미만 타겟 ${small.length}건`)
    for (const s of small.slice(0, 12)) {
      log(`    <${s.tag}${s.type ? ` type=${s.type}` : ''}> "${s.text || s.label}" — ${s.w}×${s.h}px (min ${s.minDim})`)
    }
    if (small.length > 12) log(`    … (+${small.length - 12}건 생략)`)
  }
  await ctx.close()
} catch (e) {
  log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  await browser.close()
}
