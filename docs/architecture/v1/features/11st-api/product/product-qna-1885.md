# Seller - 상품 - 상품 QnA 답변 처리

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=41&apiSeq=1885&apiSpecType=1
> categoryNo: `41` · apiSeq: `1885` · 섹션: 상품 > 상품Q&A
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

구매자가 문의한 상품 QnA의 답변을 update 합니다. 답변처리가 완료 되면 문의자에게 E-Mail이 자동 발송됩니다.

| 항목 | 값 |
|---|---|
| Method | `PUT` |
| URL | `http://api.11st.co.kr/rest/prodqnaservices/prodqnaanswer/[brdInfoNo]/[prdNo]` |
| Protocol | http |
| Version |  |
| 요청 형식 | xml |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `brdInfoNo` | Qna글번호 | string | Y |  | 4881274 | 상품 Qna 목록 조회로 확인하실 수 있습니다. |
| `prdNo` | 상품번호 | string | Y |  | 123456 | 상품 Qna 목록 조회로 확인하실 수 있습니다. |

### Request Body

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ProductQna` | ProductQna | object | Y |  |  |  |
| &nbsp;&nbsp;`answerCont` | 답변내용 | string | Y |  | 아주 맛있는 11번가표 꿀사과입니다. |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ClientMessage` | ClientMessage | object | Y |  |  |  |
| &nbsp;&nbsp;`brdInfoNo` | 답변처리를 한 상품 QnA 원본 글번호 | string | Y |  | 4917792 |  |
| &nbsp;&nbsp;`productNo` | 답변처리를 한 상품 QnA 상품번호 | string | Y |  | 123456 |  |
| &nbsp;&nbsp;`message` | 결과내용 | string | Y |  | 상품 Qna 글 번호 : 4917792의 성공적으로 수정되었습니다. 업데이트 된 내용 :아주 맛있는 11번가표 꿀사과입니다. |  |
| &nbsp;&nbsp;`resultCode` | 결과코드 | enum | Y |  | 200 | (코드값: 200=비지니스 성공) |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ClientMessage` | ClientMessage | object | Y |  |  |  |
| &nbsp;&nbsp;`brdInfoNo` | 상품 QnA 글 번호 | string | Y |  | 4917792 |  |
| &nbsp;&nbsp;`productNo` | 상품 QnA 상품번호 | string | Y |  | 123456 |  |
| &nbsp;&nbsp;`message` | 에러내용 | string | Y |  | 상품 Qna 글 번호 :49177920의 답변 업데이트 실패. MSG : OpenAPI Key 에 해당하는 유저가 없습니다. |  |
| &nbsp;&nbsp;`resultCode` | 에러코드 | enum | Y |  | 500 | (코드값: 500=비지니스 Error, -1000=서버 점검중입니다.) |
