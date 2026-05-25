# MarketCast — WIP 핸드오프 (2026-05-25)

**develop HEAD**: `c943367` — test(adapters): debug ↔ real parity.spec.ts 5종 — qa-matrix #3 부분 해소 (#147)
**main HEAD**: `b821cf8` — hotfix/v0.10.1 — registration_job_state_machine COMMENT SQL syntax fix (#137)
**테스트**: 904 passed / 31 todo (91 files / 1 skipped)
**최근 운영 배포**: v0.10 + v0.10.1
**최근 develop 머지**: PR #147 (parity.spec.ts 5종)

## 2026-05-25 세션 요약 (운영 안전망 + parity 회복)

PR #140 의 후속 정합 #1 (deploy-time vault drift 검증) + ruleset 사고 복원 + qa-matrix #3 parity 갭 부분 해소까지 진행. **운영 코드 변경 0** — 순수 CI / 테스트 / 운영 안전망 강화.

| PR | 내용 | 비고 |
|---|---|---|
| #142 | **chore(ops): develop branch ruleset 백업 JSON** | 사고 복원용. import 1회로 8 status check 일괄 복원. approval=0 (1인 셀러 모델) |
| #143 | **ci(deploy): verify-vault-secrets 잡 추가** | Management API SQL endpoint 로 `vault.decrypted_secrets` count 확인. service_role 키 CI secret 미저장 유지 |
| #147 | **test(adapters): parity.spec.ts 5종** | 5 마켓 (naver/coupang/gmarket/auction/11st) static·interface·transformProduct 외피·mock schema 정합 27건. captured-real fixture §5 는 it.todo 5건 |

### ruleset 사고·복원 메모
- develop branch protection rule 이 실수로 전체 삭제됨
- `.github/rulesets/develop.json` 작성 → GitHub UI `Settings → Rules → Rulesets → Import` 로 1분 복원
- `bypass_actors: []` (admin 우회 금지), `squash-only`, 8 status checks, approval=0
- 동일 사고 재발 시 본 JSON 으로 즉시 재import

### verify-vault-secrets 메커니즘
- `build-real` 와 병렬 잡. `deploy-pages` / `deploy-edge-functions` 가 본 잡도 needs
- SQL `count(*) filter (where name = '<key>')` — value 노출 0
- 누락 시 deploy 차단 + Vault 등록 안내

### parity.spec.ts 활성 구간 (4)
- §1 Static — market / credentialKind mock = real
- §2 Interface — 7 메서드 (refreshToken 옵셔널) 모두 존재
- §3 transformProduct 외피 — `{ market, raw }` / MarketPayloadSchema 통과
- §4 Mock schema — authenticate / createProduct / fetchCategoryTree 결과 zod 통과
- §5 (captured-real fixture parity) 는 it.todo — sandbox 접근 후 활성

## 스택 한눈에

```
프론트:  React 18 + Vite + TS strict + shadcn + Tailwind + TanStack Query + RHF + zod
         + Tiptap (WYSIWYG) + Daum Postcode SDK + DOMPurify (client) + isomorphic-dompurify (server)
백엔드:  Supabase (Postgres + RLS + Auth + Storage + Realtime + Edge Functions Deno + pg_cron + Vault)
         + AWS Lightsail Market Gateway (서울, 43.201.83.78, HMAC + 호스트 화이트리스트)
호스팅:  GitHub Pages (정적 SPA + 404.html fallback) + Supabase Cloud
모니터링: Sentry (PII 마스킹 강제 — redact.ts / masking.ts 양쪽 동기)
CI/CD:   GitHub Actions (PR 8잡 + main 분리, auto-merge 활성, pgtap-rls + verify-vault-secrets)
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
| 2026-05-23 | hotfix v0.9.1~v0.9.9 + audit 9 PR + release v0.10 + hotfix v0.10.1 + pgTAP CI 통합 | #98~#140 |
| **2026-05-25** | **ruleset 백업 + verify-vault-secrets + parity 5종** | **#142 / #143 / #147** |

## 운영 현황

- **운영 배포 URL**: `https://rumeadia-dotcom.github.io/ing0415/`
- **최근 deploy**: v0.10 + v0.10.1 (2026-05-23 evening). deploy.yml 5잡 success.
- **real Supabase** (`lfrnythcujxdhehvkmtg`): v0.10.1 마이그 3개 적용 완료.
- **dev Supabase** (`eqoywqoalwkwbrdsulfl`): **v0.10.1 마이그 3개 미적용** ⚠

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
- `20260524000002_registration_job_state_machine.sql`

### 2. dev Edge Function 재배포
```bash
pnpm functions:deploy:dev
```

### 3. real Supabase Vault 시크릿 등록 확인 (release 전 필수)
`supabase_functions_url` / `service_role_key` 가 real Supabase 대시보드 → Project Settings → Vault 에 등록되어 있어야 함. **#143 의 verify-vault-secrets 가 main 으로 가면 (next release) 미등록 시 deploy 차단.**

확인 방법: Supabase dashboard → Vault. 또는 release 전 `workflow_dispatch` (`deploy_edge_functions=false`, `apply_db_migrations=false`) 로 verify-vault-secrets 잡만 단독 dry-run (단 본 잡이 main 에 있어야 함 — chicken-and-egg, release 시점에 첫 검증).

### 4. 마이그 immutability 검증 (다음 release 전)
PR #140 round 1 의 vault 가드 약화로 dev / real `supabase_migrations.schema_migrations` stored statement 와 develop 파일 hash mismatch 잠재.
```bash
pnpm supabase:link:dev   # 또는 :real
supabase db push --linked --dry-run
```
mismatch 시: `supabase migration repair --status applied <version>`.

---

## 다음 세션 (예약된 작업)

### 1. 11번가 v1 정식 진입 — 별도 spec 분리 원인 분석 후 통합
사용자 결정 (2026-05-25): **11번가도 v1 정식 포함**. 현재 11st 가 다른 4마켓과 다르게 stub 상태로 남아있는 이유 분석 + 본격 구현 진입.

배경:
- 현재 11st = mock (`ElevenstDebugAdapter` 6 메서드 throw) + real stub (markets/index.ts case '11st' throw)
- 본격 구현 = createMockAdapter 분기 활성화 + real adapter 작성 + parity §1~§4 활성화

진입 시 점검:
- 초기 설계 당시 11st 가 별도였던 이유 (API spec 미확보 / IP 화이트리스트 정책 등)
- 2026-05-22 5마켓 정식 결정 이후 status 갱신 위치 (CLAUDE.md / market-adapter.md / markets-feature.md 등)
- 셀러 onboarding 절차 (11번가 셀러오피스 API Key 발급 + 고정 IP 화이트리스트)

### 2. release/v0.11 (11번가 통합 + 안전망 묶음)
develop 누적: #140 (pgTAP CI) + #142 (ruleset) + #143 (verify-vault) + #147 (parity 5종). 11번가 본격 작업 완료 후 묶어서 release.

release 전 게이트:
- 위 §3 운영 액션 (vault 등록 확인)
- 위 §4 마이그 immutability 검증
- 11번가 본격 작업의 develop 머지 완료

### 3. P0 qa-matrix 갭 잔여
| 항목 | 근거 | 차단 |
|---|---|---|
| ~~RLS-SQL pgTAP~~ | qa-matrix §1 | ✅ #140 해소 |
| ~~parity.spec.ts 5종~~ | qa-matrix #3 | ✅ #147 부분 해소 (§5 외부 차단) |
| **partial / retry / skip-market E2E 3종** | golden-path.md §9 | 셀러 시드 + 어댑터 시뮬레이션 |
| **captured-real fixture (parity §5)** | testing.md §12 | sandbox 마켓 API 접근 |

### 4. 미진입 v1 스코프
| PRD § | 항목 |
|---|---|
| §1.4.3 + §2.3.4 | 알림 도메인 (in-app + 이메일, PR3 트랙) |
| §1.4.2 + §4.4.3 | CSV 내보내기 (papaparse) |
| §2.4.x | 정기 보안 감사 + 백업/복구 |
| §4.2.x / §4.4.2 | 오류 통계 + 차트 (라이브러리 미선정) |
| §5.4.1 | 이미지 WebP + 변형본 |

---

## 백로그 (v1 이후 / 영구 보류)

- 로젠 외 택배사 (CJ / 한진) — v2
- 마켓 주문 웹훅(push) → 폴링 대체 — v2
- s4 템플릿 관리 / 소셜 로그인 / 2FA — v2
- 멀티유저 권한 — 1인 셀러 모델 유지 시 영구 보류
- 마켓 단건 재시도 / 카테고리 자동 추천 ML — v2
- WebKit·Firefox E2E — v2
- Stripe·PG 연동 / 구독 결제 — v2
- dependabot major bump 재시도 — release 사이클 외 별도 트랙

---

## 다음 세션 진입

```bash
git pull origin develop && pnpm install && pnpm test -- --run
```

**904 passed / 31 todo** 확인 후 진입.

### 우선 순위
1. **11번가 별도 stub 원인 분석** — 현 코드의 11st 가 다른 4마켓과 다른 형태로 남아있는 이유 (`markets/index.ts:77-83` + `ElevenstDebugAdapter.ts` 주석 + `cross-cutting/market-adapter.md`). 초기 설계 의도 (API spec 미확보 / IP 화이트리스트) 와 2026-05-22 5마켓 정식 결정 사이의 drift 파악.
2. **11번가 본격 구현** — createMockAdapter 분기 활성화 + real 어댑터 작성. 셀러 onboarding (API Key 발급 + Lightsail 고정 IP 화이트리스트) 절차 문서화. parity §1~§4 활성화.
3. **release/v0.11 묶음 배포** — 11번가 본격 작업 + #140 / #142 / #143 / #147 누적 release. **사전 vault 등록 확인 필수.**
4. (보류 해제 시) partial / retry / skip-market E2E 3종.

### ⚠ Git Flow 룰 강제 (CLAUDE.md §Rules)
- 새 feature/* 브랜치는 **반드시 `develop` 에서 분기**. `main` 금지.
- Agent isolation: "worktree" default base = main — prompt 에서 `git fetch origin develop && git checkout -B feature/X origin/develop` 강제.

### ⚠ 운영 사고 진단 룰 (CLAUDE.md §운영 사고 진단)
- chain 6단계 (서버 throw / 직렬화 / 클라 parse / 클라 schema / UI 매핑 / DB·인프라) 동시 grep.
- 사용자 재현 5회 이상 요구 = 실패한 진단.

### ⚠ ruleset 사고 복원 절차 (`.github/rulesets/README.md`)
- develop branch protection rule 이 또 실수로 날아가면 `.github/rulesets/develop.json` 을 GitHub UI 의 `Settings → Rules → Rulesets → Import a ruleset` 로 1분 복원.
- CI 잡 (`name:`) 추가/이름 변경 시 본 JSON 의 `required_status_checks` 동기 갱신 필수.

### ⚠ verify-vault-secrets 게이트 (PR #143)
- next release 부터 main 배포 시 운영 vault 의 `supabase_functions_url` / `service_role_key` 존재 자동 검증.
- 미등록 시 deploy 차단. **release 전 사용자가 Supabase dashboard → Vault 에서 두 secret 등록 상태 확인 필수.**
