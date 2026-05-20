# MarketCast v2 — 주문·배송 자동화 PRD

> **버전**: v2.0-draft | **작성일**: 2026-05-20
> 기존 `PRD.md` (상품 등록 자동화)는 그대로 유지. 본 문서는 주문·배송 자동화 신규 기능 스펙.

---

## 1. 배경 및 목표

### 1.1 현재 판매자 일과 (Pain Point)

```
오전
 └─ 여러 건 주문 들어옴
 └─ 주문마다 로젠택배 앱/웹에서 수동 집하 예약
 └─ 주문 포장

오후
 └─ 마켓별로 대시보드 접속
 └─ 배달 건당 수동으로 송장번호 입력 (네이버/쿠팡/G마켓/옥션 각각)
 └─ 실수, 누락, 시간 소요 발생
```

### 1.2 목표 상태

```
주문 수신 시
 └─ 로젠택배 집하 예약 자동 등록 → 송장번호 수신

퇴근 전
 └─ [딸깍] → 전체 마켓 송장번호 일괄 자동 입력
```

### 1.3 핵심 지표 (KPI)

| 지표 | 기준 | 목표 |
|---|---|---|
| 송장 입력 소요 시간 | 건당 30~60초 × N건 | 전체 1분 이내 |
| 입력 오류율 | 현재 ~2% (수기) | 0% |
| 일일 업무 단계 수 | 마켓 수 × 주문 수 | 1회 클릭 |

---

## 2. 기능 스펙

### 2.1 주문 수집 (Order Aggregation)

**요구사항**

- 연결된 마켓 계정에서 신규 주문 자동 조회
- 폴링 주기: 10분 (Supabase pg_cron + Edge Function)
- 수집 대상 마켓: 네이버 스마트스토어 / 쿠팡 / G마켓 / 옥션
- 주문 상태 필터: 결제완료(배송대기) 건만 수집
- 중복 수집 방지: 외부 주문번호 unique 제약

**주문 데이터 모델**

```
Order
 ├─ id (internal UUID)
 ├─ market_id (naver | coupang | gmarket | auction)
 ├─ external_order_id (마켓 주문번호)
 ├─ external_order_detail_id (마켓 주문상세번호, 필요 시)
 ├─ buyer_name
 ├─ receiver_name
 ├─ receiver_address (도로명)
 ├─ receiver_phone
 ├─ product_name
 ├─ quantity
 ├─ status: collected | logen_registered | shipped | tracking_submitted
 └─ created_at
```

### 2.2 로젠택배 자동 집하 예약

**API**: `openapihome.ilogen.co.kr` (B2B 계약 후 API Key 발급)

**선행 조건**
- 로젠택배 화주 계약 (B2B)
- API Key 발급 (포털 신청)

**자동화 플로우**

```
주문 수집 완료
 └─ Edge Function: logen-register-shipment
     └─ 수신자 정보 + 상품명 → 로젠 집하 예약 API 호출
     └─ 응답: 운송장번호(waybill_number)
     └─ orders.waybill_number 업데이트
     └─ orders.status = 'logen_registered'
```

**오류 처리**
- Logen API 실패 시: 재시도 3회 (지수 백오프), 실패 시 알림
- 주소 오류 시: 수동 처리 플래그 표시

### 2.3 송장번호 일괄 자동 입력

**트리거**: 사용자가 "송장 일괄 제출" 버튼 클릭 (퇴근 전 1회)

**처리 대상**: `status = 'logen_registered'` 인 전체 주문

**마켓별 API**

| 마켓 | API | 인증 |
|---|---|---|
| 네이버 스마트스토어 | `PATCH /external/v1/orders/{orderId}/dispatch` | OAuth 2.0 |
| 쿠팡 | `PUT /v2/providers/openapi/apis/api/v4/vendors/{vendorId}/orders/{orderId}/shipments` | HMAC-SHA256 |
| G마켓 | ESM Trading API `setShipInfo` | ESM API Key |
| 옥션 | 동일 ESM Trading API (site='A') | ESM API Key |

**처리 플로우**

```
[딸깍] 송장 일괄 제출
 └─ ShippingJobPage: 제출 대상 목록 확인 (미리보기)
 └─ Edge Function: shipping-dispatch-job
     └─ 마켓별 병렬 처리 (fan-out, RegistrationJob 패턴 동일)
     └─ 성공: orders.status = 'tracking_submitted'
     └─ 실패: 마켓별 오류 표시, 재시도 가능
 └─ 결과 화면: 마켓별 성공/실패 건수
```

### 2.4 주문·배송 현황 대시보드

- 오늘 주문 건수 (마켓별)
- 로젠 등록 완료 / 대기 건수
- 송장 제출 완료 / 미제출 건수
- 실시간 갱신 (Realtime)

---

## 3. 마켓 주문 조회 API

| 마켓 | 신규 주문 조회 API | 비고 |
|---|---|---|
| 네이버 | `GET /external/v1/pay-order/seller/orders/new-pay-waiting` | 결제 완료 대기 주문 |
| 쿠팡 | `GET /v2/providers/openapi/apis/api/v4/vendors/{vendorId}/ordersheets` | status=ACCEPT |
| G마켓 | ESM `getOrderList` | 주문상태 필터 |
| 옥션 | 동일 ESM API (site='A') | — |

---

## 4. 미결 사항 (Open Questions)

| # | 질문 | 우선순위 |
|---|---|---|
| OQ-V2-01 | 로젠택배 B2B 계약 — 개인 셀러 기준 최소 계약 조건·비용 | P0 (차단) |
| OQ-V2-02 | 주문 수집 주기: 10분 폴링 vs 마켓 웹훅(push) 가능 여부 | P1 |
| OQ-V2-03 | 네이버 주문 API type=SERVICE 심사 조건 (상품 등록 API와 동일 앱 사용 가능 여부) | P1 |
| OQ-V2-04 | 로젠 API: 집하 예약 시 운송장번호 즉시 반환 여부 (vs 집하 후 생성) | P0 (차단) |
| OQ-V2-05 | 포장 완료 전 집하 예약 가능 여부 (예약만 하고 수거는 당일 오후) | P1 |

---

## 5. v1 상품 등록 기능과의 관계

- **마켓 계정 연결**: v1의 `MarketAccount` 재사용 (추가 연동 불필요)
- **인증 토큰**: v1의 OAuth/HMAC/ESM 토큰 공유
- **신규 도메인**: `Order`, `ShippingJob` 신설
- **기존 도메인 변경 없음**: `Product`, `RegistrationJob` 그대로

---

## 6. v2 MVP 범위

**포함**
- 주문 수집 (4마켓: 네이버/쿠팡/G마켓/옥션)
- 로젠 자동 집하 예약 (OQ-V2-01·04 해제 후)
- 송장 일괄 제출 (딸깍 버튼)
- 주문·배송 현황 대시보드

**제외 (v3+)**
- 11번가 (IP 화이트리스트 정책)
- 타 택배사 (CJ대한통운, 한진 등)
- 반품/교환 자동화
- 실시간 배송 추적
