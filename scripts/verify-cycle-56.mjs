#!/usr/bin/env node
/**
 * cycle 56 — document.title 회귀 가드 (cycle 30/31 의 후속).
 *
 * 각 라우트 진입 시 document.title 이 default ("MarketCast" 등) 가 아니라 페이지 특화 값으로
 * 갱신되는지 검증.
 *
 * 검증 정책:
 *  - title 이 빈 문자열이면 fail
 *  - title 이 default 와 동일 (페이지 진입 후 갱신 안 됨) 이면 fail
 *  - 페이지 식별 키워드 (예: '로그인', '대시보드') 가 title 에 포함되어야 함
 *
 * 사용: node scripts/verify-cycle-56.mjs (dev server localhost:5173)
 */

import { chromium } from 'playwright'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173'

const ROUTES = [
  { path: '/login', expect: ['로그인'] },
  { path: '/signup', expect: ['회원가입'] },
  { path: '/forgot-password', expect: ['비밀번호'] },
  { path: '/dashboard', expect: ['대시보드'] },
  { path: '/register/info', expect: ['상품', '등록'] },
  { path: '/markets', expect: ['마켓'] },
  { path: '/history', expect: ['이력', '내역', '히스토리'] },
  { path: '/orders/list', expect: ['주문'] },
  { path: '/settings', expect: ['설정'] },
  { path: '/settings/policies', expect: ['배송', '정책'] },
  { path: '/settings/shipping', expect: ['배송'] },
]

const browser = await chromium.launch()
const ctx = await browser.newContext({ locale: 'ko-KR' })
const page = await ctx.newPage()

const findings = []
let defaultTitle = ''

// index.html 의 default title 캡처
await page.goto(`${BASE}/`)
await page.waitForLoadState('networkidle')
defaultTitle = await page.title()
console.log(`default title (index): "${defaultTitle}"`)

for (const route of ROUTES) {
  await page.goto(`${BASE}${route.path}`)
  await page.waitForLoadState('networkidle')
  // useDocumentTitle 의 effect 가 mount 후 실행 — 충분히 대기
  await page.waitForTimeout(300)
  const title = await page.title()
  const ok =
    title.length > 0 &&
    title !== defaultTitle &&
    route.expect.some((kw) => title.includes(kw))
  const mark = ok ? '✓' : '✗'
  console.log(`  ${mark} ${route.path}: "${title}"`)
  if (!ok) {
    findings.push(
      `${route.path}: title="${title}" — expected one of ${JSON.stringify(route.expect)}`,
    )
  }
}

await browser.close()

console.log(`\n=== Findings (${findings.length}) ===`)
findings.forEach((f) => console.log(`  ${f}`))
process.exit(findings.length > 0 ? 1 : 0)
