# Seller - 상품 - 상품 전시중지해제 처리

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=42&apiSeq=1632&apiSpecType=1
> categoryNo: `42` · apiSeq: `1632` · 섹션: 상품 > 판매중지
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

전시가 중지된 상품을 다시 전시합니다.

| 항목 | 값 |
|---|---|
| Method | `PUT` |
| URL | `http://api.11st.co.kr/rest/prodstatservice/stat/restartdisplay/[prdNo]` |
| Protocol | http |
| Version | 1.0 |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `prdNo` | 상품번호 | string | Y |  | 563667789 |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ClientMessage` | ClientMessage | object | Y |  |  |  |
| &nbsp;&nbsp;`message` | 결과 내용 | enum | Y |  | 판매상태가 수정되었습니다. [STAT : 103] | (코드값: 101=승인대기, 102=승인전, 103=판매중, 104=품절, 105=전시중지, 106=판매정상종료, 107=판매강제종료, 108=판매금지) |
| &nbsp;&nbsp;`resultCode` | 결과코드 | enum | Y |  | 200 | (코드값: 200=성공) |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ClientMessage` | ClientMessage | object | Y |  |  |  |
| &nbsp;&nbsp;`message` | 결과 내용 | string | Y |  | 해당 상품의 정보를 찾을 수 없습니다. 상품번호 : 41601523 |  |
| &nbsp;&nbsp;`resultCode` | 결과코드 | enum | Y |  | 500 | (코드값: 500=비지니스 Error, -1000=서버 점검중입니다.) |
