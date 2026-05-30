# Seller - 상품 - 방문수령지 조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=43&apiSeq=6759&apiSpecType=1
> categoryNo: `43` · apiSeq: `6759` · 섹션: 상품 > 배송
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

방문수령지를 조회할 수 있습니다.
Seller Office에서 등록 및 수정이 가능합니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `http://api.11st.co.kr/rest/areaservice/visit/getVisitAddress/{addrSeq}` |
| Protocol | http |
| Version | 1.0 |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `addrSeq` | 주소 순번 | string | Y |  | 11 |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:inOutAddresss` | ns2:inOutAddresss | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:inOutAddress` | ns2:inOutAddress | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addrNm` | 주소명 | string | Y |  | 본사 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addrSeq` | 주소 순번 | string | Y |  | 14 | 상품등록시 주소 순번으로 방문수령지를 정하실수 있습니다. |
| &nbsp;&nbsp;&nbsp;&nbsp;`baseAddrYN` | 기본 주소 여부 | string | Y |  | N | API로 유입되는 부분은 모두 N으로 처리함 |
| &nbsp;&nbsp;&nbsp;&nbsp;`dtlsAddr` | 상세주소 | string | Y |  | 111 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`gnrlTlphnNo` | 일반전화번호 | string | Y |  | 020-7894-1234 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`mailNO` | 우편번호 | string | Y |  | 626812 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`mailNOSeq` | 우편번호 순번 | string | Y |  | 011 | 우편번호가 5자리인경우 빈값 |
| &nbsp;&nbsp;&nbsp;&nbsp;`buildMngNO` | 건물관리번호 | string | Y |  | 1174010200101530007017336 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prtblTlphnNo` | 휴대전화번호 | string | Y |  | 010-7894-1234 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrNm` | 이름 | string | Y |  | 본사 |  |
| &nbsp;&nbsp;`ns2:result_message` | SUCCESS | string | Y |  | SUCCESS | result_message를 체크하여 주소시퀀스를 가져온다. |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:inOutAddresss` | ns2:inOutAddresss | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_message` | 결과내용 | string | Y |  | 방문수령지 조회 오류 : OpenAPI Key 에 해당하는 유저가 없습니다. |  |
