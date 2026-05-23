# Order Grouping — 다중 옵션 주문 통합 송장 (v1.4 계획)

> 신설: 2026-05-23.
> 본 문서는 **계획 + 단계별 PR 가이드** — 실 구현은 단계별 PR 트랙.

## 1. 도메인 문제

**시나리오**: 고객이 1건을 주문했지만 마켓 API 가 **추가 옵션마다 별도 order row** 를 반환하는 경우.

예시 (네이버 스마트스토어):
```
주문번호 N-2026-05-23-001
├─ 상품주문 P-001: 본품 (1)
├─ 상품주문 P-002: 옵션 A — 색상 변경 (1)
└─ 상품주문 P-003: 옵션 B — 추가 구성품 (1)
```

마켓 API 호출 시 3 row 가 반환되어 현재 시스템은 `orders` 테이블에 3 row 로 적재.

### 현재 시스템 (v1.3) 의 한계

`apps/api/supabase/migrations/20260521000001_orders.sql`:
- 1 row = 1 `external_order_id` = 1 logen 등록 = 1 waybill_number
- UNIQUE `(market_id, external_order_id, seller_id)` — 그룹 키 미고려

결과 사고:
1. 로젠에 **3번 등록** → 송장 3장 발급 (실 배송은 1박스)
2. 인쇄 **3장** (라벨 낭비)
3. 마켓 송장 제출 시 각 order row 에 다른 송장 번호 → 고객이 받는 박스는 1개인데 마켓 화면엔 3개 송장으로 표시 (CS 사고)

### 목표 (v1.4)

같은 그룹 (= 같은 고객·주소·구매 시점·마켓 단일 주문) 의 multi-row order:
1. **로젠 등록 1회** (1 박스 = 1 송장)
2. **인쇄 1장**
3. **마켓 송장 제출 시** 그룹 내 모든 order row 에 **동일 송장 번호** 분배

## 2. 마켓별 그룹 키 분석

각 마켓 응답의 그룹 키 (= 마켓 단일 주문 = 1박스 단위):

| 마켓 | 그룹 키 | 옵션 (item) 키 |
|---|---|---|
| 네이버 스마트스토어 | `orderId` | `productOrderId` |
| 쿠팡 | `orderId` | `orderItemUnitId` / `vendorItemId` |
| G마켓 (ESM) | `orderNo` | `orderItemNo` |
| 옥션 (ESM) | `orderNo` | `orderItemNo` |
| 11번가 | `ordNo` | `ordDtlNo` |

→ 5마켓 모두 그룹 키 + 옵션 키 2단계 구조 확인. 본 v1.4 가 그 구조를 시스템에 반영.

## 3. 데이터 모델 (계획)

### 3.1 신규 테이블 `order_groups`

```sql
create table public.order_groups (
  id                    uuid primary key default gen_random_uuid(),
  seller_id             uuid not null references auth.users(id) on delete cascade,
  market_id             text not null
                        check (market_id in ('naver','coupang','11st','gmarket','auction')),
  -- 마켓의 그룹 키 (예: 네이버 orderId / 쿠팡 orderId / ESM orderNo / 11st ordNo)
  external_group_id     text not null,

  -- 그룹의 수취 정보 (모든 item 이 동일 — 정합성은 INSERT 시 검증)
  buyer_name            text,
  receiver_name         text not null,
  receiver_address      text not null,
  receiver_phone        text not null,

  -- 로젠 송장 — 그룹 단위 1개
  logen_order_id        text,
  waybill_number        text,
  carrier_code          text not null default 'LOGEN',

  -- 그룹 상태 (item 들의 OR 집계 — '하나라도 dispatched' 면 dispatched, 등)
  status                text not null default 'collected'
                        check (status in (
                          'collected',         -- 모든 item 이 collected
                          'logen_registered',  -- 그룹 1회 로젠 등록 완료
                          'waybill_printed',   -- 그룹 1장 인쇄 완료
                          'dispatched',        -- 그룹의 모든 item 마켓 송장 제출 완료
                          'logen_failed',
                          'dispatch_failed'
                        )),

  -- 시점
  collected_at          timestamptz not null default now(),
  logen_registered_at   timestamptz,
  waybill_printed_at    timestamptz,
  dispatched_at         timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint order_groups_unique_market_external unique (market_id, external_group_id, seller_id)
);

create index order_groups_seller_status_idx on public.order_groups (seller_id, status);
alter table public.order_groups enable row level security;
-- (RLS 정책 — 본인 그룹만)
```

### 3.2 기존 `orders` 테이블 확장

```sql
alter table public.orders
  add column order_group_id uuid references public.order_groups(id) on delete cascade;

create index orders_order_group_idx on public.orders (order_group_id);
-- backfill (마이그레이션) — 기존 orders 의 1 row = 1 group 으로 변환:
-- 각 order 마다 group 1개 생성 + 연결.
```

### 3.3 `orders` 의 기존 컬럼 처리

- `logen_order_id` / `waybill_number` / `carrier_code` — **deprecated**. 그룹으로 이동.
- v1.4 backfill 마이그레이션:
  - 기존 row → group 생성 (1:1)
  - logen_order_id / waybill_number 를 group 으로 이동
  - orders 의 컬럼은 v1.5 에서 drop (점진 deprecation)

### 3.4 마켓별 dispatch 결과 — `shipping_job_results` 확장

`shipping_jobs` / `shipping_job_results` 가 현재 order 단위. 그룹 단위로 변경:

```sql
alter table public.shipping_jobs add column order_group_id uuid references public.order_groups(id);
alter table public.shipping_job_results add column order_group_id uuid;
-- 다음 release 에서 order_id → order_group_id 전환 + 옛 컬럼 drop.
```

## 4. MarketAdapter 인터페이스 확장

### 4.1 `MarketOrder` 스키마 확장

`apps/web/src/lib/schemas/market-orders.ts` 의 `MarketOrderSchema`:

```ts
const MarketOrderSchema = z.object({
  marketId: ...,
  externalOrderId: z.string().min(1),   // 기존 — item 키 (productOrderId 등)
  externalGroupId: z.string().min(1),   // 신규 — 그룹 키 (orderId 등)
  // ... 나머지 필드 (수취 정보 / 상품 / 시점)
})
```

### 4.2 `fetchOrders` 반환에 그룹 키 포함

각 마켓 어댑터의 `fetchOrders` 가 externalGroupId 채워 반환:
- 네이버 `naver.ts` — `order.orderId` → externalGroupId
- 쿠팡 `coupang.ts` — `order.orderId` → externalGroupId
- G마켓·옥션 `esm-shared.ts` — `order.orderNo` → externalGroupId
- 11번가 (Wave 2 본격 구현 시) — `order.ordNo` → externalGroupId

### 4.3 `submitTracking` 시그니처 확장

현재: `submitTracking(input: SubmitTrackingInput, credential?: StoredCredential)` 가 1 order 대상.
신규: 그룹 단위 — 그룹 내 모든 orderItemIds 에 동일 송장 번호 multi-submit:

```ts
interface SubmitTrackingInput {
  externalGroupId: string
  externalOrderIds: string[]   // 그룹 내 item 키들
  trackingNumber: string
  carrierCode: string          // 'LOGEN'
}
```

마켓별 어댑터 구현:
- 네이버: 그룹 내 productOrderId 들에 같은 송장 PUT
- 쿠팡: orderItemUnitId 들에 같은 송장 PUT
- ESM: orderItemNo 들에 같은 송장 PUT
- 11번가: ordDtlNo 들에 같은 송장 PUT

## 5. Edge Function 흐름 변경

### 5.1 `orders-sync` — 그룹 추출·생성·연결

```
1. 마켓별 fetchOrders → MarketOrder[] (externalGroupId 포함)
2. 그룹별 합치기 (externalGroupId 로 묶기)
3. 각 그룹:
   - order_groups UPSERT (UNIQUE market_id + external_group_id + seller_id)
   - 그룹 내 모든 MarketOrder → orders UPSERT + order_group_id 연결
4. 정합 검증:
   - 같은 externalGroupId 의 모든 row 가 동일 receiver_address 인지 (다르면 split 정책 — v1.4 는 우선 첫 row 의 주소로 통일 + 경고 로그)
```

### 5.2 `shipping-dispatch-job` — 그룹 단위 로젠 호출

```
1. dispatch 대상 = group_status = 'collected' 인 order_groups
2. 각 group 에 대해:
   - logen_register_shipment 1회 호출 (배송지·발송인 = group 의 단일 정보)
   - 응답 logen_order_id / waybill_number 를 group 에 저장
   - group 내 orders 의 status='logen_registered'
3. 인쇄 step:
   - 1 group = 1 라벨 PDF
```

### 5.3 `shipping-dispatch-market-worker` — 송장 multi-submit

```
1. dispatch 대상 = group_status = 'waybill_printed' 인 order_groups
2. 각 group, 각 마켓:
   - adapter.submitTracking({
       externalGroupId,
       externalOrderIds: group 내 orders.external_order_id 배열,
       trackingNumber: group.waybill_number,
       carrierCode: 'LOGEN',
     })
   - 마켓별로 1 API 호출 (배열 multi-submit 지원하는 마켓) 또는 N 호출 (item 마다)
3. shipping_job_results 에 group 단위 결과 + 마켓별 item count 기록
```

## 6. UI 변경 (계획)

### 6.1 s7 주문 목록 (`/orders`)

- 그룹 단위 카드 (펼치기/접기). 각 카드:
  - 상단: 그룹 키 (마켓 주문 번호) + 고객명 + 합계 금액 + 그룹 status
  - 펼쳤을 때: item 목록 (상품명·옵션·수량·금액)
  - 우측: [로젠 등록] / [라벨 인쇄] / [송장 제출] 액션
- 그룹 내 status 가 섞일 경우 (item 일부만 진행) — 가장 늦은 단계로 표시
  + 우측에 "1/3 진행" 같은 progress

### 6.2 s8 배송 처리 (`/shipping`)

- 진행 단계별 그룹 리스트 (collected → logen_registered → waybill_printed → dispatched)
- 1 group = 1 카드 (item 정보는 펼치기)
- 인쇄 시 "X개 그룹 (Y개 item) — Z장 라벨" 표시

### 6.3 라벨 인쇄

- 1 group = 1 라벨. 라벨에 그룹 내 item 목록 (상품명·옵션·수량) 모두 표시
- 송장 번호는 그룹 단위 1개

### 6.4 마켓 송장 제출 결과

- 카드에 "송장 X 가 N개 item 에 분배됨" 표시
- 마켓별 분배 결과 (성공·실패) — 부분 실패 시 어느 item 실패인지 명시

## 7. 단계별 PR 진행 (4 단계, 권장 진행)

| Phase | PR | 내용 | 시간 |
|---|---|---|---|
| 1 | `feat(db): order_groups 마이그레이션 + backfill` | order_groups 테이블 신설 + orders.order_group_id + 기존 데이터 1:1 backfill | 2~3h |
| 2 | `feat(adapters): MarketOrder externalGroupId + fetchOrders 5마켓` | MarketOrderSchema 확장 + 5마켓 어댑터의 fetchOrders 가 externalGroupId 채움 | 3~4h |
| 3 | `feat(orders-sync): 그룹 추출·생성·연결` | orders-sync Edge Function 이 그룹 단위 UPSERT. 정합 검증 (주소 등) + 경고 로그 | 2~3h |
| 4 | `feat(shipping): 그룹 단위 로젠 등록 + 라벨 + 마켓 송장 multi-submit` | shipping-dispatch-job / market-worker / submitTracking 시그니처 확장 + UI s7·s8 그룹 카드 | 5~7h |

총 **12~17시간 분량**. 단일 PR 으로 묶으면 비대 — 4 PR 분리 권장. 각 단계가 머지된 후 다음 단계 진입.

## 8. 마이그레이션 정합 / 위험

### 8.1 기존 데이터 backfill

```sql
-- Phase 1 마이그레이션:
-- 1) order_groups 테이블 생성
-- 2) 기존 orders 의 각 row 에 대해 group 1:1 생성 (external_group_id = external_order_id)
-- 3) orders.order_group_id = 신규 group.id
-- 4) orders.logen_order_id / waybill_number 를 group 으로 복사
-- 5) (v1.4 에는 orders 의 옛 컬럼 유지 — v1.5 에서 drop)
```

### 8.2 RLS 정합

`order_groups` 의 RLS 정책 = `seller_id = auth.uid()` (다른 도메인과 동일).
`orders` 의 RLS 는 변경 없음 — group 단위 select 시 `inner join order_groups using (id, seller_id)`.

### 8.3 위험

| 위험 | 대응 |
|---|---|
| 같은 externalGroupId 안에 서로 다른 receiver_address | Phase 3 의 정합 검증 — 다르면 첫 row 의 주소로 통일 + warning 로그. 운영자가 sentry 알림 받고 수동 결정. |
| 그룹 단위 로젠 등록 fail 시 partial 처리 | Phase 4 의 logen 호출 fail → group_status='logen_failed'. 재시도는 그룹 단위. |
| 마켓 송장 multi-submit 시 일부 item 만 성공 | Phase 4 의 shipping_job_results 가 item별 성공/실패 기록. UI 가 부분 실패 표시. |
| 기존 1 order = 1 waybill UI 사용자가 그룹 표시에 적응 | 출시 시 in-app 안내 + 인쇄 라벨에 그룹 내 item 목록 명시 |

## 9. 어댑터별 그룹 키 매핑 (Phase 2 본격 구현 시 검증)

| 마켓 | externalGroupId source | externalOrderId source | submitTracking item 키 |
|---|---|---|---|
| 네이버 | `order.orderId` | `productOrder.productOrderId` | productOrderId 배열 |
| 쿠팡 | `order.orderId` | `orderItem.orderItemUnitId` | orderItemUnitId 배열 |
| G마켓 (ESM) | `order.orderNo` | `orderItem.orderItemNo` | orderItemNo 배열 |
| 옥션 (ESM) | `order.orderNo` | `orderItem.orderItemNo` | orderItemNo 배열 |
| 11번가 | `order.ordNo` | `orderDetail.ordDtlNo` | ordDtlNo 배열 |

11번가는 Phase 4-B-2 Wave 2 본격 구현 시 동시 처리.

## 10. 다음 액션

1. **본 계획 문서 review + 승인** (사용자)
2. Phase 1 PR (`feat(db): order_groups 마이그레이션`) 진입
3. 각 Phase 머지 후 다음 Phase 진입 (4 단계 누적)
4. v1.4 완료 시 release/v1.4 → main

---

**v1.4 진입 전제**:
- 5마켓 정식 운영 (현재 v1.3) 안정화 — Phase 4-B-1 네이버 / Phase 4-B-2 Wave 2 11번가 진행 후 추진 권장
- 또는 병행 — 운영 검증 중인 G·옥션·쿠팡 의 외부 spec 만으로 v1.4 진입 가능 (네이버 / 11번가는 stub 동안에도 그룹 흐름 미러)
