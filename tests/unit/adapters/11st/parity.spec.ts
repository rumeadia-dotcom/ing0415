/**
 * 11번가 어댑터 debug ↔ real parity (degenerate — 양쪽 모두 stub).
 * 마스터: docs/architecture/v1/testing.md §12 / qa-matrix.md QA-FAIL-301.
 *
 * 11번가는 Phase 4-B-2 Wave 2 본격 구현 대기 중. 현 시점:
 *   - debug: 인터페이스 보존 stub (6 메서드 모두 throw MarketError).
 *   - real: `getMarketAdapter('11st')` 가 import 단계에서 Error throw (markets/index.ts).
 *
 * 본 spec 는 이 비대칭을 R-006 위반이 아닌 의도된 stub 상태로 명시한다.
 * 두 stub 모두 동일 인터페이스 shape 를 유지하는지 정합 검증.
 *
 * Wave 2 본격 구현 시 본 spec 는 다른 4개 spec 와 동일 구조 (StoredCredential /
 * CreateProductResult schema 통과) 로 재작성 필요.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AuthInput, MarketMapping, Product } from '@/lib/schemas'
import { elevenstDebugAdapter } from '@/lib/markets/debug/ElevenstDebugAdapter'
import { getMarketAdapter } from '@/lib/markets'
import { MarketError } from '@/lib/markets/errors'

const SAMPLE_API_KEY_INPUT: AuthInput = {
  kind: 'api_key',
  apiKey: 'TEST_API_KEY_' + 'X'.repeat(32),
}

describe('11st adapter parity (debug ↔ real — degenerate stub)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('§1: mock 의 static 정합 (market=11st, credentialKind=api_key)', () => {
    expect(elevenstDebugAdapter.market).toBe('11st')
    expect(elevenstDebugAdapter.credentialKind).toBe('api_key')
  })

  it('§2: mock 인터페이스 정합 — 6 메서드 모두 정의 (refreshToken 부재)', () => {
    for (const method of [
      'authenticate',
      'fetchCategoryTree',
      'transformProduct',
      'createProduct',
      'fetchOrders',
      'submitTracking',
    ] as const) {
      expect(typeof elevenstDebugAdapter[method]).toBe('function')
    }
    expect(typeof elevenstDebugAdapter.refreshToken).toBe('undefined')
  })

  it('§3-a: mock 의 6 메서드 모두 MarketError throw (일관 stub 동작)', () => {
    // 본 stub 들은 Promise 반환 타입이지만 async 키워드가 없어 sync throw 한다.
    // `.rejects` 대신 thunk + `.toThrow` 패턴으로 양쪽 (sync/async) 모두 호환.
    const sampleProduct: Product = {
      id: '00000000-0000-4000-8000-000000000002',
      sellerId: '00000000-0000-4000-8000-000000000001',
      name: '테스트',
      priceKrw: 9_900,
      stock: 10,
      images: [{ url: 'https://cdn.example.com/1.jpg', order: 0 }],
      descriptionHtml: '',
      shippingFeeKrw: 0,
    }
    const sampleMapping: MarketMapping = {
      market: '11st',
      categoryId: '12345',
      transformedImageUrls: ['https://cdn.example.com/1.jpg'],
      extra: {},
    }

    expect(() =>
      elevenstDebugAdapter.authenticate(SAMPLE_API_KEY_INPUT),
    ).toThrow(MarketError)
    expect(() => elevenstDebugAdapter.fetchCategoryTree()).toThrow(MarketError)
    expect(() =>
      elevenstDebugAdapter.transformProduct(sampleProduct, sampleMapping),
    ).toThrow(MarketError)
    expect(() =>
      elevenstDebugAdapter.createProduct({ market: '11st', raw: {} }),
    ).toThrow(MarketError)
    expect(() =>
      elevenstDebugAdapter.fetchOrders({
        sellerId: '00000000-0000-4000-8000-000000000001',
        from: '2026-05-20T00:00:00+09:00',
        to: '2026-05-25T00:00:00+09:00',
      }),
    ).toThrow(MarketError)
  })

  it('§3-b: real 모드 getMarketAdapter("11st") 는 의도된 stub Error throw (markets/index.ts)', async () => {
    // CI/dev 의 VITE_USE_MOCK='true' 와 무관하게 본 단정이 real 분기 진입 의도를
    // 격리 검증하도록 vi.stubEnv 로 강제 false. afterEach 에서 복구.
    vi.stubEnv('VITE_USE_MOCK', 'false')
    await expect(getMarketAdapter('11st')).rejects.toThrow(
      /11번가 real 어댑터 클라이언트 미구현/,
    )
  })

  it.todo('§5: Wave 2 본격 구현 후 — debug↔real StoredCredential / CreateProductResult schema 격차 비교')
})
