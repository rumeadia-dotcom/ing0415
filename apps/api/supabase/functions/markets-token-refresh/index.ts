/**
 * Edge Function: markets-token-refresh
 *
 * 마스터:
 *   - docs/architecture/v1/features/markets.md §5.4
 *   - docs/architecture/v1/cross-cutting/credential-vault.md §6
 *
 * 책임:
 *   - scheduled (pg_cron): 만료 10분 이내 active oauth credential 일괄 갱신.
 *   - on_demand: 단일 credentialId 갱신 (마켓 API 호출 직전 lazy 갱신).
 *   - adapter.refreshToken → storeCredential UPSERT (rotation 토큰 포함).
 *
 * v1 강제 (Wave 2 갱신):
 *   - 본 함수는 oauth credential 만 처리. hmac/esm_jwt/api_key kind 는 영구 키이므로
 *     skip — 호출 받아도 즉시 NO-OP (200 + message). 다른 마켓 호출도 동일.
 *   - 실패 분기: unauthorized → revoked / 그 외 누적 3회 시 expired.
 *   - on_demand 는 호출자 ownership 검증 (seller_id == auth.uid()).
 *   - scheduled 는 Authorization: Bearer <service_role_key> 헤더로 식별.
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
import type {
  Logger,
  MarketCredentialKind,
  MarketId,
} from '../_shared/index.ts'

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
  credentialKind: MarketCredentialKind
}

interface RefreshOutcome {
  refreshed: boolean
  reason?: string
  skipped?: boolean
}

async function refreshOne(
  meta: CredentialMeta,
  ctx: { correlationId: string; logger: Logger },
): Promise<RefreshOutcome> {
  // Wave 2: 영구 키 kind (hmac/esm_jwt/api_key) 는 갱신 대상 아님.
  if (meta.credentialKind !== 'oauth') {
    ctx.logger.info(
      {
        credentialId: meta.credentialId,
        market: meta.marketId,
        credentialKind: meta.credentialKind,
      },
      '↪ refresh skipped (non-oauth kind)',
    )
    return { refreshed: false, skipped: true, reason: 'non_oauth_kind' }
  }
  const supabase = getServiceClient()
  const adapter = getMarketAdapter(meta.marketId)
  const adapterRefresh = adapter.refreshToken
  if (typeof adapterRefresh !== 'function') {
    return { refreshed: false, skipped: true, reason: 'adapter_no_refresh' }
  }

  // 1) 현재 oauth credential 복호
  let decrypted
  try {
    decrypted = await loadCredential({
      credentialId: meta.credentialId,
      correlationId: ctx.correlationId,
      logger: ctx.logger,
    })
  } catch {
    return { refreshed: false, reason: 'decrypt_failed' }
  }
  if (decrypted.credentialKind !== 'oauth') {
    return { refreshed: false, skipped: true, reason: 'non_oauth_kind' }
  }
  const oauthPayload = decrypted.payload as {
    accessToken?: string
    refreshToken?: string
  }
  const refreshTok = oauthPayload.refreshToken
  if (typeof refreshTok !== 'string' || refreshTok.length === 0) {
    return { refreshed: false, reason: 'no_refresh_token' }
  }

  // 2) adapter.refreshToken (withRetry — server / rate_limit / network 만 재시도)
  let newTokens
  try {
    newTokens = await withRetry(() => adapterRefresh(refreshTok), {
      market: meta.marketId,
      correlationId: ctx.correlationId,
      logger: ctx.logger,
    })
  } catch (e) {
    if (e instanceof MarketError && e.code === 'unauthorized') {
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

    const reason = e instanceof MarketError ? e.code : 'unknown'
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

  // 3) 성공 — storeCredential UPSERT (oauth kind, rotation 적용)
  await storeCredential({
    sellerId: meta.sellerId,
    marketId: meta.marketId,
    accountLabel: meta.accountLabel,
    credentialKind: 'oauth',
    payload: newTokens as unknown as Record<string, unknown>,
    tokenExpiresAt: newTokens.expiresAt,
    scope: newTokens.scope ? newTokens.scope.split(/\s+/) : [],
    correlationId: ctx.correlationId,
    logger: ctx.logger,
  })

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

function isServiceRoleCall(req: Request): boolean {
  const auth = req.headers.get('authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return false
  const token = auth.slice('bearer '.length).trim()
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
        // Wave 2: oauth kind 만 — 다른 kind 는 token_expires_at NULL 이고 갱신 불필요.
        const { data, error } = await supabase
          .from('market_credentials')
          .select(
            'id, seller_id, market_id, market_account_label, credential_kind, token_expires_at',
          )
          .eq('status', 'active')
          .eq('credential_kind', 'oauth')
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
          credentialKind: r.credential_kind as MarketCredentialKind,
        }))
      } else {
        const sellerId = await resolveSellerJwt(req)
        if (!body.credentialId) {
          throw HttpErrors.badRequest(
            'validation',
            'credentialId required for on_demand',
          )
        }
        const credentialIdInput: string = body.credentialId
        const { data, error } = await supabase
          .from('market_credentials')
          .select(
            'id, seller_id, market_id, market_account_label, credential_kind',
          )
          .eq('id', credentialIdInput)
          .maybeSingle()
        if (error || !data) {
          throw HttpErrors.notFound('not_found', 'credential not found')
        }
        if (data.seller_id !== sellerId) {
          throw HttpErrors.notFound('not_found', 'credential not found')
        }
        const credKind = data.credential_kind as MarketCredentialKind
        if (credKind !== 'oauth') {
          // Wave 2: 영구 키 — NO-OP 즉시 응답.
          logger.info(
            {
              credentialId: data.id as string,
              market: data.market_id,
              credentialKind: credKind,
              correlationId,
            },
            '↪ refresh not applicable (non-oauth kind)',
          )
          return ok(
            {
              ok: true,
              message: 'refresh not applicable for this market',
              refreshedCount: 0,
              failedCount: 0,
              skippedCount: 1,
              correlationId,
            },
            { correlationId },
          )
        }
        targets = [
          {
            credentialId: data.id as string,
            sellerId: data.seller_id as string,
            marketId: data.market_id as MarketId,
            accountLabel: data.market_account_label as string,
            credentialKind: credKind,
          },
        ]
      }

      let refreshed = 0
      let failed = 0
      let skipped = 0
      for (const t of targets) {
        const outcome = await refreshOne(t, {
          correlationId,
          logger: logger.with({ market: t.marketId, sellerId: t.sellerId }),
        })
        if (outcome.refreshed) refreshed += 1
        else if (outcome.skipped) skipped += 1
        else failed += 1
      }

      logger.info(
        {
          mode: body.mode,
          refreshed,
          failed,
          skipped,
          total: targets.length,
          correlationId,
        },
        '← token_refresh complete',
      )

      return ok(
        {
          refreshedCount: refreshed,
          failedCount: failed,
          skippedCount: skipped,
          correlationId,
        },
        { correlationId },
      )
    },
  ),
)
