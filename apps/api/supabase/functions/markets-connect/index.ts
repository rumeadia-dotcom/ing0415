/**
 * Edge Function: markets-connect
 *
 * 마스터:
 *   - docs/architecture/v1/features/markets.md §5.7 (Wave 2 신규)
 *   - docs/architecture/v1/cross-cutting/credential-vault.md §4 (RPC)
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §2.1 (AuthInput 4-way)
 *
 * 책임 (비-OAuth 인증 흐름):
 *   - 쿠팡(HMAC) / G마켓·옥션(ESM JWT) 처럼 OAuth 흐름이 없는 마켓의 키 입력 처리.
 *   - 입력 검증 → adapter.authenticate(credentials) → 추가 fetchCategoryTree() 핑
 *     → storeCredential → market_accounts UPSERT(active) + audit.
 *
 * 강제:
 *   - v1 활성 비-OAuth 마켓 = coupang | gmarket | auction. 네이버는 본 함수 금지 (OAuth 사용).
 *   - 11번가는 v1 미사용 — UI 가드 + 본 함수 zod enum 단계 거부.
 *   - 평문 키는 응답 body 에 절대 미노출.
 *   - withRetry 는 server / rate_limit / network 만. validation / unauthorized 즉시 실패.
 *   - ownership 검증 (JWT seller_id) + duplicate_label 체크.
 */

import { z } from 'npm:zod@3.23.8'
import {
  appendAudit,
  AuthInputSchema,
  env,
  getMarketAdapter,
  getServiceClient,
  getUserClient,
  HttpErrors,
  MarketError,
  ok,
  parseBody,
  storeCredential,
  withRequest,
  withRetry,
  type MarketCredentialKind,
} from '../_shared/index.ts'

const SUPPORTED_MARKETS = ['coupang', 'gmarket', 'auction'] as const
type SupportedMarket = (typeof SUPPORTED_MARKETS)[number]

const RequestSchema = z.object({
  marketId: z.enum(SUPPORTED_MARKETS),
  accountLabel: z.string().min(1).max(40),
  credentials: AuthInputSchema,
})

async function resolveSellerId(req: Request): Promise<string> {
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

/** marketId ↔ credential kind 정합 가드. UI 잘못 호출 시 400. */
function expectedAuthKind(market: SupportedMarket): 'hmac_key' | 'esm_jwt' {
  if (market === 'coupang') return 'hmac_key'
  return 'esm_jwt'
}

export default Deno.serve(
  withRequest('markets-connect', async ({ req, logger, correlationId }) => {
    if (req.method !== 'POST') {
      throw HttpErrors.badRequest('method_not_allowed', 'POST required')
    }
    const body = await parseBody(req, RequestSchema)
    const sellerId = await resolveSellerId(req)
    const market = body.marketId

    // marketId ↔ credential kind 정합
    const need = expectedAuthKind(market)
    if (body.credentials.kind !== need) {
      throw HttpErrors.badRequest(
        'credential_kind_mismatch',
        `${market} requires credentials.kind='${need}' (got '${body.credentials.kind}')`,
      )
    }

    const supabase = getServiceClient()

    // duplicate_label 검사 (oauth-start 와 동일 규칙)
    const { data: existing, error: dupErr } = await supabase
      .from('market_accounts')
      .select('id, status')
      .eq('seller_id', sellerId)
      .eq('market_id', market)
      .eq('account_label', body.accountLabel)
      .in('status', ['active', 'expired'])
      .maybeSingle()
    if (dupErr) {
      throw HttpErrors.internal('internal', 'duplicate check failed')
    }
    if (existing) {
      await appendAudit({
        category: 'markets',
        event: 'connect_initiated_rejected',
        sellerId,
        meta: { market, reason: 'duplicate_label' },
        correlationId,
        logger,
      })
      throw HttpErrors.conflict(
        'duplicate_label',
        'account label already exists for this market',
      )
    }

    await appendAudit({
      category: 'markets',
      event: 'connect_initiated',
      sellerId,
      meta: { market, mode: env.APP_MODE, kind: body.credentials.kind },
      correlationId,
      logger,
    })

    const auditFail = async (stage: string, reason: string): Promise<void> => {
      await appendAudit({
        category: 'markets',
        event: 'connect_failed',
        sellerId,
        meta: { market, reason, stage },
        correlationId,
        logger,
      })
      await supabase.from('market_account_audit').insert({
        account_id: null,
        seller_id: sellerId,
        market_id: market,
        event: 'connect_failed',
        correlation_id: correlationId,
        error_code: reason,
      })
    }
    const marketReason = (e: unknown): string =>
      e instanceof MarketError ? e.code : 'unknown'

    // 1) authenticate (키 검증). debug = mock, real = stub throw (Wave 5).
    const adapter = getMarketAdapter(market)
    let stored
    try {
      stored = await withRetry(() => adapter.authenticate(body.credentials), {
        market,
        correlationId,
        logger,
      })
    } catch (e) {
      const reason = marketReason(e)
      await auditFail('authenticate', reason)
      if (reason === 'unauthorized' || reason === 'validation') {
        throw HttpErrors.badRequest('invalid_credentials', 'market rejected the credentials')
      }
      if (reason === 'rate_limit') throw HttpErrors.rateLimit()
      throw HttpErrors.internal('market_unavailable', 'market currently unavailable')
    }
    const credentialKind: MarketCredentialKind = stored.kind

    // 2) fetchCategoryTree 핑
    try {
      await withRetry(() => adapter.fetchCategoryTree(), {
        market,
        correlationId,
        logger,
      })
    } catch (e) {
      const reason = marketReason(e)
      await auditFail('category_ping', reason)
      if (reason === 'rate_limit') throw HttpErrors.rateLimit()
      throw HttpErrors.internal('market_unavailable', 'category ping failed')
    }

    // 3) storeCredential (jsonb 통합 저장)
    let credentialId: string
    try {
      const res = await storeCredential({
        sellerId,
        marketId: market,
        accountLabel: body.accountLabel,
        credentialKind,
        payload: stored.payload as unknown as Record<string, unknown>,
        tokenExpiresAt: stored.expiresAt ?? null,
        scope: [],
        correlationId,
        logger,
      })
      credentialId = res.credentialId
    } catch {
      await auditFail('vault', 'vault_unavailable')
      throw HttpErrors.internal('vault_unavailable', 'credential vault unavailable')
    }

    // 4) market_accounts UPSERT
    const nowIso = new Date().toISOString()
    const { data: account, error: accErr } = await supabase
      .from('market_accounts')
      .upsert(
        {
          seller_id: sellerId,
          market_id: market,
          credential_id: credentialId,
          account_label: body.accountLabel,
          status: 'active',
          connected_at: nowIso,
          last_verified_at: nowIso,
          last_error_code: null,
          last_error_at: null,
          disconnected_at: null,
          updated_at: nowIso,
        },
        { onConflict: 'seller_id,market_id,account_label' },
      )
      .select('id, account_label, status, connected_at')
      .single()
    if (accErr || !account) {
      throw HttpErrors.internal('internal', 'failed to persist account')
    }

    // 5) audit
    await supabase.from('market_account_audit').insert({
      account_id: account.id,
      seller_id: sellerId,
      market_id: market,
      event: 'connect_succeeded',
      correlation_id: correlationId,
    })
    await appendAudit({
      category: 'markets',
      event: 'market_connect_success',
      sellerId,
      meta: { market, accountId: account.id, mode: env.APP_MODE, credentialKind },
      correlationId,
      logger,
    })

    logger.info(
      { sellerId, market, accountId: account.id, credentialKind, correlationId },
      '← markets-connect ok',
    )

    return ok(
      {
        accountId: account.id as string,
        market,
        accountLabel: account.account_label as string,
        status: 'active' as const,
        connectedAt: account.connected_at as string,
        correlationId,
      },
      { correlationId },
    )
  }),
)
