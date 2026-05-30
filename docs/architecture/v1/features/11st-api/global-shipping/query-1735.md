# 물류 - 전세계배송 - 반출시 판매자 정보 조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=67&apiSeq=1735&apiSpecType=1
> categoryNo: `67` · apiSeq: `1735` · 섹션: 전세계배송 > 조회
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

전세계배송주문의 반출시 판매자 정보를 조회합니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `https://api.11st.co.kr/rest/claimservice/returnsellerinfo/[ordNo]/[ordPrdSeq]` |
| Protocol | https |
| Version |  |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ordNo` | 주문번호 | string | Y |  | 201308190311783 |  |
| `ordPrdSeq` | 주문상품순번 | string | Y |  | 1 |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:order` | ns2:order | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordNo` | 주문번호 | string | Y |  | 201308190311783 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordPrdSeq` | 주문순번 | string | Y |  | 1 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`clmReqSeq` | 클레임번호 | string | Y |  | 2568749 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`clmBndlDlvSeq` | 클레임묶음번호 | string | Y |  | 2168681 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`twplBaseAddr` | 판매자반품지 주소 | string | Y |  | 서울 동작구 신대방동 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`twplDtlsAddr` | 판매자반품지 상세주소 | string | Y |  | 성무관 7층 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`twplEmail` | 판매자 EMAIL | string | Y |  | test@cplanet.co.kr |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`twplMailNo` | 판매자반품지 우편번호 | string | Y |  | 156010 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`mailNoSeq` | 판매자반품지 우편번호 순번 | string | Y |  | 001 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`typeBilNo` | 판매자반품지 건물관리 번호 | string | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`twplMemId` | 판매자(회원)ID | string | Y |  | 11stid |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`twplNm` | 판매자명 | string | Y |  | 11번가 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`twplPrtblNo` | 판매자 휴대전화번호 | string | Y |  | 010-1111-1111 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`twplTlphn` | 판매자 전화번호 | string | Y |  | 02-1111-1111 |  |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_code` | 결과코드 | enum | Y |  |  | (코드값: 0=조회된 결과가 없습니다.<br>설명 - 조회된 결과값이 없을 경우입니다. 에러가 아닙니다., -1=ex)주문/클레임 조회 오류 MSG : OpenAPI Key 에 해당하는 유저가 없습니다.<br>비지니스 Error. 예외적으로 발생되는 모든 에러. 메시지는 일정하지 않습니다., -10001=판매자 번호를 알 수 없습니다., -10002= 주문 번호를 알 수 없습니다., -10003=주문 상세번호를 알 수 없습니다., -10004=올바른 판매자가 아닙니다., -1000=서버 점검중입니다.<br>설명 - 매주 금요일 새벽은 정기점검일입니다. 서버 차단이 있을수 있습니다.) |
| &nbsp;&nbsp;`ns2:result_text` | 결과내용 | string | Y |  |  |  |
