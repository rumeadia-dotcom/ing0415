/**
 * Edge Function 측 zod 스키마 미러.
 *
 * 마스터 (클라이언트 단일 출처):
 *   - src/lib/schemas/common.ts        — MarketId
 *   - src/lib/schemas/market.ts        — TokenSet / CategoryNode / Product / MarketMapping / MarketPayload / CreateProductResult
 *   - docs/architecture/v1/cross-cutting/registration-job-state.md §3.1 — ENUM
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §2.2
 *
 * 강제:
 *   - 본 파일은 클라이언트 스키마의 **그라운드 트루스 미러**. 변경 시 양쪽 동시 갱신.
 *   - Vite/Node ESM ↔ Deno 호환성 문제로 `src/lib/schemas/*` 를 직접 import 하지 않음
 *     (npm: specifier 사용 + tsconfig path alias 미적용).
 *   - CI 검증 (Phase 후속): 두 파일의 zod 시그니처 diff 가 0 인지 lint 룰로 비교.
 *
 * 본 미러는 zod 3 API 만 사용 (4.x 도입 시 양쪽 동시 마이그레이션).
 */

import { z } from 'npm:zod@3.23.8'

// ─────────────────────────────────────────────
// MarketId  (common.ts)
// ─────────────────────────────────────────────
export const MARKET_IDS = [
  'naver',
  'coupang',
  '11st',
  'gmarket',
  'auction',
] as const
export const MarketIdSchema = z.enum(MARKET_IDS)
export type MarketId = z.infer<typeof MarketIdSchema>

// ─────────────────────────────────────────────
// 시간 / 식별자 / 통화
// ─────────────────────────────────────────────
export const UuidSchema = z.string().uuid()
export const IsoDateTimeOffsetSchema = z.string().datetime({ offset: true })
export const IsoDateTimeSchema = z.string().datetime()
export const MoneyKrwSchema = z.number().int().nonnegative()

// ─────────────────────────────────────────────
// TokenSet  (market.ts §2.2)
// ─────────────────────────────────────────────
export const TokenSetSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: IsoDateTimeOffsetSchema,
  scope: z.string().optional(),
  tokenType: z.literal('Bearer').default('Bearer'),
})
export type TokenSet = z.infer<typeof TokenSetSchema>

// ─────────────────────────────────────────────
// MarketCredentialKind  (credential-vault.md §3.1)
// ─────────────────────────────────────────────
export const MARKET_CREDENTIAL_KINDS = [
  'oauth',
  'hmac',
  'esm_jwt',
  'api_key',
] as const
export const MarketCredentialKindSchema = z.enum(MARKET_CREDENTIAL_KINDS)
export type MarketCredentialKind = z.infer<typeof MarketCredentialKindSchema>

// ─────────────────────────────────────────────
// AuthInput  (market-adapter.md §2.1 / §2.2)
//   - oauth_code: 네이버 (`type=SELF` OAuth Authorization Code)
//   - hmac_key:   쿠팡 윙 OpenAPI (ACCESS_KEY + SECRET_KEY + VENDOR_ID)
//   - esm_jwt:    G마켓·옥션 ESM 2.0 (masterId + secretKey + sellerId + site)
//   - api_key:    11번가 (v2 — IP 화이트리스트 미해결. 인터페이스 호환 보존용)
// ─────────────────────────────────────────────
export const OAuthCodeAuthInputSchema = z.object({
  kind: z.literal('oauth_code'),
  code: z.string().min(1),
})
export const HmacKeyAuthInputSchema = z.object({
  kind: z.literal('hmac_key'),
  accessKey: z.string().min(1),
  secretKey: z.string().min(1),
  vendorId: z.string().min(1),
})
export const EsmJwtAuthInputSchema = z.object({
  kind: z.literal('esm_jwt'),
  masterId: z.string().min(1),
  secretKey: z.string().min(1),
  sellerId: z.string().min(1),
  site: z.enum(['G', 'A']),
})
export const ApiKeyAuthInputSchema = z.object({
  kind: z.literal('api_key'),
  apiKey: z.string().min(1),
})

export const AuthInputSchema = z.discriminatedUnion('kind', [
  OAuthCodeAuthInputSchema,
  HmacKeyAuthInputSchema,
  EsmJwtAuthInputSchema,
  ApiKeyAuthInputSchema,
])
export type AuthInput = z.infer<typeof AuthInputSchema>

// ─────────────────────────────────────────────
// Stored credential 페이로드 (jsonb 내부 형식)
// ─────────────────────────────────────────────
export const HmacKeyPayloadSchema = z.object({
  accessKey: z.string().min(1),
  secretKey: z.string().min(1),
  vendorId: z.string().min(1),
})
export type HmacKeyPayload = z.infer<typeof HmacKeyPayloadSchema>

export const EsmJwtKeyPayloadSchema = z.object({
  masterId: z.string().min(1),
  secretKey: z.string().min(1),
  sellerId: z.string().min(1),
  site: z.enum(['G', 'A']),
})
export type EsmJwtKeyPayload = z.infer<typeof EsmJwtKeyPayloadSchema>

export const ApiKeyPayloadSchema = z.object({
  apiKey: z.string().min(1),
})
export type ApiKeyPayload = z.infer<typeof ApiKeyPayloadSchema>

export const StoredCredentialSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('oauth'),
    payload: TokenSetSchema,
    expiresAt: IsoDateTimeOffsetSchema,
  }),
  z.object({
    kind: z.literal('hmac'),
    payload: HmacKeyPayloadSchema,
    expiresAt: IsoDateTimeOffsetSchema.optional(),
  }),
  z.object({
    kind: z.literal('esm_jwt'),
    payload: EsmJwtKeyPayloadSchema,
    expiresAt: IsoDateTimeOffsetSchema.optional(),
  }),
  z.object({
    kind: z.literal('api_key'),
    payload: ApiKeyPayloadSchema,
    expiresAt: IsoDateTimeOffsetSchema.optional(),
  }),
])
export type StoredCredential = z.infer<typeof StoredCredentialSchema>

// ─────────────────────────────────────────────
// CategoryNode (재귀)
// ─────────────────────────────────────────────
export interface CategoryNode {
  id: string
  name: string
  depth: number
  leaf: boolean
  parentId: string | null
  children: CategoryNode[]
}
export const CategoryNodeSchema: z.ZodType<CategoryNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    depth: z.number().int().min(1).max(10),
    leaf: z.boolean(),
    parentId: z.string().nullable(),
    children: z.array(CategoryNodeSchema),
  }),
)

// ─────────────────────────────────────────────
// Product (도메인 마스터)
// ─────────────────────────────────────────────
export const ProductImageSchema = z.object({
  url: z.string().url(),
  alt: z.string().max(120).optional(),
  order: z.number().int().min(0),
})
export type ProductImage = z.infer<typeof ProductImageSchema>

export const ProductSchema = z.object({
  id: UuidSchema,
  sellerId: UuidSchema,
  name: z.string().min(1).max(100),
  priceKrw: MoneyKrwSchema,
  stock: z.number().int().nonnegative(),
  images: z.array(ProductImageSchema).min(1).max(20),
  descriptionHtml: z.string().max(50_000).default(''),
  categoryHint: z.string().max(120).optional(),
  brand: z.string().max(60).optional(),
  shippingFeeKrw: MoneyKrwSchema.default(0),
})
export type Product = z.infer<typeof ProductSchema>

// ─────────────────────────────────────────────
// MarketMapping
// ─────────────────────────────────────────────
export const MarketMappingSchema = z.object({
  market: MarketIdSchema,
  categoryId: z.string().min(1),
  transformedImageUrls: z.array(z.string().url()).min(1).max(20),
  extra: z.record(z.string(), z.unknown()).default({}),
})
export type MarketMapping = z.infer<typeof MarketMappingSchema>

// ─────────────────────────────────────────────
// MarketPayload (opaque, 마켓별 zod 가 raw 검증)
// ─────────────────────────────────────────────
export const MarketPayloadSchema = z.object({
  market: MarketIdSchema,
  raw: z.unknown(),
})
export type MarketPayload = z.infer<typeof MarketPayloadSchema>

// ─────────────────────────────────────────────
// CreateProductResult
// ─────────────────────────────────────────────
export const CreateProductResultSchema = z.object({
  market: MarketIdSchema,
  externalId: z.string().min(1),
  productUrl: z.string().url(),
  status: z.enum(['succeeded', 'partial']),
  warnings: z
    .array(
      z.object({
        code: z.string(),
        message: z.string(),
      }),
    )
    .default([]),
})
export type CreateProductResult = z.infer<typeof CreateProductResultSchema>

// ─────────────────────────────────────────────
// RegistrationJob 상태 ENUM (cross-cutting §3.1)
// ─────────────────────────────────────────────
export const JOB_STATUSES = [
  'pending',
  'running',
  'partial',
  'succeeded',
  'failed',
  'retrying',
  'cancelled',
] as const
export const JobStatusSchema = z.enum(JOB_STATUSES)
export type JobStatus = z.infer<typeof JobStatusSchema>

export const MARKET_RESULT_STATUSES = [
  'pending',
  'in_flight',
  'success',
  'failed',
  'failed_final',
] as const
export const MarketResultStatusSchema = z.enum(MARKET_RESULT_STATUSES)
export type MarketResultStatus = z.infer<typeof MarketResultStatusSchema>

// ─────────────────────────────────────────────
// MarketError code (어댑터 throw)
// ─────────────────────────────────────────────
export const MarketErrorCodeSchema = z.enum([
  'unauthorized',
  'rate_limit',
  'validation',
  'network',
  'server',
  'unknown',
])
export type MarketErrorCode = z.infer<typeof MarketErrorCodeSchema>

// ─────────────────────────────────────────────
// jmr.error_code (재시도 정책 §6.2)
// market-adapter.md §6.2.1 매핑 표 단일 출처
// ─────────────────────────────────────────────
export const JOB_MARKET_ERROR_CODES = [
  'rate_limit',
  'timeout',
  'market_5xx',
  'oauth_expired',
  'oauth_revoked',
  'validation',
  'image_invalid',
  'duplicate',
  'quota_exceeded',
  'unknown',
] as const
export const JobMarketErrorCodeSchema = z.enum(JOB_MARKET_ERROR_CODES)
export type JobMarketErrorCode = z.infer<typeof JobMarketErrorCodeSchema>

// ─────────────────────────────────────────────
// ESM(G마켓·옥션) 스키마 (src/lib/schemas/esm.ts 미러)
//   마스터: docs/architecture/v1/features/esm.md §4
//   클라이언트 단일 출처: apps/web/src/lib/schemas/esm.ts — 변경 시 양쪽 동시 갱신.
// ─────────────────────────────────────────────

/** UTF-8 byte 길이 (한글 3byte). truncate 금지 → validation error. */
function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

function isMultipleOfTen(value: number): boolean {
  return value % 10 === 0
}

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

export const EsmSiteTypeSchema = z.union([z.literal(1), z.literal(2)])
export type EsmSiteType = z.infer<typeof EsmSiteTypeSchema>

export const EsmShippingTypeSchema = z.union([z.literal(1), z.literal(2)])

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

export const EsmOfficialNoticeDetailSchema = z.object({
  code: z.string().min(1),
  value: z.string().min(1),
})
export type EsmOfficialNoticeDetail = z.infer<
  typeof EsmOfficialNoticeDetailSchema
>

export const EsmOfficialNoticeSchema = z.object({
  officialNoticeNo: z.string().min(1),
  details: z.array(EsmOfficialNoticeDetailSchema),
})
export type EsmOfficialNotice = z.infer<typeof EsmOfficialNoticeSchema>

const EsmCategorySiteSchema = z.object({
  siteType: EsmSiteTypeSchema,
  catCode: z.string().min(1),
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
  placeNo: z.string().min(1),
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

// transformProduct 입력 보조 — ESM 전용 extra (mapping.extra). Web 미러:
// apps/web/src/lib/schemas/esm.ts EsmTransformExtraSchema (구조 동일).
// 오케스트레이터가 배송 프로필 번호(placeNo/dispatchPolicyNo)·officialNotice 를 주입.
export const EsmTransformExtraSchema = z
  .object({
    placeNo: z.string().min(1).optional(),
    dispatchPolicyNo: z.string().min(1).optional(),
    bundlePolicyNo: z.string().min(1).optional(),
    officialNotice: EsmOfficialNoticeSchema.optional(),
    sellingPeriod: EsmSellingPeriodSchema.optional(),
    shippingType: EsmShippingTypeSchema.optional(),
    isVatFree: z.boolean().optional(),
    stock: z.number().int().min(1).max(99_999).optional(),
  })
  .passthrough()
export type EsmTransformExtra = z.infer<typeof EsmTransformExtraSchema>

export const EsmGoodsCreateRequestSchema = z
  .object({
    itemBasicInfo: EsmItemBasicInfoSchema,
    itemAddtionalInfo: EsmItemAddtionalInfoSchema,
  })
  .superRefine((data, ctx) => {
    const siteTypes = data.itemBasicInfo.category.site.map((s) => s.siteType)
    const isGmkt = siteTypes.includes(2)
    const isAuction = siteTypes.includes(1)

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

// 보안 주의 (security.md §6): passthrough 보존 필드는 redact.ts 키 화이트리스트에
// 의존해 마스킹된다. 알려진 응답 필드엔 PII 가 없으나 ESM 비표준 키 PII 잔여
// 리스크가 있으므로 이 응답을 로그/Sentry extra 에 직접 싣지 말 것(요약 필드만).
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
)

export const ESM_PROFILE_SITES = ['G', 'A'] as const
export const EsmProfileSiteSchema = z.enum(ESM_PROFILE_SITES)
export type EsmProfileSite = z.infer<typeof EsmProfileSiteSchema>

export const ESM_DISPATCH_TYPES = ['A', 'B', 'C', 'D', 'E', 'F'] as const
export const EsmDispatchTypeSchema = z.enum(ESM_DISPATCH_TYPES)
export type EsmDispatchType = z.infer<typeof EsmDispatchTypeSchema>

export const EsmFeeTypeSchema = z.union([z.literal(1), z.literal(2)])
export type EsmFeeType = z.infer<typeof EsmFeeTypeSchema>

export const ESM_SHIPPING_PROFILE_STATUSES = ['active', 'error'] as const
export const EsmShippingProfileStatusSchema = z.enum(
  ESM_SHIPPING_PROFILE_STATUSES,
)
export type EsmShippingProfileStatus = z.infer<
  typeof EsmShippingProfileStatusSchema
>

// PII 경계(security.md §2 / esm.md §3): 저장형엔 주소·전화·이름 PII 미포함.
// 번호(addrNo/placeNo/dispatchPolicyNo)만 저장. raw_meta(jsonb)는 타입 계약에서
// 제외 — 임의 jsonb 가 PII 유입 통로가 되지 않도록. PII 는 CreateInput.address 만.
export const EsmShippingProfileSchema = z.object({
  id: UuidSchema,
  sellerId: UuidSchema,
  marketAccountId: UuidSchema,
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
  createdAt: IsoDateTimeOffsetSchema,
  updatedAt: IsoDateTimeOffsetSchema,
})
export type EsmShippingProfile = z.infer<typeof EsmShippingProfileSchema>

export const EsmShippingProfileCreateInputSchema = z.object({
  marketAccountId: UuidSchema,
  site: EsmProfileSiteSchema,
  profileLabel: z.string().min(1),
  dispatchType: EsmDispatchTypeSchema,
  shippingFee: MoneyKrwSchema,
  feeType: EsmFeeTypeSchema,
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
// 조회형 배송 리소스 (생성형→조회형 전환, esm.md "전환 결정 2026-05-30")
//   PR-E1 — apps/web/src/lib/schemas/esm.ts 4.7 절 미러 (구조 동일).
//   원문: esm-api/product/17.md (출하지 전체조회) / 19.md (발송정책 전체조회).
//   PII 경계: select 노출용 이름/번호만 정규화. 주소/연락처는 통과시키지 않는다.
//   ⚠️ 생성형 EsmShippingProfile* 스키마는 제거하지 않는다 (E3/E4 담당).
// ─────────────────────────────────────────────

export const EsmShippingPlaceSchema = z.object({
  placeNo: z.string().min(1),
  placeName: z.string().min(1),
  isDefault: z.boolean(),
})
export type EsmShippingPlace = z.infer<typeof EsmShippingPlaceSchema>

export const EsmDispatchPolicySchema = z.object({
  site: EsmProfileSiteSchema,
  dispatchPolicyNo: z.string().min(1),
  dispatchPolicyName: z.string().min(1),
  dispatchType: EsmDispatchTypeSchema,
  isDefault: z.boolean(),
})
export type EsmDispatchPolicy = z.infer<typeof EsmDispatchPolicySchema>

export const EsmShippingListResponseSchema = z.object({
  site: EsmProfileSiteSchema,
  places: z.array(EsmShippingPlaceSchema),
  dispatchPolicies: z.array(EsmDispatchPolicySchema),
})
export type EsmShippingListResponse = z.infer<
  typeof EsmShippingListResponseSchema
>

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

// ─────────────────────────────────────────────
// 11번가(11st) 스키마 (src/lib/schemas/eleven-st.ts 미러, PR-0 — spec import #265)
//   마스터: docs/architecture/v1/features/11st.md §4
//   응답은 stripNsPrefix(eleven-st-map.ts) 로 ns2 제거 후 parse.
// ─────────────────────────────────────────────

const EstCode = z.string().min(1)
const EstKrw = z.coerce.number().int().nonnegative()
/** 문자열/숫자 → 문자열 (z.coerce.string 의 undefined→"undefined" 문제 회피, 필수용). */
const EstNumOrStr = z.union([z.string(), z.number()]).transform((v) => String(v))

export const ElevenStProductCreateSchema = z
  .object({
    selMthdCd: EstCode,
    prdTypCd: EstCode,
    prdStatCd: EstCode,
    dispCtgrNo: EstCode,
    prdNm: z.string().min(1).max(100),
    brand: z.string().min(1),
    selPrc: EstKrw.refine((v) => v % 10 === 0, '판매가는 10원 단위'),
    prdSelQty: z.coerce.number().int().positive(),
    prdImage01: z.string().url(),
    htmlDetail: z.string().min(1),
    minorSelCnYn: z.enum(['Y', 'N']),
    suplDtyfrPrdClfCd: EstCode,
    rmaterialTypCd: EstCode,
    orgnTypCd: EstCode,
    dlvCnAreaCd: EstCode,
    dlvWyCd: EstCode,
    dlvClf: EstCode,
    dlvCstInstBasiCd: EstCode,
    bndlDlvCnYn: z.enum(['Y', 'N']),
    dlvCstPayTypCd: EstCode,
    jejuDlvCst: EstKrw,
    islandDlvCst: EstKrw,
    rtngdDlvCst: EstKrw,
    exchDlvCst: EstKrw,
    addrSeqOut: EstCode,
    addrSeqIn: EstCode,
    asDetail: z.string().min(1),
    rtngExchDetail: z.string().min(1),
  })
  .passthrough()
export type ElevenStProductCreate = z.infer<typeof ElevenStProductCreateSchema>

export const ELEVEN_ST_CREATE_SUCCESS_CODES = ['200', '210'] as const

export const ElevenStProductCreateResponseSchema = z
  .object({
    productNo: EstNumOrStr.optional(),
    resultCode: EstNumOrStr,
    message: z.string().optional(),
  })
  .passthrough()
export type ElevenStProductCreateResponse = z.infer<
  typeof ElevenStProductCreateResponseSchema
>

export const ElevenStCategorySchema = z
  .object({
    dispNo: EstNumOrStr,
    dispNm: z.string(),
    depth: z.coerce.number().int().min(1),
    parentDispNo: EstNumOrStr,
    leafYn: z.enum(['Y', 'N']),
    certType: EstNumOrStr.optional(),
    requiredYn: z.enum(['Y', 'N']).optional(),
  })
  .passthrough()
export type ElevenStCategory = z.infer<typeof ElevenStCategorySchema>

export const ElevenStOrderSchema = z
  .object({
    ordNo: EstNumOrStr,
    dlvNo: EstNumOrStr,
    ordPrdSeq: EstNumOrStr.optional(),
    ordNm: z.string().optional(),
    rcvrNm: z.string().optional(),
    rcvrBaseAddr: z.string().optional(),
    rcvrDtlsAddr: z.string().optional(),
    rcvrPrtblNo: z.string().optional(),
    prdNm: z.string().optional(),
    ordQty: z.coerce.number().int().nonnegative().optional(),
    ordAmt: z.coerce.number().int().nonnegative().optional(),
    ordPayAmt: z.coerce.number().int().nonnegative().optional(),
    ordDt: z.string().optional(),
    ordStlEndDt: z.string().optional(),
  })
  .passthrough()
export type ElevenStOrder = z.infer<typeof ElevenStOrderSchema>

export const ElevenStShippingAddressSchema = z
  .object({
    addrSeq: EstNumOrStr,
    addrNm: z.string(),
    addr: z.string().optional(),
    rcvrNm: z.string().optional(),
    gnrlTlphnNo: z.string().optional(),
    prtblTlphnNo: z.string().optional(),
  })
  .passthrough()
export type ElevenStShippingAddress = z.infer<typeof ElevenStShippingAddressSchema>

export const ElevenStNoticeItemSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
})
export const ElevenStOfficialNoticeSchema = z.object({
  type: z.string().min(1),
  item: z.array(ElevenStNoticeItemSchema).min(1),
})
export type ElevenStOfficialNotice = z.infer<typeof ElevenStOfficialNoticeSchema>
