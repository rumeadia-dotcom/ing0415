-- 20260521000004_orders_views.sql
-- 출처:
--   docs/spec/PRD.md §1.5 (KPI 마켓 접속 횟수 / 등록·송장 소요 시간 / 오류율),
--                                  §2.5 (주문·배송 현황 대시보드)
--   docs/architecture/v1/cross-cutting/security.md §3 (view security_invoker 패턴)
-- 목적:
--   1) orders 와 최신 shipping_job_results 를 join 한 대시보드 view
--   2) v2 KPI 일자별 집계 view (PRD §1.5 측정)
-- 비고:
--   - 전부 security_invoker=on → 호출자 RLS 적용. orders.RLS 가 그대로 적용되어
--     셀러는 본인 row 만 보임.

----------------------------------------------------------------------
-- 1. orders_with_dispatch_summary
--    각 주문에 대해 최신 dispatch 결과 (가장 최근 shipping_job_results.created_at) 1건을 LEFT JOIN.
----------------------------------------------------------------------
create or replace view public.orders_with_dispatch_summary
with (security_invoker = on)
as
with latest_dispatch as (
  -- 주문당 가장 최신 결과 1건 (재시도 시 attempt_count 증가, 최신만 노출)
  select distinct on (order_id)
    order_id,
    job_id,
    status         as dispatch_status,
    external_dispatch_id,
    error_code     as dispatch_error_code,
    error_message  as dispatch_error_message,
    attempt_count  as dispatch_attempt_count,
    created_at     as dispatch_created_at
  from public.shipping_job_results
  order by order_id, created_at desc
)
select
  o.id,
  o.seller_id,
  o.market_id,
  o.external_order_id,
  o.buyer_name,
  o.receiver_name,
  o.receiver_address,
  o.receiver_phone,
  o.product_name,
  o.quantity,
  o.order_amount,
  o.status,
  o.logen_order_id,
  o.waybill_number,
  o.carrier_code,
  o.error_code,
  o.error_message,
  o.attempt_count,
  o.collected_at,
  o.logen_registered_at,
  o.waybill_printed_at,
  o.dispatched_at,
  o.created_at,
  o.updated_at,
  ld.job_id                  as latest_dispatch_job_id,
  ld.dispatch_status         as latest_dispatch_status,
  ld.external_dispatch_id    as latest_dispatch_external_id,
  ld.dispatch_error_code     as latest_dispatch_error_code,
  ld.dispatch_error_message  as latest_dispatch_error_message,
  ld.dispatch_attempt_count  as latest_dispatch_attempt_count,
  ld.dispatch_created_at     as latest_dispatch_at
from public.orders o
left join latest_dispatch ld on ld.order_id = o.id;

comment on view public.orders_with_dispatch_summary is
  'PRD-v2 §2.5: 주문 목록 + 최신 dispatch 결과 1건. security_invoker=on. orders RLS 그대로 적용.';

grant select on public.orders_with_dispatch_summary to authenticated, service_role;

----------------------------------------------------------------------
-- 2. v2_kpi_daily_orders
--    날짜·셀러별 신규 주문 / 마켓별 분포 집계.
--    PRD-v2 §1.5: 마켓 접속 횟수 절감 효과 측정 기반.
----------------------------------------------------------------------
create or replace view public.v2_kpi_daily_orders
with (security_invoker = on)
as
select
  seller_id,
  (collected_at at time zone 'Asia/Seoul')::date as kpi_date,
  count(*)::int                                              as orders_total,
  count(*) filter (where market_id = 'naver')::int           as orders_naver,
  count(*) filter (where market_id = 'coupang')::int         as orders_coupang,
  count(*) filter (where market_id = 'gmarket')::int         as orders_gmarket,
  count(*) filter (where market_id = 'auction')::int         as orders_auction,
  count(*) filter (where market_id = '11st')::int            as orders_11st,
  count(*) filter (where status = 'logen_failed')::int       as orders_logen_failed,
  count(*) filter (where status = 'dispatch_failed')::int    as orders_dispatch_failed
from public.orders
group by seller_id, (collected_at at time zone 'Asia/Seoul')::date;

comment on view public.v2_kpi_daily_orders is
  'PRD-v2 §1.5: 일자·셀러·마켓별 주문 수집 KPI. security_invoker=on (orders RLS 적용).';

grant select on public.v2_kpi_daily_orders to authenticated, service_role;

----------------------------------------------------------------------
-- 3. v2_kpi_daily_dispatch
--    날짜·셀러별 송장 제출 잡 처리량 / 성공률 집계.
--    PRD-v2 §1.5: 송장 입력 소요 시간 0 / 오류율 0 목표 추적.
----------------------------------------------------------------------
create or replace view public.v2_kpi_daily_dispatch
with (security_invoker = on)
as
select
  sj.seller_id,
  (sj.created_at at time zone 'Asia/Seoul')::date as kpi_date,
  count(*)::int                                          as jobs_total,
  count(*) filter (where sj.status = 'succeeded')::int   as jobs_succeeded,
  count(*) filter (where sj.status = 'partial')::int     as jobs_partial,
  count(*) filter (where sj.status = 'failed')::int      as jobs_failed,
  coalesce(sum(sj.order_count), 0)::int                  as orders_attempted,
  coalesce(sum(sj.success_count), 0)::int                as orders_succeeded,
  coalesce(sum(sj.failed_count), 0)::int                 as orders_failed,
  -- 평균 처리 시간 (succeeded 만, completed_at 가 있는 경우)
  coalesce(
    avg(extract(epoch from (sj.completed_at - sj.created_at)))
      filter (where sj.status = 'succeeded' and sj.completed_at is not null),
    0
  )::numeric(10, 2) as avg_duration_sec
from public.shipping_jobs sj
group by sj.seller_id, (sj.created_at at time zone 'Asia/Seoul')::date;

comment on view public.v2_kpi_daily_dispatch is
  'PRD-v2 §1.5: 일자·셀러별 송장 제출 잡 KPI. security_invoker=on (shipping_jobs RLS 적용).';

grant select on public.v2_kpi_daily_dispatch to authenticated, service_role;
