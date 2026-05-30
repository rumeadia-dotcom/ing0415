# Seller - 상품 - 출고지 배송비 정책 등록/수정

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=43&apiSeq=1078&apiSpecType=1
> categoryNo: `43` · apiSeq: `1078` · 섹션: 상품 > 배송
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

출고지 배송비 정책을 등록 및 수정 할 수 있습니다.
Seller Office에서 등록 및 수정이 가능하며, 우편번호 순번 리스트는 다음 링크에서 다운로드 받으실 수 있습니다.
http://openapi.11st.co.kr/download/%EC%9A%B0%ED%8E%B8%EB%B2%88%ED%98%B8.xls

| 항목 | 값 |
|---|---|
| Method | `POST` |
| URL | `http://api.11st.co.kr/rest/areaservice/addOutAddrBasiDlvCst` |
| Protocol | http |
| Version | 1.0 |
| 요청 형식 | xml |
| 응답 형식 | xml |

## Request

### Request Body

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `InOutAddress` | InOutAddress | object | Y |  |  |  |
| &nbsp;&nbsp;`memNo` | 회원번호 | string | Y |  | 10006134 | 해외 통합 배송일경우는 통합셀러 회원번호를 필수로 넣어주셔야 합니다. |
| &nbsp;&nbsp;`addrSeq` | 주소 순번 | string | Y |  | 11 | 상품등록시 주소 순번으로 출고지,반품/교환지를 정하실수 있습니다. |
| &nbsp;&nbsp;`addrBasiDlvCst` | addrBasiDlvCst | object[] | Y |  |  | 2개이상 필수등록 |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvCst` | 배송비 | string | Y |  | 2000 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordBgnAmt` | 주문시작금액 | string | Y |  | 0 | 이상금액 |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordEndAmt` | 주문종료금액 | string | Y |  | 10000 | 미만금액 |
| &nbsp;&nbsp;&nbsp;&nbsp;`mbAddrLocation` | 국내외 구분 코드 | enum | Y |  | 01 | (코드값: 01=국내, 02=해외) |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:inOutAddresss` | ns2:inOutAddresss | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:addrBasiDlvCsts` | ns2:addrBasiDlvCsts | object[] | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`dlvCst` |  | string | Y |  | 2000 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordBgnAmt` |  | string | Y |  | 0 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordEndAmt` |  | string | Y |  | 10000 |  |
| &nbsp;&nbsp;`ns2:result_message` | SUCCESS | string | Y |  | SUCCESS | result_message를 체크하여 주소시퀀스를 가져온다. |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:inOutAddresss` | ns2:inOutAddresss | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_message` | 결과내용 | string | Y |  | 출고지 조건부 배송비 입력/수정 오류 : OpenAPI Key 에 해당하는 유저가 없습니다. |  |
