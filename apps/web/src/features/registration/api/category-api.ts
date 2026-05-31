import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import {
  CategoryChildrenResponseSchema,
  CategoryHitsArraySchema,
  CategorySearchResponseSchema,
  type CategoryHit,
  type CategoryNode,
  type CategorySearchResponse,
  type MarketId,
} from '@/lib/schemas'

/**
 * 마켓 카테고리 lazy cascading 조회 도메인 API.
 * 마스터: docs/architecture/v1/features/category-sync.md §6.1
 *
 * 조회 경로: Browser → Edge `markets-category-children` → gatewayFetch → Lightsail GW → 마켓 API.
 *   브라우저가 마켓 실도메인을 직접 fetch 하면 CORS 차단되므로(구 fetchCategoryTree 버그) Edge 경유로 전환.
 *   parentId=null/미지정 → 루트(대분류). 반환 노드는 직계 자식만(children=[], leaf 로 하위 존재 표시).
 *
 * 에러파싱은 esm-shipping-list-api 패턴 복제(Supabase JS v2 FunctionsHttpError 의
 *   error.context 가 ReadableStream → clone().json()).
 * 네이버 등 미지원 마켓은 Edge 가 `category_not_supported` (400) → CategoryFetchError.code 로 노출,
 *   UI(CategoryCascader)가 fallback 분기.
 *
 * 클라이언트 캐싱은 useMarketCategoryChildren hook 의 useQuery staleTime(1h) 으로.
 */

/** 카테고리 조회 실패 — code 로 UI 분기(특히 'category_not_supported' 네이버 fallback). */
export class CategoryFetchError extends Error {
  readonly code: string
  readonly correlationId: string | null
  readonly raw: unknown

  constructor(
    payload: { code: string; message: string; correlationId?: string | null },
    raw?: unknown,
  ) {
    super(payload.message)
    this.name = 'CategoryFetchError'
    this.code = payload.code
    this.correlationId = payload.correlationId ?? null
    this.raw = raw
  }
}

/**
 * 카테고리 Edge 공통 호출 — invoke + Edge err 본문(ReadableStream) 파싱 + zod parse.
 *   markets-category-children / -search 가 공유 (DRY). 미지원·소유권 에러는 CategoryFetchError.
 */
async function invokeCategoryEdge<T>(
  fnName: string,
  body: Record<string, unknown>,
  parse: (data: unknown) => T,
): Promise<T> {
  const supabase = getSupabase()
  const { data, error } = await supabase.functions.invoke<unknown>(fnName, { body })

  if (error) {
    logger.warn({ err: error.message, fn: fnName }, '← category edge error')
    // Supabase JS v2 FunctionsHttpError: error.context 가 fetch Response (body 는 ReadableStream).
    // esm-shipping-list-api 와 동일하게 clone().json() 으로 본문 파싱.
    let errorBody: unknown = data
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.clone === 'function' && typeof ctx.json === 'function') {
      try {
        errorBody = await ctx.clone().json()
      } catch {
        // body 가 JSON 이 아닐 수 있음 — data 폴백 유지
      }
    }
    const parsed = parseEdgeError(errorBody)
    if (parsed) {
      throw new CategoryFetchError(parsed, error)
    }
    throw new CategoryFetchError({ code: 'internal', message: error.message }, error)
  }

  // error 없이 본문에 { code, message } 를 담아 4xx 를 흉내내는 경우도 방어.
  const inline = parseEdgeError(data)
  if (inline) {
    throw new CategoryFetchError(inline, data)
  }

  return parse(data)
}

/**
 * 부모코드(parentId) 직계 자식 카테고리만 조회.
 * @param parentId null = 루트(대분류). leaf=false 노드 선택 시 그 id 로 다음 단계 재조회.
 */
export async function fetchMarketCategoryChildren(
  marketId: MarketId,
  marketAccountId: string,
  parentId: string | null,
): Promise<CategoryNode[]> {
  return invokeCategoryEdge(
    'markets-category-children',
    { marketId, marketAccountId, parentId },
    (data) => CategoryChildrenResponseSchema.parse(data).nodes,
  )
}

/**
 * 카테고리명 부분일치 검색 (전역 인덱스 기반). leaf 만.
 * status: 'ready'(hits) | 'building'(폴링 대기) | 'unsupported'(naver).
 * 마스터: docs/architecture/v1/features/category-sync.md §6
 */
export async function fetchCategorySearch(
  marketId: MarketId,
  marketAccountId: string,
  query: string,
): Promise<CategorySearchResponse> {
  return invokeCategoryEdge(
    'markets-category-search',
    { marketId, marketAccountId, query },
    (data) => CategorySearchResponseSchema.parse(data),
  )
}

/**
 * 셀러의 마켓별 최근 사용 카테고리 (get_recent_categories RPC). 최신순 6개.
 * 인덱스 미적재 코드는 code fallback(name/pathText=code). 0건이면 [].
 */
export async function fetchRecentCategories(marketId: MarketId): Promise<CategoryHit[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('get_recent_categories', {
    p_market_id: marketId,
  })
  if (error) {
    logger.warn({ err: error.message }, '← get_recent_categories error')
    throw new CategoryFetchError({ code: 'internal', message: error.message }, error)
  }
  return CategoryHitsArraySchema.parse(data ?? [])
}

/** Edge `err()` 본문(`{ error: { code, message, correlationId } }`) 또는 flat 형태를 정규화. */
function parseEdgeError(
  body: unknown,
): { code: string; message: string; correlationId?: string | null } | null {
  if (body === null || typeof body !== 'object') return null
  const obj = body as Record<string, unknown>
  const inner = obj.error
  if (inner && typeof inner === 'object') {
    const e = inner as Record<string, unknown>
    if (typeof e.code === 'string' && typeof e.message === 'string') {
      return {
        code: e.code,
        message: e.message,
        correlationId:
          typeof e.correlationId === 'string' ? e.correlationId : null,
      }
    }
  }
  if (typeof obj.code === 'string' && typeof obj.message === 'string') {
    return {
      code: obj.code,
      message: obj.message,
      correlationId:
        typeof obj.correlationId === 'string' ? obj.correlationId : null,
    }
  }
  return null
}
