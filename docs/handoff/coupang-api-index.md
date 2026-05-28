# 쿠팡 Open API 인덱스 (자동 추출)

출처: <https://developers.coupangcorp.com/hc/ko> (Zendesk Help Center API).
총 11 섹션 / 99개 article. **추출 시점: 2026-05-28**.

갱신:

```bash
curl -sS -A "Mozilla/5.0" "https://developers.coupangcorp.com/api/v2/help_center/ko/categories/360002105414/articles.json?per_page=100" -o /tmp/c.json
curl -sS -A "Mozilla/5.0" "https://developers.coupangcorp.com/api/v2/help_center/ko/categories/360002105414/sections.json?per_page=100" -o /tmp/s.json
# 그 후 본 인덱스 헤더의 jq 파이프라인으로 재생성 (Claude 에 요청).
```

---

## 카테고리 APIs (6)

- [카테고리 메타정보 조회](https://developers.coupangcorp.com/hc/ko/articles/360034035713)
- [카테고리 추천](https://developers.coupangcorp.com/hc/ko/articles/360033509234)
- [카테고리 자동 매칭 서비스 동의 확인](https://developers.coupangcorp.com/hc/ko/articles/900003703946)
- [카테고리 목록조회](https://developers.coupangcorp.com/hc/ko/articles/360033400814)
- [카테고리 조회](https://developers.coupangcorp.com/hc/ko/articles/360034035753)
- [카테고리 유효성 검사](https://developers.coupangcorp.com/hc/ko/articles/360033517174)

## 상품 APIs (22)

- [상품 생성](https://developers.coupangcorp.com/hc/ko/articles/360033877853)
- [상품 승인 요청](https://developers.coupangcorp.com/hc/ko/articles/360033644894)
- [상품 조회](https://developers.coupangcorp.com/hc/ko/articles/360033644994)
- [상품 조회 (승인불필요)](https://developers.coupangcorp.com/hc/ko/articles/360042701211)
- [상품 수정 (승인필요)](https://developers.coupangcorp.com/hc/ko/articles/360034156073)
- [상품 수정 (승인불필요)](https://developers.coupangcorp.com/hc/ko/articles/360042169352)
- [상품 삭제](https://developers.coupangcorp.com/hc/ko/articles/360033644954)
- [상품 등록 현황 조회](https://developers.coupangcorp.com/hc/ko/articles/4404525347353)
- [상품 목록 페이징 조회](https://developers.coupangcorp.com/hc/ko/articles/360033645034)
- [상품 목록 구간 조회](https://developers.coupangcorp.com/hc/ko/articles/360033645054)
- [상품 상태변경이력 조회](https://developers.coupangcorp.com/hc/ko/articles/360034156213)
- [상품 요약 정보 조회](https://developers.coupangcorp.com/hc/ko/articles/360033645094)
- [상품 아이템별 수량/가격/상태 조회](https://developers.coupangcorp.com/hc/ko/articles/360033645114)
- [상품 아이템별 수량 변경](https://developers.coupangcorp.com/hc/ko/articles/360034156253)
- [상품 아이템별 가격 변경](https://developers.coupangcorp.com/hc/ko/articles/360034156273)
- [상품 아이템별 판매 재개](https://developers.coupangcorp.com/hc/ko/articles/360033645154)
- [상품 아이템별 판매 중지](https://developers.coupangcorp.com/hc/ko/articles/360034156313)
- [상품 아이템별 할인율 기준가격 변경](https://developers.coupangcorp.com/hc/ko/articles/360034156333)
- [자동생성옵션 활성화 (옵션 상품 단위)](https://developers.coupangcorp.com/hc/ko/articles/27244057869209)
- [자동생성옵션 활성화 (전체 상품 단위)](https://developers.coupangcorp.com/hc/ko/articles/27244235299609)
- [자동생성옵션 비활성화 (옵션 상품 단위)](https://developers.coupangcorp.com/hc/ko/articles/27244841785497)
- [자동생성옵션 비활성화 (전체 상품 단위)](https://developers.coupangcorp.com/hc/ko/articles/27246230561177)

## 교환 APIs (4)

- [교환요청 목록조회](https://developers.coupangcorp.com/hc/ko/articles/360033397594)
- [교환요청상품 입고 확인처리](https://developers.coupangcorp.com/hc/ko/articles/360034027834)
- [교환요청 거부 처리](https://developers.coupangcorp.com/hc/ko/articles/360034027874)
- [교환상품 송장 업로드 처리](https://developers.coupangcorp.com/hc/ko/articles/360034027954)

## 쿠폰 / 캐시백 APIs (21)

- [(공통)예산현황 조회](https://developers.coupangcorp.com/hc/ko/articles/360033922353)
- [(공통)계약서 단건 조회](https://developers.coupangcorp.com/hc/ko/articles/360034204213)
- [(공통)계약서 목록 조회](https://developers.coupangcorp.com/hc/ko/articles/360034204233)
- [[즉시할인쿠폰] 생성](https://developers.coupangcorp.com/hc/ko/articles/360034208913)
- [[즉시할인쿠폰] 파기](https://developers.coupangcorp.com/hc/ko/articles/360034208973)
- [[즉시할인쿠폰] 요청상태 확인](https://developers.coupangcorp.com/hc/ko/articles/360033685834)
- [[즉시할인쿠폰] 아이템 생성](https://developers.coupangcorp.com/hc/ko/articles/360034209053)
- [[즉시할인쿠폰] 단건 조회(couponId)](https://developers.coupangcorp.com/hc/ko/articles/360034209373)
- [[즉시할인쿠폰] 단건 조회(couponItemId)](https://developers.coupangcorp.com/hc/ko/articles/360034209413)
- [[즉시할인쿠폰] 단건 조회(vendorItemId)](https://developers.coupangcorp.com/hc/ko/articles/360033685594)
- [[즉시할인쿠폰] 목록 조회(status)](https://developers.coupangcorp.com/hc/ko/articles/360034209513)
- [[즉시할인쿠폰] 목록 조회(orderId)](https://developers.coupangcorp.com/hc/ko/articles/360034209573)
- [[즉시할인쿠폰] 아이템 목록 조회(status)](https://developers.coupangcorp.com/hc/ko/articles/360034209633)
- [[다운로드쿠폰] 생성](https://developers.coupangcorp.com/hc/ko/articles/360034205493)
- [[다운로드쿠폰] 파기](https://developers.coupangcorp.com/hc/ko/articles/360033683034)
- [[다운로드쿠폰] 아이템 생성](https://developers.coupangcorp.com/hc/ko/articles/360034208773)
- [[다운로드쿠폰] 요청상태 확인](https://developers.coupangcorp.com/hc/ko/articles/360034209973)
- [[다운로드쿠폰] 단건 조회(couponId)](https://developers.coupangcorp.com/hc/ko/articles/360033685974)
- [[도서] 상품 캐시백 적용](https://developers.coupangcorp.com/hc/ko/articles/360033645234)
- [[도서] 상품 캐시백 검색](https://developers.coupangcorp.com/hc/ko/articles/360033645254)
- [[도서] 상품 캐시백 삭제](https://developers.coupangcorp.com/hc/ko/articles/360033645274)

## 물류센터 APIs (8)

- [출고지 생성](https://developers.coupangcorp.com/hc/ko/articles/360033918753)
- [출고지 조회](https://developers.coupangcorp.com/hc/ko/articles/360033644754)
- [출고지 수정](https://developers.coupangcorp.com/hc/ko/articles/360034155933)
- [반품지 생성](https://developers.coupangcorp.com/hc/ko/articles/360033644794)
- [반품지 목록 조회](https://developers.coupangcorp.com/hc/ko/articles/360033644814)
- [반품지 수정](https://developers.coupangcorp.com/hc/ko/articles/360033644834)
- [반품지 단건 조회](https://developers.coupangcorp.com/hc/ko/articles/360034156013)
- [택배사 코드](https://developers.coupangcorp.com/hc/ko/articles/360034156033)

## 배송 / 환불 APIs (12)

- [발주서 목록 조회(일단위 페이징)](https://developers.coupangcorp.com/hc/ko/articles/360033919573)
- [발주서 목록 조회(분단위 전체)](https://developers.coupangcorp.com/hc/ko/articles/360033792774)
- [발주서 단건 조회(shipmentBoxId)](https://developers.coupangcorp.com/hc/ko/articles/360033792854)
- [발주서 단건 조회(orderId)](https://developers.coupangcorp.com/hc/ko/articles/360034320553)
- [배송상태 변경 히스토리 조회](https://developers.coupangcorp.com/hc/ko/articles/360033792934)
- [상품준비중 처리](https://developers.coupangcorp.com/hc/ko/articles/360033792994)
- [송장업로드 처리](https://developers.coupangcorp.com/hc/ko/articles/360033793014)
- [송장업데이트 처리](https://developers.coupangcorp.com/hc/ko/articles/360034320653)
- [출고중지완료 처리](https://developers.coupangcorp.com/hc/ko/articles/360034320673)
- [이미출고 처리](https://developers.coupangcorp.com/hc/ko/articles/360033793034)
- [주문 상품 취소 처리](https://developers.coupangcorp.com/hc/ko/articles/360033843154)
- [장기미배송 배송완료 처리](https://developers.coupangcorp.com/hc/ko/articles/360034320713)

## 반품 APIs (7)

- [반품 / 취소 요청 목록 조회](https://developers.coupangcorp.com/hc/ko/articles/360033919613)
- [반품요청 단건 조회](https://developers.coupangcorp.com/hc/ko/articles/360034562353)
- [반품상품 입고 확인처리](https://developers.coupangcorp.com/hc/ko/articles/360034027214)
- [반품요청 승인 처리](https://developers.coupangcorp.com/hc/ko/articles/360034562513)
- [반품철회 이력 기간별 조회](https://developers.coupangcorp.com/hc/ko/articles/360034027354)
- [반품철회 이력 접수번호로 조회](https://developers.coupangcorp.com/hc/ko/articles/360034027374)
- [회수 송장 등록](https://developers.coupangcorp.com/hc/ko/articles/360034027394)

## CS APIs (6)

- [상품별 고객문의 조회](https://developers.coupangcorp.com/hc/ko/articles/360033400754)
- [상품별 고객문의 답변](https://developers.coupangcorp.com/hc/ko/articles/360033645174)
- [쿠팡 고객센터 문의조회](https://developers.coupangcorp.com/hc/ko/articles/360033645354)
- [쿠팡 고객센터 문의 단건 조회](https://developers.coupangcorp.com/hc/ko/articles/20376877844249)
- [쿠팡 고객센터 문의답변](https://developers.coupangcorp.com/hc/ko/articles/360034156233)
- [쿠팡 고객센터 문의확인](https://developers.coupangcorp.com/hc/ko/articles/360034204013)

## 정산 APIs (2)

- [매출내역 조회](https://developers.coupangcorp.com/hc/ko/articles/360033922413)
- [지급내역조회](https://developers.coupangcorp.com/hc/ko/articles/360034152213)

## 로켓그로스 APIs (9)

- [로켓그로스 주문API](https://developers.coupangcorp.com/hc/ko/articles/41129805240473)
- [로켓그로스 주문 API(목록 쿼리)](https://developers.coupangcorp.com/hc/ko/articles/41131195825433)
- [로켓창고 재고 API](https://developers.coupangcorp.com/hc/ko/articles/41090779386521)
- [카테고리 목록 조회 (로켓그로스 운영 카테고리)](https://developers.coupangcorp.com/hc/ko/articles/39428894927257)
- [카테고리 메타 정보 조회](https://developers.coupangcorp.com/hc/ko/articles/39429124103449)
- [상품 생성 (로켓그로스 및 마켓플레이스/로켓그로스 동시 운영 상품)](https://developers.coupangcorp.com/hc/ko/articles/39406974365849)
- [상품 수정 (로켓그로스 또는 마켓플레이스/로켓그로스 동시 운영 상품)](https://developers.coupangcorp.com/hc/ko/articles/39407792403609)
- [상품 조회 (로켓그로스 또는 마켓플레이스/로켓그로스 동시 운영 상품)](https://developers.coupangcorp.com/hc/ko/articles/37338749441689)
- [상품 목록 페이징 조회 (로켓그로스 및 로켓그로스/마켓플레이스 동시 운영 상품)](https://developers.coupangcorp.com/hc/ko/articles/39427498030745)

## 브랜드 APIs (2)

- [등록 브랜드 목록](https://developers.coupangcorp.com/hc/ko/articles/58230230681625)
- [브랜드 검색](https://developers.coupangcorp.com/hc/ko/articles/58230017410841)

