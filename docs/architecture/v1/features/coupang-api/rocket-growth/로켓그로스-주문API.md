# 로켓그로스 주문API

> 출처: <https://developers.coupangcorp.com/hc/ko/articles/41129805240473>
> Zendesk article id: `41129805240473`
> 섹션: 로켓그로스 APIs
> 추출 시점: 2026-05-28

---

**API 적용 가능한 구매자 사용자 지역: 한국**

로켓그로스 주문 API는 주문 정보를 프로그래밍 방식으로 검색할 수 있도록 지원합니다. 이 API를 사용하면 주문 동기화, 주문 조사, 수요 기반 의사 결정 지원 도구 등의 분야에서 빠르고 유연하며 맞춤형 애플리케이션을 개발할 수 있습니다.

## Path

GET

/v2/providers/rg\_open\_api/apis/api/v1/vendors/{vendorId}/rg/order/{orderId}

### Sample

[https://api-gateway.coupang.com/v2/providers/rg\_open\_api/apis/api/v1/vendors/A0023456/rg/order/122345566789](https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v4/vendors/A00013264/500000596/ordersheets)

**Request parameters:**

|  |  |  |  |
| --- | --- | --- | --- |
| **Name** | **Required** | **Data type** | **Description** |
| vendorId | O | String | 판매자 ID 쿠팡에서 업체에게 발급한 고유 코드 예) A00012345 |
| orderId | O | Number | 주문번호 본 파라미터는 발주서 목록 조회 일단위를 통해 조회한 발주서 정보에 포함되어 있습니다. |

**Request body:**

None

**Response message:**

| Name | | | Type | Description |
| --- | --- | --- | --- | --- |
| code | | | Number | 서버 응답 코드 |
| message | | | String | 서버 응답 메세지 |
| data | | | Array | 결과리스트  결과가 없을 때는 빈 리스트가 리턴 |
|  | orderId | | Number | 주문번호 |
|  | vendorId | | String | 판매자 ID |
|  | paidAt | | String | 결제일시  yyyy-MM-dd'T'HH:mm:ss |
|  | orderItems | | Array | 주문 정보 목록 |
|  |  | vendorItemId | Number | 옵션ID |
|  |  | productName | String | 상품명 |
|  |  | salesQuantity | Number | 제품의 판매 수량 |
|  |  | salesPrice | String | 제품의 단가 판매 가격 |
|  |  | currency | String | 판매 가격의 통화 |

**Response sample:**

{  
   "code": 200,  
   "message": "SUCCESS",  
   "data": {  
       "vendorId": "A00123456",  
       "orderId": 70000000000,  
       "paidAt": "2024-06-02T17:13:27Z",  
       "orderItems": [  
           {  
               "vendorItemId": 0,  
               "productName": "Nike running shoe size 8",  
               "salesQuantity": 1,  
               "salesPrice": 15000,  
               "currency": "KRW"  
           }  
       ]  
   }  
}

Error Spec

|  |  |  |
| --- | --- | --- |
| **HTTP 상태 코드(오류 유형)** | **오류 메시지** | **해결 방법** |
| 400 (요청변수확인) | 요청에 매개변수가 누락되었거나 매개변수가 유효하지 않아 구문 분석할 수 없습니다. | 해당 매개변수를 추가하세요. |
| 400 (요청변수확인) | 주문 번호가 잘못되었습니다. | 입력하신 주문 번호가 정확한지 확인해 주세요. |
| 400 (요청변수확인) | 다른 판매자의 주문을 조회할 수 없습니다. | 입력하신 판매자 ID(vendorId)가 올바른지 확인하세요. |
