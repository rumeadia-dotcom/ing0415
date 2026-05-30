import { z } from 'zod'
import { MarketIdSchema, type MarketId } from './common'

/**
 * 등록 도메인 zod 스키마.
 *
 * ENUM 마스터: docs/architecture/v1/cross-cutting/registration-job-state.md §3.1 / §10.1
 * 단계별 스키마 마스터: docs/architecture/v1/features/registration.md §9.1
 *
 * dashboard / history 가 본 파일의 ENUM 을 import 한다 (역방향 금지).
 */

// ─────────────────────────────────────────────
// ENUM (단일 출처)
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
export type JobStatus = (typeof JOB_STATUSES)[number]

export const MARKET_RESULT_STATUSES = [
  'pending',
  'in_flight',
  'success',
  'failed',
  'failed_final',
] as const
export type MarketResultStatus = (typeof MARKET_RESULT_STATUSES)[number]

export const RegistrationJobStatusSchema = z.enum(JOB_STATUSES)
export const MarketResultStatusSchema = z.enum(MARKET_RESULT_STATUSES)

export const ProductStatusSchema = z.enum(['draft', 'ready', 'registered'])
export const ShippingMethodSchema = z.enum([
  'parcel',
  'direct',
  'quick',
  'visit_pickup',
])

// ─────────────────────────────────────────────
// Step 1: 상품 정보 입력 (n16)
// ─────────────────────────────────────────────
export const Step1Schema = z
  .object({
    name: z.string().min(2, '상품명은 2자 이상').max(100, '상품명은 100자 이하'),
    price: z.number().int().min(100, '판매가는 100원 이상'),
    originalPrice: z.number().int().min(0).nullable(),
    brand: z.string().max(50).nullable(),
    manufacturer: z.string().max(50).nullable(),
    descriptionHtml: z.string().max(50000).nullable(),
    baseCategoryId: z.string().min(1, '내부 카테고리를 선택하세요'),
    shippingPolicyId: z.string().uuid('배송정책을 선택하세요'),
  })
  .refine((d) => d.originalPrice === null || d.originalPrice >= d.price, {
    message: '정가는 판매가 이상이어야 합니다',
    path: ['originalPrice'],
  })

// ─────────────────────────────────────────────
// Step 2: 이미지 (n18)
// ─────────────────────────────────────────────
export const ImageMetaSchema = z.object({
  id: z.string().uuid(),
  storagePath: z.string(),
  role: z.enum(['main', 'sub']),
  sortOrder: z.number().int().min(0).max(9),
  width: z.number().int().min(100),
  height: z.number().int().min(100),
  bytes: z
    .number()
    .int()
    .min(1)
    .max(10 * 1024 * 1024),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  hashSha256: z.string().length(64),
})
export type ImageMeta = z.infer<typeof ImageMetaSchema>

export const Step2Schema = z
  .object({
    images: z
      .array(ImageMetaSchema)
      .min(1, '이미지를 1장 이상 업로드해주세요')
      .max(10, '이미지는 최대 10장까지'),
  })
  .refine((d) => d.images.filter((i) => i.role === 'main').length === 1, {
    message: '대표 이미지를 1장 지정해주세요',
    path: ['images'],
  })

// ─────────────────────────────────────────────
// Step 3: 마켓 선택 + 카테고리 매핑 (n17 + n19)
// ─────────────────────────────────────────────
export const MarketSelectionSchema = z.object({
  marketId: MarketIdSchema,
  marketAccountId: z.string().uuid(),
})
export type MarketSelection = z.infer<typeof MarketSelectionSchema>

export const CategoryMappingSchema = z.object({
  marketId: MarketIdSchema,
  marketCategoryCode: z.string().min(1, '마켓 카테고리를 선택하세요'),
  marketNameOverride: z.string().max(100).nullable(),
  marketPriceOverride: z.number().int().min(0).nullable(),
  marketOptions: z.record(z.unknown()).default({}),
})
export type CategoryMapping = z.infer<typeof CategoryMappingSchema>

/**
 * 마켓별 동적 등록필드 required 검증 hook (PR-3.5, esm.md §4.6).
 *
 * `getRegistrationFieldsForMarket(marketId)` 가 required 로 선언한 fieldKey 는
 * 해당 마켓 mapping 의 `marketOptions[fieldKey]` 에 비어있지 않은 값이 있어야 한다.
 *
 * zod 스키마(단일 소스)가 어댑터 메타에 직접 import 의존하면 schemas → markets 역방향
 * 결합이 생기므로, **필드 메타 provider 를 주입**받는 형태로 분리한다. UI(Step3 page)는
 * `makeStep3Schema(getRegistrationFieldsForMarket)` 로 검증하고, 순수 스키마 단위테스트는
 * 임의 provider 를 주입해 검증한다. provider 미주입 시 추가필드 검증은 skip(기존 동작).
 */
export type RequiredFieldKeyProvider = (marketId: MarketId) => string[]

function defaultRequiredFieldKeys(): string[] {
  return []
}

/**
 * marketOptions 값이 "채워졌는지" 판정 (required 검증·blockingReason 단일 소스).
 *
 * 단순 string/number(예: placeNo·dispatchPolicyNo)뿐 아니라, 상품군 고시(officialNotice)처럼
 * **객체 형태**의 동적 필드도 한 곳에서 판정한다. officialNotice 는
 * `{officialNoticeNo, details:[{code,value}]}` 형태이며(esm.md §4.4), 셀러가 상품군만
 * 고르고 항목 value 를 비워두면 "미완성"으로 봐야 한다(PR-5). 항목코드 마스터는 markets
 * 레이어(역참조 금지)이므로 여기서는 **형태 기반 완성도**만 본다:
 *   - officialNoticeNo 비어있지 않음 + 모든 detail 의 code/value 비어있지 않음 + detail ≥ 1.
 * 군별 정적 필수항목 코드 누락 등 마스터 의존 정밀 검증은 markets 레이어
 * (isEsmOfficialNoticeComplete) 가 추가로 본다. 본 스키마는 schemas→markets 역참조를
 * 만들지 않기 위해 형태 검증까지만 한다.
 */
export function isMarketOptionValuePresent(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim() !== ''
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    // officialNotice 형태 판정 (officialNoticeNo + details 보유).
    if ('officialNoticeNo' in obj || 'details' in obj) {
      const no = obj.officialNoticeNo
      if (typeof no !== 'string' || no.trim() === '') return false
      const details = obj.details
      if (!Array.isArray(details) || details.length === 0) return false
      return details.every((d) => {
        if (typeof d !== 'object' || d === null) return false
        const code = (d as Record<string, unknown>).code
        const val = (d as Record<string, unknown>).value
        return (
          typeof code === 'string' &&
          code.trim() !== '' &&
          typeof val === 'string' &&
          val.trim() !== ''
        )
      })
    }
    // 그 외 객체(빈 객체 포함)는 비어있음으로 간주.
    return Object.keys(obj).length > 0
  }
  return true
}

function refineMarketOptions(
  d: { selections: MarketSelection[]; mappings: CategoryMapping[] },
  ctx: z.RefinementCtx,
  requiredKeysFor: RequiredFieldKeyProvider,
): void {
  for (const sel of d.selections) {
    const requiredKeys = requiredKeysFor(sel.marketId)
    if (requiredKeys.length === 0) continue
    const mapping = d.mappings.find((m) => m.marketId === sel.marketId)
    const opts = mapping?.marketOptions ?? {}
    const mappingIndex = d.mappings.findIndex((m) => m.marketId === sel.marketId)
    for (const key of requiredKeys) {
      const value = opts[key]
      const isEmpty = !isMarketOptionValuePresent(value)
      if (isEmpty) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '마켓별 필수 등록 항목이 누락되었습니다',
          // mapping 이 아직 없으면 selections 경로로 보고(다음 버튼 차단 목적).
          path:
            mappingIndex >= 0
              ? ['mappings', mappingIndex, 'marketOptions', key]
              : ['selections'],
        })
      }
    }
  }
}

/** Step3 원시 object 형태 — ProductDraftSchema 가 shape 접근에 사용. */
export const Step3ObjectSchema = z.object({
  selections: z
    .array(MarketSelectionSchema)
    .min(1, '마켓을 1개 이상 선택해주세요')
    .max(5, '마켓은 최대 5개'),
  mappings: z.array(CategoryMappingSchema).min(1, '카테고리 매핑이 필요합니다'),
})

const step3Base = Step3ObjectSchema.refine(
  (d) => d.selections.length === d.mappings.length,
  {
    message: '선택한 마켓 수와 카테고리 매핑 수가 일치해야 합니다',
    path: ['mappings'],
  },
)

/**
 * Step3 검증 스키마 빌더 — 마켓별 required 등록필드 provider 를 주입.
 * UI 는 `makeStep3Schema(getRegistrationFieldsForMarket 기반 provider)` 로 검증.
 */
export function makeStep3Schema(
  requiredKeysFor: RequiredFieldKeyProvider = defaultRequiredFieldKeys,
) {
  return step3Base.superRefine((d, ctx) =>
    refineMarketOptions(d, ctx, requiredKeysFor),
  )
}

/**
 * 기존 사용처 호환 — provider 미주입(추가필드 검증 skip). 카테고리·마켓수만 검증(기존 동작).
 * ESM 배송 프로필 required 검증이 필요한 곳은 makeStep3Schema(provider) 를 쓴다.
 */
export const Step3Schema = makeStep3Schema()

// ─────────────────────────────────────────────
// Step 4: 미리보기 (n20)
// ─────────────────────────────────────────────
export const ValidationIssueSchema = z.object({
  marketId: z.string(),
  code: z.enum([
    'product_name_invalid',
    'product_price_invalid',
    'category_missing',
    'category_not_leaf',
    'brand_required',
    'manufacturer_required',
    'shipping_method_unsupported',
    'image_main_missing',
    'image_size_too_small',
    'description_required',
    'market_options_missing',
    'token_expired',
    'token_revoked',
    'mapping_not_found',
  ]),
  field: z.string(),
  message: z.string(),
  hint: z.string().optional(),
})
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>

export const Step4ValidationSchema = z.object({
  ok: z.boolean(),
  issues: z.array(ValidationIssueSchema),
  previews: z.array(
    z.object({
      marketId: MarketIdSchema,
      payload: z.unknown(),
      estimatedFee: z.number().nullable(),
    }),
  ),
})

// ─────────────────────────────────────────────
// Step 5: 등록 결과 (n21 / n24 / n25)
// ─────────────────────────────────────────────
export const MarketResultSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  marketId: MarketIdSchema,
  marketAccountId: z.string().uuid(),
  marketStatus: MarketResultStatusSchema,
  externalProductId: z.string().nullable(),
  productUrl: z.string().url().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  attemptCount: z.number().int().min(0).max(3),
  excluded: z.boolean(),
  lastAttemptedAt: z.string().datetime().nullable(),
})
export type MarketResult = z.infer<typeof MarketResultSchema>

export const RegistrationJobSchema = z.object({
  id: z.string().uuid(),
  sellerId: z.string().uuid(),
  productId: z.string().uuid(),
  status: RegistrationJobStatusSchema,
  retryCount: z.number().int().min(0).max(5),
  errorSummary: z.string().nullable(),
  parentJobId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
})
export type RegistrationJob = z.infer<typeof RegistrationJobSchema>

// ─────────────────────────────────────────────
// 전체 위저드 종합
// ─────────────────────────────────────────────
export const ProductDraftSchema = Step1Schema.and(
  z.object({
    images: Step2Schema.innerType().shape.images,
    selections: Step3ObjectSchema.shape.selections,
    mappings: Step3ObjectSchema.shape.mappings,
  }),
)
export type ProductDraft = z.infer<typeof ProductDraftSchema>
