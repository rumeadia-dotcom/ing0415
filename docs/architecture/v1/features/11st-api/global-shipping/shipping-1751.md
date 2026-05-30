# 물류 - 전세계배송 - 해외송장 정보 업데이트

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=69&apiSeq=1751&apiSpecType=1
> categoryNo: `69` · apiSeq: `1751` · 섹션: 전세계배송 > 배송
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

전세계배송주문의 해외송장 정보를 업데이트 합니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `https://api.11st.co.kr/rest/ordservices/reqgbldlvinvc/[ordNo]/[etprsCd]/[invcNo]` |
| Protocol | https |
| Version |  |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ordNo` | 주문번호 | string | Y |  | 201308190311783 |  |
| `etprsCd` | 특송사코드 | string | Y |  | 101 |  |
| `invcNo` | 송장번호 | string | Y |  | EM129733376KR |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ResultOrder` | ResultOrder | object | Y |  |  |  |
| &nbsp;&nbsp;`openMallID` | 11번가 시스템 코드 | string | Y |  | 11ST | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`open_11st_mall` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`open_done_payment_interface` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`result_code` | 결과코드 | enum | Y |  | 0 | (코드값: 0=성공, -3311= 해외송장번호 업데이트 처리중 에러가 발생했습니다. 관리자에게 문의해주세요., -3202=파라메타 정보가 올바르지 않습니다., -3315=특송사 송장번호 입력실패, -3312= 특송사 송장번호 입력 데이터가 없습니다., -1000=서버 점검중입니다.<br>설명 - 매주 금요일 새벽은 정기점검일입니다. 서버 차단이 있을수 있습니다.) |
| &nbsp;&nbsp;`result_text` | 결과내용 | string | Y |  | 전체 1건이 정상적으로 처리 되었습니다. |  |
