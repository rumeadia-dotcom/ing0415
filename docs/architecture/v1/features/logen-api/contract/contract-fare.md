# 운임구분에 따른 계약 운임 조회

> 출처: https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/contract-fare.html
> 화물/택배사: 로젠택배 (logen)
> 섹션: 거래처 계약
> screenName: `contract-fare`
> 추출 시점: 2026-05-29

---

운임구분으로 거래처 계약 운임을 확인한다. (세부운임)

### URL

개발계:  `https://topenapi.ilogen.com/lrm02b-edi/edi/contPickFares`

운영계:  `https://openapi.ilogen.com/lrm02b-edi/edi/contPickFares`

### Input

**HTTP Method: POST**

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| userId | userId | String | 8 | Y | 연동업체코드 | 10358007 | 연동업체 테스트코드 |
| data (List) | custCd | String | 8 | Y | 거래처코드 | 20179999 | 화주사 테스트코드 |
|  | fareTy | String | 3 | Y | 운임타입코드 | 020 |  |

### Output

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data (List) | custCd | String | 8 | Y | 거래처코드 | 20179999 |  |
|  | fareTy | String | 3 | Y | 운임타입코드 | 020 | 010(선불) / 020(착불) / 030(신용) / 040(본사신용) |
| data1 (List) | boxTyCd | String | 5 | Y | 박스타입코드 | AS080 |  |
|  | boxTyNm | String | 30 | Y | 박스타입명 | 극소1 |  |
|  | custCd | String | 8 | Y | 거래처코드 | 20179999 |  |
|  | custNm | String | 50 | Y | 거래처명 | 정보전략201테스트거래처 |  |
|  | dlvFare | Integer | 7 | Y | 택배운임 | 3000 |  |
| resultCd | resultCd | String | 20 | Y | 결과 | SUCCESS | SUCCESS(성공 시) / FAIL(오류 시) |
| resultMsg | resultMsg | String | 1000 | N | 내용 | "" | 성공 시 빈값, 오류 시 메시지 |
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
      "custCd": "20179999",
      "fareTy": "020"
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
      "fareTy": "030",
      "data1": [
        {
          "boxTyNm": "ZW001",
          "custCd": "20179999",
          "custNm": "정보전략201테스트거래처",
          "dlvFare": 3000,
          "boxTyCd": "ZW001"
        }
      ],
      "resultCd": "TRUE",
      "resultMsg": ""
    },
    {
      "custCd": "20179999",
      "fareTy": "010",
      "data1": [
        {
          "boxTyNm": "ZW001",
          "custCd": "20179999",
          "custNm": "정보전략201테스트거래처",
          "dlvFare": 3000,
          "boxTyCd": "ZW001"
        }
      ],
      "resultCd": "TRUE",
      "resultMsg": ""
    }
  ],
  "sttsCd": "SUCCESS",
  "sttsMsg": "조회결과 2 건 중, 2 건 성공"
}
```

