/**
 * Debug 모드 mock 어댑터 (Edge Function 측).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §4.2
 *   - src/lib/markets/debug/createMockAdapter.ts (클라이언트 측 동등 구현)
 *
 * v1 변경 (2026-05-19, Wave 2):
 *   - authenticate(input: AuthInput) — 4-way discriminated union.
 *     - oauth_code  (네이버) → StoredCredential.kind='oauth' + TokenSet payload
 *     - hmac_key    (쿠팡)   → StoredCredential.kind='hmac' + HmacKeyPayload
 *     - esm_jwt     (G마켓·옥션) → StoredCredential.kind='esm_jwt' + EsmJwtKeyPayload
 *     - api_key     (11번가) → StoredCredential.kind='api_key' + ApiKeyPayload (2026-05-25 활성)
 *   - refreshToken 은 oauth (네이버) 만 노출.
 *
 * 강제:
 *   - debug 빌드만 import. real 모드 진입점에서 import 한 흔적 발견 시 PR 차단.
 *   - mock 응답도 동일 zod 스키마 통과 (StoredCredentialSchema 등).
 *   - 시나리오 분기: globalThis.__MOCK_SCENARIO__ 또는 함수 인자.
 *     5가지 시나리오 재현: 5xx / 401 / 429 / timeout / partial + happy.
 */

import { MarketError } from '../errors.ts'
import {
  CategoryNodeSchema,
  CreateProductResultSchema,
  StoredCredentialSchema,
  TokenSetSchema,
  type AuthInput,
  type CategoryNode,
  type CreateProductResult,
  type MarketCredentialKind,
  type MarketId,
  type MarketMapping,
  type MarketPayload,
  type Product,
  type StoredCredential,
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

const MARKET_TO_KIND: Record<MarketId, MarketCredentialKind> = {
  naver: 'oauth',
  coupang: 'hmac',
  gmarket: 'esm_jwt',
  auction: 'esm_jwt',
  '11st': 'api_key',
}

function buildHappyCredential(
  market: MarketId,
  kind: MarketCredentialKind,
  input: AuthInput,
): StoredCredential {
  switch (kind) {
    case 'oauth': {
      if (input.kind !== 'oauth_code') {
        throw new MarketError(
          'validation',
          `${market}: oauth_code input required (got ${input.kind})`,
          { market },
        )
      }
      const tokenSet = TokenSetSchema.parse({
        accessToken: 'mock_access_' + 'x'.repeat(40),
        refreshToken: 'mock_refresh_' + 'x'.repeat(40),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        scope: 'product.write',
        tokenType: 'Bearer',
      })
      return StoredCredentialSchema.parse({
        kind: 'oauth',
        payload: tokenSet,
        expiresAt: tokenSet.expiresAt,
      })
    }
    case 'hmac': {
      if (input.kind !== 'hmac_key') {
        throw new MarketError(
          'validation',
          `${market}: hmac_key input required (got ${input.kind})`,
          { market },
        )
      }
      return StoredCredentialSchema.parse({
        kind: 'hmac',
        payload: {
          accessKey: input.accessKey,
          secretKey: input.secretKey,
          vendorId: input.vendorId,
        },
      })
    }
    case 'esm_jwt': {
      if (input.kind !== 'esm_jwt') {
        throw new MarketError(
          'validation',
          `${market}: esm_jwt input required (got ${input.kind})`,
          { market },
        )
      }
      return StoredCredentialSchema.parse({
        kind: 'esm_jwt',
        payload: {
          masterId: input.masterId,
          secretKey: input.secretKey,
          sellerId: input.sellerId,
          site: input.site,
        },
      })
    }
    case 'api_key': {
      // 11번가 — 영구 키. AuthInput 의 api_key 입력에서 apiKey 만 추출.
      if (input.kind !== 'api_key') {
        throw new MarketError(
          'validation',
          `${market}: api_key input required (got ${input.kind})`,
          { market },
        )
      }
      return StoredCredentialSchema.parse({
        kind: 'api_key',
        payload: { apiKey: input.apiKey },
      })
    }
  }
}

export function createMockAdapter(
  market: MarketId,
  override?: MockScenario,
): MarketAdapter {
  const resolveS = () => override ?? readScenario()
  const credentialKind = MARKET_TO_KIND[market]

  const productUrlFor = (m: MarketId): string => {
    switch (m) {
      case 'naver':
        return 'https://smartstore.naver.com/mockstore/products/123'
      case 'coupang':
        return 'https://www.coupang.com/vp/products/123'
      case 'gmarket':
        return 'https://item.gmarket.co.kr/Item?goodscode=123'
      case 'auction':
        return 'https://www.auction.co.kr/itemview?itemno=123'
      default:
        return `https://mock.${m}.example.com/p/123`
    }
  }
  const externalIdFor = (m: MarketId): string =>
    `${m}-mock-` + Math.random().toString(36).slice(2, 10)

  const base: MarketAdapter = {
    market,
    credentialKind,

    async authenticate(input: AuthInput): Promise<StoredCredential> {
      const s = resolveS()
      if (s === '5xx') throw new MarketError('server', 'mock 5xx', { market })
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
      return buildHappyCredential(market, credentialKind, input)
    },

    async fetchCategoryTree(): Promise<CategoryNode[]> {
      const s = resolveS()
      if (s === '5xx') throw new MarketError('server', 'mock 5xx', { market })
      if (s === '429')
        throw new MarketError('rate_limit', 'mock 429', {
          market,
          retryAfterMs: 1500,
        })
      if (s === '401')
        throw new MarketError('unauthorized', 'mock 401', { market })
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
      const s = resolveS()
      if (s === '5xx') throw new MarketError('server', 'mock 5xx', { market })
      if (s === '429')
        throw new MarketError('rate_limit', 'mock 429', {
          market,
          retryAfterMs: 2000,
        })
      if (s === '401')
        throw new MarketError('unauthorized', 'mock 401 from createProduct', {
          market,
        })
      if (s === 'partial') {
        return CreateProductResultSchema.parse({
          market,
          externalId: externalIdFor(market),
          productUrl: productUrlFor(market),
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
        externalId: externalIdFor(market),
        productUrl: productUrlFor(market),
        status: 'succeeded',
        warnings: [],
      })
    },
  }

  if (credentialKind === 'oauth') {
    base.refreshToken = async (_refresh: string): Promise<TokenSet> => {
      const s = resolveS()
      if (s === '401')
        throw new MarketError('unauthorized', 'invalid_grant', { market })
      return TokenSetSchema.parse({
        accessToken: 'mock_access_rotated_' + 'x'.repeat(40),
        refreshToken: 'mock_refresh_rotated_' + 'x'.repeat(40),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        tokenType: 'Bearer',
      })
    }
  }

  return base
}
