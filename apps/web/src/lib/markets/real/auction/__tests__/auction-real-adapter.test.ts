/**
 * 옥션 real 어댑터 (ESM JWT, site='A') 단위 테스트 (8건).
 *
 * 마스터: WIP-5markets-mvp.md C-3 Phase 2
 * 근거 — PRD §2.4 자격증명 보안, market-adapter.md §9.
 *
 * 옥션은 G마켓과 ESM+ 백오피스 공유 — 공용 shared-adapter 의 site='A' 인스턴스.
 * G마켓 측 12건과 중복 회피를 위해 옥션 고유 차이점만 검증 (site 'A' 분기 / market id /
 * 상품 URL fallback). 공통 로직(상품명 80자 truncate 등) 회귀는 G마켓 측 테스트로 커버.
 *
 * 테스트 카테고리:
 *   authenticate (3건):
 *     A1. 유효 esm_jwt (site='A') → StoredCredential(kind=esm_jwt, payload.site='A')
 *     A2. 잘못된 kind(oauth_code) → MarketError('validation')
 *     A3. site 불일치 (입력 G) → MarketError('validation')
 *
 *   fetchCategoryTree (1건):
 *     F1. 정상 응답 → CategoryNode 반환 (G마켓과 동일 파서 — sanity 1건만)
 *
 *   transformProduct (2건):
 *     T1. payload.market = 'auction' + payload.raw.site = 'A'
 *     T2. 상품명 80자 이하 — 그대로 유지 (G마켓 truncate 회귀는 G 측에서 커버)
 *
 *   createProduct (2건):
 *     C1. 정상 응답 → CreateProductResult(succeeded) + auction.co.kr URL fallback
 *     C2. 400 응답 → MarketError('validation')
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  StoredCredentialSchema,
  CreateProductResultSchema,
  type Product,
  type MarketMapping,
} from '@/lib/schemas'

function makeFetchMock(responses: { ok: boolean; status: number; body: unknown }[]) {
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

const VALID_ESM_INPUT = {
  kind: 'esm_jwt' as const,
  masterId: 'master-auction-001',
  secretKey: 'secret-auction-001',
  sellerId: 'seller-auction-001',
  site: 'A' as const,
}

const VALID_PRODUCT: Product = {
  id: '11111111-1111-1111-1111-111111111111',
  sellerId: '22222222-2222-2222-2222-222222222222',
  name: '옥션 테스트 상품',
  priceKrw: 12_900,
  stock: 7,
  images: [{ url: 'https://cdn.example.com/a1.jpg', order: 0 }],
  descriptionHtml: '',
  shippingFeeKrw: 2_500,
}

const VALID_MAPPING: MarketMapping = {
  market: 'auction',
  categoryId: '500009999',
  transformedImageUrls: ['https://cdn.example.com/a1-auction.jpg'],
  extra: {},
}

// site-cats 대분류 응답 — 단일 leaf. esm-api/product/4.md 형태.
const CATEGORY_RESPONSE = [
  {
    catCode: '500009999',
    catName: '주방/욕실',
    isLeaf: true,
  },
]

const CREATE_PRODUCT_RESPONSE = {
  resultCode: '0000',
  data: {
    itemNo: 'A-ITEM-1234567',
  },
}

async function getAuthenticatedAdapter() {
  const { auctionRealAdapter } = await import('../index')
  await auctionRealAdapter.authenticate(VALID_ESM_INPUT)
  return auctionRealAdapter
}

// ─────────────────────────────────────────────
// authenticate
// ─────────────────────────────────────────────

describe('auctionRealAdapter.authenticate', () => {
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

  it('A1: 유효 esm_jwt(site=A) → StoredCredential.payload.site = "A"', async () => {
    const { auctionRealAdapter } = await import('../index')
    const result = await auctionRealAdapter.authenticate(VALID_ESM_INPUT)
    expect(() => StoredCredentialSchema.parse(result)).not.toThrow()
    expect(result.kind).toBe('esm_jwt')
    if (result.kind === 'esm_jwt') {
      expect(result.payload.site).toBe('A')
      expect(result.payload.sellerId).toBe(VALID_ESM_INPUT.sellerId)
    }
  })

  it('A2: 잘못된 kind(oauth_code) → MarketError("validation")', async () => {
    const { auctionRealAdapter } = await import('../index')
    await expect(
      auctionRealAdapter.authenticate({ kind: 'oauth_code', code: 'some-code' }),
    ).rejects.toMatchObject({ code: 'validation', name: 'MarketError' })
  })

  it('A3: site 불일치 (입력 G, 어댑터 A) → MarketError("validation")', async () => {
    const { auctionRealAdapter } = await import('../index')
    await expect(
      auctionRealAdapter.authenticate({ ...VALID_ESM_INPUT, site: 'G' }),
    ).rejects.toMatchObject({ code: 'validation' })
  })
})

// ─────────────────────────────────────────────
// fetchCategoryTree
// ─────────────────────────────────────────────

describe('auctionRealAdapter.fetchCategoryTree', () => {
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

  it('F1: 정상 응답 → CategoryNode 반환', async () => {
    vi.stubGlobal('fetch', makeFetchMock([{ ok: true, status: 200, body: CATEGORY_RESPONSE }]))

    const adapter = await getAuthenticatedAdapter()
    const tree = await adapter.fetchCategoryTree()
    expect(tree.length).toBe(1)
    expect(tree[0]?.name).toBe('주방/욕실')
    expect(tree[0]?.leaf).toBe(true)
  })
})

// ─────────────────────────────────────────────
// transformProduct
// ─────────────────────────────────────────────

describe('auctionRealAdapter.transformProduct', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('crypto', {
      randomUUID: () => 'test-correlation-id',
      subtle: globalThis.crypto.subtle,
    })
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('T1: payload.market="auction" + payload.raw.site="A"', async () => {
    const adapter = await getAuthenticatedAdapter()
    const payload = adapter.transformProduct(VALID_PRODUCT, VALID_MAPPING)
    expect(payload.market).toBe('auction')
    expect((payload.raw as { site: string }).site).toBe('A')
  })

  it('T2: 상품명 80자 이하 — 그대로 유지', async () => {
    const adapter = await getAuthenticatedAdapter()
    const product: Product = { ...VALID_PRODUCT, name: '짧은 옥션 상품명' }
    const payload = adapter.transformProduct(product, VALID_MAPPING)
    expect((payload.raw as { itemName: string }).itemName).toBe('짧은 옥션 상품명')
  })
})

// ─────────────────────────────────────────────
// createProduct
// ─────────────────────────────────────────────

describe('auctionRealAdapter.createProduct', () => {
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

  it('C1: 정상 응답 → CreateProductResult + auction.co.kr URL fallback', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock([{ ok: true, status: 200, body: CREATE_PRODUCT_RESPONSE }]),
    )

    const adapter = await getAuthenticatedAdapter()
    const payload = adapter.transformProduct(VALID_PRODUCT, VALID_MAPPING)
    const result = await adapter.createProduct(payload)

    expect(() => CreateProductResultSchema.parse(result)).not.toThrow()
    expect(result.market).toBe('auction')
    expect(result.externalId).toBe('A-ITEM-1234567')
    expect(result.productUrl).toContain('auction.co.kr')
    expect(result.productUrl).toContain('A-ITEM-1234567')
  })

  it('C2: 400 응답 → MarketError("validation")', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock([
        {
          ok: false,
          status: 400,
          body: { resultCode: '400', resultMessage: '필수 필드 누락: itemName' },
        },
      ]),
    )

    const adapter = await getAuthenticatedAdapter()
    const payload = adapter.transformProduct(VALID_PRODUCT, VALID_MAPPING)
    await expect(adapter.createProduct(payload)).rejects.toMatchObject({
      code: 'validation',
    })
  })
})
