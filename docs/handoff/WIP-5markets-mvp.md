# MarketCast — WIP 핸드오프 (11번가 spec 재검토 + Layer 2 조회형 단일화 + 11번가 PR-0 완료)

**develop HEAD**: `baf4125` — docs(handoff): WIP 11번가 PR-0 반영 (#268)
**main HEAD**: `262c778` — hotfix: v0.15.1 (#237) · main 미배포 누적 = 쿠팡 drift 6 PR + ESM 8 PR + 11번가 설계·PR-0 (**release 는 사용자 결정 — 실호출 검증 전 배포 금지**)
**테스트**: 1164 passed / 1 skipped / 31 todo
**최근 머지**: 11번가 #266(설계)·#267(PR-0)·#268(WIP) / ESM 재구현 #255~#262

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

## 2026-05-30 세션 #3 — 배송비 모델 정립 + Layer 1 fee 해소 버그픽스 (진행 중)

**계기**: 상품등록 1단계 "배송 정책"(`shipping_policies`) vs ESM "배송 프로필"(`esm_shipping_profiles`) 중복 의문. 4 마켓(쿠팡/ESM/네이버/11번가) 실제 배송비 API 조사 결과 → **중복 아님, 직교하는 2 레이어**로 결론.

- **신규 설계문서**: `cross-cutting/shipping-fee-model.md` — 4 마켓 비교표 + 2-레이어 결정(Layer 1=배송 정책=요금 의도 / Layer 2=배송 프로필=물류 참조) + 마켓별 fee 필드 매핑 + 구현 5단계 + 출처. registration.md §3.2 / esm.md §3 에 역참조 추가.
- **조사 핵심**: 4 마켓 전부 하이브리드 — 배송비 *금액*은 대부분 인라인(ESM 묶음만 정책 참조), **출고지/반품지 주소는 예외 없이 사전 생성 참조**(보편 패턴, ESM 만이 아님).
- **Step 1 버그픽스 (TDD, feature/shipping-fee-resolve)**: 워커 `data-load.ts` + validate `check.ts` 가 `shippingFeeKrw: 0` 하드코딩 → `shipping_policy_id`→`shipping_policies.fee` 미해소. 셀러 배송비가 네이버/쿠팡/11번가 등록에 0 으로 나가던 버그.
  - `_shared/shipping-fee.ts` `resolveShippingFee()` 신규 + barrel export. 워커/validate 양쪽 연결. vitest 3 케이스(`_shared/__tests__/shipping-fee.test.ts`).
  - **전체 1141 passed** (1138+3) / typecheck·lint clean.

**남은 단계 (shipping-fee-model.md §4)**: Step 2 배송 정책 enrich(feeType/조건부무료/반품비/도서산간) → Step 3 어댑터 인라인 매핑 → Step 4 Layer 2(출고지/반품지) 마켓 범용화 → Step 5 ESM fee 연결.

---

## 2026-05-30 세션 #4 — 11번가 spec import 대조 + Layer 2 조회형 단일화 결정 (설계문서만)

11번가 셀러 OpenAPI spec import(#265, 145 API) 와 현 어댑터 대조 → **11번가 어댑터도 ESM 처럼 placeholder, 5메서드 전부 실제 spec 불일치** 확정. 이어 배송 Layer 2 모델을 전면 재정립. **코드 변경 없이 설계문서 9개만 정정.**

- **11번가 재검토**: 어댑터(`eleven-st*.ts`)가 `OpenApiService.tmall?apiCode=` 레거시 추정 호출 — 실제는 `api.11st.co.kr/rest/<service>`. 카테고리/상품등록/주문/발송 전부 URL·필드·응답root(`ns2:`/`ClientMessage`) 불일치. 상품등록 필수필드 대량 누락 → real 100% 실패. (`market-adapter.md §9.9` 마스터.)
- **신규 설계문서**: `features/11st.md` — ESM `esm.md` 패턴, 6 PR 재구현 로드맵 + zod 계약 + Layer 2 + cross-market 공통화(출고지·고시·택배사코드·ns2).
- **Layer 2 조회형 단일화 (B안, 사용자 승인)**: 출고지/반품지 사전참조가 5마켓 보편 패턴임이 확정되고, ESM 도 조회 API(출하지 17/발송정책 19 전체조회 GET)가 전부 있어 **생성형이 API 강제가 아님**이 드러남. → **5마켓 전부 "마켓 콘솔 등록분 GET 조회 → select" 조회형으로 통일.** ESM 생성형(`esm_shipping_profiles` 테이블 + 생성 Edge + 생성 UI)은 **deprecate** (PR-E1~E5 로드맵, `esm.md` 전환 결정 절).
- **정정한 설계문서 9개**: `market-adapter.md`(§9.0 base URL 오기·§9.9 신설·§9.8 optionsSource·O-11), `markets.md §3.2`(11번가 placeholder), `shipping-fee-model.md`(Layer 2 조회형·11번가 필드 확정), `features/11st.md`(신규), `features/esm.md`(전환 결정 절+supersede), `registration.md §10.5`(조회형), `user_flow.md`(n61 deprecate), `design-renewal/{s9-settings,s3-register}.md`.
- **CLAUDE.md 규칙 추가**: 존댓말 / "수정 작업 전 전체 영향범위 전수조사(누락 금지)" / 메모리 포터블(레포) 우선.

**이어서 11번가 PR-0 구현 머지 (#267)**: zod 계약(`schemas/eleven-st.ts` + Edge 미러)·REST base 상수(`ELEVEN_ST_REST_BASE`)·ns2 파서(`stripNsPrefix`)·gateway allowlist(`api.11st.co.kr`). **build-green 정련**: 신규는 additive, 구 placeholder(`OpenApiService.tmall`/apiCode·`openapi.11st.co.kr`)는 호출부 재작성(PR-1)까지 병존. 신규 25 tests, 1164 passed, typecheck/lint clean.

> **남은 코드 트랙** — 11번가 PR-1~6(`features/11st.md`)·ESM 조회형 전환 PR-E1~E5(`esm.md` 전환 결정 절). PR-1 부터 placeholder 호출부 실제 재작성(동작 변경). real 검증(C3) 일정과 함께 사용자 결정.

## ⚠ carry-over 백로그 (전부 v1 머지 차단 아님)

| # | 항목 | 출처 | 사유 / 진입 |
|---|---|---|---|
| **C1** | dev 마이그 **히스토리 정합** — `esm_shipping_profiles` 는 SQL Editor 직접 적용이라 `supabase_migrations` 이력 **미기록**. 이월 마이그(20260523~29) 적용 여부 미확인 | 세션#2 | ⚠️ **PR-E4(세션#4)에서 DROP 마이그 `apps/api/supabase/migrations/20260530000002_drop_esm_shipping_profiles.sql` 작성됨 (dev/real 미적용).** 머지 후 login → `db:push:dev --include-all` 로 CREATE(20260530000001)+DROP(20260530000002) 이력 정합 동반 적용. real 도 동일 순서. |
| **C9** | **11번가 어댑터 전면 재구현** — 현 placeholder, 5메서드 실제 spec 불일치. `features/11st.md` PR-0~6. real 실호출 검증(C3 계열) 동반 | 세션#4 | **PR-0 머지됨 (#267, develop `b7f447a`)** — zod 계약·REST base·ns2 파서·gateway allowlist(additive, 구 상수 병존). **남은: PR-1(카테고리 cateservice 재작성·구 apiCode 제거) → PR-2(출고지/반품지 조회형 select) → PR-3(상품등록) → PR-4(고시, 상품군 코드 마스터 추출 선행) → PR-5(주문/발송) → PR-6(cross-market).** PR-1 부터 호출부 실제 재작성(placeholder 제거) |
| **C10** | **ESM 생성형 → 조회형 전환** — `esm_shipping_profiles` 테이블+생성 Edge(`esm-shipping-profile`)+생성 UI(`SettingsShippingEsmProfilesPage` 등) deprecate, ESM GET 조회(`/shipping/places`·`/dispatch-policies`)로 select. n61 노드 제거 | 세션#4 | **PR-E1·E2 머지됨 (조회형 동작). PR-E3+E4 통합 PR 진행 — 생성형 FE/BE/스키마/워커 제거 + DROP 마이그 작성(dev 미적용, C1).** 남은: **PR-E5** — `shippingProfile` kind / `shippingProfiles` optionsSource enum 값 제거(현재 negative-assertion 테스트 리터럴 참조 → 보존 중) + `locales/ko.ts` `shippingProfile`/`esmProfilesCard` 문구 정리 + `debug/createMockAdapter.ts`/`_shared/market-adapters/debug.ts` 점검. 셀러 온보딩 friction(ESM Plus 직접 설정 안내) 보강. `esm.md` 전환 결정 절 PR-E1~E5. |
| **C2** | **Lightsail Gateway 재배포** — `gateway-sign.ts` 엔 `sa2.esmplus.com` 추가됨, 박스 `infra/aws-lightsail-gateway/main.ts` `ALLOWED_*` 미러 + 재배포 필요 | PR-2 | ops. 미반영 시 real ESM 호출 게이트웨이 거부 |
| **C3** | **real ESM 실호출 검증** — mock+parity 까지만. 셀러 자격증명(masterId/secretKey/sellerId) + IP 화이트리스트 `3.36.239.243` 필요 | 전반 | ESM 셀러관리(G·옥션) IP 등록 → 키 발급 → 1회 실호출로 createProduct·site-cats·배송프로필 4단계 검증. parity §5 captured-real 활성 |
| **C4** | **PR-5 라이브 codes API** — `/official-notice/groups/{no}/codes` 연동 + 정적 항목 검증 | PR-5 | 문서 161.md 가 41군 중 sample 2건만 제공 → 정적코드 없는 군은 셀러 free-form. C2/C3 후 동적 폼 |
| **C5** | **PR-4 이미지 16장째 무음 드롭** — `urls.slice(1,15)` 16번째 warning 없이 누락 | PR-4 | `CreateProductResult.warnings` 에 `images_truncated` (v2) |
| **C6** | **mcp_ro_dev `supabase_migrations` read GRANT** — 없어서 MCP 로 dev 마이그 이력 조회 불가(편의) | 세션#2 | esm.md §5.4 에 `grant usage on schema supabase_migrations` + `grant select on schema_migrations` 추가 고려 |
| **C7** | **잠재 Deno 타입 에러 3건** — 세션#3 에서 deno 최초 설치 후 `deno check` 로 발견. ①`_shared/audit.ts:77/89` sellerId `string\|null`→`LogContext.sellerId?:string` ②`_shared/market-adapters/eleven-st.ts:228`+`schemas.ts:130` `expiresAt:null` vs `string` ③`registration-validate/lib/check.ts:106` `'description_html_unsafe'` 가 `ValidationIssueCode` enum 미포함 | 세션#3 | 전부 기존 버그(이번 변경 무관). deno 미설치라 그간 미검출. enum 누락(③)은 응답 직렬화 시 런타임 영향 가능 → 우선 점검 |
| **C8** | **Deno 전용 테스트 CI 미실행** — `deno test`+deno.land import 쓰는 테스트(orders-sync/coupang-orders/esm-orders 등)는 vitest exclude + CI 에 deno 없음 → 사실상 미실행. | 세션#3 | 신규 Edge 테스트는 **vitest 호환**으로 작성(가능 시) 또는 CI 에 deno step 추가 결정 필요 |
| **S2~S5** | **배송비 2-레이어 후속** — Step 2 배송정책 enrich / Step 3 어댑터 인라인 매핑(쿠팡·네이버·11번가) / Step 4 **Layer 2 조회형 단일화**(5마켓 출고지·반품지 GET 조회 select, 테이블 없음 — 세션#4 결정) / Step 5 ESM fee 는 정책에 묶여 비적용(정보성) | 세션#3·#4 | `shipping-fee-model.md §2/§4`. Step 4 는 real 검증(C3)·C9(11번가)·C10(ESM 전환) 연계. 쿠팡/네이버 어댑터 출고지·반품지 미전송 → real 거부 위험 동반 |

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
| v0.15 (#233~#235) | 11번가 "v1 real 어댑터"(⚠️ 실은 placeholder — #266 에서 확정) + 5마켓 주문 수집 | 운영 배포 v0.15.1 |
| 쿠팡 drift (#245/#246/#248~#250) | 카테고리·발주서 v5·송장·안심번호·페이징 | develop 누적 (미배포) |
| ESM 재구현 (#255~#262) | G마켓·옥션 문서 기준 8 PR (mock+parity 완성) | develop 누적 (미배포) |
| **11번가 (#266~#268)** | **spec 재검토 + Layer 2 조회형 단일화 설계 + PR-0(계약·파서·base)** | **develop 누적 (미배포). PR-1~6 남음** |

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
**1164 passed** 확인 후 진입.

### 우선 순위
1. **C9 11번가 PR-1** — 카테고리 `fetchCategoryTree` cateservice(`GET /rest/cateservice/category` + ns2 `stripNsPrefix` + depth/parentId 트리) 재작성 + 구 apiCode placeholder 제거 시작. `features/11st.md` §7 PR-1. (PR-0 토대 머지됨 #267.)
2. **C2 Gateway 재배포** — `infra/aws-lightsail-gateway/main.ts` `ALLOWED_*` 에 `sa2.esmplus.com` + `api.11st.co.kr` 미러 + 재배포. C3/C4 전제.
3. **C3 real ESM 실호출 검증** — 셀러 키 + IP `3.36.239.243` 등록 후 1회 실호출 검증. parity §5 captured-real 활성. **핵심 게이트.**
4. **C1 dev 마이그 이력 정합** — login 후 `db:push:dev`(`--include-all`) + `functions:deploy:dev`. (C10 ESM 전환 시 `esm_shipping_profiles` DROP 동반.)
5. **C10 ESM 조회형 전환 PR-E1~** / **C4 11번가 고시 상품군 코드 마스터 추출**.

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
