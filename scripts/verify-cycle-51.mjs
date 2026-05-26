#!/usr/bin/env node
/**
 * cycle 51 — Dialog focus trap 회귀 가드 (ARIA modal pattern).
 *
 * cycle 20 은 Dialog close 후 트리거로 focus 복귀 검증.
 * cycle 51 은 Dialog 열린 동안 Tab 키 순환이 dialog 내부에서만 도는지 검증 (WCAG 2.4.3 + ARIA modal).
 *
 * Radix UI Dialog 가 기본 제공이지만 회귀 가드 가치 — 향후 다른 modal 패턴 (네이티브 dialog,
 * portal 외부 modal 등) 도입 시 회귀 즉시 감지.
 *
 * 사용: node scripts/verify-cycle-51.mjs (dev server localhost:5173)
 */

import { chromium } from 'playwright'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173'

/** 점검 대상: dialog open trigger + dialog content selector */
const SCENARIOS = [
  {
    name: 'logout-confirm',
    route: '/settings',
    open: { role: 'button', name: '로그아웃' },
    dialogSelector: '[role="dialog"]',
  },
  {
    name: 'policy-create',
    route: '/settings/policies',
    open: { role: 'button', name: /새 정책|배송 정책 추가|정책 추가/ },
    dialogSelector: '[role="dialog"]',
  },
]

const browser = await chromium.launch()
const ctx = await browser.newContext({ locale: 'ko-KR' })
const page = await ctx.newPage()

const findings = []

for (const sc of SCENARIOS) {
  console.log(`\n=== ${sc.name} (${sc.route}) ===`)
  await page.goto(`${BASE}${sc.route}`)
  await page.waitForLoadState('networkidle')

  // dialog open
  const trigger = page.getByRole(sc.open.role, { name: sc.open.name }).first()
  if ((await trigger.count()) === 0) {
    console.log(`  ⚠ trigger not found: ${JSON.stringify(sc.open)}`)
    findings.push(`${sc.name}: trigger not found`)
    continue
  }
  await trigger.click()
  await page.waitForTimeout(200)
  const dialog = page.locator(sc.dialogSelector).first()
  if ((await dialog.count()) === 0) {
    console.log('  ⚠ dialog not opened')
    findings.push(`${sc.name}: dialog not opened`)
    continue
  }
  // dialog aria-modal 확인
  const ariaModal = await dialog.getAttribute('aria-modal')
  console.log(`  dialog opened — aria-modal=${ariaModal}`)
  if (ariaModal !== 'true') {
    findings.push(`${sc.name}: dialog aria-modal != 'true' (got ${ariaModal})`)
  }

  // dialog 안의 focusable element 수집
  const focusables = await dialog.locator('button, [href], input, [tabindex]:not([tabindex="-1"])').count()
  console.log(`  focusable elements in dialog: ${focusables}`)

  // Tab 키 (focusables + 2) 회 — focus 가 dialog 밖으로 빠지는지
  let outsideFocus = false
  const sample = Math.max(focusables + 2, 5)
  for (let i = 0; i < sample; i++) {
    await page.keyboard.press('Tab')
    await page.waitForTimeout(60)
    const focusedInDialog = await page.evaluate(`
      (() => {
        const dialogs = document.querySelectorAll(${JSON.stringify(sc.dialogSelector)})
        if (dialogs.length === 0) return false
        const active = document.activeElement
        if (!active) return false
        return Array.from(dialogs).some((d) => d.contains(active))
      })()
    `)
    if (!focusedInDialog) {
      outsideFocus = true
      console.log(`  ✗ Tab ${i + 1}: focus 가 dialog 밖`)
      break
    }
  }
  if (!outsideFocus) {
    console.log(`  ✓ focus trap 동작 — Tab ${sample}회 모두 dialog 내부`)
  } else {
    findings.push(`${sc.name}: focus escaped dialog after Tab`)
  }

  // ESC 로 close
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
}

await browser.close()

console.log(`\n=== Findings (${findings.length}) ===`)
findings.forEach((f) => console.log(`  ${f}`))
process.exit(findings.length > 0 ? 1 : 0)
