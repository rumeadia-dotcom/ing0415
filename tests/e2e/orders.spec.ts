import { test, expect } from '@playwright/test'

/**
 * s7 주문 현황 E2E (n47/n48/n49/n50).
 *
 * 본 PR(v2-fe-orders) 은 페이지/컴포넌트/hook 본구현만 포함하고 라우트 등록(PR1) +
 * RPC/RLS(PR2) 는 외부 의존이다. 따라서 본 spec 의 실제 활성화는
 * PR1 + PR2 머지 후 시드(주문 1건) 준비가 끝난 뒤 진행한다.
 *
 * 활성화 절차:
 *   - PR1 (라우트 + 사이드바) 머지로 `/orders`, `/orders/list`, `/orders/:id` 라우트 등록.
 *   - PR2 (orders 스키마 + RLS + RPC) 머지로 데이터 픽스처 생성 가능.
 *   - 골든 셀러 계정 + logen_failed 시드 주문 1건 준비 → 본 spec 의 `test.fixme` → `test` 전환.
 *
 * 활성화 시 시나리오 (마스터: docs/architecture/v1/qa/golden-path-v2-shipping.md, PR2 신설):
 *   O1  로그인 → /orders 진입
 *   O2  대시보드 카드 4종 노출 확인
 *   O3  /orders/list 진입 → 행 1개 확인
 *   O4  행 클릭 → /orders/:id 상세 진입
 *   O5  수동처리 다이얼로그 오픈 → 운송장 입력 → 성공 토스트
 */

test.describe('s7 Orders (v2) — n47/n48/n49/n50 @v2-orders', () => {
  test.fixme(
    'O1~O5 골든패스: /orders → 목록 → 상세 → 수동처리 다이얼로그',
    async ({ page }) => {
      // 활성화 조건 미충족 (PR1/PR2 의존).
      // 본 fixme 가 제거되는 시점에 아래 검증을 채운다.
      await page.goto('/orders')
      await expect(page.getByRole('heading', { name: '주문 현황' })).toBeVisible()

      await page.getByRole('link', { name: '전체 주문 보기' }).click()
      await expect(page).toHaveURL(/\/orders\/list/)

      // 임의의 첫 행 클릭 → 상세 진입
      const firstRow = page.getByRole('link').filter({ hasText: /A-/ }).first()
      await firstRow.click()
      await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+$/)

      // logen_failed 주문일 때만 수동처리 trigger 활성
      await page.getByTestId('order-manual-resolve-trigger').click()
      await page.getByLabel('운송장번호').fill('123456789012')
      await page.getByRole('button', { name: '확인' }).click()

      // 토스트 확인
      await expect(page.getByText('운송장이 등록되었습니다')).toBeVisible()
    },
  )
})
