# MarketCast v2 — 주문·배송 자동화 User Flow

> **버전**: v2.2-draft | **작성일**: 2026-05-20
> 전제: 로젠택배 B2B 계약 완료, 운송장번호 출력 시점 채번.
> 기존 `user_flow.md` (상품 등록 자동화)는 그대로 유지.

---

## 섹션 구성

| 섹션 | 노드 수 | 설명 |
|---|---|---|
| s7 주문 현황 | 4 | 주문 목록·상세·수동처리 |
| s8 배송 처리 | 7 | 로젠 자동등록·출력·송장 제출·결과·재시도·이력 |
| s9 설정 (배송) | 3 | 로젠 API 연동·발송인 정보 |

---

## s7 — 주문 현황

```
n47: 주문 현황 대시보드 (/orders)
  ├─ 오늘 신규 주문 N건 (마켓별 뱃지)
  ├─ 로젠 등록 완료 N건
  ├─ 출력 대기 N건 → CTA: "운송장 출력"
  ├─ 송장 제출 완료 N건 → CTA: "송장 일괄 제출"
  └─ Realtime 자동 갱신 (pg_cron 수집 완료 시)

n48: 주문 목록 (/orders/list)
  ├─ 필터: 마켓 / 날짜 / 상태(collected|logen_registered|waybill_printed|tracking_submitted)
  ├─ 행: 주문번호·수취인·상품명·마켓·상태·운송장번호
  └─ 행 클릭 → n49

n49: 주문 상세 (/orders/:orderId)
  ├─ 주문 정보 (수취인·주소·상품·수량)
  ├─ 배송 상태 타임라인
  │   collected → logen_registered → waybill_printed → tracking_submitted
  ├─ 로젠 등록 상태 + 운송장번호 (slipNo)
  └─ 마켓 송장 제출 상태

n50: 수동 처리 다이얼로그
  ├─ 진입: 로젠 API 실패(logen_failed) 주문에서
  ├─ 운송장번호 직접 입력
  └─ 확인 → orders.waybill_number 업데이트 + status = 'logen_registered'
```

---

## s8 — 배송 처리

```
n51: 로젠 자동 처리 (백그라운드, 사용자 진입 없음)
  ├─ 트리거: orders-sync 완료 직후 자동
  ├─ Edge Function: logen-register-shipment
  │   ├─ getSlipNo(slipQty) → slipNo[] 즉시 채번
  │   ├─ registerOrderData(각 주문 + slipNo) → fixTakeNo 저장
  │   └─ DB: waybill_number = slipNo, status = 'logen_registered'
  ├─ 성공 → n47 카운터 갱신 (Realtime)
  └─ 실패 → 재시도 3회 → status = 'logen_failed' → n50 유도 알림

n52: 운송장 출력 (/shipping/print)
  ├─ 진입: n47 "운송장 출력" 버튼 또는 사이드바
  ├─ 출력 대상 목록 (status=logen_registered 전체, 운송장번호 표시)
  ├─ [출력 팝업 열기] → outSlipPrintPop → 로젠 인쇄 팝업
  │   (판매자가 프린터로 출력 → 포장에 부착)
  ├─ [출력 완료] 확인 버튼 → orders.status = 'waybill_printed'
  └─ 설정 "출력 후 자동 제출" ON 시 → n53 자동 진입

n53: 송장 일괄 제출 시작 (/shipping/dispatch)
  ├─ 진입: n47 "송장 일괄 제출" 버튼 또는 n52 자동 진입
  ├─ 제출 대상 목록 미리보기 (status=waybill_printed 전체)
  ├─ 마켓별 건수 요약 (네이버 N건 / 쿠팡 N건 / G마켓 N건 / 옥션 N건)
  ├─ 출력 미완료 주문 존재 시 경고 배너
  └─ [제출 시작] 버튼 → n54

n54: 송장 제출 진행 (실시간)
  ├─ Edge Function: shipping-dispatch-job (fan-out)
  ├─ 4마켓 병렬 처리 (RegistrationJob 패턴 동일)
  ├─ 진행률 바 + 마켓별 상태 (진행중/완료/실패)
  ├─ Realtime 구독으로 실시간 갱신
  └─ 완료 → n55

n55: 송장 제출 결과 (/shipping/dispatch/:jobId/result)
  ├─ 마켓별 성공 건수 / 실패 건수
  ├─ 실패 건: 오류 메시지 + [재시도] 버튼 → n56
  ├─ 전체 성공 시: "오늘 N건 배송 처리 완료" 메시지
  └─ [주문 현황으로] → n47

n56: 부분 실패 재시도
  ├─ 실패 마켓만 선택 재시도 (exclude 패턴)
  └─ → n54 (새 ShippingJob)

n57: 배송 이력 (/shipping/history)
  ├─ 날짜별 ShippingJob 목록
  ├─ 각 잡: 제출일·마켓별 성공/실패·총 건수
  └─ 행 클릭 → n55 (이력 상세)
```

---

## s9 — 설정 (배송)

```
n58: 배송 설정 (/settings/shipping)
  ├─ 로젠택배 API 연동 상태 (연결됨 / 미연결)
  ├─ "출력 후 자동 제출" ON/OFF 토글
  ├─ 기본 택배사 (v2: 로젠만)
  └─ [로젠 API 설정] → n59 / [발송인 정보] → n60

n59: 로젠 API 연동 (/settings/shipping/logen)
  ├─ userId(연동업체코드) 입력
  ├─ custCd(거래처코드) 입력
  ├─ 저장 → pgcrypto 암호화 + logen_credentials 저장
  ├─ [연결 테스트] → Edge Function: logen-verify-credential
  ├─ 성공 → 활성 상태 표시
  └─ 실패 → 오류 메시지 (잘못된 코드 / 계약 미완료)

n60: 발송인 정보 설정 (/settings/shipping/sender)
  ├─ 발송인명
  ├─ 발송지 주소 (로젠 집하 위치)
  ├─ 연락처
  ├─ fareTy (운임타입, 계약 시 확정값)
  └─ dlvFare (택배운임, 계약 시 확정값)
```

---

## 전체 일과 플로우 (Happy Path)

```
[오전 — 자동]
pg_cron 10분 폴링
  └─ orders-sync: 4마켓 신규 주문 수집 → DB 저장
  └─ logen-register-shipment: 자동 실행
      └─ getSlipNo → slipNo 채번
      └─ registerOrderData → fixTakeNo 저장
      └─ orders.status = 'logen_registered'

[오전 — 판매자 액션 1번]
판매자: n47 접속
  └─ "운송장 출력" 클릭 (n52)
  └─ [출력 팝업 열기] → 프린터 출력 → 택배 부착
  └─ [출력 완료] 클릭 → status = 'waybill_printed'

[이후 — 자동 or 1클릭]
설정 "출력 후 자동 제출" ON
  └─ shipping-dispatch-job 자동 실행
  └─ 4마켓 동시 제출 → status = 'tracking_submitted'
  └─ 완료 (판매자 개입 없음)

또는 퇴근 전 1클릭
  └─ "송장 일괄 제출" 클릭 (n53) → n54 → n55
  └─ 30초 내 완료 → 퇴근
```

---

## 엣지 케이스

| 케이스 | 처리 |
|---|---|
| 로젠 `getSlipNo` 실패 | 재시도 3회 → `logen_failed` → n50 수동 운송장번호 입력 |
| 로젠 `registerOrderData` 실패 (부분) | 성공 건만 저장, 실패 건 재시도 → 최종 실패 시 n50 |
| 마켓 송장 API 실패 | 해당 마켓만 실패 표시 → n56 재시도 |
| 출력 완료 미확인 상태에서 제출 시도 | 경고 배너 표시 후 진행 가능 (강제 차단 아님) |
| 중복 제출 방지 | `status='tracking_submitted'` 주문 필터 제외 |
| 로젠 미연동 상태 | n58 유도 배너 (운송장번호 없으면 제출 불가) |
| `fareTy` / `dlvFare` 미설정 | n60 유도 → 발송인 정보 완성 필요 |
