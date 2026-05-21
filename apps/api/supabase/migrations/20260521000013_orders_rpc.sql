-- 20260521000013_orders_rpc.sql
-- 출처:
--   apps/web/src/features/orders/api/orders-api.ts (RawOrderRowSchema, remapOrderDetail)
--   docs/spec/PRD.md §6.1, §8 (주문 목록·상세 API, PII 마스킹)
--   docs/architecture/v1/cross-cutting/security.md §3 (PII 마스킹 강제)
-- 목적:
--   1) orders_with_dispatch_summary  — 집계 view (대시보드 오늘 요약)
--   2) list_orders(...)              — 주문 목록 keyset 페이지네이션 RPC
--   3) get_order(p_order_id)         — 주문 상세 RPC
-- 컬럼 aliasing (orders 테이블 실제 컬럼 → 프론트 기대 필드):
--   orders.status           → shipping_status
--   orders.collected_at     → ordered_at (마켓 수주 일시 근사값)
--   orders.error_message    → logen_error_message
--   orders.dispatched_at    → tracking_submitted_at
-- PII 마스킹 (security.md §3):
--   buyer_name              → buyer_masked_name  (이름 가운데 마스킹)
--   receiver_phone          → buyer_masked_phone (010-****-XXXX)
--   receiver_address        → shipping_address_masked (구 단위 이후 ***)

------------------------------------------------------------------------
-- 1. orders_with_dispatch_summary — 집계 view (PRD §2.5 오늘 요약)
--    fetchOrdersSummary() 가 .maybeSingle() 로 읽는 단일 row 집계.
--    security_invoker=on → 호출자 RLS 적용 → 본인 주문만 집계.
------------------------------------------------------------------------
create or replace view public.orders_with_dispatch_summary
with (security_invoker = on)
as
select
  count(*) filter (where status = 'collected')::int             as new_orders_count,
  count(*) filter (where status = 'logen_registered')::int      as logen_registered_count,
  count(*) filter (where status = 'waybill_printed')::int       as waybill_pending_count,
  count(*) filter (where status = 'tracking_submitted')::int    as dispatch_submitted_count,
  coalesce(
    (
      select jsonb_agg(m)
      from (
        select
          market_id,
          count(*) filter (where status = 'collected')::int        as new_orders_count,
          count(*) filter (
            where status in ('logen_registered','waybill_printed')
          )::int                                                    as pending_count
        from public.orders
        group by market_id
      ) m
    ),
    '[]'::jsonb
  ) as by_market
from public.orders;

comment on view public.orders_with_dispatch_summary is
  'PRD §2.5: 주문 현황 대시보드 오늘 요약. security_invoker=on (orders RLS 적용 → 본인 집계). '
  'fetchOrdersSummary() 의 .maybeSingle() 대상 — 단일 row 집계.';

grant select on public.orders_with_dispatch_summary to authenticated, service_role;

------------------------------------------------------------------------
-- 2. list_orders — 주문 목록 keyset 페이지네이션 RPC
--    orders-api.ts fetchOrdersList() 가 호출.
--    파라미터: market/status/date 필터 + keyset cursor (ordered_at DESC, id DESC).
--    반환: RawOrderRowSchema 와 1:1 (total_count 포함).
------------------------------------------------------------------------
create or replace function public.list_orders(
  p_market_id  text    default null,
  p_status     text    default null,
  p_from       text    default null,
  p_to         text    default null,
  p_q          text    default null,
  p_limit      int     default 50,
  p_cursor     text    default null,
  p_cursor_id  uuid    default null
)
returns table (
  id                     uuid,
  external_order_id      text,
  market_id              text,
  product_name           text,
  buyer_masked_name      text,
  shipping_status        text,
  market_dispatch_status text,
  waybill_number         text,
  ordered_at             timestamptz,
  updated_at             timestamptz,
  total_count            bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with base as (
    select
      o.id,
      o.external_order_id,
      o.market_id,
      o.product_name,
      -- PII 마스킹: 이름 가운데 * (security.md §3)
      case
        when o.buyer_name is null or char_length(o.buyer_name) = 0 then ''
        when char_length(o.buyer_name) <= 1 then o.buyer_name
        when char_length(o.buyer_name) = 2 then
          substring(o.buyer_name, 1, 1) || '*'
        else
          substring(o.buyer_name, 1, 1)
          || repeat('*', char_length(o.buyer_name) - 2)
          || right(o.buyer_name, 1)
      end                                                       as buyer_masked_name,
      o.status::text                                            as shipping_status,
      -- 최신 dispatch 결과 상태 (없으면 null)
      (
        select r.status::text
        from public.shipping_job_results r
        where r.order_id = o.id
        order by r.created_at desc
        limit 1
      )                                                         as market_dispatch_status,
      o.waybill_number,
      o.collected_at                                            as ordered_at,
      o.updated_at,
      count(*) over ()                                          as total_count
    from public.orders o
    where
      (p_market_id is null or o.market_id = p_market_id)
      and (p_status   is null or o.status::text = p_status)
      and (p_from     is null or o.collected_at >= p_from::timestamptz)
      and (p_to       is null or o.collected_at <= p_to::timestamptz)
      and (
        p_q is null
        or o.product_name       ilike '%' || p_q || '%'
        or o.external_order_id  ilike '%' || p_q || '%'
      )
      -- keyset cursor: (collected_at DESC, id DESC) 기준 다음 페이지
      and (
        p_cursor is null
        or p_cursor_id is null
        or o.collected_at < p_cursor::timestamptz
        or (o.collected_at = p_cursor::timestamptz and o.id < p_cursor_id)
      )
    order by o.collected_at desc, o.id desc
    limit p_limit
  )
  select * from base;
$$;

revoke all on function public.list_orders(text,text,text,text,text,int,text,uuid) from public, anon;
grant execute on function public.list_orders(text,text,text,text,text,int,text,uuid) to authenticated, service_role;

comment on function public.list_orders is
  'PRD §6.1: 주문 목록 keyset 페이지네이션. security invoker → orders RLS 적용. '
  'shipping_status = orders.status alias. PII 마스킹(buyer_name). '
  '페이지네이션: (ordered_at DESC, id DESC) keyset cursor.';

------------------------------------------------------------------------
-- 3. get_order — 주문 상세 RPC
--    orders-api.ts fetchOrderDetail() 가 호출.
--    반환: {order: {...}} JSONB — remapOrderDetail() 이 camelCase 로 변환.
------------------------------------------------------------------------
create or replace function public.get_order(p_order_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_row   public.orders%rowtype;
  v_dispatch_status text;
begin
  select * into v_row
  from public.orders
  where id = p_order_id;

  if not found then
    return null;
  end if;

  -- 최신 dispatch 상태
  select r.status::text into v_dispatch_status
  from public.shipping_job_results r
  where r.order_id = p_order_id
  order by r.created_at desc
  limit 1;

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id',                     v_row.id,
      'seller_id',              v_row.seller_id,
      'external_order_id',      v_row.external_order_id,
      'market_id',              v_row.market_id,
      'product_name',           v_row.product_name,
      'product_option',         null,   -- v1: orders 테이블 미존재 컬럼, null 반환
      'quantity',               v_row.quantity,
      -- PII 마스킹 (security.md §3)
      'buyer_masked_name',      case
        when v_row.buyer_name is null or char_length(v_row.buyer_name) = 0 then ''
        when char_length(v_row.buyer_name) <= 1 then v_row.buyer_name
        when char_length(v_row.buyer_name) = 2 then
          substring(v_row.buyer_name, 1, 1) || '*'
        else
          substring(v_row.buyer_name, 1, 1)
          || repeat('*', char_length(v_row.buyer_name) - 2)
          || right(v_row.buyer_name, 1)
      end,
      'buyer_masked_phone',     case
        when v_row.receiver_phone ~ '^\d{3}-\d{3,4}-\d{4}$' then
          split_part(v_row.receiver_phone, '-', 1) || '-****-' || split_part(v_row.receiver_phone, '-', 3)
        when char_length(v_row.receiver_phone) > 7 then
          left(v_row.receiver_phone, 3) || repeat('*', char_length(v_row.receiver_phone) - 7) || right(v_row.receiver_phone, 4)
        else v_row.receiver_phone
      end,
      'shipping_address_masked', case
        when v_row.receiver_address is null then null
        when char_length(v_row.receiver_address) <= 20 then v_row.receiver_address
        else substring(v_row.receiver_address, 1, 20) || ' ***'
      end,
      'shipping_status',        v_row.status::text,
      'market_dispatch_status', v_dispatch_status,
      'waybill_number',         v_row.waybill_number,
      'logen_error_message',    v_row.error_message,
      'ordered_at',             v_row.collected_at,
      'collected_at',           v_row.collected_at,
      'logen_registered_at',    v_row.logen_registered_at,
      'waybill_printed_at',     v_row.waybill_printed_at,
      'tracking_submitted_at',  v_row.dispatched_at,
      'updated_at',             v_row.updated_at
    )
  );
end;
$$;

revoke all on function public.get_order(uuid) from public, anon;
grant execute on function public.get_order(uuid) to authenticated, service_role;

comment on function public.get_order is
  'PRD §6.1: 주문 상세 단건 조회. security invoker → orders RLS 적용 (타인 주문 접근 불가). '
  'PII 마스킹: buyer_name / receiver_phone / receiver_address. '
  '반환: {order: {...}} JSONB — orders-api.ts remapOrderDetail() 대상.';
