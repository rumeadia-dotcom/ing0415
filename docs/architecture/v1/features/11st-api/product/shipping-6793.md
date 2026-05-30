# 해외출고지등록

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=43&apiSeq=6793&apiSpecType=1
> categoryNo: `43` · apiSeq: `6793` · 섹션: 상품 > 배송
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

해외셀러의 해외출고지 등록을 위한 openapi

| 항목 | 값 |
|---|---|
| Method | `POST` |
| URL | `http://api.11st.co.kr/rest/areaservice/global/registerGlobalOutAddress` |
| Protocol | http |
| Version | 1.0 |
| 요청 형식 | xml |
| 응답 형식 | xml |

## Request

### Request Body

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `InOutAddress` |  | object | Y |  |  |  |
| &nbsp;&nbsp;`addrNm` | 주소명 | string | Y |  | test addrNm |  |
| &nbsp;&nbsp;`rcvrNm` | 수신자명 | string | Y |  | test rcvrNm |  |
| &nbsp;&nbsp;`gnrlTlphnNo` | 일반전화번호 | string | Y |  | 11122233333 |  |
| &nbsp;&nbsp;`prtblTlphnNo` | 휴대폰번호 | string | Y |  | 01011112222 |  |
| &nbsp;&nbsp;`countryCd` | 국가코드 | string | Y | 2 | US |  |
| &nbsp;&nbsp;`addr1` | Address1 | string | Y |  | addr1 Text |  |
| &nbsp;&nbsp;`addr2` | Address2 | string | Y |  | addr2 Text |  |
| &nbsp;&nbsp;`city` | City | string | Y |  | City Text |  |
| &nbsp;&nbsp;`state` | State | string | Y |  | State Text |  |
| &nbsp;&nbsp;`zipCode` | 우편번호 | string | Y |  | 09841234 |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:inOutAddresss` |  | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:inOutAddresss` |  | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addr1` | Address1 | string | Y |  | addr1 Text |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addr2` | Address2 | string | Y |  | addr2 Text |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addrNm` | 주소명 | string | Y |  | test addrNm |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addrSeq` | 주소순번 | string | Y |  | 3 | 조회시 사용 가능한 주소 시퀀스 |
| &nbsp;&nbsp;&nbsp;&nbsp;`city` | City | string | Y |  | City Text |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`countryCd` | 국가코드 | string | Y |  | US |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`gnrlTlphnNo` | 일반전화번호 | string | Y |  | 111-2223-3333 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prtblTlphnNo` | 휴대폰번호 | string | Y |  | 010-1111-2222 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrNm` | 수신인명 | string | Y |  | test rcvrNm |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`state` | State | string | Y |  | State Text |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`zipCode` | 우편번호 | string | Y |  | 09841234 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ns2:result_message` | SUCCESS | string | Y |  | SUCCESS | 등록성공여부 메시지 |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:inOutAddresss` |  | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_message` | 결과내용 | string | Y |  | 해외출고지 등록 오류 : OpenAPI Key 에 해당하는 유저가 없습니다. |  |
