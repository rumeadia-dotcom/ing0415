-- 20260523000003_order_groups.sql
-- Phase 1 of v1.4 order-grouping (docs/architecture/v1/features/order-grouping.md)
--
-- 도메인 문제:
--   고객 1건 주문 + 추가 옵션 → 마켓 API 가 multi-row 반환. 현재 1 order=1 logen=1
--   waybill 가정이라 송장 N장 발급 사고. 그룹 단위 1송장 처리 위한 데이터 모델.
--
-- 본 마이그레이션 범위 (Phase 1, spec 무관):
--   1. order_groups 테이블 신설 — 그룹 단위 logen / waybill / status
--   2. orders 에 order_group_id 컬럼 + FK
--   3. 기존 데이터 1:1 backfill — 모든 기존 order 마다 group 1개 생성 + 연결
--      + logen_order_id / waybill_number 를 그룹으로 복사
--   4. RLS + GRANT (service_role + authenticated)
--   5. order_groups 의 status enum 신설 (group_status)
--
-- 비범위 (Phase 2+):
--   - orders.logen_order_id / waybill_number / carrier_code 컬럼 drop (v1.5 점진 deprecation)
--   - MarketOrder externalGroupId zod 스키마 (Phase 2)
--   - orders-sync 의 그룹 추출 (Phase 3)
--   - shipping-dispatch 의 그룹 단위 로젠·송장 (Phase 4)
--
-- 안전:
--   - 기존 orders 데이터 손실 없음 (read-only backfill)
--   - 기존 컬럼 (logen_order_id 등) 유지 — Phase 4 후 v1.5 에서 drop
--   - RLS = seller_id = auth.uid()

----------------------------------------------------------------------
-- 1. group_status ENUM
----------------------------------------------------------------------
create type public.group_status as enum (
  'collected',
  'logen_registered',
  'logen_failed',
  'waybill_printed',
  'tracking_submitted',
  'dispatch_failed'
);

comment on type public.group_status is
  '주문 그룹의 진행 상태. orders.status 와 1:1 매핑 — 그룹의 모든 item 이 같은 단계로 진행됨이 정상.';

----------------------------------------------------------------------
-- 2. order_groups 테이블
----------------------------------------------------------------------
create table public.order_groups (
  id                    uuid primary key default gen_random_uuid(),
  seller_id             uuid not null references auth.users(id) on delete cascade,

  -- 마켓 식별 + 마켓의 그룹 키 (예: 네이버 orderId / 쿠팡 shipmentBoxId / ESM orderNo / 11st ordNo)
  market_id             text not null
                        check (market_id in ('naver','coupang','11st','gmarket','auction')),
  external_group_id     text not null,

  -- 그룹의 수취 정보 (그룹 내 모든 orders 가 동일해야 함 — orders-sync 가 정합 검증)
  buyer_name            text,
  receiver_name         text not null,
  receiver_address      text not null,
  receiver_phone        text not null,

  -- 로젠 송장 — 그룹 단위 1개 (그룹 = 1 박스 = 1 송장)
  logen_order_id        text,        -- registerOrderData 응답
  waybill_number        text,        -- getSlipNo 응답
  carrier_code          text not null default 'LOGEN',

  -- 그룹 상태 (PRD-v2 §2.1 동등 — orders 와 1:1 매핑)
  status                public.group_status not null default 'collected',

  -- 실패 진단 (logen_failed / dispatch_failed 시 채움)
  error_code            text,
  error_message         text,
  attempt_count         smallint not null default 0 check (attempt_count between 0 and 5),

  -- 시점
  collected_at          timestamptz not null default now(),
  logen_registered_at   timestamptz,
  waybill_printed_at    timestamptz,
  dispatched_at         timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- UNIQUE 제약 — 같은 셀러·마켓의 동일 그룹 키는 1 row
  constraint order_groups_unique_market_external unique (market_id, external_group_id, seller_id),

  -- 길이 제한 (orders 와 일관)
  constraint order_groups_receiver_name_len  check (char_length(receiver_name) between 1 and 100),
  constraint order_groups_receiver_addr_len  check (char_length(receiver_address) between 1 and 500),
  constraint order_groups_receiver_phone_len check (char_length(receiver_phone) between 1 and 30)
);

create index order_groups_seller_idx          on public.order_groups (seller_id);
create index order_groups_seller_status_idx   on public.order_groups (seller_id, status);
create index order_groups_seller_collected_desc on public.order_groups (seller_id, collected_at desc);
create index order_groups_market_idx          on public.order_groups (market_id);
create index order_groups_waybill_idx         on public.order_groups (waybill_number) where waybill_number is not null;

alter table public.order_groups enable row level security;

-- RLS — orders 와 동일 패턴 (본인 데이터만)
create policy order_groups_select_own
  on public.order_groups for select
  using (seller_id = auth.uid());

create policy order_groups_insert_own
  on public.order_groups for insert
  with check (seller_id = auth.uid());

create policy order_groups_update_own
  on public.order_groups for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

-- GRANT — authenticated 가 본인 row DML, service_role 은 RLS bypass + 전체.
-- (default privileges 가 service_role 에는 이미 적용되지만 명시 grant 도 추가)
grant select, insert, update, delete on public.order_groups to authenticated;
grant select, insert, update, delete on public.order_groups to service_role;

comment on table public.order_groups is
  '주문 그룹 (1박스 단위) — 다중 옵션 주문의 통합 송장 처리. 마스터: docs/architecture/v1/features/order-grouping.md';
comment on column public.order_groups.external_group_id is
  '마켓의 그룹 키. 네이버 orderId / 쿠팡 shipmentBoxId / ESM orderNo / 11st ordNo.';
comment on column public.order_groups.waybill_number is
  '그룹 단위 1개 송장 번호. orders.waybill_number 는 v1.4 까지 그룹과 동일값으로 복제 유지 (v1.5 drop 예정).';

----------------------------------------------------------------------
-- 3. orders 에 order_group_id 컬럼 추가
----------------------------------------------------------------------
alter table public.orders
  add column order_group_id uuid references public.order_groups(id) on delete cascade;

create index orders_order_group_idx on public.orders (order_group_id);

comment on column public.orders.order_group_id is
  '소속 order_group. v1.4 이후 신규 row 는 반드시 채워짐. backfill 로 기존 row 도 1:1 group 에 연결.';

----------------------------------------------------------------------
-- 4. Backfill — 기존 orders 의 각 row 에 group 1:1 생성 + 연결
----------------------------------------------------------------------
-- 안전: 기존 데이터의 외부 ID 가 그룹 키로 그대로 승격 (단일 item 그룹).
-- 운영 첫 적용 시점에는 orders 가 거의 비어 있을 가능성 큼 — 실 효과는 적지만 무결성 보장.

do $$
declare
  inserted_groups int;
  updated_orders int;
begin
  -- 4.1 각 order 에 1:1 group 생성 (이미 group 있는 경우 skip)
  with new_groups as (
    insert into public.order_groups (
      id, seller_id, market_id, external_group_id,
      buyer_name, receiver_name, receiver_address, receiver_phone,
      logen_order_id, waybill_number, carrier_code,
      status,
      error_code, error_message, attempt_count,
      collected_at, logen_registered_at, waybill_printed_at, dispatched_at,
      created_at, updated_at
    )
    select
      gen_random_uuid(),
      o.seller_id, o.market_id, o.external_order_id,
      o.buyer_name, o.receiver_name, o.receiver_address, o.receiver_phone,
      o.logen_order_id, o.waybill_number, o.carrier_code,
      -- order_status enum → group_status enum (동일 텍스트 변환)
      o.status::text::public.group_status,
      o.error_code, o.error_message, o.attempt_count,
      o.collected_at, o.logen_registered_at, o.waybill_printed_at, o.dispatched_at,
      o.created_at, o.updated_at
    from public.orders o
    where o.order_group_id is null
    on conflict (market_id, external_group_id, seller_id) do nothing
    returning id, seller_id, market_id, external_group_id
  )
  -- 4.2 신규 group 의 id 를 해당 order 의 order_group_id 에 연결
  update public.orders o
  set order_group_id = g.id
  from new_groups g
  where o.seller_id = g.seller_id
    and o.market_id = g.market_id
    and o.external_order_id = g.external_group_id
    and o.order_group_id is null;

  get diagnostics updated_orders = row_count;

  select count(*) into inserted_groups from public.order_groups;

  raise notice 'order_groups backfill — total_groups=%, updated_orders=%',
    inserted_groups, updated_orders;
end $$;
