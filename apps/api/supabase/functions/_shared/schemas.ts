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
