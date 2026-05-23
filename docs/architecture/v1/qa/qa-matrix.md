# QA 커버리지 매트릭스 (v1)

> **문서 종류**: QA 누적 매트릭스 (PRD 기능별 자동화 커버리지 추적)
> **위치**: `docs/architecture/v1/qa/qa-matrix.md`
> **상위 문서**: `docs/architecture/v1/testing.md` §4 (양식) + §14 (운영 규칙)
> **자매 문서**: `docs/architecture/v1/qa/golden-path.md` (골든 패스 1 시나리오 상세 명세)
> **마지막 갱신**: 2026-05-23 (초안)

---

## 0. 목적 · 읽는 법

본 매트릭스는 PRD §1~§9 의 각 세부 기능이 **어느 테스트 레이어 (단위 / 통합 / E2E / 수동)** 에서 잠겨 있는지를 한눈에 보여주는 단일 진실이다. 신규 기능 PR 진입 시 본 표의 빈칸 (`미커버`) = `testing.md` R-001 (행복 경로 누락) / R-009 (매트릭스 갱신 누락) 위반으로 간주된다.

**커버리지 컬럼 정의**:

| 컬럼 | 의미 | 위치 |
|---|---|---|
| **단위** | Vitest. 외부 의존 없음. zod schema parse, 어댑터 transform, 상태 전이, 순수 유틸. | `tests/unit/**` / `apps/web/src/**/*.test.ts(x)` / `apps/api/supabase/functions/**/__tests__/*.test.ts` |
| **통합** | Vitest + Supabase 로컬 또는 MSW. 화면 단위 RTL, Edge Function 단위 통합. | `tests/integration/**` / `apps/web/src/features/**/__tests__/*.test.tsx` |
| **E2E** | Playwright + Chromium + MSW. 진짜 브라우저 사용자 동선. | `tests/e2e/**` |
| **수동** | 자동화 불가 (또는 미구현). 수동 절차 링크 + 책임자 + 만료일 필수. | `docs/architecture/v1/qa/manual-*.md` |
| **미커버** | 현재 어느 레이어에도 검증 없음. 다음 스프린트 백로그 후보. | — |

**상태 마커**:

- `pass` — 테스트 파일이 존재하고 CI 에서 녹색.
- `pending` — 행은 등록되었으나 테스트 파일 아직 미작성 또는 실패 중.
- `미커버` — 즉시 자동화 가능하지만 아직 행으로 잠겨 있지 않은 시나리오.
- `BLOCKED (사유)` — 외부 의존 미해결 (마켓 스펙 미확보, 로젠 계약 미체결 등). 사유 명시 필수.
- `v2 보류` — CLAUDE.md MVP 범위에 따라 v1 에서 제외. 만료일 명시 필요 (issue 링크).
- `?` — 사실 확인 필요. 다음 매트릭스 갱신 시점에 결론.

**갱신 시점**:

- 새 기능 PR — 매트릭스에 행 추가 + 상태 `pending` 초기 등록.
- 마켓 어댑터 변경 PR — 영향받는 행 전부 `pending` 으로 재설정 (`testing.md` §14).
- 외부 스펙 확정 시 — `BLOCKED` → `pending` 전환 + 어떤 issue/handoff 가 잠금 해제했는지 메모.

---

## 1. §1 상품 등록 (s3)

PRD §1.1 ~ §1.4 + §3.6 (HTML 상세) — MVP v1 의 핵심 도메인. 5단계 위저드.

| 기능 ID | 시나리오 | 단위 | 통합 | E2E | 수동 | 미커버 | 비고 |
|---|---|---|---|---|---|---|---|
| QA-REG-001 | §1.1.1 상품명 형식 검증 + 중복 확인 | `apps/web/src/lib/schemas/__tests__/registration.test.ts` (zod) | `apps/web/src/features/registration/__tests__/StepInfoPage.test.tsx` | 골든패스 G6 (`tests/e2e/golden-path.spec.ts`) | — | 실시간 중복 확인 (서버 round-trip) | RHF + zod 검증은 단위 + 통합, 중복 API 호출 검증은 ? |
| QA-REG-002 | §1.1.2 이미지 다중 업로드 + 미리보기 + 순서 조정 | — | `apps/web/src/features/registration/__tests__/StepImagesPage.test.tsx` | 골든패스 G7 (대표 이미지 1장만) | 순서 드래그앤드롭 a11y 수동 점검 | 다중 (3장+) 업로드 / 순서 조정 E2E | |
| QA-REG-003 | §1.1.3 동적 카테고리 선택 + 필터링 | — | `apps/web/src/features/registration/__tests__/StepMarketsCategoriesPage.test.tsx` | 골든패스 G8 | — | 키워드 필터링 인터랙션 | |
| QA-REG-004 | §1.1.4 기본 배송 정보 입력 | `apps/web/src/lib/schemas/__tests__/registration.test.ts` | `StepInfoPage.test.tsx` | 골든패스 G6 | — | — | |
| QA-REG-005 | §1.2.1 마켓별 상품 속성 자동 변환 (`transformProduct`) | `apps/web/src/lib/markets/real/naver/__tests__/naver-real-adapter.test.ts` 등 5종 + `tests/unit/market-adapters/*-edge.test.ts` | — | 골든패스 G8 (간접) | — | — | 5개 마켓 모두 단위 테스트 존재 (naver / coupang / gmarket / auction / esm) |
| QA-REG-006 | §1.2.2 마켓별 이미지 규격 자동 최적화 (resize/format) | — | — | — | — | **미커버** | image-pipeline 단위 테스트 부재 — `cross-cutting/image-pipeline.md` 의 변환 함수 분리 후 작성 필요 |
| QA-REG-007 | §1.2.3 마켓별 필수 항목 자동 체크 | `apps/web/src/lib/markets/__tests__/state-transition.test.ts` (부분) | `StepPreviewPage.test.tsx` | 골든패스 G9 | — | 누락 시 blockingReasons tooltip 인터랙션 | |
| QA-REG-008 | §1.3.1 등록 요청 병렬 처리 + 상태 관리 | `apps/web/src/lib/markets/__tests__/state-transition.test.ts` (7상태 전이) | `tests/integration/multi-market-fanout.test.ts` | 골든패스 G10 | — | — | 헌법 §6.3 의 42 케이스 (합법 7 + 불법 35) — `state-transition.test.ts` 가 일부만 커버? |
| QA-REG-009 | §1.3.2 등록 실패 자동 재시도 (백오프) | — | — | — | — | **미커버** | retry 시나리오 spec (`tests/e2e/golden-path-retry.spec.ts`) 미작성 — `golden-path.md` §9.2 가 권장만 |
| QA-REG-010 | §1.3.3 마켓별 API 인증·보안 통신 (HMAC/JWT/OAuth) | `apps/web/src/lib/markets/real/coupang/__tests__/hmac.test.ts` / `esm/__tests__/jwt.test.ts` / `naver-token-refresh-cron.test.ts` + `apps/api/supabase/functions/_shared/__tests__/gateway-sign.test.ts` | — | — | — | 통합 / E2E (실 호출 인증 검증) | gateway-sign 서명, HMAC, JWT 모두 단위 커버됨 |
| QA-REG-011 | §1.4.1 등록 결과 상세 내역 (성공/실패 구분 + 원인 표시) | `apps/web/src/features/registration/__tests__/registration-error-messages.test.ts` | `apps/web/src/features/registration/__tests__/StepResultPage.test.tsx` | 골든패스 G10 (success 만) | — | partial 상태 E2E (`golden-path-partial.spec.ts` 미작성) | |
| QA-REG-012 | §1.4.2 등록 결과 CSV/Excel 내보내기 | — | — | — | — | **미커버** | CSV export 기능 자체가 코드에 있는지 ? 확인 필요 |
| QA-REG-013 | §1.4.3 등록 성공/실패 알림 설정 (이메일/푸시) | — | — | — | — | **미커버** | 알림 발송 Edge Function ? |
| QA-REG-014 | §3.6.1 HTML WYSIWYG 에디터 | — | — | — | — | **미커버** | 코드 존재 여부 ? — MVP 포함이지만 테스트 미확인 |
| QA-REG-015 | §3.6.2 HTML 코드 유효성·XSS 검사 | — | — | — | — | **미커버** | sanitize 단위 테스트 부재 |
| QA-REG-016 | §3.6.3 HTML 상세 설명 미리보기 | — | — | — | — | **미커버** | |
| QA-REG-017 | 부분 등록 실패 (1 success + 1 fail) → `partial` + 재시도 버튼 | `state-transition.test.ts` (상태 전이) | `StepResultPage.test.tsx` (?) | **미작성** (`golden-path-partial.spec.ts`) | — | E2E | `golden-path.md` §9.1 권장 spec 미작성 |
| QA-REG-018 | 동시 입력 충돌 (두 탭 동일 Product) → 한쪽 거부 | — | — | — | — | **미커버** | DB advisory lock / unique constraint 자체는 마이그레이션 ? |
| QA-REG-019 | 이미지 4MB 초과 / 미지원 포맷 거부 | — | `StepImagesPage.test.tsx` (?) | — | — | E2E 거부 시나리오 | |
| QA-REG-020 | 5단계 위저드 정방향/역방향 이동 (state 보존) | — | `apps/web/src/features/registration/__tests__/useRegisterFormStore.test.ts` | 골든패스 G6~G10 정방향만 | 역방향 (뒤로가기) 수동 | 역방향 E2E | zustand store 단위만 |

**§1 갭 요약**: 이미지 파이프라인 (QA-REG-006), retry 백오프 (QA-REG-009), partial E2E (QA-REG-017), HTML WYSIWYG/XSS (QA-REG-014~016), CSV export (QA-REG-012), 알림 (QA-REG-013) — 6 클러스터 미커버.

---

## 2. §2 마켓 계정 (s5)

PRD §2.1 (인증) + §2.2 (OAuth 연결) + §2.3 (계정 관리) + §2.4 (자격증명 보안). v1 5개 마켓 전부 정식.

### 2.1 인증 (§2.1)

| 기능 ID | 시나리오 | 단위 | 통합 | E2E | 수동 | 미커버 | 비고 |
|---|---|---|---|---|---|---|---|
| QA-AUTH-001 | §2.1.1 회원가입 폼 유효성 검사 | `apps/web/src/features/auth/lib/__tests__/password-strength.test.ts` | `apps/web/src/features/auth/__tests__/SignupPage.test.tsx` | — | — | 회원가입 E2E | |
| QA-AUTH-002 | §2.1.2 비밀번호 강도 검사 + 가이드 | `password-strength.test.ts` | `SignupPage.test.tsx` | — | — | — | |
| QA-AUTH-003 | §2.1.3 2FA | — | — | — | — | `v2 보류` | CLAUDE.md MVP 범위 외 |
| QA-AUTH-004 | §2.1.4 세션 관리 + 자동 로그아웃 | `apps/web/src/features/auth/__tests__/AuthContext.session.test.tsx` | — | 골든패스 G2 (로그인 세션 진입) | 비활성 timeout 수동 | 자동 로그아웃 트리거 E2E | |
| QA-AUTH-005 | §2.1.5 비밀번호 재설정 + 이메일 인증 | `apps/web/src/features/auth/lib/__tests__/auth-error-map.test.ts` | `apps/web/src/features/auth/__tests__/LoginPage.test.tsx` | — | 이메일 수신 수동 | E2E (메일링크 클릭) | |
| QA-AUTH-006 | 셀러 B 가 셀러 A 리소스 직접 접근 (RLS) | `apps/api/supabase/tests/rls-cross-tenant.sql` (102 케이스, CI `pgtap-rls`) | — | — | — | **커버** | 17 엔티티 × 6 시나리오 (SELECT / UPDATE / DELETE / anon / service_role) |
| QA-AUTH-007 | 로그인 이벤트 감사 로그 (PII 마스킹) | `apps/web/src/features/auth/__tests__/auth-event-log.test.ts` + `tests/unit/security/edge-masking.test.ts` | — | — | — | — | |

### 2.2 마켓 OAuth 5종 어댑터 매트릭스 (§2.2.1 / §2.2.3 / §2.3.x)

각 마켓 = `MarketAdapter` 5메서드 (`authenticate` / `refreshToken` / `fetchCategoryTree` / `transformProduct` / `createProduct`). `refreshToken` 은 OAuth (네이버) 만.

| 마켓 | authenticate | refreshToken | fetchCategoryTree | transformProduct | createProduct | E2E 골든패스 |
|---|---|---|---|---|---|---|
| **네이버** (OAuth) | `naver-real-adapter.test.ts` + `tests/unit/market-adapters/naver-edge.test.ts` | `tests/unit/market-adapters/naver-token-refresh-cron.test.ts` + `useNaverTokenRefresh.test.tsx` | `naver-real-adapter.test.ts` | `naver-real-adapter.test.ts` | `naver-real-adapter.test.ts` | 골든패스 G4 (mock) — real OAuth 미커버 |
| **쿠팡** (HMAC) | `coupang-real-adapter.test.ts` + `hmac.test.ts` + `coupang-edge.test.ts` | N/A (HMAC 무 refresh) | `coupang-real-adapter.test.ts` | `coupang-real-adapter.test.ts` | `coupang-real-adapter.test.ts` | 골든패스 G5 (mock) |
| **G마켓** (ESM JWT) | `gmarket-real-adapter.test.ts` + `gmarket-edge.test.ts` + `jwt.test.ts` | N/A | `gmarket-real-adapter.test.ts` | `gmarket-real-adapter.test.ts` | `gmarket-real-adapter.test.ts` | **미작성** (골든패스 v1 범위는 2마켓 고정) |
| **옥션** (ESM JWT, site='A') | `auction-real-adapter.test.ts` + `auction-edge.test.ts` + `jwt.test.ts` | N/A | `auction-real-adapter.test.ts` | `auction-real-adapter.test.ts` | `auction-real-adapter.test.ts` | **미작성** |
| **11번가** (API Key) | — | — | — | — | — | `BLOCKED (스펙 미확보)` |

| 기능 ID | 시나리오 | 단위 | 통합 | E2E | 수동 | 미커버 | 비고 |
|---|---|---|---|---|---|---|---|
| QA-MKT-NAV-001 | 네이버 OAuth 연결 + 토큰 갱신 + 해제 | 위 표 | `apps/web/src/features/markets/__tests__/useConnectMarket.test.tsx` + `OAuthCallbackPage.test.tsx` | 골든패스 G4 (mock) | release sandbox 수동 | real OAuth E2E | 토큰 갱신 cron 단위만, E2E 미커버 |
| QA-MKT-CPG-001 | 쿠팡 HMAC 연결 + 키 갱신 | 위 표 | `useConnectMarket.test.tsx` | 골든패스 G5 (mock) | release sandbox 수동 | — | |
| QA-MKT-GMK-001 | G마켓 ESM 연결 | 위 표 | `useConnectMarket.test.tsx` | — | release sandbox 수동 | E2E | |
| QA-MKT-AUC-001 | 옥션 ESM 연결 (site='A') | 위 표 | `useConnectMarket.test.tsx` | — | release sandbox 수동 | E2E | |
| QA-MKT-11ST-001 | 11번가 연결 | — | — | — | — | `BLOCKED (스펙 미확보)` | v1 범위에 포함되지만 어댑터 코드 부재 |
| QA-MKT-CONN-001 | §2.2.2 API 연결 상태 실시간 표시 | — | `apps/web/src/features/markets/__tests__/MarketsListPage.test.tsx` | — | — | Realtime 채널 변경 E2E | |
| QA-MKT-CONN-002 | §2.3.1 연결 계정 목록 조회 | — | `MarketsListPage.test.tsx` | 골든패스 G3 (empty + 2건) | — | — | |
| QA-MKT-CONN-003 | §2.3.2 마켓 계정 추가/수정/삭제 | — | `MarketsConnectProviderPage.test.tsx` + `useConnectMarket.test.tsx` | 골든패스 G4/G5 (추가만) | — | 수정/삭제 E2E | |
| QA-MKT-CONN-004 | §2.3.3 마켓 계정 연결 상태 실시간 표시 (Realtime) | — | `MarketsListPage.test.tsx` (?) | — | — | Realtime push E2E | |
| QA-MKT-CONN-005 | §2.3.4 마켓 계정 상태 변경 알림 (토큰 만료 등) | — | — | — | — | **미커버** | 알림 발송 시스템 자체 ? |
| QA-MKT-SEC-001 | §2.4.1 자격증명 정기 보안 감사 | — | — | — | release 수동 grep | 자동 grep CI 통합 미커버 | `pgcrypto` 적용 / Vault 키 회전 확인 |
| QA-MKT-SEC-002 | §2.4.2 인증 정보 백업/복구 | — | — | — | release 수동 | **미커버** | 복구 절차 문서 부재 |
| QA-MKT-SEC-003 | OAuth access/refresh 토큰 평문 저장 부재 (DB/로그/Sentry) | `apps/web/src/lib/security/__tests__/redact-regression.test.ts` + `tests/unit/security/edge-masking.test.ts` + `tests/unit/market-adapters/naver-edge.test.ts` | — | — | release grep | — | P0 핵심 |
| QA-MKT-ERR-001 | 마켓 API 401 (refresh 만료) → 재인증 안내 | `naver-token-refresh-cron.test.ts` | `market-error-messages.test.ts` | — | — | E2E (401 토글) | |
| QA-MKT-ERR-002 | 마켓 API 429 (rate limit) → `Retry-After` 존중 백오프 | — | — | — | — | **미커버** | retry 정책 단위 테스트 부재 |
| QA-MKT-ERR-003 | 마켓 API 5xx → UI 상태 + Sentry 이벤트 | `market-error-messages.test.ts` | `MarketsConnectProviderPage.test.tsx` (?) | — | — | E2E | |
| QA-MKT-ERR-004 | 마켓 API 4xx 검증 오류 → 필드 매핑 표시 | `market-error-messages.test.ts` + `markets-feature.test.ts` (schema) | `MarketsConnectProviderPage.test.tsx` | — | — | — | |
| QA-MKT-ERR-005 | IP 화이트리스트 미등록 (Lightsail 게이트웨이 IP) | — | — | — | release 수동 (5개 마켓 콘솔 확인) | **미커버 (자동 불가)** | `docs/handoff/lightsail-setup-guide.md` 참조. 자동 검증 불가 |

**§2 갭 요약**: 11번가 어댑터 전체 BLOCKED, 429 백오프 (QA-MKT-ERR-002), 계정 상태 변경 알림 (QA-MKT-CONN-005), 자격증명 백업/복구 (QA-MKT-SEC-002). ~~RLS 단위 SQL 부재 (QA-AUTH-006)~~ → CI `pgtap-rls` 통합 후 커버.

---

## 3. §3 템플릿 관리 (s4) — v2 보류

CLAUDE.md MVP 범위에 따라 **전체 v2 보류**. v1 PR 진입 시 본 섹션 행 추가 금지.

| 기능 ID | 시나리오 | 상태 |
|---|---|---|
| QA-TPL-001 ~ QA-TPL-NNN | §3.1 ~ §3.5 (HTML 상세 제외, HTML 상세는 §3.6 = §1 QA-REG-014~016) | `v2 보류` (CLAUDE.md MVP 범위 §3.1~§3.5 제외 결정) |

s4 화면 추가 시 본 섹션을 행으로 채우고 `pending` 으로 등록.

---

## 4. §4 대시보드 + 등록 이력 (s2 + s6)

### 4.1 대시보드 (§4.1)

| 기능 ID | 시나리오 | 단위 | 통합 | E2E | 수동 | 미커버 | 비고 |
|---|---|---|---|---|---|---|---|
| QA-DASH-001 | §4.1.1 등록 현황 실시간 자동 갱신 (Supabase Realtime) | `apps/web/src/lib/schemas/__tests__/dashboard-summary.test.ts` | `apps/web/src/features/dashboard/__tests__/DashboardPage.test.tsx` | — | — | Realtime 채널 E2E | |
| QA-DASH-002 | §4.1.2 마켓·상태·날짜·상품명 필터/정렬 | — | `DashboardPage.test.tsx` | — | — | 필터 인터랙션 E2E | |
| QA-DASH-003 | §4.1.3 대시보드 접근 권한 관리 | — | — | — | — | `v2 보류` | CLAUDE.md MVP — 멀티유저/권한 모델 v2 |
| QA-DASH-004 | 4상태 (loading/data/error/empty/partial) 렌더 | — | `DashboardPage.test.tsx` (?) | — | — | partial / empty / error 상태 검증 ? | RegistrationJob 화면은 `partial` 추가 (CLAUDE.md UI 일관성) |
| QA-DASH-005 | 마켓 로고 노출 (네이버 #03C75A 등 토큰) | — | `apps/web/src/features/dashboard/__tests__/MarketLogo.test.tsx` | — | — | 대비 4.5:1 수동 | |

### 4.2 오류 알림 (§4.2)

| 기능 ID | 시나리오 | 단위 | 통합 | E2E | 수동 | 미커버 | 비고 |
|---|---|---|---|---|---|---|---|
| QA-ERR-001 | §4.2.1 오류 메시지 유형별 분류 + 해결 가이드 | `apps/web/src/features/markets/__tests__/market-error-messages.test.ts` + `apps/web/src/features/registration/__tests__/registration-error-messages.test.ts` | — | — | — | 가이드 노출 인터랙션 E2E | |
| QA-ERR-002 | §4.2.2 실시간 오류 알림 (팝업/배너) | — | — | — | — | **미커버** | 알림 UI 컴포넌트 ? |
| QA-ERR-003 | §4.2.3 오류 자동 로그 + 빈도 통계 | — | — | — | — | **미커버** | Postgres view ? |
| QA-ERR-004 | 긴 에러 메시지 접기/펼치기 (ErrorMessage 컴포넌트) | — | — | — | — | **미커버** | `apps/web/src/components/ui/error-message.tsx` 단위 테스트 부재 |

### 4.3 등록 이력 (§4.3 + §4.4)

| 기능 ID | 시나리오 | 단위 | 통합 | E2E | 수동 | 미커버 | 비고 |
|---|---|---|---|---|---|---|---|
| QA-HIST-001 | §4.3.1 오류 수정 후 즉시 재시도 | — | `apps/web/src/features/history/__tests__/HistoryDetailPage.test.tsx` | — | — | 재시도 E2E (`golden-path-retry.spec.ts` 미작성) | |
| QA-HIST-002 | §4.3.2 오류 마켓 제외 후 나머지 일괄 등록 | — | `HistoryDetailPage.test.tsx` (?) | — | — | E2E (`golden-path-skip-market.spec.ts` 미작성) | `golden-path.md` §9.3 권장 |
| QA-HIST-003 | §4.4.1 등록 이력 상세 검색 (다중 조건) | `apps/web/src/lib/schemas/__tests__/history-filter.test.ts` | `apps/web/src/features/history/__tests__/HistoryListPage.test.tsx` | 골든패스 G11 | — | 복합 필터 E2E | |
| QA-HIST-004 | §4.4.2 오류 유형별 통계 (마켓별·기간별 차트) | — | — | — | — | **미커버** | 차트 컴포넌트 ? |
| QA-HIST-005 | §4.4.3 등록 이력 CSV/Excel 내보내기 | — | — | — | — | **미커버** | export 기능 코드 부재 ? |
| QA-HIST-006 | 셀러 격리 (RLS) — 다른 셀러 이력 접근 불가 | `rls-cross-tenant.sql` (registration_jobs / registration_job_market_results, CI `pgtap-rls`) | — | — | — | **커버** | — |

**§4 갭 요약**: 알림 UI (QA-ERR-002/003/004), 오류 통계 차트 (QA-HIST-004), CSV export (QA-HIST-005), Realtime E2E. ~~RLS 단위 (QA-HIST-006)~~ → CI `pgtap-rls` 커버.

---

## 5. §5 반응형 + 크로스 브라우저 + 성능

대부분 E2E / 수동 영역. axe 회귀는 PR #126 머지 후 `tests/e2e/a11y/all-routes-axe.spec.ts` 의 26 라우트로 자동화됨.

| 기능 ID | 시나리오 | 단위 | 통합 | E2E | 수동 | 미커버 | 비고 |
|---|---|---|---|---|---|---|---|
| QA-RWD-001 | §5.1.1~§5.1.3 반응형 레이아웃 (1200+/768~1199/~767) | — | — | — | release 수동 (3 브레이크포인트 스크린샷) | 자동 시각 회귀 (v1 제외) | `testing.md` §1.2 v1 제외 |
| QA-RWD-002 | §5.1.4 반응형 이미지 (max-width + srcset) | — | — | — | release 수동 | — | |
| QA-RWD-003 | §5.2.1 터치 44x44px 최소 | — | — | — | release 수동 + jsx-a11y lint | 자동 측정 | |
| QA-RWD-004 | §5.2.2 모바일 햄버거 네비게이션 | — | `apps/web/src/components/layout/__tests__/Footer.test.tsx` (?) | — | release 수동 | E2E (viewport 변경) | |
| QA-RWD-005 | §5.2.3 모바일 폰트 16px 이상 | — | — | — | — | — | `tailwind.config.ts` 토큰 정적 검증 ? |
| QA-RWD-006 | §5.3.1~§5.3.3 크로스 브라우저 (Chrome/Safari/Firefox/Edge) | — | — | `tests/e2e/golden-path.spec.ts` (Chromium만; WebKit/Firefox 는 main 머지 시 — `testing.md` §8.3) | release 수동 (Safari/Edge) | Edge 자동 | `golden-path.md` §5.2 트리거 매트릭스 |
| QA-A11Y-001 | WCAG 2.1 AA 모든 라우트 axe violations=0 | — | — | `tests/e2e/a11y/all-routes-axe.spec.ts` (26 라우트, PR #126) + `tests/e2e/a11y.spec.ts` | 키보드 only 수동 (`docs/architecture/v1/qa/manual-a11y-checklist.md` ?) | — | `testing.md` §9.2 |
| QA-A11Y-002 | eslint-plugin-jsx-a11y lint 시점 차단 | — | — | — | — | — | `pnpm lint` 통과 = 자동 | |
| QA-A11Y-003 | 색상 대비 4.5:1 (디자인 토큰) | — | — | — | release 수동 (라이트/다크) | 자동 토큰 회귀 | |
| QA-PERF-001 | §5.4.1 이미지 WebP 압축 + 크기별 변형본 | — | — | — | release 수동 (Lighthouse) | 자동 Lighthouse CI (v1 제외) | |
| QA-PERF-002 | §5.4.2 코드 스플리팅 (Vite 자동) | — | — | — | release 수동 (dist 분석) | bundle size CI 게이트 | |
| QA-PERF-003 | §5.4.3 캐싱 전략 | — | — | — | release 수동 | — | GitHub Pages 정적 캐시 |
| QA-PERF-004 | §5.4.4 지연 로딩 (Lazy Loading) | — | — | — | release 수동 | — | React.lazy 적용 여부 ? |
| QA-PERF-005 | §5.4.5 Minify + Gzip | — | — | — | release 수동 (Vite build 산출물 grep) | — | |

**§5 갭 요약**: 시각 회귀 / Lighthouse / bundle size 자동화는 v1 명시 제외. release 수동 체크리스트로 잠금.

---

## 6. s7 주문 (v2 도메인 — orders-sync)

PRD §6 + user_flow s7. 4마켓 주문 수집 (10분 폴링).

| 기능 ID | 시나리오 | 단위 | 통합 | E2E | 수동 | 미커버 | 비고 |
|---|---|---|---|---|---|---|---|
| QA-ORD-001 | §6.1 10분 주기 4마켓 주문 수집 (pg_cron + orders-sync Edge Function) | `apps/api/supabase/functions/orders-sync/__tests__/sync.test.ts` | `tests/integration/orders-sync.test.ts` | `tests/e2e/orders.spec.ts` | — | — | |
| QA-ORD-002 | 마켓별 주문 조회 — 네이버 (`new-pay-waiting`) | `apps/web/src/lib/markets/real/naver/__tests__/naver-orders.test.ts` | `orders-sync/__tests__/sync.test.ts` | `orders.spec.ts` | — | — | |
| QA-ORD-003 | 마켓별 주문 조회 — 쿠팡 (`ACCEPT`) | `coupang-orders.test.ts` | `orders-sync/__tests__/sync.test.ts` | `orders.spec.ts` | — | — | |
| QA-ORD-004 | 마켓별 주문 조회 — G마켓 (ESM `getOrderList`) | `gmarket-orders.test.ts` | `orders-sync/__tests__/sync.test.ts` | `orders.spec.ts` | — | — | |
| QA-ORD-005 | 마켓별 주문 조회 — 옥션 (ESM site='A') | `auction-orders.test.ts` | `orders-sync/__tests__/sync.test.ts` | `orders.spec.ts` | — | — | |
| QA-ORD-006 | 11번가 주문 조회 | — | — | — | — | `BLOCKED (스펙 미확보)` | §2 일관 — 어댑터 자체 부재 |
| QA-ORD-007 | `(market_id, external_order_id, seller_id)` unique 중복 방지 | `orders-sync/__tests__/sync.test.ts` (?) | `tests/integration/orders-sync.test.ts` | — | — | DB constraint 단위 SQL | |
| QA-ORD-008 | 주문 목록 UI (필터/검색/Realtime 갱신) | — | `apps/web/src/features/orders/__tests__/OrdersListPage.test.tsx` + `OrdersDashboardPage.test.tsx` | `orders.spec.ts` | — | — | |
| QA-ORD-009 | 주문 상세 화면 | `apps/web/src/lib/schemas/__tests__/orders.test.ts` | `apps/web/src/features/orders/__tests__/OrderDetailPage.test.tsx` | — | — | E2E 상세 진입 | |
| QA-ORD-010 | 수동 처리 다이얼로그 (운송장번호 직접 입력) | — | `apps/web/src/features/orders/__tests__/OrderManualResolveDialog.test.tsx` | — | — | E2E | |
| QA-ORD-011 | 셀러 격리 (RLS) — 다른 셀러 주문 접근 불가 | `rls-cross-tenant.sql` + `v2_orders_rls.sql` (CI `pgtap-rls`) | — | — | — | **커버** | — |
| QA-ORD-012 | OQ-SHIP-02 웹훅 (push) 도입 시 폴링 대체 | — | — | — | — | `BLOCKED (OQ-SHIP-02 미결)` | PRD §9 미결 사항 |

---

## 7. s8 배송 처리 (v2 도메인 — 로젠)

PRD §6.2~§6.4 + §7 + user_flow s8. 로젠 B2B 계약 의존.

| 기능 ID | 시나리오 | 단위 | 통합 | E2E | 수동 | 미커버 | 비고 |
|---|---|---|---|---|---|---|---|
| QA-SHIP-001 | §6.2 로젠 자동 처리 — `getSlipNo` 운송장번호 채번 | `apps/web/src/lib/logen/__tests__/client.test.ts` + `schemas.test.ts` + `apps/web/src/lib/schemas/__tests__/logen.test.ts` | `tests/unit/edge/logen-register-shipment.test.ts` | `tests/e2e/shipping-golden-path.spec.ts` | — | — | logen 클라이언트 단위 + Edge Function 단위 + E2E |
| QA-SHIP-002 | §6.2 로젠 `registerOrderData` 집하 예약 등록 | `client.test.ts` | `logen-register-shipment.test.ts` | `shipping-golden-path.spec.ts` | — | — | |
| QA-SHIP-003 | §6.2 로젠 실패 자동 재시도 3회 (지수 백오프) | `client.test.ts` (?) | `logen-register-shipment.test.ts` | — | — | retry 시나리오 E2E | |
| QA-SHIP-004 | §6.2 최종 실패 → `logen_failed` + 수동 처리 다이얼로그 | — | `logen-register-shipment.test.ts` | — | — | E2E | |
| QA-SHIP-005 | §6.3 운송장 출력 (outSlipPrintPop 팝업) | `apps/web/src/features/shipping/__tests__/logen-print-stub.test.ts` | `apps/web/src/features/shipping/__tests__/ShippingPrintPage.test.tsx` | `shipping-golden-path.spec.ts` | 실 프린터 출력 수동 | 팝업 윈도우 E2E | 자동화 범위 내 유일한 수동 단계 |
| QA-SHIP-006 | §6.3 출력 완료 → `status='waybill_printed'` | — | `ShippingPrintPage.test.tsx` | `shipping-golden-path.spec.ts` | — | — | |
| QA-SHIP-007 | §6.4 마켓 송장 일괄 제출 fan-out (4마켓 동시) | `apps/web/src/features/shipping/__tests__/shipping-schema.test.ts` + `apps/web/src/lib/schemas/__tests__/shipping.test.ts` | `apps/api/supabase/functions/shipping-dispatch-job/__tests__/shipping-dispatch.test.ts` + `apps/web/src/features/shipping/__tests__/ShippingDispatchPage.test.tsx` | `shipping-golden-path.spec.ts` | — | — | |
| QA-SHIP-008 | §6.4 송장 제출 결과 화면 (성공/실패 마켓별) | — | `apps/web/src/features/shipping/__tests__/ShippingDispatchResultPage.test.tsx` | `shipping-golden-path.spec.ts` | — | — | |
| QA-SHIP-009 | §6.4 부분 실패 → 재시도 (실패 마켓만) | — | `shipping-dispatch.test.ts` (?) | — | — | E2E partial retry | |
| QA-SHIP-010 | §6.5 주문·배송 대시보드 (오늘 요약 + 빠른 액션) | — | `OrdersDashboardPage.test.tsx` | `shipping-golden-path.spec.ts` | — | — | |
| QA-SHIP-011 | 배송 이력 화면 (n57) | — | `apps/web/src/features/shipping/__tests__/ShippingHistoryPage.test.tsx` | — | — | E2E | |
| QA-SHIP-012 | "출력 후 자동 제출" 옵션 ON → §6.3 직후 §6.4 자동 트리거 | — | — | — | — | **미커버** | OQ-SHIP-05 미결 (기본값) |
| QA-SHIP-013 | shipping_jobs / shipping_job_results 셀러 격리 (RLS) | `v2_shipping_jobs_rls.sql` (CI `pgtap-rls`) | — | — | — | **커버** | — |
| QA-SHIP-014 | 로젠 API 401 / 5xx / timeout | — | `logen-register-shipment.test.ts` (?) | — | — | 5xx/401 시나리오 E2E | |

---

## 8. s9 배송 설정 (v2 — 로젠 자격증명·발송인)

PRD §8 (logen_credentials 테이블) + user_flow s9.

| 기능 ID | 시나리오 | 단위 | 통합 | E2E | 수동 | 미커버 | 비고 |
|---|---|---|---|---|---|---|---|
| QA-CFG-001 | n59 로젠 API 연동 (userId / custCd 입력 → pgcrypto 암호화 저장) | `logen/__tests__/schemas.test.ts` | `apps/web/src/features/settings/shipping/__tests__/SettingsShippingLogenPage.test.tsx` | `tests/e2e/settings-shipping.spec.ts` | — | — | |
| QA-CFG-002 | n59 로젠 연결 테스트 (입력 후 ping) | — | `SettingsShippingLogenPage.test.tsx` (?) | `settings-shipping.spec.ts` | — | — | |
| QA-CFG-003 | n60 발송인 정보 설정 (이름·주소·연락처·fareTy·dlvFare) | `shipping-schema.test.ts` | `apps/web/src/features/settings/shipping/__tests__/SettingsShippingSenderPage.test.tsx` | `settings-shipping.spec.ts` | — | — | |
| QA-CFG-004 | s9 배송 설정 메인 + 설정 네비 | — | `apps/web/src/features/settings/__tests__/SettingsNav.test.tsx` + `SettingsShippingPage.test.tsx` | `settings-shipping.spec.ts` | — | — | |
| QA-CFG-005 | 로젠 미연동 상태에서 s7 진입 → 배송 설정 유도 배너 | — | — | — | — | **미커버** | 배너 노출 인터랙션 |
| QA-CFG-006 | logen_credentials `user_id_enc` / `cust_cd_enc` 평문 저장 부재 | `v2_logen_credentials_rls.sql` (CI `pgtap-rls`) | — | — | release grep | **커버 (RLS)** / 평문 grep CI 후속 | `pgcrypto` 적용 + RLS 격리 확인. 평문 grep release 잡은 후속 PR. |
| QA-CFG-007 | OQ-SHIP-04 `fareTy` / `dlvFare` 계약 확정값 | — | — | — | — | `BLOCKED (OQ-SHIP-04 미결)` | PRD §9 |

---

## 9. 실패 시나리오 매트릭스

`testing.md` §5 의 8종 실패 분류 + s7~s9 추가. 각 시나리오마다 잠그는 테스트 위치.

| 분류 | 시나리오 ID | 잠그는 테스트 | 상태 |
|---|---|---|---|
| **마켓 API 5xx** | QA-FAIL-001 | `apps/web/src/features/markets/__tests__/market-error-messages.test.ts` (UI) + 어댑터 단위 (?) | pending — E2E 미작성 |
| **마켓 API 4xx 검증 오류** | QA-FAIL-002 | `market-error-messages.test.ts` + `registration-error-messages.test.ts` | pass (단위 only) |
| **마켓 API 429 rate limit** | QA-FAIL-003 | — | **미커버** — `Retry-After` 백오프 단위 테스트 부재 |
| **마켓 API 401 토큰 만료** | QA-FAIL-004 | `naver-token-refresh-cron.test.ts` + `useNaverTokenRefresh.test.tsx` + `market-error-messages.test.ts` | pass (네이버만; 다른 마켓 N/A) |
| **부분 실패 (2중 1 성공)** | QA-FAIL-005 | `state-transition.test.ts` (상태) + `StepResultPage.test.tsx` (UI) | pending — E2E `golden-path-partial.spec.ts` 미작성 |
| **네트워크 끊김 (Edge Function 호출 실패)** | QA-FAIL-006 | — | **미커버** |
| **동시 입력 충돌 (두 탭)** | QA-FAIL-007 | — | **미커버** — DB constraint / Playwright multi-context 미작성 |
| **권한 누수 (RLS)** | QA-FAIL-008 | `rls-cross-tenant.sql` + v2 RLS 3종 (CI `pgtap-rls`) | **커버** — 17 엔티티 × 6 시나리오 (cross-tenant + anon + service_role) |
| **로젠 `getSlipNo` 실패 (재시도 3회 후 수동)** | QA-FAIL-101 | `logen-register-shipment.test.ts` | pass |
| **로젠 `registerOrderData` 부분 실패** | QA-FAIL-102 | `logen-register-shipment.test.ts` | pending |
| **마켓 송장 제출 부분 실패** | QA-FAIL-103 | `shipping-dispatch.test.ts` + `ShippingDispatchResultPage.test.tsx` | pending |
| **자격증명 평문 누출 (로그/Sentry/DB)** | QA-FAIL-201 | `redact-regression.test.ts` + `edge-masking.test.ts` + `naver-edge.test.ts` | pass (단위) — release grep 수동 |
| **IP 화이트리스트 미등록 (5개 마켓 콘솔)** | QA-FAIL-202 | — | `BLOCKED (자동 불가)` — release 수동 |
| **debug ↔ real 어댑터 격차** | QA-FAIL-301 | `tests/unit/adapters/<market>/parity.spec.ts` (testing.md §12) | **미커버** — parity.spec.ts 파일 자체 부재 (`testing.md` R-006 위반 가능) |

---

## 10. 커버리지 갭 우선순위 (다음 스프린트 후보)

**자동 가능 (즉시)**:

1. ~~**RLS-SQL 단위 테스트 전면 부재** (QA-AUTH-006 / QA-HIST-006 / QA-ORD-011 / QA-SHIP-013)~~ → **해소** (CI `pgtap-rls` 잡 추가, `apps/api/supabase/tests/rls-cross-tenant.sql` 102 케이스 + v2 RLS 3종 자동 실행). 후속: v1.4 `order_groups` 등 신규 테이블의 cross-tenant 시나리오 추가 (별도 PR).
2. **partial / retry / skip-market E2E** (QA-REG-009 / QA-REG-017 / QA-HIST-001 / QA-HIST-002) — `golden-path.md` §9.1~§9.3 권장 spec 3개 미작성. 부분 등록 실패는 실사용에서 가장 흔한 시나리오.
3. **debug ↔ real parity.spec.ts 부재** (QA-FAIL-301) — `testing.md` R-006 / §12 헌법 위반 가능. 5개 마켓 어댑터 모두 real 코드 존재함에도 parity 단위 테스트 0건.
4. **이미지 파이프라인 단위 테스트 부재** (QA-REG-006) — `cross-cutting/image-pipeline.md` 의 resize / format 변환 함수가 분리된 단위로 검증되지 않음.
5. **429 / 5xx 백오프 단위 테스트 부재** (QA-MKT-ERR-002 / QA-FAIL-003 / QA-FAIL-006) — `RegistrationJob` 오케스트레이터의 rate limit 처리.

**자동 가능 (중기)**:

6. CSV export (QA-REG-012 / QA-HIST-005) — 기능 자체 코드 존재 여부 확인 필요.
7. 알림 발송 / 알림 UI (QA-REG-013 / QA-MKT-CONN-005 / QA-ERR-002~004) — 알림 도메인 자체가 구현되지 않은 정황.
8. HTML WYSIWYG / XSS sanitize (QA-REG-014~016) — MVP 포함이지만 구현/테스트 미확인.
9. 오류 통계 차트 (QA-HIST-004) — Postgres view + 차트 컴포넌트.
10. 동시 입력 충돌 (QA-REG-018 / QA-FAIL-007) — Playwright multi-context.

**BLOCKED (외부 의존)**:

- **11번가 어댑터 전체** (QA-MKT-11ST-001 / QA-ORD-006) — v1 범위 명시이지만 스펙 미확보. 11번가 셀러오피스 API Key 발급 + 어댑터 5메서드 구현 필요.
- **IP 화이트리스트 검증** (QA-MKT-ERR-005 / QA-FAIL-202) — 자동 검증 불가. release 수동 체크리스트로 잠금.
- **OQ-SHIP-02 웹훅** (QA-ORD-012) — 마켓 push 지원 여부 미확인.
- **OQ-SHIP-04 `fareTy` / `dlvFare`** (QA-CFG-007) — 로젠 B2B 계약 확정값.
- **OQ-SHIP-05 자동 제출 옵션 기본값** (QA-SHIP-012) — UX 결정 대기.

**갭 top 5 (즉시 백로그 후보)**:

| 순위 | 클러스터 | 영향 | 추정 작업량 |
|---|---|---|---|
| 1 | RLS-SQL 단위 (8 테이블 × 2 셀러 cross-access) | P0 보안 — 셀러 격리 검증 0건 | 1~2 sprint |
| 2 | partial / retry / skip-market E2E 3종 | P0 사용자 경로 — 가장 흔한 실패 시나리오 | 1 sprint |
| 3 | parity.spec.ts 5종 (마켓별) | P0 헌법 위반 가능 (R-006) | 1 sprint |
| 4 | 이미지 파이프라인 단위 | P1 등록 품질 | 0.5 sprint |
| 5 | 11번가 어댑터 (BLOCKED 해제 후) | P1 v1 범위 충족 | 외부 의존 |

---

## 11. 변경 절차

- 본 매트릭스는 **추가만**. 행을 지우려면 해당 시나리오가 더 이상 의미 없다는 사유와 함께 별도 PR.
- 마켓 어댑터 변경 PR — 영향받는 행 전부 `pending` 으로 재설정 후 재검증.
- 신규 PRD 기능 — 행 추가 + `pending` 등록 + 즉시 자동화 진행.
- `BLOCKED` → `pending` 전환 시 어떤 issue / handoff / 외부 결정이 잠금 해제했는지 비고 컬럼에 명시.
- 본 문서 변경 시 `testing.md` §13 의 Phase 종료 PASS 표와 cross-check (Phase 게이트가 본 매트릭스를 참조).

---

**문서 끝.** 신규 기능 PR 진입 시 본 매트릭스의 해당 행이 `pending` 또는 `pass` 가 아니면 R-001 / R-009 위반.
