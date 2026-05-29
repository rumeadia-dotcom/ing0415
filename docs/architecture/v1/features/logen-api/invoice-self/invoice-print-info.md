# 송장 출력정보 통합조회

> 출처: https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/invoice-print-info.html
> 화물/택배사: 로젠택배 (logen)
> 섹션: 자체 시스템 송장출력
> screenName: `invoice-print-info`
> 추출 시점: 2026-05-29

---

배송지점, 도착점 코드, 제주/산간/연륙도서지역 여부, 관내배송여부 등 자체 시스템 송장 출력시에 필요한 정보를 통합 조회한다.

### URL

개발계:  `https://topenapi.ilogen.com/lrm02b-edi/edi/integratedInquiry`

운영계:  `https://openapi.ilogen.com/lrm02b-edi/edi/integratedInquiry`

### Input

**HTTP Method: POST**

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| userId | userId | String | 8 | Y | 연동업체코드 | 10358007 | 연동업체 테스트코드 |
| data (List) | custCd | String | 8 | Y | 거래처코드 | 20179999 | 화주사 테스트코드 |
|  | addr | String | 1000 | Y | 주소 | 서울 동작구 강남초등길 23-3 |  |

### Output

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data (List) | custCd | String | 8 | Y | 거래처코드 | 22700000 |  |
|  | addr | String | 1000 | Y | 주소 | 서울 동작구 강남초등길 23-3 |  |
|  | branCd | String | 4 | Y | 지점코드 | 216 |  |
|  | dongNm | String | 50 | Y | 동명 | 상도1동 |  |
|  | classCd | String | 4 | Y | 분류코드 | G4-216 |  |
|  | zipCd | String | 5 | Y | 우편번호 | 06912 |  |
|  | jejuRegYn | String | 1 | Y | 제주지역여부 | N |  |
|  | shipYn | String | 1 | Y | 연륙도서여부 | N |  |
|  | montYn | String | 1 | Y | 산간여부 | N |  |
|  | salesNm | String | 20 | Y | 영업소명 | 상도영업소 |  |
|  | branShareYn | String | 1 | Y | 공용지점여부 | N |  |
|  | tmlNm | String | 10 | N | 터미널명 | 원주TM |  |
|  | resultCd | String | 20 | Y | 상태 | SUCCESS | SUCCESS / FALSE |
|  | resultMsg | String | 1000 | N | 메시지 |  | 처리 완료(resultCd 가 TRUE인 경우) 시 null 에러 상세내용 |
| sttsCd | sttsCd | String | 20 | Y | 상태 | SUCCESS | SUCCESS / PARTIAL SUCCESS / FAIL |
| sttsMsg | sttsMsg | String | 200 | Y | 메시지 | 조회결과 1 건 중, 1 건 성공 | 성공 시 / 오류 시 메시지 |

### 수정이력

| 날짜 | 수정구분 | 수정내용 |
| --- | --- | --- |
| 2025.08.11 | 최초생성 | 본문 최초 생성 |
| 2026.03.19 | 수정 | resultCd 응답값 오기입 부분 수정 |

## 요청/응답 예시

**Input**

```json
{
  "userId": "10358007",
  "data": [
    {
      "custCd": "20179999",
      "addr": "서울 동작구 강남초등길 23-3"
    }
  ]
}
```

**Output**

```json
{
  "data": [
    {
      "custCd": "20179999",
      "addr": "서울 동작구 강남초등길 23-3",
      "branCd": "216",
      "dongNam": "상도1동",
      "classCd": "G4-216",
      "zipCd": "06912",
      "jejuRegYn": "N",
      "shipYn": "N",
      "montYn": "N",
      "salesNm": "상도영업소",
      "branShareYn": "N",
      "resultCd": "SUCCESS",
      "resultMsg": ""
    }
  ],
  "sttsCd": "SUCCESS",
  "sttsMsg": "조회결과 1 건 중, 1 건 성공"
}
```

