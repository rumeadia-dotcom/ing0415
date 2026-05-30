# Seller - 상품 - 다중 상품 재고 정보 조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=40&apiSeq=1009&apiSpecType=1
> categoryNo: `40` · apiSeq: `1009` · 섹션: 상품 > 재고처리
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

11번가에 등록된 다중상품의 재고정보를 조회 합니다. 상품번호는 상품등록시 받으실 수 있습니다.
많은 상품을 조회 할경우 응답시간이 느릴수 있습니다.

| 항목 | 값 |
|---|---|
| Method | `POST` |
| URL | `http://api.11st.co.kr/rest/prodmarketservice/prodmarket/stocks` |
| Protocol | http |
| Version | 1.0 |
| 요청 형식 | xml |
| 응답 형식 | xml |

## Request

### Request Body

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ProductStocks` | ProductStocks | object | Y |  |  |  |
| &nbsp;&nbsp;`ProductStock` | ProductStock | object[] | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNo` | 상품번호 | string | Y |  | 47965651 | 재고정보를 조회할 상품번호를 입력한다. |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:ProductStocks` | ns2:ProductStocks | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:message` | 결과내용 | string | Y |  | 2 건을 조회했습니다. |  |
| &nbsp;&nbsp;`ns2:ProductStocks` | 상품번호별 재고집합 | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ns2:prdNm` | 상품이름 | string | Y |  | 기본 스타일 심플 브이넥 티(VT25614) |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ns2:prdNo` | 상품번호 | string | Y |  | 1847999 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ns2:sellerPrdCd` | 판매자상품코드 | string | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ns2:ProductStock` | 옵션별 재고번호 집합 | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`addPrc` | 옵션가격 | string | Y |  | 0 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`mixDtlOptNm` | 상세옵션명 | string | Y |  | one,와인 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`mixOptNm` | 옵션명 | string | Y |  | 사이즈,색상 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`mixOptNo` | 옵션번호 | string | Y |  | 1,2 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`prdNo` | 상품번호 | string | Y |  | 1847999 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`prdStckNo` | 재고번호 | string | Y |  | 9053248 | 재고번호로 재고수량 변경가능합니다.(추가구성상품에 대한 조회/변경은 API에서 지원하지 않습니다.) |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`prdStckStatCd` | 재고상태 | enum | Y |  | 01 | (코드값: 01=사용, 02=품절) |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`selQty` | 판매수량 | string | Y |  | 0 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`stckQty` | 재고수량 | string | Y |  | 500 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`optWght` | 추가무게 | string | Y |  | 11 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`sellerStockCd` | 셀러재고번호 | string | Y |  | CD00101 |  |
| &nbsp;&nbsp;`ns2:productComponents` | ns2:productComponents | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`productComponent` | productComponent | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`addCompPrc` | 추가 구성가격 | string | Y |  | 100 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`addPrdGrpNm` | 추가상품명 | string | Y |  | 추가 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`addPrdWght` | 추가 구성 무게 | string | Y |  | 10 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`addUseYn` | 상태 | string | Y |  | Y |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`compPrdNm` | 추가상품값 | string | Y |  | 추가구성상품 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`compPrdQty` | 판매수량 | string | Y |  | 5 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`sellerAddPrdCd` | 판매자추가상품번호 | string | Y |  | 93367282 |  |
