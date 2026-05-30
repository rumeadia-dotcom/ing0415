# 물류 - 해외물류 - 해외배송상태처리

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=64&apiSeq=1720&apiSpecType=1
> categoryNo: `64` · apiSeq: `1720` · 섹션: 해외물류 > 발주발송
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

주문번호 및 순번 단위로 해외배송상태처리 할 수 있습니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `https://api.11st.co.kr/rest/ordservices/reqordstat/[ordNo]/[ordPrdSeq]/[dlvNo]/[abrdOrdPrdStat]` |
| Protocol | https |
| Version |  |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ordNo` | 주문번호 | string | Y |  | 201001090000 |  |
| `ordPrdSeq` | 주문순번 | string | Y |  | 1 |  |
| `dlvNo` | 배송번호 | string | Y |  | 40860365 |  |
| `abrdOrdPrdStat` | 해외배송상태 | enum | Y |  | 310 | (코드값: 310=재고확인중 (해당 status는 넘기지 마세요. 넘기면 오류), 311=해외현지운송중 (해당 status는 넘기지 마세요. 넘기면 오류), 312=현지물류센터입고, 410=국제배송중, 411=수입통관중, 412=국내배송중) |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ResultOrder` | ResultOrder | object | Y |  |  |  |
| &nbsp;&nbsp;`openMallID` | 11번가 시스템 코드 | string | Y |  | 11ST | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`open_11st_mall` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`open_done_payment_interface` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`result_code` | 결과코드 | enum | Y |  | 0 | (코드값: 0=성공, -1=ex)ERROR : OpenAPI Key 에 해당하는 유저가 없습니다.<br>비지니스 Error. 예외적으로 발생되는 모든 에러. 메시지는 일정하지 않습니다., -3310=해당 배송번호의 주문상태를 확인해 주세요<br>설명 - 요청하신 배송번호의 주문상태가 취소신청 되었을 가능성이 가장 큽니다. 해당 배송번호의 주문번호로 취소신청된 내역을 요청하셔서 비교해 보시고, 취소신청된 내역이 존재하지 않고 배송준비중 내역에 있다면 관리자에게 문의 주세요, -3311=해외배송상태처리중 에러가 발생했습니다. 관리자에게 문의해주세요.<br>설명 - 시스템 장애 입니다. 우선 배송준비중을 한번 더 조회해 보시고 해당 주문건이 노출되는지 확인 하신 후 한번 더 해외배송상태처리로 처리 하신 후 같은 에러가 발생하면 관리자에게 문의 주세요., -1000=서버 점검중입니다.<br>설명 - 매주 금요일 새벽은 정기점검일입니다. 서버 차단이 있을수 있습니다.) |
| &nbsp;&nbsp;`result_text` | 결과내용 | string | Y |  | 전체 1건이 정상적으로 처리 되었습니다. |  |
