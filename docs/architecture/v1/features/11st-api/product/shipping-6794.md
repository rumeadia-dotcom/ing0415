# 해외출고지수정

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=43&apiSeq=6794&apiSpecType=1
> categoryNo: `43` · apiSeq: `6794` · 섹션: 상품 > 배송
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

| 항목 | 값 |
|---|---|
| Method | `POST` |
| URL | `http://api.11st.co.kr/rest/areaservice/global/updateGlobalOutAddress` |
| Protocol | http |
| Version | 1.0 |
| 요청 형식 | xml |
| 응답 형식 | xml |

## Request

### Request Body

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `InOutAddress` |  | object | Y |  |  |  |
| &nbsp;&nbsp;`addrNm` | 주소명 | string | Y |  | oversea outaddress |  |
| &nbsp;&nbsp;`rcvrNm` | 수신자명 | string | Y |  | crewmate |  |
| &nbsp;&nbsp;`gnrlTlphnNo` | 일반전화번호 | string | Y |  | 01011111111 |  |
| &nbsp;&nbsp;`prtblTlphnNo` | 휴대폰번호 | string | Y |  | 01012341234 |  |
| &nbsp;&nbsp;`countryCd` | 국가코드 | string | Y | 2 | US |  |
| &nbsp;&nbsp;`addr1` | Address1 | string | Y |  | Address11 |  |
| &nbsp;&nbsp;`addr2` | Address2 | string | Y |  | Address22 |  |
| &nbsp;&nbsp;`city` | City | string | Y |  | City mod |  |
| &nbsp;&nbsp;`state` | State | string | Y |  | State mod |  |
| &nbsp;&nbsp;`zipCode` | 우편번호 | string | Y |  | 22342a |  |
| &nbsp;&nbsp;`addrSeq` | 주소순번 | string | Y |  | 1 | 수정시 필요한 key값 |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:inOutAddress` |  | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:inOutAddress` |  | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addr1` | Address1 | string | Y |  | Address11 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addr2` | Address2 | string | Y |  | Address22 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addrNm` | 주소명 | string | Y |  | oversea outaddress |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addrSeq` | 주소순번 | string | Y |  | 1 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`city` | City | string | Y |  | City mod |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`countryCd` | 국가코드 | string | Y |  | US |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`gnrlTlphnNo` | 일반전화번호 | string | Y |  | 010-1111-1111 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prtblTlphnNo` | 휴대폰번호 | string | Y |  | 010-1234-1234 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrNm` | 수신자명 | string | Y |  | crewmate |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`state` | State | string | Y |  | State mod |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`zipCode` | 우편번호 | string | Y |  | 22342a |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ns2:result_message` | SUCCESS | string | Y |  |  |  |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:inOutAddresss` |  | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_message` |  | string | Y |  |  |  |
