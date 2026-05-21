-- 20260521000012_shipping_views_rpc.sql
-- 출처:
--   docs/spec/PRD.md §6.3 (운송장 출력), §6.4 (송장 일괄 제출 이력)
--   docs/spec/user_flow.md s8 n52~n57, s9 n58~n60
--   apps/web/src/features/shipping/types/shipping-schema.ts (클라이언트 zod 스키마)
--   apps/web/src/lib/schemas/logen.ts (LogenCredentialsStatusSchema)
-- 목적:
--   1) shipping_jobs_with_summary  — 배송 이력 목록용 집계 view
--   2) shipping_job_market_results — 잡 상세 마켓별 집계 view
--   3) get_logen_credentials_status — 로젠 연동 상태 조회 RPC

----------------------------------------------------------------------
-- 1. shipping_jobs_with_summary (PRD §6.4 이력 목록)
--    shipping-api.ts fetchShippingJobs() 가 읽는 view.
--    shipping_jobs 를 security_invoker=on 으로 읽으면 기존 RLS 적용됨.
--    클라이언트 ShippingJobListItemSchema 에 맞춰 컬럼 aliasing.
----------------------------------------------------------------------
create or replace view public.shipping_jobs_with_summary
with (security_invoker = on)
as
select
  j.id,
  j.seller_id,
  j.status,
  j.order_count                        as total_orders,
  0                                    as retry_count,     -- v1: 재시도 미지원. 상위 호환 상수.
  j.error_summary,
  null::uuid                           as parent_job_id,   -- v1: 부모잡 미지원. 상위 호환 null.
  j.created_at,
  j.started_at,
  j.completed_at,
  j.success_count,
  j.failed_count,
  -- 이 잡에 포함된 마켓 ID 배열 (중복 제거)
  coalesce(
    (
      select array_agg(distinct r.market_id order by r.market_id)
      from public.shipping_job_results r
      where r.job_id = j.id
    ),
    '{}'::text[]
  )                                    as market_ids
from public.shipping_jobs j;

comment on view public.shipping_jobs_with_summary is
  'PRD §6.4: 송장 일괄 제출 이력 목록. security_invoker=on → shipping_jobs RLS 적용. '
  'retry_count / parent_job_id 는 v1 미지원으로 상수(0/null).';

grant select on public.shipping_jobs_with_summary to authenticated, service_role;

----------------------------------------------------------------------
-- 2. shipping_job_market_results (PRD §6.4 잡 상세 마켓별 집계)
--    shipping-api.ts fetchShippingJobWithResults() 가 읽는 view.
--    shipping_job_results(주문 단위) 를 (job_id, market_id) 로 집계해
--    마켓별 성공·실패 건수 + 대표 에러를 노출.
--
--    market_account_id: orders.market_id + seller_id 로 market_accounts 조인.
--    한 셀러·한 마켓에 active 계정이 1개라는 v1 가정 하에 DISTINCT ON 로 대표 1건.
--    (멀티 계정 지원 시 재설계 필요.)
----------------------------------------------------------------------
create or replace view public.shipping_job_market_results
with (security_invoker = on)
as
with per_market as (
  select
    r.job_id,
    r.market_id,
    -- 대표 market_account_id: 잡에 속한 주문의 seller_id + market_id 로 조인
    (
      select ma.id
      from public.market_accounts ma
      join public.orders o2 on o2.seller_id = ma.seller_id
      where o2.id = min(r.order_id::text)::uuid
        and ma.market_id = r.market_id
      limit 1
    )                                                          as market_account_id,
    -- 집계 id: 마켓 결과 그룹 식별자 (min uuid — deterministic)
    min(r.id::text)::uuid                                      as id,
    -- 상태: 실패가 하나라도 있으면 'failed', 전부 성공이면 'success'
    case
      when count(*) filter (where r.status = 'failed') > 0
       and count(*) filter (where r.status = 'success') > 0 then 'failed'
      when count(*) filter (where r.status = 'failed') = count(*) then 'failed'
      else 'success'
    end                                                         as status,
    count(*)::int                                               as total_orders,
    count(*) filter (where r.status = 'success')::int           as success_orders,
    count(*) filter (where r.status = 'failed')::int            as failed_orders,
    -- 가장 최근 실패 에러 코드/메시지를 대표로
    (array_agg(r.error_code order by r.created_at desc)
       filter (where r.error_code is not null)
    )[1]                                                        as error_code,
    (array_agg(r.error_message order by r.created_at desc)
       filter (where r.error_message is not null)
    )[1]                                                        as error_message,
    max(r.attempt_count)::int                                   as attempt_count,
    max(r.created_at)                                           as last_attempted_at
  from public.shipping_job_results r
  group by r.job_id, r.market_id
)
select
  pm.id,
  pm.job_id,
  pm.market_id,
  pm.market_account_id,
  pm.status,
  pm.total_orders,
  pm.success_orders,
  pm.failed_orders,
  pm.error_code,
  pm.error_message,
  pm.attempt_count,
  pm.last_attempted_at
from per_market pm
-- security_invoker=on: shipping_job_results → RLS 적용됨.
-- 추가로 부모 잡의 seller_id = auth.uid() 확인
where exists (
  select 1 from public.shipping_jobs sj
  where sj.id = pm.job_id
    and sj.seller_id = auth.uid()
);

comment on view public.shipping_job_market_results is
  'PRD §6.4: 잡 상세 마켓별 집계. shipping_job_results(주문 단위)를 (job_id, market_id) 로 집계. '
  'security_invoker=on + parent shipping_jobs RLS 교차 검사. '
  'market_account_id 는 v1 단일계정 가정(한 셀러·한 마켓에 active 1개)으로 limit 1 조인.';

grant select on public.shipping_job_market_results to authenticated, service_role;

----------------------------------------------------------------------
-- 3. get_logen_credentials_status (PRD §8 — 평문 자격증명 절대 비반환)
--    shipping-settings-api.ts fetchLogenCredentialsStatus() 가 호출하는 RPC.
--    LogenCredentialsStatusSchema 와 1:1:
--      hasCredentials / hasSenderInfo / lastVerifiedAt / lastErrorAt / lastErrorCode / senderInfo
--    security definer: logen_credentials RLS = 정책 0개(authenticated 전면 차단)이므로
--    definer 권한으로 읽어 평문이 아닌 메타만 반환.
----------------------------------------------------------------------
create or replace function public.get_logen_credentials_status()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_seller_id uuid;
  v_row       public.logen_credentials%rowtype;
  v_found     boolean;
begin
  v_seller_id := auth.uid();
  if v_seller_id is null then
    raise exception 'get_logen_credentials_status: authentication required';
  end if;

  select * into v_row
  from public.logen_credentials
  where seller_id = v_seller_id;

  v_found := found;

  return jsonb_build_object(
    -- 암호화된 자격증명(userId/custCd) 존재 여부만
    'hasCredentials', v_found,
    -- v1: 자격증명과 발송인 정보는 함께 저장 (set_logen_credentials 가 atomic)
    'hasSenderInfo',  v_found,
    -- v1: DB에 verified_at / error_at 컬럼 미존재 → null 반환 (v2 컬럼 추가 시 교체)
    'lastVerifiedAt', null::text,
    'lastErrorAt',    null::text,
    'lastErrorCode',  null::text,
    -- 발송인 정보는 평문 노출 허용 (셀러 본인 정보)
    'senderInfo', case
      when v_found then jsonb_build_object(
        'name',    v_row.sender_name,
        'address', v_row.sender_address,
        'phone',   v_row.sender_phone,
        'fareTy',  v_row.fare_ty,
        'dlvFare', v_row.dlv_fare
      )
      else null
    end
  );
end;
$$;

revoke all on function public.get_logen_credentials_status() from public, anon;
grant execute on function public.get_logen_credentials_status() to authenticated, service_role;

comment on function public.get_logen_credentials_status() is
  'PRD §8: 셀러 본인의 로젠 자격증명 상태 조회. security definer (logen_credentials RLS bypass). '
  '평문 자격증명(userId/custCd) 절대 미반환 — hasCredentials boolean + 발송인 평문만 노출. '
  '반환 타입: LogenCredentialsStatusSchema (apps/web/src/lib/schemas/logen.ts).';
