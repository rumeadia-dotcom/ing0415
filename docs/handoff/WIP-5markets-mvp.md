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
```

## 아키텍처 그림 (ASCII)

```
                            ┌──────────────────────────┐
                            │  GitHub Pages (정적 SPA)  │
                            └─────────────┬────────────┘
                                          │ HTTPS
                          ┌───────────────▼───────────────┐
                          │   React App (TS strict)        │
                          │   features/auth · dashboard ·  │
                          │   registration · markets ·     │
                          │   history                      │
                          └───┬─────────────────────┬──────┘
                              │                     │
              TanStack Query  │                     │  Realtime channel
                              ▼                     ▼
                       ┌────────────┐         ┌────────────┐
                       │ Supabase JS│         │  Realtime  │
                       └──┬────────┬┘         └──────┬─────┘
                          │        │                 │
                ┌─────────▼┐    ┌──▼──────────┐      │
                │ Postgres │    │Edge Functions│      │
                │  + RLS   │◄───┤  (Deno + TS)│      │
                │  + view  │    │             │      │
                │  + RPC   │    │ markets-*   │      │
                └────┬─────┘    │ registration│      │
                     │          │ image-*     │      │
                     │ trigger  │ auth-*      │      │
                     ▼          └──────┬──────┘      │
              ┌──────────┐             │             │
              │  KPI     │             │ 외부 마켓   │
              │  events  │             ▼             │
              │  ↓ view  │      ┌──────────────┐     │
              └──────────┘      │ Naver OAuth  │     │
                                │ Coupang HMAC │     │
                                │ G마켓 ESM JWT│     │
                                │ 옥션 ESM JWT │     │
                                │ 11st (v2)    │     │
                                └──────────────┘     │
                                                     ▼
                                              status push → UI
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

## 현재 진행 단계 (Bootstrap Phase 완료)

```
Stage A → B → C → D → E → F → G → H → ✅ 부트스트랩 완료
빌드환경  디자인  라우팅  데이터  DB    Edge  테스트  CI
시스템         계층   마이그   Fn    인프라

다음: Phase 2 (실제 화면·기능 구현)
```

---

# 5마켓 MVP 확장 — 작업 중단 (WIP)

**중단 일자**: 2026-05-19
**브랜치**: develop (commit 안 됨, working tree 변경사항 다수)

## 결정 사항 (Wave 0)
- v1 정식 라인업: **네이버 / 쿠팡 / G마켓 / 옥션** 4개 (real 어댑터까지 동작)
- v2 이관: **11번가** (Supabase Edge Function outbound IP 동적 ↔ 11번가 IP 화이트리스트 정책 충돌)
- 어댑터 인터페이스: `AuthInput` 4-way discriminated union
  - `{ kind: 'oauth_code', code }` — 네이버
  - `{ kind: 'hmac_key', accessKey, secretKey, vendorId }` — 쿠팡
  - `{ kind: 'esm_jwt', masterId, secretKey, sellerId, site:'G'|'A' }` — G마켓/옥션
  - `{ kind: 'api_key', apiKey }` — 11번가 (호환 stub만, throw)
- `refreshToken` = OAuth(네이버)만 사용. optional
- credential 저장: `credential_payload jsonb` 단일 컬럼 + pgcrypto 암호화

## Wave 진행 상황

| Wave | 상태 | 산출물 |
|---|---|---|
| 1 — 인터페이스 + 설계문서 | ✅ 완료 | types.ts AuthInput union, schemas/market.ts AuthInputSchema, _shared/schemas.ts 미러, 마이그레이션 016 (credential_payload jsonb) + 017 (token_expires nullable), 설계문서 3종 (market-adapter / credential-vault / markets.md) sweep, CLAUDE.md / README.md / OPEN-QUESTIONS.md 메타 갱신 |
| 2 — debug 어댑터 + Edge Function | ✅ 완료 | 5 debug 어댑터 본문 (네이버 OAuth / 쿠팡 HMAC / G마켓·옥션 ESM JWT / 11번가 throw), 신규 `markets-connect` Edge Function, 기존 4 Edge Function 네이버 한정 가드 (oauth-start / oauth-callback / token-refresh) + 5마켓 verify/disconnect, `_shared/credentials.ts` + `market-adapters/` 5개 갱신 |
| 3 — UI (HTML + React) | 🟡 부분 완료 (2026-05-19 이어작업) | ✅ React MarketsConnectPage(5마켓 그리드+11번가 disabled), ✅ React MarketsConnectProviderPage(4분기 섹션), ✅ 신규 HTML connect-coupang.html / connect-gmarket.html / connect-auction.html. ⏸ 잔여: markets/index.html alert 텍스트 (1마켓→4마켓), dashboard/register/history HTML 5마켓 표시 (sync sweep 시 일괄 갱신) |
| 4 — 테스트 | ✅ 완료 (2026-05-19 이어작업) | debug-adapter.test.ts 갱신 (4-way AuthInput 분기 + StoredCredential 반환 + refreshToken naver 한정 + 11번가 차단 케이스 + AuthInput kind mismatch 거부). 92 통과 / 0 실패 / 26 todo |

## 현재 검증 상태 (2026-05-19 이어작업 후)
- `tsc --noEmit -p tsconfig.app.json`: **통과**
- `pnpm test`: **92 통과 / 0 실패 / 26 todo** (Wave 4 완료)
- `pnpm build:debug`: **통과** (1.96s, dist/404.html SPA fallback 포함)
- `pnpm lint`: 실패 — Edge Functions 비차단 (CI 정책) + src/ pre-existing 4건 (card.tsx/input.tsx/createMockAdapter.ts/ElevenstDebugAdapter.ts). 별도 정리 PR 예정

## 미커밋 변경 파일 영역
- `apps/web/src/lib/markets/types.ts`, `apps/web/src/lib/markets/index.ts`, `apps/web/src/lib/markets/debug/*` (Coupang 수정 + 11st/Gmarket/Auction 신규)
- `apps/web/src/lib/schemas/market.ts`, `apps/web/src/lib/schemas/markets-feature.ts`
- `apps/api/supabase/functions/_shared/{schemas, market-adapter, credentials}.ts`
- `apps/api/supabase/functions/_shared/market-adapters/{index, debug, naver, coupang, gmarket(신규), auction(신규)}.ts`
- `apps/api/supabase/functions/markets-connect/index.ts` (신규)
- `apps/api/supabase/functions/markets-oauth-start|callback|token-refresh|verify/index.ts`
- `apps/api/supabase/migrations/20260520000001_credential_payload_jsonb.sql` (신규)
- `apps/api/supabase/migrations/20260520000002_credential_token_expires_nullable.sql` (신규)
- `docs/architecture/v1/cross-cutting/{market-adapter, credential-vault}.md`
- `docs/architecture/v1/features/markets.md`
- `docs/architecture/v1/OPEN-QUESTIONS.md`
- `CLAUDE.md`, `README.md`

## 다음 세션 재개 시
1. **Wave 3 잔여 sync sweep** — commit 직전 일괄 HTML 갱신 (markets/index.html alert "1마켓→4마켓 + 11번가 오픈 준비중", dashboard/register/history HTML 의 마켓 라인업 표시)
2. **Stage D MarketsListPage 구현** — Supabase market_accounts 쿼리 + 5마켓 카드 그리드 (loading/data/error/empty 4상태) + 토큰 만료 경고. 현재는 "준비 중" placeholder
3. **lint src/ 4건 정리** — card.tsx heading-has-content, input.tsx empty interface, createMockAdapter.ts `_payload` unused, ElevenstDebugAdapter.ts `_input` unused
4. 위 1~3 완료 후 단일 commit: `feat: 5마켓 MVP 확장 — AuthInput 4-way union + 네이버·쿠팡·G마켓·옥션 활성 + 11번가 v2`

## 잔존 미해결 (P1/P2 11건)
- OQ-11 마켓별 실측 RPS (Phase 2)
- OQ-17 wasm-vips Edge 256MB 실측 (Phase 2)
- 11번가 IP 정책 해결 옵션 (Pro 고정 IP / 외부 프록시 / 11번가 해제 신청) — v2 진입 전
- 그 외 OQ-01/02/05/06/07/09/12/13/16/18 (별도 액션)

## OPEN-QUESTIONS 결정 완료 (이번 작업)
- OQ-10 갱신: 4마켓 v1 + 11번가 v2 + 4-way AuthInput union
- OQ-15: Supabase Edge Function Pro 400s / 256MB
- OQ-17: wasm-vips Deno npm: 호환 (v1.16+)
- OQ-04: pgcrypto 1차 (이전 결정 유지)
- OQ-3/14: PKCE 불요 (네이버 type=SELF / 쿠팡 HMAC 무관)

---

# 앞으로 세부 할일 (출시 로드맵)

## Phase 2 — 실제 화면·기능 구현 (4~6주 예상)

### 2.1 환경 셋업 (1일)
- [ ] Supabase 프로젝트 2개 생성 (debug / real)
- [ ] `supabase link` 후 마이그레이션 17개 적용 (`supabase db push`)
- [ ] GitHub Secrets 등록 (최소 4종): `REAL_SUPABASE_URL`, `REAL_SUPABASE_ANON_KEY`, `REAL_SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`
- [ ] GitHub Pages 활성 (Source: GitHub Actions)
- [ ] Branch protection 설정 (develop/main 에 5 status check 강제)
- [ ] `.env.local` 작성 (debug 모드 anon key)

### 2.2 5마켓 MVP 확장 WIP 마무리 (3~5일)
- [ ] **Wave 3 — UI**: 5마켓 connect 분기 HTML (connect-coupang/gmarket/auction 신규) + dashboard/history HTML 5마켓 표시 + React MarketsConnectProviderPage 5분기 placeholder
- [ ] **Wave 4 — 테스트**: debug-adapter.test.ts AuthInput 시그니처 갱신, 5어댑터 contract 테스트, 5 fixture, 골든패스 다중 마켓
- [ ] 단일 commit: `feat: 5마켓 MVP 확장 — AuthInput 4-way union`

### 2.3 s1 인증 구현 (3~5일)
- [ ] LoginPage: RHF + zod + Supabase Auth signInWithPassword + 에러 매핑
- [ ] SignupPage: 비밀번호 강도 메터 (zxcvbn) + 이메일 인증 흐름
- [ ] ForgotPasswordPage + ResetPasswordPage
- [ ] 소셜 로그인 (Google / Naver provider 설정)
- [ ] RequireAuth HOC + 세션 만료 자동 로그아웃
- [ ] auth-event-log Edge Function 연동 (로그인 이벤트 적재)

### 2.4 s5 마켓계정 구현 (5~7일)
- [ ] MarketsListPage: useQuery `['markets', sellerId]` + 카드 시각화 + 토큰 만료 경고
- [ ] MarketsConnectPage: 5마켓 그리드 + 11번가 disabled
- [ ] MarketsConnectProviderPage 4분기:
  - 네이버 → markets-oauth-start invoke → 외부 redirect
  - 쿠팡 → HMAC 폼 → markets-connect invoke
  - G마켓·옥션 → ESM JWT 폼 → markets-connect invoke
- [ ] OAuthCallbackPage: code + state → markets-oauth-callback invoke
- [ ] 연결 해제 / 재인증 / verify 동작
- [ ] 토큰 만료 자동 갱신 (네이버) — 클라이언트 호출 직전 + cron

### 2.5 s3 상품 등록 5단계 구현 (10~14일) — 가장 큰 도메인
- [ ] Step 1 정보 입력: RHF + zod + 실시간 중복 확인
- [ ] Step 2 이미지: 드롭존 + image-upload-url + 직접 PUT + image-register
- [ ] Step 3 마켓·카테고리: 4마켓 선택 + fetchCategoryTree 캐시 + 매핑 UI
- [ ] Step 4 미리보기: registration-validate invoke + 마켓별 카드
- [ ] Step 5 결과: registration-start invoke + Realtime 진행률 + partial 시각화 + 재시도/제외
- [ ] image-transform 통합 (real 모드 wasm-vips 또는 imagescript)

### 2.6 s2 대시보드 + s6 등록이력 구현 (5~7일)
- [ ] DashboardPage: 요약 카드 4개 + 최근 잡 + 마켓 연결 상태 + Realtime 갱신
- [ ] HistoryListPage: 필터 사이드바 + 페이지네이션 + Realtime
- [ ] HistoryDetailPage: 마켓별 결과 + 재시도/제외 액션

## Phase 3 — real 어댑터 구현 (3~4주)

### 3.1 네이버 OAuth (5일)
- [ ] Naver Commerce API 셀러 계약 + 앱 등록 (type=SELF)
- [ ] CLIENT_ID / CLIENT_SECRET 발급
- [ ] real 어댑터 본문 — authenticate / refreshToken / fetchCategoryTree / transformProduct / createProduct
- [ ] 실제 OAuth 흐름 E2E 테스트

### 3.2 쿠팡 HMAC (5일)
- [ ] Coupang Wing API 가입 + accessKey/secretKey/vendorId 발급
- [ ] HMAC-SHA256 시그니처 생성 로직
- [ ] 카테고리 트리 API + 상품 등록 API 통합

### 3.3 G마켓·옥션 ESM JWT (5일)
- [ ] ESM+ 마스터 ID 생성 + secretKey 발급
- [ ] JWT (HS256) 클라이언트 발급 로직 (sub='sell', aud='sa.esmplus.com', site='G'|'A')
- [ ] G마켓·옥션 통합 어댑터 (site 만 분기)

### 3.4 통합 검증 (1주)
- [ ] 4마켓 동시 등록 시나리오 검증
- [ ] partial 실패 / 재시도 / 마켓 제외 후 재등록 동선 검증
- [ ] 토큰 만료·갱신 흐름 (네이버) 검증
- [ ] 이미지 변환 256MB 메모리 한도 실측 (wasm-vips)

## Phase 4 — 운영 게이트 통과 (2주)

- [ ] 골든패스 E2E 100% 통과 (Playwright Chromium)
- [ ] axe 0 violation (14 라우트 + 신규 화면)
- [ ] 보안 감사 — 토큰 마스킹 검증 + RLS 격리 cross-tenant 테스트 (pgTAP)
- [ ] Sentry 마스킹 검증 (실제 운영 환경 샘플)
- [ ] KPI view 정확도 (월간 잡 수 / MAU / 평균 등록 시간) 측정
- [ ] 부하 테스트 (동시 잡 10건, 마켓 4 fan-out)
- [ ] release/v0.1 브랜치 컷 → 수동 QA → main 머지

## Phase 5 — v1 출시
- [ ] 사용자 매뉴얼·약관·개인정보처리방침 작성
- [ ] 베타 셀러 모집 (5~10명)
- [ ] 운영 모니터링 (Sentry / Supabase 대시보드) 24h 관찰
- [ ] 첫 4주 KPI 측정 → 베이스라인 확정

## Phase 6 — v2 백로그 (출시 후)

### 6.1 11번가 통합
- [ ] IP 화이트리스트 옵션 결정: Supabase Pro 고정 IP 활성 (유료) vs Cloudflare Worker 프록시 vs 11번가 측 해제
- [ ] api_key 어댑터 본문 + connect 폼

### 6.2 기능 확장
- [ ] s4 템플릿 관리 전체 (생성/수정/HTML WYSIWYG/이미지 버전 관리)
- [ ] 2FA (이메일·SMS)
- [ ] 알림 설정 (이메일 + 앱 푸시)
- [ ] CSV/Excel 내보내기 (등록 결과·이력)
- [ ] 등록 이력 고급 필터·통계 (오류 유형별 차트)
- [ ] 마켓별 상세 통계 위젯 (대시보드)
- [ ] 카테고리 자동 추천 ML

### 6.3 운영 자동화
- [ ] pg_cron 활성 (oauth_state 정리, audit 보관 만료 archive, 변환본 GC)
- [ ] 마켓 정책 변경 모니터링 (GitHub repo discussion 구독)
- [ ] Supabase Vault 재평가 (운영 트래픽 증가 시)
- [ ] WebKit·Firefox E2E 매트릭스 활성

## 즉시 다음 액션 (최우선)

순서대로:
1. **Wave 3 (UI)** 마무리 — designer agent
2. **Wave 4 (테스트)** 마무리 — qa agent
3. 단일 commit + push develop
4. **Phase 2.1 환경 셋업** — Supabase 프로젝트 2개 생성 + GitHub Secrets

위 4개가 끝나면 **Phase 2.3 s1 인증 구현** 으로 첫 실 화면 시작 가능.
