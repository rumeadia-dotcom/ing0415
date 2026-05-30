# 물류 - 전세계배송 - 입고시 오프라인 보류처리

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=69&apiSeq=1738&apiSpecType=1
> categoryNo: `69` · apiSeq: `1738` · 섹션: 전세계배송 > 배송
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

전세계배송주문의 입고시 오프라인 보류처리를 진행합니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `https://api.11st.co.kr/rest/claimservice/gblofflinehold/[ordNo]/[ordPrdSeq]/[holdRsnNm]` |
| Protocol | https |
| Version |  |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ordNo` | 주문순번 | string | Y |  | 201206010495577 |  |
| `ordPrdSeq` | 주문순번 | string | Y |  | 1 |  |
| `holdRsnNm` | 보류사유 | string | Y |  | 보류사유입력 |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ResultOrder` | ResultOrder | object | Y |  |  |  |
| &nbsp;&nbsp;`openMallID` | 11번가 시스템 코드 | string | Y |  | 11ST | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`open_11st_mall` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`open_done_payment_interface` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`result_code` | 결과코드 | enum | Y |  | 0 | (코드값: 0=성공, -10001=판매자 번호를 알 수 없습니다., -10002=주문 번호를 알 수 없습니다., -10003=주문 상세번호를 알 수 없습니다., -10005=보류사유를 알 수 없습니다., -1=ex)ERROR : OpenAPI Key 에 해당하는 유저가 없습니다.<br>비지니스 Error. 예외적으로 발생되는 모든 에러. 메시지는 일정하지 않습니다., -1000=서버 점검중입니다.<br>설명 - 매주 금요일 새벽은 정기점검일입니다. 서버 차단이 있을수 있습니다.) |
| &nbsp;&nbsp;`result_text` | 결과내용 | string | Y |  | 성공 |  |
