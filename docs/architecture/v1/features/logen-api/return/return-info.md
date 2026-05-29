# 반품접수 정보 조회

> 출처: https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/return-info.html
> 화물/택배사: 로젠택배 (logen)
> 섹션: 반품
> screenName: `return-info`
> 추출 시점: 2026-05-29

---

원운송장번호로 반품 접수 주문번호, 출력운송장번호, 예약상태를 리턴한다.

### URL

개발계:  `https://topenapi.ilogen.com/lrm02b-edi/edi/inquiryReturnStateMulti`

운영계:  `https://openapi.ilogen.com/lrm02b-edi/edi/inquiryReturnStateMulti`

### Input

**HTTP Method: POST**

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| userId | userId | String | 8 | Y | 연동업체코드 | 10358007 | 연동업체코드가 아닌 경우 거래처코드 입력 |
| data (List) | custCd | String | 8 | Y | 거래처코드 | 20179999 | 화주사 테스트코드 |
|  | orgnSlipNo | String | 11 | Y | 원운송장번호 | 38001014561 |  |

### Output

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data (List) | orgnSlipNo | String | 11 | Y | 원운송장번호 | 38001014561 |  |
| data1 (List) | takeNo | String | 12 | N | 접수번호 | 240504000001 |  |
|  | slipNo | String | 11 | N | 운송장번호 | 30162185676 |  |
|  | resvStatNm | String | 100 | N | 요청상태명 | 집하완료 |  |
|  | resultCd | String | 20 | Y | 결과 | TRUE | TRUE / FALSE |
|  | resultMsg | String | 1000 | N | 내용 | null | 처리 완료 시 null, 에러 시 상세내용 |
| sttsCd | sttsCd | String | 20 | Y | 상태 | SUCCESS | SUCCESS / PARTIAL SUCCESS / FAIL |
| sttsMsg | sttsMsg | String | 200 | Y | 메시지 | 총3건 - 처리결과 : 3건 처리 중 3건 성공 |  |

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
      "orgnSlipNo": "38001014561"
    },
    {
      "custCd": "20179999",
      "orgnSlipNo": "38001014562"
    },
    {
      "custCd": "20179999",
      "orgnSlipNo": "38001014563"
    }
  ]
}
```

**Output**

```json
{
  "data": [
    {
      "orgnSlipNo": "38001014561",
      "data1": [
        {
          "takeNo": "240504000001",
          "slipNo": "30162185676",
          "resvStatNm": "집하완료"
        }
      ],
      "resultCd": "TRUE",
      "resultMsg": null
    },
    {
      "orgnSlipNo": "38001014562",
      "data1": [
        {
          "takeNo": "240504000002",
          "slipNo": "38115046356",
          "resvStatNm": "집하완료"
        }
      ],
      "resultCd": "TRUE",
      "resultMsg": null
    },
    {
      "orgnSlipNo": "38102485363",
      "data1": [
        {
          "takeNo": "240504000004",
          "slipNo": "38162973125",
          "resvStatNm": "집하완료"
        },
        {
          "takeNo": "240504000005",
          "slipNo": null,
          "resvStatNm": "취소"
        }
      ],
      "resultCd": "TRUE",
      "resultMsg": null
    }
  ],
  "sttsCd": "SUCCESS",
  "sttsMsg": "총3건 - 처리결과 : 3건 처리 중 3건 성공"
}
```

