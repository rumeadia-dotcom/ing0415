# Seller - 상품 - 하위 카테고리 조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=38&apiSeq=1617&apiSpecType=1
> categoryNo: `38` · apiSeq: `1617` · 섹션: 상품 > 카테고리조회
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

11번가의 전체 카테고리 중 조회 할 카테고리를 포함한 하위 카테고리 정보를 조회 합니다. 웹상에서 Url 호출로 바로 확인이 가능합니다.
API Key 값은 필요하지 않습니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `http://api.11st.co.kr/rest/cateservice/category/[dispCtgrNo]` |
| Protocol | http |
| Version | 1.0 |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `dispCtgrNo` | 카테고리번호 | string | Y |  | 1097 | 하위 카테고리를 모두 조회 합니다. |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:categorys` | ns2:categorys | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:category` | ns2:category | object[] | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`depth` | 트리 구조의 깊이 | string | Y |  | 1 | 조회한 카테고리를 1 기준으로 하위 Level을 확인합니다. |
| &nbsp;&nbsp;&nbsp;&nbsp;`dispNm` | 카테고리 이름 | string | Y |  | 주방조리가전 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`dispNo` | 카테고리 번호 | string | Y |  | 1097 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`parentDispNo` | 상위 카테고리 번호 | string | Y |  | 1033 | 0 번은 트리 구조상 최상위로 대카테고리를 의미합니다. |
| &nbsp;&nbsp;&nbsp;&nbsp;`engDispYn` | 영문11번가노출여부 | enum | Y |  |  | (코드값: Y=가능, N=불가능) |
| &nbsp;&nbsp;&nbsp;&nbsp;`certType` | 인증유형 | enum | Y |  |  | (코드값: 1=인증유형1 (식품관련 인증), 2=인증유형2 (생활/어린이/전기용품관련 인증)) |
| &nbsp;&nbsp;&nbsp;&nbsp;`requiredYn` | 인증필수여부 | enum | Y |  |  | (코드값: Y=필수, N=비필수) |
