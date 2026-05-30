# 물류 - 해외물류 - 상품 정보 조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=63&apiSeq=1717&apiSpecType=1
> categoryNo: `63` · apiSeq: `1717` · 섹션: 해외물류 > 상품
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

11번가에 등록된 상품의 재고정보를 조회 합니다. 상품번호는 상품등록시 받으실 수 있습니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `http://api.11st.co.kr/rest/prodmarketservice/prodmarket/wght/[prdNo]` |
| Protocol | http |
| Version |  |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `prdNo` | 상품번호 | string | Y |  | 45597077 | 상품등록시 받으실 수 있습니다. |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:ProductStocks` | ns2:ProductStocks | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:prdNm` | 상품이름 | string | Y |  | 싸이닉 정품을 하나 더!!! 1+1 특급이벤트! |  |
| &nbsp;&nbsp;`ns2:prdNo` | 상품번호 | string | Y |  | 45597077 |  |
| &nbsp;&nbsp;`ns2:prdImgUrl` | 상품이미지 | string | Y |  | http://image.11st.co.kr/t/150/g/7/2/9/2/7/3/6729273_B.jpg |  |
| &nbsp;&nbsp;`ns2:prdWght` | 상품무게 | string | Y |  | 100 |  |
| &nbsp;&nbsp;`ns2:DispCtgrEngNm` | 영문분류명 | string | Y |  | clock |  |
| &nbsp;&nbsp;`ns2:GlobalOutAddr` | 판매자 출고지 | string | Y |  | 111 111, 111, state, zip United States |  |
| &nbsp;&nbsp;`ns2:GlobalInAddr` | 판매자 반품지 | string | Y |  | 111 111, 111, state, zip United States |  |
