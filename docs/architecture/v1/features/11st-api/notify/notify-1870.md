# Seller - 긴급알리미 - 긴급알리미조회_구분코드별

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=58&apiSeq=1870&apiSpecType=1
> categoryNo: `58` · apiSeq: `1870` · 섹션: 알리미 > 알림조회관리
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

긴급알리미 조회API서비스입니다.<br/>
아래 조건에 해당하는 긴급알리미 내역을 조회 할 수 있습니다.<br/>
 -기간:최대30일<br/>
 -처리상태:전체,미확인,답변대기,답변완료,재답변요청,재답변완료,처리완료<br/><br/>
출력 결과 필드 중 emerNtceCd, emerNtceDtlCd 항목이 emerNtceClfNo1, emerNtceClfNo2, emerNtceClfNo3 (emerNtceClfNm1, emerNtceClfNm2, emerNtceClfNm3) 으로 변경 되었습니다. emerNtceCd, emerNtceDtlCd 항목을 사용하고 있다면 변경하시기 바랍니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `https://api.11st.co.kr/rest/alimi/getalimilist/[startTime]/[endTime]/[emerNtceCrntCd]/[orderNo]` |
| Protocol | https |
| Version | 1.3 |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `startTime` | 검색시작일 | string | Y |  | 20140901 | YYYYMMDD. 날짜포맷 : 년(4) 월(2) 일(2)<br>ex)20140901 |
| `endTime` | 검색종료일 | string | Y |  | 20140930 | YYYYMMDD. 날짜포맷 : 년(4) 월(2) 일(2)<br>ex)20140901 |
| `emerNtceCrntCd` | 처리상태 | enum |  |  | 01 | (코드값: 01=미확인, 02=답변대기, 03=답변완료, 04=재답변요청, 05=재답변완료, 06=처리완료) |
| `orderNo` | 주문번호 | string |  |  | 201409233179697 |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:alimi` | ns2:alimi | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:alimListInfo` | ns2:alimListInfo | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`emerNtceSeq` | 게시물일련번호 | integer | Y |  | 5590778 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`emerCtntSeq` | 문의알림번호 | integer | Y |  | 1 | 문의에 대한 순번만 제공됩니다.(답변은 제공되지 않음) |
| &nbsp;&nbsp;&nbsp;&nbsp;`emerTypeCd` | 알리미 유형 | enum | Y | 2 | 01 | (코드값: 01=답변요청, 02=공지) |
| &nbsp;&nbsp;&nbsp;&nbsp;`emerNtceCd` | 게시물대분류 | enum | Y | 2 | 04 | (코드값: 01=판매, 02=안전거래, 03=기획전공지, 04=프로모션 연장, 05=송장번호오류, 06=상품모니터링타입) |
| &nbsp;&nbsp;&nbsp;&nbsp;`emerNtceDtlCd` | 게시물소분류 | enum | Y | 2 |  | (코드값: 01=배송, 02=반품, 03=교환/취소, 04=환불, 05=기타) |
| &nbsp;&nbsp;&nbsp;&nbsp;`emerNtceSubject` | 제목 | string | Y | 200 | 알리미 테스트 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`createDt` | 알림일시(등록일) | string | Y |  | 20140929 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`createTm` | 알림시간(등록일) | string | Y |  | 12:30:30 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`emerReplyDt` | 회신기한 | string | Y |  | 20141013 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`emerNtceCrntCd` | 처리상태 | enum | Y | 2 | 06 | (코드값: 01=미확인, 02=답변대기, 03=답변완료, 04=재답변요청, 05=재답변완료, 06=처리완료) |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNm` | 상품명 | string | Y | 500 |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordNo` | 주문번호 | integer | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdSeq` | 주문상품순번 | integer |  |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`memId` | 구매자ID | string | Y | 60 |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`memNm` | 구매자명 | string | Y | 40 |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`deptNm` | 작성자부서명 | string | Y | 100 | 프로모션 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`empNm` | 작성자명 | string | Y | 40 | STAGE_ADMIN1 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`emerCtnt` | 알림내용 | string | Y | 4000 | 배송문의 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`emerNtceClfNo1` | 게시물분류번호 1단계 | integer | Y |  | 10 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`emerNtceClfNm1` | 게시물분류명 1단계 | string | Y | 100 | 긴급알림톡 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`emerNtceClfNo2` | 게시물분류번호 2단계 | integer | Y |  | 21 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`emerNtceClfNm2` | 게시물분류명 2단계 | string | Y | 100 | 구매 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`emerNtceClfNo3` | 게시물분류번호 3단계 | integer | Y |  | 36 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`emerNtceClfNm3` | 게시물분류명 3단계 | string | Y | 100 | 기타 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`emerReplyList` | 답변내용리스트 | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`emerReplyCtnt` | 답변내용 | string[] | Y | 4000 | 답변1 |  |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:alimi` | ns2:alimi | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_code` | 결과코드 | enum | Y |  | 0 | (코드값: 0=조회된 결과가 없습니다.<br>설명 - 조회된 결과값이 없을 경우입니다. 에러가 아닙니다., -1=ex)알리미 조회 오류 MSG : OpenAPI Key 에 해당하는 유저가 없습니다.<br>비지니스 Error. 예외적으로 발생되는 모든 에러. 메시지는 일정하지 않습니다., -10001=조회시작일을 알 수 없습니다.<br>설명 - startTime 데이타가 없을경우입니다., -10002=조회종료일을 알 수 없습니다.<br>설명 - endTime 데이타가 없을경우입니다., -10003=처리상태값이 올바르지 않습니다.<br>설명 - 처리상태값이 01,02,03,04,05,06이 아닐경우입니다., -10004=조회기간은 최대 30일단위로 가능합니다.<br>설명 - 조회기간이 30일을 초과했을경우 입니다.., -1000=서버 점검중입니다.<br>설명 - 매주 금요일 새벽은 정기점검일입니다. 서버 차단이 있을수 있습니다.) |
| &nbsp;&nbsp;`ns2:result_text` | 결과내용 | string | Y |  | 조회된 결과가 없습니다. |  |
