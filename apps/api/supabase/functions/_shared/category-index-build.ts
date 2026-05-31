/**
 * 카테고리 인덱스 빌드 공유 헬퍼 — Deno(Edge) 측.
 *
 * 마스터:
 *   - docs/architecture/v1/features/category-sync.md §6
 *   - specs/2026-05-31-category-recommendation-design.md §4
 *
 * 역할:
 *   hydrate 된 어댑터의 fetchCategoryTreeFull() 풀트리 → flattenCategoryTree 로 row 화
 *   → 전역 캐시 market_category_index 에 (market_id 전체 삭제 + chunked insert) 재적재
 *   → market_category_index_meta 상태(building→ready/failed) 갱신.
 *
 *   빌드 Edge(markets-category-index-build) 와 검색 Edge(markets-category-search,
 *   11번가·쿠팡 단발 인라인 빌드)가 공유한다. svc(service client)·adapter 주입 → 순수 의존 최소.
 *
 * 강제:
 *   - 인덱스는 셀러 무관 전역 1벌(source_account_id 는 빌드에 쓴 계정 추적용일 뿐 격리 아님).
 *   - 토큰/키/PII 로그 금지. marketId·nodeCount 만.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { flattenCategoryTree } from './category-index.ts'
import type { Logger } from './logger.ts'
import type { MarketAdapter } from './market-adapter.ts'

/** Postgres insert 1콜당 row 상한 — 방대 트리(쿠팡)도 안전하게 분할. */
const INSERT_CHUNK = 1000

export interface BuildCategoryIndexResult {
  status: 'ready'
  nodeCount: number
}

/** market_category_index_meta upsert (PK market_id). updated_at 명시 갱신. */
async function upsertMeta(
  svc: SupabaseClient,
  row: {
    market_id: string
    status: 'building' | 'ready' | 'failed'
    built_at?: string | null
    node_count?: number | null
    source_account_id?: string | null
    error?: string | null
  },
): Promise<void> {
  await svc
    .from('market_category_index_meta')
    .upsert(
      { ...row, updated_at: new Date().toISOString() },
      { onConflict: 'market_id' },
    )
}

/**
 * fetchCategoryTreeFull → flatten → delete(market_id) → chunked insert → meta.
 * 실패 시 meta=failed 로 남기고 에러를 그대로 throw (호출 Edge 가 HTTP 매핑).
 */
export async function buildAndUpsertCategoryIndex(opts: {
  svc: SupabaseClient
  marketId: string
  adapter: MarketAdapter
  /** 빌드에 사용한 market_account id (추적용, 선택). */
  sourceAccountId?: string | null
  logger: Logger
  correlationId: string
}): Promise<BuildCategoryIndexResult> {
  const { svc, marketId, adapter, sourceAccountId = null, logger, correlationId } = opts

  if (!adapter.fetchCategoryTreeFull) {
    throw new Error(`adapter ${marketId} 는 fetchCategoryTreeFull 미지원`)
  }

  // 동시 검색이 'building' 을 보도록 먼저 표시.
  await upsertMeta(svc, { market_id: marketId, status: 'building', source_account_id: sourceAccountId })

  try {
    const tree = await adapter.fetchCategoryTreeFull()
    const rows = flattenCategoryTree(marketId, tree)

    const del = await svc.from('market_category_index').delete().eq('market_id', marketId)
    if (del.error) throw new Error(`index delete 실패: ${del.error.message}`)

    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
      const chunk = rows.slice(i, i + INSERT_CHUNK)
      const ins = await svc.from('market_category_index').insert(chunk)
      if (ins.error) throw new Error(`index insert 실패: ${ins.error.message}`)
    }

    await upsertMeta(svc, {
      market_id: marketId,
      status: 'ready',
      built_at: new Date().toISOString(),
      node_count: rows.length,
      source_account_id: sourceAccountId,
      error: null,
    })

    logger.info({ market: marketId, nodeCount: rows.length, correlationId }, '← category index built')
    return { status: 'ready', nodeCount: rows.length }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await upsertMeta(svc, {
      market_id: marketId,
      status: 'failed',
      source_account_id: sourceAccountId,
      error: message.slice(0, 500),
    })
    logger.error({ market: marketId, correlationId }, '← category index build failed')
    throw e
  }
}
