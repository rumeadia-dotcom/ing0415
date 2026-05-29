# features/esm.md — ESM(G마켓·옥션) 어댑터 문서 기준 재구현 종합 설계 (v1)

> 본 문서는 **다중 마켓 상품 자동 등록 SaaS** 의 ESM(ebay Sales Manager — G마켓·옥션 통합 백오피스) 어댑터를 **공식 API 문서(`docs/architecture/v1/features/esm-api/`, 119개 마크다운) 기준으로 재구현**하기 위한 단일 설계 문서다. architect·backend·frontend·designer·qa·security 관점을 통합한다.
>
> **작성 책임**: architect 주도 (PR-0 계약 확정). backend / frontend / security / qa 리뷰 후 머지.
> **승인**: architect + security.
> **의존**: `docs/architecture/v1/platform.md`, `frontend.md`, `ui-system.md`, `security.md`, `testing.md`, `cross-cutting/market-adapter.md`, `cross-cutting/credential-vault.md`, `cross-cutting/market-gateway.md`, `features/markets.md`, `features/registration.md`, `features/settings-shipping.md`.
> **차단 권한**: 본 문서(PR-0)가 머지되기 전까지 ESM 어댑터 재작성 PR(PR-1~PR-6) **금지** — PR-0 가 zod 스키마 계약·base URL·테이블을 고정해야 후속 PR 이 병렬 안전.
> **근거**: PRD §1.1 / §1.2 / §1.3 / §1.4, `esm-api/` 공식 문서, CLAUDE.md "마켓 어댑터 추상화" / "외부 API 로깅 패턴" / "MVP 범위 v1", `user_flow.md` s3 / s5.

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
3. **배송 선행값은 "배송 프로필"로 사전 생성·재사용** — 마켓 계정/배송 설정에서 1회 생성(우리 앱이 4단계 생성 API 호출 → `placeNo`/`dispatchPolicyNo` 확보·저장), 상품등록 3단계에선 드롭다운 **선택만**. 등록 폼 안에서 생성 API 호출 금지(실패 시 고아 정책 방지).
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

## 3. 데이터 모델 — `esm_shipping_profiles` (PR-3 에서 마이그레이션, PR-0 에서 계약 확정)

배송 선행값(addrNo/placeNo/배송비정책/dispatchPolicyNo)을 마켓 계정별로 **1회 생성·재사용**하는 테이블. PR-3 에서 마이그레이션을 만들되, 컬럼·제약·RLS 계약은 PR-0 에서 고정한다.

```sql
-- 마이그레이션(PR-3): 20260530_esm_shipping_profiles.sql
CREATE TABLE public.esm_shipping_profiles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_account_id   uuid NOT NULL REFERENCES public.market_accounts(id) ON DELETE CASCADE,
  site                text NOT NULL CHECK (site IN ('G', 'A')),   -- G=지마켓, A=옥션
  profile_label       text NOT NULL,                              -- 셀러 표시명 (예: "기본 출고지/택배")
  addr_no             text NOT NULL,                              -- 판매자 주소록 번호 (esm POST /sellers/address)
  place_no            text NOT NULL,                              -- 출하지 번호 (esm POST /shipping/places)
  bundle_policy_no    text,                                       -- 묶음배송비 정책 (esm POST /shipping/policies)
  dispatch_policy_no  text NOT NULL,                              -- 발송정책 번호 (esm POST /shipping/dispatch-policies)
  dispatch_type       text NOT NULL CHECK (dispatch_type IN ('A','B','C','D','E','F')), -- A=당일/B=순차/C=해외/D=요청일/E=주문제작/F=미정
  shipping_fee        integer NOT NULL DEFAULT 0,                 -- 기본 배송비(원)
  fee_type            smallint NOT NULL CHECK (fee_type IN (1,2)),-- 1=묶음배송비, 2=상품별배송비
  raw_meta            jsonb,                                      -- 생성 응답 메타(번호 외 부가). PII/시크릿 금지.
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active','error')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT esm_shipping_profiles_unique_label UNIQUE (market_account_id, profile_label)
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
| `optionsSource` | enum? | `shippingProfiles` / `static` — 동적 옵션 출처 |
| `helpText` | string? | |
| `blockingReason` | string? | 미입력 시 3단계 다음 버튼 tooltip 문구 |

- `Step3Schema` 확장: 마켓별 `marketOptions: Record<fieldKey, value>` 를 검증(zod). 어댑터의 `getRegistrationFields()` 가 required 로 선언한 키는 값 필수.

---

## 5. 화면 흐름 (s3 3단계) — PR-3.5 / PR-5 에서 구현, PR-0 계약

- **현재**: [StepMarketsCategoriesPage.tsx](apps/web/src/features/registration/pages/StepMarketsCategoriesPage.tsx) — 마켓 체크 → 선택 마켓마다 `CategoryMappingCard` 동적 렌더.
- **변경(PR-3.5)**: `CategoryMappingCard` → `MarketOptionsCard`. 카테고리 매핑 + `adapter.getRegistrationFields()` 가 선언한 필드를 동적 렌더.
  - ESM(gmarket/auction) 카드 = 카테고리 + **배송 프로필 select** (옵션 출처 `esm_shipping_profiles`, "프로필 없음 → 만들러 가기" deep link) + **상품정보고시** 입력.
  - 네이버/쿠팡/11번가 카드 = `getRegistrationFields()` 빈 배열(기본) → 카테고리만 (현 동작 유지, 하위호환).
- **배송 프로필 생성 진입점**(PR-3): `/markets` 행 또는 `/settings/shipping` 에 "ESM 배송 프로필 관리" — 생성 폼 → Edge Function 4단계 호출 → 목록.
- **user_flow 영향**: s3 3단계 노드 내부 카드 구조 변경(노드 추가 아님). s5/settings 에 배송 프로필 관리 화면 추가 → `user_flow.md` 갱신(PR-3). PR-0 은 문서 영향만 기록.

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
- **PR-3**: `esm_shipping_profiles` 마이그레이션 + RLS + `esm-shipping-profile` Edge Function(4단계 생성) + 설정 UI. RLS 본인 row 만 SELECT 검증.
- **PR-3.5**: `getRegistrationFields` + `MarketOptionsCard` 동적 렌더. 컴포넌트 마켓 하드코딩 0(grep 검증). 네이버/쿠팡/11st 회귀 없음.
- **PR-4**: `transformProduct` 중첩 페이로드 + `createProduct` `POST /item/v1/goods`, `siteDetail.{gmkt|iac}.SiteGoodsNo` 파싱. 옥션 중복 이미지 validation. parity.spec.
- **PR-5**: officialNotice 입력 섹션 + 41개 상품군 상수. 미입력 시 등록 차단 + blockingReason tooltip.
- **PR-6**: `fetchOrders`/`submitTracking` 문서 order-shipping 엔드포인트 정정 + 상태 정규화 문서 대조. submitTracking Edge 측 완성(현 stub 제거).

---

## 8. 범위 경계 (PR-0)

**PR-0 에 들어가는 것**: base URL 상수 정정 / §4 zod 스키마 신설 + 단위테스트 / mock 어댑터 응답 구조 동기화 / 본 설계문서 / `esm_shipping_profiles` 스키마 계약(문서) + `RegistrationFieldMeta` 타입.

**PR-0 에 안 들어가는 것**: 실제 호출 로직 재작성(URL 경로·중첩 페이로드 빌드는 PR-2/4) / DB 마이그레이션 적용(PR-3) / Edge Function 신설(PR-3) / UI 변경(PR-3·3.5·5) / JWT payload 변경(PR-1).

---

## 변경 이력

- 2026-05-30: 초안 (PR-0). architect 주도, 사용자 결정 6개 반영. ESM 문서 기준 재구현 8개 PR 로드맵·zod 계약·`esm_shipping_profiles` 테이블·동적 등록필드 프레임워크 확정.
