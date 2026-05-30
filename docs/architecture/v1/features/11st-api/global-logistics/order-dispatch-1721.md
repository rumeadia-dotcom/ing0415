# 물류 - 해외물류 - 해외현지 內 발송처리

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=64&apiSeq=1721&apiSpecType=1
> categoryNo: `64` · apiSeq: `1721` · 섹션: 해외물류 > 발주발송
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

발송처리할 내역에서 읽어온 주문 중 배송주체가 "11번가해외배송"인 것에 대하여 해외현지 內 발송처리 할 수 있습니다.
발주확인 처리를 한 이후에 해당 API를 이용하셔야 합니다.
배송주체가 "11번가해외배송"인 주문만 해당 API를 이용하셔야 합니다.
통합입고코드, 달러금액, 해외쇼핑몰ID, 해외입고유형 등 상품의 해외배송정보를 입력하셔야 합니다.
해당 API는 KGL(해외배송)용이 아니라 판매업체가 사용하시는 API입니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `https://api.11st.co.kr/rest/ordservices/reqabrdIndelv/[dlvNo]/[ordNo]/[ordPrdSeq]/[abrdInCd]/[combineStckCd]/[dollarAmt]/[abrdShopId]` |
| Protocol | https |
| Version |  |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `sendDt` | 배송번호 | string | Y |  | 20810153 |  |
| `ordNo` | 주문번호 | string | Y |  | 201102170100255 |  |
| `ordPrdSeq` | 주문상품순번 | string | Y |  | 1 |  |
| `abrdInCd` | 해외입고유형 | enum | Y |  | 01 | (코드값: 01=무료픽업, 02=판매자발송, 03=구매대행) |
| `combineStckCd` | 통합입고코드 | string | Y |  | combineStckCd01 |  |
| `dollarAmt` | 달러금액 | string | Y |  | 100 | 달러금액은 숫자로만 입력하셔야 합니다. |
| `abrdShopId` | 해외쇼핑몰 | string | Y |  | nikewest | 해외입고유형이 03 : 구매대행 일경우 필수, 다른 경우에는 옵션 |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ResultOrder` | ResultOrder | object | Y |  |  |  |
| &nbsp;&nbsp;`openMallID` | 11번가 시스템 코드 | string | Y |  | 11ST | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`open_11st_mall` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`open_done_payment_interface` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`result_code` | 결과코드 | enum | Y |  | 0 | (코드값: 0=성공, -1=ex)ERROR : OpenAPI Key 에 해당하는 유저가 없습니다.<br>비지니스 Error. 예외적으로 발생되는 모든 에러. 메시지는 일정하지 않습니다., -3308=해당 배송번호는 이미 해외현지 내 발송처리 되었습니다., -3310=해당 배송번호의 주문상태를 확인해 주세요<br>설명 - 요청하신 배송번호의 주문상태가 취소신청 되었을 가능성이 가장 큽니다. 해당 배송번호의 주문번호로 취소신청된 내역을 요청하셔서 비교해 보시고, 취소신청된 내역이 존재하지 않고 배송준비중 내역에 있다면 관리자에게 문의 주세요, -3311=해외현지 내 발송처리중 에러가 발생했습니다. 관리자에게 문의해주세요., -1000=서버 점검중입니다.<br>설명 - 매주 금요일 새벽은 정기점검일입니다. 서버 차단이 있을수 있습니다.) |
| &nbsp;&nbsp;`result_text` | 결과내용 | string | Y |  | 전체 1건이 정상적으로 발주처리가 되었습니다. |  |
