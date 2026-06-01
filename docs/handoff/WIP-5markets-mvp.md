# MarketCast — WIP 핸드오프 (수량 구간 배송비 C9 구현 완료 / 카테고리 추천 Phase 1 / v0.19 운영)

**develop HEAD**: `4c5026e` — docs(shipping): 수량 구간(박스) 배송비 설계 + WIP 갱신 (C9) (#314)
**이 브랜치**: `feature/quantity-tiered-shipping` — **C9 수량 구간(박스) 배송비 구현 완료 (옵션 A)** · **PR #316 → develop (CI 대기)**
**main HEAD**: `e48d7e0` — release: v0.19 — 이미지 업로드 멱등 fix (#308) · **Deploy (real) success (2026-05-31)**
**테스트**: 1468 passed / 1 skipped / 31 todo (135 files) · **deno check 28 entrypoint green**
**갱신일**: 2026-06-01
**develop 누적(→v0.20, 미릴리즈)**: 카테고리 추천 Phase 1 #312 (**마이그 3개**) + Phase 0 fix #311 + 수량구간 배송비 설계 #314 + **C9 구현 #316 (마이그 1개)**

---

## 2026-06-01 세션 — 수량 구간(박스) 배송비 C9 구현 완료 (PR #316, 옵션 A)

상품마다 "박스당 N개·M원" 박스 모델로 수량 구간 배송비를 입력 → 마켓 등록. 배송 입력을 **별도 엔티티 필수 select** → **상품 인라인 `products.shipping_config jsonb` + 선택적 배송 템플릿**으로 재편. 스펙: `docs/superpowers/specs/2026-06-01-quantity-tiered-shipping-design.md`.

### 구현 (카테고리별)
- **계산 로직**: `expandBoxToTiers` 순수함수 + 4마켓 변환기 (`_shared/market-adapters/box-shipping.ts`, type-only import → Vitest 직접) + `effectiveSingleFee`. web 프리뷰 `lib/shipping/expand-box.ts`(`describeTiers`).
- **zod 단일 소스**: web `lib/schemas/shipping-config.ts`(`ShippingConfigSchema` / `ShippingTemplateSchema` 중첩 `{name,isDefault,config}`) + Edge 미러 `_shared/schemas.ts`. feeType: `free/conditional_free/paid/quantity_tiered/charge_on_delivery`. box=`{qtyPerBox≥2,feePerBox}`. `ShippingMethodSchema`→`common.ts` 이동(순환 차단).
- **마이그 1개**: `20260601000004` — `products.shipping_config jsonb NOT NULL`(+default free) 추가 / `shipping_policy_id` FK 제거 / `shipping_policies` → 템플릿(`config jsonb`, flat fee·method·eta_days 드롭). seed·rls-cross-tenant 정합.
- **서버**: 워커/validate 가 `parseShippingConfig`+`effectiveSingleFee` 로 `shipping_config` 읽기(구 `resolveShippingFee` 제거). `Product.shippingFeeKrw` 유지(파생) + `shippingConfig` 추가 → 기존 어댑터 back-compat.
- **어댑터 wiring (옵션 A)**: **11번가** `dlvCstInstBasiCd=04`+`dlvCnt1/2/dlvCst3` / **쿠팡** fallback(박스당 단일 + `payload.warnings`, raw-only 전송으로 외부 누출 0). 네이버·ESM 변환기는 작성·단위테스트만 — wiring 은 C3·C7.
- **FE**: Step1 인라인 `ShippingConfigSection`(박스 실시간 미리보기) + 템플릿 적용 prefill / 설정 페이지 "배송 템플릿" 재편 / Step4 마켓별 배송비 미리보기 + 쿠팡 경고 / Step5 fallback 경고 배너.
- **문서**: shipping-fee-model / registration §3.2 / s3-register / 스펙 동기화. 고아 `shipping-policy.ts`·죽은 locale 키 정리.

### 직전 (#312·#311, 동일 develop)
카테고리 추천 Phase 1(전역 인덱스+검색+최근, 4마켓) + 카테고리 cascader Phase 0 fix.

---

## ⚠ 즉시 필요한 운영 액션 (v0.20 release 시)

### 1. real DB 마이그 적용 (apply_db_migrations) — **release main 머지 후 필수**
```
GitHub → Actions → "Deploy (real)" → Run workflow
  branch: main · apply_db_migrations: true · deploy_edge_functions: true
```
→ 마이그 `20260601000001`~`000003`(카테고리 Phase 1) + **`20260601000004`(C9 배송)** real(lfrny) 적용 + Edge `markets-category-index-build`·`markets-category-search` 배포.

### 2. dev DB 마이그 적용 (dev:db 테스트용) — **파괴적, 사용자 직접**
```
cd apps/api && npx supabase@latest db push
```
→ 카테고리 Phase 1 3개 + **C9 `20260601000004`**(products.shipping_config 추가·shipping_policy_id 드롭·shipping_policies enrich) dev(eqoyw) 적용. **미적용 시 dev:db 모드에서 상품 등록·배송 템플릿 insert 가 hard-fail(fail-fast).**

### 3. cron vault secret 확인 (운영 — 기등록 가능성 높음)
`category-prewarm-daily` cron 은 `supabase_functions_url`/`service_role_key` vault secret 재사용(orders-sync 동일). Vault 에서 확인만.

### 4. 배포 후 라이브 검증 (playwright)
카테고리 4마켓 검색→선택 / 최근 칩 / ESM building→ready. **C9**: 11번가 박스 등록(dev 키 불필요) / Step1 인라인 배송 + 실시간 미리보기 / 쿠팡 경고 / Step4·Step5 배너.

---

## ⚠ carry-over 백로그 (v1 머지 차단 아님)

| # | 항목 | 사유 / 진입 |
|---|---|---|
| **C3** | **real 실호출 검증** (5마켓 mock+parity 까지만) | 셀러 키 + IP `3.36.239.243` 화이트리스트 → 키 발급 후 1회. **다음 release 핵심 게이트.** 카테고리 lazy + Phase 1 ESM 빌드/검색 + **C9 11번가 박스 04 실등록 + 네이버 `deliveryFeeType` enum 리터럴 + ESM `FeeAmnt` 할증/상한 의미** 실검증. |
| **C7** | **네이버 카테고리 + 네이버 real 어댑터** | 어댑터 `transformProduct` stub. C9 네이버 박스 변환기(`naverBoxToDeliveryFee`)는 작성됨 → 어댑터 본체 구현 시 wiring. `market-api-docs-import` 스펙 확보 + 키 발급 후. |
| **C10** | **ESM 박스 배송비 wiring** | 변환기(`esmBoxToDetails`) 작성됨. ESM 조회형 placeNo 모델과 `each.feeType=4` 인라인 충돌 + §8.2 미검증 → C3 real 검증 후 wiring. |
| **C11** | web↔Edge `ShippingConfigSchema` superRefine 비대칭 | Edge 미러는 superRefine 없음(defensive safeParse 로 graceful). 방어심화 원하면 Edge 에도 미러 — 회귀 아님, 낮은 우선순위. |
| **C12** | web 어댑터 미사용 메서드 정리 | `apps/web/src/lib/markets/real/*` `transformProduct`·`createProduct` 런타임 미사용(Edge worker 가 런타임). 별도 정리 트랙. |
| **C4** | 11번가 상품군(officialNotice) 코드 마스터 | spec 1003 1군만, 40군 free-form |
| **C5** | 이미지 ≥13장 truncate 사전경고 UX | warning 처리됨 — v2 |
| **C6** | mcp_ro_dev supabase_migrations read GRANT | MCP 마이그 이력 조회 편의 |
| **C8** | 카테고리 추천 Phase 2 후보 | ESM 풀트리 resumable 빌드 · 마켓별 자동매핑(PRD §1.2.1) |

> **해소됨**: **C9 수량 구간(박스) 배송비 → 구현 완료 #316 (11번가·쿠팡 wired)** · 카테고리 검색 UX → Phase 1 #312 · 이미지 업로드 멱등 #307.
> 참고: 워커 fee 0원 하드코딩 버그는 C9 이전 `resolveShippingFee` 도입으로 이미 해소돼 있었고, C9 가 그 경로를 `shipping_config` 로 교체.

---

## 스택 한눈에

```
프론트:  React 18 + Vite + TS strict + shadcn + Tailwind + TanStack Query + RHF + zod + Tiptap + Daum Postcode + DOMPurify
백엔드:  Supabase (Postgres + RLS + Auth + Storage + Realtime + Edge Functions Deno + pg_cron + pg_trgm + Vault)
         + AWS Lightsail Market Gateway (서울, 3.36.239.243, HMAC + 호스트 화이트리스트)
호스팅:  GitHub Pages (정적 SPA + 404.html) + Supabase Cloud / 모니터링: Sentry (PII 마스킹)
CI/CD:   GitHub Actions — 빠른레인(feature push) + 풀게이트(PR=Build·E2E·pgTAP·deno-check, 경로필터). required=CI Gate/Lint&Typecheck/Unit 3개
브랜치:  Git Flow (main / develop / release/* / feature/* / hotfix/*) — feature base=develop, squash-only, strict
빌드모드: VITE_APP_MODE=dev|real + VITE_USE_MOCK=true|false
MCP 호스팅: Lightsail 3.36.239.243 (supabase-dev/real=read-only mcp_ro 뷰 / playwright / sentry)
```

## 도메인 모델

```
상품 등록 (s1~s6)
Seller (auth.users) ─┬─ MarketAccount ── credential_payload jsonb + pgcrypto
                     ├─ Product ─┬─ ProductImage ─ ImageTransform (private 버킷 + signed URL)
                     │           │   (UNIQUE (product_id, sha256) #307)
                     │           ├─ ProductMarketMapping (카테고리: 검색/최근/cascader 3경로 + marketOptions)
                     │           └─ shipping_config jsonb (C9 #316 — 인라인 배송 설정, feeType=quantity_tiered 시 box)
                     ├─ RegistrationJob ─── JobMarketResult (1:N)
                     └─ shipping_policies → C9: 배송 템플릿(config jsonb + name + is_default, prefill)으로 강등
주문·배송 (s7~s9): Order(+extra jsonb dlvNo) → OrderGroup / ShippingJob → ShippingJobResult / LogenCredentials
카테고리 (Phase 1): cascader(lazy) / 검색(market_category_index pg_trgm) / 최근(RPC) / 빌드(Edge·cron)
배송비 (C9): box → expandBoxToTiers → 11번가 04(wired)·쿠팡 fallback(wired)·네이버/ESM 변환기(미wiring)
공통: _shared/{carrier-codes,xml,gatewayFetch,category-index,box-shipping,shipping-fee}.ts
```

## 완료된 작업 (요약)

| 단계 | 내용 | 비고 |
|---|---|---|
| Stage A~D / v0.4~v0.17 | 부트스트랩 + s1~s6 + 5마켓 어댑터 + 주문배송 + Gateway + 11번가/ESM 재구현 | 운영 배포 |
| v0.18 (#301·#303) | 카테고리 게이트웨이 lazy cascading + 이미지 썸네일 signed URL | 운영 배포 |
| v0.19 (#307·#308) | 이미지 업로드 멱등 + product_images UNIQUE 완화 | **운영 배포 (real success)** |
| develop 누적 (#311·#312) | 카테고리 cascader Phase 0 fix + 카테고리 추천 Phase 1(마이그 3개) | develop 머지 |
| **C9 (#316)** | **수량 구간(박스) 배송비 — 인라인 재편 + 11번가/쿠팡 wiring (옵션 A, 마이그 1개, 14커밋)** | **PR #316 → develop (CI 대기)** |

## 운영 현황

- **운영 배포 URL**: `https://rumeadia-dotcom.github.io/ing0415/` · 직전 deploy = v0.19 (#308) success + Deploy(real) dispatch (2026-05-31)
- **dev Supabase** (`eqoyw`): v0.19 까지 정합. **카테고리 Phase 1 3개 + C9 1개 마이그 미적용** (운영 액션 2).
- **real Supabase** (`lfrny`): v0.19 까지 정합. **Phase 1 + C9 마이그 미적용** (운영 액션 1 — release 후).
- **Lightsail 게이트웨이**: healthz 200.

---

## 다음 세션 진입

```bash
git pull origin develop && pnpm install && pnpm test
```
**1468 passed** 확인 후 진입. (Edge: `~/.deno/bin/deno check --node-modules-dir=none apps/api/supabase/functions/*/index.ts`, deno 2.8.1.)

### 우선 순위
1. **PR #316 머지(squash) → develop** — CI green 확인 후. 머지 후 **dev DB 마이그 push**(운영 액션 2) 해야 dev:db 모드 동작.
2. **release/v0.20 → main 배포 + 마이그 적용** — Phase 0/1 + C9 운영 반영. main 머지 후 **apply_db_migrations workflow_dispatch 필수**(운영 액션 1) + cron vault 확인(3) + playwright 검증(4).
3. **C3 real 실호출 검증** — 셀러 키 + IP 화이트리스트 후 5마켓 1회. C9 11번가 박스 실등록 + 네이버 enum·ESM FeeAmnt 확정 → 그때 C7(네이버)·C10(ESM) wiring.

> C9 구현 완료(11번가·쿠팡 wired). release 시 마이그 4개(Phase1 3 + C9 1) 적용이 핵심 운영 액션.

---

## 백로그 (v1 이후 / 영구 보류)

- 네이버 real 어댑터/카테고리(C7) · ESM 박스 wiring(C10) · 카테고리 Phase 2(C8) · web 어댑터 정리(C12) · superRefine 비대칭(C11)
- 수량 구간 배송비 비균등(구간 직접 입력) 모드 — v1 은 박스(균등)만
- 알림 / CSV / 오류 통계 / 이미지 WebP / s4 템플릿 / 소셜 / 2FA / Stripe·PG / 멀티유저 — v2~보류

---

## ⚠ 룰 강제 메모

### WIP 는 머지 전 갱신 (PR 포함)
- feature/* → develop, release/* → main 모두 **머지 _전_** feature/release 브랜치에서 WIP 갱신해 같은 PR 에 포함. 머지 후 갱신 시 protected 브랜치에 WIP-only PR 따로 필요 → 비효율. (2026-05-31 사용자 지시 / CLAUDE.md §Rules.)

### C9 배송 설정 인라인 (#316)
- 배송비 단일 소스 = `products.shipping_config jsonb`(zod `ShippingConfigSchema`, web+Edge 미러). `shipping_policies` = prefill 템플릿. 박스→마켓 = `expandBoxToTiers`(11번가 04·쿠팡 fallback wired / 네이버·ESM 변환기만). 쿠팡 0원 자동등록 금지(박스당 단일 + 경고).

### 마켓 API 클라이언트 직접 호출 금지 (#303) / image-register 멱등 (#307) / owner default auth.uid() (#295)
- 모든 마켓 호출 Edge → gatewayFetch → GW. product_images `UNIQUE (product_id, sha256)`. 클라이언트 INSERT RLS 테이블 seller_id default auth.uid().

### Git Flow / 운영 인프라
- feature/* base=develop. develop/main 직접 push 차단(PR). main 머지 자동 deploy 는 **마이그 미적용** → apply_db_migrations workflow_dispatch 별도. Lightsail SSH·DB push 사용자 직접. MCP supabase read-only. gh: `C:\Program Files\GitHub CLI\gh.exe`(Win) / `gh`(mac). deno: `~/.deno/bin/deno`.
