# cross-cutting/market-adapter-shipping.md — MarketAdapter 주문/송장 확장

> 상품 등록 도메인의 `cross-cutting/market-adapter.md` 5 메서드 인터페이스에 주문·배송 도메인이 **2 메서드를 추가**한다. 본 문서는 그 2 메서드의 매트릭스만 정의하며, 기존 인터페이스·재시도·rate limit·debug/real 분리 정책은 상품 등록 문서가 단일 출처.
> 의존: `docs/architecture/v1/cross-cutting/market-adapter.md` (단일 출처), `features/orders.md`, `features/shipping.md`, `docs/spec/PRD.md` §6.1 / §6.4.

---

## 1. 추가되는 메서드 2 종

```ts
export interface MarketAdapter {
  // 상품 등록 도메인 기존 5 메서드 (변경 없음)
  authenticate(...): Promise<...>;
  refreshToken(...): Promise<...>;
  fetchCategoryTree(): Promise<CategoryNode[]>;
  transformProduct(...): Promise<MarketPayload>;
  createProduct(...): Promise<{ externalId: string; productUrl: string }>;

  // 주문·배송 신규 2 메서드
  fetchOrders(input: FetchOrdersInput): Promise<FetchOrdersOutput>;
  submitTracking(input: SubmitTrackingInput): Promise<SubmitTrackingOutput>;
}

export interface FetchOrdersInput {
  sinceIso: string;                          // 마지막 폴링 since timestamp
  status: 'paid' | 'shipping_pending';       // 마켓별 매핑은 어댑터 내부 책임
  cursor?: string;                           // 마켓 페이지네이션 (있을 때)
}

export interface FetchOrdersOutput {
  orders: NormalizedOrder[];
  nextCursor?: string;                       // 다음 폴링 사이클 진입용 (선택)
}

export interface NormalizedOrder {
  externalOrderId: string;
  buyerName?: string;
  receiverName: string;
  receiverAddress: string;
  receiverPhone: string;
  productName: string;
  quantity: number;
  orderAmount: number;
  orderedAt: string;                         // ISO 8601
}

export interface SubmitTrackingInput {
  externalOrderId: string;
  waybillNumber: string;
  carrierCode: 'LOGEN';
}

export interface SubmitTrackingOutput {
  ok: boolean;
  externalResponse: unknown;                 // 디버깅용 — Edge Function 에서 PII 제거 후 적재
}
```

- 인터페이스 변경(메서드 추가)은 v1 `market-adapter.md` "개정 절차" 를 본 PR 이 트리거하며, 본 문서가 v1 문서 §메서드 표를 보충.
- 어댑터 내부 횡단 관심사(재시도/rate limit/로깅) 는 v1 정책을 그대로 따른다 — 외부 레이어(Edge Function `orders-sync` / `shipping-dispatch-job`) 에서 처리.

---

## 2. 마켓별 매트릭스

### 2.1 `fetchOrders`

| 마켓 | 엔드포인트 | 인증 | 상태 매핑 (status='paid') | 페이지네이션 | 한도 |
|---|---|---|---|---|---|
| 네이버 | `GET /external/v1/pay-order/seller/orders/new-pay-waiting` | OAuth 2.0 (v1 동일 토큰) | 응답 자체가 "신규 결제 대기" | cursor (response.lastChange) | 1 분당 60 req |
| 쿠팡 | `GET /v2/.../ordersheets?status=ACCEPT` | HMAC-SHA256 | `ACCEPT` (결제완료/배송대기) | `nextToken` | 분당 60 req (vendor 별) |
| G마켓 | ESM `getOrderList(site='G', orderStatusType='PAID')` | ESM API Key | `PAID` 만 필터 | offset / limit | 1 분당 30 req |
| 옥션 | ESM `getOrderList(site='A', orderStatusType='PAID')` | ESM API Key | 동일 | 동일 | 동일 |

- 마켓 응답 → `NormalizedOrder` 변환은 어댑터 내부 책임. zod 로 검증 후 반환.
- 한 호출이 마켓별 페이지 1회. cursor 가 있으면 다음 폴링 사이클까지 보존 (또는 같은 사이클 내 페이지 끝까지 진행 — 운영 데이터로 정책 결정).

### 2.2 `submitTracking`

| 마켓 | 엔드포인트 | 인증 | 필수 필드 | 응답 성공 판정 |
|---|---|---|---|---|
| 네이버 | `PATCH /external/v1/orders/{externalOrderId}/dispatch` | OAuth 2.0 | dispatchDate, deliveryCompanyCode='LOGEN', trackingNumber | HTTP 200 + result.code='SUCCESS' |
| 쿠팡 | `PUT /v2/.../orders/{externalOrderId}/shipments` | HMAC-SHA256 | deliveryCompanyCode='LOGEN', invoiceNumber | HTTP 200 + code=200 |
| G마켓 | ESM `setShipInfo(site='G')` | ESM API Key | orderNo, sendDate, deliveryCompanyCode='LOGEN', invoiceNo | resultCode='0' |
| 옥션 | ESM `setShipInfo(site='A')` | ESM API Key | 동일 | 동일 |

- 모든 마켓 `carrierCode='LOGEN'` 고정 (v1 출시 범위). 다중 택배사는 후속.
- 마켓별 carrierCode 코드값 (네이버: "LOGEN" / 쿠팡: "LOGEN_KOREA" 등) 의 정확한 식별자는 PR4 구현 시 마켓 문서에서 확정.

---

## 3. 인증 사용 분리 (OQ-V2-03)

- 네이버 상품 등록 앱과 주문 조회 앱이 **동일 OAuth 앱으로 두 스코프를 가질 수 있는지** 미확정.
- 미확인 상태 가정: 동일. 분리 필요 시 `market_accounts` 에 `scopes` 컬럼 추가 + 어댑터 팩토리가 scope 별 다른 토큰 사용 (별도 PR).

---

## 4. 로깅 정책 (재확인)

v1 `market-adapter.md` 의 로깅 규약 동일:

```ts
logger.info({ market: 'naver', method: 'fetchOrders', sellerId, correlationId }, '→ market request');
logger.info({ market: 'naver', method: 'fetchOrders', status, fetched }, '← market response');
logger.error({ market: 'naver', method: 'submitTracking', err: maskError(e) }, '← market error');
```

- 새 메서드 `fetchOrders` / `submitTracking` 도 동일 화이트리스트 적용.
- 응답 body 의 PII (`receiver*`, `buyer*`, 주소·연락처) 는 적재 전 redact.

---

## 5. 테스트 매트릭스

| ID | 영역 | 케이스 |
|---|---|---|
| MA2-001 | fetchOrders | 4 마켓 각각 mock 응답 → `NormalizedOrder` 정확 변환 (4 × 1 케이스) |
| MA2-002 | fetchOrders | 빈 응답 → orders=[] |
| MA2-003 | fetchOrders | 마켓 401 → reauth_required 시그널 (Edge Function 측에서 처리) |
| MA2-004 | submitTracking | 성공 응답 → ok=true |
| MA2-005 | submitTracking | 마켓 측 "이미 송장 등록됨" → ok=true (idempotent) — 마켓별 코드 매핑 PR4 에서 결정 |
| MA2-006 | submitTracking | 마켓 측 거부 → ok=false + errorCode + errorMessage |
| MA2-007 | parity | debug mock 어댑터와 real 어댑터의 fetchOrders / submitTracking 시그니처 동등성 (tests/unit/adapters/<market>/parity.spec.ts 강제) |

테스트 디시플린 (`docs/architecture/v1/testing.md` R-006) 의 debug ↔ real 격차 감시 규칙이 새 메서드에도 그대로 적용.

---

## 6. 미해결 사안

- OQ-V2-03: 네이버 주문 조회 앱과 상품 등록 앱 동일성.
- 마켓별 `LOGEN` carrierCode 의 정확한 식별자.
- `fetchOrders` cursor 의 마켓별 의미 / 만료 (운영 검증 필요).
- 쿠팡 ordersheets API 의 vendor 별 한도 정책.
