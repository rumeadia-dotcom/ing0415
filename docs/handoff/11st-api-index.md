# 11번가 셀러 OpenAPI 인덱스 (자동 추출)

출처: <https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall> — **개발가이드 (apiSpecType=1, 인증 세션 필요)**.
총 **26 카테고리 / 150 API** (145 추출 + 5 원본 미제공). **추출 시점: 2026-05-30**.

> ⚠️ **인증 게이트**: 이 spec 들은 11번가 셀러 로그인 세션에서만 접근 가능합니다. 익명 접근 시 서버는 공개 "상품검색 OpenAPI"(commonGuide)로 폴백합니다. 재추출 시 셀러 세션 쿠키 필요.
> spec 본문은 페이지의 embedded `var jsonData` (machine-readable) 에서 추출. 실 호출 base 도메인 `api.11st.co.kr`, 인증은 `openapikey` HTTP 헤더(셀러 발급 키). 상세는 [README](../architecture/v1/features/11st-api/README.md).

---

## 공통 API

### 상품 › 카테고리조회  `categoryNo=38`

- `GET` [Seller - 상품 - 전체 카테고리 조회](../architecture/v1/features/11st-api/product/category-1001.md) — `apiSeq=1001`
- `GET` [Seller - 상품 - 하위 카테고리 조회](../architecture/v1/features/11st-api/product/category-1617.md) — `apiSeq=1617`

### 상품 › 상품조회  `categoryNo=39`

- `POST` [Seller - 상품 - 다중 상품 조회](../architecture/v1/features/11st-api/product/product-search-1007.md) — `apiSeq=1007`
- `GET` [Seller - 상품 - 신규 상품 조회](../architecture/v1/features/11st-api/product/product-search-1620.md) — `apiSeq=1620`
- `GET` [Seller - 상품 - 셀러 상품 조회](../architecture/v1/features/11st-api/product/product-search-1621.md) — `apiSeq=1621`

### 상품 › 재고처리  `categoryNo=40`

- `POST` [Seller - 상품 - 다중 상품 재고 정보 조회](../architecture/v1/features/11st-api/product/stock-1009.md) — `apiSeq=1009`
- `GET` [Seller - 상품 - 상품 재고정보 조회](../architecture/v1/features/11st-api/product/stock-1623.md) — `apiSeq=1623`
- `PUT` [Seller - 상품 - 상품 재고수량 변경처리](../architecture/v1/features/11st-api/product/stock-1625.md) — `apiSeq=1625`

### 상품 › 상품Q&A  `categoryNo=41`

- `GET` [Seller - 상품 - 상품 QnA 목록 조회](../architecture/v1/features/11st-api/product/product-qna-1626.md) — `apiSeq=1626`
- `PUT` [Seller - 상품 - 상품 QnA 답변 처리](../architecture/v1/features/11st-api/product/product-qna-1885.md) — `apiSeq=1885`

### 상품 › 판매중지  `categoryNo=42`

- `PUT` [Seller - 상품 - 상품 전시중지 처리](../architecture/v1/features/11st-api/product/sale-stop-1631.md) — `apiSeq=1631`
- `PUT` [Seller - 상품 - 상품 전시중지해제 처리](../architecture/v1/features/11st-api/product/sale-stop-1632.md) — `apiSeq=1632`

### 상품 › 배송  `categoryNo=43`

- `GET` [Seller - 상품 - 출고지 주소 조회](../architecture/v1/features/11st-api/product/shipping-1014.md) — `apiSeq=1014`
- `GET` [Seller - 상품 - 반품/교환지 주소 조회](../architecture/v1/features/11st-api/product/shipping-1015.md) — `apiSeq=1015`
- `POST` [Seller - 상품 - 출고지 배송비 정책 등록/수정](../architecture/v1/features/11st-api/product/shipping-1078.md) — `apiSeq=1078`
- `POST` [Seller - 상품 - 출고지 조회](../architecture/v1/features/11st-api/product/shipping-1691.md) — `apiSeq=1691`
- `GET` [Seller - 상품 - 반품/교환지 조회](../architecture/v1/features/11st-api/product/shipping-1692.md) — `apiSeq=1692`
- `GET` [Seller - 상품 - 출고지 배송비 정책 조회](../architecture/v1/features/11st-api/product/shipping-1694.md) — `apiSeq=1694`
- `POST` [Seller - 상품 - 출고지 등록](../architecture/v1/features/11st-api/product/shipping-6701.md) — `apiSeq=6701`
- `POST` [Seller - 상품 - 반품/교환지 등록](../architecture/v1/features/11st-api/product/shipping-6702.md) — `apiSeq=6702`
- `POST` [Seller - 상품 - 출고지 수정](../architecture/v1/features/11st-api/product/shipping-6703.md) — `apiSeq=6703`
- `POST` [Seller - 상품 - 반품/교환지 수정](../architecture/v1/features/11st-api/product/shipping-6704.md) — `apiSeq=6704`
- `GET` [발송마감 템플릿 조회](../architecture/v1/features/11st-api/product/shipping-6735.md) — `apiSeq=6735`
- `POST` [발송마감 템플릿 등록](../architecture/v1/features/11st-api/product/shipping-6736.md) — `apiSeq=6736`
- `PUT` [발송마감 템플릿 수정](../architecture/v1/features/11st-api/product/shipping-6737.md) — `apiSeq=6737`
- `POST` [배송지연 공지등록](../architecture/v1/features/11st-api/product/shipping-6757.md) — `apiSeq=6757`
- `POST` [배송지연 공지해제](../architecture/v1/features/11st-api/product/shipping-6758.md) — `apiSeq=6758`
- `GET` [Seller - 상품 - 방문수령지 조회](../architecture/v1/features/11st-api/product/shipping-6759.md) — `apiSeq=6759`
- `POST` [Seller - 상품 - 방문수령지 등록](../architecture/v1/features/11st-api/product/shipping-6760.md) — `apiSeq=6760`
- `POST` [Seller - 상품 - 방문수령지 수정](../architecture/v1/features/11st-api/product/shipping-6761.md) — `apiSeq=6761`
- `GET` [해외출고지조회](../architecture/v1/features/11st-api/product/shipping-6792.md) — `apiSeq=6792`
- `POST` [해외출고지등록](../architecture/v1/features/11st-api/product/shipping-6793.md) — `apiSeq=6793`
- `POST` [해외출고지수정](../architecture/v1/features/11st-api/product/shipping-6794.md) — `apiSeq=6794`

### 상품 › 우편번호  `categoryNo=44`

- `POST` [Seller - 상품 - 도로명주소 추천 검색](../architecture/v1/features/11st-api/product/zipcode-1987.md) — `apiSeq=1987`
- `POST` [Seller - 상품 - 주소 검색](../architecture/v1/features/11st-api/product/zipcode-6700.md) — `apiSeq=6700`

### 상품 › 상품관리  `categoryNo=81`

- `POST` [Seller - 상품 - 상품등록/신규상품등록](../architecture/v1/features/11st-api/product/product-manage-1003.md) — `apiSeq=1003`
- `PUT` [Seller - 상품 - 상품수정/신규상품수정](../architecture/v1/features/11st-api/product/product-manage-1619.md) — `apiSeq=1619`
- `GET` [Seller - 상품 - 상품 가격 수정](../architecture/v1/features/11st-api/product/product-manage-1752.md) — `apiSeq=1752`
- `GET` [Seller - 상품 - 추가구성상품 조회](../architecture/v1/features/11st-api/product/product-manage-1845.md) — `apiSeq=1845`
- `GET` [Seller - 상품 - 상품상세 설명 조회](../architecture/v1/features/11st-api/product/product-manage-1846.md) — `apiSeq=1846`
- `POST` [Seller - 상품 - 상품판매기간조회](../architecture/v1/features/11st-api/product/product-manage-1848.md) — `apiSeq=1848`
- `POST` [Seller - 상품 - 추가구성상품 수정](../architecture/v1/features/11st-api/product/product-manage-1849.md) — `apiSeq=1849`
- `POST` [Seller - 상품 - 상품상세 설명 수정](../architecture/v1/features/11st-api/product/product-manage-1850.md) — `apiSeq=1850`
- `POST` [Seller - 상품 - 옵션 수정 / 표준옵션 수정](../architecture/v1/features/11st-api/product/product-manage-1851.md) — `apiSeq=1851`
- `POST` [Seller - 상품 - 상품가격/즉시할인 수정](../architecture/v1/features/11st-api/product/product-manage-1855.md) — `apiSeq=1855`
- `PUT` [Seller - 상품 - 상품판매기간연장](../architecture/v1/features/11st-api/product/product-manage-1856.md) — `apiSeq=1856`
- `GET` [실재고체크를 통한 옵션품절 리스트 조회](../architecture/v1/features/11st-api/product/product-manage-6732.md) — `apiSeq=6732`

### 주문 › 결제완료  `categoryNo=110`

- `GET` [Seller - 주문 - 주문번호별 상태조회](../architecture/v1/features/11st-api/order/paid-1633.md) — `apiSeq=1633`
- `GET` [Seller - 주문 - 결제대기 내역 (입금대기 목록조회)](../architecture/v1/features/11st-api/order/paid-1728.md) — `apiSeq=1728`
- `GET` [Seller - 주문 - 배송지 입력대기 목록조회](../architecture/v1/features/11st-api/order/paid-1800.md) — `apiSeq=1800`
- `GET` [Seller - 주문 - 발주확인할 내역 (결재완료 목록조회)](../architecture/v1/features/11st-api/order/paid-1876.md) — `apiSeq=1876`
- `GET` [오늘발송 요청내역 (결제완료 목록조회)](../architecture/v1/features/11st-api/order/paid-6741.md) — `apiSeq=6741`
- `GET` [발송기한경과 요청내역 (결제완료 목록조회)](../architecture/v1/features/11st-api/order/paid-6743.md) — `apiSeq=6743`

### 주문 › 발주처리  `categoryNo=111`

- `GET` [Seller - 주문 - 발주확인처리 (배송준비중 처리)](../architecture/v1/features/11st-api/order/confirm-1634.md) — `apiSeq=1634`
- `GET` [Seller - 주문 - 발송처리할 내역 (배송준비중 목록조회)](../architecture/v1/features/11st-api/order/confirm-1635.md) — `apiSeq=1635`
- `POST` [발송지연안내 처리](../architecture/v1/features/11st-api/order/confirm-6728.md) — `apiSeq=6728`
- `GET` [오늘발송 요청내역 (배송준비중 목록조회)](../architecture/v1/features/11st-api/order/confirm-6742.md) — `apiSeq=6742`
- `GET` [발송기한경과 요청내역 (배송준비중 목록조회)](../architecture/v1/features/11st-api/order/confirm-6744.md) — `apiSeq=6744`

### 주문 › 발송처리  `categoryNo=112`

- `GET` [Seller - 주문 - 부분발송처리 (부분 배송중 처리)](../architecture/v1/features/11st-api/order/dispatch-1636.md) — `apiSeq=1636`
- `GET` [Seller - 주문 - 판매불가처리 (판매거부처리)](../architecture/v1/features/11st-api/order/dispatch-1638.md) — `apiSeq=1638`
- `GET` [Seller - 주문 - 발송처리 (배송중 처리)](../architecture/v1/features/11st-api/order/dispatch-1888.md) — `apiSeq=1888`
- `GET` [수량 분리발송처리 (1개의 주문상품 여러개 나눠서 송장등록 가능)](../architecture/v1/features/11st-api/order/dispatch-6791.md) — `apiSeq=6791`
- `POST` [Seller - 주문 - 방문발송처리 (배송완료 처리)](../architecture/v1/features/11st-api/order/dispatch-7052.md) — `apiSeq=7052`

### 주문 › 완료조회  `categoryNo=113`

- `GET` [Seller - 주문 - 판매완료 내역 (구매확정 목록조회)](../architecture/v1/features/11st-api/order/complete-1637.md) — `apiSeq=1637`
- `GET` [Seller - 주문 - 배송완료 내역](../architecture/v1/features/11st-api/order/complete-1727.md) — `apiSeq=1727`
- `GET` [상품미도착내역](../architecture/v1/features/11st-api/order/complete-6733.md) — `apiSeq=6733`
- `PUT` [상품미도착처리](../architecture/v1/features/11st-api/order/complete-6734.md) — `apiSeq=6734`
- `GET` [Seller - 주문 - 배송중 내역](../architecture/v1/features/11st-api/order/complete-6897.md) — `apiSeq=6897`

### 주문 › 예약판매  `categoryNo=114`

- `GET` [Seller - 주문 - 예약결제완료 목록조회](../architecture/v1/features/11st-api/order/reserve-1772.md) — `apiSeq=1772`
- `GET` [Seller - 주문 - 입고완료처리](../architecture/v1/features/11st-api/order/reserve-1773.md) — `apiSeq=1773`

### 주문 › 조회  `categoryNo=115`

- `GET` [Seller - 주문 - 주문번호별 배송정보 조회](../architecture/v1/features/11st-api/order/query-1725.md) — `apiSeq=1725`
- `GET` [Seller - 주문 - 주문번호별 주문상태 조회](../architecture/v1/features/11st-api/order/query-1774.md) — `apiSeq=1774`

### 취소교환반품 › 취소처리  `categoryNo=48`

- `GET` [Seller - 주문 - 판매불가처리 (판매거부처리)](../architecture/v1/features/11st-api/claim/cancel-1638.md) — `apiSeq=1638`
- `GET` [Seller - 취소/반품/교환 - 주문취소 요청 목록조회](../architecture/v1/features/11st-api/claim/cancel-1639.md) — `apiSeq=1639`
- `GET` [Seller - 취소/반품/교환 - 주문취소 승인처리](../architecture/v1/features/11st-api/claim/cancel-1640.md) — `apiSeq=1640`
- `GET` [Seller - 취소/반품/교환 - 주문취소 거부처리](../architecture/v1/features/11st-api/claim/cancel-1641.md) — `apiSeq=1641`
- `GET` [Seller - 취소/반품/교환 - 주문취소 완료 목록조회](../architecture/v1/features/11st-api/claim/cancel-1642.md) — `apiSeq=1642`
- `GET` [Seller - 취소/반품/교환 - 주문취소철회 완료 목록조회](../architecture/v1/features/11st-api/claim/cancel-1724.md) — `apiSeq=1724`
- `GET` [Seller - 취소/반품/교환 - 구매확정후직권취소 목록조회](../architecture/v1/features/11st-api/claim/cancel-1726.md) — `apiSeq=1726`
- `GET` [Seller - 취소/반품/교환 - 주문취소 거부처리(책임사유 오류)](../architecture/v1/features/11st-api/claim/cancel-1745.md) — `apiSeq=1745`

### 취소교환반품 › 교환처리  `categoryNo=49`

- `GET` [Seller - 취소/반품/교환 - 교환 요청 목록조회](../architecture/v1/features/11st-api/claim/exchange-1648.md) — `apiSeq=1648`
- `GET` [Seller - 취소/반품/교환 - 교환 승인처리](../architecture/v1/features/11st-api/claim/exchange-1649.md) — `apiSeq=1649`
- `GET` [Seller - 취소/반품/교환 - 교환 거부처리](../architecture/v1/features/11st-api/claim/exchange-1650.md) — `apiSeq=1650`
- `GET` [Seller - 취소/반품/교환 - 교환 완료 목록조회](../architecture/v1/features/11st-api/claim/exchange-1651.md) — `apiSeq=1651`
- `GET` [Seller - 취소/반품/교환 - 교환 철회 목록조회](../architecture/v1/features/11st-api/claim/exchange-1652.md) — `apiSeq=1652`

### 취소교환반품 › 반품처리  `categoryNo=50`

- `GET` [Seller - 취소/반품/교환 - 반품 요청 목록조회](../architecture/v1/features/11st-api/claim/return-1643.md) — `apiSeq=1643`
- `GET` [Seller - 취소/반품/교환 - 반품 승인처리](../architecture/v1/features/11st-api/claim/return-1644.md) — `apiSeq=1644`
- `GET` [Seller - 취소/반품/교환 - 반품 거부처리](../architecture/v1/features/11st-api/claim/return-1645.md) — `apiSeq=1645`
- `GET` [Seller - 취소/반품/교환 - 반품 완료 목록조회](../architecture/v1/features/11st-api/claim/return-1646.md) — `apiSeq=1646`
- `GET` [Seller - 취소/반품/교환 - 반품 철회 목록조회](../architecture/v1/features/11st-api/claim/return-1647.md) — `apiSeq=1647`
- `GET` [Seller - 취소/반품/교환 - 반품신청 및 완료](../architecture/v1/features/11st-api/claim/return-1653.md) — `apiSeq=1653`
- `GET` [Seller - 취소/반품/교환 - 반품보류 처리](../architecture/v1/features/11st-api/claim/return-1654.md) — `apiSeq=1654`
- `GET` [Seller - 취소/반품/교환 - 반품완료보류 처리](../architecture/v1/features/11st-api/claim/return-1655.md) — `apiSeq=1655`
- `GET` [Seller - 취소교환반품 > 반품송장 입력](../architecture/v1/features/11st-api/claim/return-6747.md) — `apiSeq=6747`

### 셀러기획전 › 기획전조회관리  `categoryNo=54`

- `POST` [Seller - 셀러기획전 - 셀러기획전 조회](../architecture/v1/features/11st-api/seller-plan/plan-1504.md) — `apiSeq=1504`
- `POST` [Seller - 셀러기획전 - 셀러기획전 등록](../architecture/v1/features/11st-api/seller-plan/plan-1505.md) — `apiSeq=1505`
- `PUT` [Seller - 셀러기획전 - 셀러기획전 수정](../architecture/v1/features/11st-api/seller-plan/plan-1778.md) — `apiSeq=1778`
- `DELETE` [Seller - 셀러기획전 - 셀러기획전 취소](../architecture/v1/features/11st-api/seller-plan/plan-1780.md) — `apiSeq=1780`
- `GET` [Seller - 셀러기획전 - 그룹 조회](../architecture/v1/features/11st-api/seller-plan/plan-1781.md) — `apiSeq=1781`
- `POST` [Seller - 셀러기획전 - 그룹 등록](../architecture/v1/features/11st-api/seller-plan/plan-1782.md) — `apiSeq=1782`
- `PUT` [Seller - 셀러기획전 - 그룹 수정](../architecture/v1/features/11st-api/seller-plan/plan-1783.md) — `apiSeq=1783`
- `DELETE` [Seller - 셀러기획전 - 그룹 삭제](../architecture/v1/features/11st-api/seller-plan/plan-1784.md) — `apiSeq=1784`

### 알리미 › 알림조회관리  `categoryNo=58`

- `GET` [Seller - 긴급알리미 - 긴급알리미 조회](../architecture/v1/features/11st-api/notify/notify-1796.md) — `apiSeq=1796`
- `GET` [Seller - 긴급알리미 - 긴급알리미 확인/답변처리](../architecture/v1/features/11st-api/notify/notify-1869.md) — `apiSeq=1869`
- `GET` [Seller - 긴급알리미 - 긴급알리미조회_구분코드별](../architecture/v1/features/11st-api/notify/notify-1870.md) — `apiSeq=1870`
- `GET` [Seller - 긴급알리미 - 긴급알리미조회_구분코드_주문번호별](../architecture/v1/features/11st-api/notify/notify-1871.md) — `apiSeq=1871`
- `GET` [Seller - 긴급알리미 - 게시물분류코드목록조회](../architecture/v1/features/11st-api/notify/notify-6738.md) — `apiSeq=6738`
- `PUT` [Seller - 긴급알리미 - 긴급알리미 확인/답변처리 PUT](../architecture/v1/features/11st-api/notify/notify-6982.md) — `apiSeq=6982`

### 정산 › 정산조회  `categoryNo=151`

- `GET` [정산내역조회](../architecture/v1/features/11st-api/settlement/settlement-1281.md) — `apiSeq=1281`

## 물류 API

### 해외물류 › 상품  `categoryNo=63`

- `GET` [물류 - 해외물류 - 상품 정보 조회](../architecture/v1/features/11st-api/global-logistics/product-1717.md) — `apiSeq=1717`
- `PUT` [물류 - 해외물류 - 상품 무게정보 변경처리](../architecture/v1/features/11st-api/global-logistics/product-1718.md) — `apiSeq=1718`

### 해외물류 › 발주발송  `categoryNo=64`

- `GET` [물류 - 해외물류 - 해외배송상태처리](../architecture/v1/features/11st-api/global-logistics/order-dispatch-1720.md) — `apiSeq=1720`
- `GET` [물류 - 해외물류 - 해외현지 內 발송처리](../architecture/v1/features/11st-api/global-logistics/order-dispatch-1721.md) — `apiSeq=1721`
- `GET` [물류 - 해외물류 - 발주확인처리 (배송준비중 처리)](../architecture/v1/features/11st-api/global-logistics/order-dispatch-1722.md) — `apiSeq=1722`
- `GET` [물류 - 해외물류 - 발송처리 (배송중 처리) - KGL(해외배송)](../architecture/v1/features/11st-api/global-logistics/order-dispatch-1723.md) — `apiSeq=1723`
- `GET` [물류 - 해외물류 - 발송처리할 내역 (배송준비중 목록조회)](../architecture/v1/features/11st-api/global-logistics/order-dispatch-1889.md) — `apiSeq=1889`

### 해외물류 › 취소교환반품  `categoryNo=65`

- `GET` [Seller - 취소/반품/교환 - 주문취소 요청 목록조회](../architecture/v1/features/11st-api/global-logistics/claim-1639.md) — `apiSeq=1639`
- `GET` [Seller - 취소/반품/교환 - 주문취소 완료 목록조회](../architecture/v1/features/11st-api/global-logistics/claim-1642.md) — `apiSeq=1642`
- `GET` [Seller - 취소/반품/교환 - 반품 요청 목록조회](../architecture/v1/features/11st-api/global-logistics/claim-1643.md) — `apiSeq=1643`
- `GET` [Seller - 취소/반품/교환 - 반품 승인처리](../architecture/v1/features/11st-api/global-logistics/claim-1644.md) — `apiSeq=1644`
- `GET` [Seller - 취소/반품/교환 - 반품 거부처리](../architecture/v1/features/11st-api/global-logistics/claim-1645.md) — `apiSeq=1645`
- `GET` [Seller - 취소/반품/교환 - 반품 완료 목록조회](../architecture/v1/features/11st-api/global-logistics/claim-1646.md) — `apiSeq=1646`

### 전세계배송 › 조회  `categoryNo=67`

- ~~전세계배송 주문리스트~~ — `apiSeq=1316` _(원본 미제공 — 11번가 페이지에 spec 없음)_
- ~~전세계배송 발송처리리스트~~ — `apiSeq=1318` _(원본 미제공 — 11번가 페이지에 spec 없음)_
- ~~전세계배송 수취인주소조회~~ — `apiSeq=1319` _(원본 미제공 — 11번가 페이지에 spec 없음)_
- `GET` [물류 - 전세계배송 - 현재 상태 값 조회](../architecture/v1/features/11st-api/global-shipping/query-1732.md) — `apiSeq=1732`
- `GET` [물류 - 전세계배송 - 현재 상태 값 조회(List)](../architecture/v1/features/11st-api/global-shipping/query-1733.md) — `apiSeq=1733`
- `GET` [물류 - 전세계배송 - Invoice 증빙 조회](../architecture/v1/features/11st-api/global-shipping/query-1734.md) — `apiSeq=1734`
- `GET` [물류 - 전세계배송 - 반출시 판매자 정보 조회](../architecture/v1/features/11st-api/global-shipping/query-1735.md) — `apiSeq=1735`
- `GET` [물류 - 전세계배송 - 주문내역조회 내역(List)](../architecture/v1/features/11st-api/global-shipping/query-1746.md) — `apiSeq=1746`
- `GET` [물류 - 전세계배송 - 주문내역조회 내역](../architecture/v1/features/11st-api/global-shipping/query-1747.md) — `apiSeq=1747`
- `GET` [물류 - 전세계배송 - 발송완료내역 조회](../architecture/v1/features/11st-api/global-shipping/query-1748.md) — `apiSeq=1748`
- `GET` [물류 - 전세계배송 - 수취인 주소 조회](../architecture/v1/features/11st-api/global-shipping/query-1749.md) — `apiSeq=1749`
- `GET` [물류 - 전세계배송 - 현재 상태 값 조회(기간)](../architecture/v1/features/11st-api/global-shipping/query-1925.md) — `apiSeq=1925`
- ~~SF주문조회~~ — `apiSeq=6705` _(원본 미제공 — 11번가 페이지에 spec 없음)_
- ~~SF주문조회~~ — `apiSeq=6706` _(원본 미제공 — 11번가 페이지에 spec 없음)_

### 전세계배송 › 상태처리  `categoryNo=68`

- `GET` [물류 - 전세계배송 - 30kg 초과 주문건 무게 업데이트](../architecture/v1/features/11st-api/global-shipping/status-1736.md) — `apiSeq=1736`
- `GET` [물류 - 전세계배송 - 통합ID 주문번호별 무게 업데이트](../architecture/v1/features/11st-api/global-shipping/status-1737.md) — `apiSeq=1737`
- `GET` [물류 - 전세계배송 - 주문순번 Status 업데이트](../architecture/v1/features/11st-api/global-shipping/status-1750.md) — `apiSeq=1750`

### 전세계배송 › 배송  `categoryNo=69`

- `GET` [Seller - 주문 - 발주확인처리 (배송준비중 처리)](../architecture/v1/features/11st-api/global-shipping/shipping-1634.md) — `apiSeq=1634`
- `GET` [물류 - 전세계배송 - 입고시 오프라인 보류처리](../architecture/v1/features/11st-api/global-shipping/shipping-1738.md) — `apiSeq=1738`
- `GET` [물류 - 전세계배송 - 반품/교환발송 업데이트](../architecture/v1/features/11st-api/global-shipping/shipping-1739.md) — `apiSeq=1739`
- `GET` [물류 - 전세계배송 - 30kg초과 주문건 처리](../architecture/v1/features/11st-api/global-shipping/shipping-1740.md) — `apiSeq=1740`
- `GET` [물류 - 전세계배송 - 국내통관거부](../architecture/v1/features/11st-api/global-shipping/shipping-1741.md) — `apiSeq=1741`
- `GET` [물류 - 전세계배송 - 반송주문내역 전송](../architecture/v1/features/11st-api/global-shipping/shipping-1742.md) — `apiSeq=1742`
- `GET` [물류 - 전세계배송 - 반송주문 처리방법 조회](../architecture/v1/features/11st-api/global-shipping/shipping-1743.md) — `apiSeq=1743`
- `GET` [물류 - 전세계배송 - 크레임 사유코드 전송](../architecture/v1/features/11st-api/global-shipping/shipping-1744.md) — `apiSeq=1744`
- `GET` [물류 - 전세계배송 - 해외송장 정보 업데이트](../architecture/v1/features/11st-api/global-shipping/shipping-1751.md) — `apiSeq=1751`
- `GET` [물류 - 전세계배송 - 해외배송상태 배송완료처리](../architecture/v1/features/11st-api/global-shipping/shipping-1831.md) — `apiSeq=1831`
- `GET` [Seller - 주문 - 발송처리 (배송중 처리)](../architecture/v1/features/11st-api/global-shipping/shipping-1888.md) — `apiSeq=1888`

---

원본 미제공 5건: `1316`, `1318`, `1319`, `6705`, `6706`
