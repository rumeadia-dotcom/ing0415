# [즉시할인쿠폰] 아이템 목록 조회(status)

> 출처: <https://developers.coupangcorp.com/hc/ko/articles/360034209633>
> Zendesk article id: `360034209633`
> 섹션: 쿠폰 / 캐시백 APIs
> 추출 시점: 2026-05-28

---

**API 적용 가능한 구매자 사용자 지역: 한국**

쿠폰이 적용된 옵션ID 리스트를 쿠폰상태로 조회하기 위한 API입니다.

## Path

GET

/v2/providers/fms/apis/api/v1/vendors/{vendorId}/coupons/{couponId}/items

### Example Endpoint

https://api-gateway.coupang.com/v2/providers/fms/apis/api/v1/vendors/A00012345/coupons/99/items?status=APPLIED&page=1&size=10&sort=desc

## Request Parameters

### Path Segment Parameter

| Name | | | | | Required | Type | Description |
| --- | --- | --- | --- | --- | --- | --- | --- |
| vendorId | | | | | O | String | 판매자ID  쿠팡에서 업체에게 발급한 고유 코드  예) A00012345 |
| couponId | | | | | O | Number | 쿠폰ID |

### Query String Parameter

| Name | | | | | Required | Type | Description |
| --- | --- | --- | --- | --- | --- | --- | --- |
| status | | | | | O | String | 쿠폰 상태(STANDBY, APPLIED, PAUSED, EXPIRED) |
| page | | | | |  | Number | 페이지. 기본값 0  다음 페이지를 호출하기 위한 키값. 첫 페이지 호출시에는 넣지 않거나 '0' 입력. 두 번째 페이지를 보려면 '1'을 입력합니다, 등등 |
| size | | | | |  | Number | 페이지 당 건수 |
| sort | | | | |  | String | 정렬값 (asc, desc)  기본값 ascending |

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
|  | content | | | | Array | 쿠폰아이템 리스트 |
|  |  | couponItemId | | | Number | 쿠폰아이템ID  예) 80984 |
|  |  | couponId | | | Number | 쿠폰ID  예) 75, 80 |
|  |  | vendorItemId | | | Number | 옵션ID  예) 3223826213 |
|  |  | startAt | | | String | 유효시작일  예) 2017-08-04 01:00:00 |
|  |  | endAt | | | String | 유효종료일  예)2017-09-01 00:00:00 |
|  |  | status | | | String | 쿠폰상태  | 구분코드 | 설명 | | --- | --- | | STANDBY | 대기중 | | APPLIED | 사용중 | | PAUSED | 발행중지 | | EXPIRED | 사용종료 | |
|  | Pagination | | | | Array | 페이징 |
|  |  | countPerPage | | | Number | 페이지별 데이터 Count  예) 10, 20, 30 |
|  |  | currentPage | | | Number | 현재 페이지  예) 1 |
|  |  | totalPages | | | Number | 전체 페이지 Count  예) 1000 |
|  |  | totalElements | | | Number | 전체 데이터 Count  예) 1000 |

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
    "content": [
      {
        "couponItemId": 81172,
        "couponId": 84,
        "vendorItemId": 3226138951,
        "startAt": "2017-08-09 01:00:00",
        "endAt": "2017-09-01 00:00:00",
        "status": "APPLIED"
      },
      {
        "couponItemId": 81171,
        "couponId": 84,
        "vendorItemId": 3226138847,
        "startAt": "2017-08-09 01:00:00",
        "endAt": "2017-09-01 00:00:00",
        "status": "APPLIED"
      }
    ],
    "pagination": {
      "currentPage": 0,
      "countPerPage": 1000,
      "totalPages": 1,
      "totalElements": 2
    }
  }
}
```

### Error Spec

| HTTP 상태 코드 (오류 유형) | 오류 메시지 | 해결 방법 |
| --- | --- | --- |
| 400 (요청변수확인) | 업체정보의 권한을 확인하세요 | 판매자ID(vendorId) 값을 올바로 입력했는지 확인합니다. |
