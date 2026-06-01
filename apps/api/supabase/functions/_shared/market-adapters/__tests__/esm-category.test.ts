import { describe, expect, it } from 'vitest'

import { extractSiteCatList, siteCatToCategoryNode } from '../esm-category'
import { flattenCategoryTree } from '../../category-index'
import type { EsmSiteCat } from '../../schemas'

// ESM(G마켓·옥션) 카테고리 순수 파서 회귀 — 인덱스 빌드(fetchCategoryTreeFull)는
// 기존 fetchCategoryTree(site-cats 재귀)에 위임하므로, 라이브 HTTP 없이 순수 변환만 가드.
// (라이브 빌드·검색은 dev ESM 계정 없음 → 운영 배포 후 검증. plan Task 13.)
describe('ESM 카테고리 순수 파서 (인덱스 빌드 회귀)', () => {
  it('siteCatToCategoryNode: 중첩 EsmSiteCat → CategoryNode (depth/parentId/leaf) + flatten path 누적', () => {
    const tree: EsmSiteCat = {
      siteCatCode: '100',
      siteCatName: '패션의류',
      isLeaf: false,
      children: [
        {
          siteCatCode: '200',
          siteCatName: '여성의류',
          isLeaf: false,
          children: [
            { siteCatCode: '300', siteCatName: '티셔츠', isLeaf: true, children: [] },
          ],
        },
      ],
    }
    const node = siteCatToCategoryNode(tree, 1, null)
    expect(node).toMatchObject({ id: '100', name: '패션의류', depth: 1, leaf: false, parentId: null })
    expect(node.children[0]?.children[0]).toMatchObject({
      id: '300',
      name: '티셔츠',
      depth: 3,
      leaf: true,
      parentId: '200',
    })

    const leafRow = flattenCategoryTree('gmarket', [node]).find((r) => r.code === '300')
    expect(leafRow?.leaf).toBe(true)
    expect(leafRow?.path_text).toBe('패션의류 > 여성의류 > 티셔츠')
    expect(leafRow?.path_labels).toEqual(['패션의류', '여성의류', '티셔츠'])
  })

  it('extractSiteCatList: 배열/wrapper 추출, 빈/이상 → []', () => {
    const fromArray = extractSiteCatList([{ catCode: '1', catName: '대분류', isLeaf: false }])
    expect(fromArray).toHaveLength(1)
    expect(fromArray[0]?.catCode).toBe('1')

    // wrapper { data: [...] } 도 풀어냄
    expect(
      extractSiteCatList({ data: [{ catCode: '2', catName: '중분류', isLeaf: true }] }),
    ).toHaveLength(1)

    // 빈/이상 입력 → throw 없이 []
    expect(extractSiteCatList({})).toEqual([])
    expect(extractSiteCatList([{ nope: true }])).toEqual([])
    expect(extractSiteCatList(null)).toEqual([])
  })
})
