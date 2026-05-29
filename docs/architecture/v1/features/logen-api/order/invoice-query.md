# 출력 송장번호 조회

> 출처: https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/invoice-query.html
> 화물/택배사: 로젠택배 (logen)
> 섹션: iLOGEN 주문등록
> screenName: `invoice-query`
> 추출 시점: 2026-05-29

---

주문등록 후 로젠시스템에서 출력한 송장번호를 주문번호로 조회한다.

### URL

개발계:  `https://topenapi.ilogen.com/lrm02b-edi/edi/inquirySlipNoMulti`

운영계:  `https://openapi.ilogen.com/lrm02b-edi/edi/inquirySlipNoMulti`

### Input

**HTTP Method: POST**

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 |invoice-query Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| userId | userId | String | 8 | Y | 연동업체코드 | 10358007 | 연동업체코드가 아닌 경우 거래처코드 입력 |
| data (List) | custCd | String | 8 | Y | 거래처코드 | 20179999 |  |
|  | fixTakeNo | String | 100 | Y | 주문번호 | 2004052720343091 |  |

### Output

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data (List) | fixTakeNo | String | 100 | Y | 주문번호 | 2004052720343091 |  |
| data1 (List) | slipNo | String | 11 | N | 운송장번호 |  |  |
|  | delYn | String | 1 | N | 삭제여부 | N |  |
|  | resultCd | String | 20 | Y | 결과 | FALSE | TRUE / FALSE |
|  | resultMsg | String | 1000 | N | 내용 | 유효한 주문번호가 없습니다. | 처리 완료 시 null, 에러 시 상세내용 |
| sttsCd | sttsCd | String | 20 | Y | 상태 | PARTIAL SUCCESS | SUCCESS / PARTIAL SUCCESS / FAIL |
| sttsMsg | sttsMsg | String | 200 | Y | 메시지 | 총2건 - 처리결과 : 2건 처리 중 1건 성공 |  |

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
      "fixTakeNo": "2024052720343091"
    },
    {
      "custCd": "20179999",
      "fixTakeNo": "2004052720343092"
    }
  ]
}
```

**Output**

```json
{
  "data": [
    {
      "fixTakeNo": "2024052720343091",
      "data1": [
        {
          "slipNo": "",
          "delYn": ""
        }
      ],
      "resultCd": "FALSE",
      "resultMsg": "fixTakeNo is null or empty"
    },
    {
      "fixTakeNo": "2004052720343092",
      "data1": [
        {
          "slipNo": "18245153653",
          "delYn": "N"
        },
        {
          "slipNo": "18245153652",
          "delYn": "N"
        },
        {
          "slipNo": "18245153651",
          "delYn": "N"
        }
      ],
      "resultCd": "TRUE",
      "resultMsg": null
    }
  ],
  "sttsCd": "PARTIAL SUCCESS",
  "sttsMsg": "총2건 - 처리결과 : 2건 처리 중 1건 성공"
}
```

