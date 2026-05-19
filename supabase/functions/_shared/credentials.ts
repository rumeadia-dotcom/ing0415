/**
 * 마켓 자격증명 저장 / 복호화 RPC 호출 wrapper.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/credential-vault.md §4 (RPC 시퀀스)
 *   - docs/architecture/v1/security.md §4 (대원칙)
 *
 * 강제:
 *   - 본 모듈은 Edge Function (service_role) 만 호출. 클라이언트 직접 사용 금지.
 *   - 평문 토큰은 본 함수 호출 시점에만 메모리에 존재. 호출 후 즉시 GC 가능하도록
 *     호출측이 변수 스코프 좁힘.
 *   - RPC 응답 / 에러 메시지에 평문 토큰 / 마스터 키가 절대 노출 안 됨을 호출측이 확인.
 *   - 로그는 `tokenLen` / `kid` / `correlationId` 만 (마스킹된 키 화이트리스트).
 */

import { currentKid, resolveMasterKey } from './env.ts'
import { HttpErrors } from './errors.ts'
import type { Logger } from './logger.ts'
import { getServiceClient } from './supabase.ts'

export interface StoreCredentialInput {
  sellerId: string
  marketId: string
  marketAccountLabel: string
  accessToken: string
  refreshToken: string
  tokenExpiresAt: string // ISO 8601 + offset
  scope: string[]
  correlationId: string
  logger: Logger
}

export interface LoadCredentialInput {
  credentialId: string
  correlationId: string
  logger: Logger
}

export interface DecryptedCredential {
  accessToken: string
  refreshToken: string
  tokenExpiresAt: string
  kid: string
}

/**
 * OAuth 콜백 / 토큰 갱신 직후 호출.
 * RPC: fn_encrypt_and_store_credential (credential-vault.md §4.3)
 *
 * 응답에는 credentialId 만 — 평문 토큰을 클라이언트로 반환 금지.
 */
export async function storeCredential(
  input: StoreCredentialInput,
): Promise<{ credentialId: string }> {
  const kid = currentKid()
  const masterKey = resolveMasterKey(kid)
  const supabase = getServiceClient()

  input.logger.info(
    {
      sellerId: input.sellerId,
      market: input.marketId,
      kid,
      tokenLen: input.accessToken.length,
      correlationId: input.correlationId,
    },
    '→ store credential',
  )

  const { data, error } = await supabase.rpc('fn_encrypt_and_store_credential', {
    p_seller_id: input.sellerId,
    p_market_id: input.marketId,
    p_account_label: input.marketAccountLabel,
    p_access_token: input.accessToken,
    p_refresh_token: input.refreshToken,
    p_expires_at: input.tokenExpiresAt,
    p_scope: input.scope,
    p_master_key: masterKey,
    p_kid: kid,
  })

  if (error) {
    // 에러 메시지에는 마스터 키 / 토큰이 포함될 수 없도록 RPC 가 보장 (SECURITY DEFINER + raise 시 code 만).
    // 만약 마켓 측 raw response 가 섞이면 호출측 maskError 가 후속 마스킹.
    input.logger.error(
      {
        sellerId: input.sellerId,
        market: input.marketId,
        kid,
        rpcError: error.code ?? 'unknown',
        correlationId: input.correlationId,
      },
      '← store credential error',
    )
    throw HttpErrors.internal(
      'credential_store_failed',
      'failed to persist market credential',
    )
  }
  const credentialId = typeof data === 'string' ? data : String(data)
  input.logger.info(
    {
      sellerId: input.sellerId,
      market: input.marketId,
      credentialId,
      kid,
      correlationId: input.correlationId,
    },
    '← store credential ok',
  )
  return { credentialId }
}

/**
 * 마켓 API 호출 직전 호출. 복호 결과는 단일 함수 스코프에서만 사용.
 * RPC: fn_decrypt_credential (credential-vault.md §4.2)
 *
 * - 만료가 60초 내라면 RPC 가 동기 갱신 후 반환 (§6.1). 호출측은 추가 처리 불필요.
 *   단, 현재 v1 RPC 는 갱신 책임을 호출측 (refresh-token Edge Function) 으로 분리한
 *   상태이므로, 호출측이 expiresAt 검사 후 필요 시 별도 함수 호출. (Phase 후속 결정 OQ-7)
 */
export async function loadCredential(
  input: LoadCredentialInput,
): Promise<DecryptedCredential> {
  const supabase = getServiceClient()
  // 1) row 의 kid 만 먼저 조회 (마스터 키 라우팅)
  const meta = await supabase
    .from('market_credentials')
    .select('id, ciphertext_kid, status')
    .eq('id', input.credentialId)
    .maybeSingle()

  if (meta.error || !meta.data) {
    input.logger.error(
      {
        credentialId: input.credentialId,
        correlationId: input.correlationId,
        rpcError: meta.error?.code ?? 'not_found',
      },
      '← load credential meta error',
    )
    throw HttpErrors.notFound('credential_not_found', 'credential not found')
  }
  if (meta.data.status !== 'active') {
    throw HttpErrors.forbidden(
      'credential_inactive',
      `credential status: ${meta.data.status}`,
    )
  }

  const kid = meta.data.ciphertext_kid as string
  const masterKey = resolveMasterKey(kid)

  const { data, error } = await supabase.rpc('fn_decrypt_credential', {
    p_credential_id: input.credentialId,
    p_master_key: masterKey,
  })

  if (error || !data) {
    input.logger.error(
      {
        credentialId: input.credentialId,
        kid,
        correlationId: input.correlationId,
        rpcError: error?.code ?? 'unknown',
      },
      '← load credential error',
    )
    throw HttpErrors.internal(
      'credential_load_failed',
      'failed to load market credential',
    )
  }

  // RPC 응답은 OUT row — 키 이름은 RPC 정의와 동기 필요.
  // 안전을 위해 unknown 으로 받아 형식 검증.
  const row = data as {
    access_token: string
    refresh_token: string
    token_expires_at: string
  }
  if (
    typeof row.access_token !== 'string' ||
    typeof row.refresh_token !== 'string' ||
    typeof row.token_expires_at !== 'string'
  ) {
    throw HttpErrors.internal(
      'credential_load_malformed',
      'decrypt response malformed',
    )
  }

  input.logger.info(
    {
      credentialId: input.credentialId,
      kid,
      tokenLen: row.access_token.length,
      correlationId: input.correlationId,
    },
    '← load credential ok',
  )

  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    tokenExpiresAt: row.token_expires_at,
    kid,
  }
}
