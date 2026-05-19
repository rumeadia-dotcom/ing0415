import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * 접근성 회귀 (testing.md §9.2).
 *
 * 모든 라우트 1회 이상 axe `violations.length === 0` 강제.
 * 현재는 Stage C placeholder 상태이므로 통과 보장. Stage D 이후 폼/액션이 들어오면 깨질 수 있음 → 즉시 수정.
 *
 * 본 파일에 새 라우트 추가 시 작성자가 함께 갱신 (R-009).
 */

const ROUTES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/dashboard',
  '/markets',
  '/markets/connect',
  '/register',
  '/register/info',
  '/register/images',
  '/register/markets',
  '/register/categories',
  '/register/preview',
  '/history',
] as const

for (const route of ROUTES) {
  test(`a11y: ${route} 라우트 axe violations === 0`, async ({ page }) => {
    await page.goto(route)
    // 페이지 콘텐츠가 로드될 시간을 expect 폴링으로 대기 (waitForTimeout 금지).
    await expect(page.locator('main, [role="main"], body')).toBeVisible()

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    // 위반 발견 시 어떤 규칙인지 메시지에 포함 → 디버깅 단축.
    if (results.violations.length > 0) {
      const summary = results.violations
        .map((v) => `[${v.id}] ${v.help} (${v.nodes.length} nodes)`)
        .join('\n')
      throw new Error(`a11y violations on ${route}:\n${summary}`)
    }
    expect(results.violations).toEqual([])
  })
}
