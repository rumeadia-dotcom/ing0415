# Seller - 주문 - 주문번호별 주문상태 조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=115&apiSeq=1774&apiSpecType=1
> categoryNo: `115` · apiSeq: `1774` · 섹션: 주문 > 조회
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

주문번호별 주문상태 리스트를 불러 옵니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `http://api.11st.co.kr/rest/claimservice/orderlistall/[ordNo]` |
| Protocol | http |
| Version | 1.0 |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ordNo` | 주문버호 | string | Y |  | 201106299748041,201106289747615,201106289747649 | 여러개일 경우 쉼표로 구분(공백 있음 안됨) |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:order` | ns2:order | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvNo` | 배송번호 | string | Y |  | 75347773 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordCnQty` | 취소수량 | integer | Y | 10 | 0 | 취소요청 수량도 포함 |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordNo` | 주문번호 | integer | Y |  | 201107059748920 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdSeq` | 주문순번 | integer | Y |  | 1 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdStatNm` | 주문상태 | string | Y | 100 | 결제완료 | 배송중, 배송준비중, 반품신청, 취소신청... |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdStat` | 주문상태코드 | string | Y | 5 | 202 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordQty` | 최초주문수량 | integer | Y |  | 1 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNm` | 상품명 | string | Y | 500 | 모바일_배송비테스트_수량차등 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNo` | 상품번호 | integer | Y |  | 93261420 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerID` | 판매자아이디 | string | Y | 60 | crewmate |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`referSeq` | 원클릭체크아웃 주문코드 | integer | Y |  | 455221113 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerStockCd` | 판매자 재고번호 | integer | Y |  | 34323255 |  |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_code` | 에러코드 | enum | Y |  | -1 | (코드값: -1=비지니스 Error, -28001=판매자 번호를 알 수 없습니다., -28002=주문목록을 알 수 없습니다., -28003=주문번호의 갯수는 최대 100개 까지만 가능 합니다., -28005=올바른 판매자가 아닙니다., -1000=서버 점검중입니다.) |
| &nbsp;&nbsp;`ns2:result_text` | 에러내용 | string | Y |  | 해당 건이 없습니다. |  |
