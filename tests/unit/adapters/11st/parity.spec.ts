/**
 * 11번가 어댑터 debug ↔ real parity.
 * 마스터: docs/architecture/v1/testing.md §12 / qa-matrix.md QA-FAIL-301.
 *
 * 11번가 = API Key (영구). refreshToken 없음. 2026-05-25 scaffold 후:
 *   - mock: createMockAdapter('11st') — 다른 4마켓과 동일 분기 (authenticate /
 *     fetchCategoryTree / transformProduct / createProduct / fetchOrders 모두 정상 동작).
 *   - real: scaffold — authenticate 만 동작. transformProduct / createProduct /
 *     fetchCategoryTree / fetchOrders / submitTracking 는 spec 미확보로 throw
 *     MarketError(unknown, 'adapter_spec_pending'). 본격 구현 별도 PR.
 *
 * 본 spec 는 §1 static / §2 interface / §4 mock schema 정합은 활성. §3 transformProduct
 * 외피 정합은 real 가 spec 미확보로 throw 하므로 asymmetric 명시 (mock 만 검증).
 * §5 (real createProduct 응답 vs mock schema 격차) 는 본격 구현 후 활성.
 */

import { describe, expect, it } from 'vitest'
import {
  CreateProductResultSchema,
  MarketPayloadSchema,
  StoredCredentialSchema,
  type AuthInput,
  type MarketMapping,
  type Product,
} from '@/lib/schemas'
import { elevenstDebugAdapter } from '@/lib/markets/debug/ElevenstDebugAdapter'
import { elevenstRealAdapter } from '@/lib/markets/real/11st'
import { MarketError } from '@/lib/markets/errors'

const SAMPLE_API_KEY_INPUT: AuthInput = {
  kind: 'api_key',
  apiKey: 'TEST_API_KEY_' + 'X'.repeat(32),
}

const SAMPLE_PRODUCT: Product = {
  id: '00000000-0000-4000-8000-000000000002',
  sellerId: '00000000-0000-4000-8000-000000000001',
  name: '테스트',
  priceKrw: 9_900,
  stock: 10,
  images: [{ url: 'https://cdn.example.com/1.jpg', order: 0 }],
  descriptionHtml: '',
  shippingFeeKrw: 0,
}

const SAMPLE_MAPPING: MarketMapping = {
  market: '11st',
  categoryId: '1001',
  transformedImageUrls: ['https://cdn.example.com/1.jpg'],
  extra: {},
}

describe('11st adapter parity (debug ↔ real)', () => {
  it('§1: static 정합 — market / credentialKind mock = real', () => {
    expect(elevenstDebugAdapter.market).toBe('11st')
    expect(elevenstRealAdapter.market).toBe('11st')
    expect(elevenstDebugAdapter.credentialKind).toBe('api_key')
    expect(elevenstRealAdapter.credentialKind).toBe('api_key')
  })

  it('§2: 인터페이스 정합 — 6 메서드 양쪽 모두 정의 (refreshToken 부재 정합)', () => {
    for (const method of [
      'authenticate',
      'fetchCategoryTree',
      'transformProduct',
      'createProduct',
      'fetchOrders',
      'submitTracking',
    ] as const) {
      expect(typeof elevenstDebugAdapter[method]).toBe('function')
      expect(typeof elevenstRealAdapter[method]).toBe('function')
    }
    // api_key 영구 키 — refreshToken 양쪽 부재 정합.
    expect(typeof elevenstDebugAdapter.refreshToken).toBe('undefined')
    expect(typeof elevenstRealAdapter.refreshToken).toBe('undefined')
  })

  it('§3-mock: mock transformProduct → { market, raw } / MarketPayloadSchema 통과', () => {
    const payload = elevenstDebugAdapter.transformProduct(SAMPLE_PRODUCT, SAMPLE_MAPPING)
    expect(() => MarketPayloadSchema.parse(payload)).not.toThrow()
    expect(payload.market).toBe('11st')
    expect(payload.raw).toBeTypeOf('object')
  })

  it('§3-real: real transformProduct 는 spec 미확보로 throw (본격 구현 후 §3 정합 활성)', () => {
    expect(() =>
      elevenstRealAdapter.transformProduct(SAMPLE_PRODUCT, SAMPLE_MAPPING),
    ).toThrow(MarketError)
    try {
      elevenstRealAdapter.transformProduct(SAMPLE_PRODUCT, SAMPLE_MAPPING)
    } catch (e) {
      expect(e).toBeInstanceOf(MarketError)
      expect((e as MarketError).context.marketErrorCode).toBe('adapter_spec_pending')
    }
  })

  it('§4-a: mock authenticate(api_key) → StoredCredential schema 통과', async () => {
    const cred = await elevenstDebugAdapter.authenticate(SAMPLE_API_KEY_INPUT)
    expect(() => StoredCredentialSchema.parse(cred)).not.toThrow()
    expect(cred.kind).toBe('api_key')
  })

  it('§4-b: real authenticate(api_key) → StoredCredential schema 통과 (네트워크 호출 없음)', async () => {
    const cred = await elevenstRealAdapter.authenticate(SAMPLE_API_KEY_INPUT)
    expect(() => StoredCredentialSchema.parse(cred)).not.toThrow()
    expect(cred.kind).toBe('api_key')
  })

  it('§4-c: 두 어댑터의 authenticate 결과 kind 정합', async () => {
    const mockCred = await elevenstDebugAdapter.authenticate(SAMPLE_API_KEY_INPUT)
    const realCred = await elevenstRealAdapter.authenticate(SAMPLE_API_KEY_INPUT)
    expect(mockCred.kind).toBe(realCred.kind)
    expect(mockCred.kind).toBe('api_key')
  })

  it('§4-d: mock createProduct happy → CreateProductResult schema 통과 + market=11st', async () => {
    const payload = elevenstDebugAdapter.transformProduct(SAMPLE_PRODUCT, SAMPLE_MAPPING)
    const result = await elevenstDebugAdapter.createProduct(payload)
    expect(() => CreateProductResultSchema.parse(result)).not.toThrow()
    expect(result.market).toBe('11st')
  })

  it('§4-e: real createProduct 는 spec 미확보로 throw (본격 구현 후 §4-e 활성)', async () => {
    await expect(
      elevenstRealAdapter.createProduct({ market: '11st', raw: {} }),
    ).rejects.toBeInstanceOf(MarketError)
  })

  it('§4-f: real authenticate 입력 kind 불일치 시 validation 에러 (mock 과 동일 시그니처)', async () => {
    const wrongKind: AuthInput = {
      kind: 'oauth_code',
      code: 'irrelevant',
    }
    await expect(elevenstRealAdapter.authenticate(wrongKind)).rejects.toThrow()
    await expect(elevenstDebugAdapter.authenticate(wrongKind)).rejects.toThrow()
  })

  // §5 — real 어댑터 본격 구현 후 captured-real fixture 와 mock 응답 schema 격차 비교.
  // 현 시점: real fetchCategoryTree / transformProduct / createProduct / fetchOrders /
  // submitTracking 모두 spec 미확보 → it.todo 유지.
  it.todo('§5: real 어댑터 본격 구현 후 — captured 응답 fixture ↔ mock 응답 schema 격차')
})
