import { test, expect } from '@playwright/test'

/**
 * s9 배송 설정 happy path E2E.
 *
 * 마스터: docs/spec/user_flow-v2-shipping.md s9 (n58 → n59 → n58)
 *
 * 본 spec 의 fixme 들은 PR1 (라우트 + 사이드바) + PR2 (logen RPC) + PR3
 * (logen-verify-credential Edge Function) 머지 후 활성화한다. 활성화 절차는 각
 * `test.fixme` 를 `test` 로 바꾸고 셀러 fixture 를 셋업한다.
 *
 * 현재 활성: 페이지 모듈 import 가능 여부 — 직접 라우트 진입은 PR1 에 의존하므로 fixme.
 */

test.describe('Settings → 배송 설정 (s9)', () => {
  test.fixme(
    'happy: /settings/shipping → /settings/shipping/logen → 저장 후 자동 복귀',
    async ({ page }) => {
      // 사전조건: 로그인 + Supabase mock 또는 시드 셀러 셋업
      await page.goto('/settings/shipping')
      await expect(page.getByRole('heading', { name: '배송 설정' })).toBeVisible()
      // 미연결 배지
      await expect(page.getByText('미연결')).toBeVisible()

      // [로젠 API 설정] 진입
      await page.getByRole('link', { name: '로젠 API 설정' }).click()
      await expect(page).toHaveURL(/\/settings\/shipping\/logen$/)

      await page.getByLabel(/userId/).fill('LGN_12345')
      await page.getByLabel(/custCd/).fill('CUST_67890')
      await page.getByRole('button', { name: /저장 후 연결 테스트/ }).click()

      // 검증 성공 후 자동 redirect 대기
      await expect(page).toHaveURL(/\/settings\/shipping$/, { timeout: 5_000 })
      await expect(page.getByText('연결됨')).toBeVisible()
    },
  )

  test.fixme(
    'happy: 발송인 정보 폼 → 저장 후 자동 복귀',
    async ({ page }) => {
      await page.goto('/settings/shipping/sender')
      await page.getByLabel(/발송인명/).fill('홍길동 스토어')
      await page.getByLabel(/발송지 주소/).fill('서울특별시 강남구 테헤란로 123')
      await page.getByLabel(/연락처/).fill('010-1234-5678')
      await page.getByLabel(/택배 운임/).fill('2500')
      await page.getByRole('button', { name: '저장' }).click()
      await expect(page).toHaveURL(/\/settings\/shipping$/, { timeout: 5_000 })
    },
  )

  test.fixme(
    '오류: invalid_credentials 응답 시 한국어 메시지 인라인 표시',
    async ({ page }) => {
      await page.goto('/settings/shipping/logen')
      await page.getByLabel(/userId/).fill('LGN_WRONG')
      await page.getByLabel(/custCd/).fill('CUST_WRONG')
      await page.getByRole('button', { name: /저장 후 연결 테스트/ }).click()
      await expect(
        page.getByText(/입력한 자격증명이 유효하지 않습니다/),
      ).toBeVisible()
    },
  )
})
