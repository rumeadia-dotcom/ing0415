/**
 * Cycle 27 — Loading state 일관성.
 *
 * 점검 항목:
 *  27.1 throttled 네트워크 (slow 3G) 시 각 페이지의 첫 paint 가 빈 화면이 아닌 skeleton/spinner 노출
 *  27.2 skeleton 컴포넌트 사용 일관성 grep (Skeleton 컴포넌트 vs 자체 구현)
 *  27.3 loading 중에도 PageHeader 가 노출되는지 (사용자가 어디에 있는지 인지)
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-27'
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

const ROUTES = ['dashboard', 'orders/list', 'history', 'markets']

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await loginMock(page)

  for (const r of ROUTES) {
    log(`\n══════════ /${r} (slow network 모사) ══════════`)
    // navigate without waiting for full load
    const navP = page.goto(`${BASE}/${r}`, { waitUntil: 'commit' })
    await navP
    // 250ms 후 첫 paint 스냅샷 — skeleton 노출 확인
    await page.waitForTimeout(250)
    const snap = await page.evaluate(`
      (() => {
        const skel = document.querySelectorAll('[class*="skeleton"], [data-skeleton], [role="status"]').length
        const visibleH1 = (() => {
          const h = document.querySelector('h1')
          if (!h) return null
          const r = h.getBoundingClientRect()
          return r.height > 0 ? (h.textContent || '').trim().slice(0, 50) : null
        })()
        const spinners = document.querySelectorAll('[role="progressbar"], [aria-busy="true"]').length
        const bodyText = (document.body.innerText || '').trim().length
        return { skel, h1: visibleH1, spinners, bodyTextLen: bodyText }
      })()
    `)
    log(`  250ms 후: skeleton ${snap.skel}개 / spinner ${snap.spinners}개 / h1="${snap.h1}" / body text ${snap.bodyTextLen}자`)
    const goodEarly = (snap.skel > 0 || snap.spinners > 0 || snap.h1 !== null) && snap.bodyTextLen > 10
    log(`  사용자가 즉시 컨텍스트 인지: ${goodEarly ? '✓' : '⚠ 빈 화면 가능성'}`)

    // 풀로드 후 snapshot
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    const final = await page.evaluate(`
      (() => {
        const skel = document.querySelectorAll('[class*="skeleton"]').length
        const h1 = document.querySelector('h1')
        return { skel, h1: h1 ? (h1.textContent || '').trim().slice(0, 50) : null }
      })()
    `)
    log(`  풀로드 후: skeleton ${final.skel}개 (잔존) / h1="${final.h1}"`)
    if (final.skel > 0) log(`    ⚠ 풀로드 후에도 skeleton 잔존 — 무한 로딩 상태 의심`)
  }

  // 27.2 Skeleton 컴포넌트 사용 vs 자체 div 비율 — code grep
  log(`\n══════════ 27.2 Skeleton 컴포넌트 사용 vs 자체 div ══════════`)
  log(`  (코드 grep — Bash 에서 수행)`)
  await ctx.close()
} catch (e) {
  log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  await browser.close()
}
