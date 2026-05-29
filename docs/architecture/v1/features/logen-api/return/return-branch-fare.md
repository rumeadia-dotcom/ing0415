# 반품 집하지점 및 운임 조회

> 출처: https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/return-branch-fare.html
> 화물/택배사: 로젠택배 (logen)
> 섹션: 반품
> screenName: `return-branch-fare`
> 추출 시점: 2026-05-29

---

원송장번호로 반품 집하지점 및 반품 운임을 조회한다.

### URL

개발계:  `https://topenapi.ilogen.com/lrm02b-edi/edi/reverseChkInfoMulti`

운영계:  `https://openapi.ilogen.com/lrm02b-edi/edi/reverseChkInfoMulti`

### Input

**HTTP Method: POST**

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| userId | userId | String | 8 | Y | 연동업체코드 | 10358007 (연동업체 테스트코드) |  |
| data | custCd | String | 8 | Y | 거래처코드 | 20179999 (화주사 테스트코드) |  |
|  | orgnSlipNo | String | 11 | Y | 원운송장번호 | 12345678901 |  |

### Output

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data | custCd | String | 8 | N | 거래처코드 | 20179999 |  |
|  | custNm | String | 50 | N | 거래처명 | 테스트1 |  |
|  | dlvBranCd | String | 4 | N | 배송지점코드 | 543 | 반품시 집하지점임 |
|  | branNm | String | 20 | N | 지점명 | 문경 |  |
|  | fareTy | String | 3 | N | 운임타입코드 | 010 | (010:선불,020:착불,030:신용,040:본사신용) |
|  | fareTyNm | String | 20 | N | 운임타입명 | 선불 |  |
|  | dlvFare | Integer | 7 | N | 택배운임 | 4000 |  |
|  | resultCd | String | 20 | N | 결과 | TRUE | TRUE(성공 시) / FALSE(오류 시) |
|  | resultMsg | String | 1000 | N | 내용 |  | ""(성공 시) / 오류메시지(오류 시) |
| sttsCd | sttsCd | String | 20 | Y | 상태 | SUCCESS | SUCCESS / PARTIAL SUCCESS / FAIL |
| sttsMsg | sttsMsg | String | 200 | Y | 메시지 | 총4건 - 처리결과4건 처리 중 4건 성공 | 조회결과 N 건 중, N 건 성공(성공 시) / 오류메시지(오류 시) |

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
      "orgnSlipNo": "12345678901"
    },
    {
      "custCd": "20179999",
      "orgnSlipNo": "12345678902"
    },
    {
      "custCd": "20179999",
      "orgnSlipNo": "12345678903"
    },
    {
      "custCd": "20179999",
      "orgnSlipNo": "12345678904"
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
      "custNm": "테스트1",
      "dlvBranCd": "543",
      "branNm": "브랜드1",
      "fareTy": "010",
      "fareTyNm": "선불",
      "dlvFare": "4000",
      "resultCd": "TRUE",
      "resultMsg": ""
    },
    {
      "custCd": "00000001",
      "custNm": "테스트2",
      "dlvBranCd": "224",
      "branNm": "브랜드2",
      "fareTy": "030",
      "fareTyNm": "신용",
      "dlvFare": "4000",
      "resultCd": "TRUE",
      "resultMsg": ""
    },
    {
      "custCd": "20179999",
      "custNm": "테스트1",
      "dlvBranCd": "302",
      "branNm": "문경",
      "fareTy": "010",
      "fareTyNm": "선불",
      "dlvFare": "5150",
      "resultCd": "TRUE",
      "resultMsg": ""
    },
    {
      "custCd": "00000003",
      "custNm": "테스트4",
      "dlvBranCd": "344",
      "branNm": "브랜드4",
      "fareTy": "010",
      "fareTyNm": "선불",
      "dlvFare": "3850",
      "resultCd": "TRUE",
      "resultMsg": ""
    }
  ],
  "resultCd": "SUCCESS",
  "resultMsg": "총4건 - 처리결과4건 처리 중 4건 성공"
}
```

