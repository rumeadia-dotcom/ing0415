# Seller - 주문 - 판매완료 내역 (구매확정 목록조회)

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=113&apiSeq=1637&apiSpecType=1
> categoryNo: `113` · apiSeq: `1637` · 섹션: 주문 > 완료조회
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

조회 기간은 최대 7일(1주일)입니다.
구매확정 주문을 조회하실 수 있습니다.
- 구매확정 : 배송완료일 이후 구매자가 [나의11번가]에서 ‘구매확정’하거나, 
배송완료 이후 7일이 경과하도록 고객불만이 접수되지 않아 8일째 새벽에 시스템에서 ‘구매확정’합니다. (영업일 기준)
구매확정까지 완료된 주문은 익일 정산되고, 정산 익일에 송금됩니다. (영업일 기준)
취소/반품/교환 요청이 접수되면 해당 처리가 완료된 후 구매확정이 진행됩니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `https://api.11st.co.kr/rest/ordservices/completed/[startTime]/[endTime]` |
| Protocol | https |
| Version | 1.2 |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `startTime` | 검색시작일 | string | Y |  | 201001150000 | YYYYMMDDhhmm. 날짜포맷 : 년(4) 월(2) 일(2) 시(2) 분(2) |
| `endTime` | 검색종료일 | string | Y |  | 201001170000 | YYYYMMDDhhmm. 날짜포맷 : 년(4) 월(2) 일(2) 시(2) 분(2) |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:order` | ns2:order | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`atmtBuyCnfrmYN` | 자동구매 확정여부 | enum | Y | 1 | Y | (코드값: Y=시스템 자동수취 확인(배송완료 후 7일, 미 배송완료 데이터 중 발송처리일 21일 후), N=사용자 자동수취 확인) |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvCst` | 배송비 | integer | Y | 12 | 25000 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`memNo` | 회원번호 | integer | Y |  | 1111111 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordAmt` | 주문총액 | integer | Y | 12 | 19000 | 판매단가*수량(주문 -취소 -반품)+옵션가 |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordNo` | 11번가 주문번호 | integer | Y |  | 200912308151041 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdSeq` | 주문순번 | integer | Y |  | 1 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordQty` | 수량 | integer | Y |  | 1 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`pocnfrmDt` | 수취확인일 | string | Y |  | 2010-01-15 15:58:18 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNm` | 상품명 | string | Y | 500 | 셔링 브이넥 니트 티셔츠 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerPrdCd` | 판매자상품번호 | string | Y | 100 | 000000000133275 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`slctPrdOptNm` | 주문상품옵션명 | string | Y | 2000 | 사이즈/색상:사이즈 - S(66)/색상 - 아이보리 [0000346774]-1개 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`gblDlvYn` | 전세계배송여부 | string | Y | 1 | N | 2012/09/25(화)부터 신규제공 |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordDt` | 주문일시 | string | Y |  | 2010-01-10 04:07:11 | 2013/01/17(금)부터 신규제공 |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNo` | 11번가상품번호 | string | Y | 100 | 29370295 | 2013/01/17(금)부터 신규제공 |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPayAmt` | 결제금액 | string | Y |  | 16310 | 2013/01/17(금)부터 신규제공<br>주문금액 + 배송비 - 판매자 할인금액 - mo쿠폰 |
| &nbsp;&nbsp;&nbsp;&nbsp;`referSeq` | 원클릭체크아웃 주문코드 | integer | Y |  | 455221112 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerStockCd` | 판매자 재고번호 | string | Y | 50 | 43434232 | 2016/03/25(금)부터 신규제공 |
| &nbsp;&nbsp;&nbsp;&nbsp;`sendGiftYn` | 선물하기여부 | string |  |  | Y | 2021/03/04 부터 신규제공 (선물 주문건인지 확인가능) |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_code` | 결과코드 | enum | Y |  | 0 | (코드값: 0=조회된 결과가 없습니다.<br>설명 - 조회된 결과값이 없을 경우입니다. 에러가 아닙니다., -1=ex)주문/클레임 조회 오류 MSG : OpenAPI Key 에 해당하는 유저가 없습니다.<br>비지니스 Error. 예외적으로 발생되는 모든 에러. 메시지는 일정하지 않습니다., -3902=start_dt의 조회 기간의 포멧(&#39;YYYYMMDDHH24:MI&#39;)이 올바르지 않습니다.<br>설명 - start_dt 조회기간의 데이터 포멧 문제 예)201005041400, -3903=end_dt의 조회 기간의 포멧(&#39;YYYYMMDDHH24:MI&#39;)이 올바르지 않습니다.<br>설명 - end_dt 조회기간의 데이터 포멧 문제 예)201005041400, -3904=최대 조회기간은 일주일 입니다.<br>설명 - end_dt - start_dt 의 값이 8일 이상일 경우 입니다., -1000=서버 점검중입니다.<br>설명 - 매주 금요일 새벽은 정기점검일입니다. 서버 차단이 있을수 있습니다.) |
| &nbsp;&nbsp;`ns2:result_text` | 결과내용 | string | Y |  | 조회된 결과가 없습니다. |  |
