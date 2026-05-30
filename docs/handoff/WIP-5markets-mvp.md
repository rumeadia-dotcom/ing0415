# MarketCast — WIP 핸드오프 (v0.16: 11번가 재구현 PR-0~6 + ESM 조회형 전환 E1~E5 완료)

**develop HEAD**: `2407202` — refactor(11st): PR-6 cross-market 공통화 (#279)
**main HEAD**: v0.16 release 진행 중 (직전 운영 = `262c778` hotfix v0.15.1). **release/v0.16 → main 배포 진행** (real 실호출 미검증 전제 — 사용자 수용)
**테스트**: 1352 passed / 1 skipped / 31 todo
**최근 머지 (v0.16 범위)**: 11번가 #270~#279 (PR-1~6) · ESM 조회형 전환 #270·274·275·277 (E1~E5)

---

## 2026-05-30 세션 — 11번가 재구현 + ESM 조회형 전환 (9 PR, Wave 병렬)

직전 세션의 설계(11번가 spec 재검토·Layer 2 조회형 단일화·11번가 PR-0)를 코드로 완성. worktree 격리 + ing-* 구현 + qa/security 검수 패턴. develop strict 순차 머지(공통파일 rebase 충돌 해소).

### 11번가 재구현 (C9 — 완료)
placeholder → `11st-api/` 공식 spec 기준 전면 재작성. `features/11st.md` 6 PR 로드맵 완주.

| PR | 내용 | merge |
|---|---|---|
| #271 | **PR-1** 카테고리 cateservice(`GET /rest/cateservice/category`) + ns2 `stripNsPrefix` + parentDispNo 트리 + gateway allowlist `api.11st.co.kr` | `4ea1784` |
| #272 | **PR-5** 주문/발송 ordservices 재작성 + `dlvNo` 수집(`MarketOrder.extra`) + 택배사 코드 + discriminated union | `65929ba` |
| #273 | **PR-2** 출고지/반품지 **조회형 select**(1014/1015) + `getRegistrationFields` 2 select + PII 미저장 | `71b460b` |
| #276 | **PR-3** 상품등록 prodservices(transformProduct 필수 20+ / Layer1·2 / `ClientMessage` 파싱 / 이미지 truncate warning) | `c331a61` |
| #278 | **PR-4** 상품정보고시 `ProductNotification` + `OfficialNoticeField` 재사용 (상품군 1군 확보, 40군 free-form — C4) | `c2f1524` |
| #279 | **PR-6** cross-market 공통화 — `_shared/carrier-codes.ts`(택배사 단일소스) + `_shared/xml.ts`(ns2 공유) + **송장 마스킹**(maskUrl) | `2407202` |

### ESM 생성형 → 조회형 전환 (C10 — 완료, 5/5)
ESM 배송 선행값(출하지·발송정책)을 우리가 생성하지 않고 셀러가 ESM Plus 에 만든 것을 **GET 조회 → select**. 5마켓 Layer 2 조회형 단일 표준 수렴.

| PR | 내용 | merge |
|---|---|---|
| #270 | **PR-E1** 조회 Edge `esm-shipping-list`(출하지+발송정책 병렬 GET) + 조회 스키마 신설 | `82b2d4c` |
| #274 | **PR-E2** optionsSource `shippingProfiles`→`esmShippingPlace`/`esmDispatchPolicy` + Edge POST 정합 | `21541ba` |
| #275 | **PR-E3+E4** 생성형 제거(UI/훅/api/라우트/Edge) + `DROP TABLE esm_shipping_profiles` 마이그 + 워커 조회형 재연결 | `e5f173d` |
| #277 | **PR-E5** 잔존 enum/kind/i18n 제거 + parity 최종 정합 (전환 완료 선언) | `365994f` |

### 인프라
- **C2 게이트웨이 재배포 완료** — Lightsail 박스에 `api.11st.co.kr`+`sa2.esmplus.com` allowlist 반영, healthz 200. ⚠️ **PR-6 의 maskUrl(송장 마스킹) 은 재배포 한 번 더 필요** (아래 운영 액션).
- **C1 dev DROP 완료** — `esm_shipping_profiles` dev 테이블 제거 확인(SQL Editor). 마이그 **이력 정합**(`supabase_migrations` 기록)만 release 시 `db:push:dev` 로 남음.

---

## ⚠ 즉시 필요한 운영 액션 (사용자 작업)

### 1. Lightsail 게이트웨이 재배포 (PR-6 송장 마스킹 반영)
PR-6 이 `infra/aws-lightsail-gateway/main.ts` 의 `maskUrl` 에 `reqdelivery` path 송장/dlvNo 마스킹 추가 → 코드 머지만으론 운영 박스 미반영. SSH 재배포 필요:
```bash
scp infra/aws-lightsail-gateway/main.ts ubuntu@3.36.239.243:/tmp/main.ts
ssh ubuntu@3.36.239.243 'sudo install -o marketgw -g marketgw -m 0644 /tmp/main.ts /opt/market-gateway/main.ts && sudo systemctl restart market-gateway && systemctl is-active market-gateway'
curl.exe -i https://3-36-239-243.sslip.io/healthz
```

### 2. dev 마이그 이력 정합 (C1 잔여)
`esm_shipping_profiles` 는 테이블은 제거됐으나 `supabase_migrations` 이력 미정합(생성·DROP 모두 SQL Editor 직접). login 후:
```bash
pnpm db:push:dev   # --include-all, 충돌 시 이월 마이그(20260523~30) 정합 동반
```
(real 엔 esm_shipping_profiles 미적용이라 무관.)

---

## ⚠ carry-over 백로그 (v1 머지 차단 아님)

| # | 항목 | 사유 / 진입 |
|---|---|---|
| **C3** | **real 실호출 검증** (5마켓 전부 mock+parity 까지만) | 셀러 자격증명 + IP `3.36.239.243` 화이트리스트 → 키 발급 후 1회 실호출. **현재 키 미발급으로 보류.** parity captured-real 활성 |
| **C4** | **11번가 상품군(officialNotice) 코드 마스터** | spec 1003 의 `ProductNotification` 41군 코드가 외부 첨부파일 → 1군만 확보, 40군 셀러 free-form. 첨부/고시 조회 API 확보 시 보강 |
| **NEW-1** | **dlvNo plumbing** (11번가 발송) | PR-5 `submitTracking` 이 `dlvNo` 받으려면 `orders` 테이블 `extra.dlvNo` 적재 + 워커(`shipping-dispatch-market-worker`)/`orders-repo` 전달 경로 (orders 마이그 동반) |
| **NEW-2** | **11번가 KC인증 certRequiredYn 워커 plumbing** | PR-3 transformProduct 는 `mapping.extra.certRequiredYn` 수용 준비됨. 오케스트레이터(워커 data-load)가 카테고리 cert 메타 → certRequiredYn 주입 경로 필요 |
| **C5** | **PR-3 이미지 ≥13장 truncate** | warning 처리됨 — 추가 UX(사전 경고) v2 |
| **C7** | **잠재 Deno 타입 에러** | `deno check` 발견 3건(audit sellerId / eleven-st expiresAt / validate enum). vitest 미검출. enum 누락(③)은 런타임 영향 가능 → 우선 점검 |
| **C8** | **Deno 전용 테스트 CI 미실행** | 신규 Edge 는 pure 모듈 분리 vitest 로 커버 중(carrier-codes/xml/normalize). 잔여 deno.land import 테스트는 미실행 |
| **C6** | **mcp_ro_dev `supabase_migrations` read GRANT** | 없어서 MCP 로 dev 마이그 이력 조회 불가(편의). `esm.md §5.4` 보강 고려 |

---

## 스택 한눈에

```
프론트:  React 18 + Vite + TS strict + shadcn + Tailwind + TanStack Query + RHF + zod + Tiptap + Daum Postcode + DOMPurify
백엔드:  Supabase (Postgres + RLS + Auth + Storage + Realtime + Edge Functions Deno + pg_cron + Vault)
         + AWS Lightsail Market Gateway (서울, 3.36.239.243, HMAC + 호스트 화이트리스트)
호스팅:  GitHub Pages (정적 SPA + 404.html) + Supabase Cloud
모니터링: Sentry (PII 마스킹 강제)
CI/CD:   GitHub Actions (PR 8잡: Lint&Typecheck / Unit / Build dev·real / E2E Golden·a11y / Zod Mirror / pgTAP RLS)
브랜치:  Git Flow (main / develop / release/* / feature/* / hotfix/*) — feature base = develop, squash-only, strict(up-to-date)
빌드모드: VITE_APP_MODE=dev|real + VITE_USE_MOCK=true|false
MCP 호스팅: Lightsail 3.36.239.243 docker-compose (supabase-dev=뭄바이풀러 / supabase-real=서울풀러 / playwright / sentry)
```

## 도메인 모델

```
상품 등록 (s1~s6)
Seller (auth.users) ─┬─ MarketAccount ── credential_payload jsonb + pgcrypto
                     │     (배송 Layer 2 = 마켓 콘솔 등록분 GET 조회 → select, 우리 DB 저장 없음 ★조회형 단일표준)
                     ├─ Product ─┬─ ProductImage ─ ImageTransform (마켓별 N)
                     │           └─ ProductMarketMapping (카테고리 + marketOptions: 출고지/반품지·officialNotice)
                     ├─ RegistrationJob ─── JobMarketResult (1:N)
                     └─ ShippingPolicy (Layer 1 = 요금 의도, 어댑터가 마켓별 인라인 매핑)
주문·배송 (s7~s9): Order → OrderGroup / ShippingJob → ShippingJobResult / LogenCredentials
공통: _shared/carrier-codes.ts (택배사 단일소스) · _shared/xml.ts (ns2 파서)
```

## 완료된 작업 (요약)

| 단계 | 내용 | 비고 |
|---|---|---|
| Stage A~D / v0.4~v0.11 | 부트스트랩 + s1~s6 + 4마켓 어댑터 + 주문배송 + WYSIWYG + Gateway + 운영안전망 | 운영 배포 |
| v0.14~v0.15.1 | hookify + 11번가 placeholder + 5마켓 주문 수집 + hotfix | 운영 배포 |
| 쿠팡 drift (#245~#250) | 카테고리·발주서 v5·송장·안심번호·페이징 | v0.16 포함 |
| ESM 재구현 (#255~#262) | G마켓·옥션 문서 기준 8 PR (mock+parity) | v0.16 포함 |
| **v0.16 (#270~#279)** | **11번가 재구현 PR-0~6 + ESM 조회형 전환 E1~E5** | **release 진행 중** |

## 운영 현황

- **운영 배포 URL**: `https://rumeadia-dotcom.github.io/ing0415/` · 직전 deploy v0.15.1 (success)
- **dev Supabase** (`eqoyw`, 뭄바이): `esm_shipping_profiles` DROP 완료. 마이그 이력 정합 미완(C1).
- **real Supabase** (`lfrny`, 서울): ESM/11번가 신규 마이그 미적용 (real DB 변경 없음 — 어댑터·Edge 코드만).
- **Lightsail 게이트웨이**: allowlist 반영됨. maskUrl(PR-6) 재배포 대기.
- **MCP supabase-dev**: 정상 (뭄바이 풀러).

---

## 다음 세션 진입

```bash
git pull origin develop && pnpm install && pnpm test -- --run
```
**1352 passed** 확인 후 진입.

### 우선 순위
1. **운영 액션 2건** — Lightsail 재배포(maskUrl) + dev 마이그 이력 정합(C1).
2. **C3 real 실호출 검증** — 셀러 키 발급 + IP 화이트리스트 후 5마켓 1회 실호출. **핵심 게이트** (현재 키 미발급 보류).
3. **NEW-1/NEW-2 plumbing** — 11번가 dlvNo(발송) + KC certRequiredYn(상품등록) 워커 경로. **C7 Deno 타입 에러 ③ 우선 점검**.

> v0.16 이후 release 는 C3 실호출 검증 후 사용자 결정.

---

## 백로그 (v1 이후 / 영구 보류)

- 11번가 멀티옵션·클레임·정산·기획전 / 11번가 상품군 코드 마스터(C4) / Layer 2 등록 API(우리가 생성) — v2
- 알림 / CSV / 오류 통계 차트 / 이미지 WebP — 미진입 v1 스코프
- 쿠팡 미구현 endpoint(출고지/반품지/상품수정·조회·삭제) — v2
- s4 템플릿 / 소셜 / 2FA / Stripe·PG / 멀티유저 권한 — v2~보류

---

## ⚠ 룰 강제 메모

### Git Flow / 병렬 PR (CLAUDE.md §Rules)
- 새 feature/* 는 **반드시 develop 분기**. worktree 에이전트 prompt 에 `git fetch origin develop && git checkout -B feature/X origin/develop` 강제.
- develop strict "behind" — 순차 머지 시 다음 PR `git rebase origin/develop` → 충돌 해소(공통파일: eleven-st(-map).ts, parity.spec, schemas, ko.ts) → `push --force-with-lease` → **새 CI run 등록 40s 대기 후** watch → 머지.

### worktree Windows 삭제 이슈
- `git worktree remove -f -f` 가 "Filename too long"(node_modules 깊은 경로). git 등록은 prune 으로 정리되나 `.claude/worktrees/agent-*` 폴더 잔재. 점유 해제 후 수동 `rm -rf`.

### 운영 인프라 SSH / DB write
- Lightsail SSH·dev/real DROP 등 파괴적·공유 인프라 작업은 auto 분류기가 차단 → 사용자 직접 실행 또는 settings 권한 룰 필요. MCP supabase 는 read-only(write 불가).

### gh CLI / SSH
- gh: `C:\Program Files\GitHub CLI\gh.exe` (절대경로). 박스 SSH: `ssh ubuntu@3.36.239.243`.
