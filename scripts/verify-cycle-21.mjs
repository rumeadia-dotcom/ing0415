/**
 * Cycle 21 — Skip-link + landmark navigation (WCAG 2.4.1 Bypass Blocks).
 *
 * 점검 항목:
 *  21.1  /dashboard 첫 Tab → skip-link 가 시각적으로 노출 + role / target 정합
 *  21.2  skip-link 클릭(Enter) → <main id="app-main"> 으로 포커스 이동 (스킵 동작)
 *  21.3  /dashboard 의 landmark 구조 (header / nav / main / footer) enumerate
 *  21.4  /login 등 unauthenticated 페이지 — main 또는 동등 landmark 확인
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-21'
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
  // 21.1 /dashboard 첫 Tab → skip-link 시각 노출
  log('\n══════════ 21.1 /dashboard 첫 Tab → skip-link ══════════')
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await loginMock(page)
  await page.goto(`${BASE}/dashboard`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)

  // body 에 포커스 두고 Tab
  await page.evaluate(`document.body.focus()`)
  await page.keyboard.press('Tab')
  await page.waitForTimeout(300)
  const skipFocus = await page.evaluate(`
    (() => {
      const ae = document.activeElement
      if (!ae) return { tag: 'null', text: '', href: '', visible: false }
      const rect = ae.getBoundingClientRect()
      return {
        tag: ae.tagName.toLowerCase(),
        text: (ae.textContent || '').trim().slice(0, 40),
        href: ae.getAttribute('href') || '',
        visible: rect.width > 0 && rect.height > 0 && rect.top >= 0,
      }
    })()
  `)
  log(`  첫 Tab 후 active element: <${skipFocus.tag}> "${skipFocus.text}" href="${skipFocus.href}"`)
  log(`  시각적으로 화면 안에 노출: ${skipFocus.visible ? '✓' : '⚠ off-screen (skip-link 없음)'}`)
  const isSkip = skipFocus.tag === 'a' && /본문|건너뛰기|skip/i.test(skipFocus.text) && skipFocus.href.startsWith('#')
  log(`  skip-link 패턴: ${isSkip ? '✓' : '⚠ skip-link 아닌 다른 element'}`)

  // 21.2 Enter → main 으로 점프
  if (isSkip) {
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
    const after = await page.evaluate(`
      (() => {
        const ae = document.activeElement
        if (!ae) return { tag: 'null', id: '', text: '' }
        return {
          tag: ae.tagName.toLowerCase(),
          id: ae.id || '',
          text: (ae.textContent || '').trim().slice(0, 40),
        }
      })()
    `)
    log(`  Enter 후 active element: <${after.tag} id="${after.id}"> "${after.text}"`)
    const jumped = after.tag === 'main' && after.id === 'app-main'
    log(`  본문 main 으로 점프: ${jumped ? '✓' : '⚠ 다른 element'}`)
  }

  // 21.3 landmark 구조
  log('\n══════════ 21.3 /dashboard landmark 구조 ══════════')
  const landmarks = await page.evaluate(`
    (() => {
      const items = []
      for (const sel of ['header', 'nav', 'main', 'footer', 'aside', '[role="banner"]', '[role="navigation"]', '[role="main"]', '[role="contentinfo"]']) {
        const els = document.querySelectorAll(sel)
        for (const el of els) {
          items.push({
            tag: el.tagName.toLowerCase(),
            role: el.getAttribute('role') || '',
            id: el.id || '',
            label: el.getAttribute('aria-label') || '',
          })
        }
      }
      return items
    })()
  `)
  log(`  landmark 발견 수: ${landmarks.length}`)
  for (const lm of landmarks) {
    log(`    <${lm.tag}${lm.role ? ` role="${lm.role}"` : ''}${lm.id ? ` id="${lm.id}"` : ''}${lm.label ? ` aria-label="${lm.label}"` : ''}>`)
  }
  // main 정확히 1개
  const mainCount = landmarks.filter((l) => l.tag === 'main' || l.role === 'main').length
  log(`  <main> 또는 role=main 개수: ${mainCount} ${mainCount === 1 ? '✓' : '⚠ 1개 권장'}`)

  // 21.4 /login (unauthenticated) main landmark
  log('\n══════════ 21.4 /login landmark ══════════')
  // 로그아웃 후 /login 진입 — 단순히 직접 가서 main 있는지 확인
  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  const loginLandmarks = await page.evaluate(`
    (() => {
      const items = []
      for (const sel of ['main', '[role="main"]']) {
        for (const el of document.querySelectorAll(sel)) {
          items.push({ tag: el.tagName.toLowerCase(), role: el.getAttribute('role') || '', id: el.id || '' })
        }
      }
      return items
    })()
  `)
  log(`  /login main 개수: ${loginLandmarks.length}`)
  for (const lm of loginLandmarks) log(`    <${lm.tag}${lm.role ? ` role="${lm.role}"` : ''}${lm.id ? ` id="${lm.id}"` : ''}>`)
  await ctx.close()
} catch (e) {
  log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  await browser.close()
}
