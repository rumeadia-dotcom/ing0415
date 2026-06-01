/**
 * ESM 2.0 (G마켓·옥션) site-cats 카테고리 — Deno 의존 없는 순수 로직.
 *
 * esm-shared.ts 에서 분리한 이유 (coupang-category.ts 와 동일 패턴):
 *   - site-cats 응답 추출 / CategoryNode 변환을 Vitest 로 직접 회귀 가드.
 *   - esm-shared.ts 는 `npm:zod` / gatewayFetch / esm-jwt 의존이라 Node 테스트에서 직접 import 불가.
 *   - 본 모듈은 type-only import 만 → 실제 운영 코드를 그대로 테스트.
 *
 * 스펙: esm-api/product/4.md — { catCode, catName, isLeaf, subCats?[] }.
 *   대분류=배열 / 하위 조회=단일 객체(subCats) / wrapper(data/categories) 모두 허용.
 *   isLeaf=true 인 최하위만 상품등록 가능.
 */

// type-only import 는 esbuild/vite 가 런타임에서 erase → schemas.ts(npm:zod) 미로딩.
// CategoryNode / EsmSiteCat 단일 소스 유지 (schemas.ts). vitest 직접 import 가능.
import type { CategoryNode, EsmSiteCat } from '../schemas.ts'

export type { CategoryNode }

/** site-cats 응답 raw 노드 (esm-api/product/4.md). */
export interface EsmSiteCatRaw {
  catCode: string
  catName: string
  isLeaf: boolean
  subCats?: EsmSiteCatRaw[]
}

/**
 * raw 노드 형태 런타임 가드 — zod 없이 (순수 모듈 유지).
 * 기존 EsmSiteCatRawSchema(z.lazy: catCode/catName min(1), isLeaf boolean,
 * subCats optional array of same) 와 동일하게 subCats 까지 재귀 검증한다
 * (하위 한 개라도 형식 위반이면 노드 전체 탈락 — 기존 동작 보존).
 */
function isEsmSiteCatRaw(v: unknown): v is EsmSiteCatRaw {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  if (typeof o.catCode !== 'string' || o.catCode.length === 0) return false
  if (typeof o.catName !== 'string' || o.catName.length === 0) return false
  if (typeof o.isLeaf !== 'boolean') return false
  if (o.subCats !== undefined) {
    if (!Array.isArray(o.subCats)) return false
    if (!o.subCats.every(isEsmSiteCatRaw)) return false
  }
  return true
}

/**
 * site-cats 응답 본문에서 카테고리 배열 추출.
 * 대분류=배열 / 하위 조회=단일 객체(subCats) / wrapper(subCats/categories/data) 모두 허용.
 */
export function extractSiteCatList(raw: unknown): EsmSiteCatRaw[] {
  if (Array.isArray(raw)) {
    return raw.filter(isEsmSiteCatRaw)
  }
  if (isEsmSiteCatRaw(raw)) return [raw]
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    for (const key of ['subCats', 'categories', 'data']) {
      if (key in obj) return extractSiteCatList(obj[key])
    }
  }
  return []
}

/** EsmSiteCat → 공통 CategoryNode. depth 1-base, parentId 연결. */
export function siteCatToCategoryNode(
  cat: EsmSiteCat,
  depth: number,
  parentId: string | null,
): CategoryNode {
  const children = (cat.children ?? []).map((c) =>
    siteCatToCategoryNode(c, depth + 1, cat.siteCatCode),
  )
  return {
    id: cat.siteCatCode,
    name: cat.siteCatName,
    depth,
    leaf: cat.isLeaf,
    parentId,
    children,
  }
}
