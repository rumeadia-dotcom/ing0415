# 오늘발송 요청내역 (배송준비중 목록조회)

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=111&apiSeq=6742&apiSpecType=1
> categoryNo: `111` · apiSeq: `6742` · 섹션: 주문 > 발주처리
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

* 중요 : 발송처리할 내역 (배송준비중_목록조회) API와 컬럼값이 동일합니다.
맨아래 2개 컬럼값 (dlvSndDue 발송마감일자, delaySendDt 발송예정일자)만 추가되었으니 개발하실때 참고부탁드립니다.
조회기간은 당일로 자동 셋팅되며, 오늘내로 반드시 발송처리 해야 할 주문상품입니다.
설정한 발송예정일 기준으로 오늘까지 발송처리가 안된 주문건이오니, 반드시 오늘내로 발송처리 해주세요. (발송예정일 미설정 상품은 일괄 주문 후 2일내 발송으로 인지)
만약 발송처리가 어렵다면 고객에게 발송지연안내를 해주시거나 고객안내 후 품절취소를 진행해주세요.
이를 위반할 경우 판매자 동의없이 고객직권 취소가 가능함을 안내드립니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `https://api.11st.co.kr/rest/ordservices/todaydelivery/packagings` |
| Protocol | https |
| Version | 1.0 |
| 응답 형식 | xml |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:order` | ns2:order | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addPrdNo` | 추가구성상품의 원상품번호 | enum | Y |  |  | (코드값: 0=추가구성상품 아님, 0이 아닐경우=추가구성상품의 원상품번호) |
| &nbsp;&nbsp;&nbsp;&nbsp;`addPrdYn` | 추가 구성 상품 유무 | enum | Y | 1 | N | (코드값: Y=추가구성상품 있음, N=추가구성상품 없음) |
| &nbsp;&nbsp;&nbsp;&nbsp;`bndlDlvSeq` | 묶음배송일련번호 | integer | Y |  | 4506571 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`bndlDlvYN` | 묶음 배송 유무 | enum | Y | 1 | Y | (코드값: Y=묶음 배송, N=개별 배송) |
| &nbsp;&nbsp;&nbsp;&nbsp;`custGrdNm` | 고객등급 | enum | Y | 20 |  | (코드값: 우수고객=우수고객, 일반고객=일반고객) |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvCst` | 배송비 | integer | Y | 12 | 0 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvCstType` | 배송비 착불 여부 | enum | Y | 5 | 03 | (코드값: 01=선불, 02=착불, 03=무료) |
| &nbsp;&nbsp;&nbsp;&nbsp;`bmDlvCst` | 도서산간배송비 | integer | Y | 12 | 4500 | 2014/12/19(금) 주문건부터 신규제공 |
| &nbsp;&nbsp;&nbsp;&nbsp;`bmDlvCstType` | 도서산간배송비 착불 여부 | enum | Y | 5 | 04 | 2014/12/19(금) 주문건부터 신규제공 (코드값: 01=선불, 02=착불, 04=도서산간배송비 청구 필요 (선물하기 주문)) |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvNo` | 배송번호 | string | Y |  | 40860365 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`gblDlvYn` | 전세계배송여부 | string | Y | 1 | N |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`giftCd` |  | string | Y |  |  | api 사용유저는 해당사항 없음 |
| &nbsp;&nbsp;&nbsp;&nbsp;`memID` | 회원ID | string | Y | 60 | test11st |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`memNo` | 회원번호 | integer | Y |  | 1111111 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordAmt` | 주문총액 | integer | Y | 12 | 19000 | 판매단가*수량(주문 -취소 -반품)+옵션가 |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordBaseAddr` | 주문자 기본주소 | string | Y | 200 | 충북 청주시 상당구 용암동 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordDlvReqCont` | 배송시 요청사항 | string | Y | 200 | null |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordDt` | 주문일시 | string | Y |  | 2010-01-10 04:07:11 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordDtlsAddr` | 구매자 상세주소 | string | Y | 200 | 00번지 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordMailNo` | 구매자 우편번호 | string | Y | 6 | 360100 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordNm` | 구매자 이름 | string | Y | 40 | 홍길동 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordNo` | 11번가 주문번호 | integer | Y |  | 201001108318120 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordOptWonStl` | 주문상품옵션결제금액 | integer | Y |  | 0 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPayAmt` | 결제금액 | integer | Y |  | 16310 | 주문금액 + 배송비 - 판매자 할인금액 - mo쿠폰 |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdSeq` | 주문순번 | integer | Y |  | 1 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrtblTel` | 구매자 휴대폰번호 | string | Y | 15 | 010-9999-9999 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordQty` | 수량 | integer | Y |  | 1 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordStlEndDt` | 결제완료일시 | string | Y |  | 2010-01-12 16:20:59 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordTlphnNo` | 주문자전화번호 | string | Y | 15 | 070-9999-9999 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`plcodrCnfDt` | 발주확인일시 | string | Y |  | null |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNm` | 상품명 | string | Y | 500 | 셔링 브이넥 니트 티셔츠 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNo` | 11번가상품번호 | integer | Y |  | 29370295 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdStckNo` | 주문상품옵션코드 | integer | Y |  | 999999999 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrBaseAddr` | 배송기본주소 | string | Y | 200 | 충북 청주시 상당구 용암동 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrDtlsAddr` | 배송상세주소 | string | Y | 200 | 00번지 8809호 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrMailNo` | 배송지우편번호 | string | Y | 6 | 360100 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrMailNoSeq` | 배송지우편번호순번 | string | Y | 3 | 011 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrNm` | 수령자명 | string | Y | 100 | 홍길동 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrPrtblNo` | 수령자핸드폰번호 | string | Y | 15 | 010-9999-9999 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrTlphn` | 수령자전화번호 | string | Y | 15 | 070-9999-9999 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`selPrc` | 판매가 | integer | Y |  | 19000 | 객단가 |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerDscPrc` | 판매자 할인금액 | integer | Y |  | 2280 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerPrdCd` | 판매자상품번호 | string | Y | 100 | 000000000133275 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`slctPrdOptNm` | 주문상품옵션명 | string | Y | 2000 | 사이즈/색상:사이즈 - S(66)/색상 - 아이보리 [0000346774]-1개 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`tmallDscPrc` | 11번가 할인금액 | integer | Y |  | 410 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`typeAdd` | 주소 유형 | enum | Y | 5 | 01 | 2013/11/29(금) 주문건부터 신규제공 (코드값: 01=지번명, 02=도로명) |
| &nbsp;&nbsp;&nbsp;&nbsp;`typeBilNo` | 건물관리번호 | string | Y | 50 |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`lstTmallDscPrc` | 11번가 할인금액-각상품별 | integer | Y |  | 0 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`lstSellerDscPrc` | 판매자 할인금액-각상품별 | integer | Y |  | 0 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`referSeq` | 원클릭체크아웃 주문코드 | integer | Y |  | 455221112 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerStockCd` | 판매자 재고번호 | string | Y | 50 | 43434232 | 2016/03/25(금)부터 신규제공 |
| &nbsp;&nbsp;&nbsp;&nbsp;`appmtDdDlvDy` | 희망배송일자(대형가전/가구) | string | Y | 30 | 20170420 | 2017/04/20 부터 신규제공 |
| &nbsp;&nbsp;&nbsp;&nbsp;`appmtEltRefuseYn` | 폐가전수거여부 | enum | Y | 1 |  | 2017/04/20 부터 신규제공 (코드값: Y=폐가전 수거요청함, N=폐가전 수거요청안함) |
| &nbsp;&nbsp;&nbsp;&nbsp;`appmtselStockCd` | 희망일배송 모델코드 | string | Y | 500 |  | 2017/04/20 부터 신규제공 |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvSndDue` | 발송마감일자 | string | Y |  | 2019-05-20 00:00:00 | 2019/05/20부터 신규제공 |
| &nbsp;&nbsp;&nbsp;&nbsp;`delaySendDt` | 발송예정일자 | string | Y |  | 2019-05-20 00:00:00 | 2019/05/20부터 신규제공 |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_code` | 결과코드 | enum | Y |  | 0 | (코드값: 0=조회된 결과가 없습니다.<br>설명 - 조회된 결과값이 없을 경우입니다. 에러가 아닙니다., -1=ex)주문/클레임 조회 오류 MSG : OpenAPI Key 에 해당하는 유저가 없습니다.<br>비지니스 Error. 예외적으로 발생되는 모든 에러. 메시지는 일정하지 않습니다., -3303=start_dt의 조회 기간의 포멧(&#39;YYYYMMDDHH24:MI&#39;)이 올바르지 않습니다.<br>설명 - start_dt 조회기간의 데이터 포멧 문제 예)201005041400, -3304=end_dt의 조회 기간의 포멧(&#39;YYYYMMDDHH24:MI&#39;)이 올바르지 않습니다.<br>설명 - end_dt 조회기간의 데이터 포멧 문제 예)201005041400, -3305=최대 조회기간은 일주일 입니다.<br>설명 - end_dt - start_dt 의 값이 8일 이상일 경우 입니다., -1000=서버 점검중입니다.<br>설명 - 매주 금요일 새벽은 정기점검일입니다. 서버 차단이 있을수 있습니다.) |
| &nbsp;&nbsp;`ns2:result_text` | 결과내용 | string | Y |  | 조회된 결과가 없습니다. |  |
