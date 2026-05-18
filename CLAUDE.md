# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 레포 현재 상태
- `PRD.md` — 제품 요구사항 문서 (5개 대기능 / 약 70개 세부 기능)
- `user_flow.md` — User flow 다이어그램 (6 섹션 / 46 노드 / 48 엣지, manyfast.io 출처)
- `prototype/` — UI 레퍼런스 프로토타입 (아래 "프로토타입" 섹션 참고)

빌드/테스트/Lint 명령은 아직 정의되어 있지 않다. 새 코드를 추가할 때는 그 결정에 사용된 근거(PRD 의 어떤 요구사항 / user_flow 의 어떤 노드)를 명시한다.

## 인프라 결정 (확정)

- **프론트엔드 스택**: **React + Vite + TypeScript strict**, 패키지 매니저 **pnpm**. `tsconfig` 는 `strict: true` + `noUncheckedIndexedAccess`. 외부 데이터(서버 응답·마켓 API)는 zod 로 런타임 검증.
- **라우팅**: **React Router v6+**. GitHub Pages 에서는 **404.html fallback** 패턴으로 SPA 클라이언트 라우팅 유지 (build 시 `dist/index.html` 을 `dist/404.html` 로 복제). URL 은 `/dashboard`, `/register` 처럼 깔끔. URL search params 는 zod 로 별도 검증.
- **UI 라이브러리**: **shadcn/ui + Tailwind**. 컴포넌트는 `src/components/ui/` 에 직접 소유 (라이브러리 의존이 아닌 코드 복사 방식). 접근성은 내부 Radix Primitives 가 담당. 프로토타입 `prototype/styles.css` 의 색상·spacing 토큰은 Tailwind `theme` 으로 이식.
- **데이터 페칭**: **TanStack Query + Supabase JS**. Supabase JS = raw 쿼리, TanStack Query = 캐싱·재시도·invalidation·mutation. Realtime 구독은 `useEffect` + `supabase.channel(...)` 직접 → Query cache invalidate 로 연결. Query Key 규약은 `[domain, ...filters]` 형식 (예: `['products', { sellerId, status }]`).
- **폼**: **React Hook Form + zod resolver**. 동일 zod 스키마를 (1) RHF 입력 검증, (2) Supabase insert 전 타입 보증, (3) 서버 응답 검증에 재사용 — 한 스키마가 ground truth.
- **디렉토리 구조**: `src/features/<domain>/` 으로 도메인별 묶음. 도메인 = `auth` / `dashboard` / `registration` / `templates` / `markets` / `history` (user_flow.md s1~s6 매핑). 각 폴더 안에 `components/`, `hooks/`, `api/`, `types/`, `pages/` 자체 보유. 공용 UI 는 `src/components/ui/` (shadcn), 공용 hook·유틸은 `src/lib/`.
- **테스트**: **Vitest + React Testing Library + Playwright**. Vitest = 단위·통합, RTL = 컴포넌트 렌더 테스트(접근성 셀렉터 우선), Playwright = E2E. 골든 패스(s1 로그인 → s5 마켓 연결 → s3 등록 6단계 → s6 이력 확인) 1개는 Playwright 로 자동화 강제 (qa 에이전트 룰).
- **코드 스타일**: **ESLint + Prettier**. ESLint 는 `typescript-eslint/strict` + `react` + `react-hooks` + `tanstack/query` 플러그인. `no-explicit-any` 는 error 레벨 — PR 차단. Prettier 는 포맷팅만.
- **에러 추적**: **Sentry**. 프론트 + Edge Functions 양쪽 SDK. **OAuth access/refresh 토큰·셀러 PII 자동 마스킹 룰을 SDK 초기화 시 강제** (`beforeSend` 훅 + 키 이름 화이트리스트). security 에이전트 검토 필수.
- **i18n**: 한국어 전용 운영. 단, 텍스트는 컴포넌트에 하드코딩하지 않고 `t('key')` 패턴 + `src/locales/ko.ts` 사전에 집계. 라이브러리는 i18next 또는 경량 자체 dictionary — 도입 시점에 결정. 나중 다국어 확장 시 레이블 대공사 회피.
- **테마**: **라이트 / 다크 처음부터 병행**. shadcn/Tailwind 의 `class="dark"` 토글 + CSS 변수 토큰. 색상·spacing 은 raw 값 금지 — 토큰만 사용 (ESLint 룰로 `no-restricted-syntax` 또는 `tailwindcss/no-custom-classname` 으로 강제 검토). 프로토타입 styles.css 의 라이트 토큰을 1차 이식, 다크 토큰은 첫 화면 구현 시 함께 정의.
- **접근성**: **WCAG 2.1 AA** 준수. 자동 검출: `eslint-plugin-jsx-a11y` (lint 시점) + `@axe-core/playwright` (E2E 시점). 수동 검증: 모든 새 화면에 키보드만으로의 전체 동선 확인, 색상 대비 4.5:1 이상, aria 라벨 명시. qa 에이전트가 수락 기준에 포함.
- **CI/CD**: **GitHub Actions**. PR 트리거: `pnpm install` → `tsc --noEmit` → `eslint` → `vitest` → `pnpm build` (debug 모드 sanity check). `main` push 트리거: real 모드 빌드 → GitHub Pages 배포 + Edge Functions 는 `supabase functions deploy` 동일 워크플로우. 시크릿은 GitHub Secrets (Supabase service role key, Sentry DSN 등). Edge Function 환경 변수는 Supabase 대시보드 별도 관리.
- **브랜치 전략**: **Git Flow**. `main` = 운영(real 배포 트리거), `develop` = 통합, `release/*` = 릴리즈 후보(추가 E2E·수동 QA), `feature/*` = `develop` 에서 분기, `hotfix/*` = `main` 에서 분기 후 `main` + `develop` 양쪽 머지. PR 머지는 squash. CI/CD 매핑: PR→develop 은 빌드까지, release→main 머지 시 real 배포 자동 트리거.
- **프론트엔드 호스팅**: GitHub Pages — 정적 호스팅. **SSR 불가 / SPA 필수.** 배포는 GitHub Actions → `gh-pages` 브랜치. 환경변수는 빌드 타임 주입 (런타임 시크릿 보관 불가, public 노출되는 값만 가능 — Supabase anon key). Vite 환경변수 prefix 는 `VITE_*`.
- **백엔드 / DB / Auth / Storage**: Supabase — Postgres + Auth + Storage + Edge Functions + Realtime 일체. 별도 서버 없음. 다음과 같이 매핑:
  - **Auth**: 셀러 회원가입/로그인/소셜 로그인/비밀번호 재설정 (PRD §2.1) → Supabase Auth. JWT 세션.
  - **DB**: Postgres + **Row Level Security (RLS) 필수** — 셀러는 본인 데이터(`Product`, `Template`, `MarketAccount`, `RegistrationJob`)만 접근 가능. RLS 정책 없는 테이블 거부.
  - **Storage**: 상품 이미지 원본 + 마켓별 변환본 (PRD §1.1.2 / §1.2.2 / §3.5). 버킷은 셀러별 prefix + RLS.
  - **Edge Functions**: 마켓 API 호출(OAuth 콜백, 카테고리 동기화, 일괄 등록 잡, 토큰 갱신). 마켓 자격증명·시크릿은 여기서만 접근. 클라이언트에서 마켓 API 직접 호출 금지 (CORS/시크릿 노출 회피).
  - **Realtime**: 등록 현황 대시보드 실시간 갱신 (PRD §4.1.1) → Postgres changes subscription. WebSocket/SSE 별도 구현 불필요.
- **마켓 자격증명 저장**: OAuth access/refresh 토큰은 Edge Function 만 접근 가능한 테이블 + `pgcrypto` 컬럼 암호화 (또는 Supabase Vault) + RLS 로 클라이언트 직접 SELECT 차단. JWT bypass 경로 없는지 보안 검토 필수.

**이 결정이 함의하는 제약:**
- 백엔드 언어 = Edge Functions (Deno / TypeScript) 로 사실상 확정.
- 장기 실행 잡은 Edge Function timeout(현재 한도 확인 필요) 안에 끝나야 함. 일괄 등록은 마켓당 함수 호출 1회로 쪼개고, 진행 상황은 Postgres 에 적재 + Realtime 으로 푸시.
- 프론트는 정적 자산만이라 BFF 패턴 불가. 모든 서버 로직은 Edge Function 또는 Postgres RPC 로.

## 빌드 모드: debug / real

앱은 두 가지 모드로 동작한다. `VITE_APP_MODE` (`debug` | `real`) 환경 변수로 분기.

| 항목 | debug | real |
|---|---|---|
| 데이터 소스 | `window.AppData` 또는 동등한 mock 픽스처 | Supabase (DB / Auth / Storage / Edge Functions) |
| 마켓 API | mock 어댑터 (성공/실패/지연 시나리오 재현용) | 각 마켓 운영 API (스마트스토어/11번가/G마켓/옥션/쿠팡) |
| 소스맵 | 활성화 | 비활성화 (또는 sentry-only) |
| 로깅 | verbose (debug/info/warn/error 전부, 콘솔 + 구조화) | warn 이상 + 구조화 로거만 |
| 인증 | Supabase Auth bypass 가능 (mock user) | Supabase Auth 강제 |

**규칙:**
- mock 어댑터와 실 어댑터는 **동일한 `MarketAdapter` 인터페이스** 를 구현. 모드 스위치만으로 교체 가능해야 함 (코드 분기 최소화).
- debug 전용 코드는 `if (mode === 'debug')` 가드 + tree-shaking 가능한 형태로 작성. real 번들에 mock 데이터·시크릿이 절대 들어가지 않게 빌드 설정 검증.
- 토큰·시크릿·OAuth refresh 흐름은 **debug 에서도 실제와 동일한 경로**로 검증 가능해야 함 (mock 모드라서 보안 우회 금지). security 가 거부권 행사 영역.
- 모드 전환 시 사용자 데이터·세션은 호환되지 않음 (다른 Supabase 프로젝트 / 다른 토큰). 빌드 시점에 고정, 런타임 토글 아님.

**Supabase 프로젝트 분리**: debug / real 각각 **별도 Supabase 프로젝트**. URL·anon key·서비스 키·시크릿·RLS 정책 전부 분리되어 운영 트래픽과 개발 트래픽이 절대 교차하지 않음. 마이그레이션은 두 프로젝트에 동일하게 적용되어야 하며, schema drift 가 생기지 않도록 SQL 마이그레이션 파일을 단일 소스로 관리 (Supabase CLI 권장 — Phase 1 에서 도구 확정).

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

코드를 작성하기 전 반드시 고려해야 하는 횡단 관심사:

1. **마켓 어댑터 추상화** — 각 마켓 API(REST/OAuth·카테고리 코드·이미지 규격·필수필드)가 모두 다름. PRD §1.2 / §2.2 / §2.4. `MarketAdapter` 인터페이스는 다음 5개 메서드만 강제 (최소 구성):
   - `authenticate(code)` → `{ accessToken, refreshToken, expiresAt }`
   - `refreshToken(refresh)` → `{ accessToken, refreshToken, expiresAt }`
   - `fetchCategoryTree()` → `CategoryNode[]`
   - `transformProduct(product, mapping)` → `MarketPayload` (마켓별 페이로드)
   - `createProduct(payload)` → `{ externalId, productUrl }`
   재시도·rate limit·이미지 변환·로깅 같은 횡단 관심사는 어댑터 **바깥**(공용 레이어 / RegistrationJob 오케스트레이터)에서 처리. 어댑터는 "이 마켓 API 호출"만 담당. 신규 마켓 추가는 인터페이스 구현 1파일 + 단위 테스트로 끝남.
2. **이미지 파이프라인** — 마켓별 크기/포맷(JPEG/PNG/WebP)/압축이 다름(§1.2.2). 업로드 1회 → 마켓별 변환본 N 생성하는 파이프라인 필요.
3. **병렬 등록 + 재시도** — `RegistrationJob` 은 마켓별로 독립 실행, 실패 시 자동 재시도 + 지정 횟수 초과 시 사용자 알림 (§1.3.1, §1.3.2). 한 마켓 실패가 다른 마켓 진행을 막지 않아야 함.
4. **자격증명 보안** — 마켓 토큰/API 키는 암호화 저장, 정기 보안 감사·백업·복구 (§2.4). 평문 저장 금지.
5. **실시간 상태 표시** — 등록 현황 대시보드(§4.1.1)와 마켓 연결 상태(§2.2.2)는 실시간 갱신 요구. WebSocket / SSE / polling 중 무엇을 쓸지는 사용자 확인 후 결정.
6. **반응형 + 크로스 브라우저** — 데스크탑(1200px+) / 태블릿(768~1199px) / 모바일(~767px) 브레이크포인트, Chrome·Safari·Firefox·Edge 지원, 모바일 터치 타겟 ≥44×44px (§5).

## 프로토타입 (`prototype/`)

**MarketCast** 라는 제품명으로 UI 가 시각화된 정적 프로토타입. **빌드 도구 없음** — `index.html` 에서 React 18 UMD + Babel standalone 을 CDN 으로 로드해 `.jsx` 를 브라우저에서 직접 컴파일한다. 실제 GitHub Pages 배포용 SPA 와는 별개의 **시각·인터랙션 레퍼런스**이지 그대로 빌드 산출물이 되지는 않는다.

**파일 구조:**
- `index.html` — 진입점 (CDN React/Babel + 스크립트 순서대로 로드)
- `app.jsx` — 앱 셸: 사이드바 네비 5탭(`dashboard` / `register` / `templates` / `markets` / `history`) + `route` state 라우팅
- `screens/auth.jsx` `dashboard.jsx` `register.jsx` `other.jsx` — 화면 컴포넌트 (`other.jsx` 에 templates / markets / history 합쳐져 있음)
- `components.jsx` — Lucide-style 아이콘 + `MarketIcon`/`MarketStack`/`Checkbox` 등 공용 UI
- `data.js` — `window.AppData` 로 mock 데이터 전역 노출 (사용자·마켓·통계·recent·history·templates)
- `styles.css` — 1226 줄 디자인 시스템 (Pretendard, CSS 변수 토큰, density modes)
- `tweaks-panel.jsx` — 라이브 편집 패널. `/*EDITMODE-BEGIN*/...{...}/*EDITMODE-END*/` 마커는 외부 호스트가 트윅 값을 주입하는 자리이므로 **수정 시 마커 보존**.
- `screenshots/` — 화면 캡처 19장 (디자인 진화 기록)
- `uploads/` — PRD / user_flow 의 다른 사본

**프로토타입이 PRD/user_flow 와 다른 부분 (의식적인 단순화):**
- 상품 등록 단계: **프로토타입 5단계** (정보 → 이미지 → 마켓·카테고리 → 미리보기 → 결과) vs **user_flow 6노드** (n16~n21, 마켓 선택과 카테고리 매핑 분리). 실제 구현 시 어느 쪽을 따를지 결정 필요 — 기본은 PRD/user_flow 가 ground truth, 프로토타입은 UX 제안.
- 마켓 라인업 (data.js): 네이버 스마트스토어(`#03C75A`) / 11번가(`#FF0038`) / G마켓(`#00B147`) / 옥션(`#E73936`) / 쿠팡(`#F11F44`) — 색상 코드·짧은 이름은 이 5개가 표준.
- 사이드바에 "설정" / "도움말" 항목 추가됨 (user_flow 에 없는 보조 동선).

**활용 가이드:**
- 새 화면을 React 앱에 옮길 때는 prototype 의 styles.css 토큰·컴포넌트 시각을 참고하되, `window.AppData` 전역·CDN 의존은 정식 빌드 환경에 가져오지 않는다.
- 프로토타입 자체를 수정할 때는 디자인 토큰(CSS 변수) 안에서만, inline style 남용 금지.
- 정식 앱과 프로토타입은 **자동 동기화 대상 아님**. 정식 앱 변경이 프로토타입에 자동 반영되지 않으며 그 반대도 마찬가지. 둘 중 하나가 자료로서 시효 만료된 시점은 그때 명시.

## MVP 범위 (v1)

PRD 70여 세부 기능 중 **v1 에 들어가는 항목만** 아래에 추림. 나머지는 v2+ 로 보류. 새 기능 제안 시 "MVP 안인지" 먼저 확인 — 안이면 v2 백로그에 명시.

**포함 (v1):**
- s1 인증 — 이메일/소셜 로그인, 회원가입, 비밀번호 재설정 (PRD §2.1.1, §2.1.5)
- s2 대시보드 — 요약 통계 + 최근 등록 내역만 (마켓별 상세 통계는 v2)
- s3 상품 등록 — 5단계 위저드 (정보 → 이미지 → 마켓·카테고리 → 미리보기 → 결과)
- s5 마켓 계정 — 최소 2개 마켓 연결 (**우선 = 네이버 스마트스토어 + 쿠팡**), OAuth 흐름, 토큰 갱신, 연결 해제
- s6 등록 이력 — 목록 + 기본 필터, 재시도/마켓 제외 후 등록 (PRD §4.3)

**제외 (v2 이후):**
- s4 템플릿 관리 전체
- HTML WYSIWYG 상세 설명 에디터 (§3.6)
- 2FA (§2.1.3)
- 알림 설정 (§1.4.3, §2.3.4)
- CSV/Excel 내보내기 (§1.4.2, §4.4.3)
- 등록 이력 고급 필터·통계 (§4.4.2)
- 11번가 / G마켓 / 옥션 어댑터 (인터페이스는 유지, 구현은 v2)

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

`user_flow.md` 의 46 노드는 6 섹션으로 구성된다. 라우팅/네비게이션 구조의 ground truth 다:

- **s1 인증** — 로그인 / 소셜 로그인 / 회원가입 / 비밀번호 찾기 → 대시보드
- **s2 대시보드** — 등록 현황 요약 / 마켓별 통계 / 최근 등록 내역. 다른 모든 섹션의 진입점.
- **s3 상품 등록** — 상품 정보 입력 → 마켓 선택 → 카테고리 매핑 → 등록 미리보기 → 일괄 등록 실행 → 등록 결과. 오류 시 재시도 또는 마켓 제외 후 등록.
- **s4 템플릿 관리** — 목록 / 생성 / 수정 / 이미지 관리 / HTML 설명 편집.
- **s5 마켓 계정** — 연결된 계정 목록 / 신규 연결 → OAuth → 계정 연결. 해제 / 상태 확인.
- **s6 등록 이력** — 이력 목록 / 상세 / 오류 분석 / 기간·마켓 필터.

화면 추가/변경 시 user_flow.md 의 노드·엣지와 정합성이 깨지지 않도록 한다. 새 화면이 생기면 user_flow.md 도 함께 업데이트.

## 작업 시 주의

- **추측 금지** — 기술 스택·MVP 범위·결제 모델·KPI 측정 모두 확정. 새 결정이 필요한 사안이 생기면 사용자에게 명시적으로 확인 후 CLAUDE.md 반영.
- **PRD 진행 상태 표기** — PRD 의 각 기능에는 `⚪ 시작전` 같은 진행 상태 마커가 있다. 기능 구현 완료 시 이 표기도 함께 업데이트하는 것을 사용자가 기대할 수 있으므로 작업 종료 시 확인.
- **빌드/테스트 명령이 생기면 이 파일에 추가** — 현재 비어있는 이유는 코드가 없기 때문이지, 누락이 아니다. `package.json` 등 빌드 매니페스트가 도입되면 이 섹션을 채워라.

## Rules

### 기능 설계 순서

새 기능 설계 시 아래 순서를 따른다:

1. **화면 흐름 설계** — `user_flow.md` 노드·엣지 갱신 + `docs/architecture/v1/` 의 UI 설계문서. 어떤 화면이 추가되는지, 어떤 라우트로 진입하는지.
2. **데이터 모델 + API 스키마 정의** — Postgres 테이블/RLS 정책 SQL + Edge Function 시그니처 (`Request`/`Response` 타입은 zod 스키마로). `docs/architecture/v1/features/<feature>.md` 에 작성.
3. **백엔드 구현** — Postgres 마이그레이션 → Edge Functions 구현. 외부 마켓 API 호출은 `MarketAdapter` 인터페이스로.
4. **프론트엔드 구현** — `src/features/<domain>/` 안에서 화면 + hook + api 클라이언트. zod 스키마는 백엔드와 공유 (가능하면 `src/lib/schemas/` 에 단일 소스).

### 3개 산출물 동기화

코드 수정 시 관련된 3개를 항상 함께 맞춘다:

- **설계문서** — `docs/architecture/v1/` (디렉토리 구조는 "디렉토리 구조" 결정에 따름)
- **HTML 프로토타입** — `docs/frontend_html_design/v1/` (정식 산출물). 기존 `prototype/` 는 v0 (초기 시각 레퍼런스) 로 유지하며 v1 신설은 첫 화면 작업 시점.
- **실제 구현** — `src/features/<domain>/` (디렉토리 구조 결정에 따름)

**변경 크기와 무관하게 예외 없음.** 사소한 스타일 변경(텍스트 색상, 뱃지 스타일, 버튼 정렬 등) 도 반드시 3개를 함께 수정한다. 매 코드 변경 후 설계문서·HTML 프로토타입에 관련 내용이 있는지 검색하고, 있으면 "동기화할까요?" 확인 후 반영한다. *(주: 로컬 hook 이 토큰 절감을 위해 iteration 중 sync 보류 / commit 직전 일괄 sweep 예외를 자동 주입한다 — 매 prompt 마다 hook 출력으로 확인 가능. 그 hook 예외가 우선 작동한다.)*

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

- **shadcn/ui 컴포넌트 통일** — `<Button>`, `<Input>`, `<Dialog>` 등 `src/components/ui/` 의 것을 사용. raw `<button>` / `<input>` 사용 금지 (단, shadcn 으로 못 표현하는 특수 케이스는 PR 에 사유 명시).
- **버튼 유형별 동작 구분** — 검색/필터류(즉시 결과 갱신, 페이지 이동 없음) vs 실행류(서버 변경·등록·삭제) 를 시각적으로 구분 (variant 다르게).
- **실행류 버튼 비활성 사유 표시** — `disabled` 처리만 하지 말고 `blockingReasons` 배열을 hover/focus tooltip 으로 노출 (예: "이미지 1장 이상 필요", "마켓 1개 이상 선택 필요").
- **긴 에러 메시지 접기/펼치기** — 공통 `ErrorMessage` 컴포넌트 (`src/components/ui/error-message.tsx`) 사용. 마켓 API 오류는 stack/raw response 가 길어 접힘 기본.
- **4상태 + partial 처리** — 모든 비동기 UI 는 `loading` / `data` / `error` / `empty` 를 빠짐없이 처리. RegistrationJob 화면은 `partial` 추가.
- **접근성** — WCAG 2.1 AA. 키보드 동선 + aria 라벨 + 색상 대비 4.5:1.

### 신규 파일 생성 시 .gitignore 검토

- 새 파일이나 디렉토리를 만들 때, `.gitignore` 에 추가해야 하는지 검토하고 필요 시 제안한다.
- 임시 파일, 빌드 산출물(`dist/`, `.turbo/`), 환경 변수(`.env*`), Supabase 로컬 캐시(`supabase/.branches/`, `supabase/.temp/`), Sentry sourcemap 업로드 후 잔여물, OS 산출물(`.DS_Store`) 등이 의도치 않게 커밋되는 것을 방지.

## Design Documents

- `docs/architecture/v1/` — 플랫폼 · 프론트엔드 · UI 스타일 설계문서. 글로벌 아키텍처 결정, 디자인 토큰, 공통 컴포넌트 명세.
- `docs/architecture/v1/features/` — 기능별 백엔드/UI 설계. 파일명은 도메인 매핑 (`registration.md`, `markets.md`, `templates.md`, …). 각 문서에 데이터 모델 + API 스키마 + 화면 흐름 + 수락 기준 포함.
- `docs/frontend_html_design/v1/` — 정식 HTML 프로토타입. 화면별 디렉토리 (`dashboard/`, `register/`, …). 첫 화면 작업 시점에 신설. 기존 `prototype/` 은 v0 시각 레퍼런스로 유지.
