# 물류 - 전세계배송 - 30kg초과 주문건 처리

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=69&apiSeq=1740&apiSpecType=1
> categoryNo: `69` · apiSeq: `1740` · 섹션: 전세계배송 > 배송
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

전세계배송주문의 30kg초과 주문건 처리를 진행합니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `https://api.11st.co.kr/rest/claimservice/gblordstockwght/[ordNo]/[ordPrdSeq]/[prdNo]` |
| Protocol | https |
| Version |  |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ordNo` | 주문순번 | string | Y |  | 201205230480005 |  |
| `ordPrdSeq` | 주문순번 | string | Y |  | 1 |  |
| `prdNo` | 상품번호 | string | Y |  | 5687941 |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:order` | ns2:order | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`gblStat` | 처리 상태 값 | enum | Y |  | 00 | (코드값: 00=미처리, 20=30kg초과반품, 21=30kg처리완료) |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordNo` | 주문번호 | string | Y |  | 201308190311783 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdSeq` | 주문순번 | string | Y |  | 1 |  |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_code` | 결과코드 | enum | Y |  | 0 | (코드값: 0=조회된 결과가 없습니다., -1=ex)ERROR : OpenAPI Key 에 해당하는 유저가 없습니다.<br>비지니스 Error. 예외적으로 발생되는 모든 에러. 메시지는 일정하지 않습니다., -10001=판매자 번호를 알 수 없습니다., -10002=주문 번호를 알 수 없습니다., -10003=주문 상세번호를 알 수 없습니다., -10004=올바른 판매자가 아닙니다., -10005=상품번호를 알 수 없습니다., -1000=서버 점검중입니다.<br>설명 - 매주 금요일 새벽은 정기점검일입니다. 서버 차단이 있을수 있습니다.) |
| &nbsp;&nbsp;`ns2:result_text` | 결과내용 | string | Y |  | 조회된 결과가 없습니다. |  |
