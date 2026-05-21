import { test, expect } from '@playwright/test'

/**
 * s8 배송 처리 골든패스 (user_flow-v2-shipping.md n52~n57).
 *
 * 시나리오:
 *   S1  /shipping/print — 로젠 등록된 주문 목록 노출 + [출력 팝업 열기] / [출력 완료] 버튼
 *   S2  [출력 완료] 클릭 → mutation 호출 → 목록에서 사라짐
 *   S3  /shipping/dispatch — 마켓별 그룹 미리보기 + [제출 시작] 활성
 *   S4  [제출 시작] → /shipping/dispatch/:jobId/result 이동
 *   S5  결과 페이지에 진행률 + 마켓별 상태 표시
 *   S6  /shipping/history — 잡 1행 노출
 *
 * 활성화 사전 조건 (모두 충족된 시점에 fixme → test 전환):
 *  - PR1 머지: 라우터에 4개 shipping 경로 등록 + 사이드바 항목.
 *  - PR2 머지: zod 스키마 + RLS (orders / shipping_jobs / shipping_job_market_results).
 *  - PR3 머지: 로젠 outSlipPrintPop URL 빌더 실연동 (또는 e2e mock).
 *  - PR7 머지: shipping-dispatch-job Edge Function invoke + Realtime 진행률 push.
 *  - 시드 데이터: status=logen_registered 주문 ≥ 1건 / 시드 셀러 로그인 통과.
 *
 * 현재는 사전 조건 미충족이라 모든 단계 fixme.
 */

test.describe('@golden Shipping golden path — n52 → n57', () => {
  test.fixme('S1: /shipping/print 에 출력 대상 운송장 목록 노출', async ({ page }) => {
    await page.goto('/shipping/print')
    await expect(page.getByRole('heading', { name: '운송장 출력' })).toBeVisible()
    await expect(page.getByRole('button', { name: /출력 완료/ })).toBeVisible()
  })

  test.fixme('S2: [출력 완료] 클릭 → 목록에서 제거', async ({ page }) => {
    await page.goto('/shipping/print')
    const rowCountBefore = await page.getByRole('row').count()
    await page.getByRole('button', { name: /출력 완료/ }).click()
    await expect.poll(() => page.getByRole('row').count()).toBeLessThan(rowCountBefore)
  })

  test.fixme('S3: /shipping/dispatch 미리보기 + [제출 시작] 활성', async ({ page }) => {
    await page.goto('/shipping/dispatch')
    await expect(page.getByRole('heading', { name: '송장 일괄 제출' })).toBeVisible()
    const submit = page.getByRole('button', { name: /제출 시작/ })
    await expect(submit).toBeEnabled()
  })

  test.fixme('S4+S5: [제출 시작] → result 페이지 진행률 표시', async ({ page }) => {
    await page.goto('/shipping/dispatch')
    await page.getByRole('button', { name: /제출 시작/ }).click()
    await expect(page).toHaveURL(/\/shipping\/dispatch\/[0-9a-f-]+\/result$/)
    await expect(page.getByText('진행률')).toBeVisible()
    // Realtime 으로 succeeded 까지 도달 — 60초 안에 진행률 100%.
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', /100/, {
      timeout: 60_000,
    })
  })

  test.fixme('S6: /shipping/history 에 방금 잡이 노출', async ({ page }) => {
    await page.goto('/shipping/history')
    await expect(page.getByRole('heading', { name: '배송 이력' })).toBeVisible()
    await expect(page.getByRole('link', { name: /작업 .* 상세 보기/ }).first()).toBeVisible()
  })
})
