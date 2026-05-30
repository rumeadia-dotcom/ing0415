/**
 * 11번가 어댑터 debug ↔ real parity.
 * 마스터: docs/architecture/v1/testing.md §12 / qa-matrix.md QA-FAIL-301.
 *
 * 11번가 = API Key (영구). refreshToken 없음. v1 정식 구현 완료 후:
 *   - mock: createMockAdapter('11st') — 다른 4마켓과 동일 분기.
 *   - real: 본격 구현 (11번가 Open API, XML/EUC-KR, 게이트웨이 경유). authenticate /
 *     fetchCategoryTree / transformProduct / createProduct / fetchOrders / submitTracking
 *     모두 동작. transformProduct 는 순수(네트워크 없음), 나머지는 cred 가드 + fetch.
 *
 * 본 spec 는 §1 static / §2 interface / §3 transformProduct 외피 정합 / §4 authenticate·
 * createProduct 에러 분류 계약을 검증한다 (mock = real). 실 HTTP 응답 fixture 격차(§5)는
 * 셀러 발급 키 통합 검증에서 (개발자포털 IP 화이트리스트).
 */

import { describe, expect, it } from 'vitest'
import {
  CategoryNodeSchema,
  CreateProductResultSchema,
  MarketPayloadSchema,
  StoredCredentialSchema,
  type AuthInput,
  type CategoryNode,
  type MarketMapping,
  type Product,
} from '@/lib/schemas'
import { elevenstDebugAdapter } from '@/lib/markets/debug/ElevenstDebugAdapter'
import { elevenstRealAdapter } from '@/lib/markets/real/11st'
import { mapElevenStCategories } from '@/lib/markets/real/11st/map'
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

  it('§3-real: real transformProduct → { market, raw } / MarketPayloadSchema 통과 (mock 과 동일 외피)', () => {
    const payload = elevenstRealAdapter.transformProduct(SAMPLE_PRODUCT, SAMPLE_MAPPING)
    expect(() => MarketPayloadSchema.parse(payload)).not.toThrow()
    expect(payload.market).toBe('11st')
    expect(payload.raw).toBeTypeOf('object')
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

  it('§4-e: real createProduct — 네트워크 실패 시 MarketError 분류 (에러 계약, fetch stub)', async () => {
    await elevenstRealAdapter.authenticate(SAMPLE_API_KEY_INPUT)
    const origFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      throw new Error('network down (test stub)')
    }) as typeof fetch
    try {
      const payload = elevenstRealAdapter.transformProduct(SAMPLE_PRODUCT, SAMPLE_MAPPING)
      await expect(elevenstRealAdapter.createProduct(payload)).rejects.toBeInstanceOf(
        MarketError,
      )
    } finally {
      globalThis.fetch = origFetch
    }
  })

  it('§4-f: real authenticate 입력 kind 불일치 시 validation 에러 (mock 과 동일 시그니처)', async () => {
    const wrongKind: AuthInput = {
      kind: 'oauth_code',
      code: 'irrelevant',
    }
    await expect(elevenstRealAdapter.authenticate(wrongKind)).rejects.toThrow()
    await expect(elevenstDebugAdapter.authenticate(wrongKind)).rejects.toThrow()
  })

  // ─────────────────────────────────────────────
  // §6: 카테고리 parity (PR-1) — mock fetchCategoryTree 가 real 파서
  // (mapElevenStCategories)로 만든 트리와 동형(CategoryNodeSchema 통과 + 트리 구조).
  // real fetchCategoryTree 는 네트워크(cateservice GET)라 단위 비교 대신 파서 동형성으로 검증.
  // ─────────────────────────────────────────────
  it('§6-a: mock fetchCategoryTree → CategoryNodeSchema 재귀 통과 + 트리(자식 보유)', async () => {
    const tree = await elevenstDebugAdapter.fetchCategoryTree()
    expect(tree.length).toBeGreaterThan(0)
    for (const node of tree) {
      expect(() => CategoryNodeSchema.parse(node)).not.toThrow()
    }
    // 최소 1개 루트가 자식을 가진 트리 (평탄 아님 — PR-1 정정 검증).
    const hasNested = tree.some((n) => n.children.length > 0)
    expect(hasNested).toBe(true)
  })

  it('§6-b: mock 카테고리 = real 파서(mapElevenStCategories) ns2 응답 트리와 동형', async () => {
    const mockTree = await elevenstDebugAdapter.fetchCategoryTree()
    const realParsed: CategoryNode[] = mapElevenStCategories({
      'ns2:categorys': {
        'ns2:category': [
          { dispNo: '1001', dispNm: '패션의류', depth: '1', parentDispNo: '0', leafYn: 'Y' },
          { dispNo: '1002', dispNm: '여성의류', depth: '2', parentDispNo: '1001', leafYn: 'Y' },
          { dispNo: '1003', dispNm: '블라우스/셔츠', depth: '3', parentDispNo: '1002', leafYn: 'N' },
        ],
      },
    })
    // mock 은 real 파서를 그대로 통과시키므로 동일 구조여야 한다 (id/parentId/leaf).
    expect(mockTree).toEqual(realParsed)
  })

  // §5 — 셀러 발급 키로 캡처한 실 11번가 XML 응답 fixture ↔ mock 응답 schema 격차 비교.
  // 실 키 + Lightsail Gateway 통합 검증 단계에서 fixture 확보 후 활성.
  it.todo('§5: captured 실 11번가 XML 응답 fixture ↔ mock 응답 schema 격차')
})
