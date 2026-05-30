# 물류 - 전세계배송 - 수취인 주소 조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=67&apiSeq=1749&apiSpecType=1
> categoryNo: `67` · apiSeq: `1749` · 섹션: 전세계배송 > 조회
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

전세계배송주문의 수취인 주소를 조회합니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `https://api.11st.co.kr/rest/ordservices/gbldlvaddress/[ordNo]` |
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
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvNtEngNm` | 수취인명(영문) | string | Y |  | USA |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvNtShortNm` | 수취인연락처1 | string | Y |  | US |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrBaseAddr` | 수취인연락처2 | string | Y |  | 601 Penhorn Ave Unit 3 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrDtlsAddr` | 수취인국가코드 | string | Y |  | Secaucus |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrGblDtlsAddr` | 수취인국가명(풀네임) | string | Y |  | NJ |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrMailNo` | 수취인우편번호 | string | Y |  | 07094 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrNm` | 수취인주소1(주/도) | string | Y |  | race park |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrPrtblNo` | 수취인주소2(시/군) | string | Y |  | 201-583-2500 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrTlphn` | 수취인주소3(상세) | string | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`updateDt` | 주소지 변경 일시 | string | Y |  | 2013-08-09 |  |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_code` | 결과코드 | enum | Y |  |  | (코드값: 0=조회된 결과가 없습니다.<br>설명 - 조회된 결과값이 없을 경우입니다. 에러가 아닙니다., -1=ex)주문/클레임 조회 오류 MSG : OpenAPI Key 에 해당하는 유저가 없습니다.<br>비지니스 Error. 예외적으로 발생되는 모든 에러. 메시지는 일정하지 않습니다., -1000=서버 점검중입니다.<br>설명 - 매주 금요일 새벽은 정기점검일입니다. 서버 차단이 있을수 있습니다.) |
| &nbsp;&nbsp;`ns2:result_text` | 결과내용 | string | Y |  |  |  |
