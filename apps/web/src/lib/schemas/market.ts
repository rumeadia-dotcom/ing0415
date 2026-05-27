import { z } from 'zod'
import { MarketIdSchema } from './common'

/**
 * 마켓 어댑터 공용 zod 스키마.
 * 마스터: docs/architecture/v1/cross-cutting/market-adapter.md §2.2
 *
 * 본 파일은 어댑터 인터페이스의 입출력 타입을 정의한다. BE(Edge Function) 와
 * FE(클라이언트) 양쪽이 동일 zod 를 사용해 마켓 응답을 parse 한다.
 */

// ─────────────────────────────────────────────
// TokenSet — OAuth access/refresh + 만료
// ─────────────────────────────────────────────
export const TokenSetSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  // 마켓 응답 expires_in(초)은 어댑터가 절대시각(ISO 8601 + offset)으로 환산
  expiresAt: z.string().datetime({ offset: true }),
  scope: z.string().optional(),
  tokenType: z.literal('Bearer').default('Bearer'),
})
export type TokenSet = z.infer<typeof TokenSetSchema>

// ─────────────────────────────────────────────
// MarketCredentialKind — credential_payload jsonb 의 kind 필드
// 마스터: docs/architecture/v1/cross-cutting/credential-vault.md §3.1
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
// AuthInput — MarketAdapter.authenticate(input) 4-way discriminated union
// 마스터: docs/architecture/v1/cross-cutting/market-adapter.md §2.1 / §2.2
//
//  - oauth_code: 네이버 스마트스토어 (`type=SELF` Authorization Code)
//  - hmac_key:   쿠팡 윙 OpenAPI (VENDOR_ID + ACCESS_KEY + SECRET_KEY)
//  - esm_jwt:    G마켓·옥션 ESM 2.0 (masterId + secretKey + sellerId + site)
//  - api_key:    11번가 (셀러오피스 OPEN API 센터 발급 API Key 단일 영구 키. v1 정식)
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
// 인증 페이로드 (저장 시 credential_payload jsonb 내부 형식)
//   - OAuth: TokenSet (access + refresh + expiresAt + scope)
//   - HMAC:  HmacKeyAuthInput 의 키 묶음 그대로 (자가 발급, refresh 없음)
//   - ESM JWT: EsmJwtAuthInput 의 키 묶음 (영구 키)
//   - API Key: ApiKeyAuthInput (영구)
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

// ─────────────────────────────────────────────
// StoredCredential — adapter.authenticate(input) 반환 타입.
// credential_payload jsonb 에 저장될 형식과 1:1 정합.
// kind 별 payload 분기 — credential-vault.md §3.1 / §4.3.
// ─────────────────────────────────────────────
export const StoredCredentialSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('oauth'),
    payload: TokenSetSchema,
    // OAuth 만 만료. 나머지는 영구 키 — expiresAt 부재.
    expiresAt: z.string().datetime({ offset: true }),
  }),
  z.object({
    kind: z.literal('hmac'),
    payload: HmacKeyPayloadSchema,
    expiresAt: z.string().datetime({ offset: true }).optional(),
  }),
  z.object({
    kind: z.literal('esm_jwt'),
    payload: EsmJwtKeyPayloadSchema,
    expiresAt: z.string().datetime({ offset: true }).optional(),
  }),
  z.object({
    kind: z.literal('api_key'),
    payload: ApiKeyPayloadSchema,
    expiresAt: z.string().datetime({ offset: true }).optional(),
  }),
])
export type StoredCredential = z.infer<typeof StoredCredentialSchema>

// ─────────────────────────────────────────────
// CategoryNode — 재귀 트리
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
// Product (도메인 마스터) + 이미지
// ─────────────────────────────────────────────
export const ProductImageSchema = z.object({
  url: z.string().url(),
  alt: z.string().max(120).optional(),
  order: z.number().int().min(0),
})
export type ProductImage = z.infer<typeof ProductImageSchema>

export const ProductSchema = z.object({
  id: z.string().uuid(),
  sellerId: z.string().uuid(),
  name: z.string().min(1).max(100),
  priceKrw: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative(),
  images: z.array(ProductImageSchema).min(1).max(20),
  descriptionHtml: z.string().max(50_000).default(''),
  categoryHint: z.string().max(120).optional(),
  brand: z.string().max(60).optional(),
  shippingFeeKrw: z.number().int().nonnegative().default(0),
})
export type Product = z.infer<typeof ProductSchema>

// ─────────────────────────────────────────────
// MarketMapping — Product → 마켓별 변환 입력
// ─────────────────────────────────────────────
export const MarketMappingSchema = z.object({
  market: MarketIdSchema,
  categoryId: z.string().min(1),
  transformedImageUrls: z.array(z.string().url()).min(1).max(20),
  extra: z.record(z.string(), z.unknown()).default({}),
})
export type MarketMapping = z.infer<typeof MarketMappingSchema>

// ─────────────────────────────────────────────
// MarketPayload — 어댑터가 만든 마켓별 페이로드 (opaque)
// ─────────────────────────────────────────────
export const MarketPayloadSchema = z.object({
  market: MarketIdSchema,
  raw: z.unknown(),
})
export type MarketPayload = z.infer<typeof MarketPayloadSchema>

// ─────────────────────────────────────────────
// CreateProductResult — createProduct 응답
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
