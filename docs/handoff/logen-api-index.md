# 로젠택배 Open API 인덱스 (자동 추출)

출처: <https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/> (로젠 OpenAPI 정적 HTML docs, Zendesk 아님).
총 7 섹션 / 19개 article. **추출 시점: 2026-05-29**.

- API 환경: 개발계 `topenapi.ilogen.com` / 운영계 `openapi.ilogen.com` (각 article 본문 URL 섹션 참조)
- 인증키 발급: 신청프로세스(`guide/apply-process.html`) → 인증키발급(`guide/api-key.html`), 토큰 사용법 `dev-guide/token-usage.html`
- spec 상세: `docs/architecture/v1/features/logen-api/<slug>/<screen>.md`
- 마켓 어댑터(로젠 배송/송장) 작업 직전 stale 위험 — 본 인덱스 재추출 권장 (`/market-api-docs-import`).

---

## 거래처 계약 (2) — slug: `contract`

- [거래처 계약정보 통합조회](https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/contract-info.html) → `logen-api/contract/contract-info.md`
- [운임구분에 따른 계약 운임 조회](https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/contract-fare.html) → `logen-api/contract/contract-fare.md`

## 자체 시스템 송장출력 (4) — slug: `invoice-self`

- [송장번호 채번](https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/invoice-number-assign.html) → `logen-api/invoice-self/invoice-number-assign.md`
- [전화번호에 대한 안심번호 제공](https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/safe-number.html) → `logen-api/invoice-self/safe-number.md`
- [송장 출력정보 통합조회](https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/invoice-print-info.html) → `logen-api/invoice-self/invoice-print-info.md`
- [송장 출력 주문 정보 등록](https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/invoice-order-register.html) → `logen-api/invoice-self/invoice-order-register.md`

## iLOGEN 주문등록 (2) — slug: `order`

- [주문 정보 일괄 등록](https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/bulk-order.html) → `logen-api/order/bulk-order.md`
- [출력 송장번호 조회](https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/invoice-query.html) → `logen-api/order/invoice-query.md`

## 로젠시스템 송장 출력 URL (1) — slug: `invoice-url`

- [로젠 제공 외부 운송장 출력 팝업](https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/logen-invoice-url.html) → `logen-api/invoice-url/logen-invoice-url.md`

## 반품 (7) — slug: `return`

- [반품 접수 등록](https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/return-register.html) → `logen-api/return/return-register.md`
- [반품 집하지점 및 운임 조회](https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/return-branch-fare.html) → `logen-api/return/return-branch-fare.md`
- [반품 계약 운임 조회](https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/return-contractfare.html) → `logen-api/return/return-contractfare.md`
- [반품 요청 상태 및 송장번호 조회](https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/return-status-invoice.html) → `logen-api/return/return-status-invoice.md`
- [반품 요청 상태 및 송장번호 조회 (주문번호)](https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/return-status-invoice-order.html) → `logen-api/return/return-status-invoice-order.md`
- [반품접수 정보 조회](https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/return-info.html) → `logen-api/return/return-info.md`
- [반품 취소 등록](https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/return-cancel.html) → `logen-api/return/return-cancel.md`

## 화물추적 (2) — slug: `tracking`

- [화물추적 조회](https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/tracking-api.html) → `logen-api/tracking/tracking-api.md`
- [최종 화물추적 조회](https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/tracking-final.html) → `logen-api/tracking/tracking-final.md`

## 기타 (1) — slug: `etc`

- [물품금액에 따른 할증운임 조회](https://openapihome.ilogen.com/lsy06f-api-service/pages/api-docs/etc.html) → `logen-api/etc/etc.md`
