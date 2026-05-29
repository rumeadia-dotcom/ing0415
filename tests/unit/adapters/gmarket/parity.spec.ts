/**
 * G마켓 ESM JWT 어댑터 debug ↔ real parity.
 * 마스터: docs/architecture/v1/testing.md §12 / qa-matrix.md QA-FAIL-301.
 *
 * G마켓·옥션은 같은 ESM 플랫폼 — `createEsmRealAdapter({ site: 'G' | 'A' })` 인스턴스.
 * 본 spec 는 site='G' 인스턴스 (gmarket) 의 parity 만 단정.
 */

import { describe, expect, it } from 'vitest'
import {
  CreateProductResultSchema,
  StoredCredentialSchema,
  type AuthInput,
} from '@/lib/schemas'
import { gmarketDebugAdapter } from '@/lib/markets/debug/GmarketDebugAdapter'
import { gmarketRealAdapter } from '@/lib/markets/real/gmarket'
import { assertStructuralParity } from '../_shared/parity'

const SAMPLE_ESM_INPUT: AuthInput = {
  kind: 'esm_jwt',
  masterId: 'master_gmarket_test',
  secretKey: 'SECRET' + 'Z'.repeat(48),
  sellerId: 'gmarket_seller_001',
  site: 'G',
}

describe('gmarket adapter parity (debug ↔ real)', () => {
  it('§1~§3: static / interface / transformProduct 외피 정합', () => {
    assertStructuralParity({
      mock: gmarketDebugAdapter,
      real: gmarketRealAdapter,
      expectedMarket: 'gmarket',
      expectedKind: 'esm_jwt',
      hasRefreshToken: false,
    })
  })

  it('§4-a: mock authenticate(esm_jwt) → StoredCredential schema 통과', async () => {
    const cred = await gmarketDebugAdapter.authenticate(SAMPLE_ESM_INPUT)
    expect(() => StoredCredentialSchema.parse(cred)).not.toThrow()
    expect(cred.kind).toBe('esm_jwt')
  })

  it('§4-b: real authenticate(esm_jwt) → StoredCredential schema 통과 (네트워크 호출 없음)', async () => {
    const cred = await gmarketRealAdapter.authenticate(SAMPLE_ESM_INPUT)
    expect(() => StoredCredentialSchema.parse(cred)).not.toThrow()
    expect(cred.kind).toBe('esm_jwt')
  })

  it('§4-c: 두 어댑터의 authenticate 결과 kind 정합', async () => {
    const mockCred = await gmarketDebugAdapter.authenticate(SAMPLE_ESM_INPUT)
    const realCred = await gmarketRealAdapter.authenticate(SAMPLE_ESM_INPUT)
    expect(mockCred.kind).toBe(realCred.kind)
    expect(mockCred.kind).toBe('esm_jwt')
  })

  it('§4-d: mock createProduct happy → CreateProductResult schema 통과 + market=gmarket', async () => {
    const payload = gmarketDebugAdapter.transformProduct(
      {
        id: '00000000-0000-4000-8000-000000000002',
        sellerId: '00000000-0000-4000-8000-000000000001',
        name: '테스트',
        priceKrw: 9_900,
        stock: 10,
        images: [{ url: 'https://cdn.example.com/1.jpg', order: 0 }],
        descriptionHtml: '',
        shippingFeeKrw: 0,
      },
      {
        market: 'gmarket',
        categoryId: '200001234',
        transformedImageUrls: ['https://cdn.example.com/1.jpg'],
        extra: {},
      },
    )
    const result = await gmarketDebugAdapter.createProduct(payload)
    expect(() => CreateProductResultSchema.parse(result)).not.toThrow()
    expect(result.market).toBe('gmarket')
  })

  it('§4-e: real authenticate 입력 kind 불일치 시 validation 에러 (mock 과 동일 시그니처)', async () => {
    const wrongKind: AuthInput = {
      kind: 'oauth_code',
      code: 'irrelevant',
    }
    await expect(gmarketRealAdapter.authenticate(wrongKind)).rejects.toThrow()
    await expect(gmarketDebugAdapter.authenticate(wrongKind)).rejects.toThrow()
  })

  it.todo('§5: real 어댑터 captured 응답 fixture ↔ mock 응답 schema 격차 (sandbox 접근 후)')
})
