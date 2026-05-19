/**
 * 마켓 자격증명 저장 / 복호화 RPC 호출 wrapper.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/credential-vault.md §4 (RPC 시퀀스, Wave 1 갱신)
 *   - docs/architecture/v1/security.md §4 (대원칙)
 *   - migration 016 (20260520000001_credential_payload_jsonb.sql)
 *     — fn_encrypt_and_store_credential / fn_decrypt_credential 4-way 통합
 *
 * v1 변경 (2026-05-19, Wave 2):
 *   - input/응답 시그니처를 OAuth 전용 (access/refresh) 에서 credentialKind + payload(jsonb)
 *     통합 구조로 전환. 4-way AuthInput (oauth | hmac | esm_jwt | api_key) 모두 동일 RPC.
 *   - tokenExpiresAt 은 oauth kind 만 필수. hmac/esm_jwt/api_key 는 null 허용.
 *     (마이그레이션 017 가 token_expires_at NOT NULL 을 완화.)
 *
 * 강제:
 *   - 본 모듈은 Edge Function (service_role) 만 호출. 클라이언트 직접 사용 금지.
 *   - 평문 payload 는 본 함수 호출 시점에만 메모리에 존재. 호출 후 즉시 스코프 종료.
 *   - RPC 응답 / 에러 메시지에 평문 payload / 마스터 키가 절대 노출 안 됨.
 *   - 로그는 `payloadLen` / `kid` / `correlationId` 만 (마스킹된 키 화이트리스트).
 */

import { currentKid, resolveMasterKey } from './env.ts'
import { HttpErrors } from './errors.ts'
import type { Logger } from './logger.ts'
import {
  MarketCredentialKindSchema,
  type MarketCredentialKind,
} from './schemas.ts'
import { getServiceClient } from './supabase.ts'

export interface StoreCredentialInput {
  sellerId: string
  marketId: string
  accountLabel: string
  credentialKind: MarketCredentialKind
  /** payload jsonb 내부 — 4-way kind 별 모양 (TokenSet | HmacKeyPayload | EsmJwtKeyPayload | ApiKeyPayload) */
  payload: Record<string, unknown>
  /** oauth kind 만 필수 (refresh 트리거 의존). 그 외 kind = null. */
  tokenExpiresAt: string | null
  /** oauth kind 만 의미. 그 외 kind = []. */
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
  credentialId: string
  sellerId: string
  marketId: string
  credentialKind: MarketCredentialKind
  /** jsonb payload. kind 별 모양은 호출측에서 추가 zod 검증. */
  payload: Record<string, unknown>
  tokenExpiresAt: string | null
  scope: string[]
  kid: string
  status: string
}

/**
 * OAuth 콜백 / 토큰 갱신 / HMAC·ESM 키 저장 직후 호출.
 * RPC: fn_encrypt_and_store_credential (마이그레이션 016 시그니처)
 *
 * 응답에는 credentialId 만 — 평문 payload 를 클라이언트로 반환 금지.
 */
export async function storeCredential(
  input: StoreCredentialInput,
): Promise<{ credentialId: string }> {
  // 방어적 검증 — RPC 진입 전 kind 가 유효 enum 인지.
  MarketCredentialKindSchema.parse(input.credentialKind)
  if (input.credentialKind === 'oauth' && !input.tokenExpiresAt) {
    throw HttpErrors.internal(
      'credential_store_invalid',
      'oauth credentialKind requires tokenExpiresAt',
    )
  }

  const kid = currentKid()
  const masterKey = resolveMasterKey(kid)
  const supabase = getServiceClient()

  input.logger.info(
    {
      sellerId: input.sellerId,
      market: input.marketId,
      credentialKind: input.credentialKind,
      kid,
      payloadKeyCount: Object.keys(input.payload).length,
      correlationId: input.correlationId,
    },
    '→ store credential',
  )

  const { data, error } = await supabase.rpc('fn_encrypt_and_store_credential', {
    p_seller_id: input.sellerId,
    p_market_id: input.marketId,
    p_account_label: input.accountLabel,
    p_credential_kind: input.credentialKind,
    p_payload: input.payload,
    p_token_expires_at: input.tokenExpiresAt,
    p_scope: input.scope,
    p_master_key: masterKey,
    p_kid: kid,
    p_correlation_id: input.correlationId,
  })

  if (error) {
    input.logger.error(
      {
        sellerId: input.sellerId,
        market: input.marketId,
        credentialKind: input.credentialKind,
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
      credentialKind: input.credentialKind,
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
 * RPC: fn_decrypt_credential (마이그레이션 016 시그니처)
 *
 * 만료(60초 내) 시 호출측이 별도 refresh Edge Function 으로 갱신
 * (현 RPC 자체에는 sync refresh 없음 — OQ-7).
 */
export async function loadCredential(
  input: LoadCredentialInput,
): Promise<DecryptedCredential> {
  const supabase = getServiceClient()

  // 1) row 의 kid 만 먼저 조회 (마스터 키 라우팅) + 상태 검증
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
    p_correlation_id: input.correlationId,
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

  // RPC return type = setof — 배열 또는 단일 row. 안전을 위해 첫 row 추출.
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') {
    throw HttpErrors.internal(
      'credential_load_malformed',
      'decrypt response malformed',
    )
  }
  const r = row as {
    credential_id?: string
    seller_id?: string
    market_id?: string
    credential_kind?: string
    payload?: unknown
    token_expires_at?: string | null
    scope?: string[] | null
    kid?: string
    status?: string
  }
  if (
    typeof r.credential_id !== 'string' ||
    typeof r.seller_id !== 'string' ||
    typeof r.market_id !== 'string' ||
    typeof r.credential_kind !== 'string' ||
    typeof r.payload !== 'object' ||
    r.payload === null
  ) {
    throw HttpErrors.internal(
      'credential_load_malformed',
      'decrypt response missing fields',
    )
  }

  const credentialKind = MarketCredentialKindSchema.parse(r.credential_kind)
  const payload = r.payload as Record<string, unknown>

  input.logger.info(
    {
      credentialId: input.credentialId,
      credentialKind,
      kid,
      payloadKeyCount: Object.keys(payload).length,
      correlationId: input.correlationId,
    },
    '← load credential ok',
  )

  return {
    credentialId: r.credential_id,
    sellerId: r.seller_id,
    marketId: r.market_id,
    credentialKind,
    payload,
    tokenExpiresAt: r.token_expires_at ?? null,
    scope: r.scope ?? [],
    kid: r.kid ?? kid,
    status: r.status ?? 'active',
  }
}
