-- 20260530000003_orders_extra_jsonb.sql
-- 출처:
--   docs/architecture/v1/features/11st.md (PR-5 발송처리 1888 — path 키 dlvNo)
--   docs/handoff/WIP-5markets-mvp.md (NEW-1 — dlvNo plumbing)
-- 목적:
--   11번가 발송처리(GET /ordservices/reqdelivery/.../{dlvNo}, 1888)의 path 키는 dlvNo(배송번호)이며
--   주문번호(ordNo = external_order_id)와 다른 값이다. 주문 수집 시 어댑터가 MarketOrder.extra.dlvNo
--   로 수집하지만 orders 테이블에 보존할 컬럼이 없어 발송 워커가 dlvNo 를 얻지 못했다(현재는
--   external_order_id 를 dlvNo 자리에 잘못 전달). 마켓별 발송키를 범용 보존하기 위해 extra jsonb 추가.
-- 비고:
--   - 마켓별 발송/식별 보조 키 단일 컨테이너 (현재 11번가 dlvNo. 쿠팡 vendor_item_id 는 기존 전용 컬럼 유지).
--   - 기존 row 는 NULL. 컬럼 추가만 → RLS / GRANT / 트리거 영향 없음.
--   - idempotent: add column if not exists.

begin;

alter table public.orders
  add column if not exists extra jsonb;

comment on column public.orders.extra is
  '마켓별 발송/식별 보조 키 컨테이너 (jsonb). '
  '11번가: { "dlvNo": "..." } — 발송처리(1888) path 키. 어댑터 MarketOrder.extra 를 그대로 적재. '
  '다른 마켓은 사용하지 않으면 NULL.';

commit;
