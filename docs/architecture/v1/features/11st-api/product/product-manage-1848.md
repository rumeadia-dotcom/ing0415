# Seller - 상품 - 상품판매기간조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=81&apiSeq=1848&apiSpecType=1
> categoryNo: `81` · apiSeq: `1848` · 섹션: 상품 > 상품관리
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

상품의 판매기간을 조회할 경우 사용합니다.
조회일 기준 오늘 이후로 조회 가능하며 조회기간은 최대 7일(1주일) 입니다.
데이터 양이 많을 경우 출력 오류가 발생할 수 있으므로 limit는 가능한 작게 요청하시기 바랍니다.

| 항목 | 값 |
|---|---|
| Method | `POST` |
| URL | `http://api.11st.co.kr/rest/prodservices/sellterm/` |
| Protocol | http |
| Version |  |
| 요청 형식 | xml |
| 응답 형식 | xml |

## Request

### Request Body

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `SearchProduct` | SearchProduct | object | Y |  |  |  |
| &nbsp;&nbsp;`schBgnDt` | 검색시작일 | string | Y |  | 201302010000 | yyyyMMddHHmm. 날짜포맷: 년(4) 월(2) 일(2) 시(2) 분(2) |
| &nbsp;&nbsp;`schEndDt` | 검색종료일 | string | Y |  | 201302050000 | yyyyMMddHHmm. 날짜포맷: 년(4) 월(2) 일(2) 시(2) 분(2) |
| &nbsp;&nbsp;`limit` | 목록갯수 | string |  |  |  | 데이터의 양이 많은 경우 출력하지 못할 수도 있습니다. |
| &nbsp;&nbsp;`start` | 검색된 목록의 가져올 시작 순번 | string |  |  |  |  |
| &nbsp;&nbsp;`end` | 검색된 목록의 가져올 마지막 순번 | string |  |  |  |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `products` | products | object | Y |  |  |  |
| &nbsp;&nbsp;`message` | 결과내용 | string | Y |  | 성공적으로 조회 되었습니다. |  |
| &nbsp;&nbsp;`product` | product | object[] | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNo` | 상품번호 | string | Y |  | 48190488 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`aplBgnDy` | 판매시작일 | string | Y |  | 2013-02-01 00:00:00 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`aplEndDy` | 판매종료일 | string | Y |  | 2013-02-05 23:59:59 |  |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `products` | products | object | Y |  |  |  |
| &nbsp;&nbsp;`message` | 결과내용 | string | Y |  | 검색시작일은 오늘 날짜부터 가능합니다. |  |
