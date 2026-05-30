# 물류 - 전세계배송 - 크레임 사유코드 전송

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=69&apiSeq=1744&apiSpecType=1
> categoryNo: `69` · apiSeq: `1744` · 섹션: 전세계배송 > 배송
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

전세계배송의 크레임 사유코드 전송를 진행합니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `https://api.11st.co.kr/rest/claimservice/gblcode/[grpCd]/[DtlsCd]/[DtlsComNm]` |
| Protocol | https |
| Version |  |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `grpCd` | 그룹코드 | string | Y |  | TR999 |  |
| `DtlsCd` | 상세코드 | string | Y |  | 001 |  |
| `DtlsComNm` | 상세코드명 | string | Y |  | 상세사유첫번째 |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ResultOrder` | ResultOrder | object | Y |  |  |  |
| &nbsp;&nbsp;`openMallID` | 11번가 시스템 코드 | string | Y |  | 11ST | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`open_11st_mall` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`open_done_payment_interface` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`result_code` | 결과코드 | enum | Y |  | 0 | (코드값: 0=성공, -10001=판매자 번호를 알 수 없습니다., -10002=그룹코드를 알 수 없습니다., -10003= 상세코드를 알 수 없습니다., -10004= 올바른 판매자가 아닙니다., -10005=상세코드명를 알 수 없습니다., -10006=그룹코드가 잘못되었습니다., -10007=이미 등록된 반송주문내역 사유코드입니다., -10008=이미 등록된 국내통관거부 사유코드입니다., -1=ex)ERROR : OpenAPI Key 에 해당하는 유저가 없습니다.<br>비지니스 Error. 예외적으로 발생되는 모든 에러. 메시지는 일정하지 않습니다., -1000=서버 점검중입니다.<br>설명 - 매주 금요일 새벽은 정기점검일입니다. 서버 차단이 있을수 있습니다.) |
| &nbsp;&nbsp;`result_text` | 결과내용 | string | Y |  | 성공 |  |
