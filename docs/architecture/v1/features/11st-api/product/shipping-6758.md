# 배송지연 공지해제

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=43&apiSeq=6758&apiSpecType=1
> categoryNo: `43` · apiSeq: `6758` · 섹션: 상품 > 배송
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

배송지연 공지등록된 상품들을 해제처리 할 수 있습니다.

| 항목 | 값 |
|---|---|
| Method | `POST` |
| URL | `http://api.11st.co.kr/rest/prodservices/deliveryDelay` |
| Protocol | http |
| Version | 1.0 |
| 요청 형식 | xml |
| 응답 형식 | xml |

## Request

### Request Body

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `DeliveryDelay` |  | object | Y |  |  |  |
| &nbsp;&nbsp;`delayForAllProducts` |  | enum | Y |  |  | "배송 지연 공지 대상 (코드값: N=일반상품 (상품단위 해제시), Y=셀러의 판매중인 모든상품) |
| &nbsp;&nbsp;`DelayObject` |  | object |  |  |  | delayForAllProducts가 N일 경우 필수 |
| &nbsp;&nbsp;&nbsp;&nbsp;`number` |  | string | Y |  |  | 배송지연 대상 상품 번호 |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ClientMessage` |  | object | Y |  |  |  |
| &nbsp;&nbsp;`message` |  | string | Y |  | 해제성공 |  |
| &nbsp;&nbsp;`resultCode` |  | string | Y |  | 200 |  |
