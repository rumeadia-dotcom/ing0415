/**
 * Cycle 24 — Number formatting consistency.
 *
 * 점검 항목:
 *  24.1 currency 표시 — ₩ 접두 vs 원 접미 일관성
 *  24.2 tabular-nums 적용 (숫자 컬럼이 정렬되어야 함) — 클래스 grep
 *  24.3 % / 건 / 개 등 단위 — toLocaleString 미적용 (천 단위 콤마) 케이스 식별
 *  24.4 큰 숫자 (≥ 1000) 가 콤마 없이 노출되는지 grep
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-24'
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

const ROUTES = ['dashboard', 'orders/list', 'history', 'settings/policies', 'register/info']

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await loginMock(page)

  for (const r of ROUTES) {
    log(`\n══════════ /${r} ══════════`)
    await page.goto(`${BASE}/${r}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    // 통화 표시 패턴 분석
    const stats = await page.evaluate(`
      (() => {
        const allText = document.body.innerText
        const won = (allText.match(/₩\\s*[\\d,]+/g) || []).slice(0, 30)
        const wonSuffix = (allText.match(/[\\d,]+\\s*원/g) || []).slice(0, 30)
        const krw = (allText.match(/[\\d,]+\\s*KRW/g) || []).slice(0, 10)
        // 콤마 없는 큰 숫자 (4자리 이상)
        const numbers = allText.match(/\\b\\d{4,}\\b/g) || []
        // 콤마 있는 큰 숫자
        const numsWithComma = allText.match(/\\b\\d{1,3}(?:,\\d{3})+\\b/g) || []
        // % 표시
        const pcts = (allText.match(/[\\d.]+\\s*%/g) || []).slice(0, 10)
        // 건/개 표시
        const counts = (allText.match(/[\\d,]+\\s*(?:건|개)\\b/g) || []).slice(0, 20)
        return {
          wonPrefix: won,
          wonSuffix,
          krw,
          rawBigNums: numbers.slice(0, 30),
          numsWithComma: numsWithComma.slice(0, 20),
          pcts,
          counts,
        }
      })()
    `)

    log(`  ₩ 접두 (currency prefix) 사례: ${stats.wonPrefix.length}개`)
    if (stats.wonPrefix.length > 0) log(`    예시: ${stats.wonPrefix.slice(0, 5).join(', ')}`)
    log(`  원 접미 (currency suffix) 사례: ${stats.wonSuffix.length}개`)
    if (stats.wonSuffix.length > 0) log(`    예시: ${stats.wonSuffix.slice(0, 5).join(', ')}`)
    log(`  KRW 표기: ${stats.krw.length}개`)
    log(`  콤마 있는 4+ 자리 수: ${stats.numsWithComma.length}개`)
    if (stats.numsWithComma.length > 0) log(`    예시: ${stats.numsWithComma.slice(0, 5).join(', ')}`)
    log(`  콤마 없는 4+ 자리 수: ${stats.rawBigNums.length}개`)
    // 콤마 없는 큰 숫자가 있으면 의심 (uuid/주문번호/timestamp 제외 필요)
    if (stats.rawBigNums.length > 0) log(`    예시: ${stats.rawBigNums.slice(0, 10).join(', ')}`)
    log(`  % 표시: ${stats.pcts.length}개 / 건·개 표시: ${stats.counts.length}개`)

    if (stats.wonPrefix.length > 0 && stats.wonSuffix.length > 0) {
      log(`  ⚠ currency 표기 혼재 — 페이지 안에 ₩ 접두 ${stats.wonPrefix.length}건 + 원 접미 ${stats.wonSuffix.length}건 동시 노출`)
    }
  }
  await ctx.close()
} catch (e) {
  log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  await browser.close()
}
