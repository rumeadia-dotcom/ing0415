# 물류 - 전세계배송 - 해외배송상태 배송완료처리

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=69&apiSeq=1831&apiSpecType=1
> categoryNo: `69` · apiSeq: `1831` · 섹션: 전세계배송 > 배송
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

전세계배송의 해외배송상태 배송완료처리를 진행합니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `https://api.11st.co.kr/rest/ordservices/reqgbldlvend/[ord_no]/[abrdOrdPrdStat]` |
| Protocol | https |
| Version |  |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ord_no` | 주문번호 | string | Y |  | 200712290100275 |  |
| `abrdOrdPrdStat` | 해외배송상태 | string | Y |  | 427 |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ResultOrder` | ResultOrder | object | Y |  |  |  |
| &nbsp;&nbsp;`result_code` | 결과코드 | enum | Y |  | 0 | (코드값: 0=성공, -3310=해당 배송번호의 주문상태를 확인해 주세요, -3311=해외배송상태처리중 에러가 발생했습니다. 관리자에게 문의해주세요., -3313=판매자 번호를 알 수 없습니다., -1=ex)ERROR : OpenAPI Key 에 해당하는 유저가 없습니다.<br>비지니스 Error. 예외적으로 발생되는 모든 에러. 메시지는 일정하지 않습니다., -1000=서버 점검중입니다.<br>설명 - 매주 금요일 새벽은 정기점검일입니다. 서버 차단이 있을수 있습니다.) |
| &nbsp;&nbsp;`result_text` | 결과내용 | string | Y |  | 성공 |  |
