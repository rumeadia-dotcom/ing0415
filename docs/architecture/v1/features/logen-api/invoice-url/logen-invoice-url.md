# 로젠 제공 외부 운송장 출력 팝업

> 출처: https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/logen-invoice-url.html
> 화물/택배사: 로젠택배 (logen)
> 섹션: 로젠시스템 송장 출력 URL
> screenName: `logen-invoice-url`
> 추출 시점: 2026-05-29

---

로젠에서 제공하는 운송장 출력 팝업을 호출하여 운송장 출력을 한다. (주문 정보 일괄 등록 호출 후 사용)

### URL

개발계:  `https://topenapi.ilogen.com/lrm02b-edi/edi/outSlipPrintPop`

운영계:  `https://openapi.ilogen.com/lrm02b-edi/edi/outSlipPrintPop`

### Input

**HTTP Method: GET**

Type: **JSONObject**

| Params | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| userId | String | 8 | Y | 연동업체코드 | 11111111 |  |
| custCd | String | 8 | Y | 거래처코드 | 11111111 |  |
| takeDt | String | 8 | Y | 접수일자 | 20250501 |  |

### Output

Type: **JSONObject**

| Params | DataType | Length | 필수 | 내용 | Example Value | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| return | URL | - | - | 팝업 화면이 생성됩니다. |  |  |

### 수정이력

| 날짜 | 수정구분 | 수정내용 |
| --- | --- | --- |
| 2025.08.11 | 최초생성 | 본문 최초 생성 |

## 요청/응답 예시

**Input**

```json
"/lrm02b-edi/edi/outSlipPrintPop?userId=11111111&custCd=11111111&takeDt=20250501"
```

**Output**

```json
"function pop(){ var popup = window.open('http://tlogis.ilogen.com/lrm01f-reserve/print/lrm01fp600.html?secretKey=################&custCd=11111111&takeDt=20250501', 'popup', 'width=1400,height=800'); }"
```

