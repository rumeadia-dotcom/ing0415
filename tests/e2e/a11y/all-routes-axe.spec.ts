import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { loginAsSeller } from './_fixtures/login-as-seller'

/**
 * D-A: 14 라우트 axe 0 violation 회귀 E2E (WIP-5markets-mvp.md Phase 4 / 운영 게이트).
 *
 * **목적:**
 *   PRD/user_flow 의 운영 라우트 14개 + 핵심 모달 상태에 대해 `@axe-core/playwright`
 *   를 주입해 WCAG 2.1 AA 위반 0건을 강제한다. testing.md §9.2 와 일치.
 *
 * **본 spec 의 책임 범위 (보수):**
 *   - 회귀 인프라만 제공. 위반이 검출되면 본 spec 이 깨지며, 화면 a11y 픽스는 별도 PR.
 *   - 인증 필요 라우트는 `loginAsSeller` fixture 가 시드 셀러를 주입해야 한다.
 *     현재 시드 미구현이라 해당 케이스들은 `test.fixme` 로 보류 (WIP D 섹션 참고).
 *   - 비인증 4개 라우트 (/login /signup /forgot-password /reset-password) 는 즉시 활성화.
 *
 * **기존 `tests/e2e/a11y.spec.ts` 와의 차이:**
 *   - 기존 파일은 vite preview 의 SPA fallback 한계 우회를 위해 `/` 진입 → 가드 리다이렉트
 *     로 비인증 라우트만 다룬다. 인증 라우트는 무가드 시 /login 으로 튕겨서 의도와 다르게
 *     같은 페이지를 N회 검증하던 약점이 있었다.
 *   - 본 spec 은 (1) 인증 fixture 를 거쳐 실제 보호된 화면에 진입, (2) 동적 라우트의 mock
 *     jobId, (3) 4분기 provider, (4) 모달/Dialog 가 열린 상태 도 별도 케이스로 분리한다.
 *
 * **모달/Dialog 케이스:**
 *   `/markets` 의 `MarketAccountActions` 에 "마켓 연결 해제" Dialog 가 있다.
 *   (task 가 `/markets/connect/coupang` 의 disconnect Dialog 라 했으나 실제 위치는
 *   MarketsListPage 의 행 액션이다 — 본 spec 은 실제 위치를 기준으로 검증.)
 *
 * **WCAG 태그:** wcag2a / wcag2aa / wcag21a / wcag21aa.
 * 경고는 fail (toEqual([])), 정보성 incomplete 는 skip (axe 의 incomplete 는 별도 검증 대상 아님).
 */

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const

/**
 * 페이지 axe 분석 + 위반 0 강제. 위반 발견 시 어떤 규칙·노드가 깨졌는지 메시지로 노출.
 */
async function expectNoAxeViolations(page: Page, label: string): Promise<void> {
  // main / role=main / body 중 하나가 보이면 페이지가 mount 된 것으로 간주.
  await expect(page.locator('main, [role="main"], body').first()).toBeVisible()

  const results = await new AxeBuilder({ page })
    .withTags([...WCAG_TAGS])
    .analyze()

  if (results.violations.length > 0) {
    const summary = results.violations
      .map(
        (v) =>
          `[${v.id}] ${v.help} (impact=${v.impact ?? 'n/a'}, ${v.nodes.length} nodes)\n   help: ${v.helpUrl}`,
      )
      .join('\n')
    throw new Error(`axe violations on ${label}:\n${summary}`)
  }
  expect(results.violations).toEqual([])
}

// ── 1) 비인증 라우트 (4개) — 즉시 활성 ──────────────────────────────────────────
test.describe('a11y: 비인증 라우트 (AuthLayout)', () => {
  const PUBLIC_ROUTES: readonly { path: string; label: string }[] = [
    { path: '/login', label: '/login' },
    { path: '/signup', label: '/signup' },
    { path: '/forgot-password', label: '/forgot-password' },
    { path: '/reset-password', label: '/reset-password' },
  ]

  for (const route of PUBLIC_ROUTES) {
    test(`${route.label} axe violations === 0`, async ({ page }) => {
      // vite preview SPA fallback 미지원 우회: `/` 로 진입 → anonymous 가드가 /login 으로
      // 보냄 → React Router 가 mount 됨 → history.pushState 로 client-side 이동.
      // (각 라우트마다 직접 GET 하면 preview 가 404 를 돌려준다.)
      await page.goto('/')
      await page.waitForURL(/\/login$/)
      if (route.path !== '/login') {
        await page.evaluate((target: string) => {
          window.history.pushState({}, '', target)
          window.dispatchEvent(new PopStateEvent('popstate'))
        }, route.path)
        await page.waitForURL(new RegExp(`${route.path}$`))
      }
      await expectNoAxeViolations(page, route.label)
    })
  }
})

// ── 2) 인증 필요 라우트 (10개) — 시드 미구현이라 보류 ────────────────────────
//
// 시드 셀러 (qa@marketcast.test) 가 두 Supabase 프로젝트에 생성되고 `loginAsSeller`
// 본구현이 끝나는 시점에 본 describe 의 모든 fixme 를 일괄 해제한다 (WIP D 섹션 게이트).
test.describe('a11y: 인증 라우트 (AppLayout) — 시드 셀러 미구현으로 보류', () => {
  test.fixme(
    '/dashboard axe violations === 0',
    async ({ page }) => {
      await loginAsSeller(page)
      await page.goto('/dashboard')
      await expectNoAxeViolations(page, '/dashboard')
    },
  )

  // s3 위저드 (5단계) — index 라우트(/register) 는 ground truth 가 아니므로 제외.
  // PRD/user_flow s3 의 정식 5 step 만 검증.
  const REGISTER_STEPS: readonly string[] = [
    '/register/info',
    '/register/images',
    '/register/markets',
    '/register/preview',
  ]
  for (const path of REGISTER_STEPS) {
    test.fixme(
      `${path} axe violations === 0`,
      async ({ page }) => {
        await loginAsSeller(page)
        await page.goto(path)
        await expectNoAxeViolations(page, path)
      },
    )
  }

  // 동적 라우트 — :jobId 자리. mock UUID 로 진입.
  // 실제 잡 미존재 시 페이지가 빈 상태 / 에러 메시지로 폴백하더라도 axe 검사는 유효.
  const MOCK_JOB_ID = '00000000-0000-4000-8000-000000000001'

  test.fixme(
    `/register/result/:jobId axe violations === 0`,
    async ({ page }) => {
      await loginAsSeller(page)
      await page.goto(`/register/result/${MOCK_JOB_ID}`)
      await expectNoAxeViolations(page, `/register/result/${MOCK_JOB_ID}`)
    },
  )

  test.fixme(
    '/markets axe violations === 0',
    async ({ page }) => {
      await loginAsSeller(page)
      await page.goto('/markets')
      await expectNoAxeViolations(page, '/markets')
    },
  )

  // 4분기 provider (naver / coupang / gmarket / auction) — 각각 별도 케이스.
  // 11st 는 disabled 안내라 별도 검증하지 않음 (회귀 가치 낮음, MARKET_CATALOG.disabled).
  const CONNECT_PROVIDERS: readonly ('naver' | 'coupang' | 'gmarket' | 'auction')[] = [
    'naver',
    'coupang',
    'gmarket',
    'auction',
  ]
  for (const provider of CONNECT_PROVIDERS) {
    test.fixme(
      `/markets/connect/${provider} axe violations === 0`,
      async ({ page }) => {
        await loginAsSeller(page)
        await page.goto(`/markets/connect/${provider}`)
        await expectNoAxeViolations(page, `/markets/connect/${provider}`)
      },
    )
  }

  test.fixme(
    '/history axe violations === 0',
    async ({ page }) => {
      await loginAsSeller(page)
      await page.goto('/history')
      await expectNoAxeViolations(page, '/history')
    },
  )

  test.fixme(
    `/history/:jobId axe violations === 0`,
    async ({ page }) => {
      await loginAsSeller(page)
      await page.goto(`/history/${MOCK_JOB_ID}`)
      await expectNoAxeViolations(page, `/history/${MOCK_JOB_ID}`)
    },
  )
})

// ── 3) 모달/Dialog 상태 — 별도 케이스 ────────────────────────────────────────
//
// Radix Dialog 는 portal 로 body 직속에 렌더되며 focus trap / aria-modal 이 별도 룰을
// 가지므로 닫힌 상태와 열린 상태가 axe 결과가 다를 수 있다. 따라서 별도 케이스로 분리.
test.describe('a11y: 모달/Dialog 열린 상태', () => {
  test.fixme(
    '/markets 의 연결 해제 Dialog 열린 상태 axe violations === 0',
    async ({ page }) => {
      await loginAsSeller(page)
      await page.goto('/markets')
      // 첫 행의 "해제" / "더보기" 액션 트리거 — MarketAccountActions 가 컨텍스트.
      // 정확한 트리거 라벨은 컴포넌트가 본구현 이후 확정되므로 정규식으로 폭넓게 매칭.
      await page.getByRole('button', { name: /연결 해제|해제/ }).first().click()
      // Dialog 가 열리면 마운트된 dialog role 이 visible.
      await expect(page.getByRole('dialog')).toBeVisible()
      await expectNoAxeViolations(page, '/markets [disconnect dialog open]')
    },
  )
})
