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
