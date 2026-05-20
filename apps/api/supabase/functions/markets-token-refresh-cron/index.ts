/**
 * Edge Function: markets-token-refresh-cron
 *
 * 마스터:
 *   - docs/architecture/v1/features/markets.md §5.4
 *   - docs/architecture/v1/cross-cutting/credential-vault.md §6
 *   - WIP-5markets-mvp.md C-1 Phase 3
 *
 * 책임:
 *   - 네이버 OAuth `market_accounts` 중 토큰 만료가 1시간 이내인 active 항목을
 *     일괄 refresh.
 *   - adapter.refreshToken (real / debug) → storeCredential UPSERT.
 *   - 실패 시 `market_accounts.status = 'needs_reauth'` 갱신 + Sentry/구조화 로그.
 *
 * vs `markets-token-refresh`:
 *   - 기존 `markets-token-refresh` 는 scheduled (오래 전 1주 단위) + on_demand 통합.
 *   - 본 함수는 **네이버 한정 / 만료 1시간 임박** 잡으로 분리 — 네이버 access token
 *     TTL 이 짧고 갱신 정책이 다른 마켓과 다르므로 별도 함수가 운영상 명확.
 *   - pg_cron 트리거는 supabase migrations 에서 별도 — 본 PR 은 함수 본문만.
 *
 * 강제:
 *   - Authorization: Bearer <service_role_key> 만 허용 (외부 호출 차단).
 *   - 한 번 호출에 SCHEDULED_BATCH_LIMIT 만큼만 처리 — 초과분은 다음 cron tick.
 *   - access/refresh 토큰은 로그에 절대 평문 포함 금지 (토큰은 길이만).
 */

import { z } from 'npm:zod@3.23.8'
import {
  appendAudit,
  captureMarketError,
  env,
  getMarketAdapter,
  getServiceClient,
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

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

const TARGET_MARKET: MarketId = 'naver'
export const SCHEDULED_BATCH_LIMIT = 50
export const REFRESH_WINDOW_MIN = 60 // 만료 1시간 이내
const REFRESH_FAILURE_THRESHOLD = 3

// ─────────────────────────────────────────────
// 요청 스키마
// ─────────────────────────────────────────────

const RequestSchema = z.object({
  // pg_cron 호환 — 기본 'cron'. 수동 트리거 시 'manual' 사용.
  source: z.enum(['cron', 'manual']).default('cron'),
})

// ─────────────────────────────────────────────
// 만료 임박 후보 조회
// ─────────────────────────────────────────────

export interface ExpiringCandidate {
  credentialId: string
  sellerId: string
  marketId: MarketId
  accountLabel: string
  tokenExpiresAt: string
}

/**
 * naver active OAuth credential 중 만료 windowMinutes 분 이내 항목 조회.
 *
 * 단위 테스트가 supabase 모킹 없이 검증할 수 있도록 시그니처를 단순화 — 호출측이
 * supabase 인스턴스 제공.
 */
export async function selectExpiringNaverCredentials(opts: {
  supabase: ReturnType<typeof getServiceClient>
  nowMs: number
  windowMinutes: number
  limit: number
}): Promise<ExpiringCandidate[]> {
  const horizon = new Date(opts.nowMs + opts.windowMinutes * 60 * 1000).toISOString()
  const { data, error } = await opts.supabase
    .from('market_credentials')
    .select(
      'id, seller_id, market_id, market_account_label, credential_kind, token_expires_at',
    )
    .eq('status', 'active')
    .eq('credential_kind', 'oauth')
    .eq('market_id', TARGET_MARKET)
    .lt('token_expires_at', horizon)
    .order('token_expires_at', { ascending: true })
    .limit(opts.limit)
  if (error) {
    throw HttpErrors.internal(
      'internal',
      'failed to list expiring naver credentials',
    )
  }
  return (data ?? []).map((r) => ({
    credentialId: r.id as string,
    sellerId: r.seller_id as string,
    marketId: r.market_id as MarketId,
    accountLabel: r.market_account_label as string,
    tokenExpiresAt: r.token_expires_at as string,
  }))
}

// ─────────────────────────────────────────────
// 단건 refresh
// ─────────────────────────────────────────────

export interface RefreshOutcome {
  refreshed: boolean
  reason?: string
  status?: 'active' | 'needs_reauth'
}

async function refreshOne(
  meta: ExpiringCandidate,
  ctx: { correlationId: string; logger: Logger },
): Promise<RefreshOutcome> {
  const supabase = getServiceClient()
  const adapter = getMarketAdapter(meta.marketId)
  const adapterRefresh = adapter.refreshToken
  if (typeof adapterRefresh !== 'function') {
    return { refreshed: false, reason: 'adapter_no_refresh' }
  }

  // 1) credential 복호화 → refresh token 확보
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
    return { refreshed: false, reason: 'non_oauth_kind' }
  }
  const oauthPayload = decrypted.payload as {
    accessToken?: string
    refreshToken?: string
  }
  const refreshTok = oauthPayload.refreshToken
  if (typeof refreshTok !== 'string' || refreshTok.length === 0) {
    return { refreshed: false, reason: 'no_refresh_token' }
  }

  // 2) adapter.refreshToken (withRetry — server/rate_limit/network 만 재시도)
  let newTokens
  try {
    newTokens = await withRetry(() => adapterRefresh(refreshTok), {
      market: meta.marketId,
      correlationId: ctx.correlationId,
      logger: ctx.logger,
    })
  } catch (e) {
    const code = e instanceof MarketError ? e.code : 'unknown'

    // 토큰 자체가 무효 → needs_reauth (셀러 재인증 필요)
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
          status: 'needs_reauth',
          last_error_code: 'invalid_grant',
          last_error_at: new Date().toISOString(),
        })
        .eq('credential_id', meta.credentialId)
      await supabase.from('market_account_audit').insert({
        account_id: null,
        seller_id: meta.sellerId,
        market_id: meta.marketId,
        event: 'needs_reauth',
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
      // Sentry 송출 — 토큰 마스킹은 captureMarketError 가 담당.
      if (e instanceof MarketError) {
        captureMarketError(e, {
          market: meta.marketId,
          sellerId: meta.sellerId,
          correlationId: ctx.correlationId,
        })
      }
      return {
        refreshed: false,
        reason: 'invalid_grant',
        status: 'needs_reauth',
      }
    }

    // 일시적 오류 — 누적 카운트 → 임계치 초과 시 needs_reauth 로 승격
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
        last_refresh_error: code,
        refresh_failure_count: next,
        status: exceeded ? 'refresh_failed' : 'active',
      })
      .eq('id', meta.credentialId)

    if (exceeded) {
      await supabase
        .from('market_accounts')
        .update({
          status: 'needs_reauth',
          last_error_code: code,
          last_error_at: new Date().toISOString(),
        })
        .eq('credential_id', meta.credentialId)
      await supabase.from('market_account_audit').insert({
        account_id: null,
        seller_id: meta.sellerId,
        market_id: meta.marketId,
        event: 'needs_reauth',
        correlation_id: ctx.correlationId,
        error_code: code,
      })
    }

    await appendAudit({
      category: 'markets',
      event: 'token_refresh_failure',
      sellerId: meta.sellerId,
      meta: {
        market: meta.marketId,
        reason: code,
        failureCount: next,
        exceeded,
      },
      correlationId: ctx.correlationId,
      logger: ctx.logger,
    })

    if (e instanceof MarketError) {
      captureMarketError(e, {
        market: meta.marketId,
        sellerId: meta.sellerId,
        correlationId: ctx.correlationId,
      })
    }
    return {
      refreshed: false,
      reason: code,
      status: exceeded ? 'needs_reauth' : 'active',
    }
  }

  // 3) 성공 — storeCredential rotation 적용
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

  return { refreshed: true, status: 'active' }
}

// ─────────────────────────────────────────────
// 호출자 인증 — service_role 만 허용
// ─────────────────────────────────────────────

function isServiceRoleCall(req: Request): boolean {
  const auth = req.headers.get('authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return false
  const token = auth.slice('bearer '.length).trim()
  return token === env.SUPABASE_SERVICE_ROLE_KEY
}

// ─────────────────────────────────────────────
// 진입점
// ─────────────────────────────────────────────

export default Deno.serve(
  withRequest(
    'markets-token-refresh-cron',
    async ({ req, logger, correlationId }) => {
      if (req.method !== 'POST') {
        throw HttpErrors.badRequest('method_not_allowed', 'POST required')
      }
      if (!isServiceRoleCall(req)) {
        throw HttpErrors.forbidden(
          'forbidden',
          'markets-token-refresh-cron requires service_role',
        )
      }
      await parseBody(req, RequestSchema)

      const supabase = getServiceClient()
      const targets = await selectExpiringNaverCredentials({
        supabase,
        nowMs: Date.now(),
        windowMinutes: REFRESH_WINDOW_MIN,
        limit: SCHEDULED_BATCH_LIMIT,
      })

      let refreshed = 0
      let failed = 0
      let needsReauth = 0
      for (const t of targets) {
        const outcome = await refreshOne(t, {
          correlationId,
          logger: logger.with({ market: t.marketId, sellerId: t.sellerId }),
        })
        if (outcome.refreshed) refreshed += 1
        else failed += 1
        if (outcome.status === 'needs_reauth') needsReauth += 1
      }

      logger.info(
        {
          source: 'cron',
          market: TARGET_MARKET,
          refreshed,
          failed,
          needsReauth,
          total: targets.length,
          correlationId,
        },
        '← naver token refresh cron complete',
      )

      return ok(
        {
          market: TARGET_MARKET,
          refreshedCount: refreshed,
          failedCount: failed,
          needsReauthCount: needsReauth,
          totalCount: targets.length,
          correlationId,
        },
        { correlationId },
      )
    },
  ),
)
