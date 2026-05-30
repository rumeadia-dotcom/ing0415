# Seller - 주문 - 배송완료 내역

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=113&apiSeq=1727&apiSpecType=1
> categoryNo: `113` · apiSeq: `1727` · 섹션: 주문 > 완료조회
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

조회 기간은 최대 7일(1주일)입니다.
배송완료 주문만을 조회하실 수 있습니다.
배송완료 상태에서 7일(영업일기준)이 경과할 때까지 수취확인이 되지 않을 경우, 시스템을 통해 자동수취확인이 이루어지며 그 이후엔 해당 API에는 데이터가 나타나지 않습니다.
배송완료 상태에서 구매자가 수취확인을 눌렀을 경우, 바로 수취확인이 이루어지며 그 이후엔 해당 API에는 데이터가 나타나지 않습니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `https://api.11st.co.kr/rest/ordservices/dlvcompleted/[startTime]/[endTime]` |
| Protocol | https |
| Version | 1.3 |
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
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvCst` | 배송비 | integer | Y | 12 | 25000 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvCstType` | 배송비 착불 여부 | enum | Y | 5 | 03 | (코드값: 01=선불, 02=착불, 03=무료) |
| &nbsp;&nbsp;&nbsp;&nbsp;`bmDlvCst` | 도서산간배송비 | integer | Y | 12 | 4500 | 2014/12/19(금) 주문건부터 신규제공 |
| &nbsp;&nbsp;&nbsp;&nbsp;`bmDlvCstType` | 도서산간배송비 착불 여부 | enum | Y | 5 | 04 | 2014/12/19(금) 주문건부터 신규제공 (코드값: 01=선불, 02=착불, 04=도서산간배송비 청구 필요 (선물하기 주문)) |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvEndDt` | 배송완료일 | string | Y |  | 2010-01-15 15:58:18 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvNo` | 배송번호 | string | Y |  | 12345 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`memID` | 회원ID | string | Y | 60 | test11st |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`memNo` | 회원번호 | integer | Y |  | 1111111 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordAmt` | 주문총액 | integer | Y | 12 | 19000 | 판매단가*수량(주문 -취소 -반품)+옵션가 |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordBaseAddr` | 주문자 기본주소 | string | Y | 200 | 충북 청주시 상당구 용암동 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordDlvReqCont` | 배송시 요청사항 | string | Y | 200 | null |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordDtlsAddr` | 구매자 상세주소 | string | Y | 200 | 00번지 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordMailNo` | 구매자 우편번호 | string | Y | 6 | 360100 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordId` | 구매자ID | string | Y | 60 | test11st |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordNm` | 구매자 이름 | string | Y | 40 | 홍길동 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordNo` | 11번가 주문번호 | integer | Y |  | 201001108318120 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdSeq` | 주문순번 | integer | Y |  | 1 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrtblTel` | 구매자 휴대폰번호 | string | Y | 15 | 010-9999-9999 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordQty` | 수량 | integer | Y |  | 1 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordStlEndDt` | 결제완료일시 | string | Y |  | 2010-01-12 16:20:59 |  |
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
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerPrdCd` | 판매자상품번호 | string | Y | 100 | 000000000133275 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`slctPrdOptNm` | 주문상품옵션명 | string | Y | 2000 | 사이즈/색상:사이즈 - S(66)/색상 - 아이보리 [0000346774]-1개 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`gblDlvYn` | 전세계배송여부 | string | Y | 1 | N | 2012/09/25(화)부터 신규제공 |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvMthdCd` | 배송방식 | enum | Y | 2 | 01 | 2015/03/20(금)부터 신규제공 (코드값: 01=택배, 05=직접전달(화물배달), 06=퀵서비스, 99=배송없음) |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvEtprsCd` | 택배사 코드 | enum | Y | 8 | 00007 | (코드값: 00034=CJ대한통운, 00012=롯데(현대)택배, 00011=한진택배, 00007=우체국택배/등기, 00002=로젠택배, 00116=(주)팀프레시, 00080=ACE Express (해외), 00023=ACI, 00044=APEX(ECMS Express) (해외), 00123=ARGO, 00045=CJ대한통운 국제특송(해외), 00061=CU편의점택배, 00060=CVSnet편의점택배, 00039=DHL (해외), 00046=DHL Global Mail (해외), 00058=EMS (해외), 00098=Euro Parcel (해외), 00047=Fedex (해외), 00056=GPS LOGIX (해외), 00048=GSI익스프레스 (해외), 00049=GSM NtoN (국제특송), 00114=GTS로지스, 00068=HI택배, 00126=HY, 00050=i-Parcel (해외), 00090=IK 물류, 00072=KGL 네트웍스 (국제특송), 00038=LG전자물류, 00073=LineExpress (해외), 00096=LOTOS CORPORATION, 00113=LTL, 00111=SB GLS, 00063=SLX택배, 00051=TNT Express (해외), 00052=TPL, 00053=UPS (해외), 00054=USPS (해외), 00025=WIZWA, 00092=YJS글로벌(영국), 00095=YJS글로벌(월드), 00079=cway express (국제특송), 00074=2fast익스프레스 (해외), 00037=건영택배, 00026=경동택배, 00086=고려택배, 00099=기타, 00130=나은물류, 00067=농협택배, 00089=대림통운, 00021=대신택배, 00071=대운글로벌 (국제특송), 00124=더바오, 00119=두발히어로, 00101=로지스밸리택배, 00120=로지스파트너, 00040=롯데글로벌 (해외), 00112=롯데칠성, 00041=범한판토스 (국제특송), 00117=브릿지 로지스, 00127=삼다수 가정배송, 00036=삼성전자물류, 00057=성원글로벌 (국제특송), 00091=성훈 물류, 00066=세방택배, 00105=스마트로지스, 00077=시알로지텍 (국제특송), 00087=애니트랙, 00042=에어보이익스프레스 (국제특송), 00100=엘서비스, 00109=오늘의픽업, 00128=와이드테크, 00065=용마로지스, 00062=우리택배, 00088=우리한방택배, 00069=원더스퀵, 00085=위니아딤채 본사설치, 00094=은하쉬핑, 00129=이스트라, 00106=이투마스(ETOMARS), 00022=일양로지스, 00083=자이언트, 00097=제니엘시스템, 00104=제이로지스트, 00027=천일택배, 00107=큐런택배, 00108=큐익스프레스, 00121=투데이, 00081=퍼레버택배, 00103=풀앳홈, 00102=프레시솔루션, 00125=핑퐁, 00118=하이브시티, 00064=한의사랑택배, 00035=합동택배, 00122=현대글로비스, 00082=홈이노베이션로지스, 00115=홈픽 오늘도착, 00070=홈픽택배) |
| &nbsp;&nbsp;&nbsp;&nbsp;`invcNo` | 송장번호 | string | Y | 50 | 1234567890 | 2015/03/20(금)부터 신규제공 |
| &nbsp;&nbsp;&nbsp;&nbsp;`sndEndDt` | 발송처리일 | string | Y |  | 2015-01-12 16:36:14 | 2015/03/20(금)부터 신규제공 |
| &nbsp;&nbsp;&nbsp;&nbsp;`typeBilNo` | 건물관리번호 | string | Y | 50 |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`referSeq` | 원클릭체크아웃 주문코드 | integer | Y |  | 455221112 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerStockCd` | 판매자 재고번호 | string | Y | 50 | 43434232 | 2016/03/25(금)부터 신규제공 |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_code` | 결과코드 | enum | Y |  | 0 | (코드값: 0=조회된 결과가 없습니다.<br>설명 - 조회된 결과값이 없을 경우입니다. 에러가 아닙니다., -1=ex)주문/클레임 조회 오류 MSG : OpenAPI Key 에 해당하는 유저가 없습니다.<br>비지니스 Error. 예외적으로 발생되는 모든 에러. 메시지는 일정하지 않습니다., -3902=start_dt의 조회 기간의 포멧(&#39;YYYYMMDDHH24:MI&#39;)이 올바르지 않습니다.<br>설명 - start_dt 조회기간의 데이터 포멧 문제 예)201005041400, -3903=end_dt의 조회 기간의 포멧(&#39;YYYYMMDDHH24:MI&#39;)이 올바르지 않습니다.<br>설명 - end_dt 조회기간의 데이터 포멧 문제 예)201005041400, -3904=최대 조회기간은 일주일 입니다.<br>설명 - end_dt - start_dt 의 값이 8일 이상일 경우 입니다., -1000=서버 점검중입니다.<br>설명 - 매주 금요일 새벽은 정기점검일입니다. 서버 차단이 있을수 있습니다.) |
| &nbsp;&nbsp;`ns2:result_text` | 결과내용 | string | Y |  | 조회된 결과가 없습니다. |  |
