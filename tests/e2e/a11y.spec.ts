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

// 본 배열은 router.tsx 의 path 정의와 1:1 매칭. 신규 라우트 추가 시 함께 갱신 (R-009).
// 동적 segment (':jobId', ':orderId', ':provider') 는 e2e 가 fixture seed 없이 axe 만 돌리므로 제외.
const ROUTES = [
  // s1 인증 (비인증)
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  // s2 대시보드
  '/dashboard',
  // s3 등록 위저드
  '/register',
  '/register/info',
  '/register/images',
  '/register/markets',
  '/register/preview',
  // s5 마켓 계정
  '/markets',
  '/markets/connect',
  // s6 등록 이력
  '/history',
  // 설정
  '/settings',
  '/settings/policies',
  // s7 주문 (v2)
  '/orders',
  '/orders/list',
  // s8 배송 처리 (v2)
  '/shipping/print',
  '/shipping/dispatch',
  '/shipping/history',
  // s9 배송 설정 (v2)
  '/settings/shipping',
  '/settings/shipping/logen',
  '/settings/shipping/sender',
  // D-C: 비인증 정적 페이지 (약관 / 개인정보처리방침 / 매뉴얼)
  '/legal/terms',
  '/legal/privacy',
  '/manual',
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
