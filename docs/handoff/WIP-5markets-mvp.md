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

## Phase 2 진행 중 (2026-05-19 — B-1, B-2 본구현 완료)

```
B-1 환경 셋업 ✅ → B-2 s1 인증 ✅ → B-3 s5 마켓계정 ⬅ 다음
   ↓                  ↓                 ↓
Supabase 2 프로젝트   4페이지 본구현    MarketsListPage 본구현
GitHub Secrets        AuthProvider     useQuery + Realtime
Branch protection     RequireAuth      4상태 카드 그리드
CI 6/6 ✓ + Pages      105 단위테스트
```

## 현재 develop 브랜치 (push 완료, working tree clean)

최근 10 commit (오래된 → 최신):

```
3fc4c2e refactor: 디렉토리 정리 — apps/web + apps/api 모노레포 분리
1e7ca18 fix(lint): pnpm lint 0 error 달성
b3c9c00 docs: 5마켓 MVP HTML 프로토타입 sync sweep
6214a3b feat(auth): s1 인증 4페이지 본구현 + 가드/세션 인프라
3856638 fix(migrations): Supabase 클라우드 push 호환성 3건 + config.toml PG 17
a3ebc37 fix(e2e): golden path 매칭 + RequireAuth 가드 호환
d275571 fix(e2e): G0 진입을 vite preview SPA fallback 한계 우회
dd14a36 fix(router): basename 가 vite base './' 환경에서 '.' 으로 평가되어 라우팅 실패
94e542a fix(env): VITE_SENTRY_DSN 등 옵셔널 URL 의 빈 문자열 허용
1d466b4 fix(e2e): G0 의 이메일 input 셀렉터 충돌 해소
76d52fe docs(handoff): B-1 환경 셋업 완료 + 후속 메모
```

검증 상태 (B-2 본구현 + lint 정리 시점):
- `pnpm typecheck` ✅
- `pnpm test` ✅ **105 / 0 / 26 todo**
- `pnpm build:debug` ✅ ~2.2s
- `pnpm lint` ✅ 0 error
- CI on `76d52fe`: ✅ 6/6 통과

---

# 5마켓 MVP 확장 — 작업 완료 ✅

**완료 일자**: 2026-05-19
**커밋**: `f167ad1` (feat: 5마켓 MVP 확장 — AuthInput 4-way union + 네이버·쿠팡·G마켓·옥션 활성 + 11번가 v2)
**후속 커밋**: `3fc4c2e` (refactor: 디렉토리 정리 — apps/web + apps/api 모노레포 분리)
**브랜치**: develop (push 완료, working tree clean)

## 결정 사항 (확정)
- v1 정식 라인업: **네이버 / 쿠팡 / G마켓 / 옥션** 4개 (real 어댑터까지 동작 예정)
- v2 이관: **11번가** (Supabase Edge Function outbound IP 동적 ↔ 11번가 IP 화이트리스트 정책 충돌)
- 어댑터 인터페이스: `AuthInput` 4-way discriminated union
  - `{ kind: 'oauth_code', code }` — 네이버
  - `{ kind: 'hmac_key', accessKey, secretKey, vendorId }` — 쿠팡
  - `{ kind: 'esm_jwt', masterId, secretKey, sellerId, site:'G'|'A' }` — G마켓/옥션
  - `{ kind: 'api_key', apiKey }` — 11번가 (호환 stub만, throw)
- `refreshToken` = OAuth(네이버)만 사용. optional
- credential 저장: `credential_payload jsonb` 단일 컬럼 + pgcrypto 암호화

## Wave 완료 현황

| Wave | 상태 | 산출물 |
|---|---|---|
| 1 — 인터페이스 + 설계문서 | ✅ | types.ts AuthInput union, schemas/market.ts AuthInputSchema, _shared/schemas.ts 미러, 마이그레이션 016 (credential_payload jsonb) + 017 (token_expires nullable), 설계문서 3종 sweep |
| 2 — debug 어댑터 + Edge Function | ✅ | 5 debug 어댑터, 신규 `markets-connect` Edge Function, 기존 4 Edge Function 네이버 한정 가드, 5마켓 verify/disconnect, `_shared/credentials.ts` |
| 3 — UI (React) | ✅ | MarketsConnectPage(5마켓 그리드+11번가 disabled), MarketsConnectProviderPage(4분기 섹션), 신규 HTML connect-coupang/gmarket/auction |
| 4 — 테스트 | ✅ | debug-adapter.test.ts 갱신 (4-way AuthInput + StoredCredential + 11번가 차단). 92 통과 / 0 실패 / 26 todo |

## 검증 상태 (최종)
- `pnpm typecheck`: ✅ 통과
- `pnpm test`: ✅ 92 통과 / 0 실패 / 26 todo
- `pnpm build:debug`: ✅ 통과 (dist/404.html SPA fallback 포함)
- `pnpm lint`: ✅ 0 error (2026-05-19 후속 정리 적용 — A 섹션 참조)

## OPEN-QUESTIONS 결정 완료
- OQ-10: 4마켓 v1 + 11번가 v2 + 4-way AuthInput union
- OQ-15: Supabase Edge Function Pro 400s / 256MB
- OQ-17: wasm-vips Deno npm: 호환 (v1.16+)
- OQ-04: pgcrypto 1차 (이전 결정 유지)
- OQ-3/14: PKCE 불요 (네이버 type=SELF / 쿠팡 HMAC 무관)

---

# 현재 잔존 항목 (다음 작업)

## A. 즉시 처리 가능한 정리 작업 ✅ 완료 (2026-05-19 후속 정리)

### A-1. HTML 프로토타입 본문 재구성 ✅
- ✅ `docs/frontend_html_design/v1/register/step3-markets.html` — 4마켓 활성 카드 (네이버·쿠팡·G마켓·옥션) + 카테고리 매핑 + 11번가만 v2 disabled 그리드. 선택 요약 "4 / 4"
- ✅ `docs/frontend_html_design/v1/register/step4-preview.html` — 4마켓 미리보기 카드 (옥션은 이미지 자동 리사이즈 경고 예시 포함) + 요약 banner "4/4" + 푸터 "일괄 등록 실행 (4개 마켓)"

### A-2. lint src/ ✅
- ✅ `apps/web/src/components/ui/card.tsx:39` — CardTitle 에 `children` destructure 후 명시 렌더링
- ✅ `apps/web/src/components/ui/input.tsx:9` — `interface InputProps {}` → `type InputProps = ...`
- ✅ ElevenstDebugAdapter / createMockAdapter 미사용 `_` prefix 인자 — ESLint `argsIgnorePattern: '^_'` 규칙 추가로 일괄 해소 (의도된 stub 인자 보존)

### A-3. lint 설정·스크립트 ✅
- ✅ ESLint config 에 `**/*.{cjs,mjs}`, `scripts/**` Node globals 적용 — `postcss.config.cjs` / `scripts/postbuild-spa.mjs` 통과
- ✅ deprecated `.eslintignore` 제거 → `eslint.config.js` `ignores` 로 이전 (Supabase `.branches`, `.temp` 포함)

### 추가 보너스: Edge Functions lint 3건도 함께 정리 ✅
- ✅ `apps/api/supabase/functions/_shared/http.ts:154` — `.catch(() => {})` → `.catch(() => undefined)`
- ✅ `apps/api/supabase/functions/_shared/masking.ts:75` — 정규식 `[A-Za-z0-9._\-]` → `[A-Za-z0-9._-]` (불필요 escape 제거)
- ✅ `apps/api/supabase/functions/markets-oauth-start/index.ts:217` — 의미 없는 try/catch wrapper 제거, 주석으로 의도 보존

> 위 변경으로 `pnpm lint` 가 처음으로 0 error 달성. CI `lint-and-typecheck` 잡의 Edge Functions non-blocking 가드 의존도 해소.

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

### B-3. s5 마켓계정 본 구현 (5~7일)
- [ ] **MarketsListPage placeholder → 본구현** (`apps/web/src/features/markets/pages/MarketsListPage.tsx`)
  - useQuery `['markets', sellerId]` + 5마켓 카드 그리드
  - loading / data / error / empty 4상태
  - 토큰 만료 경고 배너 (네이버)
  - Realtime 갱신
- [ ] MarketsConnectProviderPage 4분기 본 동작:
  - 네이버 → `markets-oauth-start` invoke → 외부 redirect
  - 쿠팡 → HMAC 폼 → `markets-connect` invoke
  - G마켓·옥션 → ESM JWT 폼 → `markets-connect` invoke
- [ ] OAuthCallbackPage: code + state → `markets-oauth-callback` invoke
- [ ] 연결 해제 / 재인증 / verify 동작
- [ ] 토큰 자동 갱신 (네이버) — 클라이언트 호출 직전 + cron

### B-4. s3 상품 등록 5단계 본 구현 (10~14일)
- [ ] Step 1 정보 입력: RHF + zod + 실시간 중복 확인
- [ ] Step 2 이미지: 드롭존 + `image-upload-url` + 직접 PUT + `image-register`
- [ ] Step 3 마켓·카테고리: 4마켓 선택 + `fetchCategoryTree` 캐시 + 매핑 UI
- [ ] Step 4 미리보기: `registration-validate` invoke + 마켓별 카드
- [ ] Step 5 결과: `registration-start` invoke + Realtime 진행률 + partial 시각화 + 재시도/제외
- [ ] image-transform 통합 (real 모드 wasm-vips 또는 imagescript)

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

1. **콘솔 작업 마무리** — 위 "⚠ B-1 후속" 의 Supabase Auth URL Configuration 등록 (debug + real 둘 다).
2. **로컬 검증** — `pnpm dev` → http://localhost:5173 → /signup 으로 실제 셀러 계정 1개 생성 (이메일 인증 메일 수신 확인). 이걸로 real Supabase Auth 흐름이 정말 동작하는지 즉시 검증.

## 다음 작업 후보 (우선순위 순)

### Option A — B-2 후속 마무리 (반나절 ~ 1일)
가장 짧고 s1 인증을 "완성" 시킴. 직후 B-3 진입.

- [ ] LoginPage / SignupPage 통합 테스트 (RTL — form validation, submit, navigate). RHF + zodResolver + AuthContext mock.
- [ ] auth-event-log Edge Function 호출 통합 (login_success / login_failure / password_reset_*). 또는 v2 백로그 유지 결정.
- [ ] (선택) 소셜 로그인 provider 활성화 — Supabase 콘솔에서 Google / Naver provider 키 등록 + LoginPage 의 social 탭에 실제 버튼 활성. Naver provider 는 Supabase 가 native 지원 안 해서 OAuth Custom 등록 필요.

### Option B — B-3 s5 마켓계정 본 구현 (5~7일) ⭐ 추천
B-2 통합 테스트 없어도 화면 자체는 다음 단계로 진행 가능. MarketsListPage 가 placeholder 상태라 첫 데이터 페칭 흐름 (useQuery + Realtime + 4상태) 정착 단계.

- [ ] **MarketsListPage** placeholder → 본구현 (`apps/web/src/features/markets/pages/MarketsListPage.tsx`)
- [ ] **MarketsConnectProviderPage** 4분기 본 동작 (네이버 OAuth / 쿠팡 HMAC / G마켓·옥션 ESM JWT)
- [ ] **OAuthCallbackPage** 본 동작
- [ ] 연결 해제 / 재인증 / verify 동작
- 단, real 어댑터는 Phase 3 (C-1~C-4) 라 debug 어댑터로 폼/플로우만 검증.

### Option C — B-4 s3 상품 등록 (10~14일)
가장 큰 도메인이라 분량이 큼. B-3 가 끝나야 매끄럽게 진입 가능 (마켓 카드 데이터 필요).

## 한 줄 진입 명령

```
git pull origin develop && pnpm install && pnpm dev
```

→ http://localhost:5173 으로 진입. /signup 에서 셀러 계정 생성 → /login → /dashboard (placeholder).
