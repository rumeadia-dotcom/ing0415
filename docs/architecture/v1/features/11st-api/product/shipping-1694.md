# Seller - 상품 - 출고지 배송비 정책 조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=43&apiSeq=1694&apiSpecType=1
> categoryNo: `43` · apiSeq: `1694` · 섹션: 상품 > 배송
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

출고지 배송비 정책 조회 합니다. 11번가 Seller Office 에서 수정 및 등록이 가능합니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `http://api.11st.co.kr/rest/areaservice/getOutAddrBasiDlvCst/[addrSeq]/[mbAddrLocation]` |
| Protocol | http |
| Version |  |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `addrSeq` | 주소지 시퀀스 | string | Y |  | 11 |  |
| `mbAddrLocation` | 국내외 구분 코드 | enum | Y |  | 01 | (코드값: 01=국내, 02=해외) |

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
| &nbsp;&nbsp;`ns2:result_message` | 결과내용 | string | Y |  | 출고지 조건부 배송비 조회 오류 : OpenAPI Key 에 해당하는 유저가 없습니다. |  |
