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
 *
 * v1 변경 (2026-05-19): authenticate(input) 의 4-way union 분기.
 *   - 네이버 (kind='oauth') → AuthInput.kind='oauth_code' 만 수용. StoredCredential.kind='oauth' 반환.
 *   - 쿠팡 (kind='hmac')   → AuthInput.kind='hmac_key'.  StoredCredential.kind='hmac'.
 *   - G마켓·옥션 (kind='esm_jwt') → AuthInput.kind='esm_jwt'. StoredCredential.kind='esm_jwt'.
 *   - 11번가 (kind='api_key') → 본 mock 은 즉시 throw (오픈 준비중).
 *
 *   refreshToken 은 'oauth' 어댑터에만 정의.
 */

type Scenario = 'happy' | '5xx' | '401' | '429' | 'timeout' | 'partial'

function readScenario(): Scenario {
  const g = globalThis as { __MOCK_SCENARIO__?: Scenario }
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
      // 11번가 — 오픈 준비중. authenticate 호출 자체가 v1 운영에서 차단되어야 함.
      throw new MarketError(
        'unknown',
        `${market}: api_key adapter is not in v1 (오픈 준비중 — IP 화이트리스트 미해결)`,
        { market },
      )
    }
  }
}

export function createMockAdapter(market: MarketId): MarketAdapter {
  const credentialKind = MARKET_TO_KIND[market]

  const base: MarketAdapter = {
    market,
    credentialKind,

    async authenticate(input: AuthInput): Promise<StoredCredential> {
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
      return buildHappyCredential(market, credentialKind, input)
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

  // OAuth 어댑터(네이버) 만 refreshToken 노출.
  if (credentialKind === 'oauth') {
    base.refreshToken = async (_refresh: string): Promise<TokenSet> => {
      const s = readScenario()
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
