# MarketCast — WIP 핸드오프 (v0.15 운영 — 쿠팡 drift 3건 해소 + orders schema 확장 진행)

**develop HEAD**: `d9cce0f` — docs(logen): 로젠택배 Open API 문서 import (인덱스 + 19 article) (#247)
**main HEAD**: `262c778` — hotfix: v0.15.1 — deploy.yml setup-cli rate-limit 회피 (#237)
**테스트**: 991 passed / 31 todo (FE coupang-orders 18 통과 — paidAt/orderedAt 분리 + vendorItemId 매핑 + submitTracking body 직렬화 검증 신규)
**최근 운영 배포**: v0.15.1 (2026-05-27) — 11번가 real 어댑터 + 5마켓 주문 자동 수집
**진행 중 (uncommitted main 외)**: `feature/coupang-orders-schema-extend` (HEAD `894c3e6`) — PR #246 잔여 정합 #3 해소 (SubmitTracking schema 확장 + paidAt/collected_at 분리 + DB 마이그 20260529000001)

## 2026-05-29 세션 결과 (쿠팡 drift 3건 해소 + orders schema 확장)

PR #244 의 쿠팡 OpenAPI 인덱싱에서 발견된 drift 3건 + 마이그레이션 신설을 **3개 PR 분리**로 정합.

| Drift | 우리 코드 (이전) | 공식 docs | 해소 PR |
|---|---|---|---|
| #1 카테고리 path | `categorization/display-categories/{id}` | `marketplace/meta/display-categories/{code}` | ✅ **#245** (2026-05-28) |
| #2 발주서 ordersheets v4→v5 | v4 path + flat shape | v5 path + nested orderer/receiver/Money | ✅ **#246** (2026-05-28) |
| #3 송장 업로드 path + body | PUT `/orders/{x}/ordersheets/shipments` | POST `/orders/invoices` + `orderSheetInvoiceApplyDtos[]` | ✅ **#246** path/body 구조 / 🟡 잔여 schema 확장 = 본 PR |

### 본 PR (`feature/coupang-orders-schema-extend`) — 잔여 정합 #3 해소 + paid_at 분리

PR #246 본문에 명시된 **두 한계** 를 해소:

1. **`SubmitTrackingInputSchema` 확장** — FE + Edge mirror 모두 `orderId?: string` / `vendorItemId?: string` optional 추가. 쿠팡 v4 `/orders/invoices` body 의 `orderSheetInvoiceApplyDtos[].orderId` / `vendorItemId` 필수 필드를 정상값으로 전송 (이전엔 임시 `0` 하드코드). 다른 4 마켓 어댑터 (naver / esm / 11st) 는 두 필드 미사용 — optional 이므로 호환 영향 0.

2. **`paidAt` ↔ `collected_at` 의미 분리 + DB 마이그**
   - 마이그 `20260529000001_orders_vendor_item_and_ordered_at.sql` — `orders` 테이블에 `vendor_item_id text` / `ordered_at timestamptz` / `paid_at timestamptz` 세 컬럼 추가 (모두 nullable, idempotent `add column if not exists`).
   - `collected_at` 의미를 **"우리 시스템 수집 시각"** 으로 재정의 (comment 만 갱신, 데이터 손상 0). 이전엔 `collected_at` 에 마켓의 `paidAt` 을 적재해 두 의미가 섞여 있었음.
   - `orders-sync/lib/orders-repo.ts` — `collected_at = now()`, `paid_at = order.paidAt`, `ordered_at = order.orderedAt ?? null`, `vendor_item_id = order.vendorItemId ?? null` 분리 적재.
   - `MarketOrderSchema` 에 `orderedAt?` / `vendorItemId?` optional 추가 (FE + Edge mirror).
   - 쿠팡 FE/Edge 매핑이 v5 응답의 entry-level `orderedAt` / `paidAt` / `orderItems[0].vendorItemId` 를 분리해 채움. v4 flat 응답은 `paidAt` 미존재 시 `orderedAt` fallback (호환).
   - 인덱스 `orders_seller_ordered_desc` / `orders_seller_paid_desc` 추가 (대시보드 정렬 보조).

**산출물 (수정 9 / 신규 1)**:
- 신규: `apps/api/supabase/migrations/20260529000001_orders_vendor_item_and_ordered_at.sql`
- 수정: `apps/web/src/lib/schemas/market-orders.ts` / `apps/api/supabase/functions/_shared/market-orders.ts` / `apps/web/src/lib/markets/real/coupang/orders.ts` / `apps/api/supabase/functions/_shared/market-adapters/coupang-orders.ts` / `apps/api/supabase/functions/orders-sync/lib/orders-repo.ts` / 테스트 3 (coupang-orders / sync / orders-sync 통합)

**검증**: `pnpm typecheck` / `pnpm lint` / `pnpm test --run` (991 pass) / `pnpm build` 통과. **DB push 는 수행 안 함** — 마이그 파일만 커밋 (머지 후 사용자 액션).

**UI 표시 분리 (별도 PR)**: 화면에서 `orders.collected_at` 을 "결제일" 로 라벨링한 곳 정정 / `paid_at` 기준 정렬 변경 등은 본 PR 범위 외. backend + schema 만 정합 후 UI 후속 PR 로 분리.

### 미구현 endpoint (article 존재, 코드 없음 — 향후 백로그)
출고지·반품지 CRUD / 상품 수정·조회·목록·삭제 / 배송 상태 전이 (상품준비중·이미출고·출고중지완료) / 반품·취소 요청 목록 / 카테고리 추천 / 로젠 19 article (별도 인덱스 `docs/architecture/v1/features/logen-api/`)

## 2026-05-28 세션 결과 #1 (운영 사고 + Gateway IP 마이그레이션)

#240(MCP 호스팅 도입) 배포 후 게이트웨이 다운 — 512MB nano 인스턴스에 docker + headless chromium 자동기동 OOM-lock. 추가 발견: "고정 IP `43.201.83.78`" 가 정식 Lightsail Static IP 가 아닌 인스턴스 기본(동적) 공인 IP — 설계문서 latent 버그.

**조치**: 2GB plan 신규 인스턴스 + **정식 Static IP `3.36.239.243`** 할당, Caddy 도메인 치환, Edge Function 시크릿 + GitHub Actions secrets 갱신, `CLAUDE.md` / `ko.ts` / 설계문서 IP 일괄 갱신, MCP 부팅 자동기동 차단.

**잔여 사용자 액션 (이게 끝나야 실 마켓 호출 성공)**: 네이버 커머스 / 쿠팡 Wing / ESM 셀러관리 / 11번가 셀러오피스 화이트리스트 IP 를 `43.201.83.78` → **`3.36.239.243`** 으로 재등록.

**재발 방지 룰**: 인스턴스의 "고정 IP" 라 부르는 값이 Lightsail 콘솔 **최상위 Networking → Static IPs** 목록에 실제 객체로 존재하는지 명시 검증 후에만 "Static" 으로 기록.

## 2026-05-27 세션 결과 (release v0.15 — 11번가 v1 정식 + 5마켓 주문 수집)

11번가 v1 정식 5마켓의 코드·주석·문서 drift 전수 정합 + 미구현분 실구현 후 운영 배포.

| PR | 내용 |
|---|---|
| #233 | feat(11st) — 11번가 real 어댑터 5메서드 + fetchOrders/submitTracking + coupang/gmarket/auction Deno fetchOrders 포팅 + orders-sync 5마켓 배선 |
| #234 | release/v0.15 → main |
| #235 | main → develop 백머지 |
| #237 | hotfix v0.15.1 — deploy.yml setup-cli rate-limit 회피 |

## 스택 한눈에

```
프론트:  React 18 + Vite + TS strict + shadcn + Tailwind + TanStack Query + RHF + zod
         + Tiptap (WYSIWYG) + Daum Postcode SDK + DOMPurify (client) + isomorphic-dompurify (server)
백엔드:  Supabase (Postgres + RLS + Auth + Storage + Realtime + Edge Functions Deno + pg_cron + Vault)
         + AWS Lightsail Market Gateway (서울, 3.36.239.243, HMAC + 호스트 화이트리스트)
호스팅:  GitHub Pages (정적 SPA + 404.html fallback) + Supabase Cloud
모니터링: Sentry (PII 마스킹 강제) + 4 MCP (supabase-dev / supabase-real / playwright / sentry)
CI/CD:   GitHub Actions (PR 8잡 + main 분리, auto-merge 활성)
         deploy.yml = build-real / verify-vault-secrets / deploy-pages / deploy-edge-functions / notify-sentry
브랜치:  Git Flow (main / develop / release/* / feature/* / hotfix/*) — feature base = develop
         develop ruleset = PR + 0 approval + thread resolution + 8 status checks + squash-only
빌드모드: VITE_APP_MODE=dev|real + VITE_USE_MOCK=true|false
```

## 도메인 모델

```
상품 등록 (s1~s6)
Seller (auth.users) ─┬─ MarketAccount ─── credential_payload jsonb + pgcrypto
                     ├─ Product ─┬─ ProductImage ─ ImageTransform (마켓별 N)
                     │           └─ ProductMarketMapping (카테고리/규격)
                     ├─ RegistrationJob ─── JobMarketResult (1:N)
                     └─ ShippingPolicy

주문·배송 (s7~s9, v1.4 grouping)
Seller ─┬─ Order ── order_group_id → OrderGroup (1박스=1송장)
        │   columns: collected_at(수집) / paid_at(결제) / ordered_at(주문) — 2026-05-29 정합
        │   vendor_item_id (쿠팡 송장 제출용)
        │   status: collected → logen_registered → waybill_printed → tracking_submitted
        ├─ ShippingJob ─── ShippingJobResult (1:N)
        └─ LogenCredentials (pgcrypto)
```

## 완료된 작업 (요약)

| 단계 | 내용 | 비고 |
|---|---|---|
| Stage A~H | 부트스트랩 | — |
| B-1~B-5 | 인증·대시보드·상품등록·마켓계정·이력 본구현 + 브랜드 리스킨 | — |
| C-1~C-4 | 4마켓 OAuth/HMAC/ESM real 어댑터 + fan-out 통합 12종 mock | — |
| D-A~D-D | axe E2E / pgTAP RLS / 법적 페이지 / Sentry 마스킹 | — |
| v0.4~v0.11 | 주문·배송 자동화 / WYSIWYG / Market Gateway / qa-matrix / order-grouping / 운영 안전망 | 운영 배포 |
| v0.15 | 11번가 v1 정식 + 5마켓 fetchOrders | #233~#237 |
| 2026-05-28 | 쿠팡 docs import + drift 3건 정정 | #244 #245 #246 |
| **2026-05-29** | **로젠 docs import + orders schema 확장 (drift #3 잔여)** | **#247 + 본 PR** |

## 운영 현황

- **운영 배포 URL**: `https://rumeadia-dotcom.github.io/ing0415/`
- **최근 main 배포**: v0.15.1 (2026-05-27) — deploy.yml 5잡 success.
- **real Supabase** (`lfrnythcujxdhehvkmtg`): v0.15 까지의 마이그 적용 완료.
- **dev Supabase** (`eqoywqoalwkwbrdsulfl`): v0.10.1 마이그 3개 미적용 ⚠ + **본 PR 의 20260529000001 미적용** ⚠

---

## ⚠ 즉시 필요한 운영 액션 (사용자 작업)

### 1. 본 PR 머지 후 — orders 신규 컬럼 마이그 push (dev + real)
```bash
pnpm supabase:link:dev && pnpm db:push:dev
pnpm supabase:link:real && pnpm db:push:real
```
대상: `20260529000001_orders_vendor_item_and_ordered_at.sql`
- 컬럼 추가 only (nullable, idempotent) → 데이터 손상·다운타임 0.
- push 후 `orders-sync` Edge Function 재배포 (`pnpm functions:deploy:dev` / `:real`) 로 신규 컬럼 적재 활성화.

### 2. dev DB 마이그 3개 적용 (이월 — v0.10.1)
```bash
pnpm supabase:link:dev && pnpm db:push:dev
```
대상:
- `20260523000003_order_groups.sql`
- `20260524000001_rpc_fn_prefix_fix.sql`
- `20260524000002_registration_job_state_machine.sql`

### 3. 마켓 콘솔 화이트리스트 IP 재등록 (이월)
- `43.201.83.78` → `3.36.239.243` (네이버 / 쿠팡 / ESM / 11번가 4개 콘솔)
- 키 재발급 필요 시 앱에서 자격증명 재입력

### 4. 11번가 발급 키 실호출 최종 검증 (이월)
- IP 화이트리스트 `3.36.239.243` 등록 → 키 발급 → 1회 실호출
- 어댑터의 `apiCode` / 요청·응답 XML 엘리먼트명 최종 검증

### 5. 마이그 immutability 검증 (다음 release 전)
```bash
pnpm supabase:link:dev   # 또는 :real
supabase db push --linked --dry-run
```

---

## 남은 작업 (다음 세션 예약)

### 1. UI 표시 정합 PR (본 PR 후속)
- 화면의 "결제일" 라벨이 `collected_at` 을 가리키던 곳을 `paid_at` 기준으로 정정 (orders 목록 / 상세 / 대시보드 위젯).
- 정렬 기준도 `collected_at desc` → `paid_at desc` 검토 (셀러 입장의 "최근 결제 주문" 정렬이 더 자연스러움).
- `docs/architecture/v1/features/<orders>.md` 컬럼 의미 정합 동기화.

### 2. 쿠팡 미구현 endpoint (백로그 진입 가능)
출고지·반품지 CRUD / 상품 수정·조회 / 배송 상태 전이. 우선순위는 셀러 onboarding 핵심인 **출고지·반품지 CRUD** 가 1순위.

### 3. 로젠 19 article 인덱스 활용 (PR #247)
어댑터 코드 (`logen-register-shipment` Edge Function 등) 와 docs path 비교 → drift 점검.

### 4. P0 qa-matrix 갭 잔여
| 항목 | 차단 |
|---|---|
| **partial / retry / skip-market E2E 3종** | 셀러 시드 + 어댑터 시뮬레이션 |
| **captured-real fixture (parity §5)** | sandbox 마켓 API 접근 |

### 5. 미진입 v1 스코프
| PRD § | 항목 |
|---|---|
| §1.4.3 + §2.3.4 | 알림 도메인 |
| §1.4.2 + §4.4.3 | CSV 내보내기 |
| §2.4.x | 정기 보안 감사 |
| §4.2.x / §4.4.2 | 오류 통계 차트 |
| §5.4.1 | 이미지 WebP |

### 6. release/v0.16 검토
develop 누적: #244 #245 #246 #247 + 본 PR. 본 PR 의 DB 마이그가 포함되므로 release 시 `workflow_dispatch` 의 `apply_db_migrations=true` 필수.

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

**991 passed / 31 todo** 확인 후 진입.

### 우선 순위
1. **본 PR (`feature/coupang-orders-schema-extend`) 머지 + DB push** — 운영 액션 §1.
2. **UI 표시 정합 PR** — "결제일" 라벨이 `paid_at` 가리키도록 정정 (남은 작업 §1).
3. **쿠팡 출고지·반품지 CRUD 구현** — 셀러 onboarding 핵심. v1 정식 출시 전 권장.
4. **dev DB 마이그 3개 + Edge Function 재배포** — 이월 (§2).
5. **release/v0.16 검토** — DB 마이그 포함이므로 `apply_db_migrations=true` 게이트 사용.

### ⚠ Git Flow 룰 강제 (CLAUDE.md §Rules)
- 새 feature/* 브랜치는 **반드시 `develop` 에서 분기**. `main` 금지.
- Agent isolation: "worktree" default base = main — prompt 에서 `git fetch origin develop && git checkout -B feature/X origin/develop` 강제.

### ⚠ PR strict mode "behind" 패턴
- ruleset 의 `strict_required_status_checks_policy: true` 가 PR 브랜치에 develop HEAD lineage 포함 강제.
- 동일 시점에 다른 PR 이 develop 에 머지되면 본 PR 이 "behind" — auto-merge 발동 안 함.
- 해소: `mcp__github__update_pull_request_branch` 또는 GitHub UI 의 "Update branch" 버튼.

### ⚠ release PR 충돌 흔한 패턴
- release/* → main PR 생성 시 `docs/handoff/WIP-*.md` 와 `docs/architecture/v1/qa/qa-matrix.md` 가 자주 충돌.
- 해소: `git checkout --ours <file>` 로 develop 측 (최신) 채택.

### ⚠ DB 마이그 포함 release (본 PR 이후 첫 사례)
- `apply_db_migrations=true` 워크플로 입력 명시 — default `false` 라서 명시 안 하면 마이그 미적용 + Edge Function 만 재배포되어 신규 컬럼 인입 시 5xx.
- 사용자 액션: release/v0.16 → main 머지 후 `workflow_dispatch` 로 deploy 재실행 시 `apply_db_migrations=true` 체크.
