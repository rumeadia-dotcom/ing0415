# Seller - 취소/반품/교환 - 반품 승인처리

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=65&apiSeq=1644&apiSpecType=1
> categoryNo: `65` · apiSeq: `1644` · 섹션: 해외물류 > 취소교환반품
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

구매자의 반품 요청을 승인 처리 합니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `http://api.11st.co.kr/rest/claimservice/returnreqconf/[clmReqSeq]/[ordNo]/[ordPrdSeq]` |
| Protocol | http |
| Version |  |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ordPrdCnSeq` | 클레임번호 | string | Y |  | 2400330 |  |
| `ordNo` | 주문번호 | string | Y |  | 201001068151292 |  |
| `ordPrdSeq` | 주문순번 | string | Y |  | 1 |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ResultOrder` | ResultOrder | object | Y |  |  |  |
| &nbsp;&nbsp;`openMallID` | 11번가 시스템 코드 | string | Y |  | 11ST | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`open_11st_mall` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`open_done_payment_interface` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`result_code` | 결과코드 | enum | Y |  | 0 | (코드값: 0=성공) |
| &nbsp;&nbsp;`result_text` | 결과내용 | string | Y |  |  |  |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ResultOrder` | ResultOrder | object | Y |  |  |  |
| &nbsp;&nbsp;`openMallID` | 11번가 시스템 코드 | string | Y |  | 11ST | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`open_11st_mall` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`open_done_payment_interface` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`result_code` | 결과코드 | enum | Y |  | -1 | (코드값: -1=비지니스 Error, -24001=판매자 번호를 알 수 없습니다., -24002=주문번호를 알 수 없습니다., -24003=주문상세번호를 알 수 없습니다., -24004=클레임 번호를 알 수 없습니다., -24005=반품 정보를 찾을수 없습니다., -24006=반품 신청또는 접수 상태가 아니어서 반품을 완료 할 수 없습니다., -24007=반품 신청또는 접수 상태가 아니어서 반품을 완료 할 수 없습니다., -24008=해외배송 상품은 반품사유가 구매자 귀책인 경우 통합아이디로 반품 완료 할 수 없습니다., -24009=해외배송 상품은 반품사유가 판매자 귀책인 경우 통합아이디로만 반품 완료 할 수 있습니다., -1000=서버 점검중입니다.) |
| &nbsp;&nbsp;`result_text` | 결과내용 | string | Y |  | ERROR : OpenAPI Key 에 해당하는 유저가 없습니다. |  |
