/**
 * Parity 테스트 공용 헬퍼.
 * 마스터: docs/architecture/v1/testing.md §12 (debug ↔ real 어댑터 격차 검증)
 *
 * 본 헬퍼는 시험 가능 범위를 4구간으로 한정한다 (captured-real fixture 부재 가정):
 *   1. Static 정합 — market / credentialKind mock = real
 *   2. Interface 정합 — 7 메서드 (refreshToken 옵셔널) 모두 존재
 *   3. transformProduct 외피 정합 — { market, raw } / MarketPayloadSchema 통과
 *   4. Mock 응답 schema 정합 — authenticate / createProduct / fetchCategoryTree 등
 *
 * 5번째 구간 (real 응답 captured-real-*.json 과 schema 격차) 은 Phase 4-B sandbox
 * 접근 확보 후 활성 (it.todo 마커 + 본 헬퍼 확장).
 */

import { expect } from 'vitest'
import {
  MarketPayloadSchema,
  type MarketCredentialKind,
  type MarketId,
  type MarketMapping,
  type Product,
} from '@/lib/schemas'
import type { MarketAdapter } from '@/lib/markets/types'

export const SELLER_ID_FIXTURE = '00000000-0000-4000-8000-000000000001'
export const PRODUCT_ID_FIXTURE = '00000000-0000-4000-8000-000000000002'

/**
 * 모든 마켓 transformProduct 의 truncation 한계를 회피하는 짧은 상품명 (50자 < min(coupang 50, esm 80, naver 100)).
 */
export function sampleProduct(): Product {
  return {
    id: PRODUCT_ID_FIXTURE,
    sellerId: SELLER_ID_FIXTURE,
    name: '테스트 상품 A',
    priceKrw: 19_900,
    stock: 50,
    images: [
      { url: 'https://cdn.example.com/p/1.jpg', order: 0 },
      { url: 'https://cdn.example.com/p/2.jpg', order: 1 },
    ],
    descriptionHtml: '<p>설명</p>',
    shippingFeeKrw: 3_000,
  }
}

export function sampleMapping(market: MarketId): MarketMapping {
  return {
    market,
    categoryId: '50000167',
    transformedImageUrls: [
      'https://cdn.example.com/p/naver/1.jpg',
      'https://cdn.example.com/p/naver/2.jpg',
    ],
    extra: {},
  }
}

/**
 * mock + real 어댑터 페어에 대해 §12 §1~§3 구간 (static / interface / transformProduct
 * 외피) 의 parity 단정을 일괄 실행. 호출측은 describe 안에서 it 1건으로 wrap.
 */
export function assertStructuralParity(opts: {
  mock: MarketAdapter
  real: MarketAdapter
  expectedMarket: MarketId
  expectedKind: MarketCredentialKind
  /** OAuth (naver) 만 refreshToken 메서드를 가진다. 다른 마켓은 undefined 정합. */
  hasRefreshToken: boolean
}): void {
  const { mock, real, expectedMarket, expectedKind, hasRefreshToken } = opts

  // §1 Static 정합
  expect(mock.market).toBe(expectedMarket)
  expect(real.market).toBe(expectedMarket)
  expect(mock.credentialKind).toBe(expectedKind)
  expect(real.credentialKind).toBe(expectedKind)

  // §2 Interface 정합 — 5 필수 + 2 v2 메서드 (fetchOrders / submitTracking)
  for (const method of [
    'authenticate',
    'fetchCategoryTree',
    'transformProduct',
    'createProduct',
    'fetchOrders',
    'submitTracking',
  ] as const) {
    expect(typeof mock[method]).toBe('function')
    expect(typeof real[method]).toBe('function')
  }
  // refreshToken 은 OAuth 만 정의. 양쪽 정합.
  expect(typeof mock.refreshToken).toBe(hasRefreshToken ? 'function' : 'undefined')
  expect(typeof real.refreshToken).toBe(hasRefreshToken ? 'function' : 'undefined')

  // §3 transformProduct 외피 정합 — 내부 raw 는 마켓별 상이 (의도).
  const product = sampleProduct()
  const mapping = sampleMapping(expectedMarket)
  const mockPayload = mock.transformProduct(product, mapping)
  const realPayload = real.transformProduct(product, mapping)

  expect(() => MarketPayloadSchema.parse(mockPayload)).not.toThrow()
  expect(() => MarketPayloadSchema.parse(realPayload)).not.toThrow()
  expect(mockPayload.market).toBe(expectedMarket)
  expect(realPayload.market).toBe(expectedMarket)
  expect(mockPayload.raw).toBeTypeOf('object')
  expect(realPayload.raw).toBeTypeOf('object')
  expect(mockPayload.raw).not.toBeNull()
  expect(realPayload.raw).not.toBeNull()
}
