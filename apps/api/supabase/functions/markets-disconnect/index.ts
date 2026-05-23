/**
 * Edge Function: markets-disconnect
 *
 * 마스터:
 *   - docs/architecture/v1/features/markets.md §5.5
 *   - docs/architecture/v1/cross-cutting/credential-vault.md §6.3 (revoke 처리)
 *
 * 책임:
 *   - 셀러 자발 연결 해제. ownership 검증 후 credential / account 상태 전환.
 *   - 마켓 측 revoke endpoint 호출은 v1 에서 생략 (어댑터 5메서드 외 — OQ-3 보존).
 *
 * 강제:
 *   - ownership 검증 누락 시 다른 셀러 row 접근 가능 — 직접 SQL 단계에서 seller_id == auth.uid() 강제.
 *   - 존재하지 않음 / 소유자 불일치 모두 동일 메시지 (not_found) — 정보 누출 차단.
 *   - market_credentials.status='revoked', market_accounts.status='revoked', audit 적재.
 */

import { z } from 'npm:zod@3.23.8'
import {
  appendAudit,
  getServiceClient,
  getUserClient,
  HttpErrors,
  ok,
  parseBody,
  withRequest,
} from '../_shared/index.ts'

const RequestSchema = z.object({
  accountId: z.string().uuid(),
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

export default Deno.serve(
  withRequest(
    'markets-disconnect',
    async ({ req, logger, correlationId }) => {
      if (req.method !== 'POST') {
        throw HttpErrors.badRequest('method_not_allowed', 'POST required')
      }
      const body = await parseBody(req, RequestSchema)
      const sellerId = await resolveSellerId(req)

      const supabase = getServiceClient()

      // ownership 검증 + 현재 상태 조회
      const { data: account, error: accErr } = await supabase
        .from('market_accounts')
        .select('id, seller_id, market_id, credential_id, status')
        .eq('id', body.accountId)
        .maybeSingle()

      if (accErr) {
        logger.error(
          {
            sellerId,
            accountId: body.accountId,
            rpcError: accErr.code ?? 'unknown',
            correlationId,
          },
          '← market_accounts lookup error',
        )
        throw HttpErrors.internal('internal', 'account lookup failed', {
          stage: 'account_lookup',
        })
      }
      if (!account || account.seller_id !== sellerId) {
        // 정보 누출 방지 — forbidden 도 not_found 로 통일
        throw HttpErrors.notFound('not_found', 'account not found')
      }

      const nowIso = new Date().toISOString()
      const credentialId = account.credential_id as string
      const marketId = account.market_id as string

      // market_credentials 상태 전이 (revoked)
      // 참고: credential-vault.md §10 의 audit 적재는 별도 RPC (fn_revoke_credential) 권장이나
      //       v1 에서는 직접 UPDATE + market_account_audit 으로 사용자 행동을 기록.
      //       토큰 자체 audit (encrypt/decrypt/rekey) 은 credential-vault audit 의 책임 — 여기서는 다루지 않음.
      const { error: credErr } = await supabase
        .from('market_credentials')
        .update({
          status: 'revoked',
          revoked_at: nowIso,
        })
        .eq('id', credentialId)
      if (credErr) {
        logger.error(
          {
            sellerId,
            accountId: body.accountId,
            credentialId,
            rpcError: credErr.code ?? 'unknown',
            correlationId,
          },
          '← market_credentials revoke error',
        )
        throw HttpErrors.internal('internal', 'credential revoke failed', {
          stage: 'vault_revoke',
        })
      }

      // market_accounts 상태 전이 (revoked)
      const { error: updErr } = await supabase
        .from('market_accounts')
        .update({
          status: 'revoked',
          disconnected_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', body.accountId)
      if (updErr) {
        logger.error(
          {
            sellerId,
            accountId: body.accountId,
            rpcError: updErr.code ?? 'unknown',
            correlationId,
          },
          '← market_accounts revoke error',
        )
        throw HttpErrors.internal('internal', 'account revoke failed', {
          stage: 'account_revoke',
        })
      }

      // market_account_audit
      await supabase.from('market_account_audit').insert({
        account_id: body.accountId,
        seller_id: sellerId,
        market_id: marketId,
        event: 'disconnected',
        correlation_id: correlationId,
      })

      // audit_log
      await appendAudit({
        category: 'markets',
        event: 'disconnect',
        sellerId,
        meta: {
          market: marketId,
          accountId: body.accountId,
          previousStatus: account.status,
        },
        correlationId,
        logger,
      })

      logger.info(
        {
          sellerId,
          accountId: body.accountId,
          market: marketId,
          correlationId,
        },
        '← disconnect ok',
      )

      return ok(
        {
          accountId: body.accountId,
          status: 'revoked' as const,
          correlationId,
        },
        { correlationId },
      )
    },
  ),
)
