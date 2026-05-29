-- infra/mcp-hosting/sql/real/02_mcp_ro_views.sql
-- 설계 ground truth: docs/architecture/v1/cross-cutting/mcp-hosting.md §5.2 / §5.3
--
-- 대상 프로젝트: real (lfrnythcujxdhehvkmtg) **전용**. 01_role_and_deny.sql 적용 후 실행.
-- 적용 방식: 운영자 수동 1회 (제품 마이그레이션 시퀀스와 분리).
--
-- 방식: 전용 뷰 스키마 `mcp_ro` deny-by-default. base table 에 GRANT 0.
--   신규 테이블/컬럼은 명시적으로 뷰에 넣기 전까지 자동 비노출 → 스키마 drift 시에도 PII 유출 0.
--
-- 뷰 owner(마이그레이션 실행 role = postgres) + security_invoker=off →
--   뷰는 owner 권한으로 base table 을 읽고 redacted 결과만 반환. mcp_ro_real 은 base table
--   직접 권한 0 인 채로 뷰로만 조회.
--
-- 참조 컬럼은 실제 마이그레이션(apps/api/supabase/migrations)과 1:1 검증됨:
--   sellers(20260519000002) / orders(20260521000001) / market_accounts(20260519000004) /
--   registration_jobs·market_results(20260519000006) / views_kpi(20260519000009) /
--   orders_views(20260521000004).

begin;

----------------------------------------------------------------------
-- 1. 전용 노출 스키마
----------------------------------------------------------------------
create schema if not exists mcp_ro;
comment on schema mcp_ro is
  'MCP read-only 노출 전용 (mcp-hosting.md §5). PII-redacted 행 뷰 + 전역 집계 뷰만. '
  'base table 직접 노출 금지. security_invoker=off (owner 권한으로 읽고 redacted 결과만 반환).';

grant usage on schema mcp_ro to mcp_ro_real;

-- 마이그레이션 상태 (스키마 drift 확인용). 구조 메타(pg_catalog/information_schema)는 기본 허용.
grant usage  on schema supabase_migrations            to mcp_ro_real;
grant select on supabase_migrations.schema_migrations to mcp_ro_real;

----------------------------------------------------------------------
-- 2. PII-redacted 행 뷰 (seller_id UUID 유지, PII 컬럼은 리터럴 '<redacted>')
----------------------------------------------------------------------
create or replace view mcp_ro.sellers_redacted with (security_invoker = off) as
select id as seller_id,
       '<redacted>'::text as display_name,
       business_type, signup_provider, marketing_consent,
       last_active_at, created_at, updated_at
from public.sellers;
comment on view mcp_ro.sellers_redacted is 'mcp-hosting.md §5.3. display_name redacted.';

create or replace view mcp_ro.orders_redacted with (security_invoker = off) as
select id, seller_id, market_id, external_order_id,
       '<redacted>'::text as buyer_name,
       '<redacted>'::text as receiver_name,
       '<redacted>'::text as receiver_address,
       '<redacted>'::text as receiver_phone,
       product_name, quantity, order_amount, status,
       logen_order_id, waybill_number, carrier_code,
       error_code,                                   -- error_message 는 raw 응답 잔여 우려 → 제외
       attempt_count,
       collected_at, logen_registered_at, waybill_printed_at, dispatched_at,
       created_at, updated_at
from public.orders;
comment on view mcp_ro.orders_redacted is 'mcp-hosting.md §5.3. buyer/receiver PII redacted, error_message 제외.';

create or replace view mcp_ro.market_accounts_redacted with (security_invoker = off) as
select id, seller_id, market_id, status,
       connected_at, last_verified_at, last_error_code, last_error_at,
       disconnected_at, created_at, updated_at
from public.market_accounts;          -- account_label / external_account_id / credential_id 제외
comment on view mcp_ro.market_accounts_redacted is 'mcp-hosting.md §5.3. account_label/external_account_id/credential_id 제외.';

----------------------------------------------------------------------
-- 3. PII 없는 테이블: 전역(cross-seller) 그대로 노출
----------------------------------------------------------------------
create or replace view mcp_ro.jobs with (security_invoker = off) as
select id, seller_id, product_id, status, retry_count, error_summary,
       parent_job_id, correlation_id,
       created_at, started_at, completed_at, cancelled_at
from public.registration_jobs;
comment on view mcp_ro.jobs is 'mcp-hosting.md §5.3. registration_jobs 전역 노출 (PII 없음).';

create or replace view mcp_ro.market_results with (security_invoker = off) as
select id, job_id, market_id, market_account_id, market_status,
       external_product_id, product_url, error_code, attempt_count,
       excluded, last_attempted_at, created_at, updated_at
from public.registration_job_market_results;
comment on view mcp_ro.market_results is 'mcp-hosting.md §5.3. error_message 제외 (raw 응답 잔여 우려).';

----------------------------------------------------------------------
-- 4. 전역 집계 뷰: 기존 public KPI 뷰를 security_invoker=off 로 미러
--    (public 원본은 security_invoker=on → mcp_ro_real(비-authenticated, auth.uid() null)
--     로는 행 0/권한오류. 그래서 전역 집계로 재정의.)
----------------------------------------------------------------------
create or replace view mcp_ro.kpi_monthly_registrations with (security_invoker = off) as
select date_trunc('month', created_at) as month,
       count(*) as total_jobs,
       count(*) filter (where status = 'succeeded') as succeeded,
       count(*) filter (where status = 'partial')   as partial,
       count(*) filter (where status = 'failed')    as failed,
       count(*) filter (where status = 'cancelled') as cancelled,
       count(distinct seller_id) as active_sellers
from public.registration_jobs
where created_at >= now() - interval '24 months'
group by 1 order by 1 desc;

create or replace view mcp_ro.kpi_registration_duration with (security_invoker = off) as
select date_trunc('month', created_at) as month,
       count(*) filter (where completed_at is not null) as completed_jobs,
       percentile_cont(0.50) within group (
         order by extract(epoch from (completed_at - created_at)) * 1000)::bigint as p50_ms,
       percentile_cont(0.95) within group (
         order by extract(epoch from (completed_at - created_at)) * 1000)::bigint as p95_ms,
       percentile_cont(0.99) within group (
         order by extract(epoch from (completed_at - created_at)) * 1000)::bigint as p99_ms,
       avg(extract(epoch from (completed_at - created_at)) * 1000)::bigint as avg_ms
from public.registration_jobs
where completed_at is not null
  and status in ('succeeded','partial')          -- failed 는 분포 왜곡, 제외
  and created_at >= now() - interval '24 months'
group by 1 order by 1 desc;

-- MAU: 캘린더 월 distinct seller (전역). public.kpi_mau 의 트레일링-30d 서브쿼리는
--   ad-hoc 조회엔 과도 → 캘린더 월 집계로 단순화 (mcp-hosting.md §5.3 "동일 패턴, 전역 집계").
create or replace view mcp_ro.kpi_mau with (security_invoker = off) as
select date_trunc('month', started_at) as month,
       count(distinct seller_id) as mau_calendar
from public.sessions
where started_at >= now() - interval '24 months'
group by 1 order by 1 desc;

create or replace view mcp_ro.v2_kpi_daily_orders with (security_invoker = off) as
select (collected_at at time zone 'Asia/Seoul')::date as kpi_date,
       count(*)::int as orders_total,
       count(*) filter (where market_id = 'naver')::int   as orders_naver,
       count(*) filter (where market_id = 'coupang')::int as orders_coupang,
       count(*) filter (where market_id = 'gmarket')::int as orders_gmarket,
       count(*) filter (where market_id = 'auction')::int as orders_auction,
       count(*) filter (where market_id = '11st')::int    as orders_11st,
       count(*) filter (where status = 'logen_failed')::int    as orders_logen_failed,
       count(*) filter (where status = 'dispatch_failed')::int as orders_dispatch_failed
from public.orders
group by 1 order by 1 desc;

create or replace view mcp_ro.v2_kpi_daily_dispatch with (security_invoker = off) as
select (created_at at time zone 'Asia/Seoul')::date as kpi_date,
       count(*)::int as jobs_total,
       count(*) filter (where status = 'succeeded')::int as jobs_succeeded,
       count(*) filter (where status = 'partial')::int   as jobs_partial,
       count(*) filter (where status = 'failed')::int    as jobs_failed,
       coalesce(sum(order_count), 0)::int   as orders_attempted,
       coalesce(sum(success_count), 0)::int as orders_succeeded,
       coalesce(sum(failed_count), 0)::int  as orders_failed
from public.shipping_jobs
group by 1 order by 1 desc;

----------------------------------------------------------------------
-- 5. 뷰 일괄 select grant (스키마 안 테이블/뷰 전부) + 향후 신규 뷰 default privilege
----------------------------------------------------------------------
grant select on all tables in schema mcp_ro to mcp_ro_real;
alter default privileges in schema mcp_ro grant select on tables to mcp_ro_real;

commit;

-- 적용 검증 (수동):
--   set role mcp_ro_real;
--   select count(*) from mcp_ro.orders_redacted;            -- OK (receiver_* = '<redacted>')
--   select * from public.orders limit 1;                    -- ERROR: permission denied for schema public
--   insert into mcp_ro.jobs default values;                 -- ERROR: read-only / permission denied
--   reset role;
