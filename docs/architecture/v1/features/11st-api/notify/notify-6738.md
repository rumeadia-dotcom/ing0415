# Seller - 긴급알리미 - 게시물분류코드목록조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=58&apiSeq=6738&apiSpecType=1
> categoryNo: `58` · apiSeq: `6738` · 섹션: 알리미 > 알림조회관리
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

긴급알리미 게시물 분류 코드 목록을 조회합니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `https://api.11st.co.kr/rest/alimi/getalimiclflist` |
| Protocol | https |
| Version | 1.0 |
| 응답 형식 | xml |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:alimi` |  | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:alimClfInfo` | 긴급알리미구분목록 | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`emerNtceClfNo1` | 게시물분류번호 1단계 | integer | Y |  | 10 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`emerNtceClfNm1` | 게시물분류명 1단계 | string | Y |  | 긴급문의 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`emerNtceClfNo2` | 게시물분류번호 2단계 | integer | Y |  | 21 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`emerNtceClfNm2` | 게시물분류명 2단계 | string | Y |  | 구매 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`emerNtceClfNo3` | 게시물분류번호 3단계 | integer | Y |  | 31 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`emerNtceClfNm3` | 게시물분류명 3단계 | string | Y |  | 상품 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`useYn` | 사용여부 | string | Y |  | Y |  |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:alimi` |  | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_code` |  | enum | Y |  |  | (코드값: 0=조회된 결과가 없습니다.<br>설명 - 조회된 결과값이 없을 경우입니다. 에러가 아닙니다., -1=ex)알리미 조회 오류 MSG : OpenAPI Key 에 해당하는 유저가 없습니다.<br>비지니스 Error. 예외적으로 발생되는 모든 에러. 메시지는 일정하지 않습니다., -1000=서버 점검중입니다.<br>설명 - 매주 금요일 새벽은 정기점검일입니다. 서버 차단이 있을수 있습니다.) |
