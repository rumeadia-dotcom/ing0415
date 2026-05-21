-- 20260521000002_shipping_jobs.sql
-- 출처:
--   docs/spec/PRD.md §6.4 (마켓 송장 일괄 제출), §8 (shipping_jobs / shipping_job_results DDL)
--   docs/architecture/v1/cross-cutting/registration-job-state.md (잡 + 마켓별 결과 1:N 패턴 재사용)
-- 목적:
--   "송장 일괄 제출" 딸깍 1회의 fan-out 잡 단위 + 마켓별 결과 적재.
-- 비고:
--   - registration_jobs 와 동일한 패턴: 잡 1건이 4마켓에 fan-out, 마켓별 성공/실패 1:N.
--   - 상위 상태(shipping_jobs.status)는 5상태로 단순. retry / cancel 은 v1 범위 외 (PRD-v2 §6).
--   - shipping_job_results 의 INSERT/UPDATE 는 shipping-dispatch-job Edge Function (service_role) 만.

----------------------------------------------------------------------
-- 1. ENUM
----------------------------------------------------------------------
create type public.shipping_job_status as enum (
  'pending',
  'running',
  'partial',
  'succeeded',
  'failed'
);

create type public.shipping_market_status as enum (
  'success',
  'failed'
);

----------------------------------------------------------------------
-- 2. shipping_jobs (PRD-v2 §4)
----------------------------------------------------------------------
create table public.shipping_jobs (
  id              uuid primary key default gen_random_uuid(),
  seller_id       uuid not null references auth.users(id) on delete cascade,

  status          public.shipping_job_status not null default 'pending',
  order_count     integer not null default 0 check (order_count >= 0),
  success_count   integer not null default 0 check (success_count >= 0),
  failed_count    integer not null default 0 check (failed_count >= 0),

  -- 진단
  error_summary   text,

  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz,

  constraint shipping_jobs_counts_consistent
    check (success_count + failed_count <= order_count)
);

create index shipping_jobs_seller_idx        on public.shipping_jobs (seller_id);
create index shipping_jobs_seller_created    on public.shipping_jobs (seller_id, created_at desc);
create index shipping_jobs_status_idx        on public.shipping_jobs (status);

alter table public.shipping_jobs enable row level security;

-- SELECT: 본인 잡만
create policy shipping_jobs_select_own
  on public.shipping_jobs for select
  using (seller_id = auth.uid());

-- INSERT: 본인 잡만 (클라이언트 트리거: "송장 일괄 제출" 버튼 → Edge Function 이
--   service_role 로 INSERT 하지만, 가벼운 셀프 트리거 가능성도 열어둠).
create policy shipping_jobs_insert_own
  on public.shipping_jobs for insert
  with check (seller_id = auth.uid());

-- UPDATE / DELETE 정책 부재 → service_role 만. 상태 전이는 dispatch 잡 함수가 담당.

-- updated_at 트리거는 별도 컬럼이 없어서 생략 (registration_jobs 와 동일).

comment on table public.shipping_jobs is
  'PRD-v2 §2.4 / §4: "송장 일괄 제출" 딸깍 1회 단위. 4마켓 fan-out 의 부모 잡.';
comment on column public.shipping_jobs.status is
  'pending(미시작) → running(처리 중) → succeeded(전부 성공) / partial(일부 성공) / failed(전부 실패).';

----------------------------------------------------------------------
-- 3. shipping_job_results (PRD-v2 §4)
--    job 1건 안에서도 같은 마켓에 여러 주문이 들어갈 수 있으므로
--    (job_id, order_id) UNIQUE — 마켓당 1건이 아니라 주문당 1건.
----------------------------------------------------------------------
create table public.shipping_job_results (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references public.shipping_jobs(id) on delete cascade,
  order_id        uuid not null references public.orders(id) on delete cascade,
  market_id       text not null
                  check (market_id in ('naver','coupang','11st','gmarket','auction')),

  status          public.shipping_market_status not null,
  -- 외부 마켓 응답 (성공 시 마켓 측 송장 등록 ID, 있을 때만)
  external_dispatch_id text,
  -- 실패 시 마스킹된 사용자 노출 메시지
  error_code      text,
  error_message   text,
  attempt_count   smallint not null default 1 check (attempt_count between 1 and 5),

  created_at      timestamptz not null default now(),

  constraint sjr_unique_job_order unique (job_id, order_id)
);

create index sjr_job_idx     on public.shipping_job_results (job_id);
create index sjr_order_idx   on public.shipping_job_results (order_id);
create index sjr_market_idx  on public.shipping_job_results (market_id);

alter table public.shipping_job_results enable row level security;

-- SELECT: 부모 잡의 seller_id 가 auth.uid() 일 때만.
create policy sjr_select_own
  on public.shipping_job_results for select
  using (
    exists (
      select 1 from public.shipping_jobs sj
      where sj.id = shipping_job_results.job_id
        and sj.seller_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE 정책 부재 → service_role (shipping-dispatch-job Edge Function) 만.

comment on table public.shipping_job_results is
  'PRD-v2 §4: 송장 일괄 제출 잡의 마켓별 + 주문별 결과. 클라이언트 write 전면 금지 (service_role 만).';
