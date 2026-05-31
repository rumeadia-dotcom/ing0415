/**
 * Edge Function: markets-category-index-build
 *
 * 마스터:
 *   - docs/architecture/v1/features/category-sync.md §6
 *   - markets-category-children/index.ts (셀러 JWT + ownership + loadCredential 패턴)
 *   - orders-sync/index.ts (service_role/cron 인증 + active account 자동 선택)
 *
 * 역할:
 *   마켓 공통 카테고리를 전역 캐시 market_category_index 에 빌드(셀러 무관 1벌).
 *   ESM(G마켓·옥션)은 콜이 많아 검색 Edge 가 인라인 빌드하지 않고 본 Edge 를 async
 *   트리거(fire-and-forget) → meta=building → ready 로 흡수. cron pre-warm 도 본 Edge 호출.
 *
 * 호출자 2종 (POST { marketId, marketAccountId? }):
 *   (a) 셀러 JWT — marketAccountId 필수 + market_accounts 소유권 검증.
 *   (b) service_role/cron — Authorization: Bearer <service_role>. marketAccountId 없으면
 *       해당 마켓 active market_account 1개 자동 선택. 0개면 skip(11번가는 키 불필요라 빌드).
 *
 * 응답:
 *   { marketId, status: 'ready'|'unsupported'|'skipped', nodeCount }
 *   - unsupported: fetchCategoryTreeFull 미구현(naver).
 *   - skipped: 빌드 가능한 active account/credential 없음(non-11st).
 *   - 빌드 실패 시 meta=failed + HTTP 5xx/4xx.
 *
 * 강제:
 *   - 모든 마켓 호출은 어댑터 내부 gatewayFetch 경유. 조회·적재는 멱등.
 *   - 토큰/키/PII 로그·응답 노출 금지. marketId·nodeCount 만.
 */

import {
  CategoryIndexBuildRequestSchema,
  type StoredCredential,
} from '../_shared/schemas.ts'
import {
  appendAudit,
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
} from '../_shared/index.ts'
import { buildAndUpsertCategoryIndex } from '../_shared/category-index-build.ts'

// ─────────────────────────────────────────────
// 인증 — service_role(cron/internal) vs 셀러 JWT
// ─────────────────────────────────────────────

function isServiceRoleCall(req: Request): boolean {
  const auth = req.headers.get('authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return false
  const token = auth.slice('bearer '.length).trim()
  return token === env.SUPABASE_SERVICE_ROLE_KEY
}

async function resolveSellerId(req: Request): Promise<string> {
  const token = requireBearer(req)
  const supabase = getUserClient(token)
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw HttpErrors.unauthorized('invalid_token', 'jwt verification failed')
  }
  return data.user.id
}

// ─────────────────────────────────────────────
// account/credential 해석
//   marketAccountId 지정: 해당 계정(셀러면 ownership 검증, internal 이면 market_id 정합만).
//   미지정(internal 전용): 해당 마켓 active account 1개 자동 선택(없으면 null).
// ─────────────────────────────────────────────

interface AccountCred {
  accountId: string | null
  credentialId: string | null
}

async function resolveAccountForBuild(opts: {
  svc: ReturnType<typeof getServiceClient>
  marketId: string
  marketAccountId?: string
  /** 셀러 호출이면 sellerId 로 ownership 검증. internal 이면 undefined. */
  sellerId?: string
}): Promise<AccountCred> {
  const { svc, marketId, marketAccountId, sellerId } = opts

  if (marketAccountId) {
    const { data, error } = await svc
      .from('market_accounts')
      .select('id, seller_id, market_id, credential_id, status')
      .eq('id', marketAccountId)
      .maybeSingle()
    if (error || !data) {
      throw HttpErrors.notFound('market_account_not_found', 'market account not found')
    }
    if (sellerId && data.seller_id !== sellerId) {
      throw HttpErrors.forbidden('forbidden', 'not your market account')
    }
    if (data.market_id !== marketId) {
      throw HttpErrors.badRequest('market_mismatch', 'marketId does not match market account')
    }
    return {
      accountId: data.id as string,
      credentialId: typeof data.credential_id === 'string' ? data.credential_id : null,
    }
  }

  // 자동 선택 — active account 1개(전역 인덱스이므로 어느 셀러 것이든 무방).
  const { data, error } = await svc
    .from('market_accounts')
    .select('id, credential_id')
    .eq('market_id', marketId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (error || !data) {
    return { accountId: null, credentialId: null }
  }
  return {
    accountId: data.id as string,
    credentialId: typeof data.credential_id === 'string' ? data.credential_id : null,
  }
}

// ─────────────────────────────────────────────
// Edge entry
// ─────────────────────────────────────────────

export default Deno.serve(
  withRequest('markets-category-index-build', async ({ req, logger, correlationId }) => {
    if (req.method !== 'POST') {
      throw HttpErrors.badRequest('method_not_allowed', 'POST required')
    }

    const body = await parseBody(req, CategoryIndexBuildRequestSchema)
    const market = body.marketId
    const svc = getServiceClient()

    // 1) 미지원 마켓(naver) — fetchCategoryTreeFull 생략.
    const adapter = getMarketAdapter(market)
    if (!adapter.fetchCategoryTreeFull) {
      return ok({ marketId: market, status: 'unsupported', nodeCount: 0 }, { correlationId })
    }

    // 2) 호출자 판별.
    const internal = isServiceRoleCall(req)
    let sellerId: string | undefined
    if (!internal) {
      sellerId = await resolveSellerId(req)
      if (!body.marketAccountId) {
        throw HttpErrors.badRequest('market_account_required', 'seller call requires marketAccountId')
      }
    }

    // 3) account/credential.
    const acct = await resolveAccountForBuild({
      svc,
      marketId: market,
      marketAccountId: body.marketAccountId,
      sellerId,
    })

    // 4) credential 로드 — 11번가는 카테고리(1001) 키 불필요(graceful). 그 외 필수.
    let stored: StoredCredential | null = null
    if (acct.credentialId) {
      try {
        const cred = await loadCredential({
          credentialId: acct.credentialId,
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
      // 빌드 가능한 active account/credential 없음 → skip(cron 정상 흐름).
      logger.info({ market, correlationId }, '← category index build skipped (no active account)')
      return ok({ marketId: market, status: 'skipped', nodeCount: 0 }, { correlationId })
    }

    if (stored) adapter.hydrate(stored)

    // 5) 빌드 + 적재.
    logger.info({ market, internal, correlationId }, '→ category index build')
    let result
    try {
      result = await buildAndUpsertCategoryIndex({
        svc,
        marketId: market,
        adapter,
        sourceAccountId: acct.accountId,
        logger,
        correlationId,
      })
    } catch (e) {
      if (e instanceof MarketError) {
        logger.error({ market, marketErrorCode: e.code, correlationId }, '← category index build market error')
        if (e.code === 'rate_limit') throw HttpErrors.rateLimit(e.context.retryAfterMs)
        if (e.code === 'unauthorized') {
          throw HttpErrors.badRequest('market_unauthorized', e.message)
        }
        throw HttpErrors.badGateway('category_build_failed', e.message)
      }
      throw e
    }

    await appendAudit({
      category: 'registration',
      event: 'category_index_built',
      sellerId: sellerId ?? null,
      meta: { market, nodeCount: result.nodeCount, internal },
      correlationId,
      logger,
    })

    logger.info({ market, nodeCount: result.nodeCount, correlationId }, '← category index build ok')
    return ok({ marketId: market, status: result.status, nodeCount: result.nodeCount }, { correlationId })
  }),
)
