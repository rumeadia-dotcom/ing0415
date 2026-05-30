# Seller - 상품 - 상품 재고수량 변경처리

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=40&apiSeq=1625&apiSpecType=1
> categoryNo: `40` · apiSeq: `1625` · 섹션: 상품 > 재고처리
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

11번가에 등록된 상품의 재고수량을 수정합니다. 재고번호는 상품 재고정보 조회를 하시면 재고번호를 확인하실수 있습니다.

| 항목 | 값 |
|---|---|
| Method | `PUT` |
| URL | `http://api.11st.co.kr/rest/prodservices/stockqty/[prdStckNo]` |
| Protocol | http |
| Version | 1.2 |
| 요청 형식 | xml |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `prdStckNo` | 재고번호 | string | Y |  | 434450294 |  |

### Request Body

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ProductStock` | ProductStock | object | Y |  |  |  |
| &nbsp;&nbsp;`prdNo` | 상품번호 | string | Y |  | 47965658 |  |
| &nbsp;&nbsp;`prdStckNo` | 재고번호 | string | Y |  | 434450294 |  |
| &nbsp;&nbsp;`stckQty` | 재고수량 | string | Y |  | 99 |  |
| &nbsp;&nbsp;`optWght` | 상품무게 | string | Y |  | 2 |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ClientMessage` | ClientMessage | object | Y |  |  |  |
| &nbsp;&nbsp;`productNo` | 상품재고번호 | string | Y |  | 434450294 |  |
| &nbsp;&nbsp;`message` | 결과내용 | string | Y |  | 옵션재고 번호 434450294(상품번호:47965658)의 수량이 업데이트 되었습니다. 변경된 수량 : 99 |  |
| &nbsp;&nbsp;`resultCode` | 결과코드 | enum | Y |  | 200 | (코드값: 200=비지니스 성공) |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ClientMessage` | ClientMessage | object | Y |  |  |  |
| &nbsp;&nbsp;`productNo` | 상품재고번호 | string | Y |  | 434450294 |  |
| &nbsp;&nbsp;`message` | 에러내용 | string | Y |  | 옵션재고 번호 434450294(상품번호:47965658)의 수량 업데이트 실패. MSG : OpenAPI Key 에 해당하는 유저가 없습니다. |  |
| &nbsp;&nbsp;`resultCode` | 에러코드 | enum | Y |  | 500 | (코드값: 400=잘못된 요청입니다., 404=해당 상품/재고 번호 없음., 500=비지니스 Error, -1000=서버 점검중입니다.) |
