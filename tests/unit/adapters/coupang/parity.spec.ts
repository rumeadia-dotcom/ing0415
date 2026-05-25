/**
 * 쿠팡 어댑터 debug ↔ real parity.
 * 마스터: docs/architecture/v1/testing.md §12 / qa-matrix.md QA-FAIL-301.
 *
 * 쿠팡 = HMAC 자격증명. refreshToken 없음. real authenticate(hmac_key) 는 즉시
 * 검증/저장 (네트워크 호출 없음 — 첫 API 호출 시 HMAC 서명 검증).
 */

import { describe, expect, it } from 'vitest'
import {
  CreateProductResultSchema,
  StoredCredentialSchema,
  type AuthInput,
} from '@/lib/schemas'
import { coupangDebugAdapter } from '@/lib/markets/debug/CoupangDebugAdapter'
import { coupangRealAdapter } from '@/lib/markets/real/coupang'
import { assertStructuralParity } from '../_shared/parity'

const SAMPLE_HMAC_INPUT: AuthInput = {
  kind: 'hmac_key',
  accessKey: 'TESTACCESSKEY' + 'X'.repeat(16),
  secretKey: 'TESTSECRETKEY' + 'Y'.repeat(48),
  vendorId: 'A00012345',
}

describe('coupang adapter parity (debug ↔ real)', () => {
  it('§1~§3: static / interface / transformProduct 외피 정합', () => {
    assertStructuralParity({
      mock: coupangDebugAdapter,
      real: coupangRealAdapter,
      expectedMarket: 'coupang',
      expectedKind: 'hmac',
      hasRefreshToken: false,
    })
  })

  it('§4-a: mock authenticate(hmac_key) → StoredCredential schema 통과', async () => {
    const cred = await coupangDebugAdapter.authenticate(SAMPLE_HMAC_INPUT)
    expect(() => StoredCredentialSchema.parse(cred)).not.toThrow()
    expect(cred.kind).toBe('hmac')
  })

  it('§4-b: real authenticate(hmac_key) → StoredCredential schema 통과 (네트워크 호출 없음)', async () => {
    const cred = await coupangRealAdapter.authenticate(SAMPLE_HMAC_INPUT)
    expect(() => StoredCredentialSchema.parse(cred)).not.toThrow()
    expect(cred.kind).toBe('hmac')
  })

  it('§4-c: 두 어댑터의 authenticate 결과 kind 정합', async () => {
    const mockCred = await coupangDebugAdapter.authenticate(SAMPLE_HMAC_INPUT)
    const realCred = await coupangRealAdapter.authenticate(SAMPLE_HMAC_INPUT)
    expect(mockCred.kind).toBe(realCred.kind)
    expect(mockCred.kind).toBe('hmac')
  })

  it('§4-d: mock createProduct happy → CreateProductResult schema 통과 + market=coupang', async () => {
    const payload = coupangDebugAdapter.transformProduct(
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
        market: 'coupang',
        categoryId: '12345',
        transformedImageUrls: ['https://cdn.example.com/1.jpg'],
        extra: {},
      },
    )
    const result = await coupangDebugAdapter.createProduct(payload)
    expect(() => CreateProductResultSchema.parse(result)).not.toThrow()
    expect(result.market).toBe('coupang')
  })

  it('§4-e: real authenticate 입력 kind 불일치 시 validation 에러 (mock 과 동일 시그니처)', async () => {
    const wrongKind: AuthInput = {
      kind: 'oauth_code',
      code: 'irrelevant',
    }
    await expect(coupangRealAdapter.authenticate(wrongKind)).rejects.toThrow()
    await expect(coupangDebugAdapter.authenticate(wrongKind)).rejects.toThrow()
  })

  it.todo('§5: real 어댑터 captured 응답 fixture ↔ mock 응답 schema 격차 (sandbox 접근 후)')
})
