-- 20260519000008_views_dashboard.sql
-- 출처: features/dashboard.md §2.2 (seller_dashboard_summary), §2.3 (seller_recent_jobs)
-- 목적: 대시보드 요약 + 최근 잡 리스트 view. security_invoker=on → 호출자 RLS 적용.

----------------------------------------------------------------------
-- 1. seller_dashboard_summary (dashboard.md §2.2)
--    셀러당 1 row. registration_jobs 의 RLS 가 그대로 적용됨.
----------------------------------------------------------------------
create or replace view public.seller_dashboard_summary
with (security_invoker = on)
as
with base as (
  select
    rj.seller_id,
    rj.status,
    rj.created_at,
    rj.completed_at,
    extract(epoch from (rj.completed_at - rj.created_at)) as duration_sec
  from public.registration_jobs rj
)
select
  seller_id,
  -- 오늘 (Asia/Seoul) 등록 건수
  count(*) filter (
    where created_at >= date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'
  )::int as jobs_today_count,
  -- 진행 중 (pending / running / retrying)
  count(*) filter (
    where status in ('pending', 'running', 'retrying')
  )::int as jobs_in_progress_count,
  -- 24h
  count(*) filter (where created_at >= now() - interval '24 hours')::int as jobs_24h_count,
  count(*) filter (where created_at >= now() - interval '24 hours' and status = 'succeeded')::int as jobs_24h_succeeded,
  count(*) filter (where created_at >= now() - interval '24 hours' and status = 'partial')::int    as jobs_24h_partial,
  count(*) filter (where created_at >= now() - interval '24 hours' and status = 'failed')::int     as jobs_24h_failed,
  -- 7d
  count(*) filter (where created_at >= now() - interval '7 days')::int as jobs_7d_count,
  count(*) filter (where created_at >= now() - interval '7 days' and status = 'succeeded')::int as jobs_7d_succeeded,
  count(*) filter (where created_at >= now() - interval '7 days' and status = 'partial')::int    as jobs_7d_partial,
  count(*) filter (where created_at >= now() - interval '7 days' and status = 'failed')::int     as jobs_7d_failed,
  -- 30d
  count(*) filter (where created_at >= now() - interval '30 days')::int as jobs_30d_count,
  -- 평균 등록 시간 (7d, succeeded 만 — partial/failed 는 분포 왜곡)
  coalesce(
    avg(duration_sec) filter (
      where status = 'succeeded'
        and completed_at is not null
        and created_at >= now() - interval '7 days'
    ),
    0
  )::numeric(10, 2) as avg_duration_sec_7d,
  -- 마지막 잡 시각 (empty 판정용)
  max(created_at) as last_job_at
from base
group by seller_id;

comment on view public.seller_dashboard_summary is
  '셀러별 대시보드 요약. security_invoker=on. registration_jobs RLS 그대로 적용 → 셀러는 본인 1 row 만 보임.';

----------------------------------------------------------------------
-- 2. seller_recent_jobs (dashboard.md §2.3)
--    최근 잡 + 마켓별 결과 집계. 클라이언트는 LIMIT 20 강제 (RPC 측에서 clamp).
----------------------------------------------------------------------
create or replace view public.seller_recent_jobs
with (security_invoker = on)
as
select
  rj.id                          as job_id,
  rj.seller_id,
  rj.product_id,
  rj.status                      as job_status,
  rj.created_at,
  rj.started_at,
  rj.completed_at,
  rj.retry_count,
  rj.error_summary,
  rj.parent_job_id,
  -- 마켓별 집계 (jmr 가 RLS 로 같은 셀러만 보임)
  coalesce(
    (
      select jsonb_agg(
               jsonb_build_object(
                 'market_id', jmr.market_id,
                 'market_status', jmr.market_status,
                 'attempt_count', jmr.attempt_count,
                 'external_product_id', jmr.external_product_id,
                 'product_url', jmr.product_url,
                 'error_code', jmr.error_code,
                 'excluded', jmr.excluded
               )
               order by jmr.market_id
             )
      from public.registration_job_market_results jmr
      where jmr.job_id = rj.id
    ),
    '[]'::jsonb
  ) as markets,
  (
    select count(*) from public.registration_job_market_results jmr2
    where jmr2.job_id = rj.id and jmr2.market_status = 'success'
  )::int as success_count,
  (
    select count(*) from public.registration_job_market_results jmr3
    where jmr3.job_id = rj.id and jmr3.market_status in ('failed', 'failed_final')
  )::int as failed_count,
  (
    select count(*) from public.registration_job_market_results jmr4
    where jmr4.job_id = rj.id
  )::int as market_total_count
from public.registration_jobs rj
order by rj.created_at desc;

comment on view public.seller_recent_jobs is
  '최근 잡 + 마켓별 결과 집계 jsonb. security_invoker=on. 클라이언트는 LIMIT 20 강제 (RPC clamp 1~50).';

-- view 자체 권한
grant select on public.seller_dashboard_summary to authenticated, service_role;
grant select on public.seller_recent_jobs       to authenticated, service_role;
