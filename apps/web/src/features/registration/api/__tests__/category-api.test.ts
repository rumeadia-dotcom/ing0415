/**
 * category-api (fetchMarketCategoryChildren) 단위 테스트.
 * 마스터: docs/architecture/v1/features/category-sync.md §6.1 / §8
 *
 * 커버리지:
 *  - POST { marketId, marketAccountId, parentId } body 로 markets-category-children 호출 (규약)
 *  - 200 { nodes } 응답 → CategoryChildrenResponseSchema parse (pass)
 *  - Edge err 본문(code/message) → CategoryFetchError(code 보존) (fail)
 *  - FunctionsHttpError(error.context Response) 본문 파싱 (fail)
 *  - category_not_supported(네이버) → CategoryFetchError.code 보존 (fail → UI 분기)
 *  - 응답 스키마 위반 → parse throw (fail)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const invokeMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    functions: { invoke: invokeMock },
  }),
}))

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import {
  fetchMarketCategoryChildren,
  CategoryFetchError,
} from '../category-api'

const ACCOUNT_ID = '00000000-0000-4000-8000-000000001003'

function nodesResponse() {
  return {
    nodes: [
      {
        id: '1001',
        name: '패션의류',
        depth: 1,
        leaf: false,
        parentId: null,
        children: [],
      },
      {
        id: '1002',
        name: '도서',
        depth: 1,
        leaf: true,
        parentId: null,
        children: [],
      },
    ],
  }
}

beforeEach(() => {
  invokeMock.mockReset()
})

describe('fetchMarketCategoryChildren', () => {
  it('pass: POST body 규약 + 200 nodes parse', async () => {
    invokeMock.mockResolvedValueOnce({ data: nodesResponse(), error: null })
    const nodes = await fetchMarketCategoryChildren('coupang', ACCOUNT_ID, null)
    expect(invokeMock).toHaveBeenCalledWith('markets-category-children', {
      body: { marketId: 'coupang', marketAccountId: ACCOUNT_ID, parentId: null },
    })
    expect(nodes).toHaveLength(2)
    expect(nodes[0]?.leaf).toBe(false)
    expect(nodes[1]?.leaf).toBe(true)
  })

  it('pass: parentId 지정 시 그대로 body 전달', async () => {
    invokeMock.mockResolvedValueOnce({ data: { nodes: [] }, error: null })
    await fetchMarketCategoryChildren('gmarket', ACCOUNT_ID, '1001')
    expect(invokeMock).toHaveBeenCalledWith('markets-category-children', {
      body: { marketId: 'gmarket', marketAccountId: ACCOUNT_ID, parentId: '1001' },
    })
  })

  it('fail: Edge err 본문(code/message) → CategoryFetchError(code 보존)', async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        error: {
          code: 'forbidden',
          message: '본인 계정이 아닙니다',
          correlationId: 'cid-1',
        },
      },
      error: { message: 'edge non-2xx', context: undefined },
    })
    await expect(
      fetchMarketCategoryChildren('coupang', ACCOUNT_ID, null),
    ).rejects.toMatchObject({ code: 'forbidden', correlationId: 'cid-1' })
  })

  it('fail: FunctionsHttpError(error.context Response) 본문에서 code 복원', async () => {
    const ctx = {
      clone: () => ({
        json: async () => ({
          error: { code: 'forbidden', message: 'not your account' },
        }),
      }),
      json: async () => ({}),
    }
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'http error', context: ctx },
    })
    await expect(
      fetchMarketCategoryChildren('coupang', ACCOUNT_ID, null),
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('fail: category_not_supported(네이버) → code 보존(UI fallback 분기용)', async () => {
    const ctx = {
      clone: () => ({
        json: async () => ({
          error: {
            code: 'category_not_supported',
            message: '네이버 카테고리 조회 미지원',
          },
        }),
      }),
      json: async () => ({}),
    }
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'bad request', context: ctx },
    })
    await expect(
      fetchMarketCategoryChildren('naver', ACCOUNT_ID, null),
    ).rejects.toMatchObject({ code: 'category_not_supported' })
  })

  it('fail: 응답 스키마 위반 → parse throw', async () => {
    invokeMock.mockResolvedValueOnce({
      data: { nodes: [{ id: '', name: 'x', depth: 1, leaf: true, parentId: null, children: [] }] },
      error: null,
    })
    await expect(
      fetchMarketCategoryChildren('coupang', ACCOUNT_ID, null),
    ).rejects.toBeInstanceOf(Error)
  })

  it('CategoryFetchError 인스턴스 — code/correlationId 보존', () => {
    const e = new CategoryFetchError({
      code: 'internal',
      message: 'x',
      correlationId: 'c',
    })
    expect(e).toBeInstanceOf(CategoryFetchError)
    expect(e.code).toBe('internal')
    expect(e.correlationId).toBe('c')
  })
})
