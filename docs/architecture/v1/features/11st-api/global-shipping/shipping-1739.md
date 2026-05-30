# 물류 - 전세계배송 - 반품/교환발송 업데이트

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=69&apiSeq=1739&apiSpecType=1
> categoryNo: `69` · apiSeq: `1739` · 섹션: 전세계배송 > 배송
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

전세계배송주문의 반품/교환발송 업데이트를 진행합니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `https://api.11st.co.kr/rest/claimservice/returnexchangeupdate/[ordNo]/[ordPrdSeq]/[clmReqSeq][dlvMthdCd]/[dlvEtprsCd]/[invcNo]` |
| Protocol | https |
| Version |  |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ordNo` | 주문순번 | string | Y |  | 201205230480005 |  |
| `ordPrdSeq` | 주문순번 | string | Y |  | 1 |  |
| `clmReqSeq` | 클레임번호 | string | Y |  | 6326397 |  |
| `dlvMthdCd` | 배송방식 | string | Y |  | 01 |  |
| `dlvEtprsCd` | 택배사코드 | string | Y |  | 00001 |  |
| `invcNo` | 송장번호 | string | Y |  | 9999999999 |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ResultOrder` | ResultOrder | object | Y |  |  |  |
| &nbsp;&nbsp;`openMallID` | 11번가 시스템 코드 | string | Y |  | 11ST | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`open_11st_mall` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`open_done_payment_interface` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`result_code` | 결과코드 | enum | Y |  | 0 | (코드값: 0=성공, -10001=판매자 번호를 알 수 없습니다., -10002=주문 번호를 알 수 없습니다., -10003=주문 상세번호를 알 수 없습니다., -10004= 올바른 판매자가 아닙니다., -10005=보류사유를 알 수 없습니다., -10006=배송방식 코드가 잘못되었습니다., -10007=택배사코드를 알 수 없습니다., -10008=송장번호를 알 수 없습니다., -10009=송장번호가 10자리 이하입니다. 다시 입력 해주세요., -10010=택배업체를 알 수 없습니다., -1=ex)ERROR : OpenAPI Key 에 해당하는 유저가 없습니다.<br>비지니스 Error. 예외적으로 발생되는 모든 에러. 메시지는 일정하지 않습니다., -1000=서버 점검중입니다.<br>설명 - 매주 금요일 새벽은 정기점검일입니다. 서버 차단이 있을수 있습니다.) |
| &nbsp;&nbsp;`result_text` | 결과내용 | string | Y |  | 성공 |  |
