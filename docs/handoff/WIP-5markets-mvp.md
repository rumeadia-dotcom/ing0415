# MarketCast — WIP 핸드오프 (2026-05-26 — v0.14 운영 배포 직후)

**develop HEAD**: `46f1120` — chore: main → develop 백머지 (v0.14) (#221)
**main HEAD**: `7ea4fab` — release: v0.14 — hookify 플러그인 활성화 (#220)
**테스트**: 894 passed / 31 todo (92 files, 1 sanitize-parity Deno-import env issue — CI 통과)
**최근 운영 배포**: v0.14 (2026-05-26 01:37 UTC) — deploy.yml 5/5 success
**최근 develop 머지**: PR #221 (백머지 v0.14)

## 2026-05-26 세션 결과 (v0.12 / v0.13 / v0.14 3 릴리즈)

세 번의 운영 배포가 누적된 mock walkthrough cycle + tooling 업데이트.

| Release | 내용 | PR |
|---|---|---|
| **v0.12** | mock walkthrough cycle 16-49 batch (a11y / i18n / UI consistency) | #202 |
| **v0.13** | mock walkthrough cycle 50-61 batch (form a11y + Dialog focus trap + no-console) | #217 |
| **v0.14** | `.claude/settings.json` — hookify 플러그인 활성화 (대화 분석 hook) | #220 |

### v0.14 상세 (방금 배포)

- **변경 영향**: 산출물 코드 변경 0. `.claude/` tooling 만. GitHub Pages 재배포는 형식적.
- **deploy.yml**: Verify Vault / Build real / Pages / Edge Functions / Sentry — 5/5 success (1m40s).
- **백머지**: PR #221 squash, orphan 0건.

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
| **v0.14** | **hookify 플러그인 tooling** | **#220** |

## 운영 현황

- **운영 배포 URL**: `https://rumeadia-dotcom.github.io/ing0415/`
- **최근 deploy run**: `26427360122` (v0.14, 2026-05-26 01:37 UTC, success).
- **real Supabase** (`lfrnythcujxdhehvkmtg`): v0.10.1 마이그 + Vault 2 secret 적용. v0.11~v0.14 에서 마이그 추가 없음.
- **dev Supabase** (`eqoywqoalwkwbrdsulfl`): **v0.10.1 마이그 3개 미적용** ⚠ (이월)

---

## ⚠ 즉시 필요한 운영 액션 (사용자 작업)

### 1. dev DB 마이그 3개 적용 (이월 — 3 릴리즈 누적)
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
```bash
pnpm supabase:link:dev   # 또는 :real
supabase db push --linked --dry-run
```

### 4. 11번가 Open API spec 입수 (단계 2 진입 트리거)
- 11번가 셀러오피스 (seller.11st.co.kr) 또는 OPEN API 센터 (openapi.11st.co.kr) 로그인 → Seller API 발급 양식
- IP 화이트리스트에 Lightsail 고정 IP `43.201.83.78` 등록 → 정식 API Key 발급
- 가이드 문서 / 샘플 XML / 에러 코드 표 캡처 후 사내 vault 저장

---

## 다음 세션 (예약된 작업)

### 1. 11번가 단계 2 본격 구현 (spec 입수 시 트리거)
- 서버 어댑터 `apps/api/supabase/functions/_shared/market-adapters/eleven-st.ts` 4메서드 본체
- 클라이언트 어댑터 `apps/web/src/lib/markets/real/11st/index.ts` 동일 메서드 본체
- CP949 → UTF-8 디코딩 + XML 파싱 (fast-xml-parser)
- 에러 코드 → MarketErrorCode 매핑
- `markets-connect` 의 `skipCategoryPing` 분기 제거
- parity §5 (captured-real fixture) 활성

### 2. P0 qa-matrix 갭 잔여
| 항목 | 차단 |
|---|---|
| **partial / retry / skip-market E2E 3종** | 셀러 시드 + 어댑터 시뮬레이션 |
| **captured-real fixture (parity §5)** | sandbox 마켓 API 접근 |

### 3. 미진입 v1 스코프
| PRD § | 항목 |
|---|---|
| §1.4.3 + §2.3.4 | 알림 도메인 |
| §1.4.2 + §4.4.3 | CSV 내보내기 |
| §2.4.x | 정기 보안 감사 |
| §4.2.x / §4.4.2 | 오류 통계 차트 |
| §5.4.1 | 이미지 WebP |

### 4. sanitize-parity 로컬 테스트 실패 (낮은 우선순위)
- `tests/unit/security/sanitize-parity.test.ts` 가 `npm:isomorphic-dompurify@2.20.0` (Deno-style import) 를 직접 import → Vitest 가 Node 환경에서 resolve 불가.
- CI 는 통과 (다른 환경/제외 룰). 로컬 신뢰성 향상을 위해 vite alias 또는 test exclude 추가 검토.

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

**894 passed / 31 todo** 확인 후 진입 (sanitize-parity 1 file 알려진 환경 이슈).

### 우선 순위
1. **11번가 spec 입수 신호 받음 → 단계 2 진입**.
2. **dev DB 마이그 3개 + Edge Function 재배포** — 3 릴리즈 이월, 더 미루지 말 것.
3. **mock cycle 누적 → release/v0.15** — develop 에 추가 누적 후.
4. (보류 해제 시) partial / retry / skip-market E2E 3종.

---

## 룰 강제 메모 (사고 회수 발 / 관찰된 패턴)

### ⚠ Git Flow 룰 강제 (CLAUDE.md §Rules)
- 새 feature/* 브랜치는 **반드시 `develop` 에서 분기**. `main` 금지.
- Agent isolation: "worktree" default base = main — prompt 에서 `git fetch origin develop && git checkout -B feature/X origin/develop` 강제.

### ⚠ PR strict mode "behind" 패턴 (v0.11 / 11번가 #152 사례)
- ruleset 의 `strict_required_status_checks_policy: true` 가 PR 브랜치에 develop HEAD lineage 포함 강제.
- 동일 시점에 다른 PR 이 develop 에 머지되면 본 PR 이 "behind" 로 분류 — auto-merge 발동 안 함.
- 해소: `mcp__github__update_pull_request_branch` 또는 GitHub UI 의 "Update branch" → CI 재실행.

### ⚠ release PR 충돌 흔한 패턴 (v0.11 사례)
- release/* → main PR 생성 시 `docs/handoff/WIP-*.md` 와 `docs/architecture/v1/qa/qa-matrix.md` 가 자주 충돌.
- 해소: `git checkout --ours <file>` 로 develop 측 (최신) 채택.

### ⚠ ruleset 사고 복원 절차 (`.github/rulesets/README.md`)
- develop branch protection rule 이 또 실수로 날아가면 `.github/rulesets/develop.json` 을 GitHub UI 의 `Settings → Rules → Rulesets → Import a ruleset` 로 1분 복원.

### ⚠ verify-vault-secrets 게이트 (#143, v0.11 부터 작동)
- main 배포 시 운영 vault 의 `supabase_functions_url` / `service_role_key` 존재 자동 검증.
- 미등록 시 deploy 차단.

### ⚠ 11번가 scaffold 상태 (#152, 2026-05-25)
- `authenticate` 만 본 동작. 나머지 5메서드 `adapter_spec_pending` throw.
- `markets-connect` 가 11번가 한해 `category_ping` 스킵 — 자격증명만 저장 후 active 표시.
- spec 입수 후 `skipCategoryPing` 분기 제거 + 메서드 본체 구현 → 본격 활성.

### Claude attribution 금지 (전역 룰)
- 커밋 메시지에 `Co-Authored-By: Claude ...` / `🤖 Generated with Claude Code` 등 절대 포함 X.
