# 로켓그로스 주문 API(목록 쿼리)

> 출처: <https://developers.coupangcorp.com/hc/ko/articles/41131195825433>
> Zendesk article id: `41131195825433`
> 섹션: 로켓그로스 APIs
> 추출 시점: 2026-05-28

---

**API 적용 가능한 구매자 사용자 지역: 한국**

로켓그로스 주문 API를 사용하면 프로그래밍 방식으로 주문 정보를 검색할 수 있습니다. 이 API를 사용하면 주문 동기화, 주문 조사, 수요 기반 의사 결정 지원 도구 등의 분야에서 빠르고 유연하며 맞춤형 애플리케이션을 개발할 수 있습니다. Order API는 [출고일] 이후의 주문을 지원합니다.

이 인터페이스는 분당 50회 호출로 제한됩니다.

## Path

GET

/v2/providers/rg\_open\_api/apis/api/v1/vendors/{vendorId}/rg/orders

### Example:

[https://api-gateway.coupang.com/v2/providers/rg\_open\_api/apis/api/v1/vendors/`A00123456`/rg/orders](https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v4/vendors/A00013264/500000596/ordersheets)

**Request parameters:**

|  |  |  |  |
| --- | --- | --- | --- |
| Name | Required | Data type | Description |
| vendorId | O | String | 판매자 ID 쿠팡에서 업체에게 발급한 고유 코드 예) A00012345 |
| **paidDateFrom** | O | String | 검색 시작일시  yyyymmdd 형태로 조회하기 원하는 시작 날짜 기입 ex) 20240709 |
| **paidDateTo** | O | String | 검색 종료일시  yyyymmdd 형태로 조회하기 원하는 종료 날짜 기입 ex) 20240709  최대 30일까지 조회 가능합니다. |
| **nextToken** |  | String | 결과 문자열 목록은 다음 결과 페이지를 가져오는 데 사용됩니다. nextToken이 반환되면 nextToken 값이 다음 요청으로 전달됩니다. nextToken이 반환되지 않으면 더 이상 반환할 내용이 없습니다. |

Request body:

None

Response message:

| Name | | | | | Type | Description |
| --- | --- | --- | --- | --- | --- | --- |
| code | | | | | Number | 서버 응답 코드 |
| message | | | | | String | 서버 응답 메세지 |
| data | | | | | Array | 결과리스트  결과가 없을 때는 빈 리스트가 리턴 |
|  | orderId | | | | Number | 주문번호 |
|  | vendorId | | | | String | 판매자 ID |
|  | paidAt | | | | String | 결제일시 (Time stamp)  1746093162000 |
|  | orderItems | | | | Array | 주문 정보 목록 |
|  |  | vendorItemId | | | Number | 옵션ID |
|  |  | productName | | | String | 상품명 |
|  |  | salesQuantity | | | Number | 제품의 판매 수량 |
|  |  | salesPrice | | | String | 제품의 단가 판매 가격 |
|  |  | currency | | | String | 판매 가격의 통화 |

**Response message sample:**

{  
   "code": 200,  
   "message": "SUCCESS",  
   "data": [  
       {  
           "vendorId": "A00123456",  
           "orderId": 70000000000,  
           "paidAt": "1746093162000"

           "orderItems": [  
               {  
                   "vendorItemId": 0,  
                   "productName": "Nike running shoe size 7",  
                   "salesQuantity": 1,  
                   "unitSalesPrice": 27800,  
                   "currency": "KRW"  
               }  
           ]  
       },  
       {  
           "vendorId": "A00123456",  
           "orderId": 70000000001,  
           "paidAt": "1746093162000"

           "orderItems": [  
               {  
                   "vendorItemId": 0,  
                   "productName": "Nike running shoe size 8",  
                   "salesQuantity": 2,  
                   "unitSalesPrice": 24900,  
                   "currency": "KRW"  
               }  
           ]  
       }  
   ],  
   "nextToken": "17189443970001139254740404666368"  
}

Error Spec

|  |  |  |
| --- | --- | --- |
| **HTTP 상태 코드(오류 유형)** | **오류 메시지** | **해결 방법** |
| 400 (요청변수확인) | 요청에 매개변수가 누락되었거나 매개변수가 유효하지 않아 구문 분석할 수 없습니다. | 해당 매개변수를 추가하세요. |
| 400 (요청변수확인) | 다른 판매자의 주문을 조회할 수 없습니다. | 입력하신 판매자 ID(vendorId)가 올바른지 확인하세요. |
