# MarketCast — WIP 핸드오프 (ESM 문서 기준 재구현 8 PR develop 완료 + dev 검증)

**develop HEAD**: `2bf4c80` — feat(esm): 상품정보고시 입력단계 (PR-5) (#262)
**main HEAD**: `262c778` — hotfix: v0.15.1 (#237) · main 미배포 누적 = 쿠팡 drift 6 PR + ESM 8 PR (**release 는 사용자 결정 — 실호출 검증 전 배포 금지**)
**테스트**: 1138 passed / 1 skipped / 31 todo
**최근 머지**: ESM 재구현 #255~#262

---

## 2026-05-30 세션 #1 — ESM(G마켓·옥션) 문서 기준 재구현 8 PR

기존 ESM 어댑터가 **실제 스펙 이전 placeholder** 였던 것을 `docs/architecture/v1/features/esm-api/` 119문서 기준으로 전면 재작성. Wave 0 → 1(4 병렬) → 2(순차 3), 각 PR worktree 격리 + ing-* 구현 + qa/security 검수.

| PR | 내용 | merge |
|---|---|---|
| #255 | **PR-0** 스키마 계약 + base URL (`sa.esmplus.com/api/v1`→`sa2.esmplus.com/item/v1`) + 설계문서 `features/esm.md` | `c4c983e` |
| #256 | **PR-1** JWT payload 정합 (kid/iss/ssi `{site}:{sellerId}` 단일) | `32191f1` |
| #257 | **PR-2** 카테고리 site-cats 재작성 + gateway allowlist `sa2.esmplus.com` | `4356ea9` |
| #258 | **PR-6** 주문/배송 fetchOrders·submitTracking 문서 기준 정정 | `c22a34b` |
| #259 | **PR-3** 배송 프로필 — `esm_shipping_profiles` + RLS + 4단계 생성 Edge + 설정 UI | `daa24ae` |
| #260 | **PR-3.5** 동적 등록필드 — `getRegistrationFields` + `MarketOptionsCard` | `38e68f4` |
| #261 | **PR-4** 상품등록 재작성 — transformProduct 중첩 + createProduct `POST /item/v1/goods` | `edd1674` |
| #262 | **PR-5** 상품정보고시 — 41 상품군 + officialNotice 입력 UI | `2bf4c80` |

**핵심 결정** (esm.md §1): ①사이트별 분리(어댑터 내부 siteType 단일 호출) ②범위=상품등록+주문/배송 ③배송 선행값=배송 프로필 사전 생성·재사용 ④고시 입력단계 ⑤마켓별 동적 등록필드(어댑터 메타, 하드코딩 0) ⑥real 검증=mock+parity 까지.
**범위 한계**: **mock+parity 까지만 검증됨.** real sa2.esmplus.com 실호출은 미검증 (C2/C3 선행).

## 2026-05-30 세션 #2 — dev MCP 운영 사고 복구 + dev DB 검증

**증상**: MCP `supabase-dev` 가 `select 1` 도 30s 타임아웃 (real 은 정상).
**근본 원인**: dev 무료 프로젝트 풀러 호스트가 **뭄바이(`aws-1-ap-south-1`)** 인데 `/etc/mcp-hosting/env` 의 `DATABASE_URI_DEV` 가 real 과 같은 **서울(`aws-1-ap-northeast-2`)** 로 오설정 → 서울 풀러에 dev 테넌트 없음 → `FATAL: (ENOTFOUND) tenant/user not found`. `mcp_ro_dev` role 유실도 동반. (dev DB·호스팅·real MCP 는 전부 정상이었음.)
**복구 (완료)**: ① env `DATABASE_URI_DEV` 호스트 region 정정(real 보호) ② `mcp_ro_dev` role 재생성(esm.md §5.4) ③ env-source 재기동 ④ `/mcp` 재연결. → 정상. 상세 트러블슈팅은 `mcp-hosting.md §9.3.1` 에 박음.

**dev DB 검증 (B)**: `esm_shipping_profiles` 마이그를 dev **SQL Editor 로 직접 적용** → MCP 로 정합 검증 완료:
- 테이블 ✅ / RLS `seller_id=auth.uid()` ✅ / partial CHECK(active_nums) ✅ / 6 checks·4 indexes ✅ / GRANT(`authenticated=SELECT`, `service_role=ALL`) ✅ / `audit_log` category `shipping` 추가 ✅ / Realtime ✅
- → dev 스키마·RLS·보안 경계가 esm.md §3 계약과 100% 일치.

---

## ⚠ carry-over 백로그 (전부 v1 머지 차단 아님)

| # | 항목 | 출처 | 사유 / 진입 |
|---|---|---|---|
| **C1** | dev 마이그 **히스토리 정합** — `esm_shipping_profiles` 는 SQL Editor 직접 적용(테이블·RLS 검증 완료)이라 `supabase_migrations` 이력에 **미기록**. 이월 마이그(20260523~29)도 적용 여부 미확인 | 세션#2 | login 후 `pnpm db:push:dev` 시 esm 마이그가 "이미 존재" 충돌 → `--include-all` 또는 해당 버전 applied 마킹. `functions:deploy:dev` 로 esm-shipping-profile 배포 |
| **C2** | **Lightsail Gateway 재배포** — `gateway-sign.ts` 엔 `sa2.esmplus.com` 추가됨, 박스 `infra/aws-lightsail-gateway/main.ts` `ALLOWED_*` 미러 + 재배포 필요 | PR-2 | ops. 미반영 시 real ESM 호출 게이트웨이 거부 |
| **C3** | **real ESM 실호출 검증** — mock+parity 까지만. 셀러 자격증명(masterId/secretKey/sellerId) + IP 화이트리스트 `3.36.239.243` 필요 | 전반 | ESM 셀러관리(G·옥션) IP 등록 → 키 발급 → 1회 실호출로 createProduct·site-cats·배송프로필 4단계 검증. parity §5 captured-real 활성 |
| **C4** | **PR-5 라이브 codes API** — `/official-notice/groups/{no}/codes` 연동 + 정적 항목 검증 | PR-5 | 문서 161.md 가 41군 중 sample 2건만 제공 → 정적코드 없는 군은 셀러 free-form. C2/C3 후 동적 폼 |
| **C5** | **PR-4 이미지 16장째 무음 드롭** — `urls.slice(1,15)` 16번째 warning 없이 누락 | PR-4 | `CreateProductResult.warnings` 에 `images_truncated` (v2) |
| **C6** | **mcp_ro_dev `supabase_migrations` read GRANT** — 없어서 MCP 로 dev 마이그 이력 조회 불가(편의) | 세션#2 | esm.md §5.4 에 `grant usage on schema supabase_migrations` + `grant select on schema_migrations` 추가 고려 |

---

## 스택 한눈에

```
프론트:  React 18 + Vite + TS strict + shadcn + Tailwind + TanStack Query + RHF + zod + Tiptap + Daum Postcode + DOMPurify
백엔드:  Supabase (Postgres + RLS + Auth + Storage + Realtime + Edge Functions Deno + pg_cron + Vault)
         + AWS Lightsail Market Gateway (서울, 3.36.239.243, HMAC + 호스트 화이트리스트)
호스팅:  GitHub Pages (정적 SPA + 404.html) + Supabase Cloud
모니터링: Sentry (PII 마스킹 강제)
CI/CD:   GitHub Actions (PR 8잡: Lint&Typecheck / Unit / Build dev·real / E2E Golden·a11y / Zod Mirror / pgTAP RLS)
브랜치:  Git Flow (main / develop / release/* / feature/* / hotfix/*) — feature base = develop
         develop ruleset = PR + 0 approval + thread resolution + 8 status checks + squash-only + strict(up-to-date)
빌드모드: VITE_APP_MODE=dev|real + VITE_USE_MOCK=true|false
MCP 호스팅: Lightsail 3.36.239.243 docker-compose (supabase-dev=뭄바이풀러 / supabase-real=서울풀러 / playwright / sentry)
```

## 도메인 모델

```
상품 등록 (s1~s6)
Seller (auth.users) ─┬─ MarketAccount ─┬─ credential_payload jsonb + pgcrypto
                     │                 └─ esm_shipping_profiles (ESM 배송 선행값: addr/place/dispatch 번호) ★
                     ├─ Product ─┬─ ProductImage ─ ImageTransform (마켓별 N)
                     │           └─ ProductMarketMapping (카테고리 + marketOptions: 배송프로필·officialNotice) ★
                     ├─ RegistrationJob ─── JobMarketResult (1:N)
                     └─ ShippingPolicy
주문·배송 (s7~s9): Order → OrderGroup / ShippingJob → ShippingJobResult / LogenCredentials
```

## 완료된 작업 (요약)

| 단계 | 내용 | 비고 |
|---|---|---|
| Stage A~D / v0.4~v0.11 | 부트스트랩 + s1~s6 + 4마켓 어댑터 + 주문배송 자동화 + WYSIWYG + Gateway + 운영안전망 | 운영 배포 |
| v0.15 (#233~#235) | 11번가 v1 real 어댑터 + 5마켓 주문 수집 | 운영 배포 v0.15.1 |
| 쿠팡 drift (#245/#246/#248~#250) | 카테고리·발주서 v5·송장·안심번호·페이징 | develop 누적 (미배포) |
| **ESM 재구현 (#255~#262)** | **G마켓·옥션 문서 기준 8 PR (mock+parity 완성)** | **develop 누적 (미배포)** |

## 운영 현황

- **운영 배포 URL**: `https://rumeadia-dotcom.github.io/ing0415/` · 최근 deploy v0.15.1
- **dev Supabase** (`eqoyw`, 뭄바이): `esm_shipping_profiles` **적용·검증됨** (SQL Editor 직접 — 이력 미기록, C1). 이월 마이그 적용 여부 미확인.
- **real Supabase** (`lfrny`, 서울): ESM 마이그 미적용.
- **MCP supabase-dev**: 복구 완료 (env region 정정 + role 재생성).

---

## 다음 세션 진입

```bash
git pull origin develop && pnpm install && pnpm test -- --run
```
**1138 passed** 확인 후 진입.

### 우선 순위
1. **C2 Gateway 재배포** — `infra/aws-lightsail-gateway/main.ts` `ALLOWED_*` 에 `sa2.esmplus.com` 미러 + 재배포. C3/C4 전제.
2. **C3 real ESM 실호출 검증** — 셀러 키 + IP `3.36.239.243` 등록 후 1회 실호출로 createProduct(`/item/v1/goods`)·site-cats·배송프로필 4단계 검증. parity §5 captured-real 활성. **"완벽 개발+테스트" 의 핵심 게이트.**
3. **C1 dev 마이그 이력 정합** — login 후 `db:push:dev`(`--include-all`) + `functions:deploy:dev`.
4. **C4 PR-5 라이브 codes API** — 정적 항목 검증 refine.
5. **C5 이미지 16장째 warnings** (v2 여유).

> release(main 배포)는 위 실호출 검증이 끝난 뒤 **사용자가 결정**. WIP 가 임의로 권하지 않는다.

---

## 백로그 (v1 이후 / 영구 보류)

- 11번가 발급 키 실호출 최종 검증 (어댑터 본체 완료) / 택배사 안심번호 호환 / paid_at·ordered_at 백필 — v2
- 알림 / CSV / 오류 통계 차트 / 이미지 WebP — 미진입 v1 스코프
- 쿠팡 미구현 endpoint(출고지/반품지/상품수정·조회·삭제/배송전이) — v2
- s4 템플릿 / 소셜 / 2FA / Stripe·PG / 멀티유저 권한 — v2~보류

---

## ⚠ 룰 강제 메모

### Git Flow (CLAUDE.md §Rules)
- 새 feature/* 는 **반드시 develop 분기**. Agent isolation:"worktree" default base=main → `git fetch origin develop && git checkout -B feature/X origin/develop` 강제.

### develop strict "behind" — 순차 머지 시 rebase 필수 (ESM Wave 1 사례)
- 한 PR 머지로 develop advance 시 나머지 PR 이 "8 of 8 required status checks are expected" 로 머지 거부.
- 해소: 다음 PR worktree `git fetch origin && git rebase origin/develop` → 충돌 해소(gateway-sign.ts·esm.md 등 공통파일 흔함) → `git push --force-with-lease` → **새 CI run 등록 30s 대기 후** watch (force push 직후 watch 는 옛 run 캐시를 잡아 머지 거부).

### MCP supabase-dev 풀러 region (세션#2 사고)
- dev=**뭄바이 `aws-1-ap-south-1`**, real=**서울 `aws-1-ap-northeast-2`** — 호스트 다름. `DATABASE_URI_*` 통일 금지. `tenant/user not found` 시 호스트 region 의심. 진단·복구는 `mcp-hosting.md §9.3.1`.
- 박스 MCP 재기동은 env-source 필요: `sudo bash -c 'set -a; . /etc/mcp-hosting/env; set +a; cd /opt/mcp-hosting && docker compose up -d postgres-mcp-dev'`. 단독 `up -d` 는 `${DATABASE_URI_DEV}` 보간 실패로 컨테이너 죽음.

### worktree 디렉토리 Windows 삭제 이슈
- `git worktree remove --force` 가 "Invalid argument"(파일 점유) — `prune`/`branch -D` 로 git 등록은 정리되나 `../ing0415-wt/*` 폴더 잔재. 점유 해제 후 수동 `rm -rf`.

### gh CLI / SSH
- gh: `C:\Program Files\GitHub CLI\gh.exe` (PATH 미등록 — 절대경로). 인증됨(rumeadia-dotcom, repo scope).
- 박스 SSH: `ssh ubuntu@3.36.239.243` (`~/.ssh/config` 에 IP→`LightsailDefaultKey-ap-northeast-2.pem` 등록 완료, BOM 없는 UTF-8).

### 신규 스킬 (세션#1)
- `.claude/skills/dev-preview/` — 로컬 Vite(mock) 서버 + 사용자 Chrome 띄우기 (포트 폴백 자동, 원격 Playwright 의 localhost 미접근 제약 반영).
