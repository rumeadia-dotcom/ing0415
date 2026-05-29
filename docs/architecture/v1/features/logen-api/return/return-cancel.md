# 반품 취소 등록

> 출처: https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/return-cancel.html
> 화물/택배사: 로젠택배 (logen)
> 섹션: 반품
> screenName: `return-cancel`
> 추출 시점: 2026-05-29

---

접수한 반품건을 취소한다.

### URL

개발계:  `https://topenapi.ilogen.com/lrm02b-edi/edi/cancelReserveState`

운영계:  `https://openapi.ilogen.com/lrm02b-edi/edi/cancelReserveState`

### Input

**HTTP Method: POST**

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| userId | userId | String | 8 | Y | 연동업체코드 | 10358007 | 연동업체코드가 아닌 경우 거래처코드 입력 |
| data (List) | custCd | String | 8 | Y | 거래처코드 | 20179999 | 화주사 테스트코드 |
|  | takeNo | String | 12 | Y | 접수번호 | 240504000001 |  |

### Output

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data (List) | takeNo | String | 12 | Y | 접수번호 | 240504000001 |  |
|  | resvStat | String | 3 | N | 요청상태코드 | 030 | 030 (취소) |
|  | resultCd | String | 20 | Y | 결과 | TRUE | TRUE / FALSE |
|  | resultMsg | String | 1000 | N | 내용 | null | 처리 완료 시 null, 에러 시 상세내용 |
| sttsCd | sttsCd | String | 20 | Y | 상태 | PARTIAL SUCCESS | SUCCESS / PARTIAL SUCCESS / FAIL |
| sttsMsg | sttsMsg | String | 200 | Y | 메시지 | 총2건 - 처리결과 : 2건 처리 중 1건 성공 | 총X건 - 처리결과 : X건 처리 중 X건 성공 |

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
      "takeNo": "240504000001"
    },
    {
      "custCd": "20179999",
      "takeNo": "240504000002"
    }
  ]
}
```

**Output**

```json
{
  "data": [
    {
      "takeNo": "240504000001",
      "resvStat": "030",
      "resultCd": "TRUE",
      "resultMsg": ""
    },
    {
      "takeNo": "240504000002",
      "resvStat": "030",
      "resultCd": "FAIL",
      "resultMsg": "이미 취소된 예약접수번호 입니다."
    }
  ],
  "sttsCd": "PARTIAL SUCCESS",
  "sttsMsg": "총2건 - 처리결과 : 2건 처리 중 1건 성공"
}
```

