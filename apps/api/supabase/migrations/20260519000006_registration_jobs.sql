-- 20260519000006_registration_jobs.sql
-- 출처: cross-cutting/registration-job-state.md §3 (ENUM/DDL/RLS), §3.5 (cancel RPC), §8.3 (Realtime publication)
-- 목적: RegistrationJob 단일 진실 원장. 7상태 ENUM + 5상태 ENUM + 1:N market_results + RLS.

----------------------------------------------------------------------
-- 1. ENUMs (registration-job-state.md §3.1)
----------------------------------------------------------------------
-- 상위 잡 상태 (7개)
create type public.registration_job_status as enum (
  'pending',
  'running',
  'partial',
  'succeeded',
  'failed',
  'retrying',
  'cancelled'
);

-- 마켓별 결과 상태 (5개)
create type public.market_result_status as enum (
  'pending',
  'in_flight',
  'success',
  'failed',
  'failed_final'
);

----------------------------------------------------------------------
-- 2. registration_jobs (registration-job-state.md §3.2)
----------------------------------------------------------------------
create table public.registration_jobs (
  id              uuid primary key default gen_random_uuid(),
  seller_id       uuid not null references auth.users(id) on delete cascade,
  product_id      uuid not null references public.products(id) on delete restrict,
  status          public.registration_job_status not null default 'pending',
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  retry_count     smallint not null default 0
                  check (retry_count >= 0 and retry_count <= 5),
  error_summary   text,
  cancelled_by    uuid references auth.users(id),
  cancelled_at    timestamptz,
  parent_job_id   uuid references public.registration_jobs(id) on delete set null,
  correlation_id  uuid not null default gen_random_uuid(),

  -- 상태와 타임스탬프 정합성 (DB 레벨 가드)
  constraint chk_terminal_completed_at check (
    (status in ('succeeded', 'failed', 'partial', 'cancelled')) = (completed_at is not null)
  ),
  -- (status in ('running','retrying')) implies (started_at is not null)
  constraint chk_running_started_at check (
    (status not in ('running','retrying')) or (started_at is not null)
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

----------------------------------------------------------------------
-- 3. registration_job_market_results (registration-job-state.md §3.3)
----------------------------------------------------------------------
create table public.registration_job_market_results (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid not null references public.registration_jobs(id) on delete cascade,
  market_id           text not null,                  -- 'naver' | 'coupang' | '11st' | 'gmarket' | 'auction'
  market_account_id   uuid not null references public.market_accounts(id) on delete restrict,
  market_status       public.market_result_status not null default 'pending',
  external_product_id text,
  product_url         text,
  error_code          text,
  error_message       text,
  attempt_count       smallint not null default 0
                      check (attempt_count >= 0 and attempt_count <= 3),
  last_attempted_at   timestamptz,
  excluded            boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint uq_job_market unique (job_id, market_id),

  -- (market_status = 'success') implies (external_product_id is not null)
  constraint chk_success_has_external_id check (
    (market_status <> 'success') or (external_product_id is not null)
  ),
  -- (market_status in ('failed','failed_final')) implies (error_code is not null)
  constraint chk_failed_has_error check (
    (market_status not in ('failed','failed_final')) or (error_code is not null)
  )
);

create index idx_jmr_job           on public.registration_job_market_results (job_id);
create index idx_jmr_market_status on public.registration_job_market_results (market_id, market_status);

-- updated_at 자동 갱신 (registration-job-state.md §3.3)
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

----------------------------------------------------------------------
-- 4. RLS (registration-job-state.md §3.4)
----------------------------------------------------------------------
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

-- 사용자 직접 UPDATE 는 cancel 만 허용. 그 외 상태 전이는 RPC(security definer) 또는 service_role.
create policy "rj_update_cancel_only"
  on public.registration_jobs for update
  to authenticated
  using (seller_id = auth.uid())
  with check (
    seller_id = auth.uid()
    and status = 'cancelled'
  );

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

-- 클라이언트 INSERT/UPDATE/DELETE 직접 금지. 오케스트레이터(service_role) 전용.
create policy "jmr_no_write_client"
  on public.registration_job_market_results for all
  to authenticated
  using (false)
  with check (false);

----------------------------------------------------------------------
-- 5. 취소 RPC (registration-job-state.md §3.5)
----------------------------------------------------------------------
create or replace function public.rpc_cancel_registration_job(p_job_id uuid)
returns public.registration_jobs
language plpgsql
security invoker  -- RLS 통과 필수
as $$
declare
  v_row public.registration_jobs;
begin
  update public.registration_jobs
    set status       = 'cancelled',
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

----------------------------------------------------------------------
-- 6. Realtime publication (registration-job-state.md §8.3)
----------------------------------------------------------------------
alter publication supabase_realtime add table public.registration_jobs;
alter publication supabase_realtime add table public.registration_job_market_results;
