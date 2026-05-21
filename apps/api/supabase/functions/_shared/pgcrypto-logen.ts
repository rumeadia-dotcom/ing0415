/**
 * 로젠택배 자격증명 (logen_credentials) 암호화 저장 / 조회 RPC wrapper.
 *
 * 마스터:
 *   - docs/spec/PRD-v2-shipping.md §4 (logen_credentials 테이블 정의)
 *   - docs/architecture/v1/cross-cutting/credential-vault.md §4 (RPC 시퀀스)
 *   - docs/architecture/v1/security.md §4
 *
 * 의존:
 *   - PR2 마이그레이션 `20260521000005_logen_credentials_rpc.sql` 가 다음 RPC 를
 *     정의해야 한다:
 *     - fn_set_logen_credentials(
 *         p_seller_id uuid,
 *         p_user_id text,
 *         p_cust_cd text,
 *         p_sender_name text,
 *         p_sender_address text,
 *         p_sender_phone text,
 *         p_fare_ty text,
 *         p_dlv_fare int,
 *         p_master_key text,
 *         p_correlation_id text
 *       ) returns uuid (logen_credentials.id)
 *     - fn_get_logen_credentials(p_seller_id uuid, p_master_key text)
 *         returns (user_id text, cust_cd text, sender_name text, ...)
 *
 * 강제:
 *   - 본 모듈은 Edge Function (service_role) 에서만 호출.
 *   - userId / custCd 평문은 함수 인자로 잠깐 메모리에 존재. 호출 후 즉시 스코프 종료.
 *   - 로그에 평문 노출 금지 (길이 / kid / correlationId 만).
 */

import { currentKid, resolveMasterKey } from './env.ts'
import { HttpErrors } from './errors.ts'
import type { Logger } from './logger.ts'
import { getServiceClient } from './supabase.ts'

export interface SetLogenCredentialsInput {
  sellerId: string
  userId: string
  custCd: string
  senderName: string
  senderAddress: string
  senderPhone: string
  /** 운임구분 — PRD §2.2 fareTy. 기본 'C' (착불). */
  fareTy?: string
  /** 기본 운임 (원). 기본 0. */
  dlvFare?: number
  correlationId: string
  logger: Logger
}

export interface GetLogenCredentialsInput {
  sellerId: string
  correlationId: string
  logger: Logger
}

export interface DecryptedLogenCredentials {
  sellerId: string
  userId: string
  custCd: string
  senderName: string
  senderAddress: string
  senderPhone: string
  fareTy: string
  dlvFare: number
}

/**
 * 로젠 자격증명 저장 (upsert) — verify-credential 성공 직후 호출.
 *
 * RPC: fn_set_logen_credentials (PR2 마이그레이션)
 * 응답: logen_credentials.id (uuid)
 */
export async function setLogenCredentials(
  input: SetLogenCredentialsInput,
): Promise<{ credentialId: string }> {
  const kid = currentKid()
  const masterKey = resolveMasterKey(kid)
  const supabase = getServiceClient()

  input.logger.info(
    {
      sellerId: input.sellerId,
      market: 'logen',
      kid,
      userIdLen: input.userId.length,
      custCdLen: input.custCd.length,
      correlationId: input.correlationId,
    },
    '→ set logen credentials',
  )

  const { data, error } = await supabase.rpc('fn_set_logen_credentials', {
    p_seller_id: input.sellerId,
    p_user_id: input.userId,
    p_cust_cd: input.custCd,
    p_sender_name: input.senderName,
    p_sender_address: input.senderAddress,
    p_sender_phone: input.senderPhone,
    p_fare_ty: input.fareTy ?? 'C',
    p_dlv_fare: input.dlvFare ?? 0,
    p_master_key: masterKey,
    p_kid: kid,
    p_correlation_id: input.correlationId,
  })

  if (error) {
    input.logger.error(
      {
        sellerId: input.sellerId,
        market: 'logen',
        kid,
        rpcError: error.code ?? 'unknown',
        correlationId: input.correlationId,
      },
      '← set logen credentials error',
    )
    throw HttpErrors.internal(
      'logen_credentials_store_failed',
      'failed to persist logen credentials',
    )
  }

  const credentialId = typeof data === 'string' ? data : String(data)
  input.logger.info(
    {
      sellerId: input.sellerId,
      market: 'logen',
      credentialId,
      kid,
      correlationId: input.correlationId,
    },
    '← set logen credentials ok',
  )
  return { credentialId }
}

/**
 * 로젠 자격증명 복호화 — register-shipment / 운송장 출력 시점에 호출.
 *
 * RPC: fn_get_logen_credentials (PR2 마이그레이션)
 */
export async function getLogenCredentials(
  input: GetLogenCredentialsInput,
): Promise<DecryptedLogenCredentials> {
  const supabase = getServiceClient()

  // kid 우선 조회로 마스터 키 라우팅.
  const meta = await supabase
    .from('logen_credentials')
    .select('id, ciphertext_kid')
    .eq('seller_id', input.sellerId)
    .maybeSingle()

  if (meta.error || !meta.data) {
    input.logger.error(
      {
        sellerId: input.sellerId,
        market: 'logen',
        correlationId: input.correlationId,
        rpcError: meta.error?.code ?? 'not_found',
      },
      '← get logen credentials meta error',
    )
    throw HttpErrors.notFound(
      'logen_credentials_not_found',
      'logen credentials not found',
    )
  }

  const kid = (meta.data.ciphertext_kid as string) ?? currentKid()
  const masterKey = resolveMasterKey(kid)

  const { data, error } = await supabase.rpc('fn_get_logen_credentials', {
    p_seller_id: input.sellerId,
    p_master_key: masterKey,
    p_correlation_id: input.correlationId,
  })

  if (error || !data) {
    input.logger.error(
      {
        sellerId: input.sellerId,
        market: 'logen',
        kid,
        rpcError: error?.code ?? 'unknown',
        correlationId: input.correlationId,
      },
      '← get logen credentials error',
    )
    throw HttpErrors.internal(
      'logen_credentials_load_failed',
      'failed to load logen credentials',
    )
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') {
    throw HttpErrors.internal(
      'logen_credentials_malformed',
      'decrypt response malformed',
    )
  }
  const r = row as {
    user_id?: string
    cust_cd?: string
    sender_name?: string
    sender_address?: string
    sender_phone?: string
    fare_ty?: string
    dlv_fare?: number
  }
  if (
    typeof r.user_id !== 'string' ||
    typeof r.cust_cd !== 'string' ||
    typeof r.sender_name !== 'string' ||
    typeof r.sender_address !== 'string' ||
    typeof r.sender_phone !== 'string'
  ) {
    throw HttpErrors.internal(
      'logen_credentials_malformed',
      'decrypt response missing fields',
    )
  }

  input.logger.info(
    {
      sellerId: input.sellerId,
      market: 'logen',
      kid,
      correlationId: input.correlationId,
    },
    '← get logen credentials ok',
  )

  return {
    sellerId: input.sellerId,
    userId: r.user_id,
    custCd: r.cust_cd,
    senderName: r.sender_name,
    senderAddress: r.sender_address,
    senderPhone: r.sender_phone,
    fareTy: r.fare_ty ?? 'C',
    dlvFare: typeof r.dlv_fare === 'number' ? r.dlv_fare : 0,
  }
}
