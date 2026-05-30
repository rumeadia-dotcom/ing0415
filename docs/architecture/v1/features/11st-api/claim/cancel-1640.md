# Seller - 취소/반품/교환 - 주문취소 승인처리

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=48&apiSeq=1640&apiSpecType=1
> categoryNo: `48` · apiSeq: `1640` · 섹션: 취소교환반품 > 취소처리
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

구매자의 주문 취소 요청을 승인 처리 합니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `http://api.11st.co.kr/rest/claimservice/cancelreqconf/[ordPrdCnSeq]/[ordNo]/[ordPrdSeq]` |
| Protocol | http |
| Version |  |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ordPrdCnSeq` | 클레임번호 | string | Y |  | 8191721 |  |
| `ordNo` | 주문번호 | string | Y |  | 201001138151745 |  |
| `ordPrdSeq` | 주문순번 | string | Y |  | 1 |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ResultOrder` | ResultOrder | object | Y |  |  |  |
| &nbsp;&nbsp;`openMallID` | 11번가 시스템 코드 | string | Y |  | 11ST | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`open_11st_mall` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`open_done_payment_interface` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`result_code` | 결과코드 | enum | Y |  | 0 | (코드값: 0=성공) |
| &nbsp;&nbsp;`result_text` | 결과내용 | string | Y |  | 전체 1건이 정상적으로 취소처리가 되었습니다. |  |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ResultOrder` | ResultOrder | object | Y |  |  |  |
| &nbsp;&nbsp;`openMallID` | 11번가 시스템 코드 | string | Y |  | 11ST | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`open_11st_mall` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`open_done_payment_interface` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`result_code` | 결과코드 | enum | Y |  | -1 | (코드값: -1=비지니스 Error, -22001=판매자 번호를 알 수 없습니다., -22002=주문 번호를 알 수 없습니다., -22003=주문 상세번호를 알 수 없습니다., -22004=주문취소 상세번호를 알 수 없습니다, -1000=서버 점검중입니다.) |
| &nbsp;&nbsp;`result_text` | 결과내용 | string | Y |  | 이미 취소 완료된 신청건 입니다. |  |
