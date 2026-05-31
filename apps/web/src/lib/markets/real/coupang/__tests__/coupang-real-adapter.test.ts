/**
 * 쿠팡 real 어댑터 단위 테스트 (14건).
 *
 * 마스터: WIP-5markets-mvp.md C-2 Phase 1
 * 근거 — PRD §2.4 자격증명 보안, market-adapter.md §9.
 *
 * 테스트 카테고리:
 *   authenticate (4건):
 *     A1. 유효 hmac_key → StoredCredential(kind='hmac') 반환
 *     A2. 잘못된 kind(oauth_code) → MarketError('validation')
 *     A3. 빈 accessKey → MarketError('validation')
 *     A4. 빈 secretKey → MarketError('validation')
 *
 *   fetchCategoryTree (3건):
 *     F1. 정상 mock 응답 → CategoryNode 배열 반환 + leaf=true
 *     F2. 하위 카테고리 포함 응답 → 재귀 children 파싱
 *     F3. 401 응답 → MarketError('unauthorized')
 *
 *   transformProduct (4건):
 *     T1. 상품명 50자 제한 — 초과 시 truncate
 *     T2. 상품명 50자 미만 — 그대로 유지
 *     T3. 이미지 URL 배열 순서 유지
 *     T4. 결정성 — 같은 입력 두 번 호출 = 동일 출력
 *
 *   createProduct (3건):
 *     C1. 정상 응답 (201) → CreateProductResult(succeeded)
 *     C2. 400 응답 → MarketError('validation')
 *     C3. 500 응답 → MarketError('server')
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  StoredCredentialSchema,
  CreateProductResultSchema,
  type Product,
  type MarketMapping,
} from '@/lib/schemas'

// fetch mock 헬퍼
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
// 테스트 픽스처
// ─────────────────────────────────────────────

const VALID_HMAC_INPUT = {
  kind: 'hmac_key' as const,
  accessKey: 'test-access-key',
  secretKey: 'test-secret-key',
  vendorId: 'A00012345',
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
  market: 'coupang',
  categoryId: '56137',
  transformedImageUrls: [
    'https://cdn.example.com/img1-coupang.jpg',
    'https://cdn.example.com/img2-coupang.jpg',
  ],
  extra: {},
}

// 카테고리 응답 mock 은 fetchCategoryTree Edge 이전(category-sync.md §6.4)으로 제거됨.

const CREATE_PRODUCT_RESPONSE = {
  code: '200',
  message: 'success',
  data: {
    sellerProductId: 98765432,
    productUrl: 'https://www.coupang.com/vp/products/98765432',
  },
}

// ─────────────────────────────────────────────
// 어댑터 팩토리 — 각 테스트마다 fresh 인스턴스
// ─────────────────────────────────────────────

async function getAuthenticatedAdapter() {
  // 동적 import → fresh 모듈 인스턴스 (vi.resetModules 사용)
  const { coupangRealAdapter } = await import('../index')
  await coupangRealAdapter.authenticate(VALID_HMAC_INPUT)
  return coupangRealAdapter
}

// ─────────────────────────────────────────────
// authenticate
// ─────────────────────────────────────────────

describe('coupangRealAdapter.authenticate', () => {
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

  it('A1: 유효 hmac_key → StoredCredential(kind=hmac) 반환', async () => {
    const { coupangRealAdapter } = await import('../index')
    const result = await coupangRealAdapter.authenticate(VALID_HMAC_INPUT)

    expect(() => StoredCredentialSchema.parse(result)).not.toThrow()
    expect(result.kind).toBe('hmac')
    if (result.kind === 'hmac') {
      expect(result.payload.accessKey).toBe(VALID_HMAC_INPUT.accessKey)
      expect(result.payload.vendorId).toBe(VALID_HMAC_INPUT.vendorId)
    }
  })

  it('A2: 잘못된 kind(oauth_code) → MarketError("validation")', async () => {
    const { coupangRealAdapter } = await import('../index')
    // vi.resetModules() 로 MarketError 도 재로드되어 instanceof 크로스체크 불가.
    // toMatchObject 로 code / name 검증 (동일 결과).
    await expect(
      coupangRealAdapter.authenticate({
        kind: 'oauth_code',
        code: 'some-code',
      }),
    ).rejects.toMatchObject({ code: 'validation', name: 'MarketError' })
  })

  it('A3: 빈 accessKey → MarketError("validation")', async () => {
    const { coupangRealAdapter } = await import('../index')
    await expect(
      coupangRealAdapter.authenticate({
        kind: 'hmac_key',
        accessKey: '',
        secretKey: 'valid-secret',
        vendorId: 'A00012345',
      }),
    ).rejects.toMatchObject({ code: 'validation' })
  })

  it('A4: 빈 secretKey → MarketError("validation")', async () => {
    const { coupangRealAdapter } = await import('../index')
    await expect(
      coupangRealAdapter.authenticate({
        kind: 'hmac_key',
        accessKey: 'valid-access',
        secretKey: '',
        vendorId: 'A00012345',
      }),
    ).rejects.toMatchObject({ code: 'validation' })
  })
})

// ─────────────────────────────────────────────
// fetchCategoryTree
// ─────────────────────────────────────────────

describe('coupangRealAdapter.fetchCategoryTree', () => {
  // 카테고리 조회는 Edge markets-category-children 로 이전됨 (category-sync.md §6.4).
  //   브라우저 직접 fetch 는 CORS 차단 → web 어댑터 fetchCategoryTree 는 런타임 미사용 throw.
  //   인증 불필요(첫 줄에서 throw) — 모듈 export 를 동적 import 로 직접 호출.
  it('F1: Edge 이전됨 — 호출 시 throw (런타임 미사용)', async () => {
    const { coupangRealAdapter } = await import('../index')
    await expect(coupangRealAdapter.fetchCategoryTree()).rejects.toThrow(
      /markets-category-children/,
    )
  })
})

// ─────────────────────────────────────────────
// transformProduct
// ─────────────────────────────────────────────

describe('coupangRealAdapter.transformProduct', () => {
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

  it('T1: 상품명 50자 초과 시 50자로 truncate', async () => {
    const adapter = await getAuthenticatedAdapter()
    const longNameProduct: Product = {
      ...VALID_PRODUCT,
      name: '가'.repeat(60), // 60자
    }

    const payload = adapter.transformProduct(longNameProduct, VALID_MAPPING)
    const raw = payload.raw as { sellerProductName: string }
    expect(raw.sellerProductName.length).toBe(50)
    expect(raw.sellerProductName).toBe('가'.repeat(50))
  })

  it('T2: 상품명 50자 이하 — 그대로 유지', async () => {
    const adapter = await getAuthenticatedAdapter()
    const shortNameProduct: Product = {
      ...VALID_PRODUCT,
      name: '짧은상품명', // 5자
    }

    const payload = adapter.transformProduct(shortNameProduct, VALID_MAPPING)
    const raw = payload.raw as { sellerProductName: string }
    expect(raw.sellerProductName).toBe('짧은상품명')
  })

  it('T3: 이미지 URL 배열 순서 유지 (transformedImageUrls order)', async () => {
    const adapter = await getAuthenticatedAdapter()
    const mapping: MarketMapping = {
      ...VALID_MAPPING,
      transformedImageUrls: [
        'https://cdn.example.com/first.jpg',
        'https://cdn.example.com/second.jpg',
        'https://cdn.example.com/third.jpg',
      ],
    }

    const payload = adapter.transformProduct(VALID_PRODUCT, mapping)
    const raw = payload.raw as { images: { imageOrder: number; cdnPath: string }[] }
    expect(raw.images[0]?.cdnPath).toBe('https://cdn.example.com/first.jpg')
    expect(raw.images[1]?.cdnPath).toBe('https://cdn.example.com/second.jpg')
    expect(raw.images[2]?.cdnPath).toBe('https://cdn.example.com/third.jpg')
    expect(raw.images[0]?.imageOrder).toBe(0)
    expect(raw.images[1]?.imageOrder).toBe(1)
  })

  it('T4: 결정성 — 같은 입력 두 번 호출 = 동일 출력', async () => {
    const adapter = await getAuthenticatedAdapter()
    const p1 = adapter.transformProduct(VALID_PRODUCT, VALID_MAPPING)
    const p2 = adapter.transformProduct(VALID_PRODUCT, VALID_MAPPING)
    expect(p1).toEqual(p2)
    expect(p1.market).toBe('coupang')
  })
})

// ─────────────────────────────────────────────
// createProduct
// ─────────────────────────────────────────────

describe('coupangRealAdapter.createProduct', () => {
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

  it('C1: 정상 응답 (200) → CreateProductResult(succeeded)', async () => {
    vi.stubGlobal('fetch', makeFetchMock([
      { ok: true, status: 200, body: CREATE_PRODUCT_RESPONSE },
    ]))

    const adapter = await getAuthenticatedAdapter()
    const payload = adapter.transformProduct(VALID_PRODUCT, VALID_MAPPING)
    const result = await adapter.createProduct(payload)

    expect(() => CreateProductResultSchema.parse(result)).not.toThrow()
    expect(result.market).toBe('coupang')
    expect(result.status).toBe('succeeded')
    expect(result.externalId).toBe('98765432')
    expect(result.productUrl).toContain('coupang.com')
  })

  it('C2: 400 응답 → MarketError("validation")', async () => {
    vi.stubGlobal('fetch', makeFetchMock([
      {
        ok: false,
        status: 400,
        body: { code: '400', message: '필수 필드 누락: sellerProductName' },
      },
    ]))

    const adapter = await getAuthenticatedAdapter()
    const payload = adapter.transformProduct(VALID_PRODUCT, VALID_MAPPING)

    await expect(adapter.createProduct(payload)).rejects.toMatchObject({
      code: 'validation',
    })
  })

  it('C3: 500 응답 → MarketError("server")', async () => {
    vi.stubGlobal('fetch', makeFetchMock([
      {
        ok: false,
        status: 500,
        body: { code: '500', message: 'Internal Server Error' },
      },
    ]))

    const adapter = await getAuthenticatedAdapter()
    const payload = adapter.transformProduct(VALID_PRODUCT, VALID_MAPPING)

    await expect(adapter.createProduct(payload)).rejects.toMatchObject({
      code: 'server',
    })
  })
})
