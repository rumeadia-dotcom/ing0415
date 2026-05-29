/**
 * Cycle 28 — 날짜/시간 표기 일관성.
 *
 * 점검 항목:
 *  28.1 /orders/list, /history, /markets 에 노출된 시간 텍스트 enumerate
 *       - 상대 (방금 / N분 전 / N시간 전 / N일 전)
 *       - 절대 (yyyy-mm-dd)
 *       - ISO raw (2026-05-20T00:00:00.000+09:00) 노출 의심
 *  28.2 동일 페이지 안에서 상대/절대 혼재 정도 측정
 *  28.3 formatRelativeTime 단일화 grep 확인 (중복 구현 0 확인)
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-28'
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

const ROUTES = ['orders/list', 'history', 'markets', 'dashboard']

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await loginMock(page)

  for (const r of ROUTES) {
    log(`\n══════════ /${r} 시간 표기 ══════════`)
    await page.goto(`${BASE}/${r}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    const stats = await page.evaluate(`
      (() => {
        const txt = document.body.innerText
        const relative = (txt.match(/(?:방금|어제|오늘|\\d+\\s*(?:분|시간|일|주|개월|년)\\s*전)/g) || []).slice(0, 30)
        const absoluteDate = (txt.match(/\\b20\\d{2}-\\d{2}-\\d{2}\\b/g) || []).slice(0, 20)
        const isoFull = (txt.match(/\\b20\\d{2}-\\d{2}-\\d{2}T\\d{2}:\\d{2}/g) || []).slice(0, 10)
        // M월 DD일 같은 한국어 절대 표기
        const koDate = (txt.match(/\\d{1,2}월\\s*\\d{1,2}일/g) || []).slice(0, 10)
        return { relative, absoluteDate, isoFull, koDate }
      })()
    `)

    log(`  상대 시간 (분/시간/일 전 등): ${stats.relative.length}개`)
    if (stats.relative.length > 0) log(`    예시: ${stats.relative.slice(0, 5).join(', ')}`)
    log(`  절대 yyyy-mm-dd: ${stats.absoluteDate.length}개`)
    if (stats.absoluteDate.length > 0) log(`    예시: ${stats.absoluteDate.slice(0, 5).join(', ')}`)
    log(`  한국어 M월 DD일: ${stats.koDate.length}개`)
    if (stats.koDate.length > 0) log(`    예시: ${stats.koDate.slice(0, 5).join(', ')}`)
    log(`  ISO raw 노출 의심 (2026-..T..:..): ${stats.isoFull.length}개`)
    if (stats.isoFull.length > 0) {
      log(`    ⚠ ISO raw 노출 — 사용자에게 보여서는 안 됨:`)
      for (const s of stats.isoFull) log(`      ${s}`)
    }
  }
  await ctx.close()
} catch (e) {
  log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  await browser.close()
}
