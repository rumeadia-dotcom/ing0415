# orders-sync

v2 배송(로젠) 자동화의 첫 단계 — 4 마켓의 신규 주문을 폴링해 `orders` 테이블에 적재한다.

## 책임 범위 (PR5)

1. POST `{ sellerId? }` → 활성 셀러의 활성 market_accounts (4 마켓) 조회.
2. 각 어댑터의 `fetchOrders` 호출 (지난 24h, `status='결제완료'`).
3. `orders` 테이블 upsert (`UNIQUE(seller_id, market_id, external_order_id)` on conflict do nothing).
4. 신규 insert 된 `orders.id` 배열을 `logen-register-shipment` Edge Function 으로 fire-and-forget invoke.
5. 응답 `{ collected, perMarket, errors, newOrderIds }`.

## 호출 경로

- **pg_cron 10분 간격** — `supabase/migrations/20260521000010_pg_cron_orders_sync.sql`.
- **수동 트리거** — `curl -X POST .../orders-sync -H "Authorization: Bearer <service_role>" -d '{"source":"manual"}'`.

## 인증

- service_role bearer 만 허용. JWT 외부 호출 차단.

## 의존 PR

- **PR2**: `orders` 테이블 + UNIQUE 제약 (본 PR 의 가정 스키마와 정합 필요).
- **PR4**: `MarketAdapter` 의 `fetchOrders` 확장 (`OrderSyncAdapter`). 미 머지 상태에서는 본 PR 의 어댑터 shape check 가 skip 처리.
- **PR6**: `logen-register-shipment` Edge Function. 미 머지 상태에서는 invoke 가 404 — fire-and-forget 으로 정상 처리.
- **권장 머지 순서**: PR2 → PR4 → PR6 → PR5.

## 어댑터 시그니처 (PR4 정식 확정 대상)

```ts
interface OrderSyncAdapter {
  fetchOrders(input: {
    credentialPayload: Record<string, unknown>
    since: string // ISO datetime
    status: string // 기본 '결제완료'
  }): Promise<MarketOrder[]>
}

interface MarketOrder {
  marketId: MarketId
  externalOrderId: string
  status: string
  orderedAt: string
  payload: Record<string, unknown>
}
```

본 PR 의 `lib/adapter-shape.ts` 에 임시 정의되어 있으며, PR4 머지 시 `_shared/market-adapter.ts` 의 정식 정의로 교체된다.

## 로깅

- 모든 외부 호출 (어댑터 fetchOrders / orders upsert / logen invoke) 은 구조화 로그 3종 패턴 (`→ market request` / `← market response` / `← market error`) 준수.
- 평문 토큰·PII 절대 노출 금지 (logger 의 `maskRecord` 가 자동 마스킹).

## 테스트

```bash
deno test --allow-env --allow-read \
  apps/api/supabase/functions/orders-sync/__tests__/
```

- mock 어댑터 4종 inject → orders insert + 중복 방지 + 한 마켓 실패 격리 검증.

## OUT OF SCOPE

- 로젠 등록 자체 (PR6 `logen-register-shipment`).
- 마켓별 송장번호 제출 (PR7 `orders-submit-tracking`).
- v1 어댑터 (5메서드) 인터페이스 변경 — `fetchOrders` 는 별개 `OrderSyncAdapter` 확장.
