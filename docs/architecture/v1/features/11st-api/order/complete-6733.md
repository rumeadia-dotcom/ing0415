# 상품미도착내역

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=113&apiSeq=6733&apiSpecType=1
> categoryNo: `113` · apiSeq: `6733` · 섹션: 주문 > 완료조회
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

상품 미도착 내역 조회

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `https://api.11st.co.kr/rest/nondeliverys/nondeliverylist/[shDateType]/[shDateFrom]/[shDateTo]` |
| Protocol | https |
| Version | 1.0 |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `shDateType` |  | enum | Y |  | 01 | 검색 기간 구분 (코드값: 01=결제완료일, 02=발주확인일, 03=발송처리일) |
| `shDateFrom` |  | string | Y |  | YYYYMMDD | 검색 시작일 |
| `shDateTo` |  | string | Y |  | YYYYMMDD | 검색 종료일 |

### Query String

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `query` |  | string |  |  | shBuyerType%3D02%2CshBuyerText%3Dabcd%2CshNonDlvStat%3D101%2CshRsnCode%3D101 | 검색 조건<br>-검색 조건 추가시 shBuyerType=02,shBuyerText=abcd,shNonDlvStat=101,shRsnCode=101 와 같은 포맷으로 값 설정 후 인코딩 하여 보냄 |
| `limit` |  | string |  |  | 30 | 목록 최대 갯수 |
| `start` |  | string |  |  | 0 | 이전 페이지 마지막 로우 값 |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns0:nonDeliverys` |  | object | Y |  |  | ns0:nonDeliverys |
| &nbsp;&nbsp;`ns0:nonDelivery` |  | object | Y |  |  | ns0:nonDelivery |
| &nbsp;&nbsp;&nbsp;&nbsp;`no` |  | string | Y |  | 1 | 순번 |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvNo` |  | string | Y |  | 435792890 | 배송번호 |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordNo` |  | string | Y |  | 201812115736995 | 주문번호 |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdSeq` |  | string | Y |  | 1 | 주문순번 |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdStat` |  | string | Y |  | 401 | 주문상태코드 |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdStatNm` |  | string | Y |  | 배송중 | 주문상태명 |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNm` |  | string | Y |  | 셔링 브이넥 니트 티셔츠 | 상품명 |
| &nbsp;&nbsp;&nbsp;&nbsp;`optNm` |  | string | Y |  | 색상:미스티레이크-2개 | 옵션 |
| &nbsp;&nbsp;&nbsp;&nbsp;`sndEndDt` |  | string | Y |  | 2018/12/11 13:27:37 | 발송처리일 |
| &nbsp;&nbsp;&nbsp;&nbsp;`plcodrCnfDt` |  | string | Y |  | 2018/12/11 13:27:37 | 발주확인일 |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNo` |  | string | Y |  | 2147560356 | 상품번호 |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordQty` |  | string | Y |  | 1 | 수량 |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordNm` |  | string | Y |  | 홍길동 | 구매자 |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrMailNo` |  | string | Y |  | 04637 | 우편번호 |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrPrtblNo` |  | string | Y |  | 010-1111-1111 | 휴대폰번호 |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrBaseAddr` |  | string | Y |  | 서울특별시 중구 한강대로 416 (남대문로5가,서울스퀘어)  1-1 | 주소 |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordStlEndDt` |  | string | Y |  | 2018/12/11 13:27:37 | 결제일시 |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvKdCdName` |  | string | Y |  | 일반배송 | 묶음여부 |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrNm` |  | string | Y |  | 홍길동 | 수취인 |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvMthdCdNm` |  | string | Y |  | 택배 | 배송방법 |
| &nbsp;&nbsp;&nbsp;&nbsp;`invcNo` |  | string | Y |  | 11111111 | 송장번호 |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvEtprsNm` |  | string | Y |  | CJ대한통운 | 택배사 |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvClf` |  | string | Y |  | 업체배송 | 배송주체 |
| &nbsp;&nbsp;&nbsp;&nbsp;`partDlvYn` |  | string | Y |  | N | 부분발송 |
| &nbsp;&nbsp;&nbsp;&nbsp;`nonDlvSeq` |  | string | Y |  | 970539 | 미도착접수번호 |
| &nbsp;&nbsp;&nbsp;&nbsp;`nonDlvStatNm` |  | string | Y |  | 미도착처리중 | 처리상태 |
| &nbsp;&nbsp;&nbsp;&nbsp;`nonDlvReqDt` |  | string | Y |  | 2018/12/11 13:27:37 | 미도착접수일 |
| &nbsp;&nbsp;&nbsp;&nbsp;`orderAmt` |  | string | Y |  | 110,000 | 주문금액 |
| &nbsp;&nbsp;&nbsp;&nbsp;`addPrdNo` |  | string | Y |  | 0 | 추가상품번호 |
| &nbsp;&nbsp;&nbsp;&nbsp;`updateDt` |  | string | Y |  | 2018/12/14 17:57:15 | 처리일시 |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerDtlsRsn` |  | string | Y |  | 재발송하였습니다 | 처리사유 |
| &nbsp;&nbsp;&nbsp;&nbsp;`resendDlvMthdCdNm` |  | string | Y |  | 택배 | 재발송 배송방법 |
| &nbsp;&nbsp;&nbsp;&nbsp;`resendDlvEtprsCdNm` |  | string | Y |  | 로젠택배 | 재발송 택배사 |
| &nbsp;&nbsp;&nbsp;&nbsp;`resendInvcNo` |  | string | Y |  | 11111111 | 재발송 송장번호 |
| &nbsp;&nbsp;`ns0:resultCode` |  | enum | Y |  | 0 | 응답코드 (코드값: 0=OK, -1=시스템 오류, 400=잘못된 요청 정보, -1000=서버 점검중입니다. 설명 - 매주 금요일 새벽은 정기점검일입니다. 서버 차단이 있을수 있습니다.) |
| &nbsp;&nbsp;`ns0:resultMessage` |  | string | Y |  | OK | 응답메세지 |
