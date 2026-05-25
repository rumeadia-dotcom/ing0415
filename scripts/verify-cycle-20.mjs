/**
 * Cycle 20 — Dialog accessibility (focus trap / ESC / 포커스 복귀).
 *
 * 점검 항목:
 *  20.1  /settings 로그아웃 다이얼로그 — open / ESC dismiss / focus return-to-trigger
 *  20.2  /settings 로그아웃 다이얼로그 — Tab 키가 다이얼로그 내부에서 cycle (focus trap)
 *  20.3  /settings 로그아웃 다이얼로그 — open 시 첫 포커스가 다이얼로그 내부 element 인지 (close button 또는 첫 input/button)
 *  20.4  /settings 의 다른 다이얼로그(가능 시) — 정책 삭제 등 — 동일 거동
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-20'
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
  await page.goto(`${BASE}/settings`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)

  // 트리거 버튼 — 로그아웃
  const triggerBtn = page.getByRole('button', { name: /로그아웃/ }).first()
  await triggerBtn.focus()

  log('\n══════════ 20.1 다이얼로그 ESC 닫기 + 포커스 복귀 ══════════')
  await triggerBtn.click()
  await page.waitForTimeout(500)
  const dialog = page.locator('[role="dialog"]').first()
  const opened = await dialog.isVisible().catch(() => false)
  log(`  다이얼로그 open: ${opened ? '✓' : '⚠'}`)

  // open 직후 초기 포커스
  const initFocus = await page.evaluate(`
    (() => {
      const ae = document.activeElement
      return ae ? (ae.tagName + (ae.id ? '#' + ae.id : '') + (ae.textContent ? ': ' + ae.textContent.trim().slice(0, 30) : '')) : 'null'
    })()
  `)
  log(`  open 직후 active element: ${initFocus}`)

  // 다이얼로그 내부에 포커스 있는지 확인
  const focusInsideDialog = await page.evaluate(`
    (() => {
      const dialog = document.querySelector('[role="dialog"]')
      return dialog && document.activeElement ? dialog.contains(document.activeElement) : false
    })()
  `)
  log(`  포커스가 다이얼로그 내부에 위치: ${focusInsideDialog ? '✓' : '⚠ 다이얼로그 외부에 포커스'}`)

  // ESC 로 닫기
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  const closedAfterEsc = !(await dialog.isVisible().catch(() => false))
  log(`  ESC 후 close: ${closedAfterEsc ? '✓' : '⚠ ESC 무시'}`)

  // close 후 포커스가 트리거로 복귀했는지
  const focusAfterClose = await page.evaluate(`
    (() => {
      const ae = document.activeElement
      return ae ? (ae.tagName + (ae.textContent ? ': ' + ae.textContent.trim().slice(0, 30) : '')) : 'null'
    })()
  `)
  log(`  close 후 active element: ${focusAfterClose}`)
  const returned = /로그아웃/.test(focusAfterClose)
  log(`  포커스가 트리거(로그아웃 버튼) 로 복귀: ${returned ? '✓' : '⚠ 다른 element 또는 body 로 이동'}`)

  log('\n══════════ 20.2 다이얼로그 focus trap (Tab cycle) ══════════')
  await triggerBtn.click()
  await page.waitForTimeout(500)
  // Tab 을 여러 번 눌러서 다이얼로그 외부로 빠져나가지 않는지
  const tabResults = []
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    await page.waitForTimeout(80)
    const inside = await page.evaluate(`
      (() => {
        const dialog = document.querySelector('[role="dialog"]')
        return dialog && document.activeElement ? dialog.contains(document.activeElement) : false
      })()
    `)
    const tag = await page.evaluate(`
      (() => {
        const ae = document.activeElement
        return ae ? (ae.tagName + (ae.textContent ? ': ' + ae.textContent.trim().slice(0, 20) : '')) : 'null'
      })()
    `)
    tabResults.push({ inside, tag })
  }
  for (const [i, r] of tabResults.entries()) {
    log(`    Tab #${i + 1}: ${r.tag} ${r.inside ? '✓ inside' : '⚠ escaped'}`)
  }
  const trapped = tabResults.every((r) => r.inside)
  log(`  결과: ${trapped ? '✓ trap 동작' : '⚠ trap 누수 — 외부 element 로 빠짐'}`)

  // 다이얼로그 close
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  await ctx.close()
} catch (e) {
  log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  await browser.close()
}
