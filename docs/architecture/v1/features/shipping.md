# features/shipping.md — 배송 처리 (s8) 설계

> 주문·배송 자동화의 s8 도메인 단일 진입점.
> 의존: `overview-shipping.md`, `features/orders.md`, `cross-cutting/logen-adapter.md`, `cross-cutting/market-adapter-shipping.md`, `docs/spec/PRD.md` §6.2 ~ §6.4, `docs/spec/user_flow.md` s8 (n51~n57).
> 소관: backend 주도, frontend / qa 리뷰.

---

## 1. 범위

- **포함**:
  - 화면: `/shipping/print` (n52), `/shipping/dispatch` (n53/n54), `/shipping/dispatch/:jobId/result` (n55/n56), `/shipping/history` (n57).
  - 데이터: `shipping_jobs`, `shipping_job_results` 테이블 + RLS.
  - Edge Functions: `logen-register-shipment` (n51 백그라운드), `shipping-dispatch-job` (n54 fan-out).
  - Realtime: `shipping_jobs` / `shipping_job_results` 구독.
- **제외**:
  - 로젠 API 4 메서드 명세 → `cross-cutting/logen-adapter.md`.
  - 마켓별 `submitTracking` 매트릭스 → `cross-cutting/market-adapter-shipping.md`.
  - 로젠 자격증명 / 발송인 정보 → `features/settings-shipping.md`.

---

## 2. user_flow 매핑

| 노드 | 경로 / 트리거 | 컴포넌트 / 함수 |
|---|---|---|
| n51 | (백그라운드) | Edge Fn `logen-register-shipment` |
| n52 | `/shipping/print` | `ShippingPrintPage` |
| n53 | `/shipping/dispatch` | `ShippingDispatchPage` (preview + 시작) |
| n54 | `/shipping/dispatch` (in-page progress) | `ShippingDispatchPage` (progress sub-view) |
| n55 | `/shipping/dispatch/:jobId/result` | `ShippingDispatchResultPage` |
| n56 | (다이얼로그) | `ShippingDispatchResultPage` 내부 재시도 액션 |
| n57 | `/shipping/history` | `ShippingHistoryPage` |

---

## 3. 데이터 모델

```sql
create type shipping_job_status as enum (
  'pending',     -- DB row 생성, fan-out 미시작
  'running',     -- 마켓 작업자 1개 이상 실행 중
  'partial',     -- 일부 마켓 성공, 일부 실패 (1급 시민)
  'succeeded',
  'failed'
);

create type shipping_job_result_status as enum (
  'success',
  'failed'
);

create table shipping_jobs (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references auth.users(id) on delete cascade,
  parent_job_id uuid references shipping_jobs(id),  -- n56 재시도: 부모 잡 추적
  status        shipping_job_status not null default 'pending',
  order_count   int  not null check (order_count >= 0),
  success_count int  not null default 0,
  failed_count  int  not null default 0,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index shipping_jobs_seller_created_idx on shipping_jobs (seller_id, created_at desc);

create table shipping_job_results (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references shipping_jobs(id) on delete cascade,
  order_id      uuid not null references orders(id) on delete restrict,
  market_id     text not null,
  status        shipping_job_result_status not null,
  error_code    text,
  error_message text,
  external_response jsonb,            -- 디버깅용 — 토큰/PII 제거 후 적재
  attempted_at  timestamptz not null default now(),
  unique (job_id, order_id, market_id)
);

create index shipping_job_results_job_idx on shipping_job_results (job_id);
create index shipping_job_results_order_idx on shipping_job_results (order_id);

alter table shipping_jobs enable row level security;
alter table shipping_job_results enable row level security;

create policy shipping_jobs_select_own on shipping_jobs
  for select using (seller_id = auth.uid());

create policy shipping_job_results_select_own on shipping_job_results
  for select using (
    exists (select 1 from shipping_jobs sj where sj.id = job_id and sj.seller_id = auth.uid())
  );
-- INSERT/UPDATE 는 service_role 만.
```

### 3.1 상태 전이

```
pending → running → succeeded | partial | failed
partial → (재시도 n56 → 새 잡 생성, parent_job_id 연결)
```

partial 전이 규칙 (v1 RegistrationJob 패턴 동일):
- 마켓 결과가 1개 이상 success && 1개 이상 failed → `partial`.
- 모두 success → `succeeded`.
- 모두 failed → `failed`.

---

## 4. Edge Function — `logen-register-shipment` (n51)

### 4.1 시그니처

```ts
const LogenRegisterShipmentRequest = z.object({
  sellerId: z.string().uuid(),
  orderIds: z.array(z.string().uuid()).min(1).max(100)  // orders-sync 직후 신규 주문
}).strict();

const LogenRegisterShipmentResponse = z.object({
  registered: z.array(z.object({
    orderId: z.string().uuid(),
    waybillNumber: z.string(),
    logenOrderId: z.string()
  })),
  failed: z.array(z.object({
    orderId: z.string().uuid(),
    errorCode: z.string(),
    errorMessage: z.string()
  }))
}).strict();
```

### 4.2 처리 순서

```
1. logen_credentials 조회 + 복호화 (security definer RPC)
2. orders 에서 status = 'collected' 인 orderIds 만 필터
3. getSlipNo(slipQty = filtered.length) → slipNo[]
4. registerOrderData (각 주문 + 발송인 정보 + slipNo) — Promise.allSettled
5. 성공: orders.update(status='logen_registered', waybill_number=slipNo, logen_order_id=fixTakeNo, logen_registered_at=now())
6. 실패 (3 재시도 지수 백오프 후 최종 실패): orders.update(status='logen_failed')
7. 실패 건은 다음 polling 사이클에서 재시도되지 않음 — n50 수동 처리 유도
```

로젠 API 베이스 URL / 메서드 호출 규약은 `cross-cutting/logen-adapter.md` 단일 출처.

### 4.3 트리거

- `orders-sync` 가 INSERT 한 orderIds 를 직접 enqueue.
- 별도 cron 으로도 status = 'collected' 잔여 주문 매 분 sweep (장애 보정).

---

## 5. Edge Function — `shipping-dispatch-job` (n54)

### 5.1 시그니처

```ts
const ShippingDispatchJobRequest = z.object({
  sellerId: z.string().uuid(),
  orderIds: z.array(z.string().uuid()).min(1),
  excludeMarkets: z.array(MarketIdSchema).optional(),  // n56 재시도 시
  parentJobId: z.string().uuid().optional()             // n56 재시도 시 부모 추적
}).strict();

const ShippingDispatchJobResponse = z.object({
  jobId: z.string().uuid(),
  status: ShippingJobStatusSchema,  // 즉시 pending 또는 running 반환
}).strict();
// 진행 상황 / 결과는 Realtime 으로 노출.
```

### 5.2 처리 순서

```
1. shipping_jobs INSERT (status='pending', order_count=N)
2. orders 에서 orderIds × status='waybill_printed' 필터 (waybill_number 필수)
3. 마켓별 그룹핑 (market_id 기준)
4. excludeMarkets 적용
5. 마켓별 fan-out (Promise.allSettled)
   - 마켓 어댑터.submitTracking({ externalOrderId, waybillNumber, carrierCode })
   - 결과를 shipping_job_results 에 INSERT
6. job 상태 집계 → succeeded | partial | failed
7. orders.status 업데이트:
   - success → tracking_submitted, dispatched_at=now()
   - failed → dispatch_failed
8. completed_at = now()
```

### 5.3 재시도 (n56)

- ResultPage 에서 [재시도] 클릭 → 실패 order_id 리스트 + excludeMarkets 패턴으로 새 잡 생성.
- parent_job_id 로 부모 추적.
- v1 RegistrationJob 재시도 패턴과 동일 (history.md 인용).

---

## 6. Realtime 구독

- 채널: `shipping_jobs:seller=${sellerId}` + `shipping_job_results:job=${jobId}`.
- 클라이언트는 n54 진행 화면에서 `useDispatchJob(jobId)` hook 으로 구독.
- invalidate 대상:
  - `['shipping', 'job', jobId]`
  - `['orders', 'list', sellerId]` (상태 전이 반영)

---

## 7. 화면 — s8

### 7.1 n52 `/shipping/print`

- 진입: 사이드바 "운송장 출력" 또는 n47 CTA.
- 대상 목록: status = `logen_registered` 인 orders.
- 핵심 액션:
  - [출력 팝업 열기] — `logen-adapter.outSlipPrintPopUrl()` 응답으로 받은 단발 URL 을 `window.open` (제 3 자 팝업, 새 창). 로젠 자격증명 노출 0 (URL 은 서버에서 서명/생성).
  - [출력 완료] — 선택된 주문 ids 일괄 update → status = `waybill_printed`, waybill_printed_at = now().
- 설정 `auto_dispatch_after_print = true` 인 경우 [출력 완료] 클릭 시 즉시 `/shipping/dispatch` 로 자동 진입 (n53 자동 트리거).

### 7.2 n53 / n54 `/shipping/dispatch`

- 미리보기 (n53):
  - 마켓별 제출 건수 요약 (네이버 N건 / 쿠팡 N건 / G마켓 N건 / 옥션 N건).
  - 출력 미완료 주문이 있으면 경고 배너 (강제 차단 아님).
  - [제출 시작] → `shipping-dispatch-job` 호출.
- 진행 (n54, 동일 페이지 내 transition):
  - 진행률 바 + 마켓별 상태 칩 (진행중/완료/실패).
  - Realtime 으로 마켓별 결과 도착하면 즉시 갱신.
  - 완료 시 `/shipping/dispatch/:jobId/result` 로 navigate.

### 7.3 n55 / n56 `/shipping/dispatch/:jobId/result`

- 마켓별 성공/실패 카드.
- 실패 건: 오류 코드 + 메시지(ErrorMessage 컴포넌트 — 긴 메시지 fold).
- [재시도] — 실패 마켓·주문만 묶어 새 잡 생성 (parent_job_id 연결).
- 전체 성공 시: "오늘 N건 배송 처리 완료" + [주문 현황으로] (n47).

### 7.4 n57 `/shipping/history`

- 날짜별 ShippingJob 목록 (페이지네이션 / 무한 스크롤).
- 각 행: 제출일 · 마켓별 성공/실패 · 총 건수.
- 행 클릭 → ResultPage (n55) 재진입.

---

## 8. 보안

- 모든 Edge Function 은 service_role. 클라이언트는 인증된 supabase-js 호출만.
- `external_response` jsonb 는 마켓 API 원본 응답을 적재하되, 토큰·access key·HMAC 시그니처는 적재 전 제거.
- 로젠 API 호출 로그는 `logen_user_id`, `cust_cd` 를 마스킹 (전체값 → 앞 2자리만).

---

## 9. 테스트 매트릭스

| ID | 영역 | 케이스 |
|---|---|---|
| S-001 | logen-register-shipment | getSlipNo 응답 slipNo 개수와 orderIds 개수 일치 |
| S-002 | logen-register-shipment | registerOrderData 부분 실패 시 성공 건만 logen_registered |
| S-003 | logen-register-shipment | 3 재시도 후 최종 실패 → logen_failed + Realtime 갱신 |
| S-004 | shipping-dispatch-job | 5 마켓 fan-out 중 1 마켓 실패 → partial |
| S-005 | shipping-dispatch-job | excludeMarkets 적용 시 해당 마켓 결과 없음 |
| S-006 | shipping-dispatch-job | parent_job_id 연결 (재시도 잡) |
| S-007 | n52 | outSlipPrintPop URL 만료 시 재요청 |
| S-008 | n53 | 출력 미완료 주문 경고 배너 — 진행 가능 |
| S-009 | n55 | 긴 오류 메시지 fold/unfold |
| S-010 | n56 | 부분 실패 재시도 → 새 잡 생성 + Realtime 진입 |
| S-011 | n57 | history 목록 페이지네이션 |
| S-012 | RLS | 타 셀러 job_id 직접 조회 → 거부 |

---

## 10. 미해결 사안

- OQ-V2-04 (`fareTy` / `dlvFare` 운영값) — `logen-register-shipment` 호출 시 `logen_credentials` 의 default 값 사용. 운영 데이터로 갱신.
- OQ-V2-05 (출력 후 자동 제출 default) — `features/settings-shipping.md` n58 default 결정 필요.
