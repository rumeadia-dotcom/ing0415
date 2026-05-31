/**
 * Edge Function: markets-category-children
 *
 * 마스터:
 *   - docs/architecture/v1/features/category-sync.md (ground truth)
 *   - docs/architecture/v1/cross-cutting/market-gateway.md §3 (Edge→GW→마켓 단일 경로)
 *   - esm-shipping-list/index.ts (Edge 패턴 — ownership + loadCredential + adapter)
 *
 * 역할:
 *   s3 상품등록 3단계(마켓·카테고리)의 카테고리 select 를 위해 부모코드 직계 자식
 *   카테고리만 lazy 로 조회한다. 브라우저는 마켓 실도메인을 직접 fetch 하면 CORS 로
 *   전량 실패하므로(설계: Browser→Edge→gatewayFetch→GW→마켓), 본 Edge 가 단일 경로다.
 *   방대 카테고리(쿠팡)는 전체 트리 불가 → 부모 직계만 반환(11번가/ESM 도 동일 인터페이스).
 *
 * 처리 시퀀스 (POST { marketId, marketAccountId, parentId? } — functions.invoke body 규약):
 *   1. authenticated 셀러 JWT 검증 → sellerId
 *   2. body 검증 (CategoryChildrenRequestSchema)
 *   3. market_accounts 소유권 검증 (id=marketAccountId, seller_id 일치, market_id===marketId) → credential_id
 *   4. loadCredential — 11번가는 카테고리 키 불필요 → 로드 실패해도 진행(hydrate 스킵).
 *      그 외 마켓은 credential 필수.
 *   5. getMarketAdapter(marketId) → credential 있으면 hydrate
 *   6. fetchCategoryChildren 미구현(네이버) → category_not_supported(400)
 *   7. adapter.fetchCategoryChildren(parentId ?? null) → CategoryChildrenResponseSchema parse → 200
 *
 * 강제 (Backend INTJ 원칙 / CLAUDE.md):
 *   - 모든 마켓 호출은 어댑터 내부 gatewayFetch 경유 (raw fetch 금지). 조회는 멱등.
 *   - 토큰/키/PII 로그 절대 금지. sellerId(UUID) + 노드 개수만.
 *   - service_role 정당화: 셀러 JWT 로 ownership 검증 후 자기 계정의 credential 만 사용.
 *     credential 평문은 본 함수 메모리에만, 응답/로그로 노출 안 됨.
 */

import {
  CategoryChildrenRequestSchema,
  CategoryChildrenResponseSchema,
  type StoredCredential,
} from '../_shared/schemas.ts'
import {
  HttpErrors,
  MarketError,
  appendAudit,
  getMarketAdapter,
  getServiceClient,
  getUserClient,
  loadCredential,
  ok,
  parseBody,
  requireBearer,
  withRequest,
} from '../_shared/index.ts'
import { marketErrorToHttp } from './lib/error-map.ts'

// ─────────────────────────────────────────────
// 셀러 JWT → sellerId
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

// ─────────────────────────────────────────────
// market_account 소유권 + credential 해석
//   esm-shipping-list 의 resolveMarketAccount 유사 — 단, ESM 전용 site 매핑 없이
//   임의 마켓을 받고 market_id===요청 marketId 까지 검증한다.
// ─────────────────────────────────────────────

interface ResolvedAccount {
  credentialId: string
}

async function resolveMarketAccount(opts: {
  marketAccountId: string
  marketId: string
  sellerId: string
}): Promise<ResolvedAccount> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('market_accounts')
    .select('id, seller_id, market_id, credential_id, status')
    .eq('id', opts.marketAccountId)
    .maybeSingle()

  if (error || !data) {
    throw HttpErrors.notFound('market_account_not_found', 'market account not found')
  }
  // ownership — 타 셀러 계정 조회 금지.
  if (data.seller_id !== opts.sellerId) {
    throw HttpErrors.forbidden('forbidden', 'not your market account')
  }
  // market_id 불일치 — 요청 marketId 와 계정의 마켓이 다르면 거부(오용 방지).
  if (data.market_id !== opts.marketId) {
    throw HttpErrors.badRequest(
      'market_mismatch',
      'marketId does not match market account',
    )
  }
  // credential_id 는 11번가 graceful 경로를 위해 optional 로 다룬다(없어도 진행).
  return {
    credentialId: typeof data.credential_id === 'string' ? data.credential_id : '',
  }
}

// ─────────────────────────────────────────────
// Edge Function entry
// ─────────────────────────────────────────────

export default Deno.serve(
  withRequest('markets-category-children', async ({ req, logger, correlationId }) => {
    if (req.method !== 'POST') {
      throw HttpErrors.badRequest('method_not_allowed', 'POST required')
    }

    const body = await parseBody(req, CategoryChildrenRequestSchema)
    const sellerId = await resolveSellerId(req)
    const market = body.marketId
    const parentId = body.parentId ?? null

    // 1) market_account 소유권 + market_id 정합.
    const account = await resolveMarketAccount({
      marketAccountId: body.marketAccountId,
      marketId: market,
      sellerId,
    })

    // 2) credential 로드 — 11번가는 카테고리 키 불필요(graceful). 그 외 필수.
    let stored: StoredCredential | null = null
    if (market === '11st') {
      // 11번가 카테고리(1001) 는 키 불필요 — credential 없거나 로드 실패해도 진행.
      if (account.credentialId) {
        try {
          const cred = await loadCredential({
            credentialId: account.credentialId,
            correlationId,
            logger,
          })
          stored = { kind: cred.credentialKind, payload: cred.payload } as StoredCredential
        } catch {
          stored = null // 키 불필요 → 무시하고 진행.
        }
      }
    } else {
      if (!account.credentialId) {
        throw HttpErrors.internal('credential_missing', 'market account has no credential')
      }
      const cred = await loadCredential({
        credentialId: account.credentialId,
        correlationId,
        logger,
      })
      stored = { kind: cred.credentialKind, payload: cred.payload } as StoredCredential
    }

    // 3) 어댑터 — credential 있으면 hydrate.
    const adapter = getMarketAdapter(market)
    if (stored) {
      adapter.hydrate(stored)
    }

    // 4) 미구현 마켓(네이버) — 메서드 생략 → category_not_supported.
    if (!adapter.fetchCategoryChildren) {
      throw HttpErrors.badRequest(
        'category_not_supported',
        `${market} 카테고리 조회 미지원`,
      )
    }

    logger.info(
      { market, sellerId, hasParent: parentId !== null, correlationId },
      '→ market category children',
    )

    // 5) 직계 자식 조회 (어댑터 내부 gatewayFetch 경유).
    let nodes
    try {
      nodes = await adapter.fetchCategoryChildren(parentId)
    } catch (e) {
      if (e instanceof MarketError) {
        // 네이버 NOT_IMPL 이 혹시 throw 되면 category_not_supported 로 표면화.
        if (market === 'naver') {
          throw HttpErrors.badRequest(
            'category_not_supported',
            'naver 카테고리 조회 미지원',
          )
        }
        logger.error(
          { market, sellerId, marketErrorCode: e.code, correlationId },
          '← market category error',
        )
        const mapped = marketErrorToHttp(e.code)
        if (mapped.status === 429) {
          throw HttpErrors.rateLimit(e.context.retryAfterMs)
        }
        throw mapToHttpError(mapped.status, mapped.code, e.message)
      }
      throw e
    }

    const responseBody = CategoryChildrenResponseSchema.parse({ nodes })

    await appendAudit({
      category: 'registration',
      event: 'category_children_queried',
      sellerId,
      meta: { market, parentId, count: responseBody.nodes.length },
      correlationId,
      logger,
    })

    logger.info(
      { market, sellerId, count: responseBody.nodes.length, correlationId },
      '← market category children ok',
    )

    return ok(responseBody, { correlationId })
  }),
)

/** status/code/message → HttpError (HttpErrors 의 적절한 팩토리로 분기). */
function mapToHttpError(status: number, code: string, message: string) {
  if (status === 400) return HttpErrors.badRequest(code, message)
  if (status === 401) return HttpErrors.unauthorized(code, message)
  return HttpErrors.badGateway(code, message)
}
