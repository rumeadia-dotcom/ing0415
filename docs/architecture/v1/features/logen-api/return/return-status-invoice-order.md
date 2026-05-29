# 반품 요청 상태 및 송장번호 조회 (주문번호)

> 출처: https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/return-status-invoice-order.html
> 화물/택배사: 로젠택배 (logen)
> 섹션: 반품
> screenName: `return-status-invoice-order`
> 추출 시점: 2026-05-29

---

반품 접수 등록 후 접수(요청) 상태 및 반품 송장번호를 리턴한다. (주문번호로 조회)

### URL

개발계:  `https://topenapi.ilogen.com/lrm02b-edi/edi/inquiryReserveStateFixTakeNo`

운영계:  `https://openapi.ilogen.com/lrm02b-edi/edi/inquiryReserveStateFixTakeNo`

### Input

**HTTP Method: POST**

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| userId | userId | String | 8 | Y | 연동업체코드 | 10358007 | 연동업체코드가 아닌 경우 거래처코드 입력 |
| data (List) | custCd | String | 8 | Y | 거래처코드 | 20179999 | 화주사 테스트코드 |
|  | fixTakeNo | String | 100 | Y | 주문번호 | 240504000001 | 업체에서 사용하는 주문번호 |

### Output

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data (List) | takeNo | String | 12 | Y | 접수번호 | 240504000001 |  |
|  | fixTakeNo | String | 100 | Y | 주문번호 | 240504000001 |  |
|  | resvStat | String | 3 | N | 요청상태코드 | 10 | 10 접수완료 / 20 접수취소 / 30 집하지시 / 40 집하완료 / 50 미집하 / 60 기타 |
|  | slipNo | String | 11 | N | 운송장번호 | 18001014123 |  |
|  | delayCd | String | 3 | N | 미집하사유 | 60 | 10 타택배사반송 / 20 고객장기부재 / 21 고객연락불가 / 22 고객방문희망일 / 23 안심번호(전화연결불가) / 30 반품이중등록 / 40 오등록 / 50 반품취소 / 60 사전반품완료 / 70 고객과의 약속 / 80 집하물품없음 / 90 집하금지품목 / 99 기타 |
|  | procDt | String | 8 | N | 처리일자 | null |  |
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
      "fixTakeNo": "240504000001"
    },
    {
      "custCd": "20179999",
      "fixTakeNo": "240504000002"
    },
    {
      "custCd": "20179999",
      "fixTakeNo": "240504000003"
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
      "fixTakeNo": "240504000001",
      "resvStat": "10",
      "slipNo": "18001014123",
      "delayCd": null,
      "procDt": null,
      "resultCd": "TRUE",
      "resultMsg": null
    },
    {
      "takeNo": "240504000002",
      "fixTakeNo": "240504000002",
      "resvStat": "40",
      "slipNo": "18001014124",
      "delayCd": null,
      "procDt": null,
      "resultCd": "TRUE",
      "resultMsg": null
    },
    {
      "takeNo": "240504000003",
      "fixTakeNo": "240504000003",
      "resvStat": "20",
      "slipNo": "18001014125",
      "delayCd": null,
      "procDt": null,
      "resultCd": "TRUE",
      "resultMsg": null
    }
  ],
  "sttsCd": "SUCCESS",
  "sttsMsg": "총3건 - 처리결과 : 3건 처리 중 3건 성공"
}
```

