# 로켓창고 재고 API

> 출처: <https://developers.coupangcorp.com/hc/ko/articles/41090779386521>
> Zendesk article id: `41090779386521`
> 섹션: 로켓그로스 APIs
> 추출 시점: 2026-05-28

---

로켓성장 재고 요약 API는 쿠팡의 국내 로켓 물류센터(Local Korean Rocket Warehouses)에 있는 상품의 재고 정보를 프로그램 연동을 통해 조회할 수 있도록 지원합니다.

이 API는 재고 요약 목록을 반환합니다. 반환되는 요약 정보는 `vendorIdItemId` 파라미터의 제공 여부에 따라 달라집니다:

* `vendorIdItemId` 파라미터를 생략하면, API는 사용 가능한 모든 상품에 대한 재고 요약 정보를 반환합니다.
* `vendorIdItemId` 파라미터가 제공되면, 해당 `vendorIdItemId`에 대한 재고 요약 정보만 반환되며, 이 경우 `nextToken` 파라미터는 무시됩니다.
* `vendorId`와 `nextToken` 파라미터가 모두 제공되면, API는 `nextToken` 이후부터 시작하는 모든 상품의 재고 요약 정보를 반환합니다.

**중요 안내:**  
API 호출 빈도는 **분당 50회 이하**로 제한해 주시기 바랍니다.  
이를 초과할 경우, 과도한 요청으로 인해 오류가 발생할 수 있습니다.

## **경로**

GET

/v2/providers/rg\_open\_api/apis/api/v1/vendors/{vendorId}/rg/inventory/summaries

### **예시 엔드포인트**

https://api-gateway.coupang.com/v2/providers/rg\_open\_api/apis/api/v1/vendors/{vendorId}/rg/inventory/summaries

## **요청 파라미터**

### **경로 세그먼트 파라미터**

|  |  |  |  |
| --- | --- | --- | --- |
| **Name** | **Required** | **Type** | **Description** |
| **vendorId** | O | String | **판매자 벤더 ID** 벤더 ID는 \*\*A로 시작하는 문자열 (예: Axxxx)\*\*이며 |
| **vendorItemId** |  | String | 단일 `vendorItemId`를 통해 특정 판매자의 SKU 재고 요약 정보를 조회할 때 사용됩니다 |
| **nextToken** |  | String | 이전 요청의 응답에서 반환된 문자열 토큰으로, **페이징 처리**에 사용됩니다. |

### **요청 예시**

요청 본문 파라미터는 필요하지 않습니다**.**

## **응답 메시지**

|  |  |  |  |  |
| --- | --- | --- | --- | --- |
| **Name** | | | **Type** | **Description** |
| code | | | String | **결과 코드**:   SUCCESS/ERROR |
| message | | | String | **결과 메시지** |
| data | | | List | 유효한 정보 |
|  | vendorId | | String | 쿠팡에서 판매자에게 부여한 고유 코드 |
|  | vendorItemId | | String | 단일 상품에 대한 고유 식별자 |
|  | `externalSkuId` | | String | 판매자가 정의한 SKU ID |
|  | `inventoryDetails` | |  | 특정 SKU에 대한 재고 세부 정보 |
|  |  | `totalOrderableQuantity` | Integer | 해당 상품의 주문 가능 수량 총합 |
|  | `salesCountMap` | |  | 판매 정보 |
|  |  | `SALES_COUNT_LAST_THIRTY_DAYS` | Integer | 최근 30일간 판매된 수량 |
| `nextToken` | | | String | 페이징 토큰 |

### **응답 예시**

`{`

`"code": 200,`

`"message": "SUCCESS",`

`"data": [`

`{`

`"vendorId": "A00123456",`

`"vendorItemId": 70000000000,`

`"externalSkuId": 10012345,`

`"inventoryDetails": {`

`"totalOrderableQuantity": 10`

`},`

`"salesCountMap": {`

`"SALES_COUNT_LAST_THIRTY_DAYS": 15`

`}`

`},`

`{`

`"vendorId": "A00123456",`

`"vendorItemId": 70000000001,`

`"externalSkuId": 10012346,`

`"inventoryDetails": {`

`"totalOrderableQuantity": 20`

`},`

`"salesCountMap": {`

`"SALES_COUNT_LAST_THIRTY_DAYS": 25`

`}`

`}`

`],`

`"nextToken": "2"`

`}`

### **오류 사양**

| HTTP status code (error type) | Error message | **해결 방법** |
| --- | --- | --- |
| 400 | Request has missing or invalid parameters and cannot be parsed. | 요청에 필수 파라미터가 누락되었거나 잘못된 파라미터가 포함되어 있어 요청을 처리할 수 없습니다. 필수 파라미터를 정확히 입력해 주세요. |
| **429** | Too Many Requests | 요청을 중단하고 잠시 후 다시 시도해 주세요. |

###
