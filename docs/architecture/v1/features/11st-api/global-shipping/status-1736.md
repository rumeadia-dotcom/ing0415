# 물류 - 전세계배송 - 30kg 초과 주문건 무게 업데이트

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=68&apiSeq=1736&apiSpecType=1
> categoryNo: `68` · apiSeq: `1736` · 섹션: 전세계배송 > 상태처리
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

전세계배송주문의 30kg초과시 무게를 업데이트합니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `https://api.11st.co.kr/rest/claimservice/gblstockwght/[ordNo]/[ordPrdSeq]/[totalOptWght]/[updateDt]` |
| Protocol | https |
| Version |  |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ordNo` | 주문번호 | string | Y |  | 201308190311783 |  |
| `ordPrdSeq` | 주문상품순번 | string | Y |  | 1 |  |
| `totalOptWght` | 주문순번의 합무게 | string | Y |  | 8500 |  |
| `updateDt` | 무게 측정 시간 | string | Y |  | 20130813225959 |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ResultOrder` | ResultOrder | object | Y |  |  |  |
| &nbsp;&nbsp;`openMallID` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`open_11st_mall` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`open_done_payment_interface` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`result_code` | 결과코드 | enum | Y |  |  | (코드값: 0=성공, -10001= 판매자 번호를 알 수 없습니다., -10002=주문 번호를 알 수 없습니다., -10004=올바른 판매자가 아닙니다., -10005=주문순번의 합무게를 알 수 없습니다, -1000=서버 점검중입니다.<br>설명 - 매주 금요일 새벽은 정기점검일입니다. 서버 차단이 있을수 있습니다.) |
| &nbsp;&nbsp;`result_text` | 결과내용 | string | Y |  | 전체 1건이정상적으로 처리 되었습니다. |  |
