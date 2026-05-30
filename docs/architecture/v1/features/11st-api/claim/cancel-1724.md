# Seller - 취소/반품/교환 - 주문취소철회 완료 목록조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=48&apiSeq=1724&apiSpecType=1
> categoryNo: `48` · apiSeq: `1724` · 섹션: 취소교환반품 > 취소처리
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

주문 취소철회 완료한 목록을 가져옵니다. 조회 기간은 최대 30일(1달)입니다. 
최대 조회건수는 3000건이므로 3000건 조회시 목록이 더 있을 수 있으니 기간을 단축하여 재조회해주시기 바랍니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `http://api.11st.co.kr/rest/claimservice/withdrawcanceledorders/[startTime]/[endTime]` |
| Protocol | http |
| Version | 1.0 |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `startTime` | 검색시작일 | string | Y |  | 201001150000 | YYYYMMDDhhmm<br>날짜포맷 : 년(4) 월(2) 일(2) 시(2) 분(2) |
| `endTime` | 검색종료일 | string | Y |  | 201001170000 | YYYYMMDDhhmm<br>날짜포맷 : 년(4) 월(2) 일(2) 시(2) 분(2) |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `s2:orders` | s2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:order` | ns2:order | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`createDt` | 클레임 요청 일시 | string | Y |  | 2010-01-19 13:50:05 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvNo` | 배송번호 | string | Y |  | 56565334343 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordCnDtlsRsn` | 사유코드에 대한 상세내역 | string | Y | 4000 | 다음에 구매하겠습니다. |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordCnQty` | 클레임 수량 | integer | Y | 10 | 1 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordCnRsnCd` | 클레임 사유코드 | enum | Y | 5 | 09 | (코드값: 06=배송 지연 예상, 07=상품/가격 정보 잘못 입력, 08=상품 품절(전체옵션), 09=옵션 품절(해당옵션), 10=고객변심, 14=구매의사 없어짐, 15=색상/사이즈/주문정보 변경, 16=다른 상품 잘못 주문, 17=배송지연으로 취소, 18=상품품절, 재고없음, 99=기타) |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordCnStatCd` | 클레임 상태 | enum | Y | 5 | 01 | (코드값: 01=취소요청, 02=취소완료, 05=취소신청취소(철회완료)) |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordNo` | 11번가 주문번호 | integer | Y |  | 201001198151936 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdCnSeq` | 외부몰 클레임 번호 | integer | Y |  | 8192583 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdSeq` | 주문순번 | integer | Y |  | 1 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNo` | 상품번호 | integer | Y |  | 41613972 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`slctPrdOptNm` | 클레임 옵션명 | string | Y | 4000 | 1개 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`referSeq` | 원클릭체크아웃 주문코드 | integer | Y |  | 455221113 |  |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_code` | 에러코드 | enum | Y |  | -1 | (코드값: -1=비지니스 Error, -28001=판매자 번호를 알 수 없습니다., -28002=취소목록을 알 수 없습니다., -28003=조회시작일을 알 수 없습니다., -28004=조회종료일을 알 수 없습니다., -28005=올바른 판매자가 아닙니다., -28006=end_dt의 조회 기간의 포멧(&#39;YYYYMMDDHH24&#39;)이 올바르지 않습니다., -28007=start_dt의 조회 기간의 포멧(&#39;YYYYMMDDHH24&#39;)이 올바르지 않습니다., -28008=조회기간은 최대 30(한달)일 단위로 가능합니다., -1000=서버 점검중입니다.) |
| &nbsp;&nbsp;`ns2:result_text` | 에러내용 | string | Y |  | 해당 건이 없습니다. |  |
