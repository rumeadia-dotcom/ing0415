# Seller - 상품 - 상품 QnA 목록 조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=41&apiSeq=1626&apiSpecType=1
> categoryNo: `41` · apiSeq: `1626` · 섹션: 상품 > 상품Q&A
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

구매자가 문의한 상품 QnA 목록을 조회 합니다. 조회 기간은 최대 7일(1주일)입니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `http://api.11st.co.kr/rest/prodqnaservices/prodqnalist/[startTime]/[endTime]/[answerStatus]` |
| Protocol | http |
| Version |  |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `startTime` | 검색시작일 | string | Y |  | 20100112 | YYYYMMDD<br>날짜포맷 : 년(4) 월(2) 일(2) |
| `endTime` | 검색종료일 | string | Y |  | 20100118 | YYYYMMDD<br>날짜포맷 : 년(4) 월(2) 일(2) |
| `answerStatus` | 처리여부 | enum | Y |  | 00 | (코드값: 00=전체조회, 01=답변완료조회, 02=미답변조회) |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:productQnas` | ns2:productQnas | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:productQna` | ns2:productQna | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`answerCont` | 답변내용 | string | Y |  | 아주 맛있는 11번가표 꿀사과입니다. |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`answerDt` | 처리일자 | string | Y |  | 2010/01/19 | 답변을 update 한 날짜입니다. |
| &nbsp;&nbsp;&nbsp;&nbsp;`answerYn` | 처리상태 | enum | Y |  | Y | (코드값: Y=답변을 완료한 상태입니다, N=미답변 상태입니다.) |
| &nbsp;&nbsp;&nbsp;&nbsp;`brdInfoClfNo` | 상품번호 | string | Y |  | 48073872 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`brdInfoCont` | 질문내용 | string | Y |  | 사과 맛있나요? |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`brdInfoNo` | QnA 글번호 | string | Y |  | 4881274 | 답변을 update 하실 경우 필요합니다. |
| &nbsp;&nbsp;&nbsp;&nbsp;`brdInfoSbjct` | 제목 | string | Y |  | 질문이요 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`buyYn` | 구매여부 | enum | Y |  | Y | (코드값: Y=질문자가 상품을 구매한 상태, N=구매자가 상품을 구매안한 상태) |
| &nbsp;&nbsp;&nbsp;&nbsp;`createDt` | 문의일자 | string | Y |  | 2010-01-19 12:47:02.0 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`dispYn` | 전시상태 | enum | Y |  | Y | (코드값: Y=전시, N=전시안함) |
| &nbsp;&nbsp;&nbsp;&nbsp;`memID` | 고객ID | string | Y |  | ssssssss |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`memNM` | 고객이름 | string | Y |  | 김김김 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNm` | 상품명 | string | Y |  | 사과 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`qnaDtlsCd` | 문의유형코드 | enum | Y |  | 01 | (코드값: 01=상품, 02=배송, 03=반품/환불/취소, 04=교환/변경, 05=기타) |
| &nbsp;&nbsp;&nbsp;&nbsp;`qnaDtlsCdNm` | 문의유형 | string | Y |  | 상품 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordNoDe` | 주문번호 | string | Y |  | 201510309348419 | 구매여부가 'Y'인 경우 노출 |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordStlEndDt` | 결제일시 | string | Y |  | 2015-10-30 18:26:44 | 구매여부가 'Y'인 경우 노출 |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:productQnas` | ns2:productQnas | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_code` | 에러코드 | enum | Y |  | 500 | (코드값: 500=비지니스 Error, -1000=서버 점검중입니다.) |
| &nbsp;&nbsp;`ns2:result_text` | 에러내용 | string | Y |  | 최대 조회기간은 7일 입니다. |  |
