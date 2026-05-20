# 프로젝트 전체 요약

**MarketCast** — 다중 마켓 상품 자동 등록 SaaS. 셀러가 상품 정보를 한 번 입력하면 5개 마켓(네이버·쿠팡·G마켓·옥션·11번가)에 동시 등록.

## 스택 한눈에

```
프론트:  React 18 + Vite + TS strict + shadcn + Tailwind + TanStack Query + RHF + zod
백엔드:  Supabase (Postgres + RLS + Auth + Storage + Realtime + Edge Functions)
호스팅:  GitHub Pages (정적 SPA + 404.html fallback) + Supabase Cloud
모니터링: Sentry (PII 마스킹 강제)
CI/CD:   GitHub Actions (PR + main 분리)
브랜치:  Git Flow (main / develop / release/* / feature/* / hotfix/*)
빌드 모드: debug (mock 어댑터) / real (운영 API). Supabase 프로젝트도 분리
레포 구조: apps/web (Vite root) + apps/api (Supabase workdir) 모노레포
```

## 도메인 모델 (6대 엔티티)

```
Seller (auth.users) ─┬─ MarketAccount ─── MarketCredential (jsonb + pgcrypto)
                     │
                     ├─ Product ─┬─ ProductImage ─ ImageTransform (마켓별 N)
                     │           └─ ProductMarketMapping (카테고리/규격)
                     │
                     └─ RegistrationJob ─┬─ JobMarketResult (1:N, 5상태)
                                         │  status: pending/in_flight/success/failed/failed_final
                                         └─ 잡 상위 상태: 7전이
                                            pending → running → partial|succeeded|failed|retrying|cancelled
```

## Bootstrap Phase 완료

```
Stage A → B → C → D → E → F → G → H → ✅ 부트스트랩 완료
빌드환경  디자인  라우팅  데이터  DB    Edge  테스트  CI
시스템         계층   마이그   Fn    인프라
```

## Phase 2 진행 중 (2026-05-20 — B-1·B-2·B-3·B-4·B-5(0~2) 완료, Phase 3 다음)

```
B-1 환경 셋업 ✅ → B-2 s1 인증 ✅ → B-3 s5 마켓계정 ✅ → B-4 s3 상품등록 ✅ → B-5 s2 대시보드 + s6 등록이력 🔶 진행 중
   ↓                  ↓                 ↓                    ↓                    ↓
Supabase 2 프로젝트   4페이지 본구현    4페이지 본구현       5단계 위저드본구현    Phase 0~2 ✅ / Phase 3~4 ⬜
GitHub Secrets        AuthProvider     useQuery + Realtime   RHF + zod + zustand   /dashboard ✅ / /history ✅
Branch protection     RequireAuth      4상태 + partial       이미지 파이프라인     /history/:jobId ⬜
CI 6/6 ✓ + Pages      105 단위테스트   33 단위 (합산 125)    Phase 0~6 ✅          DB 작업 0 (RPC/view 기존)
누적 테스트: 202 passed / 0 failed / 26 todo (B-5 Phase 0+1+2 후, +29건)
```

추가 작업물 (2026-05-20 13:xx, working tree untracked + uncommitted):
- **B-5 Phase 0**: dashboard-api / history-api / hooks 6종 (useDashboardSummary, useRecentJobs, useMarketHealth, useHistoryList, useHistoryDetail, useHistoryFilterState) + schemas 확장 (MarketHealth + URL ↔ filter round-trip + periodToRange) + 단위 19건
- **B-5 Phase 1 — DashboardPage 본구현**: SummaryCard / MarketDotStack / RecentJobsTable / MarketHealthCard / DashboardEmptyState + V2PlaceholderCard + 단위 5건
- **B-5 Phase 2 — HistoryListPage 본구현**: HistoryFilterSidebar (period preset + 마켓/상태 다중 + 검색 + brand color dot) / HistoryListRow (table+card variant) / HistoryListTable (IntersectionObserver 무한 스크롤) / HistoryEmptyState (절대/필터 empty 분기) + 단위 5건
- **UI 트윅 sweep** (사용자 피드백 5건):
  - AppLayout main padding 증가 (`pt-8/10 pb-10/12`)
  - Button primary/danger 폰트 `!text-white` 강제 (asChild + Link 상속 깨지는 케이스 차단)
  - CardContent / CardFooter 디폴트 `pt-0` 제거 (standalone 사용 시 상단 패딩 누락 회피). CardHeader 는 `pb-3` 로 축소해 페어 간격 조절.
  - Dashboard summary cards empty 상태 — "—" 대신 "0건" 표시
  - lib/format-time.ts 공용 신설 (formatRelativeTime + formatDurationSec)

## 현재 develop 브랜치 (HEAD = `878093d`, 2026-05-20 12:xx)

**Working tree 상태**: B-5 Phase 0+1+2 + UI 트윅 untracked/modified (이번 commit 대상).

최근 commit (오래된 → 최신):

```
6214a3b feat(auth): s1 인증 4페이지 본구현 + 가드/세션 인프라
3856638 fix(migrations): Supabase 클라우드 push 호환성 3건 + config.toml PG 17
a3ebc37 fix(e2e): golden path 매칭 + RequireAuth 가드 호환
d275571 fix(e2e): G0 진입을 vite preview SPA fallback 한계 우회
dd14a36 fix(router): basename 가 vite base './' 환경에서 '.' 으로 평가되어 라우팅 실패
94e542a fix(env): VITE_SENTRY_DSN 등 옵셔널 URL 의 빈 문자열 허용
1d466b4 fix(e2e): G0 의 이메일 input 셀렉터 충돌 해소
76d52fe docs(handoff): B-1 환경 셋업 완료 + 후속 메모
cd88ed3 docs(handoff): WIP 갱신 — Phase 2 진행도 + 다음 세션 진입 가이드
a58f424 feat(markets): B-3 s5 마켓계정 본구현 — 4페이지 + Realtime + 4분기 인증
0014ae9 feat: B-4 s3 상품등록 5단계 위저드 본구현
878093d feat: 설정 페이지 + 로그아웃 기능 추가  ⬅ HEAD
```

검증 상태 (2026-05-20 13:xx, working tree 포함):
- `pnpm typecheck` ✅
- `pnpm test` ✅ **202 passed / 0 failed / 26 todo** (B-5 Phase 0~2 단위 29건 신규)
- `pnpm lint` — 다음 commit 직전 1회 (로컬 hook 룰)
- `pnpm build:debug` — 다음 commit 직전 1회
- CI on `878093d`: 푸시 안된 상태. 다음 push 는 본 commit + Phase 3~4 완료 후

**다음 작업**: B-5 Phase 3 (History 상세 + 재시도/제외 액션). Plan: `~/.claude/plans/2026-05-20-b5-dashboard-history.md` Phase 3 섹션.

---

# 5마켓 MVP 확장 — 완료 ✅ (2026-05-19, commits `f167ad1` + `3fc4c2e`)

확정 결정:
- **v1 = 네이버·쿠팡·G마켓·옥션 4개**, **11번가 = v2 이관** (Edge Function outbound IP 동적 ↔ 11번가 IP 화이트리스트 충돌)
- `AuthInput` 4-way discriminated union: `oauth_code` (네이버) / `hmac_key` (쿠팡) / `esm_jwt` (G·옥션) / `api_key` (11번가 stub)
- `refreshToken` = OAuth(네이버)만 사용 optional. credential 저장 = `credential_payload jsonb` + pgcrypto

결정된 OPEN-QUESTIONS: OQ-10 / OQ-15 / OQ-17 / OQ-04 / OQ-3/14.

---

# 현재 잔존 항목 (다음 작업)

## A. 정리 작업 ✅ 완료 (2026-05-19)

lint 0 error 달성 + HTML 프로토타입 step3/step4 4마켓 sync + Edge Functions lint 3건 정리. 상세는 commit `1e7ca18` (lint) / `b3c9c00` (HTML sync) 참조.

## B. Phase 2 실 화면 구현 (Stage D 이후 본 작업)

### B-1. 환경 셋업 ✅ (2026-05-19 완료)
- ✅ Supabase 프로젝트 2개 생성 (debug `eqoywqoalwkwbrdsulfl` / real `lfrnythcujxdhehvkmtg`)
- ✅ `supabase link` + `supabase db push` — 17개 마이그레이션을 두 프로젝트에 모두 적용. 진행 중 발견된 호환성 fix 4건 별도 commit: `events_kpi` 의 date_trunc IMMUTABLE 회피 (AT TIME ZONE 'UTC'), `views_kpi` 의 `trailing` reserved keyword 리네임, `storage_buckets` 의 COMMENT ON POLICY 제거 (관리형 storage 권한), `config.toml` PG 17 갱신.
- ✅ GitHub Secrets 5개 등록 — `REAL_SUPABASE_URL`, `REAL_SUPABASE_ANON_KEY`, `REAL_SUPABASE_PROJECT_REF`, `DEBUG_SUPABASE_ANON_KEY`, `SUPABASE_ACCESS_TOKEN`. Sentry 관련 4개(`*_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`)는 Sentry 프로젝트 생성 후 후속 등록.
- ✅ GitHub Pages 활성 — `build_type=workflow`. URL: https://rumeadia-dotcom.github.io/ing0415/
- ✅ Branch protection — develop (5 status check + linear history + force push 차단), main (위 + enforce_admins + PR 리뷰 dismiss stale).
- ✅ `apps/web/.env.local` (debug 모드, gitignore 등록).
- ✅ CI 6/6 통과 검증 — 진행 중 발견된 3건 fix: golden-path `@golden` 태그 + RequireAuth 가드 호환, vite `base: './'` 와 router basename 호환 (resolveBasename 헬퍼), env zod 스키마의 빈 문자열 옵셔널 처리, Tabs panel ↔ input 셀렉터 충돌.

**⚠ B-1 후속 (사용자 콘솔 작업 — 미완료)**:

1. **Supabase Auth URL Configuration** (auth.md §4.2 — 화이트리스트 등록):

   **debug 프로젝트** (https://supabase.com/dashboard/project/eqoywqoalwkwbrdsulfl/auth/url-configuration)
   - Site URL: `http://localhost:5173`
   - Redirect URLs: `http://localhost:5173/**`, `http://localhost:4173/**`

   **real 프로젝트** (https://supabase.com/dashboard/project/lfrnythcujxdhehvkmtg/auth/url-configuration)
   - Site URL: `https://rumeadia-dotcom.github.io/ing0415/`
   - Redirect URLs: `https://rumeadia-dotcom.github.io/ing0415/**`

   → 등록 안 하면 회원가입 인증 메일의 redirect / 비밀번호 재설정 redirect 가 차단됨.

2. **(선택) Sentry 프로젝트 생성** → 4개 secret 등록:
   `REAL_SENTRY_DSN`, `DEBUG_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`

### B-2. s1 인증 구현 (2026-05-19 본구현 완료)
- ✅ LoginPage: RHF + zod + Supabase Auth signInWithPassword + 에러 매핑 + password 토글 + redirect (location.state.from)
- ✅ SignupPage: 자체 5단계 강도 메터 (zxcvbn 미도입, v1 번들 부담 회피) + 약관/마케팅 체크박스 + enumeration 방지 동일 응답
- ✅ ForgotPasswordPage: resetPasswordForEmail + 결과 무관 동일 안내 (네트워크/5xx/rate_limit 만 노출)
- ✅ ResetPasswordPage: recovery 세션 검사 + updatePassword + signOut(global) + toast + /login redirect
- ✅ RequireAuth HOC: AppLayout 그룹 가드 (anonymous→/login + state.from 보존, loading→skeleton)
- ✅ AuthProvider + useAuth: PKCE flow + onAuthStateChange 구독 + 3-state (loading/authed/anonymous)
- ✅ Label / ErrorMessage 공통 컴포넌트 신설 (ui-system.md §7 / §8)
- ✅ supabase.ts: `flowType:'pkce'` + `storageKey:'mc.auth'`
- ✅ auth-error-map: Supabase Auth 에러 → 한국어 + Sentry 송출 정책 (auth.md §7.2/§7.3)
- ✅ 단위 테스트 13건 (auth-error-map 7 + password-strength 6)
- [ ] 소셜 로그인 (Google / Naver provider 설정) — B-1 Supabase 콘솔 설정 의존
- [ ] auth-event-log Edge Function 연동 (audit_log) — v2 백로그 가능
- [ ] LoginPage / SignupPage 통합 테스트 (RTL — submit, validation, navigate)
- [ ] 세션 만료 자동 로그아웃 동작 검증 (refresh token rotation 시나리오)

### B-3. s5 마켓계정 본 구현 (2026-05-20 본구현 완료, 시드 의존 보류 1건)
- ✅ **MarketsListPage placeholder → 본구현** (`apps/web/src/features/markets/pages/MarketsListPage.tsx`)
  - useQuery `['markets', 'accounts', { sellerId }]` + MarketStackSummary + 테이블/카드 그리드
  - loading / data / error / empty 4상태 + partial(active=0) 경고 배너
  - Realtime: `useMarketAccountsRealtime` 채널 `market_accounts:<sellerId>`
- ✅ **MarketsConnectProviderPage 4분기 본 동작**:
  - 네이버 → `useOAuthStart` → `markets-oauth-start` → `window.location.assign(authorizeUrl)`
  - 쿠팡 → RHF + zodResolver(HmacConnectFormSchema) → `markets-connect`
  - G마켓·옥션 → RHF + zodResolver(EsmJwtConnectFormSchema) → `markets-connect`
  - 11번가 → disabled 안내
- ✅ **OAuthCallbackPage**: code + state 검증 + `markets-oauth-callback` invoke + 성공/실패 화면 (markets.md §7.4 와이어 준수)
- ✅ **연결 해제 / 재인증 / verify 동작** — MarketAccountActions (`useDisconnectMarket` / `useVerifyMarket` + Dialog confirm)
- ✅ **에러 매핑** — `formatMarketError` 13종 + correlationId 노출 (markets.md §10)
- ✅ **단위 테스트 33건 추가** (market-error-messages 17 / useConnectMarket 2 / MarketsListPage 5 / MarketsConnectProviderPage 4 / OAuthCallbackPage 4 + 기존 통합 92 → 합산 125 통과)
- [ ] **Golden Path G1~G3 e2e 활성화 (사전 조건 차단)** — 시드 셀러 `qa@marketcast.test` 미생성 + Supabase Auth URL Configuration 미완료 + MSW oauth handler 미설정. (a)(b)(c) 충족 시 묶어서 한꺼번에 fixme 해제. 현 시점 golden-path.spec.ts 코멘트는 갱신됨.
- [ ] **토큰 자동 갱신 (네이버)** — Phase 3 C-1 으로 이관 (실 OAuth 응답 형태 결정 후 클라이언트 silent refresh + cron 도입). 2026-05-20 사용자 결정.

### B-4. s3 상품 등록 5단계 본 구현 (2026-05-20 본구현 완료)
**Plan**: `~/.claude/plans/2026-05-20-b4-registration-wizard.md` (6 phase). 결정 사항: registration.md §10 ground truth 따라 **5단계로 통합** (`/register/markets` 단일 — `/register/categories` 제거).

- ✅ **Phase 0** — registration 기반 (api 3종 / hooks 8종 / zustand 폼 store / 에러 매핑) — 단위 19건
- ✅ **Phase 1** — Step 1 정보 입력: RHF + zodResolver(Step1Schema) + 디바운스 중복 확인 + useUpsertProductDraft (products INSERT/UPDATE) + 배송정책 select — 단위 3건
- ✅ **Phase 2** — Step 2 이미지: ImageDropzone (드래그·클릭·paste) + uploadOneImage (signed URL → 직접 PUT → image-register) + 진행률 카드 + 대표 토글 + 위·아래 정렬 — 단위 4건
- ✅ **Phase 3** — Step 3 통합 (라우터 정리 `/register/markets` 단일 + MarketSelectGrid 4마켓 + CategoryMappingCard + useMarketAccounts 연동) — 단위 4건
- ✅ **Phase 4** — Step 4 미리보기 `registration-validate` invoke + MarketPreviewCard + warning/error 분기 + 등록 시작 blockingReasons — 단위 3건
- ✅ **Phase 5** — Step 5 결과 `registration-start` + useRegistrationJob (useQuery + 2채널 Realtime) + JobProgressBar + JobMarketResultRow + PartialJobBanner + retry/exclude-and-restart — 단위 3건
- ✅ **Phase 6** — golden-path G5~G10 코멘트 현행화 + WIP 마킹 + 일괄 검증 + `/git-commit` 스킬 commit

**Out of scope (B-4 외)**: HTML WYSIWYG 상세 에디터 (v2), image-transform 실제 wasm-vips (Phase 3), 자동 카테고리 매핑 ML (v2), 위저드 draft persistence (v2), dnd-kit 정식 드래그 정렬 (v2 — 현재 화살표 정렬), Golden Path G1~G10 e2e 활성화 (시드 셀러 사전 조건 차단).

### B-5. s2 대시보드 + s6 등록이력 (5~7일)
- [ ] DashboardPage: 요약 카드 4개 + 최근 잡 + 마켓 연결 상태 + Realtime
- [ ] HistoryListPage: 필터 사이드바 + 페이지네이션 + Realtime
- [ ] HistoryDetailPage: 마켓별 결과 + 재시도/제외 액션

## C. Phase 3 — real 어댑터 (3~4주)

### C-1. 네이버 OAuth (5일)
- [ ] Naver Commerce API 셀러 계약 + 앱 등록 (type=SELF)
- [ ] CLIENT_ID / CLIENT_SECRET 발급
- [ ] real 어댑터 5메서드 본문
- [ ] OAuth 흐름 E2E

**📝 테스트 환경 메모 (2026-05-20, 옵션 C 채택)**

조사 결과 **네이버 커머스 API 는 공식 sandbox / 테스트 환경이 존재하지 않음.** 운영 API 만 존재하며, 실 스마트스토어 계정에 묶어서 검증해야 함.

검증 전략:

- **Phase 2 (현재) — 옵션 C 유지**: debug 모드 mock 어댑터 (`apps/web/src/lib/markets/debug/*`) 로 인터페이스·플로우·에러 매핑·UI 4상태 검증. 사업자등록 / 통신판매업 신고 부담 없음.
- **Phase 3 C-1 진입 시 — 옵션 A 병행**: real 어댑터 본문 구현 시점에 **실 사업자 1~2명을 베타 셀러로 모집** → 그분들 자격증명으로 운영 API E2E. 우리(MarketCast 운영사) 명의로 별도 사업자등록·통신판매업 신고는 불필요 (서비스 운영사 ≠ 마켓 셀러).
- **(선택) 사전 준비**: 사용자 본인 명의로 개인판매자 가입 1건 (사업자등록 X) 미리 만들어 두면, OAuth 토큰 발급 + read-only API (카테고리 조회, 내 스토어 조회) 까지는 검증 가능. 상품 생성(`createProduct`) 은 사업자등록 + 통신판매업 신고 필요해서 베타 셀러 대기.

핵심 제약 (Commerce API 발급 조건):

- **통합매니저 계정**만 개발업체 계정 생성 가능 (`apicenter.commerce.naver.com`)
- 스토어 상태가 심사중 / 거부 / 이용정지 / 탈퇴신청중 이면 API 계정 차단
- 해외 개인·해외 사업자 차단
- `type=SELF` 앱은 통합매니저가 보유한 스토어에 한해 사용 가능

→ Phase 3 C-1 진입 직전에 **베타 셀러 모집 채널** (커뮤니티 / 지인 / 셀러 카페) 확보가 선행 작업. 모집 못 하면 C-1 5일짜리 일정이 늘어남.

### C-2. 쿠팡 HMAC (5일)
- [ ] Coupang Wing API 가입 + accessKey/secretKey/vendorId 발급
- [ ] HMAC-SHA256 시그니처 생성
- [ ] 카테고리/상품 등록 API

### C-3. G마켓·옥션 ESM JWT (5일)
- [ ] ESM+ 마스터 ID + secretKey 발급
- [ ] JWT (HS256) sub='sell' / aud='sa.esmplus.com' / site='G'|'A'
- [ ] 통합 어댑터 (site 분기)

### C-4. 통합 검증 (1주)
- [ ] 4마켓 동시 등록 시나리오
- [ ] partial 실패 / 재시도 / 마켓 제외 후 재등록
- [ ] 토큰 만료·갱신 (네이버)
- [ ] 이미지 변환 256MB 메모리 한도 (wasm-vips)

## D. Phase 4 — 운영 게이트 (2주)
- [ ] 골든패스 E2E 100% (Playwright Chromium)
- [ ] axe 0 violation (14 라우트 + 신규 화면)
- [ ] 보안 감사 — 토큰 마스킹 + RLS 격리 cross-tenant (pgTAP)
- [ ] Sentry 마스킹 운영환경 검증
- [ ] KPI view 정확도
- [ ] 부하 테스트 (동시 잡 10 / 마켓 4 fan-out)
- [ ] release/v0.1 컷 → 수동 QA → main 머지

## E. Phase 5 — v1 출시
- [ ] 매뉴얼·약관·개인정보처리방침
- [ ] 베타 셀러 5~10명
- [ ] 운영 모니터링 24h
- [ ] 첫 4주 KPI 베이스라인

## F. Phase 6 — v2 백로그
- [ ] 11번가 통합 (Pro 고정 IP vs Cloudflare Worker 프록시 vs 11번가 해제 신청)
- [ ] s4 템플릿 관리 전체
- [ ] 2FA, 알림 설정, CSV/Excel 내보내기
- [ ] 등록이력 고급 필터·통계
- [ ] 카테고리 자동 추천 ML
- [ ] pg_cron 운영 자동화
- [ ] Supabase Vault 재평가
- [ ] WebKit·Firefox E2E 활성

---

# 잔존 OPEN-QUESTIONS (P1/P2 11건)
- OQ-11 마켓별 실측 RPS (Phase 2)
- OQ-17 wasm-vips Edge 256MB 실측 (Phase 2)
- 11번가 IP 정책 옵션 (v2 진입 전)
- OQ-01/02/05/06/07/09/12/13/16/18 (별도 액션)

---

# 다음 세션 진입 가이드

## ⚡ 즉시 시작 (5분)

1. **(미완료 시) 콘솔 작업** — 위 "⚠ B-1 후속" 의 Supabase Auth URL Configuration 등록 (debug + real 둘 다). 미등록이면 회원가입 인증 메일 redirect 가 차단됨.
2. **현재 상태 확인** — `pnpm test` 202 passed 확인 → /dashboard /history 본구현 확인 → B-5 Phase 3 진입.

## 다음 작업 — B-5 Phase 3 (History 상세 + 재시도/제외 액션, 1~1.5일) ⭐

Plan: `~/.claude/plans/2026-05-20-b5-dashboard-history.md` Phase 3 섹션 참조.

핵심 산출물:
- [ ] **HistoryDetailHeader** — 잡 메타 + 부모/자식 잡 링크 + actions slot (재시도 / 마켓 제외 버튼)
- [ ] **HistoryMarketResultCard** — 마켓별 결과 카드 (success URL / failed code+message + ErrorMessage 접기/펼치기 / excluded 배지)
- [ ] **HistoryErrorTabs** — '결과' / '에러' 탭 (n44)
- [ ] **재시도 액션** — 기존 `useRegistrationRetry` (B-4) import + Dialog confirm + toast + invalidate
- [ ] **마켓 제외 재등록** — 기존 `useRegistrationStart` import + parentJobId + excludedMarketIds → 새 jobId 응답 → navigate
- [ ] **HistoryDetailPage 본문** — Header + Tabs + 마켓 카드 리스트 + 부모/자식 잡 네비
- [ ] 단위 테스트 +4건 — retry Dialog flow / exclude validate / partial 분기

후속 Phase:
- **Phase 4** sync sweep + 검증 + commit (0.5~1일)

후속 (B-5 외 잔여):
- [ ] s1 LoginPage / SignupPage 통합 테스트 (RTL) — B-2 후속, v2.
- [ ] auth-event-log Edge Function 호출 통합 — v2 백로그.
- [ ] 소셜 로그인 provider 활성화 (Google / Naver) — v2 백로그.

## 한 줄 진입 명령

```
git pull origin develop && pnpm install && pnpm test && pnpm dev
```

→ http://localhost:5173/dashboard /history 본구현 확인. Phase 3 작업은 `apps/web/src/features/history/pages/HistoryDetailPage.tsx` 본구현부터.

## B-5 commit 전략 (2026-05-20 갱신)

원래 B-4 처럼 Phase 0~3 누적 후 단일 commit 계획이었으나, 사용자 요청으로 **Phase 0~2 + UI 트윅 sweep 을 중간 commit** 으로 분리 (이번 commit). Phase 3 + Phase 4 는 별도 commit. UI 트윅 (CardContent 패딩 정책 변경 등) 이 layout-wide 영향이라 단일 commit boundary 가 의미 있음.
