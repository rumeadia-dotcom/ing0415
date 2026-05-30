# MarketCast — WIP 핸드오프 (11번가 NEW-1/NEW-2 plumbing 완료 · v0.16 운영 배포본)

**develop HEAD**: `b4d34fe` — feat(11st): NEW-2 certRequiredYn plumbing (#292)
**main HEAD**: `3e4db98` — release: v0.16 (#280) · **Deploy (real) success (2026-05-30 09:36)** — 운영 배포본
**테스트**: 1370 passed / 1 skipped / 31 todo (122 files)
**갱신일**: 2026-05-31 (NEW-1 dlvNo + NEW-2 certRequiredYn plumbing develop 머지 반영)
**develop 누적(미릴리즈)**: NEW-1 #291 · NEW-2 #292 — v0.16 이후 11번가 발송·상품등록 plumbing 2건

---

## 2026-05-31 세션 — 11번가 NEW-1/NEW-2 plumbing (develop 머지)

v0.16(11번가 재구현 PR-0~6)에서 인계된 carry-over 2건(NEW-1·NEW-2)을 stacked PR 로 완주, develop 머지.

### NEW-1 — dlvNo plumbing (#291, 완료)
11번가 발송처리(1888) path 키 `dlvNo` 는 `ordNo`(=`externalOrderId`)와 **다른 값**인데, 수집된 dlvNo 를 보존할 컬럼이 없어 워커가 `externalOrderId` 를 dlvNo 자리에 잘못 전달하던 끊긴 경로 연결.

| 변경 | 내용 |
|---|---|
| 마이그 `20260530000003` | `orders.extra` jsonb 컬럼 (마켓별 발송 보조키 컨테이너, idempotent) |
| orders-repo | `MarketOrder.extra` → `orders.extra` 적재. row 빌드 순수 함수 `orders-repo-row.ts` 분리 |
| shipping 워커 | `data-load` 가 `orders.extra` SELECT → `process` 가 `buildSubmitTrackingExtra` 로 `{dlvNo}` 추출 → `submitTracking(...,{dlvNo})` 4번째 인자 전달 |
| market-adapter | `submitTracking` 에 `opts?: SubmitTrackingExtra` 추가 (optional, 기존 3-인자 구현체 호환) |
| eleven-st | `resolveElevenStDispatchDlvNo` — `opts.dlvNo` 우선·미전달 시 `externalOrderId` fallback |

### NEW-2 — certRequiredYn plumbing (#292, 완료)
11번가 `transformProduct` 는 `extra.certRequiredYn` 을 읽을 준비가 됐으나 채워주는 경로가 없어 `mapElevenStCategoryCertMeta` 파서가 고아였음. 워커가 카테고리 1617 조회 → 주입 경로 연결. **서버(Edge 워커) 전용 — web 어댑터/parity 무변경.**

| 변경 | 내용 |
|---|---|
| market-adapter | `CategoryCertMeta` 타입 + `fetchCategoryCertMeta?(dispCtgrNo)` optional |
| eleven-st | `fetchCategoryCertMeta` 구현 (cateservice 1617 GET → `mapElevenStCategoryCertMeta`, 조회 카테고리 자신 포함) |
| registration 워커 | `process` 가 `transformProduct` 직전 cert 조회 → 순수 함수 `injectCertRequiredYn`(`cert-inject.ts`)로 `mapping.extra.certRequiredYn` 주입 |
| 실패 정책 | cert 조회 실패는 `warn` 후 미주입 진행 (가용성 — `requiredYn=Y` 인데 인증 누락 시 `createProduct` 가 명확히 거부) |

> 신규 순수함수 vitest 17 추가: `resolveElevenStDispatchDlvNo` / `buildSubmitTrackingExtra` / `toOrderUpsertRow` / `injectCertRequiredYn`. 문서 sync: `features/11st.md` §4.3 cert 주입 + §4.5 dlvNo 전달.

---

## ⚠ 즉시 필요한 운영 액션 (사용자 작업)

### 1. dev DB 마이그 적용 (NEW-1 — `orders.extra`)
```
cd apps/api && npx supabase@latest db push   # 이 머신 supabase CLI 미설치 → npx
```
→ 마이그 `20260530000003_orders_extra_jsonb.sql` dev(eqoyw) 적용. **dev:db 모드에서 11번가 주문 수집·발송 검증 전 필수** (mock 모드는 무관). 미적용 시 orders insert 가 extra 컬럼 부재로 실패할 수 있음.

### 2. real DB 마이그 적용 (운영 게이트)
Actions UI → "Deploy (real)" → workflow_dispatch → `apply_db_migrations=true`
→ `20260530000003` real(lfrny) 적용. **다음 release 배포 시 동반.** (v0.16 이후 첫 real 스키마 변경)

---

## ⚠ carry-over 백로그 (v1 머지 차단 아님)

| # | 항목 | 사유 / 진입 |
|---|---|---|
| **C3** | **real 실호출 검증** (5마켓 전부 mock+parity 까지만) | 셀러 자격증명 + IP `3.36.239.243` 화이트리스트 → 키 발급 후 1회 실호출. **현재 키 미발급으로 보류.** **다음 release 핵심 게이트.** |
| **C7①** | **Deno 타입 — audit sellerId** | `deno check` 필요(이 머신 deno 미설치). `String()`로 런타임 안전, 우선순위 낮음. (②③ 완료 #289) |
| **C4** | **11번가 상품군(officialNotice) 코드 마스터** | spec 1003 의 1군만 확보, 40군 셀러 free-form. 첨부/고시 조회 API 확보 시 보강 |
| **C5** | **PR-3 이미지 ≥13장 truncate** | warning 처리됨 — 추가 UX(사전 경고) v2 |
| **C8** | **Deno 전용 테스트 CI 미실행** | 신규 Edge plumbing 은 pure 모듈 분리 vitest 로 커버(NEW-1/2 동일). fetch 본체·deno.land import 테스트는 미실행 |
| **C6** | **mcp_ro_dev `supabase_migrations` read GRANT** | 없어서 MCP 로 dev 마이그 이력 조회 불가(편의). `esm.md §5.4` 보강 고려 |

> **해소됨**: NEW-1(dlvNo plumbing) #291 · NEW-2(certRequiredYn plumbing) #292 — v0.16 carry-over 2건 종결.

---

## 스택 한눈에

```
프론트:  React 18 + Vite + TS strict + shadcn + Tailwind + TanStack Query + RHF + zod + Tiptap + Daum Postcode + DOMPurify
백엔드:  Supabase (Postgres + RLS + Auth + Storage + Realtime + Edge Functions Deno + pg_cron + Vault)
         + AWS Lightsail Market Gateway (서울, 3.36.239.243, HMAC + 호스트 화이트리스트)
호스팅:  GitHub Pages (정적 SPA + 404.html) + Supabase Cloud
모니터링: Sentry (PII 마스킹 강제)
CI/CD:   GitHub Actions — 빠른레인(feature push=Lint&Typecheck/Unit) + 풀게이트(PR=Build dev·real/E2E golden+a11y 통합/pgTAP, 경로필터 app·sql). required=CI Gate/Lint&Typecheck/Unit 3개
브랜치:  Git Flow (main / develop / release/* / feature/* / hotfix/*) — feature base = develop, squash-only, strict(up-to-date)
빌드모드: VITE_APP_MODE=dev|real + VITE_USE_MOCK=true|false
MCP 호스팅: Lightsail 3.36.239.243 docker-compose (supabase-dev=뭄바이풀러 / supabase-real=서울풀러 / playwright / sentry)
```

## 도메인 모델

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
| **develop 누적 (#291·#292)** | **11번가 NEW-1 dlvNo plumbing + NEW-2 certRequiredYn plumbing** | **develop 머지 (미릴리즈)** |

## 운영 현황

- **운영 배포 URL**: `https://rumeadia-dotcom.github.io/ing0415/` · **직전 deploy = v0.16 (#280) success (2026-05-30 09:36)**
- **dev Supabase** (`eqoyw`, 뭄바이): v0.16 마이그 정합 완료. **NEW-1 `20260530000003` 미적용(운영 액션 1).**
- **real Supabase** (`lfrny`, 서울): v0.16 까지 어댑터·Edge 코드만(스키마 변경 없음). **NEW-1 `20260530000003` 미적용(운영 액션 2 — 다음 release 동반).**
- **Lightsail 게이트웨이**: allowlist + PR-6 maskUrl 재배포 완료 (healthz 200).
- **MCP supabase-dev**: 정상 (뭄바이 풀러).

---

## 다음 세션 진입

```bash
git pull origin develop && pnpm install && pnpm test -- --run
```
**1370 passed** 확인 후 진입.

### 우선 순위
1. **C3 real 실호출 검증** — 셀러 키 발급 + IP `3.36.239.243` 화이트리스트 후 5마켓 1회 실호출. **다음 release 핵심 게이트** (현재 키 미발급 보류). 동반: NEW-1 마이그 real 적용(운영 액션 2).
2. **dev 마이그 정합** (운영 액션 1) — `npx supabase@latest db push` 로 `20260530000003` 적용. dev:db 모드 11번가 주문/등록 검증 전 필수.
3. **C7① audit sellerId** — `deno check` 필요(deno 미설치). 런타임 안전이라 우선순위 낮음.

> NEW-1/NEW-2 develop 머지 완료. 다음 release 는 C3 실호출 검증 + NEW-1 real 마이그 동반 후 사용자 결정.

---

## 백로그 (v1 이후 / 영구 보류)

- 11번가 멀티옵션·클레임·정산·기획전 / 11번가 상품군 코드 마스터(C4) / 카테고리 cert 메타 캐싱(NEW-2 매 등록 1617 1회 → v2) — v2
- 알림 / CSV / 오류 통계 차트 / 이미지 WebP — 미진입 v1 스코프
- 쿠팡 미구현 endpoint(출고지/반품지/상품수정·조회·삭제) — v2
- s4 템플릿 / 소셜 / 2FA / Stripe·PG / 멀티유저 권한 — v2~보류

---

## ⚠ 룰 강제 메모

### Git Flow / stacked PR (CLAUDE.md §Rules)
- 새 feature/* 는 **반드시 develop 분기**. 공통 파일 충돌 우려 시 stacked PR(base=선행 feature) → 선행 머지 후 `git rebase origin/develop`(선행 squash 와 중복 커밋 자동 skip) → `push --force-with-lease` → 머지.
- **CI 빠른레인 분리 후** — feature push 는 Lint&Typecheck/Unit 만. Build/E2E/pgTAP 풀게이트는 PR + 경로필터(app·sql). Edge functions 만 변경 시 Build/E2E/pgTAP skip(정상). required=CI Gate/Lint&Typecheck/Unit.

### Edge(Deno) 타입 검증 한계
- 이 머신 deno 미설치 → `deno check` 로컬 불가. 신규 Edge plumbing 은 **순수 모듈 분리 + vitest 커버**가 표준(NEW-1/2: resolve·build·toRow·inject 함수). fetch 본체는 CI/배포 검증.

### 운영 인프라 SSH / DB write
- Lightsail SSH·dev/real DROP·db push 등 파괴적·공유 인프라 작업은 사용자 직접 실행. MCP supabase 는 read-only.
- gh: `C:\Program Files\GitHub CLI\gh.exe` (절대경로). 박스 SSH: `ssh ubuntu@3.36.239.243`.
