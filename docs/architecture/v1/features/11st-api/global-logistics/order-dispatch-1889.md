# 물류 - 해외물류 - 발송처리할 내역 (배송준비중 목록조회)

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=64&apiSeq=1889&apiSpecType=1
> categoryNo: `64` · apiSeq: `1889` · 섹션: 해외물류 > 발주발송
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

조회 기간은 최대 7일(1주일)입니다.
발주확인이 완료된 주문입니다. 배송방법 및 송장번호를 입력하시고 [발송완료] 처리를 하시면 발송내용이 구매자에게 안내 됩니다.
택배/퀵/우편/등기/직접배송 등 상품의 배송수단과 운송장정보를 입력하셔야 합니다.
품절 등 판매자 귀책사유로 인한 [판매불가] 처리시에는 ‘판매거부’로 간주되어 판매자의 신용점수가 1점 차감됩니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `https://api.11st.co.kr/rest/ordservices/packaging/[startTime]/[endTime]/[abrdDlvYn]` |
| Protocol | https |
| Version |  |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `startTime` | 검색시작일 | string | Y |  | 201001150000 | YYYYMMDDhhmm. 날짜포맷 : 년(4) 월(2) 일(2) 시(2) 분(2)<br>ex)201007210000 |
| `endTime` | 검색종료일 | string | Y |  | 201001170000 | YYYYMMDDhhmm. 날짜포맷 : 년(4) 월(2) 일(2) 시(2) 분(2)<br>ex)201007210000 |
| `abrdDlvYn` | 해외배송여부 | enum | Y |  | Y | (코드값: Y=해외배송O, N=해외배송X) |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:order` | ns2:order | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addPrdYn` | 추가 구성 상품 유무 | enum | Y |  | N | (코드값: Y=추가구성상품 있음, N=추가구성상품 없음) |
| &nbsp;&nbsp;&nbsp;&nbsp;`bndlDlvSeq` | 묶음배송일련번호 | string | Y |  | 4506571 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`bndlDlvYN` | 묶음 배송 유무 | enum | Y |  | Y | (코드값: Y=묶음 배송, N=개별 배송) |
| &nbsp;&nbsp;&nbsp;&nbsp;`brandNm` | 브랜드명 | string | Y |  | 11st |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`dispCtgrEngNm` | 영문분류명 | string | Y |  | jeans |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvCst` | 배송비 | string | Y |  | 0 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvCstType` | 배송비 착불 여부 | enum | Y |  | 03 | (코드값: 01=선불, 02=착불, 03=무료) |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvNo` | 배송번호 | string | Y |  | 40860365 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`giftCd` |  | string | Y |  |  | - api 사용유저는 해당사항 없음 |
| &nbsp;&nbsp;&nbsp;&nbsp;`globalInAddr` | 판매자 반품지 | string | Y |  | United States |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`globalOutAddr` | 판매자 출고지 | string | Y |  | United States |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`hsCode` | HS코드 | string | Y |  | 61 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`islandYN` | 도서산간지역 배송여부 | enum | Y |  | Y | (코드값: Y=도서산간지역, N=도서산간지역 해당없음) |
| &nbsp;&nbsp;&nbsp;&nbsp;`makerNm` | 제조사 | string | Y |  | 11st |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`memID` | 회원ID | string | Y |  | test11st |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`modelNm` | 모델명 | string | Y |  | 11st |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`optWght` | 옵션무게 | string | Y |  | 0 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordAmt` | 주문총액 | string | Y |  | 19000 | 판매단가*수량(주문 -취소 -반품)+옵션가 |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordBaseAddr` | 주문자 기본주소 | string | Y |  | 충북 청주시 상당구 용암동 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordDlvReqCont` | 배송시 요청사항 | string | Y |  | null |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordDt` | 주문일시 | string | Y |  | 2010-01-10 04:07:11 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordDtlsAddr` | 구매자 상세주소 | string | Y |  | 00번지 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordMailNo` | 구매자 우편번호 | string | Y |  | 360100 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordNm` | 구매자 이름 | string | Y |  | 홍길동 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordNo` | 11번가 주문번호 | string | Y |  | 201001108318120 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordOptWonStl` | 주문상품옵션결제금액 | string | Y |  | 0 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPayAmt` | 결제금액 | string | Y |  | 16310 | 주문금액 + 배송비 - 판매자 할인금액 - mo쿠폰 |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdSeq` | 주문순번 | string | Y |  | 1 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrtblTel` | 구매자 휴대폰번호 | string | Y |  | 010-9999-9999 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordQty` | 발송할수량 | string | Y |  | 1 | 주문수량-취소수량 |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordStlEndDt` | 결제완료일시 | string | Y |  | 2010-01-12 16:20:59 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordTlphnNo` | 주문자전화번호 | string | Y |  | 070-9999-9999 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`orgOrdQty` | 원주문수량 | string | Y |  | 1 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`plcodrCnfDt` | 발주확인일시 | string | Y |  | null |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdImgUrl` | 상품이미지 | string | Y |  | http://i.011st.com/11st.jpg |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNo` | 11번가상품번호 | string | Y |  | 29370295 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNm` | 상품명 | string | Y |  | 해외출고지 상품 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdWght` | 상품무게 | string | Y |  | 1111 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrBaseAddr` | 배송기본주소 | string | Y |  | 충북 청주시 상당구 용암동 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrDtlsAddr` | 배송상세주소 | string | Y |  | 00번지 8809호 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrMailNo` | 배송지우편번호 | string | Y |  | 360100 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrMailNoSeq` | 배송지우편번호순번 | string | Y | 3 | 011 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrNm` | 수령자명 | string | Y |  | 홍길동 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrPrtblNo` | 수령자핸드폰번호 | string | Y |  | 010-9999-9999 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrTlphn` | 수령자전화번호 | string | Y |  | 070-9999-9999 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`selPrc` | 판매가 | string | Y |  | 19000 | 객단가 |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerDscPrc` | 판매자 할인금액 | string | Y |  | 2280 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerPrdCd` | 판매자상품번호 | string | Y |  | 000000000133275 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`slctPrdOptNm` | 주문상품옵션명 | string | Y |  | 사이즈/색상:사이즈 - S(66)/색상 - 아이보리 [0000346774]-1개 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`tmallDscPrc` | 11번가 할인금액 | string | Y |  | 410 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerId` | 셀러ID | string | Y |  | tester |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerNm` | 셀러명 | string | Y |  | 홍길동 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`combineStckCd` | 통합입고코드 | string | Y |  | 123456 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`abrdShopId` | 해외쇼핑몰ID | string | Y |  | 해외쇼핑몰ID |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`abrdInCd` | 11번가해외입고유형 | enum | Y |  | 01 | (코드값: 01=무료픽업, 02=판매자발송, 03=구매대행) |
| &nbsp;&nbsp;&nbsp;&nbsp;`dollarAmt` | 달러금액 | string | Y |  | 100 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rsdntNo` | 세관신고정보 | string | Y |  | 7910221233231 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`engNm` | 여권영문명 | string | Y |  | chan-ho Park |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdStckNo` | 재고번호 | string | Y |  | 2939992 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`totalDlvCnt` | 합포장건수 | string | Y |  | 7 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`totalSellerId` | 합포장셀러ID_전체 | string | Y |  | niketest\|\|niketest\|\|niketest | 합포장 주문에 포함된 전체 셀러의 ID가 구분자로 구분되어 출력됩니다. : 구분자 \|\| |
| &nbsp;&nbsp;&nbsp;&nbsp;`typeBilNo` | 건물관리번호 | string | Y | 50 |  |  |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_code` | 결과코드 | enum | Y |  | 0 | (코드값: 0=조회된 결과가 없습니다.<br>설명 - 조회된 결과값이 없을 경우입니다. 에러가 아닙니다., -1=ex)주문/클레임 조회 오류 MSG : OpenAPI Key 에 해당하는 유저가 없습니다.<br>비지니스 Error. 예외적으로 발생되는 모든 에러. 메시지는 일정하지 않습니다., -3303=start_dt의 조회 기간의 포멧('YYYYMMDDHH24:MI')이 올바르지 않습니다.<br>설명 - start_dt 조회기간의 데이터 포멧 문제 예)201005041400, -3304=end_dt의 조회 기간의 포멧('YYYYMMDDHH24:MI')이 올바르지 않습니다.<br>설명 - end_dt 조회기간의 데이터 포멧 문제 예)201005041400, -3305=최대 조회기간은 일주일 입니다.<br>설명 - end_dt - start_dt 의 값이 8일 이상일 경우 입니다., -1000=서버 점검중입니다.<br>설명 - 매주 금요일 새벽은 정기점검일입니다. 서버 차단이 있을수 있습니다.) |
| &nbsp;&nbsp;`ns2:result_text` | 결과내용 | string | Y |  | 조회된 결과가 없습니다 |  |
