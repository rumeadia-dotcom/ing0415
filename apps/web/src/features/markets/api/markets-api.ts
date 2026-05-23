import type { z } from 'zod'
import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import {
  ConnectRequestSchema,
  ConnectResponseSchema,
  DisconnectRequestSchema,
  DisconnectResponseSchema,
  MarketAccountSchema,
  MarketApiErrorSchema,
  OAuthCallbackRequestSchema,
  OAuthCallbackResponseSchema,
  OAuthStartRequestSchema,
  OAuthStartResponseSchema,
  VerifyRequestSchema,
  VerifyResponseSchema,
  type ConnectRequest,
  type ConnectResponse,
  type DisconnectRequest,
  type DisconnectResponse,
  type MarketAccount,
  type MarketApiError,
  type OAuthCallbackRequest,
  type OAuthCallbackResponse,
  type OAuthStartRequest,
  type OAuthStartResponse,
  type VerifyRequest,
  type VerifyResponse,
} from '@/lib/schemas/markets-feature'

/**
 * markets 도메인 Edge Function invoke 래퍼.
 * 마스터: docs/architecture/v1/features/markets.md §5 (Edge Functions) / §6 (zod 스키마)
 *
 * - 모든 호출은 zod 로 응답 parse → 스키마 위반 시 throw.
 * - Edge Function 에러 본문은 MarketApiErrorSchema 로 parse 시도 → MarketApiInvocationError 로 wrap.
 * - 클라이언트는 토큰 / credential 평문에 접근하지 않음 — 응답 schema 가 그것을 보장.
 */

export class MarketApiInvocationError extends Error {
  readonly code: string
  readonly correlationId: string | null
  readonly details: MarketApiError['details']
  readonly raw: unknown

  constructor(
    payload:
      | MarketApiError
      | { code: string; message: string; correlationId?: string; details?: MarketApiError['details'] },
    raw?: unknown,
  ) {
    super(payload.message)
    this.name = 'MarketApiInvocationError'
    this.code = payload.code
    this.correlationId = 'correlationId' in payload ? (payload.correlationId ?? null) : null
    this.details = 'details' in payload ? payload.details : undefined
    this.raw = raw
  }

  toApiError(): MarketApiError {
    return {
      code: this.code,
      message: this.message,
      correlationId: this.correlationId ?? crypto.randomUUID(),
      details: this.details,
    }
  }
}

interface InvokeOpts<TReq, TRes> {
  fn: string
  request: TReq
  requestSchema: z.ZodType<TReq>
  responseSchema: z.ZodType<TRes>
}

async function invokeEdge<TReq, TRes>({ fn, request, requestSchema, responseSchema }: InvokeOpts<TReq, TRes>): Promise<TRes> {
  // 요청 본문도 사전 parse — 잘못된 폼 데이터가 Edge Function 으로 가지 않게 클라이언트에서 차단
  const safeReq = requestSchema.parse(request)
  const supabase = getSupabase()
  const { data, error } = await supabase.functions.invoke<unknown>(fn, { body: safeReq as unknown as Record<string, unknown> })

  if (error) {
    logger.warn({ fn, err: error.message }, '← market edge function error')
    // Supabase JS v2 의 FunctionsHttpError 는 error.context 에 fetch Response 를 담는다.
    // error.context.body 는 ReadableStream 이라 직접 parse 불가 — response.json() 을 await 해야 함.
    // 이전엔 stream 그대로 schema.safeParse → 실패 → 'internal' fallback → UI 가 항상 "알 수 없는 오류" 표시.
    let errorBody: unknown = data
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.clone === 'function' && typeof ctx.json === 'function') {
      try {
        errorBody = await ctx.clone().json()
      } catch {
        // body 가 JSON 이 아닐 수 있음 — data 폴백 유지
      }
    }
    const parsed = MarketApiErrorSchema.safeParse(errorBody)
    if (parsed.success) {
      throw new MarketApiInvocationError(parsed.data, error)
    }
    throw new MarketApiInvocationError(
      { code: 'internal', message: error.message },
      error,
    )
  }

  // 일부 Edge Function 은 error 없이 본문에 { code, message } 를 담아 4xx 를 흉내낼 수 있음
  const errParsed = MarketApiErrorSchema.safeParse(data)
  if (errParsed.success && errParsed.data.code) {
    throw new MarketApiInvocationError(errParsed.data, data)
  }

  return responseSchema.parse(data)
}

// ─────────────────────────────────────────────
// 5종 mutation
// ─────────────────────────────────────────────

export function oauthStart(req: OAuthStartRequest): Promise<OAuthStartResponse> {
  return invokeEdge({
    fn: 'markets-oauth-start',
    request: req,
    requestSchema: OAuthStartRequestSchema,
    responseSchema: OAuthStartResponseSchema,
  })
}

export function oauthCallback(req: OAuthCallbackRequest): Promise<OAuthCallbackResponse> {
  return invokeEdge({
    fn: 'markets-oauth-callback',
    request: req,
    requestSchema: OAuthCallbackRequestSchema,
    responseSchema: OAuthCallbackResponseSchema,
  })
}

export function connectMarket(req: ConnectRequest): Promise<ConnectResponse> {
  return invokeEdge({
    fn: 'markets-connect',
    request: req,
    requestSchema: ConnectRequestSchema,
    responseSchema: ConnectResponseSchema,
  })
}

export function disconnectMarket(req: DisconnectRequest): Promise<DisconnectResponse> {
  return invokeEdge({
    fn: 'markets-disconnect',
    request: req,
    requestSchema: DisconnectRequestSchema,
    responseSchema: DisconnectResponseSchema,
  })
}

export function verifyMarket(req: VerifyRequest): Promise<VerifyResponse> {
  return invokeEdge({
    fn: 'markets-verify',
    request: req,
    requestSchema: VerifyRequestSchema,
    responseSchema: VerifyResponseSchema,
  })
}

// ─────────────────────────────────────────────
// list — RLS 적용된 직접 SELECT
// ─────────────────────────────────────────────

interface MarketAccountRow {
  id: string
  market_id: string
  account_label: string
  external_account_id: string | null
  status: string
  connected_at: string
  last_verified_at: string | null
  last_error_code: string | null
  last_error_at: string | null
}

function rowToAccount(row: MarketAccountRow): MarketAccount {
  return MarketAccountSchema.parse({
    id: row.id,
    marketId: row.market_id,
    accountLabel: row.account_label,
    externalAccountId: row.external_account_id,
    status: row.status,
    connectedAt: row.connected_at,
    lastVerifiedAt: row.last_verified_at,
    lastErrorCode: row.last_error_code,
    lastErrorAt: row.last_error_at,
  })
}

export async function listMarketAccounts(): Promise<MarketAccount[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('market_accounts')
    .select('id, market_id, account_label, external_account_id, status, connected_at, last_verified_at, last_error_code, last_error_at')
    .order('connected_at', { ascending: false })

  if (error) {
    logger.warn({ err: error.message }, '← market_accounts select error')
    throw new MarketApiInvocationError({ code: 'internal', message: error.message }, error)
  }

  return (data ?? []).map((row) => rowToAccount(row as MarketAccountRow))
}

// ─────────────────────────────────────────────
// Query Key 팩토리 (도메인 한정)
// ─────────────────────────────────────────────

export const marketQueryKeys = {
  all: ['markets'] as const,
  accounts: (sellerId: string | null) => ['markets', 'accounts', { sellerId }] as const,
}
