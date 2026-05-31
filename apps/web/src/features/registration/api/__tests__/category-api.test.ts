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
const rpcMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    functions: { invoke: invokeMock },
    rpc: rpcMock,
  }),
}))

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import {
  fetchMarketCategoryChildren,
  fetchCategorySearch,
  fetchRecentCategories,
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
  rpcMock.mockReset()
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

describe('fetchCategorySearch', () => {
  it('pass: POST body 규약 + 200 ready hits parse', async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        status: 'ready',
        hits: [
          {
            code: '300',
            name: '티셔츠',
            pathText: '패션 > 여성 > 티셔츠',
            pathLabels: ['패션', '여성', '티셔츠'],
          },
        ],
      },
      error: null,
    })
    const res = await fetchCategorySearch('coupang', ACCOUNT_ID, '티셔츠')
    expect(invokeMock).toHaveBeenCalledWith('markets-category-search', {
      body: { marketId: 'coupang', marketAccountId: ACCOUNT_ID, query: '티셔츠' },
    })
    expect(res.status).toBe('ready')
    expect(res.hits[0]?.code).toBe('300')
    expect(res.hits[0]?.pathText).toBe('패션 > 여성 > 티셔츠')
  })

  it('pass: building 상태 → hits []', async () => {
    invokeMock.mockResolvedValueOnce({
      data: { status: 'building', hits: [] },
      error: null,
    })
    const res = await fetchCategorySearch('gmarket', ACCOUNT_ID, '의류')
    expect(res.status).toBe('building')
    expect(res.hits).toEqual([])
  })

  it('fail: Edge err(code 보존) → CategoryFetchError', async () => {
    invokeMock.mockResolvedValueOnce({
      data: { error: { code: 'forbidden', message: '본인 계정이 아닙니다' } },
      error: { message: 'edge non-2xx', context: undefined },
    })
    await expect(
      fetchCategorySearch('coupang', ACCOUNT_ID, '티셔츠'),
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('fail: 잘못된 status enum → parse throw', async () => {
    invokeMock.mockResolvedValueOnce({
      data: { status: 'weird', hits: [] },
      error: null,
    })
    await expect(
      fetchCategorySearch('coupang', ACCOUNT_ID, '티셔츠'),
    ).rejects.toBeInstanceOf(Error)
  })
})

describe('fetchRecentCategories', () => {
  it('pass: rpc 배열 → CategoryHit[] parse', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          code: '300',
          name: '티셔츠',
          pathText: '패션 > 여성 > 티셔츠',
          pathLabels: ['패션', '여성', '티셔츠'],
        },
      ],
      error: null,
    })
    const hits = await fetchRecentCategories('coupang')
    expect(rpcMock).toHaveBeenCalledWith('get_recent_categories', {
      p_market_id: 'coupang',
    })
    expect(hits).toHaveLength(1)
    expect(hits[0]?.code).toBe('300')
  })

  it('pass: data null → []', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })
    const hits = await fetchRecentCategories('11st')
    expect(hits).toEqual([])
  })

  it('fail: rpc error → CategoryFetchError', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'rpc failed' },
    })
    await expect(fetchRecentCategories('coupang')).rejects.toBeInstanceOf(
      CategoryFetchError,
    )
  })
})
