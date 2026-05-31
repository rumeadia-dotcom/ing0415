/**
 * 카테고리 트리(CategoryNode[]) → market_category_index 평탄 row 변환 (Deno-free 순수).
 *
 * 마스터: docs/architecture/v1/cross-cutting/market-adapter.md
 *   - 11번가·쿠팡·ESM 어댑터가 받은 카테고리 트리를 market_category_index 테이블
 *     row 로 펴는 공용 유틸. 이후 빌드 Edge 가 사용.
 *   - path_text 는 검색(ILIKE)·표시용, path_labels 는 최근/선택 경로 표시용.
 *
 * 특성:
 *   - Deno 의존 없는 순수 함수 → Vitest(Node) 환경에서 직접 테스트 가능.
 *   - DFS 로 트리를 순회하며 조상 라벨을 누적.
 */
import type { CategoryNode } from './schemas.ts'

/** market_category_index 테이블 1개 row 구조 */
export interface CategoryIndexRow {
  market_id: string
  code: string
  name: string
  parent_code: string | null
  depth: number
  leaf: boolean
  /** 조상 이름을 ' > ' 로 연결한 검색·표시용 전문 경로 */
  path_text: string
  /** 조상 이름 배열 — 최근/선택 경로 UI 표시용 */
  path_labels: string[]
}

/**
 * 트리를 DFS 로 평탄화하며 조상 라벨을 누적.
 * path_text 는 ' > ' 조인.
 *
 * @param marketId   마켓 식별자 (예: 'coupang', '11st')
 * @param tree       fetchCategoryTree 로부터 받은 CategoryNode 배열 (루트 노드들)
 * @returns          market_category_index 삽입용 row 배열
 */
export function flattenCategoryTree(
  marketId: string,
  tree: CategoryNode[],
): CategoryIndexRow[] {
  const rows: CategoryIndexRow[] = []

  // DFS 순회: ancestors 는 현재 노드의 조상 이름 배열 (루트부터 현재 부모까지).
  const walk = (nodes: CategoryNode[], ancestors: string[]): void => {
    for (const node of nodes) {
      const labels = [...ancestors, node.name]
      rows.push({
        market_id: marketId,
        code: node.id,
        name: node.name,
        parent_code: node.parentId,
        depth: node.depth,
        leaf: node.leaf,
        path_text: labels.join(' > '),
        path_labels: labels,
      })
      if (node.children.length > 0) {
        walk(node.children, labels)
      }
    }
  }

  walk(tree, [])
  return rows
}
