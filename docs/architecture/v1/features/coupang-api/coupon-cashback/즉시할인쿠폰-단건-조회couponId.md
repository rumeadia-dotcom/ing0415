# [즉시할인쿠폰] 단건 조회(couponId)

> 출처: <https://developers.coupangcorp.com/hc/ko/articles/360034209373>
> Zendesk article id: `360034209373`
> 섹션: 쿠폰 / 캐시백 APIs
> 추출 시점: 2026-05-28

---

**API 적용 가능한 구매자 사용자 지역: 한국**

단일 쿠폰 정보를 조회하기 위한 API입니다. 타 업체 쿠폰은 조회할 수 없습니다.

## Path

GET

/v2/providers/fms/apis/api/v2/vendors/{vendorId}/coupon

### Example Endpoint

https://api-gateway.coupang.com/v2/providers/fms/apis/api/v2/vendors/A00012345/coupon?couponId=91

## Request Parameters

### Path Segment Parameter

| Name | | | | | Required | Type | Description |
| --- | --- | --- | --- | --- | --- | --- | --- |
| vendorId | | | | | O | String | 판매자ID  쿠팡에서 업체에게 발급한 고유 코드  예) A00012345 |

### Query String Parameter

| Name | | | | | Required | Type | Description |
| --- | --- | --- | --- | --- | --- | --- | --- |
| couponId | | | | | O | Number | 쿠폰ID |

### Request Example

not require body

## Response Message

| Name | | | | | Type | Description |
| --- | --- | --- | --- | --- | --- | --- |
| code | | | | | Number | 서버 응답 코드 |
| message | | | | | String | 서버 응답 메세지 |
| httpStatus | | | | | Number | HTTP Status Code(서버 응답 코드와 동일한 값) |
| httpStatusMessage | | | | | String | HTTP Status Message (서버 응답 메세지와 동일한 값) |
| errorMessage | | | | | String | HTTP Status 200을 제외한 나머지 Status에서 서버 내 상세한 실패 이유 메세지가 담깁니다. |
| data | | | | | Object | 쿠폰 데이터 |
|  | success | | | | Boolean | 성공 여부  true or false |
|  | content | | | | Object | 쿠폰 단건 데이터 |
|  |  | contractId | | | Number | 계약 아이디 |
|  |  | vendorContractId | | | Number | 업체의 계약서 코드(쿠팡 관리 코드)  예) -1, 1, 2 |
|  |  | couponId | | | Number | 쿠폰 아이디(Wing의 쿠폰 번호) |
|  |  | discount | | | Number | 할인율 |
|  |  | endAt | | | String | 유효종료일  예)2017-09-01 00:00:00 |
|  |  | maxDiscountPrice | | | Number | 최대 할인금액  예) 1000, 10000 |
|  |  | promotionName | | | String | 프로모션명  예) 원피스 1월 2째주 할인쿠폰 |
|  |  | startAt | | | String | 유효시작일  예) 2017-08-04 01:00:00 |
|  |  | status | | | String | 쿠폰상태  | 구분코드 | 설명 | | --- | --- | | STANDBY | 대기중 | | APPLIED | 사용중 | | PAUSED | 발행중지 | | EXPIRED | 사용종료 | | DETACHED | 아이템 파기 | |
|  |  | type | | | String | 할인방식  예) RATE(정률할인), FIXED\_WITH\_QUANTITY(수량별 정액할인), PRICE(정액할인) |
|  |  | wowExclusive | | | Boolean | 발행대상  false(전체 : 기본값)  true(로켓와우 회원) |
|  | Pagination | | | | Array | 단건 조회로 페이징 없음 |

### Response Example

```
{
  "code": 200,
  "message": "OK",
  "httpStatus": 200,
  "httpStatusMessage": "OK",
  "errorMessage": "",
  "data": {
    "success": true,
    "content": {
      "contractId": 10,
      "vendorContractId": null,
      "promotionName": null,
      "couponId": 91,
      "status": "PAUSED",
      "type": "RATE",
      "maxDiscountPrice": 1000000,
      "discount": 99,
      "startAt": "2017-11-22 00:00:00",
      "endAt": "2017-11-23 23:59:00",
      "wowExclusive": "false"     
    },
    "pagination": null
  }
}
```

### Error Spec

| HTTP 상태 코드 (오류 유형) | 오류 메시지 | 해결 방법 |
| --- | --- | --- |
| 400 (요청변수확인) | 업체정보의 권한을 확인하세요 | 판매자ID(vendorId) 값을 올바로 입력했는지 확인합니다. |
| 400 (요청변수확인) | 쿠폰이 없습니다. 쿠폰 번호를 확인해주세요. | 쿠폰ID(couponId) 값을 올바로 입력했는지 확인합니다. |
