# 배송지연 공지등록

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=43&apiSeq=6757&apiSpecType=1
> categoryNo: `43` · apiSeq: `6757` · 섹션: 상품 > 배송
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

배송지연 공지등록을 통해 사전에 구매하는 고객에게 배송안내를 할수 있습니다.
배송지연 공지 시, 상품상세 아래 배송정보 영역문구에 등록한 지연사유와 발송일이 안내됩니다.
내일 결제 건부터 공지등록이 가능하며, 선택된 결제기간동안 자동 노출되고 기간이 지나면 공지는 자동으로 내려갑니다.
선택한 발송일까지 발송처리 해주시길 바라며, 미처리시 페널티가 부과될 수 있습니다.
결제기간 이전 주문건들은 반드시 사전에 등록한 발송일을 준수해주시기 바라며, 불가피하게 늦어질경우 고객에게 ‘발송지연안내’를 해주시길 바랍니다.
공지문구를 ‘판매자 휴가’로 등록할 경우는 Q&A상단에 답변이 늦어진다는 안내문구가 자동노출 됩니다,

| 항목 | 값 |
|---|---|
| Method | `POST` |
| URL | `http://api.11st.co.kr/rest/prodservices/deliveryDelay` |
| Protocol | http |
| Version | 1.0 |
| 요청 형식 | xml |
| 응답 형식 | xml |

## Request

### Request Body

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `DeliveryDelay` |  | object | Y |  |  |  |
| &nbsp;&nbsp;`delayForAllProducts` |  | enum | Y |  | N | "배송 지연 공지 대상 (코드값: N=일반상품 (상품단위로 등록할시), Y=셀러의 판매중인 모든상품) |
| &nbsp;&nbsp;`statement` |  | enum | Y |  | 01 | "배송 지연 공지 사유 (코드값: 01="주문 폭주로 배송이 지연될 예정입니다", 02="판매자 사정으로 배송이 지연될 예정입니다.", 03="입고지연으로 배송이 지연될 예정입니다.", 04="주문제작 지연으로 배송이 지연될 예정입니다.", 05="택배사 파업으로 배송이 지연될 예정입니다.", 06="물류창고 이전으로 배송이 지연될 예정입니다.", 07="판매자 휴가로 인해 배송이 지연될 예정입니다.") |
| &nbsp;&nbsp;`dlvDelayPayBgnDt` |  | string | Y |  | yyyy/mm/dd | 결제 시작일(yyyy/MM/dd로 입력. 배송 지연 공지가 시작되는 날짜, 내일부터 등록 가능) |
| &nbsp;&nbsp;`dlvDelayPayEndDt` |  | string | Y |  | yyyy/mm/dd | 결제 마감일(yyyy/MM/dd로 입력. 배송 지연 공지가 마감되는 날짜) |
| &nbsp;&nbsp;`dlvBgnDt` |  | string | Y |  | yyyy/mm/dd | 배송 시작일(yyyy/MM/dd로 입력. 결제 마감일 다음날부터 등록 가능) |
| &nbsp;&nbsp;`DelayObject` |  | object |  |  |  | delayForAllProducts가 N일 경우 필수 |
| &nbsp;&nbsp;&nbsp;&nbsp;`number` |  | string | Y |  |  | 배송지연 대상 상품 번호 |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ClientMessage` |  | object | Y |  |  |  |
| &nbsp;&nbsp;`message` |  | string | Y |  | 등록성공 |  |
| &nbsp;&nbsp;`resultCode` |  | string | Y |  | 200 |  |
