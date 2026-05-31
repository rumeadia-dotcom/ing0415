/**
 * 쿠팡 Wing OpenAPI 카테고리 — Deno 의존 없는 순수 로직.
 *
 * coupang.ts 에서 분리한 이유:
 *   - 경로 / 루트 코드 / HTTP→MarketError 매핑 / 트리 순회를 Vitest 로 직접 회귀 가드.
 *   - coupang.ts 는 `npm:zod` / gatewayFetch(env) 의존이라 Node 테스트에서 직접 import 불가.
 *   - 본 모듈은 errors.ts(순수)만 의존 → 실제 운영 코드를 그대로 테스트.
 *
 * 공식 스펙 (2026-05-27 운영 사고 hotfix):
 *   GET /v2/providers/seller_api/apis/api/v1/marketplace/meta/display-categories/{displayCategoryCode}
 *   - 루트(depth-1) = displayCategoryCode `0`
 *   출처: developers.coupangcorp.com — "How to get category list" / "How to get categories"
 */

import { MarketError } from '../errors.ts'
// type-only import 는 esbuild/vite 가 런타임에서 erase → schemas.ts(npm:zod) 미로딩.
// CategoryNode 단일 소스 유지 (schemas.ts). vitest 직접 import 가능.
import type { CategoryNode } from '../schemas.ts'

export type { CategoryNode }

const MARKET = 'coupang' as const

/** 카테고리 메타 조회 베이스 경로. (이전 `categorization/...` 은 존재하지 않는 오타였음) */
export const COUPANG_DISPLAY_CATEGORY_BASE_PATH =
  '/v2/providers/seller_api/apis/api/v1/marketplace/meta/display-categories'

/** 루트(depth-1) displayCategoryCode. */
export const ROOT_DISPLAY_CATEGORY_CODE = 0

/** displayCategoryCode → 전체 API 경로. */
export function buildDisplayCategoryPath(code: number): string {
  return `${COUPANG_DISPLAY_CATEGORY_BASE_PATH}/${code}`
}

/** Wing OpenAPI 가 돌려주는 카테고리 1건 (zod 파싱 후 형태). */
export interface RawCoupangCategory {
  categoryId: number
  displayCategoryName: string
  isLeafCategory: boolean
  subCategories: {
    categoryId: number
    displayCategoryName: string
    isLeafCategory: boolean
  }[]
}

/**
 * Wing OpenAPI 카테고리 응답을 RawCoupangCategory 로 관대하게 매핑.
 *
 * 실제 응답 필드 (카테고리-조회.md / 카테고리-목록조회.md):
 *   data.displayCategoryCode | displayItemCategoryCode (코드) / data.name (이름) / data.child[] (직계 자식).
 *   ⚠️ isLeafCategory / subCategories / categoryId / displayCategoryName 필드는 존재하지 않는다.
 *   per-code 응답은 1-depth 자식만 주고 각 자식의 child 는 항상 [] (2-depth 미표시) →
 *   자식의 leaf 는 응답으로 판정 불가 → false(드릴 가능)로 두고, 실제 leaf 는
 *   CategoryCascader 의 "드릴 결과 0개 → 부모 자동 확정"이 판정한다.
 *
 * 연결 검증 핑은 HTTP 200 만 확인하면 되므로(반환 트리 미사용) 형태가 달라도 절대 throw 하지 않는다.
 * 구 표준 필드(categoryId/displayCategoryName/isLeafCategory/subCategories)도 하위호환으로 함께 읽는다.
 */
export function coerceCoupangCategory(
  raw: unknown,
  fallbackCode: number,
): RawCoupangCategory {
  const data =
    raw && typeof raw === 'object' && 'data' in raw
      ? (raw as { data?: unknown }).data
      : undefined
  const d = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}

  const toCode = (v: unknown): number | undefined => {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
    return undefined
  }

  const categoryId =
    toCode(d.displayCategoryCode) ?? toCode(d.displayItemCategoryCode) ?? toCode(d.categoryId) ?? fallbackCode
  const displayCategoryName =
    typeof d.name === 'string'
      ? d.name
      : typeof d.displayCategoryName === 'string'
        ? d.displayCategoryName
        : ''

  const childArr = Array.isArray(d.child)
    ? d.child
    : Array.isArray(d.subCategories)
      ? d.subCategories
      : []

  const subCategories = childArr.flatMap((s) => {
    if (!s || typeof s !== 'object') return []
    const o = s as Record<string, unknown>
    const subId = toCode(o.displayCategoryCode) ?? toCode(o.displayItemCategoryCode) ?? toCode(o.categoryId)
    if (subId === undefined) return []
    const subName =
      typeof o.name === 'string'
        ? o.name
        : typeof o.displayCategoryName === 'string'
          ? o.displayCategoryName
          : ''
    const subLeaf = typeof o.isLeafCategory === 'boolean' ? o.isLeafCategory : false
    return [{ categoryId: subId, displayCategoryName: subName, isLeafCategory: subLeaf }]
  })

  const isLeafCategory =
    typeof d.isLeafCategory === 'boolean' ? d.isLeafCategory : subCategories.length === 0

  return { categoryId, displayCategoryName, isLeafCategory, subCategories }
}

/**
 * 부모 카테고리 응답(RawCoupangCategory) → 직계 자식 CategoryNode[] (lazy cascading 용).
 *
 * 순수 함수 (Deno 의존 0 → Vitest 회귀). coerceCoupangCategory 통과 후의 subCategories 를
 * 직계 노드로 매핑한다. children 은 항상 빈 배열(직계만), leaf=각 sub.isLeafCategory.
 * depth 는 쿠팡 응답에 없으므로 1 고정 (CategoryNodeSchema 의 min(1) 통과용 — UI 미사용).
 *
 * @param raw       부모 코드 1건 조회 응답 (coerceCoupangCategory 산출물).
 * @param parentId  부모 코드 (루트=null). 자식 노드의 parentId 로 부착.
 */
export function coupangSubCategoriesToNodes(
  raw: RawCoupangCategory,
  parentId: string | null,
): CategoryNode[] {
  return raw.subCategories.map((sub) => ({
    id: String(sub.categoryId),
    name: sub.displayCategoryName || String(sub.categoryId),
    depth: 1,
    leaf: sub.isLeafCategory,
    parentId,
    children: [],
  }))
}

/** HTTP 상태 → MarketError code 매핑. */
export function coupangHttpStatusToMarketError(
  status: number,
  message: string,
  correlationId: string,
): MarketError {
  if (status === 401 || status === 403) {
    return new MarketError('unauthorized', `쿠팡 인증 실패 (${status})`, {
      market: MARKET,
      status,
      marketErrorMessage: message,
      marketErrorCode: String(status),
    })
  }
  if (status === 400 || status === 422) {
    return new MarketError('validation', `쿠팡 요청 검증 실패 (${status}): ${message}`, {
      market: MARKET,
      status,
      marketErrorMessage: message,
      marketErrorCode: String(status),
    })
  }
  if (status === 429) {
    return new MarketError('rate_limit', '쿠팡 API rate limit 초과', {
      market: MARKET,
      status,
      retryAfterMs: 5_000,
      marketErrorCode: 'rate_limit',
    })
  }
  if (status >= 500) {
    return new MarketError('server', `쿠팡 서버 오류 (${status})`, {
      market: MARKET,
      status,
      marketErrorMessage: message,
      marketErrorCode: String(status),
    })
  }
  return new MarketError(
    'unknown',
    `쿠팡 API 오류 (${status}) correlationId=${correlationId}`,
    { market: MARKET, status, marketErrorMessage: message },
  )
}

/**
 * 카테고리 트리 순회 (순수). fetchRaw 주입으로 테스트 가능.
 *
 * @param fetchRaw  displayCategoryCode 1건 조회.
 * @param code      현재 노드 코드.
 * @param depth     현재 깊이 (루트 = 1).
 * @param maxDepth  이 깊이 이상이면 자식 미조회 (재귀 종료). 핑 = 1.
 * @param parentId  부모 노드 id (루트 = null).
 *
 * 주의: maxDepth 를 넘기지 않으면 마켓 카테고리 전체를 순차 조회하여 게이트웨이가
 * 폭주/타임아웃한다. 연결 검증 핑은 maxDepth=1 (루트 1회) 로 호출할 것.
 */
export async function buildCategoryTree(
  fetchRaw: (code: number) => Promise<RawCoupangCategory>,
  code: number,
  depth: number,
  maxDepth: number,
  parentId: string | null,
): Promise<CategoryNode> {
  const raw = await fetchRaw(code)
  const isLeaf = raw.isLeafCategory || depth >= maxDepth

  const children: CategoryNode[] = []
  if (!isLeaf && raw.subCategories.length > 0) {
    for (const sub of raw.subCategories) {
      children.push(
        await buildCategoryTree(
          fetchRaw,
          sub.categoryId,
          depth + 1,
          maxDepth,
          String(raw.categoryId),
        ),
      )
    }
  }

  return {
    id: String(raw.categoryId),
    name: raw.displayCategoryName,
    depth,
    leaf: isLeaf,
    parentId,
    children,
  }
}
