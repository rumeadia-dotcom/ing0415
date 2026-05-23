# MarketCast — WIP 핸드오프 (2026-05-23)

**develop HEAD**: `71748ca` (loop 사이클 1 client mirror drift fix) — 추가 사이클 진행 중
**main HEAD**: `e6d0c4d` — chore(rule): 운영 사고 진단 룰 추가 (#108) — release 보류 (사용자 지시)
**활성 PR (develop base)**: dependabot
**최근 운영 배포**: v0.9 (Market Gateway 도입 + Phase 4-A 어댑터 게이트웨이 경유)
**테스트**: 832 passed / 26 todo

## 2026-05-23 세션 요약 (Phase 4-A 운영 검증)

릴리즈 / 핫픽스 12개 머지 — 게이트웨이 인프라 운영 검증 완료.

| PR | 내용 | 카테고리 |
|---|---|---|
| #90 / #91 / #95 | Market Gateway Phase 1~2 통합 + release/v0.8 | release |
| #93 | hotfix v0.8.1 — Supabase project_ref 시크릿 네이밍 통일 | hotfix |
| #96 / #97 | Phase 4-A — 쿠팡·ESM 어댑터 gatewayFetch() 전환 + release/v0.9 | release |
| #98 v0.9.1 | MARKET_GATEWAY_BASE_URL 정합 + 운영 env 셋업 가이드 | hotfix |
| #99 v0.9.2 | markets-connect 클라이언트↔서버 zod 스키마 정합 | hotfix |
| #100 v0.9.3 | markets-connect duplicate check PG 에러 로그 추가 (진단) | hotfix |
| #101 v0.9.4 | service_role 테이블·시퀀스 GRANT 마이그레이션 | hotfix |
| #102 v0.9.5 | audit_log.category 'markets' 허용 + service_role 함수 EXECUTE | hotfix |
| #103 | docs 정정 — IP 화이트리스트 5마켓 공통 | docs |
| #104 v0.9.6 | 게이트웨이 GET/HEAD body TypeError fix | hotfix |
| #105 v0.9.7 | markets-connect 에러 세분화 + UI 마켓명·단계 prefix | hotfix |
| #106 v0.9.8 | HttpErrors.internal 의 details 인자 누락 fix | hotfix |
| #107 v0.9.9 | invokeEdge error.context.body ReadableStream parse fix | hotfix |
| #108 | chore(rule) — 운영 사고 진단 chain 전체 점검 룰 | chore |

운영 검증 결과:
- ✅ 어댑터 → gatewayFetch() → 게이트웨이 (HMAC + 화이트리스트) → 마켓 API 전 구간 정상 동작
- ✅ 게이트웨이 로그에 G마켓 트래픽 도달 확인 (`→ proxy request market=gmarket target=sa.esmplus.com`)
- ⚠️ ESM `/api/v1/category` 가 404 — 어댑터 endpoint 정확도 검증 필요 (Phase 4-B 영역)
- ⚠️ 사용자 임의 키 + IP 미등록 상태라 마켓 응답 모두 거부. 정식 운영은 5마켓 셀러 콘솔 IP 등록 + 정식 키 발급 선행

## 스택 한눈에

```
프론트:  React 18 + Vite + TS strict + shadcn + Tailwind + TanStack Query + RHF + zod
         + Tiptap (WYSIWYG, v0.6~) + Daum Postcode SDK (주소 API, v0.6~)
백엔드:  Supabase (Postgres + RLS + Auth + Storage + Realtime + Edge Functions Deno + pg_cron + Vault)
호스팅:  GitHub Pages (정적 SPA + 404.html fallback) + Supabase Cloud
모니터링: Sentry (PII 마스킹 강제)
CI/CD:   GitHub Actions (PR + main 분리, auto-merge 활성)
브랜치:  Git Flow (main / develop / release/* / feature/* / hotfix/*) — feature base 는 항상 develop
빌드모드: VITE_APP_MODE=dev|real + VITE_USE_MOCK=true|false 두 플래그 분리
         dev+mock=빠른 UI / dev+real-API=통합 검증 / real+real-API=운영 / real+mock=금지
```

## 도메인 모델

v1 출시 범위 = 상품 등록(s1~s6) + 주문·배송 자동화(s7~s9) + 알림(s10, PR3 신설 진행 중).

```
상품 등록 (s1~s6)
Seller (auth.users) ─┬─ MarketAccount ─── credential_payload jsonb + pgcrypto
                     ├─ Product ─┬─ ProductImage ─ ImageTransform (마켓별 N)
                     │           └─ ProductMarketMapping (카테고리/규격)
                     ├─ RegistrationJob ─── JobMarketResult (1:N)
                     └─ ShippingPolicy (name / fee / method / eta_days / is_default)

주문·배송 (s7~s9)
Seller ─┬─ Order (4 마켓 폴링)
        │   status: collected → logen_registered → waybill_printed → tracking_submitted
        │   (logen_failed / dispatch_failed 분기)
        ├─ ShippingJob ─── ShippingJobResult (1:N, 마켓별)
        └─ LogenCredentials (pgcrypto — userId/custCd + 발송인 + 발송지 주소)

알림 (s10 — PR3 진행 중)
Seller ─┬─ Notification (in-app + email 큐 single source)
        └─ NotificationPreferences (채널×타입 매트릭스 + quiet_hours)
```

## 완료된 작업 (전체 요약)

| 단계 | 내용 | 커밋/PR |
|---|---|---|
| Stage A~H | 부트스트랩 (빌드·디자인·라우팅·데이터계층·DB마이그·EdgeFn·테스트·CI) | — |
| B-1~B-5 | 인증·대시보드·상품등록·마켓계정·이력 본구현 + 브랜드 리스킨 | — |
| C-1~C-3 | 네이버 OAuth / 쿠팡 HMAC / G마켓·옥션 ESM real 어댑터 | PR #2 #14 #17 |
| C-4 | 4마켓 fan-out 통합 시나리오 12종 (mock) | PR #12 |
| D-A~D-D | axe E2E / pgTAP RLS / 법적 페이지 / Sentry PII 마스킹 | PR #11 #13 #15 #16 |
| v0.4 운영 배포 | 주문·배송 자동화 + 마켓/로젠 가드 + DB 스키마 fix | PR #38 #39 #65 |
| v0.5 운영 배포 | env 플래그 분리 + mock 인프라 + stale chunk 핫픽스 | PR #79 #80 |
| **v0.6 운영 배포** | **WYSIWYG 에디터 + 발송지 주소 API + 배송 정책 화면 + 주문·배송 정합** | **PR #76 #82** |

## v0.6 신규 기능 — 상세 (2026-05-22)

### WYSIWYG 에디터 (PRD §3.6.1 / §3.6.2)
- Tiptap (StarterKit + Link + Image + Placeholder) + DOMPurify sanitize
- `RichTextEditor` 공통 컴포넌트, `sanitizeHtml()` XSS 차단

### 발송지 주소 Daum Postcode API
- `daum-postcode.ts` SDK 동적 로드 + `AddressSearchInput` 컴포넌트
- `SettingsShippingSenderPage` address 필드 교체 (수기 입력 제거)

### 배송 정책 관리 화면 (PRD §1.1.4)
- `/settings/policies` — 4상태 + 생성/수정/삭제/기본값 토글 Dialog
- `ShippingPolicyFormSchema` zod 단일 소스, `useUpdateShippingPolicy` / `useDeleteShippingPolicy` hook

### mock insert id 버그 수정
- mock `insert` 시 id 없으면 `crypto.randomUUID()` 자동 생성 → 배송 정책 select 빈값 해결

## 운영 현황

- **운영 배포 URL**: `https://rumeadia-dotcom.github.io/ing0415/`
- **최근 deploy**: release/v0.6 → `completed / success` (2026-05-22T04:44)
- **dev Supabase** (`eqoywqoalwkwbrdsulfl`): 마이그레이션 27개 + Edge Functions 23개 적용 완료
- **dev Vault 시크릿**: `supabase_functions_url`, `service_role_key` 등록 완료
- **dev Edge Function secrets** (미등록): `MASTER_KEY_*` / `DAILY_SALT` / `PUBLIC_APP_ORIGIN` / 마켓 OAuth 키

---

## ⚠ 즉시 필요한 운영 액션 (사용자 작업)

### 1. dev Edge Function secrets 등록 (UI 회원가입 검증 후 단계적)
```
# Supabase Studio (dev) → Project Settings → Edge Functions → Secrets
MASTER_KEY_CURRENT_KID = mk_2026_q2
MASTER_KEY_MK_2026_Q2  = <openssl rand -base64 32>
DAILY_SALT             = <32+ char random>
PUBLIC_APP_ORIGIN      = http://localhost:5173
```
→ pgcrypto/마켓 연결 흐름 진입 시 필수. 미설정 시 마켓 연결 시점에 Edge Function 500.

### 2. 운영(real) Vault 시크릿 등록
```
supabase_functions_url  = https://lfrnythcujxdhehvkmtg.supabase.co/functions/v1
service_role_key        = <real service_role JWT>
```
→ pg_cron `orders-sync` 운영 활성.

### 3. 운영 Edge Function env vars
```
LOGEN_API_BASE_URL    = https://openapi.ilogen.com
LOGEN_PGCRYPTO_KEY    = <암호화 키>
RESEND_API_KEY        = <PR3 머지 후>
RESEND_FROM_EMAIL     = noreply@<도메인>
```

### 4. GitHub Secrets 정리 (env 플래그 분리 후속)
CI 워크플로우가 `DEBUG_SUPABASE_ANON_KEY` / `DEBUG_SENTRY_DSN` 시크릿 이름 사용 중. 이름 통일 원하면 `DEV_*` 추가 후 워크플로우 PR.

---

## 남은 작업

### 🔴 외부 차단 (사람이 해야 하는 선행 조건)

| 항목 | 차단 내용 |
|---|---|
| 베타 셀러 모집 (1~2명) | 실 사업자 자격증명 (OAuth/HMAC/ESM + 로젠 B2B) |
| 네이버 type=SERVICE 확인 | 외부 SaaS 등록 심사 |
| 쿠팡 Wing OpenAPI IP 정책 | Edge Function outbound IP 동적 여부 |
| G·옥션 ESM+ 키 발급 심사 | 관리자 심사 ~1주 |
| 로젠택배 B2B 계약 | userId/custCd + 출력 라벨 프린터 |
| Resend 도메인 인증 | PR3 머지 후 가능 |

### 🟠 phase 2: dev DB seed (별 PR)

mock으로 fixtures shape을 zod schema 기반으로 만들었으나, 실제 RPC/view 응답과 격차 가능.
`apps/api/supabase/seed.sql` 작성 → `pnpm db:push:dev` → `pnpm dev:db` 모드로 mock과 비교.

### 🟢 v1 잔여 운영 게이트

| 항목 | 상태 |
|---|---|
| 골든패스 G1~G10 (9 fixme) + axe 14 fixme | PR2 트랙 — 별도 진행 |
| 시드 셀러 인프라 (`seed.sql` + Playwright globalSetup) | phase 2 와 결합 |
| CI service_role 시크릿 매트릭스 갱신 | PR2 의존 |
| pgTAP RLS cross-tenant | `supabase test db` CI 연동 별도 |
| Sentry 마스킹 운영환경 실검증 | real Sentry 프로젝트 연동 후 |

### 🟠 신규 v1 스코프 잔여

| PRD § | 항목 | 진행 |
|---|---|---|
| §1.4.3 + §2.3.4 | 알림 도메인 (in-app + 이메일) | PR3 트랙 |
| §1.4.2 + §4.4.3 | CSV 내보내기 (papaparse) | 미진입 |
| §2.4.1 / §2.4.2 | 정기 보안 감사 + 백업/복구 | 미진입 |
| §4.2.1 / §4.2.3 / §4.4.2 | 오류 통계 + 차트 | 미진입 — 라이브러리 미선정 |
| §5.4.1 | 이미지 WebP + 변형본 | 미진입 |

### 🟠 Phase 4 잔여 (2026-05-23 추가)

| 항목 | 진행 |
|---|---|
| **Phase 4-A 운영 검증** — 어댑터 → 게이트웨이 → 마켓 흐름 | ✅ 완료 (2026-05-23). 게이트웨이 트래픽 도달 확인 |
| **Phase 4-B-1 — 네이버 스마트스토어 어댑터 보강** | 미진입. 현재 `naver.ts` stub. OAuth code 흐름 + 카테고리 + 상품 등록 |
| **Phase 4-B-2 — 11번가 어댑터 신규** | 미진입. 현재 어댑터 파일 자체 없음. API Key 인증 |
| **ESM endpoint 정확도** | `/api/v1/category` 가 404 — 실 ESM 문서 기반 path 검증 필요 (Phase 4-B 일부) |
| **5마켓 IP 화이트리스트 등록 + 정식 키 발급** | 셀러 액션. `docs/handoff/lightsail-setup-guide.md §7` 참조 |
| **markets-connect 외 다른 markets-* 함수 에러 세분화** | hotfix v0.9.7 패턴을 oauth-callback / verify / disconnect 에도 확장 (각 ~15분) |
| **`<ErrorMessage>` 펼치기/접기 + correlationId copy 버튼** | UI 작업 (CLAUDE.md 룰) |

---

## 후속 정합 백로그 (architecture v1 drift)

1. `design-renewal/s3-register.md` / `s9-settings.md` 갱신 필요 (v0.6 WYSIWYG / 배송 정책 화면 추가).
2. `docs/architecture/v1/features/registration.md` §3.6 및 `settings-shipping.md` WYSIWYG + 주소 API 반영.
3. §4.4.2 차트 라이브러리 미선정 — 진입 전 결정.
4. §1.4.3/§2.3.4/§4.2.* 알림 도메인 정의서 — PR3 가 `s10-notifications.md` 신설로 해소 예정.
5. **env 플래그 분리 후속**: GitHub Secrets `DEBUG_*` → `DEV_*` 통일 (옵션).

---

## 백로그 (v1 이후 / 영구 보류)

- ~~**11번가 통합** — v2~~ → **2026-05-22 5마켓 정식 결정으로 v1 진입**. Phase 4-B-2 Wave 1 (PR #111) 에서 서버 stub 활성화. Wave 2 에서 정식 API spec 적용 본격 구현 예정.
- 로젠 외 택배사 (CJ / 한진) — v2
- 마켓 주문 웹훅(push) → 10분 폴링 대체 — v2
- s4 템플릿 관리 / 소셜 로그인 / 2FA — v2
- 멀티유저 권한 — 1인 셀러 모델 유지 시 영구 보류
- 마켓 단건 재시도 / 카테고리 자동 추천 ML — v2
- WebKit·Firefox E2E 활성 — v2
- Stripe·PG 연동 / 구독 결제 — v2

---

## 다음 세션 진입

```bash
git fetch origin && git checkout develop && git pull && pnpm install && pnpm test
```

**811 passed** (2026-05-23 기준) 확인 후 진입.

### 우선 순위 (2026-05-23 갱신)
1. **Phase 4-B-1 — 네이버 스마트스토어 어댑터 보강** (현재 stub). OAuth code 흐름 + 카테고리 + 상품 등록 어댑터 + 단위 테스트 + ESM endpoint 정확도 검증 같이.
2. **5마켓 IP 화이트리스트 등록 + 정식 키 발급** (셀러 액션, 검토 대기 시간 길음 — 병행 진행 권장)
3. **markets-connect 외 다른 markets-* 함수 에러 세분화** — v0.9.7 패턴을 oauth-callback / verify / disconnect 에도 확장
4. **Phase 4-B-2 — 11번가 어댑터 신규**
5. **이전 우선순위 (보존)** — 설계문서 sweep / dev DB seed / 알림 도메인 (PR3)

### ⚠ Git Flow 룰 강제 (CLAUDE.md §Rules)
- 새 feature/* 브랜치는 **반드시 `develop` 에서 분기**. `main` 분기 금지.
- Claude Code `Agent` 도구의 `isolation: "worktree"` 는 base 를 `main` 으로 잡으므로
  prompt 에서 `git fetch origin develop && git checkout -B feature/X origin/develop` 강제 명시.
- 과거 사고: PR #28~#37 main lineage 분기 → cherry-pick 회수. 재발 방지.

### ⚠ 빌드 모드 룰 강제 (CLAUDE.md §빌드 모드)
- `VITE_APP_MODE`·`VITE_USE_MOCK` 는 cross-env (package.json scripts) 가 주입. `.env*` 에서 직접 설정 금지.
- `if (useMock)` 가드는 항상 dynamic import 와 결합. top-level static import 는 PR 차단.
