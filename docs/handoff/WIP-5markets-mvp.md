# MarketCast — WIP 핸드오프 (2026-05-23 P.M.)

**develop HEAD**: `191a56e` — docs(qa): qa-matrix.md 신설 (#132)
**main HEAD**: `e6d0c4d` — chore(rule) 운영 사고 진단 chain 룰 (#108). release 보류 (사용자 지시 "develop 까지만 머지")
**테스트**: 877 passed / 26 todo (86 files)
**최근 운영 배포**: v0.9 (Market Gateway 도입 + Phase 4-A 어댑터 게이트웨이 경유) — 이후 develop 만 누적

## 2026-05-23 P.M. 세션 요약 (audit fix + 후속 보강)

3개 에이전트 audit (backend / security / qa) → 9 PR develop 머지. 운영 사고 차단 + qa 매트릭스 단일 진실 확보.

| PR | 내용 | 카테고리 |
|---|---|---|
| #123 | **RPC fn_ prefix mismatch hotfix** — logen / shipping-dispatch 100% fail 차단 | backend audit |
| #124 | orders-sync bodyPreview PII 누출 제거 | security audit |
| #125 | markets-verify `credential_inactive` / `adapter_unavailable` UI 매핑 | qa audit |
| #126 | a11y ROUTES 9개 추가 (18→26) + `/register/categories` 제거 | qa audit |
| #127 | Market Gateway `x-gw-sig` / `x-gw-ts` 헤더 마스킹 | security audit |
| #128 | `fn_registration_job_transition` — registration_jobs 상태 전이 single source | 후속 |
| #129 | order_groups backfill 검증 SQL + 운영 매뉴얼 | 후속 |
| #130 | sanitize parity test (client/server DOMPurify, 26/26 통과 — drift no) | 후속 |
| #132 | **qa-matrix.md 신설** — PRD §1~§9 + s7~s9 커버리지 매트릭스 (330줄) | 후속 |

PR #131 은 stale base (e6d0c4d 분기) 충돌로 close → qa-matrix.md 만 추출 후 #132 rebase 재제출.

## 스택 한눈에

```
프론트:  React 18 + Vite + TS strict + shadcn + Tailwind + TanStack Query + RHF + zod
         + Tiptap (WYSIWYG) + Daum Postcode SDK + DOMPurify (client) + isomorphic-dompurify (server)
백엔드:  Supabase (Postgres + RLS + Auth + Storage + Realtime + Edge Functions Deno + pg_cron + Vault)
         + AWS Lightsail Market Gateway (서울, 43.201.83.78, HMAC + 호스트 화이트리스트)
호스팅:  GitHub Pages (정적 SPA + 404.html fallback) + Supabase Cloud
모니터링: Sentry (PII 마스킹 강제 — redact.ts / masking.ts 양쪽 동기)
CI/CD:   GitHub Actions (PR + main 분리, auto-merge 활성)
브랜치:  Git Flow (main / develop / release/* / feature/* / hotfix/*) — feature base = develop
빌드모드: VITE_APP_MODE=dev|real + VITE_USE_MOCK=true|false (dev+mock / dev+real-API / real+real-API / real+mock=금지)
```

## 도메인 모델

v1 출시 범위 = 상품 등록(s1~s6) + 주문·배송 자동화(s7~s9) + 알림(s10) + v1.4 order-grouping Phase 1.

```
상품 등록 (s1~s6)
Seller (auth.users) ─┬─ MarketAccount ─── credential_payload jsonb + pgcrypto
                     ├─ Product ─┬─ ProductImage ─ ImageTransform (마켓별 N)
                     │           └─ ProductMarketMapping (카테고리/규격)
                     ├─ RegistrationJob ─── JobMarketResult (1:N)
                     │       └─ fn_registration_job_transition() — 상태 전이 single source (#128)
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
| Stage A~H | 부트스트랩 (빌드·디자인·라우팅·데이터·DB·EdgeFn·테스트·CI) | — |
| B-1~B-5 | 인증·대시보드·상품등록·마켓계정·이력 본구현 + 브랜드 리스킨 | — |
| C-1~C-4 | 4마켓 OAuth/HMAC/ESM real 어댑터 + fan-out 통합 12종 mock | — |
| D-A~D-D | axe E2E / pgTAP RLS / 법적 페이지 / Sentry 마스킹 | — |
| v0.4~v0.6 | 주문·배송 자동화 / env 플래그 분리 / WYSIWYG + 발송지 API + 배송 정책 | 운영 배포 |
| v0.8~v0.9 | Market Gateway Phase 1~2 + Phase 4-A (쿠팡·ESM 게이트웨이 경유) | 운영 배포 |
| 2026-05-22 | 5마켓 v1 정식 결정 (IP 화이트리스트 5마켓 공통) | 결정 |
| 2026-05-23 A.M. | hotfix v0.9.1~v0.9.9 + chain 진단 룰 + chunk splitting + v1.4 Phase 1 DB | #98~#122 |
| **2026-05-23 P.M.** | **audit fix 9 PR (위 표)** | **#123~#132** |

## 운영 현황

- **운영 배포 URL**: `https://rumeadia-dotcom.github.io/ing0415/`
- **최근 deploy**: release/v0.9 / Phase 4-A (2026-05-23 A.M.). 이후 P.M. 9 PR 은 develop 만 누적 (사용자 "develop 까지만 머지" 지시)
- **dev Supabase** (`eqoywqoalwkwbrdsulfl`): A.M. 까지 적용. **P.M. 신규 마이그레이션 3개 미적용** ⚠

---

## ⚠ 즉시 필요한 운영 액션 (사용자 작업)

### 1. dev DB 마이그레이션 적용 (3개 신규)

```bash
pnpm supabase:link:dev
pnpm db:push:dev
```

적용 대상:
- `20260523000003_order_groups.sql` — order_groups 테이블 + orders.order_group_id 컬럼 + 1:1 backfill
- `20260524000001_rpc_fn_prefix_fix.sql` — `fn_set_logen_credentials` / `fn_get_logen_credentials` / `fn_increment_shipping_job_counters` (Edge Function 100% fail 차단)
- `20260524000002_registration_job_state_machine.sql` — `fn_registration_job_transition`

적용 후 검증:
```bash
psql <dev-conn-string> -f scripts/sql/verify-order-groups-backfill.sql
```
6개 SELECT 통과 (자세히는 `docs/handoff/order-groups-backfill-verification.md`).

### 2. dev Edge Function 재배포

```bash
pnpm functions:deploy:dev
```
- `pgcrypto-logen.ts` (PR #123 RPC 호출)
- `shipping-dispatch-market-worker/lib/result-update.ts` (PR #123 RPC 호출)
- `jmr-update.ts` / `registration-retry/index.ts` (PR #128 RPC 경유로 교체)

### 3. dev Edge Function secrets (미설정인 경우)

```
MASTER_KEY_CURRENT_KID = mk_2026_q2
MASTER_KEY_MK_2026_Q2  = <openssl rand -base64 32>
DAILY_SALT             = <32+ char random>
PUBLIC_APP_ORIGIN      = http://localhost:5173
```

### 4. 운영(real) Vault / env vars — 이전 세션과 동일 (변동 없음)

```
supabase_functions_url  = https://lfrnythcujxdhehvkmtg.supabase.co/functions/v1
service_role_key        = <real service_role JWT>
LOGEN_API_BASE_URL      = https://openapi.ilogen.com
LOGEN_PGCRYPTO_KEY      = <암호화 키>
RESEND_API_KEY          = <PR3 머지 후>
```

---

## 남은 작업

### 🔴 외부 차단 (사람이 해야 하는 선행 조건 — 변동 없음)

베타 셀러 모집 / 네이버 type=SERVICE 심사 / 쿠팡 Wing IP 정책 확정 / G·옥션 ESM+ 키 발급 / 로젠 B2B 계약 / Resend 도메인 인증.

### 🔴 신규 P0 (qa-matrix 갭 top 3)

| 항목 | 근거 | 차단 |
|---|---|---|
| **RLS-SQL 단위 테스트 부재** | 8개+ 셀러 테이블 cross-access 검증 0건 | pgTAP CI 환경 필요 |
| partial / retry / skip-market E2E 3종 | `golden-path.md §9` 권장 | 셀러 시드 + 어댑터 시뮬레이션 |
| debug ↔ real parity.spec.ts 5종 | R-006 헌법 위반 잠재 | 마켓별 fixture 매트릭스 |

### 🟠 마켓·로젠 스펙 의존 보류 (외부 차단)

| 항목 | 차단 내용 |
|---|---|
| 골든패스 G1~G10 (9 fixme) | 셀러 시드 + 마켓 OAuth fake / 로젠 fake |
| 11번가 parity / 본격 어댑터 (Phase 4-B-2 Wave 2) | 11번가 API spec 미확보 |
| 네이버 어댑터 보강 (Phase 4-B-1) | 외부 spec 의존 |
| v1.4 Phase 2~4 (order-grouping 본격) | 마켓 multi-row 응답 / 로젠 send_list 스펙 |
| ESM endpoint 정확도 (`/api/v1/category` 404) | 실 ESM 문서 기반 path 검증 |

### 🟠 미진입 v1 스코프 (변동 없음)

| PRD § | 항목 |
|---|---|
| §1.4.3 + §2.3.4 | 알림 도메인 (in-app + 이메일, PR3 트랙) |
| §1.4.2 + §4.4.3 | CSV 내보내기 (papaparse) |
| §2.4.x | 정기 보안 감사 + 백업/복구 |
| §4.2.x / §4.4.2 | 오류 통계 + 차트 (라이브러리 미선정) |
| §5.4.1 | 이미지 WebP + 변형본 |

---

## 후속 정합 백로그 (architecture v1 drift)

1. `design-renewal/s3-register.md` / `s9-settings.md` 갱신 (v0.6 WYSIWYG / 배송 정책 / v1.4 order-grouping 다이어그램).
2. `features/registration.md` §3.6 + `settings-shipping.md` WYSIWYG + 주소 API 반영.
3. §4.4.2 차트 라이브러리 결정.
4. s10 알림 도메인 정의서 (PR3 신설 예정).
5. `qa-matrix.md` (#132) — 신규 기능 PR 진입 시 본 매트릭스의 빈칸 = R-001 / R-009 위반. 행 추가 강제.

---

## 백로그 (v1 이후 / 영구 보류)

- 로젠 외 택배사 (CJ / 한진) — v2
- 마켓 주문 웹훅(push) → 폴링 대체 — v2
- s4 템플릿 관리 / 소셜 로그인 / 2FA — v2
- 멀티유저 권한 — 1인 셀러 모델 유지 시 영구 보류
- 마켓 단건 재시도 / 카테고리 자동 추천 ML — v2
- WebKit·Firefox E2E — v2
- Stripe·PG 연동 / 구독 결제 — v2

---

## 다음 세션 진입

```bash
git fetch origin && git checkout develop && git pull && pnpm install && pnpm test -- --run
```

**877 passed / 26 todo** 확인 후 진입.

### 우선 순위

1. **⚠ 운영 액션 §1+§2 실행** — dev DB 마이그 3개 + Edge Function 재배포. 안 하면 로젠 / shipping-dispatch / registration-retry / order_groups 본 동작 불가.
2. **P0 RLS-SQL 단위 테스트** (qa-matrix #1) — `supabase test db` 환경 셋업 + 셀러 cross-access 매트릭스. 보안 P0.
3. **partial / retry / skip-market E2E 3종** (qa-matrix #2) — 셀러 시드 가능해진 후 진입.
4. **debug ↔ real parity.spec.ts 5종** (qa-matrix #3) — R-006 정합 회복.
5. **(보류 해제 시) Phase 4-B-1 네이버 어댑터 본격** — OAuth code + 카테고리 + 상품 등록.
6. **(보류 해제 시) Phase 4-B-2 Wave 2 11번가 본격** — API Key 폼 활성화.
7. **release/v0.10 검토** — develop 누적 9 PR 안정성 충분하면 main 까지 release/* PR 진행 (사용자 승인 필요).

### ⚠ Git Flow 룰 강제 (CLAUDE.md §Rules)
- 새 feature/* 브랜치는 **반드시 `develop` 에서 분기**. `main` 금지.
- `Agent isolation: "worktree"` 는 default base 가 main — prompt 에서 `git fetch origin develop && git checkout -B feature/X origin/develop` 강제.
- 과거 사고: PR #28~#37 main lineage 분기 cherry-pick 회수.

### ⚠ 운영 사고 진단 룰 (CLAUDE.md, PR #108)
- 운영 fail 진단 시 단계별 점검 금지. chain 6단계 (서버 throw / 직렬화 / 클라 parse / 클라 schema / UI 매핑 / DB·인프라) 동시 grep.
- 사용자 재현 5회 이상 요구 = 실패한 진단.

### ⚠ qa-matrix 진입 게이트 (PR #132)
- 신규 기능 PR 진입 시 `docs/architecture/v1/qa/qa-matrix.md` 의 해당 행 갱신 필수.
- 미커버 칸 ↑ → R-001 / R-009 위반 잠재.
