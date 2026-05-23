# order_groups Backfill 검증 매뉴얼

마이그레이션: `apps/api/supabase/migrations/20260523000003_order_groups.sql` (v1.4 Phase 1).
검증 SQL: `scripts/sql/verify-order-groups-backfill.sql` (READ-ONLY, SELECT only).

## 1. 배경

v1.4 Phase 1 마이그레이션은 기존 `orders` 의 각 row 에 대해 `order_groups` row 를 **1:1 로 backfill 생성**하고 `orders.order_group_id` 를 채운다. 마이그레이션 자체는 `RAISE NOTICE` 한 줄로만 결과를 알려주므로, 운영 적용 직후 **정합성을 별도 검증**하지 않으면 다음 hotfix 위험이 남는다:

- orphan `orders` (그룹 미연결) 잔존 → 그룹 단위 송장 출력이 일부 주문을 누락
- `orders.logen_order_id` ↔ `order_groups.logen_order_id` 불일치 → 로젠 재시도 시 중복 등록
- `status` ENUM 변환 누락 → 그룹 상태 머신 깨짐

본 매뉴얼은 검증 SQL 의 결과를 어떻게 해석하고, 깨졌을 때 어떤 진단 query 를 추가로 돌려서 영향 row 를 좁히는지 정의한다.

## 2. 적용 순서

```bash
# 2.1 마이그레이션 적용 — dev 먼저
pnpm supabase:link:dev
pnpm db:push:dev

# 2.2 검증 SQL 실행 (Supabase Studio → SQL Editor 권장)
#     scripts/sql/verify-order-groups-backfill.sql 전체를 붙여넣고 실행
#     또는 로컬에서:
#     psql "$DEV_DATABASE_URL" -f scripts/sql/verify-order-groups-backfill.sql

# 2.3 결과 해석 — 본 매뉴얼 §3
#     Q1~Q6 결과 + 요약 row 확인

# 2.4 dev 통과 시 real 동일 절차
pnpm supabase:link:real
pnpm db:push:real
psql "$REAL_DATABASE_URL" -f scripts/sql/verify-order-groups-backfill.sql
```

Supabase project ref (CLAUDE.md `빌드 모드` 섹션):

| 환경 | project ref |
|---|---|
| dev  | `eqoywqoalwkwbrdsulfl` |
| real | `lfrnythcujxdhehvkmtg` |

## 3. 결과 해석

검증 SQL 은 6개 SELECT + 마지막에 요약 row 1개를 반환한다.

| Query | 기대값 | 깨졌을 때 의미 |
|---|---|---|
| **Q1** orphan orders | `orphan_count = 0` | backfill 의 `UPDATE` 절이 일부 order 를 못 잡음 — §4 진단 query 1 |
| **Q2** broken FK | `broken_fk_count = 0` | FK 가 NOT VALID 이거나 `order_groups` 부분 삭제 — 즉시 운영 중단, §5 롤백 검토 |
| **Q3** group→order 매핑 | `mismatch_count = 0` | join 조건 (seller_id + market_id + external_order_id) 깨짐 — §4 진단 query 2 |
| **Q4** logen/waybill 매핑 | `logen_mismatch = 0` AND `waybill_mismatch = 0` AND `carrier_mismatch = 0` | 그룹 단위 송장 데이터 깨짐 — 운영 송장 출력 즉시 정지 위험, §4 진단 query 3 |
| **Q5** status 매핑 | `status_mismatch = 0` | ENUM 정의 불일치 또는 backfill 변환 누락 — §4 진단 query 4 |
| **Q6** distribution | Phase 1 직후: `orders_per_group = 1` 만 존재 | `ON CONFLICT` 절 오동작 또는 이미 Phase 3 이상 진입 — §4 진단 query 5 |

요약 row 의 `total_orders` 와 `total_groups` 는 Phase 1 직후 **반드시 동일**해야 한다.

## 4. 진단 query (깨졌을 때만 사용)

전부 READ-ONLY. 운영 DB 에 그대로 붙여넣어 영향 row 를 좁힌다.

### 진단 query 1 — orphan orders 특정

```sql
select id, seller_id, market_id, external_order_id, status, created_at
from public.orders
where order_group_id is null
order by created_at desc
limit 50;
```

해석: `created_at` 이 마이그레이션 적용 시각 이전 row 가 보이면 backfill 누락. 이후 row 가 보이면 v1.4 신규 INSERT 경로에서 `order_group_id` 채우는 로직이 빠져 있다는 뜻 → Edge Function 점검.

### 진단 query 2 — group→order 매핑 깨진 row 추출

```sql
select
  o.id              as order_id,
  o.seller_id       as o_seller_id,
  g.seller_id       as g_seller_id,
  o.market_id       as o_market_id,
  g.market_id       as g_market_id,
  o.external_order_id  as o_external,
  g.external_group_id  as g_external
from public.orders o
join public.order_groups g on g.id = o.order_group_id
where o.seller_id          <> g.seller_id
   or o.market_id          <> g.market_id
   or o.external_order_id  <> g.external_group_id
limit 50;
```

해석: 어느 컬럼이 어긋났는지 확인 → 백필 join 조건 재검토. 정상 운영에서는 0 row.

### 진단 query 3 — logen/waybill 불일치 그룹 추출

```sql
select
  g.id                 as group_id,
  g.market_id,
  g.external_group_id,
  o.id                 as order_id,
  o.logen_order_id     as o_logen,
  g.logen_order_id     as g_logen,
  o.waybill_number     as o_waybill,
  g.waybill_number     as g_waybill,
  o.carrier_code       as o_carrier,
  g.carrier_code       as g_carrier
from public.orders o
join public.order_groups g on g.id = o.order_group_id
where (o.logen_order_id is distinct from g.logen_order_id)
   or (o.waybill_number is distinct from g.waybill_number)
   or (o.carrier_code   is distinct from g.carrier_code)
limit 50;
```

해석: 그룹과 order 의 송장 데이터가 갈라진 row. **운영 송장 출력 직전 단계에 있으면** shipping-dispatch-job 을 즉시 중단하고 데이터 정정 후 재개.

### 진단 query 4 — status 불일치 row

```sql
select
  o.id            as order_id,
  o.status::text  as order_status,
  g.id            as group_id,
  g.status::text  as group_status,
  o.updated_at    as o_updated_at,
  g.updated_at    as g_updated_at
from public.orders o
join public.order_groups g on g.id = o.order_group_id
where o.status::text is distinct from g.status::text
limit 50;
```

해석: order 와 group 의 상태가 다르면 어느 쪽이 stale 인지 `updated_at` 으로 판단. Phase 1 직후라면 양쪽 모두 backfill 시점이므로 차이가 없어야 함.

### 진단 query 5 — orders_per_group >= 2 인 그룹

```sql
select
  g.id                 as group_id,
  g.seller_id,
  g.market_id,
  g.external_group_id,
  count(o.id)          as orders_per_group
from public.order_groups g
left join public.orders o on o.order_group_id = g.id
group by g.id, g.seller_id, g.market_id, g.external_group_id
having count(o.id) >= 2
order by orders_per_group desc
limit 50;
```

해석: Phase 1 직후 결과가 나오면 backfill 의 `ON CONFLICT (market_id, external_group_id, seller_id) DO NOTHING` 절이 의도와 달리 기존 group 에 추가 order 를 매달았다는 뜻. Phase 3+ 운영 중이면 정상 (다중 옵션 주문).

## 5. 롤백 절차

검증 SQL 의 Q1~Q5 중 하나라도 0 이 아니고 **수정 query 로 복구 불가**한 수준이라면 마이그레이션을 되돌린다. 운영 일시 중단 후 다음을 순서대로 실행:

```sql
-- 5.1 새로 들어온 신규 group 참조를 끊는다 (orders 의 FK 컬럼만 NULL 처리)
--     주의: 본 단계는 데이터 손실 아님 — order_group_id 컬럼만 비움.
update public.orders set order_group_id = null;

-- 5.2 backfill 로 만들어진 모든 order_groups row 삭제
delete from public.order_groups;

-- 5.3 컬럼 / 테이블 / 인덱스 / ENUM drop (마이그레이션 역순)
drop index if exists public.orders_order_group_idx;
alter table public.orders drop column if exists order_group_id;

drop index if exists public.order_groups_waybill_idx;
drop index if exists public.order_groups_market_idx;
drop index if exists public.order_groups_seller_collected_desc;
drop index if exists public.order_groups_seller_status_idx;
drop index if exists public.order_groups_seller_idx;
drop table if exists public.order_groups;
drop type if exists public.group_status;
```

롤백 후:

1. Supabase migration history 에서 `20260523000003_order_groups` 행 삭제 (`supabase migration repair --status reverted <timestamp>`).
2. develop 에 hotfix 브랜치로 마이그레이션 수정본 PR 작성.
3. **재적용 전** 본 매뉴얼 §2 절차 다시 수행.

롤백 query 는 **destructive** 이므로 위 SQL 을 검증 SQL 과 같은 파일에 두지 않는다 (verify SQL 은 SELECT only 유지).

## 6. 운영 first-apply 결과 기록

마이그레이션 적용 후 검증 SQL 의 요약 row 를 아래 표에 옮겨 적는다. PR / WIP 메모에 인용.

| date (KST) | env | total_orders | total_groups | orphan_orders | broken_fk | 비고 |
|---|---|---|---|---|---|---|
|  | dev  |  |  |  |  |  |
|  | real |  |  |  |  |  |

기록 룰:

- **total_orders = total_groups** (Phase 1 직후 1:1 보장)
- **orphan_orders = 0**, **broken_fk = 0**
- 비고에는 적용에 소요된 시간, 마이그레이션 직전 `orders` row 수, 검증 SQL 실행 시각을 적는다.
- 위 등식 중 하나라도 어긋나면 §5 롤백 즉시 검토.

## 7. 관련 문서

- 마이그레이션: `apps/api/supabase/migrations/20260523000003_order_groups.sql`
- 검증 SQL: `scripts/sql/verify-order-groups-backfill.sql`
- 도메인 설계: `docs/architecture/v1/features/order-grouping.md` (Phase 1~4 계획)
- 운영 사고 진단 chain: `CLAUDE.md` §"운영 사고 진단 — 한 번에 chain 전체 점검" (2026-05-23 추가)
