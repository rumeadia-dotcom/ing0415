# 물류 - 전세계배송 - 현재 상태 값 조회(기간)

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=67&apiSeq=1925&apiSpecType=1
> categoryNo: `67` · apiSeq: `1925` · 섹션: 전세계배송 > 조회
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

전세계배송(기간)주문의 현재 상태 값을 조회합니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `https://api.11st.co.kr/rest/claimservice/ordclmstatlist/[startTime]/[endTime]` |
| Protocol | https |
| Version |  |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `startTime` | 검색시작일 | string | Y |  | 201001150000 | YYYYMMDDhhmm. 날짜포맷 : 년(4) 월(2) 일(2) 시(2) 분(2)<br>ex)201007210000 |
| `endTime` | 검색종료일 | string | Y |  | 201001170000 | YYYYMMDDhhmm. 날짜포맷 : 년(4) 월(2) 일(2) 시(2) 분(2)<br>ex)201007210000 |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:order` | ns2:order | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordNo` | 주문번호 | string | Y |  | 201308190311783 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdStat` | 주문상태code | enum | Y |  | 202 | (코드값: 101 =주문완료, 102=입금대기, 103=예약대기, 201=예약결제완료, 202=결제완료, 301=발주확인, 401=발송완료, 501=배송완료, 601=클레임진행중<= 주문상태가 이경우일때에만 클레임 변수값 셋팅, 701=취소처리중, 801=재승인대기중, 901=구매확정, A01=반품완료, B01=주문취소, C01=구매확정후주문취소) |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdStatNm` | 주문상태Code명 | string | Y |  | 결제완료 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`clmReqSeq` | 클레임 번호 | string | Y |  | 2568749 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`clmStat` | 클레임상태Code | enum | Y |  | 105 | (코드값: 104=반품보류, 106=반품완료, 107=반품거부, 108=반품신청취소, 109=반품완료보류, 201=교환신청, 212=교환승인, 214=교환보류, 221=교환발송완료, 232=교환거부, 233=교환신청취소) |
| &nbsp;&nbsp;&nbsp;&nbsp;`clmStatNm` | 클레임상태Code명 | string | Y |  | 반품신청 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`clmReqRsn` | 반품/교환 사유코드\|\|상세사유 | string | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`abrdOrdPrdStat` | 해외배송상품 배송상태CODE | enum | Y |  | 421 | (코드값: 421=물류센터입고, 422=추가결제대기, 423=항공대기, 424=항공, 425=통관중, 426=해외현지배송중) |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdStatChgDt` | 주문 상태 업데이트 시간 | string | Y |  | 2013-08-19 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`abrdRefundYn` | 환불대기 코드 | enum | Y |  | N | (코드값: Y=환불대기, N=정상) |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordQty` | 수량 | string | Y |  | 1 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordAmt` | 결제금액(원) | string | Y |  | 1500 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordAmtUsd` | 결제금액(달러) | string | Y |  | 17.56 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdWght` | 상품단품무게 | string | Y |  | 600 |  |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_code` | 결과코드 | enum | Y |  | 0 | (코드값: 0=조회된 결과가 없습니다.<br>설명 - 조회된 결과값이 없을 경우입니다. 에러가 아닙니다., -1=ex)주문/클레임 조회 오류 MSG : OpenAPI Key 에 해당하는 유저가 없습니다.<br>비지니스 Error. 예외적으로 발생되는 모든 에러. 메시지는 일정하지 않습니다., -10001=판매자 번호를 알 수 없습니다., -10002=주문 번호를 알 수 없습니다., -10003=주문 상세번호를 알 수 없습니다., -10004=올바른 판매자가 아닙니다., -10005=endTime의 조회 기간의 포멧('YYYYMMDDHH24')이 올바르지 않습니다., -10006=startTime의 조회 기간의 포멧('YYYYMMDDHH24')이 올바르지 않습니다., -10007=조회기간은 최대 7일 단위로 가능합니다., -1000=서버 점검중입니다.<br>설명 - 매주 금요일 새벽은 정기점검일입니다. 서버 차단이 있을수 있습니다.) |
| &nbsp;&nbsp;`ns2:result_text` | 결과내용 | string | Y |  | 조회된 결과가 없습니다. |  |
