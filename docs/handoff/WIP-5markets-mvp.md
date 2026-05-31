# MarketCast — WIP 핸드오프 (카테고리 게이트웨이 lazy cascading + 이미지 썸네일 fix · v0.18 release 예정)

**develop HEAD**: `5d5d3bb` — fix(category): 카테고리 게이트웨이 경유 lazy cascading 조회 (#303)
**main HEAD**: `bf89065` — release: v0.17 (#299) · **Deploy (real) success (2026-05-30 17:19)** — 운영 배포본
**테스트**: 1402 passed / 1 skipped / 31 todo (127 files) · **deno check 26 entrypoint green**
**갱신일**: 2026-05-31
**develop 누적(→v0.18, 미릴리즈)**: 이미지 썸네일 signed URL #301 · **카테고리 lazy cascading #303**

---

## 2026-05-31 세션 — 카테고리 CORS 버그 수정 (게이트웨이 경유 lazy cascading)

### 문제
s3 3단계 카테고리 select 가 **브라우저에서 마켓 실도메인을 직접 fetch**(api-gateway.coupang.com / api.11st.co.kr / sa2.esmplus.com) → CORS 로 전 마켓 "카테고리를 불러오지 못했습니다". `market-gateway.md §3`(Browser→Edge→GW→마켓) + "프론트 BFF 불가" 룰 위반. 배송조회는 이미 Edge 경유였으나 **카테고리만 잔존**(C3 real 미검증으로 미발견).

### 수정 (#303) — 마스터: `features/category-sync.md`
방대 카테고리(쿠팡/네이버 수만개)는 전체 트리 불가 → **부모코드 직계 자식만 조회하는 lazy cascading** 으로 통일.
- **BE**: 신규 Edge `markets-category-children`(ownership + loadCredential + 어댑터 `fetchCategoryChildren`, gatewayFetch 경유). 서버 어댑터 신규 optional `fetchCategoryChildren(parentId)` — 쿠팡 `display-categories/{code}` / ESM `site-cats/{code}` / 11번가 1001 전체+`parentDispNo` 필터. 11번가 키 불필요 graceful, 네이버 미구현→`category_not_supported`.
- **FE**: `category-api` invoke 전환 + `CategoryFetchError`, `useMarketCategoryChildren` hook(staleTime 1h). 신규 `CategoryCascader`(대→중→소 단계별 select, leaf 확정, 4상태 + 네이버 안내). `MarketOptionsCard` 통합. **web real 어댑터 `fetchCategoryTree` 직접 fetch 제거**(Edge 이전) + parity/단위테스트 정리.
- **4마켓 완전동작**(쿠팡/11번가/G마켓/옥션). **네이버는 인터페이스만** — 어댑터 stub + 스펙 부재 + 키 미발급 → 실구현 후속(C7).

### 동반 — 이미지 썸네일 signed URL (#301, 직전)
상품 이미지 단계 썸네일이 private 버킷에 `getPublicUrl` 호출 → 403. `createSignedUrl('product-images-original', path, 3600)` 비동기 발급으로 교체. Stepper 데스크탑 라벨 truncate("마켓 · 카테고리")도 #303 에서 동반 수정.

---

## ⚠ 운영 액션 상태 — 없음 (즉시 필요한 수동 작업 없음)

- **#303 신규 마이그 없음** — 카테고리 조회는 DB 변경 무관. real DB 영향 0.
- **신규 Edge Function `markets-category-children`** 은 다음 release 의 `functions:deploy:real`(deploy.yml) 이 자동 배포. 별도 수동 액션 불필요.
- dev·real DB 마이그는 v0.17 까지 정합 완료(직전 세션).

---

## ⚠ carry-over 백로그 (v1 머지 차단 아님)

| # | 항목 | 사유 / 진입 |
|---|---|---|
| **C3** | **real 실호출 검증** (5마켓 mock+parity 까지만) | 셀러 자격증명 + IP `3.36.239.243` 화이트리스트 → 키 발급 후 1회 실호출. **현재 키 미발급 보류. 다음 release 핵심 게이트.** (#294 네이버 OAuth refresh + #303 카테고리 경로 모두 게이트웨이 경유로 선정비됨) |
| **C7** | **네이버 카테고리 real 어댑터** | 서버 어댑터 `fetchCategoryChildren` stub + 커머스 카테고리 API 스펙 문서 부재. `market-api-docs-import` 로 스펙 확보 + 어댑터 구현 + 키 발급 후 실검증. (현재 UI 는 `category_not_supported` → 안내 카드) |
| **C4** | **11번가 상품군(officialNotice) 코드 마스터** | spec 1003 의 1군만 확보, 40군 셀러 free-form. 첨부/고시 조회 API 확보 시 보강 |
| **C5** | **PR-3 이미지 ≥13장 truncate** | warning 처리됨 — 추가 UX(사전 경고) v2 |
| **C6** | **mcp_ro_dev `supabase_migrations` read GRANT** | MCP 로 dev 마이그 이력 조회 불가(편의) |

> **해소됨**: 이미지 썸네일 #301 · 카테고리 CORS #303 · 배송정책 RLS 42501 #295 · audit sellerId #294 · Deno CI #296.
> 후속(category-sync.md §9): 클라이언트 web 어댑터 createProduct 등 미사용 메서드 정리 / 카테고리 검색 UX.

---

## 스택 한눈에

```
프론트:  React 18 + Vite + TS strict + shadcn + Tailwind + TanStack Query + RHF + zod + Tiptap + Daum Postcode + DOMPurify
백엔드:  Supabase (Postgres + RLS + Auth + Storage + Realtime + Edge Functions Deno + pg_cron + Vault)
         + AWS Lightsail Market Gateway (서울, 3.36.239.243, HMAC + 호스트 화이트리스트)
호스팅:  GitHub Pages (정적 SPA + 404.html) + Supabase Cloud
모니터링: Sentry (PII 마스킹 강제)
CI/CD:   GitHub Actions — 빠른레인(feature push=Lint&Typecheck/Unit) + 풀게이트(PR=Build dev·real/E2E golden+a11y/pgTAP/deno-check, 경로필터 app·sql·functions). required=CI Gate/Lint&Typecheck/Unit 3개
브랜치:  Git Flow (main / develop / release/* / feature/* / hotfix/*) — feature base = develop, squash-only, strict
빌드모드: VITE_APP_MODE=dev|real + VITE_USE_MOCK=true|false
MCP 호스팅: Lightsail 3.36.239.243 docker-compose (supabase-dev=뭄바이풀러 / supabase-real=서울풀러 / playwright / sentry)
```

## 도메인 모델

```
상품 등록 (s1~s6)
Seller (auth.users) ─┬─ MarketAccount ── credential_payload jsonb + pgcrypto
                     │     (배송 Layer 2 = 마켓 콘솔 등록분 GET 조회 → select, 우리 DB 저장 없음 ★조회형 단일표준)
                     ├─ Product ─┬─ ProductImage ─ ImageTransform (private 버킷 + signed URL ★#301)
                     │           └─ ProductMarketMapping (카테고리 ★lazy cascading: Edge markets-category-children
                     │                                    + marketOptions: 출고지/반품지·officialNotice + certRequiredYn)
                     ├─ RegistrationJob ─── JobMarketResult (1:N)
                     └─ ShippingPolicy (Layer 1 = 요금 의도 / seller_id default auth.uid() ★#295)
주문·배송 (s7~s9): Order(+extra jsonb dlvNo) → OrderGroup / ShippingJob → ShippingJobResult / LogenCredentials
카테고리 조회: Browser → Edge markets-category-children → gatewayFetch → GW → 마켓 (부모코드 직계 자식 lazy) ★#303
공통: _shared/carrier-codes.ts (택배사 단일소스) · _shared/xml.ts (ns2 파서) · _shared/gatewayFetch.ts
```

## 완료된 작업 (요약)

| 단계 | 내용 | 비고 |
|---|---|---|
| Stage A~D / v0.4~v0.11 | 부트스트랩 + s1~s6 + 4마켓 어댑터 + 주문배송 + WYSIWYG + Gateway + 운영안전망 | 운영 배포 |
| v0.14~v0.15.1 | hookify + 11번가 placeholder + 5마켓 주문 수집 + hotfix | 운영 배포 |
| v0.16 (#270~#280) | 11번가 재구현 PR-0~6 + ESM 조회형 전환 + CI 빠른레인 | 운영 배포 |
| v0.17 (#291·#292·#294·#295·#296·#297·#299) | 11번가 NEW-1/2 plumbing + deno 타입정합 + CI deno + 배송정책 RLS + npx | 운영 배포 (real success) |
| **develop 누적 (#301·#303)** | **이미지 썸네일 signed URL + 카테고리 게이트웨이 lazy cascading (CORS fix)** | **develop 머지 (→v0.18 release 예정)** |

## 운영 현황

- **운영 배포 URL**: `https://rumeadia-dotcom.github.io/ing0415/` · **직전 deploy = v0.17 (#299) success (2026-05-30 17:19)**
- **dev Supabase** (`eqoyw`, 뭄바이): v0.17 마이그 정합 완료. #303 신규 마이그 없음.
- **real Supabase** (`lfrny`, 서울): v0.17 마이그 정합 완료. #303 신규 마이그 없음.
- **Lightsail 게이트웨이**: allowlist + maskUrl 재배포 완료 (healthz 200). 카테고리 조회도 동일 게이트웨이 경유.
- **MCP supabase-dev**: 정상.

---

## 다음 세션 진입

```bash
git pull origin develop && pnpm install && pnpm test
```
**1402 passed** 확인 후 진입. (Edge 타입: `deno check --node-modules-dir=none apps/api/supabase/functions/*/index.ts` — deno 2.8.1, CI deno-check 자동.)

### 우선 순위
1. **release/v0.18 → main 배포** — develop 누적(#301 이미지 + #303 카테고리) 운영 반영. 신규 Edge `markets-category-children` 배포 동반(deploy.yml functions:deploy 자동). 신규 마이그 없음.
2. **C3 real 실호출 검증** — 셀러 키 발급 + IP 화이트리스트 후 5마켓 1회. **다음 release 핵심 게이트** (키 미발급 보류). 카테고리 lazy 경로도 이때 실검증.
3. **C7 네이버 카테고리 real 어댑터** — 스펙 확보(market-api-docs-import) + 구현. 그 외 C4~C6.

> 카테고리 CORS 버그 해소(4마켓 게이트웨이 경유 동작). 네이버 카테고리 + 5마켓 실호출은 키 발급 후.

---

## 백로그 (v1 이후 / 영구 보류)

- 네이버 카테고리 real 어댑터(C7) / 11번가 상품군 코드 마스터(C4) / 카테고리 검색 UX(category-sync.md §9) — v2
- 클라이언트 web 어댑터 createProduct·fetchOrders 등 미사용 메서드 정리 (런타임은 Edge worker) — 별도 트랙
- 알림 / CSV / 오류 통계 차트 / 이미지 WebP — 미진입 v1 스코프
- 쿠팡 미구현 endpoint / s4 템플릿 / 소셜 / 2FA / Stripe·PG / 멀티유저 권한 — v2~보류

---

## ⚠ 룰 강제 메모

### 마켓 API 는 클라이언트 직접 호출 금지 (#303 사고)
- 모든 마켓 API 호출(카테고리·배송조회·등록·주문)은 **Edge Function → gatewayFetch → Lightsail GW** 경유. 브라우저 직접 fetch = CORS 차단 + IP 화이트리스트 위반. web real 어댑터의 `fetchCategoryTree` 는 throw(미사용) — 카테고리는 `markets-category-children` Edge.

### owner 컬럼 default auth.uid() (#295 사고)
- 클라이언트 직접 INSERT RLS 테이블은 `seller_id` 컬럼 default `auth.uid()`. 누락 시 42501.

### Edge(Deno) 타입 검증
- deno 2.8.1. `deno check --node-modules-dir=none apps/api/supabase/functions/*/index.ts`. CI deno-check 잡이 functions 변경 시 자동(#296).

### Git Flow / 운영 인프라
- feature/* 는 develop 분기. develop/main 직접 push 차단(PR 경유). required=CI Gate/Lint&Typecheck/Unit.
- Lightsail SSH·DB push 는 사용자 직접. MCP supabase read-only. gh: `C:\Program Files\GitHub CLI\gh.exe`. deno: `~/.deno/bin/deno.exe`.
