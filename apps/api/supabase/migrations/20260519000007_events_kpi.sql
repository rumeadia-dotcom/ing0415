-- 20260519000007_events_kpi.sql
-- 출처: ops/kpi.md §2 (events), §3 (sessions), §4 (nps_responses)
-- 목적: KPI / MAU / NPS 데이터 수집. 모든 테이블 RLS + 본인 row 만 SELECT.

----------------------------------------------------------------------
-- 1. ENUMs (kpi.md §2.1.1)
----------------------------------------------------------------------
create type public.event_source as enum (
  'web',
  'edge_fn',
  'db_trigger'
);

create type public.event_type as enum (
  -- 인증 (s1)
  'login_success',
  'signup_completed',
  'password_reset_completed',
  -- 대시보드 (s2)
  'dashboard_viewed',
  -- 등록 (s3)
  'registration_started',
  'registration_step_advanced',
  'registration_submitted',
  'registration_completed',
  'registration_partial',
  'registration_failed',
  'retry_initiated',
  'market_excluded_retry',
  -- 마켓 계정 (s5)
  'market_connect_started',
  'market_connected',
  'market_disconnected',
  'market_token_refresh_failed',
  -- 이력 (s6)
  'history_viewed',
  'history_filtered',
  'history_detail_opened'
);

----------------------------------------------------------------------
-- 2. events (kpi.md §2.1.2)
----------------------------------------------------------------------
create table public.events (
  id             uuid primary key default gen_random_uuid(),
  seller_id      uuid not null references auth.users(id) on delete cascade,
  event_type     public.event_type not null,
  source         public.event_source not null,
  payload        jsonb not null default '{}'::jsonb,
  correlation_id uuid,
  job_id         uuid references public.registration_jobs(id) on delete set null,
  created_at     timestamptz not null default now()
);

comment on column public.events.payload is
  'PII 금지. 허용 키: step(int), market(text), filter(jsonb), reason(text), duration_ms(int). 그 외는 zod 검증으로 차단.';

create index idx_events_seller_created on public.events (seller_id, created_at desc);
create index idx_events_type_created   on public.events (event_type, created_at desc);
create index idx_events_job            on public.events (job_id) where job_id is not null;

-- 월간 집계용 BRIN (시계열, b-tree 보다 가벼움)
create index idx_events_created_brin   on public.events using brin (created_at);

----------------------------------------------------------------------
-- 3. events RLS (kpi.md §2.2)
----------------------------------------------------------------------
alter table public.events enable row level security;
alter table public.events force row level security;

create policy events_select_own
  on public.events for select
  using (auth.uid() = seller_id);

-- INSERT: web source 만, event_type 화이트리스트 (사용자 행동 이벤트만)
create policy events_insert_web_own
  on public.events for insert
  with check (
    auth.uid() = seller_id
    and source = 'web'
    and event_type in (
      'login_success', 'dashboard_viewed',
      'registration_started', 'registration_step_advanced',
      'history_viewed', 'history_filtered', 'history_detail_opened',
      'market_connect_started'
    )
  );

-- UPDATE/DELETE 정책 부재 → 일반 사용자 불가. service_role 만 보관기간 만료 시 DELETE.

----------------------------------------------------------------------
-- 4. sessions (kpi.md §3.1)
----------------------------------------------------------------------
create table public.sessions (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references auth.users(id) on delete cascade,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  ip_hash      text,         -- sha256(ip || daily_salt). 평문 IP 금지.
  ua_hash      text,
  client_build text,
  check (ended_at is null or ended_at >= started_at)
);

create index idx_sessions_seller_started on public.sessions (seller_id, started_at desc);
create index idx_sessions_started_brin   on public.sessions using brin (started_at);

alter table public.sessions enable row level security;
alter table public.sessions force row level security;

create policy sessions_select_own
  on public.sessions for select
  using (auth.uid() = seller_id);

create policy sessions_insert_own
  on public.sessions for insert
  with check (auth.uid() = seller_id and ended_at is null);

-- UPDATE: 본인 row, 단 started_at 변조 금지
create policy sessions_update_own
  on public.sessions for update
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

-- started_at 변조 방지 트리거 (kpi.md §3.2 의 WITH CHECK 보강)
create or replace function public.sessions_protect_started_at()
returns trigger
language plpgsql
as $$
begin
  if new.started_at is distinct from old.started_at then
    raise exception 'sessions.started_at is immutable';
  end if;
  if new.ip_hash is distinct from old.ip_hash then
    raise exception 'sessions.ip_hash is immutable';
  end if;
  if new.ua_hash is distinct from old.ua_hash then
    raise exception 'sessions.ua_hash is immutable';
  end if;
  return new;
end;
$$;

create trigger trg_sessions_protect
  before update on public.sessions
  for each row execute function public.sessions_protect_started_at();

----------------------------------------------------------------------
-- 5. nps_responses (kpi.md §4.1)
----------------------------------------------------------------------
create table public.nps_responses (
  id             uuid primary key default gen_random_uuid(),
  seller_id      uuid not null references auth.users(id) on delete cascade,
  score          smallint not null check (score between 0 and 10),
  comment        text,
  trigger_reason text not null
                 check (trigger_reason in ('post_5_registrations','manual','recurring_quarterly')),
  surveyed_at    timestamptz not null default now()
);

-- 동일 트리거에 분기당 1회 응답으로 제한
-- (kpi.md §4.1 의 unique(seller_id, trigger_reason, date_trunc('quarter', surveyed_at)))
-- date_trunc(text, timestamptz) 는 timezone 의존이라 IMMUTABLE 이 아님 → unique index 의
-- 표현식으로 못 씀. `AT TIME ZONE 'UTC'` 캐스트로 timestamp(without tz) 변환한 결과는
-- date_trunc(text, timestamp) 와 매칭되어 IMMUTABLE 평가됨.
create unique index nps_responses_unique_quarter
  on public.nps_responses (
    seller_id,
    trigger_reason,
    (date_trunc('quarter', (surveyed_at at time zone 'UTC')))
  );

create index idx_nps_surveyed on public.nps_responses (surveyed_at desc);

alter table public.nps_responses enable row level security;
alter table public.nps_responses force row level security;

create policy nps_select_own
  on public.nps_responses for select
  using (auth.uid() = seller_id);

create policy nps_insert_own
  on public.nps_responses for insert
  with check (auth.uid() = seller_id);

-- UPDATE/DELETE 정책 부재 → immutable. 익명화는 service_role 만.
