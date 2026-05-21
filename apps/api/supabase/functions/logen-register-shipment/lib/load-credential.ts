/**
 * 셀러별 로젠 자격증명 로드 (Edge Function service_role 전용).
 *
 * 마스터:
 *   - docs/spec/PRD.md §7 (로젠 API 인증)
 *   - apps/api/supabase/migrations/20260521000003_logen_credentials.sql (테이블 + view)
 *
 * 의존 (PR3):
 *   - RPC `fn_decrypt_logen_credential(p_seller_id uuid, p_master_key text)`
 *     → returns (user_id text, cust_cd text, sender_name text, sender_address text,
 *                sender_phone text, fare_ty text, dlv_fare int)
 *
 *   PR3 가 본 RPC 를 추가하기 전까지 본 함수는 throw — happy path 만 짠 코드 거부 규칙에 따라
 *   호출측이 'unauthorized' MarketError 로 분류해 orders.status = 'logen_failed' 진입.
 *
 * 강제:
 *   - userId / custCd 평문은 호출 스코프에서만 존재. 반환 값을 다시 로깅하면 안 됨.
 *   - 마스터 키는 currentKid() / resolveMasterKey() 통과 — 키 회전 패턴 (credential-vault.md §5).
 */

import {
  currentKid,
  HttpErrors,
  resolveMasterKey,
  type Logger,
} from '../../_shared/index.ts'
import type { getServiceClient } from '../../_shared/supabase.ts'
import type { LogenCredential } from './types.ts'

type Service = ReturnType<typeof getServiceClient>

interface DecryptedLogenRow {
  user_id?: string
  cust_cd?: string
  sender_name?: string
  sender_address?: string
  sender_phone?: string
  fare_ty?: string
  dlv_fare?: number
}

export interface LoadLogenCredentialInput {
  service: Service
  sellerId: string
  correlationId: string
  logger: Logger
}

export async function loadLogenCredential(
  input: LoadLogenCredentialInput,
): Promise<LogenCredential> {
  const kid = currentKid()
  const masterKey = resolveMasterKey(kid)

  input.logger.info(
    {
      sellerId: input.sellerId,
      kid,
      correlationId: input.correlationId,
    },
    '→ load logen credential',
  )

  const { data, error } = await input.service.rpc(
    'fn_decrypt_logen_credential',
    {
      p_seller_id: input.sellerId,
      p_master_key: masterKey,
    },
  )

  if (error || !data) {
    input.logger.error(
      {
        sellerId: input.sellerId,
        kid,
        correlationId: input.correlationId,
        rpcError: error?.code ?? 'not_found',
      },
      '← load logen credential error',
    )
    throw HttpErrors.notFound(
      'logen_credential_not_found',
      'logen credential not connected',
    )
  }

  const row = (Array.isArray(data) ? data[0] : data) as DecryptedLogenRow | null
  if (
    !row ||
    typeof row.user_id !== 'string' ||
    typeof row.cust_cd !== 'string' ||
    typeof row.sender_name !== 'string' ||
    typeof row.sender_address !== 'string' ||
    typeof row.sender_phone !== 'string' ||
    typeof row.fare_ty !== 'string'
  ) {
    throw HttpErrors.internal(
      'logen_credential_malformed',
      'decrypted logen credential missing fields',
    )
  }

  input.logger.info(
    {
      sellerId: input.sellerId,
      kid,
      correlationId: input.correlationId,
      userIdLen: row.user_id.length,
      custCdLen: row.cust_cd.length,
    },
    '← load logen credential ok',
  )

  return {
    userId: row.user_id,
    custCd: row.cust_cd,
    sender: {
      name: row.sender_name,
      address: row.sender_address,
      phone: row.sender_phone,
    },
    fare: {
      fareTy: row.fare_ty,
      dlvFare: typeof row.dlv_fare === 'number' ? row.dlv_fare : 0,
    },
  }
}
