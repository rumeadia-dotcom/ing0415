# Testing Strategy (v1) — 테스트 전략 헌법

> 이 문서는 Phase 1~5 의 모든 기능 설계문서 (`docs/architecture/v1/features/*.md`) 가
> 인용해야 하는 **유일한 테스트 전략 ground truth** 다.
> 작성자: QA (ISTJ). "괜찮다 / 충분하다 / 잘 된다" 같은 정성 표현은 본 문서에서 거부된다.
> 통과 기준은 **명시적 자동화 + 명시적 수락 기준 행** 으로만 정의된다.

---

## 0. 헌법 조항 (Hard Rules)

1. **행복 경로만 다룬 PR / 설계문서 / 기능 문서는 거부된다.** 거부 사유는 §5 의 8종 실패 시나리오 누락.
2. **수락 기준 매트릭스 행이 없는 기능은 PR 진입 자체가 차단된다.** §4 양식을 따른다.
3. **골든 패스 (§3) 가 깨진 PR 은 `main` 머지가 차단된다.** 예외 없음.
4. **debug 모드에서만 검증된 기능은 통과로 보지 않는다.** §12 의 격차 검증 통과 필수.
5. **모든 외부 데이터 (마켓 API 응답, Supabase 응답, URL search params) 는 zod 스키마로 런타임 검증된다.** 스키마 없는 외부 데이터 사용은 거부된다.
6. **자동화 불가능한 수락 기준은 매트릭스에 `자동화: 수동` + 수동 절차 링크 + 책임자 + 만료일을 명시한다.** "수동으로 한번 더" 거부.
7. **MVP 범위 (CLAUDE.md "MVP 범위") 밖 시나리오는 `carry-over` 로 명시한다.** 누락 거부.

---

## 1. 목적 · 범위

### 1.1 목적

- 5개 마켓 (v1 은 스마트스토어 + 쿠팡) 으로의 상품 등록이 **데이터 손실·중복·권한 누수 없이** 동작함을 자동화로 증명한다.
- 외부 마켓 API 의 변동 (스펙 변경 / 장애 / rate limit / OAuth 만료) 이 발생해도 회귀를 검출한다.
- 셀러 간 데이터 격리 (RLS) 가 모든 진입 경로 (UI / Edge Function / 직접 PostgREST) 에서 유지됨을 검증한다.

### 1.2 범위

- **포함**: Vitest 단위·통합, React Testing Library, Playwright E2E, axe-core a11y, MSW 마켓 mock, Supabase 로컬 (RLS).
- **제외 (v1)**: 성능 부하 테스트 (k6 등), 시각 회귀 (Percy 등), Stripe / 결제 (MVP 범위 외).
- **carry-over (v2)**: 11번가 / G마켓 / 옥션 어댑터 E2E. 인터페이스 단위 테스트는 v1 에서도 채운다.

### 1.3 테스트 피라미드

```
                ┌───────────────────────────┐
                │  E2E (Playwright + axe)   │   ← 5 % : 골든 패스 1 + 실패 시나리오 4
                │   브라우저 · 풀스택       │   목적: 회귀 잡기, 통합 보증
                └───────────┬───────────────┘
                            │
                ┌───────────┴───────────────┐
                │ Integration (Vitest+RTL+  │   ← 25 % : 화면 단위 / 훅 / Supabase 로컬 + RLS
                │ Supabase local + MSW)     │
                └───────────┬───────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │ Unit (Vitest)                         │   ← 70 % : zod 스키마, 어댑터 transform,
        │ 순수 함수 / 상태 전이 / 변환 / 유틸    │     상태 전이, 매핑, 유틸
        └───────────────────────────────────────┘

           a11y 는 별도 횡단 레이어:
              · lint 시점 (eslint-plugin-jsx-a11y) → unit 단계와 함께 실행
              · E2E 시점 (@axe-core/playwright)   → E2E 단계와 함께 실행
```

**책임 경계**:
- Unit: 외부 의존 없음. 네트워크·DB·브라우저 사용 금지. 한 함수 / 한 모듈.
- Integration: 한 화면 + 모킹된 외부 (MSW) 또는 Supabase 로컬. 라우터·Query·폼 결합 검증.
- E2E: 진짜 브라우저 (Chromium) + Supabase 로컬 + MSW 마켓 어댑터. **사용자 동선** 단위.
- a11y: 모든 라우트 1회 이상 axe 통과. lint 는 jsx 작성 시점에 잡는다.

---

## 2. 도구 책임 분담

| 도구 | 책임 | 사용 금지 영역 |
|---|---|---|
| **Vitest** | 단위 / 통합. zod 스키마 parse 검증, 마켓 어댑터 transformProduct, RegistrationJob 상태 전이 함수, 유틸. | 실제 브라우저 렌더링, 실제 네트워크 호출. |
| **React Testing Library** | 컴포넌트 렌더 + 사용자 인터랙션 시뮬레이션. 셀러가 화면을 보는 방식대로 검증. | 구현 디테일 (state, props) 직접 검증 금지. |
| **Playwright** | E2E. Chromium 1순위. WebKit / Firefox 는 골든 패스 1개에 한해 main 매트릭스에서 실행. | 단일 컴포넌트 검증 (RTL 영역 침범 금지). |
| **@axe-core/playwright** | E2E 단계 a11y 자동 검출. 모든 라우트 / 모든 모달 1회 이상 axe 결과 `violations.length === 0`. | 디자인 토큰 검증, 시각 회귀. |
| **eslint-plugin-jsx-a11y** | lint 시점에 미리 a11y 규칙 위반 차단 (alt, role, aria-*, label, autofocus 등). | 런타임 검출 (axe 영역). |
| **MSW (Mock Service Worker)** | 마켓 API mock. RTL / Playwright 양쪽에서 같은 핸들러 재사용. 5xx / 4xx / 429 / 401 / timeout / 부분 성공 시나리오 토글. | 마켓 어댑터 자체 (debug 어댑터는 별도 — §12). |

**RTL 셀러터 우선순위 (강제)**: `getByRole` > `getByLabelText` > `getByPlaceholderText` > `getByText` > `getByDisplayValue` > `getByAltText` > `getByTitle` > `getByTestId`.
`getByTestId` 사용 시 PR 에 사유 명시. 무분별한 `data-testid` 추가는 거부.

---

## 3. 골든 패스 (필수 자동화 — main 머지 차단 기준)

### 3.1 시나리오 (Playwright 1 시나리오로 자동화)

> **s1 로그인 → s5 마켓 연결 (스마트스토어 + 쿠팡, mock OAuth) → s3 상품 등록 5단계 → s6 이력 확인**

### 3.2 단계별 기대값 표

| # | 단계 | 입력 / 조작 | 기대 결과 (관측 가능한 화면 상태) | 자동화 검증 방식 |
|---|---|---|---|---|
| G1 | s1 로그인 | seed 셀러 `qa@marketcast.test` / pw `Qa!12345` 입력 후 "로그인" 클릭 | `/dashboard` 로 리디렉트. 헤더에 셀러 이메일 노출. | `await expect(page).toHaveURL(/\/dashboard$/)` + `getByRole('navigation')` 에서 이메일 확인 |
| G2 | s5 마켓 목록 진입 | 사이드바 "마켓 계정" 클릭 | 연결된 마켓 0개 상태 UI (`empty` 상태 메시지 노출, "연결 추가" 버튼 활성) | `getByText('연결된 마켓이 없습니다')` + axe 통과 |
| G3 | 스마트스토어 OAuth | "스마트스토어 연결" → mock OAuth 콜백 (MSW: 200, `access_token`, `refresh_token`, `expires_in=3600`) | 마켓 카드에 연결 상태 = `connected`, 다음 갱신 예정 시각 노출 | DB 직접 검증: `market_accounts` 행 1, `access_token` 컬럼은 평문 아님 (`pgcrypto` 또는 vault 적용 여부 확인) |
| G4 | 쿠팡 OAuth | "쿠팡 연결" → mock OAuth 콜백 (MSW: 200) | 마켓 카드 2개, 상태 모두 `connected` | 위와 동일 |
| G5 | s3 상품 등록 1/5 정보 입력 | "상품 등록" → 상품명 / 가격 / 설명 / 배송 입력 | "다음" 버튼 활성. 필수 누락 시 "다음" disabled + `blockingReasons` tooltip 노출. | RHF + zod 에러 메시지 RTL/Playwright 양쪽에서 라벨로 캡처 |
| G6 | 2/5 이미지 | 1024x1024 jpg 3장 업로드 (fixture) | 마켓별 변환 미리보기 3종 노출 (스마트스토어 / 쿠팡 / 원본). 파일 크기·해상도 표시. | DOM 검증 + Supabase Storage 객체 존재 검증 |
| G7 | 3/5 마켓·카테고리 | 두 마켓 모두 선택. 각각 카테고리 매핑 (스마트스토어 "가전 > 주방가전", 쿠팡 동등). | "다음" 활성. 카테고리 코드 매핑 결과 노출. | 매핑 결과 DOM + `market_mappings` insert 검증 |
| G8 | 4/5 미리보기 | 미리보기 화면 노출 | 마켓별 페이로드 요약 (필수 필드 채워짐), 경고 없음. | DOM + zod `MarketPayloadSchema` 통과 검증 |
| G9 | 5/5 일괄 등록 실행 | "등록 시작" 클릭. MSW: 두 마켓 모두 200 응답, `externalId` 반환 | `RegistrationJob` 상태 `running` → `succeeded`. 각 마켓 결과 `success` + 외부 URL 링크. | Postgres `registration_jobs.status='succeeded'` polling + Realtime 이벤트 수신 검증 |
| G10 | s6 이력 진입 | 사이드바 "등록 이력" 클릭 | 방금 등록한 잡 1행 노출. 상태 `succeeded`. 마켓별 외부 URL 클릭 가능. | DOM + URL 정합성 검증 |

### 3.3 골든 패스 메타

- **위치**: `tests/e2e/golden-path.spec.ts`
- **실행 시간 상한**: 90초 (CI Chromium 헤드리스 기준). 초과 시 회귀로 간주 → 조사.
- **mock OAuth 콜백 핸들러**: `tests/fixtures/msw/oauth.ts` (스마트스토어 / 쿠팡 각각 별도 핸들러 export).
- **시드 데이터**: `tests/fixtures/seed/golden-path.sql` — seed 셀러 1, 상품 카테고리 트리 mock.

### 3.4 QA 거부권

골든 패스 spec 의 어떤 단계라도 실패 / 스킵 / 타임아웃이면 `main` 브랜치 머지 차단.
우회 (skip / xit / fixme) PR 도 거부. 시나리오 변경은 본 문서 §3.2 표 갱신 + QA 매트릭스 갱신 동반.

---

## 4. 수락 기준 매트릭스 양식 (Phase 2~5 features/*.md 강제)

### 4.1 표 양식

```
| ID | Given | When | Then | 자동화 | Priority |
|----|-------|------|------|--------|----------|
```

- **ID**: `QA-<도메인>-<3자리>` (예: `QA-REG-001`, `QA-MKT-014`). 매트릭스 전역에서 unique.
- **Given**: 검증 가능한 사전 조건. "셀러가 로그인되어 있다" 같은 모호한 표현 금지 → "셀러 `seller_id=...` 가 로그인 + 마켓 연결 0개".
- **When**: 사용자 / 시스템 트리거. 단일 행위.
- **Then**: 관측 가능한 결과 (DOM / DB / API 응답 / 로그).
- **자동화**: `Vitest` / `RTL` / `Playwright` / `axe` / `RLS-SQL` / `수동` 중 하나 이상. `수동` 은 수동 절차 파일 링크 + 만료일 필수.
- **Priority**: `P0` (골든 패스 / 보안 / 데이터 정합) / `P1` (주요 기능) / `P2` (보조 동선).

### 4.2 예시 행 (참고용)

| ID | Given | When | Then | 자동화 | Priority |
|----|-------|------|------|------|----------|
| QA-REG-001 | 셀러 A 가 상품 5개 + 마켓 2개 (스마트스토어, 쿠팡) 연결 상태. 쿠팡 어댑터 MSW 가 5xx 반환 설정. | `RegistrationJob` 생성 후 일괄 등록 실행 | 잡 상태 `partial`. 스마트스토어 5건 `success`, 쿠팡 5건 `failed`. UI 에 "재시도" 버튼 + 실패 사유 stack 접힘 노출. Sentry 이벤트 1건 발생. | Playwright + Vitest (상태 전이) + RLS-SQL | P0 |
| QA-MKT-014 | 셀러 A 의 스마트스토어 `refresh_token` 이 만료된 상태. | 셀러 A 가 상품 등록 화면 진입 | 마켓 카드 상태 `expired`. 등록 위저드 G3 단계에서 "재인증 필요" blockingReason 노출. 자동 재인증 시도 1회 후 실패 시 OAuth 시작 페이지로 안내. | Playwright + MSW (401 응답) | P0 |
| QA-AUTH-007 | 셀러 B 가 셀러 A 의 `registration_job_id` URL 을 직접 입력 | URL 진입 | 화면은 404 / 403. PostgREST 직접 호출도 RLS 거부. Sentry 에 PII 없는 로그만 남음. | RLS-SQL + Playwright | P0 |

### 4.3 채움 책임

- 기능 작성자: 매트릭스에 모든 수락 기준을 `pending` 상태로 등록.
- QA: 자동화 가능 / 불가능 판정. 자동화 누락은 거부 사유.
- 백엔드 / 프론트: 자동화 구현. 통과 시 PR 에서 상태 `pending → pass` 갱신.
- 마켓 어댑터 변경 PR: 해당 어댑터를 참조하는 모든 매트릭스 행을 `pending` 으로 재변경 + 재검증.

---

## 5. 실패 시나리오 강제 (행복 경로 금지)

모든 `features/*.md` 의 매트릭스에는 **다음 시나리오를 각각 1행 이상** 포함해야 한다.
누락 시 QA 거부. 거부 코멘트 양식은 `docs/architecture/v1/qa/` 의 검수 템플릿을 따른다.

| 분류 | 강제 시나리오 |
|---|---|
| **마켓 API 5xx** | 어댑터가 502/503/504 받았을 때 UI 상태 + 재시도 정책 + 로그 + Sentry. |
| **마켓 API 4xx (검증 오류)** | 페이로드 검증 실패 (400). 사용자에게 어느 필드가 문제인지 표시. raw response 는 ErrorMessage 접힘. |
| **마켓 API 429 (rate limit)** | `Retry-After` 헤더 존중. 자동 백오프 1회. 실패 누적 시 잡 자체 `failed` 처리. |
| **마켓 API 401 (토큰 만료)** | `refresh_token` 자동 갱신 시도 → 실패 시 `MarketAccount.status='expired'` + 재인증 안내. |
| **부분 실패 (2 중 1 성공)** | `RegistrationJob.status='partial'`. 성공 마켓은 외부 URL 노출, 실패 마켓은 재시도 버튼. |
| **네트워크 끊김** | Edge Function 호출 자체 실패 (offline / DNS / timeout). 재시도 큐 등록. 사용자에게 "네트워크 확인" 안내. |
| **동시 입력 충돌** | 같은 셀러가 두 탭에서 동일 `Product` 에 대해 동시 `RegistrationJob` 생성 시도. DB unique constraint (혹은 advisory lock) 로 한 쪽만 성공. |
| **권한 누수 (RLS)** | 셀러 B 가 셀러 A 의 리소스 (Product / RegistrationJob / MarketAccount) URL / API 직접 접근. 403 / 404 + 감사 로그. |

**거부 룰**:
- 위 8종 중 1개라도 매트릭스에 행이 없는 features 문서: **거부**.
- 자동화 컬럼이 비어있거나 `수동` 이면서 만료일 없는 행: **거부**.

---

## 6. 단위 테스트 가이드라인 (Vitest)

### 6.1 zod 스키마

- 모든 스키마는 `parse pass` + `parse fail` 케이스 각각 최소 1개.
- pass: 정상 데이터 → `safeParse({...}).success === true` + 파생 타입 사용 가능.
- fail: 한 필드씩 누락 / 잘못된 타입 / 경계값 (음수 가격, 빈 배열, undefined). `safeParse` 의 `error.issues` 배열에서 정확한 path 검증.

```ts
// 예시 (실제 코드 작성 시 features 문서에 동일 형태로 포함)
describe('ProductSchema', () => {
  it('가격이 음수면 parse 실패', () => {
    const res = ProductSchema.safeParse({ ...valid, price: -1 });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0].path).toEqual(['price']);
  });
});
```

### 6.2 마켓 어댑터 transformProduct

- 각 마켓 어댑터마다 fixture `Product` → 기대 `MarketPayload` 비교 (snapshot 또는 deep equal).
- 이미지 변환은 별도 함수로 분리 후 단위 검증.
- 필수 필드 누락 시 어댑터가 명확한 에러를 throw 하는지 확인.

### 6.3 RegistrationJob 상태 전이 함수

상위 상태는 `pending` / `running` / `partial` / `succeeded` / `failed` / `retrying` / `cancelled` (7상태).
**합법 전이 / 불법 전이 모두 케이스를 둔다.** 불법 전이 시 함수가 throw 또는 명시적 에러 반환.

| from \ to | pending | running | partial | succeeded | failed | retrying | cancelled |
|---|---|---|---|---|---|---|---|
| pending   | -  | OK | x  | x  | x  | x  | OK |
| running   | x  | -  | OK | OK | OK | x  | OK |
| partial   | x  | x  | -  | x  | x  | OK | OK |
| succeeded | x  | x  | x  | -  | x  | x  | x  |
| failed    | x  | x  | x  | x  | -  | OK | x  |
| retrying  | x  | OK | x  | x  | OK | -  | OK |
| cancelled | x  | x  | x  | x  | x  | x  | -  |

> `OK` = 합법, `x` = 불법 (throw 필수), `-` = self.
> 합법 7건 + 불법 35건, 총 42 케이스 강제. backend 가 표 갱신 시 본 문서 동시 갱신.

---

## 7. 통합 테스트 가이드라인

### 7.1 Supabase 로컬

- `supabase start` 로 로컬 Postgres + Auth + Storage 기동.
- 마이그레이션 적용 후 시드 실행: `pnpm db:seed:test`.
- 각 테스트 시작 시 트랜잭션 wrapping 또는 truncate. 테스트 간 데이터 누수 금지.

### 7.2 RLS 검증 SQL

- 모든 셀러 데이터 테이블 (`products`, `templates`, `market_accounts`, `registration_jobs`, `registration_job_market_results`, `events`, `sessions`, `nps_responses`) 은 RLS 정책 단위 테스트 필수.
- 테스트 방식: 두 명의 seed 셀러 (A, B) 로그인 JWT 각각 발급 → A 의 데이터에 B 가 `SELECT / UPDATE / DELETE` 시도 → 0 rows 또는 에러 확인.

```sql
-- 예시: B 가 A 의 registration_job 접근 불가
set local role authenticated;
set local request.jwt.claims to '{"sub":"<B-uuid>"}';
select count(*) from registration_jobs where seller_id = '<A-uuid>';
-- 기대: 0
```

- RLS 정책 없는 테이블 발견 시 자동 거부 (lint or CI 스크립트).

### 7.3 React Testing Library 통합

- 화면 단위로 `<QueryClientProvider>` + `<MemoryRouter initialEntries={[...]}>` + MSW 핸들러 결합.
- 4상태 (`loading` / `data` / `error` / `empty`) 모두 렌더 검증. RegistrationJob 화면은 `partial` 추가.

---

## 8. E2E 가이드라인 (Playwright)

### 8.1 데이터 시드

- 시나리오마다 SQL fixture 1개씩 (`tests/fixtures/seed/<scenario>.sql`).
- Playwright `globalSetup` 에서 Supabase 로컬에 시드 적용 + truncate. 시나리오 간 격리.

### 8.2 실패 재현

- MSW 마켓 핸들러는 헤더 / 쿼리 파라미터로 시나리오 토글 (`x-msw-scenario: 5xx`, `429`, `401`, `partial`, `timeout`).
- 같은 spec 안에서 `await route.use(scenario('429'))` 같은 헬퍼로 시나리오 변경.

### 8.3 브라우저 매트릭스

| 트리거 | Chromium | WebKit | Firefox |
|---|---|---|---|
| PR (develop) | 골든 패스 1 + 핵심 실패 4 | x | x |
| main 머지 | 전체 spec | 골든 패스 1 | 골든 패스 1 |
| release 브랜치 | 전체 spec | 전체 spec | 전체 spec |

### 8.4 안정성 룰

- `await page.waitForTimeout(...)` 금지. `expect(...).toHaveText(...)` / `toBeVisible()` 으로 대기.
- flaky 스펙은 `test.fixme` 가 아니라 즉시 조사. 3회 연속 실패 시 자동 issue 생성 (CI 훅).

---

## 9. 접근성 자동화 (WCAG 2.1 AA)

### 9.1 lint 시점 — `eslint-plugin-jsx-a11y`

- `recommended` + 다음 추가 룰을 error 레벨로 강제:
  - `jsx-a11y/anchor-is-valid`
  - `jsx-a11y/click-events-have-key-events`
  - `jsx-a11y/no-static-element-interactions`
  - `jsx-a11y/label-has-associated-control`
- 위반 = PR 차단.

### 9.2 E2E 시점 — `@axe-core/playwright`

- 골든 패스의 G2 / G5 / G8 / G10 + 모달이 열리는 모든 시점에서 `await new AxeBuilder({ page }).analyze()`.
- `violations.length === 0` 이 통과 기준. `incomplete` 는 P1 으로 기록 후 다음 sprint 내 해결.
- 모든 라우트 1회 이상 통과 강제. 새 라우트 추가 시 axe 통과 테스트 동반 PR.

### 9.3 수동 검증 (자동화 불가 영역)

- **키보드만으로 전체 동선 통과**: 골든 패스 G1~G10 을 Tab / Shift+Tab / Enter / Space / Esc 로만 완주. focus ring 가시성 확인.
- **색상 대비 4.5:1**: 디자인 토큰 추가 시 Contrast checker (수동) + 다크 / 라이트 양쪽.
- **aria 라벨**: 아이콘 only 버튼 / 마켓 아이콘 / 토글 등에 `aria-label` 명시. RTL 셀러터로 같이 검증되면 자동화 영역으로 승격.

수동 절차는 `docs/architecture/v1/qa/manual-a11y-checklist.md` (별도 문서, QA 가 채움) 링크.

---

## 10. CI 통합

### 10.1 PR (대상: `develop`)

```
1. pnpm install --frozen-lockfile
2. pnpm tsc --noEmit            # 타입 오류 0
3. pnpm lint                    # eslint (jsx-a11y 포함) 0 error
4. pnpm test:unit               # vitest run (단위 + 통합) coverage report 첨부
5. pnpm build                   # debug 모드 빌드 sanity check
6. pnpm test:e2e:golden         # Playwright (Chromium 헤드리스) — 골든 패스 1 + 핵심 실패 4
```

- 6번 실패 시 머지 차단.
- 5번 다음에 `pnpm build:real` 도 sanity check (sourcemap 비활성 / mock 미포함 확인 — §12).

### 10.2 `main` 머지 시

```
1. pnpm build:real
2. pnpm test:e2e:full           # Chromium 전체 + WebKit / Firefox 골든 패스
3. axe 결과 PR comment 자동 첨부
4. supabase functions deploy
5. gh-pages 배포
```

- 2번 실패 시 자동 롤백 PR 생성.

### 10.3 release 브랜치

- 전체 매트릭스 (브라우저 3종 풀 스펙) + 수동 a11y 체크리스트 통과 후 main 으로.

---

## 11. 테스트 데이터 / 픽스처 관리

### 11.1 디렉토리 구조

```
tests/
├── fixtures/
│   ├── seed/                       ← Supabase 시드 SQL
│   │   ├── golden-path.sql
│   │   ├── rls-two-sellers.sql
│   │   └── registration-partial.sql
│   ├── msw/                        ← MSW 마켓 핸들러
│   │   ├── oauth.ts                  · 스마트스토어 / 쿠팡 OAuth mock
│   │   ├── smartstore/
│   │   │   ├── success.json
│   │   │   ├── 5xx.json
│   │   │   ├── 4xx-validation.json
│   │   │   ├── 429-rate-limit.json
│   │   │   └── 401-token-expired.json
│   │   └── coupang/...
│   ├── images/                     ← 업로드용 이미지
│   │   ├── 1024.jpg
│   │   ├── 4096-oversize.jpg
│   │   └── corrupt.png
│   └── products/                   ← Product JSON 픽스처
│       ├── valid.json
│       └── missing-required.json
├── unit/
├── integration/
└── e2e/
```

### 11.2 규약

- mock 마켓 응답 JSON 은 **실제 마켓 API 응답 캡처본** 을 PII 제거 후 그대로 사용. 임의 작성 금지.
- 캡처 출처 (URL, 날짜) 를 JSON 의 `_meta` 키에 기록 → 마켓 API 스펙 변경 시 추적 가능.
- 이미지 fixture 는 100KB 이내. 4MB 같은 대형은 CI 시 생성 스크립트 (`tests/fixtures/images/generate.ts`) 로 즉시 생성.

---

## 12. debug ↔ real 어댑터 격차 검증

### 12.1 원칙

- debug 모드 (`VITE_APP_MODE=debug`) 의 mock 어댑터와 real 모드의 실제 어댑터는 **동일 `MarketAdapter` 인터페이스** 구현.
- 두 어댑터의 응답은 **같은 zod 스키마** (`MarketResponseSchema`) 를 통과해야 한다.

### 12.2 격차 테스트

- `tests/unit/adapters/<market>/parity.spec.ts` 작성:
  1. debug 어댑터 응답 fixture → `MarketResponseSchema.parse()` 통과.
  2. real 어댑터의 캡처된 실제 응답 fixture (`tests/fixtures/msw/<market>/captured-real-*.json`) → 같은 스키마 통과.
  3. 두 응답의 key set 비교. 누락 키 / 추가 키 발견 시 fail.

### 12.3 격차 발견 시 처리

- mock 어댑터 응답을 실제와 맞추도록 수정.
- 또는 zod 스키마를 좀더 관대하게 (optional / discriminated union) 변경.
- **debug 에서 통과한 시나리오를 real 에서 실행해 보지 않았다면 통과로 보지 않는다.** release 브랜치 단계에서 real Supabase + sandbox 마켓 API 로 골든 패스 1회 통과 강제.

### 12.4 real 빌드 산출물 검증

- `pnpm build:real` 후 `dist/` 안에 `mock` / `MSW` / `fixture` 문자열이 포함되는지 grep. 발견 시 빌드 실패.
- sourcemap 미생성 확인 (sentry-only 업로드 옵션은 별개 OK).

---

## 13. Phase 종료 시 PASS 표 양식

각 Phase 의 종료 게이트에서 아래 표를 채워야 한다. **모든 행이 `pass` 가 되어야 다음 Phase 진입.**
`carry-over` 는 v2 사유 + 만료일 필수.

### 13.1 Phase 1 종료 PASS 표 (인프라 결정)

| ID | 항목 | 상태 | 검증 방법 | 노트 |
|----|------|------|-----------|------|
| QA-P1-001 | 프론트엔드 스택 결정 (React+Vite+TS strict) | pending | CLAUDE.md 명시 확인 | |
| QA-P1-002 | Supabase 프로젝트 debug / real 2개 분리 | pending | 각 프로젝트 ID 명시 + 환경변수 분리 확인 | |
| QA-P1-003 | CI 파이프라인 PR/main 분리 동작 | pending | dry-run PR 통과 + main 머지 dry-run | |

### 13.2 Phase 2 종료 PASS 표 (s1 인증 + s5 마켓 OAuth)

| ID | 항목 | 상태 | 검증 방법 | 노트 |
|----|------|------|-----------|------|
| QA-P2-AUTH-001 | 이메일 회원가입 / 로그인 / 비밀번호 재설정 | pending | Playwright + Vitest | |
| QA-P2-AUTH-002 | 셀러 B 의 셀러 A 리소스 접근 차단 (RLS) | pending | RLS-SQL + Playwright | |
| QA-P2-MKT-001 | 스마트스토어 OAuth 연결 / 토큰 갱신 / 해제 | pending | Playwright + MSW (200/401) | |
| QA-P2-MKT-002 | 쿠팡 OAuth 동일 | pending | 위와 동일 | |
| QA-P2-MKT-003 | `access_token` / `refresh_token` 평문 저장 부재 | pending | DB 직접 조회 + 로그 grep + Sentry event grep | |

### 13.3 Phase 3 종료 PASS 표 (s3 상품 등록 5단계)

| ID | 항목 | 상태 | 검증 방법 | 노트 |
|----|------|------|-----------|------|
| QA-P3-REG-001 | 5단계 위저드 정방향 / 역방향 이동 | pending | Playwright + RTL | |
| QA-P3-REG-002 | RegistrationJob 7상태 합법 / 불법 전이 | pending | Vitest (42 case) | |
| QA-P3-REG-003 | 부분 실패 (2중 1 성공) → `partial` + 재시도 UI | pending | Playwright + MSW (5xx 토글) | |
| QA-P3-REG-004 | 동시 입력 충돌 (두 탭) → 한쪽 거부 | pending | Playwright (멀티 컨텍스트) | |
| QA-P3-REG-005 | 이미지 4MB 초과 / 미지원 포맷 거부 | pending | RTL + Vitest | |

### 13.4 Phase 4 종료 PASS 표 (s2 대시보드 + s6 이력)

| ID | 항목 | 상태 | 검증 방법 | 노트 |
|----|------|------|-----------|------|
| QA-P4-DASH-001 | 대시보드 4상태 (loading/data/error/empty) | pending | RTL | |
| QA-P4-DASH-002 | Realtime 등록 진행률 갱신 | pending | Playwright (Supabase realtime 채널) | |
| QA-P4-HIST-001 | 이력 목록 기본 필터 + 재시도 / 마켓 제외 후 등록 | pending | Playwright | |
| QA-P4-HIST-002 | 셀러 격리 (RLS) | pending | RLS-SQL | |

### 13.5 Phase 5 종료 PASS 표 (출시 게이트)

| ID | 항목 | 상태 | 검증 방법 | 노트 |
|----|------|------|-----------|------|
| QA-P5-GOLDEN | 골든 패스 Chromium / WebKit / Firefox 통과 | pending | Playwright full matrix | |
| QA-P5-A11Y | 모든 라우트 axe violations.length === 0 | pending | @axe-core/playwright | |
| QA-P5-A11Y-MANUAL | 키보드 only 골든 패스 통과 + 4.5:1 대비 | pending | 수동 체크리스트 | |
| QA-P5-PARITY | debug ↔ real 어댑터 격차 0 | pending | parity.spec.ts | |
| QA-P5-SEC | 토큰 / PII 로그·Sentry·DB 평문 부재 | pending | grep + DB + Sentry event 검사 | security 합동 |
| QA-P5-RLS-FULL | 모든 셀러 테이블 RLS 정책 단위 테스트 통과 | pending | RLS-SQL | |
| QA-P5-CI | PR/main/release CI 파이프라인 dry-run 통과 | pending | GitHub Actions 로그 | |

---

## 14. 매트릭스 관리 운영 규칙

- 통합 매트릭스 파일: `docs/architecture/v1/qa/qa-matrix.md` (QA 가 누적 관리).
- features 문서의 매트릭스 행은 통합 매트릭스에도 동시 반영 (자동 동기화 스크립트 도입 전까지는 수동).
- 마켓 어댑터 변경 PR: 영향받는 행을 `pending` 으로 재변경. QA 가 재검증 후 `pass`.
- v2 carry-over 행은 별도 섹션 `## v2 Carry-over` 로 분리 + 만료일 (예: `expires: 2026-12-31`) 명시.

---

## 15. 본 문서 변경 절차

- 본 문서는 **헌법**. 변경 시 PR 에 사유 + 영향받는 features 문서 목록 첨부.
- §0 / §3 / §5 / §13 변경은 QA / backend / security 3자 승인 필수.
- 도구 추가 / 교체는 §2 갱신 + CI 파이프라인 갱신 동반.
- 본 문서가 features 문서와 충돌 시 본 문서가 우선.

---

## 16. 거부 사유 빠른 참조 (QA 가 PR / 문서 검수 시 인용)

| 코드 | 사유 | 해결 |
|------|------|------|
| R-001 | 행복 경로만 다룸 (§5 의 8종 중 누락) | 누락 시나리오 매트릭스 행 추가 |
| R-002 | 자동화 컬럼 비어있음 / `수동` + 만료일 없음 | 자동화 추가 또는 수동 절차 + 책임자 + 만료일 명시 |
| R-003 | 골든 패스 (§3) 깨짐 | 즉시 수정. 우회 PR 거부 |
| R-004 | RLS 정책 없는 셀러 데이터 테이블 | 정책 추가 + RLS-SQL 단위 테스트 |
| R-005 | 외부 데이터에 zod 스키마 없음 | 스키마 추가 후 재제출 |
| R-006 | debug 만 검증, real 어댑터 격차 미확인 | §12 parity 테스트 통과 후 재제출 |
| R-007 | 토큰 / PII 로그 / Sentry / DB 평문 노출 가능성 | 마스킹 + grep 증거 첨부 |
| R-008 | data-testid 남용 (접근성 셀러터 우선순위 위반) | role / label 셀러터로 교체 |
| R-009 | features 문서 변경 시 매트릭스 갱신 누락 | 행 추가 / 상태 재설정 |
| R-010 | 3개 산출물 (설계문서 / HTML 프로토타입 / src) 동기화 누락 | 동시 갱신 PR |

---

**문서 끝.** 의문이 있는 항목은 §0 헌법을 다시 읽는다. "괜찮을 것 같습니다" 는 통과 사유가 아니다.
