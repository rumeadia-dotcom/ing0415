# Seller - 취소/반품/교환 - 반품 거부처리

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=65&apiSeq=1645&apiSpecType=1
> categoryNo: `65` · apiSeq: `1645` · 섹션: 해외물류 > 취소교환반품
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

구매자의 반품 요청을 거부 처리 합니다. 입력된 사유 내용은 고객에게 SMS, 이메일로 발송됩니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `http://api.11st.co.kr/rest/claimservice/returnreqreject/[ordNo]/[ordPrdSeq]/[clmReqSeq]/[refsRsnCd]/[refsRsn]` |
| Protocol | http |
| Version |  |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ordNo` | 주문번호 | string | Y |  | 201001068151292 |  |
| `ordPrdSeq` | 주문순번 | string | Y |  | 1 |  |
| `ordPrdCnSeq` | 클레임번호 | string | Y |  | 2400330 |  |
| `refsRsnCd` | 사유코드 | enum | Y |  | 103 | (코드값: 101=반품 상품 미입고, 102=고객 반품신청 철회 대행, 103=반품 불가 상품, 104=기타) |
| `refsRsn` | 사유 | string | Y |  | refsRsn |  |

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
| &nbsp;&nbsp;`result_code` | 결과코드 | enum | Y |  | -1 | (코드값: -1=비지니스 Error, -25001=판매자 번호를 알 수 없습니다., -25002=주문번호를 알 수 없습니다., -25003=주문상세번호를 알 수 없습니다., -25004=클레임 번호를 알 수 없습니다., -25005=반품 정보를 찾을수 없습니다., -25006=해외배송 상품은 반품사유가 구매자 귀책인 경우 통합아이디로 반품 완료 할 수 없습니다., -25007=해외배송 상품은 반품사유가 판매자 귀책인 경우 통합아이디로만 반품 완료 할 수 있습니다., -1000=서버 점검중입니다.) |
| &nbsp;&nbsp;`result_text` | 결과내용 | string | Y |  | 반품 신청상태가 아니어서 반품거부를 할 수 없습니다. |  |
