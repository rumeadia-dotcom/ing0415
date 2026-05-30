# 발송마감 템플릿 수정

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=43&apiSeq=6737&apiSpecType=1
> categoryNo: `43` · apiSeq: `6737` · 섹션: 상품 > 배송
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

발송마감 템플릿 번호별 상세 내용을 수정할 수 있습니다.

| 항목 | 값 |
|---|---|
| Method | `PUT` |
| URL | `http://api.11st.co.kr/rest/prodservices/sendCloseTemplate/344801` |
| Protocol | http |
| Version | 1.0 |
| 요청 형식 | xml |
| 응답 형식 | xml |

## Request

### Request Body

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `SendCloseTmplt` |  | object | Y |  |  |  |
| &nbsp;&nbsp;`sendClfCd` |  | string | Y |  | 01 | 발송방법(01:일반발송, 02:오늘발송, 03:재고확인 후 순차발송(소량재고/주문제작)) |
| &nbsp;&nbsp;`satSendYn` |  | string | Y |  | Y | 토요일 발송여부(Y,N) |
| &nbsp;&nbsp;`sendCmplTerm` |  | enum | Y |  | 1 | 일반발송(1 ~ 2), <br>재고확인 후 순차발송 (3 ~ 7)<br> * 해외직구상품은 최대 14일까지 선택가능 (코드값: 1=1, 2=2, 3=3, 4=4, 5=5, 6=6, 7=7, 8=8, 9=9, 10=10, 11=11, 12=12, 13=13, 14=14) |
| &nbsp;&nbsp;`wkdayPayCmplHm` |  | enum | Y |  | 0900 | 오늘발송 선택시 주문마감시간 시간 필수입력(ex:0900,2000) (코드값: 0900=0900, 1000=1000, 1100=1100, 1200=1200, 1300=1300, 1400=1400, 1500=1500, 1600=1600, 1700=1700, 1800=1800, 1900=1900, 2000=2000) |
| &nbsp;&nbsp;`satPayCmplHm` |  | enum | Y |  | 0900 | 토요일 주문마감시간(ex:0900,2000) (코드값: 0900=0900, 1000=1000, 1100=1100, 1200=1200, 1300=1300, 1400=1400, 1500=1500, 1600=1600, 1700=1700, 1800=1800, 1900=1900, 2000=2000) |
| &nbsp;&nbsp;`repCloseTimeYn` |  | string | Y |  | Y | 대표 마감시간으로 설정(Y,N) |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ClientMessage` |  | object | Y |  |  |  |
| &nbsp;&nbsp;`message` |  | string | Y |  | 발송마감 템플릿 등록 성공 |  |
| &nbsp;&nbsp;`prdInfoTmpltNo` |  | string | Y |  | 344842 |  |
| &nbsp;&nbsp;`resultCode` |  | string | Y |  | 200 |  |
