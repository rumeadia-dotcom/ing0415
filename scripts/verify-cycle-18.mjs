/**
 * Cycle 18 — Wizard route guard + reload 거동.
 *
 * 점검 항목:
 *  18.1  /register/images 직접 진입 — info 미완 상태에서 guard 동작 확인
 *  18.2  /register/markets 직접 진입 — info 미완 상태에서 guard 동작 확인
 *  18.3  /register/preview 직접 진입 — info 미완 상태에서 guard 동작 확인
 *  18.4  /register/info 입력 후 page reload — state 유실 확인 (현재 store 비-persist 명세)
 *  18.5  /register/result/:jobId 잘못된 UUID 직접 진입 — guard / 에러 처리 확인
 *
 * 18.1~18.3 은 router level 의 wizard guard 유무를 본다.
 * RHF 입력 → store sync 는 submit 완료 후 일어나므로 (input → store 즉시 sync 아님),
 * 단순 input fill 후 navigate 검증은 의미 없음 — 본 사이클은 guard 만 본다.
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-18'
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

async function checkGuard(page, label, targetPath, expectInfoRedirect = true) {
  await page.goto(`${BASE}${targetPath}`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  const finalPath = new URL(page.url()).pathname
  const redirected = finalPath !== targetPath
  log(`  ${label} (target=${targetPath}) → 최종 URL=${finalPath}`)
  if (expectInfoRedirect) {
    if (redirected && finalPath.includes('/register/info')) {
      log(`    ✓ /register/info 로 guard 적용`)
    } else if (redirected) {
      log(`    △ guard 는 적용되었으나 info 아닌 ${finalPath} 로 이동`)
    } else {
      log(`    ⚠ guard 없음: ${targetPath} 직접 진입 가능`)
    }
  }
  return { finalPath, redirected }
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})

try {
  log('\n══════════ 18.1~18.3 wizard step guard 검증 (info 건너뜀) ══════════')
  const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page1 = await ctx1.newPage()
  await loginMock(page1)
  await checkGuard(page1, '18.1 /register/images', '/register/images')
  await checkGuard(page1, '18.2 /register/markets', '/register/markets')
  await checkGuard(page1, '18.3 /register/preview', '/register/preview')
  await ctx1.close()

  // 18.4 — /register/info 입력 후 reload — store 유실 확인 (명세)
  log('\n══════════ 18.4 /register/info 입력 후 reload ══════════')
  const ctx4 = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page4 = await ctx4.newPage()
  await loginMock(page4)
  await page4.goto(`${BASE}/register/info`)
  await page4.waitForLoadState('networkidle')
  await page4.waitForTimeout(1500)
  await page4.locator('input#info-name').fill('Cycle 18 reload 테스트')
  await page4.locator('input#info-price').fill('19900')
  await page4.locator('input#info-brand').fill('Test')
  await page4.waitForTimeout(300)
  await page4.reload()
  await page4.waitForLoadState('networkidle')
  await page4.waitForTimeout(1500)
  const r4Name = await page4.locator('input#info-name').inputValue().catch(() => '')
  log(`  reload 후 input#info-name = "${r4Name}"`)
  log(`  ${r4Name === '' ? '✓ 명세대로 유실 (draft persistence v2 백로그)' : '⚠ 의도치 않게 persistence 작동 중 — 검토 필요'}`)
  await ctx4.close()

  // 18.5 — /register/result/:jobId 잘못된 UUID 진입
  log('\n══════════ 18.5 /register/result/:jobId 잘못된 UUID ══════════')
  const ctx5 = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page5 = await ctx5.newPage()
  await loginMock(page5)
  const badId = 'not-a-uuid'
  await page5.goto(`${BASE}/register/result/${badId}`)
  await page5.waitForLoadState('networkidle')
  await page5.waitForTimeout(2000)
  const path5 = new URL(page5.url()).pathname
  log(`  진입 URL: /register/result/${badId} → 최종 URL: ${path5}`)
  // 오류 / 없음 / 404 안내 노출 여부
  const err5 = await page5.locator('text=/찾을 수 없|존재하지 않|잘못된|유효하지|invalid|만료/i').count()
  log(`  에러/안내 텍스트 매칭 수: ${err5}`)
  if (err5 === 0 && path5.endsWith(`/${badId}`)) {
    await page5.screenshot({ path: `${OUT}/18.5-bad-result-id.png`, fullPage: true })
    log(`    ⚠ 안내 없이 빈 페이지 — 스크린샷: ${OUT}/18.5-bad-result-id.png`)
  }
  await ctx5.close()
} catch (e) {
  log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  await browser.close()
}
