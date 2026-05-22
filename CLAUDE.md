# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 레포 현재 상태

**디렉토리 정리 (2026-05-19)**: 모노레포 스타일로 FE/BE 분리.

```
apps/web/                  # 프론트엔드 (Vite root)
  src/
  index.html
apps/api/
  supabase/                # 백엔드 (Edge Functions + migrations, Supabase CLI workdir)
docs/
  spec/                          # 제품 요구사항·플로우 (PRD.md, docs/spec/user_flow.md)
  architecture/v1/               # 영구 설계 결정
  design-renewal/                # 외부 디자이너 인계용 화면 정의 (.md) — 디자인 ground truth
  handoff/                       # 세션 간 WIP 메모 (일회성)
  legacy/prototype-v0/           # v0 시각 레퍼런스 (읽기 전용)
  legacy/frontend_html_design-v1/ # v1 HTML 프로토타입 — deprecate (디자이너 인계 채널이 design-renewal/*.md 로 이동)
tests/                     # cross-cutting (Vitest unit + Playwright e2e + fixtures)
scripts/                   # 빌드 헬퍼 (postbuild-spa.mjs 등)
```

- `docs/spec/PRD.md` — 제품 요구사항 (9개 대기능 / 약 70개 세부 기능 + 주문·배송 §6~§9)
- `docs/spec/user_flow.md` — User flow (9 섹션 / 60 노드, manyfast.io 기반 + s7~s9 자체 확장)
- `docs/legacy/prototype-v0/` — v0 시각 레퍼런스 (읽기 전용)
- `apps/web/src/` — SPA 본구현 (React 18 + Vite + TS strict + shadcn/ui + React Router v6 + 라이트/다크 + 404.html SPA fallback)
- `apps/api/supabase/` — Postgres 마이그레이션 + Edge Functions (Deno)
- `scripts/postbuild-spa.mjs` — `dist/index.html` → `dist/404.html` 복제 (GitHub Pages SPA fallback)
- 빌드/타입/린트 설정은 루트 유지, Vite root 는 `apps/web/`

새 코드를 추가할 때는 그 결정에 사용된 근거(PRD 의 어떤 요구사항 / user_flow 의 어떤 노드)를 명시한다.

## 빌드 / 테스트 / Lint 명령

| 명령 | 동작 |
|---|---|
| `pnpm dev` | 개발 서버 (Vite, `VITE_APP_MODE=dev VITE_USE_MOCK=true`, http://localhost:5173) |
| `pnpm dev:db` | 개발 서버 (`VITE_APP_MODE=dev VITE_USE_MOCK=false`, dev-supabase + real 마켓 어댑터) |
| `pnpm dev:real` | 개발 서버 (`VITE_APP_MODE=real VITE_USE_MOCK=false`, 운영 DB — 위험, 최소 사용) |
| `pnpm typecheck` | `tsc --noEmit -p tsconfig.app.json` — 타입만 검증 |
| `pnpm lint` | ESLint flat config (typescript-eslint strict + react + react-hooks + jsx-a11y, `no-explicit-any` error) |
| `pnpm format` | Prettier 적용 |
| `pnpm build` | `tsc --noEmit` → `vite build` (기본 모드) |
| `pnpm build:dev` | `VITE_APP_MODE=dev VITE_USE_MOCK=false` 로 빌드 (CI sanity) |
| `pnpm build:real` | `VITE_APP_MODE=real VITE_USE_MOCK=false` 로 빌드 (운영 산출물) |
| `pnpm preview` | 빌드 산출물 로컬 서빙 |
| `pnpm test` | Vitest 단위·통합 (run 1회) |
| `pnpm test:watch` | Vitest watch 모드 |
| `pnpm test:ui` | Vitest UI |
| `pnpm test:e2e` | Playwright E2E (dev / preview 서버 선행 + `E2E_BASE_URL` 지정) |
| `pnpm test:e2e:ui` | Playwright UI 모드 |
| `pnpm test:e2e:install` | Playwright Chromium 설치 (최초 1회) |
| `pnpm supabase:link:dev` | Supabase CLI 를 dev 프로젝트 (eqo...) 로 link |
| `pnpm supabase:link:real` | Supabase CLI 를 real 프로젝트 (lfr...) 로 link |
| `pnpm db:push:dev` / `db:push:real` | link 후 마이그레이션 push (dev/real 각각) |
| `pnpm functions:deploy:dev` / `functions:deploy:real` | link 후 Edge Functions 배포 (dev/real 각각) |

전제: `pnpm install` 이 선행되어야 한다. Node `>=20`, pnpm `>=9` (`packageManager: pnpm@9.12.3` 고정).

## CI/CD

마스터: `docs/architecture/v1/ops/ci-cd.md` (워크플로우 / PR 잡 / 배포 잡 / 시크릿 매트릭스 / 롤백 절차 전부).

- **워크플로우**: `.github/workflows/ci.yml` (PR + push) / `deploy.yml` (`main` push + 태그 + `workflow_dispatch`).
- **PR 머지 게이트** (branch protection):
  - `develop`: Lint & Typecheck / Unit (Vitest) / Build matrix (dev + real) / E2E Golden Path 전체 통과.
  - `main`: 위 전부 + release/hotfix 만 허용 + linear history (squash).
- **위험 게이트 (수동 결정)**:
  - **`supabase db push` 자동 적용 default 비활성.** `workflow_dispatch` 의 `apply_db_migrations=true` 입력 시에만 실행 (ci-cd.md §7 drift 정책).
  - `deploy_edge_functions=false` 로 프론트만 재배포 (롤백 시나리오) 가능.
- **시크릿 추가/변경 시** `docs/architecture/v1/ops/ci-cd.md` §시크릿 매트릭스 갱신 필수. service_role / 마켓 OAuth client secret 저장 금지 (Supabase Edge Function env vars 사용).

## 데이터 레이어 (enforcement 룰만)

상세: `docs/architecture/v1/frontend.md` + `cross-cutting/market-adapter.md` + `cross-cutting/credential-vault.md`.

- **단일 진입점 강제** — Supabase 는 `getSupabase()`, 마켓 어댑터는 `getMarketAdapter(marketId)`, 환경변수는 `isDev` / `isReal` / `useMock` boolean. 직접 `createClient` / 어댑터 구현체 import / `import.meta.env.VITE_APP_MODE` 비교 모두 금지.
- **zod 스키마 단일 소스** — `apps/web/src/lib/schemas/`. RHF resolver + Supabase insert + 서버 응답 parse 3중 재사용. 컴포넌트 내부 inline `z.object` 금지.
- **ENUM 마스터 위치** — `JOB_STATUSES` / `MARKET_RESULT_STATUSES` / `MARKET_IDS` 는 `schemas/registration.ts` + `schemas/common.ts` 에서만 정의. 타 도메인은 import.
- **Query Key 규약** — `[domain, ...filters]` (예: `['products', { sellerId, status }]`). `queryClient` 기본값은 `frontend.md §4.3` 참조.
- **i18n** — 사용자 노출 텍스트는 `apps/web/src/locales/ko.ts` path 참조. 하드코딩 금지.
- **Sentry 마스킹** — `initSentry()` 의 `beforeSend` / `beforeBreadcrumb` 가 `lib/security/redact.ts` 의 `redact()` 강제. OAuth 토큰·PII 누출 0 (security.md §6.2/§6.3 마스터).

## 테스트 디시플린

마스터: `docs/architecture/v1/testing.md` (헌법) + `qa/golden-path.md` (게이트).

- **PR 진입 기준** — 새 컴포넌트/hook/유틸 = 단위 테스트 1+ 성공 + 1+ 실패 시나리오 (R-001). 새 라우트 = `tests/e2e/a11y.spec.ts` ROUTES 배열 추가 + 회귀 axe 통과 (R-009). 새 zod 스키마 = pass 1 + fail ≥1.
- **골든패스 게이트** — `tests/e2e/golden-path.spec.ts` 가 `main` 머지 차단 기준. `test.skip / test.fixme / test.only` 우회 PR 거부 (R-003).
- **mock ↔ real 어댑터 격차** — real 어댑터 도입 시 `tests/unit/adapters/<market>/parity.spec.ts` 추가 강제 (R-006).

## 인프라 결정 (확정)

마스터: `docs/architecture/v1/platform.md` (스택 / 호스팅 / Supabase 매핑 / 함의 제약) + `frontend.md` (라우팅 / 폼 / 데이터 / 테마) + `ops/ci-cd.md` (브랜치 / 배포) + `security.md` (Sentry 마스킹 / 자격증명 저장).

**고정 스택 (변경 시 마스터 4개 동기 갱신):**

React + Vite + TS strict (`noUncheckedIndexedAccess`) / pnpm / React Router v6 + GH Pages 404.html fallback / shadcn/ui + Tailwind / TanStack Query + Supabase JS / RHF + zod / Vitest + RTL + Playwright / ESLint strict + Prettier (`no-explicit-any` error) / Sentry / i18n `locales/ko.ts` / 라이트·다크 / WCAG 2.1 AA / Git Flow (main / develop / release/* / feature/* / hotfix/*, squash) / GitHub Pages 정적 + Supabase (Auth / Postgres+RLS / Storage+RLS / Edge Functions / Realtime).

**enforcement 룰:**
- 외부 데이터 (서버 응답·마켓 API) = zod 런타임 검증 필수.
- 색상·spacing·radius = `apps/web/src/styles/globals.css` CSS 변수 또는 `tailwind.config.ts` 키만. raw HEX·임의 px 금지.
- RHF + Supabase insert + 서버 응답 parse 는 동일 zod 스키마 3중 재사용 (단일 ground truth).
- RLS 없는 테이블 거부. OAuth access/refresh 토큰 클라이언트 직접 SELECT 차단 (Edge Function 전용 + pgcrypto / Vault).
- 골든패스 (s1→s5→s3→s6) Playwright 1개 강제. 우회 PR 거부.
- Sentry `beforeSend` 에서 OAuth 토큰·셀러 PII 자동 마스킹 (security.md §6.2).

**함의 제약**: Edge Function timeout 내 완결 → 일괄 등록은 마켓당 함수 1회 + Postgres 진행상황 적재 + Realtime 푸시. 프론트 BFF 불가 → 서버 로직은 Edge Function / Postgres RPC.

## 빌드 모드: dev / real + useMock 플래그

플래그 2개로 분리 (2026-05-22):

- **`VITE_APP_MODE`** (`dev` | `real`) — DB / Edge Function 타겟 + Sentry 환경 라벨
- **`VITE_USE_MOCK`** (`true` | `false`) — 마켓 어댑터 소스 (mock vs real)

두 플래그 모두 **빌드 타임 분기**. 런타임 토글 아님.

| 조합 | 명령 | 데이터 소스 | 마켓 API | 인증 |
|---|---|---|---|---|
| `dev` + `useMock=true` | `pnpm dev` | dev-supabase (eqo...) | mock 어댑터 | dev Supabase Auth |
| `dev` + `useMock=false` | `pnpm dev:db` | dev-supabase (eqo...) | 실 마켓 API | dev Supabase Auth |
| `real` + `useMock=false` | `pnpm dev:real` / `build:real` | real-supabase (lfr...) | 실 마켓 API | real Supabase Auth |
| `real` + `useMock=true` | (금지) | — | — | 부트스트랩 시 throw |

**규칙:**
- mock / real 어댑터는 동일 `MarketAdapter` 인터페이스 (코드 분기 최소화).
- useMock=true 전용 코드는 `if (useMock)` 가드 + dynamic import. real 번들에 mock·시크릿 누출 0 (CI grep 검증 — `VITE_APP_MODE=dev` / `VITE_USE_MOCK=true` 리터럴 차단).
- 토큰·OAuth refresh 흐름은 dev 에서도 실 경로로 검증 (보안 우회 금지).
- dev / real 별도 Supabase 프로젝트 (project ref: dev=`eqoywqoalwkwbrdsulfl`, real=`lfrnythcujxdhehvkmtg`). 트래픽 교차 금지. SQL 마이그레이션 단일 소스 (Supabase CLI), 각 프로젝트에 개별 push.
- env 파일은 mode-scoped: `apps/web/.env.development*` (dev 로드) / `apps/web/.env.real*` (real 로드, `--mode real` 진입). `.local` 접미사는 gitignored, 그 외 committed.

## 제품 도메인

**다중 마켓 상품 자동 등록 SaaS.** 개인 판매자가 상품 정보를 한 번 입력하면 네이버 스마트스토어, 11번가, 쿠팡, 지마켓, 옥션 같은 복수 마켓에 동시 등록되는 웹/앱 서비스. 타겟은 1인 기업가·소규모 셀러.

핵심 도메인 개념(코드 추가 시 일관된 네이밍 유지):

- **Market / Channel** — 외부 마켓플레이스 (네이버 스마트스토어, 11번가, 쿠팡, 지마켓, 옥션). 각 마켓은 고유한 카테고리 트리·이미지 규격·필수필드·OAuth 인증 정책을 가짐.
- **MarketAccount** — 사용자가 연결한 마켓별 계정/토큰. 암호화 저장 필수, OAuth 토큰 자동 갱신.
- **Product** — 사용자가 입력하는 마스터 상품 정보(상품명, 가격, 카테고리, 이미지, 배송정보, HTML 상세).
- **Template** — 자주 쓰는 Product 필드 묶음. 이미지·HTML 상세까지 포함, 버전/이력 관리.
- **MarketMapping** — Product → Market 별 변환 결과 (카테고리 코드 매핑, 이미지 리사이즈/포맷 변환, 필수필드 보정).
- **RegistrationJob** — 병렬 일괄 등록 작업. 상위 상태는 `pending` / `running` / `partial` / `succeeded` / `failed` / `retrying` / `cancelled` (Postgres ENUM). 마켓별 세부 결과(성공/실패/오류 메시지/외부 상품 ID)는 별도 테이블 `registration_job_market_results` 에 1:N 으로 적재 — 한 마켓 실패가 다른 마켓 상태에 영향 없도록 분리. 상태 전이 규칙은 backend 에이전트가 명시.

## 핵심 아키텍처 결정 사항 (PRD 에서 도출)

마스터: `docs/architecture/v1/cross-cutting/` (`market-adapter.md` / `image-pipeline.md` / `registration-job-state.md` / `credential-vault.md`).

횡단 관심사 (코드 작성 전 고려):

1. **마켓 어댑터 추상화** — `MarketAdapter` 5메서드 (`authenticate` / `refreshToken` / `fetchCategoryTree` / `transformProduct` / `createProduct`). 재시도·rate limit·이미지 변환·로깅은 어댑터 바깥 (RegistrationJob 오케스트레이터). 신규 마켓 = 인터페이스 구현 1파일 + 단위 테스트.
2. **이미지 파이프라인** — 업로드 1회 → 마켓별 변환본 N. 크기·포맷·압축 마켓별 상이 (§1.2.2).
3. **병렬 등록 + 재시도** — `RegistrationJob` 마켓별 독립 실행. 한 마켓 실패가 다른 마켓 진행 차단 금지 (§1.3.1, §1.3.2).
4. **자격증명 보안** — 토큰·API 키 암호화 저장 (`credential-vault.md`). 평문 금지.
5. **실시간 상태** — 대시보드 + 마켓 연결 상태 = Supabase Realtime (§4.1.1, §2.2.2).
6. **반응형 + 크로스 브라우저** — 1200+ / 768~1199 / ~767 브레이크포인트, Chrome/Safari/Firefox/Edge, 터치 ≥44×44px (§5).

## 프로토타입 (legacy v0)

`docs/legacy/prototype-v0/` — **MarketCast** 정적 프로토타입 (CDN React UMD + Babel standalone, 빌드 도구 없음). v1 SPA 와 자동 동기화 대상 아님. 시각 레퍼런스 (styles.css 토큰 / 컴포넌트 모양) 만 v1 으로 이식하고 `window.AppData` 전역·CDN 의존은 가져오지 않는다. PRD/user_flow 가 ground truth, 프로토타입은 UX 제안.

**마켓 라인업 색상 표준**: 네이버 `#03C75A` / 11번가 `#FF0038` / G마켓 `#00B147` / 옥션 `#E73936` / 쿠팡 `#F11F44`.

## MVP 범위 (v1)

PRD 70여 세부 기능 중 **v1 에 들어가는 항목만** 아래에 추림. 나머지는 v2+ 로 보류. 새 기능 제안 시 "MVP 안인지" 먼저 확인 — 안이면 v2 백로그에 명시.

**포함 (v1):**

- **s1 인증** — 이메일/소셜 로그인, 회원가입, 비밀번호 재설정.
  - PRD §2.1.1 회원가입 폼 유효성 검사, §2.1.2 비밀번호 강도 검사, §2.1.4 세션 관리 + 자동 로그아웃, §2.1.5 비밀번호 재설정.

- **s2 대시보드** — 등록 현황 요약 + 마켓별 상세 통계 위젯 + 최근 등록 내역 + 필터/정렬.
  - PRD §4.1.1 실시간 자동 갱신 (Supabase Realtime), §4.1.2 마켓·상태·날짜·상품명 필터/정렬.

- **s3 상품 등록** — 5단계 위저드 (정보 → 이미지 → 마켓·카테고리 → 미리보기 → 결과).
  - 폼/이미지/카테고리/배송: PRD §1.1.1 상품명 자동 검증 + 실시간 중복 확인, §1.1.2 이미지 다중 업로드 + 미리보기 + 순서 조정, §1.1.3 동적 카테고리 선택 + 필터링, §1.1.4 기본 배송 정보 입력.
  - 마켓 매핑/변환: §1.2.1 마켓별 상품 속성 자동 변환, §1.2.2 마켓별 이미지 규격·포맷 자동 최적화, §1.2.3 마켓별 필수 항목 자동 체크.
  - 일괄 등록 실행: §1.3.1 등록 요청 병렬 처리 + 상태 관리, §1.3.2 실패 자동 재시도, §1.3.3 마켓 API 인증·보안 통신.
  - 결과/내보내기: §1.4.1 등록 결과 상세 내역, §1.4.2 등록 결과 CSV/Excel 내보내기.
  - HTML 상세: §3.6.1 WYSIWYG 에디터, §3.6.2 HTML 코드 유효성·XSS 검사, §3.6.3 HTML 상세 설명 미리보기.

- **s5 마켓 계정** — **v1 정식 = 네이버 / 쿠팡 / G마켓 / 옥션 / 11번가 5개 전부** (real 어댑터까지 동작). 모든 마켓 호출은 **AWS Lightsail Market Gateway (서울 리전, 고정 IP)** 경유 (`docs/architecture/v1/cross-cutting/market-gateway.md`). 어댑터 인터페이스는 **AuthInput 4-way discriminated union** (`oauth_code` | `hmac_key` | `esm_jwt` | `api_key`). `refreshToken` 은 OAuth(네이버)만 사용 — optional. credential 저장은 `credential_payload jsonb` 단일 컬럼 + pgcrypto 암호화.
  - PRD §2.2.1 OAuth 인증 플로우, §2.2.2 API 연결 상태 실시간 표시, §2.2.3 OAuth 토큰 갱신 자동화, §2.3.1 연결 계정 목록 조회, §2.3.2 마켓 계정 추가/수정/삭제, §2.3.3 연결 상태 실시간 표시.
  - 자격증명 보안: §2.4.1 정기 보안 감사, §2.4.2 인증 정보 백업/복구.
  - 근거: 5개 마켓 모두 v1 출시 가능. 11번가 IP 화이트리스트 정책은 Lightsail 인스턴스 고정 IP 등록으로 해소 (2026-05-22 결정, O-9 종결).

- **s6 등록 이력** — 목록 + 기본 필터 + 재시도/마켓 제외 후 등록.
  - PRD §4.3.1 오류 수정 후 즉시 재시도, §4.3.2 오류 마켓 제외 후 나머지 일괄 등록, §4.4.1 등록 이력 상세 검색 (다중 조건), §4.4.2 오류 유형별 통계 (마켓별·기간별 성공률 차트), §4.4.3 등록 이력 CSV/Excel 내보내기.

- **알림 (횡단 도메인)** — 등록·계정·오류 알림.
  - PRD §1.4.3 등록 성공/실패 알림 설정 (이메일·앱 푸시), §2.3.4 마켓 계정 상태 변경 알림 (토큰 만료·인증 실패), §4.2.1 오류 메시지 유형별 분류 + 해결 가이드, §4.2.2 실시간 오류 알림 (팝업/배너), §4.2.3 오류 자동 로그 + 빈도 통계.

- **반응형·크로스 브라우저** — PRD §5.1 (12칼럼·flexbox·미디어쿼리), §5.2 (44px 터치·햄버거·16px 폰트), §5.3 (Chrome/Safari/Firefox/Edge).

- **성능 최적화** — PRD §5.4.1 이미지 WebP 압축 + 크기별 변형본, §5.4.2 코드 스플리팅, §5.4.3 브라우저/서버 캐싱, §5.4.4 지연 로딩 (Lazy Loading), §5.4.5 CSS/JS/HTML 압축·축소 (Minify + Gzip).

**제외 (v2 이후):**
- s4 템플릿 관리 전체 (PRD §3.1~§3.5)
- 2FA (§2.1.3)
- 멀티유저/권한 모델 (§3.3.3 템플릿 수정 권한, §4.1.3 대시보드 접근 권한) — 1인 셀러 모델 가정. 팀/조직 기능 도입 시점에 별도 트랙으로 재논의.

**결제·정산 모델 (v1):** 전면 무료. 사용 패턴 수집을 위해 **월간 등록 건수 소프트 제한** (정확한 한도는 베타 운영 데이터 기반 후속 결정). Stripe·PG 연동·구독 결제는 v2+ 로 보류. PCI-DSS 적용 범위는 v1 에 없음.

**KPI 측정:**
- Supabase 테이블 + Postgres **계산 view** 로 직접 집계.
- 필수 테이블: `events` (사용자 행동 이벤트), `registration_jobs` (등록 잡 시작/완료 타임스탬프), `sessions` (MAU 기초).
- 핵심 지표 (PRD §1.핵심지표):
  - **월간 총 등록 건수** = `registration_jobs` 의 `created_at` 월별 count
  - **MAU** = `sessions` 의 `seller_id` 30일 distinct count
  - **평균 등록 시간 단축률** = `registration_jobs.completed_at - created_at` 의 분포 변화 추적 (베이스라인은 v1 출시 후 첫 달)
  - **NPS** = in-app 설문 별도 테이블 `nps_responses`
- 외부 분석 도구(PostHog 등) 도입하지 않음. PII 외부 노출 0 유지.

## User Flow 구조

`docs/spec/user_flow.md` 의 46 노드는 6 섹션으로 구성된다. 라우팅/네비게이션 구조의 ground truth 다:

- **s1 인증** — 로그인 / 소셜 로그인 / 회원가입 / 비밀번호 찾기 → 대시보드
- **s2 대시보드** — 등록 현황 요약 / 마켓별 통계 / 최근 등록 내역. 다른 모든 섹션의 진입점.
- **s3 상품 등록** — 상품 정보 입력 → 마켓 선택 → 카테고리 매핑 → 등록 미리보기 → 일괄 등록 실행 → 등록 결과. 오류 시 재시도 또는 마켓 제외 후 등록.
- **s4 템플릿 관리** — 목록 / 생성 / 수정 / 이미지 관리 / HTML 설명 편집.
- **s5 마켓 계정** — 연결된 계정 목록 / 신규 연결 → OAuth → 계정 연결. 해제 / 상태 확인.
- **s6 등록 이력** — 이력 목록 / 상세 / 오류 분석 / 기간·마켓 필터.

화면 추가/변경 시 docs/spec/user_flow.md 의 노드·엣지와 정합성이 깨지지 않도록 한다. 새 화면이 생기면 docs/spec/user_flow.md 도 함께 업데이트.

## 작업 시 주의

- **추측 금지** — 기술 스택·MVP 범위·결제 모델·KPI 측정 모두 확정. 새 결정이 필요한 사안이 생기면 사용자에게 명시적으로 확인 후 CLAUDE.md 반영.
- **PRD 진행 상태 추적 위치** — PRD 본문에는 **진행 상태 마커를 두지 않는다** (drift 누적 방지). 진행 상태 추적은 `docs/handoff/WIP-*.md` (실시간) 와 GitHub Issues/PR 단위로만 관리. PRD 의 `중요도` / `역할` / `기기` 메타데이터는 유지 (시점에 따라 변하지 않는 값).
- **빌드/테스트 명령은 위 "빌드 / 테스트 / Lint 명령" 섹션 참조** — Stage A 에서 채워졌다. 명령이 추가/변경되면 그 섹션을 갱신할 것.

## Rules

### 기능 설계 순서

새 기능 설계 시 아래 순서를 따른다:

1. **화면 흐름 설계** — `docs/spec/user_flow.md` 노드·엣지 갱신 + `docs/architecture/v1/` 의 UI 설계문서. 어떤 화면이 추가되는지, 어떤 라우트로 진입하는지.
2. **데이터 모델 + API 스키마 정의** — Postgres 테이블/RLS 정책 SQL + Edge Function 시그니처 (`Request`/`Response` 타입은 zod 스키마로). `docs/architecture/v1/features/<feature>.md` 에 작성.
3. **백엔드 구현** — Postgres 마이그레이션 → Edge Functions 구현. 외부 마켓 API 호출은 `MarketAdapter` 인터페이스로.
4. **프론트엔드 구현** — `apps/web/src/features/<domain>/` 안에서 화면 + hook + api 클라이언트. zod 스키마는 백엔드와 공유 (가능하면 `apps/web/src/lib/schemas/` 에 단일 소스).

### 2개 산출물 동기화

코드 수정 시 관련된 2개를 함께 맞춘다 (이전 "3개 산출물" 의 HTML 프로토타입은 deprecate — `docs/legacy/frontend_html_design-v1/`):

- **설계문서** — `docs/architecture/v1/features/<feature>.md` (영구 설계) 와 `docs/design-renewal/s{N}-<domain>.md` (외부 디자이너 인계용 정의서, 디자인 ground truth)
- **실제 구현** — `apps/web/src/features/<domain>/`

**즉시 sync 가 필요한 변경** (예외 없음 룰 유지):
- 신규 화면 / 페이지 추가
- 컴포넌트 자체 추가/제거
- 레이아웃 구조 변경
- API/데이터 모델 변경 (스키마·RPC·Edge Function 시그니처)

**iteration 중 sync 보류**: 색상/텍스트/패딩/버튼 위치 같은 사소한 스타일 트윅은 코드만 수정. 설계문서·정의서 동기화는 보류. "동기화할까요?" 질문도 생략.

**commit 직전 일괄 sync sweep**: `git-commit` 실행 시 그동안 미뤄둔 변경을 일괄 반영. commit 시점에 정합 충족.

*(주: 로컬 hook 이 위 룰을 매 prompt 마다 자동 주입한다 — 사용자 머신 한정 토큰 절감 규약.)*

### 외부 API 로깅 패턴

외부 마켓 API (스마트스토어 / 쿠팡 / 11번가 / G마켓 / 옥션) 및 Supabase RPC 등 외부 호출 시 반드시 구조화 로그를 남긴다. Edge Functions 는 Deno + TypeScript:

```ts
logger.info({ market: 'naver', method: 'GET', url, sellerId }, '→ market request');
logger.info({ market: 'naver', status }, '← market response');
logger.error({ market: 'naver', err: maskError(e) }, '← market error');
```

- **OAuth access/refresh 토큰, API 키, 셀러 비밀번호·이메일·전화번호는 절대 로그에 포함 금지.** 토큰은 길이만, 셀러 식별은 internal `sellerId` (UUID) 만.
- 모든 외부 호출에 `correlationId` (요청 단위) + `jobId` (RegistrationJob 단위) 부여.
- Sentry 로 흘리기 전 `beforeSend` 훅이 위 금지 키를 자동 마스킹해야 함 (security 에이전트 검수 필수).

### 의사소통 방식

- **선택지를 물어볼 때는 자신의 의견(추천)을 먼저 말할 것.** 추천 옵션을 첫 번째 자리에 두고 "(추천)" 표기.
- 사용자가 의견을 제시하면 **무조건 수용하지 않는다** — 좋은지 나쁜지 자체 판단을 함께 제시한 다음 진행.
- **사용자 질문에 동의하면** → 의견 + 바로 수정.
- **신규 의견이나 반대 의견이면** → 의견만 먼저 제시, 확인 후 수정.
- **사용자가 문제/버그를 보고하면** → 해결책 제안만 하고, **확인 받은 후** 코드 수정. 단 "이렇게 고쳐줘"처럼 명확히 지시한 경우는 바로 수정.

### 파일 관리 원칙

- 프로젝트 외부 파일(`~/.claude/projects/` 등) 은 수정하지 않는다.
- 사용자가 관리하는 파일(memory, 설정) 은 프로젝트 폴더 `.claude/` 하위에 둔다.

### 메모리 저장 원칙

무언가를 기록할 때, **CLAUDE.md vs memory 중 어디에 남길지** 의견과 함께 사용자에게 확인한다:

- **CLAUDE.md** — 프로젝트 규칙, 명령어, 아키텍처 결정, 도메인 정의 등 **모든 세션에서 항상 적용**되는 내용.
- **memory** (`~/.claude/projects/.../memory/`) — 일회성 프로젝트 상황, 외부 참조, 시점에 따라 달라질 수 있는 컨텍스트.

### 프론트엔드 UI 일관성

새 화면 개발 시 공통 규칙을 반드시 따른다:

- **shadcn/ui 컴포넌트 통일** — `<Button>`, `<Input>`, `<Dialog>` 등 `apps/web/src/components/ui/` 의 것을 사용. raw `<button>` / `<input>` 사용 금지 (단, shadcn 으로 못 표현하는 특수 케이스는 PR 에 사유 명시).
- **버튼 유형별 동작 구분** — 검색/필터류(즉시 결과 갱신, 페이지 이동 없음) vs 실행류(서버 변경·등록·삭제) 를 시각적으로 구분 (variant 다르게).
- **실행류 버튼 비활성 사유 표시** — `disabled` 처리만 하지 말고 `blockingReasons` 배열을 hover/focus tooltip 으로 노출 (예: "이미지 1장 이상 필요", "마켓 1개 이상 선택 필요").
- **긴 에러 메시지 접기/펼치기** — 공통 `ErrorMessage` 컴포넌트 (`apps/web/src/components/ui/error-message.tsx`) 사용. 마켓 API 오류는 stack/raw response 가 길어 접힘 기본.
- **4상태 + partial 처리** — 모든 비동기 UI 는 `loading` / `data` / `error` / `empty` 를 빠짐없이 처리. RegistrationJob 화면은 `partial` 추가.
- **접근성** — WCAG 2.1 AA. 키보드 동선 + aria 라벨 + 색상 대비 4.5:1.
- **색상·spacing·radius 는 토큰만** — `apps/web/src/styles/globals.css` 의 CSS 변수 또는 `tailwind.config.ts` 의 키만 사용. raw HEX·임의 px 금지. 토큰 추가가 필요하면 `docs/architecture/v1/ui-system.md` 먼저 갱신 후 globals.css·tailwind.config.ts 동기화.

### 신규 파일 생성 시 .gitignore 검토

- 새 파일이나 디렉토리를 만들 때, `.gitignore` 에 추가해야 하는지 검토하고 필요 시 제안한다.
- 임시 파일, 빌드 산출물(`dist/`, `.turbo/`), 환경 변수(`.env*`), Supabase 로컬 캐시(`supabase/.branches/`, `supabase/.temp/`), Sentry sourcemap 업로드 후 잔여물, OS 산출물(`.DS_Store`) 등이 의도치 않게 커밋되는 것을 방지.

## Design Documents

- `docs/architecture/v1/` — 플랫폼 · 프론트엔드 · UI 스타일 설계문서. 글로벌 아키텍처 결정, 디자인 토큰, 공통 컴포넌트 명세.
- `docs/architecture/v1/features/` — 기능별 백엔드/UI 설계. 파일명은 도메인 매핑 (`registration.md`, `markets.md`, `templates.md`, …). 각 문서에 데이터 모델 + API 스키마 + 화면 흐름 + 수락 기준 포함.
- `docs/design-renewal/` — 외부 디자이너 인계용 화면 정의 (s1~s9 도메인별 `.md`). 화면 정의 / 기능 / 워크플로우 / 컴포넌트 / 데이터 의존 / 디자인 리뉴얼 시 고려사항. v1 의 디자인 ground truth.
- `docs/legacy/frontend_html_design-v1/` — **deprecate**. 과거 정식 HTML 프로토타입. 인계 채널이 `design-renewal/*.md` 로 이동하며 더 이상 정식 산출물 아님. 시각 레퍼런스로만 참조.
