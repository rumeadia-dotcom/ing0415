-- 20260521000001_orders.sql
-- 출처:
--   docs/spec/PRD.md §6.1 (주문 자동 수집) — 상태 ENUM, 수집 데이터, 중복 방지 UNIQUE
--   docs/spec/PRD.md §8 (데이터 모델 — orders DDL 마스터)
--   docs/architecture/v1/cross-cutting/security.md §3 RLS 정책 패턴 (seller_id = auth.uid())
-- 목적:
--   v2 주문·배송 자동화 도메인 1단계. 4마켓(네이버/쿠팡/G마켓/옥션) 신규 주문을
--   pg_cron + orders-sync Edge Function 으로 10분 폴링 적재하는 마스터 테이블.
-- 비고:
--   - 클라이언트(authenticated)는 본인 row 의 SELECT 만. INSERT/UPDATE 는 service_role
--     (orders-sync / logen-register-shipment / shipping-dispatch-job) 만 수행.
--   - DELETE 는 정책 부재 → forward-only, soft delete 도 v1 범위 외.
--   - waybill_number / logen_order_id 는 collected 시점 NULL, registerOrderData 응답 후 채워짐.

----------------------------------------------------------------------
-- 1. ENUM (PRD-v2 §2.1)
----------------------------------------------------------------------
create type public.order_status as enum (
  'collected',
  'logen_registered',
  'logen_failed',
  'waybill_printed',
  'tracking_submitted',
  'dispatch_failed'
);

----------------------------------------------------------------------
-- 2. orders (PRD-v2 §4)
----------------------------------------------------------------------
create table public.orders (
  id                  uuid primary key default gen_random_uuid(),
  seller_id           uuid not null references auth.users(id) on delete cascade,

  -- 마켓 식별 (registration / markets 도메인의 MARKET_IDS 와 동일 4-way enum text)
  market_id           text not null
                      check (market_id in ('naver','coupang','11st','gmarket','auction')),
  external_order_id   text not null,

  -- 수취 정보 (collectors 가 마켓 응답에서 채움)
  buyer_name          text,
  receiver_name       text not null,
  receiver_address    text not null,
  receiver_phone      text not null,

  -- 상품 정보 (마켓 응답 스냅샷)
  product_name        text not null,
  quantity            integer not null check (quantity >= 1),
  order_amount        integer not null check (order_amount >= 0),

  -- 상태 (PRD-v2 §2.1)
  status              public.order_status not null default 'collected',

  -- 로젠 연동 산출물 (PRD-v2 §2.2)
  logen_order_id      text,        -- fixTakeNo (registerOrderData 응답)
  waybill_number      text,        -- slipNo (getSlipNo 응답)
  carrier_code        text not null default 'LOGEN',

  -- 실패 진단 (logen_failed / dispatch_failed 시 채움). 마스킹된 사용자 노출 메시지.
  error_code          text,
  error_message       text,
  attempt_count       smallint not null default 0 check (attempt_count between 0 and 5),

  -- 시점 컬럼 (PRD-v2 §2.1 — collected → logen → printed → dispatched 진행 추적)
  collected_at        timestamptz not null default now(),
  logen_registered_at timestamptz,
  waybill_printed_at  timestamptz,
  dispatched_at       timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- PRD-v2 §2.1: 중복 방지 (10분 폴링 시 같은 주문 재INSERT 차단).
  constraint orders_unique_market_external unique (market_id, external_order_id, seller_id),
  constraint orders_product_name_len   check (char_length(product_name) between 1 and 500),
  constraint orders_receiver_name_len  check (char_length(receiver_name) between 1 and 100),
  constraint orders_receiver_addr_len  check (char_length(receiver_address) between 1 and 500),
  constraint orders_receiver_phone_len check (char_length(receiver_phone) between 1 and 30)
);

create index orders_seller_idx           on public.orders (seller_id);
create index orders_seller_status_idx    on public.orders (seller_id, status);
-- 대시보드 / 주문 목록 정렬 (PRD-v2 §2.5)
create index orders_seller_collected_desc on public.orders (seller_id, collected_at desc);
create index orders_market_idx           on public.orders (market_id);
create index orders_waybill_idx          on public.orders (waybill_number) where waybill_number is not null;

alter table public.orders enable row level security;

-- SELECT: 본인 주문만
create policy orders_select_own
  on public.orders for select
  using (seller_id = auth.uid());

-- INSERT: 본인 주문만 (클라이언트가 직접 만들 일은 거의 없으나, 수동 보정 경로 대비.
--   대량 적재는 service_role 의 orders-sync 함수가 RLS bypass 로 수행).
create policy orders_insert_own
  on public.orders for insert
  with check (seller_id = auth.uid());

-- UPDATE: 본인 주문만. 운송장 출력 완료 / 수동 송장 입력 같은 셀러 액션을 대비.
--   상태 전이 규칙은 RPC / Edge Function 측에서 강제 (DB CHECK 로 enum 만 보호).
create policy orders_update_own
  on public.orders for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

-- DELETE 정책 부재 → authenticated 의 DELETE 전면 차단. service_role 만 가능.

-- updated_at 트리거 (sellers 의 touch_updated_at 재사용)
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();

comment on table public.orders is
  'PRD-v2 §2.1 / §4. 4마켓 신규 주문 적재 + 로젠 등록·운송장·송장 제출 상태 추적. '
  'INSERT/UPDATE 대부분은 service_role (orders-sync, logen-register-shipment, shipping-dispatch-job).';
comment on column public.orders.status is
  'PRD-v2 §2.1: collected(수집) → logen_registered(집하 예약 + 운송장번호 채번 완료) → '
  'waybill_printed(물리 라벨 출력) → tracking_submitted(마켓 송장 제출 완료). '
  '실패 분기: logen_failed (registerOrderData/getSlipNo 실패) / dispatch_failed (마켓 송장 제출 실패).';
comment on column public.orders.logen_order_id is
  'PRD-v2 §2.2: registerOrderData 응답의 fixTakeNo. 같은 주문 재시도 시 동일 값 사용.';
comment on column public.orders.waybill_number is
  'PRD-v2 §2.2: getSlipNo 응답의 slipNo. 운송장 출력 / 마켓 송장 제출에 사용.';
