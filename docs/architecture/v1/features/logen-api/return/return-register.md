# 반품 접수 등록

> 출처: https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/return-register.html
> 화물/택배사: 로젠택배 (logen)
> 섹션: 반품
> screenName: `return-register`
> 추출 시점: 2026-05-29

---

반품건을 접수한다. (반품 요청)

### URL

개발계:  `https://topenapi.ilogen.com/lrm02b-edi/edi/registReturnRequest`

운영계:  `https://openapi.ilogen.com/lrm02b-edi/edi/registReturnRequest`

### Input

**HTTP Method: POST**

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| userId | userId | String | 8 | Y | 연동업체코드 | 10358007 (연동업체 테스트코드) | 연동업체코드가 아닌 경우 거래처코드 입력 |
| data (List) | orgnSlipNo | String | 11 | P | 원운송장번호 | 18059359711 | 원송장 번호 없으면 주문번호, 거래처코드 필수 / 있으면 선택 |
| data (List) | fixTakeNo | String | 100 | P | 주문번호 | null | 원송장 번호 없으면 필수 |
| data (List) | custCd | String | 8 | P | 거래처코드 | null | 원송장 번호 없으면 필수 |
| data (List) | sndCustNm | String | 50 | Y | 송하인명 | 홍길동 |  |
| data (List) | sndTelNo | String | 50 | Y | 송하인전화번호 | 01012345678 | 전화번호나 휴대폰번호 둘 중 하나 필수 |
| data (List) | sndCellNo | String | 50 |  | 송하인휴대폰번호 | 01012345878 |  |
| data (List) | sndCustAddr1 | String | 500 | Y | 송하인주소1 | 경기 고양시 일산동구 동국로 111길 강변빌라 103 | 기본주소에 전체주소 입력 가능 |
| data (List) | sndCustAddr2 | String | 500 | N | 송하인주소2 |  |  |
| data (List) | rcvCustNm | String | 50 | Y | 수하인명 | 테스트화주사명 |  |
| data (List) | rcvTelNo | String | 50 | Y | 수하인전화번호 | 01098765432 | 전화번호나 휴대폰번호 둘 중 하나 필수 |
| data (List) | rcvCellNo | String | 50 |  | 수하인휴대폰번호 | 01098765432 |  |
| data (List) | rcvCustAddr1 | String | 500 | Y | 수하인주소1 | 서울 은평구 진관동2 삼호 101-1004 관악로 111 | 기본주소에 전체주소 입력 가능 |
| data (List) | rcvCustAddr2 | String | 500 | N | 수하인주소2 |  |  |
| data (List) | qty | Integer | 1 | Y | 수량 | 1 (고정) |  |
| data (List) | fareTy | String | 3 | Y | 운임타입코드 | 020 | 010/020 |
| data (List) | dlvFare | Integer | 7 | Y | 택배운임 | 5000 | null or 0 불가 |
| data (List) | goodsNm | String | 1000 | N | 물품명 | 토너 |  |
| data (List) | sndMsg | String | 500 | N | 배송메세지 | 반품요청 test\_250328001 |  |

### Output

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data (List) | takeNo | String | 12 | Y | 접수번호 | 240504000001 |  |
| data (List) | fixTakeNo | String | 100 | Y | 주문번호 | null | Input Parameter 값 전달 |
| data (List) | resultCd | String | 20 | Y | 결과 | TRUE | TRUE / FALSE |
| data (List) | resultMsg | String | 1000 | N | 내용 | 정상적으로 처리되었습니다 |  |
| sttsCd | sttsCd | String | 20 | Y | 상태 | SUCCESS | SUCCESS / PARTIAL SUCCESS / FAIL |
| sttsMsg | sttsMsg | String | 200 | Y | 메시지 | 총2건 - 처리결과 : 2건 처리 중 2건 성공 |  |

### 수정이력

| 날짜 | 수정구분 | 수정내용 |
| --- | --- | --- |
| 2025.08.11 | 최초생성 | 본문 최초 생성 |
| 2026.04.29 | 수정 | fareTy 신용(030)/본사신용(040) 제외 적용 |

## 요청/응답 예시

**Input**

```json
{
  "userId": "10358007",
  "data": [
    {
      "orgnSlipNo": "18059359711",
      "sndCustNm": "홍길동",
      "sndTelNo": "01012345678",
      "sndCellNo": null,
      "sndCustAddr1": "경기 고양시 일산동구 동국로 111길",
      "sndCustAddr2": "강변빌라 103",
      "rcvCustNm": "김을동",
      "rcvTelNo": "01098765432",
      "rcvCellNo": null,
      "rcvCustAddr1": "서울은평구진관동2 삼호 101-1004",
      "rcvCustAddr2": "관악로 111",
      "qty": 1,
      "fareTy": "010",
      "dlvFare": 5000,
      "goodsNm": "토너 ",
      "sndMsg": "반품요청 test_250328001",
      "fixTakeNo": null,
      "custCd": null
    },
    {
      "orgnSlipNo": "18059359712",
      "sndCustNm": "홍길동",
      "sndTelNo": "01012345678",
      "sndCellNo": null,
      "sndCustAddr1": "경기 고양시 일산동구 동국로 111길",
      "sndCustAddr2": "강변빌라 103",
      "rcvCustNm": "테스트화주사명",
      "rcvTelNo": "01098765432",
      "rcvCellNo": null,
      "rcvCustAddr1": "서울은평구진관동2 삼호 101-1004",
      "rcvCustAddr2": "관악로 111",
      "qty": 1,
      "fareTy": "010",
      "dlvFare": 5000,
      "goodsNm": "토너1 ",
      "sndMsg": "반품요청 test_250328001",
      "fixTakeNo": null,
      "custCd": null
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
      "fixTakeNo": null,
      "resultCd": "TRUE",
      "resultMsg": "정상적으로 처리되었습니다."
    },
    {
      "takeNo": "240504000002",
      "fixTakeNo": null,
      "resultCd": "TRUE",
      "resultMsg": "정상적으로 처리되었습니다."
    }
  ],
  "sttsCd": "SUCCESS",
  "sttsMsg": "총2건 - 처리결과 : 2건 처리 중 2건 성공"
}
```

