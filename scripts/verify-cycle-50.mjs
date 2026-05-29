#!/usr/bin/env node
/**
 * cycle 50 — form validation a11y 일관성 회귀 가드.
 *
 * 검증:
 *  - 모든 RHF 폼 페이지의 Input/checkbox 가 aria-invalid 속성을 가짐
 *  - 에러 상태일 때 input 의 aria-describedby 가 error <p> 의 id 와 매칭
 *  - error <p> 가 role="alert" + 고유 id 보유
 *
 * 표준 패턴 (LoginPage / ForgotPasswordPage 기준):
 *   <Input aria-invalid="true" aria-describedby="X-error" />
 *   <p id="X-error" role="alert">{message}</p>
 *
 * 사용: node scripts/verify-cycle-50.mjs
 * (dev server localhost:5173 선행 — pnpm dev)
 */

import { chromium } from 'playwright'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173'

/** 점검 대상 페이지 + 잘못된 입력을 submit 했을 때 기대되는 error field id 목록 */
const ROUTES = [
  {
    path: '/login',
    title: '로그인',
    inputs: [
      { selector: '#login-email', errorId: 'login-email-error' },
      { selector: '#login-password', errorId: 'login-password-error' },
    ],
    submit: '로그인',
  },
  {
    path: '/signup',
    title: '회원가입',
    inputs: [
      { selector: '#signup-name', errorId: 'signup-name-error' },
      { selector: '#signup-email', errorId: 'signup-email-error' },
      { selector: '#signup-password', errorId: 'signup-password-error' },
      { selector: '#signup-password-confirm', errorId: 'signup-password-confirm-error' },
    ],
    submit: '가입',
  },
  {
    path: '/forgot-password',
    title: '비밀번호 재설정',
    inputs: [
      { selector: '#forgot-email', errorId: 'forgot-email-error' },
    ],
    submit: '재설정 메일',
  },
]

const browser = await chromium.launch()
const ctx = await browser.newContext({ locale: 'ko-KR' })
const page = await ctx.newPage()

const findings = []

for (const route of ROUTES) {
  console.log(`\n=== ${route.path} (${route.title}) ===`)
  await page.goto(`${BASE}${route.path}`)
  await page.waitForLoadState('networkidle')

  // 빈 폼 submit → validation 강제 발화
  try {
    await page.locator(`button[type="submit"]:has-text("${route.submit}")`).first().click({ trial: false })
  } catch {
    // submit button absent / disabled — ignore, validation 가 다른 경로로 발화될 수 있음
  }
  await page.waitForTimeout(300)

  for (const inp of route.inputs) {
    const el = page.locator(inp.selector)
    if ((await el.count()) === 0) {
      findings.push(`${route.path} ${inp.selector}: NOT FOUND`)
      continue
    }
    const ariaInvalid = await el.getAttribute('aria-invalid')
    const ariaDescribedBy = await el.getAttribute('aria-describedby')
    const errorEl = page.locator(`#${inp.errorId}`)
    const errorCount = await errorEl.count()
    const errorRole = errorCount > 0 ? await errorEl.getAttribute('role') : null
    const ok =
      ariaInvalid === 'true' &&
      ariaDescribedBy === inp.errorId &&
      errorCount === 1 &&
      errorRole === 'alert'
    const mark = ok ? '✓' : '✗'
    console.log(
      `  ${mark} ${inp.selector}: aria-invalid=${ariaInvalid} aria-describedby=${ariaDescribedBy} error#${inp.errorId}=${errorCount > 0 ? `role=${errorRole}` : 'MISSING'}`,
    )
    if (!ok) {
      findings.push(
        `${route.path} ${inp.selector}: aria-invalid=${ariaInvalid} aria-describedby=${ariaDescribedBy} error=${errorCount > 0 ? errorRole : 'missing'}`,
      )
    }
  }
}

await browser.close()

console.log(`\n=== Findings (${findings.length}) ===`)
findings.forEach((f) => console.log(`  ${f}`))
process.exit(findings.length > 0 ? 1 : 0)
