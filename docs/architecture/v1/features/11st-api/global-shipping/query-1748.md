# 물류 - 전세계배송 - 발송완료내역 조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=67&apiSeq=1748&apiSpecType=1
> categoryNo: `67` · apiSeq: `1748` · 섹션: 전세계배송 > 조회
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

조회 기간은 최대 7일(1주일)입니다.
전세계배송발송완료내역 조회합니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `https://api.11st.co.kr/rest/ordservices/gbldlvsndlist/[startTime]/[endTime]` |
| Protocol | https |
| Version |  |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `startTime` | 검색시작일 | string | Y |  | 201301150000 | YYYYMMDDhhmm. 날짜포맷 : 년(4) 월(2) 일(2) 시(2) 분(2)<br>ex)201007210000 |
| `endTime` | 검색종료일 | string | Y |  | 201301210000 | YYYYMMDDhhmm. 날짜포맷 : 년(4) 월(2) 일(2) 시(2) 분(2)<br>ex)201007210000 |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:order` | ns2:order | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordNo` | 주문번호 | string | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdSeq` | 주문순번 | string | Y |  | 1 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdStat` | 주문상태code | enum | Y |  | 401 | (코드값: 202 =결제완료, 301=발주확인, 401=발송완료, 501=배송완료, 601=클레임진행중, 701=취소처리중) |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvNtShortNm` | 국가코드약어 | string | Y |  | CN |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvNtNm` | 국가코드 | string | Y |  | CHINA |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`gblDlvEtrsCd` | 특송사코드 | string | Y |  | 101 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`totalDlvCnt` | 합포장건수 | string | Y |  | 1 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvNo` | 배송번호 | string | Y |  | 75653738 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`barcode` | 바코드 번호 | string | Y |  | 130819031178301 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvMthdCd` | 배송방식 | enum | Y |  | 01 | (코드값: 01=택배, 04=우편(소포/등기)) |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvEtprsCd` | 택배사 코드 | string | Y |  | null |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`invcNo` | 송장번호 | string | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`plcodrCnfDt` | 발주확인일시 | string | Y |  | null |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`sndEndDt` | 발송일시 | string | Y |  | null |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordId` | 구매자(회원)ID | string | Y |  | 11st |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordNm` | 구매자명 | string | Y |  | 홍길동 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordEngNm` | 구매자명 (영문) | string | Y |  | testname |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordTlphnNo` | 구매자 전화번호 | string | Y |  | 010-333-4444 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrtblTel` | 구매자 휴대전화번호 | string | Y |  | 02-4563-8957 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerId` | 판매자(회원)ID | string | Y |  | crewmate11 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerNm` | 판매자명 | string | Y |  | 홍길동 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerMailNo` | 판매자우편번호 | string | Y |  | 210928 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`mailNoSeq` | 판매자우편번호 순번 | string | Y |  | 001 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`typeBilNo` | 판매자건물관리 번호 | string | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerAddr` | 판매자주소 | string | Y |  | 강원도 강릉시 노암동 주소보라매 성무관 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerEmail` | 판매자 EMAIL | string | Y |  | test@11st.co.kr |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerTlphnNo` | 판매자 전화번호 | string | Y |  | 02-1111-2222 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerPrtblTel` | 판매자 휴대전화번호 | string | Y |  | 010-1111-2222 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNo` | 상품번호 | string | Y |  | 93342879 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdStckNo` | 재고번호 | string | Y |  | 909643161 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNm` | 상품명 | string | Y |  | 클레임_입력형옵션_테스트_즉시복합 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdEngNm` | 상품명(영어) | string | Y |  | Cargo shorts |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`slctPrdOptNm` | 옵션명 | string | Y |  | test:test,색상:노란색-1개 (+5000원) |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordQty` | 수량 | string | Y |  | 1 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdWght` | 상품 단품 무게 | string | Y |  | 600 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdWght` | 상품무게 | string | Y |  | 600 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`optWght` | 옵션무게 | string | Y |  | 0 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`hsCode` | HS CODE | string | Y |  | 3926200000 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`hsCodeNm` | HS CODE 품명 | string | Y |  | Articles of apparel and clothing accessories (including gloves, mittens and mitts) |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdType` | 상품 구분 | string | Y |  | 31 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`gblPostTypCd` | 국제우편물종류코드 | string | Y |  | 301 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`orgNtShortNm` | 생산지국가코드 | string | Y |  | KR |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`orgNtNm` | 생산지(풀네임) | string | Y |  | SOUTH KOREA |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordDt` | 주문일시 | string | Y |  | 2013-08-19 14:42:10 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordStlEndDt` | 결제일시 | string | Y |  | 2013-08-19 14:42:10 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordAmt` | 주문순번 결제금액 (\) | string | Y |  | 15000 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordAmtUsd` | 주문순번 결제금액 ($) | string | Y |  | 13.39 |  |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_code` | 결과코드 | enum | Y |  | 0 | (코드값: 0=조회된 결과가 없습니다.<br>설명 - 조회된 결과값이 없을 경우입니다. 에러가 아닙니다., -1=ex)주문/클레임 조회 오류 MSG : OpenAPI Key 에 해당하는 유저가 없습니다.<br>비지니스 Error. 예외적으로 발생되는 모든 에러. 메시지는 일정하지 않습니다., -3402=start_dt의 조회 기간의 포멧('YYYYMMDDHH24:MI')이 올바르지 않습니다.<br>설명 - start_dt 조회기간의 데이터 포멧 문제 예)201005041400, -3403=end_dt의 조회 기간의 포멧('YYYYMMDDHH24:MI')이 올바르지 않습니다.<br>설명 - end_dt 조회기간의 데이터 포멧 문제 예)201005041400, -3404=최대 조회기간은 일주일 입니다.<br>설명 - end_dt - start_dt 의 값이 8일 이상일 경우 입니다., -1000=서버 점검중입니다.) |
| &nbsp;&nbsp;`ns2:result_text` | 결과내용 | string | Y |  | 조회된 결과가 없습니다. |  |
