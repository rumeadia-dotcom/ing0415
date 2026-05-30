# Seller - 취소/반품/교환 - 교환 거부처리

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=49&apiSeq=1650&apiSpecType=1
> categoryNo: `49` · apiSeq: `1650` · 섹션: 취소교환반품 > 교환처리
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

구매자의 교환 요청을 거부 처리 합니다. 입력된 사유 내용은 고객에게 SMS, 이메일로 발송됩니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `http://api.11st.co.kr/rest/claimservice/exchangereqreject/[ordNo]/[ordPrdSeq]/[clmReqSeq]/[refsRsnCd]/[refsRsn]` |
| Protocol | http |
| Version |  |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ordNo` | 주문번호 | string | Y |  | 201001068151292 |  |
| `ordPrdSeq` | 주문순번 | string | Y |  | 1 |  |
| `clmReqSeq` | 클레임번호 | string | Y |  | 8191721 |  |
| `refsRsnCd` | 사유코드 | enum | Y |  | 204 | (코드값: 201=교환 상품 미입고, 202=고객 교환신청 철회 대행, 203=교환 불가 상품, 204=기타) |
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
| &nbsp;&nbsp;`result_code` | 결과코드 | enum | Y |  | -26005 | (코드값: -1=비지니스 Error, -26001=판매자 번호를 알 수 없습니다., -26002=주문번호를 알 수 없습니다., -26003=주문상세번호를 알 수 없습니다, -26004=클레임 번호를 알 수 없습니다., -26005=교환 정보를 찾을수 없습니다., -26006=교환신청 상태가 아니어서 교환접수거부를 할 수 없습니다., -26007=해외배송 상품은 교환접수거부를 할 수 없습니다., -1000=서버 점검중입니다.) |
| &nbsp;&nbsp;`result_text` | 결과내용 | string | Y |  | 교환 정보를 찾을수 없습니다. |  |
