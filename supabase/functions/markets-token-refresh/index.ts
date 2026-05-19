/**
 * Edge Function: markets-token-refresh
 *
 * 마스터:
 *   - docs/architecture/v1/features/markets.md §5.4
 *   - docs/architecture/v1/cross-cutting/credential-vault.md §6 (자동 갱신·실패 처리)
 *
 * 책임:
 *   - scheduled (pg_cron): 만료 10분 이내 active credential 일괄 갱신.
 *   - on_demand: 단일 credentialId 갱신 (마켓 API 호출 직전 lazy 갱신).
 *   - adapter.refreshToken → storeCredential UPSERT (rotation 토큰 포함).
 *   - 실패 분기: unauthorized → revoked / 그 외 누적 3회 시 expired.
 *
 * 강제:
 *   - on_demand 는 호출자 ownership 검증 (seller_id == auth.uid()).
 *   - scheduled 는 인증된 cron 만 (Supabase pg_cron 의 service_role 호출).
 *     본 v1 에서는 Authorization: Bearer <service_role_key> 헤더로 식별.
 *   - 토큰 평문은 메모리 스코프 외 변수에 캐시 금지.
 *   - 모든 분기 audit 적재 (market_credentials_audit 은 RPC 내부에서, market_account_audit / audit_log 는 본 함수에서).
 */

import { z } from 'npm:zod@3.23.8'
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
  storeCredential,
  withRequest,
  withRetry,
} from '../_shared/index.ts'
import type { Logger, MarketId } from '../_shared/index.ts'

const RequestSchema = z
  .object({
    mode: z.enum(['scheduled', 'on_demand']),
    credentialId: z.string().uuid().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.mode === 'on_demand' && !val.credentialId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'credentialId required for on_demand',
        path: ['credentialId'],
      })
    }
  })

const SCHEDULED_BATCH_LIMIT = 100
const REFRESH_FAILURE_THRESHOLD = 3

interface CredentialMeta {
  credentialId: string
  sellerId: string
  marketId: MarketId
  accountLabel: string
}

interface RefreshOutcome {
  refreshed: boolean
  reason?: string
}

async function refreshOne(
  meta: CredentialMeta,
  ctx: { correlationId: string; logger: Logger },
): Promise<RefreshOutcome> {
  const supabase = getServiceClient()
  const adapter = getMarketAdapter(meta.marketId)

  // 1) 현재 refresh token 복호
  let decrypted
  try {
    decrypted = await loadCredential({
      credentialId: meta.credentialId,
      correlationId: ctx.correlationId,
      logger: ctx.logger,
    })
  } catch (_e) {
    return { refreshed: false, reason: 'decrypt_failed' }
  }

  // 2) adapter.refreshToken (withRetry — server / rate_limit / network 만 재시도)
  let newTokens
  try {
    newTokens = await withRetry(
      () => adapter.refreshToken(decrypted.refreshToken),
      { market: meta.marketId, correlationId: ctx.correlationId, logger: ctx.logger },
    )
  } catch (e) {
    if (e instanceof MarketError && e.code === 'unauthorized') {
      // invalid_grant / revoked → 즉시 revoked 처리
      await supabase
        .from('market_credentials')
        .update({
          status: 'revoked',
          last_refresh_error: 'invalid_grant',
          revoked_at: new Date().toISOString(),
        })
        .eq('id', meta.credentialId)
      await supabase
        .from('market_accounts')
        .update({
          status: 'revoked',
          last_error_code: 'invalid_grant',
          last_error_at: new Date().toISOString(),
        })
        .eq('credential_id', meta.credentialId)
      await supabase.from('market_account_audit').insert({
        account_id: null,
        seller_id: meta.sellerId,
        market_id: meta.marketId,
        event: 'auto_revoked',
        correlation_id: ctx.correlationId,
        error_code: 'invalid_grant',
      })
      await appendAudit({
        category: 'markets',
        event: 'token_refresh_failure',
        sellerId: meta.sellerId,
        meta: { market: meta.marketId, reason: 'invalid_grant' },
        correlationId: ctx.correlationId,
        logger: ctx.logger,
      })
      return { refreshed: false, reason: 'invalid_grant' }
    }

    // 그 외 실패 — refresh_failure_count 증가, threshold 초과 시 refresh_failed
    const reason =
      e instanceof MarketError ? e.code : 'unknown'
    const { data: row } = await supabase
      .from('market_credentials')
      .select('refresh_failure_count')
      .eq('id', meta.credentialId)
      .maybeSingle()
    const next = (row?.refresh_failure_count ?? 0) + 1
    const exceeded = next >= REFRESH_FAILURE_THRESHOLD

    await supabase
      .from('market_credentials')
      .update({
        last_refresh_error: reason,
        refresh_failure_count: next,
        status: exceeded ? 'refresh_failed' : 'active',
      })
      .eq('id', meta.credentialId)

    if (exceeded) {
      await supabase
        .from('market_accounts')
        .update({
          status: 'expired',
          last_error_code: reason,
          last_error_at: new Date().toISOString(),
        })
        .eq('credential_id', meta.credentialId)
      await supabase.from('market_account_audit').insert({
        account_id: null,
        seller_id: meta.sellerId,
        market_id: meta.marketId,
        event: 'auto_expired',
        correlation_id: ctx.correlationId,
        error_code: reason,
      })
    }

    await appendAudit({
      category: 'markets',
      event: 'token_refresh_failure',
      sellerId: meta.sellerId,
      meta: {
        market: meta.marketId,
        reason,
        failureCount: next,
        exceeded,
      },
      correlationId: ctx.correlationId,
      logger: ctx.logger,
    })
    return { refreshed: false, reason }
  }

  // 3) 성공 — storeCredential UPSERT (rotation 적용)
  await storeCredential({
    sellerId: meta.sellerId,
    marketId: meta.marketId,
    marketAccountLabel: meta.accountLabel,
    accessToken: newTokens.accessToken,
    refreshToken: newTokens.refreshToken,
    tokenExpiresAt: newTokens.expiresAt,
    scope: newTokens.scope ? newTokens.scope.split(/\s+/) : [],
    correlationId: ctx.correlationId,
    logger: ctx.logger,
  })

  // market_accounts.last_verified_at, status='active'
  await supabase
    .from('market_accounts')
    .update({
      status: 'active',
      last_verified_at: new Date().toISOString(),
      last_error_code: null,
      last_error_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('credential_id', meta.credentialId)

  await appendAudit({
    category: 'markets',
    event: 'token_refresh_success',
    sellerId: meta.sellerId,
    meta: { market: meta.marketId },
    correlationId: ctx.correlationId,
    logger: ctx.logger,
  })

  return { refreshed: true }
}

/** Authorization: Bearer <service_role_key> 가 scheduled cron 호출. */
function isServiceRoleCall(req: Request): boolean {
  const auth = req.headers.get('authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return false
  const token = auth.slice('bearer '.length).trim()
  // 안전 비교는 어렵지만 길이/eq 만 — env 값은 Edge Function 환경에서만 접근.
  return token === env.SUPABASE_SERVICE_ROLE_KEY
}

async function resolveSellerJwt(req: Request): Promise<string> {
  const auth = req.headers.get('authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    throw HttpErrors.unauthorized('missing_token', 'Authorization required')
  }
  const token = auth.slice('bearer '.length).trim()
  if (token.length < 10) {
    throw HttpErrors.unauthorized('invalid_token', 'token format invalid')
  }
  const supabase = getUserClient(token)
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw HttpErrors.unauthorized('invalid_token', 'jwt verification failed')
  }
  return data.user.id
}

export default Deno.serve(
  withRequest(
    'markets-token-refresh',
    async ({ req, logger, correlationId }) => {
      if (req.method !== 'POST') {
        throw HttpErrors.badRequest('method_not_allowed', 'POST required')
      }
      const body = await parseBody(req, RequestSchema)
      const supabase = getServiceClient()

      let targets: CredentialMeta[] = []

      if (body.mode === 'scheduled') {
        if (!isServiceRoleCall(req)) {
          throw HttpErrors.forbidden(
            'forbidden',
            'scheduled mode requires service_role',
          )
        }
        const tenMinAhead = new Date(Date.now() + 10 * 60 * 1000).toISOString()
        const { data, error } = await supabase
          .from('market_credentials')
          .select(
            'id, seller_id, market_id, market_account_label, token_expires_at',
          )
          .eq('status', 'active')
          .lt('token_expires_at', tenMinAhead)
          .order('token_expires_at', { ascending: true })
          .limit(SCHEDULED_BATCH_LIMIT)
        if (error) {
          throw HttpErrors.internal(
            'internal',
            'failed to list expiring credentials',
          )
        }
        targets = (data ?? []).map((r) => ({
          credentialId: r.id as string,
          sellerId: r.seller_id as string,
          marketId: r.market_id as MarketId,
          accountLabel: r.market_account_label as string,
        }))
      } else {
        // on_demand — ownership 검증
        const sellerId = await resolveSellerJwt(req)
        const { data, error } = await supabase
          .from('market_credentials')
          .select('id, seller_id, market_id, market_account_label')
          .eq('id', body.credentialId!)
          .maybeSingle()
        if (error || !data) {
          throw HttpErrors.notFound(
            'not_found',
            'credential not found',
          )
        }
        if (data.seller_id !== sellerId) {
          // 정보 누출 방지 — 동일 메시지
          throw HttpErrors.notFound('not_found', 'credential not found')
        }
        targets = [
          {
            credentialId: data.id as string,
            sellerId: data.seller_id as string,
            marketId: data.market_id as MarketId,
            accountLabel: data.market_account_label as string,
          },
        ]
      }

      let refreshed = 0
      let failed = 0
      for (const t of targets) {
        const outcome = await refreshOne(t, {
          correlationId,
          logger: logger.with({ market: t.marketId, sellerId: t.sellerId }),
        })
        if (outcome.refreshed) refreshed += 1
        else failed += 1
      }

      logger.info(
        {
          mode: body.mode,
          refreshed,
          failed,
          total: targets.length,
          correlationId,
        },
        '← token_refresh complete',
      )

      return ok(
        {
          refreshedCount: refreshed,
          failedCount: failed,
          correlationId,
        },
        { correlationId },
      )
    },
  ),
)
