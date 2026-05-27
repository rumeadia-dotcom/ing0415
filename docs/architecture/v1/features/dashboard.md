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

s1 인증을 통과한 셀러가 가장 먼저 보는 화면. 다음 4가지를 한 화면에서 제공한다.

1. 등록 활동 한눈에 — "오늘 몇 건 등록했고, 진행 중인 잡이 몇 개고, 성공률이 얼마인가." (요약 카드)
2. **마켓별 주문 현황** — "어느 마켓에 신규 주문이 몇 건 들어왔고, 동기화는 정상인가." (v1 정식 5 마켓 전부)
3. 마켓 연결 건강 상태 — "토큰이 만료된 마켓이 있는지." (markets.md 인용)
4. 다음 행동 유도 — "상품 등록 시작" CTA.

> **2026-05 디자인 리뉴얼 결정**: 기존 "최근 등록 잡 리스트" 위젯은 **제거**되었다. 등록 잡 이력은 s6 등록 이력 (`/history`) 으로 일원화하고, 대시보드 본문 위젯 자리는 셀러가 매일 가장 먼저 확인해야 하는 **마켓별 주문 현황** 으로 교체. 결정 근거: `docs/design-renewal/s2-dashboard.md` §3.4 / §6.3. user_flow n12 (최근 등록 내역) 는 위젯 의미를 "마켓별 주문 현황" 으로 재해석.

### 1.2 v1 범위

| 구분 | 포함 (v1) | 제외 (v2+) |
|---|---|---|
| 요약 카드 | 오늘 등록 / 진행 중 / 7일 성공률 / 평균 소요 | 마켓별 KPI, 기간 비교(증감률) |
| 마켓별 주문 현황 | 5 마켓 (네이버 / 쿠팡 / G마켓 / 옥션 / 11번가) 카드. 신규 주문 카운트 + 오늘 총합 + 동기화 상태 + 마지막 sync 시각 | 마켓별 매출, 기간 비교, 채널 광고 KPI |
| 마켓 연결 상태 | active / expired / error 요약 (markets.md 인용) | 마켓별 상세 통계, OAuth 재인증 인라인 흐름 (마켓 페이지로 보냄) |
| Realtime 갱신 | `orders` INSERT/UPDATE/DELETE + `market_accounts` UPDATE (둘 다 본 화면이 직접 구독) | — |
| CTA | "상품 등록 시작" (n9 → n15) | 템플릿에서 시작 (s4, v2) |
| **제거** | ~~최근 등록 잡 리스트 (v1 초기 설계에 있었음)~~ → s6 `/history` 로 이관 | — |

### 1.3 user_flow 매핑

`user_flow.md` s2 의 노드/엣지 중 본 문서가 책임지는 것:

| 노드 | 의미 | v1 / v2 |
|---|---|---|
| n9 | 대시보드 진입 (s1 인증 성공 후) | v1 |
| n10 | 등록 현황 요약 위젯 (KPI 4카드) | **v1** |
| n11 | 마켓별 통계 위젯 | **v2** (현재 자리는 마켓별 주문 현황이 차지) |
| n12 | 최근 등록 내역 리스트 → **(리뉴얼) 마켓별 주문 현황 위젯** 으로 의미 재해석 | **v1** (실 위젯은 주문 현황) |
| n13 | 최근 잡 → 등록 이력 상세 진입 | v1 (단, 진입 경로는 사이드바 / s6 `/history` 직접 이동. 대시보드 내 리스트는 없음) |
| n14 | 새로고침 (수동) | v1 (Realtime 보조용, 명시적 버튼) |

n11 (마켓별 등록 통계) 는 v1 에서 별도 위젯을 두지 않는다 — 본 화면의 "마켓별 주문 현황" 이 운영상 더 자주 확인되는 지표이며, 등록 통계는 s6 `/history` 의 통계 탭에서 제공. 매출/광고 KPI 등 v2 마켓별 통계가 추가될 시점에 본 화면 그리드에 합류 검토.

### 1.4 라우트

| 경로 | 화면 | 인증 |
|---|---|---|
| `/dashboard` | 본 문서가 정의 (s2 메인) | 필수 (s1) |
| `/dashboard?refresh=1` | 수동 새로고침 표시 (URL 변경 후 자동 invalidate, 1회성) | 필수 |

`/dashboard` 는 사이드바 첫 항목 · s1 로그인 성공 후 default redirect. URL search params 는 zod 로 검증 (`refresh` 는 `'1' | undefined`).

---

## 2. 데이터 모델 (view 합성)

**신규 테이블 없음.** 기존 테이블 위에 계산 view 1개 (`seller_dashboard_summary`) 를 정의하고, 마켓별 주문 현황은 **이미 존재하는** `orders_with_dispatch_summary` view + `orders` / `market_accounts` 테이블 SELECT 3개를 클라이언트가 합성한다 (별도 RPC 없음 — §3.3 참조).

| view | 입력 테이블 | 용도 | 정의처 |
|---|---|---|---|
| `seller_dashboard_summary` | `registration_jobs` | KPI 4 카드의 숫자 | 본 문서 §2.2 |
| `orders_with_dispatch_summary` | `orders` + 배송 도메인 (s7) | `by_market` jsonb → 마켓별 신규/pending 카운트 | 인용. 정의처: `docs/architecture/v1/features/orders.md` |

`market_accounts` 의 상태 요약은 별도 view 를 만들지 않는다. markets.md 가 정의한 `market_accounts` 를 클라이언트가 RLS 로 직접 SELECT 한 뒤 프론트에서 `groupBy(status)` 한다 (테이블 row 수 적음, 셀러당 ≤ 10).

> **deprecated**: 이전 설계의 `seller_recent_jobs` view 는 **삭제**되었다 (2026-05 리뉴얼). 등록 잡 최근 N건 조회 책임은 s6 `/history` 단독. 본 화면이 위 view 에 의존하지 않으므로 마이그레이션은 `DROP VIEW IF EXISTS public.seller_recent_jobs;` 동반.

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

### 2.3 (삭제) `seller_recent_jobs` view

**삭제됨 (2026-05 리뉴얼).** 본 화면이 등록 잡 리스트 위젯을 더 이상 노출하지 않으므로 view 를 폐기. 마이그레이션:

```sql
DROP VIEW IF EXISTS public.seller_recent_jobs;
```

s6 `/history` 가 등록 잡 조회를 단독 책임. 동일 형태의 잡 리스트가 다시 필요해지면 그 시점에 `features/history.md` 단독 view 로 재정의 (대시보드 의존 없이).

### 2.4 view RLS 검증 (보안 핵심)

`security_invoker = on` 의 효과는 SQL 테스트로 매 마이그레이션 검증한다.

```sql
-- 테스트: 셀러 B 가 셀러 A 의 row 를 못 봄
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '<seller_B_uuid>';
SELECT count(*) FROM public.seller_dashboard_summary
WHERE seller_id = '<seller_A_uuid>';
-- 기대: 0
-- 주문 / 마켓 계정도 동일 RLS 적용 (orders.md / markets.md 에서 정의).
SELECT count(*) FROM public.orders
WHERE seller_id = '<seller_A_uuid>';
-- 기대: 0
SELECT count(*) FROM public.market_accounts
WHERE seller_id = '<seller_A_uuid>';
-- 기대: 0
```

자동화: `RLS-SQL` 카테고리로 testing.md §3 의 RLS 격리 테스트 슈트에 포함 (아래 QA 매트릭스 QA-DSH-001 ~ 002).

---

## 3. API · RPC

### 3.1 결정: view 직접 SELECT vs RPC (위젯별 분리)

위젯별로 트레이드오프가 다르다. v1 결정:

| 위젯 | 방식 | 근거 |
|---|---|---|
| KPI 요약 카드 | **RPC `rpc_get_dashboard_summary()`** (SECURITY INVOKER) | 14 필드 단일 row 응답. zod 와 1:1 매칭. PL/pgSQL `RETURNS TABLE` 로 응답 shape 고정. |
| 마켓별 주문 현황 | **클라이언트 합성 (PostgREST view + 2 테이블 SELECT)** | 3개 데이터 소스의 단순 조합. 마켓 카드 4개 × 필드 6개로 응답 작음. RPC 신설보다 코드 비용 낮음. 합성 로직은 `apps/web/src/features/dashboard/api/dashboard-api.ts` 단일 파일. |
| 마켓 연결 상태 | **PostgREST 직접 SELECT** (`market_accounts`) | 셀러당 ≤ 10 row, 상태 컬럼 1개. RPC 불필요. |

근거:

1. KPI 요약은 14 필드 응답이 PostgREST 자동 컬럼 변경에 취약 → RPC 로 고정.
2. 마켓별 주문 현황은 v1 기간에 view/테이블 컬럼 변경이 빈번할 수 있음 (s7 배송 도메인이 동시 발전). 클라이언트 합성으로 두면 view 컬럼 추가 시 zod schema 만 갱신.
3. 데이터 fetch 횟수가 늘어도 (3회 → 4회) 셀러당 row 수가 작아 ms 단위 부하. TanStack Query 가 합쳐서 단일 `dashboardKeys.marketOrders()` 캐시 키로 캐싱.

> **2026-05 결정 변경**: 이전 설계의 `rpc_get_recent_jobs(p_limit)` RPC 는 **삭제**. 본 화면이 등록 잡 리스트를 노출하지 않으므로 RPC 자체를 마이그레이션에서 `DROP FUNCTION IF EXISTS public.rpc_get_recent_jobs(int);` 로 폐기.

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

### 3.3 `fetchMarketOrdersSummary()` 조립 로직 (클라이언트 합성, RPC 없음)

마켓별 주문 현황 위젯의 데이터 fetcher. **백엔드 RPC 를 추가하지 않는다.** 정의처: `apps/web/src/features/dashboard/api/dashboard-api.ts`.

**시그니처:**

```ts
export async function fetchMarketOrdersSummary(): Promise<MarketOrdersSummary>;
```

`MarketOrdersSummary` 는 `apps/web/src/lib/schemas/dashboard-summary.ts` 의 zod schema (§3.4 참조). 모든 SELECT 결과는 zod parse 통과 후 도메인 객체로 반환.

**조립 단계 (모두 RLS 통과 — 셀러 본인 row 만 도착):**

| 단계 | 데이터 소스 | 쿼리 | 산출 |
|---|---|---|---|
| 1 | `orders_with_dispatch_summary` view (s7 정의, security_invoker) | `.from('orders_with_dispatch_summary').select('by_market').maybeSingle()` | `by_market` jsonb 배열 → 마켓별 `newOrdersCount` map |
| 2 | `orders` 테이블 | `.from('orders').select('market_id').gte('collected_at', startOfTodayKstIso())` | 오늘 0시(KST) 이후 마켓별 row 카운트 → `todayTotalCount` map |
| 3 | `market_accounts` 테이블 | `.from('market_accounts').select('market_id, status, last_verified_at, last_error_code')` | 마켓별 `syncStatus` / `lastSyncedAt` / `syncError` map + 행 존재 여부 → `connected` |
| 4 | (메모리 합성) | `V1_MARKETS` 순회 | `MarketOrderItem` (마켓당 1개) + `comingSoon` |

**한 마켓 ↔ 여러 계정 합산 규칙:**

- `connected`: 해당 마켓의 `market_accounts` 행이 1개 이상 존재하면 `true`. 셀러가 아직 연동하지 않은 마켓은 `false` (status=expired/revoked/error 는 *연동됨 + 재인증 필요* 이므로 `connected:true` + `syncStatus:'error'`). `connected:false` 행은 위젯에서 비활성(dim) row + "연결하기" 유도로 렌더 (주문 목록 click-through 없음).
- `syncStatus`: 더 심각한 상태 우선 (`error > expired > revoked > active`). 코드상 `account.status === 'active'` → `'idle'`, 그 외 → `'error'`.
- `lastSyncedAt`: 같은 syncStatus 안에서는 MAX (가장 최근). 심각도 다르면 더 심각한 쪽의 timestamp 채택.

**`startOfTodayKstIso()`:** 클라이언트에서 KST(UTC+9) 자정의 ISO 8601 (+09:00 offset 포함) 문자열 계산. orders.collected_at 이 timestamptz 라 KST offset 비교 가능. summary view 와 시간대 일치 유지 (`Asia/Seoul`).

**에러 정책:** 3개 fetch 중 하나라도 5xx/네트워크 오류 → `throw`. UI 는 `MarketOrdersSummaryCard` 의 `state='error'` 로 표시 (다른 위젯은 영향 없음, TanStack Query 의 독립 쿼리). 부분 성공 시나리오는 없음 — 세 SELECT 가 모두 성공해야 의미 있는 카드 4개 합성 가능.

**RLS 의존성:** 세 소스 모두 `seller_id` 컬럼 기반 RLS (orders.md / markets.md). 클라이언트가 `eq('seller_id', uid)` 를 명시하지 않아도 RLS 가 본인 row 만 반환. 단, 인덱스 활용을 위해 향후 명시 검토 (OPEN-DSH-007).

**호출 패턴 (TypeScript):**

```ts
import { fetchMarketOrdersSummary } from '@/features/dashboard/api/dashboard-api';

const { data, isLoading, error } = useQuery({
  queryKey: dashboardQueryKeys.marketOrders(),
  queryFn: fetchMarketOrdersSummary,
  staleTime: 15_000,
  enabled: !!sellerId,
});
```

### 3.4 zod 스키마 (`apps/web/src/lib/schemas/dashboard-summary.ts`)

> **`RegistrationJobStatusSchema` / `MarketResultStatusSchema` / `MarketIdSchema` 는 본 모듈에서 정의하지 않는다.** schema 정의는 `apps/web/src/lib/schemas/registration.ts` + `apps/web/src/lib/schemas/common.ts` 단일 소스. 본 모듈은 `import` 해서 재사용만 한다.

본 모듈이 정의/export 하는 스키마:

| 스키마 | 용도 | 비고 |
|---|---|---|
| `DashboardSummarySchema` | `rpc_get_dashboard_summary()` 응답 | 14 필드 단일 row |
| `MarketHealthSchema` | `market_accounts` SELECT + groupBy 결과 | active / expired / revoked / error / total |
| `MarketOrdersSummarySchema` | `fetchMarketOrdersSummary()` 합성 결과 | **신규 (2026-05)** |
| `MarketOrderItemSchema` | 마켓 카드 1개 | **신규 (2026-05)** |
| `MarketOrderSyncStatusSchema` | `'idle' | 'syncing' | 'error'` | **신규 (2026-05)** |

> **deprecated (제거 완료)**: `RecentJobSchema`, `RecentJobMarketSchema`, `RecentJobsResponseSchema` 는 `seller_recent_jobs` view 폐기와 함께 삭제. 등록 잡 시리얼라이즈가 다시 필요하면 `features/history.md` 단독 schema 로 재정의.

```ts
import { z } from 'zod';
import { MarketIdSchema } from '@/lib/schemas/common';
import {
  RegistrationJobStatusSchema,
  MarketResultStatusSchema,
} from '@/lib/schemas/registration';

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
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;

export const MarketHealthSchema = z.object({
  active: z.number().int().nonnegative(),
  expired: z.number().int().nonnegative(),
  revoked: z.number().int().nonnegative(),
  error: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
export type MarketHealth = z.infer<typeof MarketHealthSchema>;

// 마켓별 주문 현황 (s2 위젯, 클라이언트 합성)
export const MarketOrderSyncStatusSchema = z.enum(['idle', 'syncing', 'error']);
export type MarketOrderSyncStatus = z.infer<typeof MarketOrderSyncStatusSchema>;

export const MarketOrderItemSchema = z.object({
  marketId: MarketIdSchema,
  connected: z.boolean(), // market_accounts 행 존재 여부. false = 미연동 → 위젯 비활성 row
  newOrdersCount: z.number().int().nonnegative(),
  todayTotalCount: z.number().int().nonnegative(),
  lastSyncedAt: z.string().datetime({ offset: true }).nullable(),
  syncStatus: MarketOrderSyncStatusSchema,
  syncError: z.string().nullable(),
});
export type MarketOrderItem = z.infer<typeof MarketOrderItemSchema>;

export const MarketOrdersSummarySchema = z.object({
  markets: z.array(MarketOrderItemSchema),
  comingSoon: z.array(MarketIdSchema),
});
export type MarketOrdersSummary = z.infer<typeof MarketOrdersSummarySchema>;
```

**필드 명명 규약:**

- `DashboardSummarySchema` 와 `MarketHealthSchema` 는 DB view / SELECT 결과를 직접 받으므로 **snake_case** (DB 컬럼명 그대로).
- `MarketOrdersSummarySchema` / `MarketOrderItemSchema` 는 클라이언트 합성 산출물이라 **camelCase** (도메인 객체).

zod 는 모든 fetcher 응답에 즉시 `parse()` — 실패 시 throw → TanStack Query error 상태. Sentry 의 `beforeSend` 가 필드 path 만 남기고 값 마스킹 (security.md §sentry-mask 인용).

### 3.5 TanStack Query 키 규약

`frontend.md` §Query Key 규약 (`[domain, ...filters]`) 을 따른다. 실제 정의처: `apps/web/src/features/dashboard/api/dashboard-api.ts`.

```ts
export const dashboardQueryKeys = {
  all: ['dashboard'] as const,
  summary:      () => ['dashboard', 'summary']       as const,
  marketOrders: () => ['dashboard', 'market-orders'] as const,
  marketHealth: () => ['dashboard', 'market-health'] as const,
};
```

| 키 | 사용 hook | fetcher |
|---|---|---|
| `dashboardQueryKeys.summary()` | `useDashboardSummary` | `fetchDashboardSummary` (`rpc_get_dashboard_summary().maybeSingle()`) |
| `dashboardQueryKeys.marketOrders()` | `useMarketOrdersSummary` | `fetchMarketOrdersSummary` (3 소스 합성) |
| `dashboardQueryKeys.marketHealth()` | `useMarketHealth` | `fetchMarketHealth` (`market_accounts` SELECT) |

> **deprecated**: 이전 설계의 `dashboardKeys.recent(limit)` 는 **제거**. `seller_recent_jobs` view / `RecentJob` schema 삭제와 함께 사라짐.

**`fetchDashboardSummary` 의 null 처리** (등록 잡 0건): `.maybeSingle()` 가 `null` 반환 시 `fetchDashboardSummary()` 도 `null` 반환. 컴포넌트는 `data === null` 분기로 KPI 카드에 0/— 표시. 빈 상태 hero 분기는 §6 / §5.3 참조 — `last_job_at === null` AND 마켓 0건 / 또는 마켓 있음, 두 갈래.

---

## 4. Realtime 갱신 (PRD §4.1.1 "별도 새로고침 없이 최신 정보")

### 4.1 구독 채널 (위젯별 분리)

위젯이 의존하는 테이블이 달라 채널을 위젯별로 분리한다. KPI 요약은 `registration_jobs` 만, 마켓별 주문 현황은 `orders` + `market_accounts` 두 채널.

**KPI 요약 — `useDashboardRealtime` (또는 `useDashboardSummary` 내부)**:

```ts
supabase
  .channel(`dashboard_summary:${sellerId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'registration_jobs',
    filter: `seller_id=eq.${sellerId}`,
  }, () => {
    queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.summary() });
  })
  .subscribe();
```

**마켓별 주문 현황 — `useMarketOrdersSummary`** (2 채널):

```ts
// 채널 1: orders INSERT/UPDATE/DELETE → newOrdersCount / todayTotalCount 변동
supabase
  .channel(`dashboard_market_orders_orders:${sellerId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'orders',
    filter: `seller_id=eq.${sellerId}`,
  }, () => {
    queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.marketOrders() });
  })
  .subscribe();

// 채널 2: market_accounts UPDATE → syncStatus / lastSyncedAt 변동
supabase
  .channel(`dashboard_market_orders_accounts:${sellerId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'market_accounts',
    filter: `seller_id=eq.${sellerId}`,
  }, () => {
    queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.marketOrders() });
  })
  .subscribe();
```

**핵심 결정:**

- `registration_jobs` 변경은 **summary 만 invalidate** — 본 화면이 더 이상 잡 리스트를 노출하지 않으므로 marketOrders 캐시는 건드릴 필요 없음.
- `orders` 변경은 **marketOrders 만 invalidate** — KPI 4 카드는 잡 기반이라 주문 변동과 무관.
- `market_accounts` 변경은 **marketOrders 만 invalidate** — markets.md 의 자체 Realtime hook 이 마켓 헬스 카드를 별도 invalidate (s5 단독 책임). 본 화면에서는 syncStatus 노출용으로만 구독.
- 채널을 3개로 늘렸지만 셀러당 동시 연결 한도(Supabase 기본 100)에 비해 무의미한 비용. 위젯 독립성이 더 중요.
- 모든 채널이 `seller_id=eq.<sellerId>` 필터 + RLS 이중 보호.

> **deprecated**: 이전 설계의 `registration_job_market_results` 채널은 본 화면에서 **삭제**. 잡 마켓 결과 변동은 s6 `/history` 가 단독 구독.

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

SummaryGrid  (KPI 4 카드)
  ├ Card "오늘 등록"            value=jobs_today_count    icon=Calendar
  ├ Card "진행 중"              value=jobs_in_progress    icon=Loader (회전 — 진행 중 > 0 일 때만)
  ├ Card "7일 성공률"           value=successRate7d %      icon=TrendingUp
  └ Card "평균 등록 소요"       value=fmtDuration(7d avg)  icon=Clock

TwoColumnSection
  ├ LeftCol (8 cols on desktop, 12 on mobile)
  │   MarketOrdersSummaryCard  (v1 위젯, design-renewal/s2-dashboard.md §3.4)
  │     ├ Header "마켓별 주문 현황"  (오른쪽: "전체 보기 →" → /orders)
  │     └ Grid: MarketOrderItemCard × 5 (네이버 / 쿠팡 / G마켓 / 옥션 / 11번가)
  │         item:
  │           ├ 좌측 컬러바 (브랜드 색)
  │           ├ 색상 도트 + 마켓명
  │           ├ newOrdersCount (28px tabular-nums) + "신규" + "오늘 N건"
  │           ├ SyncBadge (정상 / 동기화 중 / 오류)
  │           ├ "최근 동기화 X분 전" 또는 "연결 오류 — 재인증 필요"
  │           └ 클릭: 정상 → /orders/list?market=<id>, 오류 → /markets
  │
  └ RightCol (4 cols on desktop, 12 on mobile)
      └ Card "마켓 연결 상태" (markets.md 인용)
          ├ active 수 / expired 수 / error 수 + 각 색
          └ "마켓 관리 →" → /markets
```

> **2026-05 리뉴얼**: 이전 설계의 LeftCol "최근 등록" 카드와 RightCol "마켓별 통계 (v2 placeholder)" 카드는 모두 **제거**. LeftCol 은 마켓별 주문 현황이 차지하고, v2 마켓 통계는 매출/광고 KPI 가 명세될 때 그리드 재배치 검토.

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
│ │ 🛍 마켓별 주문 현황   [전체 보기 →]      │ │ 마켓 연결 상태       │  │
│ ├─────────────────────────────────────────┤ │ ● 활성  4            │  │
│ │ ┌──────────────┐  ┌──────────────┐      │ │ ▲ 만료  0            │  │
│ │ │ ● 네이버  ✓  │  │ ● 쿠팡    ✓  │      │ │ ▼ 오류  0            │  │
│ │ │   12 신규    │  │   3 신규     │      │ │ [마켓 관리 →]        │  │
│ │ │   오늘 18건  │  │   오늘 5건   │      │ │                       │  │
│ │ │   3분 전     │  │   12분 전    │      │ │                       │  │
│ │ └──────────────┘  └──────────────┘      │ │                       │  │
│ │ ┌──────────────┐  ┌──────────────┐      │ │                       │  │
│ │ │ ● G마켓   ⚠  │  │ ● 옥션    ✓  │      │ │                       │  │
│ │ │   연결 오류  │  │   0 신규     │      │ │                       │  │
│ │ │   재인증 필요│  │   오늘 0건   │      │ │                       │  │
│ │ └──────────────┘  └──────────────┘      │ │                       │  │
│ │ ┌──────────────┐                        │ │                       │  │
│ │ │ ● 11번가  ✓  │                        │ │                       │  │
│ │ │   2 신규     │                        │ │                       │  │
│ │ │   오늘 4건   │                        │ │                       │  │
│ │ └──────────────┘                        │ │                       │  │
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
│ │ 🛍 마켓별 주문 현황          [전체 보기 →]       │ │
│ │ (마켓 카드 × 5)                                   │ │
│ └──────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────┐ │
│ │ 마켓 연결 상태                                    │ │
│ └──────────────────────────────────────────────────┘ │
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
│ 🛍 마켓별 주문 현황 [전체→]│
│ ──────────────────────────  │
│ ┌────────┐ ┌────────┐      │
│ │● 네이버 │ │● 쿠팡   │      │
│ │ 12 신규│ │  3 신규│      │
│ └────────┘ └────────┘      │
│ ┌────────┐ ┌────────┐      │
│ │● G마켓⚠│ │● 옥션  │      │
│ │재인증  │ │ 0 신규 │      │
│ └────────┘ └────────┘      │
│ ┌────────┐                 │
│ │●11번가 │                 │
│ │ 2 신규 │                 │
│ └────────┘                 │
├────────────────────────────┤
│ 마켓 연결 ● 활성 4  ▲ 0 ▼ 0│
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

#### 5.2.2 MarketOrdersSummaryCard (컨테이너)

`apps/web/src/features/dashboard/components/MarketOrdersSummaryCard.tsx`.

| Prop | 타입 | 비고 |
|---|---|---|
| `state` | `'loading' \| 'data' \| 'error' \| 'empty'` | 4상태 + (empty 는 마켓 0건 가이드용) |
| `data` | `MarketOrdersSummary \| undefined` | zod parse 통과 산출물 |
| `errorMessage` | `string \| undefined` | `<ErrorMessage>` 단문 노출 |
| `hasNoConnectedMarkets` | `boolean` | 마켓 0건 시 하단 안내 + `/markets` 링크 강조 |

구성:

- Header: 제목 "마켓별 주문 현황" + 우상단 "전체 보기 →" (→ `/orders`)
- Loading: 5 카드 grid skeleton
- Error: `role="alert"` + `<ErrorMessage details>` (raw 메시지 접힘)
- Data/Empty: 마켓 카드 grid × 5 (네이버 / 쿠팡 / G마켓 / 옥션 / 11번가 전부 정식 활성)
- Empty 보조 가이드: `hasNoConnectedMarkets === true` 시 "마켓 연결하기 →" 안내 박스 노출

#### 5.2.3 MarketOrderItemCard (단일 마켓 카드)

`apps/web/src/features/dashboard/components/MarketOrderItemCard.tsx`.

| 시각 hierarchy | 데이터 | 비고 |
|---|---|---|
| 좌측 컬러바 (1px × 100%) | 마켓 brand color (`BRAND_COLOR[marketId]`) | 오류 시 컬러바 색 제거, border-danger |
| 색상 도트 + 마켓명 | `marketId` → `ko.market[marketId]` | i18n 사전 참조 |
| 신규 주문 (28px tabular-nums) | `item.newOrdersCount` | 0건 시 `text-text-tertiary` + 카드 opacity 75 |
| 오늘 총합 | `item.todayTotalCount` | "오늘 N건" 보조 텍스트 |
| SyncBadge | `item.syncStatus` (`idle`/`syncing`/`error`) | 색 + 아이콘 + 라벨 3중 |
| 동기화 시각 | `item.lastSyncedAt` | `formatRelativeShort()` ("방금" / "N분 전" / "N시간 전" / "N일 전") |
| 오류 안내 | `syncStatus === 'error'` | "연결 오류 — 재인증 필요" 우선 표시 |

**클릭 동선:**

| 상태 | 링크 |
|---|---|
| 정상 / 신규 0건 | `/orders/list?market=<marketId>` (s7 OrdersListPage) |
| 오류 (`syncStatus === 'error'`) | `/markets` (재인증 유도) |

`MarketId` brand color 표 (markets.md §7.2 표준 인용):

| marketId | color |
|---|---|
| `naver` | `#03C75A` |
| `coupang` | `#F11F44` |
| `gmarket` | `#00B147` |
| `auction` | `#E73936` |
| `11st` | `#FF0038` |

#### 5.2.4 SyncBadge (MarketOrderItemCard 내부)

`syncStatus` 3종을 색 + 아이콘 + 한국어 라벨 3중으로 표현.

| status | 아이콘 | 색 토큰 | 라벨 |
|---|---|---|---|
| `idle` | CheckCircle2 | `--badge-success` (`bg-success-soft text-success-on-soft`) | 정상 |
| `syncing` | Loader2 (회전, `animate-spin`) | `--badge-info` (`bg-info-soft text-info-on-soft`) | 동기화 중 |
| `error` | AlertCircle | `--badge-danger` (`bg-danger-soft text-danger`) | 오류 |

색 대비 4.5:1 이상 (ui-system.md 토큰 검수). 색약 대응: 아이콘 + 라벨 동반 필수, color-only 표현 금지. `prefers-reduced-motion: reduce` 시 `syncing` 의 회전 정지 (§9.5).

> **deprecated**: 이전 설계의 `JobStatusBadge` (잡 상태 7종) 는 본 화면에서 **제거**. 잡 상태 시각화는 s6 `/history` 가 단독 책임.

#### 5.2.5 MarketConnectionStatusCard

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

> **제거**: 이전 설계의 `MarketStatsV2Placeholder` 카드는 그리드에서 **삭제**. v2 마켓 통계 (매출/광고 KPI) 가 명세될 때 별도 위젯으로 재배치.

### 5.3 빈 상태 (0건 셀러, 2 분기)

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

**빈 상태 우선순위 (s2-dashboard.md §6.2):**

1. **`no-markets`** (`marketHealth.total === 0`) — **최우선 분기**. 마켓 연결이 없으면 등록도 주문도 시작 불가. "마켓 연결하기 →" 를 hero CTA 로 (`/markets`). "상품 등록 시작" 은 보조 링크.
2. **`no-activity`** (`marketHealth.total > 0` AND `summary.last_job_at === null` AND 모든 마켓의 `newOrdersCount + todayTotalCount === 0`) — 마켓은 있으나 활동 없음. "첫 상품 등록 시작 →" 를 hero CTA 로 (`/register`).

판정 변수는 `useDashboardSummary` + `useMarketOrdersSummary` + `useMarketHealth` 세 hook 의 data 가 모두 도착한 시점에 계산. 어느 하나가 loading 이면 빈 상태 분기 보류 (KPI 카드 영역은 skeleton).

KPI 4 카드는 **빈 상태에서도 유지** (모두 0 또는 — 표시). hero 영역만 본문 위젯을 가린다.

> **변경 (이전 설계 대비)**: 이전 설계는 `last_job_at === null` 단일 분기였다. 리뉴얼 후 **2 분기 (no-markets 우선 / no-activity)** 로 확장 — 마켓 0건 셀러가 잘못된 CTA 를 보지 않도록.

---

## 6. 상태 처리 (4상태, 위젯별 독립)

frontend.md "4상태" 규칙을 위젯별로 적용한다 — 한 위젯의 에러가 다른 위젯을 막지 않는다.

| 위젯 | `loading` | `data` | `error` | `empty` |
|---|---|---|---|---|
| KPI 4 카드 | 회색 펄스 4개 | RPC 성공 | `<ErrorMessage>` + 재시도. 다른 위젯은 정상. | `last_job_at === null` → 0/— 표시 (카드는 유지) |
| MarketOrdersSummaryCard | 5 카드 skeleton | 5 마켓 카드 (네이버 / 쿠팡 / G마켓 / 옥션 / 11번가) | 컨테이너 단문 에러 (role=alert) — 다른 위젯에 영향 없음. raw 메시지는 접힘 | `markets[].newOrdersCount + todayTotalCount === 0` 전체일 때: 신규 없음 회색 표시 + (마켓 0건 시) 마켓 연결 안내 |
| MarketOrderItemCard (개별) | 컨테이너 skeleton 안에 포함 | 카운트 + sync 배지 정상 | 컨테이너가 일괄 처리 (개별 카드별 에러는 없음 — 합성 fetch 단일 실패) | `newOrdersCount=0 && todayTotalCount=0` 시 카드 dimmed |
| MarketConnectionStatusCard | 회색 펄스 | 카운트 정상 | 단문 에러. KPI / 마켓 주문은 정상 | `total === 0` 시 "마켓 연결하기" 강조 |

> **partial 상태 제거**: 이전 설계는 잡 리스트의 partial 행을 dashboard 에서 표시했으나, 잡 리스트 위젯이 제거되었으므로 본 화면에서 `partial` UI 분기는 더 이상 존재하지 않는다. partial 잡 확인은 s6 `/history` 단독.

**에러 격리 원칙**: 각 위젯이 독립 TanStack Query → 한 fetcher 의 5xx 가 다른 위젯을 막지 않음. Realtime 끊김 배너는 화면 상단에 1회만 표시 (§4.2).

---

## 7. 에러 매핑

| 분류 | 원인 | UI |
|---|---|---|
| `summary_rpc_5xx` | `rpc_get_dashboard_summary` 5xx | KPI 카드 영역만 `<ErrorMessage>` + 재시도. 다른 위젯 정상. |
| `market_orders_fetch_5xx` | `orders_with_dispatch_summary` view / `orders` SELECT / `market_accounts` SELECT 중 하나라도 5xx 또는 네트워크 오류 | `MarketOrdersSummaryCard` 컨테이너만 에러 (role=alert) + 단문 메시지. raw 응답은 접힘. KPI/마켓 헬스 정상. |
| `market_health_fetch_5xx` | `market_accounts` SELECT 5xx | 마켓 헬스 카드만 에러. 본 fetcher 와 market-orders 의 accounts SELECT 가 동일 테이블이라 동시 실패 가능 — 별도 키로 캐싱하므로 UI 는 독립적으로 에러 표시. |
| `zod_validation_failed` | 응답이 스키마 불일치 (특히 합성 산출물) | Sentry 전송 (필드 path 만, 값 미포함) + 사용자에게는 "데이터 형식이 잘못되었어요. 새로고침해주세요" |
| `auth_expired` | JWT 만료 | s1 로그인 페이지 redirect (auth.md §세션 만료 처리) |
| `realtime_disconnected` | WebSocket 5초 이상 끊김 | 상단 배너 + `refetchInterval` 30s 폴백 (모든 위젯 일괄) |
| `realtime_reconnected` | 복구 | 배너 사라짐 + `refetchInterval` 해제 |
| `rls_denied` (이론상 발생 불가) | 다른 셀러 row 가 push 됨 (서버 버그) | Sentry P0 alert + 데이터 무시 (UI 표시 안 함) |

Sentry `beforeSend` (security.md §sentry-mask) 가 OAuth 토큰·이메일·전화 마스킹. 본 화면이 노출하는 raw 값:

- `market_accounts.last_error_code` (code 만, 메시지 없음 — markets.md §3 보장)
- `MarketOrderItem.syncError` (위 code 그대로 — PII 아님)
- `orders` 관련 raw 필드는 본 화면에 노출 0 (카운트만)

> **제거**: 이전 설계의 `recent_rpc_5xx` 분류는 삭제. 잡 리스트가 없으므로 해당 분류 발생 경로 0.

---

## 8. 성능

### 8.1 인덱스

이미 정의된 인덱스로 충분.

| 인덱스 | 정의처 | 본 화면 활용 |
|---|---|---|
| `idx_registration_jobs_seller_created (seller_id, created_at DESC)` | registration-job-state.md §3.2 | summary view 의 시간대 FILTER (today / 24h / 7d / 30d) |
| `idx_registration_jobs_seller_status (seller_id, status)` | 동상 | summary view 의 status FILTER 절 |
| `idx_orders_seller_collected (seller_id, collected_at DESC)` | orders.md (s7) — collected_at >= today SELECT 활용 | fetchMarketOrdersSummary 단계 2 |
| `market_accounts_seller_id_idx (seller_id)` | markets.md §2.1 | fetchMarketHealth + market-orders 단계 3 |

> **제거**: `idx_jmr_job` 의 본 화면 활용 항목은 삭제 (recent_jobs view 와 함께). jmr 인덱스 자체는 history / registration 화면이 계속 사용.

**추가 인덱스 제안: 없음.** 새 인덱스는 view 가 실제로 느린 게 측정된 후에 추가 (premature optimization 거부).

### 8.2 캐시 전략 (TanStack Query)

| 키 | staleTime | gcTime | refetchOnWindowFocus | refetchInterval |
|---|---|---|---|---|
| `dashboardQueryKeys.summary()` | 30s | 5분 | `true` | 0 (Realtime 정상 시) / 30s (fallback) |
| `dashboardQueryKeys.marketOrders()` | 15s | 5분 | `true` | 0 (Realtime 정상 시) / 30s (fallback) |
| `dashboardQueryKeys.marketHealth()` | 60s | 10분 | `true` | 0 (markets.md 가 Realtime 채널 별도 보유) |

staleTime: marketOrders 만 15s — 신규 주문 카운트가 KPI 보다 민감 (셀러가 즉시 확인). summary 는 30s.

### 8.3 응답 페이로드

- summary: 14 필드 × number/timestamp → ~ 200 bytes
- marketOrders: 합성 산출물 = 4 마켓 × 6 필드 + comingSoon 배열 → ~ 1 KB (zod 통과 후)
  - 단계별 fetch: by_market jsonb ~ 500 bytes + today orders.market_id 마켓당 1 bytes × N row (오늘 주문 100건 가정 ~ 0.1 KB) + market_accounts 4 row × 4 필드 ~ 300 bytes
- accounts (health): 평균 4 row × 1 필드(status) → ~ 100 bytes

총 < 5 KB. gzip 후 < 2 KB. 부하 무시 가능.

### 8.4 합성 fetch 비용

`fetchMarketOrdersSummary` 는 3 round-trip (병렬 가능). 각 단계:

- 단계 1 (`orders_with_dispatch_summary` view): 셀러당 1 row. 인덱스 활용 ms 단위.
- 단계 2 (`orders` today SELECT): 인덱스 `(seller_id, collected_at)` 활용. 오늘 주문 수 < 1000 가정 시 ms 단위. 1000 초과 시 view 의 `by_market.today_count` 컬럼 추가로 합치는 대안 검토 (OPEN-DSH-007).
- 단계 3 (`market_accounts` SELECT): 셀러당 ≤ 10 row. ms 단위.

> **개선 후보**: 3 round-trip 을 1회 RPC 로 묶을 수 있으나 (성능 측정 후), 현재는 코드 단순성 우선. 평균 응답 > 300ms / P95 > 800ms 시 RPC 도입 (OPEN-DSH-007).

실측 측정 트리거: 평균 응답 > 200ms 또는 P95 > 500ms 시 view 재설계 (materialized view 또는 별도 집계 테이블 + trigger). 현재는 보류.

---

## 9. 접근성 (WCAG 2.1 AA)

### 9.1 키보드 동선

```
Tab 순서:
1. 사이드바 (← s2 진입 시) 이미 dashboard 활성 표시
2. [새로고침] 버튼
3. [상품 등록 시작] CTA
4. KPI 카드 1 → 4 (카드 자체는 link 아님, focusable false. 단 내용 클릭 가능한 부분만 focus)
5. "주문 전체 보기 →" 링크 (marketOrders card header)
6. MarketOrderItemCard 1 → 5 (네이버 / 쿠팡 / G마켓 / 옥션 / 11번가. 각 카드 = link, Enter 로 /orders/list 또는 /markets 진입)
7. "마켓 관리 →" 링크 (MarketConnectionStatusCard)
9. (mobile sticky CTA 의 경우 첫 진입 시 Tab 우선순위 조정)
```

Skip link: 사이드바 첫 진입 시 "본문으로 건너뛰기" 제공 (frontend.md §a11y 참조).

### 9.2 ARIA

- `<main aria-labelledby="page-title">` + `<h1 id="page-title">대시보드</h1>`
- KPI 카드: `<section aria-label="오늘 등록 건수">`
- MarketOrdersSummaryCard: `aria-labelledby="dashboard-market-orders-title"`
- MarketOrderItemCard link: `aria-label="네이버 주문 12건, 목록으로 이동"` / 오류 시 `"네이버 연결 오류, 재인증 페이지로 이동"` (11번가 포함 5 마켓 동일)
- 진행 중 카운트의 회전 아이콘: `<Loader aria-hidden="true">` (장식), 텍스트로 "3건 진행 중" 음성 노출
- SyncBadge: 아이콘 `aria-hidden`, 텍스트("정상" / "동기화 중" / "오류") 가 스크린리더에 그대로 전달
- 새로고침 버튼: `aria-label="대시보드 새로고침"`
- 실시간 배너: `role="status" aria-live="polite"`
- 로딩 컨테이너: `role="status" aria-live="polite" aria-label="마켓별 주문 현황 불러오는 중"`

### 9.3 색 + 아이콘 + 라벨 3중

`SyncBadge` 가 색만으로 의미를 전달하지 않게 아이콘 + 한국어 라벨 동반 (§5.2.4 표). `MarketOrderItemCard` 의 brand color 도트는 마켓명 텍스트와 함께 노출되어 색약 사용자도 마켓 구분 가능.

색약 대응: protanopia / deuteranopia / tritanopia 시뮬레이션을 디자인 리뷰 시 1회 강제 (qa 매트릭스 QA-DSH-010 에 수동 항목).

### 9.4 대비

라이트/다크 토큰 모두 4.5:1 검증. axe-core (Playwright) 가 CI 에서 자동 검출. 위반 시 PR 차단 (testing.md §axe).

### 9.5 모션 민감성

`prefers-reduced-motion: reduce` 인 사용자: 회전 아이콘 (KPI "진행 중" Loader / SyncBadge `syncing` 의 Loader2 `animate-spin`) → 정적 색 변경으로 대체. CSS `@media (prefers-reduced-motion: reduce)` 처리.

---

## 10. 테스트 매트릭스 (testing.md §4 양식)

| ID | Given | When | Then | 자동화 | Priority |
|----|-------|------|------|--------|----------|
| QA-DSH-001 | 셀러 A 가 자기 잡 5건 보유, 셀러 B 가 별도 잡 3건 보유 | 셀러 B 가 `rpc_get_dashboard_summary` 호출 | `seller_id = B.uid` 인 1 row 만 반환. 카운트는 B 의 데이터만. A 의 데이터 0건 노출. | RLS-SQL | P0 |
| QA-DSH-002 | 셀러 A 가 `orders` 12건, `market_accounts` 4개 보유. 셀러 B 가 별도 데이터. | 셀러 B 가 `fetchMarketOrdersSummary` 호출 (3 SELECT 합성) | `orders_with_dispatch_summary` / `orders` / `market_accounts` 모두 B 의 row 만 반환. A 의 newOrdersCount / todayTotalCount / sync 정보 노출 0. | RLS-SQL + Playwright | P0 |
| QA-DSH-003 | 셀러 A 가 잡 0건 + 마켓 0건. | `/dashboard` 진입 | 빈 상태 `no-markets` 분기: "마켓 연결하기" hero CTA. KPI 4 카드는 유지하며 0 표시. Sentry 에러 0건. | Playwright + RTL | P0 |
| QA-DSH-003b | 셀러 A 가 잡 0건 + 마켓 2건 (active) + 주문 0건. | `/dashboard` 진입 | 빈 상태 `no-activity` 분기: "첫 상품 등록 시작" hero CTA. 마켓 주문 현황 카드는 "신규 없음" 회색 표시. | Playwright + RTL | P0 |
| QA-DSH-004 | 셀러 A 가 `running` 잡 1개 보유. mock 어댑터가 5초 후 success 응답. | `/dashboard` 마운트 후 5초 대기 | Realtime UPDATE 푸시 → "진행 중" KPI 1 → 0, "오늘 등록" +1. **수동 새로고침 없이.** (잡 리스트는 본 화면에 없음 — history 에서 확인) | Playwright + Realtime mock | P0 |
| QA-DSH-005 | 셀러 A 의 `market_accounts` 중 네이버 = `expired`. | `/dashboard` 진입 | (a) "마켓 연결 상태" 카드의 expired 카운트 1 표시, 노란 색. (b) MarketOrderItemCard 의 네이버 카드 `syncStatus='error'`, "연결 오류 — 재인증 필요" 표시, 클릭 시 `/markets` 이동. | Playwright | P0 |
| QA-DSH-006 | KPI RPC 가 503 반환 (네트워크 단절 mock). | `/dashboard` 진입 | KPI 영역만 `<ErrorMessage>` + 재시도. 마켓 주문 현황 / 마켓 헬스는 정상. 한 위젯 에러가 다른 위젯을 막지 않음. | Playwright + MSW | P1 |
| QA-DSH-006b | `fetchMarketOrdersSummary` 의 3 SELECT 중 `orders_with_dispatch_summary` 만 503. | `/dashboard` 진입 | MarketOrdersSummaryCard 만 `state='error'`. KPI / 마켓 헬스 정상. raw 응답 메시지는 접힘. | Playwright + MSW | P1 |
| QA-DSH-007 | 셀러 A 의 네이버 신규 주문 12건, 쿠팡 0건, G마켓 sync 오류, 옥션 정상 0건, 11번가 신규 2건. | `/dashboard` 진입 | 5 카드 시각 검증: 네이버 = 12 신규 강조, 쿠팡 = 0 신규 dimmed, G마켓 = border-danger + AlertCircle 배지, 옥션 = 0 신규 dimmed + 정상 배지, 11번가 = 2 신규 강조 + 정상 배지. | Playwright | P0 |
| QA-DSH-008 | Realtime 채널 WebSocket 강제 종료. | 5초 후 | 상단 배너 "실시간 갱신 일시 중단됨" 노출, TanStack Query `refetchInterval` 30s 활성 (KPI / marketOrders 모두). 복구 시 배너 사라짐 + interval 해제. | Playwright (Supabase Realtime mock) | P1 |
| QA-DSH-009 | `fetchMarketOrdersSummary` 합성 후 `newOrdersCount` 가 음수 (스키마 위반). | `/dashboard` 진입 | zod 검증 실패. Sentry `validation_failed` 이벤트 1건 발생 (path: markets.0.newOrdersCount, 값 미포함). MarketOrdersSummaryCard `state='error'`. | Vitest (zod) + Sentry mock | P1 |
| QA-DSH-010 | 색약 시뮬레이션 (deuteranopia). | 대시보드 전체 시각 검사 | `SyncBadge` 3종 (정상 / 동기화 중 / 오류) 가 모두 의미 구분 가능 (아이콘 + 라벨로). 색만으로 구분되지 않는다. brand color 도트는 마켓명 텍스트와 동반. | 수동 (만료일 2026-08-31, 책임: designer) | P1 |
| QA-DSH-011 | 키보드만 사용. Tab 으로 순회. | dashboard 진입 후 Tab 반복 | "본문으로 건너뛰기" → 새로고침 → CTA → KPI 카드 → "주문 전체 보기" → 마켓 카드 1~5 → "마켓 관리" 순. focus ring 명확. Enter 로 모든 인터랙티브 요소 활성화. | Playwright + axe | P0 |
| QA-DSH-012 | 30일 잡 0 + 24h 잡 1 (running). 마켓 2개 active. | summary 응답 검사 | `last_job_at != null`, `jobs_30d_count == 1`, 빈 상태 UI 노출 안 됨, 데이터 UI 노출. | Vitest | P1 |
| QA-DSH-013 | 모바일 viewport (375×667). | `/dashboard` 진입 | CTA 풀폭 sticky. KPI 카드 2x2 그리드. MarketOrderItemCard 2x2 그리드. 터치 타겟 ≥ 44×44px. 카드 텍스트 truncate. | Playwright (mobile) | P1 |
| QA-DSH-014 | 셀러 A 가 두 탭에서 동시에 `/dashboard` 진입 후 한 탭에서 `orders` INSERT (mock 어댑터). | 두 번째 탭 5초 이내 관찰 | Realtime 으로 두 탭 모두 해당 마켓의 newOrdersCount / todayTotalCount +1. 별도 새로고침 없음. | Playwright (두 BrowserContext) | P1 |
| QA-DSH-015 | 마켓 5xx 시나리오 (testing.md §5 강제). 한 잡이 `partial` 로 종결. | dashboard 표시 측면 | KPI 카드의 `jobs_24h_partial` 카운트 반영. 본 화면에서 partial 잡을 row 로 표시하지는 않음 — 상세는 `/history/jobs/{id}`. | Playwright | P0 |
| QA-DSH-016 | 마켓 4xx (검증) 시나리오. 한 잡이 `failed` 로 종결. | KPI 카드 | `jobs_24h_failed` +1. 시각적으로 7일 성공률 카드의 분모/분자 변동. | Playwright | P1 |
| QA-DSH-017 | 마켓 429 시나리오. 잡이 `retrying` 상태 5초 유지. | KPI 카드 | `jobs_in_progress_count` 가 `retrying` 포함하여 +1 유지. "진행 중" Loader 회전 (prefers-reduced-motion 시 정지). | Playwright + RTL | P1 |
| QA-DSH-018 | 마켓 401 시나리오. refresh 실패 → `market_accounts.status='expired'`. | dashboard 진입 | (a) 마켓 연결 상태 카드의 expired 카운트 +1. (b) Realtime UPDATE 로 해당 마켓 `MarketOrderItemCard` 의 `syncStatus` `idle` → `error` 즉시 전환 (수동 새로고침 없이). 클릭 시 `/markets` 이동. | Playwright | P0 |
| QA-DSH-019 | 네트워크 끊김 (브라우저 offline). | 새로고침 버튼 클릭 | "네트워크 확인" 토스트. 기존 데이터는 stale 한 채로 유지 (TanStack Query cache). 복구 시 자동 refetch. | Playwright (offline mode) | P1 |
| QA-DSH-020 | 같은 셀러가 두 탭에서 동일 product 로 동시 `RegistrationJob` 생성. | 한 쪽만 성공, 다른 쪽 충돌 | KPI 의 "오늘 등록" 이 정확히 1만 증가 (UNIQUE 인덱스로 한 쪽 거부). | Playwright + DB constraint | P0 |
| QA-DSH-021 | MarketOrderItemCard 클릭. | 네이버 카드 클릭 (정상 상태) | `/orders/list?market=naver` 이동. URL search params 의 `market` 이 zod parse 통과. | Playwright | P0 |

### 10.1 testing.md §5 강제 8종 매핑

| 분류 | 매핑 행 |
|---|---|
| 마켓 API 5xx | QA-DSH-015 (KPI 카운트 측면) + QA-DSH-006b (위젯 합성 에러) |
| 마켓 API 4xx | QA-DSH-016 |
| 마켓 API 429 | QA-DSH-017 |
| 마켓 API 401 | QA-DSH-018 (sync 상태 즉시 반영) |
| 부분 실패 | QA-DSH-015 (KPI partial 카운트) |
| 네트워크 끊김 | QA-DSH-019 |
| 동시 입력 충돌 | QA-DSH-020 |
| 권한 누수 (RLS) | QA-DSH-001 (KPI 영역) / QA-DSH-002 (마켓 주문 / 마켓 헬스 영역) |

8종 모두 1행 이상 포함. testing.md §5 거부 룰 통과.

---

## 11. 수락 기준 체크리스트

- [ ] `seller_dashboard_summary` view 가 `security_invoker = on` 으로 정의되어 있다 (DDL 코드 리뷰 + `\d+` 출력 확인).
- [ ] **`seller_recent_jobs` view 가 마이그레이션에서 DROP 됨** (`DROP VIEW IF EXISTS public.seller_recent_jobs;`).
- [ ] **`rpc_get_recent_jobs(int)` 함수가 마이그레이션에서 DROP 됨** (`DROP FUNCTION IF EXISTS public.rpc_get_recent_jobs(int);`).
- [ ] view 위에 RLS 정책 추가 0개 (view 는 정책 안 받음. 하위 테이블 RLS 가 책임).
- [ ] `rpc_get_dashboard_summary` 가 `SECURITY INVOKER` 로 정의.
- [ ] `fetchMarketOrdersSummary()` 가 RPC 가 아닌 클라이언트 합성으로 구현 (3 SELECT) — `apps/web/src/features/dashboard/api/dashboard-api.ts`.
- [ ] `orders` / `orders_with_dispatch_summary` / `market_accounts` 가 셀러 격리 RLS 를 가지고 있고, 본 화면이 호출 시 다른 셀러 row 0 노출 (QA-DSH-002 자동화).
- [ ] zod 스키마 (`DashboardSummarySchema` / `MarketOrdersSummarySchema` / `MarketOrderItemSchema` / `MarketHealthSchema`) 가 응답과 1:1 일치 (마이그레이션 PR 에서 동시 갱신).
- [ ] Realtime 채널 3개: `dashboard_summary` (`registration_jobs`) / `dashboard_market_orders_orders` (`orders`) / `dashboard_market_orders_accounts` (`market_accounts`). 채널별 invalidate 키 분리.
- [ ] Realtime 끊김 → 30s 폴백 동작 확인 (KPI + marketOrders 모두).
- [ ] 빈 상태 UI 2 분기 (`no-markets` 우선 / `no-activity`) 동작 확인.
- [ ] `SyncBadge` 3종 (정상 / 동기화 중 / 오류) 모두 색 + 아이콘 + 라벨 3중.
- [ ] axe-core 위반 0건 (CI).
- [ ] 키보드만으로 모든 인터랙티브 요소 도달 (5 마켓 카드 전부 link).
- [ ] 모바일 viewport 에서 터치 타겟 ≥ 44px.
- [ ] zod 검증 실패 시 Sentry 이벤트가 값 없이 path 만 전송 (security.md §sentry-mask 검증).
- [ ] 마켓 토큰 / 이메일 / 전화번호 / orders 의 raw 주문자 정보 가 어떤 응답에도 포함되지 않음 (네트워크 탭 검사). 본 화면이 fetch 하는 것은 카운트 + market_id + collected_at + status + last_verified_at + last_error_code 뿐.
- [ ] 5 마켓 카드 (11번가 포함) 가 `MARKET_IDS` 에서 자동 구성 (하드코딩 row 금지).
- [ ] view 컬럼명/타입이 본 문서와 SQL 마이그레이션과 zod 스키마 3곳에서 일치.
- [ ] `prefers-reduced-motion` 환경에서 회전 아이콘 (KPI Loader / SyncBadge Loader2) 미동작.
- [ ] testing.md §5 의 8종 시나리오 매트릭스 행이 모두 존재.

---

## 12. 미해결 사안

| ID | 사안 | 결정 시점 | 영향 |
|---|---|---|---|
| OPEN-DSH-001 | 마켓별 통계 위젯 (n11) 의 v2 구체 사양 — 마켓당 매출 / 광고 KPI / 기간 비교? 본 화면 그리드 재배치 또는 별도 라우트? | v2 기획 시작 시 (현재 미정) | UI |
| OPEN-DSH-003 | 시간대 `Asia/Seoul` 하드코딩 (KPI summary view + `startOfTodayKstIso()`). 사용자별 timezone 설정 도입 시점. | 다국가 진출 검토 시점 | i18n |
| OPEN-DSH-004 | KPI 측정용 `events` 테이블 (CLAUDE.md §KPI 측정) 에서 "대시보드 진입" / "마켓 카드 클릭" 이벤트를 기록할지. 기록 시 이벤트명 / payload 합의 필요. | events 테이블 도입 시 (현재 미정) | 분석 |
| OPEN-DSH-005 | 새로고침 버튼이 명시적이어야 하는지 — Realtime 정상 동작 중에는 숨기는 안 vs 항상 노출. 본 문서는 "항상 노출". UX 검증 데이터로 재결정. | v1 베타 출시 후 1개월 | UX |
| OPEN-DSH-007 | `fetchMarketOrdersSummary` 3 round-trip 을 단일 RPC `rpc_get_market_orders_summary()` 로 합칠지. 성능 측정 후 결정 (평균 > 300ms / P95 > 800ms). 합칠 경우 `MarketOrdersSummarySchema` 는 그대로 재사용. | v1 베타 운영 데이터 수집 후 | 성능 |
| OPEN-DSH-008 | 마켓 활성/비활성 토글을 코드 상수에서 DB 설정 테이블 (`market_feature_flags`) 로 이관할지 (v1 은 5 마켓 전부 정식 활성이라 `comingSoon` 배열은 비어 있음). 신규 마켓 추가 시점에 코드 수정 vs 운영 토글. | 신규 마켓 추가 검토 시점 | 운영 |

---

## 13. 3개 산출물 동기화

본 설계 적용 시 함께 갱신해야 하는 산출물.

| 산출물 | 갱신 대상 |
|---|---|
| 설계문서 | 본 파일 (`docs/architecture/v1/features/dashboard.md`) + 디자이너 인계용 `docs/design-renewal/s2-dashboard.md` (상호 참조) |
| HTML 프로토타입 | `docs/frontend_html_design/v1/dashboard/` (마켓 주문 카드 시각 반영). 이전 RecentJobsList 마크업은 제거 또는 deprecated 폴더로 이동 |
| 실제 구현 | `apps/web/src/features/dashboard/` — `pages/DashboardPage.tsx` / `hooks/useDashboardSummary.ts` / `hooks/useMarketOrdersSummary.ts` / `hooks/useMarketHealth.ts` / `components/MarketOrdersSummaryCard.tsx` / `components/MarketOrderItemCard.tsx` / `components/MarketConnectionStatusCard.tsx` / `components/DashboardEmptyState.tsx` / `api/dashboard-api.ts`. zod: `apps/web/src/lib/schemas/dashboard-summary.ts`. 마이그레이션: `apps/api/supabase/migrations/<timestamp>_drop_seller_recent_jobs.sql` (view + RPC DROP) |

> **제거된 산출물 (변경 추적)**:
> - 코드: `RecentJobsTable.tsx`, `useRecentJobs.ts`, `JobStatusBadge.tsx` (대시보드 영역), `dashboardKeys.recent(limit)` 호출부, `RecentJob` / `RecentJobMarket` zod schema
> - DB: `seller_recent_jobs` view, `rpc_get_recent_jobs(int)` function

CLAUDE.md "3개 산출물 동기화" 규칙. 변경 시 매번 3개 동시 갱신.

---

## 14. 보안 검수 요청

다음 항목은 **security 에이전트의 명시적 승인 후** 머지한다.

1. `seller_dashboard_summary` view 가 `security_invoker = on` 인지 (RLS 우회 가능성).
2. `rpc_get_dashboard_summary` 가 `SECURITY INVOKER` 인지 (definer 면 거부).
3. **`seller_recent_jobs` view / `rpc_get_recent_jobs(int)` function 이 마이그레이션에서 실제 DROP 되었는지** (`\dv` / `\df` 출력 확인). 폐기된 RPC 로 우회 호출 경로 0.
4. `fetchMarketOrdersSummary` 의 3 SELECT 가 `orders_with_dispatch_summary` / `orders` / `market_accounts` 모두 RLS 활성 + 셀러 격리 정책 보유 검증 (markets.md / orders.md 인용 + `pg_policies` 조회).
5. Realtime payload 에 다른 셀러의 row 가 새는지 — `registration_jobs` / `orders` / `market_accounts` 모두 `seller_id=eq.<sellerId>` 필터 + RLS. 실제 푸시 packet 을 다른 셀러 토큰으로 receive 시도해서 0건 확인.
6. fetcher 응답에 토큰/PII/이메일/전화/orders 의 주문자 정보 미포함 확인. 본 화면이 SELECT 하는 컬럼: `orders.market_id`, `orders.collected_at`, `market_accounts.market_id`, `market_accounts.status`, `market_accounts.last_verified_at`, `market_accounts.last_error_code` 만.
7. Sentry `beforeSend` 가 `MarketOrderItem.syncError` (code 만) 만 통과시키고 raw 응답 메시지 / 토큰 / PII 를 마스킹하는지.

승인 게이트 통과 전 머지 금지.
