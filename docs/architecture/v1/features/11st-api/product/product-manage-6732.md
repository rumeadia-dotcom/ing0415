# 실재고체크를 통한 옵션품절 리스트 조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=81&apiSeq=6732&apiSpecType=1
> categoryNo: `81` · apiSeq: `6732` · 섹션: 상품 > 상품관리
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

실시간재고체크 사용하는 셀러 대상 응답 결과를 통해 재고품절/주문가능수량부족으로 리턴되어 품절처리된 11번가 상품 옵션 리스트 조회

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `/rest/prodservices/getRealTimeCheckSoldOutOpt/{startDt}/{endDt}` |
| Protocol | http |
| Version | 1.0 |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `startDt` |  | string | Y | 12 | YYYYMMDDHH24MI | 조회 시작 일자<br>(ex: YYYYMMDDHH24MI / 최근 3개월치만 검색해 주세요) |
| `endDt` |  | string | Y | 12 | YYYYMMDDHH24MI | 조회 종료 일자<br>(ex: YYYYMMDDHH24MI / 최근 3개월치만 검색해 주세요) |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `soldoutList` |  | object | Y |  |  |  |
| &nbsp;&nbsp;`solditem` |  | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNo` |  | integer | Y |  | 1234567890 | 상품번호 |
| &nbsp;&nbsp;&nbsp;&nbsp;`stockNo` |  | integer | Y |  | 1236456 | 옵션번호 |
| &nbsp;&nbsp;&nbsp;&nbsp;`createDt` |  | string | Y |  | 2018-12-03 13:13:48.0 | 생성일 |
| &nbsp;&nbsp;`resultCode` |  | enum | Y |  | 200 | 응답코드 (코드값: 200=성공, 500=실패 및 예외발생) |
| &nbsp;&nbsp;`resultText` |  | string | Y |  | 정상 조회 되었습니다. | 응답메시지 |
