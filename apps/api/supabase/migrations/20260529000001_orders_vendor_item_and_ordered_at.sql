-- 20260529000001_orders_vendor_item_and_ordered_at.sql
-- 출처:
--   docs/architecture/v1/features/coupang-api/shipping-refund/발주서-목록-조회일단위-페이징.md
--     (entry-level 에 orderedAt / paidAt / orderId / vendorItemId 존재)
--   docs/spec/PRD.md §6 (주문 자동 수집) — 시점 컬럼 분리 의미 명확화
-- 목적:
--   PR #246 에서 잔여한 정합 #3 해소:
--     1) 쿠팡 송장 제출 v4 /orders/invoices 본체에 vendor_item_id 필수 → orders 테이블에 보존.
--     2) paidAt(결제완료) 와 collected_at(수집시각) 의미 분리. 기존 orders 는 collected_at 에
--        마켓의 paidAt 을 적재해 두 의미가 섞여 있었음 — 새 컬럼 ordered_at / paid_at 추가 후
--        orders-sync 가 분리 적재. collected_at 은 "우리 시스템 수집 시각" 으로 재정의.
-- 비고:
--   - 기존 데이터 백필은 본 PR 범위 외. 신규 컬럼 default NULL — 기존 row 는 ordered_at/paid_at NULL.
--   - 컬럼 추가만 → RLS / GRANT 영향 없음. 정책 / 트리거 / 인덱스 추가 안전.
--   - idempotent: 모든 alter / index / comment 에 IF NOT EXISTS 사용.

begin;

-- 1. 신규 컬럼 (모두 nullable — 마켓별 응답에 없으면 NULL).
alter table public.orders
  add column if not exists vendor_item_id text;

alter table public.orders
  add column if not exists ordered_at timestamptz;

alter table public.orders
  add column if not exists paid_at timestamptz;

-- 2. 인덱스 — 대시보드 / 주문 목록의 결제일 정렬을 위해 ordered_at 보조.
--    RLS 와 호환되도록 seller_id 선행, ordered_at 내림차순.
create index if not exists orders_seller_ordered_desc
  on public.orders (seller_id, ordered_at desc);

create index if not exists orders_seller_paid_desc
  on public.orders (seller_id, paid_at desc);

-- 3. 컬럼 의미 재정의 (comment 만 갱신 — 데이터 손상 없음).
comment on column public.orders.collected_at is
  '우리 시스템이 마켓에서 수집한 시각 (2026-05-29 정합). '
  'paid_at(결제완료) 와 분리. 이전 PR 에서는 collected_at 에 paidAt 이 섞여 있었음.';
comment on column public.orders.ordered_at is
  'PRD §6 / coupang docs: 마켓 응답의 orderedAt — 주문 생성 시각. 마켓별 응답에 없으면 NULL.';
comment on column public.orders.paid_at is
  'PRD §6 / coupang docs: 마켓 응답의 paidAt — 결제 완료 시각. 발송 대기 큐 정렬·SLA 측정 기준. '
  '마켓별 응답에 없으면 NULL.';
comment on column public.orders.vendor_item_id is
  '쿠팡 vendor_item_id — 송장 제출 (POST /orders/invoices) body 의 vendorItemId 로 재사용. '
  '다른 마켓은 사용하지 않음 (NULL).';

commit;
