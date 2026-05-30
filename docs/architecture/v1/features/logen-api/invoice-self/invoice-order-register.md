# 송장 출력 주문 정보 등록

> 출처: https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/invoice-order-register.html
> 화물/택배사: 로젠택배 (logen)
> 섹션: 자체 시스템 송장출력
> screenName: `invoice-order-register`
> 추출 시점: 2026-05-29

---

출력된 송장(주문) 정보를 전송한다.

### URL

개발계:  `https://topenapi.ilogen.com/lrm02b-edi/edi/slipPrintM`

운영계:  `https://openapi.ilogen.com/lrm02b-edi/edi/slipPrintM`

### Input

**HTTP Method: POST**

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| userId | userId | String | 8 | Y | 연동업체코드 | 10358007 | 연동업체 테스트코드 |
| data | printYn | String | 1 | Y | 출력여부 | Y | 자체출력(Y) |
|  | slipNo | String | 11 | Y | 운송장번호 | 970000001 | 송장 재발행 시 신규 채번 필수 |
|  | slipTy | String | 3 | P | 주문구분 | 100 | 값이 없을 때 기본으로 100 |
|  | orgnSlipNo | String | 11 | N | 원운송장번호 |  | 사용안함 |
|  | custCd | String | 8 | Y | 거래처코드 | 20179999 |  |
|  | sndCustNm | String | 50 | Y | 송하인명 | 손흥민 |  |
|  | sndTelNo | String | 50 | Y | 송하인전화번호 | 0298765438 |  |
|  | sndCellNo | String | 50 |  | 송하인휴대폰번호 | 01099887767 |  |
|  | sndZipCd | String | 5 | P | 송하인우편번호 | 63115 | 영문주소일때만 사용 |
|  | sndCustAddr1 | String | 500 | Y | 송하인주소1 | 제주 제주시 공항로 2 제주국제공항 공항1동 테스트 |  |
|  | sndCustAddr2 | String | 500 | Y | 송하인주소2 |  |  |
|  | rcvCustNm | String | 50 | Y | 수하인명 | 홍길동 |  |
|  | rcvTelNo | String | 50 | Y | 수하인전화번호 | 0212346781 |  |
|  | rcvCellNo | String | 50 |  | 수하인휴대폰번호 | 01056786781 |  |
|  | rcvZipCd | String | 5 | P | 수하인우편번호 | 26131 | 영문주소일때만 사용 |
|  | rcvCustAddr1 | String | 500 | Y | 수하인주소1 | 강원 정선군 봉양3길 21 정선군청 1층 |  |
|  | rcvCustAddr2 | String | 500 | Y | 수하인주소2 |  |  |
|  | fareTy | String | 3 | Y | 운임타입코드 | 020 | 010/020/030/040 |
|  | qty | Integer | 1 | Y | 수량 | 1 | 고정 |
|  | rcvBranCd | String | 3 | Y | 배송점코드 | 244 |  |
|  | goodsNm | String | 1000 | N | 물품명 | 자두맛캔디 |  |
|  | dlvFare | Integer | 7 | Y | 택배운임 | 3000 |  |
|  | extraFare | Integer | 7 | Y | 할증운임 | 2000 | 기본값 0 |
|  | goodsAmt | Integer | 7 | Y | 물품금액 | 50000 | 기본값 0 |
|  | jejuAmtTy | String | 3 | N | 제주운임유형 | 010 | 제주지역시 운임타입코드와 동일 |
|  | shipYn | String | 1 | N | 연륙도서여부 | N | Y/N |
|  | takeDt | String | 8 | Y | 접수일자 | 20250410 |  |
|  | remarks | String | 1000 | N | 비고 | 비고입니다. |  |
|  | fixTakeNo | String | 100 | N | 주문번호 |  |  |
|  | jejuAmt | Integer | 7 | N | 제주운임 | 0 |  |
|  | shipFare | Integer | 7 | N | 연륙도서운임 | 0 |  |
|  | montFare | Integer | 22 | N | 산간운임 | 0 |  |
|  | wt | Integer | 3 | P | 중량 | 0 |  |

### Output

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data | slipNo | String | 11 | N | 값 | 10000000000 | 송장번호 |
|  | resultCd | String | 20 | N | 값 | TRUE | TRUE/FALSE |
|  | resultMsg | String | 1000 | N | 값 |  | 성공시 "" |
| sttsCd | sttsCd | String | 20 | Y | 상태 | SUCCESS |  |
| sttsMsg | sttsMsg | String | 200 | Y | 메시지 | 총1건 - 처리결과 : 1건 처리 중 1건 성공 |  |

### 수정이력

| 날짜 | 수정구분 | 수정내용 |
| --- | --- | --- |
| 2025.08.11 | 최초생성 | 본문 최초 생성 |
| 2026.04.29 | 수정 | 제주운임 착불시 필수 제외 (제주운임 정액제 시행) |

## 요청/응답 예시

**Input**

```json
{
  "userId": "10358007",
  "data": [
    {
      "printYn": "Y",
      "slipNo": "97000000001",
      "slipTy": "100",
      "orgnSlipNo": "",
      "custCd": "20179999",
      "sndCustNm": "손흥민",
      "sndTelNo": "0298765438",
      "sndCellNo": "01099887767",
      "sndZipCd": "63115",
      "sndCustAddr1": "제주 제주시 공항로 2 제주국제공항",
      "sndCustAddr2": "공항1동 테스트",
      "rcvCustNm": "홍길동",
      "rcvTelNo": "0212346781",
      "rcvCellNo": "01056786781",
      "rcvZipCd": "26131",
      "rcvCustAddr1": "강원 정선군 봉양3길 21 정선군청",
      "rcvCustAddr2": "1층 테스트",
      "fareTy": "020",
      "qty": "1",
      "rcvBranCd": "244",
      "goodsNm": "자두맛캔디",
      "dlvFare": "3000",
      "extraFare": "2000",
      "goodsAmt": "50000",
      "jejuAmtTy": "N",
      "shipYn": "N",
      "takeDt": "20250410",
      "remarks": "비고입니다.",
      "fixTakeNo": "",
      "jejuAmt": "0",
      "shipFare": "0",
      "montFare": "0",
      "wt": "0"
    }
  ]
}
```

**Output**

```json
{
  "data": [
    {
      "slipNo": "10000000000",
      "resultCd": "TRUE",
      "resultMsg": ""
    }
  ],
  "sttsCd": "SUCCESS",
  "sttsMsg": "총1건 - 처리결과 : 1건 처리 중 1건 성공"
}
```

