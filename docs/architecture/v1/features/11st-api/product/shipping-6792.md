# 해외출고지조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=43&apiSeq=6792&apiSpecType=1
> categoryNo: `43` · apiSeq: `6792` · 섹션: 상품 > 배송
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `http://api.11st.co.kr/rest/areaservice/global/getGlobalOutAddress/{addrSeq}` |
| Protocol | http |
| Version | 1.0 |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `addrSeq` | 주소시퀀스 | string | Y |  | 2 |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:inOutAddresss` | ns2:inOutAddresss | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:inOutAddresss` | ns2:inOutAddresss | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addr1` | Address1 | string | Y |  | addr1 text |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addr2` | Address2 | string | Y |  | addr2 text |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addrNm` | 주소명 | string | Y |  | oversea text |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addrSeq` | 주소시퀀스 | string | Y |  | 1 | 등록된 해외주소지를 찾는 key값 |
| &nbsp;&nbsp;&nbsp;&nbsp;`city` | City | string | Y |  | city text |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`gnrlTlphnNo` | 일반전화번호 | string | Y |  | 11112222 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`memNo` | 회원번호 | string | Y |  | 10000276 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prtblTlphnNo` | 휴대폰번호 | string | Y |  | 01011111111 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrNm` | 수신자명 | string | Y |  | rcvrNm text | 수취인명 |
| &nbsp;&nbsp;&nbsp;&nbsp;`state` | State | string | Y |  | state text |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`zipCode` | 우편번호 | string | Y |  | 112341aaa |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ns2:result_message` | SUCCESS | string | Y |  | SUCCESS | result_message를 체크하여 주소시퀀스를 가져온다. |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:inOutAddresss` |  | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_message` | 결과내용 | string | Y |  | 해외출고지 주소가 없습니다. |  |
