# MarketCast — WIP 핸드오프 (v0.17 릴리즈 진행 · 11번가 plumbing + deno check + RLS fix)

**develop HEAD**: `325de66` — chore(tooling): supabase 스크립트 npx 포터블화 (#297)
**main HEAD**: `3e4db98` — release: v0.16 (#280) · **v0.17 release → main 머지 진행 중**
**테스트**: 1370 passed / 1 skipped / 31 todo (122 files) · **deno check 25 entrypoint green**
**갱신일**: 2026-05-31 (v0.17 — RLS seller_id default fix + npx 포터블화 추가)
**develop 누적(→v0.17)**: NEW-1 #291 · NEW-2 #292 · deno 타입수정 #294 · CI deno check #296 · RLS fix #295 · npx #297

---

## 2026-05-31 세션 — 11번가 plumbing + deno check 정합

v0.16 carry-over(NEW-1·NEW-2) 완주 + deno 도입으로 Edge 타입 사각 해소.

### NEW-1 — dlvNo plumbing (#291)
11번가 발송처리(1888) path 키 `dlvNo`(≠`ordNo`)를 `orders.extra` jsonb 에 보존 → 발송 워커가 `submitTracking` 4번째 인자(`opts.dlvNo`)로 전달. `orders-repo-row.ts`(row 빌드) + `tracking-opts.ts`(opts 빌드) + `resolveElevenStDispatchDlvNo`(fallback) 순수 함수 분리. 마이그 `20260530000003`.

### NEW-2 — certRequiredYn plumbing (#292)
워커가 카테고리 1617(`fetchCategoryCertMeta`)로 KC인증 필수여부 조회 → `injectCertRequiredYn`(`cert-inject.ts`)로 `mapping.extra.certRequiredYn` 주입 → `transformProduct` 가 `ProductCertGroup` 분기. **서버(Edge 워커) 전용** — web 어댑터/parity 무변경. 조회 실패는 warn 후 미주입(가용성).

### deno check 도입 + Edge 타입 정합 (#294, #296)
이 머신에 **deno 2.8.1 설치** 후 최초 `deno check` 로 기존 Edge 타입 에러 7건 발견·수정.
- **#294 핵심 — OAuth refresh 런타임 버그**: `refresh-credential.ts` 가 `cred.refreshToken`(없는 속성, payload 안에 있음) + `storeCredential` 입력 구조 불일치 → 네이버 토큰 자동 refresh 가 런타임 실패할 상태였음(C3 real 미검증이라 사고 미발생). `markets-token-refresh §3` 패턴으로 정합. + `process.ts` tokenExpiresAt null 가드 + `audit.ts` sellerId null→undefined(C7①).
- **#296 — CI deno check 잡**: `ci.yml` `deno-check` 잡 신설(경로필터 `functions`, run_heavy 게이팅, CI Gate 집계). C8 종결.

> 신규 순수함수 vitest: `resolveElevenStDispatchDlvNo`/`buildSubmitTrackingExtra`/`toOrderUpsertRow`/`injectCertRequiredYn`. 문서 sync: `features/11st.md` §4.3·§4.5, `ops/ci-cd.md` §3.

---

## ⚠ 운영 액션 상태 (2026-05-31 v0.17 — 해소)

### ✅ dev DB 마이그 — 완료
`20260530000003_orders_extra_jsonb` + `20260531000001_seller_id_default_auth_uid` dev(eqoyw) push 완료. `seller_id default auth.uid()` 검증.

### ✅ real DB 마이그 — 완료 (드리프트 정합)
real(lfrny) 이 `20260527000001` 까지만 적용된 드리프트를 정합: `20260529000001`·`20260530000001~3`·`20260531000001` 5개 `supabase db push` 직접 적용.
- **운영 사고 해소**: `shipping_policies`/`products` INSERT 가 `seller_id` 누락으로 RLS WITH CHECK 위반(PostgREST 42501) → owner 컬럼 `default auth.uid()` 로 차단. 운영 배송정책 추가 정상 확인 (#295).
- 이미 real 적용 완료이므로 본 v0.17 deploy 의 `apply_db_migrations` 는 **불필요** (코드/레포 정합 목적 릴리즈).

---

## ⚠ carry-over 백로그 (v1 머지 차단 아님)

| # | 항목 | 사유 / 진입 |
|---|---|---|
| **C3** | **real 실호출 검증** (5마켓 전부 mock+parity 까지만) | 셀러 자격증명 + IP `3.36.239.243` 화이트리스트 → 키 발급 후 1회 실호출. **현재 키 미발급으로 보류.** **다음 release 핵심 게이트.** (#294 로 네이버 OAuth refresh 경로 버그 선제 수정됨) |
| **C4** | **11번가 상품군(officialNotice) 코드 마스터** | spec 1003 의 1군만 확보, 40군 셀러 free-form. 첨부/고시 조회 API 확보 시 보강 |
| **C5** | **PR-3 이미지 ≥13장 truncate** | warning 처리됨 — 추가 UX(사전 경고) v2 |
| **C6** | **mcp_ro_dev `supabase_migrations` read GRANT** | 없어서 MCP 로 dev 마이그 이력 조회 불가(편의). `esm.md §5.4` 보강 고려 |

> **해소됨**: NEW-1 #291 · NEW-2 #292 · **C7①(audit sellerId) #294** · **C8(Deno 타입 CI 미검증) #296**.

---

---

```
프론트:  React 18 + Vite + TS strict + shadcn + Tailwind + TanStack Query + RHF + zod + Tiptap + Daum Postcode + DOMPurify
백엔드:  Supabase (Postgres + RLS + Auth + Storage + Realtime + Edge Functions Deno + pg_cron + Vault)
         + AWS Lightsail Market Gateway (서울, 3.36.239.243, HMAC + 호스트 화이트리스트)
호스팅:  GitHub Pages (정적 SPA + 404.html) + Supabase Cloud
모니터링: Sentry (PII 마스킹 강제)
CI/CD:   GitHub Actions — 빠른레인(feature push=Lint&Typecheck/Unit) + 풀게이트(PR=Build dev·real/E2E golden+a11y 통합/pgTAP/deno-check, 경로필터 app·sql·functions). required=CI Gate/Lint&Typecheck/Unit 3개
브랜치:  Git Flow (main / develop / release/* / feature/* / hotfix/*) — feature base = develop, squash-only, strict(up-to-date)
빌드모드: VITE_APP_MODE=dev|real + VITE_USE_MOCK=true|false
MCP 호스팅: Lightsail 3.36.239.243 docker-compose (supabase-dev=뭄바이풀러 / supabase-real=서울풀러 / playwright / sentry)
```

직전 세션의 설계(11번가 spec 재검토·Layer 2 조회형 단일화·11번가 PR-0)를 코드로 완성. worktree 격리 + ing-* 구현 + qa/security 검수 패턴. develop strict 순차 머지(공통파일 rebase 충돌 해소).

```
상품 등록 (s1~s6)
Seller (auth.users) ─┬─ MarketAccount ── credential_payload jsonb + pgcrypto
                     │     (배송 Layer 2 = 마켓 콘솔 등록분 GET 조회 → select, 우리 DB 저장 없음 ★조회형 단일표준)
                     ├─ Product ─┬─ ProductImage ─ ImageTransform (마켓별 N)
                     │           └─ ProductMarketMapping (카테고리 + marketOptions: 출고지/반품지·officialNotice
                     │                                    + certRequiredYn ★NEW-2 워커 주입(11번가 1617))
                     ├─ RegistrationJob ─── JobMarketResult (1:N)
                     └─ ShippingPolicy (Layer 1 = 요금 의도, 어댑터가 마켓별 인라인 매핑)
주문·배송 (s7~s9): Order(+extra jsonb ★NEW-1 dlvNo) → OrderGroup / ShippingJob → ShippingJobResult / LogenCredentials
공통: _shared/carrier-codes.ts (택배사 단일소스) · _shared/xml.ts (ns2 파서)
```

## 완료된 작업 (요약)

| 단계 | 내용 | 비고 |
|---|---|---|
| Stage A~D / v0.4~v0.11 | 부트스트랩 + s1~s6 + 4마켓 어댑터 + 주문배송 + WYSIWYG + Gateway + 운영안전망 | 운영 배포 |
| v0.14~v0.15.1 | hookify + 11번가 placeholder + 5마켓 주문 수집 + hotfix | 운영 배포 |
| v0.16 (#270~#280) | 11번가 재구현 PR-0~6 + ESM 조회형 전환 E1~E5 + CI 빠른레인 #286 | 운영 배포 (Deploy real success) |
| **develop 누적 (#291·#292·#294·#296)** | **11번가 NEW-1 dlvNo + NEW-2 certRequiredYn plumbing + deno 타입정합 + CI deno check** | **develop 머지 (미릴리즈)** |

## 운영 현황

- **운영 배포 URL**: `https://rumeadia-dotcom.github.io/ing0415/` · **직전 deploy = v0.16 (#280) success (2026-05-30 09:36)**
- **dev Supabase** (`eqoyw`, 뭄바이): v0.16 마이그 정합 완료. **NEW-1 `20260530000003` 미적용(운영 액션 1).**
- **real Supabase** (`lfrny`, 서울): v0.16 까지 어댑터·Edge 코드만. **NEW-1 `20260530000003` 미적용(운영 액션 2 — 다음 release 동반).**
- **Lightsail 게이트웨이**: allowlist + PR-6 maskUrl 재배포 완료 (healthz 200).
- **MCP supabase-dev**: 정상 (뭄바이 풀러).

---

## 다음 세션 진입

```bash
git pull origin develop && pnpm install && pnpm test -- --run
```
**1370 passed** 확인 후 진입. (Edge 타입 검증: `deno check --node-modules-dir=none apps/api/supabase/functions/*/index.ts` — 이 머신 deno 2.8.1 설치됨, CI deno-check 잡 자동 실행.)

### 우선 순위
1. **C3 real 실호출 검증** — 셀러 키 발급 + IP `3.36.239.243` 화이트리스트 후 5마켓 1회 실호출. **다음 release 핵심 게이트** (현재 키 미발급 보류). 동반: NEW-1 마이그 real 적용(운영 액션 2).
2. **dev 마이그 정합** (운영 액션 1) — `npx supabase@latest db push` 로 `20260530000003` 적용. dev:db 모드 11번가 검증 전 필수.
3. **C4~C6 백로그** — 진입 가능 항목부터.

> 11번가 plumbing(NEW-1/2) + deno 정합 완료. 다음 release 는 C3 실호출 검증 + NEW-1 real 마이그 동반 후 사용자 결정.

---

## 백로그 (v1 이후 / 영구 보류)

- 11번가 멀티옵션·클레임·정산·기획전 / 11번가 상품군 코드 마스터(C4) / 카테고리 cert 메타 캐싱(NEW-2 매 등록 1617 1회 → v2) — v2
- 알림 / CSV / 오류 통계 차트 / 이미지 WebP — 미진입 v1 스코프
- 쿠팡 미구현 endpoint(출고지/반품지/상품수정·조회·삭제) — v2
- s4 템플릿 / 소셜 / 2FA / Stripe·PG / 멀티유저 권한 — v2~보류

---

## ⚠ 룰 강제 메모

### Edge(Deno) 타입 검증
- 이 머신 **deno 2.8.1 설치 완료**. Edge 타입은 `deno check --node-modules-dir=none apps/api/supabase/functions/*/index.ts` (npm:zod 등을 글로벌 캐시로 resolve, 루트 pnpm node_modules 무시).
- `pnpm typecheck`(tsc)는 apps/web 만 본다 — Edge 는 deno check 별도. **CI deno-check 잡(#296)이 functions 변경 시 자동 검증**(C8 종결).
- 신규 Edge plumbing 은 순수 모듈 분리 + vitest 커버가 표준(NEW-1/2). fetch 본체는 deno check + CI/배포 검증.

### Git Flow / stacked PR (CLAUDE.md §Rules)
- 새 feature/* 는 **develop 분기**. 공통 파일 충돌 시 stacked PR(base=선행 feature) → 선행 머지 후 `git rebase origin/develop`(중복 커밋 자동 skip) → `push --force-with-lease` → 머지.
- develop/main **직접 push 차단**(branch protection) — WIP·문서도 PR 경유. required=CI Gate/Lint&Typecheck/Unit.

### 운영 인프라 SSH / DB write
- Lightsail SSH·dev/real DROP·`db push` 등 파괴적·공유 인프라 작업은 사용자 직접 실행. MCP supabase 는 read-only.
- gh: `C:\Program Files\GitHub CLI\gh.exe`. 박스 SSH: `ssh ubuntu@3.36.239.243`. deno: `~/.deno/bin/deno.exe`.
