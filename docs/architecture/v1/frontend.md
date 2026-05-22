# Frontend 구현 규약 (v1)

## 1. 목적·범위

- `platform.md` (인프라 결정) 와 `ui-system.md` (디자인 토큰·컴포넌트 명세) 사이를 잇는 **프론트엔드 구현 규약** 문서.
- 적용 대상: `src/` 이하 모든 코드 (React 컴포넌트, hook, api 클라이언트, zod 스키마, 라우팅, 폼, 상태관리).
- 본 문서에서 정의된 규칙은 PR 차단 사유. 예외는 PR description 에 사유 명시 후에만 허용.

---

## 2. 라우팅 구조

### 2.1 라이브러리

- **React Router v6+** (`react-router-dom`). 데이터 라우터 API (`createBrowserRouter`) 사용. `RouterProvider` 로 주입.
- **레이지 로딩 강제** — 각 라우트는 `lazy()` 또는 dynamic import 기반 `Component` 필드로 정의. 루트 번들에는 인증·레이아웃 셸만 포함.
- 라우트 정의 위치: `apps/web/src/app/router.tsx` (단일 소스). 각 도메인의 `pages/` 는 default export 하나만 노출하고, `router.tsx` 가 import.

### 2.2 GitHub Pages 404.html fallback

GitHub Pages 는 SPA 라우팅을 모름. 사용자가 `/dashboard` 새로고침하면 404. 해결:

- 빌드 후 `dist/index.html` 을 `dist/404.html` 로 복제 (Vite plugin 또는 `pnpm postbuild` 스크립트).
- 404.html 은 index.html 과 동일한 React 앱을 부트스트랩 → 클라이언트 라우터가 `location.pathname` 보고 알맞은 라우트 렌더.
- `BrowserRouter` 의 `basename` 은 `import.meta.env.BASE_URL` 사용 (Vite `base` 설정과 일치).
- 빌드 산출물 검증: CI 에서 `dist/404.html` 존재 확인 step 필수.

```ts
// vite.config.ts 발췌
import { defineConfig } from 'vite';
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/',
  plugins: [
    {
      name: 'spa-404-fallback',
      closeBundle() {
        const indexHtml = readFileSync(resolve('dist/index.html'), 'utf8');
        writeFileSync(resolve('dist/404.html'), indexHtml);
      },
    },
  ],
});
```

### 2.3 user_flow.md → URL 매핑

| user_flow 노드 | URL | 컴포넌트 위치 | 인증 필요 |
|---|---|---|---|
| n1 시작 | `/` | `apps/web/src/app/Landing.tsx` (인증 시 `/dashboard` 리다이렉트) | No |
| n2 로그인/회원가입 | `/login` | `features/auth/pages/LoginPage.tsx` | No |
| n3 이메일 로그인 | `/login?method=email` | 동일 (탭 state) | No |
| n4 소셜 로그인 | `/login?method=social` | 동일 (탭 state) | No |
| n5 회원가입 | `/signup` | `features/auth/pages/SignupPage.tsx` | No |
| n6 비밀번호 찾기 | `/forgot-password` | `features/auth/pages/ForgotPasswordPage.tsx` | No |
| n7 로그인 실행 | (mutation) → `/dashboard` | — | — |
| n8 회원가입 완료 | (mutation) → `/dashboard` | — | — |
| n9 대시보드 | `/dashboard` | `features/dashboard/pages/DashboardPage.tsx` | Yes |
| n10 등록 현황 요약 | `/dashboard` (섹션) | 동일 | Yes |
| n11 마켓별 통계 | `/dashboard` (섹션) | 동일 | Yes |
| n12 최근 등록 내역 | `/dashboard` (섹션) | 동일 | Yes |
| n13 상세 보기 | `/history/:jobId` | (s6 로 라우팅) | Yes |
| n14 새로고침 | (Query invalidate) | — | — |
| n15 상품 등록 진입 | `/register` | → `/register/info` 리다이렉트 | Yes |
| n16 상품 정보 입력 | `/register/info` | `features/registration/pages/StepInfoPage.tsx` | Yes |
| n18 이미지 업로드 | `/register/images` | `features/registration/pages/StepImagesPage.tsx` | Yes |
| n17 마켓 선택 | `/register/markets` | `features/registration/pages/StepMarketsPage.tsx` | Yes |
| n19 카테고리 매핑 | `/register/categories` | `features/registration/pages/StepCategoriesPage.tsx` | Yes |
| n20 등록 미리보기 | `/register/preview` | `features/registration/pages/StepPreviewPage.tsx` | Yes |
| n23 일괄 등록 실행 | (mutation) → `/register/result/:jobId` | — | Yes |
| n21 등록 결과 | `/register/result/:jobId` | `features/registration/pages/StepResultPage.tsx` | Yes |
| n22 템플릿 불러오기 | `/register/info?templateId=...` (search param) | StepInfoPage 내부 | Yes |
| n24 오류 재시도 | (mutation, 같은 화면) | — | — |
| n25 마켓 제외 등록 | (mutation, 같은 화면) | — | — |
| n26 템플릿 관리 (v2) | `/templates` | `features/templates/pages/TemplatesListPage.tsx` | Yes |
| n28 템플릿 생성 (v2) | `/templates/new` | `features/templates/pages/TemplateEditPage.tsx` | Yes |
| n29 템플릿 수정 (v2) | `/templates/:templateId` | 동일 | Yes |
| n34 마켓 계정 관리 | `/markets` | `features/markets/pages/MarketsListPage.tsx` | Yes |
| n35 연결된 계정 목록 | `/markets` (섹션) | 동일 | Yes |
| n36 마켓 계정 연결 | `/markets/connect/:provider` | `features/markets/pages/MarketConnectPage.tsx` | Yes |
| n37 OAuth 인증 | `/markets/oauth/callback/:provider` | `features/markets/pages/OAuthCallbackPage.tsx` | Yes |
| n41 등록 이력 | `/history` | `features/history/pages/HistoryListPage.tsx` | Yes |
| n42 이력 목록 | `/history?from=...&to=...&market=...` (search params) | 동일 | Yes |
| n43 이력 상세 | `/history/:jobId` | `features/history/pages/HistoryDetailPage.tsx` | Yes |
| n44 오류 분석 | `/history/:jobId?tab=errors` (search param) | 동일 | Yes |

**라우트 가드:**

- `Yes` 표시 라우트는 `<RequireAuth>` HOC 로 감싼다. 세션 없으면 `/login?redirect=<원본 경로>` 로 리다이렉트.
- 마켓 1개도 연결 안 된 상태에서 `/register` 진입 시: 등록은 가능하지만 마켓 선택 단계에서 빈 상태 + `/markets/connect` 로 가는 CTA. 강제 리다이렉트 금지 (사용자 선택 존중).
- `/register/:step` 의 step 값 검증은 zod enum 으로 (`'info' | 'images' | 'markets' | 'categories' | 'preview'`). 임의 문자열 입력 시 `/register/info` 로 보냄.

### 2.4 URL search params zod 검증

URL search params 는 외부 입력 → zod 로 1회 parse 후 사용. 직접 `searchParams.get('foo')` 후 분기 금지.

```ts
// features/history/hooks/useHistoryFilters.ts
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';

const historyFiltersSchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  market: z.enum(['naver', 'coupang', '11st', 'gmarket', 'auction']).optional(),
  status: z.enum(['succeeded', 'failed', 'partial', 'running']).optional(),
});

export type HistoryFilters = z.infer<typeof historyFiltersSchema>;

export function useHistoryFilters(): HistoryFilters {
  const [searchParams] = useSearchParams();
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = historyFiltersSchema.safeParse(raw);
  if (!parsed.success) {
    return {};
  }
  return parsed.data;
}
```

---

## 3. `apps/web/src/features/<domain>/` 구조

### 3.1 도메인 매핑

| 도메인 | user_flow 섹션 | MVP |
|---|---|---|
| `auth` | s1 | v1 |
| `dashboard` | s2 | v1 |
| `registration` | s3 | v1 |
| `templates` | s4 | v2 |
| `markets` | s5 | v1 |
| `history` | s6 | v1 |

도메인 외 공용:
- `apps/web/src/components/ui/` — shadcn/ui 컴포넌트 (직접 소유, 라이브러리 의존 X)
- `apps/web/src/components/layout/` — `AppShell`, `Sidebar`, `Topbar` 등 셸 컴포넌트
- `apps/web/src/lib/schemas/` — zod 스키마 단일 소스 (도메인 간 공유)
- `apps/web/src/lib/supabase.ts` — Supabase 클라이언트 단일 인스턴스
- `apps/web/src/lib/query.ts` — TanStack Query 클라이언트 + 키 팩토리
- `apps/web/src/lib/logger.ts` — 구조화 로거 (Sentry 연동)
- `apps/web/src/lib/env.ts` — `VITE_APP_MODE` (`dev` / `real`) + `VITE_USE_MOCK` (`true` / `false`) 분기
- `apps/web/src/locales/ko.ts` — i18n 사전

### 3.2 도메인 내부 폴더 책임

| 폴더 | 책임 | 외부에서 import 가능? |
|---|---|---|
| `components/` | 도메인 전용 UI 컴포넌트. shadcn ui 조합 | 같은 도메인에서만 |
| `hooks/` | TanStack Query / mutation / Realtime / 폼 hook | 같은 도메인 + (선택적) 다른 도메인 |
| `api/` | Supabase / Edge Function 호출 함수. zod 응답 검증 포함 | hook 내부에서만 (페이지 직접 호출 금지) |
| `types/` | 도메인 타입 (zod `infer` 결과). `lib/schemas` 에 없는 도메인-로컬 타입만 | 어디서나 |
| `pages/` | 라우트 단위 페이지. lazy import 진입점 | `app/router.tsx` 만 |

**규칙:**
- 한 도메인 안의 컴포넌트는 다른 도메인 컴포넌트를 직접 import 하지 않는다. 필요하면 `apps/web/src/components/` 로 승격하거나, 도메인 hook 으로 데이터를 노출.
- 페이지(`pages/`) 는 비즈니스 로직을 가지지 않고, 도메인 컴포넌트·hook 의 조합만 수행.
- `api/` 함수는 zod parse 결과만 반환. raw Supabase response 를 외부로 누출 금지.

### 3.3 ASCII 트리 예시 — `features/markets/`

```
apps/web/src/features/markets/
├── api/
│   ├── fetchMarketAccounts.ts      # SELECT market_accounts WHERE seller_id = me
│   ├── fetchMarketCategories.ts    # Edge Function: GET /functions/v1/markets/categories
│   ├── disconnectMarket.ts         # UPDATE market_accounts SET status='disconnected'
│   └── startOAuth.ts               # Edge Function: POST /functions/v1/markets/oauth/start
├── components/
│   ├── MarketAccountCard.tsx       # 연결된 1개 계정 카드 (n35)
│   ├── MarketAccountList.tsx       # 카드 그리드 (n35)
│   ├── MarketConnectButton.tsx     # 신규 연결 CTA (n36)
│   ├── MarketStatusBadge.tsx       # 연결/만료/오류 상태 뱃지
│   ├── DisconnectDialog.tsx        # 연결 해제 확인 다이얼로그 (n39)
│   └── EmptyMarketState.tsx        # 빈 상태 (마켓 0개)
├── hooks/
│   ├── useMarketAccounts.ts        # useQuery(['markets', { sellerId }])
│   ├── useDisconnectMarket.ts      # useMutation + onSuccess invalidate
│   ├── useStartOAuth.ts            # useMutation (window.location.href = ...)
│   └── useMarketRealtimeSync.ts    # supabase.channel → invalidate ['markets']
├── pages/
│   ├── MarketsListPage.tsx         # /markets
│   ├── MarketConnectPage.tsx       # /markets/connect/:provider
│   └── OAuthCallbackPage.tsx       # /markets/oauth/callback/:provider
└── types/
    └── index.ts                    # MarketAccount, MarketStatus 타입 re-export
```

다른 도메인도 동일 구조. `features/auth/api/` 만 예외적으로 Supabase Auth 직접 호출 허용.

---

## 4. TanStack Query Key 규약

### 4.1 형식

- Query Key 는 **항상 배열**. 첫 요소는 도메인 문자열, 뒤이어 필터/식별자 객체.
- 형식: `[domain, ...filters]`
- 필터 객체 키는 **알파벳 정렬**. 직렬화 일관성을 위해 (TanStack Query 는 deep equal 비교하지만, 디버깅·devtools 가독성).

### 4.2 도메인별 키 팩토리

`apps/web/src/lib/query.ts` 에 도메인별 키 팩토리를 export. 임의 inline 배열 작성 금지.

```ts
// apps/web/src/lib/query.ts
export const queryKeys = {
  auth: {
    session: () => ['auth', 'session'] as const,
  },
  markets: {
    all: (sellerId: string) =>
      ['markets', { sellerId }] as const,
    detail: (sellerId: string, marketAccountId: string) =>
      ['markets', { marketAccountId, sellerId }] as const,
    categories: (market: string, parentId: string | null) =>
      ['categories', { market, parentId }] as const,
  },
  registration: {
    job: (jobId: string) =>
      ['registrationJobs', { jobId }] as const,
    jobsList: (sellerId: string, status?: string) =>
      ['registrationJobs', { sellerId, status: status ?? null }] as const,
    draft: (sellerId: string) =>
      ['registrationDraft', { sellerId }] as const,
  },
  dashboard: {
    summary: (sellerId: string) =>
      ['dashboardSummary', { sellerId }] as const,
    recent: (sellerId: string, limit: number) =>
      ['dashboardRecent', { limit, sellerId }] as const,
  },
  history: {
    list: (
      sellerId: string,
      filters: { from?: string; to?: string; market?: string; status?: string }
    ) => ['history', { ...filters, sellerId }] as const,
    detail: (jobId: string) =>
      ['history', { jobId }] as const,
  },
  templates: {
    all: (sellerId: string) =>
      ['templates', { sellerId }] as const,
    detail: (templateId: string) =>
      ['templates', { templateId }] as const,
  },
} as const;
```

### 4.3 도메인별 키 예시 표

| 도메인 | 키 | 용도 | TTL / staleTime |
|---|---|---|---|
| auth | `['auth', 'session']` | 현재 Supabase 세션 | `Infinity` (Auth listener 가 invalidate) |
| markets | `['markets', { sellerId }]` | 연결된 마켓 계정 목록 | 30s |
| markets | `['markets', { marketAccountId, sellerId }]` | 단일 계정 상세 | 30s |
| markets | `['categories', { market, parentId }]` | 마켓별 카테고리 트리 노드 | 1h (마켓 카테고리 변경 빈도 낮음) |
| registration | `['registrationJobs', { sellerId, status }]` | 상태별 잡 목록 | 10s (Realtime 으로 즉시 무효화) |
| registration | `['registrationJobs', { jobId }]` | 단일 잡 + 마켓별 결과 | 5s (Realtime 무효화) |
| registration | `['registrationDraft', { sellerId }]` | 등록 위저드 임시 저장본 | 0 (mutation 후 즉시 invalidate) |
| dashboard | `['dashboardSummary', { sellerId }]` | 요약 통계 | 30s |
| dashboard | `['dashboardRecent', { limit, sellerId }]` | 최근 등록 N건 | 10s (Realtime) |
| history | `['history', { ...filters, sellerId }]` | 필터된 이력 목록 | 30s |
| history | `['history', { jobId }]` | 이력 상세 | 30s |
| templates | `['templates', { sellerId }]` | 템플릿 목록 (v2) | 1min |

**금지:**
- 키 안에 함수, Date 인스턴스, undefined 직접 넣지 말 것. `null` 로 정규화.
- 한 hook 안에서 키를 동적으로 join 하지 말고, 반드시 `queryKeys.*` 팩토리 호출.

---

## 5. Mutation 패턴

### 5.1 onSuccess invalidation 표

| Mutation | invalidate 대상 키 | 추가 동작 |
|---|---|---|
| `signIn` | `['auth', 'session']` | 라우터 `redirect` 파라미터 따라 이동 |
| `signOut` | `['auth', 'session']` + `queryClient.clear()` | `/login` 이동 |
| `signUp` | `['auth', 'session']` | `/dashboard` 이동 |
| `startOAuth(provider)` | (없음 — 외부 URL 이동) | `window.location.href` 변경 |
| `completeOAuth(provider, code)` | `['markets', { sellerId }]` | `/markets` 이동 + toast |
| `disconnectMarket(marketAccountId)` | `['markets', { sellerId }]`, `['markets', { marketAccountId, sellerId }]` | toast |
| `saveRegistrationDraft` | `['registrationDraft', { sellerId }]` | (silent) |
| `submitRegistration` | `['registrationJobs', { sellerId, status: null }]`, `['dashboardSummary', { sellerId }]`, `['dashboardRecent', { ... }]` | `/register/result/:jobId` 이동 |
| `retryJob(jobId)` | `['registrationJobs', { jobId }]`, `['history', { jobId }]` | toast |
| `retryJobExcludingMarkets(jobId, marketIds)` | 동일 | toast |
| `saveTemplate` (v2) | `['templates', { sellerId }]` | toast |
| `deleteTemplate` (v2) | `['templates', { sellerId }]`, `['templates', { templateId }]` | toast |

### 5.2 mutation hook 표준 형태

```tsx
// features/markets/hooks/useDisconnectMarket.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { disconnectMarket } from '../api/disconnectMarket';
import { useSession } from '@/features/auth/hooks/useSession';
import { useToast } from '@/components/ui/use-toast';
import { t } from '@/locales/ko';

export function useDisconnectMarket() {
  const qc = useQueryClient();
  const session = useSession();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (marketAccountId: string) =>
      disconnectMarket(marketAccountId),
    onSuccess: (_, marketAccountId) => {
      if (!session) return;
      qc.invalidateQueries({
        queryKey: queryKeys.markets.all(session.user.id),
      });
      qc.invalidateQueries({
        queryKey: queryKeys.markets.detail(session.user.id, marketAccountId),
      });
      toast({ description: t('markets.disconnect.success') });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        description: t('markets.disconnect.error'),
      });
    },
  });
}
```

**규칙:**
- `onSuccess` 에서 키를 hardcode 하지 말고 `queryKeys.*` 팩토리 사용.
- `setQueryData` 로 optimistic update 하는 경우, 실패 시 `onError` 에서 반드시 롤백.
- mutation 결과로 직접 라우팅하지 말고, page 컴포넌트가 `mutate(..., { onSuccess })` 에서 처리 (테스트 용이성).

---

## 6. Realtime 구독 패턴

### 6.1 원칙

- Supabase Realtime 은 **TanStack Query 의 대체가 아니라 트리거**. 변경 이벤트 수신 → Query cache invalidate → 자동 refetch.
- 구독은 `useEffect` + `supabase.channel(...)` 으로 직접 구현. 별도 wrapper 라이브러리 도입 안 함.
- 구독 채널은 컴포넌트가 unmount 되면 즉시 `removeChannel` 로 해제. 메모리 누수 방지.

### 6.2 RegistrationJob 실시간 갱신 스니펫

```tsx
// features/registration/hooks/useRegistrationJobRealtime.ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/query';
import { logger } from '@/lib/logger';

export function useRegistrationJobRealtime(jobId: string): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!jobId) return;

    const channel = supabase
      .channel(`registration_job:${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'registration_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          logger.debug({ jobId, event: payload.eventType }, 'realtime: job');
          qc.invalidateQueries({
            queryKey: queryKeys.registration.job(jobId),
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'registration_job_market_results',
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          logger.debug({ jobId, event: payload.eventType }, 'realtime: market_result');
          qc.invalidateQueries({
            queryKey: queryKeys.registration.job(jobId),
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [jobId, qc]);
}
```

### 6.3 구독 대상 표

| 화면 | 채널 / 테이블 | invalidate 키 |
|---|---|---|
| `/register/result/:jobId` | `registration_jobs`, `registration_job_market_results` (filter: jobId) | `queryKeys.registration.job(jobId)` |
| `/dashboard` | `registration_jobs` (filter: seller_id, 최근 N건) | `queryKeys.dashboard.recent(...)`, `queryKeys.dashboard.summary(...)` |
| `/markets` | `market_accounts` (filter: seller_id) | `queryKeys.markets.all(sellerId)` |
| `/history/:jobId` | `registration_jobs`, `registration_job_market_results` (filter: jobId) | `queryKeys.history.detail(jobId)` |

**RLS 정합성:** Supabase Realtime 도 RLS 를 따른다. 클라이언트가 본인 데이터 외 구독을 시도해도 이벤트가 도달하지 않음. 단, 채널 이름 자체로 정보 노출 안 되게 `seller:<uuid>` 형태로 셀러별 namespace 구성 권장.

---

## 7. 폼: React Hook Form + zod resolver

### 7.1 원칙

- 모든 폼은 **React Hook Form + `@hookform/resolvers/zod`** 사용.
- 동일 zod 스키마를 다음 3곳에 재사용:
  1. **RHF resolver** — 입력 단계 검증
  2. **Supabase insert/update 직전 parse** — DB 입력 직전 타입 보증
  3. **서버 응답 검증** — Edge Function 또는 Supabase SELECT 응답 zod parse
- 스키마 단일 소스: `apps/web/src/lib/schemas/`. 도메인이 명확하면 `apps/web/src/lib/schemas/<domain>.ts`.

### 7.2 단일 스키마 3중 재사용 예시

```ts
// apps/web/src/lib/schemas/product.ts
import { z } from 'zod';

export const productInputSchema = z.object({
  name: z.string().min(1, '상품명을 입력하세요').max(100),
  price: z.number().int().positive('가격은 0보다 커야 합니다'),
  description: z.string().min(1).max(5000),
  brand: z.string().max(50).optional(),
  manufacturer: z.string().max(50).optional(),
  countryOfOrigin: z.string().length(2).default('KR'),
});

export type ProductInput = z.infer<typeof productInputSchema>;

// 응답에는 서버 생성 필드가 추가됨
export const productSchema = productInputSchema.extend({
  id: z.string().uuid(),
  sellerId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Product = z.infer<typeof productSchema>;
```

```tsx
// features/registration/components/StepInfo.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productInputSchema, type ProductInput } from '@/lib/schemas/product';

export function StepInfo({ onNext }: { onNext: (input: ProductInput) => void }) {
  const form = useForm<ProductInput>({
    resolver: zodResolver(productInputSchema),
    defaultValues: { countryOfOrigin: 'KR' },
  });

  return (
    <form onSubmit={form.handleSubmit(onNext)}>
      {/* fields */}
    </form>
  );
}
```

```ts
// features/registration/api/saveDraft.ts
import { supabase } from '@/lib/supabase';
import { productInputSchema, type ProductInput } from '@/lib/schemas/product';

export async function saveDraft(input: ProductInput): Promise<void> {
  // 2) insert 직전 재검증 — RHF 우회로 들어온 데이터(예: 외부 호출) 도 차단
  const validated = productInputSchema.parse(input);

  const { error } = await supabase
    .from('product_drafts')
    .upsert({
      name: validated.name,
      price: validated.price,
      description: validated.description,
      brand: validated.brand,
      manufacturer: validated.manufacturer,
      country_of_origin: validated.countryOfOrigin,
    });

  if (error) throw error;
}
```

```ts
// features/registration/api/fetchDraft.ts
import { supabase } from '@/lib/supabase';
import { productSchema, type Product } from '@/lib/schemas/product';

export async function fetchDraft(sellerId: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('product_drafts')
    .select('*')
    .eq('seller_id', sellerId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  // 3) 응답 검증 — 스키마 drift 즉시 감지
  return productSchema.parse({
    id: data.id,
    sellerId: data.seller_id,
    name: data.name,
    price: data.price,
    description: data.description,
    brand: data.brand ?? undefined,
    manufacturer: data.manufacturer ?? undefined,
    countryOfOrigin: data.country_of_origin,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
}
```

**위반 시 (PR 차단):**
- 폼 컴포넌트 안에서 inline zod 스키마 정의 (스키마는 `lib/schemas/` 에만).
- Supabase insert 호출에서 raw 객체 직접 전달 (parse 우회).
- API 응답을 그대로 컴포넌트에 전달 (parse 누락).

---

## 8. 외부 데이터 zod 검증

### 8.1 검증 대상

| 출처 | 검증 위치 | 이유 |
|---|---|---|
| Supabase SELECT 응답 | `features/*/api/fetch*.ts` 함수 내부 | 스키마 drift 감지, undefined 노출 차단 |
| Edge Function 응답 | 동일 위치 | 백엔드 변경에 즉시 대응 |
| 마켓 API raw 응답 | Edge Function (서버) 에서만 — 클라이언트 노출 금지 | 횡단 관심사 분리 |
| URL search params | `useSearchParams` 래퍼 hook | XSS, 잘못된 enum 차단 |
| `localStorage` / `sessionStorage` | 읽는 hook 내부 | 사용자 임의 수정 가능 |
| `window.AppData` (debug 모드) | 진입점 1회 | mock 데이터 일관성 |
| `import.meta.env` | 앱 부트스트랩 1회 (`apps/web/src/lib/env.ts`) | 환경변수 누락 즉시 실패 |

### 8.2 패턴

**환경변수:**
```ts
// apps/web/src/lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  VITE_APP_MODE: z.enum(['dev', 'real']),
  VITE_USE_MOCK: z.union([z.literal('true'), z.literal('false')]).optional(),
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_SENTRY_DSN: z.string().url().optional(),
});

export const env = envSchema.parse(import.meta.env);
```

**localStorage:**
```ts
// 잘못된 패턴 — 타입 단언으로 회피
const draft = JSON.parse(localStorage.getItem('draft') ?? '{}') as ProductInput;

// 올바른 패턴
const raw = localStorage.getItem('draft');
const parsed = raw
  ? productInputSchema.safeParse(JSON.parse(raw))
  : null;
const draft = parsed?.success ? parsed.data : null;
```

**금지:**
- `as` 타입 단언으로 외부 데이터 강제 캐스팅. zod parse 만 허용.
- `any` 타입 사용. ESLint `no-explicit-any` 가 error 레벨.
- `// @ts-ignore` / `// @ts-expect-error` 무단 사용. 사용 시 PR description 에 이유 명시 + 30일 내 제거 약속.

---

## 9. UI 상태 패턴 (4+1)

### 9.1 상태 정의

모든 비동기 UI 컴포넌트는 다음 상태를 명시적으로 처리한다. 누락 시 코드 리뷰 거부.

| 상태 | 조건 | 시각적 처리 |
|---|---|---|
| `loading` | `query.isLoading === true` (초기 로딩) | shadcn `<Skeleton>` 또는 도메인별 placeholder. spinner 단독은 금지 (레이아웃 점프) |
| `data` | `query.data` 가 truthy + 빈 컬렉션 아님 | 정상 렌더 |
| `error` | `query.isError === true` | `<ErrorMessage>` (긴 raw response 접힘 기본) + 재시도 버튼 |
| `empty` | `query.data` 가 빈 컬렉션 또는 null (성공) | 도메인별 빈 상태 컴포넌트 (예: `<EmptyMarketState>` — 안내 + CTA) |
| `partial` | (RegistrationJob 전용) 일부 마켓만 성공 | 성공/실패 마켓 분리 표시 + 실패 마켓만 재시도 CTA |

### 9.2 patial 처리 규칙 (RegistrationJob)

- `registration_jobs.status === 'partial'` 일 때만 발생.
- 화면: `/register/result/:jobId`, `/history/:jobId`
- 표시:
  - 상단 요약 배너: "5개 마켓 중 3개 등록 성공, 2개 실패"
  - 마켓별 결과 카드 (성공/실패/대기 색상 구분, WCAG 대비 4.5:1)
  - 실패 마켓 카드에는 raw error 접힘 + "재시도" / "이 마켓 제외" 버튼
- 폴링/Realtime: `useRegistrationJobRealtime(jobId)` 로 실시간 갱신.

### 9.3 표준 컴포넌트 패턴

```tsx
// features/markets/pages/MarketsListPage.tsx
export function MarketsListPage() {
  const session = useSession();
  const query = useMarketAccounts(session?.user.id);

  if (query.isLoading) return <MarketAccountListSkeleton />;
  if (query.isError) {
    return (
      <ErrorMessage
        title={t('markets.list.errorTitle')}
        rawDetail={query.error.message}
        onRetry={() => query.refetch()}
      />
    );
  }
  if (!query.data || query.data.length === 0) {
    return <EmptyMarketState />;
  }
  return <MarketAccountList accounts={query.data} />;
}
```

**금지:**
- `query.data?.map(...)` 같은 옵셔널 체이닝으로 empty/loading 을 암묵 처리. 4상태 명시.
- `loading` 상태에 spinner 만 띄우고 레이아웃 비우기. 반드시 Skeleton.
- `error` 를 console.log 만 하고 화면에 표시 안 함.

---

## 10. 공용 컴포넌트 (`apps/web/src/components/ui/`) 사용 규칙

### 10.1 원칙

- **shadcn/ui 컴포넌트는 직접 소유** — `pnpm dlx shadcn-ui@latest add button` 으로 코드 복사. 라이브러리 의존 없음. 변경은 자유롭게 가능 (단, 토큰/접근성 깨면 안 됨).
- 위치: `apps/web/src/components/ui/<component>.tsx` (kebab-case).
- 모든 도메인 컴포넌트는 `@/components/ui/*` 를 사용한다.

### 10.2 금지 사항

| 금지 | 대체 |
|---|---|
| raw `<button>` | `<Button variant="..." />` |
| raw `<input>` | `<Input />` 또는 RHF 와 결합된 `<FormField>` |
| raw `<select>` | `<Select />` (shadcn) |
| native `confirm()` / `alert()` | `<AlertDialog>` |
| native `<dialog>` | `<Dialog>` 또는 `<Sheet>` |
| inline style 의 색상·spacing | Tailwind theme 토큰 (`bg-primary`, `p-4`) |
| Tailwind arbitrary value (`bg-[#FF0038]`) | `tailwind.config.ts` 의 디자인 토큰 추가 후 사용 |

### 10.3 예외 절차

`<button>` 등 raw HTML 이 정말 필요한 경우 (예: 외부 임베드, 특수한 a11y 요구):

1. PR description 에 사유 명시 ("shadcn `<Button>` 으로 구현 불가능한 이유")
2. 컴포넌트 상단에 `// eslint-disable-next-line @ing/no-raw-html-elements -- 사유: ...` 주석
3. designer + frontend reviewer 양쪽 승인 필수

### 10.4 필수 공용 컴포넌트 (`apps/web/src/components/ui/`)

| 컴포넌트 | 용도 |
|---|---|
| `button.tsx` | 모든 버튼. variant: `default` / `destructive` / `outline` / `secondary` / `ghost` / `link` |
| `input.tsx` | 단일 라인 입력 |
| `textarea.tsx` | 다중 라인 입력 |
| `select.tsx` | 드롭다운 선택 |
| `dialog.tsx` | 모달 |
| `sheet.tsx` | 사이드 슬라이드 패널 (모바일 친화) |
| `alert-dialog.tsx` | 확인/취소 다이얼로그 |
| `tooltip.tsx` | hover/focus 툴팁 (`blockingReasons` 표시) |
| `toast.tsx` + `use-toast.ts` | mutation 결과 toast |
| `skeleton.tsx` | loading placeholder |
| `error-message.tsx` | 긴 에러 접힘 + 재시도 |
| `empty-state.tsx` | 빈 상태 컴포넌트 베이스 |
| `progress.tsx` | 이미지 업로드 / 등록 진행률 |
| `tabs.tsx` | 탭 내비 |
| `form.tsx` | RHF 와 결합된 FormField/FormItem/FormLabel/FormMessage |

### 10.5 버튼 유형별 variant 규약

- **검색·필터류** (즉시 결과 갱신, 페이지 이동 없음): `variant="outline"` 또는 `variant="ghost"`.
- **실행류** (서버 변경·등록·삭제): `variant="default"` (주 CTA) 또는 `variant="destructive"` (파괴적).
- **취소·뒤로**: `variant="ghost"`.

### 10.6 실행류 비활성 사유 표시

`disabled` 만 두지 말고 `blockingReasons: string[]` 을 hover/focus tooltip 으로 노출. 키보드 사용자도 focus 시 사유 인지 가능.

```tsx
type SubmitButtonProps = {
  onClick: () => void;
  blockingReasons: string[]; // 빈 배열 = 활성화
};

export function SubmitButton({ onClick, blockingReasons }: SubmitButtonProps) {
  const disabled = blockingReasons.length > 0;

  if (!disabled) {
    return (
      <Button variant="default" onClick={onClick}>
        {t('register.submit')}
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* span wrapper — disabled 버튼은 pointer event 미수신 */}
        <span tabIndex={0} aria-describedby="submit-blocking-reasons">
          <Button variant="default" disabled aria-disabled>
            {t('register.submit')}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent id="submit-blocking-reasons">
        <ul className="list-disc pl-4">
          {blockingReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
```

---

## 11. 에러 경계

### 11.1 배치

- **라우트 단위 ErrorBoundary** — `app/router.tsx` 의 각 라우트에 `errorElement` 지정. React Router v6 의 `useRouteError` + `isRouteErrorResponse` 활용.
- **글로벌 ErrorBoundary** — `RouterProvider` 바깥에 `<SentryErrorBoundary>` 1개. 라우트 단위에서 잡지 못한 예외(컴포넌트 렌더 에러)를 캐치.
- **mutation 에러** — ErrorBoundary 가 잡지 못함. `onError` 에서 toast + `logger.error` + Sentry capture.

### 11.2 표준 errorElement

```tsx
// apps/web/src/app/RouteErrorBoundary.tsx
import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { ErrorMessage } from '@/components/ui/error-message';
import { useEffect } from 'react';

export function RouteErrorBoundary() {
  const error = useRouteError();

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  if (isRouteErrorResponse(error)) {
    return (
      <ErrorMessage
        title={`${error.status} ${error.statusText}`}
        rawDetail={JSON.stringify(error.data, null, 2)}
      />
    );
  }

  const message = error instanceof Error ? error.message : String(error);
  return (
    <ErrorMessage
      title={t('common.unexpectedError')}
      rawDetail={message}
    />
  );
}
```

### 11.3 Sentry 초기화

- `apps/web/src/lib/sentry.ts` 에서 초기화. `beforeSend` 훅이 OAuth 토큰·셀러 PII·마켓 자격증명 키 이름을 마스킹.
- `VITE_APP_MODE === 'dev'` 일 때도 Sentry 활성화 (dev 프로젝트로 분리). 단, 콘솔 출력은 verbose.
- security 에이전트 검수 항목: `beforeSend` 마스킹 룰 + Sentry sourcemap 업로드 후 잔여물 `.gitignore` 등록.

---

## 12. 번들 / 코드 스플리팅

### 12.1 라우트 기반 lazy

```tsx
// apps/web/src/app/router.tsx (발췌)
import { createBrowserRouter, lazy } from 'react-router-dom';
import { RouteErrorBoundary } from './RouteErrorBoundary';

const DashboardPage = lazy(
  () => import('@/features/dashboard/pages/DashboardPage')
);
const StepInfoPage = lazy(
  () => import('@/features/registration/pages/StepInfoPage')
);
// ... 모든 페이지 동일 패턴

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: 'dashboard', element: <DashboardPage /> },
      {
        path: 'register',
        children: [
          { index: true, loader: () => redirect('/register/info') },
          { path: 'info', element: <StepInfoPage /> },
          // ...
        ],
      },
      // ...
    ],
  },
]);
```

### 12.2 마켓 어댑터 dynamic import

- 마켓 어댑터(`MarketAdapter` 인터페이스 구현)는 클라이언트 번들에 직접 포함하지 않음. 클라이언트는 Edge Function 만 호출하므로 어댑터 자체는 서버측 코드.
- 단, **debug 모드** 에서는 mock 어댑터를 클라이언트에서 직접 사용 가능. 이 경우에도 dynamic import:

```ts
// apps/web/src/lib/marketAdapter.ts
import { env } from '@/lib/env';

export async function getMarketAdapter(market: string) {
  if (env.VITE_USE_MOCK) {
    const mod = await import(`@/mocks/adapters/${market}.ts`);
    return mod.adapter;
  }
  // useMock=false: real 어댑터 dynamic import (src/lib/markets/real/*)
  const mod = await import(`@/lib/markets/real/${market}`);
  return mod.default;
}
```

- mock 어댑터는 `src/mocks/adapters/` 에 분리. real 빌드 시 tree-shaking 으로 제거되도록 dynamic import + 조건 분기 + Vite `define` 으로 dead code elimination 보장.

### 12.3 번들 크기 가드레일

- 초기 번들 (entry + AppShell + RouterProvider) 200KB gzipped 이하 목표.
- CI 에 `vite-bundle-visualizer` 또는 `rollup-plugin-visualizer` 결과 artifact 업로드.
- 한 vendor chunk 가 100KB gzipped 초과 시 PR review 에서 분할 검토.

---

## 13. 접근성 규약

### 13.1 자동 검출

- **ESLint** — `eslint-plugin-jsx-a11y` 의 `recommended` 룰셋. 위반은 error 레벨.
- **E2E** — Playwright + `@axe-core/playwright` 로 골든 패스 테스트 시 axe 검사 통과 필수. 1개 이상의 critical/serious 위반 시 빌드 실패.

### 13.2 키보드 동선 체크리스트

새 화면 추가 시 다음을 수동 검증 (qa 에이전트 수락 기준):

- [ ] Tab 으로 모든 인터랙티브 요소에 도달 가능
- [ ] Shift+Tab 으로 역순 이동 가능
- [ ] 포커스 링이 명확히 보임 (대비 3:1 이상)
- [ ] Enter / Space 로 버튼·링크 동작
- [ ] Esc 로 Dialog / Sheet / Tooltip 닫힘
- [ ] 화면 진입 시 첫 인터랙티브 요소에 자동 포커스 또는 skip-to-content 링크
- [ ] disabled 버튼이라도 `aria-disabled` + Tab focus 가능 (사유 인지)

### 13.3 ARIA 라벨 규칙

- 아이콘 단독 버튼은 `aria-label` 필수.
- 폼 input 은 `<label>` 또는 `aria-labelledby` 명시.
- 비동기 영역 변경(toast, validation message)은 `aria-live="polite"`.
- 색상만으로 상태 구분 금지 (예: 빨강=실패, 초록=성공) — 아이콘 또는 텍스트 병행.

### 13.4 색상 대비

- 본문 텍스트 4.5:1 이상.
- 큰 텍스트(18pt 이상 또는 14pt bold) 3:1 이상.
- 포커스 링·뱃지 비텍스트 컴포넌트 3:1 이상.
- 디자인 토큰 (`ui-system.md`) 에서 보장하지만, 새 변형 추가 시 designer 와 함께 재검증.

### 13.5 반응형 + 터치 타겟

- 브레이크포인트: `~767px` (모바일) / `768~1199px` (태블릿) / `1200px+` (데스크탑). Tailwind `sm` / `md` / `lg` / `xl` 토큰 사용.
- 모바일 인터랙티브 요소 최소 44×44px (`min-h-11 min-w-11` Tailwind class).
- 기본 폰트 크기 ≥ 16px (모바일 줌 트리거 방지).
- 모바일 사이드바는 `<Sheet>` 로 햄버거 토글.

---

## 14. i18n 패턴

### 14.1 원칙

- 한국어 전용 운영. 단, **하드코딩 금지** — 모든 사용자 노출 텍스트는 `t('key')` 패턴으로 사전 참조.
- 사전 위치: `apps/web/src/locales/ko.ts`. 단일 파일 1000줄까지 허용, 초과 시 도메인별 분할 (`apps/web/src/locales/ko/auth.ts`, `apps/web/src/locales/ko/markets.ts`, ...).
- 도입 라이브러리: i18next 또는 경량 자체 dictionary. v1 첫 화면 작업 시점에 확정. 인터페이스만 안정화하면 라이브러리 교체는 비파괴적.

### 14.2 사전 구조

```ts
// apps/web/src/locales/ko.ts
export const ko = {
  common: {
    submit: '제출',
    cancel: '취소',
    retry: '다시 시도',
    unexpectedError: '예상치 못한 오류가 발생했습니다',
  },
  auth: {
    login: {
      title: '로그인',
      emailLabel: '이메일',
      passwordLabel: '비밀번호',
      submitButton: '로그인',
      forgotPasswordLink: '비밀번호를 잊으셨나요?',
    },
  },
  markets: {
    list: {
      title: '연결된 마켓',
      empty: '아직 연결된 마켓이 없습니다',
      errorTitle: '마켓 목록을 불러올 수 없습니다',
    },
    disconnect: {
      success: '마켓 연결이 해제되었습니다',
      error: '연결 해제에 실패했습니다',
    },
  },
  registration: {
    steps: {
      info: '상품 정보',
      images: '이미지',
      markets: '마켓 선택',
      categories: '카테고리',
      preview: '미리보기',
    },
    submit: '일괄 등록 실행',
    blocking: {
      noMarketSelected: '마켓을 1개 이상 선택해야 합니다',
      noImage: '이미지를 1장 이상 업로드해야 합니다',
      invalidCategory: '모든 마켓에 카테고리를 매핑해야 합니다',
    },
  },
} as const;
```

### 14.3 `t()` 헬퍼

```ts
// apps/web/src/locales/index.ts
import { ko } from './ko';

type Path<T> = T extends object
  ? { [K in keyof T]: K extends string ? `${K}` | `${K}.${Path<T[K]>}` : never }[keyof T]
  : never;

export type TranslationKey = Path<typeof ko>;

export function t(key: TranslationKey): string {
  const parts = key.split('.');
  let current: unknown = ko;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return key;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : key;
}
```

### 14.4 위반 검출

- ESLint 룰 (커스텀 또는 `eslint-plugin-i18next`) 로 JSX text node 의 한국어 리터럴 검출. 위반 시 error.
- 예외: a11y 용도의 시각 표시 외 텍스트(`aria-hidden="true"` 컨테이너), 디버그 전용 로그.

---

## 15. 변경 시 동기화

이 문서를 수정한 경우 다음을 함께 확인 (CLAUDE.md "3개 산출물 동기화" 규칙):

- `docs/architecture/v1/ui-system.md` — 컴포넌트 명세 변경 시
- `docs/architecture/v1/platform.md` — 라우팅·번들·환경변수 결정 변경 시
- `docs/frontend_html_design/v1/` — UI 패턴 변경 시 HTML 프로토타입 반영
- `apps/web/src/features/<domain>/` — 실제 구현 (도입 시점부터)

본 문서가 변경되었으나 구현이 따라잡지 못한 항목은 `## 16. 미구현 트래커` (도입 시점에 신설) 에 명시.
