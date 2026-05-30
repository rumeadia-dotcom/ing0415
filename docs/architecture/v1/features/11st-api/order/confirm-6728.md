# 발송지연안내 처리

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=111&apiSeq=6728&apiSpecType=1
> categoryNo: `111` · apiSeq: `6728` · 섹션: 주문 > 발주처리
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

발송지연안내는 결제완료, 배송준비중 상태일때만 발송 가능합니다.
발송지연 안내시 구매자에게 Email과 SMS로 안내가 됩니다.
예상발송일까지 발송지연에 따른 페널티는 부과되지 않습니다.
단, 예상발송일을 경과하게 되면 페널티가 부과될 수 있습니다.

| 항목 | 값 |
|---|---|
| Method | `POST` |
| URL | `https://api.11st.co.kr/rest/ordservices/deliveryDelayGuide` |
| Protocol | https |
| Version | 1.0 |
| 요청 형식 | xml |
| 응답 형식 | xml |

## Request

### Request Body

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `DeliveryDelayGuideRequest` |  | object | Y |  |  | DeliveryDelayGuideRequest |
| &nbsp;&nbsp;`ordNo` |  | string | Y |  |  | 주문번호 |
| &nbsp;&nbsp;`dlvNo` |  | string | Y |  |  | 배송번호 |
| &nbsp;&nbsp;`delaySendDt` |  | string | Y |  |  | 예상발송일 |
| &nbsp;&nbsp;`delaySendRsnCd` |  | enum | Y |  |  | 발송지연사유 (코드값: 01=단기 재고 부족, 02=주문폭주로 인한 작업지연, 03=주문제작 시간이 필요, 04=고객 요청, 05=기타) |
| &nbsp;&nbsp;`delaySendRsn` |  | string | Y |  |  | 상세사유 |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ResultOrder` |  | object | Y |  |  | ResultOrder |
| &nbsp;&nbsp;`openMallID` |  | string | Y |  | 11ST | 11번가 시스템 코드 무시 하셔도 됩니다. |
| &nbsp;&nbsp;`open_11st_mall` |  | string | Y |  |  | 11번가 시스템 코드 무시 하셔도 됩니다. |
| &nbsp;&nbsp;`open_done_payment_interface` |  | string | Y |  |  | 11번가 시스템 코드 무시 하셔도 됩니다. |
| &nbsp;&nbsp;`result_code` |  | enum | Y |  | 0 | 결과코드 (코드값: 0=성공, -1=ex)ERROR : OpenAPI Key 에 해당하는 유저가 없습니다. 비지니스 Error. 예외적으로 발생되는 모든 에러. 메시지는 일정하지 않습니다., -28001=판매자 번호를 알 수 없습니다., -28301=주문번호가 올바르지 않습니다., -28302=배송번호가 올바르지 않습니다., -28303=예약발송일 값이 올바르지 않습니다 ., -28304=발송지연사유 값이 올바르지 않습니다., -28305=상세사유 값이 올바르지 않습니다., -28306=예약발송일은 최대 D+30일까지 가능합니다., -28307=상세사유 값은 20~300Byte 사이로 입력해 주세요., -28311=발송지연 요청 조건에 만족하지 않습니다. 요청 조건을 확인해 주세요.) |
| &nbsp;&nbsp;`result_text` |  | string | Y |  | 전체 2 건이 발송지연 처리 되었습니다. | 결과내용 |
