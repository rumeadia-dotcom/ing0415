# 2026-06-01 — 수량 구간(박스) 배송비 + 배송 설정 인라인 재편 설계

> 상품마다 다른 "수량 구간별 차등 배송비"(특정 개수 초과 시 다른 박스 → 배송비 배수)를 5개 마켓에 등록할 수 있게 모델링하고, 그 과정에서 현재의 "별도 엔티티 + 필수 select" 구조인 `shipping_policies`(배송 정책)를 **상품 인라인 배송 설정 + 선택적 템플릿**으로 재편한다.
>
> 상태: **구현 완료 (옵션 A) — C9, 2026-06-01**. 실제 구현이 본 설계와 다른 점:
> - **어댑터 wiring**: 11번가(`dlvCstInstBasiCd=04`)·쿠팡(단일 fallback+경고)만 `transformProduct` 에 wired (real 경로 동작). **네이버 `repeatQuantity` / ESM `each.feeType=4` 변환기는 작성·단위테스트만, 어댑터 미wiring** — 네이버 Edge 어댑터가 아직 stub, ESM 은 조회형 전환과 충돌하여 옵션 A 로 분리(C3·C7 real 트랙에서 wiring).
> - **파일명**: zod 단일 소스는 `lib/schemas/shipping-config.ts` (기존 송장 도메인 `shipping.ts` 와의 이름 충돌 회피). 폐기된 `shipping-policy.ts` 는 삭제.
> - **템플릿 스키마**: `ShippingTemplateSchema` 는 `{ name, isDefault, config }` 중첩(별도 flat 컬럼 미보존).
> - **back-compat**: `Product.shippingFeeKrw` 는 **제거하지 않고 유지**(유효 단일배송비 파생) + `shippingConfig` 추가 — 기존 어댑터 무중단.
> - **워커**: `resolveShippingFee`(shipping_policies.fee 조회) 제거 → `parseShippingConfig(products.shipping_config)` + `effectiveSingleFee`.
> 의존(동기화 완료): `cross-cutting/shipping-fee-model.md`, `features/registration.md §3.2`, `design-renewal/s3-register.md`.
> 근거: 2026-05-31~06-01 사용자 요구 — "상품마다 배송비 정책을 다르게, 특정 개수 넘으면 박스가 나뉘어 배송비 배수". CLAUDE.md "설계 원칙 — 사용자 편의 우선".

---

## 0. 문제 정의

셀러는 상품마다 다른 배송비 정책이 필요하다. 특히 **물리적 박스 용량** 때문에 "N개까지 한 박스 → 배송비 1단위, 초과분은 새 박스 → 배송비 배수"가 되는 상품이 많다 (예: 12개까지 2,500원 / 13~24개 5,000원 / 25~36개 7,500원).

선행 조사(2026-05-31, `shipping-fee-model.md` + 11번가·ESM·네이버 spec + 쿠팡 Wing 확인) 결과 **5개 중 4개 마켓이 수량 구간 배송비를 API로 지원**한다:

| 마켓 | 수량 구간 지원 | 표현 수단 | 최대 구간 |
|---|---|---|---|
| 네이버 | ✅ | `deliveryFee.repeatQuantity`(+ baseFee) = N개마다 기본배송비 반복 | 사실상 무한(균등) / 비균등은 2~3 |
| 11번가 | ✅ | `dlvCstInstBasiCd=04` + `dlvCnt1`(이상)/`dlvCnt2`(이하)/`dlvCst3`(구간 배송비) | 10 |
| G마켓 | ✅ | `shipping.policy.each.feeType=4` + `details.Condition/FeeAmnt` | 5 |
| 옥션 | ✅ | 동일 (ESM 공용) | 5 |
| 쿠팡 | ❌ | `deliveryChargeType` = FREE/NOT_FREE/CONDITIONAL_FREE/CHARGE_RECEIVED 4종뿐. 수량 구간 개념 없음 | — |

현재 우리 데이터 모델(`shipping_policies` = `name + fee 단일정수 + method + eta_days + is_default`)은 이 요구를 전혀 담지 못한다. 또한 "배송 정책"을 별도 엔티티로 두고 상품 등록 Step1에서 **필수 select** 하게 되어 있는데, 수량 구간은 박스 용량에 따라 상품마다 달라 재사용 엔티티에 맞지 않는다.

---

## 1. 개념 모델 — 배송 설정 재편 (§1~§4 확정)

배송 설정을 두 곳으로 재정립한다 (현재의 "별도 엔티티 + 필수 select" 폐기).

- **상품 인라인 배송 설정** (`products` 본문, 단일 진실원본) — 이 상품의 실제 배송비 의도. 수량 구간(박스)은 상품마다 다르므로 여기에 산다.
- **배송 템플릿** (옵션, 기존 `shipping_policies` 재편) — 셀러가 자주 쓰는 값을 저장해 두고 상품 폼을 **prefill** 만 한다. FK 강제·필수 select 없음.

> `products.shipping_policy_id`(필수 FK) → **제거**. 템플릿은 "적용 시 폼에 값 복사"하는 편의 장치로 강등.

**판단 근거 ("배송 정책 불필요" 가설 검증):** 절반만 맞다.
- 못 없애는 것: 배송 *설정 자체* — 배송비는 5개 마켓 등록 **필수값**.
- 없앨 수 있는 것: "별도 엔티티 + 매 상품 필수 select" 구조.
- 주의: 반품비·도서산간·결제방법·무료조건은 셀러 **공통 상수**라 매 상품 재입력은 CLAUDE.md "반복 제거" 위배 → 템플릿 prefill 로 흡수.

---

## 2. 데이터 모델

상품에 배송 설정을 **JSONB 1컬럼**으로 넣고 zod 단일 스키마로 검증한다 (flat 다수 컬럼 회피, "zod 단일 소스 + 외부데이터 런타임 검증" 규약과 일치).

```ts
// apps/web/src/lib/schemas/shipping.ts — 단일 소스 (RHF resolver + Supabase insert + 서버 parse 3중 재사용)
import { z } from 'zod'
import { ShippingMethodSchema } from './registration'
import { MARKET_IDS } from './common'

export const ShippingFeeTypeSchema = z.enum([
  'free', 'conditional_free', 'paid', 'quantity_tiered', 'charge_on_delivery',
])

export const ShippingConfigSchema = z.object({
  method: ShippingMethodSchema,                       // parcel/direct/quick/visit_pickup (기존 enum 재사용)
  etaDays: z.number().int().min(0).max(30),
  feeType: ShippingFeeTypeSchema,
  baseFee: z.number().int().min(0).default(0),        // paid / conditional_free 기본배송비
  freeThreshold: z.number().int().min(0).optional(),  // conditional_free 무료조건금액
  box: z.object({                                     // feeType === 'quantity_tiered'
    qtyPerBox: z.number().int().min(2),               // 박스당 N개 (ESM '첫 구간 2 이상' 규칙 수용)
    feePerBox: z.number().int().min(0),               // 박스당 M원
  }).optional(),
  payType: z.enum(['prepaid', 'collect', 'both']).default('prepaid'),
  returnFee: z.number().int().min(0).optional(),
  exchangeFee: z.number().int().min(0).optional(),
  areaSurcharge: z.object({
    jeju: z.number().int().min(0),
    island: z.number().int().min(0),
  }).optional(),
  bundleAllowed: z.boolean().default(false),
  // 미지원 마켓(쿠팡 등) 보정값 — 없으면 자동 근사(첫 구간 금액)
  marketOverrides: z.record(
    z.enum(MARKET_IDS),
    z.object({ feeType: ShippingFeeTypeSchema, baseFee: z.number().int().min(0) }),
  ).optional(),
}).superRefine((v, ctx) => {
  // feeType별 동반필드 필수
  if (v.feeType === 'paid' && v.baseFee <= 0) ctx.addIssue({ code: 'custom', message: '유료배송은 기본배송비 필요', path: ['baseFee'] })
  if (v.feeType === 'conditional_free' && v.freeThreshold == null) ctx.addIssue({ code: 'custom', message: '무료조건금액 필요', path: ['freeThreshold'] })
  if (v.feeType === 'quantity_tiered' && v.box == null) ctx.addIssue({ code: 'custom', message: '박스 설정 필요', path: ['box'] })
})

export type ShippingConfig = z.infer<typeof ShippingConfigSchema>

// 배송 템플릿 (shipping_policies 재편) — 동일 config + 이름 + 기본여부
export const ShippingTemplateSchema = ShippingConfigSchema.and(z.object({
  name: z.string().min(1).max(50),
  isDefault: z.boolean(),
}))
```

**DDL 변경 (마이그):**
- `products.shipping_config jsonb not null` 추가, `products.shipping_policy_id` 컬럼 제거.
- `shipping_policies` enrich: 기존 `fee int` flat → `config jsonb`(= `ShippingConfigSchema`) + `name` + `is_default` 유지. (테이블명 유지로 blast radius 축소. 의견 시 `shipping_templates` 로 rename 가능.)
- RLS 정책은 기존 그대로 (seller 본인 row).

**박스 모델이 곧 구간:** `box={qtyPerBox:12, feePerBox:2500}` → 구간 1~12:2,500 / 13~24:5,000 / 25~36:7,500 … (k번째 박스 = k×feePerBox). 셀러는 두 값만 입력.

---

## 3. 박스 → 마켓 매핑 매트릭스

공용 순수함수 `expandBoxToTiers(box, maxTiers)` → `{ minQty, maxQty|null, fee }[]` 를 만들고, 각 어댑터가 마켓 포맷으로 변환한다.

> **2026-06-01 실검증 완료** — 네이버 모델 / 11번가 open-ended / ESM details 포맷 확정. 잔여는 네이버 enum 리터럴(문자열)뿐 → §8.

| 마켓 | feeType=quantity_tiered 매핑 | 구간 한도 | 한도 초과 처리 |
|---|---|---|---|
| **네이버** | `deliveryFee.repeatQuantity = qtyPerBox`, `baseFee = feePerBox` (= 네이버 "수량별 배송비" 반복부과). `deliveryFeeType` enum 리터럴은 §8 | **무한(균등)** | 불필요 (네이티브) |
| **11번가** | `dlvCstInstBasiCd=04`, `dlvCnt1=1^(N+1)^…`(요소 K개), `dlvCnt2=N^2N^…`(요소 K-1개), `dlvCst3=M^2M^…`(요소 K개) | 10박스 | 마지막(dlvCnt2 없는) 구간이 ≥ open-ended → 10번째 요금. spec 예시 `dlvCnt1=1^10^100`/`dlvCnt2=9^99`/`dlvCst3=5000^1000^0` 로 확정 |
| **G마켓/옥션** | `shipping.policy.feeType=2`(상품별) + `each.feeType=4` + `each.details[]={Condition(수량), FeeAmnt(금액)}` 배열 | 5박스(=5단계) | 5박스 초과분은 5번째 요금 |
| **쿠팡** | ❌ → fallback (§4) | — | 항상 fallback |

> **핵심:** 박스 모델이면 **네이버는 한도 문제 없음**(수량별 배송비 = repeatQuantity 균등 반복). 한도는 11번가(10)·ESM(5)에서 박스 수가 그보다 많을 수 있을 때만, 그것도 마지막 구간 open-ended라 실질 손실은 초대량 주문에 한정.
>
> **ESM 할증(surcharge) 의미 주의 (2026-06-01 발견):** ESM `each.details.FeeAmnt` 는 **G마켓 포함 등록 시 "배송비 할증" 방식 + 카테고리별 최대 배송비 상한**(`20.md:118`). 즉 박스 모델의 "k번째 박스 총액 k×M" 을 ESM 에 넣을 때 FeeAmnt 가 *총액*인지 *base 대비 할증분*인지 + 카테고리 상한에 걸리는지 구현 시 실호출 검증 필요. 착불(`feePayType=3`)은 **옥션 단독 등록만** 허용.
>
> **네이버 구간별(비균등) 별도 메커니즘:** 네이버는 우리 박스(균등) 외에 "구간별 배송비(2구간/3구간)" = `secondBaseQuantity`/`secondExtraFee`/`thirdBaseQuantity`/`thirdExtraFee` 로 **비균등 최대 3구간**도 지원. v1 박스 모델은 균등만 쓰므로 미사용 — 향후 비균등 입력(§2 입력모델 '구간 직접 입력') 도입 시 네이버는 이 필드로, 11번가/ESM 은 임의 dlvCst3/FeeAmnt 로 매핑 가능.

---

## 4. fallback + 경고 (자동 근사) — §4 확정

미지원(쿠팡) 또는 한도 초과(11번가>10, ESM>5) 시:

1. **기본 동작** — 그 마켓엔 `feeType=paid, baseFee=feePerBox`(=1박스 요금) 단일 등록.
2. **가시적 경고** — Step4 미리보기 + 등록 결과(s6)에 배너 (`ErrorMessage` 공통 컴포넌트, 접힘 가능):
   *"쿠팡은 수량 구간 미지원 → 박스당 2,500원 단일 적용. 2박스 이상 주문은 배송비가 실제보다 적게 청구됩니다."*
3. **선택적 override** — 셀러가 `marketOverrides.coupang` 로 단일값 직접 지정 가능. 지정 시 경고 해제.
4. 한도 초과도 동일 경고 변형 ("N박스까지만 구간 반영").

> **절대 금지:** 무료(0원) 자동 등록 (셀러 손실). 미지정 시 항상 "박스당 요금"으로 근사.

---

## 5. UI 흐름

**Step1 (상품정보) — 기존 "배송정책 *" select 를 인라인 "배송 설정" 섹션으로 교체:**

```
배송 설정                                    [ 템플릿 적용 ▼ ] (옵션 prefill)
─────────────────────────────────────────────────────────
배송방식 [택배 ▼]   예상 배송일수 [ 2 ]일

배송비 유형  ○무료  ○조건부무료  ○유료  ●수량별(박스)  ○착불
  └ 박스당 [ 12 ]개   박스당 배송비 [ 2,500 ]원
     미리보기:  1~12개 2,500원 · 13~24개 5,000원 · 25~36개 7,500원 …
     ⚠ 쿠팡은 수량 구간 미지원 → 박스당 2,500원 단일 적용  [쿠팡 단일값 지정]

결제방법 [선결제 ▼]   □ 묶음배송 허용
반품비 [2,500]원  교환비 [5,000]원   ▸ 도서산간 추가비 (접힘)

[ 이 설정을 템플릿으로 저장 ] (옵션)
```

- **실시간 구간 미리보기** — 박스 두 값 입력 시 구간이 펼쳐지는 모습 즉시 표시.
- **Step4 미리보기**: 마켓별 "실제 들어갈 배송비" 표 (네이버 `12개마다 2,500 반복` / 11번가 `10구간` / 쿠팡 `박스당 2,500 단일 ⚠`).
- **blockingReasons** (CLAUDE.md UI 규약): 박스 유형인데 `qtyPerBox`/`feePerBox` 미입력 시 다음 단계 disabled + tooltip.
- **설정 화면**: `SettingsPoliciesPage` → 라벨 "배송 템플릿", 폼은 동일 `ShippingTemplateSchema`(박스 포함).
- user_flow s3 노드 자체는 불변(화면 추가 아님) — 배송 입력 방식만 변경.

---

## 6. Blast radius (구현 PR 범위 — 본 설계는 편집하지 않음)

| 영역 | 변경 |
|---|---|
| **DB** | 마이그: `products.shipping_config jsonb` 추가 + `shipping_policy_id` 제거 / `shipping_policies` enrich / `seed.sql`·`tests/rls-cross-tenant.sql` 갱신 |
| **zod** | 신규 `lib/schemas/shipping.ts`(단일 소스) / `shipping-policy.ts`→템플릿 재편 / `_shared/schemas.ts`(`shippingFeeKrw`→`shippingConfig`)·`_shared/shipping-fee.ts`(박스→마켓 변환 헬퍼) / `registration.ts` Step1Schema |
| **FE** | `StepInfoPage`(인라인 교체)·`useRegisterFormStore`·`useProductDraft`·`useShippingPolicies`→`useShippingTemplates`·`SettingsPoliciesPage`·`StepPreview`·결과(s6)·`locales/ko.ts` |
| **어댑터** | 네이버 `real/naver/index.ts`(repeatQuantity)·11번가 `eleven-st-map.ts`(04+dlvCnt1/2/dlvCst3)·ESM(each.feeType=4)·쿠팡 `real/coupang/index.ts`(fallback) `transformProduct` + 공용 `expandBoxToTiers` 순수함수 + `parity.spec` |
| **문서동기화** | `cross-cutting/shipping-fee-model.md`(Layer1 모델 — feeType에 quantity_tiered/박스/fallback 반영, §2 표 갱신)·`features/registration.md §3.2`·`design-renewal/s3-register.md` (CLAUDE.md 2개 산출물 룰) |

> **실제 구현(C9)과의 차이 (2026-06-01):**
> - **어댑터**: 위 표는 4 마켓 `transformProduct` 동시 wiring 을 가정했으나, 실제는 **11번가 + 쿠팡만 wired**. 네이버 변환기(`repeatQuantity`)는 함수·단위테스트만 — **네이버 Edge 어댑터가 아직 stub** 이라 wiring 대상이 없음. ESM `each.feeType=4` 변환기도 작성만 — 조회형 전환과 충돌하여 미wiring. 두 마켓은 C3·C7 real 트랙에서 wiring.
> - **web 어댑터**: 박스→마켓 매핑은 **Edge 측 순수모듈**(`_shared/market-adapters/box-shipping.ts` + `expandBoxToTiers`)에서만 사용. web mock 어댑터는 박스 전개를 직접 쓰지 않음(미리보기는 web `lib/shipping/expand-box.ts` 의 `describeShippingForMarket` 사용).
> - **zod 파일명**: 표의 `lib/schemas/shipping.ts` 는 실제로 **`shipping-config.ts`**(기존 송장 `shipping.ts` 와 충돌 회피). `shipping-policy.ts` 는 삭제.
> - **"0원 버그"**: §7·아래 회귀 항목의 `shippingFeeKrw:0` 하드코딩 버그는 **C9 이전에 이미 `resolveShippingFee` 도입으로 해소**돼 있었음 — C9 는 그 경로를 `shipping_config` 로 교체한 것(신규 버그 픽스 아님).

---

## 7. 테스트

- **`expandBoxToTiers` + 마켓 변환 순수함수** (집중 대상): 11번가 10박스 생성/초과 캡 · ESM 5박스/캡 · 네이버 repeatQuantity · 쿠팡 fallback 단일+경고플래그. 각 pass + fail 시나리오 (R-001).
- **`ShippingConfigSchema`**: feeType별 동반필드 필수 (paid→baseFee 없으면 fail, conditional_free→freeThreshold 없으면 fail, quantity_tiered→box 없으면 fail). pass 1 + fail ≥1 (zod 규약).
- **`parity.spec`**: mock↔real `transformProduct` 배송비 동등성 (R-006).
- **워커 fee resolve 회귀** — `shipping_config` 경로(`parseShippingConfig` + `effectiveSingleFee`)가 셀러 배송비를 올바로 반영하는지 검증. (참고: `shippingFeeKrw:0` 하드코딩 버그는 C9 이전 `resolveShippingFee` 로 이미 해소됨 — C9 는 그 경로를 `shipping_config` 로 교체.)
- (선택) E2E 골든패스: 수량별 박스 상품 1건 등록.

---

## 8. 확인 필요

### 8.1 해소 완료 (2026-06-01 실검증)

- ✅ **네이버 수량별 모델** — "수량별 배송비"는 `repeatQuantity`(반복 수량) + `baseFee`(반복 부과 금액)로 **균등·무한** 표현 = 우리 박스 모델 네이티브 매핑. "구간별 배송비(2/3구간)"는 별개의 비균등(second/third, 최대 3). 박스 모델 가정 확정.
- ✅ **11번가 마지막 구간 open-ended** — spec 예시(`dlvCnt1=1^10^100`/`dlvCnt2=9^99`/`dlvCst3=5000^1000^0`)로 dlvCnt2 가 1개 적고 마지막이 ≥(이상) 처리임을 확정.
- ✅ **ESM details 포맷** — `each.details` = `{Condition, FeeAmnt}` 배열, 최대 5단계 (`20.md:114-118`).

### 8.2 구현 착수 전 잔여 (실호출 트랙에서 확정)

- **네이버 `deliveryFeeType` enum 리터럴 문자열** — 모델은 확정, 단 수량별에 해당하는 enum *문자열 값*은 apicenter 봇 차단으로 web 미확정. 셀러 실 API 키로 1회 호출해 확정 (값은 version-specific 가능성 있어 어차피 live 검증 대상). 모델이 확정이라 **설계 위험 아님.**
- **ESM FeeAmnt 할증/상한 의미** — G마켓 포함 등록 시 FeeAmnt 가 *총액* vs *base 대비 할증분*, 카테고리별 최대 배송비 상한 충돌 여부 실호출 검증 (§3 주의 박스).
- **쿠팡 fallback 경고 카피 강도** — under-charge 위험을 셀러에게 어느 수준으로 경고할지 (배너 문구 최종 — 카피 결정, 설계 비차단).

---

## 9. 결정 로그

- 2026-06-01: §1 배송 정책 재편 = **인라인 + 선택적 템플릿** (사용자 승인). 필수 select 제거.
- 2026-06-01: §2 입력 모델 = **박스 모델** (박스당 N개 + 박스당 M원, 구간 자동 생성). 사용자 승인.
- 2026-06-01: §4 미지원 fallback = **자동 근사(첫 구간 금액) + 가시적 경고 + 선택적 마켓별 override**. 사용자 승인.
- 2026-06-01: §2 저장 = `products.shipping_config jsonb` 단일 컬럼 + zod 단일 소스 / 템플릿 테이블명 `shipping_policies` 유지 / fallback 기본값 = 박스당 요금. (사용자 "이견 없음".)
- 2026-06-01: §8 실검증 — 네이버 박스=`repeatQuantity`(무한 균등) 확정 / 11번가 마지막 구간 ≥ open-ended 확정 / ESM `each.details[]` 최대 5단계 + G마켓 할증·카테고리 상한 제약 발견. 잔여: 네이버 enum 리터럴(문자열)·ESM FeeAmnt 할증 의미만 실호출 트랙으로 이관(설계 비차단).
