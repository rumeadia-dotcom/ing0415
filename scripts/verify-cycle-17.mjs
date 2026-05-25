/**
 * Cycle 17 — Form a11y (label association / aria-invalid / aria-describedby).
 *
 * 점검 항목:
 *  17.1  /login + /signup — input 의 label association 100% (htmlFor↔id 또는 aria-labelledby)
 *  17.2  /login 빈 제출 — 에러 발생 후 input 에 aria-invalid="true" + 에러 텍스트와 aria-describedby 연결
 *  17.3  /register/info — 가격 / 재고 / 상품명 input 의 label 연결
 *  17.4  /markets/connect/coupang — secret 입력 필드의 label 및 type=password 마스킹
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-17'
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

async function auditInputs(page) {
  return await page.evaluate(`
    (() => {
      const fields = Array.from(document.querySelectorAll('input, textarea, select'))
      const findings = []
      let totalForm = 0
      let labeled = 0
      let unlabeled = 0
      for (const el of fields) {
        const type = el.getAttribute('type') ?? el.tagName.toLowerCase()
        if (type === 'hidden') continue
        totalForm++
        const id = el.id
        const ariaLabel = el.getAttribute('aria-label')
        const ariaLabelledby = el.getAttribute('aria-labelledby')
        const ariaInvalid = el.getAttribute('aria-invalid')
        const ariaDescribedby = el.getAttribute('aria-describedby')
        const labelFor = id ? document.querySelector('label[for="' + id + '"]') : null
        const wrappingLabel = el.closest('label')
        const hasLabel = !!(labelFor || wrappingLabel || ariaLabel || ariaLabelledby)
        if (hasLabel) labeled++
        else unlabeled++
        findings.push({
          tag: el.tagName.toLowerCase(),
          type,
          id: id || '∅',
          name: el.getAttribute('name') || '∅',
          hasLabel,
          ariaInvalid: ariaInvalid || '∅',
          ariaDescribedby: ariaDescribedby || '∅',
          labelText: (labelFor?.textContent || ariaLabel || (ariaLabelledby ? document.getElementById(ariaLabelledby)?.textContent : '') || '').trim().slice(0, 30),
        })
      }
      return { totalForm, labeled, unlabeled, findings }
    })()
  `)
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})

try {
  // 17.1 /login 라벨 연결
  log('\n══════════ 17.1 /login form 라벨 연결 ══════════')
  const ctx1 = await browser.newContext()
  const page1 = await ctx1.newPage()
  await page1.goto(`${BASE}/login`)
  await page1.waitForLoadState('networkidle')
  const a1 = await auditInputs(page1)
  log(`  /login — 총 ${a1.totalForm}개 / 라벨 ${a1.labeled}개 / 라벨 누락 ${a1.unlabeled}개`)
  for (const f of a1.findings) {
    log(`    ${f.tag}[type=${f.type}] id=${f.id} name=${f.name} → label="${f.labelText}" ${f.hasLabel ? '✓' : '⚠ 누락'}`)
  }
  await ctx1.close()

  // 17.2 /login 빈 제출 후 aria-invalid 확인
  log('\n══════════ 17.2 /login 빈 제출 후 aria-invalid 검증 ══════════')
  const ctx2 = await browser.newContext()
  const page2 = await ctx2.newPage()
  await page2.goto(`${BASE}/login`)
  await page2.waitForLoadState('networkidle')
  await page2
    .locator('button[type="submit"]')
    .filter({ hasText: /^로그인$/ })
    .first()
    .click()
  await page2.waitForTimeout(800)
  const a2 = await auditInputs(page2)
  log(`  /login(empty submit) — 총 ${a2.totalForm} / 라벨 ${a2.labeled}`)
  for (const f of a2.findings) {
    log(`    ${f.tag}[type=${f.type}] id=${f.id} aria-invalid=${f.ariaInvalid} aria-describedby=${f.ariaDescribedby}`)
  }
  // 에러 메시지 노출 여부
  const errCount2 = await page2.locator('[role="alert"], .text-danger, .text-destructive').count()
  log(`  에러 메시지(role=alert/text-danger) 노출 수: ${errCount2}`)
  await ctx2.close()

  // 17.3 /signup 폼 라벨 연결
  log('\n══════════ 17.3 /signup form 라벨 연결 ══════════')
  const ctx3 = await browser.newContext()
  const page3 = await ctx3.newPage()
  await page3.goto(`${BASE}/signup`)
  await page3.waitForLoadState('networkidle')
  const a3 = await auditInputs(page3)
  log(`  /signup — 총 ${a3.totalForm}개 / 라벨 ${a3.labeled}개 / 라벨 누락 ${a3.unlabeled}개`)
  for (const f of a3.findings) {
    log(`    ${f.tag}[type=${f.type}] id=${f.id} name=${f.name} → label="${f.labelText}" ${f.hasLabel ? '✓' : '⚠ 누락'}`)
  }
  await ctx3.close()

  // 17.4 /register/info 폼 라벨 연결
  log('\n══════════ 17.4 /register/info form 라벨 연결 ══════════')
  const ctx4 = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page4 = await ctx4.newPage()
  await loginMock(page4)
  await page4.goto(`${BASE}/register/info`)
  await page4.waitForLoadState('networkidle')
  await page4.waitForTimeout(1500)
  const a4 = await auditInputs(page4)
  log(`  /register/info — 총 ${a4.totalForm}개 / 라벨 ${a4.labeled}개 / 라벨 누락 ${a4.unlabeled}개`)
  for (const f of a4.findings.slice(0, 20)) {
    log(`    ${f.tag}[type=${f.type}] id=${f.id} name=${f.name} → label="${f.labelText}" ${f.hasLabel ? '✓' : '⚠ 누락'}`)
  }
  await ctx4.close()

  // 17.5 /markets/connect/coupang — 시크릿 필드 마스킹 검증
  log('\n══════════ 17.5 /markets/connect/coupang 시크릿 입력 마스킹 ══════════')
  const ctx5 = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page5 = await ctx5.newPage()
  await loginMock(page5)
  await page5.goto(`${BASE}/markets/connect/coupang`)
  await page5.waitForLoadState('networkidle')
  await page5.waitForTimeout(1500)
  const a5 = await auditInputs(page5)
  log(`  /markets/connect/coupang — 총 ${a5.totalForm}개 / 라벨 ${a5.labeled}개 / 라벨 누락 ${a5.unlabeled}개`)
  for (const f of a5.findings) {
    const isSecret =
      /secret|api[_-]?key|password|jwt/i.test(f.name) ||
      /secret|api[_-]?key|password|jwt/i.test(f.id) ||
      /secret|api[_-]?key|password|jwt/i.test(f.labelText.toLowerCase())
    const ok = !isSecret || f.type === 'password'
    log(`    ${f.tag}[type=${f.type}] id=${f.id} → "${f.labelText}" ${ok ? '✓' : '⚠ 시크릿인데 type=password 아님'}`)
  }
  await ctx5.close()
} catch (e) {
  log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  await browser.close()
}
