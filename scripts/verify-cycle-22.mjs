/**
 * Cycle 22 — Toast accessibility (sonner aria-live + role).
 *
 * 점검 항목:
 *  22.1  Toaster 컨테이너에 aria-live / role 속성 존재 (스크린리더 라이브 영역)
 *  22.2  실제 토스트 표시 시 DOM 에 aria-live 영역 안에 텍스트 들어가는지
 *  22.3  성공·실패 토스트 모두 SR 에 노출되는지 (sonner 기본 동작 검증)
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-22'
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
  // 22.1 Toaster 컨테이너 검사
  log('\n══════════ 22.1 Toaster 컨테이너 aria 속성 ══════════')
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await loginMock(page)
  await page.goto(`${BASE}/dashboard`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  const toasterInfo = await page.evaluate(`
    (() => {
      const containers = Array.from(document.querySelectorAll('section[aria-label], ol[role], section[role]'))
        .filter((el) => el.textContent !== null && /toast|sonner/i.test(el.className || ''))
      const sections = Array.from(document.querySelectorAll('section')).filter((el) => {
        const lbl = (el.getAttribute('aria-label') || '').toLowerCase()
        return lbl.includes('notification') || lbl.includes('toast') || lbl.includes('알림')
      })
      const allLive = Array.from(document.querySelectorAll('[aria-live]')).map((el) => ({
        tag: el.tagName.toLowerCase(),
        ariaLive: el.getAttribute('aria-live'),
        role: el.getAttribute('role') || '',
        label: el.getAttribute('aria-label') || '',
        cls: (el.className || '').slice(0, 40),
      }))
      return { containerCount: containers.length, sectionCount: sections.length, liveRegions: allLive }
    })()
  `)
  log(`  aria-label 기반 컨테이너 후보: ${toasterInfo.sectionCount}개`)
  log(`  aria-live region 발견: ${toasterInfo.liveRegions.length}개`)
  for (const lr of toasterInfo.liveRegions) {
    log(`    <${lr.tag} aria-live="${lr.ariaLive}" role="${lr.role}" aria-label="${lr.label}" class="${lr.cls}…">`)
  }

  // 22.2 실제 토스트 발생 시 동작
  log('\n══════════ 22.2 실제 토스트 발생 (mock - 강제 trigger) ══════════')
  await page.evaluate(`
    (() => {
      // window 에 노출된 sonner 가 있다면 활용. 없으면 sonner module 직접 import 불가하므로
      // 페이지의 기존 toast 호출을 일으키는 시나리오를 사용해야 한다. 여기선 일단 직접 sonner toast 글로벌 노출이 없을 가능성 高.
    })()
  `)
  // 대안: /login 으로 가서 잘못된 비밀번호 시도 → 에러 토스트 발생
  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800)
  await page.getByRole('textbox', { name: '이메일' }).fill('wrong@example.com')
  await page.locator('input[type="password"]').first().fill('wrong1234!')
  await page
    .locator('button[type="submit"]')
    .filter({ hasText: /^로그인$/ })
    .first()
    .click()
  await page.waitForTimeout(2500)
  // mock 환경은 실패 케이스가 없을 수 있음. /settings 의 로그아웃 성공 토스트로 변경
  log('  /login 실패 토스트 시도 — mock 환경에선 성공 처리될 수도 있음. /settings 로그아웃 토스트로 대안 검증.')
  await page.waitForTimeout(1500)
  const afterLoginUrl = new URL(page.url()).pathname
  log(`  /login 후 URL: ${afterLoginUrl}`)
  if (afterLoginUrl.endsWith('/login')) {
    // 에러 토스트가 떴을 수 있음
    const errorToastDom = await page.evaluate(`
      (() => {
        const lr = document.querySelector('[aria-live]')
        return lr ? { text: (lr.textContent || '').trim().slice(0, 120), liveLevel: lr.getAttribute('aria-live') } : null
      })()
    `)
    log(`  로그인 후 live region 내용: ${JSON.stringify(errorToastDom)}`)
  }

  // 22.3 /settings 로그아웃 성공 토스트 — 가장 안정적인 토스트 발생 경로
  log('\n══════════ 22.3 /settings 로그아웃 성공 토스트 ══════════')
  // 우선 로그인 후
  if (afterLoginUrl.endsWith('/login')) {
    await loginMock(page)
  }
  await page.goto(`${BASE}/settings`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: /로그아웃/ }).first().click()
  await page.waitForTimeout(400)
  // 다이얼로그 내 로그아웃 확정
  await page
    .locator('[role="dialog"] button')
    .filter({ hasText: /^로그아웃$/ })
    .first()
    .click()
  await page.waitForTimeout(800)
  // 토스트 발생 직후 SR 영역 캡처
  const toastSnapshot = await page.evaluate(`
    (() => {
      const lrs = Array.from(document.querySelectorAll('[aria-live]'))
      return lrs.map((el) => ({
        ariaLive: el.getAttribute('aria-live'),
        role: el.getAttribute('role') || '',
        label: el.getAttribute('aria-label') || '',
        text: (el.textContent || '').trim().slice(0, 120),
      }))
    })()
  `)
  log(`  로그아웃 직후 live region 들:`)
  for (const t of toastSnapshot) {
    log(`    aria-live="${t.ariaLive}" role="${t.role}" label="${t.label}" text="${t.text}"`)
  }
  const hasToastText = toastSnapshot.some((t) => /로그아웃|signed out|성공|sign-out|signOutSuccess/i.test(t.text))
  log(`  로그아웃 성공 토스트 텍스트 SR 노출: ${hasToastText ? '✓' : '⚠ live region 에 텍스트 없음'}`)
  await ctx.close()
} catch (e) {
  log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  await browser.close()
}
