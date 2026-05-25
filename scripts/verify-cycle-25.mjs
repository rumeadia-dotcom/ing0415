/**
 * Cycle 25 — 검색 / 필터 클리어 동작.
 *
 * 점검 항목:
 *  25.1 /history 검색 + 초기화 버튼 동작
 *  25.2 /orders/list 검색어 입력 후 클리어 → 결과 복귀
 *  25.3 /history 필터 조합 후 reset 시 URL 쿼리스트링 정리 확인
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-25'
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
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await loginMock(page)

  // 25.1 /history 검색 + 초기화
  log('\n══════════ 25.1 /history 검색 + 초기화 ══════════')
  await page.goto(`${BASE}/history`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)

  // 초기 row 개수
  const beforeRows = await page.locator('table tbody tr, [data-history-row], [role="row"]').count()
  log(`  초기 row 개수: ${beforeRows}`)

  // Fieldset "검색" 펼치기
  const searchLegendBtn = page.getByRole('button', { name: /^검색/ }).first()
  const expanded = await searchLegendBtn.getAttribute('aria-expanded').catch(() => null)
  if (expanded === 'false') {
    await searchLegendBtn.click()
    await page.waitForTimeout(300)
  }

  // 검색어 입력
  const searchInput = page.locator('input[aria-label*="검색"], input[placeholder*="검색"]').first()
  await searchInput.fill('존재하지않는상품XYZ')
  await page.waitForTimeout(800)
  // "적용" 버튼이 있으면 클릭, 없으면 Enter
  const applyBtn = page.getByRole('button', { name: /^적용$/ }).first()
  const applyVisible = await applyBtn.isVisible().catch(() => false)
  if (applyVisible) {
    await applyBtn.click()
  } else {
    await page.keyboard.press('Enter')
  }
  await page.waitForTimeout(1200)
  const afterSearchRows = await page.locator('table tbody tr, [data-history-row], [role="row"]').count()
  log(`  검색어 입력 후 row 개수: ${afterSearchRows}`)
  const urlAfterSearch = new URL(page.url()).search
  log(`  검색 후 URL query: "${urlAfterSearch}"`)

  // 초기화 버튼
  const resetBtn = page.getByRole('button', { name: /^초기화$/ }).first()
  const resetVisible = await resetBtn.isVisible().catch(() => false)
  log(`  초기화 버튼 노출: ${resetVisible ? '✓' : '⚠ 보이지 않음'}`)
  if (resetVisible) {
    await resetBtn.click()
    await page.waitForTimeout(1500)
    const afterResetRows = await page.locator('table tbody tr, [data-history-row], [role="row"]').count()
    const searchValue = await searchInput.inputValue().catch(() => 'N/A')
    const urlAfterReset = new URL(page.url()).search
    log(`  초기화 후 row 개수: ${afterResetRows} (초기 ${beforeRows} 와 일치: ${afterResetRows === beforeRows ? '✓' : '⚠'})`)
    log(`  초기화 후 검색 input 값: "${searchValue}" ${searchValue === '' ? '✓' : '⚠ 잔존'}`)
    log(`  초기화 후 URL query: "${urlAfterReset}" ${urlAfterReset === '' ? '✓' : '⚠ 잔존'}`)
  }

  // 25.2 /orders/list 검색 + 클리어
  log('\n══════════ 25.2 /orders/list 검색 + 클리어 ══════════')
  await page.goto(`${BASE}/orders/list`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  const ordersBeforeRows = await page.locator('table tbody tr, [role="row"]').count()
  log(`  초기 row 개수: ${ordersBeforeRows}`)
  const ordersSearchInput = page.locator('input[placeholder*="검색"], input[aria-label*="검색"]').first()
  const ordersSearchVisible = await ordersSearchInput.isVisible().catch(() => false)
  log(`  검색 input 노출: ${ordersSearchVisible ? '✓' : '⚠'}`)
  if (ordersSearchVisible) {
    await ordersSearchInput.fill('존재하지않는주문ZZZ')
    await page.waitForTimeout(800)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1500)
    const ordersAfterSearchRows = await page.locator('table tbody tr, [role="row"]').count()
    log(`  검색 후 row 개수: ${ordersAfterSearchRows} ${ordersAfterSearchRows < ordersBeforeRows ? '✓ 필터됨' : '⚠ 그대로'}`)

    // orders/list 의 reset 버튼 찾기 — "필터 초기화"
    const ordersResetBtn = page.getByRole('button', { name: /초기화/ }).first()
    const ordersResetVisible = await ordersResetBtn.isVisible().catch(() => false)
    log(`  초기화 버튼 노출: ${ordersResetVisible ? '✓' : '⚠'}`)
    if (ordersResetVisible) {
      await ordersResetBtn.click()
      await page.waitForTimeout(1500)
      const ordersAfterResetRows = await page.locator('table tbody tr, [role="row"]').count()
      const inputAfterReset = await ordersSearchInput.inputValue().catch(() => 'N/A')
      log(`  초기화 후 row 개수: ${ordersAfterResetRows} (초기 ${ordersBeforeRows} 와 일치: ${ordersAfterResetRows === ordersBeforeRows ? '✓' : '⚠'})`)
      log(`  초기화 후 검색 input 값: "${inputAfterReset}" ${inputAfterReset === '' ? '✓' : '⚠ 잔존'}`)
    }
  }
  await ctx.close()
} catch (e) {
  log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  await browser.close()
}
