# 주문·배송 자동화 아키텍처 개요 (v1)

> **작성일**: 2026-05-21
> **범위**: 4 마켓(네이버/쿠팡/G마켓/옥션) 신규 주문 폴링 → 로젠택배 집하 자동 등록 → 운송장 1클릭 출력 → 마켓 송장 1클릭 일괄 제출.
> **전제**: 상품 등록 자동화 도메인과 동일 v1 출시 범위. 로젠택배 B2B 계약 완료.

---

## 1. 목적

PRD.md / user_flow.md 가 ground truth. 본 문서는 그 두 문서를 묶어 **아키텍처 결정과 디렉토리 매핑**을 단일 진입점으로 제공한다.

핵심 가치 (PRD §1.4):
- 오전: 4 마켓 접속 0 → MarketCast 1곳에서 신규 주문 확인.
- 오전: 로젠 수동 입력 0 → `orders-sync` 자동 수집 + `logen-register-shipment` 자동 채번/등록.
- 오전: 운송장 출력 1 클릭 → 물리 출력만 판매자 책임.
- 퇴근 전: 마켓 송장 입력 0 → "송장 일괄 제출" 1 클릭으로 4 마켓 fan-out.

---

## 2. 상품 등록 도메인과의 관계

| 구분 | 상품 등록 (s1~s6) | 주문·배송 (s7~s9) |
|---|---|---|
| 도메인 | `products` / `product_market_mappings` / `registration_jobs` | `orders` / `shipping_jobs` / `shipping_job_results` / `logen_credentials` |
| 마켓 어댑터 | 5 메서드 (authenticate / refreshToken / fetchCategoryTree / transformProduct / createProduct) | **+2 메서드**: `fetchOrders` / `submitTracking` (cross-cutting/market-adapter-shipping.md) |
| 자격증명 | `market_credentials` (pgcrypto) | **+로젠 자격증명**: `logen_credentials` (pgcrypto, 셀러당 1 row) |
| 잡 상태 모델 | `RegistrationJob` 7 상태 | `ShippingJob` 5 상태 (pending / running / partial / succeeded / failed) — 동일 fan-out 패턴 |
| Realtime | `registration_jobs` 구독 | `orders` + `shipping_jobs` 구독 |
| Edge Functions | registration-* 5 종 | **+3 종**: `orders-sync` / `logen-register-shipment` / `shipping-dispatch-job` / `logen-verify-credential` |
| 인프라 신규 | — | **pg_cron** (orders-sync 10분 주기 폴링) |

**기존 도메인 변경 없음.** 상품 등록의 `MarketAccount` (OAuth/HMAC/ESM 토큰) 를 그대로 재사용 — 주문·배송이 그 위에 얹히는 구조. 토큰 복호화 RPC (`market_credentials.decrypt_token`) 동일 경로.

---

## 3. 인프라 신규 결정

### 3.1 pg_cron (10분 폴링)

- **선택**: Supabase pg_cron extension.
- **근거**: 외부 마켓 웹훅 지원이 4 마켓 중 일관되지 않음 (OQ-V2-02 미결). v1 의 Edge Function 호출 모델을 그대로 이어 받아 운영 부담 최소화.
- **거부**: (a) 별도 워커 (Render/Fly) — 인프라 추가, debug/real 프로젝트 분리 깨짐. (b) GitHub Actions cron — 5분 보장 어려움 + 외부 시크릿 노출 표면 증가.
- **스케줄**: `*/10 * * * *` — 각 폴링 사이클이 4 마켓 fan-out 으로 끝나야 함. Edge Function timeout 안에서 한 마켓이라도 실패 시 결과는 `orders` 에 partial 적재 (다음 사이클에서 멱등 재시도).
- **OQ-SHIP-02 해결 후**: 마켓별 웹훅 진입을 추가 Edge Function 으로 받고, pg_cron 은 fallback / 손실 보정 용으로 유지.

### 3.2 Realtime 구독 추가

- `orders` 테이블 INSERT/UPDATE → s7 대시보드 (n47) Realtime 갱신.
- `shipping_jobs` + `shipping_job_results` UPDATE → s8 진행 화면 (n54).
- 구독 키 규약 (frontend.md §7 인용): `[domain, sellerId, ...filters]`.

### 3.3 Edge Functions 3 종 + 1 보조

| 함수 | 트리거 | 책임 |
|---|---|---|
| `orders-sync` | pg_cron (10분) | 4 마켓 `fetchOrders` 호출 + `orders` upsert (멱등) + 신규 주문에 대해 `logen-register-shipment` 큐잉 |
| `logen-register-shipment` | `orders-sync` 직후 자동 / 재시도 큐 | `getSlipNo` → `registerOrderData` → `orders.status = logen_registered` |
| `shipping-dispatch-job` | s8 n53 의 "제출 시작" 클릭 / 자동 트리거 | 마켓별 `submitTracking` fan-out, 결과를 `shipping_job_results` 에 1:N 적재 |
| `logen-verify-credential` | s9 n59 의 "연결 테스트" 클릭 | `logen_credentials` 복호화 → `getSlipNo` 1건으로 ping (즉시 취소 또는 sandbox base URL 사용) |

cross-cutting/logen-adapter.md 가 로젠 API 4 메서드 명세, cross-cutting/market-adapter-shipping.md 가 마켓별 fetchOrders / submitTracking 매트릭스를 정의한다.

### 3.4 운송장 출력 (outSlipPrintPop)

- 클라이언트가 새 창으로 `outSlipPrintPop` URL 을 직접 열어 로젠 인쇄 팝업을 띄움.
- URL 자체는 Edge Function 이 `logen_credentials` 복호화 후 서명/생성하여 클라이언트로 단발 응답 (토큰·custCd 노출 없이 시간 제한 URL).
- 판매자가 물리 출력 후 [출력 완료] 클릭 → `orders.status = waybill_printed` 일괄 업데이트.

---

## 4. 디렉토리 매핑

### 4.1 프론트 (apps/web/src/)

```
features/orders/
  pages/
    OrdersDashboardPage.tsx        # /orders                       (n47)
    OrdersListPage.tsx             # /orders/list                  (n48)
    OrderDetailPage.tsx            # /orders/:orderId              (n49)
    OrderManualResolveDialog.tsx   # n50 (다이얼로그 — Detail 내부)
  components/                      # OrderRow, MarketBadge, StatusTimeline 등
  hooks/                           # useOrdersList, useOrderDetail, useOrdersRealtime
  api/                             # ordersApi.ts (Supabase RPC + Edge Function 호출)
  types/                           # OrderRow, OrderDetail (zod infer)

features/shipping/
  pages/
    ShippingPrintPage.tsx          # /shipping/print               (n52)
    ShippingDispatchPage.tsx       # /shipping/dispatch            (n53, n54)
    ShippingDispatchResultPage.tsx # /shipping/dispatch/:jobId/result (n55, n56)
    ShippingHistoryPage.tsx        # /shipping/history             (n57)
  components/                      # PrintReadyTable, DispatchSummary, JobResultPanel
  hooks/                           # usePrintReadyOrders, useDispatchJob, useShippingHistory
  api/                             # shippingApi.ts
  types/

features/settings/shipping/
  pages/
    SettingsShippingPage.tsx        # /settings/shipping           (n58)
    SettingsShippingLogenPage.tsx   # /settings/shipping/logen     (n59)
    SettingsShippingSenderPage.tsx  # /settings/shipping/sender    (n60)
  components/                      # LogenConnectionCard, SenderInfoForm
  hooks/                           # useLogenStatus, useLogenSave, useSenderInfo
  api/                             # logenApi.ts, senderApi.ts
  types/
```

### 4.2 백엔드 (apps/api/supabase/)

```
migrations/
  20260520_*_orders.sql                 # PR2 소관
  20260520_*_shipping_jobs.sql          # PR2 소관
  20260520_*_logen_credentials.sql      # PR2 소관

functions/
  orders-sync/                          # PR3 소관
  logen-register-shipment/              # PR5 소관
  shipping-dispatch-job/                # PR6 소관
  logen-verify-credential/              # PR7 소관
  _shared/logen-adapter.ts              # PR3 소관 (cross-cutting/logen-adapter.md 구현)
```

### 4.3 마켓 어댑터 (apps/web/src/lib/markets/)

```
real/{naver,coupang,gmarket,auction}/
  adapter.ts                       # fetchOrders + submitTracking 메서드 추가 (PR4)
```

cross-cutting/market-adapter-shipping.md 에 매트릭스 정의.

### 4.4 zod 스키마 (apps/web/src/lib/schemas/)

```
orders.ts        # PR2 소관 — OrderRow / OrderStatus enum / OrderDetail
shipping.ts      # PR2 소관 — ShippingJob / ShippingJobResult
logen.ts         # PR2 소관 — LogenCredentialInput / LogenStatus
```

### 4.5 i18n (apps/web/src/locales/ko.ts)

- `nav.shipping` — 사이드바 새 그룹 타이틀.
- `orders.*` — s7 화면 라벨/CTA.
- `shipping.*` — s8 화면 라벨/CTA/상태.
- `settingsShipping.*` — s9 화면 라벨/CTA.

본 PR(파운데이션) 이 텍스트만 채우고, 다운스트림 PR8/9/10 이 import 만 하면 되도록 단일 소스 유지.

---

## 5. PR 의존 그래프 (이력 참고)

```
PR1 (foundation)  ─┬─→ PR2 (schemas + migrations)
                   ├─→ PR4 (market-adapter 확장: fetchOrders / submitTracking)
                   └─→ PR8/9/10 (UI 본 구현, placeholder 교체)

PR2 ──→ PR3 (orders-sync)
PR2 ──→ PR5 (logen-register-shipment)
PR2 ──→ PR6 (shipping-dispatch-job)
PR2 ──→ PR7 (logen-verify-credential)
```

PR1 (foundation) 은 다른 9 개 PR 의 **충돌 표면을 선점**하는 역할로, 라우터·사이드바·i18n·디렉토리 트리·설계문서만 추가하고 실제 비즈니스 로직·DB 마이그레이션·Edge Function 코드는 일절 손대지 않았다.

---

## 6. MVP 범위 게이트

CLAUDE.md "MVP 범위 (v1)" 에 본 도메인(s7~s9) 이 포함된다. 본 문서가 정의하는 라우트·메뉴·placeholder 는 다운스트림 PR8/9/10 이 채우는 슬롯이며, 운영 활성화는 셀러 데이터 시드와 로젠 자격증명 입력이 완료된 시점부터.

---

## 7. 미해결 사안 (PRD §9 인용)

| # | 질문 | 영향 |
|---|---|---|
| OQ-SHIP-02 | 마켓 주문 웹훅 지원 여부 | 폴링 주기 / Realtime 정밀도 |
| OQ-SHIP-03 | 네이버 주문 API 와 상품등록 앱 동일 여부 | 인증 분리 필요 시 `MarketAccount` 분기 |
| OQ-SHIP-04 | `registerOrderData` 의 `fareTy` / `dlvFare` 운영값 | s9 n60 발송인 정보 폼 기본값 |
| OQ-SHIP-05 | "출력 후 자동 제출" 기본 ON/OFF | s9 n58 설정 default |

해결 결과는 본 문서 §3 / §4 또는 features/* 문서에 반영하고 OQ 번호는 닫는다.
