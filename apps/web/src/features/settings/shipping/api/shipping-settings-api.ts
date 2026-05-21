import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import {
  LogenApiErrorSchema,
  LogenCredentialsStatusSchema,
  LogenVerifyRequestSchema,
  LogenVerifyResponseSchema,
  SetLogenCredentialsArgsSchema,
  ShippingAutoDispatchSettingSchema,
  type LogenApiError,
  type LogenCredentialsStatus,
  type LogenVerifyRequest,
  type LogenVerifyResponse,
  type SetLogenCredentialsArgs,
  type ShippingAutoDispatchSetting,
} from '@/lib/schemas/logen'

/**
 * s9 배송 설정 도메인 API.
 *
 * 마스터: docs/spec/PRD-v2-shipping.md §4 / docs/spec/user_flow-v2-shipping.md s9
 *
 * 호출 매트릭스:
 *  - fetchLogenCredentialsStatus()   → RPC `get_logen_credentials_status` (평문 자격증명 절대 비반환)
 *  - setLogenCredentials(args)       → RPC `set_logen_credentials` (Edge 가 pgcrypto 암호화)
 *  - verifyLogenCredential(req)      → Edge Function `logen-verify-credential`
 *  - fetchAutoDispatchSetting()      → RPC `get_seller_auto_dispatch`
 *  - setAutoDispatchSetting(value)   → RPC `set_seller_auto_dispatch`
 *
 * RPC 정의는 PR2 (migrations) 가 제공한다. 본 PR 은 시그니처와 zod 응답 parse 만 책임.
 */

export class LogenApiInvocationError extends Error {
  readonly code: LogenApiError['code']
  readonly correlationId: string | null
  readonly raw: unknown

  constructor(payload: LogenApiError, raw?: unknown) {
    super(payload.message)
    this.name = 'LogenApiInvocationError'
    this.code = payload.code
    this.correlationId = payload.correlationId ?? null
    this.raw = raw
  }

  toApiError(): LogenApiError {
    return {
      code: this.code,
      message: this.message,
      correlationId: this.correlationId ?? crypto.randomUUID(),
    }
  }
}

// ─────────────────────────────────────────────
// 1. 자격증명 / 발송인 정보 상태
// ─────────────────────────────────────────────

export async function fetchLogenCredentialsStatus(): Promise<LogenCredentialsStatus> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .rpc('get_logen_credentials_status')
    .maybeSingle()
  if (error) {
    logger.warn({ err: error.message }, 'get_logen_credentials_status failed')
    throw new LogenApiInvocationError(
      { code: 'internal', message: error.message },
      error,
    )
  }
  // RPC 가 NULL row 반환 시 (자격증명 미설정) 기본 상태 반환
  if (data === null || data === undefined) {
    return {
      hasCredentials: false,
      hasSenderInfo: false,
      lastVerifiedAt: null,
      lastErrorAt: null,
      lastErrorCode: null,
      senderInfo: null,
    }
  }
  return LogenCredentialsStatusSchema.parse(data)
}

// ─────────────────────────────────────────────
// 2. 자격증명 / 발송인 정보 저장 (set_logen_credentials RPC)
// ─────────────────────────────────────────────

export async function setLogenCredentials(
  args: SetLogenCredentialsArgs,
): Promise<void> {
  const safe = SetLogenCredentialsArgsSchema.parse(args)
  const supabase = getSupabase()
  const { error } = await supabase.rpc('set_logen_credentials', {
    p_credentials: safe.credentials ?? null,
    p_sender_info: safe.senderInfo ?? null,
  })
  if (error) {
    logger.warn({ err: error.message }, 'set_logen_credentials failed')
    throw new LogenApiInvocationError(
      { code: 'internal', message: error.message },
      error,
    )
  }
  logger.debug({}, 'logen credentials saved')
}

// ─────────────────────────────────────────────
// 3. 연결 테스트 (logen-verify-credential Edge Function)
// ─────────────────────────────────────────────

export async function verifyLogenCredential(
  req: LogenVerifyRequest,
): Promise<LogenVerifyResponse> {
  const safeReq = LogenVerifyRequestSchema.parse(req)
  const supabase = getSupabase()
  const { data, error } = await supabase.functions.invoke<unknown>(
    'logen-verify-credential',
    { body: safeReq as unknown as Record<string, unknown> },
  )

  if (error) {
    logger.warn({ err: error.message }, '← logen-verify-credential error')
    const parsed = LogenApiErrorSchema.safeParse(
      (error as { context?: { body?: unknown } }).context?.body ?? data,
    )
    if (parsed.success) {
      throw new LogenApiInvocationError(parsed.data, error)
    }
    throw new LogenApiInvocationError(
      { code: 'internal', message: error.message },
      error,
    )
  }

  const errParsed = LogenApiErrorSchema.safeParse(data)
  if (errParsed.success) {
    throw new LogenApiInvocationError(errParsed.data, data)
  }

  return LogenVerifyResponseSchema.parse(data)
}

// ─────────────────────────────────────────────
// 4. 자동 송장 제출 설정 (sellers.auto_dispatch_after_print)
// ─────────────────────────────────────────────

export async function fetchAutoDispatchSetting(): Promise<ShippingAutoDispatchSetting> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .rpc('get_seller_auto_dispatch')
    .maybeSingle()
  if (error) {
    logger.warn({ err: error.message }, 'get_seller_auto_dispatch failed')
    throw new LogenApiInvocationError(
      { code: 'internal', message: error.message },
      error,
    )
  }
  if (data === null || data === undefined) {
    return { autoDispatchAfterPrint: false }
  }
  return ShippingAutoDispatchSettingSchema.parse(data)
}

export async function setAutoDispatchSetting(value: boolean): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.rpc('set_seller_auto_dispatch', {
    p_auto_dispatch: value,
  })
  if (error) {
    logger.warn({ err: error.message }, 'set_seller_auto_dispatch failed')
    throw new LogenApiInvocationError(
      { code: 'internal', message: error.message },
      error,
    )
  }
}

// ─────────────────────────────────────────────
// Query Key 팩토리
// ─────────────────────────────────────────────

export const shippingSettingsQueryKeys = {
  all: ['shipping-settings'] as const,
  credentialsStatus: (sellerId: string | null) =>
    ['shipping-settings', 'credentials-status', { sellerId }] as const,
  autoDispatch: (sellerId: string | null) =>
    ['shipping-settings', 'auto-dispatch', { sellerId }] as const,
}
