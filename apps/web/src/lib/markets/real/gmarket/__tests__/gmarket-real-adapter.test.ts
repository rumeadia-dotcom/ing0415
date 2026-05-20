/**
 * G마켓 real 어댑터 (ESM JWT, site='G') 단위 테스트 (12건).
 *
 * 마스터: WIP-5markets-mvp.md C-3 Phase 1
 * 근거 — PRD §2.4 자격증명 보안, market-adapter.md §9.
 *
 * 본 테스트는 공용 ESM 어댑터 (`shared-adapter.ts`) 의 G마켓 site 인스턴스를 통해
 * 5메서드 동작 + zod 스키마 통과 + 에러 매핑을 검증한다. 옥션 측은 별도 파일.
 *
 * 테스트 카테고리:
 *   authenticate (4건):
 *     A1. 유효 esm_jwt 입력 → StoredCredential(kind=esm_jwt) 반환
 *     A2. 잘못된 kind(hmac_key) → MarketError('validation')
 *     A3. 빈 masterId → MarketError('validation')
 *     A4. site 불일치 (입력 site='A') → MarketError('validation')
 *
 *   fetchCategoryTree (3건):
 *     F1. 정상 응답 → CategoryNode 배열 반환 + leaf
 *     F2. 하위 카테고리 포함 응답 → 재귀 children 파싱
 *     F3. 401 응답 → MarketError('unauthorized')
 *
 *   transformProduct (3건):
 *     T1. 상품명 80자 초과 → truncate
 *     T2. 이미지 배열 순서 + MAIN/EXTRA 분기
 *     T3. 결정성 — 같은 입력 두 번 호출 = 동일 출력 + market='gmarket'
 *
 *   createProduct (2건):
 *     C1. 정상 응답 → CreateProductResult(succeeded) + G마켓 URL
 *     C2. 500 응답 → MarketError('server')
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  StoredCredentialSchema,
  CategoryNodeSchema,
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

// ─────────────────────────────────────────────
// 픽스처
// ─────────────────────────────────────────────

const VALID_ESM_INPUT = {
  kind: 'esm_jwt' as const,
  masterId: 'master-gmarket-001',
  secretKey: 'secret-gmarket-001',
  sellerId: 'seller-gmarket-001',
  site: 'G' as const,
}

const VALID_PRODUCT: Product = {
  id: '11111111-1111-1111-1111-111111111111',
  sellerId: '22222222-2222-2222-2222-222222222222',
  name: '테스트 상품 G마켓',
  priceKrw: 19_900,
  stock: 10,
  images: [
    { url: 'https://cdn.example.com/g1.jpg', order: 0 },
    { url: 'https://cdn.example.com/g2.jpg', order: 1 },
  ],
  descriptionHtml: '',
  shippingFeeKrw: 3_000,
}

const VALID_MAPPING: MarketMapping = {
  market: 'gmarket',
  categoryId: '200001234',
  transformedImageUrls: [
    'https://cdn.example.com/g1-gmarket.jpg',
    'https://cdn.example.com/g2-gmarket.jpg',
  ],
  extra: {},
}

const CATEGORY_RESPONSE_LEAF = {
  resultCode: '0000',
  resultMessage: 'success',
  data: {
    categories: [
      {
        categoryId: '200001234',
        categoryName: '여성의류',
        isLeaf: true,
      },
    ],
  },
}

const CATEGORY_RESPONSE_WITH_CHILDREN = {
  resultCode: '0000',
  data: {
    categories: [
      {
        categoryId: '1',
        categoryName: '패션',
        isLeaf: false,
        children: [
          {
            categoryId: '200001234',
            categoryName: '여성의류',
            isLeaf: true,
          },
        ],
      },
    ],
  },
}

const CREATE_PRODUCT_RESPONSE = {
  resultCode: '0000',
  resultMessage: 'success',
  data: {
    itemNo: 'G-ITEM-9876543',
  },
}

// ─────────────────────────────────────────────
// 어댑터 팩토리
// ─────────────────────────────────────────────

async function getAuthenticatedAdapter() {
  const { gmarketRealAdapter } = await import('../index')
  await gmarketRealAdapter.authenticate(VALID_ESM_INPUT)
  return gmarketRealAdapter
}

// ─────────────────────────────────────────────
// authenticate
// ─────────────────────────────────────────────

describe('gmarketRealAdapter.authenticate', () => {
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

  it('A1: 유효 esm_jwt → StoredCredential(kind=esm_jwt) 반환', async () => {
    const { gmarketRealAdapter } = await import('../index')
    const result = await gmarketRealAdapter.authenticate(VALID_ESM_INPUT)

    expect(() => StoredCredentialSchema.parse(result)).not.toThrow()
    expect(result.kind).toBe('esm_jwt')
    if (result.kind === 'esm_jwt') {
      expect(result.payload.masterId).toBe(VALID_ESM_INPUT.masterId)
      expect(result.payload.site).toBe('G')
    }
  })

  it('A2: 잘못된 kind(hmac_key) → MarketError("validation")', async () => {
    const { gmarketRealAdapter } = await import('../index')
    await expect(
      gmarketRealAdapter.authenticate({
        kind: 'hmac_key',
        accessKey: 'ak',
        secretKey: 'sk',
        vendorId: 'v1',
      }),
    ).rejects.toMatchObject({ code: 'validation', name: 'MarketError' })
  })

  it('A3: 빈 masterId → MarketError("validation")', async () => {
    const { gmarketRealAdapter } = await import('../index')
    await expect(
      gmarketRealAdapter.authenticate({
        ...VALID_ESM_INPUT,
        masterId: '',
      }),
    ).rejects.toMatchObject({ code: 'validation' })
  })

  it('A4: site 불일치 (입력 A, 어댑터 G) → MarketError("validation")', async () => {
    const { gmarketRealAdapter } = await import('../index')
    await expect(
      gmarketRealAdapter.authenticate({
        ...VALID_ESM_INPUT,
        site: 'A',
      }),
    ).rejects.toMatchObject({ code: 'validation' })
  })
})

// ─────────────────────────────────────────────
// fetchCategoryTree
// ─────────────────────────────────────────────

describe('gmarketRealAdapter.fetchCategoryTree', () => {
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

  it('F1: 정상 응답(leaf) → CategoryNodeSchema 통과 + leaf=true', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock([{ ok: true, status: 200, body: CATEGORY_RESPONSE_LEAF }]),
    )

    const adapter = await getAuthenticatedAdapter()
    const tree = await adapter.fetchCategoryTree()

    expect(tree.length).toBe(1)
    expect(() => CategoryNodeSchema.parse(tree[0])).not.toThrow()
    expect(tree[0]?.leaf).toBe(true)
    expect(tree[0]?.name).toBe('여성의류')
  })

  it('F2: 하위 카테고리 포함 → 재귀 children 파싱', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock([{ ok: true, status: 200, body: CATEGORY_RESPONSE_WITH_CHILDREN }]),
    )

    const adapter = await getAuthenticatedAdapter()
    const tree = await adapter.fetchCategoryTree()

    expect(tree[0]?.leaf).toBe(false)
    expect(tree[0]?.children.length).toBe(1)
    expect(tree[0]?.children[0]?.name).toBe('여성의류')
    expect(tree[0]?.children[0]?.parentId).toBe('1')
  })

  it('F3: 401 응답 → MarketError("unauthorized")', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock([
        { ok: false, status: 401, body: { resultCode: '401', resultMessage: 'Unauthorized' } },
      ]),
    )

    const adapter = await getAuthenticatedAdapter()
    await expect(adapter.fetchCategoryTree()).rejects.toMatchObject({
      code: 'unauthorized',
    })
  })
})

// ─────────────────────────────────────────────
// transformProduct
// ─────────────────────────────────────────────

describe('gmarketRealAdapter.transformProduct', () => {
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

  it('T1: 상품명 80자 초과 시 80자로 truncate', async () => {
    const adapter = await getAuthenticatedAdapter()
    const product: Product = { ...VALID_PRODUCT, name: '가'.repeat(100) }
    const payload = adapter.transformProduct(product, VALID_MAPPING)
    const raw = payload.raw as { itemName: string }
    expect(raw.itemName.length).toBe(80)
    expect(raw.itemName).toBe('가'.repeat(80))
  })

  it('T2: 이미지 첫 번째 = MAIN, 나머지 = EXTRA, 순서 유지', async () => {
    const adapter = await getAuthenticatedAdapter()
    const mapping: MarketMapping = {
      ...VALID_MAPPING,
      transformedImageUrls: [
        'https://cdn.example.com/main.jpg',
        'https://cdn.example.com/extra1.jpg',
        'https://cdn.example.com/extra2.jpg',
      ],
    }
    const payload = adapter.transformProduct(VALID_PRODUCT, mapping)
    const raw = payload.raw as {
      images: { order: number; imageUrl: string; imageType: string }[]
    }
    expect(raw.images[0]?.imageType).toBe('MAIN')
    expect(raw.images[0]?.imageUrl).toBe('https://cdn.example.com/main.jpg')
    expect(raw.images[1]?.imageType).toBe('EXTRA')
    expect(raw.images[2]?.imageType).toBe('EXTRA')
    expect(raw.images[0]?.order).toBe(0)
    expect(raw.images[2]?.order).toBe(2)
  })

  it('T3: 결정성 — 같은 입력 두 번 호출 = 동일 출력 + market="gmarket"', async () => {
    const adapter = await getAuthenticatedAdapter()
    const p1 = adapter.transformProduct(VALID_PRODUCT, VALID_MAPPING)
    const p2 = adapter.transformProduct(VALID_PRODUCT, VALID_MAPPING)
    expect(p1).toEqual(p2)
    expect(p1.market).toBe('gmarket')
    expect((p1.raw as { site: string }).site).toBe('G')
  })
})

// ─────────────────────────────────────────────
// createProduct
// ─────────────────────────────────────────────

describe('gmarketRealAdapter.createProduct', () => {
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

  it('C1: 정상 응답 → CreateProductResult(succeeded) + gmarket.co.kr URL fallback', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock([{ ok: true, status: 200, body: CREATE_PRODUCT_RESPONSE }]),
    )

    const adapter = await getAuthenticatedAdapter()
    const payload = adapter.transformProduct(VALID_PRODUCT, VALID_MAPPING)
    const result = await adapter.createProduct(payload)

    expect(() => CreateProductResultSchema.parse(result)).not.toThrow()
    expect(result.market).toBe('gmarket')
    expect(result.status).toBe('succeeded')
    expect(result.externalId).toBe('G-ITEM-9876543')
    expect(result.productUrl).toContain('gmarket.co.kr')
    expect(result.productUrl).toContain('G-ITEM-9876543')
  })

  it('C2: 500 응답 → MarketError("server")', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock([
        {
          ok: false,
          status: 500,
          body: { resultCode: '500', resultMessage: 'Internal Server Error' },
        },
      ]),
    )

    const adapter = await getAuthenticatedAdapter()
    const payload = adapter.transformProduct(VALID_PRODUCT, VALID_MAPPING)
    await expect(adapter.createProduct(payload)).rejects.toMatchObject({
      code: 'server',
    })
  })
})
