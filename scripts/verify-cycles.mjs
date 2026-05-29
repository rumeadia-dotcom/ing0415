/**
 * Cycle 1-5 mock walkthrough driver.
 *
 * 마스터: scripts/verify-mock-flow.mjs (기본 driver) 의 확장.
 *
 * 5 사이클:
 *  - cycle 1: 인터랙티브 (forms / buttons / dialogs)
 *  - cycle 2: 반응형 (viewport 768 / 375 mobile)
 *  - cycle 3: 다크 모드 토글
 *  - cycle 4: 데이터 페이지 quality (mock data quality 점검)
 *  - cycle 5: register 5단계 wizard 끝까지 driving
 */

import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycles'
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
  // submit btn — ko.auth.login.submit = '로그인'
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
    pageErrors.push(`[${page.url()}] ${err.message.slice(0, 200)}`),
  )
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('CERT_AUTHORITY')) {
      pageErrors.push(`[${page.url()}] console.error: ${msg.text().slice(0, 200)}`)
    }
  })
  return { context, page }
}

try {
  // ============================================================
  // Cycle 1 — 인터랙티브 (forms / buttons / dialogs)
  // ============================================================
  log('\n══════════ Cycle 1 — 인터랙티브 (forms / buttons / dialogs) ══════════')

  // 1.1 signup 폼 입력 → submit
  {
    log('\n1.1 signup 폼 입력 → submit')
    const { context, page } = await newCtx()
    await page.goto(`${BASE}/signup`)
    await page.waitForLoadState('networkidle')
    const emailInput = page.getByRole('textbox', { name: '이메일' })
    const emailCnt = await emailInput.count()
    log(`  이메일 textbox: ${emailCnt}`)
    if (emailCnt > 0) await emailInput.first().fill('newuser@example.com')
    const pwdInputs = page.locator('input[type="password"]')
    const pwdCnt = await pwdInputs.count()
    log(`  password input: ${pwdCnt}`)
    if (pwdCnt >= 1) await pwdInputs.first().fill('Password123!')
    if (pwdCnt >= 2) await pwdInputs.nth(1).fill('Password123!')
    // 닉네임/이름
    const nameField = page.getByRole('textbox', { name: /이름|닉네임|성함|표시/ })
    if ((await nameField.count()) > 0) await nameField.first().fill('Test User')
    const termsCheckboxes = await page.locator('input[type="checkbox"]').count()
    log(`  체크박스 ${termsCheckboxes}개 발견 — 전부 체크`)
    for (let i = 0; i < termsCheckboxes; i++) {
      await page.locator('input[type="checkbox"]').nth(i).check({ force: true }).catch(() => { /* ignore */ })
    }
    await shot(page, 'c1-01-signup-filled')
    const signupBtn = page.getByRole('button', { name: /^(가입|회원가입|계정 만들기|시작)/ }).first()
    if ((await signupBtn.count()) > 0) {
      await signupBtn.click()
      await page.waitForTimeout(2000)
      log(`  after click → ${new URL(page.url()).pathname}`)
      const inviteText = (await page.locator('body').textContent()) ?? ''
      log(`  body keyword: ${inviteText.includes('이메일') && inviteText.includes('인증') ? '이메일 인증 안내' : '미상'}`)
    }
    await shot(page, 'c1-02-after-signup')
    await context.close()
  }

  // 1.2 forgot-password
  {
    log('\n1.2 /forgot-password 이메일 입력 → submit')
    const { context, page } = await newCtx()
    await page.goto(`${BASE}/forgot-password`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('textbox').first().fill('reset@example.com')
    const sendBtn = page.getByRole('button', { name: /발송|보내|재설정|전송/ }).first()
    if ((await sendBtn.count()) > 0) await sendBtn.click()
    await page.waitForTimeout(1500)
    const afterForgot = (await page.locator('body').textContent()) ?? ''
    log(`  성공/안내 메시지 키워드 표시: ${afterForgot.includes('발송') || afterForgot.includes('전송') || afterForgot.includes('확인') ? 'Yes' : 'No'}`)
    await shot(page, 'c1-03-forgot-password-sent')
    await context.close()
  }

  // 1.3 로그인 → settings → 로그아웃
  {
    log('\n1.3 settings → 로그아웃 dialog 확인')
    const { context, page } = await newCtx()
    await loginMock(page)
    await page.goto(`${BASE}/settings`)
    await page.waitForLoadState('networkidle')
    const logoutBtn = page.getByRole('button', { name: /로그아웃/ })
    const logoutCnt = await logoutBtn.count()
    log(`  로그아웃 버튼: ${logoutCnt}개`)
    if (logoutCnt > 0) {
      await logoutBtn.first().click()
      await page.waitForTimeout(800)
      await shot(page, 'c1-04-logout-dialog')
      const confirmBtn = page.getByRole('button', { name: /확인|로그아웃/ }).last()
      if ((await confirmBtn.count()) > 0) {
        await confirmBtn.click({ timeout: 3000 }).catch(() => { /* ignore */ })
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => { /* ignore */ })
        log(`  after confirm → ${new URL(page.url()).pathname}`)
        await shot(page, 'c1-05-after-logout')
      }
    }
    await context.close()
  }

  // ============================================================
  // Cycle 2 — 반응형 (모바일 viewport)
  // ============================================================
  log('\n══════════ Cycle 2 — 반응형 (모바일 768 / 375) ══════════')
  for (const [w, h, label] of [[768, 1024, 'tablet'], [375, 812, 'mobile']]) {
    const { context, page } = await newCtx({ width: w, height: h })
    log(`\n2.${label === 'tablet' ? '1' : '2'} viewport ${w}×${h} (${label})`)
    await loginMock(page)
    for (const [route, name] of [
      ['dashboard', 'dashboard'],
      ['markets', 'markets'],
      ['markets/connect', 'markets-connect'],
      ['register/info', 'register-info'],
      ['orders/list', 'orders-list'],
      ['shipping/dispatch', 'shipping-dispatch'],
      ['settings', 'settings'],
    ]) {
      await page.goto(`${BASE}/${route}`)
      await page.waitForLoadState('networkidle', { timeout: 10000 })
      await shot(page, `c2-${label}-${name}`)
    }
    await context.close()
  }

  // ============================================================
  // Cycle 3 — 다크 모드 토글
  // ============================================================
  log('\n══════════ Cycle 3 — 다크 모드 토글 ══════════')
  {
    const { context, page } = await newCtx()
    await loginMock(page)
    await page.goto(`${BASE}/settings`)
    await page.waitForLoadState('networkidle')
    // theme toggle 찾기 (라이트/다크/시스템 3 state)
    const themeBtn = page.getByRole('button', { name: /다크|테마|어둡|어두/ })
    const themeBtnCnt = await themeBtn.count()
    log(`  theme 토글 버튼: ${themeBtnCnt}개`)
    if (themeBtnCnt > 0) {
      await themeBtn.first().click()
      await page.waitForTimeout(500)
      await shot(page, 'c3-01-settings-dark')
      await page.goto(`${BASE}/dashboard`)
      await page.waitForLoadState('networkidle')
      await shot(page, 'c3-02-dashboard-dark')
      await page.goto(`${BASE}/markets`)
      await page.waitForLoadState('networkidle')
      await shot(page, 'c3-03-markets-dark')
    } else {
      log('  ⚠ theme 토글 버튼 못찾음 — HTML 직접 검사')
      // html data-theme 직접 토글 (page.evaluate 인자는 browser 컨텍스트)
      await page.evaluate(`document.documentElement.setAttribute('data-theme', 'dark')`)
      await page.waitForTimeout(500)
      await shot(page, 'c3-01-html-theme-dark')
    }
    await context.close()
  }

  // ============================================================
  // Cycle 4 — 데이터 페이지 quality
  // ============================================================
  log('\n══════════ Cycle 4 — 데이터 페이지 quality ══════════')
  {
    const { context, page } = await newCtx()
    await loginMock(page)
    for (const [route, name] of [
      ['shipping/print', 'shipping-print'],
      ['shipping/history', 'shipping-history'],
      ['orders/list', 'orders-list'],
      ['settings/policies', 'settings-policies'],
      ['settings/shipping/logen', 'settings-shipping-logen'],
      ['settings/shipping/sender', 'settings-shipping-sender'],
    ]) {
      await page.goto(`${BASE}/${route}`)
      await page.waitForLoadState('networkidle', { timeout: 10000 })
      const bodyText = (await page.locator('body').textContent()) ?? ''
      const isEmpty = bodyText.includes('데이터 없음') || bodyText.includes('아직 없음') || bodyText.length < 200
      log(`  ${route} body length=${bodyText.length} ${isEmpty ? '⚠ 빈 페이지?' : 'OK'}`)
      await shot(page, `c4-${name}`)
    }
    await context.close()
  }

  // ============================================================
  // Cycle 5 — register 5단계 wizard 끝까지
  // ============================================================
  log('\n══════════ Cycle 5 — register 5단계 wizard 끝까지 ══════════')
  {
    const { context, page } = await newCtx()
    await loginMock(page)

    log('\n5.1 step1 /register/info — 상품명·가격·카테고리·배송정책 입력')
    await page.goto(`${BASE}/register/info`)
    await page.waitForLoadState('networkidle')
    // 상품명
    await page.getByLabel(/상품명/).first().fill('Mock 테스트 상품 — 5단계 진행').catch(() => { /* ignore */ })
    // 가격 (첫 input[type=number])
    const priceInputs = page.locator('input[type="number"]')
    const priceCnt = await priceInputs.count()
    log(`  number input ${priceCnt}개 — 첫 input 에 19900 입력`)
    if (priceCnt > 0) await priceInputs.first().fill('19900')
    // 브랜드
    await page.getByLabel(/브랜드/).first().fill('mockbrand').catch(() => { /* ignore */ })
    // 내부 카테고리
    await page.getByLabel(/카테고리/).first().fill('전자 > 음향').catch(() => { /* ignore */ })
    // 배송정책 dropdown — 첫 option 선택
    const policySelect = page.locator('select#info-shipping')
    const policyOptions = await policySelect.locator('option').allTextContents()
    log(`  배송정책 옵션: ${policyOptions.slice(1, 4).join(', ')}`)
    if (policyOptions.length > 1) {
      // 첫 비-placeholder option (index 1) 의 value 선택
      const firstPolicyValue = await policySelect.locator('option').nth(1).getAttribute('value')
      if (firstPolicyValue) {
        await policySelect.selectOption(firstPolicyValue)
        log(`  배송정책 선택 value=${firstPolicyValue.slice(0, 12)}…`)
      }
    }
    await page.waitForTimeout(500)
    await shot(page, 'c5-01-step1-filled')

    // 다음 버튼 — 활성 여부 확인 + 클릭
    const nextBtn = page.getByRole('button', { name: /다음.*이미지|다음/ }).first()
    const nextBtnCnt = await nextBtn.count()
    const nextBtnDisabled = nextBtnCnt > 0 ? await nextBtn.isDisabled() : true
    log(`  다음 버튼 ${nextBtnCnt}개 / disabled=${nextBtnDisabled}`)
    if (nextBtnCnt > 0 && !nextBtnDisabled) {
      await nextBtn.click({ timeout: 5000 }).catch((e) => log(`  next click err: ${e.message.slice(0, 100)}`))
      await page.waitForTimeout(2000)
      log(`  step1 → ${new URL(page.url()).pathname}`)
      await shot(page, 'c5-02-after-step1-next')
    }

    log('\n5.2 step2 /register/images — 이미지 업로드 화면 진입')
    await page.goto(`${BASE}/register/images`)
    await page.waitForLoadState('networkidle')
    const onImagesStep = page.url().includes('/images')
    log(`  /register/images 에 있는가? ${onImagesStep}`)
    await shot(page, 'c5-03-step2-images')

    log('\n5.3 step3 /register/markets — 마켓 선택')
    await page.goto(`${BASE}/register/markets`)
    await page.waitForLoadState('networkidle')
    await shot(page, 'c5-04-step3-markets')

    log('\n5.4 step4 /register/preview — 미리보기')
    await page.goto(`${BASE}/register/preview`)
    await page.waitForLoadState('networkidle')
    await shot(page, 'c5-05-step4-preview')

    log('\n5.5 step5 /register/result/:jobId — 결과 (mock jobId)')
    // mockRegistrationJobs[0].id = '00000000-0000-4000-8000-000000003001'
    await page.goto(`${BASE}/register/result/00000000-0000-4000-8000-000000003001`)
    await page.waitForLoadState('networkidle')
    await shot(page, 'c5-06-step5-result')

    await context.close()
  }

  log('\n══════════ ✅ 5 사이클 완료 ══════════')
} catch (e) {
  log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  if (pageErrors.length > 0) {
    log(`\n──── pageerror / console.error 합계 ${pageErrors.length}건 ────`)
    for (const e of pageErrors.slice(0, 40)) log(`  ${e}`)
  }
  await browser.close()
}
