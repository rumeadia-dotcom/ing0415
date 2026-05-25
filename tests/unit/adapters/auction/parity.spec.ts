/**
 * 옥션 ESM JWT 어댑터 debug ↔ real parity.
 * 마스터: docs/architecture/v1/testing.md §12 / qa-matrix.md QA-FAIL-301.
 *
 * 옥션은 G마켓과 동일 ESM 플랫폼 — `createEsmRealAdapter({ site: 'A' })` 인스턴스.
 * 본 spec 는 site='A' 인스턴스 (auction) 의 parity 만 단정.
 */

import { describe, expect, it } from 'vitest'
import {
  CreateProductResultSchema,
  StoredCredentialSchema,
  type AuthInput,
} from '@/lib/schemas'
import { auctionDebugAdapter } from '@/lib/markets/debug/AuctionDebugAdapter'
import { auctionRealAdapter } from '@/lib/markets/real/auction'
import { assertStructuralParity } from '../_shared/parity'

const SAMPLE_ESM_INPUT: AuthInput = {
  kind: 'esm_jwt',
  masterId: 'master_auction_test',
  secretKey: 'SECRET' + 'Z'.repeat(48),
  sellerId: 'auction_seller_001',
  site: 'A',
}

describe('auction adapter parity (debug ↔ real)', () => {
  it('§1~§3: static / interface / transformProduct 외피 정합', () => {
    assertStructuralParity({
      mock: auctionDebugAdapter,
      real: auctionRealAdapter,
      expectedMarket: 'auction',
      expectedKind: 'esm_jwt',
      hasRefreshToken: false,
    })
  })

  it('§4-a: mock authenticate(esm_jwt) → StoredCredential schema 통과', async () => {
    const cred = await auctionDebugAdapter.authenticate(SAMPLE_ESM_INPUT)
    expect(() => StoredCredentialSchema.parse(cred)).not.toThrow()
    expect(cred.kind).toBe('esm_jwt')
  })

  it('§4-b: real authenticate(esm_jwt) → StoredCredential schema 통과 (네트워크 호출 없음)', async () => {
    const cred = await auctionRealAdapter.authenticate(SAMPLE_ESM_INPUT)
    expect(() => StoredCredentialSchema.parse(cred)).not.toThrow()
    expect(cred.kind).toBe('esm_jwt')
  })

  it('§4-c: 두 어댑터의 authenticate 결과 kind 정합', async () => {
    const mockCred = await auctionDebugAdapter.authenticate(SAMPLE_ESM_INPUT)
    const realCred = await auctionRealAdapter.authenticate(SAMPLE_ESM_INPUT)
    expect(mockCred.kind).toBe(realCred.kind)
    expect(mockCred.kind).toBe('esm_jwt')
  })

  it('§4-d: mock createProduct happy → CreateProductResult schema 통과 + market=auction', async () => {
    const payload = auctionDebugAdapter.transformProduct(
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
        market: 'auction',
        categoryId: '300005678',
        transformedImageUrls: ['https://cdn.example.com/1.jpg'],
        extra: {},
      },
    )
    const result = await auctionDebugAdapter.createProduct(payload)
    expect(() => CreateProductResultSchema.parse(result)).not.toThrow()
    expect(result.market).toBe('auction')
  })

  it('§4-e: real authenticate 입력 kind 불일치 시 validation 에러 (mock 과 동일 시그니처)', async () => {
    const wrongKind: AuthInput = {
      kind: 'hmac_key',
      accessKey: 'k',
      secretKey: 's',
      vendorId: 'v',
    }
    await expect(auctionRealAdapter.authenticate(wrongKind)).rejects.toThrow()
    await expect(auctionDebugAdapter.authenticate(wrongKind)).rejects.toThrow()
  })

  it.todo('§5: real 어댑터 captured 응답 fixture ↔ mock 응답 schema 격차 (sandbox 접근 후)')
})
