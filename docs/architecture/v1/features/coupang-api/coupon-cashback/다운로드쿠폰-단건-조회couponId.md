# [다운로드쿠폰] 단건 조회(couponId)

> 출처: <https://developers.coupangcorp.com/hc/ko/articles/360033685974>
> Zendesk article id: `360033685974`
> 섹션: 쿠폰 / 캐시백 APIs
> 추출 시점: 2026-05-28

---

**API 적용 가능한 구매자 사용자 지역: 한국**

couponId(쿠폰 생성 시 Response로 확인)를 이용하여 다운로드 쿠폰을 조회합니다.

## Path

GET

/v2/providers/marketplace\_openapi/apis/api/v1/coupons/{couponId}

### Example Endpoint

https://api-gateway.coupang.com/v2/providers/marketplace\_openapi/apis/api/v1/coupons/11234224

## Request Parameters

### Path Segment Parameter

| Name | | | | | Required | Type | Description |
| --- | --- | --- | --- | --- | --- | --- | --- |
| couponId | | | | | O | Number | 다운로드 쿠폰ID (쿠폰 생성 시 Response로 확인) |

### Request Example

not require body

## Response Message

| Name | | | | | Type | Description |
| --- | --- | --- | --- | --- | --- | --- |
| couponId | | | | | Number | 쿠폰 ID  쿠폰 아이템 생성 / 쿠폰삭제 & 조회 등에 사용 |
| title | | | | | String | 쿠폰 명칭  해당쿠폰 다운로드 페이지 명칭 |
| couponType | | | | | String | 쿠폰 분류 |
| couponStatus | | | | | String | 쿠폰상태  생성시에는 'STANDBY'로 노출 |
| publishedDate | | | | | String | 쿠폰 발행일 (최초 쿠폰 아이템 시점) |
| startDate | | | | | String | 쿠폰적용 시작일  'YYYY-MM-DD HH:MM:SS' |
| endDate | | | | | String | 쿠폰적용 종료일  'YYYY-MM-DD HH:MM:SS' |
| appliedOptionCount | | | | | Number | 쿠폰 적용 vendorId 수 |
| usageAmount | | | | | Number | 쿠폰 사용량 |
| couponPolicies | | | | | Number | 쿠폰 ID(Wing의 쿠폰 번호) |
|  | title | | | | String | 해당쿠폰 정책명칭  쿠폰 명칭과 다른 항목, 장바구니에서 쿠폰선택시 노출되는 명칭 |
|  | typeOfDiscount | | | | String | 쿠폰 정책유형  | CODE | MEANING | | --- | --- | | RATE | 정률할인 | | PRICE | 정액할인 | |
|  | description | | | | String | 쿠폰 상세 설명  장바구니에서 쿠폰정책 명칭의 부연설명으로 표시 |
|  | minimumPrice | | | | Number | 쿠폰 적용 최소구매금액  쿠폰을 사용하기 위해 충족해야하는 주문금액 |
|  | discount | | | | Number | 쿠폰 할인금액 또는 비율(%)  | CODE | Example | | --- | --- | | RATE | 1~99 정수 | | PRICE | 10원 단위 금액 | |
|  | maximumDiscountPrice | | | | Number | 최대 할인 금액  RATE일 때 최대 할인 금액 PRICE일 때는 -1로 노출 |
|  | maximumPerDaily | | | | Number | 최대 발급 갯수(1인/1일)  9,999 초과 불가 |

### Response Example

```
{
  "couponId": 11234224,
  "title": "쿠폰 명칭",
  "couponType": "DOWNLOAD",
  "couponStatus": "STANDBY",
  "publishedDate": "",
  "startDate": "2019-05-24 19:55:00",
  "endDate": "2019-06-08 11:00:00",
  "appliedOptionCount": 0,
  "usageAmount": 0,
  "couponPolicies": [
    {
      "title": "해당쿠폰의 정책 1 명칭",
      "typeOfDiscount": "RATE",
      "description": "해당정책 안내 문구 작성1",
      "minimumPrice": 1000,
      "discount": 10,
      "maximumDiscountPrice": 2000,
      "maximumPerDay": 999
    },
    {
      "title": "해당쿠폰의 정책 2 명칭",
      "typeOfDiscount": "RATE",
      "description": "해당정책 안내 문구 작성2",
      "minimumPrice": 2000,
      "discount": 20,
      "maximumDiscountPrice": 3000,
      "maximumPerDay": 999
    },
    {
      "title": "해당쿠폰의 정책 3 명칭",
      "typeOfDiscount": "RATE",
      "description": "해당정책 안내 문구 작성3",
      "minimumPrice": 3000,
      "discount": 30,
      "maximumDiscountPrice": 3400,
      "maximumPerDay": 999
    }
  ]
}
```

### Error Spec

| HTTP 상태 코드 (오류 유형) | 오류 메시지 | 해결 방법 |
| --- | --- | --- |
| 404 (요청변수확인) | 존재 하지 않는 프로모션 (228047\*\*\*) | 쿠폰ID(couponId) 값을 올바로 입력했는지 확인합니다. |

### URL API Name

GET\_COUPON\_BY\_ID
