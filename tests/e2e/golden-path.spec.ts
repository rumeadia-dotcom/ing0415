import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * 골든 패스 1 시나리오 (testing.md §3, qa/golden-path.md).
 *
 * **이게 안 돌면 main 머지 차단.**
 *
 * v1 활성 마켓 = 네이버 스마트스토어 1개 (2026-05-19 결정 — OQ-10).
 * 쿠팡 / 11번가 / G마켓 / 옥션 = 오픈 준비중 (v2 어댑터 인터페이스 확장 후 통합).
 *
 * 시나리오 (단일 마켓 가정):
 *   G1  로그인 (이메일+비밀번호)
 *   G2  /markets 진입 — empty 상태
 *   G3  스마트스토어 OAuth 연결 (mock)
 *   G5  /register/info — 상품 정보 입력
 *   G6  /register/images — 이미지 업로드
 *   G7  /register/markets + /register/categories — 마켓·카테고리 매핑 (네이버 단일)
 *   G8  /register/preview — 미리보기
 *   G9  일괄 등록 실행 — running → succeeded
 *   G10 /history — 잡 1행 succeeded 확인
 *
 *   (G4 쿠팡 OAuth 연결 단계는 v2 백로그로 이관 — 본 sweep 에서 삭제)
 *
 * Stage G 현재 (2026-05-20 B-3 + B-4 진행 후):
 *   - G2 (/markets empty) / G3 (네이버 OAuth) 화면 본구현 = B-3 완료.
 *   - G5 (Step 1 정보 입력) / G6 (Step 2 이미지) / G7 (Step 3 마켓·카테고리 통합 —
 *     `/register/markets` 단일 라우트) / G8 (Step 4 미리보기) / G9 (등록 실행) /
 *     G10 (등록 이력) 의 화면 본구현 = B-4 완료
 *     (apps/web/src/features/registration/pages/*).
 *   - 그러나 G1~G10 활성화는 다음 사전 조건이 모두 충족돼야 함:
 *       (a) 시드 셀러 계정(`qa@marketcast.test`, `Qa!12345`) 이 두 Supabase 프로젝트
 *           (debug / real) 에 모두 등록되어 있어야 한다 — 현재 미생성.
 *       (b) Supabase Auth URL Configuration (Site URL + Redirect URLs) 등록 완료 —
 *           debug `eqoywqoalwkwbrdsulfl` / real `lfrnythcujxdhehvkmtg` 양쪽 콘솔.
 *       (c) MSW oauth handler (tests/fixtures/msw/oauth.ts) 또는 동등한 mock authorize URL
 *           대응이 e2e 진입로에 셋업되어 있어야 한다.
 *   - 위 (a)(b)(c) 가 풀리는 시점에 G1 부터 묶어서 한꺼번에 fixme 해제 권장.
 *   - 현재는 G0 (라우트 셸 진입) 1단계만 active. 라우터/lazy import 가 깨지면 즉시 검출.
 *
 * 활성화 절차:
 *   - 각 step 의 `test.fixme(...)` 를 `test(...)` 로 바꾸고 어설션 채움.
 *   - 셀러터는 testing.md §2 RTL 셀러터 우선순위 따른다 — `getByRole`, `getByLabel` 우선.
 *   - `data-testid` 사용 시 PR 사유 명시 (R-008).
 */

const SEED_SELLER = {
  email: 'qa@marketcast.test',
  password: 'Qa!12345',
}

test.describe('Golden Path @golden — s1 로그인 → s5 마켓 연결(네이버) → s3 등록 5단계 → s6 이력', () => {
  test('G0: 라우트 셸 진입 + AuthLayout 네비게이션 동작', async ({ page }) => {
    // 본 단계는 항상 active. 라우터/레이아웃/lazy import 가 깨지면 즉시 fail.
    //
    // vite preview 는 SPA fallback 미지원 — `/login` 직접 GET 은 404. 그래서 `/` 로
    // 진입해 React Router 가 client-side 로 `/dashboard` → (RequireAuth 가드) → `/login`
    // 까지 라우팅하도록 한다. anonymous 상태이므로 가드가 자동으로 /login 으로 보낸다.
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)

    // LoginPage 의 로그인 카드 헤딩.
    await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible()
    // 이메일 input 이 보여야 폼 마운트 OK.
    // (Tabs 의 "이메일 로그인" 탭 panel 도 aria 매칭되므로 textbox role 로 좁힌다.)
    await expect(page.getByRole('textbox', { name: '이메일' })).toBeVisible()

    // AuthLayout 의 다른 페이지(/signup) 로 client-side 이동 — Suspense + Router 동작 검증.
    await page.getByRole('link', { name: '회원가입' }).click()
    await expect(page).toHaveURL(/\/signup$/)
    await expect(page.getByRole('heading', { name: '회원가입' })).toBeVisible()
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

  test.fixme('G3: 스마트스토어 OAuth 연결 → status=connected (v1 활성 마켓 1개)', async ({
    page,
  }) => {
    // MSW oauth handler 가 200 + access/refresh 반환하도록 설정 (tests/fixtures/msw/oauth.ts).
    await page.goto('/markets/connect')
    await page.getByRole('button', { name: '스마트스토어 연결' }).click()
    // OAuth 콜백 후 /markets 로 복귀.
    await expect(page).toHaveURL(/\/markets$/)
    await expect(page.getByText(/스마트스토어/).first()).toBeVisible()
    await expect(page.getByText(/연결됨|connected/i)).toBeVisible()
    // v1 단일 마켓 — 1개만 연결됨 확인.
    await expect(page.getByText(/연결됨|connected/i)).toHaveCount(1)
    // 보안: DB 검증 (access_token 평문 부재) 은 별도 RLS-SQL 테스트에서 (R-007).
  })

  // G4 쿠팡 OAuth 연결 단계는 v2 백로그로 이관 (2026-05-19 결정 — OQ-10).
  // 쿠팡은 HMAC 인증이라 OAuth 가정 어댑터 인터페이스와 부정합 → v2 인터페이스 확장 후 시나리오 복원.

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

  test.fixme('G6: /register/images — 1024x1024 jpg 3장 업로드 (v1 = 네이버 변환본 1종)', async ({
    page,
  }) => {
    await page.goto('/register/images')
    const file = 'tests/fixtures/images/sample.jpg'
    await page.getByLabel('이미지 업로드').setInputFiles([file, file, file])
    // 마켓별 변환 미리보기 (원본 + 스마트스토어).
    await expect(page.getByRole('img', { name: /원본|스마트스토어/ })).toHaveCount(
      6,
    ) // 3장 × 2변환 (원본 + 네이버).
  })

  test.fixme('G7: /register/markets — 마켓 선택 + 카테고리 매핑 통합 (네이버 단일)', async ({
    page,
  }) => {
    // B-4 통합 후: /register/markets 단일 라우트. /register/categories 제거됨.
    await page.goto('/register/markets')
    await page.getByRole('checkbox', { name: /네이버 스마트스토어 선택/ }).check()
    // 동일 페이지 안에 카테고리 select 가 표시됨.
    await page.getByLabel(/네이버 스마트스토어 카테고리 선택/).selectOption({ label: /주방가전/ })
    await page.getByRole('button', { name: /다음: 미리보기/ }).click()
    await expect(page).toHaveURL(/\/register\/preview$/)
  })

  test.fixme('G8: /register/preview — 마켓 페이로드 요약 + axe', async ({
    page,
  }) => {
    await page.goto('/register/preview')
    // 마켓 페이로드 요약 카드 1개 노출 (네이버).
    await expect(page.getByRole('region', { name: /스마트스토어/ })).toHaveCount(1)
    // 경고/에러 없음.
    await expect(page.getByRole('alert')).toHaveCount(0)
    const axe = await new AxeBuilder({ page }).analyze()
    expect(axe.violations).toEqual([])
  })

  test.fixme('G9: 등록 실행 → 잡 succeeded', async ({ page }) => {
    await page.goto('/register/preview')
    await page.getByRole('button', { name: /등록 시작|등록 실행/ }).click()
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
    // v1 = 네이버 단일 마켓이라 외부 상품 URL 1개.
    await expect(firstRow.getByRole('link', { name: /외부|상품 URL/ })).toHaveCount(1)
  })
})
