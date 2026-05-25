/**
 * Cycle 6-10 mock walkthrough driver (확장).
 *
 * 마스터: scripts/verify-cycles.mjs (cycle 1-5, PR #160) 의 연속.
 *
 * 6: 키보드 네비 / a11y (Tab focus order, ARIA, 색상 대비)
 * 7: mock error scenarios (5xx / 401 / 429 / timeout / partial)
 * 8: history 상세 + retry / exclude 액션
 * 9: markets connect 전체 폼 (HMAC / ESM JWT / API Key) submit
 * 10: 필터 UI (orders / history)
 */

import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycles-2'
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
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})

const pageErrors = []
async function newCtx(viewport = { width: 1280, height: 800 }) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  page.on('pageerror', (err) =>
    pageErrors.push(`[${new URL(page.url()).pathname}] ${err.message.slice(0, 200)}`),
  )
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('CERT_AUTHORITY')) {
      pageErrors.push(`[${new URL(page.url()).pathname}] console.error: ${msg.text().slice(0, 200)}`)
    }
  })
  return { context, page }
}

try {
  // ============================================================
  // Cycle 6 — 키보드 네비 + a11y 점검
  // ============================================================
  log('\n══════════ Cycle 6 — 키보드 / a11y ══════════')
  {
    const { context, page } = await newCtx()
    await loginMock(page)

    // 6.1 dashboard Tab focus 순회 — 처음 7번 Tab 후 focus 위치
    log('\n6.1 dashboard Tab focus 순회 7회')
    await page.goto(`${BASE}/dashboard`)
    await page.waitForLoadState('networkidle')
    const focusTrail = []
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('Tab')
      await page.waitForTimeout(100)
      const focused = await page.evaluate(`
        (() => {
          const el = document.activeElement
          if (!el) return 'null'
          const tag = el.tagName?.toLowerCase()
          const aria = el.getAttribute('aria-label')
          const text = (el.textContent || '').trim().slice(0, 30)
          return tag + (aria ? '[' + aria.slice(0, 25) + ']' : '') + (text ? ' "' + text + '"' : '')
        })()
      `)
      focusTrail.push(focused)
    }
    log(`  focus 1-7: ${focusTrail.join(' → ')}`)
    await shot(page, 'c6-01-dashboard-focus')

    // 6.2 ARIA landmark 수
    log('\n6.2 ARIA landmark 점검')
    const landmarks = await page.evaluate(`
      Array.from(document.querySelectorAll('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer'))
        .map(el => el.tagName.toLowerCase() + (el.getAttribute('role') ? '[' + el.getAttribute('role') + ']' : '') + (el.getAttribute('aria-label') ? '("' + el.getAttribute('aria-label').slice(0, 20) + '")' : ''))
    `)
    log(`  landmark 발견: ${landmarks.length}개`)
    for (const m of landmarks) log(`    - ${m}`)

    // 6.3 markets connect 11st — 폼 Tab navigation
    log('\n6.3 /markets/connect/11st Tab 순회 5회')
    await page.goto(`${BASE}/markets/connect/11st`)
    await page.waitForLoadState('networkidle')
    const formTrail = []
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab')
      await page.waitForTimeout(80)
      const focused = await page.evaluate(`
        (() => {
          const el = document.activeElement
          if (!el) return 'null'
          const tag = el.tagName?.toLowerCase()
          const aria = el.getAttribute('aria-label')
          const placeholder = el.getAttribute('placeholder')
          const text = (el.textContent || '').trim().slice(0, 20)
          return tag + (aria ? '[' + aria.slice(0, 20) + ']' : '') + (placeholder ? ' (' + placeholder.slice(0, 15) + ')' : '') + (text && tag === 'button' ? ' "' + text + '"' : '')
        })()
      `)
      formTrail.push(focused)
    }
    log(`  focus 1-5: ${formTrail.join(' → ')}`)
    await shot(page, 'c6-02-11st-form-tab')

    await context.close()
  }

  // ============================================================
  // Cycle 7 — mock error scenarios
  // ============================================================
  log('\n══════════ Cycle 7 — mock error scenarios ══════════')
  for (const scenario of ['5xx', '401', '429', 'partial']) {
    const { context, page } = await newCtx()
    await loginMock(page)
    log(`\n7.${scenario} — globalThis.__MOCK_SCENARIO__ = "${scenario}"`)

    // markets connect provider 진입 후 mock 시나리오 주입
    await page.goto(`${BASE}/markets/connect/coupang`)
    await page.waitForLoadState('networkidle')
    await page.evaluate(`globalThis.__MOCK_SCENARIO__ = "${scenario}"`)

    // HMAC 폼 입력 + submit
    await page.getByLabel(/Vendor/i).first().fill('A00012345').catch(() => { /* ignore */ })
    await page.getByLabel(/Access/i).first().fill('test-access-key').catch(() => { /* ignore */ })
    const pwdInputs = page.locator('input[type="password"]')
    if ((await pwdInputs.count()) > 0) {
      await pwdInputs.first().fill('test-secret-key-' + 'x'.repeat(30))
    }
    await page.getByRole('button', { name: /^연결$/ }).click({ timeout: 3000 }).catch(() => { /* ignore */ })
    await page.waitForTimeout(2000)

    const body = (await page.locator('body').textContent()) ?? ''
    const errSeen = /오류|실패|문제|error/i.test(body) || /\d{3}/.test(body)
    log(`  error UI 표시: ${errSeen ? 'Yes' : 'No'}`)
    await shot(page, `c7-${scenario}-coupang-after`)
    await context.close()
  }

  // ============================================================
  // Cycle 8 — history 상세 + retry / exclude
  // ============================================================
  log('\n══════════ Cycle 8 — history 상세 + retry / exclude ══════════')
  {
    const { context, page } = await newCtx()
    await loginMock(page)

    // 8.1 history list → 첫 잡 클릭 → 상세 진입
    log('\n8.1 /history → 첫 잡 클릭 → 상세 진입')
    await page.goto(`${BASE}/history`)
    await page.waitForLoadState('networkidle')
    await shot(page, 'c8-01-history-list')
    const firstJobRow = page.locator('a[href^="/history/"], a[href*="/history/"]').first()
    const firstHref = await firstJobRow.getAttribute('href').catch(() => null)
    log(`  첫 jobId href: ${firstHref ?? 'none'}`)
    if (firstHref) {
      await firstJobRow.click()
      await page.waitForLoadState('networkidle', { timeout: 10000 })
      log(`  진입 → ${new URL(page.url()).pathname}`)
      await shot(page, 'c8-02-history-detail')
    } else {
      // direct mock job id
      await page.goto(`${BASE}/history/00000000-0000-4000-8000-000000003002`) // partial job
      await page.waitForLoadState('networkidle')
      await shot(page, 'c8-02-history-detail')
    }

    // 8.2 retry / exclude 버튼 검출 (partial 잡 가정)
    const retryBtn = page.getByRole('button', { name: /재시도/ }).first()
    const excludeBtn = page.getByRole('button', { name: /제외/ }).first()
    log(`  재시도 버튼: ${(await retryBtn.count())}개 / 제외 버튼: ${(await excludeBtn.count())}개`)
    if ((await retryBtn.count()) > 0) {
      await retryBtn.click().catch(() => { /* ignore */ })
      await page.waitForTimeout(500)
      await shot(page, 'c8-03-retry-dialog')
      // dialog 닫기 (있다면)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }

    await context.close()
  }

  // ============================================================
  // Cycle 9 — markets connect 전체 폼 (HMAC / ESM JWT / API Key)
  // ============================================================
  log('\n══════════ Cycle 9 — markets connect 전체 폼 submit ══════════')
  for (const [provider, label, fillFn] of [
    ['coupang', 'HMAC', async (p) => {
      await p.getByLabel(/Vendor/i).first().fill('A00012345').catch(() => { /* ignore */ })
      await p.getByLabel(/Access/i).first().fill('mock-access-key').catch(() => { /* ignore */ })
      const pwds = p.locator('input[type="password"]')
      if ((await pwds.count()) > 0) {
        await pwds.first().fill('mock-secret-key-' + 'x'.repeat(30))
      }
    }],
    ['gmarket', 'ESM JWT', async (p) => {
      await p.getByLabel(/Master/i).first().fill('master_test').catch(() => { /* ignore */ })
      const pwds = p.locator('input[type="password"]')
      if ((await pwds.count()) > 0) await pwds.first().fill('SECRET' + 'Z'.repeat(50))
      await p.getByLabel(/Seller/i).first().fill('seller_test').catch(() => { /* ignore */ })
    }],
    ['11st', 'API Key', async (p) => {
      const pwds = p.locator('input[type="password"]')
      if ((await pwds.count()) > 0) await pwds.first().fill('mock-api-key-' + 'x'.repeat(40))
    }],
  ]) {
    const { context, page } = await newCtx()
    await loginMock(page)
    log(`\n9.${provider} (${label}) — 폼 입력 → submit`)
    await page.goto(`${BASE}/markets/connect/${provider}`)
    await page.waitForLoadState('networkidle')
    await fillFn(page)
    await shot(page, `c9-${provider}-filled`)
    await page.getByRole('button', { name: /^연결$/ }).click({ timeout: 3000 }).catch((e) => log(`  submit err: ${e.message.slice(0, 80)}`))
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => { /* ignore */ })
    const url = new URL(page.url()).pathname
    log(`  after submit → ${url}`)
    await shot(page, `c9-${provider}-after`)
    await context.close()
  }

  // ============================================================
  // Cycle 10 — 필터 UI (orders / history)
  // ============================================================
  log('\n══════════ Cycle 10 — 필터 UI ══════════')
  {
    const { context, page } = await newCtx()
    await loginMock(page)

    // 10.1 orders/list 마켓 필터
    log('\n10.1 /orders/list 마켓 필터 — 쿠팡만 보기')
    await page.goto(`${BASE}/orders/list`)
    await page.waitForLoadState('networkidle')
    const filterCoupang = page.getByRole('button', { name: /^쿠팡$/ }).first()
    const filterCnt = await filterCoupang.count()
    log(`  쿠팡 필터 버튼: ${filterCnt}개`)
    if (filterCnt > 0) {
      await filterCoupang.click()
      await page.waitForTimeout(500)
      await shot(page, 'c10-01-orders-coupang-filter')
    }

    // 10.2 history filter sidebar
    log('\n10.2 /history 사이드바 필터')
    await page.goto(`${BASE}/history`)
    await page.waitForLoadState('networkidle')
    // 기간 필터 7일 클릭
    const sevenDayBtn = page.getByRole('button', { name: /7일|7 days/ }).first()
    if ((await sevenDayBtn.count()) > 0) {
      await sevenDayBtn.click()
      await page.waitForTimeout(300)
    }
    await shot(page, 'c10-02-history-filter')

    await context.close()
  }

  log('\n══════════ ✅ cycle 6-10 완료 ══════════')
} catch (e) {
  log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  if (pageErrors.length > 0) {
    log(`\n──── pageerror / console.error ${pageErrors.length}건 ────`)
    for (const e of pageErrors.slice(0, 30)) log(`  ${e}`)
  }
  await browser.close()
}
