import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createMockAdapter } from '@/lib/markets/debug/createMockAdapter'
import { MarketError } from '@/lib/markets/errors'
import {
  TokenSetSchema,
  CategoryNodeSchema,
  MarketPayloadSchema,
  CreateProductResultSchema,
  type Product,
  type MarketMapping,
  type MarketId,
} from '@/lib/schemas'

/**
 * Debug MarketAdapter contract 테스트 (testing.md §6.2 + market-adapter.md §4.2).
 *
 * 정책:
 *  - 5 메서드 모두 zod 출력 스키마 통과 (행복 경로).
 *  - 1 개 이상 실패 시나리오 (5xx / 401 / 429) 에 대해 MarketError throw 검증 (R-001).
 *  - 동일 contract 가 naver / coupang 양쪽에서 동작해야 함 (parametrized).
 *
 * 시나리오 토글: globalThis.__MOCK_SCENARIO__ ('happy' | '5xx' | '401' | '429' | 'partial' | 'timeout').
 * 'timeout' 은 60초 대기 → 본 파일에서는 검증하지 않음 (별도 long-running spec 에서).
 */

declare global {
  var __MOCK_SCENARIO__:
    | undefined
    | 'happy'
    | '5xx'
    | '401'
    | '429'
    | 'timeout'
    | 'partial'
}

const VALID_PRODUCT: Product = {
  id: '11111111-1111-1111-1111-111111111111',
  sellerId: '22222222-2222-2222-2222-222222222222',
  name: '테스트 상품',
  priceKrw: 12_000,
  stock: 10,
  images: [{ url: 'https://cdn.example.com/p.jpg', order: 0 }],
  descriptionHtml: '',
  shippingFeeKrw: 0,
}

const VALID_MAPPING_FOR = (market: MarketId): MarketMapping => ({
  market,
  categoryId: 'C-100-10',
  transformedImageUrls: ['https://cdn.example.com/p-transformed.jpg'],
  extra: {},
})

beforeEach(() => {
  globalThis.__MOCK_SCENARIO__ = 'happy'
})

afterEach(() => {
  globalThis.__MOCK_SCENARIO__ = undefined
})

// ─────────────────────────────────────────────
// Parametrized: naver / coupang 양쪽이 동일 contract 통과
// ─────────────────────────────────────────────
describe.each<MarketId>(['naver', 'coupang'])(
  '%s debug 어댑터 — MarketAdapter contract',
  (market) => {
    const adapter = createMockAdapter(market)

    it('market 프로퍼티가 일치', () => {
      expect(adapter.market).toBe(market)
    })

    // authenticate ────────────────────────────────────────────────────────────
    it('authenticate(happy): TokenSetSchema parse 통과', async () => {
      const token = await adapter.authenticate('mock-auth-code')
      expect(() => TokenSetSchema.parse(token)).not.toThrow()
      expect(token.accessToken.length).toBeGreaterThan(10)
      expect(token.refreshToken.length).toBeGreaterThan(10)
      // expiresAt 은 ISO datetime + offset.
      expect(token.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('authenticate(5xx): MarketError("server") throw', async () => {
      globalThis.__MOCK_SCENARIO__ = '5xx'
      await expect(adapter.authenticate('x')).rejects.toBeInstanceOf(MarketError)
      await expect(adapter.authenticate('x')).rejects.toMatchObject({
        code: 'server',
        context: { market },
      })
    })

    it('authenticate(401): MarketError("unauthorized") throw', async () => {
      globalThis.__MOCK_SCENARIO__ = '401'
      await expect(adapter.authenticate('x')).rejects.toMatchObject({
        code: 'unauthorized',
      })
    })

    it('authenticate(429): MarketError("rate_limit") + retryAfterMs 포함', async () => {
      globalThis.__MOCK_SCENARIO__ = '429'
      try {
        await adapter.authenticate('x')
        throw new Error('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(MarketError)
        const err = e as MarketError
        expect(err.code).toBe('rate_limit')
        expect(err.context.retryAfterMs).toBeGreaterThan(0)
      }
    })

    // refreshToken ────────────────────────────────────────────────────────────
    it('refreshToken(happy): TokenSetSchema parse 통과 + access 가 갱신됨', async () => {
      const fresh = await adapter.refreshToken('old-refresh-token-value')
      expect(() => TokenSetSchema.parse(fresh)).not.toThrow()
      expect(fresh.accessToken).toContain('rotated')
    })

    it('refreshToken(401): MarketError("unauthorized") → 호출측 disconnected 처리 신호', async () => {
      globalThis.__MOCK_SCENARIO__ = '401'
      await expect(adapter.refreshToken('expired')).rejects.toMatchObject({
        code: 'unauthorized',
      })
    })

    // fetchCategoryTree ───────────────────────────────────────────────────────
    it('fetchCategoryTree: CategoryNodeSchema 배열 전수 parse 통과', async () => {
      const tree = await adapter.fetchCategoryTree()
      expect(tree.length).toBeGreaterThan(0)
      for (const node of tree) {
        expect(() => CategoryNodeSchema.parse(node)).not.toThrow()
      }
    })

    // transformProduct (순수 함수) ─────────────────────────────────────────────
    it('transformProduct: MarketPayloadSchema parse 통과 + 결정성', () => {
      const mapping = VALID_MAPPING_FOR(market)
      const payload1 = adapter.transformProduct(VALID_PRODUCT, mapping)
      const payload2 = adapter.transformProduct(VALID_PRODUCT, mapping)
      expect(() => MarketPayloadSchema.parse(payload1)).not.toThrow()
      // 결정성 — 같은 입력은 같은 출력 (market-adapter.md §2.1 transformProduct 룰).
      expect(payload1).toEqual(payload2)
      expect(payload1.market).toBe(market)
    })

    // createProduct ───────────────────────────────────────────────────────────
    it('createProduct(happy): CreateProductResultSchema parse 통과', async () => {
      const payload = adapter.transformProduct(VALID_PRODUCT, VALID_MAPPING_FOR(market))
      const result = await adapter.createProduct(payload)
      expect(() => CreateProductResultSchema.parse(result)).not.toThrow()
      expect(result.market).toBe(market)
      expect(result.status).toBe('succeeded')
      expect(result.externalId.length).toBeGreaterThan(0)
    })

    it('createProduct(5xx): MarketError("server") throw — 호출측 재시도 신호', async () => {
      const payload = adapter.transformProduct(VALID_PRODUCT, VALID_MAPPING_FOR(market))
      globalThis.__MOCK_SCENARIO__ = '5xx'
      await expect(adapter.createProduct(payload)).rejects.toMatchObject({
        code: 'server',
      })
    })

    it('createProduct(429): MarketError("rate_limit") + retryAfterMs', async () => {
      const payload = adapter.transformProduct(VALID_PRODUCT, VALID_MAPPING_FOR(market))
      globalThis.__MOCK_SCENARIO__ = '429'
      try {
        await adapter.createProduct(payload)
        throw new Error('should have thrown')
      } catch (e) {
        const err = e as MarketError
        expect(err.code).toBe('rate_limit')
        expect(err.context.retryAfterMs).toBeGreaterThan(0)
      }
    })

    it('createProduct(partial): status=partial + warnings 1건 이상', async () => {
      const payload = adapter.transformProduct(VALID_PRODUCT, VALID_MAPPING_FOR(market))
      globalThis.__MOCK_SCENARIO__ = 'partial'
      const result = await adapter.createProduct(payload)
      expect(result.status).toBe('partial')
      expect(result.warnings.length).toBeGreaterThanOrEqual(1)
    })
  },
)

// ─────────────────────────────────────────────
// MarketError 자체 contract
// ─────────────────────────────────────────────
describe('MarketError', () => {
  it('name = "MarketError", code / context 보존', () => {
    const e = new MarketError('validation', '필수 필드 누락', {
      market: 'naver',
      status: 400,
    })
    expect(e.name).toBe('MarketError')
    expect(e.code).toBe('validation')
    expect(e.context.market).toBe('naver')
    expect(e instanceof Error).toBe(true)
  })
})
