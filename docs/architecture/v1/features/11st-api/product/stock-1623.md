# Seller - 상품 - 상품 재고정보 조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=40&apiSeq=1623&apiSpecType=1
> categoryNo: `40` · apiSeq: `1623` · 섹션: 상품 > 재고처리
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

11번가에 등록된 상품의 재고정보를 조회 합니다. 상품번호는 상품등록시 받으실 수 있습니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `http://api.11st.co.kr/rest/prodmarketservice/prodmarket/stck/[prdNo]` |
| Protocol | http |
| Version |  |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `prdNo` | 상품번호 | string | Y |  | 45597077 |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:ProductStocks` | ns2:ProductStocks | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:ProductStock` | ns2:ProductStock | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addPrc` | 옵션가격 | string | Y |  | 0 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`mixDtlOptNm` | 상세옵션명 | string | Y |  | 정품을 하나 더!!! 1+1 특급이벤트!<<001>> |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`mixOptNm` | 옵션명 | string | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`mixOptNo` | 옵션번호 | string | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNo` | 상품번호 | string | Y |  | 45597077 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdStckNo` | 재고번호 | string | Y |  | 440634790 | 재고번호로 재고수량 변경가능합니다.(추가구성상품에 대한 조회/변경은 API에서 지원하지 않습니다.) |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdStckStatCd` | 재고상태 | enum | Y |  | 01 | (코드값: 01=사용, 02=품절) |
| &nbsp;&nbsp;&nbsp;&nbsp;`selQty` | 판매수량 | string | Y |  | 39 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`stckQty` | 재고수량 | string | Y |  | 62 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`optWght` | 추가무게 | string | Y |  | 3 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerStockCd` | 셀러재고번호 | string | Y |  | CD01101 |  |
| &nbsp;&nbsp;`ns2:prdNm` | 상품이름 | string | Y |  | 싸이닉 정품을 하나 더!!! 1+1 특급이벤트! |  |
| &nbsp;&nbsp;`ns2:prdNo` | 상품번호 | string | Y |  | 45597077 |  |
| &nbsp;&nbsp;`ns2:sellerPrdCd` | 판매자상품코드 | string | Y |  | MYCODE758634 |  |
| &nbsp;&nbsp;`productComponents` | productComponents | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`productComponent` | productComponent | object[] | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`addCompPrc` | 추가 구성가격 | string | Y |  | 100 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`addPrdGrpNm` | 추가상품명 | string | Y |  | 추가 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`addPrdWght` | 추가 구성 무게 | string | Y |  | 10 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`addUseYn` | 상태 | string | Y |  | Y |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`compPrdNm` | 추가상품값 | string | Y |  | 추가구성상품 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`compPrdQty` | 판매수량 | string | Y |  | 5 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`sellerAddPrdCd` | 판매자추가상품번호 | string | Y |  | 93367282 |  |
