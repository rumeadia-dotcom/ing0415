# MarketCast v2 — 주문·배송 자동화 PRD

> **버전**: v2.2-draft | **작성일**: 2026-05-20
> 전제 조건: 로젠택배 B2B 계약 완료 + 운송장번호는 출력 시점(집하 전)에 채번.
> 기존 `PRD.md` (상품 등록 자동화)는 그대로 유지.

---

## 1. 배경 및 목표

### 1.1 현재 판매자 일과 (Pain Point)

```
오전
 ├─ 여러 마켓 각각 접속해서 신규 주문 확인
 ├─ 주문마다 수취인 정보를 로젠 앱/웹에 수동 입력해서 집하 예약
 ├─ 운송장 출력 (로젠 웹에서 건별 출력)
 └─ 주문 포장 + 운송장 부착

오후~퇴근 전
 └─ 마켓마다 각각 접속 → 주문 건별 송장번호 수동 입력
    (네이버·쿠팡·G마켓·옥션 각각 로그인 → 주문관리 → 송장입력 반복)
```

### 1.2 전제 조건 (확인 완료)

| 항목 | 상태 | 비고 |
|---|---|---|
| 로젠택배 B2B 계약 | ✅ 완료 | `userId`(연동업체코드) + `custCd`(거래처코드) 발급됨 |
| 운송장번호 생성 시점 | 출력 버튼 시점 채번 — 수거 전 확보 가능 | `getSlipNo` API 호출 즉시 발급 |
| 마켓 송장 제출 API | ✅ 4마켓 모두 존재 확인 | §2.4 참고 |

### 1.3 자동화 범위

| 단계 | 자동화 여부 | 내용 |
|---|---|---|
| 주문 수집 | ✅ 완전 자동 | 4마켓 신규 주문 10분 폴링 → 통합 목록 |
| 로젠 집하 예약 등록 | ✅ 완전 자동 | `registerOrderData` 자동 호출 |
| 운송장번호 채번 | ✅ 완전 자동 | `getSlipNo` → slipNo 즉시 확보 |
| 운송장 출력 | 🖨️ 클릭 1번 | `outSlipPrintPop` 팝업 → 판매자 물리 출력 (택배 부착 필수) |
| 마켓 송장 일괄 제출 | ✅ 완전 자동 | 1클릭 → 4마켓 동시 제출 (출력 후 즉시 가능) |

### 1.4 핵심 가치

- **오전**: 여러 마켓 접속 없이 → MarketCast 1곳에서 주문 확인
- **오전**: 로젠 수동 입력 없이 → 주문 자동 등록 + 운송장번호 자동 채번
- **오전**: 운송장 출력 클릭 1번 → 포장만 하면 끝
- **퇴근 전**: 마켓마다 각각 접속 없이 → 딸깍 1번으로 전체 제출 (또는 출력 후 즉시 자동 제출 옵션)

### 1.5 핵심 지표 (KPI)

| 지표 | 현재 | 목표 |
|---|---|---|
| 마켓 접속 횟수 | 4회 (주문 확인) + 4회 (송장 입력) | 1회 (MarketCast만) |
| 로젠 등록 소요 시간 | 건당 1~2분 수동 입력 × N건 | 0초 (완전 자동) |
| 송장 입력 소요 시간 | 건당 30~60초 × N건 | 0초 (완전 자동, 출력 후 즉시) |
| 입력 오류율 | ~2% (수기) | 0% |

---

## 2. 기능 스펙

### 2.1 주문 자동 수집

**동작**
- Supabase pg_cron → Edge Function `orders-sync` → 마켓별 신규 주문 조회
- 주기: 10분 (조정 가능)
- 상태: `결제완료/배송대기` 주문만 수집
- 중복 방지: `(market_id, external_order_id, seller_id)` unique 제약

**수집 데이터**
```
Order
 ├─ id (UUID)
 ├─ market_id
 ├─ external_order_id
 ├─ buyer_name / receiver_name / receiver_address / receiver_phone
 ├─ product_name / quantity / order_amount
 ├─ status: collected → logen_registered → waybill_printed → tracking_submitted
 ├─ logen_order_id (fixTakeNo — registerOrderData 후 저장)
 ├─ waybill_number (slipNo — getSlipNo 후 저장)
 └─ collected_at / logen_registered_at / waybill_printed_at / dispatched_at
```

**마켓별 주문 조회 API**

| 마켓 | API |
|---|---|
| 네이버 | `GET /external/v1/pay-order/seller/orders/new-pay-waiting` |
| 쿠팡 | `GET /v2/.../ordersheets?status=ACCEPT` |
| G마켓 | ESM `getOrderList` (주문상태: 결제완료) |
| 옥션 | 동일 ESM API (site='A') |

---

### 2.2 로젠 집하 예약 자동 등록

**트리거**: 주문 수집 직후 자동 실행 (pg_cron 또는 DB trigger)

**Edge Function**: `logen-register-shipment`

**처리 순서**

```
1. getSlipNo(slipQty = 미등록 주문 수)
   POST openapi.ilogen.com/lrm02b-edi/edi/getSlipNo
   req: { userId, slipQty }
   res: { startSlipNo, closeSlipNo, slipNo[] }

2. registerOrderData (주문 건별 — 병렬)
   POST openapi.ilogen.com/lrm02b-edi/edi/registerOrderData
   req: {
     userId, custCd, takeDt,
     sndCustNm, sndCustAddr, sndTelNo,   ← 발송인 정보 (설정에서)
     rcvCustNm, rcvCustAddr, rcvTelNo,   ← 수취인 정보 (주문에서)
     fareTy, qty, dlvFare,
     fixTakeNo (주문 ID),
     slipNo (채번된 운송장번호)
   }
   res: { fixTakeNo, resultCd }

3. DB 업데이트
   orders.logen_order_id = fixTakeNo
   orders.waybill_number = slipNo
   orders.status = 'logen_registered'
   orders.logen_registered_at = now()
```

**실패 처리**
- 재시도 3회 (지수 백오프)
- 최종 실패 시 `orders.status = 'logen_failed'` + 알림 배너 → 수동 처리 다이얼로그 유도

---

### 2.3 운송장 출력 (클릭 1번)

**목적**: 물리적 운송장 라벨 출력 (택배 부착용). 유일한 수동 단계.

**동작**
- 버튼: "운송장 출력" (status = `logen_registered` 주문 전체 또는 선택)
- Edge Function or 클라이언트 팝업: `outSlipPrintPop`
  ```
  GET openapi.ilogen.com/lrm02b-edi/edi/outSlipPrintPop
  req: { userId, custCd, takeDt }
  res: 팝업 URL
  ```
- 팝업에서 프린터로 출력 → 택배 포장에 부착
- 출력 완료 확인 버튼 클릭 → `orders.status = 'waybill_printed'`

**운송장번호는 이미 확보된 상태** (`logen_registered` 전환 시 저장됨)

---

### 2.4 마켓 송장 일괄 제출 (딸깍)

**트리거**: "송장 일괄 제출" 버튼 1회 클릭

**처리 대상**: `status = 'waybill_printed'` 주문 전체
(설정에서 "출력 후 자동 제출" ON 시 `waybill_printed` 전환 즉시 자동 트리거)

**마켓별 송장 제출 API**

| 마켓 | API | 인증 |
|---|---|---|
| 네이버 | `PATCH /external/v1/orders/{orderId}/dispatch` | OAuth 2.0 |
| 쿠팡 | `PUT /v2/.../orders/{orderId}/shipments` | HMAC-SHA256 |
| G마켓 | ESM `setShipInfo` (site='G') | ESM API Key |
| 옥션 | ESM `setShipInfo` (site='A') | ESM API Key |

**처리 플로우**
```
[딸깍] 송장 일괄 제출
  └─ 미리보기: 마켓별 제출 건수 확인
  └─ Edge Function: shipping-dispatch-job (fan-out)
      └─ 4마켓 병렬 처리
      └─ 성공: status = 'tracking_submitted'
      └─ 실패: 마켓별 오류 + 재시도 버튼
  └─ 결과: "오늘 N건 처리 완료"
```

---

### 2.5 주문·배송 현황 대시보드

| 섹션 | 내용 |
|---|---|
| 오늘 요약 | 신규 주문 N건 / 로젠 등록 완료 N건 / 출력 대기 N건 / 제출 완료 N건 |
| 빠른 액션 | "운송장 출력" / "송장 일괄 제출" |
| 주문 목록 | 마켓별 필터 / 상태별 필터 / 검색 |
| Realtime | pg_cron 수집·등록 완료 시 자동 갱신 |

---

## 3. 로젠택배 API 명세 (사용 API 정리)

| API | 엔드포인트 | 용도 |
|---|---|---|
| 송장번호 채번 | `POST /lrm02b-edi/edi/getSlipNo` | 운송장번호 즉시 발급 |
| 주문 정보 일괄 등록 | `POST /lrm02b-edi/edi/registerOrderData` | 집하 예약 등록 |
| 운송장 출력 팝업 | `GET /lrm02b-edi/edi/outSlipPrintPop` | 물리 출력 팝업 |
| 출력 송장번호 조회 | `POST /lrm02b-edi/edi/inquirySlipNoMulti` | slipNo 재조회 (fallback) |

**Base URL**
- 개발: `https://topenapi.ilogen.com`
- 운영: `https://openapi.ilogen.com`

**인증**: `userId`(연동업체코드) + `custCd`(거래처코드) — B2B 계약 시 발급, Edge Function env var로 관리

---

## 4. 데이터 모델

```sql
orders
  id                uuid PK
  seller_id         uuid FK → sellers
  market_id         text
  external_order_id text
  receiver_name     text
  receiver_address  text
  receiver_phone    text
  product_name      text
  quantity          int
  order_amount      int
  status            enum (
                      collected |
                      logen_registered |
                      logen_failed |
                      waybill_printed |
                      tracking_submitted |
                      dispatch_failed
                    )
  logen_order_id    text nullable   -- fixTakeNo (registerOrderData 응답)
  waybill_number    text nullable   -- slipNo (getSlipNo 응답)
  carrier_code      text default 'LOGEN'
  collected_at      timestamptz
  logen_registered_at timestamptz nullable
  waybill_printed_at  timestamptz nullable
  dispatched_at     timestamptz nullable
  UNIQUE (market_id, external_order_id, seller_id)

shipping_jobs
  id            uuid PK
  seller_id     uuid FK
  status        enum (pending | running | partial | succeeded | failed)
  order_count   int
  success_count int
  failed_count  int
  created_at    timestamptz
  completed_at  timestamptz nullable

shipping_job_results
  id            uuid PK
  job_id        uuid FK → shipping_jobs
  order_id      uuid FK → orders
  market_id     text
  status        enum (success | failed)
  error_code    text nullable
  error_message text nullable

logen_credentials              -- 셀러별 로젠 API 자격증명 (pgcrypto 암호화)
  id            uuid PK
  seller_id     uuid FK → sellers UNIQUE
  user_id_enc   bytea          -- userId (연동업체코드) 암호화
  cust_cd_enc   bytea          -- custCd (거래처코드) 암호화
  sender_name   text
  sender_address text
  sender_phone  text
  fare_ty       text default 'C'
  dlv_fare      int  default 0
  created_at    timestamptz
  updated_at    timestamptz
```

---

## 5. v1 상품 등록 기능과의 관계

- **마켓 계정 연결**: v1 `MarketAccount` 재사용 (토큰 공유)
- **인증 인프라**: OAuth/HMAC/ESM 토큰 그대로 재사용
- **신규 도메인**: `orders`, `shipping_jobs`, `shipping_job_results`, `logen_credentials`
- **기존 도메인 변경 없음**

---

## 6. 미결 사항

| # | 질문 | 우선순위 |
|---|---|---|
| OQ-V2-02 | 마켓 주문 웹훅(push) 지원 여부 — 있으면 10분 폴링 대신 실시간 가능 | P2 |
| OQ-V2-03 | 네이버 주문 API — 상품등록 앱과 동일 앱으로 주문 조회 가능 여부 | P1 |
| OQ-V2-04 | `registerOrderData` 의 `fareTy` / `dlvFare` 값 — 계약 시 확정값 확인 필요 | P1 |
| OQ-V2-05 | 출력 후 자동 제출 옵션 기본값 — ON/OFF 중 셀러 선호 확인 필요 | P2 |
