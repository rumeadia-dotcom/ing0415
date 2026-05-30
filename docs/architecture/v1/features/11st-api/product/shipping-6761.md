# Seller - 상품 - 방문수령지 수정

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=43&apiSeq=6761&apiSpecType=1
> categoryNo: `43` · apiSeq: `6761` · 섹션: 상품 > 배송
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

방문수령지를 수정 할 수 있습니다.
Seller Office에서 등록 및 수정이 가능합니다.

| 항목 | 값 |
|---|---|
| Method | `POST` |
| URL | `http://api.11st.co.kr/rest/areaservice/visit/updateVisitAddress` |
| Protocol | http |
| Version | 1.0 |
| 요청 형식 | xml |
| 응답 형식 | xml |

## Request

### Request Body

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `InOutAddress` | InOutAddress | object | Y |  |  |  |
| &nbsp;&nbsp;`addrSeq` | 주소 순번 | string | Y |  | 14 | 상품등록시 주소 순번으로 방문수령지를 정하실 수 있습니다. |
| &nbsp;&nbsp;`addrNm` | 주소명 | string | Y |  | 본사 |  |
| &nbsp;&nbsp;`rcvrNm` | 이름 | string | Y |  | 홍길동 |  |
| &nbsp;&nbsp;`gnrlTlphnNo` | 일반전화번호 | string | Y |  | 02-000-0000 | 입력형식 예시) 02-000-0000 |
| &nbsp;&nbsp;`prtblTlphnNo` | 휴대전화번호 | string | Y |  | 010-1111-1111 | 력형식 예시) 010-1111-2222 |
| &nbsp;&nbsp;`buildMngNO` | 건물관리번호 | string |  |  | 1168010100108380001026116 | 건물관리번호 또는 관련 지번 순번 둘중에 하나는 필수 |
| &nbsp;&nbsp;`lnmAddrSeq` | 관련 지번 순번 | string |  |  | 1776801 | 입력시 건물관리번호 빈값 |
| &nbsp;&nbsp;`dtlsAddr` | 상세주소 | string | Y |  | 101호 | 최대 한글 100자 영/숫자 200자 |
| &nbsp;&nbsp;`addrClfCd` | 주소 구분 | string | Y |  | 01 | 기본값은 도로명. 도로명인 경우 01, 지번인 경우 02 |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:inOutAddresss` | ns2:intOutAddresss | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:intOutAddress` | ns2:inOutAddress | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addrNm` | 주소명 | string | Y |  | 본사 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addrSeq` | 주소 순번 | string | Y |  | 14 | 상품등록시 주소 순번으로 방문수령지를 정하실 수 있습니다. |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrNm` | 이름 | string | Y |  | 홍길동 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`gnrlTlphnNo` | 일반전화번호 | string | Y |  | 02-000-0000 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prtblTlphnNo` | 휴대전화번호 | string | Y |  | 010-1111-1111 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`buildMngNO` | 건물관리번호 | string |  |  | 1168010100108380001026116 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`lnmAddrSeq` | 관련 지번 순번 | string |  |  | 1776801 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`dtlsAddr` | 상세주소 | string | Y |  | 101호 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addrClfCd` | 주소 구분 | string | Y |  | 01 |  |
| &nbsp;&nbsp;`ns2:result_message` | SUCCESS | string | Y |  | SUCCESS | result_message를 체크하여 주소 순번을 가져온다. |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:inOutAddresss` | ns2:inOutAddresss | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_message` | 결과내용 | string | Y |  |  |  |
