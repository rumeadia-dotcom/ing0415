# Platform Architecture (v1)

> 본 문서는 다중 마켓 상품 자동 등록 SaaS 의 **플랫폼 기준점**이다. Phase 0 의 다른 4문서(`frontend.md` / `ui-system.md` / `security.md` / `testing.md`) 및 `features/*.md` 는 본 문서를 인용한다.
> 변경 시 CLAUDE.md "인프라 결정 (확정)" 섹션과 동기화 의무.

---

## 1. 목적·범위

- **목적**: v1 의 기술 스택·런타임·디렉토리·빌드 모드·외부 의존을 단일 문서로 고정한다.
- **범위**: 코드가 닿는 모든 layer (프론트 / Edge Functions / DB / Storage / CI) 의 결정과 제약. UX·디자인 토큰·보안 룰셋은 별도 문서로 분리.
- **비범위**: 결제·정산(v2), 외부 분석 도구 연동(없음), 다국어 UI 운영(현재 한국어 1종).

---

## 2. 기술 스택 결정 매트릭스

CLAUDE.md "인프라 결정 (확정)" 의 항목을 표로 압축한다. "근거" 컬럼은 PRD 요구사항 또는 운영 제약 기준.

### 2.1 프론트엔드

| 축 | 결정 | 근거 (한 줄) |
|---|---|---|
| 언어 | TypeScript (`strict: true` + `noUncheckedIndexedAccess`) | 외부 마켓 API 페이로드 다양성 → 타입으로 좁히지 않으면 런타임 오류 폭증 |
| 빌드 도구 | Vite | 정적 SPA 만 산출, GitHub Pages 호환, HMR 빠름 |
| 프레임워크 | React 18 | shadcn/ui 호환·RTL 생태계·Realtime 구독 패턴 표준 |
| 패키지 매니저 | pnpm | monorepo 친화·중복 의존 제거·CI 캐시 효율 |
| 라우팅 | React Router v6+ | SPA·코드 분할 친화. GitHub Pages 는 `404.html` fallback 패턴 |
| UI 컴포넌트 | shadcn/ui + Tailwind | 컴포넌트 소유권이 레포 내부 → 디자인 토큰 직접 통제 |
| 데이터 페칭 | TanStack Query + Supabase JS | 캐싱·재시도·invalidation 표준화. Supabase JS = raw 쿼리 |
| 폼 | React Hook Form + zod resolver | 동일 zod 스키마 = RHF 검증 + Supabase insert 가드 + 응답 검증 |
| 런타임 검증 | zod | 외부 마켓 API·URL search params·Supabase 응답 모두 동일 도구 |
| 에러 추적 | Sentry (프론트 + Edge Functions) | 토큰·PII 마스킹 `beforeSend` 훅 강제 |
| Lint | ESLint (`typescript-eslint/strict` + `react-hooks` + `tanstack/query` + `jsx-a11y`) | `no-explicit-any` error 레벨 → PR 차단 |
| Format | Prettier | 포맷팅만 담당, lint 와 책임 분리 |
| 테스트 | Vitest + RTL + Playwright | 단위·통합·E2E 3단 분리. 골든 패스 1개 Playwright 강제 |
| 접근성 | WCAG 2.1 AA | `eslint-plugin-jsx-a11y` + `@axe-core/playwright` 자동 검출 |
| i18n 준비 | `t('key')` + `apps/web/src/locales/ko.ts` 사전 | 한국어 1종 운영, 텍스트 하드코딩 금지 |
| 테마 | Light + Dark (`class="dark"` 토글) | shadcn/Tailwind CSS 변수 토큰. raw 색상 금지 |

### 2.2 백엔드 / 데이터

| 축 | 결정 | 근거 (한 줄) |
|---|---|---|
| BaaS | Supabase (Postgres + Auth + Storage + Edge Functions + Realtime) | 1인 셀러 SaaS 규모, 별도 서버 운영 부담 회피 |
| DB | Postgres + Row Level Security | 셀러별 데이터 격리 = RLS 가 단일 게이트, 애플리케이션 검증 의존 금지 |
| Auth | Supabase Auth (JWT) | 이메일·소셜 로그인 표준 흐름 (PRD §2.1) |
| Storage | Supabase Storage (셀러별 prefix + RLS) | 원본 1장 → 마켓별 변환본 N 장 (§1.2.2) |
| 서버 로직 | Edge Functions (Deno + TypeScript) | 시크릿·OAuth 토큰 접근은 Edge Function 만. 클라이언트 직접 호출 금지 |
| Realtime | Supabase Postgres changes subscription | RegistrationJob 상태 push (§4.1.1). WebSocket 자체 구현 회피 |
| 자격증명 암호화 | `pgcrypto` 컬럼 암호화 (1차, v1 확정 — `credential-vault.md` §2 단일 출처) | 평문 저장 금지 (§2.4). RLS + 암호화 이중 게이트. Vault 검토는 v2 백로그 |

### 2.3 인프라 / 운영

| 축 | 결정 | 근거 (한 줄) |
|---|---|---|
| 프론트 호스팅 | GitHub Pages (정적) | 비용 0, SSR 불필요, SPA 충분 |
| CI/CD | GitHub Actions | 레포·시크릿 동일 plane 에서 관리 |
| 브랜치 전략 | Git Flow (`main` / `develop` / `release/*` / `feature/*` / `hotfix/*`) | release 게이트에서 real 모드 수동 QA 1회 확보 |
| 머지 정책 | Squash | 커밋 히스토리 1 PR = 1 commit 정렬 |
| 환경 변수 prefix | `VITE_*` (빌드 타임 주입) | 런타임 시크릿 보관 불가, public 값만 (Supabase anon key) |
| 시크릿 보관 | GitHub Secrets + Supabase Functions 환경변수 | 클라이언트 번들 노출 0 |

### 2.4 거부된 옵션 (대표)

- **Next.js / Remix**: SSR 필요 없음. GitHub Pages 정적 호스팅 결정과 충돌. v1 부담 가중.
- **자체 백엔드 (Express/Fastify on VPS)**: 운영 인력 0 가정과 충돌. Supabase 가 동일 기능 제공.
- **Redux / Zustand 전역 상태**: TanStack Query 캐시 + URL state 로 충분. 전역 store 도입 = YAGNI.
- **MUI / Chakra**: 컴포넌트 소유권 외부화 → 디자인 토큰 변경마다 wrapper 누적. shadcn 의 "코드 복사" 모델 채택.
- **Kafka / 이벤트 소싱 / k8s**: 1인 셀러 SaaS 규모에서 PRD 근거 없음. 절대 금지.

---

## 3. 디렉토리 구조

```
/Users/jhan/ing0415
├── src/                          # 프론트엔드 코드 (Vite 진입점)
│   ├── main.tsx                  # 앱 부트스트랩 + Sentry init + mode 분기
│   ├── App.tsx                   # 라우팅 셸
│   ├── components/
│   │   └── ui/                   # shadcn/ui 컴포넌트 (레포 소유)
│   ├── features/                 # 도메인별 묶음 (s1~s6 매핑)
│   │   ├── auth/                 #   s1 인증
│   │   ├── dashboard/            #   s2 대시보드
│   │   ├── registration/         #   s3 상품 등록 (5단계 위저드)
│   │   ├── templates/            #   s4 템플릿 (v2)
│   │   ├── markets/              #   s5 마켓 계정
│   │   └── history/              #   s6 등록 이력
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client 싱글톤
│   │   ├── query-client.ts       # TanStack Query client
│   │   ├── schemas/              # zod 스키마 단일 소스 (BE/FE 공유)
│   │   ├── logger.ts             # 구조화 로거 (mode 분기)
│   │   ├── sentry.ts             # beforeSend 마스킹 훅
│   │   └── mode.ts               # VITE_APP_MODE 판정
│   ├── locales/
│   │   └── ko.ts                 # 한국어 사전
│   └── styles/
│       └── globals.css           # Tailwind base + CSS 변수 토큰
├── supabase/                     # Supabase CLI 관리 (단일 마이그레이션 소스)
│   ├── migrations/               # SQL 마이그레이션 (timestamp prefix)
│   ├── functions/                # Edge Functions (도메인별 디렉토리)
│   │   ├── _shared/              #   공용 모듈 (logger, adapters/, masking)
│   │   │   └── adapters/         #   MarketAdapter 인터페이스 + 마켓별 구현
│   │   ├── market-oauth-callback/
│   │   ├── market-refresh-token/
│   │   ├── market-category-sync/
│   │   └── registration-run/
│   ├── seed.sql                  # 로컬 시드 (dev 프로젝트 전용)
│   └── config.toml
├── docs/
│   ├── architecture/
│   │   └── v1/
│   │       ├── platform.md       # 본 문서
│   │       ├── frontend.md
│   │       ├── ui-system.md
│   │       ├── security.md
│   │       ├── testing.md
│   │       ├── cross-cutting/    # 횡단 결정 단편
│   │       ├── features/         # 도메인별 설계 (registration.md, markets.md, …)
│   │       ├── ops/              # CI/CD·릴리즈·롤백
│   │       └── qa/               # 수락 기준·골든 패스
│   └── frontend_html_design/
│       └── v1/                   # 정식 HTML 프로토타입 (첫 화면 작업 시 신설)
├── tests/
│   ├── e2e/                      # Playwright (골든 패스 포함)
│   └── fixtures/                 # mock 픽스처 (useMock=true 데이터)
├── prototype/                    # v0 시각 레퍼런스 (수정 동결)
├── .github/
│   └── workflows/                # GitHub Actions
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── eslint.config.js
├── CLAUDE.md
├── PRD.md
├── README.md
└── user_flow.md
```

### 3.1 디렉토리 책임 매트릭스

| 디렉토리 | 책임 | 비범위 |
|---|---|---|
| `apps/web/src/features/<domain>/` | 도메인별 화면·hook·api 클라이언트·도메인 타입 | 다른 도메인 import (`features/markets` → `features/registration` 금지). 공유는 `apps/web/src/lib/` 경유 |
| `apps/web/src/components/ui/` | shadcn/ui 컴포넌트 (Button, Input, Dialog 등) | 비즈니스 로직·도메인 의존 금지 |
| `apps/web/src/lib/` | 공용 hook·유틸·zod 스키마·Supabase client | 화면 컴포넌트 보유 금지 |
| `apps/web/src/locales/` | i18n 사전 | 도메인 로직 금지 |
| `apps/api/supabase/migrations/` | SQL 마이그레이션 (RLS 정책 포함) | 시드 데이터 금지 (`seed.sql` 별도) |
| `apps/api/supabase/functions/` | Edge Function 진입점 | 클라이언트에서 직접 import 금지 (HTTP 경계) |
| `apps/api/supabase/functions/_shared/adapters/` | `MarketAdapter` 인터페이스 + 마켓별 구현 + mock 어댑터 | RegistrationJob 오케스트레이션 금지 (어댑터는 호출 1회만 책임) |
| `docs/architecture/v1/` | 설계문서 (3개 산출물 sync 대상) | 코드 금지 |
| `docs/frontend_html_design/v1/` | 정식 HTML 프로토타입 (3개 산출물 sync 대상) | React/TS 코드 금지 |
| `tests/e2e/` | Playwright E2E (골든 패스 1개 최소) | 단위 테스트는 각 `apps/web/src/features/<domain>/__tests__/` 에 동거 |
| `tests/fixtures/` | mock 픽스처 (`window.AppData` 대체) | real 번들에 절대 포함 금지 (tree-shaking 보장) |
| `prototype/` | v0 시각 레퍼런스 | 정식 빌드 산출물 아님. 수정 동결 |

---

## 4. 빌드 모드: dev / real + useMock 플래그

플래그 2개로 분리 (2026-05-22):

- **`VITE_APP_MODE`** (`dev` | `real`) — DB / Edge Function 타겟 + Sentry 환경 라벨
- **`VITE_USE_MOCK`** (`true` | `false`) — 마켓 어댑터 소스 (mock vs real)

두 플래그 모두 **빌드 시점에 고정**. 런타임 토글 없음.

### 4.1 유효 조합 매트릭스

| MODE | USE_MOCK | 명령 | Supabase | 마켓 API | 용도 |
|---|---|---|---|---|---|
| `dev` | `true` | `pnpm dev` | dev (eqo...) | mock 어댑터 | 빠른 로컬 UI 작업 |
| `dev` | `false` | `pnpm dev:db` / `build:dev` | dev (eqo...) | 실 마켓 API (sandbox) | 통합 검증 + CI sanity |
| `real` | `false` | `pnpm dev:real` / `build:real` | real (lfr...) | 실 마켓 API (운영) | 운영 배포 |
| `real` | `true` | — | — | — | **부트스트랩 시 throw** |

### 4.2 모드 스위치 메커니즘

`apps/web/src/lib/env.ts` 가 단일 ground truth. zod 로 검증 후 export.

```ts
// apps/web/src/lib/env.ts (요약)
const EnvSchema = z
  .object({
    VITE_APP_MODE: z.enum(['dev', 'real']).default('dev'),
    VITE_USE_MOCK: booleanString.optional(),
    // ... Supabase URL/key, Sentry DSN
  })
  .transform((v) => ({
    ...v,
    VITE_USE_MOCK: v.VITE_USE_MOCK ?? (v.VITE_APP_MODE === 'dev'),
  }))
  .refine((v) => !(v.VITE_APP_MODE === 'real' && v.VITE_USE_MOCK === true), {
    message: 'real 모드에서는 VITE_USE_MOCK=true 를 사용할 수 없습니다',
  })

export const isDev = env.VITE_APP_MODE === 'dev'
export const isReal = env.VITE_APP_MODE === 'real'
export const useMock = env.VITE_USE_MOCK
```

### 4.3 빌드 시점 분기 가드 (tree-shaking)

mock 전용 코드는 real 번들에 절대 들어가지 않아야 한다. 다음 패턴을 강제한다.

```ts
// apps/web/src/lib/markets/index.ts
import { useMock } from '@/lib/env'

export async function getMarketAdapter(market: MarketId): Promise<MarketAdapter> {
  if (useMock) {
    const { naverDebugAdapter } = await import('./debug/NaverDebugAdapter')
    return naverDebugAdapter
  }
  const { naverRealAdapter } = await import('./real/naver')
  return naverRealAdapter
}
```

#### 검증 룰

- `if (useMock)` 가드 + dynamic import 만 사용. top-level 정적 import 는 PR 차단.
- `tests/fixtures/` 는 `src/` 가 정적 import 금지. ESLint `no-restricted-imports` 룰.
- 빌드 후 `dist/assets/*.js` 에 다음 패턴이 검색되면 real 빌드 fail (CI grep 게이트):
  - `window.AppData`, `__MOCK_FIXTURES__`, `MockMarketAdapter`, `MOCK_SELLER`
  - `VITE_APP_MODE` 리터럴 값 `dev`
  - `VITE_USE_MOCK` 리터럴 값 `true`
  - `service_role`, `sbp_v0_`, `sntrys_` 토큰형 패턴

### 4.4 모드 전환 시 사용자 데이터 호환성

- 모드는 빌드 시점 고정. 사용자 세션·DB·Storage 가 프로젝트 단위로 다르므로 **dev 토큰 → real 앱 인증 불가, 역도 불가**.
- 마이그레이션은 두 프로젝트에 **동일 SQL** 을 적용 (`pnpm db:push:dev` / `pnpm db:push:real`). schema drift 가 생기면 CI fail.

---

## 5. Supabase 프로젝트 분리

### 5.1 프로젝트 매트릭스

| 항목 | dev 프로젝트 | real 프로젝트 |
|---|---|---|
| Project Ref | `eqoywqoalwkwbrdsulfl` (MarketCast-Dev) | `lfrnythcujxdhehvkmtg` (MarketCast-Real) |
| 사용처 | 개발·QA·`develop` 빌드 | 운영·`main` 빌드 |
| Supabase URL | `https://eqoywqoalwkwbrdsulfl.supabase.co` | `https://lfrnythcujxdhehvkmtg.supabase.co` |
| anon key | dev 전용 (public) | real 전용 (public) |
| service role key | dev 전용 (GitHub Secrets `SUPABASE_DEV_SERVICE_ROLE`) | real 전용 (GitHub Secrets `SUPABASE_REAL_SERVICE_ROLE`) |
| Functions 환경변수 | Supabase 대시보드 dev | Supabase 대시보드 real |
| 마켓 OAuth client_id/secret | 마켓 sandbox 자격증명 | 마켓 운영 자격증명 |
| Sentry DSN | dev DSN | real DSN |
| Seed 데이터 | `supabase/seed.sql` 자동 주입 | 주입 금지 |

### 5.2 환경변수 매트릭스

| 변수 | dev 값 출처 | real 값 출처 | 노출 범위 |
|---|---|---|---|
| `VITE_APP_MODE` | GitHub Actions secret/var | GitHub Actions secret/var | public (빌드 산출물에 포함) |
| `VITE_SUPABASE_URL` | GitHub Secrets | GitHub Secrets | public (anon key 와 함께 노출됨) |
| `VITE_SUPABASE_ANON_KEY` | GitHub Secrets | GitHub Secrets | public |
| `VITE_SENTRY_DSN` | GitHub Secrets | GitHub Secrets | public |
| `SUPABASE_SERVICE_ROLE_KEY` | (Functions 환경변수만) | (Functions 환경변수만) | **server-only** (절대 `VITE_*` 금지) |
| `MARKET_NAVER_CLIENT_SECRET` | Functions 환경변수 | Functions 환경변수 | server-only |
| `MARKET_COUPANG_ACCESS_KEY` | Functions 환경변수 | Functions 환경변수 | server-only |

### 5.3 마이그레이션 단일 소스 유지

- `apps/api/supabase/migrations/` 가 **유일한** 스키마 ground truth. 대시보드에서 SQL 직접 실행 금지.
- 두 프로젝트에 동일 SQL 적용을 CI 로 강제:

```yaml
# .github/workflows/db-migrate.yml (발췌)
jobs:
  migrate-dev:
    if: github.ref == 'refs/heads/develop'
    steps:
      - run: supabase link --project-ref ${{ secrets.SUPABASE_DEV_REF }}
      - run: supabase db push
  migrate-real:
    if: github.ref == 'refs/heads/main'
    needs: migrate-dev   # dev 통과 후만 real 적용
    steps:
      - run: supabase link --project-ref ${{ secrets.SUPABASE_REAL_REF }}
      - run: supabase db push
```

- 스키마 drift 검증: `supabase db diff --linked` 결과가 비어있어야 통과. drift 발견 시 CI fail.
- 롤백 정책: 다운 마이그레이션 작성 의무화 (`<timestamp>_down.sql`). real 적용 후 5분 내 health check 실패 시 즉시 down 적용.

---

## 6. Edge Function 제약

### 6.1 한도 (Supabase 공식 문서 사실 확인)

> 출처: `https://supabase.com/docs/guides/functions/limits` (확인 일자: 2026-05-18)

| 항목 | Free | Paid |
|---|---|---|
| Maximum Duration (wall clock) | **150s** | **400s** |
| Maximum Memory | 256MB | 256MB |
| CPU Time (per request, sync 만) | 2s | 2s |
| Request Idle Timeout | 150s (504 반환) | 150s (504 반환) |
| Concurrency 상한 | 명시 없음 (재귀 호출 5000 req/min 임계 외) | 명시 없음 |
| Request Body 크기 상한 | 공식 문서 확인 안 됨 | 공식 문서 확인 안 됨 |

**결정**: v1 운영은 **Paid 플랜 가정 (400s)**. Free 한도(150s) 는 dev 프로젝트에서 사용해도 무방하나, 운영 시간 모델은 400s 기준.

### 6.2 장기 잡 처리 패턴 (RegistrationJob)

5개 마켓 동시 등록을 단일 함수 호출 1회로 처리 시 마켓당 평균 응답 시간 + 이미지 변환 누적 → 400s 한도 초과 위험. 마켓당 1회 호출로 쪼갠다.

#### 패턴

1. **Job 생성**: 클라이언트 → `POST /registration-create` → Postgres `registration_jobs` row insert (`status = 'pending'`), `registration_job_market_results` 마켓별 row insert (`status = 'pending'`).
2. **마켓별 Worker invoke**: `registration-create` 가 응답 반환 직전 마켓 수만큼 `supabase.functions.invoke('registration-run-market', { jobId, market })` 를 fire-and-forget 으로 호출. 각 호출은 독립 Edge Function 인스턴스로 분리 → 마켓당 400s 독립 한도.
3. **각 worker 가 자기 마켓만 처리**:
   - `transformProduct` 로 페이로드 변환
   - 이미지 변환본 Storage 업로드
   - `createProduct` 호출
   - 성공/실패 결과를 `registration_job_market_results` 로 update
4. **상위 status 집계**: Postgres trigger 또는 마지막 worker 가 모든 `market_results.status` 를 집계해 `registration_jobs.status` 전이 (`succeeded` / `partial` / `failed`).
5. **Realtime push**: 클라이언트는 `supabase.channel('registration_jobs:id=eq.<jobId>')` + `registration_job_market_results:job_id=eq.<jobId>` 두 구독으로 진행 상황 표시.

#### 한도 초과 안전망

- 마켓 1개 처리가 400s 를 초과하는 경우 (네트워크 정체 + 대용량 이미지) → worker 가 자체 `setTimeout(380s)` 으로 self-abort + `status = 'retrying'` 으로 표기 + Postgres `pg_cron` (또는 별도 trigger) 으로 재invoke. **결정 미해결 — Phase 1 에서 `pg_cron` vs `Supabase scheduled functions` 선택.**
- 재시도 횟수 상한: 3회. 초과 시 `status = 'failed'` + 사용자에게 알림 (v1 알림은 Sentry 이벤트로만, in-app 알림은 v2).

### 6.3 기타 제약

- **CPU 2s 제약**: 동기 CPU 시간이므로 이미지 리사이즈는 worker 내부에서 외부 서비스(Supabase Storage 의 transformations) 위임 또는 async I/O 로 분산. JS 동기 루프로 이미지 처리 금지.
- **메모리 256MB**: 이미지 원본을 메모리에 로드하지 않고 stream → Storage 로 직접 pipe.
- **클라이언트 직접 마켓 API 호출 금지**: CORS·시크릿 노출 회피. 모든 마켓 호출은 Edge Function 경유.

---

## 7. 횡단 4결정 일관 인용 블록

> **다른 설계문서에서 본 절을 그대로 인용한다.** 수정 시 본 문서 = ground truth. 인용 측 문서를 동시 갱신.

### 7.1 MarketAdapter 인터페이스 (5메서드)

```ts
// apps/api/supabase/functions/_shared/adapters/types.ts
export interface MarketAdapter {
  authenticate(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
  }>;

  refreshToken(refresh: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
  }>;

  fetchCategoryTree(): Promise<CategoryNode[]>;

  transformProduct(
    product: Product,
    mapping: MarketMapping,
  ): Promise<MarketPayload>;

  createProduct(payload: MarketPayload): Promise<{
    externalId: string;
    productUrl: string;
  }>;
}
```

**제약**:
- 어댑터는 위 5메서드 외 public 메서드 노출 금지.
- 재시도·rate limit·이미지 변환·로깅·correlationId 부여는 어댑터 **바깥** (RegistrationJob 오케스트레이터 / 공용 wrapper) 에서 처리.
- mock 어댑터(`adapters/mock/<market>.ts`) 와 운영 어댑터(`adapters/<market>.ts`) 는 동일 인터페이스 구현. 모드 스위치만으로 교체.
- 어댑터 버전은 `adapters/<market>/v<N>.ts` 형태로 관리. 마켓 API 정책 변경 시 신버전 어댑터 추가 → 점진 전환 (구버전과 신버전 병존 기간 명시).

### 7.2 dev · real 모드 동일 보안 경로

- 토큰·시크릿·OAuth refresh 흐름은 **dev 모드 / useMock=true 어느 조합에서도 실제와 동일 코드 경로**로 실행. mock 어댑터라도 OAuth 콜백 처리·토큰 암호화 저장·refresh 만료 처리는 운영과 동일.
- 즉 mock 모드 = "외부 마켓 응답만 mock", 보안 레이어(암호화·RLS·로그 마스킹) 는 우회 금지.
- 인증 bypass (mock user) 는 옵션이며, 기본값은 off. PR 단위로 명시적 활성화 필요.

### 7.3 RLS 의무화

- `public` 스키마의 모든 테이블은 **RLS enable + 정책 1개 이상**. RLS 없는 테이블은 마이그레이션 단계에서 거부.
- 의무 검증 SQL (CI 단계):

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN (
    SELECT tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  );
-- 결과 비어있어야 통과
```

- 셀러 자격증명 테이블(`market_accounts`, `market_account_tokens`) 은 RLS + Edge Function service role only + pgcrypto 컬럼 암호화 **3중 게이트**. 클라이언트 anon JWT 는 SELECT 자체 불가.

### 7.4 토큰 마스킹 (Sentry beforeSend + 화이트리스트)

- Sentry SDK 초기화 시 `beforeSend` 훅 의무 등록. 다음 키 이름 (대소문자 무관) 은 모든 event payload 에서 `[REDACTED]` 치환:
  - `accessToken`, `refreshToken`, `apiKey`, `clientSecret`, `password`, `email`, `phone`
- 화이트리스트 패턴: payload 의 키 이름을 정규식 매치 → 매치되면 값 redact. 깊이 제한 없음 (재귀).
- 로그 레벨에서도 동일 마스킹 적용 — `apps/web/src/lib/logger.ts` 가 출력 전 동일 화이트리스트 통과.
- 운영 어댑터의 외부 호출 로그는 `tokenLength`, `tokenSuffix4` 만 노출. 본문 금지.

```ts
// apps/web/src/lib/sentry.ts (발췌)
import * as Sentry from '@sentry/react';
import { isReal, APP_MODE } from './mode';

const SENSITIVE_KEYS = /(accessToken|refreshToken|apiKey|clientSecret|password|email|phone)/i;

function maskDeep<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(maskDeep) as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE_KEYS.test(k) ? '[REDACTED]' : maskDeep(v);
  }
  return out as T;
}

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: APP_MODE,
  enabled: isReal,            // dev 모드는 Sentry off (또는 별도 DSN)
  beforeSend(event) {
    return maskDeep(event);
  },
});
```

---

## 8. 확장 정책

### 8.1 신규 마켓 어댑터 추가 절차

신규 마켓 추가는 **1 파일 + 단위 테스트** 로 끝나야 한다. 외부에 손이 닿으면 추상화 실패로 간주.

```
1. apps/api/supabase/functions/_shared/adapters/<market>.ts        # 5메서드 구현
2. apps/api/supabase/functions/_shared/adapters/<market>.test.ts   # 단위 테스트 (Deno test)
3. tests/fixtures/markets/<market>.ts                     # useMock=true 용 mock 응답
4. apps/api/supabase/functions/_shared/adapters/index.ts           # 1줄 export 추가
5. apps/api/supabase/migrations/<ts>_seed_market_<market>.sql      # markets 테이블에 row insert
```

검증 체크리스트:

- [ ] 5메서드 외 public 노출 없음
- [ ] 재시도·rate limit 로직이 어댑터 내부에 들어가지 않음
- [ ] mock 응답이 운영 응답 스키마와 zod 로 호환 검증됨
- [ ] OAuth 흐름의 client_secret 은 Functions 환경변수에서만 읽음
- [ ] 외부 호출 로그가 `_shared/logger.ts` 의 마스킹 통과
- [ ] 어댑터 버전(`v1`/`v2`) 명시. 마켓 정책 변경 모니터링 대상 등록

**거부 조건**: 위 체크리스트 1개라도 실패하면 PR 머지 차단.

### 8.2 신규 도메인(feature) 추가 절차

```
1. user_flow.md 노드/엣지 갱신
2. docs/architecture/v1/features/<domain>.md 작성
   - 데이터 모델 (Postgres 테이블 + RLS 정책)
   - API 스키마 (Edge Function 시그니처 + zod)
   - 화면 흐름 (user_flow 노드 인용)
   - 수락 기준 (qa 에이전트 룰)
3. docs/frontend_html_design/v1/<domain>/ 정적 HTML
4. apps/api/supabase/migrations/ SQL 추가 (RLS 정책 포함)
5. apps/api/supabase/functions/<endpoint>/ 구현
6. apps/web/src/features/<domain>/ 구현 (components/hooks/api/types/pages)
7. tests 추가 (단위 + 골든 패스 영향 검토)
```

**3개 산출물 동기화 의무**: 설계문서 / HTML 프로토타입 / src 가 항상 함께 갱신. CLAUDE.md "Rules / 3개 산출물 동기화" 참조.

### 8.3 v1 → v2 확장 시 영향 범위

다음 v2 항목은 **인터페이스를 v1 시점에 유지**하되 구현은 보류:

- ~~11번가 / G마켓 / 옥션 어댑터: v2~~ → **2026-05-22 5마켓 정식 결정으로 v1 정식 진입**. G마켓 / 옥션은 Phase 4-A (PR #96) 에서 ESM JWT 어댑터 본격 구현 + gateway 경유. 11번가는 Phase 4-B-2 에서 real 어댑터 (11번가 Open API XML / EUC-KR, 게이트웨이 경유) 본격 구현 완료 — 카테고리 / 상품등록 / 주문조회 / 발송 5메서드 + 주문 확장 2메서드 전부 동작.
- 템플릿(s4): 데이터 모델 `templates` 테이블은 v1 마이그레이션에 **포함 금지** (YAGNI). v2 진입 시 마이그레이션 추가.
- 알림(s10): 도메인 stub 정의서 `docs/design-renewal/s10-notifications.md` (PR #112) 만 신설. 실 테이블 / Edge Function / UI 는 PR3 트랙 후속.
- CSV 내보내기: v1 시점에 어떤 hook·디렉토리도 만들지 않음.
- 결제·정산: PCI-DSS 적용 범위 0. v1 코드베이스에 결제 의존 0.

---

## 9. 미해결 사안 (Phase 1~5 결정 큐)

본 문서가 의도적으로 미결정 상태로 남긴 항목. 결정 시 본 문서 갱신 + 영향 문서 갱신.

| # | 항목 | 결정 시점 | 후보 옵션 | 영향 문서 |
|---|---|---|---|---|
| 1 | 자격증명 암호화 방식 | **Phase 1 결정 완료 — pgcrypto** (`credential-vault.md` §2 단일 출처). Vault 검토는 v2 백로그 | (해결됨) | `security.md` §4.2, `cross-cutting/credential-vault.md` |
| 2 | 실시간 상태 전송 방식 | Phase 1 (frontend + backend) | Supabase Realtime (Postgres changes) vs polling (TanStack Query refetch) | `frontend.md`, `features/registration.md` |
| 3 | 장기 잡 재시도 스케줄러 | Phase 2 (backend) | `pg_cron` vs Supabase scheduled functions vs 클라이언트 재요청 | `features/registration.md` |
| 4 | i18n 라이브러리 | Phase 3 (frontend) | i18next vs 경량 자체 dictionary (`apps/web/src/locales/ko.ts` 단순 lookup) | `frontend.md` |
| 5 | 이미지 변환 실행 위치 | Phase 2 (backend) | Edge Function 내부 (CPU 2s 제약) vs Supabase Storage transformations vs 외부 서비스 | `features/registration.md`, `security.md` |
| 6 | 다크 토큰 정의 시점 | Phase 0 (designer) | 첫 화면 구현과 동시 vs 별도 spike | `ui-system.md` |
| 7 | MAU 세션 수집 방식 | Phase 4 (backend) | Supabase Auth event 트리거 vs 클라이언트 ping | `features/dashboard.md` |
| 8 | 등록 잡 부분 실패 → 사용자 알림 | Phase 4 | Sentry 이벤트만 (v1) vs in-app toast (v2 일부 선반영) | `features/registration.md` |
| 9 | Supabase CLI 버전 고정 정책 | Phase 0 (ops) | `package.json` devDep vs CI 단계 install vs Docker image pin | `ops/release.md` |
| 10 | RLS 정책 단위 테스트 | Phase 1 (qa) | `pgTAP` vs Supabase JS 통합 테스트 vs 수동 검수 | `testing.md`, `security.md` |
| 11 | 마켓 API 정책 변경 모니터링 | Phase 2 (backend) | 마켓별 changelog RSS subscribe vs 주간 수동 점검 vs API contract 테스트 | `features/markets.md` |
| 12 | Edge Function 요청 body 크기 상한 | Phase 1 (backend) | 공식 문서 미명시 → 실측 후 결정 | `features/registration.md` |

---

## 10. 변경 이력

| 일자 | 변경 | 작성 |
|---|---|---|
| 2026-05-18 | v1 초안 — 플랫폼 결정 매트릭스·디렉토리·빌드 모드·Edge Function 한도(150s/400s 사실 확인)·횡단 4결정·확장 정책·미해결 12건 | ing-architect |
