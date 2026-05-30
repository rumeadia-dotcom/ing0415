# Seller - 상품 - 상품 가격 수정

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=81&apiSeq=1752&apiSpecType=1
> categoryNo: `81` · apiSeq: `1752` · 섹션: 상품 > 상품관리
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

상품 정보 중 가격정보만 수정할 경우 사용합니다.
11번가와 협의하여 11번가의 쿠폰 또는 서비스이용료 조정이 적용된 상품의 경우, 판매자 기본즉시할인이 적용된 가격이 상향 되면 조정된 내용이 강제로 종료 됩니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `http://api.11st.co.kr/rest/prodservices/product/price/[prdNo]/[selPrc]` |
| Protocol | http |
| Version | 1 |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `prdNo` | 상품번호 | string | Y |  | 113214968 | 수정할 상품번호 |
| `selPrc` | 상품가격 | string | Y |  | 22000 | 수정할 판매가격 |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ClientMessage` | ClientMessage | object | Y |  |  |  |
| &nbsp;&nbsp;`productNo` | 상품번호 | string | Y |  | 113214968 |  |
| &nbsp;&nbsp;`message` | 결과내용 | string | Y |  | (상품번호:113214968)의 가격이 업데이트 되었습니다. |  |
| &nbsp;&nbsp;`resultCode` | 결과코드 | enum | Y |  | 200 | (코드값: 200=비즈니스 성공) |
| &nbsp;&nbsp;`preSelPrc` | 수정 전 판매가 | string | Y |  | 4000 |  |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ClientMessage` | ClientMessage | object | Y |  |  |  |
| &nbsp;&nbsp;`productNo` | 상품번호 | string | Y |  | 113214968 |  |
| &nbsp;&nbsp;`message` | 에러내용 | string | Y |  | 상품번호:113214968)의 가격 업데이트 실패. MSG : OpenAPI Key 에 해당하는 유저가 없습니다. |  |
| &nbsp;&nbsp;`resultCode` | 에러코드 | enum | Y |  | 500 | (코드값: 500=비지니스 Error, -1000=서버 점검중입니다.) |
