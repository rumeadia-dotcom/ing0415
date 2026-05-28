# [즉시할인쿠폰] 단건 조회(vendorItemId)

> 출처: <https://developers.coupangcorp.com/hc/ko/articles/360033685594>
> Zendesk article id: `360033685594`
> 섹션: 쿠폰 / 캐시백 APIs
> 추출 시점: 2026-05-28

---

**API 적용 가능한 구매자 사용자 지역: 한국**

현재 적용된 쿠폰아이템을 벤더아이템아이디로 조회하기 위한 API입니다.

## Path

GET

/v2/providers/fms/apis/api/v1/vendors/{vendorId}/coupons/{couponId}/items/{vendorItemId}

### Example Endpoint

https://api-gateway.coupang.com/v2/providers/fms/apis/api/v1/vendors/A00000001/coupons/76/items/3223826213?type=vendorItemId

## Request Parameters

### Path Segment Parameter

| Name | | | | | Required | Type | Description |
| --- | --- | --- | --- | --- | --- | --- | --- |
| vendorId | | | | | O | String | 업체 ID |
| couponId | | | | | O | Number | 쿠폰 ID(Wing의 쿠폰 번호) |
| vendorItemId | | | | | O | Number | 벤더아이템 ID |

### Query String Parameter

| Name | | | | | Required | Type | Description |
| --- | --- | --- | --- | --- | --- | --- | --- |
| type | | | | | O | String | vendorItemId |

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
| data | | | | | Object | 쿠폰 아이템 정보 리스트 데이터 |
|  | success | | | | Boolean | 성공 여부  true or false |
|  | content | | | | Object | 쿠폰 아이템 리스트 |
|  |  | couponItemId | | | Number | 쿠폰아이템 아이디  예) 80984 |
|  |  | couponId | | | Number | 쿠폰 아이디(Wing의 쿠폰 번호)  예) 75, 80 |
|  |  | vendorItemId | | | Number | 벤더아이템 아이디  예) 3223826213 |
|  |  | startAt | | | String | 유효시작일  예) 2017-08-04 01:00:00 |
|  |  | endAt | | | String | 유효종료일  예)2017-09-01 00:00:00 |
|  |  | status | | | String | 쿠폰상태  | 구분코드 | 설명 | | --- | --- | | STANDBY | 대기중 | | APPLIED | 사용중 | | PAUSED | 발행중지 | | EXPIRED | 사용종료 | |
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
      "couponItemId": 80984,
      "couponId": 76,
      "vendorItemId": 3223826213,
      "startAt": "2017-08-04 01:00:00",
      "endAt": "2017-09-01 00:00:00",
      "status": "APPLIED"
    },
    "pagination": null
  }
}
```

### Error Spec
