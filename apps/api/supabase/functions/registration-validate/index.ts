/**
 * Edge Function: registration-validate
 *
 * 마스터:
 *   - docs/architecture/v1/features/registration.md §6.2
 *   - docs/architecture/v1/cross-cutting/registration-job-state.md §6.2.1
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §2, §7
 *
 * 책임:
 *   - Step 4 미리보기에서 호출. 잡 생성 없음 (preview only).
 *   - 단계: ownership → products/images/mappings SELECT → 마켓별 transformProduct
 *     시뮬레이션 → issues / previews 응답.
 *   - product_market_mappings.last_validated_at / last_validation_errors 캐시 갱신.
 *
 * 강제:
 *   - JWT 검증 후 sellerId 확정. RLS 통과 가능한 도메인 데이터만 조회 (lib/load.ts).
 *   - 한 마켓의 transform 실패가 다른 마켓 검증을 막지 않음.
 *   - 응답 body 에 PII / 토큰 / raw 마켓 응답 노출 금지.
 *   - 잡 생성·외부 마켓 API 호출 없음. transformProduct 는 순수 함수.
 */

import { z } from 'npm:zod@3.23.8'
import {
  appendAudit,
  getServiceClient,
  getUserClient,
  HttpErrors,
  MarketIdSchema,
  ok,
  parseBody,
  requireBearer,
  withRequest,
  type Logger,
  type MarketId,
} from '../_shared/index.ts'
import { loadProductBundle } from './lib/load.ts'
import { validateMarket } from './lib/check.ts'
import type { MarketPreview, ValidationIssue } from './lib/types.ts'

const RequestSchema = z.object({
  productId: z.string().uuid(),
  marketIds: z.array(MarketIdSchema).min(1).max(5),
})

async function updateMappingCache(
  service: ReturnType<typeof getServiceClient>,
  productId: string,
  sellerId: string,
  marketIds: readonly MarketId[],
  allIssues: readonly ValidationIssue[],
  logger: Logger,
): Promise<void> {
  for (const marketId of marketIds) {
    const marketIssues = allIssues.filter((i) => i.marketId === marketId)
    const { error } = await service
      .from('product_market_mappings')
      .update({
        last_validated_at: new Date().toISOString(),
        last_validation_errors: marketIssues.length > 0 ? marketIssues : null,
      })
      .eq('product_id', productId)
      .eq('seller_id', sellerId)
      .eq('market_id', marketId)
    if (error) {
      logger.warn(
        { market: marketId, rpcError: error.code ?? 'unknown' },
        '← validate cache update failed',
      )
      // 캐시 실패는 응답 차단 안 함.
    }
  }
}

export default Deno.serve(
  withRequest('registration-validate', async ({ req, logger, correlationId }) => {
    const jwt = requireBearer(req)
    const body = await parseBody(req, RequestSchema)

    // sellerId 확정 (JWT 검증)
    const userClient = getUserClient(jwt)
    const userRes = await userClient.auth.getUser()
    if (userRes.error || !userRes.data.user) {
      throw HttpErrors.unauthorized('invalid_token', 'jwt verification failed')
    }
    const sellerId = userRes.data.user.id

    logger.info(
      {
        event: 'registration_validate',
        sellerId,
        productId: body.productId,
        marketIds: body.marketIds,
        correlationId,
      },
      '→ registration validate',
    )

    const bundle = await loadProductBundle(jwt, body.productId, logger)

    // ownership 이중 검증 (RLS + 명시).
    if (bundle.product.seller_id !== sellerId) {
      throw HttpErrors.forbidden('forbidden_product', 'product not owned')
    }

    const allIssues: ValidationIssue[] = []
    const previews: MarketPreview[] = []

    for (const marketId of body.marketIds) {
      const { issues, preview } = validateMarket(
        marketId,
        bundle.product,
        bundle.images,
        bundle.mappings.get(marketId),
        logger,
      )
      allIssues.push(...issues)
      if (preview) previews.push(preview)
    }

    await updateMappingCache(
      getServiceClient(),
      body.productId,
      sellerId,
      body.marketIds,
      allIssues,
      logger,
    )

    await appendAudit({
      category: 'registration',
      event: 'registration.validate',
      sellerId,
      meta: {
        productId: body.productId,
        marketIds: body.marketIds,
        issueCount: allIssues.length,
      },
      correlationId,
      logger,
    })

    return ok(
      {
        ok: allIssues.length === 0,
        issues: allIssues,
        previews,
      },
      { correlationId },
    )
  }),
)
