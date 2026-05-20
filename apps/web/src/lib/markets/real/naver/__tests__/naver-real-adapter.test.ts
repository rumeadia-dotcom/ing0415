/**
 * 네이버 real 어댑터 단위 테스트 (14건).
 *
 * 마스터: WIP-5markets-mvp.md C-1 Phase 1
 * 근거 — PRD §2.4 자격증명 보안, market-adapter.md §9.1.
 *
 * 테스트 카테고리:
 *   authenticate (2건):
 *     A1. 잘못된 kind(hmac_key) → MarketError('validation')
 *     A2. 유효 oauth_code 라도 FE 직접 호출 금지 — MarketError('unknown', fe_exchange_not_allowed)
 *
 *   refreshToken (3건):
 *     R1. 정상 응답 → TokenSet (expiresAt = now + expires_in*1000)
 *     R2. 401 응답 → MarketError('unauthorized')
 *     R3. 빈 refresh 입력 → MarketError('validation')
 *
 *   fetchCategoryTree (3건):
 *     F1. 평탄 배열 응답 → depth 1 루트 + 자식 트리화
 *     F2. depth 4 깊이 → depth 3 까지만 children 채움 + leaf=true 강제
 *     F3. 401 응답 → MarketError('unauthorized')
 *
 *   transformProduct (4건):
 *     T1. 상품명 100자 초과 → 100자로 truncate
 *     T2. 상품명 100자 이하 — 그대로 유지
 *     T3. 이미지 URL: 첫번째 = representativeImage, 나머지 = optionalImages
 *     T4. 결정성 — 같은 입력 두 번 호출 = 동일 출력
 *
 *   createProduct (2건):
 *     C1. 정상 응답 (originProductNo 포함) → CreateProductResult(succeeded)
 *     C2. 400 응답 → MarketError('validation')
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  StoredCredentialSchema,
  CategoryNodeSchema,
  CreateProductResultSchema,
  TokenSetSchema,
  type Product,
  type MarketMapping,
} from '@/lib/schemas'

// fetch mock 헬퍼
function makeFetchMock(
  responses: { ok: boolean; status: number; body: unknown }[],
) {
  let callIdx = 0
  return vi.fn().mockImplementation(() => {
    const last = responses[responses.length - 1]
    const r = responses[callIdx] ?? last
    callIdx++
    if (!r) throw new Error('makeFetchMock: responses 배열이 비어있음')
    const text = JSON.stringify(r.body)
    return Promise.resolve({
      ok: r.ok,
      status: r.status,
      text: () => Promise.resolve(text),
      json: () => Promise.resolve(r.body),
    })
  })
}

// ─────────────────────────────────────────────
// 테스트 픽스처
// ─────────────────────────────────────────────

const VALID_OAUTH_INPUT = {
  kind: 'oauth_code' as const,
  code: 'test-authorization-code',
}

const NAVER_TOKEN_RESPONSE = {
  access_token: 'naver-access-token-abc',
  refresh_token: 'naver-refresh-token-xyz',
  expires_in: 10800, // 3시간 (네이버 표준 access token TTL 가정)
  token_type: 'Bearer',
  scope: 'commerce.products',
}

const NAVER_CATEGORY_FLAT_RESPONSE = {
  data: [
    { id: 50000000, name: '패션의류', parentId: null },
    { id: 50000001, name: '여성의류', parentId: 50000000 },
    { id: 50000002, name: '원피스', parentId: 50000001 },
  ],
}

// depth 4 자식 (자식의 자식의 자식의 자식) — 의도적으로 depth 3 초과
const NAVER_CATEGORY_DEEP_RESPONSE = {
  data: [
    { id: 1, name: 'L1', parentId: null },
    { id: 2, name: 'L2', parentId: 1 },
    { id: 3, name: 'L3', parentId: 2 },
    { id: 4, name: 'L4 (overflow)', parentId: 3 },
  ],
}

const CREATE_PRODUCT_RESPONSE = {
  originProductNo: 1234567890,
}

const VALID_PRODUCT: Product = {
  id: '11111111-1111-1111-1111-111111111111',
  sellerId: '22222222-2222-2222-2222-222222222222',
  name: '테스트 상품명',
  priceKrw: 15_000,
  stock: 5,
  images: [
    { url: 'https://cdn.example.com/img1.jpg', order: 0 },
    { url: 'https://cdn.example.com/img2.jpg', order: 1 },
  ],
  descriptionHtml: '',
  shippingFeeKrw: 2_500,
}

const VALID_MAPPING: MarketMapping = {
  market: 'naver',
  categoryId: '50000002',
  transformedImageUrls: [
    'https://cdn.example.com/img1-naver.jpg',
    'https://cdn.example.com/img2-naver.jpg',
  ],
  extra: {},
}

// ─────────────────────────────────────────────
// 어댑터 팩토리 — 각 테스트마다 fresh 인스턴스 (cred 격리)
// ─────────────────────────────────────────────

async function getFreshAdapter() {
  vi.resetModules()
  const mod = await import('../index')
  return mod.__createNaverRealAdapterForTest()
}

// refreshToken 으로 cred 주입한 fresh 인스턴스
async function getAuthedAdapter() {
  vi.stubGlobal(
    'fetch',
    makeFetchMock([{ ok: true, status: 200, body: NAVER_TOKEN_RESPONSE }]),
  )
  const adapter = await getFreshAdapter()
  await (adapter.refreshToken ?? (() => Promise.reject(new Error("no refreshToken"))))('seed-refresh-token')
  vi.unstubAllGlobals()
  return adapter
}

// ─────────────────────────────────────────────
// authenticate
// ─────────────────────────────────────────────

describe('naverRealAdapter.authenticate', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('crypto', {
      randomUUID: () => 'test-correlation-id',
      subtle: globalThis.crypto.subtle,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('A1: 잘못된 kind(hmac_key) → MarketError("validation")', async () => {
    const { naverRealAdapter } = await import('../index')
    await expect(
      naverRealAdapter.authenticate({
        kind: 'hmac_key',
        accessKey: 'ak',
        secretKey: 'sk',
        vendorId: 'A0001',
      }),
    ).rejects.toMatchObject({ code: 'validation', name: 'MarketError' })
  })

  it('A2: 유효 oauth_code 라도 FE 직접 호출 금지 — Edge Function 위임', async () => {
    const { naverRealAdapter } = await import('../index')
    await expect(
      naverRealAdapter.authenticate(VALID_OAUTH_INPUT),
    ).rejects.toMatchObject({ code: 'unknown', name: 'MarketError' })
  })
})

// ─────────────────────────────────────────────
// refreshToken
// ─────────────────────────────────────────────

describe('naverRealAdapter.refreshToken', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('crypto', {
      randomUUID: () => 'test-correlation-id',
      subtle: globalThis.crypto.subtle,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('R1: 정상 응답 → TokenSet (스키마 통과 + 토큰 매핑)', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock([{ ok: true, status: 200, body: NAVER_TOKEN_RESPONSE }]),
    )
    const adapter = await getFreshAdapter()
    const tokenSet = await (adapter.refreshToken ?? (() => Promise.reject(new Error("no refreshToken"))))('refresh-token-seed')

    expect(() => TokenSetSchema.parse(tokenSet)).not.toThrow()
    expect(tokenSet.accessToken).toBe(NAVER_TOKEN_RESPONSE.access_token)
    expect(tokenSet.refreshToken).toBe(NAVER_TOKEN_RESPONSE.refresh_token)
    expect(tokenSet.scope).toBe(NAVER_TOKEN_RESPONSE.scope)
    // expiresAt 은 ISO offset 형식 (Z 가 아닌 +00:00 정규화).
    expect(tokenSet.expiresAt).toMatch(/\+00:00$/)
  })

  it('R2: 401 응답 → MarketError("unauthorized")', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock([
        {
          ok: false,
          status: 401,
          body: { error: 'invalid_grant' },
        },
      ]),
    )
    const adapter = await getFreshAdapter()
    await expect(
      (adapter.refreshToken ?? (() => Promise.reject(new Error("no refreshToken"))))('expired-refresh'),
    ).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('R3: 빈 refresh 입력 → MarketError("validation")', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const adapter = await getFreshAdapter()
    await expect((adapter.refreshToken ?? (() => Promise.reject(new Error("no refreshToken"))))('')).rejects.toMatchObject({
      code: 'validation',
    })
  })
})

// ─────────────────────────────────────────────
// fetchCategoryTree
// ─────────────────────────────────────────────

describe('naverRealAdapter.fetchCategoryTree', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('crypto', {
      randomUUID: () => 'test-correlation-id',
      subtle: globalThis.crypto.subtle,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('F1: 평탄 배열 → depth 1 루트 + 자식 트리화', async () => {
    const adapter = await getAuthedAdapter()
    vi.stubGlobal(
      'fetch',
      makeFetchMock([
        { ok: true, status: 200, body: NAVER_CATEGORY_FLAT_RESPONSE },
      ]),
    )

    const tree = await adapter.fetchCategoryTree()
    expect(tree.length).toBe(1)
    for (const node of tree) {
      expect(() => CategoryNodeSchema.parse(node)).not.toThrow()
    }
    expect(tree[0]?.name).toBe('패션의류')
    expect(tree[0]?.children[0]?.name).toBe('여성의류')
    expect(tree[0]?.children[0]?.children[0]?.name).toBe('원피스')
    // 가장 깊은 노드도 leaf
    expect(tree[0]?.children[0]?.children[0]?.leaf).toBe(true)
  })

  it('F2: depth 4 응답 → depth 3 까지만 children, depth 3 노드는 leaf=true', async () => {
    const adapter = await getAuthedAdapter()
    vi.stubGlobal(
      'fetch',
      makeFetchMock([
        { ok: true, status: 200, body: NAVER_CATEGORY_DEEP_RESPONSE },
      ]),
    )

    const tree = await adapter.fetchCategoryTree()
    const l3 = tree[0]?.children[0]?.children[0]
    expect(l3?.depth).toBe(3)
    expect(l3?.leaf).toBe(true)
    expect(l3?.children.length).toBe(0)
  })

  it('F3: 401 응답 → MarketError("unauthorized")', async () => {
    const adapter = await getAuthedAdapter()
    vi.stubGlobal(
      'fetch',
      makeFetchMock([
        { ok: false, status: 401, body: { error: 'invalid_token' } },
      ]),
    )

    await expect(adapter.fetchCategoryTree()).rejects.toMatchObject({
      code: 'unauthorized',
    })
  })
})

// ─────────────────────────────────────────────
// transformProduct
// ─────────────────────────────────────────────

describe('naverRealAdapter.transformProduct', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('crypto', {
      randomUUID: () => 'test-correlation-id',
      subtle: globalThis.crypto.subtle,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('T1: 상품명 100자 초과 시 100자로 truncate', async () => {
    const adapter = await getAuthedAdapter()
    const longNameProduct: Product = {
      ...VALID_PRODUCT,
      // ProductSchema 가 100자 제한 — 정확히 100자로 작성 후 어댑터 내부
      // truncate 경로를 별도 검증 (스키마 우회).
      name: '가'.repeat(100),
    }

    // 어댑터의 truncate 로직은 100 초과 입력에서만 의미가 있으므로 직접 주입.
    const overflowed = { ...longNameProduct, name: '가'.repeat(150) }
    const payload = adapter.transformProduct(overflowed, VALID_MAPPING)
    const raw = payload.raw as {
      originProduct: { name: string }
    }
    expect(raw.originProduct.name.length).toBe(100)
    expect(raw.originProduct.name).toBe('가'.repeat(100))
  })

  it('T2: 상품명 100자 이하 — 그대로 유지', async () => {
    const adapter = await getAuthedAdapter()
    const shortNameProduct: Product = {
      ...VALID_PRODUCT,
      name: '짧은상품명',
    }

    const payload = adapter.transformProduct(shortNameProduct, VALID_MAPPING)
    const raw = payload.raw as { originProduct: { name: string } }
    expect(raw.originProduct.name).toBe('짧은상품명')
  })

  it('T3: 이미지 URL — 첫번째 = representativeImage, 나머지 = optionalImages', async () => {
    const adapter = await getAuthedAdapter()
    const mapping: MarketMapping = {
      ...VALID_MAPPING,
      transformedImageUrls: [
        'https://cdn.example.com/first.jpg',
        'https://cdn.example.com/second.jpg',
        'https://cdn.example.com/third.jpg',
      ],
    }

    const payload = adapter.transformProduct(VALID_PRODUCT, mapping)
    const raw = payload.raw as {
      originProduct: {
        images: {
          representativeImage: { url: string }
          optionalImages: { url: string }[]
        }
      }
    }
    expect(raw.originProduct.images.representativeImage.url).toBe(
      'https://cdn.example.com/first.jpg',
    )
    expect(raw.originProduct.images.optionalImages.length).toBe(2)
    expect(raw.originProduct.images.optionalImages[0]?.url).toBe(
      'https://cdn.example.com/second.jpg',
    )
    expect(raw.originProduct.images.optionalImages[1]?.url).toBe(
      'https://cdn.example.com/third.jpg',
    )
  })

  it('T4: 결정성 — 같은 입력 두 번 호출 = 동일 출력', async () => {
    const adapter = await getAuthedAdapter()
    const p1 = adapter.transformProduct(VALID_PRODUCT, VALID_MAPPING)
    const p2 = adapter.transformProduct(VALID_PRODUCT, VALID_MAPPING)
    expect(p1).toEqual(p2)
    expect(p1.market).toBe('naver')
  })
})

// ─────────────────────────────────────────────
// createProduct
// ─────────────────────────────────────────────

describe('naverRealAdapter.createProduct', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('crypto', {
      randomUUID: () => 'test-correlation-id',
      subtle: globalThis.crypto.subtle,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('C1: 정상 응답 → CreateProductResult(succeeded)', async () => {
    const adapter = await getAuthedAdapter()
    vi.stubGlobal(
      'fetch',
      makeFetchMock([
        { ok: true, status: 200, body: CREATE_PRODUCT_RESPONSE },
      ]),
    )

    const payload = adapter.transformProduct(VALID_PRODUCT, VALID_MAPPING)
    const result = await adapter.createProduct(payload)

    expect(() => CreateProductResultSchema.parse(result)).not.toThrow()
    expect(result.market).toBe('naver')
    expect(result.status).toBe('succeeded')
    expect(result.externalId).toBe('1234567890')
    expect(result.productUrl).toContain('smartstore.naver.com')
  })

  it('C2: 400 응답 → MarketError("validation")', async () => {
    const adapter = await getAuthedAdapter()
    vi.stubGlobal(
      'fetch',
      makeFetchMock([
        {
          ok: false,
          status: 400,
          body: { code: '400', message: '필수 필드 누락: name' },
        },
      ]),
    )

    const payload = adapter.transformProduct(VALID_PRODUCT, VALID_MAPPING)
    await expect(adapter.createProduct(payload)).rejects.toMatchObject({
      code: 'validation',
    })
  })
})

// ─────────────────────────────────────────────
// authenticate / refresh — StoredCredential 호환 sanity
// ─────────────────────────────────────────────

describe('naverRealAdapter — StoredCredential 호환', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('crypto', {
      randomUUID: () => 'test-correlation-id',
      subtle: globalThis.crypto.subtle,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('S1: refresh 응답을 StoredCredential(kind=oauth) 로 wrap 가능', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock([{ ok: true, status: 200, body: NAVER_TOKEN_RESPONSE }]),
    )
    const adapter = await getFreshAdapter()
    const tokenSet = await (adapter.refreshToken ?? (() => Promise.reject(new Error("no refreshToken"))))('seed')
    const stored = StoredCredentialSchema.parse({
      kind: 'oauth',
      payload: tokenSet,
      expiresAt: tokenSet.expiresAt,
    })
    expect(stored.kind).toBe('oauth')
    if (stored.kind === 'oauth') {
      expect(stored.payload.accessToken).toBe(tokenSet.accessToken)
    }
  })
})
