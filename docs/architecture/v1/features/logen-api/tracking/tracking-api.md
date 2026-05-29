# 화물추적 조회

> 출처: https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/tracking-api.html
> 화물/택배사: 로젠택배 (logen)
> 섹션: 화물추적
> screenName: `tracking-api`
> 추출 시점: 2026-05-29

---

운송장번호로 화물추적 상태 전체를 리턴한다.

### URL

개발계:  `https://topenapi.ilogen.com/lrm02b-edi/edi/inquiryCargoTrackingMulti`

운영계:  `https://openapi.ilogen.com/lrm02b-edi/edi/inquiryCargoTrackingMulti`

### Input

**HTTP Method: POST**

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| userId | userId | String | 8 | Y | 연동업체코드 | 10358007 | 연동업체코드가 아닌 경우 거래처코드 입력 |
| data (List) | slipNo | String | 11 | Y | 운송장번호 | 38010101111 |  |

### Output

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data (List) | slipNo | String | 11 | Y | 운송장번호 | 38010101111 |  |
| data1 (List) | scanDt | String | 8 | N | 스캔일자 | 20240501 |  |
|  | scanTm | String | 6 | N | 스캔시각 | 113536 |  |
|  | statNm | String | 100 | N | 화물상태 | 배송완료 |  |
|  | branCd | String | 4 | N | 지점코드 | 226 |  |
|  | branNm | String | 20 | N | 지점명 | 동동강남 |  |
|  | oppBranCd | String | 3 | N | 상대지점코드 | null |  |
|  | oppBranNm | String | 20 | N | 상대지점명 | null |  |
|  | salesCd | String | 8 | N | 영업소코드 | 22610304 |  |
|  | salesNm | String | 20 | N | 영업소명 | 홍길동/대치동 |  |
|  | sndBranNm | String | 20 | N | 배송지점명 | null |  |
|  | rcvBranNm | String | 20 | N | 수하인지점명 | null |  |
|  | acptorTyNm | String | 100 | N | 인수자구분명 | 현관/문앞 |  |
|  | resultCd | String | 20 | Y | 결과 | TRUE | TRUE / FALSE |
|  | resultMsg | String | 1000 | N | 내용 | null | 처리 완료 시 null, 에러 시 상세내용 |
| sttsCd | sttsCd | String | 20 | Y | 상태 | SUCCESS | SUCCESS / PARTIAL SUCCESS / FAIL |
| sttsMsg | sttsMsg | String | 200 | Y | 메시지 | 총2건 - 처리결과 : 2건 처리 중 2건 성공 |  |

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
      "slipNo": "38010101111"
    },
    {
      "slipNo": "38010101112"
    }
  ]
}
```

**Output**

```json
{
  "data": [
    {
      "slipNo": "38010101111",
      "data1": [
        {
          "scanDt": "20240501",
          "scanTm": "063633",
          "statNm": "배송입고",
          "branCd": "226",
          "branNm": "동동강남",
          "oppBranCd": "912",
          "oppBranNm": "이천센터",
          "salesCd": "22610000",
          "salesNm": "동동강남 기본",
          "sndBranNm": "이천센터[912]",
          "rcvBranNm": "동동강남[226]",
          "acptorTyNm": null
        },
        {
          "scanDt": "20240501",
          "scanTm": "064015",
          "statNm": "배송출고",
          "branCd": "226",
          "branNm": "동동강남",
          "oppBranCd": null,
          "oppBranNm": null,
          "salesCd": "22610304",
          "salesNm": "홍길동/대치동",
          "sndBranNm": null,
          "rcvBranNm": null,
          "acptorTyNm": null
        },
        {
          "scanDt": "20240501",
          "scanTm": "131201",
          "statNm": "배송완료",
          "branCd": "226",
          "branNm": "동동강남",
          "oppBranCd": null,
          "oppBranNm": null,
          "salesCd": "22610304",
          "salesNm": "홍길동/대치동",
          "sndBranNm": null,
          "rcvBranNm": null,
          "acptorTyNm": "현관/문앞"
        }
      ],
      "resultCd": "TRUE",
      "resultMsg": null
    },
    {
      "slipNo": "38010101112",
      "data1": [
        {
          "scanDt": "20240501",
          "scanTm": "014829",
          "statNm": "터미널입고",
          "branCd": "912",
          "branNm": "이천센터",
          "oppBranCd": "225",
          "oppBranNm": "남성동",
          "salesCd": "91210000",
          "salesNm": null,
          "sndBranNm": "남성동[225]",
          "rcvBranNm": "이천센터[912]",
          "acptorTyNm": null
        },
        {
          "scanDt": "20240501",
          "scanTm": "015253",
          "statNm": "터미널출고",
          "branCd": "912",
          "branNm": "이천센터",
          "oppBranCd": "226",
          "oppBranNm": "동동강남",
          "salesCd": "91210000",
          "salesNm": null,
          "sndBranNm": "이천센터[912]",
          "rcvBranNm": "동동강남[226]",
          "acptorTyNm": null
        },
        {
          "scanDt": "20240501",
          "scanTm": "065234",
          "statNm": "배송입고",
          "branCd": "226",
          "branNm": "동동강남",
          "oppBranCd": "912",
          "oppBranNm": "이천센터",
          "salesCd": "22610000",
          "salesNm": "동동강남 기본",
          "sndBranNm": "이천센터[912]",
          "rcvBranNm": "동동강남[226]",
          "acptorTyNm": null
        },
        {
          "scanDt": "20240501",
          "scanTm": "065514",
          "statNm": "배송출고",
          "branCd": "226",
          "branNm": "동동강남",
          "oppBranCd": null,
          "oppBranNm": null,
          "salesCd": "22610304",
          "salesNm": "홍길동/대치동",
          "sndBranNm": null,
          "rcvBranNm": null,
          "acptorTyNm": null
        },
        {
          "scanDt": "20240501",
          "scanTm": "122727",
          "statNm": "배송완료",
          "branCd": "226",
          "branNm": "동동강남",
          "oppBranCd": null,
          "oppBranNm": null,
          "salesCd": "22610304",
          "salesNm": "홍길동/대치동",
          "sndBranNm": null,
          "rcvBranNm": null,
          "acptorTyNm": "현관/문앞"
        }
      ],
      "resultCd": "TRUE",
      "resultMsg": null
    }
  ],
  "sttsCd": "SUCCESS",
  "sttsMsg": "총2건 - 처리결과 : 2건 처리 중 2건 성공"
}
```

