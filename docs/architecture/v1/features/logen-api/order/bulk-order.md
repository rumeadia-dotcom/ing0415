# 주문 정보 일괄 등록

> 출처: https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/bulk-order.html
> 화물/택배사: 로젠택배 (logen)
> 섹션: iLOGEN 주문등록
> screenName: `bulk-order`
> 추출 시점: 2026-05-29

---

로젠시스템의 “주문등록출력(복수건)” 화면에서 출력하기 위한 주문데이터를 전송한다.

### URL

개발계:  `https://topenapi.ilogen.com/lrm02b-edi/edi/registerOrderData`

운영계:  `https://openapi.ilogen.com/lrm02b-edi/edi/registerOrderData`

### Input

**HTTP Method: POST**

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| userId | userId | String | 8 | Y | 연동업체코드 | 10358007 | 연동업체코드가 아닌 경우 거래처코드 입력 |
| data (List) | custCd | String | 8 | Y | 거래처코드 | 20179999 |  |
|  | takeDt | String | 8 | Y | 접수일자 | 20250304 |  |
|  | slipNo | String | 11 | N | 운송장번호 | 94000018361 | 20250806 추가(접수된 업체만 활용, 로젠 담당자 문의) |
|  | fixTakeNo | String | 100 | P | 주문번호 | 131000462800101 2 | 외부송장출력팝업 사용시 필수 |
|  | sndCustNm | String | 50 | Y | 송하인명 | 이순신 |  |
|  | sndZipCd | String | 5 | N | 송하인우편번호 |  | 영문주소일때만 사용 |
|  | sndCustAddr | String | 1000 | Y | 송하인주소 (전체) | 서울시 강남구 대치동 포스코센터 서관 10F |  |
|  | sndTelNo | String | 50 | Y | 송하인전화번호 | 0234150001 | 둘 중 하나 필수 |
|  | sndCellNo | String | 50 |  | 송하인휴대폰번호 | 01012345678 |  |
|  | rcvCustNm | String | 50 | Y | 수하인명 | 홍길도 |  |
|  | rcvZipCd | String | 5 | N | 수하인우편번호 |  | 영문주소일때만 사용 |
|  | rcvCustAddr | String | 1000 | Y | 수하인주소 (전체) | 충남 부여군 은산면 내지리 123-1 |  |
|  | rcvTelNo | String | 50 | Y | 수하인전화번호 | 050212345678 | 둘 중 하나 필수 |
|  | rcvCellNo | String | 50 |  | 수하인휴대폰번호 | 01012348765 |  |
|  | fareTy | String | 3 | Y | 운임타입코드 | 030 | 010/020/030/040 |
|  | boxTyCd | String | 5 | N | 박스타입코드 | WS001 |  |
|  | qty | Integer | 1 | Y | 수량 | 2 |  |
|  | dlvFare | Integer | 7 | Y | 택배운임 | 6000 |  |
|  | extraFare | Integer | 7 | N | 할증운임 | 0 |  |
|  | goodsNm | String | 1000 | N | 물품명 | 달력 |  |
|  | goodsAmt | Integer | 7 | N | 물품금액 | 5000 |  |
|  | inQty | Integer | 3 | N | 내품수량 | 1 |  |
|  | goodsOpt | String | 1000 | N | 물품옵션 | 칼라 : 레드 |  |
|  | addOpt | String | 1000 | N | 추가옵션 | 선물 포장 |  |
|  | sndMsg | String | 500 | N | 배송메세지 | 문 앞 |  |
|  | mrgInQty | String | 200 | N | 합포장내품수량 | 1#1#1#1######## |  |
|  | mrgItemCd | String | 2000 | N | 합포장품목코드 |  |  |
|  | mrgItemNm | String | 4000 | N | 합포장품목명 |  |  |
|  | mrgItemOpt | String | 2000 | N | 합포장품목옵션 | 낚시용 도구/용품#낚시용 도구/용품#낚시용 도구/용품#낚시용 도구/용품#낚시용 도구/용품#낚시용 도구/용품#낚시용 도구/용품 |  |
|  | mrgGoodsAmt | String | 1000 | N | 합포장상품금액 | 1280600 |  |
|  | mrgAddOpt | String | 2000 | N | 합포장추가옵션 |  |  |
|  | mrgYn | String | 1 | N | 합포장여부 | Y/N |  |

### Output

Type: **JSONObject**

| Params | column | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data (List) | fixTakeNo | String | 100 | Y | 주문번호 | 131000462800101 2 |  |
|  | resultCd | String | 20 | Y | 결과 | TRUE | TRUE / FALSE |
|  | resultMsg | String | 1000 | N | 내용 | null | 처리 완료 시 null, 에러 시 상세내용 |
| sttsCd | sttsCd | String | 20 | Y | 상태 | SUCCESS |  |
| sttsMsg | sttsMsg | String | 200 | Y | 메시지 | 총2건 - 처리결과 : 2건 처리 중 1건 성공 |  |

### 수정이력

| 날짜 | 수정구분 | 수정내용 |
| --- | --- | --- |
| 2025.08.11 | 최초생성 | 본문 최초 생성 |
| 2026.01.12 | 추가 | addOpt(추가옵션) 입력 파라미터 추가 |

## 요청/응답 예시

**Input**

```json
{
  "userId": "10358007",
  "data": [
    {
      "custCd": "20179999",
      "takeDt": "20250304",
      "slipNo": "94000018361",
      "fixTakeNo": "131000462800101 2",
      "sndCustNm": "포스코",
      "sndZipCd": "",
      "sndCustAddr": "서울시 강남구 대치동 포스코센터 서관 10F",
      "sndTelNo": "12345678",
      "sndCellNo": "01012345678",
      "rcvCustNm": "홍길도",
      "rcvZipCd": "",
      "rcvCustAddr": "충남부여군은산면내지리123-1",
      "rcvTelNo": "050212345678",
      "rcvCellNo": "01012348765",
      "fareTy": "030",
      "boxTyCd": null,
      "qty": 1,
      "dlvFare": 3000,
      "extraFare": 0,
      "goodsNm": "달력",
      "goodsAmt": "5000",
      "inqty": "1",
      "goodsOpt": null,
      "addOpt": "",
      "sndMsg": "문 앞",
      "mrgInQty": "",
      "mrgItemCd": "",
      "mrgItemNm": "",
      "mrgItemOpt": "",
      "mrgGoodsAmt": "",
      "mrgAddOpt": "",
      "mrgYn": ""
    },
    {
      "custCd": "20179999",
      "takeDt": "20250304",
      "slipNo": "94000018361",
      "fixTakeNo": "982347823482",
      "sndCustNm": "홍길동",
      "sndZipCd": "",
      "sndCustAddr": "서울시 강남구 대치동 포스코센터 서관 10F",
      "sndTelNo": "12345678",
      "sndCellNo": "01012345678",
      "rcvCustNm": "김길동",
      "rcvZipCd": "",
      "rcvCustAddr": "충남 부여군 은산면 내지리123-2",
      "rcvTelNo": "'050212345678",
      "rcvCellNo": "01012348765",
      "fareTy": "030",
      "boxTyCd": null,
      "qty": 1,
      "dlvFare": 3000,
      "extraFare": 0,
      "goodsNm": "탁상시계",
      "goodsAmt": "15000",
      "inqty": "1",
      "goodsOpt": null,
      "addOpt": "",
      "sndMsg": "문 앞",
      "mrgInQty": "",
      "mrgItemCd": "",
      "mrgItemNm": "",
      "mrgItemOpt": "",
      "mrgGoodsAmt": "",
      "mrgAddOpt": "",
      "mrgYn": ""
    }
  ]
}
```

**Output**

```json
{
  "data": [
    {
      "fixTakeNo": "131000462800101 2",
      "resultCd": "TRUE",
      "resultMsg": null
    },
    {
      "fixTakeNo": "131000462800101 4",
      "resultCd": "TRUE",
      "resultMsg": ""
    },
    {
      "fixTakeNo": "6100046690708 65",
      "resultCd": "FAIL",
      "resultMsg": "유효한 계약이 없습니다."
    }
  ],
  "sttsCd": "PARTIAL SUCCESS",
  "sttsMsg": "총2건 - 처리결과 : 2건 처리 중 1건 성공"
}
```

