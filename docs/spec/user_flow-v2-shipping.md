# MarketCast v2 — 주문·배송 자동화 User Flow

> **버전**: v2.0-draft | **작성일**: 2026-05-20
> 기존 `user_flow.md` (상품 등록 자동화)는 그대로 유지.

---

## 섹션 구성

| 섹션 | 노드 수 | 설명 |
|---|---|---|
| s7 주문 현황 | 4 | 주문 목록·상세 |
| s8 배송 처리 | 6 | 로젠 등록·송장 일괄 제출·결과 |
| s9 설정 (배송) | 3 | 로젠 API 연동·택배사 선택 |

---

## s7 — 주문 현황

```
n47: 주문 현황 대시보드 (/orders)
  ├─ 오늘 신규 주문 N건 (마켓별 뱃지)
  ├─ 로젠 등록 대기 건수 / 완료 건수
  ├─ 송장 미제출 건수 → CTA: "송장 일괄 제출"
  └─ Realtime 자동 갱신

n48: 주문 목록 (/orders/list)
  ├─ 필터: 마켓 / 날짜 / 상태(collected|logen_registered|tracking_submitted)
  ├─ 행: 주문번호·수취인·상품명·마켓·상태·송장번호
  └─ 행 클릭 → n49

n49: 주문 상세 (/orders/:orderId)
  ├─ 주문 정보 (수취인·주소·상품·수량)
  ├─ 배송 상태 타임라인
  ├─ 로젠 등록 상태 + 운송장번호
  └─ 마켓 송장 제출 상태

n50: 수동 처리 다이얼로그
  ├─ 로젠 API 실패 시 진입
  ├─ 수동 운송장번호 입력
  └─ 확인 → orders.waybill_number 업데이트
```

---

## s8 — 배송 처리

```
n51: 로젠 자동 등록 (백그라운드, 사용자 진입 없음)
  ├─ 트리거: 주문 수집 후 자동 (pg_cron 또는 즉시)
  ├─ Edge Function: logen-register-shipment
  ├─ 성공 → orders.status = 'logen_registered', waybill_number 저장
  └─ 실패 → 재시도 3회 → 실패 시 n50 진입 유도 알림

n52: 송장 일괄 제출 시작 (/shipping/dispatch)
  ├─ 진입: n47 "송장 일괄 제출" 버튼 또는 사이드바
  ├─ 제출 대상 목록 미리보기 (status=logen_registered 전체)
  ├─ 마켓별 건수 요약 (네이버 N건 / 쿠팡 N건 / G마켓 N건 / 옥션 N건)
  ├─ 로젠 미등록 주문 존재 시 경고 배너
  └─ [송장 제출 시작] 버튼 → n53

n53: 송장 제출 진행 (실시간)
  ├─ Edge Function: shipping-dispatch-job
  ├─ 마켓별 병렬 fan-out (RegistrationJob 패턴 동일)
  ├─ 진행률 바 + 마켓별 상태 (진행중/완료/실패)
  ├─ Realtime 구독으로 실시간 갱신
  └─ 완료 → n54

n54: 송장 제출 결과 (/shipping/dispatch/:jobId/result)
  ├─ 마켓별 성공 건수 / 실패 건수
  ├─ 실패 건: 오류 메시지 + [재시도] 버튼
  ├─ 전체 성공 시: "오늘 배송 처리 완료" 메시지
  └─ [주문 현황으로] → n47

n55: 부분 실패 재시도
  ├─ 실패 마켓만 선택 재시도 (exclude 패턴)
  └─ → n53 (새 ShippingJob)

n56: 배송 이력 (/shipping/history)
  ├─ 날짜별 ShippingJob 목록
  ├─ 각 잡: 제출일·마켓별 성공/실패·총 건수
  └─ 행 클릭 → n54 (이력 상세)
```

---

## s9 — 설정 (배송)

```
n57: 배송 설정 (/settings/shipping)
  ├─ 로젠택배 API 연동 설정
  │   ├─ API Key 입력 (암호화 저장)
  │   ├─ 연결 테스트 버튼
  │   └─ 연결 상태 표시
  ├─ 기본 택배사 선택 (v2: 로젠만)
  └─ 집하 예약 자동화 ON/OFF 토글

n58: 로젠 API 연동 (/settings/shipping/logen)
  ├─ API Key 입력 폼
  ├─ 연결 테스트 → Edge Function: logen-verify-credential
  ├─ 성공 → 저장 + 활성 상태
  └─ 실패 → 오류 메시지 (잘못된 Key / 계약 미완료)

n59: 발송인 정보 설정 (/settings/shipping/sender)
  ├─ 발송인명
  ├─ 발송지 주소 (로젠 집하 위치)
  └─ 연락처
```

---

## 전체 일과 플로우 (Happy Path)

```
[오전]
주문 자동 수집 (pg_cron 10분 폴링)
  └─ 신규 주문 n건 DB 저장
  └─ 로젠 집하 예약 자동 호출 (n51)
  └─ 운송장번호 수신 및 저장

[오전~오후]
판매자: 상품 포장

[퇴근 전]
판매자: n47 접속
  └─ "송장 일괄 제출" 클릭 (n52)
  └─ 대상 확인 → [제출 시작] (n53)
  └─ 30초 내 완료 → n54 결과 확인
  └─ 퇴근
```

---

## 엣지 케이스

| 케이스 | 처리 |
|---|---|
| 로젠 API 실패 | 재시도 3회 → 수동 처리 플래그 → n50 |
| 마켓 송장 API 실패 | 해당 마켓만 실패 표시 → n55 재시도 |
| 운송장번호 미생성 상태에서 제출 시도 | 해당 주문 제외 경고 후 나머지 진행 |
| 중복 제출 방지 | status='tracking_submitted' 주문 필터 제외 |
| 로젠 미연동 상태 | n57 유도 배너 |
