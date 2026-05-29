# 거래처 계약정보 통합조회

> 출처: https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/contract-info.html
> 화물/택배사: 로젠택배 (logen)
> 섹션: 거래처 계약
> screenName: `contract-info`
> 추출 시점: 2026-05-29

---

거래처코드로 해당 거래처와 계약한 영업소정보, 거래처코드 사용여부, 계약운임구분 등 정보를 조회한다.

### URL

개발계:  `https://topenapi.ilogen.com/lrm02b-edi/edi/contractTotalInfo`

운영계:  `https://openapi.ilogen.com/lrm02b-edi/edi/contractTotalInfo`

### Input

**HTTP Method: POST**

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| userId | userId | String | 8 | Y | 연동업체코드 | 10358007 | 연동업체 테스트코드 |
| data (List) | custCd | String | 8 | Y | 거래처코드 | 20179999 | 화주사 테스트코드 |

### Output

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data | custCd | String | 8 | Y | 거래처코드 | 20179999 |  |
|  | pickSalesCd | String | 8 | Y | 집하영업소코드 | 33610000 |  |
|  | pickSalesNm | String | 20 | Y | 집하영업소명 | 수지 기본(050-6113-0000) |  |
|  | pickBranCd | String | 4 | Y | 집하지점코드 | 336 |  |
|  | pickBranNm | String | 20 | Y | 집하지점명 | 동수지 |  |
|  | fareTy | String | 3 | Y | 운임타입코드 | 040 |  |
|  | fareTyNm | String | 20 | Y | 운임타입명 | 본사신용 |  |
|  | useYn | String | 1 | Y | 사용여부 | Y | Y(사용), N(미사용) |
|  | resultCd | String | 20 | Y | 결과 | TRUE | TRUE / FALSE |
|  | resultMsg | String | 1000 | N | 내용 | null | 처리 완료 시 null, 에러 시 상세내용 |
| sttsCd | sttsCd | String | 20 | Y | 상태 | SUCCESS | SUCCESS / PARTIAL SUCCESS / FAIL |
| sttsMsg | sttsMsg | String | 200 | Y | 메시지 | 조회결과 N 건 중, N 건 성공 | 성공 시 / 오류 시 메시지 |

### 수정이력

| 날짜 | 수정구분 | 수정내용 |
| --- | --- | --- |
| 2025.08.11 | 최초생성 | 본문 최초 생성 |

## 요청/응답 예시

**Input**

```json
{
  "userId": "10358007",
  "data": [
    {
      "custCd": "20179999"
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
      "pickSalesCd": "20110000",
      "pickSalesNm": "서강남 기본(050-6113-0000)",
      "pickBranCd": "201",
      "pickBranNm": "서강남",
      "fareTy": "040",
      "fareTyNm": "본사신용",
      "useYn": "Y",
      "resultCd": "TRUE",
      "resultMsg": ""
    }
  ],
  "sttsCd": "SUCCESS",
  "sttsMsg": "조회결과 1 건 중, 1 건 성공"
}
```

