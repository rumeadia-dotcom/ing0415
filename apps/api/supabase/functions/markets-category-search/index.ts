/**
 * Edge Function: markets-category-search
 *
 * 마스터:
 *   - docs/architecture/v1/features/category-sync.md §6
 *   - markets-category-children/index.ts (셀러 JWT + ownership + loadCredential 패턴)
 *   - markets-category-index-build/index.ts (공유 빌드 헬퍼)
 *
 * 역할:
 *   s3 상품등록 3단계에서 셀러가 카테고리명을 타이핑하면 leaf 카테고리를 전역 캐시
 *   market_category_index 의 path_text(pg_trgm) 부분일치로 찾아 반환한다.
 *
 * 처리 (POST { marketId, marketAccountId, query }):
 *   1. 셀러 JWT → sellerId, market_accounts 소유권 검증.
 *   2. naver(fetchCategoryTreeFull 미구현) → status='unsupported'.
 *   3. meta=ready & !stale(<7일) → 즉시 검색(status='ready').
 *   4. 아니면 마켓별:
 *      - 11번가·쿠팡: 단발 1콜 → buildAndUpsertCategoryIndex 인라인 후 검색(ready).
 *      - ESM(gmarket·auction): 콜 多 → 빌드 Edge async 트리거(fire-and-forget) + building.
 *        (이미 building 이면 재트리거 없이 building 만 반환 — 폴링 중복 방지.)
 *
 * 강제:
 *   - 인덱스는 셀러 무관 전역. 검색은 leaf=true 만(등록 가능 최하위).
 *   - user query 의 LIKE 와일드카드(%,_,\)는 이스케이프 — 패턴 주입 차단.
 *   - 토큰/키/PII 로그·응답 노출 금지.
 */

import {
  CategorySearchRequestSchema,
  CategorySearchResponseSchema,
  type CategoryHit,
  type StoredCredential,
} from '../_shared/schemas.ts'
import {
  env,
  getMarketAdapter,
  getServiceClient,
  getUserClient,
  HttpErrors,
  loadCredential,
  MarketError,
  ok,
  parseBody,
  requireBearer,
  withRequest,
  type Logger,
} from '../_shared/index.ts'
import { buildAndUpsertCategoryIndex } from '../_shared/category-index-build.ts'

/** 인덱스 신선도 — 7일 초과 시 stale 로 재빌드. cron pre-warm 이 일 1회 데움. */
const STALE_MS = 7 * 24 * 60 * 60 * 1000
const SEARCH_LIMIT = 20
/** ESM(콜 多) — 인라인 금지, async 빌드 + building 폴백. */
const ASYNC_BUILD_MARKETS: readonly string[] = ['gmarket', 'auction']

// ─────────────────────────────────────────────
// 인증 + 소유권
// ─────────────────────────────────────────────

async function resolveSellerId(req: Request): Promise<string> {
  const token = requireBearer(req)
  const supabase = getUserClient(token)
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw HttpErrors.unauthorized('invalid_token', 'jwt verification failed')
  }
  return data.user.id
}

interface ResolvedAccount {
  accountId: string
  credentialId: string | null
}

async function resolveMarketAccount(opts: {
  svc: ReturnType<typeof getServiceClient>
  marketAccountId: string
  marketId: string
  sellerId: string
}): Promise<ResolvedAccount> {
  const { data, error } = await opts.svc
    .from('market_accounts')
    .select('id, seller_id, market_id, credential_id, status')
    .eq('id', opts.marketAccountId)
    .maybeSingle()
  if (error || !data) {
    throw HttpErrors.notFound('market_account_not_found', 'market account not found')
  }
  if (data.seller_id !== opts.sellerId) {
    throw HttpErrors.forbidden('forbidden', 'not your market account')
  }
  if (data.market_id !== opts.marketId) {
    throw HttpErrors.badRequest('market_mismatch', 'marketId does not match market account')
  }
  return {
    accountId: data.id as string,
    credentialId: typeof data.credential_id === 'string' ? data.credential_id : null,
  }
}

// ─────────────────────────────────────────────
// 인덱스 검색 / meta
// ─────────────────────────────────────────────

/** LIKE 와일드카드 이스케이프(기본 escape char `\`). */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`)
}

async function runSearch(
  svc: ReturnType<typeof getServiceClient>,
  marketId: string,
  query: string,
): Promise<CategoryHit[]> {
  const pattern = `%${escapeLike(query)}%`
  const { data, error } = await svc
    .from('market_category_index')
    .select('code, name, path_text, path_labels')
    .eq('market_id', marketId)
    .eq('leaf', true)
    .ilike('path_text', pattern)
    .limit(SEARCH_LIMIT)
  if (error) {
    throw HttpErrors.internal('category_search_failed', error.message)
  }
  return (data ?? []).map((r) => ({
    code: r.code as string,
    name: r.name as string,
    pathText: r.path_text as string,
    pathLabels: (r.path_labels as string[]) ?? [],
  }))
}

interface IndexMeta {
  status: string
  builtAt: string | null
}

async function getMeta(
  svc: ReturnType<typeof getServiceClient>,
  marketId: string,
): Promise<IndexMeta | null> {
  const { data, error } = await svc
    .from('market_category_index_meta')
    .select('status, built_at')
    .eq('market_id', marketId)
    .maybeSingle()
  if (error || !data) return null
  return { status: data.status as string, builtAt: (data.built_at as string | null) ?? null }
}

function isFresh(meta: IndexMeta | null): boolean {
  if (!meta || meta.status !== 'ready' || !meta.builtAt) return false
  return Date.now() - Date.parse(meta.builtAt) < STALE_MS
}

// ─────────────────────────────────────────────
// ESM async 빌드 트리거 (fire-and-forget)
// ─────────────────────────────────────────────

function functionsBaseUrl(): string {
  try {
    const u = new URL(env.SUPABASE_URL)
    return `${u.protocol}//${u.host}/functions/v1`
  } catch {
    return env.SUPABASE_URL
  }
}

function triggerBuildAsync(opts: {
  marketId: string
  marketAccountId: string
  correlationId: string
  logger: Logger
}): void {
  const url = `${functionsBaseUrl().replace(/\/$/, '')}/markets-category-index-build`
  const p = (async () => {
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'content-type': 'application/json',
          'x-correlation-id': opts.correlationId,
        },
        body: JSON.stringify({
          marketId: opts.marketId,
          marketAccountId: opts.marketAccountId,
        }),
      })
    } catch {
      opts.logger.warn({ market: opts.marketId }, 'async category build trigger failed')
    }
  })()
  // Supabase Edge 의 EdgeRuntime.waitUntil 로 응답 후에도 빌드 invoke 완주 보장.
  // (Deno 타입에 없는 글로벌이라 globalThis 캐스팅. 없으면 fire-and-forget.)
  const er = (globalThis as Record<string, unknown>).EdgeRuntime as
    | { waitUntil?: (p: Promise<unknown>) => void }
    | undefined
  if (er?.waitUntil) er.waitUntil(p.catch(() => undefined))
  else void p.catch(() => undefined)
}

// ─────────────────────────────────────────────
// Edge entry
// ─────────────────────────────────────────────

export default Deno.serve(
  withRequest('markets-category-search', async ({ req, logger, correlationId }) => {
    if (req.method !== 'POST') {
      throw HttpErrors.badRequest('method_not_allowed', 'POST required')
    }

    const body = await parseBody(req, CategorySearchRequestSchema)
    const market = body.marketId
    const sellerId = await resolveSellerId(req)

    // 1) 미지원 마켓(naver).
    const adapter = getMarketAdapter(market)
    if (!adapter.fetchCategoryTreeFull) {
      return ok(
        CategorySearchResponseSchema.parse({ status: 'unsupported', hits: [] }),
        { correlationId },
      )
    }

    // 2) 소유권.
    const svc = getServiceClient()
    const account = await resolveMarketAccount({
      svc,
      marketAccountId: body.marketAccountId,
      marketId: market,
      sellerId,
    })

    // 3) 신선한 인덱스 → 즉시 검색.
    const meta = await getMeta(svc, market)
    if (isFresh(meta)) {
      const hits = await runSearch(svc, market, body.query)
      return ok(
        CategorySearchResponseSchema.parse({ status: 'ready', hits }),
        { correlationId },
      )
    }

    // 4-a) ESM — async 빌드 + building. 이미 building 이면 재트리거 없이 대기.
    if (ASYNC_BUILD_MARKETS.includes(market)) {
      if (meta?.status !== 'building') {
        triggerBuildAsync({
          marketId: market,
          marketAccountId: body.marketAccountId,
          correlationId,
          logger,
        })
      }
      return ok(
        CategorySearchResponseSchema.parse({ status: 'building', hits: [] }),
        { correlationId },
      )
    }

    // 4-b) 11번가·쿠팡 — 단발 인라인 빌드 후 검색.
    let stored: StoredCredential | null = null
    if (account.credentialId) {
      try {
        const cred = await loadCredential({
          credentialId: account.credentialId,
          correlationId,
          logger,
        })
        stored = { kind: cred.credentialKind, payload: cred.payload } as StoredCredential
      } catch (e) {
        if (market !== '11st') throw e
        stored = null // 11번가 → 키 없이 진행.
      }
    }
    if (!stored && market !== '11st') {
      throw HttpErrors.internal('credential_missing', 'market account has no credential')
    }
    if (stored) adapter.hydrate(stored)

    logger.info({ market, sellerId, correlationId }, '→ category index inline build (miss)')
    try {
      await buildAndUpsertCategoryIndex({
        svc,
        marketId: market,
        adapter,
        sourceAccountId: account.accountId,
        logger,
        correlationId,
      })
    } catch (e) {
      if (e instanceof MarketError) {
        if (e.code === 'rate_limit') throw HttpErrors.rateLimit(e.context.retryAfterMs)
        if (e.code === 'unauthorized') {
          throw HttpErrors.badRequest('market_unauthorized', e.message)
        }
        throw HttpErrors.badGateway('category_build_failed', e.message)
      }
      throw e
    }

    const hits = await runSearch(svc, market, body.query)
    return ok(
      CategorySearchResponseSchema.parse({ status: 'ready', hits }),
      { correlationId },
    )
  }),
)
