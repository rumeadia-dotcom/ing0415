# MarketCast — WIP 핸드오프 (2026-05-21)

**develop HEAD**: `d2febc9` — 753 passed / 26 todo / 0 failed (PR #38 시점)
**main HEAD**: `fc2e9b6` — v0.2 릴리즈 머지 완료 (#39)

## 스택 한눈에

```
프론트:  React 18 + Vite + TS strict + shadcn + Tailwind + TanStack Query + RHF + zod
백엔드:  Supabase (Postgres + RLS + Auth + Storage + Realtime + Edge Functions Deno + pg_cron + Vault)
호스팅:  GitHub Pages (정적 SPA + 404.html fallback) + Supabase Cloud
모니터링: Sentry (PII 마스킹 강제)
CI/CD:   GitHub Actions (PR + main 분리, auto-merge 활성)
브랜치:  Git Flow (main / develop / release/* / feature/* / hotfix/*) — feature base 는 항상 develop
빌드모드: debug (mock 어댑터) / real (운영 API), Supabase 프로젝트 분리
```

## 도메인 모델

v1 출시 범위 = 상품 등록(s1~s6) + 주문·배송 자동화(s7~s9) 통합.

```
상품 등록 (s1~s6)
Seller (auth.users) ─┬─ MarketAccount ─── credential_payload jsonb + pgcrypto
                     ├─ Product ─┬─ ProductImage ─ ImageTransform (마켓별 N)
                     │           └─ ProductMarketMapping (카테고리/규격)
                     └─ RegistrationJob ─── JobMarketResult (1:N)

주문·배송 (s7~s9 — PR #38 통합)
Seller ─┬─ Order (4 마켓 폴링 수집)
        │   status: collected → logen_registered → waybill_printed → tracking_submitted
        │   (logen_failed / dispatch_failed 분기)
        ├─ ShippingJob ─── ShippingJobResult (1:N, 마켓별)
        └─ LogenCredentials (pgcrypto 암호화 — userId/custCd + 발송인 정보)
```

## 완료된 작업 (전체 요약)

| 단계 | 내용 | 커밋/PR |
|---|---|---|
| Stage A~H | 부트스트랩 (빌드·디자인·라우팅·데이터계층·DB마이그·EdgeFn·테스트·CI) | — |
| B-1~B-5 | 인증·대시보드·상품등록·마켓계정·이력 본구현 + 브랜드 리스킨 | — |
| C-1~C-3 | 네이버 OAuth / 쿠팡 HMAC / G마켓·옥션 ESM real 어댑터 | PR #2 #14 #17 |
| C-4 | 4마켓 fan-out 통합 시나리오 12종 (mock 기반) | PR #12 |
| D-A~D-D | axe E2E / pgTAP RLS / 법적 페이지 / Sentry PII 마스킹 | PR #11 #13 #15 #16 |
| v0.1 운영 배포 | GitHub Pages (`https://rumeadia-dotcom.github.io/ing0415/`) | `5ad98e7` |
| Hotfix #21~#23 | SPA basename / notify-sentry / GRANT 누락 | `74f6c66` `991957d` `b06bfc7` |
| **주문·배송 자동화** | s7/s8/s9 (10 작업) cherry-pick 합본 — 4 마켓 주문 폴링 + 로젠 자동 등록 + 송장 일괄 제출 | **PR #38 `d2febc9`** |
| **v0.2 main 배포** | release/v0.2 → main 머지 + deploy.yml 자동 트리거 | **PR #39 `fc2e9b6`** |

## 주문·배송 신규 (#38 에 포함된 변경)

### 프론트엔드 (s7/s8/s9 — 10 페이지)
- `/orders` /orders/list /orders/:id + 수동처리 다이얼로그 (n47~n50)
- `/shipping/print` /shipping/dispatch /shipping/dispatch/:jobId/result /shipping/history (n52~n57)
- `/settings/shipping` /settings/shipping/logen /settings/shipping/sender (n58~n60)

### 백엔드 (Edge Functions 5종 신규)
- `orders-sync` — 4 마켓 신규 주문 폴링 (pg_cron 10분)
- `logen-register-shipment` — getSlipNo + registerOrderData 자동 등록 + 재시도 3회
- `shipping-dispatch-job` (fan-out 부모) + `shipping-dispatch-market-worker` (마켓별)
- `logen-verify-credential` — 로젠 자격증명 검증 + 암호화 저장

### DB 마이그레이션 (`20260521000001~5` + `000010`)
- `orders` / `shipping_jobs` / `shipping_job_results` / `logen_credentials`
- `orders_with_dispatch_summary` view + 주문·배송 KPI view
- `set_logen_credentials` RPC + pg_cron orders-sync 스케줄

### 어댑터·SDK
- `MarketAdapter` 5메서드 → 7메서드 (fetchOrders + submitTracking 추가)
- 4 마켓 (네이버·쿠팡·G·옥션) real + mock 8 파일 (G·옥션은 ESM 공용)
- `apps/web/src/lib/logen/` — 로젠 API SDK 4 메서드 (getSlipNo / registerOrderData / outSlipPrintPop URL / inquirySlipNoMulti)

## 운영 현황

- **배포 URL**: `https://rumeadia-dotcom.github.io/ing0415/`
- **deploy.yml v0.2 자동 푸시 잡** (run `26200181952`): ✅ success — GitHub Pages + Edge Functions 5종 + Sentry release `v0.2`
- **workflow_dispatch (apply_db_migrations=true)** (run `26200345281`): ❌ FAIL — `pg_cron_orders_sync.sql` 가 vault secret `supabase_functions_url` 미등록으로 중단

### 운영 DB 상태 (추정 — 적용 순서 기반)
- ✅ `orders` / `shipping_jobs` / `shipping_job_results` / `logen_credentials` 적용
- ✅ views + RPC 적용
- ❌ pg_cron 10분 폴링 스케줄 **미적용** → `orders-sync` 는 수동 호출 시에만 동작

---

## ⚠ 즉시 필요한 운영 액션 (사용자 작업)

### 1. Supabase Vault 시크릿 등록 (운영 프로젝트)
```
supabase_functions_url  = https://<project-ref>.supabase.co/functions/v1
service_role_key        = <Supabase service_role JWT>
```
→ pg_cron 마이그레이션 재실행 가능해짐.

### 2. Edge Function env vars (운영 Supabase 대시보드)
```
LOGEN_API_BASE_URL = https://openapi.ilogen.com
LOGEN_PGCRYPTO_KEY = <암호화 키>
```
→ `logen-verify-credential` / `logen-register-shipment` 동작 가능.

### 3. pg_cron 마이그레이션 재적용
- Actions UI → "Deploy (real)" → workflow_dispatch → `apply_db_migrations=true` 재실행
- 또는 Supabase SQL Editor 에서 `20260521000010_pg_cron_orders_sync.sql` 수동 실행

### 4. 주문·배송 운영 DB 마이그레이션 적용 검증
- Supabase 대시보드 → Database → Migrations 에서 `20260521000001~5` 적용 확인
- pgTAP `v2_*_rls.sql` 회귀 1회 (cross-tenant 격리 확인)

---

## 남은 작업

### 🔴 외부 차단 (사람이 해야 하는 선행 조건)

| 항목 | 차단 내용 | 해제 시 가능해지는 것 |
|---|---|---|
| 베타 셀러 모집 (1~2명) | 실 사업자 자격증명 없음 (OAuth/HMAC/ESM 키 + 로젠 B2B) | C-1/C-2/C-3 + 주문·송장 실 API E2E |
| 네이버 type=SERVICE 확인 | 외부 SaaS 등록 심사 조건 미확인 | C-1 OAuth + 주문조회 본 연동 |
| 쿠팡 Wing OpenAPI IP 정책 | Edge Function outbound IP 동적 여부 (11번가 전례) | C-2 + 송장 제출 운영 |
| G·옥션 ESM+ 키 발급 심사 | 관리자 심사 ~1주 | C-3 + 주문·송장 운영 |
| 로젠택배 B2B 계약 | `userId` / `custCd` 발급 + 출력 라벨 프린터 준비 | 주문·배송 전체 본 동작 |

### 🟠 신규 v1 스코프 진입 (CLAUDE.md MVP 갱신 2026-05-21 — 미구현)

CLAUDE.md "MVP 범위 (v1) > 포함" 에 새로 들어온 항목 중 코드 없음:

| PRD § | 항목 | 비고 |
|---|---|---|
| §1.4.2 | 등록 결과 CSV/Excel 내보내기 | history 와 묶어 1 PR |
| §1.4.3 | 등록 성공/실패 알림 설정 (이메일·앱 푸시) | 알림 도메인 신설 — 채널·인프라 결정 필요 |
| §2.3.4 | 마켓 계정 상태 변경 알림 (토큰 만료) | §1.4.3 채널 재사용 |
| §2.4.1 | 마켓 계정 정보 정기 보안 감사 | 운영 절차 + 자동 감사 잡 |
| §2.4.2 | 마켓 계정 인증 정보 백업/복구 | 운영 절차 |
| §3.6.1 | 상품 상세 HTML WYSIWYG 에디터 | 라이브러리 선정 (tiptap 후보) |
| §3.6.2 | HTML 코드 유효성·XSS 검사 | §3.6.1 동반 |
| §3.6.3 | HTML 상세 설명 미리보기 | §3.6.1 동반 |
| §4.2.1 | 오류 메시지 유형별 분류 + 해결 가이드 | 현재 toast 만 — 분류 룰북 신설 |
| §4.2.3 | 오류 자동 로그 + 빈도 통계 | 로그는 Sentry, 통계 UI 신설 |
| §4.4.2 | 오류 유형별 통계 (마켓별·기간별 차트) | recharts 등 차트 라이브러리 선정 |
| §4.4.3 | 등록 이력 CSV/Excel 내보내기 | §1.4.2 와 묶음 |
| §5.4.1 | 이미지 WebP 압축 + 크기별 변형본 | image-transform 확장 |
| §5.4.3 | 브라우저/서버 캐싱 전략 | Cache-Control / SW 검토 |
| §5.4.4 | 지연 로딩 (Lazy Loading) | 이미지·라우트 lazy 확장 |
| — | s2 대시보드 마켓별 상세 통계 위젯 | 현재 요약·최근 등록만 |

### 🟡 주문·배송 후속 정합 (별도 PR 필요, v0.2 출시 영향 없음 — PR #38 본문에서 발췌)

1. `OrderStatusEnum.dispatch_failed` 의 ko.ts `orders.timeline` 라벨 추가
2. `OrderListFilterSchema` (offset, PR2) vs `OrdersFilterSchema` (keyset cursor, PR8) 페이징 통일
3. `ManualWaybillResolveInputSchema` (PR2) vs `ManualResolveWaybillSchema` (PR8) 중복 제거 + `carrierCode` 처리
4. `orders-sync/sync.test.ts` 가 Deno URL specifier — vitest exclude 상태. CI 에서 Deno test 러너 별도 잡 추가 (ci-cd.md §)
5. `ManualPage` 10 섹션 → 상품등록/주문배송 분리 (디자이너 검토)

### 🟢 v1 잔여 운영 게이트

| 항목 | 현황 |
|---|---|
| 골든패스 E2E 100% (G1~G15) | 전체 fixme — 시드 셀러 생성 시 해제 |
| axe 0 violation (18 라우트) | 4 active ✅, 14 fixme — 시드 셀러 생성 시 해제 |
| pgTAP RLS cross-tenant | 상품등록 + 주문·배송 102 + 신규 회귀. CI `supabase test db` 연동 필요 |
| Sentry 마스킹 운영환경 실검증 | debug 검증 완료, real Sentry 프로젝트 (`v0.2` release) 연동 후 재확인 |
| KPI view 정확도 | 상품등록 16 케이스 완성, 주문·배송 view (`v2_kpi_daily_orders`, `v2_kpi_daily_dispatch` — 물리 view 명) 회귀 추가 필요 |

### 🔵 Phase 5 — 출시 후

- 법적 페이지 콘텐츠 — 법률 전문가 검토 후 최종 확정
- 베타 셀러 5~10명 온보딩 (상품 등록 + 주문·배송 동시)
- 운영 모니터링 24h + 첫 4주 KPI 베이스라인

---

## 후속 백로그 (v1 이후 / 영구 보류)

- **11번가 통합** (Pro 고정 IP / Cloudflare Worker 프록시 / 화이트리스트 해제 신청 중 결정) — v2
- 로젠 외 택배사 (CJ대한통운 / 한진 등) — 어댑터 확장 — v2
- 마켓 주문 웹훅(push) 지원 시 10분 폴링 → 실시간 (OQ-SHIP-02) — v2
- 출력 후 자동 제출 옵션 셀러 선호 조사 (OQ-SHIP-05) — v2
- s4 템플릿 관리 / 소셜 로그인 / 2FA — v2
- 멀티유저 권한 (§3.3.3 템플릿 수정 권한 / §4.1.3 대시보드 접근 권한) — 1인 셀러 모델이 유지되는 한 영구 보류
- 마켓 단건 재시도 (현재 마켓 단위) — v2
- 카테고리 자동 추천 ML — v2
- WebKit·Firefox E2E 활성 — v2

---

## 다음 세션 진입

```bash
git pull origin develop && pnpm install && pnpm test
```

**753 passed** 확인 후 진입.

### 우선 순위
1. **Supabase Vault 시크릿 등록 + pg_cron 재적용** (위 §운영 액션 1·3) — orders-sync 자동화 활성
2. **Edge Function env vars 등록** (위 §운영 액션 2) — logen 어댑터 본 동작
3. 주문·배송 후속 정합 PR 1~3 (스키마 / 페이징 / status enum 정합) — 별도 develop 작업
4. 시드 셀러 생성 → Golden Path fixme 14 해제 → E2E CI 100%

### ⚠ Git Flow 룰 강제 (CLAUDE.md §Rules)
- 새 feature/* 브랜치는 **반드시 `develop` 에서 분기**. `main` 에서 분기 금지.
- Claude Code `Agent` 도구의 `isolation: "worktree"` 는 base 를 `main` 으로 잡으므로 prompt 에서 `git checkout -B feature/X origin/develop` 강제 명시.
- 과거 사고: PR #28~#37 가 main lineage 로 분기되어 cherry-pick 회수. PR #38/#39 로 복구.
