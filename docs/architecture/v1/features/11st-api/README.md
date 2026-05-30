# 11번가 셀러 OpenAPI — spec import (전략 D)

11번가 셀러 OpenAPI(개발가이드) 의 article 단위 spec 을 마크다운으로 변환·인덱싱한 영구 산출물.
어댑터(`apps/api/supabase/functions/_shared/markets/11st/*`) 구현 시 외부 사이트 재조회 없이 grep / Read 로 참조하기 위함.

- **인덱스**: [docs/handoff/11st-api-index.md](../../../../handoff/11st-api-index.md) (섹션·카테고리별 전체 API 링크)
- **상세 spec**: 이 디렉토리 `<section>/<category>-<apiSeq>.md` — 26 카테고리 / 150 API (145 추출 + 5 원본 미제공)
- **추출 시점**: 2026-05-30

---

## 1. 사이트 유형 — 전략 D (embedded jsonData spec, 인증 게이트)

`OpenApiGuide.tmall?categoryNo=N&apiSeq=M&apiSpecType=1` 페이지는 **서버가 항상 동일한 기본 HTML 을 주고**, 실제 spec 은
`<div class="specArea">` 가 비어 있는 채로 `<script>` 안의 `var jsonData = {...}` (machine-readable) 를 클라이언트가 렌더한다.

- **인증 게이트**: 셀러 로그인 세션이 없으면 서버는 공개 "상품검색 OpenAPI"(commonGuide 4종)로 폴백한다.
  익명 curl / 브라우저 모두 셀러 API spec 을 못 본다. → 본 import 는 **셀러 세션 쿠키**로 수행했다.
- spec 본문(요청/응답 필드 트리·예시·enum·sampleCode)은 HTML 테이블이 아니라 `jsonData` 에서 추출했다.
  Zendesk nested-table 평탄화 같은 손실 없이 `name / label / description / example / require / valueType / 길이 / 코드값(enum)` 이 깔끔히 보존된다.

### 재추출 방법 (stale 시)

1. 11번가 셀러 계정으로 `openapi.11st.co.kr` 로그인 → 셀러 메뉴(상품관리 등)가 보이는지 확인.
2. DevTools → Network → `OpenApiGuide.tmall` 문서 요청의 `Cookie` 헤더 전체 복사 (또는 `JSESSIONID`).
3. 각 `categoryNo` 페이지 → apiSeq 서브목록 추출 → 각 apiSeq 페이지의 `jsonData` 파싱 → 변환.
   (euc-kr 페이지이므로 `iconv -f euc-kr -t utf-8` 필요.)

> 자동 동기화하지 않는다. 원본이 갱신돼도 이 md 는 그대로 — 어댑터 작업 직전 재추출 권장.

---

## 2. 호출 환경 / 인증

| 항목 | 값 |
|---|---|
| 실 호출 base | `https://api.11st.co.kr/rest/...` (구버전 일부 `http://`) |
| 요청/응답 형식 | **XML** (sample 은 euc-kr, 실제 UTF-8 권장) |
| 인증 | HTTP 헤더 **`openapikey`** (셀러가 발급받은 OpenAPI Key) |
| OAuth / refresh | **없음** — 정적 API Key 방식 |

### 자격증명 모델 (프로젝트 연동)

- `openapikey` 는 **셀러가 11번가 셀러오피스(API 관리)에서 발급받아 앱에 직접 입력**하는 per-seller 자격증명이다.
  코드·문서·로그에 평문으로 박지 않는다. → `market_accounts.credential_payload` (jsonb, pgcrypto 암호화) 에 저장,
  Edge Function 에서 복호화해 요청 시 `openapikey` 헤더로 주입.
- CLAUDE.md `AuthInput` 4-way union 기준 11번가 = **`api_key`** 타입 (oauth_code / hmac_key / esm_jwt 아님).
- **IP 화이트리스트**: 11번가도 키 발급/호출 시 고정 IP 화이트리스트를 요구. 모든 호출은 AWS Lightsail Market Gateway
  (서울, 고정 IP `3.36.239.243`) 경유. 셀러는 이 IP 를 셀러오피스에 등록 후 키 발급
  (`docs/architecture/v1/cross-cutting/market-gateway.md`).

> ⚠️ sampleCode 의 키 값은 `<OPENAPI_KEY>` 로 마스킹했다 (원문 더미 키 제거).

---

## 3. 카테고리 구조 (LNB 트리 = source of truth)

```
공통 API
  상품          38 카테고리조회 · 39 상품조회 · 40 재고처리 · 41 상품Q&A
                42 판매중지 · 43 배송 · 44 우편번호 · 81 상품관리
  주문          110 결제완료 · 111 발주처리 · 112 발송처리 · 113 완료조회 · 114 예약판매 · 115 조회
  취소교환반품   48 취소처리 · 49 교환처리 · 50 반품처리
  셀러기획전     54 기획전조회관리
  알리미        58 알림조회관리
  정산          151 정산조회
물류 API
  해외물류       63 상품 · 64 발주발송 · 65 취소교환반품
  전세계배송     67 조회 · 68 상태처리 · 69 배송
```

섹션 slug ↔ dep2 그룹: `product`(상품) `order`(주문) `claim`(취소교환반품) `seller-plan`(셀러기획전)
`notify`(알리미) `settlement`(정산) `global-logistics`(해외물류) `global-shipping`(전세계배송).

### 어댑터 매핑 힌트 (5메서드 기준)

- `fetchCategoryTree` → 38 카테고리조회 (`1001` 전체 / `1617` 하위)
- `transformProduct` / `createProduct` → 81 상품관리 (`1003` 상품등록 / `1619` 상품수정), 가격/옵션/상세 수정 1752·1849·1850·1851 등
- 배송 정책·출고지 → 43 배송 (`6701` 출고지 등록, `1078` 출고지 배송비 정책 등)
- 주문 수집·발송 → 110~115 / 클레임 48~50

> 일부 apiSeq 는 2개 카테고리에 교차 등재됨(예: `1639` 취소신청목록조회 = 취소처리 & 해외물류). 메뉴 구조를 따라 양쪽에 배치.

---

## 4. 원본 미제공 (5건)

전세계배송 › 조회 카테고리의 아래 apiSeq 는 11번가 페이지 자체가 `var jsonData = ''` (콘텐츠 없음):
`1316` `1318` `1319` `6705` `6706`. 인덱스에 취소선으로 표기.
