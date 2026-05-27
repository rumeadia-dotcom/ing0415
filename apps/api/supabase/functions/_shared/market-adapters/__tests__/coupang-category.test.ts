import { describe, expect, it, vi } from 'vitest'
import { MarketError } from '../../errors'
import {
  buildDisplayCategoryPath,
  buildCategoryTree,
  coupangHttpStatusToMarketError,
  COUPANG_DISPLAY_CATEGORY_BASE_PATH,
  ROOT_DISPLAY_CATEGORY_CODE,
  type RawCoupangCategory,
} from '../coupang-category'

/**
 * 쿠팡 카테고리 순수 로직 회귀 가드.
 *
 * 운영 사고 (2026-05-27, correlationId 58f3ca64): markets-connect 의 category_ping 이
 * `category ping failed (unknown)` 로 실패. 근본 원인 = 카테고리 API 경로가
 * `categorization/display-categories` (존재 X) 로 쓰여 쿠팡이 404 → fallback 'unknown'.
 * 공식 스펙: `/v2/providers/seller_api/apis/api/v1/marketplace/meta/display-categories/{code}`,
 * 루트(depth-1)는 displayCategoryCode `0`.
 *
 * 부수 결함: 5xx 가 MarketError code 자리에 메시지 문자열을 넣어(`as never`)
 * 'server' 로 분류되지 않고 재시도도 안 됨.
 */
describe('쿠팡 카테고리 경로 / 루트 코드', () => {
  it('베이스 경로는 marketplace/meta 세그먼트를 쓴다 (categorization 아님)', () => {
    expect(COUPANG_DISPLAY_CATEGORY_BASE_PATH).toBe(
      '/v2/providers/seller_api/apis/api/v1/marketplace/meta/display-categories',
    )
    expect(COUPANG_DISPLAY_CATEGORY_BASE_PATH).not.toContain('categorization')
  })

  it('루트(depth-1) displayCategoryCode 는 0 이다', () => {
    expect(ROOT_DISPLAY_CATEGORY_CODE).toBe(0)
  })

  it('buildDisplayCategoryPath(0) 은 루트 카테고리 전체 경로를 만든다', () => {
    expect(buildDisplayCategoryPath(0)).toBe(
      '/v2/providers/seller_api/apis/api/v1/marketplace/meta/display-categories/0',
    )
  })

  it('buildDisplayCategoryPath 는 임의 코드를 경로에 붙인다', () => {
    expect(buildDisplayCategoryPath(1001)).toBe(
      '/v2/providers/seller_api/apis/api/v1/marketplace/meta/display-categories/1001',
    )
  })
})

describe('coupangHttpStatusToMarketError', () => {
  it('5xx 는 code=server 로 분류되고 재시도 가능하다', () => {
    const e = coupangHttpStatusToMarketError(503, 'svc down', 'cid-1')
    expect(e).toBeInstanceOf(MarketError)
    expect(e.code).toBe('server')
    expect(e.retryable).toBe(true)
  })

  it('401/403 → unauthorized', () => {
    expect(coupangHttpStatusToMarketError(401, '', 'c').code).toBe('unauthorized')
    expect(coupangHttpStatusToMarketError(403, '', 'c').code).toBe('unauthorized')
  })

  it('400/422 → validation', () => {
    expect(coupangHttpStatusToMarketError(400, '', 'c').code).toBe('validation')
    expect(coupangHttpStatusToMarketError(422, '', 'c').code).toBe('validation')
  })

  it('429 → rate_limit', () => {
    expect(coupangHttpStatusToMarketError(429, '', 'c').code).toBe('rate_limit')
  })

  it('그 외(404 등) → unknown', () => {
    expect(coupangHttpStatusToMarketError(404, '', 'c').code).toBe('unknown')
  })
})

describe('buildCategoryTree — 핑 깊이 제한 (게이트웨이 폭주 방지)', () => {
  const makeRaw = (
    id: number,
    leaf: boolean,
    subs: number[] = [],
  ): RawCoupangCategory => ({
    categoryId: id,
    displayCategoryName: `cat-${id}`,
    isLeafCategory: leaf,
    subCategories: subs.map((s) => ({
      categoryId: s,
      displayCategoryName: `cat-${s}`,
      isLeafCategory: false,
    })),
  })

  it('maxDepth=1 이면 루트 1회만 조회하고 자식은 재귀하지 않는다', async () => {
    const fetchRaw = vi.fn(async (code: number) =>
      code === 0 ? makeRaw(0, false, [10, 20, 30]) : makeRaw(code, true),
    )

    const root = await buildCategoryTree(fetchRaw, 0, 1, 1, null)

    expect(fetchRaw).toHaveBeenCalledTimes(1)
    expect(fetchRaw).toHaveBeenCalledWith(0)
    expect(root.id).toBe('0')
    expect(root.leaf).toBe(true) // depth>=maxDepth 이므로 leaf 처리
    expect(root.children).toEqual([])
  })

  it('maxDepth=2 이면 루트 + 직속 자식까지만 조회한다', async () => {
    const fetchRaw = vi.fn(async (code: number) =>
      code === 0 ? makeRaw(0, false, [10, 20]) : makeRaw(code, false, [99]),
    )

    const root = await buildCategoryTree(fetchRaw, 0, 1, 2, null)

    // 루트 + 자식 2개 = 3회. 손자(99)는 미조회.
    expect(fetchRaw).toHaveBeenCalledTimes(3)
    expect(root.children).toHaveLength(2)
    expect(root.children.every((c) => c.leaf)).toBe(true)
  })

  it('isLeafCategory=true 면 maxDepth 전이라도 재귀 종료', async () => {
    const fetchRaw = vi.fn(async () => makeRaw(0, true))
    const root = await buildCategoryTree(fetchRaw, 0, 1, 3, null)
    expect(fetchRaw).toHaveBeenCalledTimes(1)
    expect(root.leaf).toBe(true)
  })
})
