# orders-sync

v2 배송(로젠) 자동화의 첫 단계 — 4 마켓의 신규 주문을 폴링해 `orders` 테이블에 적재한다.

## 책임 범위 (PR5)

1. POST `{ sellerId? }` → 활성 셀러의 활성 market_accounts (4 마켓) 조회.
2. 각 어댑터의 `fetchOrders({ sellerId, since, statuses: ['new_pay'] })` 호출 (지난 24h).
3. `orders` 테이블 upsert — PRD §4 컬럼 (`buyer_name`, `receiver_name`, `receiver_address`,
   `receiver_phone`, `product_name`, `quantity`, `order_amount`, `status='collected'`,
   `collected_at`). UNIQUE `(market_id, external_order_id, seller_id)` on conflict do nothing.
4. 신규 insert 된 `orders.id` 배열을 `logen-register-shipment` Edge Function 으로
   fire-and-forget invoke.
5. 응답 `{ collected, perMarket, errors, newOrderIds }`.

## 상태 매핑

- **PRD §2.1 "결제완료/배송대기"** → 어댑터 내부에서 PR4 정규화 enum `new_pay` 로 통합.
- 본 함수는 한글 raw 상태를 다루지 않는다. 어댑터가 반환한 `MarketOrderStatus` enum 만 사용.
- `orders.status` 는 PRD §4 의 영문 ENUM. 수집 시점에는 항상 `'collected'`.
  이후 단계 (PR6 `logen-register-shipment`) 가 `logen_registered` 로 전이.
- 어댑터가 `new_pay` 이외 status 반환 시 적재 제외 (방어 — 부적격 row 차단).

## 호출 경로

- **pg_cron 10분 간격** — `supabase/migrations/20260521000010_pg_cron_orders_sync.sql`.
- **수동 트리거** — `curl -X POST .../orders-sync -H "Authorization: Bearer <service_role>" -d '{"source":"manual"}'`.

## 인증

- service_role bearer 만 허용. JWT 외부 호출 차단.

## 의존 PR

- **PR2**: `orders` 테이블 (PRD §4 컬럼) + UNIQUE 제약. 본 PR `orders-repo.ts` 의 컬럼 매핑과 정합.
- **PR4**: `MarketAdapter` 의 `fetchOrders` 확장 (`OrderSyncAdapter`).
  - 본 PR 의 `lib/adapter-shape.ts` 는 PR4 `apps/web/src/lib/schemas/market-orders.ts` 의
    1:1 미러 (Vite/Node ↔ Deno 호환성 문제로 직접 import 불가).
  - 미 머지 상태에서는 본 PR 의 어댑터 shape check 가 skip 처리.
- **PR6**: `logen-register-shipment` Edge Function. 미 머지 상태에서는 invoke 가 404 —
  fire-and-forget 으로 정상 처리.
- **권장 머지 순서**: PR2 → PR4 → PR6 → PR5.

## 어댑터 시그니처 (PR4 단일 출처)

```ts
interface OrderSyncAdapter {
  fetchOrders(input: {
    sellerId: string             // UUID
    since?: string               // ISO 8601 + offset
    until?: string               // ISO 8601 + offset
    statuses?: MarketOrderStatus[]  // ['new_pay'] (본 PR)
  }): Promise<MarketOrder[]>
}

interface MarketOrder {
  externalOrderId: string
  buyerName: string
  receiverName: string
  receiverAddress: string
  receiverPhone: string
  productName: string
  quantity: number
  orderAmount: number
  status: MarketOrderStatus        // 'new_pay' | 'dispatched' | ...
  paidAt: string                   // ISO 8601 + offset
  market: MarketId
}
```

PR4 머지 시 본 PR 의 `lib/adapter-shape.ts` 는 `_shared/market-adapter.ts` 의 정식
정의로 흡수된다.

## 로깅

- 모든 외부 호출 (어댑터 fetchOrders / orders upsert / logen invoke) 은 구조화 로그 3종 패턴
  (`→ market request` / `← market response` / `← market error`) 준수.
- 평문 토큰·PII (buyer / receiver) 절대 노출 금지 — DB 컬럼에는 적재되지만 logger 의
  `maskRecord` 가 키 이름 기반 자동 마스킹.

## 테스트

```bash
deno test --allow-env --allow-read \
  apps/api/supabase/functions/orders-sync/__tests__/
```

- mock 어댑터 4종 inject → orders insert + 중복 방지 + 한 마켓 실패 격리 + non-new_pay 필터.

## OUT OF SCOPE

- 로젠 등록 자체 (PR6 `logen-register-shipment`).
- 마켓별 송장번호 제출 (PR7 `orders-submit-tracking`).
- v1 어댑터 (5메서드) 인터페이스 변경 — `fetchOrders` 는 별개 `OrderSyncAdapter` 확장.
