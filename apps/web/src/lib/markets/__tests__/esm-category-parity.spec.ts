/**
 * ESM(G마켓·옥션) 카테고리 mock ↔ real CategoryNode 구조 parity (PR-2).
 *
 * 목적: site-cats 재작성(fetchCategoryTree) 후, mock 어댑터와 real 어댑터가
 *       동일한 site-cats raw 입력에 대해 **구조적으로 동일한 CategoryNode 트리**를
 *       생성하는지 검증한다. (testing.md §6.2 R-006 mock↔real 격차 방지)
 *
 * 검증 항목:
 *   - 양쪽 모두 CategoryNodeSchema 통과.
 *   - id / name / depth / leaf / parentId / children 중첩 구조 동형.
 *   - real 어댑터가 site-cats raw(catCode/catName/isLeaf/subCats)를 정규화해
 *     mock 과 동일한 공통 CategoryNode 로 변환.
 *
 * 마스터:
 *   - docs/architecture/v1/features/esm.md §4.3 / §7 PR-2
 *   - docs/architecture/v1/testing.md §6.2 R-006
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CategoryNodeSchema, type CategoryNode } from '@/lib/schemas'
import { createMockAdapter } from '../debug/createMockAdapter'

// site-cats 대분류 응답(esm-api/product/4.md) — mock 트리와 동형 구조:
//   root(비-leaf) → 하위 leaf 1개. 인라인 subCats 로 추가 조회 없이 완성.
const SITE_CATS_RESPONSE = [
  {
    catCode: '300004975',
    catName: '패션의류',
    isLeaf: false,
    subCats: [
      {
        catCode: '300004976',
        catName: '여성의류',
        isLeaf: true,
      },
    ],
  },
]

function makeFetchMock(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  })
}

const VALID_ESM_INPUT_G = {
  kind: 'esm_jwt' as const,
  masterId: 'master-gmarket-parity',
  secretKey: 'secret-gmarket-parity',
  sellerId: 'seller-gmarket-parity',
  site: 'G' as const,
}

/** CategoryNode 트리에서 좌표·플래그만 추출한 비교용 골격(구조 동형성 검증). */
interface CategoryShape {
  depth: number
  leaf: boolean
  hasParent: boolean
  childCount: number
  children: CategoryShape[]
}

function toShape(node: CategoryNode): CategoryShape {
  return {
    depth: node.depth,
    leaf: node.leaf,
    hasParent: node.parentId !== null,
    childCount: node.children.length,
    children: node.children.map(toShape),
  }
}

describe('ESM 카테고리 mock ↔ real parity (site-cats)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('crypto', {
      randomUUID: () => 'test-correlation-id',
      subtle: globalThis.crypto.subtle,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mock 트리는 CategoryNodeSchema 를 통과하고 root 비-leaf + leaf 자식 구조', async () => {
    const mock = createMockAdapter('gmarket')
    const tree = await mock.fetchCategoryTree()
    expect(tree.length).toBe(1)
    expect(() => tree.map((n) => CategoryNodeSchema.parse(n))).not.toThrow()
    expect(tree[0]?.leaf).toBe(false)
    expect(tree[0]?.children[0]?.leaf).toBe(true)
    expect(tree[0]?.children[0]?.parentId).toBe(tree[0]?.id)
  })

  it('real(gmarket) 이 site-cats raw 를 mock 과 동일한 CategoryNode 구조로 정규화', async () => {
    vi.stubGlobal('fetch', makeFetchMock(SITE_CATS_RESPONSE))
    const { gmarketRealAdapter } = await import('../real/gmarket')
    await gmarketRealAdapter.authenticate(VALID_ESM_INPUT_G)
    const realTree = await gmarketRealAdapter.fetchCategoryTree()

    const mock = createMockAdapter('gmarket')
    const mockTree = await mock.fetchCategoryTree()

    // 양쪽 모두 스키마 통과.
    expect(() => realTree.map((n) => CategoryNodeSchema.parse(n))).not.toThrow()
    expect(() => mockTree.map((n) => CategoryNodeSchema.parse(n))).not.toThrow()

    // 구조 동형 (depth/leaf/parent/children 중첩).
    expect(realTree.map(toShape)).toEqual(mockTree.map(toShape))

    // 값 정합 — site-cats raw 의 catCode/catName 이 그대로 매핑.
    expect(realTree[0]?.id).toBe('300004975')
    expect(realTree[0]?.name).toBe('패션의류')
    expect(realTree[0]?.children[0]?.id).toBe('300004976')
    expect(realTree[0]?.children[0]?.leaf).toBe(true)
    expect(realTree[0]?.children[0]?.parentId).toBe('300004975')
  })
})
