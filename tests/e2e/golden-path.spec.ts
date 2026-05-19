import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * 골든 패스 1 시나리오 (testing.md §3, qa/golden-path.md).
 *
 * **이게 안 돌면 main 머지 차단.**
 *
 * 시나리오:
 *   G1  로그인 (이메일+비밀번호)
 *   G2  /markets 진입 — empty 상태
 *   G3  스마트스토어 OAuth 연결 (mock)
 *   G4  쿠팡 OAuth 연결 (mock)
 *   G5  /register/info — 상품 정보 입력
 *   G6  /register/images — 이미지 업로드
 *   G7  /register/markets + /register/categories — 마켓·카테고리 매핑
 *   G8  /register/preview — 미리보기
 *   G9  일괄 등록 실행 — running → succeeded
 *   G10 /history — 잡 1행 succeeded 확인
 *
 * Stage G 현재:
 *   - 각 페이지가 Stage C placeholder 상태 (실제 폼/액션 미구현).
 *   - 따라서 G1~G10 은 모두 `test.fixme` 상태로 시나리오 골격만 보존.
 *   - 단, G0 (라우트 진입 + 사이드바 네비게이션 가능) 1단계는 active. 라우터 자체가 깨지면 즉시 검출.
 *
 * 활성화 절차 (Stage D 이후):
 *   - 각 step 의 `fixme(true)` 를 제거하고 어설션 채움.
 *   - 셀러터는 testing.md §2 RTL 셀러터 우선순위 따른다 — `getByRole`, `getByLabel` 우선.
 *   - `data-testid` 사용 시 PR 사유 명시 (R-008).
 */

const SEED_SELLER = {
  email: 'qa@marketcast.test',
  password: 'Qa!12345',
}

test.describe('Golden Path — s1 로그인 → s5 마켓 연결 → s3 등록 5단계 → s6 이력', () => {
  test('G0: 라우트 셸 진입 + 사이드바 네비 동작', async ({ page }) => {
    // 본 단계는 항상 active. 라우터/레이아웃이 깨지면 즉시 fail.
    await page.goto('/dashboard')

    // AppLayout 의 사이드바 (frontend.md §3) — role="navigation".
    const nav = page.getByRole('navigation')
    await expect(nav).toBeVisible()

    // 5도메인 placeholder 페이지가 lazy 로드됨. 대시보드 페이지 헤더 노출.
    await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible()

    // 사이드바 → /markets 로 이동.
    await page.getByRole('link', { name: /마켓/ }).first().click()
    await expect(page).toHaveURL(/\/markets$/)
  })

  test.fixme('G1: /login 에서 이메일+비밀번호 로그인 → /dashboard 리디렉트', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.getByLabel('이메일').fill(SEED_SELLER.email)
    await page.getByLabel('비밀번호').fill(SEED_SELLER.password)
    await page.getByRole('button', { name: '로그인' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    // 헤더에 셀러 이메일 노출 (auth.md §UI).
    await expect(page.getByRole('navigation')).toContainText(SEED_SELLER.email)
  })

  test.fixme('G2: /markets — 연결된 마켓 0개 empty 상태 + axe 통과', async ({
    page,
  }) => {
    await page.goto('/markets')
    await expect(page.getByText('연결된 마켓이 없습니다')).toBeVisible()
    await expect(page.getByRole('button', { name: /연결 추가/ })).toBeEnabled()

    const axe = await new AxeBuilder({ page }).analyze()
    expect(axe.violations).toEqual([])
  })

  test.fixme('G3: 스마트스토어 OAuth 연결 → status=connected', async ({ page }) => {
    // MSW oauth handler 가 200 + access/refresh 반환하도록 설정 (tests/fixtures/msw/oauth.ts).
    await page.goto('/markets/connect')
    await page.getByRole('button', { name: '스마트스토어 연결' }).click()
    // OAuth 콜백 후 /markets 로 복귀.
    await expect(page).toHaveURL(/\/markets$/)
    await expect(page.getByText(/스마트스토어/).first()).toBeVisible()
    await expect(page.getByText(/연결됨|connected/i)).toBeVisible()
    // 보안: DB 검증 (access_token 평문 부재) 은 별도 RLS-SQL 테스트에서 (R-007).
  })

  test.fixme('G4: 쿠팡 OAuth 연결 → 마켓 카드 2개', async ({ page }) => {
    await page.goto('/markets/connect')
    await page.getByRole('button', { name: '쿠팡 연결' }).click()
    await expect(page).toHaveURL(/\/markets$/)
    // 두 마켓 모두 connected.
    await expect(page.getByText(/연결됨|connected/i)).toHaveCount(2)
  })

  test.fixme('G5: /register/info — 상품 정보 입력', async ({ page }) => {
    await page.goto('/register/info')
    await page.getByLabel('상품명').fill('테스트 텀블러')
    await page.getByLabel('판매가').fill('15000')
    await page.getByLabel('재고').fill('50')
    await page.getByLabel(/상품 설명|상세 설명/).fill('테스트용 상품 설명')
    // 필수 누락 시 disabled + blockingReasons tooltip 검증은 별도 P1 spec.
    await expect(page.getByRole('button', { name: '다음' })).toBeEnabled()
    await page.getByRole('button', { name: '다음' }).click()
    await expect(page).toHaveURL(/\/register\/images$/)
  })

  test.fixme('G6: /register/images — 1024x1024 jpg 3장 업로드', async ({ page }) => {
    await page.goto('/register/images')
    const file = 'tests/fixtures/images/sample.jpg'
    await page.getByLabel('이미지 업로드').setInputFiles([file, file, file])
    // 마켓별 변환 미리보기 3종 (원본 + 스마트스토어 + 쿠팡).
    await expect(page.getByRole('img', { name: /원본|스마트스토어|쿠팡/ })).toHaveCount(
      9,
    ) // 3장 × 3변환.
  })

  test.fixme('G7: /register/markets + /register/categories — 매핑', async ({
    page,
  }) => {
    await page.goto('/register/markets')
    await page.getByRole('checkbox', { name: /스마트스토어/ }).check()
    await page.getByRole('checkbox', { name: /쿠팡/ }).check()
    await page.getByRole('button', { name: '다음' }).click()
    await expect(page).toHaveURL(/\/register\/categories$/)
    // 카테고리 매핑 — 셀러터는 카테고리 콤보박스 라벨로.
    await page.getByLabel('스마트스토어 카테고리').click()
    await page.getByRole('option', { name: /가전 > 주방가전/ }).click()
    await page.getByLabel('쿠팡 카테고리').click()
    await page.getByRole('option', { name: /가전 > 주방가전/ }).click()
  })

  test.fixme('G8: /register/preview — 마켓별 페이로드 요약 + axe', async ({
    page,
  }) => {
    await page.goto('/register/preview')
    // 마켓별 페이로드 요약 카드 2개 노출.
    await expect(page.getByRole('region', { name: /스마트스토어|쿠팡/ })).toHaveCount(2)
    // 경고/에러 없음.
    await expect(page.getByRole('alert')).toHaveCount(0)
    const axe = await new AxeBuilder({ page }).analyze()
    expect(axe.violations).toEqual([])
  })

  test.fixme('G9: 등록 실행 → 잡 succeeded', async ({ page }) => {
    await page.goto('/register/preview')
    await page.getByRole('button', { name: /등록 시작|일괄 등록/ }).click()
    // 결과 페이지로 이동, jobId 가 path 에.
    await expect(page).toHaveURL(/\/register\/result\/[0-9a-f-]+$/)
    // Realtime 으로 status running → succeeded.
    await expect(page.getByText(/등록 완료|succeeded/i)).toBeVisible({ timeout: 30_000 })
  })

  test.fixme('G10: /history — 방금 등록 잡 1행 succeeded', async ({ page }) => {
    await page.goto('/history')
    // 가장 최근 row.
    const firstRow = page.getByRole('row').nth(1) // 0 은 header.
    await expect(firstRow).toContainText(/성공|succeeded/i)
    await expect(firstRow.getByRole('link', { name: /외부|상품 URL/ })).toHaveCount(2)
  })
})
