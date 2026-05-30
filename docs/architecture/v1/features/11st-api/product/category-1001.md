# Seller - 상품 - 전체 카테고리 조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=38&apiSeq=1001&apiSpecType=1
> categoryNo: `38` · apiSeq: `1001` · 섹션: 상품 > 카테고리조회
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

11번가의 전체 카테고리 정보를 조회 합니다. 웹상에서 Url 호출로 바로 확인이 가능합니다.
API Key 값은 필요하지 않습니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `http://api.11st.co.kr/rest/cateservice/category` |
| Protocol | http |
| Version | 1.0 |
| 응답 형식 | xml |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:categorys` | ns2:categorys | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:category` | ns2:category | object[] | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`depth` | 트리 구조의 깊이 | string | Y |  | 1 | 11번가 전체 카테고리를 조회하기에 1 : 대카테고리. 2 : 중카테고리. 3 : 소카테고리. 4 : 세카테고리 로 보셔도 무방합니다. 단, 하위카테고리 조회는 예외입니다. |
| &nbsp;&nbsp;&nbsp;&nbsp;`dispNm` | 카테고리 이름 | string | Y |  | 주방/이미용/생활가전 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`dispNo` | 카테고리 번호 | string | Y |  | 1033 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`parentDispNo` | 상위 카테고리 번호 | string | Y |  | 0 | 0 번은 트리 구조상 최상위로 대카테고리를 의미합니다. |
| &nbsp;&nbsp;&nbsp;&nbsp;`gblDlvYn` | 전세계배송가능여부 | enum | Y |  | Y | (코드값: Y=가능, N=불가능) |
| &nbsp;&nbsp;&nbsp;&nbsp;`engDispYn` | 영문11번가노출여부 | enum | Y |  | Y | (코드값: Y=가능, N=불가능) |
| &nbsp;&nbsp;&nbsp;&nbsp;`leafYn` | 하위 카테고리 여부 | enum | Y |  | N | (코드값: Y=하위 카테고리, N=하위 카테고리가 아님) |
