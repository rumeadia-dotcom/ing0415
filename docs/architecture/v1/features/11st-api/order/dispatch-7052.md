# Seller - 주문 - 방문발송처리 (배송완료 처리)

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=112&apiSeq=7052&apiSpecType=1
> categoryNo: `112` · apiSeq: `7052` · 섹션: 주문 > 발송처리
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

방문수령주문에 대하여 발송처리와 배송완료처리를 할 수 있습니다.

| 항목 | 값 |
|---|---|
| Method | `POST` |
| URL | `https://api.11st.co.kr/rest/ordservices/visitdlvend/[dlvNo]/[ordNo]/[visitDlvCertCode]` |
| Protocol | https |
| Version | 1.0 |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `dlvNo` | 배송번호 | string | Y |  | 1372846035 |  |
| `ordNo` | 주문번호 | string | Y |  | 20231123000644032 |  |
| `visitDlvCertCode` | 방문수령인증번호 | string | Y |  | 426428827 |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `n2:orders` | n2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_code` | 결과코드 | enum | Y |  |  | (코드값: 1=성공) |
| &nbsp;&nbsp;`ns2:result_text` | 결과내용 | string | Y |  |  |  |
| &nbsp;&nbsp;`ns2:order` | ns2:order | object |  |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ordNo` | 주문번호 | string |  |  |  |  |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `n2:orders` | n2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_code` | 결과코드 | enum | Y |  |  | (코드값: -1001=방문수령인증코드가 유효하지 않습니다. 다시 한 번 확인해주세요., -1002=방문수령인증코드가 유효하지 않습니다. 다시 한 번 확인해주세요., -1=비지니스 Error) |
| &nbsp;&nbsp;`ns2:result_text` | 결과메시지 | string | Y |  |  |  |
