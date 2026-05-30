# Seller - 상품 - 추가구성상품 수정

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=81&apiSeq=1849&apiSpecType=1
> categoryNo: `81` · apiSeq: `1849` · 섹션: 상품 > 상품관리
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

추가구성상품을 수정할 수 있습니다.
Seller Office에서 등록 및 수정이 가능합니다.

| 항목 | 값 |
|---|---|
| Method | `POST` |
| URL | `http://api.11st.co.kr/rest/prodservices/updateProductComponent/[prdNo]` |
| Protocol | http |
| Version |  |
| 요청 형식 | xml |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `prdNo` | 상품번호 | string | Y |  | 113214968 |  |

### Request Body

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `Product` | Product | object | Y |  |  |  |
| &nbsp;&nbsp;`ProductComponent` | ProductComponent | object[] | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addCompPrc` | 추가 구성가격 | string | Y |  | 100 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addPrdGrpNm` | 추가상품명 | string | Y |  | 추가1 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addPrdWght` | 추가 구성 무게 | string | Y |  | 10 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addUseYn` | 상태 | string | Y |  | Y |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`compPrdNm` | 추가상품값 | string | Y |  | 추가구성상품01 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`compPrdQty` | 판매수량 | string | Y |  | 5 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`compPrdVatCd` | 상품번호 | string | Y |  | 01 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerAddPrdCd` | 판매자추가상품번호 | string | Y |  | 93367282 |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `Product` | Product | object | Y |  |  |  |
| &nbsp;&nbsp;`message` |  | string | Y |  | 추가 구성 상품 내용이 수정되었습니다. |  |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `Products` | Products | object | Y |  |  |  |
| &nbsp;&nbsp;`message` | 결과내용 | string | Y |  | OpenAPI Key 에 해당하는 유저가 없습니다. |  |
