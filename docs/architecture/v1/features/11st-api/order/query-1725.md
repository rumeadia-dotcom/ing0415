# Seller - 주문 - 주문번호별 배송정보 조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=115&apiSeq=1725&apiSpecType=1
> categoryNo: `115` · apiSeq: `1725` · 섹션: 주문 > 조회
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

주문번호별 배송정보 리스트를 불러 옵니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `https://api.11st.co.kr/rest/claimservice/orderlistalladdr/[ordNo]` |
| Protocol | https |
| Version | 1.3 |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ordNo` | 주문번호 | string | Y |  | 201106299748041,201106289747615,201106289747649 | 여러개일 경우 쉼표로 구분(공백 있음 안됨) |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:order` | ns2:order | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvNo` | 배송번호 | string | Y |  | 12345 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordCnQty` | 취소수량 | integer | Y | 10 | 0 | 취소요청 수량도 포함 |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordNo` | 11번가 주문번호 | integer | Y |  | 201001108318120 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdSeq` | 주문순번 | integer | Y |  | 1 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdStatNm` | 주문상태 | string | Y | 100 | 결제완료 | 배송중, 배송준비중, 반품신청, 취소신청... |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdStat` | 주문상태코드 | enum | Y | 5 | 202 | (코드값: 101=주문완료, 102=입금대기, 103=예약대기, 200=배송지입력대기, 201=예약결제완료, 202=결제완료, 301=발주확인, 401=발송완료, 501=배송완료, 601=클레임진행중, 701=취소처리중, 801=재승인대기중, 901=수취확인, A01=반품완료, B01=주문취소, C01=수취확인후주문취소) |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordQty` | 수량 | integer | Y |  | 1 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNm` | 상품명 | string | Y | 500 | 셔링 브이넥 니트 티셔츠 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNo` | 11번가상품번호 | integer | Y |  | 29370295 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerID` | 판매자아이디 | string | Y | 60 | crewmate |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrBaseAddr` | 배송기본주소 | string | Y | 200 | 충북 청주시 상당구 용암동 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrDtlsAddr` | 배송상세주소 | string | Y | 200 | 00번지 8809호 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrMailNo` | 배송지우편번호 | string | Y | 6 | 360100 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrMailNoSeq` | 배송지우편번호순번 | string | Y | 3 | 011 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrNm` | 수령자명 | string | Y | 100 | 홍길동 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrPrtblNo` | 수령자핸드폰번호 | string | Y | 15 | 010-9999-9999 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrTlphn` | 수령자전화번호 | string | Y | 15 | 070-9999-9999 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvMthdCd` | 배송방식 | enum | Y | 2 | 01 | 2015/03/20(금)부터 신규제공 (코드값: 01=택배, 05=직접전달(화물배달), 06=퀵서비스, 99=배송없음) |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvEtprsCd` | 택배사 코드 | enum | Y | 8 | 00007 | (코드값: 00034=CJ대한통운, 00012=롯데(현대)택배, 00011=한진택배, 00007=우체국택배/등기, 00002=로젠택배, 00116=(주)팀프레시, 00080=ACE Express (해외), 00023=ACI, 00044=APEX(ECMS Express) (해외), 00123=ARGO, 00045=CJ대한통운 국제특송(해외), 00061=CU편의점택배, 00060=CVSnet편의점택배, 00039=DHL (해외), 00046=DHL Global Mail (해외), 00058=EMS (해외), 00098=Euro Parcel (해외), 00047=Fedex (해외), 00056=GPS LOGIX (해외), 00048=GSI익스프레스 (해외), 00049=GSM NtoN (국제특송), 00114=GTS로지스, 00068=HI택배, 00126=HY, 00050=i-Parcel (해외), 00090=IK 물류, 00072=KGL 네트웍스 (국제특송), 00038=LG전자물류, 00073=LineExpress (해외), 00096=LOTOS CORPORATION, 00113=LTL, 00111=SB GLS, 00063=SLX택배, 00051=TNT Express (해외), 00052=TPL, 00053=UPS (해외), 00054=USPS (해외), 00025=WIZWA, 00092=YJS글로벌(영국), 00095=YJS글로벌(월드), 00079=cway express (국제특송), 00074=2fast익스프레스 (해외), 00037=건영택배, 00026=경동택배, 00086=고려택배, 00099=기타, 00130=나은물류, 00067=농협택배, 00089=대림통운, 00021=대신택배, 00071=대운글로벌 (국제특송), 00124=더바오, 00119=두발히어로, 00101=로지스밸리택배, 00120=로지스파트너, 00040=롯데글로벌 (해외), 00112=롯데칠성, 00041=범한판토스 (국제특송), 00117=브릿지 로지스, 00127=삼다수 가정배송, 00036=삼성전자물류, 00057=성원글로벌 (국제특송), 00091=성훈 물류, 00066=세방택배, 00105=스마트로지스, 00077=시알로지텍 (국제특송), 00087=애니트랙, 00042=에어보이익스프레스 (국제특송), 00100=엘서비스, 00109=오늘의픽업, 00128=와이드테크, 00065=용마로지스, 00062=우리택배, 00088=우리한방택배, 00069=원더스퀵, 00085=위니아딤채 본사설치, 00094=은하쉬핑, 00129=이스트라, 00106=이투마스(ETOMARS), 00022=일양로지스, 00083=자이언트, 00097=제니엘시스템, 00104=제이로지스트, 00027=천일택배, 00107=큐런택배, 00108=큐익스프레스, 00121=투데이, 00081=퍼레버택배, 00103=풀앳홈, 00102=프레시솔루션, 00125=핑퐁, 00118=하이브시티, 00064=한의사랑택배, 00035=합동택배, 00122=현대글로비스, 00082=홈이노베이션로지스, 00115=홈픽 오늘도착, 00070=홈픽택배) |
| &nbsp;&nbsp;&nbsp;&nbsp;`invcNo` | 송장번호 | string | Y | 50 | 1234567890 | 2015/03/20(금)부터 신규제공 |
| &nbsp;&nbsp;&nbsp;&nbsp;`sndEndDt` | 발송처리일 | string | Y |  | 2015-01-12 16:36:14 | 2015/03/20(금)부터 신규제공 |
| &nbsp;&nbsp;&nbsp;&nbsp;`typeBilNo` | 건물관리번호 | string | Y | 50 |  |  |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_code` | 결과코드 | enum | Y |  | -1 | (코드값: -1=비지니스 Error, -28001=판매자 번호를 알 수 없습니다., -28002=주문목록을 알 수 없습니다., -28003=주문번호의 갯수는 최대 100개 까지만 가능 합니다., -28005=올바른 판매자가 아닙니다., -1000=서버 점검중입니다.) |
| &nbsp;&nbsp;`ns2:result_text` | 결과내용 | string | Y |  | 해당 건이 없습니다. |  |
