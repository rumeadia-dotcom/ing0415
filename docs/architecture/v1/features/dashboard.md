# Dashboard (s2) 기능 설계

> 본 문서는 v1 의 **대시보드 (s2)** 단일 기능에 한정한다. user_flow.md s2 의 n9~n14, PRD §4.1 을 ground truth 로 한다. backend / frontend / designer / qa 관점을 한 문서에서 종합한다.
>
> 선행 문서:
> - `docs/architecture/v1/platform.md` (Supabase Postgres / Realtime / Edge Functions 운영 원칙)
> - `docs/architecture/v1/frontend.md` (React Router v6 / TanStack Query / zod / shadcn)
> - `docs/architecture/v1/ui-system.md` (디자인 토큰 · 컴포넌트 변종 · 다크 토글)
> - `docs/architecture/v1/security.md` (RLS 강제 · service_role 경로 · Sentry beforeSend)
> - `docs/architecture/v1/testing.md` §4 (수락 기준 매트릭스 양식) · §5 (실패 시나리오 8종)
> - `docs/architecture/v1/cross-cutting/registration-job-state.md` §3 `registration_jobs` / `registration_job_market_results` DDL · §4 Realtime 채널
> - `docs/architecture/v1/features/registration.md` (등록 위저드 진입 · 상세 · 재시도)
> - `docs/architecture/v1/features/markets.md` (`market_accounts` 상태 = active / expired / revoked / error)

본 문서는 **신규 테이블을 정의하지 않는다.** 모든 데이터 모델은 위 문서에서 정의된 것을 view 로 합성한다. 충돌 시 cross-cutting / 선행 features 문서가 우선한다.

---

## 1. 목적 · 범위

### 1.1 목적

s1 인증을 통과한 셀러가 가장 먼저 보는 화면. 다음 3가지를 한 화면에서 제공한다.

1. 등록 활동 한눈에 — "오늘 몇 건 등록했고, 진행 중인 잡이 몇 개고, 성공률이 얼마인가."
2. 최근 등록 잡의 마켓별 결과 — "어떤 잡이 partial / failed 인지, 어디로 들어가야 하는지."
3. 마켓 연결 건강 상태 — "토큰이 만료된 마켓이 있는지." (markets.md 인용)
4. 다음 행동 유도 — "상품 등록 시작" CTA.

### 1.2 v1 범위

| 구분 | 포함 (v1) | 제외 (v2+) |
|---|---|---|
| 요약 카드 | 오늘 등록 / 진행 중 / 7일 성공률 / 평균 소요 | 마켓별 KPI, 기간 비교(증감률) |
| 최근 등록 잡 | 최근 20건, 마켓별 상태 배지 | 무한 스크롤, 통계 다운로드 |
| 마켓 연결 상태 | active / expired / error 요약 (markets.md 인용) | 마켓별 상세 통계, OAuth 재인증 인라인 흐름 (마켓 페이지로 보냄) |
| Realtime 갱신 | `registration_jobs` INSERT/UPDATE | `market_accounts` 변동 (markets.md 책임) |
| CTA | "상품 등록 시작" (n9 → n15) | 템플릿에서 시작 (s4, v2) |

### 1.3 user_flow 매핑

`user_flow.md` s2 의 노드/엣지 중 본 문서가 책임지는 것:

| 노드 | 의미 | v1 / v2 |
|---|---|---|
| n9 | 대시보드 진입 (s1 인증 성공 후) | v1 |
| n10 | 등록 현황 요약 위젯 | **v1** |
| n11 | 마켓별 통계 위젯 | **v2** (자리만 비워둠) |
| n12 | 최근 등록 내역 리스트 | **v1** |
| n13 | 최근 잡 → 등록 이력 상세 진입 | v1 (registration.md / history 가 실제 화면 소유) |
| n14 | 새로고침 (수동) | v1 (Realtime 보조용, 명시적 버튼) |

n11 (마켓별 통계) 는 v1 에서 **자리만 비운다** — `<Card data-feature="market-stats-v2"/>` 형태로 placeholder 노출 + "v2 에서 제공" 문구. 코드 분기 없이 자연스럽게 비활성화.

### 1.4 라우트

| 경로 | 화면 | 인증 |
|---|---|---|
| `/dashboard` | 본 문서가 정의 (s2 메인) | 필수 (s1) |
| `/dashboard?refresh=1` | 수동 새로고침 표시 (URL 변경 후 자동 invalidate, 1회성) | 필수 |

`/dashboard` 는 사이드바 첫 항목 · s1 로그인 성공 후 default redirect. URL search params 는 zod 로 검증 (`refresh` 는 `'1' | undefined`).

---

## 2. 데이터 모델 (view 합성)

**신규 테이블 없음.** 기존 테이블 위에 계산 view 2개를 정의한다.

| view | 입력 테이블 | 용도 |
|---|---|---|
| `seller_dashboard_summary` | `registration_jobs` | 요약 카드 4개의 숫자 |
| `seller_recent_jobs` | `registration_jobs` + `registration_job_market_results` | 최근 20건 + 마켓별 집계 |

`market_accounts` 의 상태 요약은 별도 view 를 만들지 않는다. markets.md 가 정의한 `market_accounts` 를 클라이언트가 RLS 로 직접 SELECT 한 뒤 프론트에서 `groupBy(status)` 한다 (테이블 row 수 적음, 셀러당 ≤ 10).

### 2.1 view 의 RLS 호환 원칙

Postgres view 는 **기본 `security_invoker = on`** 으로 생성한다 (PG 15+). 이는:

- view 의 RLS 평가 시점이 **호출자 권한** 으로 동작 → 하위 테이블의 RLS 정책이 그대로 적용됨.
- `security_definer` view 는 **금지** (소유자 권한으로 평가 → RLS 우회 위험).

각 view 정의 시 `WITH (security_invoker = on)` 명시. PG 15 미만으로 다운그레이드되는 일 없도록 platform.md §Supabase 버전에 PG ≥ 15 명시되어 있다고 가정한다.

추가로 view 정의에 `WHERE seller_id = auth.uid()` 를 **명시하지 않는다** — 하위 테이블의 RLS 정책이 이미 셀러 격리를 강제하기 때문에 이중 필터링은 옵티마이저에 혼란을 준다. 단, 집계 비용 절감을 위해 `seller_id` 컬럼을 SELECT 절에 노출하고 클라이언트가 `eq('seller_id', uid)` 를 항상 붙이는 패턴을 권장한다 (인덱스 활용).

### 2.2 `seller_dashboard_summary` (요약 카드용)

요약 4지표를 한 row 로 반환. 셀러당 1 row.

```sql
-- migration: 20260518_dashboard_views.sql

CREATE OR REPLACE VIEW public.seller_dashboard_summary
WITH (security_invoker = on)
AS
WITH base AS (
  SELECT
    rj.seller_id,
    rj.status,
    rj.created_at,
    rj.completed_at,
    EXTRACT(EPOCH FROM (rj.completed_at - rj.created_at)) AS duration_sec
  FROM public.registration_jobs rj
)
SELECT
  seller_id,
  -- 오늘 (Asia/Seoul) 등록 건수
  COUNT(*) FILTER (
    WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'
  )::int AS jobs_today_count,
  -- 진행 중 (pending / running / retrying)
  COUNT(*) FILTER (
    WHERE status IN ('pending', 'running', 'retrying')
  )::int AS jobs_in_progress_count,
  -- 24h
  COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS jobs_24h_count,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours' AND status = 'succeeded')::int AS jobs_24h_succeeded,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours' AND status = 'partial')::int    AS jobs_24h_partial,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours' AND status = 'failed')::int     AS jobs_24h_failed,
  -- 7d
  COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS jobs_7d_count,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days' AND status = 'succeeded')::int AS jobs_7d_succeeded,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days' AND status = 'partial')::int    AS jobs_7d_partial,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days' AND status = 'failed')::int     AS jobs_7d_failed,
  -- 30d
  COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS jobs_30d_count,
  -- 평균 등록 시간 (7d, succeeded 만 — partial / failed 는 분포 왜곡)
  COALESCE(
    AVG(duration_sec) FILTER (
      WHERE status = 'succeeded'
        AND completed_at IS NOT NULL
        AND created_at >= now() - interval '7 days'
    ),
    0
  )::numeric(10, 2) AS avg_duration_sec_7d,
  -- 마지막 잡 시각 (empty 판정용)
  MAX(created_at) AS last_job_at
FROM base
GROUP BY seller_id;

COMMENT ON VIEW public.seller_dashboard_summary IS
  '셀러별 대시보드 요약. security_invoker=on 으로 registration_jobs RLS 그대로 적용. 셀러는 본인 1 row 만 보임.';
```

**설계 메모:**

- 7d 성공률 = `jobs_7d_succeeded / NULLIF(jobs_7d_count, 0)` (클라이언트 계산). DB 에서 `numeric` 으로 미리 나누면 0 분기와 반올림 정책이 server-side 에 박혀 추적이 어려워짐.
- 평균은 `succeeded` 만 — partial 잡의 `completed_at` 은 일부 마켓이 빨리 끝나면 짧게 잡힘, failed 도 마찬가지로 분포 왜곡.
- `created_at`/`status` 는 `cross-cutting/registration-job-state.md` §3.2 에 정의된 컬럼 그대로 사용. 본 문서에서 새 컬럼 추가 없음.
- 시간대: 한국 단일 운영이므로 `Asia/Seoul` 하드코딩. 다국가 진출 시 i18n 결정 시점에 재검토.

### 2.3 `seller_recent_jobs` (최근 잡 리스트용)

최근 20건 (실제로는 view 가 전체 반환, 클라이언트가 `limit(20)`). 잡 row + 마켓별 결과 집계.

```sql
CREATE OR REPLACE VIEW public.seller_recent_jobs
WITH (security_invoker = on)
AS
SELECT
  rj.id                          AS job_id,
  rj.seller_id,
  rj.product_id,
  rj.status                      AS job_status,
  rj.created_at,
  rj.started_at,
  rj.completed_at,
  rj.retry_count,
  rj.error_summary,
  rj.parent_job_id,
  -- 마켓별 집계 (jmr 가 RLS 로 같은 셀러만 보임)
  COALESCE(
    (
      SELECT jsonb_agg(
               jsonb_build_object(
                 'market_id', jmr.market_id,
                 'market_status', jmr.market_status,
                 'attempt_count', jmr.attempt_count,
                 'external_product_id', jmr.external_product_id,
                 'product_url', jmr.product_url,
                 'error_code', jmr.error_code,
                 'excluded', jmr.excluded
               )
               ORDER BY jmr.market_id
             )
      FROM public.registration_job_market_results jmr
      WHERE jmr.job_id = rj.id
    ),
    '[]'::jsonb
  ) AS markets,
  -- 카운트 헬퍼 (UI 배지 표시용 빠른 경로)
  (
    SELECT COUNT(*) FROM public.registration_job_market_results jmr2
    WHERE jmr2.job_id = rj.id AND jmr2.market_status = 'success'
  )::int AS success_count,
  (
    SELECT COUNT(*) FROM public.registration_job_market_results jmr3
    WHERE jmr3.job_id = rj.id AND jmr3.market_status IN ('failed', 'failed_final')
  )::int AS failed_count,
  (
    SELECT COUNT(*) FROM public.registration_job_market_results jmr4
    WHERE jmr4.job_id = rj.id
  )::int AS market_total_count
FROM public.registration_jobs rj
ORDER BY rj.created_at DESC;

COMMENT ON VIEW public.seller_recent_jobs IS
  '최근 잡 + 마켓별 결과 집계. security_invoker=on. 클라이언트는 LIMIT 20 강제.';
```

**설계 메모:**

- `markets` 컬럼은 `jsonb` — Postgrest 가 RLS 통과한 jmr row 만 합쳐줌. `external_product_id` 가 success 일 때만 채워지는 것은 jmr 의 `chk_success_has_external_id` 가 보장.
- 에러 메시지(`error_message`)는 view 에서 노출하지 **않는다** — UI 리스트는 코드(`error_code`) 만 보여주고, 상세 클릭 시 history / registration 화면이 `registration_job_market_results` 를 직접 조회. raw 메시지 길이가 대시보드 리스트 페이로드를 불필요하게 키움.
- 인덱스: `idx_registration_jobs_seller_created` (registration-job-state.md §3.2 에 이미 정의) 가 `(seller_id, created_at DESC)` 라 그대로 활용. jmr 측 `idx_jmr_job` 도 그대로.

### 2.4 view RLS 검증 (보안 핵심)

`security_invoker = on` 의 효과는 SQL 테스트로 매 마이그레이션 검증한다.

```sql
-- 테스트: 셀러 B 가 셀러 A 의 row 를 못 봄
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '<seller_B_uuid>';
SELECT count(*) FROM public.seller_dashboard_summary
WHERE seller_id = '<seller_A_uuid>';
-- 기대: 0
SELECT count(*) FROM public.seller_recent_jobs
WHERE seller_id = '<seller_A_uuid>';
-- 기대: 0
```

자동화: `RLS-SQL` 카테고리로 testing.md §3 의 RLS 격리 테스트 슈트에 포함 (아래 QA 매트릭스 QA-DSH-001 ~ 002).

---

## 3. API · RPC

### 3.1 결정: view 직접 SELECT vs RPC

| 옵션 | 장점 | 단점 |
|---|---|---|
| **A. view 직접 SELECT** (Postgrest) | 간단. 추가 코드 0. RLS 자동 적용. | 응답 shape 가 PostgREST 가 자동 생성 — zod 스키마 1:1 맞추기 까다로움 (특히 jsonb 의 nested 타입). |
| **B. RPC `get_dashboard_*`** (security invoker) | 응답 스키마를 한 곳에서 강제 (PL/pgSQL return type). zod 와 1:1. swagger 자동 생성도 깔끔. | 추가 SQL 코드. view 와 RPC 둘 다 유지보수. |

**결정: B (RPC) 우선 권장.** 근거:

1. zod 스키마(응답)는 `apps/web/src/lib/schemas/dashboard.ts` 에 단일 소스로 두고 PL/pgSQL `RETURNS TABLE(...)` 시그니처와 1:1. PostgREST 가 자동 생성하는 컬럼 누락/추가 변경을 컴파일 타임에 잡기 어려운 단점 회피.
2. 향후 `market-stats-v2` 가 추가될 때 RPC 의 응답에만 필드 확장 → 클라이언트 동시 배포 부담 작음.
3. Realtime 으로 호출 자체는 적음 (TanStack Query staleTime 30s + Realtime invalidate). RPC 오버헤드 무시 가능.

view 는 그대로 두되 (운영 점검 / 임시 쿼리용), 클라이언트는 RPC 만 호출한다.

### 3.2 RPC: `rpc_get_dashboard_summary()`

```sql
CREATE OR REPLACE FUNCTION public.rpc_get_dashboard_summary()
RETURNS TABLE (
  seller_id              uuid,
  jobs_today_count       int,
  jobs_in_progress_count int,
  jobs_24h_count         int,
  jobs_24h_succeeded     int,
  jobs_24h_partial       int,
  jobs_24h_failed        int,
  jobs_7d_count          int,
  jobs_7d_succeeded      int,
  jobs_7d_partial        int,
  jobs_7d_failed         int,
  jobs_30d_count         int,
  avg_duration_sec_7d    numeric,
  last_job_at            timestamptz
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    seller_id,
    jobs_today_count,
    jobs_in_progress_count,
    jobs_24h_count, jobs_24h_succeeded, jobs_24h_partial, jobs_24h_failed,
    jobs_7d_count,  jobs_7d_succeeded,  jobs_7d_partial,  jobs_7d_failed,
    jobs_30d_count,
    avg_duration_sec_7d,
    last_job_at
  FROM public.seller_dashboard_summary
  WHERE seller_id = auth.uid();
$$;

COMMENT ON FUNCTION public.rpc_get_dashboard_summary() IS
  'security invoker. 셀러 본인의 요약 1 row. registration_jobs 가 0 건이면 빈 결과 (.maybeSingle()).';
```

호출 패턴 (TypeScript):

```ts
const { data, error } = await supabase
  .rpc('rpc_get_dashboard_summary')
  .maybeSingle();
```

### 3.3 RPC: `rpc_get_recent_jobs(p_limit)`

```sql
CREATE OR REPLACE FUNCTION public.rpc_get_recent_jobs(p_limit int DEFAULT 20)
RETURNS TABLE (
  job_id              uuid,
  seller_id           uuid,
  product_id          uuid,
  job_status          registration_job_status,
  created_at          timestamptz,
  started_at          timestamptz,
  completed_at        timestamptz,
  retry_count         smallint,
  error_summary       text,
  parent_job_id       uuid,
  markets             jsonb,
  success_count       int,
  failed_count        int,
  market_total_count  int
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    job_id, seller_id, product_id, job_status,
    created_at, started_at, completed_at,
    retry_count, error_summary, parent_job_id,
    markets, success_count, failed_count, market_total_count
  FROM public.seller_recent_jobs
  WHERE seller_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 50));  -- 1~50 clamp
$$;

COMMENT ON FUNCTION public.rpc_get_recent_jobs(int) IS
  'security invoker. 셀러 본인의 최근 잡 (default 20, max 50). markets jsonb 는 마켓별 결과 배열.';
```

`limit` 은 1~50 clamp — 클라이언트가 더 큰 값을 요청해도 50 으로 잘림. 50 초과는 history 화면(별도 페이지네이션) 책임.

### 3.4 zod 스키마 (`apps/web/src/lib/schemas/dashboard.ts`)

> **`RegistrationJobStatusSchema` / `MarketResultStatusSchema` / `MarketIdSchema` 는 본 모듈에서 정의하지 않는다.** schema 정의는 `apps/web/src/lib/schemas/registration.ts` 단일 소스 (`features/registration.md` §9 참조). 본 모듈은 `import` 해서 재사용만 한다.

```ts
import { z } from 'zod';
import {
  RegistrationJobStatusSchema,
  MarketResultStatusSchema,
  MarketIdSchema,
} from '@/lib/schemas/registration';

export const RecentJobMarketSchema = z.object({
  market_id: MarketIdSchema,
  market_status: MarketResultStatusSchema,
  attempt_count: z.number().int().min(0).max(3),
  external_product_id: z.string().nullable(),
  product_url: z.string().url().nullable(),
  error_code: z.string().nullable(),
  excluded: z.boolean(),
});

export const DashboardSummarySchema = z.object({
  seller_id: z.string().uuid(),
  jobs_today_count: z.number().int().nonnegative(),
  jobs_in_progress_count: z.number().int().nonnegative(),
  jobs_24h_count: z.number().int().nonnegative(),
  jobs_24h_succeeded: z.number().int().nonnegative(),
  jobs_24h_partial: z.number().int().nonnegative(),
  jobs_24h_failed: z.number().int().nonnegative(),
  jobs_7d_count: z.number().int().nonnegative(),
  jobs_7d_succeeded: z.number().int().nonnegative(),
  jobs_7d_partial: z.number().int().nonnegative(),
  jobs_7d_failed: z.number().int().nonnegative(),
  jobs_30d_count: z.number().int().nonnegative(),
  avg_duration_sec_7d: z.coerce.number().nonnegative(),  // numeric → number
  last_job_at: z.string().datetime({ offset: true }).nullable(),
});

export const RecentJobSchema = z.object({
  job_id: z.string().uuid(),
  seller_id: z.string().uuid(),
  product_id: z.string().uuid(),
  job_status: RegistrationJobStatusSchema,
  created_at: z.string().datetime({ offset: true }),
  started_at: z.string().datetime({ offset: true }).nullable(),
  completed_at: z.string().datetime({ offset: true }).nullable(),
  retry_count: z.number().int().min(0).max(5),
  error_summary: z.string().nullable(),
  parent_job_id: z.string().uuid().nullable(),
  markets: z.array(RecentJobMarketSchema),
  success_count: z.number().int().nonnegative(),
  failed_count: z.number().int().nonnegative(),
  market_total_count: z.number().int().nonnegative(),
});

export const RecentJobsResponseSchema = z.array(RecentJobSchema).max(50);

export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;
export type RecentJob = z.infer<typeof RecentJobSchema>;
export type RecentJobMarket = z.infer<typeof RecentJobMarketSchema>;
```

zod 는 RPC 응답에 즉시 `parse()` — 실패 시 Sentry 에 `validation_failed` 이벤트(필드 path 만, 값 미포함) 보내고 UI 는 error 상태로 폴백.

### 3.5 TanStack Query 키 규약

`frontend.md` §Query Key 규약 (`[domain, ...filters]`) 을 따른다.

```ts
export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
  recent: (limit: number) => [...dashboardKeys.all, 'recent', { limit }] as const,
};

// 사용
useQuery({
  queryKey: dashboardKeys.summary(),
  queryFn: async () => {
    const { data, error } = await supabase.rpc('rpc_get_dashboard_summary').maybeSingle();
    if (error) throw new SupabaseError(error);
    return data === null
      ? DashboardSummarySchema.parse(EMPTY_SUMMARY_FALLBACK(sellerId))
      : DashboardSummarySchema.parse(data);
  },
  staleTime: 30_000,
  refetchOnWindowFocus: true,
});
```

**`maybeSingle()` 가 null 인 경우 (등록 잡 0건)** → 클라이언트에서 0 으로 채운 fallback 객체 생성 (모든 카운트 0, `last_job_at=null`). 빈 상태 UI 분기는 `last_job_at === null` 또는 `jobs_30d_count === 0` 로 판정.

---

## 4. Realtime 갱신 (PRD §4.1.1 "별도 새로고침 없이 최신 정보")

### 4.1 구독 채널

`cross-cutting/registration-job-state.md` §4 의 Realtime 채널 정의를 그대로 사용한다. 본 문서는 **새 채널을 만들지 않는다.**

```ts
// apps/web/src/features/dashboard/hooks/useDashboardRealtime.ts
useEffect(() => {
  const channel = supabase
    .channel(`dashboard:${sellerId}`)
    .on(
      'postgres_changes',
      {
        event: '*',                    // INSERT / UPDATE / DELETE
        schema: 'public',
        table: 'registration_jobs',
        filter: `seller_id=eq.${sellerId}`,
      },
      (payload) => {
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'registration_job_market_results',
        // jmr 자체는 seller_id 컬럼 없음 → 필터링은 RLS 가 책임. payload 도착 시 invalidate.
      },
      (payload) => {
        queryClient.invalidateQueries({ queryKey: dashboardKeys.recent(20) });
      },
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [sellerId, queryClient]);
```

**핵심 결정:**

- 한 채널에 `registration_jobs` + `registration_job_market_results` 두 subscribe 를 묶는다. 채널 개수 줄여 Supabase Realtime 동시 연결 한도 절약.
- `registration_jobs` 변경은 **summary + recent 둘 다 invalidate** (4 카드 숫자가 모두 바뀔 수 있음).
- `registration_job_market_results` 변경은 **recent 만 invalidate** (summary 는 상위 잡 상태로만 집계 — 마켓 결과 단독 변경으로는 숫자가 바뀌지 않음).
- jmr 에는 `seller_id` 컬럼이 없다. Postgres changes 필터를 못 걸지만 RLS 가 셀러 본인 row 만 push 하므로 보안상 안전 (security.md §realtime-rls 확인).

### 4.2 fallback (Realtime 연결 실패)

- WebSocket 끊김 5초 이상 지속 → 상단에 "실시간 갱신 일시 중단됨, 30 초마다 자동 새로고침 중" 토스트 배너 + TanStack Query `refetchInterval: 30_000` 로 전환.
- 복구 시 배너 제거 + refetchInterval 0 으로 환원.
- 명시적 새로고침 버튼(n14) 은 항상 노출 — Realtime 정상이어도 표시. 클릭 시 `invalidateQueries(dashboardKeys.all)`.

### 4.3 디바운스

같은 잡이 1초 안에 여러 번 UPDATE 되는 경우 (마켓 결과 동시 도착) — invalidateQueries 자체는 다발 호출이 와도 TanStack Query 가 한 번만 실제 fetch 한다 (`networkMode: 'online'` + 진행 중 fetch dedup). 별도 디바운스 코드 불필요.

---

## 5. UI 흐름 — 화면별

### 5.1 라우트 = `/dashboard`

#### 5.1.1 페이지 구조 (논리적)

```
PageHeader
  ├ Greeting "안녕하세요, {nickname}님"
  ├ "마지막 활동: {lastJobAt | '아직 없음'}"
  └ Actions
      ├ Button(secondary, icon=RefreshCw) "새로고침" (n14)
      └ Button(primary, icon=Plus) "상품 등록 시작"  (n9 → /register)

SummaryGrid  (4 카드)
  ├ Card "오늘 등록"            value=jobs_today_count    icon=Calendar
  ├ Card "진행 중"              value=jobs_in_progress    icon=Loader (회전 — 진행 중 > 0 일 때만)
  ├ Card "7일 성공률"           value=successRate7d %      icon=TrendingUp
  └ Card "평균 등록 소요"       value=fmtDuration(7d avg)  icon=Clock

TwoColumnSection
  ├ LeftCol (8 cols on desktop, 12 on mobile)
  │   Card "최근 등록"
  │     ├ Header "최근 등록"  (오른쪽: "이력 전체 보기" → /history)
  │     ├ RecentJobsList (max 20)
  │     │   item:
  │     │     ├ ProductThumb (40x40, fallback 회색)
  │     │     ├ ProductName + 마켓 stack (MarketStack)
  │     │     ├ JobStatusBadge (succeeded / partial / failed / running / ...)
  │     │     ├ "X분 전" 상대 시간
  │     │     └ → 클릭 시 /history/jobs/{job_id}
  │     └ Empty: "아직 등록한 상품이 없어요" + CTA
  │
  └ RightCol (4 cols on desktop, 12 on mobile)
      ├ Card "마켓 연결 상태" (markets.md 인용)
      │   ├ active 수 / expired 수 / error 수 + 각 색
      │   └ "마켓 관리" → /markets
      │
      └ Card "마켓별 통계" data-feature="market-stats-v2"
          ├ disabled placeholder
          └ "v2 에서 제공 예정" + 디자인 prototype 시안 thumbnail
```

#### 5.1.2 ASCII 와이어 — 데스크탑 (≥1200px)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 대시보드                              [↻ 새로고침] [+ 상품 등록 시작 ▶]   │
│ 안녕하세요, 홍길동님 · 마지막 활동: 12분 전                                │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│ │ 오늘 등록    │ │ 진행 중      │ │ 7일 성공률   │ │ 평균 등록 소요 │   │
│ │   12         │ │   3 ⟳        │ │   92.5%      │ │   1분 47초     │   │
│ │ 어제 8건     │ │ partial 1    │ │ 56/61        │ │ 7일 평균       │   │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ ┌──────────────────────┐  │
│ │ 최근 등록           [이력 전체 보기 →]   │ │ 마켓 연결 상태       │  │
│ ├─────────────────────────────────────────┤ │ ● 활성  2            │  │
│ │ ▢  상품A  [N][C]  ● 성공     3분 전   →│ │ ▲ 만료  0            │  │
│ │ ▢  상품B  [N][C]  ◑ 부분 성공 12분 전  →│ │ ▼ 오류  0            │  │
│ │ ▢  상품C  [N]     ⟳ 진행 중   1분 전   →│ │ [마켓 관리 →]        │  │
│ │ ▢  상품D  [C]     ✕ 실패      1시간 전 →│ ├──────────────────────┤  │
│ │ ...                                      │ │ 마켓별 통계 (v2)     │  │
│ │ (최대 20건)                              │ │ ░░░░░░░░░░░░░░░░░░░ │  │
│ │                                          │ │ v2 에서 제공 예정    │  │
│ └─────────────────────────────────────────┘ └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 5.1.3 ASCII 와이어 — 태블릿 (768~1199px)

```
┌──────────────────────────────────────────────────────┐
│ 대시보드               [↻] [+ 상품 등록 시작 ▶]      │
│ 안녕하세요, 홍길동님 · 마지막 활동: 12분 전             │
├──────────────────────────────────────────────────────┤
│ ┌────────────┐ ┌────────────┐                       │
│ │ 오늘 등록  │ │ 진행 중    │                       │
│ │   12       │ │   3 ⟳      │                       │
│ └────────────┘ └────────────┘                       │
│ ┌────────────┐ ┌────────────┐                       │
│ │ 7일 성공률 │ │ 평균 소요  │                       │
│ │   92.5%    │ │  1분 47초  │                       │
│ └────────────┘ └────────────┘                       │
├──────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────┐ │
│ │ 최근 등록                  [이력 전체 보기 →]    │ │
│ │ (리스트, 데스크탑과 동일)                          │ │
│ └──────────────────────────────────────────────────┘ │
│ ┌──────────────────────────┐ ┌──────────────────┐   │
│ │ 마켓 연결 상태           │ │ 마켓별 통계 (v2) │   │
│ └──────────────────────────┘ └──────────────────┘   │
└──────────────────────────────────────────────────────┘
```

#### 5.1.4 ASCII 와이어 — 모바일 (≤767px)

```
┌────────────────────────────┐
│ ☰ 대시보드           [↻]   │
│ 홍길동 · 12분 전            │
├────────────────────────────┤
│ [+ 상품 등록 시작 ▶ ]      │  ← 풀폭 sticky CTA
├────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ │
│ │ 오늘 12  │ │ 진행 3 ⟳ │ │
│ └──────────┘ └──────────┘ │
│ ┌──────────┐ ┌──────────┐ │
│ │ 성공 92% │ │ 1분47초  │ │
│ └──────────┘ └──────────┘ │
├────────────────────────────┤
│ 최근 등록                   │
│ ─────────────────────────  │
│ ▢ 상품A  [N][C]  ●  3분전 →│
│ ▢ 상품B  [N][C]  ◑  12분전→│
│ ...                        │
├────────────────────────────┤
│ 마켓 연결 ● 활성 2  ▲ 0 ▼ 0│
├────────────────────────────┤
│ 마켓별 통계 (v2) ░░░░░░░░░ │
└────────────────────────────┘
```

모바일 터치 타겟 ≥44×44px (frontend.md §5). 카드 클릭 영역 전체가 link.

### 5.2 위젯 명세

#### 5.2.1 SummaryCard (4종 공용)

| Prop | 타입 | 비고 |
|---|---|---|
| `label` | string | 한국어, `t('dashboard.cards.todayCount')` 등 |
| `value` | string \| number | 포맷 후 문자열 (예: `'92.5%'`, `'1분 47초'`) |
| `valueLabel` | string \| undefined | 보조 텍스트 ("어제 8건" 등) |
| `icon` | LucideIcon | 아이콘은 색만으로 의미 전달 금지 — 항상 label 동반 |
| `tone` | `'neutral' \| 'success' \| 'warning' \| 'danger'` | 색 토큰. tone 단독으로 의미 전달 X (테스트 시 텍스트로 검증) |
| `loading` | boolean | skeleton (값 영역 회색 펄스) |

shadcn `<Card>` 사용. `tone` → CSS 변수 토큰 (`--card-tone-success` 등). `ui-system.md` 의 token 만 사용.

#### 5.2.2 RecentJobsList

| 컬럼 | 데이터 | 동작 |
|---|---|---|
| 썸네일 | `products.thumbnail_url` (필요 시 별도 fetch 또는 join 추가 검토) — v1 은 placeholder | 클릭 시 잡 상세 |
| 상품명 | `products.name` (RPC 응답에 누락 → 5.2.2-1 처리) | - |
| 마켓 stack | `markets[]` 의 `market_id` 배열 → `<MarketStack>` (prototype 인용) | hover 시 마켓별 상태 tooltip |
| 잡 상태 | `job_status` → `<JobStatusBadge>` | 색 + 아이콘 + 한국어 라벨 (3중 중복) |
| 진행률 | `success_count / market_total_count` | partial 일 때만 노출 ("2/3 성공") |
| 시간 | `formatRelative(created_at)` | hover 시 절대 시각 |
| → | 잡 상세 링크 | `/history/jobs/{job_id}` |

**5.2.2-1 상품명·썸네일 누락**: `seller_recent_jobs` view 가 `products.name` / `thumbnail_url` 을 JOIN 하지 않는다. 두 가지 안.

| 안 | 비고 |
|---|---|
| **A. view 에 products LEFT JOIN 추가** (권장) | 한 번에 가져옴. products RLS 도 셀러 본인 → security_invoker 그대로 통과. |
| B. 클라이언트에서 product_id 모아 별도 fetch | 네트워크 1회 추가. waterfall. |

**결정: A.** view 정의를 다음과 같이 보강 (위 §2.3 의 view 에 `p.name`, `p.thumbnail_url` 컬럼을 SELECT 절에 추가 + `LEFT JOIN public.products p ON p.id = rj.product_id`). 본 문서 작성 후 SQL 마이그레이션 작성 시 반영. zod 스키마에도 `product_name`, `product_thumbnail_url` 필드 추가.

```sql
-- 위 view 정의에 추가:
LEFT JOIN public.products p ON p.id = rj.product_id
-- SELECT 절에 추가:
,  p.name           AS product_name
,  p.thumbnail_url  AS product_thumbnail_url
```

`products` 가 삭제될 일은 거의 없지만 `ON DELETE RESTRICT` (registration.md §3.2) 라 LEFT 일 필요 없음. 일관성 위해 LEFT JOIN 유지.

#### 5.2.3 JobStatusBadge

상태 7종을 색 + 아이콘 + 한국어 라벨 3중으로 표현.

| status | 아이콘 | 색 토큰 | 라벨 |
|---|---|---|---|
| `pending` | Hourglass | `--badge-neutral` | 대기 중 |
| `running` | Loader (회전) | `--badge-info` | 진행 중 |
| `retrying` | RotateCcw (회전) | `--badge-warning` | 재시도 중 |
| `partial` | CircleDashed | `--badge-warning` | 일부 성공 |
| `succeeded` | CheckCircle | `--badge-success` | 성공 |
| `failed` | XCircle | `--badge-danger` | 실패 |
| `cancelled` | Slash | `--badge-neutral` | 취소됨 |

색 대비 4.5:1 이상 (ui-system.md 토큰 검수). 색약 대응: 아이콘 + 라벨 동반 필수, color-only 표현 금지.

#### 5.2.4 MarketConnectionStatusCard

```ts
// markets.md 인용. dashboard 는 SELECT 만, 변경 없음.
const { data: accounts } = useQuery({
  queryKey: ['markets', 'accounts', { sellerId }],
  queryFn: () => supabase.from('market_accounts').select('id, market_id, status').then(...),
});
const grouped = groupBy(accounts ?? [], 'status');
```

표시:

- `active` 수: `--badge-success`
- `expired` 수: `--badge-warning` ("재인증 필요")
- `error` 수: `--badge-danger`
- `revoked` 수: `--badge-neutral` (있다면)

`expired > 0` 시 "재인증 필요 N개" 클릭 → `/markets?filter=expired`.

#### 5.2.5 MarketStatsV2Placeholder

```tsx
<Card data-feature="market-stats-v2" aria-disabled="true">
  <CardHeader>
    <CardTitle className="text-muted-foreground">마켓별 통계</CardTitle>
    <Badge variant="outline">v2 예정</Badge>
  </CardHeader>
  <CardContent>
    <img src="/illustrations/market-stats-coming-soon.svg" alt="" />
    <p className="text-sm text-muted-foreground">{t('dashboard.marketStats.comingSoon')}</p>
  </CardContent>
</Card>
```

`aria-disabled` + 키보드 포커스 가능 (tabindex 0) 이지만 클릭 동작 없음. 스크린리더에 "현재 사용할 수 없음" 안내.

### 5.3 빈 상태 (0건 셀러)

```
┌─────────────────────────────────────────┐
│           [Illustration]                 │
│                                          │
│      첫 상품을 등록해보세요              │
│  여러 마켓에 한 번에 올릴 수 있어요      │
│                                          │
│    [+ 첫 상품 등록 시작 ▶]               │
│                                          │
│    먼저 마켓 연결이 필요한가요?           │
│    [마켓 연결하기 →]                      │
└─────────────────────────────────────────┘
```

판정: `summary.last_job_at === null` AND `accounts.length === 0` → 위 풀스크린 빈 상태.
판정: `summary.last_job_at === null` AND `accounts.length > 0` → 같은 빈 상태에서 "마켓 연결" 링크 숨김.

`accounts.length === 0` 인 경우 "마켓 연결" 을 1차 행동으로 우선순위 강조 (CTA 색 변경).

---

## 6. 상태 처리 (4상태 + partial)

frontend.md "4상태 + partial 처리" 규칙을 적용한다.

| 상태 | 트리거 | UI |
|---|---|---|
| `loading` | 최초 fetch | skeleton: 4 카드 모두 회색 펄스, 리스트 5 row 회색 펄스 |
| `data` | RPC 성공 | 정상 렌더 |
| `error` | RPC 실패 / zod 실패 | `<ErrorMessage>` (접힘 기본) + 재시도 버튼 + "실시간 갱신 일시 중단" 배너 |
| `empty` | `summary.last_job_at === null` | §5.3 빈 상태 |
| `partial` | recent 목록 일부 잡이 `partial` | 해당 row 에 노란 배지 + "재시도 / 실패한 마켓만" CTA → /history 또는 /register?retry={jobId} (registration.md §재시도) |

`partial` 은 잡 단위로 row 안에서 표시. 대시보드 전체가 partial 상태가 되지는 않음.

---

## 7. 에러 매핑

| 분류 | 원인 | UI |
|---|---|---|
| `summary_rpc_5xx` | RPC 호출 5xx | "요약을 불러오지 못했어요. 잠시 후 다시 시도해주세요." + 재시도 |
| `recent_rpc_5xx` | RPC 호출 5xx | 카드만 에러, summary 는 정상 |
| `zod_validation_failed` | 응답이 스키마 불일치 | Sentry 전송 (필드 path 만, 값 미포함) + 사용자에게는 "데이터 형식이 잘못되었어요. 새로고침해주세요" |
| `auth_expired` | JWT 만료 | s1 로그인 페이지 redirect (auth.md §세션 만료 처리) |
| `realtime_disconnected` | WebSocket 5초 이상 끊김 | 상단 배너 + `refetchInterval` 30s 폴백 |
| `realtime_reconnected` | 복구 | 배너 사라짐 + `refetchInterval` 해제 |
| `rls_denied` (이론상 발생 불가) | 다른 셀러 row 가 push 됨 (서버 버그) | Sentry P0 alert + 데이터 무시 (UI 표시 안 함) |

Sentry `beforeSend` (security.md §sentry-mask) 가 OAuth 토큰·이메일·전화·잡 raw error_message 마스킹. 본 화면이 노출하는 raw 값은 `external_product_id`, `product_url` (이미 마켓이 공개로 부여한 식별자) 만 — PII 아님.

---

## 8. 성능

### 8.1 인덱스

이미 정의된 인덱스로 충분.

| 인덱스 | 정의처 | 본 화면 활용 |
|---|---|---|
| `idx_registration_jobs_seller_created (seller_id, created_at DESC)` | registration-job-state.md §3.2 | recent_jobs view 의 ORDER BY |
| `idx_registration_jobs_seller_status (seller_id, status)` | 동상 | summary view 의 FILTER 절 |
| `idx_jmr_job (job_id)` | 동상 §3.3 | recent_jobs 의 jsonb_agg subquery |
| `market_accounts_seller_id_idx (seller_id)` | markets.md §2.1 | MarketConnectionStatusCard |

**추가 인덱스 제안: 없음.** 새 인덱스는 view 가 실제로 느린 게 측정된 후에 추가 (premature optimization 거부).

### 8.2 캐시 전략 (TanStack Query)

| 키 | staleTime | gcTime | refetchOnWindowFocus | refetchInterval |
|---|---|---|---|---|
| `dashboardKeys.summary()` | 30s | 5분 | `true` | 0 (Realtime 정상 시) / 30s (fallback) |
| `dashboardKeys.recent(20)` | 30s | 5분 | `true` | 동상 |
| `['markets', 'accounts', { sellerId }]` | 60s | 10분 | `true` | 0 (markets.md 가 Realtime 채널 별도 보유) |

staleTime 30s = "30초 안에 다시 마운트되면 fetch 안 함". Realtime 이 invalidate 하면 즉시 refetch. window focus refetch 는 모바일에서 앱 전환 후 자동 갱신 효과.

### 8.3 응답 페이로드

- summary: 14 필드 × number/timestamp → ~ 200 bytes
- recent: 20 row × (~15 필드 + markets jsonb 평균 2 마켓 × 7 필드) → ~ 6 KB
- accounts: 평균 2 row × 3 필드 → ~ 200 bytes

총 < 10 KB. gzip 후 < 3 KB. 부하 무시 가능.

### 8.4 view 비용

`seller_dashboard_summary` 는 셀러당 1 row 집계. `registration_jobs` 의 seller_id partial 인덱스 활용. 셀러당 잡 100 만건이 되어도 인덱스 스캔 → 단일 셀러 row 만 → 수 ms.

`seller_recent_jobs` 는 ORDER BY + LIMIT 20. 상관 서브쿼리 (`jsonb_agg`) 가 row 당 1회 — 20 row × jmr 평균 2개 → 40회. ms 단위.

실측 측정 트리거: 평균 응답 > 200ms 또는 P95 > 500ms 시 view 재설계 (materialized view 또는 별도 집계 테이블 + trigger). 현재는 보류.

---

## 9. 접근성 (WCAG 2.1 AA)

### 9.1 키보드 동선

```
Tab 순서:
1. 사이드바 (← s2 진입 시) 이미 dashboard 활성 표시
2. [새로고침] 버튼
3. [상품 등록 시작] CTA
4. 카드 1 → 4 (카드 자체는 link 아님, focusable false. 단 내용 클릭 가능한 부분만 focus)
5. "이력 전체 보기" 링크
6. 최근 잡 row 1 → 20 (각 row 는 link, Enter 로 진입)
7. "마켓 관리" 링크
8. (placeholder 는 aria-disabled 라 tab skip)
```

Skip link: 사이드바 첫 진입 시 "본문으로 건너뛰기" 제공 (frontend.md §a11y 참조).

### 9.2 ARIA

- `<main aria-labelledby="page-title">` + `<h1 id="page-title">대시보드</h1>`
- 카드: `<section aria-label="오늘 등록 건수">`
- 진행 중 카운트의 회전 아이콘: `<Loader aria-hidden="true">` (장식), 텍스트로 "3건 진행 중" 음성 노출
- 잡 상태 배지: `aria-label="상태: 부분 성공, 2/3 마켓 성공"`
- 새로고침 버튼: `aria-label="대시보드 새로고침"`
- 실시간 배너: `role="status" aria-live="polite"`

### 9.3 색 + 아이콘 + 라벨 3중

`JobStatusBadge` 가 색만으로 의미를 전달하지 않게 아이콘 + 한국어 라벨 동반 (§5.2.3 표).

색약 대응: protanopia / deuteranopia / tritanopia 시뮬레이션을 디자인 리뷰 시 1회 강제 (qa 매트릭스 QA-DSH-010 에 수동 항목).

### 9.4 대비

라이트/다크 토큰 모두 4.5:1 검증. axe-core (Playwright) 가 CI 에서 자동 검출. 위반 시 PR 차단 (testing.md §axe).

### 9.5 모션 민감성

`prefers-reduced-motion: reduce` 인 사용자: 회전 아이콘 (Loader / RotateCcw) → 정적 색 변경으로 대체. CSS `@media (prefers-reduced-motion: reduce)` 처리.

---

## 10. 테스트 매트릭스 (testing.md §4 양식)

| ID | Given | When | Then | 자동화 | Priority |
|----|-------|------|------|--------|----------|
| QA-DSH-001 | 셀러 A 가 자기 잡 5건 보유, 셀러 B 가 별도 잡 3건 보유 | 셀러 B 가 `rpc_get_dashboard_summary` 호출 | `seller_id = B.uid` 인 1 row 만 반환. 카운트는 B 의 데이터만. A 의 데이터 0건 노출. | RLS-SQL | P0 |
| QA-DSH-002 | 셀러 B 가 셀러 A 의 `job_id` 를 알고 `rpc_get_recent_jobs(p_limit:=20)` 호출 | 응답 검사 | 응답에 A 의 잡 row 없음. PostgREST 로 view 직접 SELECT 도 동일. | RLS-SQL | P0 |
| QA-DSH-003 | 셀러 A 가 잡 0건. | `/dashboard` 진입 | 빈 상태 풀스크린 ("첫 상품 등록" CTA). 카드 4개 모두 0 표시. Sentry 에러 0건. | Playwright + RTL | P0 |
| QA-DSH-004 | 셀러 A 가 `running` 잡 1개 보유. mock 어댑터가 5초 후 success 응답. | `/dashboard` 마운트 후 5초 대기 | Realtime UPDATE 푸시 → "진행 중" 카드 1 → 0, "오늘 등록" +1, recent 리스트의 해당 잡 status badge `running` → `succeeded`. **수동 새로고침 없이.** | Playwright + Realtime mock | P0 |
| QA-DSH-005 | 셀러 A 의 `market_accounts` 중 스마트스토어 = `expired`. | `/dashboard` 진입 | "마켓 연결 상태" 카드의 expired 카운트 1 표시, 노란 색 토큰. 클릭 시 `/markets?filter=expired` 로 이동. | Playwright | P1 |
| QA-DSH-006 | RPC 가 503 반환 (네트워크 단절 mock). | `/dashboard` 진입 | summary 영역 `<ErrorMessage>` 노출, 재시도 버튼 동작. recent 가 503 이어도 summary 영역만 별도 에러. 한 카드의 에러가 다른 영역을 막지 않음. | Playwright + MSW | P1 |
| QA-DSH-007 | 셀러 A 의 잡 `partial` (스마트스토어 success, 쿠팡 failed_final). | `/dashboard` 진입 | recent row 에 `JobStatusBadge` = "일부 성공 (1/2)", 노란 색. 클릭 시 `/history/jobs/{id}` 진입. | Playwright | P0 |
| QA-DSH-008 | Realtime 채널 WebSocket 강제 종료. | 5초 후 | 상단 배너 "실시간 갱신 일시 중단됨" 노출, TanStack Query `refetchInterval` 30s 활성. 복구 시 배너 사라짐 + interval 해제. | Playwright (Supabase Realtime mock) | P1 |
| QA-DSH-009 | RPC 응답 중 한 필드 (`avg_duration_sec_7d`) 가 string `"abc"` (스키마 위반). | `/dashboard` 진입 | zod 검증 실패. Sentry `validation_failed` 이벤트 1건 발생 (path: avg_duration_sec_7d, 값 미포함). UI 는 error 상태로 폴백. | Vitest (zod) + Sentry mock | P1 |
| QA-DSH-010 | 색약 시뮬레이션 (deuteranopia). | 대시보드 전체 시각 검사 | `JobStatusBadge` 7종이 모두 의미 구분 가능 (아이콘 + 라벨로). 색만으로 구분되지 않는다. | 수동 (만료일 2026-08-31, 책임: designer) | P1 |
| QA-DSH-011 | 키보드만 사용. Tab 으로 순회. | dashboard 진입 후 Tab 반복 | "본문으로 건너뛰기" → 새로고침 → CTA → 잡 row 1 → ... 순. focus ring 명확. Enter 로 모든 인터랙티브 요소 활성화. | Playwright + axe | P0 |
| QA-DSH-012 | 30일 잡 0 + 24h 잡 1 (running). | summary 응답 검사 | `last_job_at != null`, `jobs_30d_count == 1`, 빈 상태 UI 노출 안 됨, 데이터 UI 노출. | Vitest | P1 |
| QA-DSH-013 | 모바일 viewport (375×667). | `/dashboard` 진입 | CTA 풀폭 sticky. 카드 2x2 그리드. 터치 타겟 ≥ 44×44px. recent row 가로 스크롤 없음 (텍스트 truncate). | Playwright (mobile) | P1 |
| QA-DSH-014 | 셀러 A 가 두 탭에서 동시에 `/dashboard` 진입 후 한 탭에서 새 잡 INSERT. | 두 번째 탭 5초 이내 관찰 | Realtime 으로 두 탭 모두 카드 +1, recent 리스트 새 row 추가. 별도 새로고침 없음. | Playwright (두 BrowserContext) | P1 |
| QA-DSH-015 | 마켓 5xx 시나리오 (testing.md §5 강제). 한 잡이 `partial` 로 종결. | recent 리스트 진입 | partial 잡 row 에 노란 배지 + "1/2 성공". raw error stack 은 노출 안 됨 (history 화면 책임). | Playwright | P0 |
| QA-DSH-016 | 마켓 4xx (검증) 시나리오. 한 잡이 `failed` 로 종결. | recent 리스트 | failed 배지 + 빨간 색 + 아이콘 + "실패" 라벨. 잡 row 클릭 시 history 상세로 진입. | Playwright | P1 |
| QA-DSH-017 | 마켓 429 시나리오. 잡이 `retrying` 상태 5초 유지. | recent 리스트 | `retrying` 배지 (회전 아이콘). prefers-reduced-motion 사용자는 정적 색 변경. | Playwright + RTL | P1 |
| QA-DSH-018 | 마켓 401 시나리오. refresh 실패 → `market_accounts.status='expired'`. | dashboard 진입 | 잡 결과 row 의 마켓 stack 에서 해당 마켓 아이콘 흐림 처리 + "재인증 필요" tooltip. 마켓 연결 상태 카드의 expired 카운트 +1. | Playwright | P0 |
| QA-DSH-019 | 네트워크 끊김 (브라우저 offline). | 새로고침 버튼 클릭 | "네트워크 확인" 토스트. 기존 데이터는 stale 한 채로 유지 (TanStack Query cache). 복구 시 자동 refetch. | Playwright (offline mode) | P1 |
| QA-DSH-020 | 같은 셀러가 두 탭에서 동일 product 로 동시 `RegistrationJob` 생성. | 한 쪽만 성공, 다른 쪽 충돌 | dashboard recent 리스트에 잡 1건만 노출 (UNIQUE 인덱스로 한 쪽 거부). | Playwright + DB constraint | P0 |

### 10.1 testing.md §5 강제 8종 매핑

| 분류 | 매핑 행 |
|---|---|
| 마켓 API 5xx | QA-DSH-015 (recent row 표시 측면) |
| 마켓 API 4xx | QA-DSH-016 |
| 마켓 API 429 | QA-DSH-017 |
| 마켓 API 401 | QA-DSH-018 |
| 부분 실패 | QA-DSH-007 |
| 네트워크 끊김 | QA-DSH-019 |
| 동시 입력 충돌 | QA-DSH-020 |
| 권한 누수 (RLS) | QA-DSH-001 / QA-DSH-002 |

8종 모두 1행 이상 포함. testing.md §5 거부 룰 통과.

---

## 11. 수락 기준 체크리스트

- [ ] `seller_dashboard_summary` view 가 `security_invoker = on` 으로 정의되어 있다 (DDL 코드 리뷰 + `\d+` 출력 확인).
- [ ] `seller_recent_jobs` view 가 동상.
- [ ] view 위에 RLS 정책 추가 0개 (view 는 정책 안 받음. 하위 테이블 RLS 가 책임).
- [ ] `rpc_get_dashboard_summary` / `rpc_get_recent_jobs` 가 `SECURITY INVOKER` 로 정의.
- [ ] zod 스키마 (`DashboardSummarySchema` / `RecentJobSchema`) 가 RPC 응답과 1:1 일치 (마이그레이션 PR 에서 동시 갱신).
- [ ] Realtime 채널 1개로 `registration_jobs` + `registration_job_market_results` 둘 다 구독.
- [ ] Realtime 끊김 → 30s 폴백 동작 확인.
- [ ] 빈 상태 UI 노출 (셀러 잡 0건 + 마켓 연결 0건 / 마켓 연결 있음 두 분기).
- [ ] `JobStatusBadge` 7종 모두 색 + 아이콘 + 라벨 3중.
- [ ] axe-core 위반 0건 (CI).
- [ ] 키보드만으로 모든 인터랙티브 요소 도달.
- [ ] 모바일 viewport 에서 터치 타겟 ≥ 44px.
- [ ] zod 검증 실패 시 Sentry 이벤트가 값 없이 path 만 전송 (security.md §sentry-mask 검증).
- [ ] 마켓 토큰 / 이메일 / 전화번호 / raw error_message 가 어떤 응답에도 포함되지 않음 (네트워크 탭 검사).
- [ ] view 컬럼명/타입이 본 문서와 SQL 마이그레이션과 zod 스키마 3곳에서 일치.
- [ ] `prefers-reduced-motion` 환경에서 회전 아이콘 미동작.
- [ ] testing.md §5 의 8종 시나리오 매트릭스 행이 모두 존재.

---

## 12. 미해결 사안

| ID | 사안 | 결정 시점 | 영향 |
|---|---|---|---|
| OPEN-DSH-001 | 마켓별 통계 위젯 (n11) 의 v2 구체 사양 — 마켓당 등록 건수 / 성공률 / 평균 소요? 기간 비교? | v2 기획 시작 시 (현재 미정) | placeholder 유지 |
| OPEN-DSH-002 | `seller_recent_jobs` view 의 `products LEFT JOIN` 컬럼 (product_name, product_thumbnail_url) 이 v2 의 큰 썸네일 갤러리 모드를 견디는지. materialized view 전환 시점. | 평균 응답 200ms / P95 500ms 초과 시 | 성능 |
| OPEN-DSH-003 | 시간대 `Asia/Seoul` 하드코딩. 사용자별 timezone 설정 도입 시점. | 다국가 진출 검토 시점 | i18n |
| OPEN-DSH-004 | KPI 측정용 `events` 테이블 (CLAUDE.md §KPI 측정) 에서 "대시보드 진입" 이벤트를 기록할지. 기록 시 이벤트명 / payload 합의 필요. | events 테이블 도입 시 (현재 미정) | 분석 |
| OPEN-DSH-005 | 새로고침 버튼이 명시적이어야 하는지 — Realtime 정상 동작 중에는 숨기는 안 vs 항상 노출. 본 문서는 "항상 노출". UX 검증 데이터로 재결정. | v1 베타 출시 후 1개월 | UX |
| OPEN-DSH-006 | 진행 중 잡이 많을 때 (예: 50개 동시) recent 리스트의 마켓 stack 폭이 모바일에서 가로 스크롤 발생 여부. 현재 가정: 잡당 마켓 ≤ 5. 6 이상 시 +N 인디케이터. | 마켓 6번째 어댑터 추가 시 | UI |

---

## 13. 3개 산출물 동기화

본 설계 적용 시 함께 갱신해야 하는 산출물.

| 산출물 | 갱신 대상 |
|---|---|
| 설계문서 | 본 파일 (`docs/architecture/v1/features/dashboard.md`) — 본 PR 의 결과물 |
| HTML 프로토타입 | `docs/frontend_html_design/v1/dashboard/` (신설). prototype/ v0 의 `screens/dashboard.jsx` 를 토큰 정합화하여 이식 |
| 실제 구현 | `apps/web/src/features/dashboard/` (pages/DashboardPage.tsx / hooks/useDashboard.ts / hooks/useDashboardRealtime.ts / components/SummaryCard.tsx / components/RecentJobsList.tsx / components/JobStatusBadge.tsx / api/rpc.ts), `apps/web/src/lib/schemas/dashboard.ts`, `apps/api/supabase/migrations/20260518_dashboard_views.sql` |

CLAUDE.md "3개 산출물 동기화" 규칙. 변경 시 매번 3개 동시 갱신.

---

## 14. 보안 검수 요청

다음 항목은 **security 에이전트의 명시적 승인 후** 머지한다.

1. `seller_dashboard_summary` / `seller_recent_jobs` view 가 `security_invoker = on` 인지 (RLS 우회 가능성).
2. `rpc_get_dashboard_summary` / `rpc_get_recent_jobs` 가 `SECURITY INVOKER` 인지 (definer 면 거부).
3. Realtime payload 에 다른 셀러의 row 가 새는지 — `registration_jobs` 는 `seller_id` 필터 가능, `registration_job_market_results` 는 컬럼 없음 → RLS 단독 의존. 실제 푸시 packet 을 다른 셀러 토큰으로 receive 시도해서 0건 확인.
4. RPC 응답에 토큰/PII/raw error_message 미포함 확인.
5. Sentry `beforeSend` 가 `RecentJob.markets[].error_code` 만 통과시키고 나머지 raw 필드 마스킹하는지.

승인 게이트 통과 전 머지 금지.
