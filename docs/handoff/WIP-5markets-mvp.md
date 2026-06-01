# MarketCast — WIP 핸드오프 (v0.20 운영 배포 완료 / 수량 구간 배송비 C9 / 카테고리 추천 Phase 1)

**develop HEAD**: `a06a7eb` — docs(handoff): WIP 갱신 — C9 develop 머지 완료 (#317)
**main HEAD**: `73d73db` — **release: v0.20 (#318) · Deploy (real) success (2026-06-01) — 카테고리 Phase 0/1 + C9 배송비**
**마이그**: **dev(eqoyw)·real(lfrny) 양쪽 4개 적용 완료** (`20260601000001`~`000004`). (chaltteok 스킬은 `feature/skill-chaltteok` 로 분리·별도 PR 대기.)
**테스트**: 1490 passed / 1 skipped / 31 todo (138 files) — overnight 수정으로 +22 (회귀 0)
**갱신일**: 2026-06-01 (밤 — overnight 자율 검수)
**develop 누적(→v0.20, 미릴리즈)**: 카테고리 추천 Phase 1 #312 (**마이그 3개**) + Phase 0 fix #311 + 수량구간 배송비 설계 #314 + **C9 구현 #316 (마이그 1개)**
**진행 중 PR(미머지)**: `feature/overnight-autofix-20260601-fixes` — 무인 검수로 FE/cron 버그 **11건 수정** (TIER1 5 + TIER2 6, 아래 §overnight 세션). overnight-autofix 스킬 자체는 #321(별도).

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

## 2026-06-01 (밤) — overnight 자율 버그 검수·수정 (PR `feature/overnight-autofix-20260601-fixes`)

mock 이 가린 **스키마/DB 정합 깨짐 + 로직 버그 11건**을 무인 검수로 수정. 전부 TDD(실패 테스트 먼저) + 직접 MCP/코드 교차검증. **real DB write·마이그 적용·Edge deploy·main 배포 없음.**

| # | 심각도 | 수정 | 커밋 |
|---|---|---|---|
| H1 | high | history JobSummary/JobDetail `datetime()`→offset 허용 (실DB `+00:00` 거부 → 이력 전면 throw) | 50e0676 |
| H2 | med | history custom 기간 종료일 1일 누락 (`created_at < p_to`) → KST 다음날 0시 상한 | 50e0676 |
| O1 | **crit** | orders `market_dispatch_status` RPC(success/failed/null)↔zod(pending/submitted/failed) 매핑 경계 추가 → 목록·상세 전면 throw 해소 | e4c17fe |
| O2 | high | orders `dispatch_failed` 가 `OrderShippingStatusSchema`(5값)에 누락 → 6값 동기(badge·timeline·필터) | e4c17fe |
| R1 | **crit** | registration `ValidationIssueSchema` enum 2개 누락(transform_failed/description_html_unsafe) → real 미리보기 전면 generic 에러 | 9a6e5da |
| M1 | **crit** | markets-token-refresh-cron `needs_reauth`(DB CHECK 위반)→`expired`/`auto_expired` 무음 실패 | 6c7d3cd |
| R2 | high | StepImagesPage 다중 업로드 read-modify-write race → store `addImage` 원자 append | ff1fc11 |
| R3 | med | PartialJobBanner `failed_final` 포함 카운트 → non-final `failed` 만 재시도 대상 | ff1fc11 |
| R4 | med | registration start/retry error code 3개 client 메시지맵 누락 → 전용 메시지 | ff1fc11 |
| M3 | med | category children/search query key `marketAccountId` 누락 → 계정전환 stale | ff1fc11 |
| O3/H5 | low | OrdersListPage 11번가 컬러바 누락 / Dashboard 잡 0건 빈상태 미노출 | 3695570 |

---

## ⚠ 운영 액션 현황 (v0.20)

### 1. real DB 마이그 적용 — ✅ **완료** (2026-06-01)
`apply_db_migrations=true` workflow_dispatch(run 26736911165) 로 real(lfrny) 에 `20260601000001`~`000004` 4개 적용 + Edge `markets-category-index-build`·`markets-category-search` 배포 완료. (dispatch 로그 `Finished supabase db push` 확인.)

### 2. dev DB 마이그 적용 — ✅ **완료** (2026-06-01)
`pnpm db:push:dev` 로 dev(eqoyw) 에 `20260531000002` + `20260601000001`~`000004` 적용 완료. MCP 검증: `products.shipping_config`(default free) / `shipping_policies.config` / `market_category_index` 존재.

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

### ⚠ overnight 검수 round-2 인계 — real Edge 경로 결함 (검증됨, deploy 게이트라 미수정)

mock 미실행 + real 등록 베타 미가동(latent) + Edge deploy 게이트 + 핵심 오케스트레이션/스펙 결정 필요 → overnight 자율 수정 보류. **후속 "registration-worker + image-transform + logen-settings 정합 PR" 권고.** 근본원인·수정안 전문은 세션 BUGLOG 참조.

| # | 심각도 | 위치 | 결함 / 수정안 |
|---|---|---|---|
| ~~W1~~ | ~~crit~~ | jmr-update.ts | ✅ **수정 완료 (2026-06-02, feature/registration-worker-realpath-fix)** — 종결 판정을 `rpc_recompute_job_status` 위임(전이표 우회). **⚠ Edge deploy 필요** (functions:deploy registration-market-worker). |
| ~~W2~~ | ~~crit~~ | data-load.ts | ✅ **수정 완료 (2026-06-02, 동 PR)** — `image_id` 2-step 조인 + seller_id 가드 복원. **⚠ Edge deploy 필요** (동일 함수). |
| W3 | high | image-transform/process.ts:95-146 | 'failed' transform upsert 반환 error 미검사(무음). error 로깅 추가. |
| W4 | med | image-transform/index.ts:128-130 | product_images `status='ready'` 승격 update error 미검사. error 로깅. |
| W5 | low~med | registration-retry/index.ts:195-209 | retry 시 `attempt_count` 미리셋(누적) → 실효 재시도 1회로 축소. **정책 결정**(리셋 vs 유지+UI 노출). |
| **W6** | **crit** | logen.ts ↔ logen-verify-credential/index.ts | 로젠 연결테스트 FE↔Edge contract(요청/응답 shape) 전면 불일치 → verify 절대 성공 불가. ground truth(README=Edge) 기준 FE 재정렬 + W8 ReadableStream 동시 수정. |
| **W7** | high | SettingsShippingSenderPage.tsx:180-183 ↔ logen.ts:44/DB CHECK | 발송인 `fareTy` select `C/S/R` vs 스키마·DB `C/P/M` → S/R 저장 불가. **fareTy 의미가 4파일 상충(신용/선불/착불 매핑 모순) → 로젠 스펙 확인 필수(추측 금지, 운임 오발급 위험).** |
| W8 | high | shipping-settings-api.ts:122-134 | verify `error.context.body`(ReadableStream) await 없이 safeParse → 모든 에러 'internal' 폴백(markets-api 가 이미 고친 회귀). W6 과 함께. |

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
| **v0.20 (#316·#311·#312)** | **수량 구간(박스) 배송비 C9(11번가/쿠팡 wiring) + 카테고리 추천 Phase 0/1** | **운영 배포 완료 (main 73d73db, real success)** |
| **overnight (미머지 PR)** | **무인 검수 — FE/cron 버그 11건 수정 (mock 가 가린 스키마/DB 정합 + 로직)** | **develop 머지 대기 (W1~W8 round-2 결함은 인계)** |

## 운영 현황

- **운영 배포 URL**: `https://rumeadia-dotcom.github.io/ing0415/` · 직전 deploy = v0.19 (#308) success + Deploy(real) dispatch (2026-05-31)
- **운영 배포 URL**: `https://rumeadia-dotcom.github.io/ing0415/` · **직전 deploy = v0.20 (#318) + apply_db_migrations dispatch success (2026-06-01)**
- **dev Supabase** (`eqoyw`): **v0.20 정합** (마이그 `20260601000001`~`000004` 적용 완료).
- **real Supabase** (`lfrny`): **v0.20 정합** (마이그 4개 적용 완료).
- **Lightsail 게이트웨이**: healthz 200.

---

## 다음 세션 진입

```bash
git pull origin develop && pnpm install && pnpm test
```
**1490 passed** 확인 후 진입. (Edge: `~/.deno/bin/deno check --node-modules-dir=none apps/api/supabase/functions/*/index.ts`, deno 2.8.1.)

### 우선 순위
1. **overnight PR 머지 확인** — `feature/overnight-autofix-20260601-fixes` → develop CI green 후 머지(자율 진행됨). 머지 후 develop HEAD 갱신.
2. **W1·W2 (crit, real Edge)** — registration-worker retry 정체(rpc_recompute_job_status 배선) + product_id 쿼리(image_id 조인). C3 real 검증 _전에_ 반드시. Edge deploy 필요 → 후속 정합 PR.
3. **C3 real 실호출 검증** — 셀러 키 + IP `3.36.239.243` 화이트리스트 후 5마켓 1회. C9 11번가 박스 실등록 + 네이버/ESM 운임 확정.
4. **W6~W8 로젠 설정 정합** — verify contract + fareTy 스펙 확인(운임 오발급 위험) + ReadableStream. / **chaltteok 스킬** `feature/skill-chaltteok` 별도 PR.

> C9 develop 머지 완료(11번가·쿠팡 wired). release/v0.20 main 머지 후 마이그 4개(Phase1 3 + C9 1) apply_db_migrations 가 핵심 운영 액션.

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
