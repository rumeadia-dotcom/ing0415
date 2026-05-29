# 물품금액에 따른 할증운임 조회

> 출처: https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/etc.html
> 화물/택배사: 로젠택배 (logen)
> 섹션: 기타
> screenName: `etc`
> 추출 시점: 2026-05-29

---

물품금액, 택배운임에 따른 할증운임을 조회한다. (주문 정보 일괄 등록, 송장 출력 주문 정보 등록 사용시 조회)

### URL

개발계:  `https://topenapi.ilogen.com/lrm02b-edi/edi/custExtraFare`

운영계:  `https://openapi.ilogen.com/lrm02b-edi/edi/custExtraFare`

### Input

**HTTP Method: POST**

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| userId | userId | String | 8 | Y | 연동업체코드 | 10358007 | 연동업체 테스트코드 |
| data (List) | custCd | String | 8 | Y | 거래처코드 | 20179999 | 화주사 테스트코드 |
|  | fareTy | String | 3 | Y | 운임타입코드 | 010 |  |
|  | qty | Integer | 1 | N | 수량 | 10 | 고정 |
|  | goodsAmt | Integer | 7 | N | 물품금액 | 15000000 |  |
|  | dlvFare | Integer | 7 | N | 택배운임 | 45000 |  |

### Output

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data (List) | custCd | String | 8 | Y | 거래처코드 | 20179999 |  |
|  | fareTy | String | 3 | Y | 운임타입코드 | 010 |  |
|  | goodsAmt | Integer | 7 | Y | 물품금액 | 15000000 |  |
|  | dlvFare | Integer | 7 | Y | 택배운임 | 45000 |  |
|  | extraFare | Integer | 7 | Y | 할증운임 | 42750 |  |
|  | resultCd | String | 20 | Y | 결과 | TRUE | TRUE / FALSE |
|  | resultMsg | String | 1000 | N | 내용 | null | 처리 완료 시 null, 에러 시 상세내용 |
| sttsCd | sttsCd | String | 20 | Y | 상태 | SUCCESS | SUCCESS(성공 시) / PARTIAL SUCCESS(부분 성공 시) / FAIL(오류 시) |
| sttsMsg | sttsMsg | String | 200 | Y | 메시지 | 조회결과 2 건 중, 2 건 성공 | 조회결과 N 건 중, N 건 성공(성공 시) / 오류메시지(오류 시) |

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
      "fareTy": "010",
      "qty": "10",
      "goodsAmt": "15000000",
      "dlvFare": "45000"
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
      "fareTy": "010",
      "goodsAmt": 15000000,
      "dlvFare": 45000,
      "extraFare": 42750,
      "resultCd": "TRUE",
      "resultMsg": ""
    }
  ],
  "sttsCd": "SUCCESS",
  "sttsMsg": "조회결과 1 건 중, 1 건 성공"
}
```

