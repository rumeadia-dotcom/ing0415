/**
 * Cycle 31 — cycle 30 follow-up: PageHeader 미사용 페이지의 document.title.
 *
 * 검증 라우트:
 *  /login           → "로그인 · MarketCast"
 *  /signup          → "회원가입 · MarketCast"
 *  /forgot-password → "비밀번호 찾기 · MarketCast"
 *  /reset-password  → "비밀번호 재설정 · MarketCast"
 *  /legal/terms     → "이용약관 · MarketCast"
 *  /legal/privacy   → "개인정보처리방침 · MarketCast"
 *  /manual          → "매뉴얼 · MarketCast"
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-31'
await mkdir(OUT, { recursive: true })

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})

const ROUTES = [
  { path: 'login', expect: /로그인/ },
  { path: 'signup', expect: /회원가입/ },
  { path: 'forgot-password', expect: /비밀번호 찾기/ },
  { path: 'reset-password', expect: /비밀번호 재설정/ },
  { path: 'legal/terms', expect: /이용약관/ },
  { path: 'legal/privacy', expect: /개인정보처리방침/ },
  { path: 'manual', expect: /매뉴얼/ },
]

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()

  console.log('\n══════════ 31.1 unauth + legal 페이지 <title> ══════════')
  for (const r of ROUTES) {
    await page.goto(`${BASE}/${r.path}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(600)
    const title = await page.title()
    const ok = r.expect.test(title) && /MarketCast/.test(title)
    console.log(`  /${r.path} → "${title}" ${ok ? '✓' : '⚠ 기대 패턴 미일치'}`)
  }
  await ctx.close()
} catch (e) {
  console.log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  await browser.close()
}
