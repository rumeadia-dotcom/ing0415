# MarketCast — WIP 핸드오프 (2026-05-27 — 쿠팡 연결/검증 hotfix 5건 운영 배포 직후)

**develop HEAD**: 백머지 (main #231 → develop) — chore/backmerge-hydrate
**main HEAD**: `<#231 squash>` — fix: 어댑터 hydrate 추가 (상태확인 연결 끊김) (#231)
**테스트**: ~914 passed / 31 todo (94 files, eleven-st +2 hydrate. 1 sanitize-parity env issue — CI 통과)
**최근 운영 배포**: 어댑터 hydrate hotfix #231 (2026-05-27 08:4x UTC) — deploy.yml 5/5 success (Edge Functions 재배포)
**최근 develop 머지**: 백머지 (#231)

## 2026-05-27 세션 결과 (쿠팡 연결/검증 운영 hotfix 5건 — chain 진단)

쿠팡 마켓 연결·검증 흐름의 **연쇄 결함 5개**를 chain 진단으로 순차 해소. 각 fix 가 다음 layer 를 드러냄 (**404→401→500→42883→상태확인 끊김**). 전부 "real 쿠팡/Supabase 로 검증된 적 없던" 코드 + "자기 복사본만 검사 / 로컬·mock 에선 재현 안 되는 약한 테스트"가 가린 케이스. **연결 성공 확인됨(쿠팡 active).**

> **교훈**: 마켓 어댑터 real 경로(경로 상수 / HMAC 서명 / 응답 스키마)는 sandbox/실 API 1회 검증 없이 머지하면 안 됨. 단위 테스트가 인라인 복사본을 검사하면 false-confidence (5xx `as never`, HMAC `\n`, strict 스키마 모두 통과했었음). 실모듈 직접 테스트 + KAT 로 가드.

### 1탄 #223 — 카테고리 경로/루트 (`category_ping_failed`)
- correlationId `58f3ca64`, Edge 로그 `category ping failed (unknown)`, 796ms (즉시 404).
- 경로 `…/api/v1/`**`categorization`**`/…` → `…/api/v1/`**`marketplace/meta`**`/display-categories/{code}` (루트 `1`→`0`). 쿠팡 공식 문서 검증.
- 핑 `fetchCategoryTree` maxDepth=1 (트리 전체 재귀 → 폭주/타임아웃 방지).
- 5xx code `as never` 문자열 → `'server'`. audit insert error 미검사 → 로깅.
- 순수 로직 `coupang-category.ts` 분리 + vitest 12 (실코드 회귀 가드).

### 2탄 #225 — HMAC 서명 형식 (`credentials_unauthorized`)
- 1탄 후 호출이 쿠팡 도달(HTTP 400 / 3.5s) → 쿠팡 401. correlationId `fb9e719d`.
- 서명 메시지 `datetime\nMETHOD\npath\n` (개행) → 공식 스펙 `datetime+method+path+query` **무개행** 연결 + query('?' 분리). 서버 + 클라이언트 미러 둘 다.
- KAT(node crypto 정답 대조) 추가 — 기존 10 테스트는 구조만 봐 형식 오류 못 잡음.

### 3탄 #227 — 핑 응답 파싱 완화 (`market_server`)
- 2탄 후 401 사라짐(인증 통과) → reason=`server` 재시도. correlationId `0965ac1a`.
- `fetchCategoryTree` 가 응답을 strict zod 로 파싱하다 실패 → server. **markets-connect 는 핑 반환값 미사용** → "HTTP 200 = 자격증명 OK" 로 완화. `coerceCoupangCategory` 관대 매핑(throw 없음), non-2xx 만 분류 유지.

### 4탄 #229 — 자격증명 RPC search_path (`vault_unavailable` / pgcrypto 42883)
- 3탄 후 핑 통과 → storeCredential 단계 `fn_encrypt_and_store_credential` 이 42883(undefined_function). correlationId `39cffee6`.
- Supabase 클라우드는 pgcrypto 를 `extensions` 스키마에 설치하는데, 자격증명 RPC 가 `search_path = public, pg_temp` (extensions 누락) → bare `pgp_sym_encrypt/decrypt` 미해결. 로컬/pgTAP 은 pgcrypto 가 public 이라 통과.
- 마이그 `20260527000001`: RPC 4개(market 2 + logen 2) search_path 에 `extensions` 추가 (ALTER FUNCTION). `apply_db_migrations=true` 로 real 적용.
- markets-connect vault `catch{}` 무음 → err 로깅 보강. → **연결 성공(active) 확인됨.**

### 5탄 #231 — 어댑터 hydrate (상태확인/등록 시 연결 끊김)
- 마켓 계정 "상태 확인"(markets-verify) 클릭 시 멀쩡한 연결이 `revoked` 처리.
- `getMarketAdapter` 는 빈 어댑터 생성, real 어댑터는 authenticate 가 cred 세팅해야 동작. verify 는 `loadCredential`만 하고 authenticate 미호출 → `fetchCategoryTree` 가 `getCredOrThrow()` unauthorized → hmac 즉시 revoked. registration `createProduct` 도 동일.
- `MarketAdapter.hydrate(stored)` 추가 (authenticate 와 분리, API 없음). coupang/esm/eleven-st 구현, naver(stub)/mock no-op. markets-verify + registration-market-worker 가 ping/createProduct 전 hydrate 호출. mock(dev) cred 게이트 없어 real 첫 검증에서만 발현.

> ⚠ **격리 hotfix** — 다섯 다 main 기준 분기 (develop 누적 미반영, blast radius 최소).
> ⚠ **4탄 배포 후에도 막히면 남은 원인** = 진짜 쿠팡 5xx(일시) 또는 키 오류 / 쿠팡 Wing IP 화이트리스트 `43.201.83.78` 미등록.
> ⚠ **dev 미적용**: 마이그 `20260527000001` 은 real 만 적용됨 → dev `db:push:dev` 이월 목록에 추가.
> ⚠ **후속**: UI 카테고리 트리(s3) 쿠팡 응답 실제 필드명 미검증 / `coupang-edge.test.ts` 인라인 재구현 흡수 / RPC search_path 회귀 가드 pgTAP(proconfig에 extensions 포함 검사).

## 스택 한눈에

```
프론트:  React 18 + Vite + TS strict + shadcn + Tailwind + TanStack Query + RHF + zod
         + Tiptap (WYSIWYG) + Daum Postcode SDK + DOMPurify (client) + isomorphic-dompurify (server)
백엔드:  Supabase (Postgres + RLS + Auth + Storage + Realtime + Edge Functions Deno + pg_cron + Vault)
         + AWS Lightsail Market Gateway (서울, 43.201.83.78, HMAC + 호스트 화이트리스트)
호스팅:  GitHub Pages (정적 SPA + 404.html fallback) + Supabase Cloud
모니터링: Sentry (PII 마스킹 강제)
CI/CD:   GitHub Actions (PR 8잡 + main 분리, auto-merge 활성)
         deploy.yml = build-real / verify-vault-secrets / deploy-pages / deploy-edge-functions / notify-sentry
브랜치:  Git Flow (main / develop / release/* / feature/* / hotfix/*) — feature base = develop
         develop ruleset = PR + 0 approval + thread resolution + 8 status checks + squash-only
빌드모드: VITE_APP_MODE=dev|real + VITE_USE_MOCK=true|false
```

## 도메인 모델

v1 출시 범위 = 상품 등록(s1~s6) + 주문·배송 자동화(s7~s9) + 알림(s10) + v1.4 order-grouping Phase 1.

```
상품 등록 (s1~s6)
Seller (auth.users) ─┬─ MarketAccount ─── credential_payload jsonb + pgcrypto
                     ├─ Product ─┬─ ProductImage ─ ImageTransform (마켓별 N)
                     │           └─ ProductMarketMapping (카테고리/규격)
                     ├─ RegistrationJob ─── JobMarketResult (1:N)
                     │       └─ fn_registration_job_transition() — 상태 전이 single source
                     └─ ShippingPolicy

주문·배송 (s7~s9, v1.4 grouping)
Seller ─┬─ Order ── order_group_id → OrderGroup (1박스=1송장, Phase 1 backfill 1:1)
        │   status: collected → logen_registered → waybill_printed → tracking_submitted
        ├─ ShippingJob ─── ShippingJobResult (1:N)
        └─ LogenCredentials (pgcrypto — userId/custCd + 발송인/지)
```

## 완료된 작업 (요약)

| 단계 | 내용 | 비고 |
|---|---|---|
| Stage A~H | 부트스트랩 | — |
| B-1~B-5 | 인증·대시보드·상품등록·마켓계정·이력 본구현 + 브랜드 리스킨 | — |
| C-1~C-4 | 4마켓 OAuth/HMAC/ESM real 어댑터 + fan-out 통합 12종 mock | — |
| D-A~D-D | axe E2E / pgTAP RLS / 법적 페이지 / Sentry 마스킹 | — |
| v0.4~v0.10 | 주문·배송 자동화 / WYSIWYG / Market Gateway / qa-matrix / order-grouping | 운영 배포 |
| v0.11 | 운영 안전망 3종 (ruleset / verify-vault / parity) | #142~#151 |
| 11번가 v1 scaffold | 단계 1 (A~G) — authenticate 만 동작, 5메서드 spec_pending | #152 |
| v0.12 / v0.13 | mock cycle 16-49 / 50-61 batch (a11y + UI 정합) | #202 / #217 |
| v0.14 | hookify 플러그인 tooling | #220 |
| **쿠팡 hotfix** | **카테고리 경로/루트 수정 + 핑 깊이 제한 + audit 관찰성** | **#223** |

## 운영 현황

- **운영 배포 URL**: `https://rumeadia-dotcom.github.io/ing0415/`
- **최근 deploy run**: `26497646002` (쿠팡 hotfix #223, 2026-05-27 07:37 UTC, success). Edge Functions 재배포 완료 → `markets-connect` + 쿠팡 어댑터 최신.
- **real Supabase** (`lfrnythcujxdhehvkmtg`): v0.10.1 마이그 + Vault 2 secret 적용. 이후 마이그 추가 없음 (hotfix 도 마이그 0).
- **dev Supabase** (`eqoywqoalwkwbrdsulfl`): **v0.10.1 마이그 3개 미적용** ⚠ (이월)

---

## ⚠ 즉시 필요한 운영 액션 (사용자 작업)

### 1. 쿠팡 재연결 검증 (hotfix 직후 — 미완)
- 운영 UI 에서 쿠팡 마켓 **재연결** → `category_ping` 성공 → `active` 확인.
- 실패 시 Edge 로그 `markets-connect` 의 `← market response (gateway)` `{ status, kind }` 확인 (경로 수정 후에도 4xx 면 자격증명/IP 화이트리스트 문제).

### 2. dev DB 마이그 3개 적용 (이월 — 3+ 릴리즈 누적)
```bash
pnpm supabase:link:dev
pnpm db:push:dev
```
대상: `20260523000003_order_groups.sql` / `20260524000001_rpc_fn_prefix_fix.sql` / `20260524000002_registration_job_state_machine.sql`

### 3. dev Edge Function 재배포 (이월)
```bash
pnpm functions:deploy:dev
```

### 4. 11번가 Open API spec 입수 (단계 2 진입 트리거)
- 11번가 OPEN API 센터 (openapi.11st.co.kr) → Seller API 발급. IP 화이트리스트 `43.201.83.78` 등록 → API Key 발급. 가이드/샘플 XML/에러 코드 캡처.

---

## 남은 작업 / 후속 정합

### 1. 쿠팡 hotfix 후속
- **`coupang-edge.test.ts` 인라인 재구현 정리** — 이 테스트는 실코드 복사본을 테스트해 5xx `as never` 버그를 못 잡았음(이번 사고의 숨은 배경). `coupang-category.ts` 실모듈 테스트로 흡수 검토.
- **registration UI 카테고리 트리** — 핑만 maxDepth=1 로 고침. UI 의 `fetchCategoryTree` 전체 트리 eager 로딩은 여전히 비현실적(수백~수천 호출). lazy/페이지네이션 설계 필요 (OQ-13 / markets.md O-4).

### 2. 11번가 단계 2 (spec 입수 시 트리거)
- 서버/클라 어댑터 4메서드 본체 + CP949→UTF-8 + XML 파싱 + 에러 매핑 + `skipCategoryPing` 제거 + parity §5 활성.

### 3. P0 qa-matrix 갭
| 항목 | 차단 |
|---|---|
| partial / retry / skip-market E2E 3종 | 셀러 시드 + 어댑터 시뮬레이션 |
| captured-real fixture (parity §5) | sandbox 마켓 API 접근 |

### 4. 미진입 v1 스코프
| PRD § | 항목 |
|---|---|
| §1.4.3 + §2.3.4 | 알림 도메인 |
| §1.4.2 + §4.4.3 | CSV 내보내기 |
| §2.4.x | 정기 보안 감사 |
| §4.2.x / §4.4.2 | 오류 통계 차트 |
| §5.4.1 | 이미지 WebP |

### 5. sanitize-parity 로컬 실패 (낮은 우선순위)
- `tests/unit/security/sanitize-parity.test.ts` 가 `npm:isomorphic-dompurify@2.20.0` (Deno import) 직접 import → Vitest Node resolve 불가. CI 통과. vite alias 또는 exclude 검토.

---

## 백로그 (v1 이후 / 영구 보류)

- 로젠 외 택배사 (CJ / 한진) — v2
- 마켓 주문 웹훅(push) → 폴링 대체 — v2
- s4 템플릿 / 소셜 로그인 / 2FA — v2
- 멀티유저 권한 — 영구 보류
- Stripe·PG 연동 — v2
- dependabot major bump 재시도 — 별도 트랙

---

## 다음 세션 진입

```bash
git pull origin develop && pnpm install && pnpm test
```

**906 passed / 31 todo** 확인 후 진입 (sanitize-parity 1 file 알려진 환경 이슈).

### 우선 순위
1. **쿠팡 재연결 검증** — hotfix 배포됨, 운영에서 실제 연결 성공 확인 (운영 액션 #1).
2. **dev DB 마이그 3개 + Edge Function 재배포** — 3+ 릴리즈 이월.
3. **11번가 spec 입수 신호 → 단계 2 진입**.
4. mock cycle 누적 → release/v0.15.

---

## 룰 강제 메모 (사고 회수 발 / 관찰된 패턴)

### ⚠ 운영 사고 진단 — chain 전체 1회 점검 (CLAUDE.md §Rules, 쿠팡 사고 재확인)
- generic 에러/5xx 진단 시 한 단계씩 금지. throw 지점 → 직렬화 → 클라 parse → schema → UI 매핑 → 인프라 6단계를 한 번에 grep+Read.
- 쿠팡 사고: 어댑터가 요청 correlationId 와 다른 자체 ID 사용 → 게이트웨이 로그를 요청 ID 로 grep 불가. Edge Function 로그(같은 실행 스트림)가 ground truth.

### ⚠ Git Flow 룰 강제 (CLAUDE.md §Rules)
- 새 feature/* 는 **반드시 `develop` 에서 분기**. Agent worktree default base = main 주의.
- 운영 hotfix 는 main 기준 격리 분기 권장 (develop 누적 미반영, blast radius 최소).

### ⚠ PR strict mode "behind" 패턴
- ruleset `strict_required_status_checks_policy: true` → 동시 머지 시 "behind" 분류, auto-merge 미발동. 해소: "Update branch" → CI 재실행.

### ⚠ release/백머지 PR 충돌 흔한 패턴
- `docs/handoff/WIP-*.md` / `qa-matrix.md` 자주 충돌. 해소: `git checkout --ours <file>` (develop 측 최신 채택).

### ⚠ ruleset 사고 복원 (`.github/rulesets/README.md`)
- develop protection 유실 시 `.github/rulesets/develop.json` 을 GitHub UI Import 로 1분 복원.

### ⚠ verify-vault-secrets 게이트 (#143, v0.11~)
- main 배포 시 운영 vault `supabase_functions_url` / `service_role_key` 자동 검증. 미등록 시 deploy 차단.

### ⚠ 11번가 scaffold 상태 (#152)
- `authenticate` 만 동작. 5메서드 `adapter_spec_pending`. `markets-connect` 가 11번가 한해 `category_ping` 스킵. spec 입수 후 `skipCategoryPing` 제거.

### Claude attribution 금지 (전역 룰)
- 커밋 메시지에 `Co-Authored-By: Claude ...` / `🤖 Generated with Claude Code` 등 절대 포함 X.
