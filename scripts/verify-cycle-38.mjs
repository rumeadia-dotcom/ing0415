/**
 * Cycle 38 — SettingsPoliciesPage 의 dialog 포커스 복귀 (cycle 20 후속).
 *
 * 점검 항목:
 *  38.1 /settings/policies 의 정책 추가/수정/삭제 다이얼로그 close 시 트리거 포커스 복귀
 *  38.2 mock 데이터에 정책 ≥1 가정 — Edit / Delete 버튼 트리거 가능
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-38'
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

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await loginMock(page)
  await page.goto(`${BASE}/settings/policies`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)

  console.log('\n══════════ 38.1 정책 추가 다이얼로그 ESC 후 포커스 복귀 ══════════')
  const addBtn = page.getByRole('button', { name: /추가|새 정책/ }).first()
  const addVisible = await addBtn.isVisible().catch(() => false)
  console.log(`  "추가" 트리거 노출: ${addVisible ? '✓' : '⚠ 미발견'}`)
  if (addVisible) {
    await addBtn.focus()
    await addBtn.click()
    await page.waitForTimeout(600)
    const opened = await page.locator('[role="dialog"]').first().isVisible().catch(() => false)
    console.log(`  다이얼로그 open: ${opened ? '✓' : '⚠'}`)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)
    const closed = !(await page.locator('[role="dialog"]').first().isVisible().catch(() => false))
    console.log(`  ESC 후 close: ${closed ? '✓' : '⚠'}`)
    const afterFocus = await page.evaluate(`
      (() => {
        const ae = document.activeElement
        return ae ? (ae.tagName + ': ' + (ae.textContent || '').trim().slice(0, 20)) : 'null'
      })()
    `)
    console.log(`  close 후 active element: ${afterFocus}`)
    const restored = /추가|새 정책/.test(afterFocus)
    console.log(`  트리거 포커스 복귀: ${restored ? '✓' : '⚠ body 또는 다른 element'}`)
  }

  console.log('\n══════════ 38.2 정책 수정 다이얼로그 — 행의 "수정" 트리거 ══════════')
  const editBtn = page.getByRole('button', { name: /수정/ }).first()
  const editVisible = await editBtn.isVisible().catch(() => false)
  console.log(`  "수정" 트리거 노출: ${editVisible ? '✓ (mock 정책 row 존재)' : '⚠ mock 데이터 없음'}`)
  if (editVisible) {
    await editBtn.click()
    await page.waitForTimeout(600)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)
    const afterFocus = await page.evaluate(`
      (() => {
        const ae = document.activeElement
        return ae ? (ae.tagName + ': ' + (ae.textContent || '').trim().slice(0, 20)) : 'null'
      })()
    `)
    console.log(`  close 후 active element: ${afterFocus}`)
    const restored = /수정/.test(afterFocus)
    console.log(`  수정 트리거로 포커스 복귀: ${restored ? '✓' : '⚠'}`)
  }

  await ctx.close()
} catch (e) {
  console.log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  await browser.close()
}
