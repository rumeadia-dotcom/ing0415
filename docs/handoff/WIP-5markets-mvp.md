# MarketCast — WIP 핸드오프 (2026-05-23 evening)

**develop HEAD**: `65e2808` — chore: main → develop 백머지 (v0.10.1) (#138)
**main HEAD**: `b821cf8` — hotfix/v0.10.1 — registration_job_state_machine COMMENT SQL syntax fix (#137)
**테스트**: 877 passed / 26 todo (85 files passed / 1 skipped)
**최근 운영 배포**: **v0.10 + v0.10.1** — qa-matrix + audit fix + v1.4 Phase 1 (order-grouping) + `fn_registration_job_transition` COMMENT 절 SQL syntax hotfix

## 2026-05-23 저녁 세션 요약 (release v0.10 + hotfix v0.10.1)

오전(P.M.) audit fix 9 PR (#123~#132) + WIP (#134) 가 develop 에 누적된 상태에서 운영 배포 절차 실행.

| PR | 내용 | 비고 |
|---|---|---|
| #135 | **release: v0.10 — qa-matrix + audit fix + v1.4 Phase 1** (main 머지 `d786811`) | release-deploy 스킬 §1~§7 |
| #136 | chore: main → develop 백머지 (v0.10) (`ec576e9`) | orphan 0, 충돌 0 |
| #137 | **hotfix/v0.10.1 — `fn_registration_job_transition` COMMENT SQL syntax fix** (main 머지 `b821cf8`) | apply_db_migrations 1차 실행 시 SQLSTATE 42601 발생 → `COMMENT ON ... IS '...' \|\| '...'` 가 PostgreSQL expression 거부. `\|\|` 제거 + SQL 표준 string literal 연속으로 교체 |
| #138 | chore: main → develop 백머지 (v0.10.1) (`65e2808`) | 1파일 충돌 `--theirs` 채택, orphan 0 |

v0.10 운영 배포 (deploy.yml) — 자동 트리거 + `apply_db_migrations=true` workflow_dispatch 2회차에서 5잡 전부 success. Build (real) / Deploy Pages / Deploy Edge Functions / Apply DB Migrations / Sentry release.

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
                     │       └─ fn_registration_job_transition() — 상태 전이 single source (v0.10.1 운영 적용)
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
| 2026-05-23 P.M. | audit fix 9 PR (qa-matrix 신설 + 운영 사고 차단) | #123~#132 |
| **2026-05-23 evening** | **release v0.10 + hotfix v0.10.1 운영 배포 완료** | **#135~#138** |

## 운영 현황

- **운영 배포 URL**: `https://rumeadia-dotcom.github.io/ing0415/`
- **최근 deploy**: v0.10 + v0.10.1 (2026-05-23 evening). deploy.yml 5잡 success (Build real / Pages / Edge Fn / **Apply DB Migrations** / Sentry).
- **real Supabase** (`lfrnythcujxdhehvkmtg`): v0.10.1 신규 마이그 3개 적용 완료.
  - `20260523000003_order_groups.sql`
  - `20260524000001_rpc_fn_prefix_fix.sql`
  - `20260524000002_registration_job_state_machine.sql` (v0.10.1 syntax fix 후 success)
- **dev Supabase** (`eqoywqoalwkwbrdsulfl`): **위 3개 마이그 미적용** ⚠ (release 흐름에서 real 만 적용)

---

## ⚠ 즉시 필요한 운영 액션 (사용자 작업)

### 1. dev DB 마이그레이션 3개 적용

```bash
pnpm supabase:link:dev
pnpm db:push:dev
```

대상:
- `20260523000003_order_groups.sql`
- `20260524000001_rpc_fn_prefix_fix.sql`
- `20260524000002_registration_job_state_machine.sql` (v0.10.1 syntax fix 적용본)

적용 후 검증:
```bash
psql <dev-conn-string> -f scripts/sql/verify-order-groups-backfill.sql
```
6개 SELECT 통과 (`docs/handoff/order-groups-backfill-verification.md`).

### 2. dev Edge Function 재배포

```bash
pnpm functions:deploy:dev
```

- `pgcrypto-logen.ts` / `shipping-dispatch-market-worker/lib/result-update.ts` — fn_set/get_logen_credentials, fn_increment_shipping_job_counters RPC 호출 활성화
- `jmr-update.ts` / `registration-retry/index.ts` — fn_registration_job_transition RPC 경유

### 3. dev Edge Function secrets (미설정인 경우)

```
MASTER_KEY_CURRENT_KID = mk_2026_q2
MASTER_KEY_MK_2026_Q2  = <openssl rand -base64 32>
DAILY_SALT             = <32+ char random>
PUBLIC_APP_ORIGIN      = http://localhost:5173
```

### 4. 운영(real) — 추가 액션 없음

deploy.yml workflow_dispatch (`apply_db_migrations=true`) 로 마이그·Edge Function·Pages·Sentry 전부 자동 적용 완료. 운영 검증은 markets 자격증명 등록 시나리오로 확인 (사용자 보고 "완료").

---

## 남은 작업

### 🔴 외부 차단 (사람이 해야 하는 선행 조건 — 변동 없음)

베타 셀러 모집 / 네이버 type=SERVICE 심사 / 쿠팡 Wing IP 정책 확정 / G·옥션 ESM+ 키 발급 / 로젠 B2B 계약 / Resend 도메인 인증.

### 🔴 P0 (qa-matrix 갭 top 3)

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

1. **⚠ 운영 액션 §1+§2 실행** — dev DB 마이그 3개 + Edge Function 재배포. 안 하면 dev 환경 logen / shipping-dispatch / registration-retry / order_groups 본 동작 불가.
2. **P0 RLS-SQL 단위 테스트** (qa-matrix #1) — `supabase test db` 환경 셋업 + 셀러 cross-access 매트릭스. 보안 P0.
3. **partial / retry / skip-market E2E 3종** (qa-matrix #2) — 셀러 시드 가능해진 후 진입.
4. **debug ↔ real parity.spec.ts 5종** (qa-matrix #3) — R-006 정합 회복.
5. **(보류 해제 시) Phase 4-B-1 네이버 어댑터 본격** — OAuth code + 카테고리 + 상품 등록.
6. **(보류 해제 시) Phase 4-B-2 Wave 2 11번가 본격** — API Key 폼 활성화.
7. **release/v0.11 검토** — develop 누적 변경이 쌓이면 다음 release/* PR 진행 (사용자 승인 필요).

### ⚠ Git Flow 룰 강제 (CLAUDE.md §Rules)
- 새 feature/* 브랜치는 **반드시 `develop` 에서 분기**. `main` 금지.
- `Agent isolation: "worktree"` 는 default base 가 main — prompt 에서 `git fetch origin develop && git checkout -B feature/X origin/develop` 강제.
- 과거 사고: PR #28~#37 main lineage 분기 cherry-pick 회수.

### ⚠ 운영 사고 진단 룰 (CLAUDE.md, PR #108)
- 운영 fail 진단 시 단계별 점검 금지. chain 6단계 (서버 throw / 직렬화 / 클라 parse / 클라 schema / UI 매핑 / DB·인프라) 동시 grep.
- 사용자 재현 5회 이상 요구 = 실패한 진단.

### ⚠ SQL `COMMENT ON ... IS` 룰 (PR #137 사례)
- `COMMENT ON FUNCTION ... IS '...' || '...'` = expression context 거부 (SQLSTATE 42601).
- 다행 string 코멘트는 SQL 표준 string literal 연속 (`'a '` 다음 줄에 `'b '` — newline + whitespace 만 있으면 자동 concat) 사용.
- 마이그레이션 신설 시 `psql --dry-run` 류 검증 권장 (CI 통합은 후속).

### ⚠ qa-matrix 진입 게이트 (PR #132)
- 신규 기능 PR 진입 시 `docs/architecture/v1/qa/qa-matrix.md` 의 해당 행 갱신 필수.
- 미커버 칸 ↑ → R-001 / R-009 위반 잠재.
