# 송장번호 채번

> 출처: https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/invoice-number-assign.html
> 화물/택배사: 로젠택배 (logen)
> 섹션: 자체 시스템 송장출력
> screenName: `invoice-number-assign`
> 추출 시점: 2026-05-29

---

송장 출력에 필요한 송장번호를 채번한다.

### URL

개발계:  `https://topenapi.ilogen.com/lrm02b-edi/edi/getSlipNo`

운영계:  `https://openapi.ilogen.com/lrm02b-edi/edi/getSlipNo`

### Input

**HTTP Method: POST**

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| userId | userId | String | 8 | Y | 연동업체코드 | 10358007 | 연동업체 테스트코드 |
| data (List) | slipQty | Integer | 4 | Y | 운송장번호채번개수 | 1 (기본)9999 (최대)9999 초과시 별도 요청 |  |

### Output

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data | startSlipNo | String | 11 | N | 시작운송장번호 | 10000000850 |  |
|  | closeSlipNo | String | 11 | N | 종료운송장번호 | 10000000835 |  |
|String data1 | slipNo | String | 11 | N | 운송장번호 | 10000000835 |  |
| data1 | resultCd | String | 20 | N | 결과 | TRUE | TRUE(성공 시) / FALSE(오류 시) |
| data1 | resultMsg | String | 1000 | N | 내용 |  |  |
| sttsCd | sttsCd | String | 20 | Y | 상태 | SUCCESS | SUCCESS(성공 시) / PARTIAL SUCCESS(부분 성공 시) / FAIL(오류 시) |
| sttsMsg | sttsMsg | String | 200 | Y | 메시지 |  | 조회결과 N 건 중, N 건 성공(성공 시) / 오류메시지(오류 시) |

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
      "slipQty": "3"
    }
  ]
}
```

**Output**

```json
{
  "data": {
    "closeSlipNo": "10000000942",
    "startSlipNo": "10000000920",
    "data1": [
      {
        "slipNo": "10000000920",
        "resultCd": "TRUE",
        "resultMsg": ""
      },
      {
        "slipNo": "10000000931",
        "resultCd": "TRUE",
        "resultMsg": ""
      },
      {
        "slipNo": "10000000942",
        "resultCd": "TRUE",
        "resultMsg": ""
      }
    ]
  },
  "sttsCd": "SUCCESS",
  "sttsMsg": ""
}
```

