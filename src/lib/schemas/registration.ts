import { z } from 'zod'
import { MarketIdSchema } from './common'

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

export const Step3Schema = z
  .object({
    selections: z
      .array(MarketSelectionSchema)
      .min(1, '마켓을 1개 이상 선택해주세요')
      .max(5, '마켓은 최대 5개'),
    mappings: z.array(CategoryMappingSchema).min(1, '카테고리 매핑이 필요합니다'),
  })
  .refine((d) => d.selections.length === d.mappings.length, {
    message: '선택한 마켓 수와 카테고리 매핑 수가 일치해야 합니다',
    path: ['mappings'],
  })

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
    selections: Step3Schema.innerType().shape.selections,
    mappings: Step3Schema.innerType().shape.mappings,
  }),
)
export type ProductDraft = z.infer<typeof ProductDraftSchema>
