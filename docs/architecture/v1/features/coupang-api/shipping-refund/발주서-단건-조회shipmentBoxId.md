# 발주서 단건 조회(shipmentBoxId)

> 출처: <https://developers.coupangcorp.com/hc/ko/articles/360033792854>
> Zendesk article id: `360033792854`
> 섹션: 배송 / 환불 APIs
> 추출 시점: 2026-05-28

---

**API 적용 가능한 구매자 사용자 지역: 한국, 대만**

shipmentBoxId를 이용하여 발주서 단건을 조회하는 API입니다.

결제완료 상태에서 고객이 배송지를 변경할 수 있기 때문에  
상품준비중 처리 이후에 꼭! 발주서 단건 조회를 통해 배송지 정보("receiver")가 변경되었는지 확인 및 업데이트를 해 주셔야 합니다.

* 출고 전, "sellerProductName + sellerProductItemName"과 "vendorItemName"의 정보가 일치하는지 반드시 확인해주시기 바랍니다.
* **구성, 수량, 용량 등이 다르게 노출**되고 있는 경우, 출고를 보류해주시고 온라인 문의 접수해주시면 빠르게 도움 드리도록 하겠습니다. ( [상품 정보가 잘못 노출되고 있습니다. > '네'](https://helpseller.coupangcorp.com/hc/ko/requests/new?ticket_form_id=360000651672) 선택하여 접수해주세요.)
* 오노출로 확인되는 경우, 반영된 판매자 점수는 원복됩니다.

## Path

GET

/v2/providers/openapi/apis/api/v5/vendors/{vendorId}/ordersheets/{shipmentBoxId}

### Example Endpoint

https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v5/vendors/A00000001/ordersheets/642538971006401429

## Request Parameters

### Path Segment Parameter

| Name | | | | | Required | Type | Description |
| --- | --- | --- | --- | --- | --- | --- | --- |
| vendorId | | | | | O |  | 업체코드  쿠팡에서 업체에게 발급한 고유 코드  Wing 로그인 후, 확인 가능 |
| shipmentBoxId | | | | | O |  | 배송번호(묶음배송번호)  Wing 또는, 발주서 목록 조회 분단위/일단위를 통해 조회  shipmentBoxId는 Number type입니다. |

### Request Example

not require body

## Response Message

| Name | | | | | Type | Description |
| --- | --- | --- | --- | --- | --- | --- |
| code | | | | | Number | 서버 응답 코드 |
| message | | | | | String | 서버 응답 메세지 |
| data | | | | | Object |  |
|  | shipmentBoxId | | | | Number | 배송번호 |
|  | orderId | | | | Number | 주문번호 |
|  | orderedAt | | | | String | 주문일시（[ISO-8601](https://en.wikipedia.org/wiki/ISO_8601)표준을 준수해야 합니다.）  YYYY-MM-DDThh:mm:ss.ssssss±hh:mm |
|  | orderer | | | | Object | 주문자 정보 |
|  |  | name | | | String | 주문자 이름 |
|  |  | email | | | String | 주문자 E-mail  미사용(빈값) |
|  |  | safeNumber | | | String | 수취인 연락처(안심번호)（[E.164](https://en.wikipedia.org/wiki/E.164)표준을 준수해야 합니다.） |
|  |  | ordererNumber | | | String | 주문자 연락처(실전화번호)（[E.164](https://en.wikipedia.org/wiki/E.164)표준을 준수해야 합니다.）  null |
|  | paidAt | | | | String | 결제일시（[ISO-8601](https://en.wikipedia.org/wiki/ISO_8601)표준을 준수해야 합니다.）  YYYY-MM-DDThh:mm:ss.ssssss±hh:mm |
|  | status | | | | String | 발주서상태  | STATUS | MEANING | | --- | --- | | ACCEPT | 결제완료 | | INSTRUCT | 상품준비중 | | DEPARTURE | 배송지시 | | DELIVERING | 배송중 | | FINAL\_DELIVERY | 배송완료 | | NONE\_TRACKING | 업체 직접 배송(배송 연동 미적용), 추적불가 | |
|  | shippingPrice | | | | Object | 배송비 |
|  |  | currencyCode | | | String | 통화 코드 ([ISO-4217](https://en.wikipedia.org/wiki/ISO_4217) 표준 준수), 대문자 3개 |
|  |  | units | | | Number | 통화 정수 부분, 64 bit |
|  |  | nanos | | | Number | 통화 소수점 부분, 32 bit, 값 범위 [-9999999999, 999999999] |
|  | remotePrice | | | | Object | 도서산간배송비 |
|  |  | currencyCode | | | String | 통화 코드 ([ISO-4217](https://en.wikipedia.org/wiki/ISO_4217) 표준 준수), 대문자 3개 |
|  |  | units | | | Number | 통화 정수 부분, 64 bit |
|  |  | nanos | | | Number | 통화 소수점 부분, 32 bit, 값 범위 [-9999999999, 999999999] |
|  | remoteArea | | | | Boolean | 도서산간여부 |
|  | parcelPrintMessage | | | | String | 배송메세지 |
|  | splitShipping | | | | Boolean | 분리배송여부 |
|  | ableSplitShipping | | | | Boolean | 분리배송가능여부 |
|  | receiver | | | | Object | 수취인 정보 |
|  |  | name | | | String | 수취인 이름 |
|  |  | safeNumber | | | String | 수취인 연락처(안심번호)（[E.164](https://en.wikipedia.org/wiki/E.164)표준을 준수해야 합니다.） |
|  |  | receiverNumber | | | String | 수취인 연락처(실전화번호)（[E.164](https://en.wikipedia.org/wiki/E.164)표준을 준수해야 합니다.）  null |
|  |  | addr1 | | | String | 수취인 배송지1 |
|  |  | addr2 | | | String | 수취인 배송지2 |
|  |  | postCode | | | String | 수취인 우편번호 |
|  | orderItems | | | | Array | 주문 상품 정보 |
|  |  | vendorItemPackageId | | | Number | vendorItemPackageId  미사용 / 없는 경우 0으로 리턴 |
|  |  | vendorItemPackageName | | | String | vendorItemPackageName  미사용 |
|  |  | productId | | | Number | 노출상품ID  없는 경우 0으로 리턴 |
|  |  | vendorItemId | | | Number | 옵션ID |
|  |  | vendorItemName | | | String | 노출상품명 |
|  |  | shippingCount | | | Number | shippingCount = 주문시 item의 구매 수량  holdCountForCancel = 취소가 되어 환불 예정이 수량 cancelCount = 취소가 확정된 수량 발주 가능 수량 = shippingCount - (holdCountForCancel + cancelCount ) |
|  |  | salesPrice | | | Object | 개당 상품 가격(price of one item) |
|  |  |  | currencyCode | | String | 통화 코드 ([ISO-4217](https://en.wikipedia.org/wiki/ISO_4217) 표준 준수), 대문자 3개 |
|  |  |  | units | | Number | 통화 정수 부분, 64 bit |
|  |  |  | nanos | | Number | 통화 소수점 부분, 32 bit, 값 범위 [-9999999999, 999999999] |
|  |  | orderPrice | | | Object | 결제 가격 : salesPrice\*shippingCount |
|  |  |  | currencyCode | | String | 통화 코드 ([ISO-4217](https://en.wikipedia.org/wiki/ISO_4217) 표준 준수), 대문자 3개 |
|  |  |  | units | | Number | 통화 정수 부분, 64 bit |
|  |  |  | nanos | | Number | 통화 소수점 부분, 32 bit, 값 범위 [-9999999999, 999999999] |
|  |  | discountPrice | | | Object | 총 할인 가격 discountPrice(총 할인 금액) =  instantCouponDiscount(즉시할인 쿠폰) +  downloadableCoupon(다운로드 쿠폰) +  coupangDiscount(쿠팡 지원 할인) |
|  |  |  | currencyCode | | String | 통화 코드 ([ISO-4217](https://en.wikipedia.org/wiki/ISO_4217) 표준 준수), 대문자 3개 |
|  |  |  | units | | Number | 통화 정수 부분, 64 bit |
|  |  |  | nanos | | Number | 통화 소수점 부분, 32 bit, 값 범위 [-9999999999, 999999999] |
|  |  | instantCouponDiscount | | | Object | 즉시할인 쿠폰  즉시할인 쿠폰 할인 금액 |
|  |  |  | currencyCode | | String | 통화 코드 ([ISO-4217](https://en.wikipedia.org/wiki/ISO_4217) 표준 준수), 대문자 3개 |
|  |  |  | units | | Number | 통화 정수 부분, 64 bit |
|  |  |  | nanos | | Number | 통화 소수점 부분, 32 bit, 값 범위 [-9999999999, 999999999] |
|  |  | downloadableCouponDiscount | | | Object | 다운로드 쿠폰  다운로드 쿠폰 할인 금액 |
|  |  |  | currencyCode | | String | 통화 코드 ([ISO-4217](https://en.wikipedia.org/wiki/ISO_4217) 표준 준수), 대문자 3개 |
|  |  |  | units | | Number | 통화 정수 부분, 64 bit |
|  |  |  | nanos | | Number | 통화 소수점 부분, 32 bit, 값 범위 [-9999999999, 999999999] |
|  |  | coupangDiscount | | | Object | 쿠팡 지원 할인  쿠팡 지원 장바구니 / 카테고리 쿠폰 등의 금액 |
|  |  |  | currencyCode | | String | 통화 코드 ([ISO-4217](https://en.wikipedia.org/wiki/ISO_4217) 표준 준수), 대문자 3개 |
|  |  |  | units | | Number | 통화 정수 부분, 64 bit |
|  |  |  | nanos | | Number | 통화 소수점 부분, 32 bit, 값 범위 [-9999999999, 999999999] |
|  |  | externalVendorSkuCode | | | String | 업체 외부 상품 코드 |
|  |  | etcInfoHeader | | | String | 상품별 개별 입력 항목  optional |
|  |  | etcInfoValue | | | String | 상품별 개별 입력 항목에 대한 사용자의 입력값  optional  미사용 |
|  |  | etcInfoValues | | | Array | 상품별 개별 입력 항목에 대한 사용자의 입력값 리스트  optional |
|  |  | sellerProductId | | | Number | 등록상품ID |
|  |  | sellerProductName | | | String | 등록상품명 |
|  |  | sellerProductItemName | | | String | 등록옵션명 |
|  |  | firstSellerProductItemName | | | String | 최초등록옵션명 |
|  |  | cancelCount | | | Number | 취소수량 |
|  |  | holdCountForCancel | | | Number | 환불대기수량 |
|  |  | estimatedShippingDate | | | String | 주문 시 출고예정일（[ISO-8601](https://en.wikipedia.org/wiki/ISO_8601)표준을 준수해야 합니다.）  yyyy-MM-dd |
|  |  | plannedShippingDate | | | String | 실제 출고예정일 (분리배송 시)（[ISO-8601](https://en.wikipedia.org/wiki/ISO_8601)표준을 준수해야 합니다.）  yyyy-MM-dd |
|  |  | invoiceNumberUploadDate | | | String | 운송장번호 업로드 일시（[ISO-8601](https://en.wikipedia.org/wiki/ISO_8601)표준을 준수해야 합니다.）  YYYY-MM-DDThh:mm:ss.ssssss±hh:mm |
|  |  | extraProperties | | | Object | 업체상품옵션 추가 정보  key:value 형태 |
|  |  | pricingBadge | | | Boolean | 쿠런티(최저가 상품 여부)  true/false |
|  |  | usedProduct | | | Boolean | 중고 상품 여부  true/false |
|  |  | confirmDate | | | String | 구매확정일자（[ISO-8601](https://en.wikipedia.org/wiki/ISO_8601)표준을 준수해야 합니다.）  YYYY-MM-DDThh:mm:ss.ssssss±hh:mm |
|  |  | deliveryChargeTypeName | | | String | 배송비구분  유료, 무료 |
|  |  | upBundleVendorItemId | | | Number | 자동생성옵션 ID |
|  |  | upBundleVendorItemName | | | String | 자동생성옵션 노출상품명 |
|  |  | upBundleSize | | | Number | 자동생성옵션 개수 |
|  |  | upBundleItem | | | Boolean | 자동생성옵션 아이템 여부 true/false |
|  |  | canceled | | | Boolean | 주문 취소 여부  true/false |
|  | overseaShippingInfoDto | | | | Object | 해외배송정보 |
|  |  | personalCustomsClearanceCode | | | String | 개인통관 고유부호 |
|  |  | orderersSsn | | | String | 미사용(Not in use) |
|  |  | ordererPhoneNumber | | | String | 통관용 수신자 전화번호（[E.164](https://en.wikipedia.org/wiki/E.164)표준을 준수해야 합니다.） |
|  | deliveryCompanyName | | | | String | 택배사  Ex: CJ 대한통운,한진택배... |
|  | invoiceNumber | | | | String | 운송장번호 |
|  | inTrasitDateTime | | | | String | 출고일(발송일)（[ISO-8601](https://en.wikipedia.org/wiki/ISO_8601)표준을 준수해야 합니다.）  YYYY-MM-DDThh:mm:ss.ssssss±hh:mm |
|  | deliveredDate | | | | String | 배송완료일（[ISO-8601](https://en.wikipedia.org/wiki/ISO_8601)표준을 준수해야 합니다.）  YYYY-MM-DDThh:mm:ss.ssssss±hh:mm |
|  | refer | | | | String | 결제위치  아이폰앱,안드로이드앱,PC웹 |
|  | shipmentType | | | | String | 배송유형  THIRD\_PARTY, CGF, CGF LITE |
|  | isCod | | | | Boolean | 주문이 현금결제(착불/COD) 방식입니까  `true`/`false` |
|  | extraProperties | | | | Object | 주문 속성의 기타 정보  `key:value` 형식  세금 계산서(인보이스) 발행을 지원하는 마켓에서 다음 정보가 표시됩니다:  `receiptOption` (영수증 옵션):   * "PAPER": 종이 영수증 (Paper Invoice) * "E-GUI": 전자 영수증 (Electronic Invoice)   `appliedType` (적용된 유형): 세금 계산서 유형 (가능한 값):   * "PERSONAL\_COUPANG\_MEMBER\_CARRIER": 쿠팡 회원 매개체 (Coupang Member Carrier) * "PERSONAL\_MOBILE\_BARCODE\_CARRIER": 휴대폰 바코드 매개체 (Mobile Barcode Carrier) * "DONATION": 영수증 기부 (Invoice Donation) * "BUSINESS": 사업자 영수증 (Company Invoice)   `appliedValue` (적용 값): 통합 영수증 번호/정보 (가능한 값):   * `appliedType`이 PERSONAL\_COUPANG\_MEMBER\_CARRIER일 때: `null` * `appliedType`이 PERSONAL\_MOBILE\_BARCODE\_CARRIER일 때: 휴대폰 바코드 (Mobile Barcode) * `appliedType`이 DONATION일 때: 영수증 기부 번호 (Invoice Donation Number) * `appliedType`이 BUSINESS일 때: 사업자등록번호 (Company Uniform Serial Number)   `sameDayShipping`: 주문 당일 배송 여부 (가능한 값):   * “true”: 당일 배송 활성화 * “false”: 당일 배송 비활성화   `cutOffTimeHour`: sameDayShipping이 적용되지 않는 시간 (가능한 값):   * 10~23, 0 |

### Response Example

```
{
    "code": "200",
    "message": "OK",
    "data": {
        "shipmentBoxId": 64253897***6401429,
        "orderId": 500000596,
        "orderedAt": "2025-01-15T14:17:13.973885-08:00",
        "orderer": {
            "name": "김문근",
            "email": "",
            "safeNumber": "+1(555)444-1234",
            "ordererNumber": null
        },
        "paidAt": "2025-01-15T14:17:13.973885-08:00",
        "status": "FINAL_DELIVERY",
        "shippingPrice": {
            "currencyCode": "KRW",
            "units": 2500,
            "nanos": 0
        },
        "remotePrice": {
            "currencyCode": "KRW",
            "units": 0,
            "nanos": 0
        },
        "remoteArea": false,
        "parcelPrintMessage": null,
        "splitShipping": false,
        "ableSplitShipping": false,
        "receiver": {
            "name": "test",
            "safeNumber": "+1(555)444-1234",
            "receiverNumber": null,
            "addr1": "addr1",
            "addr2": "addr2",
            "postCode": "284-60"
        },
        "orderItems": [
            {
                "vendorItemPackageId": 0,
                "vendorItemPackageName": "러비더비 섬유향수 보솔레이",
                "productId": 2429,
                "vendorItemId": 3000000177,
                "vendorItemName": "러비더비 섬유향수 보솔레이, 500ml",
                "shippingCount": 1,
                "salesPrice": {
                    "currencyCode": "KRW",
                    "units": 14000,
                    "nanos": 0
                },
                "orderPrice": {
                    "currencyCode": "KRW",
                    "units": 14000,
                    "nanos": 0
                },
                "discountPrice": {
                    "currencyCode": "KRW",
                    "units": 500,
                    "nanos": 0
                },
                "instantCouponDiscount": {
                    "currencyCode": "KRW",
                    "units": 0,
                    "nanos": 0
                },
                "downloadableCouponDiscount": {
                    "currencyCode": "KRW",
                    "units": 500,
                    "nanos": 0
                },
                "coupangDiscount": {
                    "currencyCode": "KRW",
                    "units": 0,
                    "nanos": 0
                },
                "externalVendorSkuCode": "800022867",
                "etcInfoHeader": null,
                "etcInfoValue": null,
                "etcInfoValues": [
                    "추가메시지1",
                    "추가메시지2"
                ],
                "sellerProductId": 26758514,
                "sellerProductName": "[러비더비] 대용량 섬유향수 보솔레이 500ml",
                "sellerProductItemName": "01_보솔레이 500ml",
                "firstSellerProductItemName": "01_보솔레이 500ml",
                "cancelCount": 0,
                "holdCountForCancel": 0,
                "estimatedShippingDate": "2017-10-12",
                "plannedShippingDate": "",
                "invoiceNumberUploadDate": "",
                "extraProperties": {

                },
                "pricingBadge": false,
                "usedProduct": false,
                "confirmDate": "2025-01-15T14:17:13.973885-08:00",
                "deliveryChargeTypeName": "무료",
                "canceled": false
            }
        ],
        "overseaShippingInfoDto": {
            "personalCustomsClearanceCode": null,
            "ordererSsn": "",
            "ordererPhoneNumber": ""
        },
        "deliveryCompanyName": "CJ 대한통운",
        "invoiceNumber": "337398446274",
        "inTrasitDateTime": "2025-01-15T14:17:13.973885-08:00",
        "deliveredDate": "2025-01-15T14:17:13.973885-08:00",
        "refer": "PC웹",
        "shipmentType": "CGF LITE",
        "isCod": false,
        "extraProperties": {
            "taxReceiptInfo": {
                "appliedValue": null,
                "receiptOption": "PAPER",
                "appliedType": "PERSONAL_COUPANG_MEMBER_CARRIER"
            },
            "sameDayShipping": "true",
            "cutOffTimeHour": "18"
        }
    }
}
```

### Error Spec

| HTTP 상태 코드 (오류 유형) | 오류 메시지 | 해결 방법 |
| --- | --- | --- |
| 400 (요청변수확인) | 해당 주문이 취소 또는 반품되었습니다. | [반품/취소 요청 목록 조회 API](https://developers.coupangcorp.com/hc/ko/articles/360033919613)를 통해 해당주문의 취소, 반품여부를 확인합니다. 해당 주문을 반복 호출하지 않도록 처리합니다. |
| 400 (요청변수확인) | Invalid vendor ID | 판매자ID(vendorId)를 올바로 입력했는지 확인합니다. |

### URL API Name

GET\_ORDERSHEET\_BY\_SHIPMENTBOX
