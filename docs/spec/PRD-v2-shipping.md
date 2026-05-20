# MarketCast v2 — 주문·배송 자동화 PRD

> **버전**: v2.1-draft | **작성일**: 2026-05-20
> 전제 조건 반영: 로젠택배 API Key 발급 불가(B2B 계약 필요) + 운송장번호는 수거 후 생성.
> 기존 `PRD.md` (상품 등록 자동화)는 그대로 유지.

---

## 1. 배경 및 목표

### 1.1 현재 판매자 일과 (Pain Point)

```
오전
 ├─ 여러 마켓 각각 접속해서 신규 주문 확인
 ├─ 주문마다 수취인 정보를 로젠 앱/웹에 수동 입력해서 집하 예약
 └─ 주문 포장

오후 (수거 후)
 ├─ 로젠 앱/문자에서 운송장번호 하나씩 확인
 └─ 마켓마다 각각 접속 → 주문 건별 송장번호 수동 입력
    (네이버·쿠팡·G마켓·옥션 각각 로그인 → 주문관리 → 송장입력 반복)
```

### 1.2 전제 조건 (확인 완료)

| 항목 | 상태 | 대응 |
|---|---|---|
| 로젠택배 API | ❌ B2B 계약 필요, 개인 셀러 직접 발급 불가 | 데이터 준비 자동화로 우회 |
| 운송장번호 생성 시점 | 수거 후 생성 (예약 시 미발급) | 수거 후 입력 플로우 설계 |

### 1.3 자동화 범위 (재정의)

| 단계 | 자동화 여부 | 내용 |
|---|---|---|
| 주문 수집 | ✅ 완전 자동 | 4마켓 신규 주문 10분 폴링 → 통합 목록 |
| 로젠 집하 예약용 데이터 준비 | ✅ 자동 (1클릭) | 로젠 업로드 형식 CSV 자동 생성 |
| 로젠 집하 예약 | ❌ 수동 | 판매자가 CSV로 로젠 웹/앱에 업로드 |
| 운송장번호 입력 | ⚡ 반자동 | 바코드 스캔 / CSV 가져오기 / 빠른 수동 입력 |
| 마켓 송장 일괄 제출 | ✅ 완전 자동 | 1클릭 → 4마켓 동시 제출 |

### 1.4 핵심 가치

- **오전**: 여러 마켓 각각 접속 없이 → 통합 주문 목록 1곳에서 확인
- **오전**: 로젠 등록 정보 수동 타이핑 없이 → CSV 1클릭 다운로드
- **오후**: 운송장번호 입력 시간 단축 (바코드 스캔 or CSV)
- **퇴근 전**: 마켓마다 각각 접속 없이 → 딸깍 1번으로 전체 제출

### 1.5 핵심 지표 (KPI)

| 지표 | 현재 | 목표 |
|---|---|---|
| 마켓 접속 횟수 | 4회 (송장 입력) + 4회 (주문 확인) | 1회 (MarketCast만) |
| 송장 입력 소요 시간 | 건당 30~60초 × N건 | 운송장번호 수집 후 전체 2분 이내 |
| 입력 오류율 | ~2% (수기) | 0% |

---

## 2. 기능 스펙

### 2.1 주문 자동 수집

**동작**
- Supabase pg_cron → Edge Function `orders-sync` → 마켓별 신규 주문 조회
- 주기: 10분 (조정 가능)
- 상태: `결제완료/배송대기` 주문만 수집
- 중복 방지: `(market_id, external_order_id)` unique 제약

**수집 데이터**
```
Order
 ├─ id (UUID)
 ├─ market_id
 ├─ external_order_id
 ├─ buyer_name / receiver_name / receiver_address / receiver_phone
 ├─ product_name / quantity / order_amount
 ├─ status: collected | waybill_ready | tracking_submitted
 ├─ waybill_number (nullable — 운송장번호, 수거 후 입력)
 └─ collected_at / dispatched_at
```

**마켓별 주문 조회 API**

| 마켓 | API |
|---|---|
| 네이버 | `GET /external/v1/pay-order/seller/orders/new-pay-waiting` |
| 쿠팡 | `GET /v2/.../ordersheets?status=ACCEPT` |
| G마켓 | ESM `getOrderList` (주문상태: 결제완료) |
| 옥션 | 동일 ESM API (site='A') |

---

### 2.2 로젠 집하 예약용 CSV 자동 생성

**목적**: 판매자가 로젠 웹/앱의 대량 업로드 기능에 붙여넣거나 업로드할 데이터를 자동 생성.

**1클릭 다운로드**
- 버튼: "로젠 등록용 CSV 다운로드"
- 대상: `status = 'collected'` 주문 전체
- 출력 형식: 로젠택배 대량 접수 양식 (수취인명 / 주소 / 전화번호 / 상품명 / 수량)

**판매자 직접 수행**
1. CSV 다운로드 → 로젠 웹(ilogen.co.kr) 또는 앱에서 대량 업로드
2. 로젠 기사 수거 → 운송장번호 생성 (로젠 앱 알림 또는 문자)

---

### 2.3 운송장번호 입력 (3가지 방법)

수거 완료 후, 운송장번호를 MarketCast에 입력하는 단계.

#### 방법 A — 바코드 스캔 (모바일 최적화)
- 모바일 카메라로 로젠 운송장 바코드 스캔
- 주문 자동 매칭 (수취인 전화번호 뒷 4자리 or 상품명)
- 스캔 → 다음 주문 자동 이동

#### 방법 B — CSV 가져오기
- 로젠 앱/웹에서 `발송완료 내역 CSV` 내보내기
- MarketCast에 드래그&드롭 업로드
- 자동 파싱 → 주문 매칭 (수취인 전화번호 기준)
- 매칭 결과 미리보기 후 확인

#### 방법 C — 빠른 수동 입력
- 주문 목록 테이블 인라인 편집
- 각 행에 운송장번호 입력 → Tab으로 다음 행 이동
- 일괄 저장

---

### 2.4 마켓 송장 일괄 제출 (딸깍)

**트리거**: "송장 일괄 제출" 버튼 1회 클릭

**처리 대상**: `status = 'waybill_ready'` (운송장번호 입력 완료) 주문 전체

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
| 오늘 요약 | 신규 주문 N건 / 로젠 등록 대기 N건 / 운송장 미입력 N건 / 제출 완료 N건 |
| 빠른 액션 | "로젠 CSV 다운로드" / "운송장 입력" / "송장 일괄 제출" |
| 주문 목록 | 마켓별 필터 / 상태별 필터 / 검색 |
| Realtime | pg_cron 수집 완료 시 자동 갱신 |

---

## 3. 데이터 모델

```sql
orders
  id              uuid PK
  seller_id       uuid FK → sellers
  market_id       text
  external_order_id text
  receiver_name   text
  receiver_address text
  receiver_phone  text
  product_name    text
  quantity        int
  status          enum (collected | waybill_ready | tracking_submitted | failed)
  waybill_number  text nullable
  carrier_code    text default 'LOGEN'
  collected_at    timestamptz
  waybill_set_at  timestamptz nullable
  dispatched_at   timestamptz nullable
  UNIQUE (market_id, external_order_id, seller_id)

shipping_jobs
  id              uuid PK
  seller_id       uuid FK
  status          enum (pending | running | partial | succeeded | failed)
  order_count     int
  success_count   int
  failed_count    int
  created_at      timestamptz
  completed_at    timestamptz nullable

shipping_job_results
  id              uuid PK
  job_id          uuid FK → shipping_jobs
  order_id        uuid FK → orders
  market_id       text
  status          enum (success | failed)
  error_code      text nullable
  error_message   text nullable
```

---

## 4. v1 상품 등록 기능과의 관계

- **마켓 계정 연결**: v1 `MarketAccount` 재사용 (토큰 공유)
- **인증 인프라**: OAuth/HMAC/ESM 토큰 그대로 재사용
- **신규 도메인**: `orders`, `shipping_jobs`, `shipping_job_results`
- **기존 도메인 변경 없음**

---

## 5. 미결 사항

| # | 질문 | 우선순위 |
|---|---|---|
| OQ-V2-02 | 마켓 주문 웹훅(push) 지원 여부 — 있으면 10분 폴링 대신 실시간 가능 | P2 |
| OQ-V2-03 | 네이버 주문 API — 상품등록 앱과 동일 앱으로 주문 조회 가능 여부 | P1 |
| OQ-V2-06 | 로젠 CSV 업로드 양식 정확한 컬럼 정의 (로젠 웹에서 확인 필요) | P1 |
| OQ-V2-07 | 로젠 앱 `발송완료 내역 CSV` 내보내기 기능 존재 여부 (방법 B 전제) | P1 |
