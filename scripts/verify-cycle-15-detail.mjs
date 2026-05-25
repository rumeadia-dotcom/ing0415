import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const ROUTE = process.env.ROUTE ?? 'orders/list'

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
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()
await loginMock(page)
await page.goto(`${BASE}/${ROUTE}`)
await page.waitForLoadState('networkidle')
await page.waitForTimeout(2500)
const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  .analyze()

for (const v of results.violations) {
  console.log(`\n=== ${v.id} [${v.impact}] ${v.help} ===`)
  console.log(`URL: ${v.helpUrl}`)
  for (const n of v.nodes.slice(0, 5)) {
    console.log(`  selector: ${n.target.join(' > ')}`)
    console.log(`  html: ${(n.html ?? '').slice(0, 200)}`)
    if (n.any?.[0]?.message) console.log(`  msg: ${n.any[0].message}`)
  }
}

await browser.close()
