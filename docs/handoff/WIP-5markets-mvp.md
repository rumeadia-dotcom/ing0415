# MarketCast — WIP 핸드오프 (v0.15 운영 배포 완료 — 11번가 v1 정식 + 5마켓 주문 수집)

**develop HEAD**: `99a99dc` — chore: main → develop 백머지 (v0.15) (#235)
**main HEAD**: `b1d0f96` — release: v0.15 — 11번가 v1 정식 활성 + 5마켓 주문 자동 수집 (#234)
**테스트**: 984 passed / 31 todo (95 files / 1 skipped)
**최근 운영 배포**: v0.15 (2026-05-27) — 11번가 real 어댑터 + coupang/gmarket/auction fetchOrders + orders-sync 5마켓
**최근 develop 머지**: PR #235 (v0.15 백머지)

## 2026-05-27 세션 결과 (release v0.15 — 11번가 v1 정식 + 5마켓 주문 수집)

11번가가 v1 정식 5마켓인데 코드·주석·문서가 stub/제외/"v2 예정"으로 drift돼 있던 것을 전수 정합하고, 미구현분을 실구현 후 운영 배포.

| PR | 내용 | 영향 |
|---|---|---|
| #233 | feat(11st) — 11번가 real 어댑터(카테고리/상품등록/주문조회/발송, XML·EUC-KR, 게이트웨이) + coupang/gmarket/auction `fetchOrders` Deno 포팅 + `orders-sync` 5마켓 배선(credential hydrate) + 게이트 해제 + UI/문서 16종 v1 정식 정합 | feature → develop |
| #234 | release/v0.15 → main | deploy.yml 트리거 (GitHub Pages + Edge Functions 재배포). DB 마이그·시크릿 변경 0 |
| #235 | main → develop 백머지 | orphan 가드 PASS, content parity 확인 |

- **순수 매핑 분리**: `eleven-st-map.ts`(Deno) / `real/11st/map.ts`(FE) — npm/Deno specifier 없는 순수 함수로 Vitest 검증(11번가 21건 + parity).
- **naver**: 주문수집 fetchOrders 미구현(Wave 5) → `hasFetchOrders` graceful skip. 11번가는 정상 폴링.
- **잔여 검증 권장**: 11번가 `apiCode`/XML 엘리먼트는 개발자포털 IP 화이트리스트(403)로 미검증 best-effort. `eleven-st-map.ts` 상수 격리 — 셀러 발급 키로 게이트웨이 고정 IP(`43.201.83.78`) 경유 1회 실호출 검증 권장. 마켓별 try/catch 격리로 11번가 실패가 타 마켓 차단 안 함.
- **운영 확인 필요**: deploy.yml 4잡(Build real / Deploy Pages / Deploy Edge Functions / Finalize Sentry) 성공 여부는 Actions 탭에서 확인.

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

### 11번가 v1 real 어댑터 — 본격 구현 완료
CLAUDE.md s5 "v1 정식 = 5 마켓 전부" 결정의 코드 활성화 완료. 11번가 real 어댑터가 **5메서드 (authenticate / fetchCategoryTree / transformProduct / createProduct) + 주문 확장 2메서드 (fetchOrders / submitTracking) 전부 본 동작** — 11번가 Open API (XML, EUC-KR) 를 Lightsail 게이트웨이 경유로 호출.

| 카테고리 | 산출물 |
|---|---|
| **A** | Host 정정 — `api.11st.co.kr` → `openapi.11st.co.kr`. gateway / sign / adapter 5 파일 |
| **B** | `apps/web/src/lib/markets/real/11st/index.ts` — 5메서드 + fetchOrders / submitTracking 본체. XML(EUC-KR) 직렬화·파싱 |
| **C** | `markets/index.ts` wiring — `await import('./real/11st')` |
| **D** | `createMockAdapter` api_key 분기 활성. `ElevenstDebugAdapter` → wrapper 통합 |
| **E** | UI 활성 — `MARKET_CATALOG['11st']` status='ready', authMode='api_key'. `ApiKeyForm`. `markets-feature.ts` zod 확장. `markets-connect` Edge Function 5마켓 통합 (다른 4 마켓과 동일하게 `category_ping` 검증) |
| **F** | `tests/unit/adapters/11st/parity.spec.ts` — §1/§2/§4 활성, §3 mock/real 분리 |
| **G** | `markets.md` drift 정합 — §3 / §3.2 / §5 / §7.2 정합 |

> **잔여 검증 권장**: 정확한 `apiCode` / 요청·응답 XML 엘리먼트명은 셀러 발급 API Key 의 실호출로 최종 검증 권장 (11번가 개발자포털이 IP 화이트리스트 등록 후에야 정식 문서·apiCode 노출). 게이트웨이 고정 IP `43.201.83.78` 등록 후 발급 키로 1회 실호출 검증.

### 11번가 Open API 정보 수집 결과

| 항목 | 상태 | 출처 |
|---|---|---|
| 공식 포털 | `http://openapi.11st.co.kr/openapi/OpenApiFrontMain.tmall` | 다수 ref |
| API endpoint base | `https://openapi.11st.co.kr/openapi/OpenApiService.tmall` | 공식 + 블로그 |
| 호출 형식 | `?key=<API_KEY>&apiCode=<CODE>&<params>` 또는 `openapikey` 헤더 | 블로그 |
| 응답 format | XML (CP949 인코딩) | 공식 |
| 인증 모델 | 영구 API Key (refresh 없음) | 공식 |
| IP 화이트리스트 | 셀러가 사전 등록 후 키 발급 — Lightsail `43.201.83.78` 등록 | 다수 ref |
| Seller API apiCode 이름 | 구현 반영됨 — 발급 키 실호출로 최종 검증 권장 (개발자포털 IP 화이트리스트) | 어댑터 |
| 요청·응답 XML schema | 구현 반영됨 — 발급 키 실호출로 엘리먼트명 최종 검증 권장 | 어댑터 |

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

### 4. 11번가 발급 키 실호출 최종 검증 (어댑터는 본격 구현 완료)
- 11번가 셀러오피스 (seller.11st.co.kr) 또는 OPEN API 센터 (openapi.11st.co.kr) 로그인 → Seller API 발급 양식
- IP 화이트리스트에 Lightsail 고정 IP `43.201.83.78` 등록 → 정식 API Key 발급
- 발급 키로 1회 실호출 → 어댑터의 `apiCode` / 요청·응답 XML 엘리먼트명 최종 검증 (불일치 시 어댑터 미세 보정)
- 사내 vault 에 저장 후 사용자 신호

---

## 다음 세션 (예약된 작업)

### 1. 11번가 실호출 검증 후 미세 보정 (어댑터 본체는 구현 완료)
- 서버 어댑터 `apps/api/supabase/functions/_shared/market-adapters/eleven-st.ts` — 5메서드 + fetchOrders / submitTracking 본체 구현 완료
- 클라이언트 어댑터 `apps/web/src/lib/markets/real/11st/index.ts` — 동일 메서드 본체 구현 완료
- EUC-KR ↔ UTF-8 디코딩 + XML 파싱 구현 반영됨
- 발급 키 실호출로 `apiCode` / XML 엘리먼트명 / 에러 코드 매핑 최종 검증 후 필요 시 보정
- parity §5 (captured-real fixture) 활성 — sandbox/실키 응답 캡처 시

### 2. release/v0.12 검토 (사용자 결정 2026-05-25: develop 까지만 — 보류)
develop 누적: #152 (11번가 real 어댑터). 변경 양 작아 추가 누적 (알림 / CSV / 이미지 WebP 등) 후 묶음 release.

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
1. **11번가 발급 키 실호출 → apiCode / XML 엘리먼트 최종 검증** (어댑터는 본격 구현 완료).
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

### ⚠ 11번가 real 어댑터 상태 (본격 구현 완료)
- 5메서드 (authenticate / fetchCategoryTree / transformProduct / createProduct) + fetchOrders / submitTracking 전부 본 동작 — 11번가 Open API (XML, EUC-KR) 게이트웨이 경유.
- `markets-connect` 는 다른 4 마켓과 동일하게 `category_ping` 으로 자격증명 검증 후 active 표시.
- 잔여: 발급 키 실호출로 `apiCode` / 요청·응답 XML 엘리먼트명 최종 검증 (개발자포털 IP 화이트리스트 등록 후) → 불일치 시 어댑터 미세 보정.
