/**
 * 네이버 어댑터 debug ↔ real parity.
 * 마스터: docs/architecture/v1/testing.md §12 / qa-matrix.md QA-FAIL-301.
 *
 * v1 시점 scope (sandbox 마켓 API 접근 외부 차단):
 *   - Static / Interface / transformProduct 외피 정합 — 활성.
 *   - 캡처된 real 응답 fixture (captured-real-*.json) ↔ mock 응답 schema 격차 — it.todo.
 *
 * 네이버는 5마켓 중 유일하게 OAuth (refreshToken 메서드 보유). 본 spec 가 그 비대칭을
 * 다른 4개 spec 와 분리해 단정한다 (R-006 헌법).
 */

import { describe, expect, it } from 'vitest'
import {
  CategoryNodeSchema,
  CreateProductResultSchema,
  StoredCredentialSchema,
  type AuthInput,
} from '@/lib/schemas'
import { naverDebugAdapter } from '@/lib/markets/debug/NaverDebugAdapter'
import { naverRealAdapter } from '@/lib/markets/real/naver'
import { assertStructuralParity } from '../_shared/parity'

describe('naver adapter parity (debug ↔ real)', () => {
  it('§1~§3: static / interface / transformProduct 외피 정합', () => {
    assertStructuralParity({
      mock: naverDebugAdapter,
      real: naverRealAdapter,
      expectedMarket: 'naver',
      expectedKind: 'oauth',
      hasRefreshToken: true,
    })
  })

  it('§4-a: mock authenticate(oauth_code) → StoredCredential schema 통과', async () => {
    const input: AuthInput = {
      kind: 'oauth_code',
      code: 'mock_auth_code_xxxxxxxxxxxxxx',
    }
    const cred = await naverDebugAdapter.authenticate(input)
    expect(() => StoredCredentialSchema.parse(cred)).not.toThrow()
    expect(cred.kind).toBe('oauth')
  })

  it('§4-b: mock fetchCategoryTree → CategoryNode[] schema 통과', async () => {
    const tree = await naverDebugAdapter.fetchCategoryTree()
    expect(tree.length).toBeGreaterThan(0)
    for (const node of tree) {
      expect(() => CategoryNodeSchema.parse(node)).not.toThrow()
    }
  })

  it('§4-c: mock createProduct happy → CreateProductResult schema 통과 + status=succeeded', async () => {
    const product = naverDebugAdapter.transformProduct(
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
        market: 'naver',
        categoryId: 'C-100-10',
        transformedImageUrls: ['https://cdn.example.com/1.jpg'],
        extra: {},
      },
    )
    const result = await naverDebugAdapter.createProduct(product)
    expect(() => CreateProductResultSchema.parse(result)).not.toThrow()
    expect(result.status).toBe('succeeded')
    expect(result.market).toBe('naver')
  })

  it('§4-d: real adapter authenticate(oauth_code) 는 클라이언트 직접 호출 차단 (markets-oauth-callback Edge Function 위임)', async () => {
    const input: AuthInput = {
      kind: 'oauth_code',
      code: 'irrelevant',
    }
    // 네이버 real 어댑터는 OAuth code exchange 를 의도적으로 차단한다 (markets/real/naver/index.ts 주석).
    await expect(naverRealAdapter.authenticate(input)).rejects.toThrow()
  })

  // §5 — captured-real-*.json fixture ↔ mock 응답 schema 격차 비교.
  // sandbox 마켓 API 접근 확보 (Phase 4-B-1) 후 활성.
  it.todo('§5: real 어댑터 captured 응답 fixture ↔ mock 응답 schema 격차 (sandbox 접근 후)')
})
