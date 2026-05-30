# Seller - 상품 - 상품판매기간연장

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=81&apiSeq=1856&apiSpecType=1
> categoryNo: `81` · apiSeq: `1856` · 섹션: 상품 > 상품관리
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

고정가판매와 중고판매 상품의 판매기간을 수정할 경우 사용합니다.
기존에 등록된 상품 위에 수정된 데이터를 덮어쓰는 형태이므로, 기존의 데이터는 사라지고 수정되는 정보로 교체됩니다.

| 항목 | 값 |
|---|---|
| Method | `PUT` |
| URL | `http://api.11st.co.kr/rest/prodservices/sellterm/[prdNo]/[selPrdClfCd]` |
| Protocol | http |
| Version | 1.1 |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `prdNo` | 상품번호 | string | Y |  | 113214968 |  |
| `selPrdClfCd` | 판매기간 일자 | enum | Y |  | 0 | 최대 3년까지 등록 가능 (코드값: 0=설정안함, 3=3일, 5=5일, 7=7일, 15=15일, 30=30일(1개월), 60=60일(2개월), 90=90일(3개월), 120=120일(4개월)) |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ClientMessage` | ClientMessage | object | Y |  |  |  |
| &nbsp;&nbsp;`productNo` | 상품번호 | string | Y |  | 113214968 |  |
| &nbsp;&nbsp;`message` | 결과내용 | string | Y |  | 판매기간이 연장되었습니다. |  |
| &nbsp;&nbsp;`resultCode` | 결과코드 | enum | Y |  | 200 | (코드값: 200=비즈니스 성공) |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ClientMessage` | ClientMessage | object | Y |  |  |  |
| &nbsp;&nbsp;`productNo` | 상품번호 | string | Y |  | 113214968 |  |
| &nbsp;&nbsp;`message` | 에러내용 | string | Y |  | 판매자의 상품이 아닙니다. |  |
| &nbsp;&nbsp;`resultCode` | 에러코드 | enum | Y |  | 500 | (코드값: 500=비지니스 Error, -1000=서버 점검중입니다.) |
