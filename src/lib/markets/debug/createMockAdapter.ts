import {
  CategoryNodeSchema,
  CreateProductResultSchema,
  TokenSetSchema,
  type CategoryNode,
  type CreateProductResult,
  type MarketId,
  type MarketMapping,
  type MarketPayload,
  type Product,
  type TokenSet,
} from '@/lib/schemas'
import { MarketError } from '../errors'
import type { MarketAdapter } from '../types'

/**
 * Debug 모드 mock 어댑터.
 * 마스터: docs/architecture/v1/cross-cutting/market-adapter.md §4.2
 *
 * 본 모듈은 `if (isDebug)` 가드 + dynamic import 안에서만 로드되어야 한다
 * (real 번들에 tree-shaking).
 *
 * 시나리오: `globalThis.__MOCK_SCENARIO__` 로 주입 (테스트·E2E 에서 사용).
 *   'happy' | '5xx' | '401' | '429' | 'timeout' | 'partial'
 */

type Scenario = 'happy' | '5xx' | '401' | '429' | 'timeout' | 'partial'

function readScenario(): Scenario {
  const g = globalThis as { __MOCK_SCENARIO__?: Scenario }
  return g.__MOCK_SCENARIO__ ?? 'happy'
}

export function createMockAdapter(market: MarketId): MarketAdapter {
  return {
    market,

    async authenticate(_code: string): Promise<TokenSet> {
      const s = readScenario()
      if (s === '5xx')
        throw new MarketError('server', 'mock 5xx', { market })
      if (s === '401')
        throw new MarketError('unauthorized', 'mock 401', { market })
      if (s === '429')
        throw new MarketError('rate_limit', 'mock 429', {
          market,
          retryAfterMs: 1500,
        })
      if (s === 'timeout') {
        await new Promise((r) => setTimeout(r, 60_000))
        throw new MarketError('network', 'mock timeout', { market })
      }
      return TokenSetSchema.parse({
        accessToken: 'mock_access_' + 'x'.repeat(40),
        refreshToken: 'mock_refresh_' + 'x'.repeat(40),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        scope: 'product.write',
        tokenType: 'Bearer',
      })
    },

    async refreshToken(_refresh: string): Promise<TokenSet> {
      const s = readScenario()
      if (s === '401')
        throw new MarketError('unauthorized', 'invalid_grant', { market })
      return TokenSetSchema.parse({
        accessToken: 'mock_access_rotated_' + 'x'.repeat(40),
        refreshToken: 'mock_refresh_rotated_' + 'x'.repeat(40),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        tokenType: 'Bearer',
      })
    },

    async fetchCategoryTree(): Promise<CategoryNode[]> {
      const tree: CategoryNode[] = [
        {
          id: 'C-100',
          name: '패션의류',
          depth: 1,
          leaf: false,
          parentId: null,
          children: [
            {
              id: 'C-100-10',
              name: '여성의류',
              depth: 2,
              leaf: true,
              parentId: 'C-100',
              children: [],
            },
          ],
        },
      ]
      return tree.map((n) => CategoryNodeSchema.parse(n))
    },

    transformProduct(
      product: Product,
      mapping: MarketMapping,
    ): MarketPayload {
      return {
        market,
        raw: {
          name: product.name,
          price: product.priceKrw,
          stock: product.stock,
          images: mapping.transformedImageUrls,
          categoryId: mapping.categoryId,
          extra: mapping.extra,
        },
      }
    },

    async createProduct(_payload: MarketPayload): Promise<CreateProductResult> {
      const s = readScenario()
      if (s === '5xx')
        throw new MarketError('server', 'mock 5xx', { market })
      if (s === '429')
        throw new MarketError('rate_limit', 'mock 429', {
          market,
          retryAfterMs: 2000,
        })
      if (s === 'partial') {
        return CreateProductResultSchema.parse({
          market,
          externalId: 'MOCK-' + Math.random().toString(36).slice(2, 10),
          productUrl: `https://mock.${market}.example.com/p/123`,
          status: 'partial',
          warnings: [
            {
              code: 'image_resized',
              message: '이미지 1장이 권장 해상도 미달로 자동 보정됨',
            },
          ],
        })
      }
      return CreateProductResultSchema.parse({
        market,
        externalId: 'MOCK-' + Math.random().toString(36).slice(2, 10),
        productUrl: `https://mock.${market}.example.com/p/123`,
        status: 'succeeded',
        warnings: [],
      })
    },
  }
}
