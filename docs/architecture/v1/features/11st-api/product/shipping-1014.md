# Seller - 상품 - 출고지 주소 조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=43&apiSeq=1014&apiSpecType=1
> categoryNo: `43` · apiSeq: `1014` · 섹션: 상품 > 배송
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

출고지 주소 목록 조회 및 주소지 순번을 조회 합니다. 11번가 Seller Office 에서 수정 및 등록이 가능합니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `http://api.11st.co.kr/rest/areaservice/outboundarea` |
| Protocol | http |
| Version |  |
| 응답 형식 | xml |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:inOutAddresss` | ns2:inOutAddresss | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:inOutAddress` | ns2:inOutAddress | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addr` | 주소 | string | Y |  | 서울 중구 을지로1가 111 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addrNm` | 주소명 | string | Y |  | 본사 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`addrSeq` | 주소 순번 | string | Y |  | 14 | 상품등록시 주소 순번으로 출고지,반품/교환지를 정하실수 있습니다. |
| &nbsp;&nbsp;&nbsp;&nbsp;`gnrlTlphnNo` | 연락처1 | string | Y |  | 02-1111-2222 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prtblTlphnNo` | 연락처2 | string | Y |  | 010-3333-4444 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`rcvrNm` | 이름 | string | Y |  | 본사 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`memNo` | 회원번호 | string | Y |  | 10000000 | 해외 통합 배송일경우는 통합셀러 회원번호를 필수로 넣어주셔야 합니다. |
| &nbsp;&nbsp;`ns2:result_message` | SUCCESS | string | Y |  | SUCCESS | result_message를 체크하여 주소시퀀스를 가져온다. |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:inOutAddresss` | ns2:inOutAddresss | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_message` | 결과내용 | string | Y |  | 주소지 조회 오류 : OpenAPI Key 에 해당하는 유저가 없습니다. |  |
