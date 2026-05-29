# 전화번호에 대한 안심번호 제공

> 출처: https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/safe-number.html
> 화물/택배사: 로젠택배 (logen)
> 섹션: 자체 시스템 송장출력
> screenName: `safe-number`
> 추출 시점: 2026-05-29

---

수하인 전화번호에 대해 안심번호를 제공한다.

### URL

개발계:  `https://topenapi.ilogen.com/lrm02b-edi/edi/getVtelNoSaveM`

운영계:  `https://openapi.ilogen.com/lrm02b-edi/edi/getVtelNoSaveM`

### Input

**HTTP Method: POST**

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| userId | userId | String | 8 | Y | 연동업체코드 | 10358007 | 연동업체 테스트코드 |
| data | takeDt | String | 8 | Y | 접수일자 | 20250409 |  |
| data1 | slipNo | String | 11 | Y | 운송장번호 | 11111111111 |  |
|  | telNo | String | 50 | P | 전화번호 | 0223456789 | 전화번호, 휴대폰번호 중 한 항목이 입력되어 있어야 함. |
|  | cellNo | String | 50 |  | 휴대폰번호 | 01012345678 | 전화번호, 휴대폰번호 중 한 항목이 입력되어 있어야 함. |

### Output

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data | slipNo | String | 11 | N | 운송장번호 | 11111111111 |  |
|  | virTelNo | String | 22 | N | 안심번호 | 0503-1234-5678 | 휴대폰번호에 대한 매핑된 안심번호 |
|  | resultCd | String | 20 | N | 결과 | TRUE | TRUE(성공 시) / FALSE(오류 시) |
|  | resultMsg | String | 1000 | N | 내용 |  | ""(성공 시) / 오류메시지(오류 시) |
| sttsCd | sttsCd | String | 20 | Y | 상태 | SUCCESS | SUCCESS / PARTIAL SUCCESS / FAIL |
| sttsMsg | sttsMsg | String | 200 | Y | 메시지 | 총2건 - 처리결과 : 2건 처리 중 2건 성공 | 조회결과 N 건 중, N 건 성공(성공 시) / 오류메시지(오류 시) |

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
      "takeDt": "20250409",
      "data1": [
        {
          "slipNo": "11111111111",
          "telNo": "0223456789",
          "cellNo": "01012345679"
        },
        {
          "slipNo": "11111111112",
          "telNo": "0223456788",
          "cellNo": "01012345681"
        }
      ]
    }
  ]
}
```

**Output**

```json
{
  "data": [
    {
      "slipNo": "11111111111",
      "virTelNo": "0503-1234-5678",
      "resultCd": "TRUE",
      "resultMsg": ""
    },
    {
      "slipNo": "11111111112",
      "virTelNo": "0503-1234-5679",
      "resultCd": "TRUE",
      "resultMsg": ""
    }
  ],
  "sttsCd": "FAIL",
  "sttsMsg": "총2건 - 처리결과 : 2건 처리 중 2건 성공"
}
```

