# 반품 계약 운임 조회

> 출처: https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/return-contractfare.html
> 화물/택배사: 로젠택배 (logen)
> 섹션: 반품
> screenName: `return-contractfare`
> 추출 시점: 2026-05-29

---

원송장번호 및 반품 운임구분으로 반품 계약 운임을 조회한다.

### URL

개발계:  `https://topenapi.ilogen.com/lrm02b-edi/edi/contRtnFares`

운영계:  `https://openapi.ilogen.com/lrm02b-edi/edi/contRtnFares`

### Input

**HTTP Method: POST**

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| userId | userId | String | 8 | Y | 연동업체코드 | 10358007 |  |
| data (List) | orgnSlipNo | String | 11 | Y | 원운송장번호 | 38000000000 |  |
|  | fareTy | String | 3 | Y | 운임타입코드 | 010 |  |

### Output

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data (List) | fareTy | String | 3 | Y | 운임타입코드 | 010 |  |
|  | orgnSlipNo | String | 11 | Y | 원운송장번호 | 38000000000 |  |
| data1 (List) | boxTyCd | String | 5 | Y | 박스타입코드 | AS080 |  |
|  | boxTyNm | String | 30 | Y | 박스타입명 | 극소1 |  |
|  | custCd | String | 8 | Y | 거래처코드 | 51020000 |  |
|  | custNm | String | 50 | Y | 거래처명 | 알레르기연구소 |  |
|  | dlvFare | Integer | 7 | Y | 택배운임 | 4000 |  |
|  | resultCd | String | 20 | Y | 결과 | SUCCESS | SUCCESS / FAIL |
|  | resultMsg | String | 1000 | N | 내용 | "" | 성공 시 "" / 오류 시 메시지 |
| sttsCd | sttsCd | String | 20 | Y | 상태 | SUCCESS | SUCCESS / PARTIAL SUCCESS / FAIL |
| sttsMsg | sttsMsg | String | 200 | Y | 메시지 | 조회결과 N 건 중, N 건 성공 |  |

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
      "orgnSlipNo": "38000000000",
      "fareTy": "010"
    }
  ]
}
```

**Output**

```json
{
  "data": [
    {
      "fareTy": "010",
      "orgnSlipNo": "38000000000",
      "data1": [
        {
          "boxTyCd": "AS080",
          "boxTyNm": "극소8",
          "custCd": "24600000",
          "custNm": "거래처",
          "dlvFare": 3500
        }
      ],
      "resultCd": "SUCCESS",
      "resultMsg": ""
    }
  ],
  "sttsCd": "SUCCESS",
  "sttsMsg": "조회결과 1 건 중, 1 건 성공"
}
```

