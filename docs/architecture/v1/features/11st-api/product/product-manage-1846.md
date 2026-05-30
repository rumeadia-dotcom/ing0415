# Seller - 상품 - 상품상세 설명 조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=81&apiSeq=1846&apiSpecType=1
> categoryNo: `81` · apiSeq: `1846` · 섹션: 상품 > 상품관리
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

상품상세 설명을 조회할 수 있습니다.
Seller Office에서 등록 및 수정이 가능합니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `http://api.11st.co.kr/rest/prodservices/getProductDetailCont/[prdNo]` |
| Protocol | http |
| Version |  |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `prdNo` | 상품번호 | string | Y |  | 113214968 |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ProductDetailCont` | ProductDetailCont | object | Y |  |  |  |
| &nbsp;&nbsp;`prdDescContClob` | 상품상세 컨텐츠 | string | Y |  | 컨텐츠 수정 |  |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `Products` | Products | object | Y |  |  |  |
| &nbsp;&nbsp;`message` | 결과내용 | string | Y |  | OpenAPI Key 에 해당하는 유저가 없습니다. |  |
