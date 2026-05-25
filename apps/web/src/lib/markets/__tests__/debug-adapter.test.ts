import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createMockAdapter } from '@/lib/markets/debug/createMockAdapter'
import { MarketError } from '@/lib/markets/errors'
import {
  StoredCredentialSchema,
  TokenSetSchema,
  CategoryNodeSchema,
  MarketPayloadSchema,
  CreateProductResultSchema,
  type AuthInput,
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
 *  - v1 4-way AuthInput union: naver(oauth_code) / coupang(hmac_key) / gmarket·auction(esm_jwt) / 11st(api_key).
 *  - refreshToken 은 OAuth(네이버) 한정. 다른 마켓에는 메서드가 정의되지 않아야 함.
 *  - 11번가는 v1 운영에서 authenticate 호출 자체가 차단 — MarketError throw.
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

// AuthInput fixture per market (mock adapter 가 검증할 4-way union).
const AUTH_INPUT_FOR: Record<MarketId, AuthInput> = {
  naver: { kind: 'oauth_code', code: 'mock-auth-code-xxxxxxxxxxxx' },
  coupang: {
    kind: 'hmac_key',
    accessKey: 'mock-coupang-access',
    secretKey: 'mock-coupang-secret',
    vendorId: 'A00012345',
  },
  gmarket: {
    kind: 'esm_jwt',
    masterId: 'mock-esm-master',
    secretKey: 'mock-esm-secret',
    sellerId: 'mock-gmarket-seller',
    site: 'G',
  },
  auction: {
    kind: 'esm_jwt',
    masterId: 'mock-esm-master',
    secretKey: 'mock-esm-secret',
    sellerId: 'mock-auction-seller',
    site: 'A',
  },
  '11st': { kind: 'api_key', apiKey: 'mock-11st-api-key' },
}

beforeEach(() => {
  globalThis.__MOCK_SCENARIO__ = 'happy'
})

afterEach(() => {
  globalThis.__MOCK_SCENARIO__ = undefined
})

// ─────────────────────────────────────────────
// Parametrized: v1 활성 4마켓 (naver/coupang/gmarket/auction) 동일 contract.
// 11번가는 별도 (authenticate 차단).
// ─────────────────────────────────────────────
const ACTIVE_MARKETS = ['naver', 'coupang', 'gmarket', 'auction'] as const

describe.each<(typeof ACTIVE_MARKETS)[number]>(ACTIVE_MARKETS)(
  '%s debug 어댑터 — MarketAdapter contract',
  (market) => {
    const adapter = createMockAdapter(market)
    const input = AUTH_INPUT_FOR[market]

    it('market 프로퍼티가 일치', () => {
      expect(adapter.market).toBe(market)
    })

    it('credentialKind 가 마켓 정책과 일치', () => {
      const expected: Record<typeof market, string> = {
        naver: 'oauth',
        coupang: 'hmac',
        gmarket: 'esm_jwt',
        auction: 'esm_jwt',
      }
      expect(adapter.credentialKind).toBe(expected[market])
    })

    // authenticate ────────────────────────────────────────────────────────────
    it('authenticate(happy): StoredCredentialSchema parse 통과 + kind 일치', async () => {
      const stored = await adapter.authenticate(input)
      expect(() => StoredCredentialSchema.parse(stored)).not.toThrow()
      expect(stored.kind).toBe(adapter.credentialKind)
    })

    it('authenticate(5xx): MarketError("server") throw', async () => {
      globalThis.__MOCK_SCENARIO__ = '5xx'
      await expect(adapter.authenticate(input)).rejects.toBeInstanceOf(MarketError)
      await expect(adapter.authenticate(input)).rejects.toMatchObject({
        code: 'server',
        context: { market },
      })
    })

    it('authenticate(401): MarketError("unauthorized") throw', async () => {
      globalThis.__MOCK_SCENARIO__ = '401'
      await expect(adapter.authenticate(input)).rejects.toMatchObject({
        code: 'unauthorized',
      })
    })

    it('authenticate(429): MarketError("rate_limit") + retryAfterMs 포함', async () => {
      globalThis.__MOCK_SCENARIO__ = '429'
      try {
        await adapter.authenticate(input)
        throw new Error('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(MarketError)
        const err = e as MarketError
        expect(err.code).toBe('rate_limit')
        expect(err.context.retryAfterMs).toBeGreaterThan(0)
      }
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
// refreshToken — OAuth(네이버) 한정. 다른 마켓에는 메서드 자체가 없어야 함.
// ─────────────────────────────────────────────
describe('refreshToken — OAuth 한정', () => {
  it('naver: refreshToken 정의됨 + happy 시 TokenSet 갱신', async () => {
    const adapter = createMockAdapter('naver')
    const { refreshToken } = adapter
    if (!refreshToken) throw new Error('naver adapter must expose refreshToken')
    const fresh = await refreshToken('old-refresh-token-value')
    expect(() => TokenSetSchema.parse(fresh)).not.toThrow()
    expect(fresh.accessToken).toContain('rotated')
  })

  it('naver: refreshToken(401) → MarketError("unauthorized") (disconnected 처리 신호)', async () => {
    const adapter = createMockAdapter('naver')
    const { refreshToken } = adapter
    if (!refreshToken) throw new Error('naver adapter must expose refreshToken')
    globalThis.__MOCK_SCENARIO__ = '401'
    await expect(refreshToken('expired')).rejects.toMatchObject({
      code: 'unauthorized',
    })
  })

  it.each(['coupang', 'gmarket', 'auction', '11st'] as const)(
    '%s: refreshToken 메서드가 정의되지 않음 (영구 키 / N/A)',
    (market) => {
      const adapter = createMockAdapter(market)
      expect(adapter.refreshToken).toBeUndefined()
    },
  )
})

// ─────────────────────────────────────────────
// 11번가 — 2026-05-25 v1 활성 (api_key 분기) — 다른 4마켓과 동등.
// ─────────────────────────────────────────────
describe('11st debug 어댑터 — v1 활성 (api_key)', () => {
  const adapter = createMockAdapter('11st')

  it('credentialKind = "api_key"', () => {
    expect(adapter.credentialKind).toBe('api_key')
  })

  it('authenticate(happy) → StoredCredential.kind = "api_key"', async () => {
    const result = await adapter.authenticate(AUTH_INPUT_FOR['11st'])
    expect(result.kind).toBe('api_key')
    expect((result as { payload: { apiKey: string } }).payload.apiKey).toBe(
      (AUTH_INPUT_FOR['11st'] as { apiKey: string }).apiKey,
    )
  })

  it('잘못된 input kind 거부 — naver oauth_code 입력 시 validation throw', async () => {
    await expect(
      adapter.authenticate(AUTH_INPUT_FOR.naver),
    ).rejects.toBeInstanceOf(MarketError)
  })
})

// ─────────────────────────────────────────────
// AuthInput kind mismatch — 각 어댑터가 잘못된 kind 거부
// ─────────────────────────────────────────────
describe('AuthInput kind mismatch 거부', () => {
  it('naver(oauth) 어댑터가 hmac_key 입력을 거부', async () => {
    const adapter = createMockAdapter('naver')
    await expect(
      adapter.authenticate(AUTH_INPUT_FOR.coupang),
    ).rejects.toMatchObject({ code: 'validation' })
  })

  it('coupang(hmac) 어댑터가 oauth_code 입력을 거부', async () => {
    const adapter = createMockAdapter('coupang')
    await expect(
      adapter.authenticate(AUTH_INPUT_FOR.naver),
    ).rejects.toMatchObject({ code: 'validation' })
  })

  it('gmarket(esm_jwt) 어댑터가 api_key 입력을 거부', async () => {
    const adapter = createMockAdapter('gmarket')
    await expect(
      adapter.authenticate(AUTH_INPUT_FOR['11st']),
    ).rejects.toMatchObject({ code: 'validation' })
  })
})

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
