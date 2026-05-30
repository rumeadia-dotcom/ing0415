# 물류 - 전세계배송 - Invoice 증빙 조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=67&apiSeq=1734&apiSpecType=1
> categoryNo: `67` · apiSeq: `1734` · 섹션: 전세계배송 > 조회
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

전세계배송주문번호의 Invoice 증빙 조회합니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `https://api.11st.co.kr/rest/claimservice/invoicepubl/[ordNo]` |
| Protocol | https |
| Version |  |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ordNo` | 주문번호 | string | Y |  | 201308190311783 |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:order` | ns2:order | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordNo` | 주문번호 | string | Y |  | 201308190311783 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`publMth` | 인보이스 발행 방법 코드 | enum | Y |  | 01 | (코드값: 01=통관용, 02=E-mail, 03=FAX) |
| &nbsp;&nbsp;&nbsp;&nbsp;`publMthNm` | 인보이스 발행 방법 코드명 | string | Y |  | 통관용 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`publMthData` | 인보이스 발행 정보 | string | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`result_code` | 결과코드 | enum | Y |  | 0 | (코드값: 0=성공, 98=Invoice 증빙내역이 존재하지 않습니다., 99=주문정보가 존재하지 않습니다.) |
| &nbsp;&nbsp;&nbsp;&nbsp;`result_text` | 결과내용 | string | Y |  | 성공 |  |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_code` | 결과코드 | enum | Y |  |  | (코드값: 0=조회된 결과가 없습니다.<br>설명 - 조회된 결과값이 없을 경우입니다. 에러가 아닙니다., -1=ex)주문/클레임 조회 오류 MSG : OpenAPI Key 에 해당하는 유저가 없습니다.<br>비지니스 Error. 예외적으로 발생되는 모든 에러. 메시지는 일정하지 않습니다., -10001= 판매자 번호를 알 수 없습니다., -10002=주문 번호를 알 수 없습니다., -10004=올바른 판매자가 아닙니다., -1000=서버 점검중입니다.<br>설명 - 매주 금요일 새벽은 정기점검일입니다. 서버 차단이 있을수 있습니다.) |
| &nbsp;&nbsp;`ns2:result_text` | 결과내용 | string | Y |  |  |  |
