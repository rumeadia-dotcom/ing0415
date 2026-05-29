# features/orders.md — 주문 자동 수집 (s7) 설계

> 본 문서는 **주문·배송 자동화** 의 s7 도메인을 단일 파일로 정의한다.
> 의존: `docs/architecture/v1/overview-shipping.md`, `docs/architecture/v1/cross-cutting/market-adapter-shipping.md`, `docs/spec/PRD.md` §6.1 / §6.5 / §8, `docs/spec/user_flow.md` s7 (n47~n50).
> 소관: backend 주도, frontend / security / qa 리뷰.

---

## 1. 범위

- **포함**:
  - 화면: `/orders` (n47 대시보드), `/orders/list` (n48 목록), `/orders/:orderId` (n49 상세), n50 수동 처리 다이얼로그.
  - 데이터: `orders` 테이블, RLS 정책.
  - Edge Function: `orders-sync` (pg_cron 10분 폴링).
  - Realtime: `orders` 구독.
- **제외 (다른 문서)**:
  - 마켓별 `fetchOrders` 어댑터 메서드 → `cross-cutting/market-adapter-shipping.md`.
  - 로젠 등록 자동 후속 → `features/shipping.md`.
  - `MarketAccount` 토큰 복호화 → v1 `cross-cutting/credential-vault.md`.

---

## 2. user_flow 매핑

| 노드 | 경로 | 컴포넌트 |
|---|---|---|
| n47 | `/orders` | `OrdersDashboardPage` |
| n48 | `/orders/list` | `OrdersListPage` |
| n49 | `/orders/:orderId` | `OrderDetailPage` |
| n50 | (다이얼로그) | `OrderManualResolveDialog` (Detail 내부) |

---

## 3. 데이터 모델

### 3.1 `orders` 테이블 (PRD §4 그대로)

```sql
create type order_status as enum (
  'collected',          -- orders-sync 직후 (로젠 미등록)
  'logen_registered',   -- registerOrderData 완료, slipNo 확보
  'logen_failed',       -- registerOrderData 3회 재시도 실패
  'waybill_printed',    -- 판매자가 출력 완료 확인
  'tracking_submitted', -- 마켓 송장 제출 완료
  'dispatch_failed'     -- 마켓 송장 제출 실패
);

create table orders (
  id                  uuid primary key default gen_random_uuid(),
  seller_id           uuid not null references auth.users(id) on delete cascade,
  market_id           text not null,                 -- 'naver' | 'coupang' | 'gmarket' | 'auction'
  external_order_id   text not null,
  buyer_name          text,
  receiver_name       text not null,
  receiver_address    text not null,
  receiver_phone      text not null,                 -- 마스킹 정책은 security.md 인용
  product_name        text not null,
  quantity            int  not null check (quantity > 0),
  order_amount        int  not null check (order_amount >= 0),
  status              order_status not null default 'collected',
  logen_order_id      text,                          -- fixTakeNo (registerOrderData 응답)
  waybill_number      text,                          -- slipNo (getSlipNo 응답)
  carrier_code        text not null default 'LOGEN',
  collected_at        timestamptz not null default now(),
  logen_registered_at timestamptz,
  waybill_printed_at  timestamptz,
  dispatched_at       timestamptz,
  unique (market_id, external_order_id, seller_id)
);

create index orders_seller_status_idx on orders (seller_id, status, collected_at desc);
create index orders_seller_market_idx on orders (seller_id, market_id, collected_at desc);
```

### 3.2 RLS

```sql
alter table orders enable row level security;

create policy orders_select_own on orders
  for select using (seller_id = auth.uid());

-- INSERT / UPDATE 는 Edge Function (service_role) 만 — 클라이언트 직접 변경 금지.
-- 단, 수동 처리(n50)는 별도 RPC `orders.manual_set_waybill(p_order_id, p_waybill)` 를 통해
-- security definer 함수가 seller_id = auth.uid() 검증 후 UPDATE.
```

### 3.3 상태 전이표

```
collected ──orders-sync──→ collected (중복은 unique 제약으로 차단)
collected ──logen-register-shipment 성공──→ logen_registered
collected ──logen-register-shipment 3회 실패──→ logen_failed
logen_failed ──RPC manual_set_waybill──→ logen_registered  (n50 수동 입력)
logen_registered ──사용자 [출력 완료] 클릭──→ waybill_printed
waybill_printed ──shipping-dispatch-job 성공──→ tracking_submitted
waybill_printed ──shipping-dispatch-job 실패──→ dispatch_failed
dispatch_failed ──n56 재시도──→ waybill_printed → tracking_submitted
```

`shipping_jobs` / `shipping_job_results` 와의 외래 관계는 `features/shipping.md` 가 정의.

---

## 4. Edge Function — `orders-sync`

### 4.1 트리거

- pg_cron: `*/10 * * * *`. 모든 활성 셀러를 대상으로 fan-out.
- 운영 단계에서 셀러 수가 많아지면 셀러 샤딩(`seller_id % N`)으로 분산.

### 4.2 시그니처

```ts
// Request — pg_cron 호출 시 body 없음. 수동 트리거(workflow_dispatch) 시 seller_id 1건 지정 가능.
const OrdersSyncRequest = z.object({
  sellerId: z.string().uuid().optional(),     // 생략 시 활성 셀러 전체
  marketIds: z.array(MarketIdSchema).optional() // 생략 시 5 마켓 전체
}).strict();

// Response
const OrdersSyncResponse = z.object({
  jobId: z.string().uuid(),                   // 본 폴링 사이클 ID (logging correlation)
  results: z.array(z.object({
    sellerId: z.string().uuid(),
    marketId: MarketIdSchema,
    fetched: z.number().int().min(0),
    inserted: z.number().int().min(0),        // unique 충돌로 skip 된 건은 fetched - inserted
    error: z.object({ code: z.string(), message: z.string() }).nullable()
  }))
}).strict();
```

### 4.3 처리 흐름

```
1. SELECT 활성 seller_id × market_account.status = 'active'
2. 셀러 × 마켓 fan-out (Promise.all, 마켓 어댑터 fetchOrders 호출)
3. 마켓 API 응답을 zod 로 검증 → `orders` upsert (on conflict do nothing)
4. INSERT 성공한 order_id 리스트를 logen-register-shipment 큐에 enqueue
5. 결과 로깅 (security.md §6 — 토큰/PII 마스킹 강제)
```

### 4.4 멱등성

- unique 제약 `(market_id, external_order_id, seller_id)` 가 중복 차단.
- `orders-sync` 재실행은 안전 — 같은 윈도우 재폴링 시 0건 insert.

### 4.5 실패 격리

- 한 마켓 실패가 다른 마켓 진행을 막지 않음 (`Promise.allSettled`).
- 마켓 401 응답 시 `market_accounts.status = 'reauth_required'` 로 마킹 + 다음 사이클은 자동 스킵 + s5 마켓 페이지에 재인증 배너.

---

## 5. Realtime 구독

- 채널: `orders:seller=${sellerId}`.
- 이벤트: INSERT (신규 주문) → n47 카운터 즉시 +1, UPDATE (status 전이) → 해당 카운터 재계산.
- 클라이언트 구독은 `useOrdersRealtime(sellerId)` hook 으로 추상화. invalidate 대상 Query Key:
  - `['orders', 'summary', sellerId]`
  - `['orders', 'list', sellerId, ...filters]`

---

## 6. 화면 — s7

### 6.1 n47 `/orders` 대시보드

레이아웃:

```
PageHeader: "주문 현황"
└─ 오늘 요약 4 카드
    - 신규 주문 N건 (마켓별 뱃지)
    - 로젠 등록 완료 N건
    - 출력 대기 N건           → CTA [운송장 출력] → /shipping/print
    - 제출 완료 N건           → CTA [송장 일괄 제출] → /shipping/dispatch
└─ 최근 주문 테이블 (10건)    → [전체 목록] → /orders/list
```

상태:
- loading: skeleton 4 카드 + 테이블.
- empty: "오늘 신규 주문이 없습니다" (로젠 미연동이면 별도 배너로 /settings/shipping 유도).
- error: error-message 컴포넌트 + 재시도.

### 6.2 n48 `/orders/list`

필터 (URL search params, zod 검증):

```ts
const OrderListFilter = z.object({
  market: z.array(MarketIdSchema).default([]),
  status: z.array(OrderStatusSchema).default([]),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  q: z.string().max(60).optional()
}).strict();
```

행: 주문번호 · 수취인(마스킹) · 상품명 · 마켓 뱃지 · 상태 칩 · 운송장번호. 클릭 → n49.

### 6.3 n49 `/orders/:orderId`

블록:
- 주문 정보 (수취인 / 주소 / 상품 / 수량 / 금액)
- 상태 타임라인 (collected → logen_registered → waybill_printed → tracking_submitted)
- 로젠 등록 상태 (slipNo, fixTakeNo) — 로젠 미등록이면 "처리 대기" 또는 logen_failed 배너 + [수동 처리] 버튼 → n50
- 마켓 송장 제출 상태

### 6.4 n50 수동 처리 다이얼로그

- 트리거: Detail 의 logen_failed 배너 [수동 처리] 버튼.
- 입력: 운송장번호 1 필드 (zod 검증 — 12자리 숫자 등 로젠 규칙).
- 동작: RPC `orders.manual_set_waybill(p_order_id, p_waybill)` 호출 → 성공 시 status = logen_registered, waybill_number = p_waybill, logen_registered_at = now().
- 감사 로그: `events` 테이블에 `{ type: 'manual_waybill_set', seller_id, order_id, prev_status }` 적재.

---

## 7. 보안

- `receiver_phone`, `receiver_address` 는 응답 직전 마스킹 정책 (security.md §6.2 인용) 적용. UI 는 마스킹된 값 + 마스크 토글(권한자만) 또는 항상 마스킹.
- `orders-sync` 가 호출하는 마켓 API 응답에서 PII 는 즉시 적재되지만 로그/Sentry 로 흘러나가는 경로에서 `redact()` 통과 강제.
- RLS: SELECT 만 셀러 본인. INSERT/UPDATE 는 service_role + 명시 RPC.

---

## 8. 테스트 매트릭스

| ID | 영역 | 케이스 |
|---|---|---|
| O-001 | orders-sync | 동일 주문 2회 폴링 시 1건만 insert |
| O-002 | orders-sync | 마켓 1 401 시 나머지 3 마켓은 정상 진행 + reauth_required 마킹 |
| O-003 | RLS | 타 셀러 order_id 로 직접 RPC 시도 → 거부 |
| O-004 | n47 | empty state 표시 (last_collected_at null) |
| O-005 | n48 | URL search params 무효 값 → 기본값 fallback |
| O-006 | n49 | 상태 타임라인 — partial 상태 시각화 |
| O-007 | n50 | 수동 입력 운송장번호 zod 실패 → 폼 에러 |
| O-008 | n50 | 성공 시 events 로깅 + Realtime invalidate |

---

## 9. 미해결 사안

- OQ-V2-02 (웹훅) 해결 시 본 문서 §4 의 pg_cron 정책 갱신.
- OQ-V2-03 (네이버 주문 API 와 상품등록 앱 동일성) 결과에 따라 `MarketAccount` 분기 필요할 수 있음 — features/markets.md(v1) 와 함께 갱신.
