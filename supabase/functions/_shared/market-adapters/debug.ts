/**
 * Debug 모드 mock 어댑터 (Edge Function 측).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §4.2
 *   - src/lib/markets/debug/createMockAdapter.ts (클라이언트 측 동등 구현)
 *
 * 강제:
 *   - debug 빌드만 import. real 모드 진입점에서 import 한 흔적 발견 시 PR 차단.
 *   - mock 응답도 동일 zod 스키마 통과 (CreateProductResultSchema, TokenSetSchema 등).
 *   - 시나리오 분기는 globalThis.__MOCK_SCENARIO__ 또는 함수 인자.
 *     5가지 시나리오 재현: 5xx / 401 / 429 / timeout / partial + happy.
 *
 * 토큰 평문 발급해도 보안 동등성 — debug Supabase 프로젝트의 마스터 키로 동일 RPC
 * `fn_encrypt_and_store_credential` 경유 저장 (credential-vault.md §11.1).
 */

import { MarketError } from '../errors.ts'
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
} from '../schemas.ts'
import type { MarketAdapter } from '../market-adapter.ts'

export type MockScenario =
  | 'happy'
  | '5xx'
  | '401'
  | '429'
  | 'timeout'
  | 'partial'

function readScenario(): MockScenario {
  const g = globalThis as { __MOCK_SCENARIO__?: MockScenario }
  return g.__MOCK_SCENARIO__ ?? 'happy'
}

export function createMockAdapter(
  market: MarketId,
  override?: MockScenario,
): MarketAdapter {
  const resolveScenario = () => override ?? readScenario()

  return {
    market,

    async authenticate(_code: string): Promise<TokenSet> {
      const s = resolveScenario()
      if (s === '5xx') throw new MarketError('server', 'mock 5xx', { market })
      if (s === '401') throw new MarketError('unauthorized', 'mock 401', { market })
      if (s === '429') {
        throw new MarketError('rate_limit', 'mock 429', {
          market,
          retryAfterMs: 1500,
        })
      }
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
      const s = resolveScenario()
      if (s === '401') {
        throw new MarketError('unauthorized', 'invalid_grant', { market })
      }
      return TokenSetSchema.parse({
        accessToken: 'mock_access_rotated_' + 'x'.repeat(40),
        refreshToken: 'mock_refresh_rotated_' + 'x'.repeat(40),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        tokenType: 'Bearer',
      })
    },

    async fetchCategoryTree(): Promise<CategoryNode[]> {
      const s = resolveScenario()
      if (s === '5xx') throw new MarketError('server', 'mock 5xx', { market })
      if (s === '429') {
        throw new MarketError('rate_limit', 'mock 429', {
          market,
          retryAfterMs: 1500,
        })
      }
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
      const s = resolveScenario()
      if (s === '5xx') throw new MarketError('server', 'mock 5xx', { market })
      if (s === '429') {
        throw new MarketError('rate_limit', 'mock 429', {
          market,
          retryAfterMs: 2000,
        })
      }
      if (s === '401') {
        throw new MarketError('unauthorized', 'mock 401 from createProduct', { market })
      }
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
