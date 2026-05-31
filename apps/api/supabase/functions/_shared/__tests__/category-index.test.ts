import { describe, expect, it } from 'vitest'
import { flattenCategoryTree, type CategoryIndexRow } from '../category-index'
import type { CategoryNode } from '../schemas'

// 테스트용 최소 CategoryNode 생성 헬퍼.
function n(over: Partial<CategoryNode> & { id: string; name: string }): CategoryNode {
  return { depth: 1, leaf: false, parentId: null, children: [], ...over }
}

describe('flattenCategoryTree', () => {
  it('중첩 트리를 path_text/path_labels 누적과 함께 평탄화', () => {
    const tree: CategoryNode[] = [
      n({
        id: 'A',
        name: '패션',
        leaf: false,
        children: [
          n({
            id: 'B',
            name: '여성',
            parentId: 'A',
            depth: 2,
            leaf: false,
            children: [n({ id: 'C', name: '티셔츠', parentId: 'B', depth: 3, leaf: true })],
          }),
        ],
      }),
    ]
    const rows = flattenCategoryTree('coupang', tree)
    expect(rows).toHaveLength(3)
    expect(rows.find((r) => r.code === 'C')).toEqual<CategoryIndexRow>({
      market_id: 'coupang',
      code: 'C',
      name: '티셔츠',
      parent_code: 'B',
      depth: 3,
      leaf: true,
      path_text: '패션 > 여성 > 티셔츠',
      path_labels: ['패션', '여성', '티셔츠'],
    })
    expect(rows.find((r) => r.code === 'A')!.path_text).toBe('패션')
  })

  it('빈 트리 → 빈 배열', () => {
    expect(flattenCategoryTree('11st', [])).toEqual([])
  })
})
