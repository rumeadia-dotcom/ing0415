/**
 * Cycle 23 — i18n leak (한국어 UI 안 영어 잔존 텍스트).
 *
 * 점검 항목:
 *  23.1 /dashboard, /markets, /orders/list, /history, /settings 의 visible text 에서 영어 단어 / 문장 enumerate
 *  23.2 placeholder / aria-label / title 속성 영어 잔존
 *
 * 단, 다음은 정상 허용 (whitelist):
 *  - 도메인 약어: HTML / CSV / OAuth / API / Vendor ID / Access Key / Secret Key / JWT / HMAC / WCAG / KPI / SaaS / MAU / NPS
 *  - 마켓 ID 영문: naver / coupang / gmarket / auction / 11st / G마켓
 *  - 브랜드: MarketCast / Manrope / JetBrains / Pretendard / Sentry / Supabase / PostgreSQL / Postgres
 *  - 디자인: Studio / Tailwind / OKLCH / Vite / TypeScript
 *  - 단순 단어: v1 / v2 / OK / yes / no
 *  - placeholder 의 단위: KRW / 원 / px
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const OUT = './verify-out/cycle-23'
await mkdir(OUT, { recursive: true })

const findings = []
function log(line) {
  console.log(line)
  findings.push(line)
}

// 도메인 / 브랜드 / 약어 whitelist
const WHITELIST = [
  // 약어
  'HTML', 'CSS', 'JS', 'CSV', 'OAuth', 'API', 'JWT', 'HMAC', 'WCAG', 'KPI', 'SaaS', 'MAU', 'NPS', 'UI', 'UX', 'PR', 'PRD', 'QA', 'CI', 'CD', 'CTA', 'SR',
  'Vendor', 'ID', 'Access', 'Key', 'Secret', 'Token', 'URL', 'URI', 'UUID', 'IP', 'TLS', 'HTTPS', 'HTTP', 'JSON', 'XML', 'SVG', 'PNG', 'JPG', 'WebP',
  // 마켓
  'naver', 'coupang', 'gmarket', 'auction', '11st', 'G마켓', 'Naver', 'Coupang', 'Gmarket', 'Auction',
  // 브랜드
  'MarketCast', 'Manrope', 'JetBrains', 'Mono', 'Pretendard', 'Sentry', 'Supabase', 'Postgres', 'PostgreSQL', 'Lightsail', 'GitHub', 'AWS',
  // 디자인
  'Studio', 'Tailwind', 'OKLCH', 'OKLab', 'RGB', 'HEX', 'Vite', 'TypeScript', 'React',
  // 단위 / 수치
  'KRW', 'USD', 'EUR', 'JPY', 'GB', 'MB', 'KB', 'B', 'kg', 'g', 'cm', 'mm', 'px',
  // 기타 빈도 단어
  'v1', 'v2', 'v3', 'OK', 'no', 'yes', 'mock', 'm', 's', 'h', 'd', 'w', 'M', 'F', 'T', 'alt', 'Alt', 'Ctrl', 'Shift', 'Enter', 'Tab', 'Esc',
]

function findEnglish(text) {
  // 영어 단어/문장 (2글자 이상) 매칭
  const matches = text.match(/[A-Za-z]{2,}(?:[ '-][A-Za-z]+)*/g) ?? []
  return matches.filter((m) => {
    // whitelist 에 포함되는 모든 토큰은 제외
    const tokens = m.split(/[\s'-]+/)
    return !tokens.every((t) => WHITELIST.includes(t))
  })
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

async function captureVisibleText(page) {
  return await page.evaluate(`
    (() => {
      const out = []
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT
          const parent = node.parentElement
          if (!parent) return NodeFilter.FILTER_REJECT
          // hidden / script / style 등 제외
          const tag = parent.tagName.toLowerCase()
          if (['script', 'style', 'noscript'].includes(tag)) return NodeFilter.FILTER_REJECT
          // sr-only 도 점검 대상 — SR 사용자에게 영어 노출되면 같은 문제
          // hidden inputs 의 텍스트는 없을 것 — 통과
          return NodeFilter.FILTER_ACCEPT
        },
      })
      let n
      while ((n = walker.nextNode())) {
        const text = n.textContent.trim()
        if (text) out.push(text)
      }
      return out
    })()
  `)
}

async function capturePlaceholders(page) {
  return await page.evaluate(`
    (() => {
      const out = []
      for (const el of document.querySelectorAll('input[placeholder], textarea[placeholder]')) {
        const p = el.getAttribute('placeholder')
        if (p) out.push({ kind: 'placeholder', text: p })
      }
      for (const el of document.querySelectorAll('[aria-label], [title]')) {
        const a = el.getAttribute('aria-label')
        const t = el.getAttribute('title')
        if (a) out.push({ kind: 'aria-label', text: a })
        if (t) out.push({ kind: 'title', text: t })
      }
      return out
    })()
  `)
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})

const ROUTES = ['dashboard', 'markets', 'orders/list', 'history', 'settings']

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await loginMock(page)

  for (const r of ROUTES) {
    log(`\n══════════ /${r} ══════════`)
    await page.goto(`${BASE}/${r}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    const texts = await captureVisibleText(page)
    const attrs = await capturePlaceholders(page)

    const englishHits = []
    for (const t of texts) {
      const hits = findEnglish(t)
      if (hits.length > 0) englishHits.push({ text: t, hits })
    }
    log(`  visible text 노드 ${texts.length}개 / 영어 잔존 의심 ${englishHits.length}건`)
    for (const h of englishHits.slice(0, 15)) {
      log(`    "${h.text.slice(0, 80)}" → ${h.hits.join(' / ')}`)
    }
    if (englishHits.length > 15) log(`    … (+${englishHits.length - 15}건 생략)`)

    const attrHits = []
    for (const a of attrs) {
      const hits = findEnglish(a.text)
      if (hits.length > 0) attrHits.push({ ...a, hits })
    }
    log(`  attribute(placeholder/aria-label/title) ${attrs.length}개 / 영어 잔존 의심 ${attrHits.length}건`)
    for (const h of attrHits.slice(0, 10)) {
      log(`    [${h.kind}] "${h.text.slice(0, 60)}" → ${h.hits.join(' / ')}`)
    }
    if (attrHits.length > 10) log(`    … (+${attrHits.length - 10}건 생략)`)
  }
  await ctx.close()
} catch (e) {
  log(`\n❌ FATAL: ${e?.message ?? e}`)
} finally {
  await browser.close()
}
