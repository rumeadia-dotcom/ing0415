-- verify-order-groups-backfill.sql
-- ----------------------------------------------------------------------
-- 목적:
--   `20260523000003_order_groups.sql` (v1.4 Phase 1) 의 backfill 정합성을
--   운영 DB 에 READ-ONLY 로 검증한다. 모든 query 는 SELECT only — UPDATE /
--   DELETE / DROP / ALTER 절대 포함 금지.
--
-- 적용 대상:
--   - dev  Supabase project: eqoywqoalwkwbrdsulfl
--   - real Supabase project: lfrnythcujxdhehvkmtg
--
-- 실행 방법:
--   1. `pnpm supabase:link:dev`  (또는 `:real`) 로 link
--   2. Supabase Studio → SQL Editor 에 본 파일을 통째로 붙여넣기, 또는
--      `psql "$DATABASE_URL" -f scripts/sql/verify-order-groups-backfill.sql`
--   3. 각 query 의 EXPECTED / IF FAIL 주석을 보고 해석
--
-- 해석 매뉴얼: docs/handoff/order-groups-backfill-verification.md
-- ----------------------------------------------------------------------

-- ======================================================================
-- [Q1] orphan orders — orders.order_group_id IS NULL row count
-- ----------------------------------------------------------------------
-- CHECK    : backfill 후에는 모든 기존 orders 가 그룹에 연결되어야 함.
-- EXPECTED : orphan_count = 0
-- IF FAIL  : backfill DO block 의 UPDATE 절이 어떤 row 를 못 잡았다는 뜻.
--            진단 query (매뉴얼 §진단 query 1) 로 해당 seller / market 식별.
-- ======================================================================
select
  count(*)                                                  as orphan_count,
  count(*) filter (where created_at < '2026-05-23'::date)   as orphan_pre_v14,
  count(*) filter (where created_at >= '2026-05-23'::date)  as orphan_post_v14
from public.orders
where order_group_id is null;

-- ======================================================================
-- [Q2] broken FK — orders.order_group_id 가 order_groups.id 에 매칭 안 되는 row
-- ----------------------------------------------------------------------
-- CHECK    : FK constraint 가 살아 있으면 0 이어야 한다. 0 이 아니라면
--            FK 가 NOT VALID 상태이거나 마이그레이션 도중 부분 적용된 흔적.
-- EXPECTED : broken_fk_count = 0
-- IF FAIL  : 즉시 운영 중단. order_groups 가 부분 삭제됐거나 마이그레이션
--            실패 흔적. 롤백 절차 (매뉴얼 §롤백) 검토.
-- ======================================================================
select
  count(*) as broken_fk_count
from public.orders o
left join public.order_groups g on g.id = o.order_group_id
where o.order_group_id is not null
  and g.id is null;

-- ======================================================================
-- [Q3] group→order 매핑 — 같은 group 안 orders 의 seller_id / market_id /
--                          external_* 일치 여부
-- ----------------------------------------------------------------------
-- CHECK    : Phase 1 backfill 은 1:1 매핑이므로 그룹 내 orders 는
--            전부 동일 seller_id, market_id 여야 하고
--            orders.external_order_id = order_groups.external_group_id 이어야 함.
-- EXPECTED : mismatch_count = 0
-- IF FAIL  : backfill 의 join 조건 (seller_id + market_id + external_order_id)
--            이 깨졌다는 뜻. 진단 query (매뉴얼 §진단 query 2) 로 좁힘.
-- ======================================================================
select
  count(*) filter (where o.seller_id          <> g.seller_id)         as seller_mismatch,
  count(*) filter (where o.market_id          <> g.market_id)         as market_mismatch,
  count(*) filter (where o.external_order_id  <> g.external_group_id) as external_mismatch,
  count(*) filter (
    where o.seller_id          <> g.seller_id
       or o.market_id          <> g.market_id
       or o.external_order_id  <> g.external_group_id
  )                                                                    as mismatch_count
from public.orders o
join public.order_groups g on g.id = o.order_group_id;

-- ======================================================================
-- [Q4] logen_order_id / waybill_number 매핑 — group ↔ first order
-- ----------------------------------------------------------------------
-- CHECK    : Phase 1 backfill 은 1:1 이므로 group.logen_order_id 와
--            연결된 order.logen_order_id 가 동일해야 한다 (NULL 도 동일).
--            waybill_number 도 동일 룰.
-- EXPECTED : logen_mismatch = 0  AND  waybill_mismatch = 0
-- IF FAIL  : 그룹 단위 송장 데이터가 깨져 있다 — 운영 송장 출력이 즉시 멈출 수 있음.
--            매뉴얼 §진단 query 3 으로 영향받은 그룹 ID 추출.
-- ======================================================================
select
  count(*) filter (
    where o.logen_order_id is distinct from g.logen_order_id
  )                                                              as logen_mismatch,
  count(*) filter (
    where o.waybill_number is distinct from g.waybill_number
  )                                                              as waybill_mismatch,
  count(*) filter (
    where o.carrier_code is distinct from g.carrier_code
  )                                                              as carrier_mismatch
from public.orders o
join public.order_groups g on g.id = o.order_group_id;

-- ======================================================================
-- [Q5] 상태 매핑 — order_groups.status (group_status) ↔ orders.status (order_status)
-- ----------------------------------------------------------------------
-- CHECK    : 두 ENUM 은 동일 텍스트 6개 (collected / logen_registered /
--            logen_failed / waybill_printed / tracking_submitted /
--            dispatch_failed) 로 1:1 매핑. backfill 은 텍스트 변환으로 복사.
-- EXPECTED : status_mismatch = 0
-- IF FAIL  : ENUM 정의가 한쪽에서 변경됐거나 backfill 변환 중 누락이 있음.
--            매뉴얼 §진단 query 4 로 특정.
-- ======================================================================
select
  count(*) filter (
    where o.status::text is distinct from g.status::text
  )                                                          as status_mismatch,
  -- 분포 (참고용) — 정상이면 group_status 분포가 order_status 분포와 동일
  count(*) filter (where g.status = 'collected')             as cnt_collected,
  count(*) filter (where g.status = 'logen_registered')      as cnt_logen_registered,
  count(*) filter (where g.status = 'logen_failed')          as cnt_logen_failed,
  count(*) filter (where g.status = 'waybill_printed')       as cnt_waybill_printed,
  count(*) filter (where g.status = 'tracking_submitted')    as cnt_tracking_submitted,
  count(*) filter (where g.status = 'dispatch_failed')       as cnt_dispatch_failed
from public.orders o
join public.order_groups g on g.id = o.order_group_id;

-- ======================================================================
-- [Q6] distribution — group 당 orders 수 분포
-- ----------------------------------------------------------------------
-- CHECK    : Phase 1 backfill 은 1:1 이므로 모든 그룹의 orders_per_group = 1.
--            Phase 3+ 에서 orders-sync 가 multi-row 그룹을 만들기 시작하면
--            2 이상 분포가 자연스럽게 등장.
-- EXPECTED : Phase 1 직후  → orders_per_group = 1 인 row 가 100%
--            Phase 3+ 운영 → 1 이 압도적, 2~N 이 소수 (다중 옵션 주문)
-- IF FAIL  : Phase 1 직후인데 orders_per_group >= 2 가 보이면
--            backfill 의 ON CONFLICT 절이 의도와 다르게 동작했을 가능성.
--            매뉴얼 §진단 query 5 로 해당 group 추출.
-- ======================================================================
with per_group as (
  select g.id, count(o.id) as orders_per_group
  from public.order_groups g
  left join public.orders o on o.order_group_id = g.id
  group by g.id
)
select
  orders_per_group,
  count(*) as group_count
from per_group
group by orders_per_group
order by orders_per_group;

-- ======================================================================
-- 요약 row (한 번에 사람이 읽기 위한 dashboard)
-- ----------------------------------------------------------------------
-- 적용 결과를 운영 매뉴얼의 "first-apply 결과 기록 칸" 에 그대로 옮겨 적기.
-- ======================================================================
select
  (select count(*) from public.orders)                                    as total_orders,
  (select count(*) from public.order_groups)                              as total_groups,
  (select count(*) from public.orders where order_group_id is null)       as orphan_orders,
  (select count(*) from public.orders o
     left join public.order_groups g on g.id = o.order_group_id
     where o.order_group_id is not null and g.id is null)                 as broken_fk,
  now()                                                                    as checked_at;
