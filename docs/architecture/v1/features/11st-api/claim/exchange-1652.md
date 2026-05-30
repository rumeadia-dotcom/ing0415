# Seller - 취소/반품/교환 - 교환 철회 목록조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=49&apiSeq=1652&apiSpecType=1
> categoryNo: `49` · apiSeq: `1652` · 섹션: 취소교환반품 > 교환처리
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

구매자가 교환 요청을 한 상태에서 교환 요청을 취소한 교환철회 목록을 가져옵니다. 조회 기간은 최대 30일(1달)입니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `http://api.11st.co.kr/rest/claimservice/retractexcorders/[startTime]/[endTime]` |
| Protocol | http |
| Version | 1.1 |
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
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:order` | ns2:order | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`affliateBndlDlvSeq` | 무료교환 여부 | enum | Y |  | 0 | (코드값: 0=무료교환, 1=일반교환(유료)) |
| &nbsp;&nbsp;&nbsp;&nbsp;`clmReqCont` | 반품 사유코드에 대한 상세내역 | string | Y | 4000 | 상세내역 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`clmReqQty` | 클레임 수량 | integer | Y |  | 1 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`clmReqRsn` | 반품 수량 | enum | Y | 5 | 101 | (코드값: 101=구매자 - 상품에 이상 없으나 구매 의사 없어짐, 105=판매자 - 상품이 상품상세 정보와 틀림, 108=판매자 - 다른 상품이 잘못 배송됨, 110=구매자 - 사이즈, 색상 등을 잘못 선택함, 111=판매자 - 배송된 상품의 파손/하자/포장 불량, 112=판매자 - 상품이 도착하고 있지 않음, 113=구매자 - 기타(구매자 책임사유), 114=구매자 - 구매자 귀책으로 교환을 반품으로 전환, 115=판매자 - 판매자 귀책으로 교환을 반품으로 전환, 116=판매자 - 기타(판매자 책임사유), 117=판매자 - 전세계배송 국내통관 거부, 118=판매자 - 전세계배송 30kg 초과, 119=구매자 - 전세계배송(추가 해외배송비 미결제), 198=판매자 - 구매확정후 직권취소(판매자 책임), 199=구매자 - 구매확정후 직권취소(구매자 책임), 206=구매자 - 사이즈 또는 색상 등을 잘못 선택함, 207=판매자 - 배송된 상품의 파손/하자/포장 불량, 208=판매자 - 다른 상품이 잘못 배송됨, 209=판매자 - 품절 등의 사유로 판매자 협의 후 교환, 210=판매자 - 상품이 상품상세 정보와 틀림, 212=구매자 - 구매자 귀책으로 반품을 교환으로 전환, 213=판매자 - 판매자 귀책으로 반품을 교환으로 전환, 211=구매자 - 기타(구매자 책임사유), 214=판매자 - 기타(판매자 책임사유), 215=구매자 - 사이즈/색상/상품 오선택, 216=판매자 - 상품불량/파손/오배송, 217=판매자 - 품절사유로 판매자 협의 후 교환) |
| &nbsp;&nbsp;&nbsp;&nbsp;`clmReqSeq` | 외부몰 클레임 번호 | integer | Y |  | 2400330 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`clmStat` | 클레임 상태 | enum | Y | 5 | 105 | (코드값: 103=재결제대기중, 104=반품보류, 105=반품신청, 106=반품완료, 107=반품거부, 108=반품철회, 109=반품완료보류, 201=교환신청, 212=교환승인, 214=교환보류, 221=교환발송완료, 232=교환거부, 233=교환철회, 301=재배송접수, 302=재배송완료) |
| &nbsp;&nbsp;&nbsp;&nbsp;`optName` | 옵션명 | string | Y | 2000 | 1개 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordNo` | 11번가 주문번호 | integer | Y |  | 201001068151292 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdSeq` | 주문순번 | integer | Y |  | 1 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNo` | 상품번호 | integer | Y |  | 41601209 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`reqDt` | 클레임 요청 일시 | string | Y |  | 2010-01-06 15:16:37 |  |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_code` | 에러코드 | enum | Y |  | -1 | (코드값: -1=비지니스 Error, -1000=서버 점검중입니다.) |
| &nbsp;&nbsp;`ns2:result_text` | 에러내용 | string | Y |  | 해당 건이 없습니다. |  |
