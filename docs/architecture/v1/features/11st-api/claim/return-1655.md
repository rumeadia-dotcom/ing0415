# Seller - 취소/반품/교환 - 반품완료보류 처리

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=50&apiSeq=1655&apiSpecType=1
> categoryNo: `50` · apiSeq: `1655` · 섹션: 취소교환반품 > 반품처리
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

반품보류 상태에서 더이상 구매자와의 협의가 어려울 경우 [반품완료보류] 버튼을 누르시면 됩니다.
조회된 그리드 내에서 반품완료예정일 확인이 가능하여 예정일 이전에 처리하시면 자동으로 반품완료처리되지 않습니다.
단, 반품완료보류 처리 후 반품완료가 장기간 미처리시 강제 환불 처리될 수 있습니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `http://api.11st.co.kr/rest/claimservice/returncompletedefer/[ordNo]/[ordPrdSeq]/[clmReqSeq]/[deferRefsRsnCd]/[deferRefsRsn]` |
| Protocol | http |
| Version |  |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ordNo` | 주문번호 | string | Y |  | 201001068151292 |  |
| `ordPrdSeq` | 주문순번 | string | Y |  | 1 |  |
| `clmReqSeq` | 클레임번호 | string | Y |  | 8191721 | 반품신청번호 |
| `deferRefsRsnCd` | 보류사유코드 | enum | Y |  | 101 | (코드값: 101=반품 상품 미입고, 102=반품 배송비 미동봉, 103=반품 상품 훼손, 104=구매자 연락 두절, 105=기타) |
| `ordCnDtlsRsn` | 사유 | string | Y |  | %EC%82%AC%EC%9C%A0 | 한글 입력일 경우 url 인코딩을 해주세요. |

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
| &nbsp;&nbsp;`result_code` | 결과코드 | enum | Y |  | -21008 | (코드값: -1=ex)ERROR : OpenAPI Key 에 해당하는 유저가 없습니다.<br>비지니스 Error. 예외적으로 발생되는 모든 에러. 메시지는 일정하지 않습니다., -21001=판매자 번호를 알 수 없습니다., -21002=주문 번호를 알 수 없습니다., -21003=주문순번을 알 수 없습니다., -21004=클레임 신청번호를 알 수 없습니다., -21005=보류사유 코드를 알 수 없습니다., -21006=보류 상세 사유를 알 수 없습니다., -21007=반품보류 신청할수 있는 목록이 없습니다., -21008=반품보류 처리중 에러가 발생 했습니다., -21009=반품보류 처리는 되었으나 반품완료보류 처리중 에러가 발생 했습니다., -21010=해외배송 상품은 반품보류 할 수 없습니다., -1000=서버 점검중입니다.<br>설명 - 매주 금요일 새벽은 정기점검일입니다. 서버 차단이 있을수 있습니다.) |
| &nbsp;&nbsp;`result_text` | 결과내용 | string | Y |  | 반품보류 처리중 에러가 발생 했습니다. |  |
