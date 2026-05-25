# MarketCast — WIP 핸드오프 (2026-05-25 — 11번가 scaffold 머지 직후)

**develop HEAD**: `03fd791` — feat(11st): real 어댑터 scaffold + UI 활성 + Edge Function 5마켓 통합 (#152)
**main HEAD**: `5afdc7b` — release: v0.11 운영 안전망 3종 (#149)
**테스트**: 910 passed / 31 todo (91 files / 1 skipped)
**최근 운영 배포**: v0.11 (2026-05-25)
**최근 develop 머지**: PR #152 (11번가 scaffold)

## 2026-05-25 세션 결과 (release v0.11 + 11번가 scaffold)

### 2026-05-25 전반 (release/v0.11)
5 PR 묶음으로 운영 안전망 3종 출시. FE/BE 코드 변경 0, DB 마이그 변경 0 — 순수 CI / 테스트 / 운영 안전망 강화 release.

| PR | 내용 | 영향 |
|---|---|---|
| #142 | ruleset 백업 JSON | 사고 복원용. approval=0 (1인 셀러 모델) |
| #143 | deploy.yml `verify-vault-secrets` 잡 | **v0.11 부터 자동 게이트** — vault drift 차단 |
| #147 | parity.spec.ts 5종 | qa-matrix #3 부분 해소 |
| #148 | WIP 갱신 | — |
| #149 | release/v0.11 → main | deploy.yml 5잡 success |
| #150 | main → develop 백머지 | orphan 가드 PASS |
| #151 | WIP 갱신 (v0.11 후) | — |

### 2026-05-25 후반 (11번가 v1 scaffold — #152)
CLAUDE.md s5 "v1 정식 = 5 마켓 전부" 결정의 코드 활성화. **단계 1 (A~G) 완료**, 단계 2 (transformProduct / createProduct / fetchCategoryTree 본체) 는 11번가 Open API spec 미확보로 보류.

| 카테고리 | 산출물 |
|---|---|
| **A** | Host 정정 — `api.11st.co.kr` → `openapi.11st.co.kr`. gateway / sign / adapter 5 파일 |
| **B** | `apps/web/src/lib/markets/real/11st/index.ts` 신규 — authenticate 동작, 나머지 5메서드 `MarketError(unknown, 'adapter_spec_pending')` throw |
| **C** | `markets/index.ts` wiring — `case '11st': throw` → `await import('./real/11st')` |
| **D** | `createMockAdapter` api_key 분기 활성. `ElevenstDebugAdapter` → wrapper 통합 |
| **E** | UI 활성 — `MARKET_CATALOG['11st']` status='ready', authMode='api_key'. `ApiKeyForm` 신규. `markets-feature.ts` zod 확장. `markets-connect` Edge Function 5마켓 통합 + 11번가 한해 `category_ping` 스킵 |
| **F** | `tests/unit/adapters/11st/parity.spec.ts` 재작성 — §1/§2/§4 활성, §3 mock/real 분리 |
| **G** | `markets.md` drift 정합 — §3 / §3.2 / §5 / §7.2 옛 문구 제거 |

### 11번가 Open API 정보 수집 결과

| 항목 | 상태 | 출처 |
|---|---|---|
| 공식 포털 | `http://openapi.11st.co.kr/openapi/OpenApiFrontMain.tmall` | 다수 ref |
| API endpoint base | `https://openapi.11st.co.kr/openapi/OpenApiService.tmall` | 공식 + 블로그 |
| 호출 형식 | `?key=<API_KEY>&apiCode=<CODE>&<params>` 또는 `openapikey` 헤더 | 블로그 |
| 응답 format | XML (CP949 인코딩) | 공식 |
| 인증 모델 | 영구 API Key (refresh 없음) | 공식 |
| IP 화이트리스트 | 셀러가 사전 등록 후 키 발급 — Lightsail `43.201.83.78` 등록 | 다수 ref |
| Seller API apiCode 이름 | **미확보** — 공식 문서 IP 화이트리스트로 403 | — |
| 요청·응답 XML schema | **미확보** | — |

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
| 2026-05-25 전반 | **release v0.11** 운영 안전망 3종 | #142~#151 |
| **2026-05-25 후반** | **11번가 v1 scaffold (단계 1 A~G)** | **#152** |

## 운영 현황

- **운영 배포 URL**: `https://rumeadia-dotcom.github.io/ing0415/`
- **최근 deploy**: v0.11 (2026-05-25). deploy.yml 5잡 success.
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
```bash
pnpm supabase:link:dev   # 또는 :real
supabase db push --linked --dry-run
```

### 4. 11번가 Open API spec 입수 (단계 2 진입 트리거)
- 11번가 셀러오피스 (seller.11st.co.kr) 또는 OPEN API 센터 (openapi.11st.co.kr) 로그인 → Seller API 발급 양식
- IP 화이트리스트에 Lightsail 고정 IP `43.201.83.78` 등록 → 정식 API Key 발급
- 발급 시점에 받는 가이드 문서 / 샘플 XML / 에러 코드 표 캡처
- 사내 vault 에 저장 후 사용자 신호

---

## 다음 세션 (예약된 작업)

### 1. 11번가 단계 2 본격 구현 (spec 입수 시 트리거)
- 서버 어댑터 `apps/api/supabase/functions/_shared/market-adapters/eleven-st.ts` 4메서드 본체 (fetchCategoryTree / transformProduct / createProduct / + v2 fetchOrders·submitTracking)
- 클라이언트 어댑터 `apps/web/src/lib/markets/real/11st/index.ts` 동일 메서드 본체
- CP949 → UTF-8 디코딩 + XML 파싱 (DOMParser 또는 fast-xml-parser)
- 에러 코드 → MarketErrorCode 매핑
- `markets-connect` 의 `skipCategoryPing` 분기 제거
- parity §5 (captured-real fixture) 활성

### 2. release/v0.12 검토 (사용자 결정 2026-05-25: develop 까지만 — 보류)
develop 누적: #152 (11번가 scaffold). 변경 양 작아 추가 누적 (알림 / CSV / 이미지 WebP / 11번가 단계 2 등) 후 묶음 release.

### 3. P0 qa-matrix 갭 잔여
| 항목 | 차단 |
|---|---|
| **partial / retry / skip-market E2E 3종** | 셀러 시드 + 어댑터 시뮬레이션 |
| **captured-real fixture (parity §5)** | sandbox 마켓 API 접근 |

### 4. 미진입 v1 스코프
| PRD § | 항목 |
|---|---|
| §1.4.3 + §2.3.4 | 알림 도메인 |
| §1.4.2 + §4.4.3 | CSV 내보내기 |
| §2.4.x | 정기 보안 감사 |
| §4.2.x / §4.4.2 | 오류 통계 차트 |
| §5.4.1 | 이미지 WebP |

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
git pull origin develop && pnpm install && pnpm test -- --run
```

**910 passed / 31 todo** 확인 후 진입.

### 우선 순위
1. **11번가 spec 입수 신호 받음 → 단계 2 진입**.
2. **dev DB 마이그 3개 + Edge Function 재배포** — 이월.
3. **release/v0.12 검토** — develop 에 더 누적된 후 (사용자 결정).
4. (보류 해제 시) partial / retry / skip-market E2E 3종.

### ⚠ Git Flow 룰 강제 (CLAUDE.md §Rules)
- 새 feature/* 브랜치는 **반드시 `develop` 에서 분기**. `main` 금지.
- Agent isolation: "worktree" default base = main — prompt 에서 `git fetch origin develop && git checkout -B feature/X origin/develop` 강제.

### ⚠ PR strict mode "behind" 패턴 (v0.11 / 11번가 #152 사례)
- ruleset 의 `strict_required_status_checks_policy: true` 가 PR 브랜치에 develop HEAD lineage 포함 강제.
- 동일 시점에 다른 PR 이 develop 에 머지되면 본 PR 이 "behind" 로 분류 — auto-merge 발동 안 함 → 머지 안 됨 → webhook 이벤트 미발생.
- 해소: `mcp__github__update_pull_request_branch` 또는 GitHub UI 의 "Update branch" 버튼 → CI 재실행 → strict 충족 → auto-merge 발동.

### ⚠ release PR 충돌 흔한 패턴 (v0.11 사례)
- release/* → main PR 생성 시 `docs/handoff/WIP-*.md` 와 `docs/architecture/v1/qa/qa-matrix.md` 가 자주 충돌.
- 해소: `git checkout --ours <file>` 로 develop 측 (최신) 채택.

### ⚠ ruleset 사고 복원 절차 (`.github/rulesets/README.md`)
- develop branch protection rule 이 또 실수로 날아가면 `.github/rulesets/develop.json` 을 GitHub UI 의 `Settings → Rules → Rulesets → Import a ruleset` 로 1분 복원.

### ⚠ verify-vault-secrets 게이트 (#143, v0.11 부터 작동)
- main 배포 시 운영 vault 의 `supabase_functions_url` / `service_role_key` 존재 자동 검증.
- 미등록 시 deploy 차단. release 전 사용자가 Supabase dashboard → Vault 등록 상태 확인 필수.

### ⚠ 11번가 scaffold 상태 (#152, 2026-05-25)
- `authenticate` 만 본 동작. 나머지 5메서드 `adapter_spec_pending` throw.
- `markets-connect` 가 11번가 한해 `category_ping` 스킵 — 자격증명만 저장 후 active 표시.
- spec 입수 후 `skipCategoryPing` 분기 제거 + 메서드 본체 구현 → 본격 활성.
