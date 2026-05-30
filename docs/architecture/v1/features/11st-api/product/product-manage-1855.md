# Seller - 상품 - 상품가격/즉시할인 수정

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=81&apiSeq=1855&apiSpecType=1
> categoryNo: `81` · apiSeq: `1855` · 섹션: 상품 > 상품관리
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

상품 정보 중 가격과 즉시할인 정보를 수정할 경우 사용합니다.
11번가와 협의하여 11번가의 쿠폰 또는 서비스이용료 조정이 적용된 상품의 경우, 판매자 기본즉시할인이 적용된 가격이 상향 되면 조정된 내용이 강제로 종료 됩니다.

| 항목 | 값 |
|---|---|
| Method | `POST` |
| URL | `http://api.11st.co.kr/rest/prodservices/product/priceCoupon/[prdNo]` |
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
| &nbsp;&nbsp;`selPrc` | 판매가 | string | Y |  | 3300 | 콤마(,) 없이 숫자만 입력하세요. 50,000(X) 50000(O) |
| &nbsp;&nbsp;`cuponcheck` | 쿠폰 사용 여부 | enum | Y |  | Y | 설정안함 N 입력시 할인수치, 단위코드, 할인 적용기간 등은 입력하지 않아도 됩니다 (코드값: Y=설정함, N=설정안함) |
| &nbsp;&nbsp;`dscAmtPercnt` | 할인수치 | string |  |  | 10 | 판매가에서 할인될 정율/정액 수치를 입력하세요. |
| &nbsp;&nbsp;`cupnDscMthdCd` | 할인 단위코드 | enum |  |  | 01 | 정율/정액 중 선택할 할인단위를 입력하세요. (코드값: 01=할인액(원), 02=할인율(%)) |
| &nbsp;&nbsp;`cupnUseLmtDyYn` | 할인 적용기간 설정 | enum |  |  | Y | 할인쿠폰 지급기간을 설정합니다. (코드값: Y=설정함, N=설정안함) |
| &nbsp;&nbsp;`cupnIssEndDy` | 할인적용기간 종료일 | string |  |  | 2012/04/30 | 할인 적용기간 시작일은 입력 불가능하며, 종료일만 입력 가능합니다.<br>할인적용기간 설정 N 일경우 입력하지 않아도 됩니다 |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ClientMessage` | ClientMessage | object | Y |  |  |  |
| &nbsp;&nbsp;`productNo` | 상품번호 | string | Y |  | 93322795 |  |
| &nbsp;&nbsp;`message` | 결과내용 | string | Y |  | 상품 가격 및 기본즉시할인 정보가 정상적으로 수정 되었습니다. 상품번호 : 113214968 |  |
| &nbsp;&nbsp;`resultCode` | 결과코드 | enum | Y |  | 200 | (코드값: 200=비즈니스 성공) |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ClientMessage` | ClientMessage | object | Y |  |  |  |
| &nbsp;&nbsp;`productNo` | 상품번호 | string | Y |  | 113214968 |  |
| &nbsp;&nbsp;`message` | 에러내용 | string | Y |  | (상품번호:113214968)의 즉시할인 업데이트 실패. |  |
| &nbsp;&nbsp;`resultCode` | 에러코드 | enum | Y |  | 500 | (코드값: 500=비지니스 Error, -1000=서버 점검중입니다) |
