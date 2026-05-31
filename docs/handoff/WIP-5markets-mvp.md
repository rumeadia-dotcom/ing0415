# MarketCast — WIP 핸드오프 (이미지 업로드 멱등 fix · v0.19 release 예정 / v0.18 운영 완료)

**develop HEAD**: `a47b1d7` — fix(images): image-register 멱등화 + product_images UNIQUE 완화 (#307)
**main HEAD**: `fe730e3` — release: v0.18 (#305) · **Deploy (real) success (2026-05-31)** — 카테고리 lazy cascading + 이미지 썸네일
**테스트**: 1404 passed / 1 skipped / 31 todo (128 files) · **deno check 26 entrypoint green**
**갱신일**: 2026-05-31
**develop 누적(→v0.19, 미릴리즈)**: 이미지 업로드 멱등 fix #307 (**마이그 20260531000002 동반**)

---

## 2026-05-31 세션 — 이미지 업로드 409 duplicate_image 운영 사고 fix (#307)

### 문제
운영에서 상품 이미지 업로드가 `image-register` **409 duplicate_image** 로 차단. `image-upload-url` 200·Storage PUT 정상이나 register 실패. 원인: product_images `UNIQUE (seller_id, sha256)` **전역 차단** — "멱등성 키" 주석 의도와 달리 차단 구현이라 ① 같은 이미지 다른 상품 재사용 ② 재시도 ③ 반복 업로드를 영구 거부.

### 수정 (#307) — 마스터: `cross-cutting/image-pipeline.md §6`
- **마이그 `20260531000002`**: `UNIQUE (seller_id, sha256)` → `(product_id, sha256)`. 같은 상품 내 동일 파일 중복만 차단, 이미지 재사용 허용. `(product_id, position)` 유지.
- **image-register 멱등**: 23505 충돌 시 409 대신 기존 row 반환(sha256 매칭 우선, position fallback) → `{ imageId, status, role, originalPath }` 200.
- **클라이언트**: `RegisterResponse` 에 originalPath 추가. `useImageUpload` 가 요청값이 아닌 register 응답값(멱등 시 기존 row)을 ImageMeta.id/storagePath 로 신뢰. mock + 멱등 회귀 테스트(+2).
- v0.18(카테고리)과 무관한 기존 결함.

### 직전 v0.18 (운영 완료) — 카테고리 게이트웨이 lazy cascading
s3 카테고리 select 가 브라우저 직접 fetch(CORS) → Edge `markets-category-children` lazy cascading 전환. 4마켓 동작, 네이버 인터페이스만(C7).

---

## ⚠ 즉시 필요한 운영 액션 (v0.19 release 시)

### 1. real DB 마이그 적용 (apply_db_migrations) — **release main 머지 후 필수**
main 머지 시 자동 push deploy 는 마이그 미적용(default false). **별도 수동 트리거**:
```
GitHub → Actions → "Deploy (real)" → Run workflow
  branch: main · apply_db_migrations: true · deploy_edge_functions: true
```
→ 마이그 `20260531000002` real(lfrny) 적용. 멱등 Edge 코드는 구/신 제약 양쪽 동작이라 순서 무관(deploy 큐잉).

### 2. dev DB 마이그 적용 (dev:db 테스트용)
```
cd apps/api && npx supabase@latest db push
```
→ `20260531000002` dev(eqoyw) 적용. **파괴적/공유 인프라 — 사용자 직접.**

---

## ⚠ carry-over 백로그 (v1 머지 차단 아님)

| # | 항목 | 사유 / 진입 |
|---|---|---|
| **C3** | **real 실호출 검증** (5마켓 mock+parity 까지만) | 셀러 키 + IP `3.36.239.243` 화이트리스트 → 키 발급 후 1회. **다음 release 핵심 게이트** (키 미발급 보류). 카테고리 lazy 경로도 이때 실검증. |
| **C7** | **네이버 카테고리 real 어댑터** | 어댑터 stub + 커머스 카테고리 API 스펙 부재. `market-api-docs-import` 스펙 확보 + 구현 + 키 발급 후. (현 UI: category_not_supported 안내) |
| **C4** | 11번가 상품군(officialNotice) 코드 마스터 | spec 1003 1군만 확보, 40군 free-form |
| **C5** | 이미지 ≥13장 truncate 사전경고 UX | warning 처리됨 — v2 |
| **C6** | mcp_ro_dev supabase_migrations read GRANT | MCP 마이그 이력 조회 편의 |

> **해소됨**: 이미지 업로드 멱등 #307 · 카테고리 CORS #303 · 이미지 썸네일 #301 · 배송정책 RLS #295.
> 후속(image-pipeline §, category-sync §9): web 어댑터 미사용 메서드 정리 / orphan storage 정리(미등록 PUT) / 카테고리 검색 UX.

---

## 스택 한눈에

```
프론트:  React 18 + Vite + TS strict + shadcn + Tailwind + TanStack Query + RHF + zod + Tiptap + Daum Postcode + DOMPurify
백엔드:  Supabase (Postgres + RLS + Auth + Storage + Realtime + Edge Functions Deno + pg_cron + Vault)
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
                     │           │   (UNIQUE (product_id, sha256) ★#307 — 같은상품 중복만 차단, 재사용 허용)
                     │           │   (image-register 멱등: 23505 → 기존 row 반환)
                     │           └─ ProductMarketMapping (카테고리 lazy: Edge markets-category-children
                     │                                    + marketOptions: 출고지/반품지·officialNotice + certRequiredYn)
                     ├─ RegistrationJob ─── JobMarketResult (1:N)
                     └─ ShippingPolicy (seller_id default auth.uid())
주문·배송 (s7~s9): Order(+extra jsonb dlvNo) → OrderGroup / ShippingJob → ShippingJobResult / LogenCredentials
카테고리: Browser → Edge markets-category-children → gatewayFetch → GW → 마켓 (부모코드 직계 자식 lazy)
공통: _shared/{carrier-codes,xml,gatewayFetch}.ts
```

## 완료된 작업 (요약)

| 단계 | 내용 | 비고 |
|---|---|---|
| Stage A~D / v0.4~v0.16 | 부트스트랩 + s1~s6 + 5마켓 어댑터 + 주문배송 + Gateway + 11번가/ESM 재구현 | 운영 배포 |
| v0.17 | 11번가 plumbing + deno check + 배송정책 RLS + npx | 운영 배포 |
| v0.18 (#301·#303·#305) | 카테고리 게이트웨이 lazy cascading(CORS fix) + 이미지 썸네일 signed URL | 운영 배포 (real success) |
| **develop 누적 (#307)** | **이미지 업로드 멱등 + product_images UNIQUE 완화 (409 fix, 마이그 동반)** | **develop 머지 (→v0.19 release 예정)** |

## 운영 현황

- **운영 배포 URL**: `https://rumeadia-dotcom.github.io/ing0415/` · **직전 deploy = v0.18 (#305) success (2026-05-31)**
- **dev Supabase** (`eqoyw`): v0.18 까지 정합. **#307 마이그 `20260531000002` 미적용(운영 액션 2).**
- **real Supabase** (`lfrny`): v0.18 까지 정합. **#307 마이그 미적용(운영 액션 1 — release 후 apply_db_migrations).**
- **Lightsail 게이트웨이**: healthz 200. 카테고리/배송조회 경유.

---

## 다음 세션 진입

```bash
git pull origin develop && pnpm install && pnpm test
```
**1404 passed** 확인 후 진입. (Edge: `deno check --node-modules-dir=none apps/api/supabase/functions/*/index.ts`, deno 2.8.1.)

### 우선 순위
1. **release/v0.19 → main 배포 + 마이그 적용** — #307 운영 반영. main 머지 후 **apply_db_migrations workflow_dispatch 필수**(운영 액션 1) + dev push(액션 2).
2. **C3 real 실호출 검증** — 셀러 키 + IP 화이트리스트 후 5마켓 1회. 카테고리/이미지 경로 real 검증.
3. **C7 네이버 카테고리** + C4~C6.

> 이미지 업로드 멱등 fix 완료. release 시 마이그 적용이 핵심 운영 액션.

---

## 백로그 (v1 이후 / 영구 보류)

- 네이버 카테고리 real 어댑터(C7) / 11번가 상품군 코드(C4) / 카테고리 검색 UX / orphan storage 정리 — v2
- web 어댑터 createProduct·fetchOrders 등 미사용 메서드 정리(런타임은 Edge worker) — 별도 트랙
- 알림 / CSV / 오류 통계 / 이미지 WebP / s4 템플릿 / 소셜 / 2FA / Stripe·PG / 멀티유저 — v2~보류

---

## ⚠ 룰 강제 메모

### 마켓 API 클라이언트 직접 호출 금지 (#303)
- 모든 마켓 호출(카테고리·배송조회·등록·주문)은 Edge → gatewayFetch → GW 경유. 브라우저 직접 fetch = CORS·IP 위반.

### image-register 멱등 + UNIQUE (#307)
- product_images = `UNIQUE (product_id, sha256)` + `(product_id, position)`. 같은 상품 내 중복만 차단(이미지 재사용 허용). image-register 는 23505 → 기존 row 반환(멱등). 클라이언트는 register 응답 imageId/originalPath 신뢰.

### owner 컬럼 default auth.uid() (#295) / Edge deno check (#296)
- 클라이언트 INSERT RLS 테이블 seller_id default auth.uid(). deno check CI 자동.

### Git Flow / 운영 인프라
- feature/* base=develop. develop/main 직접 push 차단(PR). main 머지 자동 deploy 는 **마이그 미적용** → apply_db_migrations workflow_dispatch 별도(위험 게이트).
- Lightsail SSH·DB push 사용자 직접. MCP supabase read-only(real=mcp_ro 뷰). gh: `C:\Program Files\GitHub CLI\gh.exe`. deno: `~/.deno/bin/deno.exe`.
