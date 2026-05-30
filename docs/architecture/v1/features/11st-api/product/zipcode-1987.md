# Seller - 상품 - 도로명주소 추천 검색

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=44&apiSeq=1987&apiSpecType=1
> categoryNo: `44` · apiSeq: `1987` · 섹션: 상품 > 우편번호
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

지번 주소로 11번가 도로명 추천 서비스용 API 입니다.
검색어는 2글자 이상 입력하셔야 하며, 한글 검색은 UTF-8로 인코딩해야 합니다.

검색어 예) 895-6

| 항목 | 값 |
|---|---|
| Method | `POST` |
| URL | `http://api.11st.co.kr/rest/commonservices/roadAddrSuggest` |
| Protocol | http |
| Version |  |
| 요청 형식 | xml |
| 응답 형식 | xml |

## Request

### Request Body

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `RoadAddrSearchRequest` | RoadAddrSearchRequest | object | Y |  |  |  |
| &nbsp;&nbsp;`searchRoadAddrKwd` | 검색어 | string | Y |  | 역삼 |  |
| &nbsp;&nbsp;`sido` | 시도명 | string | Y |  | 서울특별시 |  |
| &nbsp;&nbsp;`sigungu` | 시군구명 | string | Y |  | 강남구 |  |
| &nbsp;&nbsp;`ueupmyon` | 읍면동 | string | Y |  |  |  |
| &nbsp;&nbsp;`fetchSize` | 페이지 번호컨텐츠수 | string | Y |  | 10 |  |
| &nbsp;&nbsp;`pageNum` | 페이지 번호 | string | Y |  | 1 |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `RoadAddrList` | RoadAddrList | object | Y |  |  |  |
| &nbsp;&nbsp;`roadAddrInfo` | roadAddrInfo | object[] | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`buildMngNo` | 건물관리번호 | string | Y |  | 1168010100108380001026116 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`mailAddr` | 우편번호 주소 | string | Y |  | 서울특별시 강남구 역삼1동 푸르덴셜타워 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`mailNo` | 우편번호 | string | Y |  | 135982 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`mailNoSeq` | 시퀀스 | string | Y |  | 003 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`areaNo` | 지역번호 | string | Y |  | 12345 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`roadAddr` | 도로명 주소 | string | Y |  | 강남대로 298 (역삼동,푸르덴셜타워) |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`roadNm` | 도로명 | string | Y |  | 강남대로 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`sidoNm` | 시도명 | string | Y |  | 서울특별시 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`sigunguNm` | 시군구명 | string | Y |  | 강남구 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`ueupmyonNm` | 읍면동명 | string | Y |  |  |  |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ResultMessage` | ResultMessage | object | Y |  |  |  |
| &nbsp;&nbsp;`result_code` | 결과코드 | enum | Y |  | E011 | (코드값: E011=검색키워드 없음, E012=잘못된 파라미터 값, E013=검색키워드 길이 체크(4byte 이상 입력해야 함), E014=파라미터가 NULL인 경우, E099=기타 내부시스템 오류(재송신 필요)) |
| &nbsp;&nbsp;`result_message` | 결과내용 | string | Y |  | 검색키워드 없음 |  |
