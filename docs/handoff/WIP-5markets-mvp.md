# MarketCast — WIP 핸드오프 (카테고리 추천 Phase 1 develop 머지 / v0.19 운영 완료)

**develop HEAD**: `22554fa` — feat(category): 카테고리 추천 Phase 1 — 전역 인덱스 + 검색 + 최근 (4마켓) (#312)
**main HEAD**: `e48d7e0` — release: v0.19 — 이미지 업로드 멱등 fix (#308) · **Deploy (real) success (2026-05-31)**
**테스트**: 1434 passed / 1 skipped / 31 todo (133 files) · **deno check 28 entrypoint green** (빌드·검색 Edge +2)
**갱신일**: 2026-05-31
**develop 누적(→v0.20, 미릴리즈)**: 카테고리 추천 Phase 1 #312 (**마이그 3개 동반**) + 카테고리 cascader Phase 0 fix #311

---

## 2026-05-31 세션 — 카테고리 추천 Phase 1 (#312)

### 목표 (사용자 편의)
s3 3단계 카테고리 선택의 깊은 cascading 수고 절감 — (1) 카테고리명 타이핑 → leaf 즉시 검색, (2) 최근 사용 카테고리 칩 재선택. 막히면 기존 `CategoryCascader` graceful 폴백. **4마켓(쿠팡·11번가·G마켓·옥션), 네이버 제외.**
마스터: `docs/architecture/v1/features/category-sync.md §10` / 스펙 `docs/superpowers/specs/2026-05-31-category-recommendation-design.md`.

### 구현 (카테고리별)
- **마이그 3개**: `20260601000001` market_category_index(전역 캐시 + pg_trgm GIN on path_text, RLS 읽기 전역/쓰기 service_role) + `_meta` · `20260601000002` get_recent_categories RPC(security invoker, auth.uid 격리) · `20260601000003` cron pre-warm(일 1회 03:00, 4마켓 unnest).
- **어댑터**: `fetchCategoryTreeFull()` — 쿠팡(1콜)·11번가·ESM(site-cats 재귀 위임). ESM 순수 파서 → Deno 의존 없는 `esm-category.ts` 분리(Vitest 회귀, 쿠팡은 기존 `coupang-category.ts`).
- **Edge**: `markets-category-index-build`(빌드 — 셀러 JWT / service_role·cron 자동 account 선택, 공유 헬퍼 `buildAndUpsertCategoryIndex`) · `markets-category-search`(ready 즉시 / 11번가·쿠팡 인라인 빌드 / ESM async 빌드+`building` 폴링 / naver unsupported).
- **FE**: `useCategorySearch`(250ms 디바운스·building 4s 폴링)/`useRecentCategories` + `CategorySearchBox`(combobox/listbox 5상태·키보드)/`RecentCategoryChips` → `MarketOptionsCard` 조립(naver 가드). zod 서버/웹 미러.

### 직전 Phase 0 (#311, 동일 develop)
s3 카테고리 cascader 쿠팡·11번가 선택 불능 버그 fix.

---

## ⚠ 즉시 필요한 운영 액션 (v0.20 release 시)

### 1. real DB 마이그 적용 (apply_db_migrations) — **release main 머지 후 필수**
main 머지 자동 push deploy 는 마이그 미적용(default false). **별도 수동 트리거**:
```
GitHub → Actions → "Deploy (real)" → Run workflow
  branch: main · apply_db_migrations: true · deploy_edge_functions: true
```
→ 마이그 `20260601000001` / `20260601000002` / `20260601000003` real(lfrny) 적용 + Edge `markets-category-index-build`·`markets-category-search` 배포.

### 2. dev DB 마이그 적용 (dev:db 테스트용)
```
cd apps/api && npx supabase@latest db push
```
→ 위 3개 dev(eqoyw) 적용. **파괴적/공유 인프라 — 사용자 직접.** (현재 dev 에 market_category_index 미존재 확인됨.)

### 3. cron vault secret 확인 (운영 — 기등록 가능성 높음)
`category-prewarm-daily` cron 은 `supabase_functions_url` / `service_role_key` vault secret 재사용(orders-sync 와 동일). 미등록 시 cron 실행만 runtime fail(schedule 등록은 무해). orders-sync 가 동작 중이면 이미 등록됨 — Vault 에서 확인만.

### 4. 배포 후 라이브 검증 (playwright)
4마켓 검색→선택 / 최근 칩 / ESM `building→ready` 전환. **dev 에 ESM(G마켓·옥션) 계정 없음 → ESM 라이브 빌드·검색은 real 계정 검증(C3 와 연계).** 11번가는 키 불필요라 dev 검증 가능, 쿠팡은 dev 계정 유무에 따라.

---

## ⚠ carry-over 백로그 (v1 머지 차단 아님)

| # | 항목 | 사유 / 진입 |
|---|---|---|
| **C3** | **real 실호출 검증** (5마켓 mock+parity 까지만) | 셀러 키 + IP `3.36.239.243` 화이트리스트 → 키 발급 후 1회. **다음 release 핵심 게이트.** 카테고리 lazy + **Phase 1 ESM 빌드/검색** 도 이때 실검증. |
| **C7** | **네이버 카테고리 real 어댑터** | 어댑터 stub + 커머스 카테고리 API 스펙 부재. Phase 1 도 네이버 제외(unsupported). `market-api-docs-import` 스펙 확보 + 구현 + 키 발급 후. |
| **C4** | 11번가 상품군(officialNotice) 코드 마스터 | spec 1003 1군만 확보, 40군 free-form |
| **C5** | 이미지 ≥13장 truncate 사전경고 UX | warning 처리됨 — v2 |
| **C6** | mcp_ro_dev supabase_migrations read GRANT | MCP 마이그 이력 조회 편의 |
| **C8** | 카테고리 추천 Phase 2 후보 | ESM 풀트리 빌드 Edge wall-clock 한도 초과 시 resumable 빌드(체크포인트). 마켓별 자동매핑(PRD §1.2.1). |

> **해소됨**: 카테고리 검색 UX(category-sync §9) → **Phase 1 #312** · 이미지 업로드 멱등 #307 · 카테고리 CORS #303 · 이미지 썸네일 #301.
> 후속(image-pipeline §, category-sync §9): web 어댑터 미사용 메서드 정리 / orphan storage 정리(미등록 PUT).

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
                     │           │   (UNIQUE (product_id, sha256) #307 — 같은상품 중복만 차단, 재사용 허용)
                     │           └─ ProductMarketMapping (카테고리: 검색/최근/cascader 3경로
                     │                + marketOptions: 출고지/반품지·officialNotice + certRequiredYn)
                     ├─ RegistrationJob ─── JobMarketResult (1:N)
                     └─ ShippingPolicy (seller_id default auth.uid())
주문·배송 (s7~s9): Order(+extra jsonb dlvNo) → OrderGroup / ShippingJob → ShippingJobResult / LogenCredentials
카테고리 (Phase 1):
  · cascader: Browser → Edge markets-category-children → GW → 마켓 (부모코드 직계 자식 lazy)
  · 검색:     Browser → Edge markets-category-search → market_category_index(pg_trgm) [miss 시 빌드]
  · 최근:     RPC get_recent_categories (product_market_mappings ⋈ market_category_index)
  · 빌드:     Edge markets-category-index-build / cron category-prewarm-daily → 전역 캐시 (셀러 무관 1벌)
공통: _shared/{carrier-codes,xml,gatewayFetch,category-index,category-index-build}.ts
```

## 완료된 작업 (요약)

| 단계 | 내용 | 비고 |
|---|---|---|
| Stage A~D / v0.4~v0.17 | 부트스트랩 + s1~s6 + 5마켓 어댑터 + 주문배송 + Gateway + 11번가/ESM 재구현 + deno check | 운영 배포 |
| v0.18 (#301·#303) | 카테고리 게이트웨이 lazy cascading(CORS fix) + 이미지 썸네일 signed URL | 운영 배포 |
| v0.19 (#307·#308) | 이미지 업로드 멱등 + product_images UNIQUE 완화 (409 fix, 마이그 동반) | **운영 배포 (real success)** |
| **develop 누적 (#311·#312)** | **카테고리 cascader Phase 0 fix + 카테고리 추천 Phase 1(전역 인덱스+검색+최근, 마이그 3개)** | **develop 머지 (→v0.20 release 예정)** |

## 운영 현황

- **운영 배포 URL**: `https://rumeadia-dotcom.github.io/ing0415/` · **직전 deploy = v0.19 (#308) success + Deploy(real) workflow_dispatch (2026-05-31 05:21)**
- **dev Supabase** (`eqoyw`): v0.19 까지 정합. **Phase 1 마이그 3개 미적용(운영 액션 2 — market_category_index 미존재 확인됨).**
- **real Supabase** (`lfrny`): v0.19 까지 정합(#307 마이그 적용 추정 — Deploy(real) dispatch run). **Phase 1 마이그 3개 미적용(운영 액션 1 — release 후).**
- **Lightsail 게이트웨이**: healthz 200. 카테고리/배송조회 경유.

---

## 다음 세션 진입

```bash
git pull origin develop && pnpm install && pnpm test
```
**1434 passed** 확인 후 진입. (Edge: `deno check --node-modules-dir=none apps/api/supabase/functions/*/index.ts`, deno 2.8.1.)

### 우선 순위
1. **release/v0.20 → main 배포 + 마이그 적용** — Phase 0/1 운영 반영. main 머지 후 **apply_db_migrations + deploy_edge_functions workflow_dispatch 필수**(운영 액션 1) + dev push(액션 2) + cron vault 확인(액션 3) + playwright 라이브 검증(액션 4).
2. **C3 real 실호출 검증** — 셀러 키 + IP 화이트리스트 후 5마켓 1회. 카테고리 lazy + **Phase 1 ESM 빌드/검색** real 검증.
3. **C7 네이버 카테고리** + C4~C6·C8.

> 카테고리 추천 Phase 1 develop 머지 완료. release 시 마이그 3개 + Edge 2개 배포가 핵심 운영 액션.

---

## 백로그 (v1 이후 / 영구 보류)

- 네이버 카테고리 real 어댑터(C7) / 11번가 상품군 코드(C4) / 카테고리 추천 Phase 2(C8) / orphan storage 정리 — v2
- web 어댑터 createProduct·fetchOrders 등 미사용 메서드 정리(런타임은 Edge worker) — 별도 트랙
- 알림 / CSV / 오류 통계 / 이미지 WebP / s4 템플릿 / 소셜 / 2FA / Stripe·PG / 멀티유저 — v2~보류

---

## ⚠ 룰 강제 메모

### 카테고리 인덱스는 전역 1벌 (#312)
- market_category_index 는 셀러 무관 전역 캐시(RLS 읽기 전역/쓰기 service_role). 검색·최근은 leaf=true 만. ESM 빌드는 콜 多 → 검색 Edge 인라인 금지(async + building + cron pre-warm). user query LIKE 와일드카드 이스케이프.

### 마켓 API 클라이언트 직접 호출 금지 (#303)
- 모든 마켓 호출(카테고리·검색·배송조회·등록·주문)은 Edge → gatewayFetch → GW 경유. 브라우저 직접 fetch = CORS·IP 위반.

### image-register 멱등 + UNIQUE (#307) / owner default auth.uid() (#295) / Edge deno check (#296)
- product_images = `UNIQUE (product_id, sha256)`(같은 상품 중복만 차단). 클라이언트 INSERT RLS 테이블 seller_id default auth.uid(). deno check CI 자동.

### Git Flow / 운영 인프라
- feature/* base=develop. develop/main 직접 push 차단(PR). main 머지 자동 deploy 는 **마이그 미적용** → apply_db_migrations workflow_dispatch 별도(위험 게이트).
- Lightsail SSH·DB push 사용자 직접. MCP supabase read-only(real=mcp_ro 뷰). gh: `C:\Program Files\GitHub CLI\gh.exe`. deno: `~/.deno/bin/deno.exe`.
