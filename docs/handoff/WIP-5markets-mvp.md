# MarketCast — WIP 핸드오프 (2026-05-21)

**develop HEAD**: `bfb38ad` — 753 passed / 26 todo / 0 failed
**main HEAD**: `cf679c1` — v0.2 + hotfix #74 머지 완료
**develop_mobile HEAD**: `bfb38ad` (develop 동일 HEAD 에서 분기, 모바일·후속 정합 트랙)
**활성 PR (develop_mobile base)**: #76 (PR1) 머지 대기 / PR2·PR3 백그라운드 진행 중 / PR4 분리 대기

## 스택 한눈에

```
프론트:  React 18 + Vite + TS strict + shadcn + Tailwind + TanStack Query + RHF + zod
백엔드:  Supabase (Postgres + RLS + Auth + Storage + Realtime + Edge Functions Deno + pg_cron + Vault)
호스팅:  GitHub Pages (정적 SPA + 404.html fallback) + Supabase Cloud
모니터링: Sentry (PII 마스킹 강제)
CI/CD:   GitHub Actions (PR + main 분리, auto-merge 활성)
브랜치:  Git Flow (main / develop / develop_mobile / release/* / feature/* / hotfix/*) — feature base 는 develop 또는 develop_mobile
빌드모드: debug (mock 어댑터) / real (운영 API), Supabase 프로젝트 분리
```

## 도메인 모델

v1 출시 범위 = 상품 등록(s1~s6) + 주문·배송 자동화(s7~s9) + 알림(s10, PR3 신설 진행 중).

```
상품 등록 (s1~s6)
Seller (auth.users) ─┬─ MarketAccount ─── credential_payload jsonb + pgcrypto
                     ├─ Product ─┬─ ProductImage ─ ImageTransform (마켓별 N)
                     │           └─ ProductMarketMapping (카테고리/규격)
                     └─ RegistrationJob ─── JobMarketResult (1:N)

주문·배송 (s7~s9)
Seller ─┬─ Order (4 마켓 폴링)
        │   status: collected → logen_registered → waybill_printed → tracking_submitted
        │   (logen_failed / dispatch_failed 분기)
        ├─ ShippingJob ─── ShippingJobResult (1:N, 마켓별)
        └─ LogenCredentials (pgcrypto — userId/custCd + 발송인)

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
| v0.1 운영 배포 | GitHub Pages `https://rumeadia-dotcom.github.io/ing0415/` | `5ad98e7` |
| Hotfix #21~#23 | SPA basename / notify-sentry / GRANT 누락 | `74f6c66` `991957d` `b06bfc7` |
| 주문·배송 자동화 (s7/s8/s9) | 4 마켓 주문 폴링 + 로젠 자동 등록 + 송장 일괄 제출 | PR #38 `d2febc9` |
| v0.2 main 배포 | release/v0.2 → main + deploy.yml 자동 트리거 | PR #39 `fc2e9b6` |
| Hotfix #74 | 기본 택배사 v2→v1 표기 + 자동제출 토글 레이아웃 | PR #74 `cf679c1` |
| **PR1 후속 정합 1~3** | dispatch_failed 라벨 + OrdersFilterSchema(keyset) + ManualResolveWaybillSchema 통일 | **PR #76 (머지 대기, base=develop_mobile)** |

## develop_mobile 4 PR 병렬 트랙 (진행 중)

`docs/handoff/WIP-5markets-mvp.md` 의 🟢/🟠/🟡 항목을 4 PR 로 병렬 처리 중. base = `develop_mobile`.

| # | 트랙 | 브랜치 | 상태 |
|---|---|---|---|
| PR1 | 후속 정합 1~3 (XS, +72/-84, 3파일, 764 passed) | `feature/order-shipping-followup` | ✅ **PR #76** 머지 대기 |
| PR2 | 골든패스 G1~G10 + axe 14 fixme 해제 + 시드 셀러 인프라 | `feature/golden-axe-unlock` | 🟡 백그라운드 진행 중 |
| PR3 | 알림 도메인 신설 (In-app Realtime + Resend 이메일) | `feature/notifications-domain` | 🟡 백그라운드 진행 중 |
| PR4 | WYSIWYG (§3.6) + CSV (§1.4.2/§4.4.3) | (미생성) | 🟠 분리 결정 대기 → 아래 §PR4 분리안 |

## 운영 현황

- **배포 URL**: `https://rumeadia-dotcom.github.io/ing0415/`
- v0.2 main 머지 + hotfix #74 적용 완료.
- pg_cron `orders-sync` 10분 폴링 스케줄: ❌ Vault 시크릿 미등록으로 **여전히 미적용** (수동 호출 시에만 동작).

---

## ⚠ 즉시 필요한 운영 액션 (사용자 작업)

### 1. Supabase Vault 시크릿 등록 (운영 프로젝트)
```
supabase_functions_url  = https://<project-ref>.supabase.co/functions/v1
service_role_key        = <Supabase service_role JWT>
```
→ pg_cron 마이그레이션 (orders-sync, notifications-dispatch) 재실행 가능.

### 2. Edge Function env vars (운영 + debug Supabase 대시보드)
```
LOGEN_API_BASE_URL    = https://openapi.ilogen.com
LOGEN_PGCRYPTO_KEY    = <암호화 키>
RESEND_API_KEY        = <PR3 머지 후 필요>
RESEND_FROM_EMAIL     = noreply@<도메인>
```
→ logen-* + notifications-dispatch-email Edge Function 본 동작.

### 3. pg_cron 마이그레이션 재적용
Actions UI → "Deploy (real)" → workflow_dispatch → `apply_db_migrations=true` 재실행. PR3 머지 후 알림 dispatch pg_cron 도 동일 절차.

### 4. Resend 도메인 인증 (PR3 머지 후)
Resend 콘솔에서 발송 도메인 SPF/DKIM 인증. 미완료 시 발사 도메인이 `onboarding@resend.dev` fallback → 도달성 낮음.

### 5. CI 시크릿 `SUPABASE_DEBUG_SERVICE_ROLE` (PR2 머지 후)
debug 프로젝트 한정. E2E 시드(`auth.users` insert) 적용용. real 프로젝트 service_role 은 그대로 비저장.

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

### 🟠 PR4 분리안 (사용자 결정 2026-05-21)

**결정**: WYSIWYG + CSV 둘 다 **v1 포함**. `docs/architecture/v1/` 의 v2 carry-over 표기는 outlier 로 판단, 문서 동반 갱신 필요.

**PR4 를 2개로 분리 권고**:

- **PR4a (CSV §1.4.2 + §4.4.3)** — S, 의존성 `papaparse` 1개. `useExportCsv` 공용 hook + StepResultPage / HistoryListPage 버튼 활성화. **PII 외부 노출 보류 사유는 `security.md §8.1` "본인 화면" 범위로 이미 해소**. 컬럼 화이트리스트 (잡ID / 상품명 / 시각 / 상태 / retry / 마켓별 결과 / errorCode / external_product_id).
- **PR4b (WYSIWYG §3.6.1~3)** — M, 의존성 `@tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-image isomorphic-dompurify` (~100KB gz, lazy import). RichTextEditor + sandboxed iframe preview + DOMPurify 3중 게이트 (tiptap schema + zod refine + 서버). 모바일 툴바 6개 + 데스크탑 +H2/H3/Blockquote.

**진입 전 문서 동반 갱신 필수** (4개):
- `CLAUDE.md` MVP §3.6.1 v1 유지 (현재 표기 그대로면 OK)
- `docs/architecture/v1/security.md:484` — "§3.6, v2" → "v1 (DOMPurify 3중 게이트)"
- `docs/architecture/v1/features/registration.md:73,76` — v2 표기 제거 + tiptap 명시
- `docs/design-renewal/s3-register.md` line 46/100/554-558, `s6-history.md` line 313-326 — v2 carry-over 제거

**리스크**: tiptap 한글 IME (StarterKit ≥2.6 + composition event 테스트), 디자이너 툴바 명세 후속 트윅.

### 🟡 주문·배송 후속 정합 — **PR #76 으로 해소** (머지 대기)

### 🟢 v1 잔여 운영 게이트 — **PR2 진행 중**

| 항목 | 상태 |
|---|---|
| 골든패스 G1~G10 (9 fixme) + axe 14 fixme | PR2 (`feature/golden-axe-unlock`) 진행 중 |
| 시드 셀러 인프라 (`apps/api/supabase/seed.sql` + Playwright globalSetup) | PR2 포함 |
| CI `service_role` 시크릿 매트릭스 갱신 | PR2 포함 |
| pgTAP RLS cross-tenant | PR2 외 — `supabase test db` CI 연동 별도 |
| Sentry 마스킹 운영환경 실검증 | real Sentry 프로젝트 연동 후 |
| KPI view (주문·배송) 회귀 | `v2_kpi_daily_orders` / `v2_kpi_daily_dispatch` 케이스 추가 |

### 🟠 신규 v1 스코프 잔여 (PR4 외)

| PRD § | 항목 | 진행 |
|---|---|---|
| §1.4.3 + §2.3.4 | 알림 도메인 (in-app + 이메일) | PR3 진행 중 |
| §2.4.1 / §2.4.2 | 정기 보안 감사 + 백업/복구 (운영 절차 + 자동 감사 잡) | 미진입 |
| §4.2.1 / §4.2.3 | 오류 메시지 유형별 분류 + 빈도 통계 UI | 미진입 |
| §4.4.2 | 오류 유형별 통계 차트 (recharts 등) | 미진입 — 라이브러리 선정 필요 |
| §5.4.1 | 이미지 WebP 압축 + 크기별 변형본 | 미진입 |
| §5.4.3 / §5.4.4 | 캐싱 전략 + Lazy Loading 확장 | 미진입 |
| — | s2 대시보드 마켓별 상세 통계 위젯 | 미진입 |

---

## 후속 정합 백로그 (architecture v1 drift — ing-architect 2026-05-21 조사)

CLAUDE.md MVP 확장 (`91f1d95`) 의 over-scoping 신호:

1. **§3.6.2 XSS 책임 분담 표현** — CLAUDE.md/security.md = "클라+서버 3중", design-renewal = "서버 단독" 축약. PR4b 진입 시 동반 정정.
2. **§4.4.2 차트 라이브러리 미선정** — design-renewal 화면 명세 부재. 진입 전 결정 필요.
3. **§2.4.1/§2.4.2 보안 감사·백업 화면** — `credential-vault.md` 가 운영 절차로만 기술, FE/BE 명세 없음.
4. **§1.4.3/§2.3.4/§4.2.* 알림 도메인 정의서** — PR3 가 `docs/design-renewal/s10-notifications.md` 신설로 자동 해소.

---

## 백로그 (v1 이후 / 영구 보류)

- **11번가 통합** — Pro 고정 IP / 외부 프록시 / 화이트리스트 해제 신청 — v2
- 로젠 외 택배사 (CJ대한통운 / 한진) — v2
- 마켓 주문 웹훅(push) → 10분 폴링 대체 — v2
- 출력 후 자동 제출 옵션 셀러 선호 조사 — v2
- s4 템플릿 관리 / 소셜 로그인 / 2FA — v2
- 멀티유저 권한 — 1인 셀러 모델 유지 시 영구 보류
- 마켓 단건 재시도 / 카테고리 자동 추천 ML — v2
- WebKit·Firefox E2E 활성 — v2
- Stripe·PG 연동 / 구독 결제 — v2

---

## 다음 세션 진입

```bash
git fetch origin develop_mobile && git checkout develop_mobile && git pull && pnpm install && pnpm test
```

**753 passed** (PR1 머지 후 764 passed) 확인 후 진입.

### 우선 순위
1. **PR2 / PR3 백그라운드 완료 확인** — agentId 로 SendMessage 또는 GitHub `mcp__github__list_pull_requests` 로 상태 확인. 결과 통합 보고.
2. **PR4a (CSV) 진입** — papaparse + useExportCsv hook + 2개 버튼 활성화. PR4b 보다 가벼움, 단독 머지 가능.
3. **architecture 문서 4개 동반 갱신 PR** — PR4b 진입 전 선행. security.md:484 + features/registration.md:73,76 + design-renewal/s3:46,100,554-558 + design-renewal/s6:313-326.
4. **PR4b (WYSIWYG) 진입** — 문서 갱신 머지 후. tiptap 한글 IME + 디자이너 툴바 명세 후속 트윅.
5. **운영 액션 1~5 사용자 수행** — Vault 시크릿 + Edge Fn env vars + pg_cron 재적용 + Resend 도메인 인증 + CI service_role 시크릿.

### ⚠ Git Flow 룰 강제 (CLAUDE.md §Rules)
- 새 feature/* 브랜치는 **반드시 `develop` 또는 `develop_mobile` 에서 분기**. `main` 분기 금지.
- Claude Code `Agent` 도구의 `isolation: "worktree"` 는 base 를 `main` 으로 잡으므로 prompt 에서 `git fetch origin <base> && git checkout -B feature/X origin/<base>` 강제 명시.
- 과거 사고: PR #28~#37 main lineage 분기 → cherry-pick 회수. PR #38/#39 로 복구. 재발 방지.
