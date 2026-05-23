# MarketCast — WIP 핸드오프 (2026-05-23 night)

**develop HEAD**: `fdf6a77` — ci(pgtap): RLS cross-tenant 회귀 PR 게이트 통합 (#140)
**main HEAD**: `b821cf8` — hotfix/v0.10.1 — registration_job_state_machine COMMENT SQL syntax fix (#137)
**테스트**: 877 passed / 26 todo (85 files / 1 skipped)
**최근 운영 배포**: v0.10 + v0.10.1
**최근 develop 머지**: PR #140 (pgTAP CI 통합) — qa-matrix §1 P0 해소

## 2026-05-23 night 세션 요약 (qa-matrix §1 pgTAP CI 통합)

`apps/api/supabase/tests/*.sql` (rls-cross-tenant 102 케이스 + v2_orders / v2_logen_credentials / v2_shipping_jobs / kpi-view-accuracy) 가 D-B Phase 4 (PR #11) 산출물로 존재하지만 ci.yml 통합 부재로 PR 별 회귀 0건이었음. PR #140 로 7번 잡 `pgtap-rls` 추가 → PR 마다 자동 회귀.

| PR | 내용 | 비고 |
|---|---|---|
| #140 | **ci(pgtap): RLS cross-tenant CI 통합** (`fdf6a77`) | 6 round fix 후 5/5 .sql 통과 |
| #3, #4, #5 | dependabot actions major bump close | deploy-pages 4→5, setup-cli 1→2, download-artifact 4→8 |

PR #140 의 6 round chain fix:
1. `--exclude` 컨테이너명 정정 (`inbucket` → `mailpit`, `pooler` → `supavisor`)
2. 마이그 #20260521000010 vault 가드 약화 (`raise exception` → `raise notice + return`)
3. config.toml `[db.seed] enabled = false` (psql `\set` SQLSTATE 42601 회피)
4. tests/*.sql 4 파일의 `\set ON_ERROR_STOP on` comment 처리
5. kpi-view products `title` → `name` + `price` + `base_category_id` NN 컬럼 추가
6. K3 registration_jobs INSERT 의 `error_summary` 컬럼 정합 (row 5 만 8값 stray fix)

v2_logen_credentials_rls.sql 의 `select is(count, 0)` 패턴 5개를 `throws_ok('42501')` 로 교체 — logen_credentials 가 authenticated 에 GRANT 자체 없어 permission denied 발생.

## 스택 한눈에

```
프론트:  React 18 + Vite + TS strict + shadcn + Tailwind + TanStack Query + RHF + zod
         + Tiptap (WYSIWYG) + Daum Postcode SDK + DOMPurify (client) + isomorphic-dompurify (server)
백엔드:  Supabase (Postgres + RLS + Auth + Storage + Realtime + Edge Functions Deno + pg_cron + Vault)
         + AWS Lightsail Market Gateway (서울, 43.201.83.78, HMAC + 호스트 화이트리스트)
호스팅:  GitHub Pages (정적 SPA + 404.html fallback) + Supabase Cloud
모니터링: Sentry (PII 마스킹 강제 — redact.ts / masking.ts 양쪽 동기)
CI/CD:   GitHub Actions (PR + main 분리, auto-merge 활성, pgtap-rls 7번 잡 추가)
브랜치:  Git Flow (main / develop / release/* / feature/* / hotfix/*) — feature base = develop
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
                     │       └─ fn_registration_job_transition() — 상태 전이 single source (v0.10.1)
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
| v0.8~v0.9 | Market Gateway Phase 1~2 + Phase 4-A (쿠팡·ESM 게이트웨이) | 운영 배포 |
| 2026-05-22 | 5마켓 v1 정식 결정 (IP 화이트리스트 5마켓 공통) | 결정 |
| 2026-05-23 A.M. | hotfix v0.9.1~v0.9.9 + chain 진단 룰 + chunk splitting + v1.4 Phase 1 DB | #98~#122 |
| 2026-05-23 P.M. | audit fix 9 PR (qa-matrix 신설 + 운영 사고 차단) | #123~#132 |
| 2026-05-23 evening | release v0.10 + hotfix v0.10.1 운영 배포 완료 | #135~#138 |
| **2026-05-23 night** | **pgTAP CI 통합 — qa-matrix §1 P0 해소** | **#140** |

## 운영 현황

- **운영 배포 URL**: `https://rumeadia-dotcom.github.io/ing0415/`
- **최근 deploy**: v0.10 + v0.10.1 (evening). deploy.yml 5잡 success.
- **real Supabase** (`lfrnythcujxdhehvkmtg`): v0.10.1 마이그 3개 적용 완료.
- **dev Supabase** (`eqoywqoalwkwbrdsulfl`): **위 3개 마이그 미적용** ⚠ (release 흐름에서 real 만 적용)

---

## ⚠ 즉시 필요한 운영 액션 (사용자 작업)

### 1. dev DB 마이그 3개 적용

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

### 2. dev Edge Function 재배포

```bash
pnpm functions:deploy:dev
```

### 3. branch protection 갱신 (pgTAP required check 추가)

GitHub Settings → Branches → develop / main → required status checks → **`pgTAP RLS (Supabase local)`** 추가. 안 하면 본 잡 fail PR 도 머지 통과 가능.

### 4. 마이그 immutability 검증 (다음 release 전)

PR #140 의 round 1 fix 가 #20260521000010 의 vault 가드 약화 (`raise exception` → `raise notice + return`). dev / real DB 의 `supabase_migrations.schema_migrations` 의 stored statement 와 develop 파일 hash mismatch 잠재. 다음 release 전 검증:

```bash
pnpm supabase:link:dev   # 또는 :real
supabase db push --linked --dry-run
```

mismatch 시:
- `supabase migration repair --status applied <version>` 으로 재정합
- 또는 영향 minor 면 ignore (cron schedule 동작 영향 없음)

---

## 남은 작업

### 🔴 외부 차단 (사람이 해야 하는 선행 조건 — 변동 없음)

베타 셀러 모집 / 네이버 type=SERVICE 심사 / 쿠팡 Wing IP 정책 확정 / G·옥션 ESM+ 키 발급 / 로젠 B2B 계약 / Resend 도메인 인증.

### 🔴 P0 (qa-matrix 갭 top 3 — #140 후 갱신)

| 항목 | 근거 | 차단 |
|---|---|---|
| ~~RLS-SQL 단위 테스트 부재~~ | ~~qa-matrix §1 갭 1순위~~ | **✅ #140 해소** |
| **partial / retry / skip-market E2E 3종** | `golden-path.md §9` | 셀러 시드 + 어댑터 시뮬레이션 |
| **debug ↔ real parity.spec.ts 5종** | R-006 헌법 위반 잠재 | 마켓별 fixture 매트릭스 |

### 🟠 마켓·로젠 스펙 의존 보류 (외부 차단)

| 항목 | 차단 내용 |
|---|---|
| 골든패스 G1~G10 (9 fixme) | 셀러 시드 + 마켓 OAuth fake / 로젠 fake |
| 11번가 본격 어댑터 (Phase 4-B-2 Wave 2) | 11번가 API spec 미확보 |
| 네이버 어댑터 보강 (Phase 4-B-1) | 외부 spec 의존 |
| v1.4 Phase 2~4 (order-grouping 본격) | 마켓 multi-row 응답 / 로젠 send_list 스펙 |
| ESM endpoint 정확도 (`/api/v1/category` 404) | 실 ESM 문서 기반 path 검증 |

### 🟠 미진입 v1 스코프

| PRD § | 항목 |
|---|---|
| §1.4.3 + §2.3.4 | 알림 도메인 (in-app + 이메일, PR3 트랙) |
| §1.4.2 + §4.4.3 | CSV 내보내기 (papaparse) |
| §2.4.x | 정기 보안 감사 + 백업/복구 |
| §4.2.x / §4.4.2 | 오류 통계 + 차트 (라이브러리 미선정) |
| §5.4.1 | 이미지 WebP + 변형본 |

---

## 후속 정합 백로그 (architecture v1 drift)

1. **deploy.yml `verify-vault-secrets` 잡 추가** — PR #140 의 vault 가드 약화 보완. 운영 vault drift 검증 안전망 복원. main push / workflow_dispatch 시 `supabase_functions_url` / `service_role_key` 존재 검증, 누락 시 deploy fail.
2. **v1.4 `order_groups` 등 신규 테이블 cross-tenant 시나리오 추가** — rls-cross-tenant.sql 보강 (현재 17 엔티티 → +order_groups).
3. **logen_credentials 평문 grep release 잡** — QA-CFG-006 의 release grep 부분 미커버. ci.yml 또는 deploy.yml 에 `grep -rE "user_id|cust_cd" apps/api/supabase` 같은 평문 누출 검출 잡 추가.
4. `design-renewal/s3-register.md` / `s9-settings.md` 갱신 (v0.6 WYSIWYG / 배송 정책 / v1.4 order-grouping 다이어그램).
5. `features/registration.md` §3.6 + `settings-shipping.md` WYSIWYG + 주소 API 반영.
6. §4.4.2 차트 라이브러리 결정.
7. s10 알림 도메인 정의서 (PR3 신설 예정).
8. qa-matrix.md — 신규 기능 PR 진입 시 본 매트릭스의 빈칸 = R-001 / R-009 위반. 행 추가 강제.

---

## 백로그 (v1 이후 / 영구 보류)

- 로젠 외 택배사 (CJ / 한진) — v2
- 마켓 주문 웹훅(push) → 폴링 대체 — v2
- s4 템플릿 관리 / 소셜 로그인 / 2FA — v2
- 멀티유저 권한 — 1인 셀러 모델 유지 시 영구 보류
- 마켓 단건 재시도 / 카테고리 자동 추천 ML — v2
- WebKit·Firefox E2E — v2
- Stripe·PG 연동 / 구독 결제 — v2
- dependabot major bump 재시도 (download-artifact 4→8, setup-cli 1→2, deploy-pages 4→5, react-router-dom 6→7, sonner 1→2, jsdom 25→29, lucide-react 0→1) — release 사이클 외 별도 트랙

---

## 다음 세션 진입

```bash
git fetch origin && git checkout develop && git pull && pnpm install && pnpm test -- --run
```

**877 passed / 26 todo** 확인 후 진입.

### 우선 순위

1. **⚠ 운영 액션 §1+§2 실행** — dev DB 마이그 3개 + Edge Function 재배포. 안 하면 dev 환경 logen / shipping-dispatch / registration-retry / order_groups 본 동작 불가.
2. **⚠ branch protection 갱신** — `pgTAP RLS (Supabase local)` required check 추가 (main / develop). 안 하면 본 잡 fail 도 머지 통과 가능.
3. **deploy.yml verify-vault-secrets 잡 추가 (후속 정합 #1)** — PR #140 의 vault 가드 약화 보완. 마이그 immutability 검증 후 진행.
4. **partial / retry / skip-market E2E 3종 (qa-matrix #2)** — 셀러 시드 가능해진 후 진입.
5. **debug ↔ real parity.spec.ts 5종 (qa-matrix #3)** — R-006 정합 회복.
6. **(보류 해제 시) Phase 4-B-1 네이버 어댑터 본격** — OAuth code + 카테고리 + 상품 등록.
7. **(보류 해제 시) Phase 4-B-2 Wave 2 11번가 본격** — API Key 폼 활성화.
8. **release/v0.11 검토** — develop 누적 변경 (PR #140) + 후속 정합 누적 시 release/* 진행.

### ⚠ Git Flow 룰 강제 (CLAUDE.md §Rules)
- 새 feature/* 브랜치는 **반드시 `develop` 에서 분기**. `main` 금지.
- `Agent isolation: "worktree"` 는 default base 가 main — prompt 에서 `git fetch origin develop && git checkout -B feature/X origin/develop` 강제.

### ⚠ 운영 사고 진단 룰 (CLAUDE.md, PR #108)
- 운영 fail 진단 시 단계별 점검 금지. chain 6단계 (서버 throw / 직렬화 / 클라 parse / 클라 schema / UI 매핑 / DB·인프라) 동시 grep.
- 사용자 재현 5회 이상 요구 = 실패한 진단.
- **CI fail 진단도 동일** — PR #140 의 6 round (chain 진단 1회로 끝낼 수 있었음) 가 반례.

### ⚠ SQL `COMMENT ON ... IS` 룰 (PR #137 사례)
- `COMMENT ON FUNCTION ... IS '...' || '...'` = expression context 거부 (SQLSTATE 42601).
- 다행 string 코멘트는 SQL 표준 string literal 연속 (`'a '` 다음 줄에 `'b '` — newline + whitespace 만 있으면 자동 concat) 사용.

### ⚠ pgTAP CI 잡 게이트 (PR #140)
- 본 잡이 PR 마다 자동 실행 — RLS 정책 / GRANT / 마이그 변경 PR 의 회귀 안전망.
- supabase start 부팅 시간 ~1-2분 (docker pull 캐시 적용 후). 첫 CI run 은 ~3분.
- 신규 RLS 테이블 추가 시 `apps/api/supabase/tests/rls-cross-tenant.sql` 또는 별도 `tests/*.sql` 파일에 cross-tenant 6 시나리오 추가 의무.
- `\set` psql meta-command 금지 (SQLSTATE 42601). SQL 표준 statement 만 사용.
- 마이그 가드의 vault dependency 는 `raise notice + return` 패턴 권장 (CI / dev 환경 통과 + 운영 검증은 별도 잡으로).

### ⚠ qa-matrix 진입 게이트 (PR #132)
- 신규 기능 PR 진입 시 `docs/architecture/v1/qa/qa-matrix.md` 의 해당 행 갱신 필수.
- 미커버 칸 ↑ → R-001 / R-009 위반 잠재.
