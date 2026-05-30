# Seller - 긴급알리미 - 긴급알리미 확인/답변처리 PUT

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=58&apiSeq=6982&apiSpecType=1
> categoryNo: `58` · apiSeq: `6982` · 섹션: 알리미 > 알림조회관리
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

긴급알리미 내용 확인 및 답변처리 API입니다. (PUT)

| 항목 | 값 |
|---|---|
| Method | `PUT` |
| URL | `http://api.11st.co.kr/rest/alimi/alimianswer` |
| Protocol | http |
| Version | 1.0 |
| 요청 형식 | xml |
| 응답 형식 | xml |

## Request

### Request Body

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `request` | request | object | Y |  |  |  |
| &nbsp;&nbsp;`confirmYn` | 확인처리 | string | Y |  |  | (Y / N) |
| &nbsp;&nbsp;`emerNtceSeq` | 게시물일련번호 | string | Y |  |  | 예시: 5590777 |
| &nbsp;&nbsp;`answerCtnt` | 답변내용 | string |  |  |  | 답변내용(답변처리건일경우 필수처리) |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `alimiResult` | alimiResult | object | Y |  |  |  |
| &nbsp;&nbsp;`emerNtceSeq` | 게시물 고유 key값 | string | Y |  | 11ST |  |
| &nbsp;&nbsp;`ordNo` | 주문번호 | string | Y |  |  |  |
| &nbsp;&nbsp;`result_code` | 결과코드 | enum | Y |  | 100 | (코드값: 100=공지건에 대한 확인처리성공, 200=답변건에 대한 확인처리성공) |
| &nbsp;&nbsp;`result_text` | 결과내용 | string | Y |  |  | 확인처리 되었습니다. |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `alimiResult` | alimiResult | object | Y |  |  |  |
| &nbsp;&nbsp;`emerNtceSeq` | 게시물 고유 key값 | string | Y |  | 5540783 |  |
| &nbsp;&nbsp;`ordNo` | 주문번호 | string | Y |  |  |  |
| &nbsp;&nbsp;`result_code` | 결과코드 | enum | Y |  | -10005 | (코드값: -1=비지니스 Error, -10000=게시물일련번호에 대한 알리미내역이 존재하지 않습니다., -10001=게시물일련번호를 알 수 없습니다., -10002=확인처리여부를 알 수 없습니다., -10003=확인처리값은 &#39;Y&#39; 또는 &#39;N&#39;으로 입력하셔야 합니다., -10004=답변내용이 입력되어있지 않습니다., -10005=이미 처리된 알리미입니다., -1000=서버 점검중입니다.) |
| &nbsp;&nbsp;`result_text` | 결과내용 | string | Y |  | 이미 처리된 알리미입니다. |  |
