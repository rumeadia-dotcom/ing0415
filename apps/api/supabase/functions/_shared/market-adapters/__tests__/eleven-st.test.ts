import { describe, expect, it } from 'vitest'
import { MarketError } from '../../errors'
import {
  ELEVEN_ST_API_BASE,
  createElevenStAdapter,
} from '../eleven-st'

/**
 * 11번가 어댑터 stub 단위 테스트 (Phase 4-B-2 Wave 1).
 *
 * 회귀 가드:
 * - authenticate 만 동작, 다른 메서드는 명확한 MarketError throw
 * - kind 검증 — api_key 외 거부
 * - 본격 구현 시점에 본 테스트가 보호막 (stub → real 전환의 동등성 검증)
 *
 * 비범위:
 * - 실 11번가 API 호출 (정식 spec 확보 후 별도 PR).
 */
describe('createElevenStAdapter — stub', () => {
  it('market = 11st / credentialKind = api_key', () => {
    const adapter = createElevenStAdapter()
    expect(adapter.market).toBe('11st')
    expect(adapter.credentialKind).toBe('api_key')
  })

  it('authenticate(api_key) — StoredCredential 반환', async () => {
    const adapter = createElevenStAdapter()
    const result = await adapter.authenticate({
      kind: 'api_key',
      apiKey: 'test-11st-api-key',
    })
    expect(result.kind).toBe('api_key')
    expect(result.payload).toEqual({ apiKey: 'test-11st-api-key' })
    expect(result.expiresAt).toBeNull()
  })

  it('authenticate 의 input.kind 가 api_key 가 아니면 validation throw', async () => {
    const adapter = createElevenStAdapter()
    await expect(
      adapter.authenticate({ kind: 'oauth_code', code: 'wrong' }),
    ).rejects.toBeInstanceOf(MarketError)
    await expect(
      adapter.authenticate({ kind: 'oauth_code', code: 'wrong' }),
    ).rejects.toMatchObject({
      code: 'validation',
      context: { market: '11st' },
    })
  })

  it('fetchCategoryTree 는 stub throw (정식 spec 확보 후 구현 예정)', async () => {
    const adapter = createElevenStAdapter()
    // authenticate 한 후에도 fetchCategoryTree 는 throw — stub 의 의도된 동작
    await adapter.authenticate({ kind: 'api_key', apiKey: 'k' })
    await expect(adapter.fetchCategoryTree()).rejects.toBeInstanceOf(MarketError)
    await expect(adapter.fetchCategoryTree()).rejects.toMatchObject({
      code: 'unauthorized',
      context: {
        market: '11st',
        marketErrorCode: 'adapter_stub',
      },
    })
  })

  it('transformProduct 는 stub throw', () => {
    const adapter = createElevenStAdapter()
    expect(() =>
      adapter.transformProduct(
        // @ts-expect-error stub 호출이라 인자 구조 무관
        {},
        {},
      ),
    ).toThrow(MarketError)
  })

  it('createProduct 는 stub throw', async () => {
    const adapter = createElevenStAdapter()
    await expect(
      // @ts-expect-error stub 호출이라 인자 구조 무관
      adapter.createProduct({}),
    ).rejects.toBeInstanceOf(MarketError)
    await expect(
      // @ts-expect-error stub 호출이라 인자 구조 무관
      adapter.createProduct({}),
    ).rejects.toMatchObject({
      code: 'unauthorized',
      context: {
        market: '11st',
        marketErrorCode: 'adapter_stub',
      },
    })
  })

  it('refreshToken 인터페이스 — 영구 키라 undefined (인터페이스 optional 준수)', () => {
    const adapter = createElevenStAdapter()
    expect(adapter.refreshToken).toBeUndefined()
  })

  it('ELEVEN_ST_API_BASE 가 https://openapi.11st.co.kr/openapi/OpenApiService.tmall 로 export (게이트웨이 화이트리스트 정합)', () => {
    expect(ELEVEN_ST_API_BASE).toBe('https://openapi.11st.co.kr/openapi/OpenApiService.tmall')
  })
})
