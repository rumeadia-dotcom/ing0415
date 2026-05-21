# 골든 패스 명세 (Golden Path Specification)

> **문서 종류**: QA 명세 / 자동화 강제 룰
> **위치**: `docs/architecture/v1/qa/golden-path.md`
> **상위 문서**: `docs/architecture/v1/testing.md` §3 골든 패스
> **테스트 파일 위치**: `tests/e2e/golden-path.spec.ts`
> **수정 시 동반 갱신**: `docs/architecture/v1/testing.md` §3.2, `docs/architecture/v1/qa-matrix.md` 의 `QA-P5-GOLDEN` 행
> **마지막 갱신**: Phase 5 QA 분과
>
> 본 문서는 골든 패스 1 시나리오의 **상세 명세** 다. testing.md §3 은 "정의"만, 본 문서는 "실행 가능한 사양" 이다. 시나리오의 한 단계라도 모호하게 적혀 있으면 본 문서를 거부한다.

---

## 0. 한 줄 요약 (까칠한 버전)

> **"이게 안 돌면 머지하지 않는다."**
>
> debug 모드 Playwright Chromium 헤드리스에서 90초 안에 G1 → G10 이 전부 통과되어야 한다. 단 1 단계라도 fail / skip / timeout 이면 PR 머지를 차단한다. `test.skip` / `test.fixme` / `test.only` 우회 PR 도 거부. 시나리오를 줄이고 싶다면 본 문서 §2 표 자체를 PR 에서 함께 갱신하라.

---

## 1. 목적 · 범위

### 1.1 목적

1. **MVP v1 의 핵심 셀러 동선 (인증 → 마켓 연결 → 상품 등록 → 이력 확인) 이 항상 동작함을 보증**한다.
2. **회귀 게이트** — 마켓 어댑터 / Edge Function / RLS / UI 컴포넌트 변경이 핵심 동선을 깨는 PR 을 `develop` / `main` 진입 전에 차단한다.
3. **3개 산출물 동기화 검증의 마지막 보루** — 설계문서(`docs/architecture/v1/`) / HTML 프로토타입(`docs/frontend_html_design/v1/`) / 실제 구현(`apps/web/src/features/<domain>/`) 중 하나라도 누락되어 있으면 본 시나리오가 실패하도록 단계별 검증을 짠다.

### 1.2 범위

본 문서가 다루는 시나리오는 **단 1개**다. 다른 모든 E2E 시나리오 (실패 / 부분 / 권한 / 401 / 429 / 5xx) 는 본 문서가 아니라 각 `features/*.md` 의 QA 매트릭스에서 정의한다.

**v1 (MVP)**:

| 항목 | 포함 | 비고 |
|---|---|---|
| s1 로그인 | O | 이메일+비밀번호. 소셜 로그인은 별도 시나리오 (out of scope) |
| s5 마켓 계정 연결 | O | 스마트스토어 1 + 쿠팡 1 (mock OAuth) |
| s3 상품 등록 5단계 | O | Step 1 정보 → Step 2 이미지 → Step 3 마켓·카테고리 → Step 4 미리보기 → Step 5 일괄 등록 |
| s6 등록 이력 | O | 방금 등록한 잡이 `succeeded` 로 표시되는지만 검증 |

**v2 (carry-over, 골든 패스에 추가하지 않음)**:

- s4 템플릿 — 골든 패스에서 사용하지 않는다. 별도 시나리오로 분리.
- 11번가 / G마켓 / 옥션 어댑터 — `MarketAdapter` 인터페이스만 유지, 골든 패스 단계에 포함하지 않는다.
- HTML WYSIWYG 상세 — Step 1 의 단순 textarea 만 사용.

### 1.3 인용 선행 문서

본 문서를 읽기 전 다음을 반드시 참조한다.

- `docs/architecture/v1/platform.md` — Supabase 프로젝트 분리 (debug / real), Edge Function 매핑.
- `docs/architecture/v1/frontend.md` — 라우팅 (`/login`, `/dashboard`, `/markets`, `/register/new`, `/history`), shadcn 컴포넌트 셀렉터 규약.
- `docs/architecture/v1/testing.md` §3 — 골든 패스 정의 (본 문서가 이 절을 상세화).
- `docs/architecture/v1/security.md` — 마켓 토큰 평문 저장 금지, RLS 거부 룰.
- `docs/architecture/v1/features/auth.md` — 로그인 폼 라벨 (`이메일`, `비밀번호`), 성공 시 `/dashboard` 리디렉트.
- `docs/architecture/v1/features/markets.md` — `market_accounts` 스키마, OAuth 콜백 흐름, `status='active'` 전이 규칙.
- `docs/architecture/v1/features/registration.md` — 5단계 위저드 구조, `registration_jobs` 상태 전이, Realtime 채널.
- `docs/architecture/v1/features/dashboard.md` — `/dashboard` 진입 시 노출되는 헤더 / 사이드바.
- `docs/architecture/v1/features/history.md` — 이력 목록 컬럼 (잡 ID / 생성시각 / 상태 / 마켓 / 외부 URL).

---

## 2. 시나리오 단계 표 (상세 명세)

각 단계는 **단계 / 액션 / 기대 결과 / 검증 방법 / 의존 데이터** 의 5열로 정의한다. 모호한 표현 ("로그인 잘 됨", "정상 동작") 은 금지. 모든 기대는 DOM / DB / Realtime 이벤트 / 네트워크 응답 중 적어도 하나로 관측 가능해야 한다.

### 2.1 단계 G1~G10

| # | 단계 | 액션 (사용자 / 시스템) | 기대 (관측 가능 상태) | 검증 방법 (자동화) | 의존 데이터 |
|---|---|---|---|---|---|
| **G1** | s1 로그인 페이지 진입 | `page.goto('/login')` | URL = `/login`. 폼 라벨 `이메일`, `비밀번호` 노출. "로그인" 버튼 disabled (값 미입력 상태). a11y violation = 0. | `expect(page).toHaveURL(/\/login$/)` + `getByLabel('이메일')` 존재 + `getByRole('button', { name: '로그인' })` 의 `disabled` 속성 확인 + `await new AxeBuilder({ page }).analyze()` violations.length === 0 | seed 셀러 미사용 단계. 빌드된 SPA 만 |
| **G2** | 이메일·비번 입력 → 로그인 → 대시보드 진입 | `getByLabel('이메일').fill('qa@marketcast.test')`, `getByLabel('비밀번호').fill('Qa!12345')`, `getByRole('button', { name: '로그인' }).click()` | URL = `/dashboard`. 사이드바에 5개 메뉴 (대시보드 / 상품 등록 / 마켓 계정 / 등록 이력 / 설정) 노출. 헤더에 셀러 이메일 표기. `sessions` 테이블에 신규 행 1건. | `expect(page).toHaveURL(/\/dashboard$/)` + `getByRole('navigation').getByText('qa@marketcast.test')` + Supabase JS 직접 쿼리 `select count() from sessions where seller_id = $seedSellerId and created_at > now() - interval '1 minute'` = 1 | `seed.sql` 의 셀러 1건 (`qa@marketcast.test` / bcrypt `Qa!12345`) |
| **G3** | s5 마켓 계정 진입 (empty 상태) | 사이드바 "마켓 계정" 링크 클릭 | URL = `/markets`. `market_accounts` 0건 상태 → "연결된 마켓이 없습니다" 메시지 + "스마트스토어 연결" / "쿠팡 연결" 버튼 2개 노출. a11y violation = 0. | `expect(page).toHaveURL(/\/markets$/)` + `getByText('연결된 마켓이 없습니다')` 가시 + `getByRole('button', { name: /스마트스토어 연결/ })` 활성 + axe 통과 | 이전 단계에서 G2 로 로그인된 셀러. `market_accounts` 0건 |
| **G4** | 스마트스토어 연결 (mock OAuth) | "스마트스토어 연결" 클릭 → 새 탭 / 동일 탭에서 mock OAuth 콜백 (`/oauth/callback?market=naver&code=mock_code_naver`). MSW 핸들러가 `{ access_token, refresh_token, expires_in: 3600 }` 200 응답. | 마켓 목록에 스마트스토어 카드 1개, 상태 배지 `연결됨` (green). DB `market_accounts` 행 1건, `market='naver'`, `status='active'`, `access_token` 컬럼은 평문 아님 (pgcrypto 또는 vault). Sentry 로그에 토큰 문자열 0건. | DOM: `getByTestId('market-card-naver').getByText('연결됨')`. DB: `select status, access_token_encrypted is not null as encrypted from market_accounts where seller_id=$X and market='naver'` → `status='active' AND encrypted=true`. Sentry: 테스트 시작 ~ 시점까지의 이벤트에서 access_token 값 정규식 검색 = 0. | MSW oauth 핸들러 (`tests/fixtures/msw/oauth.ts`) |
| **G5** | 쿠팡 연결 (mock OAuth) | "쿠팡 연결" 클릭 → mock OAuth 콜백 (`/oauth/callback?market=coupang&code=mock_code_coupang`) → MSW 200 응답. | 마켓 카드 2개 (스마트스토어 + 쿠팡), 둘 다 `연결됨`. DB `market_accounts` 행 2건. | G4 와 동일 패턴으로 쿠팡 검증 | MSW oauth 핸들러 |
| **G6** | s3 상품 등록 진입 → Step 1 정보 입력 | 사이드바 "상품 등록" 클릭. URL = `/register/new?step=1`. 필드 입력: 상품명 `골든패스 테스트 상품 #{Date.now()}`, 가격 `19900`, 브랜드 `MarketCast QA`, 제조사 `MarketCast`, 카테고리 `가전 > 주방가전`, 배송정책 `무료배송`. "다음" 클릭. | URL `step=2`. `products` 테이블에 draft 행 1건 INSERT (`status='draft'`, `seller_id=$X`). | `expect(page).toHaveURL(/step=2/)` + DB `select count() from products where seller_id=$X and status='draft' and created_at > $testStart` = 1 | Step 1 폼 라벨이 frontend.md / features/registration.md 와 정확히 일치해야 함 |
| **G7** | Step 2 이미지 업로드 | `getByLabel('대표 이미지').setInputFiles('tests/fixtures/images/sample-256.jpg')`. 업로드 진행 표시 → 완료. "다음" 클릭. | URL `step=3`. Supabase Storage 버킷 `product-images/{seller_id}/{product_id}/main.jpg` 객체 존재. `products.images` JSON 에 URL 1건 기록. | `await expect(getByText('업로드 완료')).toBeVisible({ timeout: 10_000 })` + Storage API `list({prefix})` 결과 length=1 + DB jsonb 길이 = 1 | `tests/fixtures/images/sample-256.jpg` (256x256 JPEG, 약 12KB) |
| **G8** | Step 3 마켓 선택 + 카테고리 매핑 | 두 마켓 체크박스 모두 선택 (`getByLabel('스마트스토어')`, `getByLabel('쿠팡')`). 각 마켓 카테고리 셀렉트에서 "가전 > 주방가전" 매핑. "다음" 클릭. | URL `step=4`. `product_market_mappings` 행 2건 INSERT (`market='naver'`, `market='coupang'`). 마켓별 카테고리 코드가 NULL 아님. | DB `select market, market_category_code from product_market_mappings where product_id=$X order by market` → 2행, 코드 모두 not null | mock 카테고리 트리 fixture (`tests/fixtures/msw/categories.ts`) |
| **G9** | Step 4 미리보기 | `step=4` 화면 노출 대기. 마켓별 변환 결과 카드 2개 노출. 경고 없음. "등록 시작" 버튼 활성. | 2 마켓 모두 필수 필드 충족 표시 (`✓` 또는 동등 아이콘). `blockingReasons` 배열 비어있음 (tooltip 호출 시 빈 상태). "등록 시작" 버튼 `aria-disabled='false'`. | `expect(getByTestId('preview-naver').getByText('필수 필드 충족')).toBeVisible()` (쿠팡 동일) + `expect(getByRole('button', { name: '등록 시작' })).toBeEnabled()` | 이전 단계 누적 데이터 |
| **G10** | Step 5 일괄 등록 실행 → 양쪽 success | "등록 시작" 클릭. MSW: 두 마켓 모두 200 응답 + `externalId`. Realtime 으로 `registration_jobs` 상태 변화 수신. | `RegistrationJob` 상태 `pending → running → succeeded`. UI 진행률 100%. 마켓별 결과 카드 2개 모두 `success`, 외부 URL 클릭 가능 (target=`_blank`, `rel='noopener noreferrer'`). DB `registration_job_market_results` 2행, 둘 다 `status='success'`. | Polling: `await expect.poll(() => fetchJobStatus(jobId), { timeout: 60_000 }).toBe('succeeded')` + DOM `getByText('등록 완료').count()` = 2 + DB 검증 + 외부 URL 링크 속성 검증 | MSW market handler success 시나리오 |
| **G11** | s6 등록 이력 진입 → 잡 표시 확인 | 사이드바 "등록 이력" 클릭. URL = `/history`. | 가장 상단 행 = 방금의 `jobId`. 상태 컬럼 `succeeded`. 마켓 컬럼에 `naver`, `coupang` 둘 다 표시. 외부 URL 2개 노출. a11y violation = 0. | `expect(page).toHaveURL(/\/history$/)` + `getByRole('row').first().getByText(jobId.slice(0,8))` + `getByRole('row').first().getByText('succeeded')` + axe 통과 | G10 에서 생성된 jobId |

> **참고**: 사용자 지시문에는 "G1~G10" 으로 정리되어 있으나, 본 명세는 검증 단위로 G1 (페이지 진입) 과 G2 (로그인 폼 제출) 를 분리하여 **G1~G11** 로 운영한다. testing.md §3.2 의 G1~G10 매핑과 1:1 변환표는 §10 부록에 둔다.

### 2.2 단계 간 명시적 사전 / 사후 조건

각 단계는 **이전 단계가 통과한 상태**를 사전 조건으로 가정한다. 단계를 건너뛰는 `test.only`, 분기 if 문, conditional skip 은 금지한다. 한 단계라도 실패하면 후속 단계는 자동 skip 되며 골든 패스 전체가 `failed` 로 마크된다.

| 단계 | 사전 조건 | 사후 상태 (다음 단계의 시드) |
|---|---|---|
| G1 | clean session (`page.context().clearCookies()` 직후) | `/login` 페이지 로드 완료 |
| G2 | G1 통과 + seed 셀러 존재 | 로그인 세션 (`sb-access-token` 쿠키), `/dashboard` 진입 |
| G3 | G2 통과 + `market_accounts` 0건 | `/markets` empty 상태 |
| G4 | G3 통과 | `market_accounts` 1건 (naver, active) |
| G5 | G4 통과 | `market_accounts` 2건 (naver + coupang, 둘 다 active) |
| G6 | G5 통과 | `products` draft 1건, `step=2` 진입 |
| G7 | G6 통과 + 이미지 fixture 파일 존재 | Storage 객체 1건, `step=3` 진입 |
| G8 | G7 통과 | `product_market_mappings` 2건, `step=4` 진입 |
| G9 | G8 통과 | 미리보기 통과, "등록 시작" enabled |
| G10 | G9 통과 + MSW 두 마켓 모두 success | `registration_jobs.status='succeeded'`, 결과 2건 |
| G11 | G10 통과 | 이력 목록에 잡 노출, 시나리오 종료 |

---

## 3. 테스트 픽스처 / 시드 데이터

### 3.1 시드 셀러

- 파일: `tests/fixtures/seed/golden-path.sql`
- 내용:

```sql
-- 시드 셀러 1명 (debug Supabase 프로젝트 전용)
-- 동일한 ID 가 모든 골든 패스 실행에서 재사용된다. 멱등하게 작성.
insert into auth.users (id, email, encrypted_password, email_confirmed_at)
values (
  '00000000-0000-0000-0000-000000000001',
  'qa@marketcast.test',
  crypt('Qa!12345', gen_salt('bf')),
  now()
)
on conflict (id) do update set encrypted_password = excluded.encrypted_password;

insert into sellers (id, auth_user_id, display_name)
values (
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-000000000001',
  'QA 골든패스 셀러'
)
on conflict (id) do nothing;

-- 시드 카테고리 트리 (단순화: 가전 > 주방가전)
insert into market_categories (market, code, label, parent_code)
values
  ('naver',   '50000000', '가전',         null),
  ('naver',   '50000010', '주방가전',     '50000000'),
  ('coupang', '1001',     '가전',         null),
  ('coupang', '1001001',  '주방가전',     '1001')
on conflict (market, code) do nothing;
```

- **시드 정리 규칙**: 골든 패스는 매 실행마다 다음을 정리한다 (테스트 시작 시점 `beforeEach`).
  - `market_accounts` where `seller_id = $SEED` → 전부 삭제 (G3 의 empty 상태 보장).
  - `products`, `product_market_mappings`, `registration_jobs`, `registration_job_market_results` where `seller_id = $SEED` → 전부 삭제.
  - Supabase Storage `product-images/{$SEED}/` prefix → 전부 삭제.
  - `sessions` 는 보존 (감사 흔적).

### 3.2 MSW (mock 어댑터) 시나리오

- 위치: `tests/fixtures/msw/`
- **모드**: 골든 패스에서는 **모두 success 시나리오**. 실패 / 부분 / 429 / 401 시나리오는 각 features 매트릭스의 별도 spec 에서 다룬다.
- 핸들러 파일:
  - `oauth.ts` — `POST /naver/oauth/token`, `POST /coupang/oauth/token` 200 응답 (`access_token`, `refresh_token`, `expires_in=3600`)
  - `categories.ts` — `GET /naver/categories`, `GET /coupang/categories` 200 응답 (시드 카테고리 트리와 동일)
  - `products.ts` — `POST /naver/products`, `POST /coupang/products` 200 응답 (`externalId`, `productUrl`)
- **금지**:
  - 실제 마켓 API 호출 — 골든 패스는 debug 모드에서만 자동화한다. real 모드는 §7 의 수동 절차.
  - 환경에 따라 응답이 바뀌는 비결정성 — 모든 응답은 fixture 파일로 박제.

### 3.3 이미지 fixture

| 파일 | 크기 | 포맷 | 용도 |
|---|---|---|---|
| `tests/fixtures/images/sample-256.jpg` | 256x256, ~12 KB | JPEG | G7 의 대표 이미지 업로드 |

- **고정 시드 이미지** (랜덤 생성 금지). Git LFS 미사용, 원본 그대로 커밋.
- 마켓별 이미지 규격 (스마트스토어 / 쿠팡) 의 *최소 요구* 를 만족하는 크기로 선정. 마켓별 변환 결과 (G7 단계의 미리보기) 도 동일 fixture 기반.

### 3.4 환경 변수

골든 패스 실행에 필요한 환경 변수 (CI Secrets 또는 로컬 `.env.test`):

| 변수 | 값 (예) | 비고 |
|---|---|---|
| `VITE_APP_MODE` | `debug` | 실 마켓 API 호출 차단 |
| `VITE_SUPABASE_URL` | debug 프로젝트 URL | platform.md §Supabase 분리 |
| `VITE_SUPABASE_ANON_KEY` | debug anon key | public 가능 |
| `SUPABASE_SERVICE_ROLE_KEY` | debug service role | 시드 정리 전용. CI Secret. |
| `MSW_ENABLED` | `true` | MSW 핸들러 활성화 |
| `PLAYWRIGHT_BASE_URL` | `http://localhost:5173` | Vite dev 또는 `pnpm preview` |

---

## 4. Playwright 시나리오 코드

다음은 `tests/e2e/golden-path.spec.ts` 의 **실행 가능 수준** 초안이다. 실제 import 경로 / 헬퍼는 `tests/e2e/helpers/` 에 분리한다.

```ts
// tests/e2e/golden-path.spec.ts
//
// MarketCast 골든 패스 — s1 로그인 → s5 마켓 연결 → s3 등록 5단계 → s6 이력 확인
// 본 spec 이 실패하면 main 머지를 차단한다 (docs/architecture/v1/qa/golden-path.md §8).

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  resetSeedSellerState,
  fetchJobStatusFromDb,
  countMarketAccounts,
  countMarketMappings,
  assertTokenNotPlaintext,
} from './helpers/db';
import { installMswSuccessHandlers } from './helpers/msw';

const SEED_SELLER_ID = '00000000-0000-0000-0000-0000000000a1';
const SEED_EMAIL = 'qa@marketcast.test';
const SEED_PASSWORD = 'Qa!12345';
const IMAGE_FIXTURE = 'tests/fixtures/images/sample-256.jpg';

test.describe('Golden Path (P0, main merge blocker)', () => {
  test.describe.configure({ mode: 'serial', timeout: 90_000 });

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await resetSeedSellerState(SEED_SELLER_ID);
    await installMswSuccessHandlers(page);
  });

  test('G1~G11: 셀러가 로그인하고 두 마켓을 연결한 뒤 상품을 등록하고 이력에서 확인한다', async ({ page }) => {
    //
    // G1 — 로그인 페이지 진입
    //
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel('이메일')).toBeVisible();
    await expect(page.getByLabel('비밀번호')).toBeVisible();
    await expect(page.getByRole('button', { name: '로그인' })).toBeDisabled();
    {
      const result = await new AxeBuilder({ page }).analyze();
      expect(result.violations, '/login a11y').toEqual([]);
    }

    //
    // G2 — 로그인 → /dashboard
    //
    await page.getByLabel('이메일').fill(SEED_EMAIL);
    await page.getByLabel('비밀번호').fill(SEED_PASSWORD);
    await page.getByRole('button', { name: '로그인' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('navigation').getByText(SEED_EMAIL)).toBeVisible();

    //
    // G3 — 마켓 계정 진입 (empty 상태)
    //
    await page.getByRole('link', { name: '마켓 계정' }).click();
    await expect(page).toHaveURL(/\/markets$/);
    await expect(page.getByText('연결된 마켓이 없습니다')).toBeVisible();
    {
      const result = await new AxeBuilder({ page }).analyze();
      expect(result.violations, '/markets empty a11y').toEqual([]);
    }

    //
    // G4 — 스마트스토어 연결 (mock OAuth)
    //
    await page.getByRole('button', { name: /스마트스토어 연결/ }).click();
    // mock OAuth 콜백은 MSW 가 가로채서 즉시 callback URL 로 리다이렉트.
    await expect(page.getByTestId('market-card-naver').getByText('연결됨')).toBeVisible({
      timeout: 10_000,
    });
    expect(await countMarketAccounts(SEED_SELLER_ID, 'naver')).toBe(1);
    await assertTokenNotPlaintext(SEED_SELLER_ID, 'naver');

    //
    // G5 — 쿠팡 연결 (mock OAuth)
    //
    await page.getByRole('button', { name: /쿠팡 연결/ }).click();
    await expect(page.getByTestId('market-card-coupang').getByText('연결됨')).toBeVisible({
      timeout: 10_000,
    });
    expect(await countMarketAccounts(SEED_SELLER_ID, 'coupang')).toBe(1);
    await assertTokenNotPlaintext(SEED_SELLER_ID, 'coupang');

    //
    // G6 — 상품 등록 Step 1 (정보)
    //
    await page.getByRole('link', { name: '상품 등록' }).click();
    await expect(page).toHaveURL(/\/register\/new\?step=1/);
    const productName = `골든패스 테스트 상품 #${Date.now()}`;
    await page.getByLabel('상품명').fill(productName);
    await page.getByLabel('판매가').fill('19900');
    await page.getByLabel('브랜드').fill('MarketCast QA');
    await page.getByLabel('제조사').fill('MarketCast');
    await page.getByLabel('카테고리').selectOption({ label: '가전 > 주방가전' });
    await page.getByLabel('배송정책').selectOption({ label: '무료배송' });
    await page.getByRole('button', { name: '다음' }).click();
    await expect(page).toHaveURL(/step=2/);

    //
    // G7 — Step 2 (이미지)
    //
    await page.getByLabel('대표 이미지').setInputFiles(IMAGE_FIXTURE);
    await expect(page.getByText('업로드 완료')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '다음' }).click();
    await expect(page).toHaveURL(/step=3/);

    //
    // G8 — Step 3 (마켓 선택 + 카테고리 매핑)
    //
    await page.getByLabel('스마트스토어').check();
    await page.getByLabel('쿠팡').check();
    await page
      .getByTestId('category-select-naver')
      .selectOption({ label: '가전 > 주방가전' });
    await page
      .getByTestId('category-select-coupang')
      .selectOption({ label: '가전 > 주방가전' });
    await page.getByRole('button', { name: '다음' }).click();
    await expect(page).toHaveURL(/step=4/);
    expect(await countMarketMappings(SEED_SELLER_ID, productName)).toBe(2);

    //
    // G9 — Step 4 (미리보기)
    //
    await expect(page.getByTestId('preview-naver').getByText('필수 필드 충족')).toBeVisible();
    await expect(page.getByTestId('preview-coupang').getByText('필수 필드 충족')).toBeVisible();
    await expect(page.getByRole('button', { name: '등록 시작' })).toBeEnabled();

    //
    // G10 — Step 5 (일괄 등록 실행)
    //
    await page.getByRole('button', { name: '등록 시작' }).click();
    // 잡 ID 는 화면의 data-job-id 로 노출됨.
    const jobIdLocator = page.getByTestId('registration-job-id');
    await expect(jobIdLocator).toBeVisible({ timeout: 15_000 });
    const jobId = (await jobIdLocator.getAttribute('data-job-id'))!;
    expect(jobId).toMatch(/^[0-9a-f-]{36}$/);

    await expect
      .poll(() => fetchJobStatusFromDb(jobId), { timeout: 60_000, intervals: [500, 1000, 2000] })
      .toBe('succeeded');

    await expect(page.getByText('등록 완료')).toHaveCount(2);
    const externalLinks = page.getByRole('link', { name: /상품 페이지 열기/ });
    await expect(externalLinks).toHaveCount(2);
    for (const link of await externalLinks.all()) {
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener.*noreferrer/);
    }

    //
    // G11 — 등록 이력 진입 → 잡 표시 확인
    //
    await page.getByRole('link', { name: '등록 이력' }).click();
    await expect(page).toHaveURL(/\/history$/);
    const firstRow = page.getByRole('row').nth(1); // 0번은 헤더
    await expect(firstRow.getByText(jobId.slice(0, 8))).toBeVisible();
    await expect(firstRow.getByText('succeeded')).toBeVisible();
    await expect(firstRow.getByText('naver')).toBeVisible();
    await expect(firstRow.getByText('coupang')).toBeVisible();
    {
      const result = await new AxeBuilder({ page }).analyze();
      expect(result.violations, '/history a11y').toEqual([]);
    }
  });
});
```

### 4.1 헬퍼 분리 (요구 사항)

`tests/e2e/helpers/` 아래에 다음 파일을 둔다. **인라인 SQL · 인라인 MSW 핸들러 금지** — 모든 비결정적 동작은 헬퍼에 격리해 재사용성과 디버깅 추적성을 확보한다.

- `helpers/db.ts` — Supabase service role 키로 시드 정리 / DB 검증 / 토큰 컬럼 평문 여부 검증.
- `helpers/msw.ts` — Playwright `page.route()` 로 마켓 API URL 인터셉트. fixture import.
- `helpers/selectors.ts` — `getByTestId` 등 자주 쓰는 셀렉터 상수화. test-id 변경 시 단일 수정점.

### 4.2 셀렉터 우선순위

1. `getByRole` (접근성 시맨틱)
2. `getByLabel` (폼 필드)
3. `getByText` (정적 라벨)
4. `getByTestId` (위 3개로 불가능할 때만)

> `page.locator('.btn-primary')` 같은 CSS / XPath 셀렉터는 금지. UI 리팩토링 한 번에 모든 테스트가 깨진다.

---

## 5. CI 통합

### 5.1 워크플로우 위치

`.github/workflows/ci.yml` (CLAUDE.md "CI/CD" 결정 + `docs/architecture/v1/ops/ci-cd.md` 인용).

### 5.2 트리거별 실행 매트릭스

| 트리거 | 실행 대상 | 게이트 동작 |
|---|---|---|
| `pull_request` → `develop` | **골든 패스 1 (Chromium 헤드리스)** + features 매트릭스의 P0 실패 시나리오 일부 | 골든 패스 실패 시 `merge_block` 라벨 자동 부착, PR 머지 버튼 비활성 |
| `push` → `develop` | 전체 Vitest + 골든 패스 1 (Chromium) | 실패 시 develop 배포 차단 |
| `pull_request` → `main` (release/* 머지) | **전체 E2E** + 골든 패스 1 (Chromium / WebKit / Firefox 3 브라우저) + 수동 QA 체크리스트 PR 코멘트 | 어느 브라우저든 실패 시 머지 차단 |
| `push` → `main` | real 모드 빌드 → GitHub Pages 배포 (골든 패스는 release 단계에서 이미 통과한 상태) | — |

### 5.3 CI 단계 (PR → develop 기준)

```yaml
# .github/workflows/ci.yml 의 e2e job (요약)
jobs:
  e2e-golden-path:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    env:
      VITE_APP_MODE: debug
      VITE_SUPABASE_URL: ${{ secrets.SUPABASE_DEBUG_URL }}
      VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_DEBUG_ANON_KEY }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_DEBUG_SERVICE_ROLE_KEY }}
      MSW_ENABLED: 'true'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm seed:golden-path  # tests/fixtures/seed/golden-path.sql 적용
      - run: pnpm build  # debug 모드
      - run: pnpm preview --port 5173 &
      - run: pnpm test:e2e:golden  # tests/e2e/golden-path.spec.ts 만
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-golden-path-trace
          path: |
            test-results/
            playwright-report/
```

### 5.4 머지 차단 룰

- GitHub 브랜치 보호 규칙:
  - `develop` — required status checks: `lint`, `typecheck`, `vitest`, **`e2e-golden-path`**.
  - `main` — required status checks: 위 + `e2e-full-matrix` (3 브라우저).
- **bypass 금지**. admin 권한자라 하더라도 골든 패스 fail PR 을 머지하려면 본 문서 §2 단계 표를 함께 줄이는 PR 을 별도로 올려야 한다.

---

## 6. a11y 검증 통합

### 6.1 자동 검사 위치

골든 패스 spec 안에서 **다음 시점에 `@axe-core/playwright` 를 실행하고 violation 0 을 강제**한다:

| 시점 | 페이지 | 강제 룰 |
|---|---|---|
| G1 종료 후 | `/login` | violations = 0 |
| G3 종료 후 | `/markets` (empty) | violations = 0 |
| G6 시작 후 | `/register/new?step=1` | violations = 0 (선택 검증, 폼 라벨 회귀 방지) |
| G10 종료 후 | `/register/new` 완료 화면 | violations = 0 |
| G11 종료 후 | `/history` | violations = 0 |

### 6.2 axe 규칙 셋

- 기본: `wcag2a`, `wcag2aa`, `wcag21aa`.
- 비활성: 없음. (모든 violation = 실패)
- 예외 등록 절차: 만약 라이브러리 한계로 일시 우회가 필요하면, axe `disableRules` 와 함께 **만료일** 을 spec 코드 주석에 명시. 만료일 초과 시 CI 실패하도록 헬퍼에서 강제.

### 6.3 lint 시점 a11y (보완)

`eslint-plugin-jsx-a11y` 가 PR 단계에서 JSX 차원의 a11y 위반을 차단한다. axe (E2E) 는 런타임 차원, eslint (lint) 는 정적 차원. 둘 다 통과해야 머지.

---

## 7. debug 모드 동등성 검증 (debug ≠ real)

> **ISTJ 검증자의 첫 번째 의심**: "debug 에서 통과했으니까 real 에서도 통과한다" — **거짓**.
> MSW 핸들러가 실제 마켓 API 응답 스키마를 100% 반영하지 못한다는 가정으로 운영한다.

### 7.1 debug 모드 (자동화 강제)

- 실행: PR → develop 단계, CI 자동.
- 환경: debug Supabase 프로젝트 + MSW.
- 결과: PR 머지 게이트.

### 7.2 real 모드 (수동 QA, release/* 단계)

- 실행: `release/x.y.z` 브랜치 생성 후, 운영자가 **체크리스트 1회 실행**.
- 환경: real Supabase 프로젝트 + 마켓 sandbox API (스마트스토어 sandbox / 쿠팡 sandbox).
- 체크리스트 (`docs/architecture/v1/qa/release-checklist.md` 와 양방향 링크):
  1. G1~G11 을 수동으로 실행, 각 단계 스크린샷 1장 첨부.
  2. 마켓 sandbox 에서 실제 OAuth 콜백 (redirect URL 등록 확인).
  3. 실제로 등록된 상품이 sandbox 마켓 콘솔에 노출되는지 확인.
  4. 등록 후 즉시 sandbox 콘솔에서 상품 비활성화 / 삭제 (테스트 잔재 방지).
  5. Sentry 이벤트에 토큰 / 비밀번호 / 이메일 문자열이 노출되지 않는지 grep.

### 7.3 모드 차이 자동 감시

다음 검사를 골든 패스 spec 안에 추가한다 — debug 시나리오라도 모드 차이의 단서를 잡기 위함이다:

- 환경 변수 `VITE_APP_MODE` 가 spec 시작 시점에 `debug` 인지 assertion (real 모드에서 본 spec 이 실수로 돌면 차단).
- MSW 핸들러가 단 한 번이라도 fallback (`onUnhandledRequest='error'`) 으로 빠지면 spec 실패. → real API 가 MSW 가 모르는 새 엔드포인트를 호출하기 시작했다는 신호.

```ts
test.beforeAll(() => {
  if (process.env.VITE_APP_MODE !== 'debug') {
    throw new Error('Golden Path Playwright spec must run in debug mode. real 모드는 §7.2 수동 절차로.');
  }
});
```

---

## 8. 실패 시 조치

### 8.1 PR 머지 차단 룰 (재확인)

- 골든 패스 spec 의 어느 단계라도 `failed` / `skipped` / `timedOut` → PR 머지 차단.
- `test.skip` / `test.fixme` / `test.only` 가 spec 파일에 포함된 PR → CI 단계에서 정적 grep 으로 차단.

```bash
# .github/workflows/ci.yml 의 e2e job 전 단계에서 실행
if grep -RE '\b(test\.only|test\.skip|test\.fixme)\b' tests/e2e/golden-path.spec.ts; then
  echo "❌ 골든 패스 spec 에 only / skip / fixme 가 있습니다. 머지 차단."
  exit 1
fi
```

### 8.2 디버깅 절차 (실패 PR 작성자용)

1. CI artifact `playwright-golden-path-trace` 다운로드.
2. `pnpm exec playwright show-trace test-results/.../trace.zip` 로 trace viewer 열기.
3. 실패 직전 액션의 DOM 스냅샷 / 네트워크 / 콘솔 확인.
4. 로컬 재현: `pnpm seed:golden-path && pnpm test:e2e:golden --headed --debug`.
5. 원인 분류:
   - **컴포넌트 회귀** → 해당 feature 의 Vitest / RTL 테스트 보강 후 재실행.
   - **마켓 어댑터 회귀** → MSW 핸들러 / 어댑터 둘 다 점검. testing.md §3.2 표를 갱신할지 검토.
   - **시드 / DB 상태 문제** → `tests/fixtures/seed/golden-path.sql` 멱등성 점검.
   - **타이밍 / flaky** → 임계값을 늘리지 말고 **결정적 신호 (Realtime 이벤트 / DB 폴링) 로 대체**. timeout 늘리는 핫픽스는 거부.
6. 수정 후 PR 에 다음을 첨부:
   - 실패 원인 (1~2 문장)
   - 회귀 방지를 위해 추가한 테스트 (Vitest / RTL / spec 보강)

### 8.3 스크린샷 / 비디오 자동 캡처

`playwright.config.ts`:

```ts
export default defineConfig({
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  retries: 0, // 골든 패스는 retry 금지. flaky 면 spec 자체를 고친다.
  reporter: [['html', { open: 'never' }], ['list']],
});
```

> **retry 금지 이유**: 재시도로 통과하는 시나리오는 "운으로 통과하는 시나리오" 다. 운영에서도 운에 맡길 것이 아니라면 spec 을 결정적으로 고쳐라.

### 8.4 알림

- CI 실패 시 PR 코멘트 자동 게시 (GitHub Actions `actions/github-script`):
  - 실패 단계 (G1~G11 중 어느 것).
  - artifact 다운로드 링크.
  - 본 문서 §8.2 디버깅 절차 링크.

---

## 9. 확장 시나리오 (필수 아닌 강력 권장)

> 본 문서의 메인 시나리오는 1개 (성공 경로) 만 강제한다. 그러나 다음 3개는 별도 spec 으로 작성해 두기를 강력 권장한다. **CI 에서 P0 으로 함께 실행**한다.

### 9.1 partial 시나리오 (`tests/e2e/golden-path-partial.spec.ts`)

- 차이점: G10 에서 MSW 가 쿠팡만 500 응답.
- 기대:
  - `registration_jobs.status = 'partial'`.
  - 스마트스토어 결과 `success` + 외부 URL.
  - 쿠팡 결과 `failed` + 에러 메시지 (ErrorMessage 접힘 컴포넌트).
  - "재시도" 버튼 활성, "마켓 제외 등록" 버튼 활성.
  - Sentry 이벤트 1건 (쿠팡 5xx).
- 매트릭스 ID: `QA-REG-PARTIAL-001`.

### 9.2 retry 시나리오 (`tests/e2e/golden-path-retry.spec.ts`)

- 차이점: G10 에서 쿠팡이 첫 호출 429 (`Retry-After: 1`), 두 번째 호출 200.
- 기대:
  - 잡 상태 `pending → running → retrying → succeeded`.
  - Edge Function 로그에 backoff 흔적.
  - 사용자 UI 에는 "잠시 후 재시도 중" 표시 후 최종 success.
- 매트릭스 ID: `QA-REG-RETRY-001`.

### 9.3 마켓 제외 후 재등록 (`tests/e2e/golden-path-skip-market.spec.ts`)

- 차이점: 9.1 partial 결과에서 사용자가 "쿠팡 제외하고 잡 종료" 클릭.
- 기대:
  - 잡 상태 `succeeded` 로 종결 (제외된 마켓은 결과 행 `status='skipped'`).
  - 등록 이력에서 마켓 컬럼에 `naver` 만 표시.
- 매트릭스 ID: `QA-REG-SKIPMARKET-001`.

---

## 10. 수락 기준 체크리스트

본 문서가 "완성" 되었다고 보려면 다음이 전부 통과해야 한다. PR 리뷰어는 체크리스트로 검수한다.

- [ ] `tests/e2e/golden-path.spec.ts` 가 존재하고 §4 의 구조를 따른다.
- [ ] `tests/fixtures/seed/golden-path.sql` 가 멱등하다 (두 번 실행해도 같은 상태).
- [ ] `tests/fixtures/images/sample-256.jpg` 가 커밋되어 있고 256x256 JPEG 다.
- [ ] `tests/fixtures/msw/{oauth,categories,products}.ts` 가 success 핸들러를 제공한다.
- [ ] §2 단계 표의 G1~G11 모든 단계가 spec 에 1:1 로 구현되어 있다.
- [ ] 각 단계의 검증이 DOM **+** DB **+** (해당 시) Storage / Sentry 중 적어도 2개 차원에서 이뤄진다.
- [ ] §6 의 axe 검증 시점 4개가 spec 안에 포함되어 있다.
- [ ] `eslint-plugin-jsx-a11y` 가 lint 단계에서 활성화되어 있다.
- [ ] CI `.github/workflows/ci.yml` 에 `e2e-golden-path` job 이 있고, develop / main 브랜치 보호 규칙의 required check 다.
- [ ] CI 단계에 `test.only` / `test.skip` / `test.fixme` 정적 grep 차단이 있다.
- [ ] `playwright.config.ts` 의 `retries=0`, `trace='on-first-retry'`, `screenshot='only-on-failure'`, `video='retain-on-failure'` 설정이 적용되어 있다.
- [ ] spec 실행 시간이 90초 이내 (CI Chromium 헤드리스).
- [ ] real 모드 수동 QA 체크리스트 (`docs/architecture/v1/qa/release-checklist.md`) 에서 본 문서를 참조한다.
- [ ] 본 문서가 `docs/architecture/v1/testing.md` §3 과 양방향 링크되어 있다.
- [ ] `docs/architecture/v1/qa-matrix.md` 에 `QA-P5-GOLDEN` 행이 존재하며 상태가 `pending` 또는 `pass`.

> **체크리스트 1개라도 비어있으면 본 문서는 "초안" 으로 간주**하고, 골든 패스 자동화 강제는 아직 시작되지 않은 것으로 본다 (qa-matrix.md `QA-P5-GOLDEN` = `pending`).

---

## 11. 유지보수

### 11.1 시나리오 변경이 필요한 경우

다음 변화가 발생하면 본 문서의 §2 표 / spec 코드 / QA 매트릭스를 **함께** 갱신한다. 셋 중 하나만 바꾸는 PR 은 거부.

| 변화 | 갱신해야 하는 곳 |
|---|---|
| 로그인 폼 라벨 변경 (`이메일` → `Email` 등) | §2 G1 / G2 + spec selectors + features/auth.md + frontend.md |
| 마켓 카드 상태 라벨 변경 (`연결됨` → `Active`) | §2 G4 / G5 + spec + features/markets.md |
| 등록 위저드 Step 추가 / 삭제 | §2 G6~G10 전체 재작성 + features/registration.md + testing.md §3.2 |
| 신규 마켓 어댑터 추가 (11번가 등) | 골든 패스에는 추가하지 않음 (v1 범위 = 2마켓 고정). 별도 spec. |
| 카테고리 트리 구조 변경 | §3.1 시드 SQL + MSW categories 핸들러 |
| 이미지 fixture 변경 | §3.3 + spec G7 + Storage 검증 헬퍼 |

### 11.2 책임자

- **PR 작성자**: 본인이 만든 변경이 골든 패스의 어느 단계에 영향이 가는지 PR 본문에 표기 (`Golden Path Impact: G6, G8`).
- **QA 에이전트**: 영향받는 단계의 검증 충분성 확인. 부족하면 거부.
- **백엔드 / 프론트엔드 에이전트**: 영향받는 단계의 spec 갱신을 동일 PR 에서 제출.

### 11.3 주기적 점검

- `release/*` 브랜치 생성 시점마다 본 문서 §10 체크리스트 전체 통과 여부 재검증.
- 새 마켓 어댑터 / Step / 라우트 / RLS 정책이 도입될 때마다 본 문서를 갱신한다. 별도 fork 없이 v1 골든 패스 단일 문서로 유지.

---

## 부록 A. testing.md §3.2 (G1~G10) 와 본 문서 (G1~G11) 매핑

| testing.md §3.2 | 본 문서 §2 |
|---|---|
| G1 (로그인) | G1 (로그인 페이지 진입) + G2 (제출) |
| G2 (마켓 목록) | G3 |
| G3 (스마트스토어 OAuth) | G4 |
| G4 (쿠팡 OAuth) | G5 |
| G5 (Step 1 정보) | G6 |
| G6 (Step 2 이미지) | G7 |
| G7 (Step 3 마켓·카테고리) | G8 |
| G8 (Step 4 미리보기) | G9 |
| G9 (Step 5 일괄 등록) | G10 |
| G10 (이력) | G11 |

testing.md §3.2 를 갱신할 때 본 부록 표도 동시에 갱신한다. 매핑이 깨지면 두 문서가 같은 시나리오를 다르게 부르게 되며, QA 코멘트에서 사고가 난다.

---

## 부록 B. "이렇게 묻지 말 것" 목록

본 문서를 읽고도 다음과 같이 묻는 PR / 코멘트는 즉시 반려한다:

- "골든 패스 실패는 일시적인 거 같으니 retry 해보면 안 되나요?" → §8.3 retry 금지.
- "수동으로 한 번 더 돌려봤더니 되던데요" → §1.1 자동화 강제.
- "이번 PR 은 작은 스타일 변경이라 G1~G11 영향 없어요" → §11.1 영향 표기 의무.
- "11번가 어댑터도 골든 패스에 넣어야 하지 않나요?" → §1.2 v1 범위 = 2마켓 고정.
- "axe 통과는 너무 빡세지 않나요?" → §6.2 예외 없음. 만료일 명시한 disableRules 만 한시 허용.
- "real 모드는 자동화하지 말죠?" → §7.2 release 단계 수동 QA 는 자동화 회피가 아니라 별도 절차.

---

> **문서 종료**.
> 본 문서가 다루지 않는 모든 실패 / 부분 / 권한 / 401 / 429 / 5xx 시나리오는 각 `features/*.md` 의 QA 매트릭스가 책임진다. 골든 패스는 "성공 경로 1개" 만 본다. 그 1개가 항상 통과한다는 것을 보증하는 것이 본 문서의 유일한 책임이다.
