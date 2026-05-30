import { z } from 'zod'
import { MoneyKrwSchema } from './common'

/**
 * ESM(G마켓·옥션) 어댑터 zod 스키마 단일 소스.
 *
 * 마스터: docs/architecture/v1/features/esm.md §4 (API 스키마 zod 계약).
 * 근거 원문: docs/architecture/v1/features/esm-api/product/{20,4,161,17,19,23}.md
 *
 * 본 파일은 PR-0 산출물 — ESM 문서 기준 재구현(PR-1~6)의 계약을 고정한다.
 * Edge Function 측 미러: apps/api/supabase/functions/_shared/schemas.ts (구조 동일).
 * RHF resolver + Supabase insert + 서버 응답 parse 3중 재사용. 컴포넌트 inline z.object 금지.
 *
 * 사이트별 분리 모델(esm.md §1.1): gmarket/auction 은 별도 마켓으로 유지하고,
 * 한 호출에 site 하나만 채운다 (siteType 단일, price/stock 단일 사이트).
 *   - site='G'(지마켓) → siteType:2, price.Gmkt, stock.Gmkt, dispatchPolicyNo.gmkt
 *   - site='A'(옥션)   → siteType:1, price.Iac,  stock.Iac,  dispatchPolicyNo.iac
 *
 * 주의: 실제 호출 경로/페이로드 빌드 로직은 PR-2/4. PR-0 은 스키마 계약만 둔다.
 */

// ─────────────────────────────────────────────
// 공용 제약 — UTF-8 byte 길이 (≤100byte 상품명, esm.md §4.1)
// ─────────────────────────────────────────────

/** UTF-8 인코딩 byte 길이. 한글 3byte 가정. truncate 금지 → validation error. */
function utf8ByteLength(value: string): number {
  // TextEncoder 는 브라우저/Node/Deno 공통 표준.
  return new TextEncoder().encode(value).length
}

/** 10원 단위 검증 (esm.md §4.1 price). */
function isMultipleOfTen(value: number): boolean {
  return value % 10 === 0
}

// 판매기간 enum — esm.md §4.1 sellingPeriod (-1/0/15/30/60/90/365)
export const ESM_SELLING_PERIODS = [-1, 0, 15, 30, 60, 90, 365] as const
export const EsmSellingPeriodSchema = z.union([
  z.literal(-1),
  z.literal(0),
  z.literal(15),
  z.literal(30),
  z.literal(60),
  z.literal(90),
  z.literal(365),
])
export type EsmSellingPeriod = z.infer<typeof EsmSellingPeriodSchema>

// siteType — esm.md §4.1 (1=옥션 / 2=지마켓)
export const EsmSiteTypeSchema = z.union([z.literal(1), z.literal(2)])
export type EsmSiteType = z.infer<typeof EsmSiteTypeSchema>

// 배송 type — esm.md §4.1 shipping.type (1=택배 / 2=직접)
export const EsmShippingTypeSchema = z.union([z.literal(1), z.literal(2)])

// 사이트별 분리이므로 price/stock/sellingPeriod 는 Gmkt|Iac 한쪽만 채운다.
const EsmPriceSchema = z
  .object({
    Gmkt: z.number().int().min(10).max(999_999_999).refine(isMultipleOfTen, {
      message: '가격은 10원 단위여야 합니다',
    }),
    Iac: z.number().int().min(10).max(999_999_999).refine(isMultipleOfTen, {
      message: '가격은 10원 단위여야 합니다',
    }),
  })
  .partial()

const EsmStockSchema = z
  .object({
    Gmkt: z.number().int().min(1).max(99_999),
    Iac: z.number().int().min(1).max(99_999),
  })
  .partial()

const EsmSellingPeriodPairSchema = z
  .object({
    Gmkt: EsmSellingPeriodSchema,
    Iac: EsmSellingPeriodSchema,
  })
  .partial()

// ─────────────────────────────────────────────
// 4.4 officialNotice — 상품정보고시 (EsmOfficialNoticeSchema)
//   esm.md §4.4 / esm-api/product/161.md
// ─────────────────────────────────────────────
export const EsmOfficialNoticeDetailSchema = z.object({
  code: z.string().min(1),
  value: z.string().min(1),
})
export type EsmOfficialNoticeDetail = z.infer<
  typeof EsmOfficialNoticeDetailSchema
>

export const EsmOfficialNoticeSchema = z.object({
  // 41개 상품군 중 택1 (필수). 상품군 코드 마스터는 PR-5 에서 상수화.
  officialNoticeNo: z.string().min(1),
  details: z.array(EsmOfficialNoticeDetailSchema),
})
export type EsmOfficialNotice = z.infer<typeof EsmOfficialNoticeSchema>

// ─────────────────────────────────────────────
// 4.1 상품등록 요청 (EsmGoodsCreateRequestSchema)
//   POST /item/v1/goods — esm.md §4.1 / esm-api/product/20.md
// ─────────────────────────────────────────────

const EsmCategorySiteSchema = z.object({
  siteType: EsmSiteTypeSchema,
  catCode: z.string().min(1), // leaf 카테고리 코드
})

const EsmItemBasicInfoSchema = z.object({
  goodsName: z.object({
    kor: z
      .string()
      .min(1)
      .refine((v) => utf8ByteLength(v) <= 100, {
        message: '검색용 상품명(kor)은 100byte 이하여야 합니다',
      }),
  }),
  category: z.object({
    site: z.array(EsmCategorySiteSchema).min(1),
  }),
})

// 이미지 — basic 필수 + 추가 14 (addtionalImg1..14URL). esm-api 의 오타 표기(addtional) 보존.
const EsmImagesSchema = z
  .object({
    basicImgURL: z.string().url(),
    addtionalImg1URL: z.string().url().optional(),
    addtionalImg2URL: z.string().url().optional(),
    addtionalImg3URL: z.string().url().optional(),
    addtionalImg4URL: z.string().url().optional(),
    addtionalImg5URL: z.string().url().optional(),
    addtionalImg6URL: z.string().url().optional(),
    addtionalImg7URL: z.string().url().optional(),
    addtionalImg8URL: z.string().url().optional(),
    addtionalImg9URL: z.string().url().optional(),
    addtionalImg10URL: z.string().url().optional(),
    addtionalImg11URL: z.string().url().optional(),
    addtionalImg12URL: z.string().url().optional(),
    addtionalImg13URL: z.string().url().optional(),
    addtionalImg14URL: z.string().url().optional(),
  })
  .strict()

const EsmShippingPolicySchema = z.object({
  placeNo: z.string().min(1), // 출하지 번호 (배송 프로필)
})

const EsmDispatchPolicyNoSchema = z
  .object({
    gmkt: z.string().min(1),
    iac: z.string().min(1),
  })
  .partial()

const EsmShippingSchema = z.object({
  type: EsmShippingTypeSchema,
  policy: EsmShippingPolicySchema,
  dispatchPolicyNo: EsmDispatchPolicyNoSchema,
})

const EsmItemAddtionalInfoSchema = z.object({
  price: EsmPriceSchema,
  stock: EsmStockSchema,
  sellingPeriod: EsmSellingPeriodPairSchema,
  shipping: EsmShippingSchema,
  images: EsmImagesSchema,
  officialNotice: EsmOfficialNoticeSchema,
  isVatFree: z.boolean(),
})

export const EsmGoodsCreateRequestSchema = EsmItemBasicInfoSchema.pick({})
  .extend({
    itemBasicInfo: EsmItemBasicInfoSchema,
    itemAddtionalInfo: EsmItemAddtionalInfoSchema,
  })
  .superRefine((data, ctx) => {
    // 사이트별 분리: site 하나만 채운다. category.site 의 siteType 으로 사이트 판정.
    const siteTypes = data.itemBasicInfo.category.site.map((s) => s.siteType)
    const isGmkt = siteTypes.includes(2)
    const isAuction = siteTypes.includes(1)

    // 옥션 이미지 중복 불가 (esm.md §4.1 / esm-api/product/20.md).
    if (isAuction) {
      const imgs = data.itemAddtionalInfo.images
      const urls = Object.values(imgs).filter(
        (u): u is string => typeof u === 'string',
      )
      const distinct = new Set(urls)
      if (distinct.size !== urls.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '옥션은 이미지 URL 중복이 허용되지 않습니다',
          path: ['itemAddtionalInfo', 'images'],
        })
      }
    }

    // 사이트별 가격/재고 정합 — site='G' 면 Gmkt, site='A' 면 Iac 가 있어야 한다.
    const price = data.itemAddtionalInfo.price
    if (isGmkt && price.Gmkt === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '지마켓(siteType:2) 등록에는 price.Gmkt 가 필요합니다',
        path: ['itemAddtionalInfo', 'price', 'Gmkt'],
      })
    }
    if (isAuction && price.Iac === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '옥션(siteType:1) 등록에는 price.Iac 가 필요합니다',
        path: ['itemAddtionalInfo', 'price', 'Iac'],
      })
    }
  })
export type EsmGoodsCreateRequest = z.infer<typeof EsmGoodsCreateRequestSchema>

// ─────────────────────────────────────────────
// transformProduct 입력 보조 — ESM 전용 extra (mapping.extra 로 전달)
//   esm.md §7 PR-4: transformProduct 는 순수 함수. 배송 프로필 번호(placeNo/
//   dispatchPolicyNo)·officialNotice 등 ESM 고유 입력은 등록 오케스트레이터가
//   esm_shipping_profiles 조회·mapping 적재 결과로 mapping.extra 에 주입한다.
//   본 스키마는 그 extra 의 ESM 관련 부분만 안전 파싱한다(나머지 extra 키는 무시).
//   passthrough — 미지 extra 키(타 도메인)는 보존하되 검증 대상 아님.
// ─────────────────────────────────────────────
export const EsmTransformExtraSchema = z
  .object({
    // 배송 프로필에서 온 번호 (오케스트레이터가 shippingProfileId 로 조회 후 주입).
    placeNo: z.string().min(1).optional(),
    dispatchPolicyNo: z.string().min(1).optional(),
    bundlePolicyNo: z.string().min(1).optional(),
    // 상품정보고시 (PR-5 가 셀러 입력 → mapping 적재. PR-4 는 받으면 매핑만).
    officialNotice: EsmOfficialNoticeSchema.optional(),
    // 등록 옵션 — 미지정 시 transformProduct 가 기본값 적용.
    sellingPeriod: EsmSellingPeriodSchema.optional(),
    shippingType: EsmShippingTypeSchema.optional(),
    isVatFree: z.boolean().optional(),
    // 재고/판매가 override (미지정 시 Product 도메인 값 사용).
    stock: z.number().int().min(1).max(99_999).optional(),
  })
  .passthrough()
export type EsmTransformExtra = z.infer<typeof EsmTransformExtraSchema>

// ─────────────────────────────────────────────
// 4.2 createProduct 응답 (EsmGoodsCreateResponseSchema)
//   esm.md §4.2 / esm-api/product/20.md — passthrough 로 미지 필드 보존
//
//   보안 주의 (security.md §6): passthrough 로 보존되는 미지 필드가 그대로
//   Sentry/로그로 흐를 경우, 마스킹은 lib/security/redact.ts 의 키 이름 화이트리스트
//   (token/secret/email/phone/name 등) 에 의존한다. 알려진 응답 필드(goodsNo/
//   SiteGoodsNo/SiteGoodsComment/resultCode/message)에는 PII 가 없다. ESM 이
//   향후 비표준 키로 PII 를 반환하면 redact 키 매칭에 잡히지 않을 잔여 리스크가
//   있으므로, 이 응답을 Sentry extra/breadcrumb 에 직접 싣지 말 것(요약 필드만).
// ─────────────────────────────────────────────

const EsmSiteDetailEntrySchema = z
  .object({
    SiteGoodsNo: z.string().optional(),
    SiteGoodsComment: z.string().optional(),
  })
  .passthrough()

export const EsmGoodsCreateResponseSchema = z
  .object({
    goodsNo: z.number(),
    siteDetail: z
      .object({
        gmkt: EsmSiteDetailEntrySchema.optional(),
        iac: EsmSiteDetailEntrySchema.optional(),
      })
      .passthrough()
      .optional(),
    resultCode: z.number(),
    message: z.string().nullable().optional(),
  })
  .passthrough()
export type EsmGoodsCreateResponse = z.infer<
  typeof EsmGoodsCreateResponseSchema
>

// ─────────────────────────────────────────────
// 4.3 site-cats 카테고리 응답 (EsmSiteCatSchema)
//   esm.md §4.3 / esm-api/product/4.md — lazy 재귀 children
//   CategoryNode 정규화 매핑은 PR-2. PR-0 은 raw 응답 스키마만 확정.
// ─────────────────────────────────────────────

export interface EsmSiteCat {
  siteCatCode: string
  siteCatName: string
  isLeaf: boolean
  siteType?: EsmSiteType
  children?: EsmSiteCat[]
}

export const EsmSiteCatSchema: z.ZodType<EsmSiteCat> = z.lazy(() =>
  z.object({
    siteCatCode: z.string().min(1),
    siteCatName: z.string().min(1),
    isLeaf: z.boolean(),
    siteType: EsmSiteTypeSchema.optional(),
    children: z.array(EsmSiteCatSchema).optional(),
  }),
) as z.ZodType<EsmSiteCat>

// ─────────────────────────────────────────────
// 4.5 배송 프로필 (EsmShippingProfileSchema + Create input)
//   esm.md §3 테이블 / §4.5 — DB 컬럼과 1:1.
//   PII(주소·전화)는 생성 요청에만 존재하고 DB 엔 번호만 저장.
// ─────────────────────────────────────────────

export const ESM_PROFILE_SITES = ['G', 'A'] as const
export const EsmProfileSiteSchema = z.enum(ESM_PROFILE_SITES)
export type EsmProfileSite = z.infer<typeof EsmProfileSiteSchema>

// 발송유형 — esm.md §3 (A=당일/B=순차/C=해외/D=요청일/E=주문제작/F=미정)
export const ESM_DISPATCH_TYPES = ['A', 'B', 'C', 'D', 'E', 'F'] as const
export const EsmDispatchTypeSchema = z.enum(ESM_DISPATCH_TYPES)
export type EsmDispatchType = z.infer<typeof EsmDispatchTypeSchema>

// 배송비 유형 — esm.md §3 (1=묶음배송비 / 2=상품별배송비)
export const EsmFeeTypeSchema = z.union([z.literal(1), z.literal(2)])
export type EsmFeeType = z.infer<typeof EsmFeeTypeSchema>

export const ESM_SHIPPING_PROFILE_STATUSES = ['active', 'error'] as const
export const EsmShippingProfileStatusSchema = z.enum(
  ESM_SHIPPING_PROFILE_STATUSES,
)
export type EsmShippingProfileStatus = z.infer<
  typeof EsmShippingProfileStatusSchema
>

/**
 * 저장형 — esm_shipping_profiles 테이블 컬럼과 1:1 (esm.md §3).
 *
 * PII 경계(security.md §2 / esm.md §3): 본 저장형에는 주소·전화·이름 등 PII 필드를
 * 의도적으로 두지 않는다. ESM 측 식별 번호(addrNo/placeNo/dispatchPolicyNo)만 저장.
 * esm.md §3 의 raw_meta(jsonb) 컬럼은 "번호 외 부가, PII/시크릿 금지" 이므로
 * 본 타입 계약에서도 제외한다(임의 jsonb 가 PII 유입 통로가 되지 않도록).
 * PII 는 EsmShippingProfileCreateInputSchema.address 에만 존재하고 ESM 측에만 전달.
 */
export const EsmShippingProfileSchema = z.object({
  id: z.string().uuid(),
  sellerId: z.string().uuid(),
  marketAccountId: z.string().uuid(),
  site: EsmProfileSiteSchema,
  profileLabel: z.string().min(1),
  addrNo: z.string().min(1),
  placeNo: z.string().min(1),
  bundlePolicyNo: z.string().nullable().optional(),
  dispatchPolicyNo: z.string().min(1),
  dispatchType: EsmDispatchTypeSchema,
  shippingFee: MoneyKrwSchema,
  feeType: EsmFeeTypeSchema,
  status: EsmShippingProfileStatusSchema,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
})
export type EsmShippingProfile = z.infer<typeof EsmShippingProfileSchema>

/**
 * 생성 요청 — site/profile_label/dispatch_type/shipping_fee/fee_type + 주소 입력.
 * 주소·전화 등 PII 는 생성 요청에만 존재하고 ESM 측에만 전달, 우리 DB 엔 번호만 저장(esm.md §4.5).
 */
export const EsmShippingProfileCreateInputSchema = z.object({
  marketAccountId: z.string().uuid(),
  site: EsmProfileSiteSchema,
  profileLabel: z.string().min(1),
  dispatchType: EsmDispatchTypeSchema,
  shippingFee: MoneyKrwSchema,
  feeType: EsmFeeTypeSchema,
  // 주소록 생성 입력 (PII — DB 저장 금지, ESM 측에만 전달).
  address: z.object({
    zipCode: z.string().min(1),
    addressMain: z.string().min(1),
    addressDetail: z.string().optional(),
    contactName: z.string().min(1),
    contactPhone: z.string().min(1),
  }),
})
export type EsmShippingProfileCreateInput = z.infer<
  typeof EsmShippingProfileCreateInputSchema
>

// ─────────────────────────────────────────────
// 4.7 조회형 배송 리소스 (생성형→조회형 전환, esm.md "전환 결정 2026-05-30")
//   PR-E1 — 셀러가 ESM Plus 에서 만든 출하지/발송정책을 GET 조회 → select.
//   우리 앱은 생성하지 않는다(생성형 EsmShippingProfile* 는 deprecate, E3/E4 제거).
//   원문: esm-api/product/17.md (출하지 전체조회 → shippingPlaces[])
//        esm-api/product/19.md (발송정책 전체조회 → dispatchPolicies[])
//
// 정규화 응답 — Edge esm-shipping-list 가 raw ESM 응답을 정규화해 반환하는 모양.
// PII 경계(security.md §2): 출하지엔 주소·연락처가 ESM 측에 있으나, 우리는 저장 안 하고
//   select 노출용으로 이름/번호(placeNo/placeName, dispatchPolicyNo/name)만 통과시킨다.
// ─────────────────────────────────────────────

/**
 * 정규화 출하지 — esm-api/product/17.md shippingPlaces[].
 *   placeNo(int) → 문자열 식별자(우리 도메인은 번호를 문자열로 다룸, profile 과 동일).
 *   placeName(string) → select 라벨.
 *   isDefaultShippingPlace → 기본 출하지(select 기본값 힌트).
 * 주소/추가배송비 등은 select 노출에 불필요 + PII 인접 → 정규화에서 제외.
 */
export const EsmShippingPlaceSchema = z.object({
  placeNo: z.string().min(1),
  placeName: z.string().min(1),
  isDefault: z.boolean(),
})
export type EsmShippingPlace = z.infer<typeof EsmShippingPlaceSchema>

/**
 * 정규화 발송정책 — esm-api/product/19.md dispatchPolicies[].
 *   발송정책은 G마켓/옥션 사이트별로 별도 → site 구분 유지(dispatchPolicyNo.{gmkt|iac} 매칭용).
 *   dispatchPolicyNo(int) → 문자열 식별자.
 *   dispatchPolicyName(string) → select 라벨.
 *   dispatchType(A~F) → 발송유형(이미 정의된 EsmDispatchTypeSchema 재사용).
 */
export const EsmDispatchPolicySchema = z.object({
  site: EsmProfileSiteSchema,
  dispatchPolicyNo: z.string().min(1),
  dispatchPolicyName: z.string().min(1),
  dispatchType: EsmDispatchTypeSchema,
  isDefault: z.boolean(),
})
export type EsmDispatchPolicy = z.infer<typeof EsmDispatchPolicySchema>

/**
 * esm-shipping-list Edge Function 의 200 응답.
 *   출하지(공통) + 발송정책(요청 계정 site 분) 정규화 목록.
 *   site 는 요청한 market_account 의 사이트('G'|'A') — 호출측이 어느 사이트 분인지 안다.
 */
export const EsmShippingListResponseSchema = z.object({
  site: EsmProfileSiteSchema,
  places: z.array(EsmShippingPlaceSchema),
  dispatchPolicies: z.array(EsmDispatchPolicySchema),
})
export type EsmShippingListResponse = z.infer<
  typeof EsmShippingListResponseSchema
>

// ─────────────────────────────────────────────
// 4.6 마켓별 동적 등록필드 메타 (RegistrationFieldMetaSchema)
//   esm.md §4.6 — MarketAdapter.getRegistrationFields() 반환 타입.
//   PR-0 은 타입 계약만. 어댑터 메서드 실제 추가는 PR-3.5.
// ─────────────────────────────────────────────

export const REGISTRATION_FIELD_KINDS = [
  'select',
  'text',
  'number',
  'officialNotice',
  'shippingProfile',
] as const
export const RegistrationFieldKindSchema = z.enum(REGISTRATION_FIELD_KINDS)
export type RegistrationFieldKind = z.infer<typeof RegistrationFieldKindSchema>

export const REGISTRATION_FIELD_OPTIONS_SOURCES = [
  'shippingProfiles',
  'static',
  // 11번가 Layer 2 조회형 select 옵션 출처 (11st.md §4.6 / PR-2). additive — ESM 영역(위 2개) 미접촉.
  //   UI(MarketOptionsCard)가 useElevenStShippingAddresses 로 출고지/반품지 목록을 채운다.
  'elevenStOutbound',
  'elevenStReturn',
] as const
export const RegistrationFieldOptionsSourceSchema = z.enum(
  REGISTRATION_FIELD_OPTIONS_SOURCES,
)
export type RegistrationFieldOptionsSource = z.infer<
  typeof RegistrationFieldOptionsSourceSchema
>

export const RegistrationFieldMetaSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  kind: RegistrationFieldKindSchema,
  required: z.boolean(),
  optionsSource: RegistrationFieldOptionsSourceSchema.optional(),
  helpText: z.string().optional(),
  blockingReason: z.string().optional(),
})
export type RegistrationFieldMeta = z.infer<typeof RegistrationFieldMetaSchema>
