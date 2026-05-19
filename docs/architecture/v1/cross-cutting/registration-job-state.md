# RegistrationJob 상태 모델 (Cross-Cutting)

> **위치**: `docs/architecture/v1/cross-cutting/registration-job-state.md`
> **상태**: v1 확정 (Phase 3 features/registration.md 의 ground truth)
> **소유**: backend 에이전트 (ing-backend / INTJ)
> **변경 영향도**: ★★★★★ — 본 문서 상태 전이표가 흔들리면 Phase 3 전수 재작성. 변경 시 PR 에 security · qa · frontend 모두 reviewer 지정 필수.

---

## 1. 목적 · 범위

다중 마켓 일괄 등록 잡(`RegistrationJob`)의 **상태 7개와 전이 규칙, 데이터 모델, 재시도·취소·partial 판정 정책, 오케스트레이터 시퀀스**를 단일 ground truth 로 정의한다.
대상 독자는 backend (Edge Function `registration-run`, Postgres RPC 작성자), frontend (대시보드·이력 화면), qa (테스트 매트릭스 설계자) 에이전트.
범위 외: 마켓 어댑터 내부 구현(별도 `MarketAdapter` 문서), OAuth 토큰 갱신 흐름(`docs/architecture/v1/features/markets.md`), Sentry 마스킹 규칙(`security.md`).

---

## 2. 도메인 모델 ERD

```
                   ┌──────────────────────┐
                   │   auth.users         │  (Supabase Auth)
                   │   id (uuid, PK)      │
                   └──────────┬───────────┘
                              │ 1
                              │
                              ▼ N
┌──────────────────────┐    ┌──────────────────────────┐    ┌──────────────────────┐
│   products           │    │   sellers (= auth.users  │    │  market_accounts     │
│   id (uuid, PK)      │    │   투영, RLS owner key)   │    │  id (uuid, PK)       │
│   seller_id (FK)─────┼───►│                          │◄───┤  seller_id (FK)      │
│   name               │    │                          │    │  market_id (text)    │
│   ...                │    │                          │    │  access_token_enc    │
└──────────┬───────────┘    └──────────────────────────┘    │  refresh_token_enc   │
           │ 1                                              │  expires_at          │
           │                                                └──────────┬───────────┘
           ▼ N                                                         │
┌────────────────────────────────────────────┐                         │
│   registration_jobs                        │                         │
│   id (uuid, PK)                            │                         │
│   seller_id (FK → auth.users.id)           │                         │
│   product_id (FK → products.id)            │                         │
│   status (registration_job_status ENUM)    │                         │
│   created_at, started_at, completed_at     │                         │
│   retry_count (smallint, ≤ 5)              │                         │
│   error_summary (text, nullable)           │                         │
│   cancelled_by (uuid, nullable)            │                         │
│   parent_job_id (FK self, nullable)        │  ← n25 마켓 제외 재등록 │
│   correlation_id (uuid)                    │                         │
└──────────┬─────────────────────────────────┘                         │
           │ 1                                                         │
           │                                                           │
           ▼ N                                                         │
┌────────────────────────────────────────────┐                         │
│   registration_job_market_results          │                         │
│   id (uuid, PK)                            │                         │
│   job_id (FK → registration_jobs.id)       │                         │
│   market_id (text)  ─── 논리키 → market_accounts (seller_id, market_id)
│   market_account_id (FK → market_accounts) ┼─────────────────────────┘
│   market_status (market_result_status ENUM)│
│   external_product_id (text, nullable)     │
│   product_url (text, nullable)             │
│   error_code (text, nullable)              │
│   error_message (text, nullable)           │
│   attempt_count (smallint, ≤ 3)            │
│   last_attempted_at (timestamptz)          │
│   excluded (boolean, default false)        │ ← n25 사용자가 이번 잡에서 제외
│   created_at, updated_at                   │
│   UNIQUE (job_id, market_id)               │
└────────────────────────────────────────────┘
```

**카디널리티 메모:**
- `registration_jobs` : `registration_job_market_results` = 1 : N (N 은 사용자가 선택한 마켓 개수, MVP 에서는 1~2, 이론상 5 이내).
- `registration_jobs.parent_job_id` 는 n25 "마켓 제외 후 재등록" 흐름에서만 채워진다. 새 잡으로 분기하되 추적성 유지.
- 같은 `(job_id, market_id)` 조합은 유일. 마켓별 재시도는 row 신설이 아니라 `attempt_count++` + `last_attempted_at` 갱신.

---

## 3. Postgres DDL

### 3.1. ENUM

```sql
-- 상위 잡 상태 (7개)
create type registration_job_status as enum (
  'pending',     -- 큐잉됨, 아직 한 마켓도 호출 안 함
  'running',     -- 하나 이상의 마켓 호출 in-flight
  'partial',     -- 잡 종료, 일부 마켓 성공/일부 실패
  'succeeded',   -- 잡 종료, 모든 마켓 성공
  'failed',      -- 잡 종료, 모든 마켓 실패 (재시도 한도 초과 포함)
  'retrying',    -- 실패한 마켓을 자동 재시도 중 (전체 잡 retry_count++)
  'cancelled'    -- 사용자가 명시적으로 취소
);

-- 마켓별 결과 상태 (5개)
create type market_result_status as enum (
  'pending',       -- 아직 호출 안 함
  'in_flight',     -- 호출 중
  'success',       -- 외부 상품 ID 받음
  'failed',        -- 마켓 호출 실패, 재시도 한도 내
  'failed_final'   -- 재시도 한도 초과, 더 이상 시도 안 함
);
```

`registration_job_status` 와 `market_result_status` 는 **분리**한다. 상위 잡 상태는 사용자에게 보여줄 거시 상태, 마켓별 상태는 오케스트레이터·재시도 로직이 보는 미시 상태. 혼동 금지.

### 3.2. `registration_jobs`

```sql
create table public.registration_jobs (
  id              uuid primary key default gen_random_uuid(),
  seller_id       uuid not null references auth.users(id) on delete cascade,
  product_id      uuid not null references public.products(id) on delete restrict,
  status          registration_job_status not null default 'pending',
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  retry_count     smallint not null default 0 check (retry_count >= 0 and retry_count <= 5),
  error_summary   text,
  cancelled_by    uuid references auth.users(id),
  cancelled_at    timestamptz,
  parent_job_id   uuid references public.registration_jobs(id) on delete set null,
  correlation_id  uuid not null default gen_random_uuid(),

  -- 상태와 타임스탬프 정합성 (DB 레벨 가드)
  constraint chk_terminal_completed_at check (
    (status in ('succeeded', 'failed', 'partial', 'cancelled')) = (completed_at is not null)
  ),
  constraint chk_running_started_at check (
    (status in ('running', 'retrying')) <= (started_at is not null)
  ),
  constraint chk_cancelled_fields check (
    (status = 'cancelled') = (cancelled_by is not null and cancelled_at is not null)
  )
);

create index idx_registration_jobs_seller_status
  on public.registration_jobs (seller_id, status);

create index idx_registration_jobs_seller_created
  on public.registration_jobs (seller_id, created_at desc);

create index idx_registration_jobs_status_running
  on public.registration_jobs (status)
  where status in ('pending', 'running', 'retrying');

create index idx_registration_jobs_parent
  on public.registration_jobs (parent_job_id)
  where parent_job_id is not null;
```

### 3.3. `registration_job_market_results`

```sql
create table public.registration_job_market_results (
  id                 uuid primary key default gen_random_uuid(),
  job_id             uuid not null references public.registration_jobs(id) on delete cascade,
  market_id          text not null,           -- 'naver' | 'coupang' | '11st' | 'gmarket' | 'auction'
  market_account_id  uuid not null references public.market_accounts(id) on delete restrict,
  market_status      market_result_status not null default 'pending',
  external_product_id text,
  product_url        text,
  error_code         text,
  error_message      text,
  attempt_count      smallint not null default 0 check (attempt_count >= 0 and attempt_count <= 3),
  last_attempted_at  timestamptz,
  excluded           boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint uq_job_market unique (job_id, market_id),

  constraint chk_success_has_external_id check (
    (market_status = 'success') <= (external_product_id is not null)
  ),
  constraint chk_failed_has_error check (
    (market_status in ('failed', 'failed_final')) <= (error_code is not null)
  )
);

create index idx_jmr_job on public.registration_job_market_results (job_id);
create index idx_jmr_market_status on public.registration_job_market_results (market_id, market_status);

create or replace function public.tg_jmr_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_jmr_updated_at
before update on public.registration_job_market_results
for each row execute function public.tg_jmr_set_updated_at();
```

### 3.4. RLS 정책

**모든 테이블에 RLS 활성화 필수.** 셀러는 본인 데이터만, Edge Function 의 service_role 만 cross-seller 접근.

```sql
-- registration_jobs
alter table public.registration_jobs enable row level security;
alter table public.registration_jobs force row level security;

create policy "rj_select_own"
  on public.registration_jobs for select
  to authenticated
  using (seller_id = auth.uid());

create policy "rj_insert_own"
  on public.registration_jobs for insert
  to authenticated
  with check (seller_id = auth.uid());

-- 사용자 직접 UPDATE 는 cancel 만 허용. 그 외 상태 전이는 RPC(security definer) 경유.
create policy "rj_update_cancel_only"
  on public.registration_jobs for update
  to authenticated
  using (seller_id = auth.uid())
  with check (
    seller_id = auth.uid()
    and status = 'cancelled'  -- 새 row 의 상태가 cancelled 일 때만 통과
  );

-- DELETE 는 클라이언트 불허. 정리는 운영 batch (service_role) 만.
create policy "rj_no_delete"
  on public.registration_jobs for delete
  to authenticated
  using (false);

-- registration_job_market_results
alter table public.registration_job_market_results enable row level security;
alter table public.registration_job_market_results force row level security;

create policy "jmr_select_own"
  on public.registration_job_market_results for select
  to authenticated
  using (
    exists (
      select 1 from public.registration_jobs rj
      where rj.id = registration_job_market_results.job_id
        and rj.seller_id = auth.uid()
    )
  );

-- 클라이언트는 INSERT/UPDATE/DELETE 직접 금지. 오케스트레이터(service_role) 전용.
create policy "jmr_no_write_client"
  on public.registration_job_market_results for all
  to authenticated
  using (false)
  with check (false);
```

**service_role 경로**: `registration-run` Edge Function 은 service_role 키로 동작. RLS bypass 정당화 사유는 `docs/architecture/v1/security.md` §service-role-paths 에 명시되어 있다고 가정. 본 경로에서 셀러 데이터 cross-tenant 누출이 없도록 `seller_id` 를 매 쿼리 WHERE 절에 강제 — security 검수 필수.

### 3.5. 상태 전이 RPC

```sql
create or replace function public.rpc_cancel_registration_job(p_job_id uuid)
returns public.registration_jobs
language plpgsql
security invoker  -- RLS 통과해야 함
as $$
declare
  v_row public.registration_jobs;
begin
  update public.registration_jobs
    set status = 'cancelled',
        cancelled_by = auth.uid(),
        cancelled_at = now(),
        completed_at = now()
  where id = p_job_id
    and seller_id = auth.uid()
    and status in ('pending', 'running', 'retrying')
  returning * into v_row;

  if v_row.id is null then
    raise exception 'cancel_not_allowed' using errcode = 'P0001';
  end if;

  return v_row;
end;
$$;
```

오케스트레이터 측 상태 전이는 Edge Function 내부의 `nextStatus()` 순수 함수 + service_role UPDATE 로 처리한다(§10).

---

## 4. 7상태 전이표

행 = 현재 상태, 열 = 목표 상태. ✅ = 합법, ❌ = 불법(시도 시 오케스트레이터가 거부 + Sentry warn 로그).

| from \ to     | pending | running | partial | succeeded | failed | retrying | cancelled |
|---------------|:-------:|:-------:|:-------:|:---------:|:------:|:--------:|:---------:|
| **pending**   |   ❌    |   ✅    |   ❌    |    ❌     |   ❌   |    ❌    |    ✅     |
| **running**   |   ❌    |   ❌    |   ✅    |    ✅     |   ✅   |    ✅    |    ✅     |
| **partial**   |   ❌    |   ❌    |   ❌    |    ❌     |   ❌   |    ✅    |    ❌     |
| **succeeded** |   ❌    |   ❌    |   ❌    |    ❌     |   ❌   |    ❌    |    ❌     |
| **failed**    |   ❌    |   ❌    |   ❌    |    ❌     |   ❌   |    ✅    |    ❌     |
| **retrying**  |   ❌    |   ✅    |   ❌    |    ❌     |   ❌   |    ❌    |    ✅     |
| **cancelled** |   ❌    |   ❌    |   ❌    |    ❌     |   ❌   |    ❌    |    ❌     |

**Terminal 상태**: `succeeded` / `cancelled` 는 절대 다른 상태로 못 간다.
**Semi-terminal**: `partial` / `failed` 는 사용자 트리거(자동 재시도 또는 수동 재시도)로 `retrying` 만 가능. 직접 `running` 으로 못 감.

### 4.1. 합법 전이 트리거 이벤트

| 전이 | 트리거 이벤트 | 발생 위치 |
|------|---------------|-----------|
| `pending → running` | 오케스트레이터가 첫 마켓 호출 직전 `started_at = now()` 세팅 | `registration-run` 진입 |
| `pending → cancelled` | 사용자가 시작 전 취소 | `rpc_cancel_registration_job` |
| `running → succeeded` | 모든 마켓 결과 `success` | 오케스트레이터 종료 직전 판정 |
| `running → partial` | 일부 `success`, 일부 `failed_final` | 오케스트레이터 종료 직전 판정 |
| `running → failed` | 모든 마켓 `failed_final` | 오케스트레이터 종료 직전 판정 |
| `running → retrying` | 일부 마켓이 retryable 실패, 전체 `retry_count < 5` | 오케스트레이터가 재시도 결정 |
| `running → cancelled` | 사용자가 진행 중 취소 (`rpc_cancel_registration_job`) | RPC |
| `partial → retrying` | 사용자가 "실패 마켓만 재시도" 버튼 클릭 | features/registration.md `rpc_retry_registration_job` |
| `failed → retrying` | 사용자가 "전체 재시도" 클릭 | 동상 |
| `retrying → running` | 재시도 백오프 종료, 실제 마켓 호출 재개 | 오케스트레이터 |
| `retrying → cancelled` | 사용자가 재시도 중 취소 | RPC |

### 4.2. 불법 전이 예시 (실수하기 쉬운 케이스)

- `pending → succeeded` ❌ : 한 번도 마켓 호출 안 한 잡이 성공할 수 없음. 반드시 `running` 경유.
- `partial → succeeded` ❌ : partial 은 잡 종료 시점 판정이라 직접 갱신 금지. 재시도로 `retrying → running → succeeded` 경유.
- `succeeded → *` ❌ : 종착. 재등록은 별도 새 잡(`parent_job_id` 연결).
- `cancelled → *` ❌ : 종착. 재시도하려면 새 잡 신설.
- `failed → running` ❌ : `retrying` 경유 필수 (retry_count 증가 + 이벤트 발행을 위해).

---

## 5. `partial` vs `succeeded` vs `failed` 판정 규칙

오케스트레이터가 모든 마켓 호출(또는 재시도) 종료 후 **단 한 번** 판정한다. 판정 함수는 `decideTerminalStatus()` 순수 함수로 §10 에 정의.

판정 입력: 잡에 속한 모든 `registration_job_market_results` 의 `market_status` 집합 (단, `excluded = true` 인 row 는 제외).

| 모든 마켓 결과 (excluded 제외) | 최종 잡 상태 |
|-------------------------------|--------------|
| 100% `success` | `succeeded` |
| ≥ 1 `success` 이고 나머지가 `failed_final` | `partial` |
| 100% `failed_final` | `failed` |
| 1 개 이상 `pending` 또는 `in_flight` 또는 `failed`(non-final) 잔존 | **판정 금지** — 아직 종료 시점 아님 |
| (이전 단계에서) 사용자 명시 취소 | `cancelled` (판정 함수 미진입) |

**Excluded 처리:** 사용자가 n25 흐름에서 "이 마켓 제외하고 재등록" 선택 시 새 잡의 해당 row 는 `excluded = true`. 판정에서 제외하므로 나머지 마켓이 모두 success 면 새 잡은 `succeeded`.
**Edge case**: 모든 마켓이 excluded 면? → 새 잡 생성 자체를 막는다(features/registration.md API 레벨 검증). DB 레벨에는 강제 안 함.

---

## 6. 재시도 규칙

### 6.1. 두 레벨의 재시도

| 레벨 | 카운터 | 한도 | 의미 |
|------|--------|------|------|
| 잡 전체 | `registration_jobs.retry_count` | **5** | 사용자가 partial/failed 잡을 재시도한 횟수 (자동 + 수동 합산) |
| 마켓 단위 | `registration_job_market_results.attempt_count` | **3** | 단일 마켓 호출 시도 횟수 (초기 1 + 자동 백오프 재시도 최대 2) |

마켓별 `attempt_count` 가 3 에 도달하면 해당 row 는 `failed_final`. 더 이상 자동 재시도 없음. 사용자가 잡 전체 재시도(`retrying`)를 트리거하면 `failed_final` row 의 `attempt_count` 가 **리셋되지 않고** 0 부터 다시 카운트되는 새 잡(`parent_job_id`)이 권장 경로(§7). 단, "동일 잡 내 사용자 트리거 재시도"를 허용하면 row 의 attempt_count 를 reset 하는 RPC 가 필요 — MVP 는 **새 잡 분기로 단일화**.

### 6.2. `error_code` 분류와 재시도 가능 여부

마켓 어댑터는 모든 실패에 `error_code` 를 부여해야 한다. 분류 미명시 = `unknown` (재시도 불가).

| error_code | 의미 | 자동 재시도 | 백오프 | 사용자 액션 |
|------------|------|:-----------:|--------|-------------|
| `rate_limit` | 마켓 429 | ✅ | exponential, base 2s, max 30s | 자동 |
| `timeout` | 네트워크 timeout / 마켓 응답 지연 | ✅ | exponential, base 1s, max 15s | 자동 |
| `market_5xx` | 마켓 서버 일시 장애 | ✅ | exponential, base 5s, max 60s | 자동 |
| `oauth_expired` | 401, refresh_token 으로 재발급 가능 | ✅ (refresh 후 1회) | 0 (즉시) | 자동, refresh 실패 시 사용자 재인증 요구 |
| `oauth_revoked` | 401, refresh_token 도 무효 | ❌ | — | 사용자 재인증 필수 |
| `validation` | 필수필드 누락, 카테고리 코드 오류 등 4xx | ❌ | — | 사용자가 상품/매핑 수정 후 새 잡 |
| `image_invalid` | 이미지 규격 위반 | ❌ | — | 사용자가 이미지 교체 후 새 잡 |
| `duplicate` | 마켓 측 동일 상품 이미 등록됨 | ❌ | — | 사용자 확인 |
| `quota_exceeded` | 마켓별 일일 등록 한도 초과 | ❌ | — | 익일 재시도 |
| `unknown` | 분류 실패 | ❌ | — | 운영팀 조사 |

**규칙:**
- 재시도 ✅ 인 error_code 만 자동 재시도 큐에 들어감. ❌ 는 즉시 `failed_final`.
- 자동 재시도가 한도(`attempt_count = 3`) 도달 시 어떤 error_code 든 `failed_final`.
- 잡 전체 재시도(`partial/failed → retrying`) 는 **excluded 가 아닌 failed_final row 만** 다시 시도 (성공한 마켓은 건드리지 않음).
- 사용자가 "전체 재시도" 했는데 새 잡에서도 `validation` 류로 실패하면 무한 재시도 방지: 잡 `retry_count` 5 도달 시 `failed` 고착, "재시도" 버튼 비활성 + blockingReasons 노출.

#### 6.2.1 어댑터 `MarketError.code` → `jmr.error_code` 매핑 표 (단일 출처)

`market-adapter.md` §7 의 `MarketError` 6코드 (어댑터 throw 층) 와 본 문서 §6.2 의 `error_code` 10코드 (재시도 정책 층) 는 분리된 두 층이다. 어댑터 throw → 오케스트레이터가 본 표대로 분류 후 `registration_job_market_results.error_code` 에 적재.

| MarketError throw (어댑터) | jmr.error_code (재시도 정책) | 비고 |
|---|---|---|
| `unauthorized` | `oauth_expired` (1회 refresh 후 재시도) 또는 `oauth_revoked` (재인증 필요) | refresh 시도 성공 가능 여부로 분기 |
| `rate_limit` | `rate_limit` | 지수 백오프, retryAfterMs 우선 |
| `validation` | `validation` | 재시도 불가 |
| `network` | `timeout` | 재시도 가능 (지수 백오프) |
| `server` | `market_5xx` | 지수 백오프, 5회 한도 |
| `unknown` | `unknown` | 재시도 불가 |

본 매핑은 features/registration.md §12 의 사용자 노출 메시지 표보다 우선한다. registration.md §12 는 사용자 한국어 메시지만 정의, 분류는 본 표를 인용한다.

### 6.3. 백오프 구현

```
sleep(min(maxMs, baseMs * 2^(attemptIndex - 1)) + jitter(0..500ms))
```

`attemptIndex` 는 1-based (첫 자동 재시도가 1). Edge Function 시간 제약(현재 한도 측정 필요, security 가 확인) 안에 들어가도록 max 합산이 60s 를 넘으면 마켓 호출을 분할 함수 호출로 위임.

---

## 7. 마켓 제외 후 재등록 (n25)

user_flow.md n25 "오류 시 재시도 또는 마켓 제외 후 등록" 흐름.

**결정: 새 잡 분기 (parent_job_id 로 연결).** 기존 잡 확장 방식은 거부.

**근거:**
- 기존 잡 확장은 `attempt_count` 와 `retry_count` 두 카운터 의미가 섞임 → 디버깅 지옥.
- 잡 단위 audit/Realtime 이벤트 일관성 ↓ (한 잡이 partial 종료된 뒤 row 가 추가되거나 상태가 다시 변함 → 클라이언트 캐시 일관성 깨짐).
- `parent_job_id` 만 있으면 이력 화면에서 "재등록 트리" 시각화 가능.
- 새 잡은 `retry_count = 0` 으로 시작, 종전 잡의 `retry_count` 와 독립. 단, 새 잡의 retry_count 도 5 한도 동일 적용.

**새 잡 생성 시 입력:**
- `product_id` 는 원본과 동일.
- 새 잡의 `registration_job_market_results` row 는 "재등록 대상 마켓"만 신설. 사용자가 "제외" 표시한 마켓은 row 자체를 만들지 않거나, 만들되 `excluded = true`. **MVP 는 row 자체 미생성** (단순성 우선). `excluded` 컬럼은 v2 의 "재등록 트리 시각화에서 제외 마켓도 추적" 용도로 reserved.

---

## 8. 이벤트 / Realtime 푸시

Postgres Realtime 의 `postgres_changes` 채널을 사용. 클라이언트는 `seller_id = auth.uid()` RLS 가 자동 적용된 결과만 수신.

### 8.1. 구독 채널

| 채널 키 | 테이블 | 이벤트 | 필터 |
|---------|--------|--------|------|
| `rj:{sellerId}` | `registration_jobs` | INSERT, UPDATE | `seller_id=eq.{sellerId}` |
| `jmr:{sellerId}` | `registration_job_market_results` | INSERT, UPDATE | 조인 RLS 통해서 자동 필터 |

### 8.2. INSERT / UPDATE → 클라이언트 이벤트 매핑

| DB 이벤트 | 클라이언트 이벤트 | TanStack Query 액션 |
|-----------|---------------------|---------------------|
| `registration_jobs` INSERT | `job:created` | `['jobs', sellerId]` invalidate |
| `registration_jobs` UPDATE (status 변경) | `job:status_changed` | `['jobs', sellerId]` + `['jobs', jobId]` invalidate |
| `registration_jobs` UPDATE (started_at/completed_at) | `job:progress` | `['jobs', jobId]` patch (낙관적 갱신 X, refetch) |
| `registration_job_market_results` INSERT | `jmr:created` | `['jobs', jobId, 'markets']` invalidate |
| `registration_job_market_results` UPDATE (market_status) | `jmr:status_changed` | 동상 |

**금지:** 클라이언트가 Realtime payload 의 외부 토큰·PII 를 직접 보는 경로 없음 (해당 컬럼이 두 테이블에 없음). 만일 추후 추가 시 Realtime publication 화이트리스트로 제외 — security 가 거부권.

### 8.3. Publication 설정

```sql
alter publication supabase_realtime add table public.registration_jobs;
alter publication supabase_realtime add table public.registration_job_market_results;
```

---

## 9. 오케스트레이터 시퀀스 (`registration-run` Edge Function)

```
┌────────┐                ┌──────────────────┐         ┌──────────┐         ┌──────────┐
│ Client │                │ registration-run │         │ Postgres │         │ Market X │
│ (RHF)  │                │  (Edge Function) │         │          │         │  API     │
└───┬────┘                └────────┬─────────┘         └────┬─────┘         └────┬─────┘
    │                              │                        │                    │
    │ POST /registration-jobs      │                        │                    │
    │ (productId, marketIds[])     │                        │                    │
    │─────────────────────────────►│                        │                    │
    │                              │ INSERT registration_jobs (status=pending)   │
    │                              │───────────────────────►│                    │
    │                              │ INSERT jmr rows (status=pending) × N        │
    │                              │───────────────────────►│                    │
    │                              │                        │                    │
    │ 201 { jobId, correlationId } │                        │                    │
    │◄─────────────────────────────│                        │                    │
    │                              │                        │                    │
    │ (Realtime subscribe)         │                        │                    │
    │                              │                        │                    │
    │                              │ UPDATE jobs SET status=running, started_at  │
    │                              │───────────────────────►│                    │
    │                              │                        │── notify ─────────►│ (client Realtime)
    │                              │                        │                    │
    │                              │ for each market in parallel:                │
    │                              │   UPDATE jmr SET market_status=in_flight    │
    │                              │   attempt_count++ , last_attempted_at=now() │
    │                              │───────────────────────►│                    │
    │                              │                        │                    │
    │                              │ adapter.transformProduct(product, mapping)  │
    │                              │ adapter.createProduct(payload)              │
    │                              │────────────────────────┼───────────────────►│
    │                              │                        │                    │
    │                              │   ┌─ 201 → market_status=success            │
    │                              │   │  external_product_id, product_url       │
    │                              │   ├─ 429/5xx → retryable                    │
    │                              │   │  if attempt_count<3 → backoff, 재호출   │
    │                              │   │  else → market_status=failed_final      │
    │                              │   └─ 4xx validation → market_status=failed_final
    │                              │   UPDATE jmr                                │
    │                              │───────────────────────►│                    │
    │                              │                        │                    │
    │                              │ (모든 마켓 종료 후) decideTerminalStatus()  │
    │                              │ UPDATE jobs SET status=(succeeded|partial|failed),
    │                              │   completed_at=now(), error_summary=...     │
    │                              │───────────────────────►│                    │
    │                              │                        │── notify ─────────►│ (client)
    │                              │                        │                    │
```

**중요:**
- 마켓별 호출은 `Promise.allSettled` 로 병렬. 하나 실패가 다른 진행 차단 금지.
- Edge Function timeout 안에 못 끝나는 경우(대형 이미지 다수 + 마켓 다수) 마켓당 1 함수 호출로 분할 (Phase 3 에서 결정).
- 모든 외부 호출은 `logger.info({ market, method, url, sellerId, correlationId, jobId }, '→ market request')` 패턴. 토큰 절대 금지.
- 중복 트리거 방어: 같은 `product_id` 로 `status in ('pending','running','retrying')` 인 잡이 존재하면 신규 INSERT 거부 (RPC 에서 SELECT FOR UPDATE 또는 partial unique index 활용 — Phase 3 에서 SQL 확정).

---

## 10. 상태 전이 순수 함수 (TypeScript)

`apps/web/src/lib/registration/state.ts` (백엔드·프론트엔드 공유). zod 와 동일 위치.

### 10.1. 타입

```ts
export const JOB_STATUSES = [
  'pending', 'running', 'partial', 'succeeded',
  'failed', 'retrying', 'cancelled',
] as const;
export type JobStatus = typeof JOB_STATUSES[number];

export const MARKET_RESULT_STATUSES = [
  'pending', 'in_flight', 'success', 'failed', 'failed_final',
] as const;
export type MarketResultStatus = typeof MARKET_RESULT_STATUSES[number];

export type JobEvent =
  | { type: 'start' }                    // pending → running
  | { type: 'cancel'; by: string }       // (pending|running|retrying) → cancelled
  | { type: 'all_success' }              // running → succeeded
  | { type: 'mixed_terminal' }           // running → partial
  | { type: 'all_failed' }               // running → failed
  | { type: 'enter_retry' }              // running → retrying  (자동)
  | { type: 'user_retry' }               // (partial|failed) → retrying  (수동)
  | { type: 'retry_resume' };            // retrying → running
```

### 10.2. 전이 함수

```ts
export class IllegalTransitionError extends Error {
  constructor(public readonly from: JobStatus, public readonly event: JobEvent) {
    super(`illegal transition: ${from} on ${event.type}`);
    this.name = 'IllegalTransitionError';
  }
}

export function nextStatus(current: JobStatus, event: JobEvent): JobStatus {
  switch (current) {
    case 'pending':
      if (event.type === 'start')  return 'running';
      if (event.type === 'cancel') return 'cancelled';
      break;
    case 'running':
      if (event.type === 'all_success')    return 'succeeded';
      if (event.type === 'mixed_terminal') return 'partial';
      if (event.type === 'all_failed')     return 'failed';
      if (event.type === 'enter_retry')    return 'retrying';
      if (event.type === 'cancel')         return 'cancelled';
      break;
    case 'partial':
      if (event.type === 'user_retry') return 'retrying';
      break;
    case 'failed':
      if (event.type === 'user_retry') return 'retrying';
      break;
    case 'retrying':
      if (event.type === 'retry_resume') return 'running';
      if (event.type === 'cancel')       return 'cancelled';
      break;
    case 'succeeded':
    case 'cancelled':
      break; // terminal
  }
  throw new IllegalTransitionError(current, event);
}
```

### 10.3. 종결 판정 함수

```ts
export type JmrSummary = {
  marketStatus: MarketResultStatus;
  excluded: boolean;
};

export function decideTerminalStatus(
  results: ReadonlyArray<JmrSummary>,
): 'succeeded' | 'partial' | 'failed' | null {
  const active = results.filter((r) => !r.excluded);
  if (active.length === 0) return null; // 전부 excluded → 호출 측에서 에러로 처리

  const hasNonFinal = active.some((r) =>
    r.marketStatus === 'pending'
    || r.marketStatus === 'in_flight'
    || r.marketStatus === 'failed', // non-final
  );
  if (hasNonFinal) return null; // 아직 종료 시점 아님

  const successCount = active.filter((r) => r.marketStatus === 'success').length;
  const failedFinalCount = active.filter((r) => r.marketStatus === 'failed_final').length;

  if (successCount === active.length) return 'succeeded';
  if (failedFinalCount === active.length) return 'failed';
  return 'partial';
}
```

### 10.4. 단위 테스트 케이스 매트릭스

`apps/web/src/lib/registration/state.test.ts` (Vitest).

```ts
import { describe, it, expect } from 'vitest';
import { nextStatus, IllegalTransitionError, decideTerminalStatus } from './state';

describe('nextStatus 7x7 matrix', () => {
  const legal: Array<[JobStatus, JobEvent['type'], JobStatus]> = [
    ['pending',  'start',           'running'],
    ['pending',  'cancel',          'cancelled'],
    ['running',  'all_success',     'succeeded'],
    ['running',  'mixed_terminal',  'partial'],
    ['running',  'all_failed',      'failed'],
    ['running',  'enter_retry',     'retrying'],
    ['running',  'cancel',          'cancelled'],
    ['partial',  'user_retry',      'retrying'],
    ['failed',   'user_retry',      'retrying'],
    ['retrying', 'retry_resume',    'running'],
    ['retrying', 'cancel',          'cancelled'],
  ];

  it.each(legal)('%s + %s → %s', (from, eventType, expected) => {
    const event = eventType === 'cancel'
      ? ({ type: 'cancel', by: 'tester' } as const)
      : ({ type: eventType } as const);
    expect(nextStatus(from, event as JobEvent)).toBe(expected);
  });

  const allStatuses: JobStatus[] = [
    'pending','running','partial','succeeded','failed','retrying','cancelled',
  ];
  const allEvents: JobEvent['type'][] = [
    'start','cancel','all_success','mixed_terminal','all_failed',
    'enter_retry','user_retry','retry_resume',
  ];

  it('rejects every transition not in the legal matrix', () => {
    const legalSet = new Set(legal.map(([s,e]) => `${s}|${e}`));
    for (const s of allStatuses) {
      for (const e of allEvents) {
        if (legalSet.has(`${s}|${e}`)) continue;
        const event = e === 'cancel'
          ? ({ type: 'cancel', by: 't' } as const)
          : ({ type: e } as const);
        expect(() => nextStatus(s, event as JobEvent))
          .toThrow(IllegalTransitionError);
      }
    }
  });
});

describe('decideTerminalStatus', () => {
  const s = (marketStatus: MarketResultStatus, excluded = false) => ({ marketStatus, excluded });

  it('all success → succeeded', () => {
    expect(decideTerminalStatus([s('success'), s('success')])).toBe('succeeded');
  });

  it('mixed success + failed_final → partial', () => {
    expect(decideTerminalStatus([s('success'), s('failed_final')])).toBe('partial');
  });

  it('all failed_final → failed', () => {
    expect(decideTerminalStatus([s('failed_final'), s('failed_final')])).toBe('failed');
  });

  it('pending remaining → null (not terminal)', () => {
    expect(decideTerminalStatus([s('success'), s('pending')])).toBeNull();
  });

  it('in_flight remaining → null', () => {
    expect(decideTerminalStatus([s('in_flight'), s('failed_final')])).toBeNull();
  });

  it('non-final failed remaining → null (still retryable)', () => {
    expect(decideTerminalStatus([s('failed'), s('success')])).toBeNull();
  });

  it('excluded rows are ignored', () => {
    expect(decideTerminalStatus([s('success'), s('failed_final', true)])).toBe('succeeded');
  });

  it('all excluded → null (caller must reject)', () => {
    expect(decideTerminalStatus([s('failed_final', true)])).toBeNull();
  });
});
```

---

## 11. 테스트 매트릭스

### 11.1. 단위 테스트 (Vitest)

| 영역 | 케이스 | 기대 |
|------|--------|------|
| `nextStatus` 7×8 전이 | §10.4 의 legal 11 케이스 + 나머지 불법 전이 전수 | legal 통과, 불법 throw |
| `decideTerminalStatus` | 전부 success / 혼합 / 전부 failed_final / pending 잔존 / in_flight 잔존 / non-final failed 잔존 / excluded 처리 / 전부 excluded | §10.4 매트릭스대로 |
| 백오프 계산기 | attemptIndex 1~5 에서 base·max 적용 + jitter 범위 | 음수 없음, max 이하 |
| error_code 분류 → 재시도 가능 매핑 | §6.2 표 모든 행 | retryable 플래그 일치 |

### 11.2. 통합 테스트 (Vitest + Supabase 로컬)

| 시나리오 | 셋업 | 검증 |
|----------|------|------|
| 행복 경로 | 2 마켓 모두 mock 어댑터 success | jobs.status='succeeded', completed_at != null, 모든 jmr.market_status='success' |
| 1 성공 + 1 실패 | naver=success, coupang=validation 실패 | jobs.status='partial', jmr 각각 success/failed_final, error_summary 채워짐 |
| 전부 실패 | 두 마켓 모두 market_5xx 3회 재시도 후 final | jobs.status='failed', retry_count 변동 없음(자동 재시도는 잡 retry_count 미사용) |
| rate_limit 자동 회복 | 1회차 429, 2회차 success | attempt_count=2, market_status='success', jobs.status='succeeded' |
| oauth_expired → refresh 성공 | 401 → refresh_token 으로 재발급 → success | tokens 갱신 + market_status='success' |
| oauth_revoked | refresh_token 도 무효 | market_status='failed_final', error_code='oauth_revoked', 사용자에게 재인증 요구 이벤트 |
| 사용자 취소 (running 중) | RPC 호출 | jobs.status='cancelled', cancelled_by=auth.uid(), Realtime 이벤트 1회 |
| 동일 product 중복 트리거 | pending 잡 존재 시 신규 POST | 409 Conflict, 새 잡 미생성 |
| 마켓 제외 후 재등록 | partial 잡 → "coupang 제외" 새 잡 | parent_job_id 연결, 새 잡에 coupang row 없음, 새 잡 succeeded |
| Realtime 이벤트 | running 잡의 상태 변화 5회 | 클라이언트가 5 이벤트 수신, payload 에 토큰 없음 |

### 11.3. E2E (Playwright)

골든 패스 (qa 에이전트 강제 1개): s1 로그인 → s5 마켓 2개 연결 → s3 등록 위저드 → s6 등록 이력에서 succeeded 확인.
실패 경로 1개: s3 등록 → mock 어댑터로 coupang 실패 → 이력에서 partial 확인 → "재시도" 클릭 → 성공.

### 11.4. RLS 회귀 테스트

- 셀러 A 가 셀러 B 의 `registration_jobs` SELECT → 0 rows
- 셀러 A 가 셀러 B 의 `registration_job_market_results` SELECT → 0 rows
- 셀러 A 가 자기 잡을 DELETE → 권한 거부
- 셀러 A 가 자기 잡을 UPDATE status='succeeded' → 권한 거부 (RLS chk_update_cancel_only)
- 셀러 A 가 자기 잡을 UPDATE status='cancelled' → 성공 (단 RPC 권장)

---

## 12. 미해결 사안 (Phase 3 에서 확정)

1. **Edge Function timeout 실측치.** Supabase 공식 한도 확인 후 마켓당 1 함수 호출로 분할할지 결정. 확인 안 됨 시점에서 200s 가정.
2. **중복 트리거 방어 SQL.** partial unique index `WHERE status in ('pending','running','retrying')` on `(seller_id, product_id)` vs SELECT FOR UPDATE 중 선택. 트랜잭션 격리 수준 함께 검토.
3. **자동 재시도가 잡 `retry_count` 를 증가시키는가?** 현재 정의는 "수동만 증가". 자동 백오프는 `attempt_count` 만 증가. Phase 3 에서 확정 후 본 문서 잠금.
4. **`error_summary` 포맷.** 자유 텍스트 vs 구조화 JSON. 프론트가 i18n key 로 변환하려면 구조화 권장.
5. **취소 후 in-flight 마켓 호출 처리.** Edge Function 이 이미 마켓 API 호출 중일 때 cancel 들어오면 abort? 응답 받고 무시? → AbortController 우선, 응답 받으면 `cancelled` 잡의 jmr 는 갱신하지 않음 (race 회피).
6. **`registration_job_market_results.excluded` 사용 시점.** MVP 는 row 미생성으로 단일화했으나 v2 에서 "재등록 트리에 제외 표시" UX 요구 시 사용. 컬럼은 reserved.
7. **`market_account_id` 의 history 보존.** 사용자가 잡 종료 후 마켓 계정 해제하면 FK on delete restrict 가 막음. 운영 정책 결정 필요 — 권장: 해제 시 `market_accounts.is_active=false` soft delete + FK 유지.
8. **Realtime 처리량.** 셀러당 동시 진행 잡 N개 × 마켓 M개 × 상태 변화 K번 = 이벤트 폭증 시나리오. 대시보드 화면 디바운스 정책은 frontend 에서.

미해결 사안이 확정되면 본 문서의 해당 섹션을 즉시 갱신하고 Phase 3 features/registration.md 와 동기화.

---

## 13. 보안 검수 요청 (security 에이전트 @멘션)

- [ ] §3.4 RLS 정책 — 셀러 cross-tenant 누수 가능성 검토
- [ ] §3.5 `rpc_cancel_registration_job` `security invoker` — auth.uid() 우회 경로 없는지
- [ ] §8 Realtime publication 화이트리스트 — 향후 컬럼 추가 시 PII/토큰 자동 노출 위험
- [ ] §9 service_role 사용 경로 — `registration-run` Edge Function 의 seller_id 강제 WHERE 검수
- [ ] §6 `error_message` 컬럼 — 마켓 API raw 응답에 PII/토큰 섞일 가능성. 저장 전 마스킹 함수 적용
