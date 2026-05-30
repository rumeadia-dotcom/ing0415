# features/esm.md — ESM(G마켓·옥션) 어댑터 문서 기준 재구현 종합 설계 (v1)

> 본 문서는 **다중 마켓 상품 자동 등록 SaaS** 의 ESM(ebay Sales Manager — G마켓·옥션 통합 백오피스) 어댑터를 **공식 API 문서(`docs/architecture/v1/features/esm-api/`, 119개 마크다운) 기준으로 재구현**하기 위한 단일 설계 문서다. architect·backend·frontend·designer·qa·security 관점을 통합한다.
>
> **작성 책임**: architect 주도 (PR-0 계약 확정). backend / frontend / security / qa 리뷰 후 머지.
> **승인**: architect + security.
> **의존**: `docs/architecture/v1/platform.md`, `frontend.md`, `ui-system.md`, `security.md`, `testing.md`, `cross-cutting/market-adapter.md`, `cross-cutting/credential-vault.md`, `cross-cutting/market-gateway.md`, `features/markets.md`, `features/registration.md`, `features/settings-shipping.md`.
> **차단 권한**: 본 문서(PR-0)가 머지되기 전까지 ESM 어댑터 재작성 PR(PR-1~PR-6) **금지** — PR-0 가 zod 스키마 계약·base URL·테이블을 고정해야 후속 PR 이 병렬 안전.
> **근거**: PRD §1.1 / §1.2 / §1.3 / §1.4, `esm-api/` 공식 문서, CLAUDE.md "마켓 어댑터 추상화" / "외부 API 로깅 패턴" / "MVP 범위 v1", `user_flow.md` s3 / s5.

---

## ⚠ 전환 결정 (2026-05-30): 생성형 → 조회형 (B안, 사용자 승인) — ✅ 전환 완료 (5/5)

> **상태 (2026-05-30): 전환 완료 (PR-E1~E5 머지).** 생성형 배송 프로필(테이블·UI·훅·Edge·생성 API)은 PR-E3/E4 에서 제거됐고, 잔존 enum(`shippingProfile` kind / `shippingProfiles` optionsSource)·i18n(`shippingProfile*`/`esmProfilesCard`/`esmProfiles`)은 PR-E5 에서 제거됐다. ESM 배송 Layer 2 는 조회형(`esmShippingPlace`/`esmDispatchPolicy` — `esm-shipping-list` GET 조회 → select)으로 단일화됐으며 11번가/네이버/쿠팡과 동일 표준(`cross-cutting/shipping-fee-model.md` §2)을 따른다. 아래 절들은 전환 과정의 기록이다.

> **본 절은 §1 결정 3 / §3 (`esm_shipping_profiles` 테이블) / §5 배송 프로필 생성 UI / §7 PR-3 / §4.5 를 supersede 한다.** 아래 transition 로드맵이 우선이며, 위 절들은 "이미 구현된 생성형(deprecate 대상)" 의 기록으로만 읽는다.

**결정**: ESM 배송 선행값(출고지·발송정책)을 **우리 앱이 생성하지 않고**, 셀러가 ESM Plus 에서 만든 것을 **조회 → select** 하는 **조회형으로 전환**한다. 11번가/네이버/쿠팡과 동일한 Layer 2 단일 표준(`cross-cutting/shipping-fee-model.md` §2)에 ESM 도 수렴시킨다.

**근거**:
- ESM 도 조회 API 가 전부 있다 — 출하지 `GET /item/v1/shipping/places`(17 전체조회 → `shippingPlaces[]`), 발송정책 `GET /item/v1/shipping/dispatch-policies`(19 전체조회), 주소록(16)/묶음배송비(18) 동일. 즉 **생성형은 API 강제가 아니라 제품 결정이었다.**
- 생성형이 끌고 온 복잡도 전부 — 4단계 순차 생성(멱등 아님)·고아 리소스·`status='error'` 추적(QA-313)·테이블+RLS+마이그레이션·생성 UI — 가 조회형에선 사라진다.
- 마켓별 Layer 2 모델이 둘(ESM 생성형 vs 나머지 조회형)로 갈려 유지·테스트 부담 + 신규 마켓이 잘못된 템플릿을 따를 위험. 조회형으로 단일화.

**전환 후 동작**:
- `getRegistrationFields()` 의 ESM 배송 필드 `optionsSource` = `shippingProfiles`(생성형) → **`esmShippingLookup`** 조회형. 출하지/발송정책 2종이라 enum 값은 `esmShippingPlace` + `esmDispatchPolicy` 둘로 구현(11번가 `elevenStOutbound`/`elevenStReturn` 와 동일 패턴). UI(MarketOptionsCard)가 `useEsmShippingOptions` 로 Edge `esm-shipping-list`(POST `{ marketAccountId }`)를 조회해 채운다. (PR-E2 구현 완료.)
- ESM 카드 = 출하지(`placeNo`) select + **발송정책(`dispatchPolicyNo`, 사이트별 G/A) select** + officialNotice. (발송정책이 사이트별이라 site 별 매칭 유지 — `dispatchPolicyNo.{gmkt|iac}`.)
- 셀러가 ESM Plus 에 배송 설정이 없으면 → "ESM Plus 에서 출하지·발송정책 등록 후 새로고침" 안내(우리 앱 생성 진입점 제거).
- 우리 DB 에 배송 참조 저장 없음(조회 결과는 호출측 24h 캐시).

### 전환 PR 로드맵 + 코드 blast radius

> 본 문서(설계)만 지금 갱신한다. 아래 코드는 **전환 PR 에서** 손댄다(배포된 코드 무단 편집 금지).

| PR | 작업 | 대상 파일 |
|---|---|---|
| **PR-E1** ✅ | ESM 배송 리소스 **조회** Edge + 스키마 | (신규) `functions/esm-shipping-list/` (places + dispatch-policies 정규화). (변경) `lib/schemas/esm.ts` + `_shared/schemas.ts` — `EsmShippingPlace`/`EsmDispatchPolicy` 조회 응답 스키마 신설. ⚠️ PR-E2 에서 Edge 호출 규약을 GET → **POST `{ marketAccountId }` body**(supabase-js `functions.invoke` 규약, 11번가 `eleven-st-shipping-list` 와 정합)로 정정. |
| **PR-E2** ✅ | 어댑터 메타 `optionsSource` 전환 + select 데이터 소스 교체 | (변경) `lib/schemas/esm.ts` + `_shared/schemas.ts` — `REGISTRATION_FIELD_OPTIONS_SOURCES` 에 `esmShippingPlace`/`esmDispatchPolicy` **additive** 추가(생성형 `shippingProfiles` 보존, E3/E5 제거). `lib/markets/real/esm/registration-fields.ts` + `_shared/market-adapters/esm-registration-fields.ts` — `shippingProfile`(생성형) → 출하지(`shippingPlaceNo`, select) + 발송정책(`dispatchPolicyNo`, select) + officialNotice 3필드. `features/registration/components/MarketOptionsCard.tsx`(+`__tests__`) — `EsmShippingSelect` 분기 + 신규 훅 `useEsmShippingOptions` · 신규 `api/esm-shipping-list-api.ts`(POST 호출). `esm-shipping-list/index.ts` GET → POST 정합. `locales/ko.ts`(esmShippingPlace/esmDispatchPolicy/esmShippingField) · `mock/createMockSupabase.ts`(esm-shipping-list 응답) · `parity.spec.ts`. ⚠️ 생성형 제거는 PR-E3/E4. |
| **PR-E3** ✅ | 생성형 **제거** (UI/훅/API/라우트) | `SettingsShippingEsmProfilesPage.tsx`(+test) · `hooks/useCreateEsmShippingProfile.ts` · `hooks/useEsmShippingProfiles.ts` · `api/esm-shipping-profile-api.ts`(+test) 삭제 · `SettingsShippingPage.tsx`(카드 5 제거) · `app/router.tsx`(`/settings/shipping/esm-profiles` 제거) · `features/settings/index.ts` · `features/settings/shipping/index.ts` 배럴 정리 · `MarketOptionsCard.tsx`(dead `ShippingProfileSelect` + `useEsmShippingProfiles` import 제거) · `user_flow.md` n61 노드/엣지 제거 · `design-renewal/s9-settings.md` 카드5/§4.7 제거. |
| **PR-E4** ✅ | 생성형 **백엔드 제거** + DB drop | `functions/esm-shipping-profile/`(index + lib/error-row + tests) 삭제 · 신규 마이그레이션 `20260530000002_drop_esm_shipping_profiles.sql`(`DROP TABLE ... CASCADE` + realtime publication 정리; audit category `'shipping'` 은 shipping-dispatch-job / esm-shipping-list / eleven-st-shipping-list 가 계속 사용 → **유지**) · `tests/esm_shipping_profiles_rls.sql`(pgTAP) 삭제 · `lib/schemas/esm.ts` + `_shared/schemas.ts` 생성형 스키마(`EsmShippingProfile*`/`EsmFeeType`/`EsmShippingProfileStatus`) 제거(조회형 + site/dispatchType enum 보존) · 워커 `data-load.ts` 의 `esm_shipping_profiles` 조회(`injectEsmShippingProfile`)를 조회형 marketOptions 매핑(`mapEsmShippingOptions`)으로 교체(DROP 안전 + 등록 경로 재연결) · `mock/createMockSupabase.ts` 생성형 mock 제거. **⚠ DROP 마이그 dev/real 미적용 — 머지 후 `pnpm db:push:dev --include-all`(C1 이력 정합 동반) 필요.** **잔존(PR-E5 인계)**: `shippingProfile` kind / `shippingProfiles` optionsSource enum 값(negative-assertion 테스트 리터럴 참조 → TS2367 회피 보존) + `locales/ko.ts` `shippingProfile`/`esmProfilesCard` 문구. |
| **PR-E5** ✅ | mock / parity / i18n 정합 + 잔존 생성형 enum/kind 제거 (전환 5/5 마무리) | `lib/schemas/esm.ts` + `_shared/schemas.ts` — `shippingProfile` kind / `shippingProfiles` optionsSource enum 값 **제거**(조회형 `esmShippingPlace`/`esmDispatchPolicy` 보존). negative-assertion 테스트 정리 — `__tests__/parity.spec.ts`(리터럴 비교 → optionsSource 조회형 enum 단언) · `lib/markets/real/esm/__tests__/registration-fields.test.ts` + `lib/schemas/__tests__/esm.test.ts`(TS2367 회피 리터럴 → schema reject 단언으로 대체) · gmarket/auction 어댑터 테스트(`extra.shippingProfileId` dead 키 제거). i18n — `locales/ko.ts` `markets.registrationFields.shippingProfile`/`shippingProfileField` + settings `esmProfilesCard`/`esmProfiles` 블록 제거(조회형 `esmShippingPlace`/`esmDispatchPolicy`/`esmShippingField` "ESM Plus 등록 안내" 는 PR-E2 도입 완료 → 유지) · `lib/i18n.ts` 주석 예시 path 갱신. mock(`createMockAdapter.ts`·`_shared/market-adapters/debug.ts`)·`createMockSupabase.ts`·`tests/unit/adapters/_shared/parity.ts` 는 PR-E3/E4 에서 이미 생성형 잔재 제거 완료(재확인 — 잔존 없음). |

> **문서 동기 (지금 갱신 완료/예정)**: `cross-cutting/shipping-fee-model.md`(§2 Layer 2 조회형) · `features/11st.md §8` · `cross-cutting/market-adapter.md §9.8`(optionsSource) · `features/registration.md`(§3 동적필드) · `docs/spec/user_flow.md`(n61) · `docs/design-renewal/s9-settings.md`(카드5/§4.7) · `docs/design-renewal/s3-register.md`(ESM 카드) · `docs/handoff/WIP-5markets-mvp.md`.

**리스크 / 주의**:
- dev 에 `esm_shipping_profiles` 가 이미 적용돼 있다(WIP C1) → DROP 마이그레이션 + 이력 정합 동반.
- 셀러 온보딩 friction 증가(ESM Plus 직접 설정 안내 필요) → s9/문구 보강.
- ESM 발송정책은 사이트별(G/A) → 조회도 사이트별 토큰 호출. select·매칭에서 site 분기 유지.
- 11번가 재구현(`features/11st.md`)은 처음부터 조회형 — 본 전환과 동일 패턴. **생성형을 신규 마켓 템플릿으로 삼지 않는다.**

---

## 0. 배경 — 왜 재구현인가

현재 코드의 ESM 어댑터는 **실제 ESM 스펙이 문서화되기 전에 만든 placeholder** 다. JWT 서명 골격(`aud: sa.esmplus.com`)만 맞고, 엔드포인트·페이로드·카테고리 체계·등록 모델이 공식 문서와 거의 전부 불일치한다.

| 항목 | 📄 문서 (`esm-api/`) | 💻 현재 코드 | 갭 |
|---|---|---|---|
| Base URL | `https://sa2.esmplus.com/item/v1` | `https://sa.esmplus.com/api/v1` | ❌ 도메인·경로 |
| 상품 등록 | `POST /item/v1/goods` — 중첩(`itemBasicInfo`/`itemAddtionalInfo`) | `POST /products` — flat | ❌ 페이로드 구조 |
| 등록 모델 | 마스터 `goodsNo` + 사이트별 `SiteGoodsNo`, `siteType`(1=옥션/2=지마켓) | `site`(G/A) flat | ⚠️ 통합 모델 미반영 |
| 카테고리 | `site-cats`(사이트별)+`sd-cats`(ESM)+매칭, `isLeaf` | `GET /category?site=G\|A` 단일 트리 | ❌ 체계 상이 |
| 배송 선행 | 주소록→출하지→묶음배송→발송정책 4단계, `dispatchPolicyNo`/`placeNo` 필수 | `shippingFee` 숫자 1개 | ❌ 전무 |
| 상품정보고시 | `officialNotice` 필수 (41개 상품군) | 없음 | ❌ 전무 |
| 옵션 | 추천옵션코드 기반 | 없음 | ❌ 전무 (v1 범위 밖) |
| 이미지 | basic + 추가 14, 600×600~, 2MB, jpg/png, 옥션 중복 불가 | MAIN/EXTRA 배열 | ⚠️ 규격·14개 |

근거: `esm-api/README.md:40-169`, `esm-api/product/20.md`, `esm-api/product/4.md`, `esm-api/product/16~19.md`, `apps/web/src/lib/markets/real/esm/shared-adapter.ts:59`.

**불변 골격**: Web(`apps/web/src/lib/markets/real/esm/`)·Edge(`apps/api/supabase/functions/_shared/market-adapters/esm-*.ts`) 양쪽이 `esm-shared` 로 일원화돼 있다 → **공유 어댑터 한 곳을 고치면 G마켓·옥션 양쪽 반영**. gmarket/auction 은 `site`(G/A)만 다른 thin wrapper. 이 구조는 유지한다.

---

## 1. 확정 결정 (사용자 승인 완료 — 변경 금지)

1. **사이트별 분리 유지** — gmarket/auction 을 별도 마켓으로 유지. 어댑터 내부에서 문서의 통합 API(`POST /item/v1/goods`)를 **`siteType` 하나만 채워** 호출한다(문서: "양사이트 동시 또는 사이트별 개별 등록 모두 가능", `esm-api/product/20.md`). `MARKET_IDS`·`RegistrationJob` 마켓별 독립성(한 마켓 실패가 다른 마켓 차단 금지)·s3 UI 그대로.
2. **범위 = 상품등록 + 주문/배송**. 클레임·정산·CS(esm-api/claim, settlement, cs)는 v2.
3. ~~**배송 선행값은 "배송 프로필"로 사전 생성·재사용** — 마켓 계정/배송 설정에서 1회 생성(우리 앱이 4단계 생성 API 호출 → `placeNo`/`dispatchPolicyNo` 확보·저장), 상품등록 3단계에선 드롭다운 **선택만**. 등록 폼 안에서 생성 API 호출 금지(실패 시 고아 정책 방지).~~ → **SUPERSEDED (2026-05-30, 상단 "전환 결정" 절)**: 생성형 폐기, **조회형**(셀러가 ESM Plus 에서 만든 출하지/발송정책을 GET 조회 → select)으로 전환.
4. **상품정보고시(officialNotice)** 는 s3 등록 위저드 3단계 카드에 입력 섹션 추가.
5. **마켓별 동적 등록필드** — `MarketAdapter` 에 마켓별 추가 등록필드 메타(zod + UI 메타)를 노출하는 `getRegistrationFields()` 를 추가하고, 3단계 `CategoryMappingCard` → `MarketOptionsCard` 로 일반화하여 동적 렌더. 컴포넌트 내 `if (marketId === ...)` 하드코딩 분기 금지. ESM 은 `[shippingProfile 선택, officialNotice]` 를 선언.
6. **real 검증은 mock + parity 까지** — real 어댑터 코드는 문서 기준 작성하되, 검증은 mock 어댑터 + `parity.spec` 까지. 실제 `sa2.esmplus.com` 실호출 검증은 셀러 자격증명·IP 화이트리스트 확보 후 별도 라운드.

---

## 2. PR 로드맵 + 의존성 그래프

```
Wave 0 (단독, 모든 PR의 base)
└─ PR-0  스펙정정(base URL) + zod 스키마 계약 + 설계문서(본 문서) + mock 동기화
          ↓ (머지 후)
Wave 1 (병렬 4)
├─ PR-1  JWT 인증 정합 (kid/iss/ssi)                          [의존: PR-0]
├─ PR-2  카테고리 재작성 (site-cats)                          [의존: PR-0]
├─ PR-3  배송 프로필 (DB + 4단계 생성 Edge Function + UI)      [의존: PR-0]
└─ PR-6  주문/배송 (fetchOrders / submitTracking 정정)        [의존: PR-0, PR-1]
          ↓
Wave 2 (병렬 3)
├─ PR-3.5 마켓별 동적 등록필드 프레임워크                      [의존: PR-3]
├─ PR-4   상품등록 재작성 (transformProduct + createProduct)  [의존: PR-0·1·2·3·3.5]
└─ PR-5   상품정보고시 입력단계                                [의존: PR-4]
```

| PR | 제목 | 핵심 산출물 | 투입 agent |
|---|---|---|---|
| PR-0 | 스펙·스키마 계약 | 본 문서, zod 스키마, base URL, mock 동기화 | architect + backend |
| PR-1 | JWT 인증 정합 | `buildEsmJwt` (kid/iss/ssi) Web+Edge | backend + security |
| PR-2 | 카테고리 재작성 | `fetchCategoryTree`(site-cats) Web+Edge | backend |
| PR-3 | 배송 프로필 | `esm_shipping_profiles` + RLS + Edge Function + 설정 UI | backend + frontend + designer |
| PR-3.5 | 동적 등록필드 | `getRegistrationFields` + `MarketOptionsCard` | frontend |
| PR-4 | 상품등록 재작성 | `transformProduct`/`createProduct`(POST /item/v1/goods) | backend + frontend |
| PR-5 | 상품정보고시 | officialNotice 입력 섹션 + 스키마 | frontend + backend |
| PR-6 | 주문/배송 | `fetchOrders`/`submitTracking` 문서 기준 | backend |

전 PR 공통: `ing-qa` acceptance·테스트 게이트 검수, `ing-security` 자격증명·로깅 마스킹 검수.

---

## 3. 데이터 모델 — `esm_shipping_profiles` (⚠ DEPRECATE 대상 — 상단 "전환 결정" 절 참조)

> **이 테이블은 생성형 시절 산출물이며 조회형 전환으로 제거된다(PR-E4 `DROP TABLE`).** 아래는 구현 기록으로 보존한다. 신규 작업은 본 테이블에 의존하지 않는다.


> 본 테이블은 배송의 **물류 참조(Layer 2)** 레이어 — 4 마켓 배송비 모델 비교 + 2-레이어(요금 의도 vs 물류 참조) 정립은 `cross-cutting/shipping-fee-model.md` 참조. 출고지/반품지 사전 생성 참조는 ESM 만이 아니라 모든 마켓의 보편 패턴이며, Layer 2 일반화는 후속 트랙.

배송 선행값(addrNo/placeNo/배송비정책/dispatchPolicyNo)을 마켓 계정별로 **1회 생성·재사용**하는 테이블. PR-3 에서 마이그레이션을 만들되, 컬럼·제약·RLS 계약은 PR-0 에서 고정한다.

```sql
-- 마이그레이션(PR-3): 20260530_esm_shipping_profiles.sql
CREATE TABLE public.esm_shipping_profiles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_account_id   uuid NOT NULL REFERENCES public.market_accounts(id) ON DELETE CASCADE,
  site                text NOT NULL CHECK (site IN ('G', 'A')),   -- G=지마켓, A=옥션
  profile_label       text NOT NULL,                              -- 셀러 표시명 (예: "기본 출고지/택배")
  -- 번호 컬럼: status='active' 일 때만 NOT NULL 보장(아래 partial CHECK).
  -- status='error' (부분 성공 후 실패 — 고아 추적 row) 시엔 아직 못 받은 번호가 NULL 일 수 있다.
  addr_no             text,                                       -- 판매자 주소록 번호 (esm POST /sellers/address)
  place_no            text,                                       -- 출하지 번호 (esm POST /shipping/places)
  bundle_policy_no    text,                                       -- 묶음배송비 정책 (esm POST /shipping/policies) — active 여도 사이트별 optional
  dispatch_policy_no  text,                                       -- 발송정책 번호 (esm POST /shipping/dispatch-policies)
  dispatch_type       text NOT NULL CHECK (dispatch_type IN ('A','B','C','D','E','F')), -- A=당일/B=순차/C=해외/D=요청일/E=주문제작/F=미정
  shipping_fee        integer NOT NULL DEFAULT 0,                 -- 기본 배송비(원)
  fee_type            smallint NOT NULL CHECK (fee_type IN (1,2)),-- 1=묶음배송비, 2=상품별배송비
  raw_meta            jsonb,                                      -- 생성 응답 메타(번호 외 부가). PII/시크릿 금지. error row 는 failedStep/errorCode/completedSteps 만.
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active','error')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT esm_shipping_profiles_unique_label UNIQUE (market_account_id, profile_label),
  CONSTRAINT esm_shipping_profiles_fee_nonneg   CHECK (shipping_fee >= 0),
  -- status='active' = 4단계 모두 성공 → 필수 번호 보장. status='error' = 부분 성공 후 실패 → NULL 허용.
  -- (bundle_policy_no 는 사이트별 미반환이 있어 active 여도 제약 대상 아님)
  CONSTRAINT esm_shipping_profiles_active_nums_present CHECK (
    status <> 'active'
    OR (addr_no IS NOT NULL AND place_no IS NOT NULL AND dispatch_policy_no IS NOT NULL)
  )
);

CREATE INDEX esm_shipping_profiles_seller_idx  ON public.esm_shipping_profiles (seller_id);
CREATE INDEX esm_shipping_profiles_account_idx ON public.esm_shipping_profiles (market_account_id);

COMMENT ON TABLE public.esm_shipping_profiles IS
  'ESM(G마켓/옥션) 배송 선행값 재사용 프로필. 우리 앱이 ESM 4단계 생성 API 호출 결과 번호를 저장. 상품등록 시 dispatch_policy_no/place_no 를 주입.';
```

### 3.1 RLS 정책

```sql
ALTER TABLE public.esm_shipping_profiles ENABLE ROW LEVEL SECURITY;

-- 셀러 본인 row 만 SELECT (3단계 드롭다운/설정 목록 조회)
CREATE POLICY esm_shipping_profiles_select_own
  ON public.esm_shipping_profiles FOR SELECT TO authenticated
  USING (seller_id = auth.uid());

-- INSERT/UPDATE/DELETE 미정의 = 거부. 생성/수정/삭제는 Edge Function(service_role) 경유.
```

- **RLS 없는 테이블 금지 원칙 준수.** `dispatch_policy_no`/`addr_no` 등 번호는 PII 아님(마켓 내부 식별자) → 클라이언트 SELECT 허용. 단 `raw_meta` 에 셀러 주소·전화 평문 저장 금지(주소록 생성 시 PII 는 ESM 측에만, 우리 DB 엔 번호만).
- 생성·삭제 경로: Edge Function `esm-shipping-profile` (PR-3) 가 service_role 로 INSERT/DELETE.
- **error row 도 동일 RLS** — `status='error'` row 역시 `seller_id = auth.uid()` 로 본인만 SELECT (cross-tenant 차단). 적재 주체는 service_role(Edge Function)뿐 — authenticated 직접 INSERT 거부는 active/error 동일.

### 3.2 부분 실패 시 `status='error'` row 적재 (고아 정책 추적 — QA-313)

배송 프로필 생성은 ESM 4단계(주소록 → 출하지 → 묶음배송 → 발송정책) 순차 호출이다. 멱등이 아니므로 step 단위 retry 를 하지 않는다(중복 생성 방지). 따라서 **일부 단계가 성공한 뒤 뒷단계가 실패하면 ESM 측에 부분 생성된 리소스(`addrNo`/`placeNo`/`bundlePolicyNo`)가 고아로 남는다.**

- Edge Function 은 4단계 중 어느 단계든 실패하면 **throw 하기 전에 `status='error'` row 를 service_role 로 INSERT** 한다. 그렇지 않으면 우리 DB 에 흔적이 없어 고아 리소스를 영원히 추적·수동 정리할 수 없다.
- error row 가 담는 것:
  - **그때까지 확보한 부분 번호** — `addr_no`/`place_no`/`bundle_policy_no` 중 성공분(나머지는 NULL). `dispatch_policy_no` 는 마지막 단계라 error row 에선 항상 NULL.
  - **`raw_meta`** — `{ failedStep, errorCode, completedSteps }` 만. `failedStep` 은 실패 단계명(`address`/`place`/`policy`/`dispatch`), `errorCode` 는 HttpError code(`esm_<step>_http_5xx` / `esm_<step>_schema_mismatch` 등 ESM 응답 성격), `completedSteps` 는 실패 직전까지 성공한 단계 목록. **토큰/secretKey/주소/전화/이름 등 PII 절대 금지.**
- error row 적재는 **best-effort** — 적재 자체가 실패(예: 동일 라벨 unique 충돌)해도 원래 에러를 가리지 않고 그대로 re-throw 한다(로그만 남김).
- `status='active'` 경로는 그대로 4단계 모두 성공 시 INSERT. partial CHECK(`esm_shipping_profiles_active_nums_present`)가 active row 의 필수 번호 누락을 DB 레벨에서 거부한다.
- 정상화: 셀러가 동일 라벨로 재시도하려면 unique 충돌을 피하기 위해 error row 를 먼저 삭제(service_role)하거나 다른 라벨을 쓴다. error row 삭제·재처리 UI 는 후속 PR.

---

## 4. API 스키마 (zod) 계약 — **PR-0 의 핵심 산출물**

> 단일 소스 규약: zod 스키마는 `apps/web/src/lib/schemas/` 에 정의하고, Edge Function `apps/api/supabase/functions/_shared/schemas.ts` 와 **구조 동일**하게 미러링(현 ESM 스키마와 동일 패턴). RHF resolver + Supabase insert + 서버 응답 parse 3중 재사용. 컴포넌트 내부 inline `z.object` 금지.
> PR-0 는 아래 스키마 파일을 **신설**한다: `apps/web/src/lib/schemas/esm.ts` (+ Edge 미러). createProduct 요청/응답·site-cats·officialNotice·shippingProfile·registrationFieldMeta 를 담는다.

### 4.1 ESM 상품등록 요청 페이로드 (`EsmGoodsCreateRequestSchema`)

문서 `esm-api/product/20.md` 의 `POST /item/v1/goods` body. 사이트별 분리이므로 **한 호출에 site 하나만** 채운다(siteType 단일, price/stock 단일 사이트).

| 경로 | 타입 | 제약 | 근거 |
|---|---|---|---|
| `itemBasicInfo.goodsName.kor` | string | ≤100 byte (초과 truncate 금지 → validation error) | product/20.md:22 |
| `itemBasicInfo.category.site[]` | array | `[{ siteType, catCode }]`, siteType 1=옥션/2=지마켓, catCode=leaf | product/20.md:28-31 |
| `itemAddtionalInfo.price.{Gmkt\|Iac}` | number | 10원 단위, 10 ≤ p < 1e9 | product/20.md:49-52 |
| `itemAddtionalInfo.stock.{Gmkt\|Iac}` | number | 1~99999 | product/20.md:50 |
| `itemAddtionalInfo.sellingPeriod.{Gmkt\|Iac}` | enum | -1/0/15/30/60/90/365 | product/20.md:53-54 |
| `itemAddtionalInfo.shipping.type` | enum | 1=택배/2=직접 | product/20.md |
| `itemAddtionalInfo.shipping.policy.placeNo` | string | 출하지 번호(배송프로필) | product/17.md, product/20.md |
| `itemAddtionalInfo.shipping.dispatchPolicyNo.{gmkt\|iac}` | string | 발송정책 번호(배송프로필) | product/19.md, product/20.md |
| `itemAddtionalInfo.images.basicImgURL` | url | 600×600~, ≤2MB, jpg/png, 완전 URL | product/20.md:171, product/23.md |
| `itemAddtionalInfo.images.addtionalImg{1..14}URL` | url? | 추가 최대 14, 순차 입력 | product/23.md |
| `itemAddtionalInfo.officialNotice.officialNoticeNo` | string | 상품군 코드 (필수) | product/161.md |
| `itemAddtionalInfo.officialNotice.details[]` | array | `[{ code, value }]` 필수 항목 | product/161.md |
| `itemAddtionalInfo.isVatFree` | boolean | true=면세 | product/20.md |

- **사이트별 분리 매핑**: site='G' → `category.site=[{siteType:2,catCode}]`, `price.Gmkt`, `stock.Gmkt`, `dispatchPolicyNo.gmkt`, `isSell.gmkt=true`. site='A' → siteType:1, `Iac`, `iac`.
- **옥션 이미지 중복 불가**(product/20.md): site='A' 일 때 basic + 추가 URL 전부 distinct 검증.

### 4.2 createProduct 응답 (`EsmGoodsCreateResponseSchema`)

문서 `esm-api/product/20.md` 응답. `passthrough()` 로 미지 필드 보존.

| 경로 | 타입 | 의미 |
|---|---|---|
| `goodsNo` | number | 마스터 상품번호 |
| `siteDetail.gmkt.SiteGoodsNo` | string? | 지마켓 사이트 상품번호 |
| `siteDetail.gmkt.SiteGoodsComment` | string? | "Success" 또는 오류 |
| `siteDetail.iac.SiteGoodsNo` | string? | 옥션 사이트 상품번호 |
| `siteDetail.iac.SiteGoodsComment` | string? | |
| `resultCode` | number | 0=성공 |
| `message` | string\|null | |

- 어댑터 `createProduct` 는 호출한 site 의 `SiteGoodsNo` 를 `externalId` 로 반환. 없으면 에러(현 코드 동작 유지). `itemUrl` fallback: 지마켓 `https://item.gmarket.co.kr/Item?goodscode={id}`, 옥션 `https://itempage3.auction.co.kr/DetailView.aspx?itemno={id}` (현 코드 유지).

### 4.3 site-cats 카테고리 응답 (`EsmSiteCatSchema`)

문서 `esm-api/product/4.md`. `GET /item/v1/categories/site-cats`(대분류) / `/{siteCatCode}`(하위).

| 경로 | 타입 | 의미 |
|---|---|---|
| `siteCatCode` | string | 카테고리 코드 |
| `siteCatName` | string | 이름 |
| `isLeaf` | boolean | leaf 여부 (상품등록은 leaf 만) |
| `siteType` | enum? | 1/2 |
| (children) | lazy array | 재귀 — `CategoryNode` 로 정규화 |

- `CategoryNode`(공통 타입) 정규화 매핑은 PR-2. PR-0 은 raw 응답 스키마만 확정.

### 4.4 officialNotice (`EsmOfficialNoticeSchema`)

| 경로 | 타입 | 제약 |
|---|---|---|
| `officialNoticeNo` | string | 41개 상품군 중 택1 (필수) |
| `details[]` | array | `[{ code: string, value: string }]` — 상품군별 필수 항목 |

상품군 코드/항목 목록 마스터는 PR-5 에서 `esm-api/product/161.md` 기준 상수화. PR-0 은 스키마 형태만.

### 4.5 배송 프로필 (`EsmShippingProfileSchema`)

§3 테이블과 1:1. 생성 요청(`EsmShippingProfileCreateInputSchema`: site, profile_label, dispatch_type, shipping_fee, fee_type, 주소 입력) + 저장형(위 테이블 컬럼). PII(주소·전화)는 생성 요청에만 존재하고 DB 엔 번호만 저장.

### 4.6 마켓별 동적 등록필드 메타 (`RegistrationFieldMetaSchema`)

`MarketAdapter.getRegistrationFields()` 반환 타입. UI 가 마켓을 몰라도 렌더 가능하게 한다.

| 필드 | 타입 | 의미 |
|---|---|---|
| `key` | string | 필드 식별자 (예: `shippingProfileId`, `officialNotice`) |
| `label` | string | i18n key 또는 표시명 |
| `kind` | enum | `select` / `text` / `number` / `officialNotice` / `shippingProfile` |
| `required` | boolean | |
| `optionsSource` | enum? | 동적 옵션 출처. ⚠️ 조회형 전환(전환 결정 절): `esmShippingLookup`(ESM GET) / `elevenStOutbound`·`elevenStReturn`(11번가 GET) / `static`. 구 `shippingProfiles`(생성형 테이블)는 deprecate |
| `helpText` | string? | |
| `blockingReason` | string? | 미입력 시 3단계 다음 버튼 tooltip 문구 |

- `Step3Schema` 확장: 마켓별 `marketOptions: Record<fieldKey, value>` 를 검증(zod). 어댑터의 `getRegistrationFields()` 가 required 로 선언한 키는 값 필수.

---

## 5. 화면 흐름 (s3 3단계) — PR-3.5 / PR-5 에서 구현, PR-0 계약

> ⚠ **부분 SUPERSEDED (전환 결정 절)**: 배송 프로필 **생성** 진입점(`/settings/shipping/esm-profiles`, `SettingsShippingEsmProfilesPage`)·user_flow n61 은 조회형 전환으로 **제거(PR-E3)**. 3단계 배송 select 는 유지하되 데이터 소스가 `esm_shipping_profiles` → ESM GET 조회(`esmShippingLookup`)로 바뀐다. officialNotice 부분은 그대로 유효.

- **현재**: [StepMarketsCategoriesPage.tsx](apps/web/src/features/registration/pages/StepMarketsCategoriesPage.tsx) — 마켓 체크 → 선택 마켓마다 `CategoryMappingCard` 동적 렌더.
- **변경(PR-3.5, 구현 완료)**: `CategoryMappingCard` → `MarketOptionsCard`. 카테고리 매핑 + 어댑터 메타가 선언한 필드를 동적 렌더.
  - ESM(gmarket/auction) 카드 = 카테고리 + **배송 프로필 select** (옵션 출처 `esm_shipping_profiles`, "프로필 없음 → 만들러 가기" deep link `/settings/shipping/esm-profiles`) + **상품정보고시** 입력(`OfficialNoticeField`, PR-5 완료 — 상품군 select + 군별 항목 동적 폼 → `marketOptions.officialNotice`).
  - 네이버/쿠팡/11번가 카드 = `getRegistrationFields()` 빈 배열(기본) → 카테고리만 (현 동작 유지, 하위호환).
  - **구현 메모(PR-3.5)**:
    - 컴포넌트 내 `if (marketId === ...)` 하드코딩 분기 0. UI 는 동기 resolver `getRegistrationFieldsForMarket(marketId)`(`apps/web/src/lib/markets/registration-fields.ts`) 가 돌려준 `RegistrationFieldMeta[]` 의 `kind` 로만 렌더 분기. resolver 는 ESM(gmarket/auction)→`getEsmRegistrationFields()`, 그 외→`[]`. `getRegistrationFields()` 가 순수·정적(mock↔real parity)이라 무거운 async `getMarketAdapter` 를 await 하지 않고 동기 해석.
    - `RegistrationFieldMeta.label`/`helpText`/`blockingReason` 은 i18n key(`markets.registrationFields.*`) → `resolveKoPath()`(`apps/web/src/lib/i18n.ts`)로 해석(하드코딩 금지).
    - 배송 프로필 select 4상태: loading(Skeleton) / error(문구) / data(`status='active'` 프로필만 옵션) / empty(만들러 가기 CTA). `useEsmShippingProfiles(marketAccountId)`(PR-3) 재사용.
    - `Step3Schema` → `makeStep3Schema(requiredKeysFor)` 빌더로 확장. 어댑터가 `required` 로 선언한 fieldKey 가 해당 마켓 `mapping.marketOptions[key]` 에 비어있으면 zod fail + blockingReasons tooltip + 다음 버튼 비활성. provider 미주입 기본 `Step3Schema` 는 추가필드 검증 skip(하위호환).
- **배송 프로필 생성 진입점**(PR-3, 구현됨): `/settings/shipping/esm-profiles` (`SettingsShippingEsmProfilesPage`) — `/settings/shipping` 허브의 "G마켓·옥션 배송 프로필" 카드 [배송 프로필 관리] 로 진입. 목록(`useEsmShippingProfiles` = RLS 적용 직접 SELECT) + 생성 Dialog(RHF + `EsmShippingProfileCreateInputSchema` → `useCreateEsmShippingProfile` → Edge `esm-shipping-profile` 4단계 호출). ESM(gmarket/auction) 계정 미연결 시 생성 차단 + `/markets/connect` 유도.
- **user_flow 영향**(PR-3 반영 완료): s3 3단계 노드 내부 카드 구조 변경(노드 추가 아님 — PR-3.5). settings(s9)에 **n61 (G마켓·옥션 배송 프로필 관리)** 노드 추가 → `user_flow.md` §s9 + `design-renewal/s9-settings.md` §1.2/§1.3/§2/§3/§4.7 갱신.

---

## 6. 마켓 어댑터 인터페이스 변경 (`cross-cutting/market-adapter.md` 동기 — PR-3.5)

- `MarketAdapter` 에 `getRegistrationFields(): RegistrationFieldMeta[]` 추가.
- **하위호환**: 기본 구현 `() => []`. naver/coupang/11st 어댑터는 빈 배열 → 기존 동작 불변. ESM 어댑터만 `[shippingProfile, officialNotice]` 반환.
- 인터페이스 변경이므로 `market-adapter.md` 와 mock 어댑터 동기 갱신(PR-3.5). PR-0 은 타입 계약만 `schemas/esm.ts` 에 둔다.

---

## 7. PR별 수락 기준 (acceptance criteria)

- **PR-0 (완료 정의)**:
  - [ ] `ESM_API_BASE` Web+Edge 모두 `https://sa2.esmplus.com/item/v1` 로 정정.
  - [ ] `apps/web/src/lib/schemas/esm.ts` + Edge 미러 신설 — §4 의 6개 스키마(요청/응답/site-cats/officialNotice/shippingProfile/fieldMeta) 정의. 각 스키마 pass 1 + fail ≥1 단위테스트(testing.md R-001).
  - [ ] mock 어댑터(Web `debug/createMockAdapter.ts`, Edge `_shared/market-adapters/debug.ts`)가 새 응답 스키마 구조 반환(파싱 통과).
  - [ ] 본 설계문서 머지.
  - [ ] `pnpm typecheck` / `pnpm lint` / `pnpm test` 통과. 기존 골든패스 회귀 없음.
  - [ ] **범위 경계 준수**: PR-0 에서 실제 `createProduct`/`fetchCategoryTree` 호출 로직·URL 경로 재작성은 **하지 않는다**(PR-2/4). base URL 상수와 스키마·mock 까지만.
- **PR-1**: `buildEsmJwt` payload 에 `kid`(마스터ID)/`iss`/`ssi`(site:sellerId 단일) 반영. 기존 jwt 단위테스트 갱신 + 신규 fail 케이스.
- **PR-2**: `fetchCategoryTree` 가 `GET /item/v1/categories/site-cats` + `/{code}` 재귀, `isLeaf` 기반 leaf, `CategoryNode` 정규화. mock↔real parity.spec.
  - ⚠️ **Gateway allowlist (PR-2 가 첫 실호출이므로 여기서 필수)**: 새 base URL 호스트 `sa2.esmplus.com` 을 (a) `apps/api/supabase/functions/_shared/gateway-sign.ts` 의 `GATEWAY_ALLOWED_HOSTS` 에 추가, (b) Lightsail Gateway `infra/aws-lightsail-gateway/main.ts` 의 `ALLOWED_*` 미러 갱신·재배포, (c) `gateway-sign.test.ts` allowlist 케이스 갱신. 미반영 시 `assertGatewayUrl` 이 "host not in allow-list" 로 거부. (PR-0 에서 base URL 만 바꾸고 호스트 화이트리스트는 PR-2 로 의도적 분리 — PR-0 은 mock+parity 라 무해.)
- **PR-3** (⚠ 구현 완료됐으나 전환 결정으로 DEPRECATE — PR-E3/E4 에서 제거): `esm_shipping_profiles` 마이그레이션 + RLS + `esm-shipping-profile` Edge Function(4단계 생성) + 설정 UI. RLS 본인 row 만 SELECT 검증. **부분 실패 시 `status='error'` row 적재(고아 추적, §3.2) — pgTAP 에서 error row RLS 본인 SELECT + nullable 번호 검증, Edge 단위테스트에서 단계별 실패 → error row payload(부분 번호 + PII-free raw_meta) 검증 (QA-313).**
- **PR-3.5 (완료)**: `getRegistrationFields` + `MarketOptionsCard` 동적 렌더. 컴포넌트 마켓 하드코딩 0(메타 kind 분기만). 네이버/쿠팡/11st 회귀 없음.
  - [x] `MarketOptionsCard`(카테고리 + 동적 필드) — `CategoryMappingCard` 제거·일반화.
  - [x] 동기 resolver `getRegistrationFieldsForMarket` + i18n `resolveKoPath`.
  - [x] `makeStep3Schema(provider)` — required marketOptions zod 검증(단일 소스). 미입력 시 blocking.
  - [x] Vitest: ESM select 렌더 / status=error 프로필 제외 / 미선택 deep link / onChange 적재 / error 상태 / naver 회귀(필드 0, 훅 미호출) + 스키마 pass/fail.
  - [x] `pnpm typecheck` / `lint` / `test`(1100 pass) 통과.
- **PR-4**: `transformProduct` 중첩 페이로드 + `createProduct` `POST /item/v1/goods`, `siteDetail.{gmkt|iac}.SiteGoodsNo` 파싱. 옥션 중복 이미지 validation. parity.spec.
- **PR-5 (완료)**: officialNotice 입력 섹션(`OfficialNoticeField`) + 41개 상품군 상수(`ESM_OFFICIAL_NOTICE_GROUPS`, Web+Edge 미러). 상품군 select → 군별 항목 동적 폼 → `EsmOfficialNotice` 로 `marketOptions.officialNotice` 적재 → 오케스트레이터가 `mapping.extra.officialNotice` 로 PR-4 transformProduct 에 연결. 미입력/미완성(객체 완성도 `isMarketOptionValuePresent`) 시 `makeStep3Schema` fail + blockingReason tooltip + 다음 버튼 비활성.
  - [x] `OfficialNoticeField`(상품군 select + 군별 필수항목 동적 폼) — `MarketOptionsCard` `kind='officialNotice'` 렌더.
  - [x] `getEsmRegistrationFields()` 에 officialNotice 필드(required, kind=officialNotice) — gmarket/auction/mock parity.
  - [x] `isMarketOptionValuePresent` 객체 완성도 판정(군+모든 detail code/value) — 스키마·페이지 blockingReason 단일 소스.
  - [x] i18n `markets.registrationFields.officialNoticeField.*`(ko.ts) / 토큰 / a11y(폼 라벨·aria).
  - [x] Vitest: 상품군 select 렌더(41) / 군 선택 → 항목 seed / value 적재 / 추가·삭제 / marketOptions.officialNotice 적재 / 미완성 blocking(pass+fail) / 타 마켓(naver) 회귀.
  - [x] 2개 산출물 동기화: user_flow s3 / design-renewal s3-register.md / features/registration.md §10.5.
- **PR-6**: `fetchOrders`/`submitTracking` 문서 order-shipping 엔드포인트 정정 + 상태 정규화 문서 대조. submitTracking Edge 측 완성(현 stub 제거).

---

## 8. 범위 경계 (PR-0)

**PR-0 에 들어가는 것**: base URL 상수 정정 / §4 zod 스키마 신설 + 단위테스트 / mock 어댑터 응답 구조 동기화 / 본 설계문서 / `esm_shipping_profiles` 스키마 계약(문서) + `RegistrationFieldMeta` 타입.

**PR-0 에 안 들어가는 것**: 실제 호출 로직 재작성(URL 경로·중첩 페이로드 빌드는 PR-2/4) / DB 마이그레이션 적용(PR-3) / Edge Function 신설(PR-3) / UI 변경(PR-3·3.5·5) / JWT payload 변경(PR-1).

---

## 변경 이력

- 2026-05-30: 초안 (PR-0). architect 주도, 사용자 결정 6개 반영. ESM 문서 기준 재구현 8개 PR 로드맵·zod 계약·`esm_shipping_profiles` 테이블·동적 등록필드 프레임워크 확정.
- 2026-05-30: **전환 결정 (생성형→조회형, B안)**. 11번가 spec import 대조에서 출고지/반품지 사전참조가 5마켓 보편 패턴임이 확정되고, ESM 도 조회 API(17/19 전체조회)가 전부 있어 생성형이 API 강제가 아님이 드러남. ESM 배송 선행값을 조회형으로 전환 — `esm_shipping_profiles` 테이블·생성 Edge·생성 UI deprecate (PR-E1~E5 로드맵 + 코드 blast radius). 상단 "전환 결정" 절이 §1결정3/§3/§5/§7PR-3 supersede. Layer 2 단일 표준은 `cross-cutting/shipping-fee-model.md` §2.
