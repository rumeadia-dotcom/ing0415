/**
 * Cycle 19 — 로그아웃 플로우 + 세션 보호.
 *
 * 점검 항목:
 *  19.1  /settings 에서 로그아웃 버튼 발견 → 확인 다이얼로그 → 실행 → /login 으로 redirect
 *  19.2  로그아웃 후 보호 라우트(/dashboard) 직접 진입 → /login 으로 redirect (세션 검증)
 *  19.3  로그아웃 후 보호 라우트(/markets) 직접 진입 → /login 으로 redirect
 *  19.4  로그아웃 후 sessionStorage / localStorage 에 잔존 데이터 없는지 (셀러 PII / 토큰 키)
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-19'
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
  log('\n══════════ 19.1 /settings 로그아웃 플로우 ══════════')
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await loginMock(page)
  await page.goto(`${BASE}/settings`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)

  // 로그아웃 트리거 버튼
  const triggerBtn = page.getByRole('button', { name: /로그아웃/ }).first()
  const triggerVisible = await triggerBtn.isVisible().catch(() => false)
  log(`  /settings 로그아웃 트리거 노출: ${triggerVisible ? '✓' : '⚠ 보이지 않음'}`)
  if (!triggerVisible) {
    await page.screenshot({ path: `${OUT}/19.1-settings.png`, fullPage: true })
    throw new Error('logout trigger not found')
  }
  await triggerBtn.click()
  await page.waitForTimeout(500)
  // 확인 다이얼로그
  const dialogVisible = await page.locator('[role="dialog"]').first().isVisible().catch(() => false)
  log(`  확인 다이얼로그 노출: ${dialogVisible ? '✓' : '⚠'}`)
  if (dialogVisible) {
    // 다이얼로그 내 확인(=로그아웃) 버튼
    const confirmBtn = page
      .locator('[role="dialog"] button')
      .filter({ hasText: /^로그아웃$/ })
      .first()
    await confirmBtn.click()
    await page.waitForTimeout(2000)
    const url = new URL(page.url()).pathname
    log(`  로그아웃 후 URL: ${url} ${url.includes('/login') ? '✓' : '⚠ /login 아님'}`)
  }

  // NOTE: mock supabase 는 createMockSupabase() 부팅 시 자동 로그인
  // (createMockSupabase.ts:575 — "UI 즉시 진입" 목적). 따라서 page.goto() 같은 full
  // reload 는 mock 모듈이 재초기화되며 다시 로그인 상태가 됨. 보호 라우트 검증은
  // 현재 SPA 세션 안에서 history.pushState 로 이동해야 RequireAuth 가 실제 동작.

  log('\n══════════ 19.2 SPA 내 보호 라우트 /dashboard 이동 ══════════')
  await page.evaluate(`window.history.pushState({}, '', '/dashboard'); window.dispatchEvent(new PopStateEvent('popstate'))`)
  await page.waitForTimeout(1500)
  const u2 = new URL(page.url()).pathname
  log(`  /dashboard → ${u2} ${u2.endsWith('/login') ? '✓ 로그인으로 redirect (RequireAuth 동작)' : '⚠ 보호되지 않음'}`)

  log('\n══════════ 19.3 SPA 내 보호 라우트 /markets 이동 ══════════')
  await page.evaluate(`window.history.pushState({}, '', '/markets'); window.dispatchEvent(new PopStateEvent('popstate'))`)
  await page.waitForTimeout(1500)
  const u3 = new URL(page.url()).pathname
  log(`  /markets → ${u3} ${u3.endsWith('/login') ? '✓ 로그인으로 redirect (RequireAuth 동작)' : '⚠ 보호되지 않음'}`)

  log('\n[참고] mock supabase 부팅 자동 로그인:')
  log('  page.goto() / page.reload() = full reload → mock 모듈 재초기화 → 자동 로그인 (DX 편의).')
  log('  실제 환경에서는 reload 후에도 Supabase 세션 토큰이 storage 에 없으면 anonymous 유지.')

  log('\n══════════ 19.4 sessionStorage / localStorage 잔존 점검 ══════════')
  const storage = await page.evaluate(`
    (() => {
      const out = { local: {}, session: {} }
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k) out.local[k] = (localStorage.getItem(k) || '').slice(0, 80)
      }
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i)
        if (k) out.session[k] = (sessionStorage.getItem(k) || '').slice(0, 80)
      }
      return out
    })()
  `)
  log(`  localStorage 키 수: ${Object.keys(storage.local).length}`)
  for (const [k, v] of Object.entries(storage.local)) {
    const suspicious = /token|secret|access|refresh|email|seller|password/i.test(k) || /token|secret|access_key|refresh_token|password/i.test(v)
    log(`    [local] ${k} = "${v}" ${suspicious ? '⚠ 의심: 토큰/PII 잔존 가능' : '✓'}`)
  }
  log(`  sessionStorage 키 수: ${Object.keys(storage.session).length}`)
  for (const [k, v] of Object.entries(storage.session)) {
    const suspicious = /token|secret|access|refresh|email|seller|password/i.test(k) || /token|secret|access_key|refresh_token|password/i.test(v)
    log(`    [session] ${k} = "${v}" ${suspicious ? '⚠ 의심: 토큰/PII 잔존 가능' : '✓'}`)
  }
  await ctx.close()
} catch (e) {
  log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  await browser.close()
}
