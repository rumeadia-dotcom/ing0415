-- 20260519000009_views_kpi.sql
-- 출처: ops/kpi.md §5 (계산 view), §5.5 (권한)
-- 목적: PRD §1.핵심지표 — 월간 등록 건수 / MAU / 평균 등록 시간 / NPS.
-- 모든 view 는 security_invoker=on → 호출자 RLS 적용. 셀러는 본인 데이터 집계만 보임.

----------------------------------------------------------------------
-- 1. kpi_monthly_registrations (kpi.md §5.1)
----------------------------------------------------------------------
create or replace view public.kpi_monthly_registrations
with (security_invoker = on) as
select
  date_trunc('month', rj.created_at)              as month,
  extract(year  from rj.created_at)::int          as year,
  extract(month from rj.created_at)::int          as month_num,
  count(*)                                        as total_jobs,
  count(*) filter (where rj.status = 'succeeded') as succeeded,
  count(*) filter (where rj.status = 'partial')   as partial,
  count(*) filter (where rj.status = 'failed')    as failed,
  count(*) filter (where rj.status = 'cancelled') as cancelled,
  count(distinct rj.seller_id)                    as active_sellers
from public.registration_jobs rj
where rj.created_at >= now() - interval '24 months'
group by 1, 2, 3
order by 1 desc;

comment on view public.kpi_monthly_registrations is
  'PRD §1.핵심지표: 월간 총 등록 건수. RLS 호환 (security_invoker).';

----------------------------------------------------------------------
-- 2. kpi_mau (kpi.md §5.2) — 캘린더 월 + 트레일링 30일
----------------------------------------------------------------------
create or replace view public.kpi_mau
with (security_invoker = on) as
with monthly as (
  select
    date_trunc('month', started_at) as month,
    count(distinct seller_id)       as mau_calendar
  from public.sessions
  where started_at >= now() - interval '24 months'
  group by 1
),
trailing_window as (
  -- `trailing` 은 PG reserved keyword 라 CTE 별칭으로 사용 불가
  select
    date_trunc('day', d)::date as as_of,
    (
      select count(distinct s.seller_id)
      from public.sessions s
      where s.started_at >= d - interval '30 days'
        and s.started_at <  d
    ) as mau_trailing_30d
  from generate_series(
    date_trunc('day', now() - interval '24 months'),
    date_trunc('day', now()),
    interval '1 day'
  ) d
)
select
  m.month,
  m.mau_calendar,
  (
    select mau_trailing_30d
    from trailing_window
    where as_of = (m.month + interval '1 month')::date
  ) as mau_trailing_30d_at_month_end
from monthly m
order by m.month desc;

comment on view public.kpi_mau is
  'PRD §1.핵심지표: MAU. 캘린더 월 + 트레일링 30일 동시 제공.';

----------------------------------------------------------------------
-- 3. kpi_registration_duration (kpi.md §5.3) — p50/p95/p99 + avg
----------------------------------------------------------------------
create or replace view public.kpi_registration_duration
with (security_invoker = on) as
select
  date_trunc('month', rj.created_at) as month,
  count(*) filter (where rj.completed_at is not null) as completed_jobs,
  percentile_cont(0.50) within group (
    order by extract(epoch from (rj.completed_at - rj.created_at)) * 1000
  )::bigint as p50_ms,
  percentile_cont(0.95) within group (
    order by extract(epoch from (rj.completed_at - rj.created_at)) * 1000
  )::bigint as p95_ms,
  percentile_cont(0.99) within group (
    order by extract(epoch from (rj.completed_at - rj.created_at)) * 1000
  )::bigint as p99_ms,
  avg(extract(epoch from (rj.completed_at - rj.created_at)) * 1000)::bigint as avg_ms
from public.registration_jobs rj
where rj.completed_at is not null
  and rj.status in ('succeeded','partial')   -- failed 는 분포 왜곡, 제외
  and rj.created_at >= now() - interval '24 months'
group by 1
order by 1 desc;

comment on view public.kpi_registration_duration is
  'PRD §1.핵심지표: 평균 등록 시간. p50/p95/p99 + avg. 단축률은 baseline 과 비교 (kpi.md §6).';

----------------------------------------------------------------------
-- 4. kpi_nps_summary (kpi.md §5.4)
----------------------------------------------------------------------
create or replace view public.kpi_nps_summary
with (security_invoker = on) as
select
  date_trunc('month', surveyed_at)                          as month,
  count(*)                                                  as total_responses,
  count(*) filter (where score >= 9)                        as promoter,
  count(*) filter (where score between 7 and 8)             as passive,
  count(*) filter (where score <= 6)                        as detractor,
  round(
    (
      (count(*) filter (where score >= 9))::numeric
      - (count(*) filter (where score <= 6))::numeric
    ) / nullif(count(*), 0) * 100,
    1
  ) as nps_score
from public.nps_responses
where surveyed_at >= now() - interval '24 months'
group by 1
order by 1 desc;

comment on view public.kpi_nps_summary is
  'PRD §1.핵심지표: NPS. promoter/passive/detractor + NPS score.';

----------------------------------------------------------------------
-- 5. view 호출 권한 (kpi.md §5.5)
----------------------------------------------------------------------
grant select on public.kpi_monthly_registrations to authenticated, service_role;
grant select on public.kpi_mau                   to authenticated, service_role;
grant select on public.kpi_registration_duration to authenticated, service_role;
grant select on public.kpi_nps_summary           to authenticated, service_role;
