# s6 등록 이력 (History) 기능 설계

> **위치**: `docs/architecture/v1/features/history.md`
> **상태**: v1 초안 (Phase 4 산출물 — features/registration.md / cross-cutting/registration-job-state.md 종속)
> **소유**: backend (INTJ, ing-backend) 주도, frontend / designer / qa 합의
> **선행 문서**:
> - `docs/architecture/v1/platform.md` (Edge Function 한도, RLS 의무, MarketAdapter 인터페이스)
> - `docs/architecture/v1/frontend.md` §2.3 (URL 매핑 — `/history`, `/history/:jobId`), §2.4 (search params zod), §4 (Query Key), §6 (Realtime), §9 (4+1 상태)
> - `docs/architecture/v1/ui-system.md` §7 (Button variant 분리 룰), §8 (ErrorMessage), §9 (MarketIcon/Stack/Badge), §10 (RegistrationJob 7상태 시각 토큰)
> - `docs/architecture/v1/security.md` (RLS, 로그 마스킹, service_role 경로)
> - `docs/architecture/v1/testing.md` §4 (수락 기준 매트릭스 양식), §5 (실패 시나리오 8종 강제), §13.4 Phase 4 PASS 표
> - `docs/architecture/v1/cross-cutting/registration-job-state.md` (7상태 모델, RLS, Realtime, 판정 함수)
> - `docs/architecture/v1/features/registration.md` (`registration-retry`, `registration-start` + parentJobId 동선)
> - `docs/architecture/v1/features/markets.md` (마켓 ID 5종, MarketBadge), `features/dashboard.md` (최근 등록 카드 → 이력 진입점)
> - PRD §4.3 (재시도·제외), §4.4.1 (이력 검색 — v1 포함), §4.4.2 통계 / §4.4.3 내보내기 (**v2 제외**)
> - `user_flow.md` s6 (n41~n46)

본 문서는 **이력 화면(s6) 의 UI 흐름·필터·재시도/제외 동선·테스트 매트릭스** 를 ground truth 로 정의한다.
**신규 테이블·신규 Edge Function 없음**. 데이터는 `registration_jobs` + `registration_job_market_results` 를 그대로 읽고, 액션은 features/registration.md 의 `registration-retry` / `registration-start` 를 그대로 호출한다. 본 문서가 새로 만드는 것은 **(a) `list_registration_jobs` 페이지네이션 RPC, (b) 이력 화면 UI 와 zod 스키마, (c) 필터·재시도·제외 인터랙션 규약** 뿐이다.

---

## 목차

1. 목적·범위 + user_flow 매핑
2. 데이터 모델 (신규 테이블 없음 — 인용만)
3. API / RPC 시그니처 + zod 스키마
4. 클라이언트 zod 스키마 (필터·요약·상세)
5. UI 흐름 — 화면별 (목록 / 상세 / 필터 / 데스크탑·모바일 ASCII)
6. 재시도 흐름 (n24, registration-retry 호출)
7. 마켓 제외 후 재등록 (n25, registration-start + parentJobId)
8. 상태 처리 (loading / data / error / empty / partial)
9. 에러 매핑
10. 성능 (인덱스, 페이지 크기, 무한 스크롤 vs 페이지네이션)
11. 접근성 (키보드 동선, aria, 색 대비)
12. 테스트 매트릭스 (testing.md §4 양식, 18행)
13. 수락 기준 체크리스트 (Phase 4 PASS 게이트)
14. 미해결 사안

---

## 1. 목적·범위 + user_flow 매핑

### 1.1 목적 (3줄)

- 셀러가 **과거 등록 잡 전수** 를 조회·필터·상세 추적할 수 있게 한다.
- partial / failed 잡에서 **재시도 (n24) 또는 마켓 제외 후 재등록 (n25)** 동선을 같은 화면에서 제공한다.
- 셀러 격리 (RLS) 와 마켓 토큰 비노출을 화면 진입 경로 전수에서 유지한다.

### 1.2 범위

**포함 (v1)**:
- `/history` 목록 화면 — 기간 / 마켓 / 상태 / 검색어 4종 필터.
- `/history/:jobId` 상세 화면 — 마켓별 결과 카드 + 에러 메시지 + 재시도/제외 액션.
- 페이지네이션 (서버 측 cursor 또는 offset, §10 결정).
- 부모-자식 잡 연결 표시 (`parent_job_id` → "이 잡은 재등록 잡입니다 → 부모 잡 보기").
- 재시도 / 마켓 제외 후 재등록 트리거.
- Realtime 갱신 (목록·상세 양쪽, registration-job-state.md §8 채널 재사용).

**제외 (v2 carry-over)** — testing.md §0 헌법 #7 명시:
- PRD §4.4.2 **오류 유형별 통계 차트** — `expires: 2026-12-31`, 사유: 베타 운영 데이터 부족, error_code 분포 안정화 후.
- PRD §4.4.3 **CSV/Excel 내보내기** — `expires: 2026-12-31`, 사유: PII 외부 노출 정책 미정, security 미검토.
- 11번가 / G마켓 / 옥션 잡 표시 — 인터페이스는 v1 에서도 받아들이지만(스키마에 enum 포함), 실제 잡 데이터는 v2 에서 생성됨.

### 1.3 user_flow s6 노드 매핑 (n41~n46)

| user_flow 노드 | URL / 컴포넌트 | v1 구현 |
|---|---|---|
| **n41 등록 이력 (main_page)** | `/history` 진입점 | `features/history/pages/HistoryListPage.tsx` |
| **n42 이력 목록 (page)** | `/history?from=&to=&market=&status=&q=&page=` | 동일 페이지의 목록 영역 (좌측 필터 / 우측 리스트) |
| **n43 이력 상세 (page)** | `/history/:jobId` | `features/history/pages/HistoryDetailPage.tsx` |
| **n44 오류 분석 (page)** | `/history/:jobId?tab=errors` | v1 = 상세 페이지 내부 탭 ("결과" / "에러"). PRD §4.4.2 통계 차트는 v2 |
| **n45 기간별 필터 (action)** | 필터 사이드바 | 4 preset (`today` / `7d` / `30d` / `custom`) |
| **n46 마켓별 필터 (action)** | 필터 사이드바 | 5 마켓 다중 선택 (`naver` / `coupang` / `11st` / `gmarket` / `auction`) |

### 1.4 s6 외 진입점

- s2 대시보드의 "최근 등록 내역" 카드(n12) → `Link to=/history/:jobId`.
- s3 등록 결과(`/register/result/:jobId`, n21) → "이력으로 이동" 버튼(이력 상세와 동일 UI 인 다른 URL 이지만, v1 은 result 페이지를 그대로 두고 history 로 별도 진입 가능하게 한다 — features/registration.md §10.7 와 비충돌).

---

## 2. 도메인 데이터 모델 (신규 테이블 없음)

본 문서는 **신규 테이블·컬럼·ENUM 추가가 없다**. 모두 인용.

### 2.1 인용 출처

- `registration_jobs` (DDL): `cross-cutting/registration-job-state.md` §3.2
- `registration_job_market_results` (DDL): 동 문서 §3.3
- `market_accounts` (DDL): `features/markets.md` §3 — `market_id`, `account_label` 사용
- `products` (DDL): `features/registration.md` §3.3 — `name`, `thumbnail_image_id` 사용

### 2.2 본 문서가 SELECT 하는 컬럼 (정리표)

| 테이블 | 사용 컬럼 (목록·상세 응답에 노출) | 비노출 (마스킹 / 미포함) |
|---|---|---|
| `registration_jobs` | `id`, `status`, `created_at`, `started_at`, `completed_at`, `retry_count`, `error_summary`, `parent_job_id`, `correlation_id` (debug 모드만), `product_id` | `cancelled_by`(uuid 만, email/이름 X) |
| `registration_job_market_results` | `id`, `market_id`, `market_status`, `external_product_id`, `product_url`, `error_code`, `error_message`, `attempt_count`, `last_attempted_at`, `excluded` | `market_account_id` 는 응답에 미포함 (로깅 시 `sellerId`/`accountId` 만, 라벨/이메일 X) |
| `market_accounts` | `account_label` (목록 행에서 어느 계정으로 등록됐는지 표시) | `access_token_enc`, `refresh_token_enc`, `expires_at`, `email`, `phone` 절대 미포함 |
| `products` | `name`, `thumbnail_image_id` → 별도 RPC 로 변환된 thumbnail URL | 상세설명 HTML, 가격 raw (목록·상세 둘 다 미노출. 가격은 product detail 진입 후 별도 화면) |

> **금지**: `error_message` 컬럼은 마켓 API 가 응답에 PII/토큰을 섞어 보낸 경우가 있으므로 **저장 시점에 마스킹** (registration-job-state.md §13 보안 검수 항목 [5]). 이력 화면은 저장된 값을 그대로 노출하되, 저장 직전에 backend 가 마스킹 책임. 본 문서는 마스킹 함수 호출 위치만 인용 — 함수 자체는 `src/lib/security/mask.ts` (security.md).

### 2.3 ERD 인용 (간략)

```
          ┌──────────────────────┐
          │ registration_jobs    │ (RLS: seller_id = auth.uid())
          │ id, status, ...      │
          │ parent_job_id ◄──────┼── self-ref (n25 재등록 트리)
          └──────────┬───────────┘
                     │ 1
                     │
                     ▼ N
          ┌──────────────────────────────────┐
          │ registration_job_market_results  │
          │ market_status, error_code, ...   │
          │ (RLS: 조인 통해 자동 필터)        │
          └──────────────────────────────────┘
```

---

## 3. API / RPC

### 3.1 함수 일람

| 이름 | 종류 | 트리거 | 기능 | timeout | 인증 |
|---|---|---|---|---|---|
| `list_registration_jobs` | **Postgres RPC** (security invoker) | `/history` 목록 로드 + 필터 변경 | 페이지네이션 + 4종 필터 → `{ jobs[], total, nextCursor? }` | DB 기본 (~5s) | seller JWT |
| `get_registration_job` | **Postgres RPC** (security invoker) | `/history/:jobId` 상세 로드 | 잡 + 마켓 결과 N개 + 부모 잡 메타 → `JobDetail` | DB 기본 | seller JWT |
| (재시도) | Edge Function `registration-retry` | "재시도" 버튼 | features/registration.md §6.5 그대로 인용 | 15s | seller JWT |
| (마켓 제외 등록) | Edge Function `registration-start` (+ `parentJobId`, `excludedMarketIds`) | "마켓 제외 등록" 버튼 | features/registration.md §6.3 그대로 인용 | 60s | seller JWT |

**결정 사유 (Edge Function vs Postgres RPC)**:
- 이력 조회는 **읽기 전용 + RLS 자동 적용 + 외부 마켓 API 호출 없음** → Postgres RPC 가 적합. Edge Function 의 cold start / timeout / service_role 노출 위험을 회피.
- 재시도·제외 등록은 **외부 마켓 API 호출 + 토큰 decrypt 필요** → Edge Function 필수. 기존 함수 재사용, 본 문서에서 신규 함수 만들지 않음.

### 3.2 `list_registration_jobs` 시그니처

```sql
create or replace function public.list_registration_jobs(
  p_from         timestamptz default null,    -- inclusive
  p_to           timestamptz default null,    -- exclusive
  p_markets      text[]      default null,    -- ['naver','coupang',...] 또는 null
  p_statuses     registration_job_status[] default null,
  p_q            text        default null,    -- 상품명 부분 일치 (ILIKE)
  p_limit        int         default 20,      -- 20 | 50 (§10 결정)
  p_cursor       timestamptz default null,    -- (created_at, id) keyset cursor 의 created_at 부분
  p_cursor_id    uuid        default null     -- tie-breaker
)
returns table (
  id              uuid,
  status          registration_job_status,
  created_at      timestamptz,
  started_at      timestamptz,
  completed_at    timestamptz,
  retry_count     smallint,
  error_summary   text,
  parent_job_id   uuid,
  product_id      uuid,
  product_name    text,
  product_thumbnail_id uuid,
  market_summary  jsonb,  -- [{market_id, market_status, excluded}, ...] (마켓 ID 만, 토큰/계정라벨 미포함)
  total_count     bigint  -- window function 으로 첫 행에만 노출 (또는 별도 호출, §10)
)
language sql
security invoker  -- RLS 통과해야 함 (auth.uid() = seller_id 자동 적용)
stable
as $$
  with filtered as (
    select rj.*,
           p.name as product_name,
           p.thumbnail_image_id as product_thumbnail_id,
           (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'market_id', jmr.market_id,
                      'market_status', jmr.market_status,
                      'excluded', jmr.excluded
                    ) order by jmr.market_id), '[]'::jsonb)
             from public.registration_job_market_results jmr
             where jmr.job_id = rj.id
           ) as market_summary
    from public.registration_jobs rj
    join public.products p on p.id = rj.product_id
    where rj.seller_id = auth.uid()       -- 명시. RLS 가 또 한 번 보강.
      and (p_from is null or rj.created_at >= p_from)
      and (p_to   is null or rj.created_at <  p_to)
      and (p_statuses is null or rj.status = any(p_statuses))
      and (p_q is null or p.name ilike '%' || p_q || '%')
      and (
        p_markets is null
        or exists (
          select 1 from public.registration_job_market_results jmr
          where jmr.job_id = rj.id and jmr.market_id = any(p_markets)
        )
      )
      and (
        p_cursor is null
        or (rj.created_at, rj.id) < (p_cursor, coalesce(p_cursor_id, '00000000-0000-0000-0000-000000000000'::uuid))
      )
    order by rj.created_at desc, rj.id desc
    limit least(p_limit, 50)
  ),
  counted as (
    -- total_count 는 같은 필터로 별도 집계 (limit 무시)
    select count(*) as total
    from public.registration_jobs rj
    join public.products p on p.id = rj.product_id
    where rj.seller_id = auth.uid()
      and (p_from is null or rj.created_at >= p_from)
      and (p_to   is null or rj.created_at <  p_to)
      and (p_statuses is null or rj.status = any(p_statuses))
      and (p_q is null or p.name ilike '%' || p_q || '%')
      and (
        p_markets is null
        or exists (
          select 1 from public.registration_job_market_results jmr
          where jmr.job_id = rj.id and jmr.market_id = any(p_markets)
        )
      )
  )
  select
    f.id, f.status, f.created_at, f.started_at, f.completed_at,
    f.retry_count, f.error_summary, f.parent_job_id,
    f.product_id, f.product_name, f.product_thumbnail_id, f.market_summary,
    (select total from counted) as total_count
  from filtered f;
$$;
```

**규약:**
- `security invoker` 라서 RLS 가 자동 적용된다. `seller_id = auth.uid()` 를 명시한 이유는 plan stability (인덱스 활용) + 이중 방어.
- `total_count` 는 첫 행에 동일 값 반복. 클라이언트는 `rows[0].total_count` 만 사용. 큰 결과셋에서는 부정확할 수 있는 `count(*)` 비용 — §10 에서 결정 (정확 vs estimated).
- 검색어 `p_q` 는 ILIKE 부분 일치. 전문 검색은 v2 (`pg_trgm` 또는 `tsvector` 도입).

### 3.3 `get_registration_job` 시그니처

```sql
create or replace function public.get_registration_job(p_job_id uuid)
returns jsonb
language sql
security invoker
stable
as $$
  select jsonb_build_object(
    'job', to_jsonb(rj) - 'cancelled_by',  -- cancelled_by 는 uuid 만 별도 키로
    'cancelledByMaskedId', case when rj.cancelled_by is not null
                                then substring(rj.cancelled_by::text, 1, 8) || '…'
                                else null end,
    'product', jsonb_build_object(
       'id', p.id,
       'name', p.name,
       'thumbnailImageId', p.thumbnail_image_id
    ),
    'parent', case when rj.parent_job_id is not null then
       (select jsonb_build_object('id', pj.id, 'status', pj.status, 'createdAt', pj.created_at)
        from public.registration_jobs pj where pj.id = rj.parent_job_id)
       else null end,
    'children', (
       select coalesce(jsonb_agg(jsonb_build_object(
         'id', cj.id, 'status', cj.status, 'createdAt', cj.created_at
       ) order by cj.created_at desc), '[]'::jsonb)
       from public.registration_jobs cj
       where cj.parent_job_id = rj.id and cj.seller_id = auth.uid()
    ),
    'marketResults', (
       select coalesce(jsonb_agg(jsonb_build_object(
         'id', jmr.id,
         'marketId', jmr.market_id,
         'marketStatus', jmr.market_status,
         'externalProductId', jmr.external_product_id,
         'productUrl', jmr.product_url,
         'errorCode', jmr.error_code,
         'errorMessage', jmr.error_message,
         'attemptCount', jmr.attempt_count,
         'lastAttemptedAt', jmr.last_attempted_at,
         'excluded', jmr.excluded,
         'updatedAt', jmr.updated_at
       ) order by jmr.market_id), '[]'::jsonb)
       from public.registration_job_market_results jmr
       where jmr.job_id = rj.id
    )
  )
  from public.registration_jobs rj
  join public.products p on p.id = rj.product_id
  where rj.id = p_job_id
    and rj.seller_id = auth.uid();
$$;
```

- 권한 없는 잡 id 입력 시 `null` 반환. 클라이언트 hook 이 `null` → `notFound` UI.
- `cancelled_by` raw uuid 를 그대로 노출하지 않는다 — `cancelledByMaskedId` 로 8자 잘라서. 단일 사용자 셀러 시나리오에서는 항상 본인 uuid 라 PII 위험 낮지만 일관성 정책.
- `children` 은 n25 재등록 트리 추적용. v1 UI 는 "이 잡은 N건의 재등록을 가지고 있습니다 → 보기" 한 줄만 표시 (트리 시각화는 v2).
- 마켓 토큰·계정 라벨 절대 미포함.

### 3.4 응답 zod 스키마 (Edge Function 측 또는 클라이언트 측 검증)

`src/lib/schemas/history.ts` — backend·frontend 단일 소스 (frontend.md §7 패턴 준수).

```ts
import { z } from 'zod';
import { JOB_STATUSES, MARKET_RESULT_STATUSES } from '@/lib/registration/state';

export const MARKET_IDS = ['naver', 'coupang', '11st', 'gmarket', 'auction'] as const;
export const marketIdSchema = z.enum(MARKET_IDS);
export const jobStatusSchema = z.enum(JOB_STATUSES);
export const marketResultStatusSchema = z.enum(MARKET_RESULT_STATUSES);

// 목록 행 (list_registration_jobs 의 한 row)
export const jobSummarySchema = z.object({
  id: z.string().uuid(),
  status: jobStatusSchema,
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  retryCount: z.number().int().min(0).max(5),
  errorSummary: z.string().nullable(),
  parentJobId: z.string().uuid().nullable(),
  productId: z.string().uuid(),
  productName: z.string(),
  productThumbnailId: z.string().uuid().nullable(),
  marketSummary: z.array(z.object({
    marketId: marketIdSchema,
    marketStatus: marketResultStatusSchema,
    excluded: z.boolean(),
  })),
});
export type JobSummary = z.infer<typeof jobSummarySchema>;

// 상세 페이로드 (get_registration_job 의 jsonb)
export const marketResultSchema = z.object({
  id: z.string().uuid(),
  marketId: marketIdSchema,
  marketStatus: marketResultStatusSchema,
  externalProductId: z.string().nullable(),
  productUrl: z.string().url().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  attemptCount: z.number().int().min(0).max(3),
  lastAttemptedAt: z.string().datetime().nullable(),
  excluded: z.boolean(),
  updatedAt: z.string().datetime(),
});

export const jobDetailSchema = z.object({
  job: z.object({
    id: z.string().uuid(),
    sellerId: z.string().uuid(),
    productId: z.string().uuid(),
    status: jobStatusSchema,
    createdAt: z.string().datetime(),
    startedAt: z.string().datetime().nullable(),
    completedAt: z.string().datetime().nullable(),
    retryCount: z.number().int().min(0).max(5),
    errorSummary: z.string().nullable(),
    cancelledAt: z.string().datetime().nullable(),
    parentJobId: z.string().uuid().nullable(),
    correlationId: z.string().uuid(),
  }),
  cancelledByMaskedId: z.string().nullable(),
  product: z.object({
    id: z.string().uuid(),
    name: z.string(),
    thumbnailImageId: z.string().uuid().nullable(),
  }),
  parent: z.object({
    id: z.string().uuid(),
    status: jobStatusSchema,
    createdAt: z.string().datetime(),
  }).nullable(),
  children: z.array(z.object({
    id: z.string().uuid(),
    status: jobStatusSchema,
    createdAt: z.string().datetime(),
  })),
  marketResults: z.array(marketResultSchema),
});
export type JobDetail = z.infer<typeof jobDetailSchema>;
```

---

## 4. 클라이언트 zod 스키마 — 필터 + 페이지네이션 키

`src/features/history/types/filters.ts` 도 src/lib/schemas/history.ts 와 함께 단일 소스.

### 4.1 `HistoryFilter`

```ts
export const periodPresetSchema = z.enum(['today', '7d', '30d', 'custom']);
export type PeriodPreset = z.infer<typeof periodPresetSchema>;

export const historyFilterSchema = z.object({
  // 기간
  period: periodPresetSchema.default('30d'),
  from: z.string().date().optional(),   // custom 일 때만 사용
  to:   z.string().date().optional(),
  // 마켓 (다중)
  markets: z.array(marketIdSchema).optional(),
  // 상태 (다중)
  statuses: z.array(jobStatusSchema).optional(),
  // 검색어 (상품명 부분 일치)
  q: z.string().max(100).optional(),
  // 페이지네이션
  cursor: z.string().datetime().optional(),
  cursorId: z.string().uuid().optional(),
  pageSize: z.union([z.literal(20), z.literal(50)]).default(20),
}).superRefine((v, ctx) => {
  if (v.period === 'custom') {
    if (!v.from || !v.to) {
      ctx.addIssue({ code: 'custom', message: 'custom 기간은 from/to 필수', path: ['from'] });
    } else if (v.from > v.to) {
      ctx.addIssue({ code: 'custom', message: 'from 은 to 이전이어야 합니다', path: ['from'] });
    }
  }
});
export type HistoryFilter = z.infer<typeof historyFilterSchema>;
```

### 4.2 URL search params 변환 (frontend.md §2.4 패턴)

```ts
// features/history/hooks/useHistoryFilters.ts
import { useSearchParams } from 'react-router-dom';

export function useHistoryFilters(): HistoryFilter {
  const [sp] = useSearchParams();
  const raw = {
    period: sp.get('period') ?? '30d',
    from: sp.get('from') ?? undefined,
    to:   sp.get('to') ?? undefined,
    markets:  sp.getAll('market').length ? sp.getAll('market') : undefined,
    statuses: sp.getAll('status').length ? sp.getAll('status') : undefined,
    q: sp.get('q') ?? undefined,
    cursor: sp.get('cursor') ?? undefined,
    cursorId: sp.get('cursorId') ?? undefined,
    pageSize: sp.get('pageSize') === '50' ? 50 : 20,
  };
  const parsed = historyFilterSchema.safeParse(raw);
  return parsed.success ? parsed.data : historyFilterSchema.parse({});
}
```

- **모든 필터 변경은 URL 갱신 → TanStack Query 가 키 변화 감지 → refetch.** 컴포넌트 로컬 state 로 필터 보관 금지 (deep link / 뒤로가기 호환성 + 새로고침 시 재현).
- preset → 실제 from/to 변환은 RPC 호출 직전 hook 에서 수행 (`today` → `now()::date`, `7d` → `now() - interval '7 days'` 등).

---

## 5. UI 흐름 — 화면별

### 5.1 라우팅 (frontend.md §2.3 인용)

```
/history                  → HistoryListPage  (목록 + 필터 사이드바)
/history/:jobId           → HistoryDetailPage (상세, tab='result' 기본)
/history/:jobId?tab=errors → 동일 페이지의 에러 탭 (n44)
```

`<RequireAuth>` 필수. 미인증 시 `/login?redirect=/history…`.

### 5.2 TanStack Query 키 (frontend.md §4.3 규약)

```ts
['history', 'list', filter]    // 목록. filter 객체가 키
['history', 'detail', jobId]   // 상세
```

- Realtime 이벤트 (`registration_jobs` UPDATE) 수신 시 `['history']` 전체 invalidate 가 아니라 **변경된 jobId 가 현재 화면에 보이는 행에 포함될 때만** invalidate (`queryClient.setQueryData` 로 패치 + `['history', 'list']` 부분 refetch).
- frontend.md §6.3 표 추가 행:

| 채널 | 이벤트 | Query 액션 |
|---|---|---|
| `seller-jobs-list-{sellerId}` (history 화면 한정) | `registration_jobs` UPDATE | 현재 visible page 안의 jobId 면 `['history','detail',jobId]` + `['history','list',*]` invalidate |

### 5.3 데스크탑 (≥1200px) — 목록 화면 ASCII

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ┌──────────┐  등록 이력                                                       총 142건          │
│  │ 사이드바 │  ──────────────────────────────────────────────────────────────────────────────── │
│  │          │  ┌─ 필터 ────────────────┐  ┌─ 목록 ────────────────────────────────────────────┐│
│  │ • 홈     │  │ 기간                  │  │ ┌────────────────────────────────────────────────┐││
│  │ • 등록   │  │ ( ) 오늘              │  │ │ [thumb] 무선 이어폰 / partial                 │││
│  │ • 마켓   │  │ ( ) 7일               │  │ │         [N][C]+0    1성공 / 1실패              │││
│  │ ◉ 이력   │  │ (◉) 30일              │  │ │         2026-05-18 14:23  retry=1              │││
│  │ • 설정   │  │ ( ) 직접 선택         │  │ │                                       [상세 →] │││
│  │          │  │                       │  │ └────────────────────────────────────────────────┘││
│  │          │  │ 마켓                  │  │ ┌────────────────────────────────────────────────┐││
│  │          │  │ ☑ 네이버              │  │ │ [thumb] 캠핑 의자  / succeeded                  │││
│  │          │  │ ☑ 쿠팡                │  │ │         [N][C]      2성공                        │││
│  │          │  │ ☐ 11번가              │  │ │         2026-05-17 09:11                         │││
│  │          │  │ ☐ G마켓               │  │ │                                       [상세 →]  │││
│  │          │  │ ☐ 옥션                │  │ └────────────────────────────────────────────────┘││
│  │          │  │                       │  │ ┌────────────────────────────────────────────────┐││
│  │          │  │ 상태                  │  │ │ [thumb] 텀블러   / failed   (재등록 1건 있음 →) │││
│  │          │  │ ☐ 진행 중             │  │ │         [N][C]      0성공 / 2실패                │││
│  │          │  │ ☑ 부분 성공           │  │ │         2026-05-16 18:42  retry=3                │││
│  │          │  │ ☑ 실패                │  │ │                                       [상세 →]  │││
│  │          │  │ ☐ 성공                │  │ └────────────────────────────────────────────────┘││
│  │          │  │ ☐ 취소                │  │     …                                              ││
│  │          │  │                       │  │                                                    ││
│  │          │  │ 검색                  │  │  [ ← 이전 ]  1 / 8 페이지  [ 다음 → ]              ││
│  │          │  │ ┌─────────────────┐   │  │  [페이지 크기: 20 ▾]                               ││
│  │          │  │ │상품명 검색…     │   │  │                                                    ││
│  │          │  │ └─────────────────┘   │  │                                                    ││
│  │          │  │                       │  │                                                    ││
│  │          │  │ [필터 적용] [초기화]   │  │                                                    ││
│  │          │  └───────────────────────┘  └───────────────────────────────────────────────────┘│
│  └──────────┘                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**버튼 variant (ui-system.md §7.2 강제 룰):**
- `[필터 적용]` = **검색류** (`ghost`). 페이지 이동 없음, URL params 만 갱신 + 결과 refetch.
- `[초기화]` = **검색류** (`outline`). 동상.
- `[상세 →]` = 링크 (`link` variant).
- `[← 이전] [다음 →]` = `outline`. 페이지 이동 없음.
- 필터 변경 자체(체크박스 클릭, period radio 클릭)는 **디바운스 300ms 후 자동 적용**. `[필터 적용]` 버튼은 검색어 enter 와 동일 역할로 명시적 트리거 (모바일에서 키보드 닫기 동시).

### 5.4 모바일 (≤767px) — 목록 화면 ASCII

```
┌────────────────────────────────┐
│ ☰  등록 이력         🔍 [필터]│
├────────────────────────────────┤
│ 30일 · 네이버,쿠팡 · partial+failed   ✕│  ← 활성 필터 칩 (탭하면 사이드시트)
├────────────────────────────────┤
│ ┌────────────────────────────┐ │
│ │ [thumb] 무선 이어폰         │ │
│ │ partial   [N][C]            │ │
│ │ 2026-05-18 14:23            │ │
│ │ 1성공 / 1실패  retry=1      │ │
│ │ ──────────────────────────  │ │
│ │ [상세 보기 →]                │ │
│ └────────────────────────────┘ │
│ ┌────────────────────────────┐ │
│ │ [thumb] 캠핑 의자  succeeded│ │
│ │ ...                         │ │
│ └────────────────────────────┘ │
│  ...                           │
│  [더 불러오기 (8 페이지 남음)]  │
└────────────────────────────────┘
```

- 모바일은 필터를 `Sheet (bottom)` 로 띄움 (ui-system.md §7 `ResponsiveDialog`).
- 페이지네이션은 모바일에서 "더 불러오기" 버튼 (cursor 기반 무한 스크롤은 v2 — §10).

### 5.5 데스크탑 — 상세 화면 ASCII

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [← 이력으로]      등록 이력 상세                                            │
│ ────────────────────────────────────────────────────────────────────────── │
│  [thumb 80px]   무선 이어폰 / partial                                        │
│                 created_at: 2026-05-18 14:23                                 │
│                 completed_at: 14:24  /  retry_count: 1 / 5                  │
│                 correlation_id: corr_a1b2…  [📋 복사]   ← debug 모드만       │
│                                                                              │
│  [재등록 트리]   이 잡은 부모 잡이 있습니다 → [부모 잡 보기 #b1c2…]            │
│                  하위 재등록 잡: 1건  → [보기 #c2d3…]                          │
│                                                                              │
│  ─ 탭 ─                                                                      │
│  [● 결과]  [○ 에러 (1)]                                                     │
│ ────────────────────────────────────────────────────────────────────────── │
│  ┌─ 마켓 결과 카드 ───────────────────────────────────────────────────────┐ │
│  │ [N] 네이버 스마트스토어                            [성공]              │ │
│  │     외부 상품 ID:  smt_998877                                          │ │
│  │     상품 URL:      https://smartstore.naver.com/p/998877  [↗ 열기]     │ │
│  │     마지막 시도:   2026-05-18 14:24  (시도 1/3)                        │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│  ┌─ 마켓 결과 카드 ───────────────────────────────────────────────────────┐ │
│  │ [C] 쿠팡                                            [실패 (자동 재시도 한도 초과)] │
│  │     ErrorMessage (collapsed):                                          │ │
│  │     ┌────────────────────────────────────────────────────────────────┐ │ │
│  │     │ [⚠] 쿠팡 등록 실패                                              │ │ │
│  │     │      카테고리 코드가 유효하지 않습니다. 다시 매핑해주세요.       │ │ │
│  │     │      ▸ 자세히 보기   ID: corr_a1b2…                              │ │ │
│  │     │     [이 마켓만 재시도]  [이 마켓 제외하고 재등록]                 │ │ │
│  │     └────────────────────────────────────────────────────────────────┘ │ │
│  │     시도 3/3  /  마지막: 2026-05-18 14:24                              │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  [전체 실패 마켓 재시도]   [전체 잡 취소(진행 중일 때만)]                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

**버튼 variant (ui-system.md §7.2 + frontend.md §10.5):**
- `[이 마켓만 재시도]` / `[전체 실패 마켓 재시도]` = **실행류** (`primary`). 서버 상태 변경.
- `[이 마켓 제외하고 재등록]` = **실행류** (`secondary`). 새 잡 생성.
- `[전체 잡 취소]` = **실행류 destructive** (`destructive`).
- `[↗ 열기]` = `link` (외부 URL — 새 탭).
- `[← 이력으로]` = `outline`.

### 5.6 실행류 비활성 사유 (`blockingReasons`) — 강제

frontend.md §10.6 패턴. 각 버튼이 disabled 일 때 tooltip 노출.

| 버튼 | disabled 조건 | blockingReasons (한국어, t() 키) |
|---|---|---|
| `[이 마켓만 재시도]` | `marketStatus !== 'failed' && marketStatus !== 'failed_final'` | "성공한 마켓은 재시도할 수 없습니다" |
| (위, 동일) | `job.status === 'succeeded' \|\| 'cancelled'` | "이미 종료된 잡입니다" |
| (위, 동일) | `job.retryCount >= 5` | "재시도 한도(5회)에 도달했습니다" |
| `[전체 실패 마켓 재시도]` | 모든 마켓이 `success` | "재시도할 실패 마켓이 없습니다" |
| (위, 동일) | `job.retryCount >= 5` | "재시도 한도(5회)에 도달했습니다" |
| `[이 마켓 제외하고 재등록]` | 부모 잡이 `pending/running/retrying` | "기존 잡이 종료될 때까지 기다려주세요" |
| (위, 동일) | 제외하고 나면 남는 마켓 0 | "최소 1개 마켓이 있어야 재등록할 수 있습니다" |
| (위, 동일) | 동일 product 로 진행 중 잡 존재 | "이 상품에 진행 중인 잡이 있습니다 (advisory lock)" |
| `[전체 잡 취소]` | `job.status not in ('pending','running','retrying')` | "이미 종료된 잡입니다" |

> **금지**: 단순 `disabled` 처리만 두고 사유 미노출. CLAUDE.md "프론트엔드 UI 일관성" 위반.

### 5.7 에러 탭 (n44 오류 분석) — v1 단순 형태

```
[○ 결과]  [● 에러 (1)]
─────────────────────────────────────────
┌──────────────────────────────────────┐
│ 쿠팡  /  errorCode: validation        │
│ "카테고리 코드가 유효하지 않습니다…" │
│ 발생 시각: 2026-05-18 14:24           │
│ correlation_id: corr_a1b2…            │
│ [이 마켓만 재시도]                    │
└──────────────────────────────────────┘
```

- v1 = 에러 발생 마켓별 카드 나열 (사실상 결과 탭의 실패 카드만 필터링한 뷰).
- v2 = error_code 분포 도넛 차트 + "이번 달 가장 빈번한 에러" (PRD §4.4.2). `carry-over` 행으로 §12 매트릭스에 명시.

### 5.8 데이터·구분이 색에만 의존 금지

ui-system.md §10 "색상에만 의존하지 않기" 강제. partial/failed/succeeded 모두 (1) 색 토큰 (2) lucide 아이콘 (3) 한국어 텍스트 3중 표시 — 위 ASCII 의 `[성공]` / `[실패 …]` 텍스트와 마켓 카드 좌측 컬러 바.

---

## 6. 재시도 흐름 (n24, `registration-retry` 호출)

### 6.1 트리거

| 위치 | 액션 | 인자 |
|---|---|---|
| 마켓 카드의 `[이 마켓만 재시도]` | `registration-retry` | `{ jobId, marketResultIds: [marketResult.id] }` |
| 화면 하단 `[전체 실패 마켓 재시도]` | `registration-retry` | `{ jobId }` (marketResultIds 생략 → 모든 failure_* 재시도) |

함수 시그니처는 `features/registration.md §6.5` 그대로 인용.

### 6.2 UI 시퀀스

```
사용자 클릭
  ↓
confirm 다이얼로그 (ResponsiveDialog)
  "쿠팡에서 재시도하시겠습니까?  retry_count: 1 → 2"
  [취소]  [재시도]
  ↓
mutation 실행 → loading toast "재시도 중…"
  ↓ (응답)
  ├ 200 → success toast "재시도가 시작되었습니다" + Realtime 으로 status='retrying' 수신
  ├ 422 not_retryable → error toast + ErrorMessage 카드 갱신
  ├ 429 retry_exceeded → error toast "재시도 한도(5회)에 도달했습니다"
  └ 401/forbidden → 로그인 페이지로 (Sentry breadcrumb)
```

### 6.3 Mutation hook (frontend.md §5.2 표준)

```ts
// features/history/hooks/useRetryRegistration.ts
export function useRetryRegistration(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { marketResultIds?: string[] }) => {
      const res = await supabase.functions.invoke('registration-retry', {
        body: { jobId, marketResultIds: vars.marketResultIds },
      });
      if (res.error) throw new RegistrationRetryError(res.error);
      return retryResponseSchema.parse(res.data);
    },
    onSuccess: () => {
      // Realtime 이 status='retrying' 으로 갱신해주지만, 응답 즉시 캐시도 패치
      queryClient.invalidateQueries({ queryKey: ['history', 'detail', jobId] });
      queryClient.invalidateQueries({ queryKey: ['history', 'list'] });
      toast.success('재시도가 시작되었습니다');
    },
    onError: (err) => {
      logger.warn({ jobId, errCode: err.code }, 'retry failed');
      toast.error(humanizeRetryError(err));
    },
  });
}
```

### 6.4 Realtime 으로 status 변경 수신

- `registration_jobs.status` 가 `retrying → running → (partial|succeeded|failed)` 로 변하면 `['history','detail',jobId]` 자동 패치 (registration-job-state.md §8 채널).
- 마켓 결과 row 의 `market_status` 변경도 동일.

---

## 7. 마켓 제외 후 재등록 (n25, `registration-start` + `parentJobId`)

### 7.1 트리거

마켓 카드의 `[이 마켓 제외하고 재등록]` 또는 화면 하단 `[제외 후 재등록]`.

### 7.2 UI 시퀀스

```
사용자 클릭
  ↓
Sheet (mobile) 또는 Dialog (desktop):
  "재등록할 마켓을 선택하세요"
  ☑ 네이버 (이전 잡: 성공)         ← 사용자가 체크 해제 가능
  ☐ 쿠팡   (이전 잡: 실패)         ← 기본 미체크 (실패 마켓 제외)
  ──────────
  포함된 마켓: 1개 / 제외: 1개
  [취소]  [재등록 시작]
  ↓
mutation: registration-start({ productId, marketIds: ['naver'], parentJobId: jobId })
  ↓ (응답)
  ├ 200 { jobId: newJobId } → 라우팅: /history/:newJobId (이력 상세로 바로)
  ├ 409 job_in_progress → "이 상품에 진행 중인 잡이 있습니다" toast
  ├ 422 no_markets_selected → "최소 1개 마켓이 필요합니다" toast
  └ 401/forbidden → 로그인
```

### 7.3 결정 — 새 잡 분기

- registration-job-state.md §7 "결정: 새 잡 분기" 그대로 인용. UI 는 새 잡 ID 로 라우팅.
- 사용자에게 "재등록 잡 #c2d3…" 으로 명시. 부모 잡 상세에는 "하위 재등록 잡 N건" 표시 (§5.5).

### 7.4 blockingReasons 재확인

- features/registration.md §16.3 인용: 부모 잡이 `pending/running/retrying` 이면 거부 (advisory lock). UI 는 §5.6 표대로 사유 노출.

---

## 8. 상태 처리 — loading / data / error / empty / partial

frontend.md §9 "4+1" 패턴 강제.

### 8.1 목록 화면

| 상태 | UI |
|---|---|
| `loading` | Skeleton 행 5개 (ui-system.md §7 `Skeleton`). 필터 사이드바는 즉시 인터랙티브 |
| `data` | 잡 행 N개. partial 행은 좌측에 노란 막대 (status 토큰) + "1성공 / 1실패" 카운트 |
| `error` | 중앙에 `ErrorMessage` (title="이력을 불러오지 못했습니다", actions=[{label:'다시 시도', onClick:refetch}]) |
| `empty` | 필터 결과 0건 → "조건에 맞는 잡이 없습니다 [필터 초기화]" / 전체 잡 0건 → "아직 등록 이력이 없습니다 [상품 등록하러 가기]" 두 형태 구분 |
| `partial` | (목록에서는 적용 안 됨. 목록 자체가 partial 잡 N개 + 다른 잡 M개 혼재할 뿐) |

### 8.2 상세 화면

| 상태 | UI |
|---|---|
| `loading` | 잡 메타 영역 Skeleton + 마켓 결과 카드 Skeleton 2개 |
| `data` | 위 §5.5 ASCII |
| `error` | 잡 메타가 비어있으면 전체 ErrorMessage (notFound 또는 권한 거부). 마켓 결과 일부만 오류면 해당 카드만 ErrorMessage |
| `empty` | 잡 id 가 RLS 로 차단되거나 존재하지 않음 → "잡을 찾을 수 없습니다 (id: …)" + [이력으로 돌아가기] |
| **`partial`** | **목록 행 + 상세 헤더의 status 뱃지가 `partial`. 마켓 결과 카드는 성공/실패 혼재** — ui-system.md §10 디자이너 의견 인용: "실패 N건 카드를 1차 배치, 성공 M건은 default expanded but visually 보조" |

### 8.3 partial 상세 시각화 (ui-system.md §10 인용)

```
[⚠ partial — 1건 성공, 1건 실패]   ← 상단 헤더 뱃지 (warning 토큰)
─────────────────────────────────
실패 카드  ← 먼저 노출 (손실 회피 UX)
  ┌──────────────────────────┐
  │ [C] 쿠팡  /  실패          │
  │     ErrorMessage 펼쳐짐    │
  │     [이 마켓만 재시도] ...  │
  └──────────────────────────┘

성공 카드  ← 아래
  ┌──────────────────────────┐
  │ [N] 네이버  /  성공         │
  │     외부 상품 URL [↗]      │
  └──────────────────────────┘
```

---

## 9. 에러 매핑 — RPC / Edge Function 에러 → 한국어

| 코드 | 출처 | 한국어 (locales/ko.ts) | 동선 |
|---|---|---|---|
| `not_found` | get_registration_job 결과 null | "이력을 찾을 수 없거나 접근 권한이 없습니다" | `[이력으로 돌아가기]` |
| `unauthorized` | Supabase 401 | "다시 로그인해주세요" | `/login` 리다이렉트 |
| `rls_denied` (서버 5xx 변환) | RLS 차단 | "이력을 찾을 수 없거나 접근 권한이 없습니다" (동일 — enumeration 방지) | `[이력으로 돌아가기]` |
| `not_retryable` (registration-retry 422) | `failed_final` 재시도 시도 | "이 마켓은 더 이상 자동 재시도할 수 없습니다. 상품/카테고리를 수정하고 새 등록을 시도하세요" | 새 등록 페이지 link |
| `retry_exceeded` (429) | retry_count ≥ 5 | "재시도 한도(5회)에 도달했습니다. 새로 등록해주세요" | 동상 |
| `job_in_progress` (registration-start 409) | advisory lock | "이 상품에 진행 중인 잡이 있습니다. 종료 후 다시 시도하세요" | 진행 중 잡 link |
| `forbidden_product` (403) | 다른 셀러 product | "권한이 없습니다" | dashboard |
| `network_offline` | fetch 실패 | "네트워크 연결을 확인해주세요" | 재시도 버튼 |
| `unknown` | 분류 실패 | "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요" | Sentry 자동 보고 |

마켓 측 `error_code` 자체의 한국어화는 features/registration.md §12 가 ground truth. 본 문서는 RPC/Edge Function 호출 결과 코드만 다룬다.

---

## 10. 성능

### 10.1 인덱스 (registration-job-state.md §3.2 / §3.3 인용)

- 이미 `idx_registration_jobs_seller_created (seller_id, created_at desc)` 존재 — 목록 정렬·필터 핵심.
- 본 문서 추가 권장 (Phase 4 마이그레이션):

```sql
-- 상품명 검색 (ILIKE) 가속용 trigram
create extension if not exists pg_trgm;
create index if not exists idx_products_name_trgm
  on public.products using gin (name gin_trgm_ops);

-- jmr 의 market_id 필터 EXISTS 가속
-- 이미 idx_jmr_market_status 가 있지만 (market_id, market_status) 복합이라 market_id 단독에는 prefix 매칭 가능. 추가 인덱스 불필요.

-- parent_job_id 조회 (children 집계 가속)
-- 이미 idx_registration_jobs_parent 가 partial index 로 존재.
```

### 10.2 페이지 크기

- 기본 20, 옵션 50. v1 은 두 값만. 100+ 는 v2 (모바일 메모리 부담).
- 결정: **keyset (cursor) 페이지네이션**. offset 거부 — 깊은 페이지에서 비효율 + RLS 와 함께 plan 이 흔들림.
- cursor = `(created_at desc, id desc)` 튜플. URL: `?cursor=2026-05-17T18:00:00Z&cursorId=…`.

### 10.3 총 개수 (`total_count`)

- v1 = 정확 count. 잡 수가 셀러당 수천 건 수준으로 가정 (월 100~500건 × 12개월).
- 수십만 건 도달 시 estimated count (`pg_class.reltuples`) 로 전환 — v2.

### 10.4 무한 스크롤 vs 페이지네이션

- **데스크탑** = 페이지네이션 (`[이전] 1/N [다음]`). 깊은 페이지로 이동 / 공유 / 뒤로가기 호환.
- **모바일** = `[더 불러오기]` 버튼 (TanStack Query `useInfiniteQuery`). 자동 무한 스크롤은 v2 (스크롤 위치 보존 복잡).

### 10.5 Realtime 부하

- 셀러당 평균 동시 진행 잡 ≤ 2 (MVP). 목록 화면이 열려 있을 때만 구독.
- registration-job-state.md §8.2 의 디바운스 정책 인용: 같은 잡 id 의 status 변화가 1초 안에 3회 이상이면 마지막만 반영 (frontend 측 lodash debounce 300ms).

### 10.6 부하 예산

- `list_registration_jobs` P95 응답 ≤ 500ms (잡 1000행 + 마켓 결과 5000행 기준, supabase db.medium 가정). 측정은 Phase 4 QA.
- `get_registration_job` P95 ≤ 200ms.

---

## 11. 접근성 (WCAG 2.1 AA)

testing.md §9, ui-system.md §12 인용.

### 11.1 키보드 동선

- Tab 순서: 필터 (period radio → 마켓 checkbox → 상태 checkbox → 검색 input → 적용 버튼) → 페이지네이션 → 잡 행들 (각 행은 Link, Enter 로 상세 진입).
- 상세 화면: 탭 (Tabs 컴포넌트) → 마켓 결과 카드들 → ErrorMessage 의 토글 / 액션 버튼들.
- Esc: 필터 sheet (모바일) 닫기. Dialog 의 confirm 닫기.

### 11.2 aria

- 필터 사이드바: `<aside role="search" aria-label="이력 필터">`.
- 마켓 다중 선택: `<fieldset><legend>마켓</legend>` + `<Checkbox aria-checked>`. **`aria-multiselectable` 은 listbox role 일 때만 의미** — fieldset/checkbox 조합이라 불필요. 사용자 요청에 있던 표현 정정.
- 상태 뱃지: `aria-label="상태: 부분 성공"` (색에 의존 금지).
- partial 헤더: `role="status"` + `aria-live="polite"` (Realtime 으로 상태 변화 시 스크린리더 알림).
- 잡 행 thumbnail `<img alt="...상품 썸네일">`. 빈 alt 금지.
- ErrorMessage: ui-system.md §8.4 그대로.

### 11.3 색 대비

- partial 뱃지 (`#B45309 / #FFFBEB`) = 5.4:1 ✅ (ui-system.md §12.1).
- 다크 모드 대비도 ui-system.md §12.2 통과.
- 색만으로 partial / failed 구분 금지 — 아이콘 (`AlertTriangle` / `XCircle`) + 텍스트 ("부분 성공" / "실패") 동반.

### 11.4 자동 검증

- `eslint-plugin-jsx-a11y` lint (testing.md §9.1).
- `@axe-core/playwright` 로 `/history` + `/history/:jobId` + 필터 모달 / 확인 다이얼로그 / partial 상태 각각 1회 이상 스캔 (violations.length === 0).

---

## 12. 테스트 매트릭스 (testing.md §4 양식)

`Priority`: `P0` = 보안·데이터 정합·골든 패스 / `P1` = 주요 기능 / `P2` = 보조 동선.

| ID | Given | When | Then | 자동화 | Priority |
|----|-------|------|------|--------|----------|
| **QA-HIST-001** | 셀러 A 가 잡 0건 보유 + `/history` 진입 | 페이지 로드 | empty 상태 ("아직 등록 이력이 없습니다") + [상품 등록하러 가기] CTA 노출 | RTL + Playwright | P1 |
| **QA-HIST-002** | 셀러 A 가 잡 25건 (succeeded 15 / partial 5 / failed 5) | `/history?pageSize=20` 진입 | 20행 노출, total_count=25, [다음 →] 활성 | Vitest + Playwright | P1 |
| **QA-HIST-003** | 셀러 A 가 잡 100건 + 필터 `period=7d` 적용 | 필터 적용 | URL `?period=7d` 갱신, refetch, 7일 이내 잡만 노출 | RTL + Playwright | P1 |
| **QA-HIST-004** | 셀러 A 가 잡 50건 + 필터 `market=coupang` 다중 (markets=[coupang]) | 체크박스 클릭 | URL `?market=coupang`, 쿠팡 결과 행을 1개 이상 가진 잡만 노출 | RTL | P1 |
| **QA-HIST-005** | 셀러 A 가 partial 잡 1건 + failed 잡 1건 + 필터 `statuses=[partial,failed]` | 체크박스 둘 다 클릭 | URL `?status=partial&status=failed`, 두 잡 모두 노출, 다른 상태는 미노출 | Playwright | P1 |
| **QA-HIST-006** | 셀러 A 가 잡 ("무선 이어폰", "캠핑 의자") + 필터 `q=이어폰` | 검색창 입력 + Enter | "무선 이어폰" 행만 노출, ILIKE 매칭 검증 | RTL + Vitest (RPC) | P1 |
| **QA-HIST-007** | 셀러 A 가 잡 30건 + period=custom + from=2026-05-01, to=2026-04-30 (from>to) | 필터 적용 시도 | superRefine fail 메시지 "from 은 to 이전이어야 합니다" 노출, refetch 안 함 | Vitest | P1 |
| **QA-HIST-008** (RLS 격리) | 셀러 A 와 B 각자 잡 있음. A 로 로그인 | `list_registration_jobs` 호출 | A 의 잡만 노출 (B 잡 0건 누락). 추가로 B 의 jobId URL 직접 진입 시 `/history/:jobId` notFound | RLS-SQL + Playwright | **P0** |
| **QA-HIST-009** (RLS bypass 시도) | 셀러 B 가 셀러 A 의 잡 id 를 PostgREST 로 직접 SELECT | 직접 호출 | 0 rows. Sentry 에 PII 없는 access denied breadcrumb | RLS-SQL | **P0** |
| **QA-HIST-010** (재시도 happy n24) | 셀러 A 가 partial 잡 (네이버 success, 쿠팡 failed) 보유 | `[이 마켓만 재시도]` 클릭, MSW: 쿠팡 200 | `registration-retry` 호출, 잡 status `retrying → running → succeeded`, Realtime 으로 UI 갱신 ≤ 2s | Playwright + MSW | **P0** |
| **QA-HIST-011** (재시도 한도) | retry_count=5 인 잡 | `[재시도]` 클릭 시도 | 버튼 disabled, tooltip "재시도 한도(5회)에 도달했습니다", 클릭해도 mutation 안 일감 | RTL + Vitest | P1 |
| **QA-HIST-012** (재시도 not_retryable) | failed_final 마켓 결과 | `[이 마켓만 재시도]` 클릭 시도 | 422 not_retryable, error toast + 마켓 카드의 [재시도] 버튼 disabled 로 전환 | Vitest + Playwright | P1 |
| **QA-HIST-013** (n25 마켓 제외) | partial 잡 (네이버 성공, 쿠팡 실패) | `[이 마켓 제외하고 재등록]` → Sheet 에서 네이버 체크 해제, 쿠팡만 체크는 사용자 시나리오에서 거의 없으므로 네이버 단독 재등록 케이스로 → `[재등록 시작]` | 새 잡 생성, parent_job_id=원본, marketIds=[naver], `/history/:newJobId` 라우팅 | Playwright | **P0** |
| **QA-HIST-014** (n25 모든 마켓 제외 시도) | partial 잡 | 재등록 Sheet 에서 모든 마켓 체크 해제 | `[재등록 시작]` disabled + tooltip "최소 1개 마켓이 있어야 재등록할 수 있습니다" | RTL | P1 |
| **QA-HIST-015** (n25 부모 잡 진행 중) | running 잡 | `[제외 후 재등록]` 클릭 시도 | 버튼 disabled + tooltip "기존 잡이 종료될 때까지 기다려주세요" | RTL | P1 |
| **QA-HIST-016** (마켓 5xx → 재시도 후 성공) | partial 잡 (쿠팡 5xx 재시도 한도 초과) | `[이 마켓만 재시도]` + MSW: 쿠팡 200 | retry_count++, 잡 status → succeeded, 마켓 결과 success | Vitest + MSW | P1 |
| **QA-HIST-017** (마켓 4xx validation 재시도) | failed (validation) 잡 | `[재시도]` 클릭 | 422 not_retryable (validation 은 자동 재시도 ❌, registration-job-state.md §6.2). UI: "상품 정보를 수정하고 새 등록을 시도하세요" | Vitest | P1 |
| **QA-HIST-018** (마켓 429 rate_limit) | running 잡에서 mock 어댑터 429 → 자동 백오프 후 success | (자동) | 마켓 결과 attempt_count=2, 잡 status=succeeded. 사용자 액션 불필요. 이력 행은 succeeded 로 표시 (재시도 액션 없음) | Vitest + MSW | P1 |
| **QA-HIST-019** (마켓 401 oauth_expired) | 잡 실행 중 401 → refresh 자동 → success | (자동) | 잡 status=succeeded. 이력 상세에서 토큰 관련 정보 비노출 (마스킹 검증) | Vitest + 로그 grep | **P0** |
| **QA-HIST-020** (마켓 401 oauth_revoked) | refresh 도 401 | (자동) | 마켓 결과=failed_final(oauth_revoked), 상세 페이지의 ErrorMessage 에 "[마켓 다시 연결]" CTA → `/markets/connect/coupang` 링크 | Playwright | P1 |
| **QA-HIST-021** (네트워크 끊김) | list_registration_jobs fetch 중 offline | (자동) | 4상태 error UI + [다시 시도]. Sentry 자동 보고. | Playwright (offline 모드) | P1 |
| **QA-HIST-022** (동시 입력 충돌) | 셀러 A 가 두 탭에서 동일 잡의 재시도 버튼 동시 클릭 | 두 mutation 동시 fire | 한 쪽 200, 다른 쪽 422 (이미 retrying 상태). 두 번째 UI 는 error toast | Playwright (two contexts) | P1 |
| **QA-HIST-023** (Realtime 진행률) | running 잡 상세 페이지 열린 상태 | 백엔드가 status → succeeded UPDATE | UI 가 ≤ 2s 안에 partial/succeeded 뱃지로 갱신, 마켓 결과 카드도 갱신 | Playwright (Realtime) | P1 |
| **QA-HIST-024** (Realtime fallback) | WebSocket 끊김 | 5s 안에 메시지 없음 | TanStack Query polling 으로 fallback (frontend.md §6.3) | Playwright | P2 |
| **QA-HIST-025** (Realtime 컬럼 누수) | running 잡 UPDATE Realtime payload | 클라이언트 수신 | payload 에 token / email / phone 없음 (publication 정의 검증) | Vitest + Sentry test transport | **P0** |
| **QA-HIST-026** (긴 에러 메시지 접기) | 마켓 결과 error_message 5000자 | 상세 페이지 로드 | ErrorMessage 기본 collapsed, "자세히 보기" 클릭 시 펼침 + max-h-200px 내부 스크롤 | Playwright | P2 |
| **QA-HIST-027** (오래된 잡 표시) | 30일 초과 잡 + period=30d 필터 | 진입 | 빈 결과 (필터에서 빠짐). 단 period=custom 으로 from=1년 전 입력 시 노출. **보관 기간 정책은 §14 미해결** | Vitest | P2 |
| **QA-HIST-028** (부모-자식 잡 트리) | 재등록 잡 진입 (parent_job_id 채워짐) | 상세 페이지 | "부모 잡 보기" 링크 + 부모는 "하위 재등록 1건" 표시 | Playwright | P2 |
| **QA-HIST-029** (a11y 키보드) | `/history` 진입 | Tab 만으로 필터 사이드바 전부 → 잡 행 → 다음 페이지까지 | 모든 인터랙티브 reachable, focus ring 가시, axe violations=0 | Playwright + axe | P1 |
| **QA-HIST-030** (data-testid 비사용) | 모든 spec 코드 검사 | grep | `data-testid` 등장 0 회 (role/label 셀러터만) | CI lint | P2 |
| **QA-HIST-031** (debug ↔ real parity) | mock 어댑터 응답 fixture / real 응답 캡처 | 두 응답으로 jobDetailSchema parse | 둘 다 success, key set 동일 | Vitest (parity.spec) | P1 |
| **QA-HIST-032** (로그 마스킹) | 재시도 mutation 실행 + Sentry test transport | breadcrumb | accessToken / refreshToken / email / phone 0회. correlationId / jobId / sellerId(uuid) 만 | Vitest + Sentry test transport | **P0** |
| **QA-HIST-033** (v2 carry-over: CSV 내보내기) | — | — | `expires: 2026-12-31` 명시, MVP 미구현 | 문서 검증 | carry-over |
| **QA-HIST-034** (v2 carry-over: 오류 통계) | — | — | 동상 | 문서 검증 | carry-over |

### 12.1 실패 시나리오 8종 매핑 (testing.md §5 강제)

| 강제 시나리오 | 대응 행 |
|---|---|
| 마켓 5xx | QA-HIST-016 |
| 마켓 4xx 검증 | QA-HIST-017 |
| 마켓 429 rate_limit | QA-HIST-018 |
| 마켓 401 토큰 만료 | QA-HIST-019, QA-HIST-020 |
| 부분 실패 | QA-HIST-010, QA-HIST-013 |
| 네트워크 끊김 | QA-HIST-021 |
| 동시 입력 충돌 | QA-HIST-022 |
| 권한 누수 (RLS) | QA-HIST-008, QA-HIST-009 |

8종 모두 ≥ 1 행. testing.md §16 R-001 (행복 경로 거부) 통과.

### 12.2 골든 패스 (testing.md §3) 와의 관계

testing.md §3.2 G10 ("s6 이력 진입 → 방금 등록한 잡 1행 노출, 상태 succeeded") 가 본 화면을 1회 통과한다. 골든 패스 spec 내부에서 `/history` 행이 노출되는지 + `/history/:jobId` 의 마켓별 외부 URL 이 클릭 가능한지 검증. QA-HIST-002 / QA-HIST-010 / QA-HIST-013 은 별도 spec.

---

## 13. 수락 기준 체크리스트 (Phase 4 PASS 게이트)

testing.md §13.4 의 `QA-P4-HIST-001` / `-002` 를 본 문서가 채운다. 본 문서가 머지되려면 아래 모두 ✓.

| 항목 | 기준 | 검증 | PASS |
|---|---|---|---|
| 1 | user_flow s6 (n41~n46) 6 노드 매핑 표 존재 | §1.3 | ☐ |
| 2 | 신규 테이블·컬럼 0건 — 모두 인용 | §2 | ☐ |
| 3 | `list_registration_jobs` / `get_registration_job` 시그니처 SQL + 권한 모델 | §3.2 / §3.3 | ☐ |
| 4 | 클라이언트 zod 스키마 (`jobSummarySchema` / `jobDetailSchema` / `historyFilterSchema`) | §3.4 / §4 | ☐ |
| 5 | URL search params → zod 변환 hook | §4.2 | ☐ |
| 6 | 데스크탑·모바일 ASCII (목록 / 상세) 각 1개 이상 | §5.3 / §5.4 / §5.5 | ☐ |
| 7 | Button variant 분리 (검색류 ghost/outline / 실행류 primary/secondary/destructive) 명시 | §5.3 / §5.5 | ☐ |
| 8 | `blockingReasons` 모든 실행류 버튼에 명시 | §5.6 | ☐ |
| 9 | 재시도(n24) `registration-retry` 호출 + 응답 처리 | §6 | ☐ |
| 10 | 마켓 제외(n25) `registration-start + parentJobId` 호출 + 새 잡 라우팅 | §7 | ☐ |
| 11 | 4상태 + partial 처리 (목록·상세 각각) | §8 | ☐ |
| 12 | partial 상세 시각화 (실패 1차 / 성공 2차) | §8.3 (ui-system.md §10 인용) | ☐ |
| 13 | 에러 코드 → 한국어 매핑 표 | §9 | ☐ |
| 14 | 인덱스 / cursor 페이지네이션 / total_count 정책 | §10 | ☐ |
| 15 | 접근성 (키보드 / aria / 색대비 / axe) | §11 | ☐ |
| 16 | 테스트 매트릭스 18+ 행 (실제 30+ 채움) + 실패 8종 모두 매핑 | §12 / §12.1 | ☐ |
| 17 | 골든 패스 G10 인용 | §12.2 | ☐ |
| 18 | 미해결 사안 명시 | §14 | ☐ |
| 19 | security 리뷰 요청 (Realtime payload / cancelled_by 마스킹 / error_message 마스킹) | PR reviewer | ☐ |
| 20 | qa 리뷰 요청 (§12 매트릭스) | PR reviewer | ☐ |
| 21 | frontend 리뷰 요청 (§5 와이어 + §6 hook) | PR reviewer | ☐ |
| 22 | designer 리뷰 요청 (§5 와이어 + §8.3 partial 시각) | PR reviewer | ☐ |
| 23 | architect 승인 | 최종 머지 게이트 | ☐ |
| 24 | 3개 산출물 동기화: 본 문서 + `docs/frontend_html_design/v1/history/*` + `src/features/history/*` 계획 명시 | CLAUDE.md "3개 산출물 동기화" | ☐ |

---

## 14. 미해결 사안

본 문서 머지 후 별도 결정 필요. 결정 시 본 문서 해당 섹션 잠금.

1. **잡 보관 기간.** 무기한 vs 12개월 vs 24개월. 현재 정책 없음. KPI 산출 (PRD §1 핵심지표 "월간 등록 건수") 은 무기한 보관이 유리하지만 비용·검색 성능 측면에서 12개월 archival (cold storage 이동) 검토. **권장: v1 무기한 + Phase 5 출시 후 3개월 시점에 결정** — security 와 운영 비용 공동.
2. **PRD §4.4.2 오류 유형별 통계.** v1 carry-over. error_code 분포 데이터가 1개월 누적된 시점 (베타 4주차)에 도넛 차트 / 표 도입 검토. v2.
3. **PRD §4.4.3 CSV/Excel 내보내기.** v1 carry-open. security 검토 필수 — PII (상품명·마켓 외부 ID) 외부 노출 정책. v2.
4. **전문 검색 (`pg_trgm` / `tsvector`).** §3.2 의 ILIKE 가 잡 수 ≥ 5000 행에서 느려지면 trigram 인덱스 도입. 본 문서 §10.1 권장에 인덱스만 미리 깔고, 검색 쿼리는 v1 그대로.
5. **무한 스크롤 (모바일).** v1 = "더 불러오기" 버튼. v2 = IntersectionObserver 자동 로드 + 스크롤 위치 보존. 결정 시점: 모바일 사용 비율 30% 초과 후.
6. **`children` (재등록 트리) 시각화.** v1 = "하위 N건" 한 줄. v2 = 트리 그래프. 어떤 라이브러리·복잡도인지 designer 가 결정.
7. **부모 잡 + 재등록 잡 결합 통계.** "이 product 의 누적 등록 잡 수 / 성공률" 같은 product-centric 집계는 v2.
8. **`error_message` 의 마켓 응답 raw 마스킹 함수.** registration-job-state.md §13 [5] 와 동일 — security 가 결정. 본 문서는 호출 위치만 인용 (저장 직전, registration-market-worker 안).
9. **debug 모드의 `correlation_id` 표시.** 현재 §5.5 ASCII 에 "debug 모드만" 으로 표기. real 모드에서 사용자에게 노출할지 / 운영팀만 볼지. 권장: real 도 표시 (Sentry 추적 강화) but tooltip 으로 "운영 추적용" 명시.

---

## 15. 보안 검수 요청 (security 에이전트 @멘션)

testing.md §16 R-007 / registration-job-state.md §13 인용. 본 문서 신설 항목만 추가:

- [ ] §3.2 `list_registration_jobs` 의 `auth.uid()` 명시 + RLS 자동 적용 이중 방어 검토. plan stability 와 별개로 RLS bypass 가능 경로 없는지.
- [ ] §3.3 `get_registration_job` 의 `cancelledByMaskedId` 처리. uuid 8자 prefix 가 enumeration / 추적 위험 없는지.
- [ ] §3.3 응답의 `error_message` 컬럼 노출. 저장 시점 마스킹 함수가 화이트리스트 기반인지 / 토큰·이메일·전화 마스킹이 전수인지.
- [ ] §5.5 debug 모드 `correlation_id` 노출. real 에서 노출 시 사용자 추적 ID 와 분리되는지.
- [ ] §6.3 mutation hook 의 `logger.warn` payload 에 마스킹 미적용 변수 없는지.
- [ ] §9 에러 코드 한국어 메시지가 `rls_denied` 와 `not_found` 를 동일 텍스트로 통일하는 것 (enumeration 방지) 의 적절성.
- [ ] Realtime publication 화이트리스트 (registration-job-state.md §8.3) 가 본 화면 도입으로 변경되지 않음을 확인.

---

## 16. 3개 산출물 동기화 (CLAUDE.md "Rules" 강제)

본 문서 머지 시 동시 갱신:

- **설계문서 (본 문서)** — 본 파일.
- **HTML 프로토타입** — `docs/frontend_html_design/v1/history/` 신설. 와이어 §5 의 데스크탑/모바일 2종 정적 HTML.
- **실제 구현** — `src/features/history/` 디렉토리 생성 (frontend.md §3.1 인용). `pages/HistoryListPage.tsx` / `pages/HistoryDetailPage.tsx` / `hooks/useHistoryFilters.ts` / `hooks/useRetryRegistration.ts` / `api/list-jobs.ts` / `api/get-job.ts` / `types/filters.ts`. zod 스키마는 `src/lib/schemas/history.ts` 에 단일 소스.

세 산출물 중 어느 하나라도 누락된 PR 은 거부 (CLAUDE.md "변경 크기와 무관하게 예외 없음").

---

> **본 문서는 features/registration.md / cross-cutting/registration-job-state.md 의 ground truth 를 인용하는 위치이지 재정의하지 않는다.** 상태 모델·재시도 규칙·RLS 정책 변경이 필요하면 그 두 문서를 먼저 갱신하고 본 문서는 인용만 갱신한다. 본 문서가 단독으로 백엔드 동작을 바꾸지 않는다.
