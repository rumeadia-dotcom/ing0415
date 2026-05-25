# MarketCast — WIP 핸드오프 (2026-05-25 v0.11 배포 직후)

**develop HEAD**: `0213416` — chore: main → develop 백머지 (v0.11) (#150)
**main HEAD**: `5afdc7b` — release: v0.11 운영 안전망 3종 (#149)
**테스트**: 904 passed / 31 todo (91 files / 1 skipped)
**최근 운영 배포**: **v0.11 (2026-05-25 완료)** + v0.10 + v0.10.1
**최근 develop 머지**: PR #150 (v0.11 백머지)

## 2026-05-25 세션 결과 (release/v0.11 운영 배포 완료)

5 PR 묶음으로 운영 안전망 3종 출시. FE/BE 코드 변경 0, DB 마이그 변경 0 — 순수 CI / 테스트 / 운영 안전망 강화 release.

| PR | 내용 | 영향 |
|---|---|---|
| #142 | ruleset 백업 JSON | 사고 복원용 (`Settings → Rules → Import`). approval=0 (1인 셀러 모델 정합) |
| #143 | deploy.yml `verify-vault-secrets` 잡 | **v0.11 배포부터 자동 게이트 작동** — vault drift 차단 |
| #147 | parity.spec.ts 5종 (naver/coupang/gmarket/auction/11st) | qa-matrix #3 부분 해소 (외피 4구간 활성, §5 fixture parity 보류) |
| #148 | WIP 갱신 (운영 안전망 + 11번가 v1 예약) | 본 PR 의 직전 상태 |
| #149 | release/v0.11 → main 머지 | deploy.yml 5잡 전부 success |
| #150 | main → develop 백머지 | orphan 가드 점검 (없음) |

### release/v0.11 운영 검증 결과
- **deploy.yml** 5잡 PASS: build-real / verify-vault-secrets / deploy-pages / deploy-edge-functions / notify-sentry
- **verify-vault-secrets 첫 실전 실행**: real Vault 의 `supabase_functions_url` + `service_role_key` 등록 확인 → PASS
- **Sentry release v0.11** finalize 완료

## 스택 한눈에

```
프론트:  React 18 + Vite + TS strict + shadcn + Tailwind + TanStack Query + RHF + zod
         + Tiptap (WYSIWYG) + Daum Postcode SDK + DOMPurify (client) + isomorphic-dompurify (server)
백엔드:  Supabase (Postgres + RLS + Auth + Storage + Realtime + Edge Functions Deno + pg_cron + Vault)
         + AWS Lightsail Market Gateway (서울, 43.201.83.78, HMAC + 호스트 화이트리스트)
호스팅:  GitHub Pages (정적 SPA + 404.html fallback) + Supabase Cloud
모니터링: Sentry (PII 마스킹 강제 — redact.ts / masking.ts 양쪽 동기)
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
| Stage A~H | 부트스트랩 (빌드·디자인·라우팅·데이터·DB·EdgeFn·테스트·CI) | — |
| B-1~B-5 | 인증·대시보드·상품등록·마켓계정·이력 본구현 + 브랜드 리스킨 | — |
| C-1~C-4 | 4마켓 OAuth/HMAC/ESM real 어댑터 + fan-out 통합 12종 mock | — |
| D-A~D-D | axe E2E / pgTAP RLS / 법적 페이지 / Sentry 마스킹 | — |
| v0.4~v0.6 | 주문·배송 자동화 / env 플래그 분리 / WYSIWYG + 발송지 API + 배송 정책 | 운영 배포 |
| v0.8~v0.9 | Market Gateway Phase 1~2 + Phase 4-A (쿠팡·ESM 게이트웨이) | 운영 배포 |
| 2026-05-22 | 5마켓 v1 정식 결정 (IP 화이트리스트 5마켓 공통) | 결정 |
| 2026-05-23 | hotfix v0.9.1~v0.9.9 + audit 9 PR + release v0.10 + hotfix v0.10.1 + pgTAP CI | #98~#140 |
| **2026-05-25** | **release v0.11 — 운영 안전망 3종 (ruleset / verify-vault / parity)** | **#142~#150** |

## 운영 현황

- **운영 배포 URL**: `https://rumeadia-dotcom.github.io/ing0415/`
- **최근 deploy**: v0.11 (2026-05-25 05:14 commit, deploy.yml 5잡 success).
- **real Supabase** (`lfrnythcujxdhehvkmtg`): v0.10.1 마이그 3개 + Vault 두 secret 등록 완료.
- **dev Supabase** (`eqoywqoalwkwbrdsulfl`): **v0.10.1 마이그 3개 미적용** ⚠

---

## ⚠ 즉시 필요한 운영 액션 (사용자 작업)

### 1. dev DB 마이그 3개 적용 (이월)
```bash
pnpm supabase:link:dev
pnpm db:push:dev
```
대상:
- `20260523000003_order_groups.sql`
- `20260524000001_rpc_fn_prefix_fix.sql`
- `20260524000002_registration_job_state_machine.sql`

### 2. dev Edge Function 재배포 (이월)
```bash
pnpm functions:deploy:dev
```

### 3. 마이그 immutability 검증 (다음 release 전)
PR #140 round 1 의 vault 가드 약화로 dev / real `supabase_migrations.schema_migrations` stored statement 와 develop 파일 hash mismatch 잠재.
```bash
pnpm supabase:link:dev   # 또는 :real
supabase db push --linked --dry-run
```
mismatch 시: `supabase migration repair --status applied <version>`.

---

## 다음 세션 (예약된 작업)

### 1. 11번가 본격 구현 (외부 차단 해제 후)
2026-05-22 5마켓 v1 정식 결정 이후 11번가만 stub 상태 잔존. **사용자 결정 (2026-05-25): Open API spec 입수 후 작업 시작.**

진입 시 작업 범위:
- 11번가 Open API 공식 문서 + 정식 발급 API Key 확보 (외부)
- 서버 측 `apps/api/supabase/functions/_shared/market-adapters/eleven-st.ts` 4메서드 본체 구현
- 클라이언트 측 `apps/web/src/lib/markets/real/11st/index.ts` 신규 작성
- `markets/index.ts:77-83` 의 throw 분기를 `await import('./real/11st')` 로 교체
- `ElevenstDebugAdapter` 를 `createMockAdapter('11st')` 분기로 교체
- parity §1~§4 활성화 (`tests/unit/adapters/11st/parity.spec.ts` 재작성)
- `markets.md` drift 정합 (§3.1 "v1 = 네이버 1개" / §3.2 "v2 예정" 잔존 문구 제거)
- markets-connect UI 의 11번가 disabled 해제

### 2. P0 qa-matrix 갭 잔여
| 항목 | 근거 | 차단 |
|---|---|---|
| ~~RLS-SQL pgTAP~~ | qa-matrix §1 | ✅ #140 해소 |
| ~~parity.spec.ts 5종 외피~~ | qa-matrix #3 | ✅ #147 부분 해소 |
| **partial / retry / skip-market E2E 3종** | golden-path.md §9 | 셀러 시드 + 어댑터 시뮬레이션 |
| **captured-real fixture (parity §5)** | testing.md §12 | sandbox 마켓 API 접근 |

### 3. 미진입 v1 스코프
| PRD § | 항목 |
|---|---|
| §1.4.3 + §2.3.4 | 알림 도메인 (in-app + 이메일, PR3 트랙) |
| §1.4.2 + §4.4.3 | CSV 내보내기 (papaparse) |
| §2.4.x | 정기 보안 감사 + 백업/복구 |
| §4.2.x / §4.4.2 | 오류 통계 + 차트 (라이브러리 미선정) |
| §5.4.1 | 이미지 WebP + 변형본 |

### 4. release/v0.12 후보
develop 누적 변경이 다시 모이면 release. v0.11 후 누적 0.

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
1. **11번가 본격 구현** — 사용자가 Open API spec 입수 시 트리거. 위 §1 작업 범위 참조.
2. **dev DB 마이그 3개 + Edge Function 재배포** (운영 액션 §1+§2) — 이월된 dev 환경 동기화.
3. **partial / retry / skip-market E2E 3종** — 셀러 시드 가능해진 후. qa-matrix #2.
4. (보류 해제 시) captured-real fixture 캡처 → parity §5 it.todo 5건 해소.

### ⚠ Git Flow 룰 강제 (CLAUDE.md §Rules)
- 새 feature/* 브랜치는 **반드시 `develop` 에서 분기**. `main` 금지.
- Agent isolation: "worktree" default base = main — prompt 에서 `git fetch origin develop && git checkout -B feature/X origin/develop` 강제.

### ⚠ 운영 사고 진단 룰 (CLAUDE.md §운영 사고 진단)
- chain 6단계 (서버 throw / 직렬화 / 클라 parse / 클라 schema / UI 매핑 / DB·인프라) 동시 grep.
- 사용자 재현 5회 이상 요구 = 실패한 진단.

### ⚠ ruleset 사고 복원 절차 (`.github/rulesets/README.md`)
- develop branch protection rule 이 또 실수로 날아가면 `.github/rulesets/develop.json` 을 GitHub UI 의 `Settings → Rules → Rulesets → Import a ruleset` 로 1분 복원.
- CI 잡 (`name:`) 추가/이름 변경 시 본 JSON 의 `required_status_checks` 동기 갱신 필수.

### ⚠ verify-vault-secrets 게이트 (#143, v0.11 부터 작동)
- main 배포 시 운영 vault 의 `supabase_functions_url` / `service_role_key` 존재 자동 검증.
- 미등록 시 deploy 차단. release 전 사용자가 Supabase dashboard → Vault 등록 상태 확인 필수.

### ⚠ release PR 충돌 흔한 패턴 (v0.11 사례)
- release/* → main PR 생성 시 `docs/handoff/WIP-*.md` 와 `docs/architecture/v1/qa/qa-matrix.md` 가 자주 충돌 (양쪽 squash merge 후 lineage 분리).
- 해소: `git checkout --ours <file>` 로 develop 측 (최신) 채택. release 본문은 항상 develop 시점이 ground truth.
